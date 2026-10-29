// Scheduling: turn rosters into interval availability, and compare it with
// the requirement.
//
// Two sources of shifts:
//   patterns  weekly templates ("08:00–16:30, 30 min break, 14 Mon–Fri"),
//             applied to every week of the plan
//   imported  dated shifts from a rostering system's CSV export; where a
//             date has imported shifts they replace the patterns for that day
//
// A shift: { date, start, end, breaks: [[from, to]], count } with times in
// minutes from the shift date's midnight (end may pass 1440 for overnight).

import { parseTime, weekdayIndex, daysBetween, formatTime, addDays } from './dates.js'
import { splitCSVLine, detectDelimiter, normaliseDate, guessSlashOrder, normaliseHeader, parseClock } from './csv.js'
import { metricsFor } from './erlang.js'
import { erlangA } from './erlangA.js'
import { openWindow, slotsPerDay } from './profiles.js'

/** A break of `minutes` centred in the shift, snapped to `grain`. */
export function midBreak(start, end, minutes, grain = 15) {
  if (!(minutes > 0)) return []
  const from = Math.round(((start + end) / 2 - minutes / 2) / grain) * grain
  return [[from, from + minutes]]
}

/**
 * When a roster says "30 minutes' break" without times, assume breaks are
 * staggered across the middle of the shift (as a scheduler would) rather
 * than everyone leaving the floor at once. Window: up to 3 hours, centred.
 */
export function staggeredBreak(start, end, minutes) {
  if (!(minutes > 0)) return null
  const len = Math.max(minutes, Math.min(180, (end - start) / 2))
  const from = (start + end) / 2 - len / 2
  return { from, to: from + len, minutes }
}

const breakMinutes = (s) => s.breaks.reduce((t, [a, b]) => t + Math.max(0, b - a), 0) + (s.stagger?.minutes ?? 0)

/** Shift templates expanded onto real dates. */
export function shiftsFromPatterns(patterns, dates) {
  const out = []
  for (const date of dates) {
    const wd = weekdayIndex(date)
    for (const p of patterns ?? []) {
      const count = p.counts?.[wd] ?? 0
      if (!(count > 0)) continue
      const start = parseTime(p.start)
      let end = parseTime(p.end)
      if (start == null || end == null) continue
      if (end <= start) end += 1440
      out.push({ date, start, end, breaks: [], stagger: staggeredBreak(start, end, p.breakMin), count })
    }
  }
  return out
}

/** Imported shifts where they exist for a date, patterns otherwise. */
export function shiftsForDates(schedule, dates) {
  if (!dates.length) return []
  const imported = schedule?.shifts ?? []
  const importedDates = new Set(imported.map((s) => s.date))
  // Include the day before so overnight shifts spill into the first date.
  const span = [addDays(dates[0], -1), ...dates]
  const inSpan = new Set(span)
  return [
    ...imported.filter((s) => inSpan.has(s.date)),
    ...shiftsFromPatterns(schedule?.patterns, span.filter((d) => !importedDates.has(d))),
  ]
}

/**
 * People on shift (excluding breaks) per interval, for each date. Partial
 * overlap counts proportionally: on for 15 of 30 minutes is 0.5.
 */
export function onDutyGrid(shifts, dates, intervalMin) {
  const n = slotsPerDay(intervalMin)
  const grid = dates.map(() => new Array(n).fill(0))
  for (const s of shifts) {
    const base = daysBetween(dates[0], s.date)
    const first = Math.floor(s.start / intervalMin)
    const last = Math.ceil(s.end / intervalMin)
    for (let k = first; k < last; k++) {
      const a = k * intervalMin
      const b = a + intervalMin
      let on = Math.max(0, Math.min(b, s.end) - Math.max(a, s.start))
      for (const [x, y] of s.breaks) on -= Math.max(0, Math.min(b, y) - Math.max(a, x))
      if (s.stagger) {
        const g = s.stagger
        on -= (Math.max(0, Math.min(b, g.to) - Math.max(a, g.from)) * g.minutes) / (g.to - g.from)
      }
      if (on <= 1e-9) continue
      const day = base + Math.floor(a / 1440)
      if (day < 0 || day >= dates.length) continue
      grid[day][((k % n) + n) % n] += (on / intervalMin) * s.count
    }
  }
  return grid
}

/** Paid hours rostered on the given dates (breaks treated as unpaid). */
export function paidHours(shifts, dates) {
  const set = new Set(dates)
  return shifts.filter((s) => set.has(s.date)).reduce((t, s) => t + ((s.end - s.start - breakMinutes(s)) * s.count) / 60, 0)
}

