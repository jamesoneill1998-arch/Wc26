import { test } from 'node:test'
import assert from 'node:assert/strict'
import { intervalRequirements, weeklyRequirements, simulateSupply, recommendHires, planWeeks } from '../src/engine/capacity.js'
import { defaultProfiles, learnProfiles } from '../src/engine/profiles.js'
import { parseHistoryCSV, aggregateDaily, toCSV } from '../src/engine/csv.js'
import { generateSampleHistory } from '../src/engine/sample.js'

const settings = {
  intervalMin: 30, targetSec: 20, slTarget: 0.8, asaTarget: null, maxOccupancy: 0.9,
  shrinkage: 0.3, defaultAht: 300, concurrency: 1, minAgents: 1, fteHoursPerWeek: 37.5,
  hours: [...Array(5).fill({ open: '08:00', close: '20:00' }), { open: '09:00', close: '17:00' }, null],
}

test('default profiles sum to 1 on open days and 0 when closed', () => {
  const p = defaultProfiles(settings)
  const sum = (r) => r.reduce((s, v) => s + v, 0)
  assert.ok(Math.abs(sum(p.volume[0]) - 1) < 1e-9)
  assert.equal(sum(p.volume[6]), 0)
  assert.equal(p.volume[0][0], 0) // midnight closed
})

test('learnt profiles aggregate 15-minute data into 30-minute slots', () => {
  const rows = [
    { date: '2026-10-19', time: 600, volume: 10, aht: 200 },
    { date: '2026-10-19', time: 615, volume: 30, aht: 400 },
    { date: '2026-10-19', time: 630, volume: 60, aht: 300 },
  ]
  const p = learnProfiles(rows, 30)
  assert.ok(Math.abs(p.volume[0][20] - 0.4) < 1e-9)
  assert.ok(Math.abs(p.aht[0][20] - 350) < 1e-9)
})

test('requirements roll up to sensible FTE', () => {
  const profiles = defaultProfiles(settings)
  const days = planWeeks('2026-10-19', 1).flatMap((wk) => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.parse(wk) + i * 864e5).toISOString().slice(0, 10)
    return { date: d, volume: i < 5 ? 2000 : i === 5 ? 600 : 0 }
  }))
  const reqs = intervalRequirements(days, profiles, new Array(7).fill(300), settings)
  const [week] = weeklyRequirements(reqs, settings)
  // Pure workload: 10,600 contacts × 300s = 883 h; queueing + shrinkage push FTE above that.
  assert.ok(week.requiredFte > week.workloadFte)
  assert.ok(week.workloadFte > 30 && week.requiredFte < 80, JSON.stringify(week))
  reqs[0].intervals.filter((iv) => iv.volume > 0.5).forEach((iv) => assert.ok(iv.sl >= 0.8))
})

test('supply simulation applies attrition and ramp', () => {
  const weeks = planWeeks('2026-10-19', 10).map((week) => ({ week, requiredFte: 50 }))
  const c = { startHeadcount: 50, monthlyAttrition: 0.04, trainingWeeks: 3, nestingWeeks: 2, nestingProductivity: 0.5 }
  const sim = simulateSupply(weeks, c, [{ week: weeks[1].week, count: 10 }])
  assert.equal(sim[0].availableFte, 50)
  assert.ok(sim[2].headcount > 58.5 && sim[2].availableFte < 50) // in training, not productive
  assert.ok(sim[4].availableFte > sim[3].availableFte) // nesting
  assert.ok(sim[9].availableFte > 55)
})

test('recommended hires close the gap', () => {
  const weeks = planWeeks('2026-10-19', 26).map((week, i) => ({ week, requiredFte: 50 + i }))
  const c = { startHeadcount: 52, monthlyAttrition: 0.03, trainingWeeks: 4, nestingWeeks: 2, nestingProductivity: 0.6, classCadenceWeeks: 4 }
  const recs = recommendHires(weeks, c)
  assert.ok(recs.length > 0)
  const sim = simulateSupply(weeks, c, recs)
  sim.slice(6).forEach((r) => assert.ok(r.gap >= -0.5, `${r.week} gap ${r.gap}`))
})

test('CSV parsing handles interval data, aliases and UK dates', () => {
  const text = 'Date;Interval;Calls Offered;AHT\n19/10/2026;08:00;12;310\n19/10/2026;08:30;20;290\nbad;row;x;1\n'
  const r = parseHistoryCSV(text)
  assert.equal(r.kind, 'interval')
  assert.equal(r.rows.length, 2)
  assert.equal(r.rows[0].date, '2026-10-19')
  assert.equal(r.errors.length, 1)
  const [day] = aggregateDaily(r.rows)
  assert.equal(day.volume, 32)
  assert.ok(Math.abs(day.aht - (12 * 310 + 20 * 290) / 32) < 1e-9)
})

test('CSV export escapes cells', () => {
  assert.equal(toCSV([{ label: 'a', get: (r) => r }], ['x,y']), 'a\n"x,y"')
})

test('sample history is deterministic', () => {
  const a = generateSampleHistory({ endDate: '2026-10-18', days: 14 })
  const b = generateSampleHistory({ endDate: '2026-10-18', days: 14 })
  assert.deepEqual(a, b)
})

test('shortfalls inside the hiring lead time are reported, not chased with ever-bigger classes', async () => {
  const { unfixableWeeks } = await import('../src/engine/capacity.js')
  const weeks = planWeeks('2026-10-19', 20).map((week) => ({ week, requiredFte: 72 }))
  const c = { startHeadcount: 60, monthlyAttrition: 0.03, trainingWeeks: 4, nestingWeeks: 2, nestingProductivity: 0.6, classCadenceWeeks: 4 }
  const recs = recommendHires(weeks, c)
  const total = recs.reduce((s, r) => s + r.count, 0)
  assert.ok(total > 12 && total < 25, `total hires ${total}`)
  assert.equal(recs[0].week, weeks[0].week)
  assert.equal(unfixableWeeks(simulateSupply(weeks, c, recs), c).length, 6)
})

test('CSV export neutralises formula injection but keeps negative numbers', () => {
  const out = toCSV([{ label: 'v', get: (r) => r }], ['=HYPERLINK("http://x")', '+1+1', '@SUM(A1)', '-1.5', '-cmd'])
  assert.equal(out, 'v\n"\'=HYPERLINK(""http://x"")"\n\'+1+1\n\'@SUM(A1)\n-1.5\n\'-cmd')
})

test('CSV import rejects absurd values', () => {
  const r = parseHistoryCSV('date,volume,aht\n2026-01-01,99999999999,300\n2026-01-02,10,100000\n2026-01-03,10,300\n')
  assert.equal(r.rows.length, 1)
  assert.equal(r.errors.length, 2)
})
