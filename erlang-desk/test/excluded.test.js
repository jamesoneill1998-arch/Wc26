// Planner-excluded days: outages and incidents left out of the forecast.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toDailySeries, forecastDaily, unusualDays } from '../src/engine/forecast.js'
import { bankHolidays } from '../src/engine/holidays.js'
import { addDays, weekdayIndex } from '../src/engine/dates.js'
import { sanitizeWorkspace } from '../src/state/store.js'
import { buildSampleWorkspace } from '../src/state/sample.js'
import { computeService } from '../src/engine/compute.js'

function history(days = 400, outage = null) {
  const rows = []
  for (let i = 0; i < days; i++) {
    const date = addDays('2025-09-01', i) // a Monday
    const wd = weekdayIndex(date)
    let volume = wd >= 5 ? 300 : 1000 + (i % 3) * 10
    if (date === outage) volume = 250
    rows.push({ date, volume })
  }
  return rows
}

test('an excluded day is filled like an export gap and reported separately', () => {
  const rows = history(70)
  const s = toDailySeries(rows, new Set(['2025-10-08']))
  assert.equal(s.values[37], 1010, 'filled from the same weekday nearby, not the recorded value')
  assert.deepEqual(s.excludedDays, ['2025-10-08'])
  assert.deepEqual(s.filled, [], 'not listed as an export gap')
})

test('leaving out a recent outage restores the forecast', () => {
  const outage = addDays('2025-09-01', 395) // a weekday in the last week
  const clean = forecastDaily(history(400), { horizon: 28 })
  const hit = forecastDaily(history(400, outage), { horizon: 28 })
  const fixed = forecastDaily(history(400, outage), { horizon: 28, excluded: new Set([outage]) })
  const total = (f) => f.points.reduce((t, p) => t + p.volume, 0)
  assert.ok(total(hit) < total(clean) * 0.995, 'the outage drags the forecast down')
  assert.ok(Math.abs(total(fixed) / total(clean) - 1) < 0.002, 'excluded, it matches the clean history')
  assert.deepEqual(fixed.excludedDays, [outage])
})

test('unusual days: finds an outage, skips bank holidays and days already left out', () => {
  const outage = '2026-03-17'
  const rows = history(400, outage).map((r) => (r.date === '2026-04-06' ? { ...r, volume: 300 } : r)) // Easter Monday
  const holidays = bankHolidays(2025, 2026)
  const found = unusualDays(rows, { holidays })
  assert.equal(found[0].date, outage)
  assert.ok(found[0].ratio < 0.3)
  assert.ok(!found.some((u) => u.date === '2026-04-06'), 'bank holiday not flagged')
  assert.equal(unusualDays(rows, { holidays, excluded: new Set([outage]) }).length, 0)
})

test('excluded days are stored cleanly and change the plan', () => {
  const ws = buildSampleWorkspace()
  const svc = ws.services[0]
  const outage = unusualDays(svc.history.dailyRows)[0].date
  const stored = sanitizeWorkspace({ ...ws, services: [{ ...svc, excludedDays: [{ date: outage, note: 'Outage' }, { date: outage }, { date: 'nonsense' }, { date: '2026-01-01', note: 'x'.repeat(200) }] }, ...ws.services.slice(1)] })
  assert.deepEqual(stored.services[0].excludedDays.map((x) => x.date), ['2026-01-01', outage].sort())
  assert.equal(stored.services[0].excludedDays.find((x) => x.date === '2026-01-01').note.length, 80)
  const site = ws.sites.find((x) => x.id === svc.siteId)
  const before = computeService(svc, site)
  const after = computeService({ ...svc, excludedDays: [{ date: outage, note: '' }] }, site)
  assert.deepEqual(after.forecast.excludedDays, [outage])
  assert.notEqual(after.forecast.points[0].volume, before.forecast.points[0].volume)
})