/**
 * In-day shrinkage: the part of a site's shrinkage a roster doesn't already
 * show. Leave is excluded (people on leave aren't rostered) and so are
 * breaks (they're in the shifts).
 */
export function defaultInDayShrinkage(site) {
  const s = site?.shrinkage ?? {}
  return (s.sickness ?? 0) + (s.training ?? 0) + (s.meetings ?? 0) + (s.other ?? 0)
}

function queueAt(slots, q, s) {
  if (slots <= 0) return { sl: 0, abandon: s.queueModel === 'erlangA' ? 1 : null }
  if (s.queueModel === 'erlangA') {
    const r = erlangA(slots, { ...q, patienceSec: s.patienceSec })
    return { sl: r.serviceLevel, abandon: r.pAbandon }
  }
  return { sl: metricsFor(slots, q).serviceLevel, abandon: null }
}

/**
 * Service level and abandonment an interval would get with `available`
 * staff (whole people only). For branches, staff are shared out as evenly
 * as possible: with 37 across 25 branches, 12 branches get 2 and 13 get 1.
 */
export function projectInterval(available, iv, s) {
  if (!(iv.volume > 0.01)) return { sl: null, abandon: null }
  const k = Math.max(1, s.concurrency || 1)
  const people = Math.floor(available + 1e-9)
  const sites = s.channel === 'branch' ? Math.max(1, Math.round(s.branches || 1)) : 1
  const q = { volume: iv.volume / sites, ahtSec: iv.aht, intervalSec: s.intervalMin * 60, targetSec: s.targetSec }
  if (sites === 1) return queueAt(people * k, q, s)
  const base = Math.floor(people / sites)
  const extra = people - base * sites
  const lo = queueAt(base * k, q, s)
  if (!extra) return lo
  const hi = queueAt((base + 1) * k, q, s)
  const share = extra / sites
  return {
    sl: lo.sl * (1 - share) + hi.sl * share,
    abandon: lo.abandon == null ? null : lo.abandon * (1 - share) + hi.abandon * share,
  }
}

/**
 * Requirement against roster for a set of forecast days.
 * @param dayReqs   days from intervalRequirements / backofficeRequirements
 * @param schedule  service.schedule
 * @param s         resolved service settings
 * @param inDay     in-day shrinkage applied to rostered staff
 */
export function coverageForDays(dayReqs, schedule, s, inDay) {
  const dates = dayReqs.map((d) => d.date)
  const shifts = shiftsForDates(schedule, dates)
  const grid = onDutyGrid(shifts, dates, s.intervalMin)
  const importedDates = new Set((schedule?.shifts ?? []).map((x) => x.date))
  const keep = 1 - Math.min(0.9, Math.max(0, inDay))
  const hrs = s.intervalMin / 60
  const days = dayReqs.map((d, i) => {
    const onDutyHours = grid[i].reduce((t, v) => t + v * hrs, 0)
    const base = { date: d.date, volume: d.volume, source: importedDates.has(d.date) ? 'imported' : 'patterns', requiredHours: d.agentHours, availableHours: onDutyHours * keep }
    if (s.channel === 'backoffice') return { ...base, intervals: [], gapHours: base.availableHours - d.agentHours }
    let answeredWithin = 0
    let offered = 0
    let abandoned = 0
    let shortHours = 0
    let overHours = 0
    const intervals = d.intervals.map((iv, k) => {
      const onDuty = grid[i][k]
      const available = onDuty * keep
      const gap = available - iv.agents
      if (gap < 0) shortHours += -gap * hrs
      else overHours += gap * hrs
      const p = projectInterval(available, iv, s)
      if (p.sl != null) {
        answeredWithin += p.sl * iv.volume
        offered += iv.volume
        if (p.abandon != null) abandoned += p.abandon * iv.volume
      }
      return { time: iv.time, volume: iv.volume, aht: iv.aht, required: iv.agents, onDuty, available, gap, sl: p.sl, abandon: p.abandon, open: iv.open }
    })
    return {
      ...base,
      intervals,
      shortHours,
      overHours,
      serviceLevel: offered > 0 ? answeredWithin / offered : null,
      abandonRate: s.queueModel === 'erlangA' && offered > 0 ? abandoned / offered : null,
      offered,
    }
  })
  const offered = days.reduce((t, d) => t + (d.offered ?? 0), 0)
  return {
    days,
    shifts,
    paidHours: paidHours(shifts, dates),
    serviceLevel: offered > 0 ? days.reduce((t, d) => t + (d.serviceLevel ?? 0) * (d.offered ?? 0), 0) / offered : null,
    abandonRate: s.queueModel === 'erlangA' && offered > 0 ? days.reduce((t, d) => t + (d.abandonRate ?? 0) * (d.offered ?? 0), 0) / offered : null,
    shortHours: days.reduce((t, d) => t + (d.shortHours ?? Math.max(0, -(d.gapHours ?? 0))), 0),
    overHours: days.reduce((t, d) => t + (d.overHours ?? Math.max(0, d.gapHours ?? 0)), 0),
  }
}

