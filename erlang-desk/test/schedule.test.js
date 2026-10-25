import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shiftsFromPatterns, onDutyGrid, parseScheduleCSV, coverageForDays, suggestPatterns, suggestDailyPatterns, paidHours, midBreak, projectInterval, defaultInDayShrinkage, shiftsForDates } from '../src/engine/schedule.js'
import { defaultServiceSettings, defaultSites, resolveSettings } from '../src/engine/channels.js'
import { intervalRequirements, backofficeRequirements } from '../src/engine/capacity.js'
import { defaultProfiles } from '../src/engine/profiles.js'

const MON = '2026-10-26'
const week = Array.from({ length: 7 }, (_, i) => `2026-10-${26 + i}`.replace('2026-10-32', '2026-11-01'))

test('patterns expand onto dates by weekday', () => {
  const shifts = shiftsFromPatterns([{ start: '08:00', end: '16:30', breakMin: 30, counts: [10, 9, 0, 0, 0, 0, 2] }], week)
  assert.deepEqual(shifts.map((s) => [s.date, s.count]), [[MON, 10], ['2026-10-27', 9], ['2026-11-01', 2]])
  assert.deepEqual(shifts[0].stagger, { from: 645, to: 825, minutes: 30 }) // spread over 10:45-13:45
  const g = onDutyGrid(shifts.slice(0, 1), [MON], 30)[0]
  assert.equal(g[16], 10) // 08:00, nobody on break
  assert.ok(Math.abs(g[24] - 10 * (1 - 30 / 180)) < 1e-9) // 12:00, a sixth of the team on break
  assert.ok(Math.abs(g.reduce((t, v) => t + v, 0) * 30 - 10 * 480) < 1e-6) // 8 h on the floor each
})

test('coverage counts partial intervals and removes breaks', () => {
  const shifts = [{ date: MON, start: 8 * 60 + 15, end: 10 * 60, breaks: [[540, 555]], count: 4 }]
  const g = onDutyGrid(shifts, [MON], 30)[0]
  assert.equal(g[16], 2) // 08:00-08:30: on for 15 of 30 min × 4 people
  assert.equal(g[17], 4) // 08:30-09:00
  assert.equal(g[18], 2) // 09:00-09:30 minus a 15-minute break
  assert.equal(g[19], 4)
  assert.equal(g[20], 0)
  assert.equal(paidHours(shifts, [MON]), (105 - 15) * 4 / 60)
})

test('overnight shifts spill into the next day, including from the day before', () => {
  const night = [{ start: '22:00', end: '06:00', breakMin: 0, counts: [0, 0, 0, 0, 0, 0, 3] }] // Sunday nights
  const sched = { patterns: night, shifts: [] }
  const shifts = shiftsForDates(sched, [MON])
  const g = onDutyGrid(shifts, [MON], 60)[0]
  assert.equal(g[0], 3) // Sunday's 22:00 shift is still on at Monday 00:00
  assert.equal(g[5], 3)
  assert.equal(g[6], 0)
})

test('imported schedules: aliases, breaks, merged counts, names discarded', () => {
  const csv = [
    'Agent Name,Date,Shift Start,Shift End,Lunch Start,Lunch End',
    'Alice Smith,26/10/2026,08:00,16:30,12:00,12:30',
    'Bob Jones,26/10/2026,08:00,16:30,12:00,12:30',
    'Cara Lee,26/10/2026,22:00,06:00,02:00,02:30',
    'Dan,not a date,09:00,17:00,,',
  ].join('\n')
  const r = parseScheduleCSV(csv)
  assert.equal(r.rows, 3)
  assert.equal(r.errors.length, 1)
  assert.equal(r.shifts.length, 2)
  assert.deepEqual(r.shifts[0], { date: MON, start: 480, end: 990, breaks: [[720, 750]], count: 2 })
  assert.deepEqual(r.shifts[1].breaks, [[1560, 1590]]) // 02:00 next day
  assert.ok(!JSON.stringify(r.shifts).includes('Alice'))
  const r2 = parseScheduleCSV('date,start,end,headcount,break_minutes\n2026-10-26,09:00,17:30,5,30\n')
  assert.deepEqual(r2.shifts[0], { date: MON, start: 540, end: 1050, breaks: [], stagger: { from: 705, to: 885, minutes: 30 }, count: 5 })
  assert.equal(paidHours(r2.shifts, [MON]), 5 * 8)
  assert.ok(parseScheduleCSV('date,start\n2026-10-26,09:00').errors.length)
})

test('imported shifts replace patterns on their dates only', () => {
  const sched = { patterns: [{ start: '09:00', end: '17:00', breakMin: 0, counts: [5, 5, 5, 5, 5, 0, 0] }], shifts: [{ date: MON, start: 600, end: 660, breaks: [], count: 1 }] }
  const g = onDutyGrid(shiftsForDates(sched, week.slice(0, 2)), week.slice(0, 2), 60)
  assert.equal(g[0][9], 0)
  assert.equal(g[0][10], 1)
  assert.equal(g[1][9], 5)
})

test('in-day shrinkage excludes leave and breaks', () => {
  const [uk, os] = defaultSites()
  assert.ok(Math.abs(defaultInDayShrinkage(uk) - 0.15) < 1e-9)
  assert.ok(Math.abs(defaultInDayShrinkage(os) - 0.08) < 1e-9)
})

