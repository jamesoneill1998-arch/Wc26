// Deterministic demo data: two years of 30-minute contact history with
// trend, weekly and annual seasonality, a double-humped intraday curve,
// bank-holiday dips and noise. Lets prospects try the product instantly.

import { addDays, weekdayIndex, parseISODate } from './dates.js'

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(rand) {
  const u = Math.max(rand(), 1e-12)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

const WEEKDAY_SHAPE = [1.18, 1.06, 1.0, 0.98, 0.94, 0.52, 0.3]

/** Relative arrival weight for an interval starting at `mins`. */
export function demoIntradayWeight(mins, weekday) {
  const h = mins / 60
  if (weekday >= 5) {
    // Weekends: open 09:00-17:00, single hump.
    if (h < 9 || h >= 17) return 0
    return Math.exp(-((h - 12.5) ** 2) / 6)
  }
  if (h < 8 || h >= 20) return 0
  const morning = Math.exp(-((h - 10.5) ** 2) / 3.2)
  const afternoon = 0.8 * Math.exp(-((h - 14.5) ** 2) / 4.5)
  const evening = 0.25 * Math.exp(-((h - 18.5) ** 2) / 2)
  return morning + afternoon + evening
}

export function generateSampleHistory({ endDate, days = 728, baseDaily = 2400, intervalMin = 30, seed = 42 } = {}) {
  const rand = mulberry32(seed)
  const end = endDate ?? new Date().toISOString().slice(0, 10)
  const start = addDays(end, -(days - 1))
  const rows = []
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i)
    const wd = weekdayIndex(date)
    const doy = new Date(parseISODate(date)).getUTCMonth() * 30.4 + new Date(parseISODate(date)).getUTCDate()
    const trend = 1 + 0.12 * (i / 365)
    const annual = 1 + 0.12 * Math.cos((2 * Math.PI * (doy - 15)) / 365) // January peak
    const holiday = rand() < 0.012 ? 0.35 : 1
    const daily = baseDaily * trend * annual * WEEKDAY_SHAPE[wd] * holiday * (1 + 0.05 * gaussian(rand))
    const weights = []
    for (let m = 0; m < 1440; m += intervalMin) weights.push(demoIntradayWeight(m + intervalMin / 2, wd))
    const total = weights.reduce((s, w) => s + w, 0)
    const ahtBase = 300 + (wd === 0 ? 15 : 0) + 10 * Math.sin((2 * Math.PI * i) / 365)
    weights.forEach((w, k) => {
      if (w <= 0) return
      const mean = (daily * w) / total
      const volume = Math.max(0, Math.round(mean + Math.sqrt(mean) * gaussian(rand)))
      const aht = Math.round(ahtBase * (1 + 0.06 * gaussian(rand)))
      rows.push({ date, time: k * intervalMin, volume, aht })
    })
  }
  return rows
}