// ── Import ──────────────────────────────────────────────────────────────────

const COLS = {
  date: ['date', 'day', 'shift_date', 'schedule_date', 'work_date'],
  start: ['start', 'shift_start', 'start_time', 'shift_start_time', 'scheduled_start', 'from', 'in'],
  end: ['end', 'shift_end', 'end_time', 'shift_end_time', 'scheduled_end', 'to', 'out', 'finish'],
  count: ['count', 'headcount', 'heads', 'agents', 'staff', 'fte'],
  breakStart: ['break_start', 'break1_start', 'break_1_start'],
  breakEnd: ['break_end', 'break1_end', 'break_1_end'],
  lunchStart: ['lunch_start', 'break2_start', 'break_2_start'],
  lunchEnd: ['lunch_end', 'break2_end', 'break_2_end'],
  breakMin: ['break_minutes', 'break_min', 'break_mins', 'unpaid_break', 'break'],
}

export const MAX_SCHEDULE_ROWS = 200000

/**
 * Parse a roster export. Names and IDs are ignored on purpose: only times
 * and counts are kept, so no personal data is stored.
 * @returns {{shifts, rows:number, errors:string[]}}
 */
export function parseScheduleCSV(text) {
  if (text.length > 25 * 1024 * 1024) return { shifts: [], rows: 0, errors: ['File is larger than 25 MB.'] }
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return { shifts: [], rows: 0, errors: ['File has no data rows.'] }
  if (lines.length > MAX_SCHEDULE_ROWS + 1) return { shifts: [], rows: 0, errors: [`File has more than ${MAX_SCHEDULE_ROWS.toLocaleString()} rows.`] }
  const delim = detectDelimiter(lines[0])
  const header = splitCSVLine(lines[0], delim).map(normaliseHeader)
  const col = Object.fromEntries(Object.entries(COLS).map(([k, names]) => [k, header.findIndex((h) => names.includes(h))]))
  const errors = []
  if (col.date < 0 || col.start < 0 || col.end < 0) {
    return { shifts: [], rows: 0, errors: ['Needs "date", "start" and "end" columns.'] }
  }
  const body = lines.slice(1).map((l) => splitCSVLine(l, delim))
  const order = guessSlashOrder(body.map((r) => r[col.date] ?? ''))
  const merged = new Map()
  let rows = 0
  body.forEach((r, i) => {
    const date = normaliseDate(r[col.date] ?? '', order)
    const start = parseClock(r[col.start] ?? '')
    let end = parseClock(r[col.end] ?? '')
    const count = col.count >= 0 && r[col.count] !== '' ? Number(r[col.count]) : 1
    if (!date || start == null || end == null || !Number.isFinite(count) || count <= 0 || count > 10000) {
      if (errors.length < 10) errors.push(`Row ${i + 2}: could not read "${r.join(delim).slice(0, 80)}".`)
      return
    }
    if (end <= start) end += 1440
    const breaks = []
    for (const [a, b] of [['breakStart', 'breakEnd'], ['lunchStart', 'lunchEnd']]) {
      if (col[a] < 0 || col[b] < 0) continue
      const x = parseClock(r[col[a]] ?? '')
      let y = parseClock(r[col[b]] ?? '')
      if (x == null || y == null) continue
      let from = x < start ? x + 1440 : x
      if (y < x) y += 1440
      y = from + (y - x)
      if (from >= start && y <= end) breaks.push([from, y])
    }
    const stagger = !breaks.length && col.breakMin >= 0 ? staggeredBreak(start, end, Math.min(240, Number(r[col.breakMin]) || 0)) : null
    const key = `${date}|${start}|${end}|${breaks.map((b) => b.join('-')).join(',')}|${stagger?.minutes ?? 0}`
    const cur = merged.get(key)
    if (cur) cur.count += count
    else merged.set(key, stagger ? { date, start, end, breaks, stagger, count } : { date, start, end, breaks, count })
    rows++
  })
  return { shifts: [...merged.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.start - b.start)), rows, errors }
}

// ── Shift suggestion ────────────────────────────────────────────────────────