function voiceWeek(volume = 2000) {
  const site = defaultSites()[0]
  const s = resolveSettings({ channel: 'voice', settings: defaultServiceSettings('voice') }, site)
  const days = week.map((date, i) => ({ date, volume: i < 5 ? volume : i === 5 ? volume / 2 : volume / 4 }))
  return { s, reqs: intervalRequirements(days, defaultProfiles(s), new Array(7).fill(300), s) }
}

test('coverage compares roster with requirement and projects service level', () => {
  const { s, reqs } = voiceWeek()
  const none = coverageForDays(reqs, { patterns: [], shifts: [] }, s, 0.15)
  assert.equal(none.serviceLevel, 0)
  assert.ok(none.shortHours > 0 && none.overHours === 0)
  const lots = coverageForDays(reqs, { patterns: [{ start: '08:00', end: '20:00', breakMin: 0, counts: [200, 200, 200, 200, 200, 200, 200] }], shifts: [] }, s, 0.15)
  assert.ok(lots.serviceLevel > 0.99)
  assert.ok(lots.overHours > 0)
  const iv = lots.days[0].intervals.find((x) => x.volume > 1)
  assert.equal(iv.available, 200 * 0.85)
  assert.ok(Math.abs(iv.gap - (iv.available - iv.required)) < 1e-9)
})

test('projected service level matches the requirement it was sized for', () => {
  const { s, reqs } = voiceWeek()
  const iv = reqs[0].intervals.find((x) => x.volume > 50)
  const at = projectInterval(iv.agents, iv, s)
  const below = projectInterval(iv.agents - 1, iv, s)
  assert.ok(at.sl >= s.slTarget || iv.occ <= s.maxOccupancy)
  assert.ok(below.sl < at.sl)
})

test('suggested shifts cover most of the requirement without large waste', () => {
  const { s, reqs } = voiceWeek()
  const reqWeek = reqs.map((d) => d.intervals.map((iv) => iv.agents))
  const patterns = suggestPatterns(reqWeek, s, { inDay: 0.15 })
  assert.ok(patterns.length >= 3, `${patterns.length} patterns`)
  patterns.forEach((p) => assert.match(p.start, /^\d\d:\d\d$/))
  const cov = coverageForDays(reqs, { patterns, shifts: [] }, s, 0.15)
  const required = reqs.reduce((t, d) => t + d.agentHours, 0)
  assert.ok(cov.shortHours < 0.12 * required, `short ${cov.shortHours} of ${required}`)
  assert.ok(cov.overHours < 0.35 * required, `over ${cov.overHours} of ${required}`)
  assert.ok(cov.serviceLevel > 0.7, `SL ${cov.serviceLevel}`)
})

test('back office coverage is by day', () => {
  const site = defaultSites()[0]
  const s = resolveSettings({ channel: 'backoffice', settings: defaultServiceSettings('backoffice') }, site)
  const reqs = backofficeRequirements(week.map((date) => ({ date, volume: 600 })), new Array(7).fill(420), s)
  const cov = coverageForDays(reqs, { patterns: [{ start: '09:00', end: '17:30', breakMin: 30, counts: [10, 10, 10, 10, 10, 0, 0] }], shifts: [] }, s, 0.1)
  assert.equal(cov.days[0].availableHours, 10 * 8 * 0.9)
  assert.equal(cov.days[0].intervals.length, 0)
  assert.equal(cov.paidHours, 400)
})

test('midBreak snaps to the grain', () => {
  assert.deepEqual(midBreak(480, 990, 30), [[720, 750]])
  assert.deepEqual(midBreak(480, 990, 0), [])
})

test("back-office suggestion covers each day's hours with staggered full shifts", () => {
  const site = defaultSites()[0]
  const s = resolveSettings({ channel: 'backoffice', settings: defaultServiceSettings('backoffice') }, site)
  const reqs = backofficeRequirements(week.map((date, i) => ({ date, volume: [3000, 2600, 2200, 2100, 2000, 400, 200][i] })), new Array(7).fill(420), s)
  const p = suggestDailyPatterns(reqs, s, { inDay: 0.15 })
  assert.deepEqual(p.map((x) => `${x.start}-${x.end}`), ['08:00-16:30', '09:30-18:00'])
  const cov = coverageForDays(reqs, { patterns: p, shifts: [] }, s, 0.15)
  cov.days.forEach((d) => assert.ok(d.availableHours >= d.requiredHours - 1e-6, `${d.date} ${d.availableHours} < ${d.requiredHours}`))
  cov.days.filter((d) => d.requiredHours > 0).forEach((d) => assert.ok(d.availableHours - d.requiredHours < 8))
})

test('branch projection shares staff out across branches', () => {
  const s = { ...resolveSettings({ channel: 'branch', settings: defaultServiceSettings('branch') }, defaultSites()[0]), branches: 25 }
  const iv = { volume: 50, aht: 600 } // 2 visitors per branch per half hour
  const one = projectInterval(25, iv, s).sl
  const two = projectInterval(50, iv, s).sl
  const mid = projectInterval(37, iv, s).sl
  assert.ok(one < mid && mid < two)
  assert.ok(Math.abs(mid - (one * 13 + two * 12) / 25) < 1e-9)
})
