import { test } from 'node:test'
import assert from 'node:assert/strict'
import { forecastDaily, toDailySeries, wape, solveLinear } from '../src/engine/forecast.js'
import { addDays, weekdayIndex } from '../src/engine/dates.js'
import { generateSampleHistory } from '../src/engine/sample.js'
import { aggregateDaily } from '../src/engine/csv.js'

test('series fills gaps with zero', () => {
  const s = toDailySeries([{ date: '2026-01-01', volume: 5 }, { date: '2026-01-03', volume: 7 }])
  assert.deepEqual(s.values, [5, 0, 7])
})

test('wape', () => {
  assert.equal(wape([100, 100], [90, 110]), 0.1)
})

test('linear solver', () => {
  const x = solveLinear([[2, 1], [1, 3]], [3, 5])
  assert.ok(Math.abs(x[0] - 0.8) < 1e-9 && Math.abs(x[1] - 1.4) < 1e-9)
})

test('recovers a clean weekly pattern', () => {
  const shape = [120, 110, 100, 100, 90, 40, 0]
  const rows = []
  for (let i = 0; i < 140; i++) {
    const date = addDays('2026-01-05', i) // a Monday
    rows.push({ date, volume: shape[weekdayIndex(date)] })
  }
  const fc = forecastDaily(rows, { horizon: 14 })
  assert.equal(fc.points.length, 14)
  assert.ok(fc.accuracy.wape < 0.02, `wape ${fc.accuracy.wape}`)
  fc.points.forEach((p) => assert.ok(Math.abs(p.volume - shape[weekdayIndex(p.date)]) < 3))
})

test('forecasts the demo data within 10% WAPE and keeps the band ordered', () => {
  const daily = aggregateDaily(generateSampleHistory({ endDate: '2026-10-18' }))
  const fc = forecastDaily(daily, { horizon: 91 })
  assert.ok(fc.accuracy.wape < 0.1, `wape ${fc.accuracy.wape} via ${fc.method}`)
  assert.equal(fc.points[0].date, '2026-10-19')
  fc.points.forEach((p) => assert.ok(p.low <= p.volume && p.volume <= p.high))
})

test('planner overlay scales the forecast', () => {
  const daily = aggregateDaily(generateSampleHistory({ endDate: '2026-10-18', days: 120 }))
  const a = forecastDaily(daily, { horizon: 7, method: 'weekdayAverage' })
  const b = forecastDaily(daily, { horizon: 7, method: 'weekdayAverage', adjustPct: 0.1 })
  a.points.forEach((p, i) => assert.ok(Math.abs(b.points[i].volume - p.volume * 1.1) < 1e-6))
})

test('too little history returns an error', () => {
  assert.ok(forecastDaily([{ date: '2026-01-01', volume: 1 }]).error)
})

test('forecast against actuals: a kept forecast is scored on the days that have since arrived', async () => {
  const { forecastSnapshot, compareForecast } = await import('../src/engine/forecast.js')
  const points = Array.from({ length: 28 }, (_, i) => ({ date: new Date(Date.UTC(2026, 10, 2 + i)).toISOString().slice(0, 10), volume: 100, low: 80, high: 120 }))
  const snap = forecastSnapshot({ methodLabel: 'Same day last week', points }, '2026-11-01')
  assert.equal(snap.points.length, 28)
  assert.deepEqual(Object.keys(snap.points[0]), ['date', 'volume'])
  assert.equal(forecastSnapshot(null, '2026-11-01'), null)
  // Two weeks of actuals, all 10% above the forecast.
  const actuals = points.slice(0, 14).map((p) => ({ date: p.date, volume: 110 }))
  const r = compareForecast(snap, actuals)
  assert.equal(r.days, 14)
  assert.equal(r.from, '2026-11-02')
  assert.equal(r.to, '2026-11-15')
  assert.ok(Math.abs(r.wape - 10 / 110) < 1e-9)
  assert.ok(Math.abs(r.bias - (1400 - 1540) / 1540) < 1e-9) // negative: it under-forecast
  assert.deepEqual(r.weeks.map((w) => [w.week, w.days, w.forecast, w.actual]), [['2026-11-02', 7, 700, 770], ['2026-11-09', 7, 700, 770]])
  // Left-out days are ignored; under a week of overlap gives nothing.
  assert.equal(compareForecast(snap, actuals, new Set(['2026-11-02'])).days, 13)
  assert.equal(compareForecast(snap, actuals.slice(0, 6)), null)
  assert.equal(compareForecast(null, actuals), null)
})