/**
 * Greedy shift builder: repeatedly add the shift that covers the most unmet
 * requirement per minute worked, until extra shifts would mostly sit idle.
 * Not an optimiser, but a sound starting roster a planner can then edit.
 * @param reqWeek  7 arrays (Mon–Sun) of staff required per interval
 * @returns patterns [{ start, end, breakMin, counts[7] }]
 */
export function suggestPatterns(reqWeek, s, { inDay = 0.15, fullMin = 510, breakMin = 30, partMin = 240, minUseful = 0.6 } = {}) {
  const im = s.intervalMin
  const n = slotsPerDay(im)
  const keep = 1 - inDay
  const tally = new Map()
  for (let wd = 0; wd < 7; wd++) {
    const w = openWindow(s, wd)
    if (!w || !reqWeek[wd]) continue
    const need = reqWeek[wd].map((r) => r / keep)
    if (!need.some((v) => v > 0)) continue
    const full = Math.min(fullMin, w[1] - w[0])
    const part = Math.min(partMin, w[1] - w[0])
    const build = (len) => {
      const out = []
      if (len < 120) return out
      const brk = len >= 360 ? breakMin : 0
      for (let start = w[0]; start + len <= w[1]; start += im) {
        const shift = { date: '2000-01-03', start, end: start + len, breaks: [], stagger: staggeredBreak(start, start + len, brk), count: 1 }
        const frac = onDutyGrid([shift], ['2000-01-03'], im)[0]
        out.push({ start, end: start + len, brk, frac, total: frac.reduce((t, v) => t + v, 0) })
      }
      return out
    }
    const cover = new Array(n).fill(0)
    const add = (c) => {
      for (let k = 0; k < n; k++) cover[k] += c.frac[k]
      const key = `${c.start}|${c.end}|${c.brk}`
      if (!tally.has(key)) tally.set(key, { start: c.start, end: c.end, breakMin: c.brk, counts: new Array(7).fill(0) })
      tally.get(key).counts[wd] += 1
    }
    // Full-time shifts first, then part-time to top up what's left.
    for (const pool of [build(full), part < full ? build(part) : []]) {
      for (let guard = 0; guard < 2000; guard++) {
        let best = null
        for (const c of pool) {
          let useful = 0
          let score = 0
          for (let k = 0; k < n; k++) {
            if (!(c.frac[k] > 0) || !(need[k] > 0)) continue
            const deficit = Math.max(0, need[k] - cover[k])
            const u = Math.min(c.frac[k], deficit)
            useful += u
            // Favour intervals proportionally furthest from covered, so
            // early and late starts are balanced instead of starved.
            score += u * (deficit / need[k])
          }
          if (useful / c.total < minUseful) continue // mostly idle: don't add it
          if (!best || score > best.score) best = { c, score }
        }
        if (!best) break
        add(best.c)
      }
    }
  }
  return [...tally.values()]
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .map((p) => ({ start: formatTime(p.start), end: formatTime(p.end % 1440), breakMin: p.breakMin, counts: p.counts }))
}

/**
 * Back-office shifts: work can wait within the day, so only daily hours
 * matter. Enough full shifts per day to cover the hours needed, split
 * between an early and a late start when the day is longer than a shift.
 * @param dayReqs one week of back-office days ({ date, agentHours })
 */
export function suggestDailyPatterns(dayReqs, s, { inDay = 0.15, fullMin = 510, breakMin = 30 } = {}) {
  const tally = new Map()
  for (const d of dayReqs) {
    const wd = weekdayIndex(d.date)
    const w = openWindow(s, wd)
    if (!w || !(d.agentHours > 0)) continue
    const len = Math.min(fullMin, w[1] - w[0])
    const brk = len >= 360 ? breakMin : 0
    const netHours = ((len - brk) / 60) * (1 - inDay)
    const total = Math.ceil(d.agentHours / netHours - 1e-9)
    const starts = w[1] - w[0] > len ? [w[0], w[1] - len] : [w[0]]
    starts.forEach((start, i) => {
      const count = Math.floor(total / starts.length) + (i < total % starts.length ? 1 : 0)
      if (!count) return
      const key = `${start}|${start + len}|${brk}`
      if (!tally.has(key)) tally.set(key, { start, end: start + len, breakMin: brk, counts: new Array(7).fill(0) })
      tally.get(key).counts[wd] += count
    })
  }
  return [...tally.values()]
    .sort((a, b) => a.start - b.start)
    .map((p) => ({ start: formatTime(p.start), end: formatTime(p.end % 1440), breakMin: p.breakMin, counts: p.counts }))
}
