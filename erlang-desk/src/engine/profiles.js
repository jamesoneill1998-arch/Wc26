// Intraday arrival profiles: what share of a day's contacts lands in each
// interval, per weekday. Learnt from interval history when available,
// otherwise shaped from the configured opening hours.

import { parseTime, weekdayIndex } from './dates.js'

export const slotsPerDay = (intervalMin) => Math.round(1440 / intervalMin)

/** Opening window for a weekday as [openMins, closeMins) or null when closed. */
export function openWindow(settings, wd) {
  const h = settings.hours?.[wd]
  if (!h) return null
  const open = parseTime(h.open)
  let close = parseTime(h.close)
  if (open == null || close == null) return null
  if (close <= open) close = 1440 // "00:00" close means midnight
  return [open, close]
}

export function isOpen(settings, wd, mins) {
  const w = openWindow(settings, wd)
  return !!w && mins >= w[0] && mins < w[1]
}

/** A plausible contact-centre curve across the open hours: morning peak, softer afternoon. */
export function defaultProfiles(settings) {
  const n = slotsPerDay(settings.intervalMin)
  const volume = []
  for (let wd = 0; wd < 7; wd++) {
    const w = openWindow(settings, wd)
    const row = new Array(n).fill(0)
    if (w) {
      const len = w[1] - w[0]
      for (let s = 0; s < n; s++) {
        const mid = s * settings.intervalMin + settings.intervalMin / 2
        if (mid < w[0] || mid >= w[1]) continue
        const x = (mid - w[0]) / len // 0..1 through the day
        row[s] = 0.25 + Math.exp(-((x - 0.25) ** 2) / 0.02) + 0.75 * Math.exp(-((x - 0.58) ** 2) / 0.03)
      }
    }
    volume.push(normalise(row))
  }
  return { source: 'default', volume, aht: null }
}

function normalise(row) {
  const t = row.reduce((s, v) => s + v, 0)
  return t > 0 ? row.map((v) => v / t) : row
}

/**
 * Learn weekday profiles from interval rows ({date, time, volume, aht?}),
 * using the most recent `weeks` weeks. Data at a finer grain is summed into
 * the plan interval; coarser data is spread evenly across sub-intervals.
 */
export function learnProfiles(intervalRows, intervalMin, weeks = 8) {
  if (!intervalRows.length) return null
  const n = slotsPerDay(intervalMin)
  const last = intervalRows.reduce((m, r) => (r.date > m ? r.date : m), intervalRows[0].date)
  const cutoff = new Date(Date.parse(last) - weeks * 7 * 86400000).toISOString().slice(0, 10)
  const times = [...new Set(intervalRows.map((r) => r.time))].sort((a, b) => a - b)
  let dataGrain = Infinity
  for (let i = 1; i < times.length; i++) dataGrain = Math.min(dataGrain, times[i] - times[i - 1])
  if (!Number.isFinite(dataGrain)) dataGrain = intervalMin
  const vol = Array.from({ length: 7 }, () => new Array(n).fill(0))
  const work = Array.from({ length: 7 }, () => new Array(n).fill(0))
  const workVol = Array.from({ length: 7 }, () => new Array(n).fill(0))
  for (const r of intervalRows) {
    if (r.date <= cutoff) continue
    const wd = weekdayIndex(r.date)
    const parts = Math.max(1, Math.round(dataGrain / intervalMin))
    for (let p = 0; p < parts; p++) {
      const s = Math.floor((r.time + p * intervalMin) / intervalMin)
      if (s < 0 || s >= n) continue
      const v = r.volume / parts
      vol[wd][s] += v
      if (r.aht) { work[wd][s] += r.aht * v; workVol[wd][s] += v }
    }
  }
  const hasAht = workVol.some((row) => row.some((v) => v > 0))
  return {
    source: 'history',
    volume: vol.map(normalise),
    aht: hasAht ? work.map((row, wd) => row.map((w, s) => (workVol[wd][s] > 0 ? w / workVol[wd][s] : null))) : null,
  }
}

/** Volume-weighted AHT per weekday from the last `weeks` weeks of daily rows. */
export function weekdayAht(dailyRows, fallback, weeks = 8) {
  const withAht = dailyRows.filter((r) => r.aht)
  if (!withAht.length) return new Array(7).fill(fallback)
  const last = withAht[withAht.length - 1].date
  const cutoff = new Date(Date.parse(last) - weeks * 7 * 86400000).toISOString().slice(0, 10)
  const w = new Array(7).fill(0)
  const v = new Array(7).fill(0)
  for (const r of withAht) {
    if (r.date <= cutoff) continue
    const wd = weekdayIndex(r.date)
    w[wd] += r.aht * r.volume
    v[wd] += r.volume
  }
  return w.map((x, i) => (v[i] > 0 ? x / v[i] : fallback))
}
