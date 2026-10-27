import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addMonths, monthIndex, unitsByMonth, changeEffect, areaPlan, assessChange, occupancyFor, erlangAgents, hoursPerFteMonth, summaryText, fteFor } from '../src/engine/impact.js'

const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${a} !≈ ${b}`)
const ctx = { shrinkage: 0.35, weeklyHours: 37.5 }

function area({ settings = {}, ...over } = {}) {
  return {
    id: 'mtg', name: 'Mortgages', channel: 'voice', startMonth: '2027-01',
    rows: Array.from({ length: 12 }, () => ({ volume: 50000, aht: 420, operationalFte: 70, mtpFte: 68 })),
    ...over,
    settings: { occupancyMode: 'manual', occupancy: 0.85, openHoursPerWeek: 60, slTarget: 0.8, targetSec: 20, patienceSec: 120, maxOccupancy: 0.9, peakFactor: 1.2, concurrency: 1, bufferPct: 0.02, overtimePct: 0.05, leadTimeWeeks: 10, costPerFte: 32000, ...settings },
  }
}
// 50,000 calls × 420s ≈ 65 FTE at 85% occupancy, 35% shrinkage, 37.5h
const BASE = (50000 * 420 / 3600) / 0.85 / 0.65 / ((37.5 * 52) / 12)

test('months', () => {
  assert.equal(addMonths('2026-11', 3), '2027-02')
  assert.equal(addMonths('2027-01', -1), '2026-12')
  assert.equal(monthIndex('2026-11', '2027-02'), 3)
})

test('baseline converts volume to FTE the way a planner would by hand', () => {
  const [m] = areaPlan(area(), ctx)
  // 50,000 × 420s = 5,833.3 h; ÷ 0.85 ÷ 0.65 ÷ 162.5 h per FTE-month
  close(m.workloadHours, 50000 * 420 / 3600)
  close(m.requiredFte, (50000 * 420 / 3600) / 0.85 / 0.65 / hoursPerFteMonth(37.5))
  close(m.headroom, 70 - m.requiredFte)
})

test('acquisition volumes spread by profile and contact curve, totals preserved', () => {
  assert.deepEqual(unitsByMonth(600, 3, 'flat'), [200, 200, 200])
  assert.deepEqual(unitsByMonth(600, 3, 'ramp'), [100, 200, 300])
  const ch = { id: 'c', areaId: 'mtg', status: 'proposed', inMtp: false, driver: { type: 'acquisitions', total: 25000, startMonth: '2027-03', months: 6, profile: 'flat', contactsPerUnit: 1.5, curve: [0.5, 0.3, 0.2], aht: 540 } }
  const e = changeEffect(ch, area(), area().rows)
  close(e.contacts.reduce((t, v) => t + v, 0) + e.beyondPlan, 37500)
  assert.equal(e.contacts[1], 0) // nothing before go-live
  close(e.contacts[2], (25000 / 6) * 1.5 * 0.5) // March: half of March's acquisitions call in month
  close(e.workloadHours[2], e.contacts[2] * 540 / 3600)
})

test('mortgage launch: 25k acquisitions outside MTP are not absorbable on thin headroom', () => {
  const a = area({ rows: Array.from({ length: 12 }, () => ({ volume: 50000, aht: 420, operationalFte: Math.ceil(BASE / 0.98 + 2) })) })
  const launch = { id: 'launch', name: 'Mortgage acquisition launch', areaId: 'mtg', status: 'proposed', inMtp: false, driver: { type: 'acquisitions', total: 25000, startMonth: '2027-03', months: 6, profile: 'flat', contactsPerUnit: 1.5, curve: [0.5, 0.3, 0.2], aht: 540 } }
  const r = assessChange(launch, a, [launch], ctx)
  // Peak month carries 6,250 contacts × 540s = 937.5 h → ÷0.85 ÷0.65 ÷162.5 ≈ 10.4 FTE
  close(r.peakFte, 937.5 / 0.85 / 0.65 / 162.5, 1e-6)
  assert.equal(r.verdict, 'short')
  assert.ok(r.peakShortfall > 0)
  assert.equal(r.firstShort, '2027-04')
  assert.equal(r.hireBy, '2027-01') // 10 weeks' lead time ≈ 3 months
  assert.ok(r.cost > 0)
  assert.ok(r.worstSl < 0.8)
  const text = summaryText(launch, a, r)
  assert.match(text, /NOT ABSORBABLE/)
  assert.match(text, /Recruitment: \d+ FTE starting by January 2027/)
})

test('the same change is absorbable with headroom, and needs overtime in between', () => {
  const launch = { id: 'l', areaId: 'mtg', status: 'proposed', inMtp: false, driver: { type: 'acquisitions', total: 25000, startMonth: '2027-03', months: 6, profile: 'flat', contactsPerUnit: 1.5, curve: [0.5, 0.3, 0.2], aht: 540 } }
  const base = areaPlan(area(), ctx)[0].requiredFte
  const roomy = area({ rows: Array.from({ length: 12 }, () => ({ volume: 50000, aht: 420, operationalFte: Math.ceil((base + 11) / 0.98) })) })
  assert.equal(assessChange(launch, roomy, [launch], ctx).verdict, 'absorbable')
  const tight = area({ rows: Array.from({ length: 12 }, () => ({ volume: 50000, aht: 420, operationalFte: Math.ceil(base / 0.98 + 2) })) })
  assert.equal(assessChange(launch, tight, [launch], ctx).verdict, 'short')
  const ot = area({ settings: { overtimePct: 0.12 }, rows: Array.from({ length: 12 }, () => ({ volume: 50000, aht: 420, operationalFte: Math.ceil(base / 0.98 + 2) })) })
  assert.equal(assessChange(launch, ot, [launch], ctx).verdict, 'overtime')
})

test('committed changes consume headroom first; MTP changes add nothing', () => {
  const base = areaPlan(area(), ctx)[0].requiredFte
  const a = area({ rows: Array.from({ length: 12 }, () => ({ volume: 50000, aht: 420, operationalFte: Math.ceil((base + 8) / 0.98) })) })
  const small = { id: 's', areaId: 'mtg', status: 'proposed', inMtp: false, driver: { type: 'volume', startMonth: '2027-01', months: 12, mode: 'pct', value: 0.05, aht: 420 } }
  const big = { id: 'b', areaId: 'mtg', status: 'approved', inMtp: false, driver: { type: 'volume', startMonth: '2027-01', months: 12, mode: 'pct', value: 0.3, aht: 420 } }
  assert.equal(assessChange(small, a, [small], ctx).verdict, 'absorbable')
  assert.equal(assessChange(small, a, [small, big], ctx).verdict, 'short')
  assert.equal(assessChange(small, a, [small, { ...big, inMtp: true }], ctx).verdict, 'absorbable')
  assert.equal(assessChange({ ...small, inMtp: true }, a, [small], ctx).verdict, 'inMtp')
})

test('AHT and abstraction drivers', () => {
  const a = area()
  const aht = { id: 'x', areaId: 'mtg', status: 'proposed', inMtp: false, driver: { type: 'aht', startMonth: '2027-02', months: 2, deltaSec: 30, share: 0.4 } }
  const e = changeEffect(aht, a, a.rows)
  close(e.workloadHours[1], 50000 * 0.4 * 30 / 3600)
  assert.equal(e.workloadHours[3], 0)
  const train = { id: 't', areaId: 'mtg', status: 'proposed', inMtp: false, driver: { type: 'abstraction', startMonth: '2027-01', months: 1, people: 120, hoursPerPerson: 7.5 } }
  const r = assessChange(train, a, [train], ctx)
  close(r.rows[0].incrementalFte, 900 / hoursPerFteMonth(37.5)) // paid hours: no shrinkage gross-up
  assert.equal(r.rows[1].incrementalFte, 0)
})

test('missing operational FTE means the change cannot be judged', () => {
  const a = area({ rows: Array.from({ length: 12 }, () => ({ volume: 50000, aht: 420, operationalFte: null })) })
  const c = { id: 'c', areaId: 'mtg', status: 'proposed', inMtp: false, driver: { type: 'volume', startMonth: '2027-01', months: 1, mode: 'abs', value: 1000, aht: 400 } }
  assert.equal(assessChange(c, a, [c], ctx).verdict, 'unknown')
})

test('Erlang occupancy: larger queues run hotter, and agents move smoothly', () => {
  const a = area({ settings: { occupancyMode: 'erlang' } })
  const small = occupancyFor(500, 420, a)
  const large = occupancyFor(8000, 420, a)
  assert.ok(small < large && large <= 0.9, `${small} ${large}`)
  const n1 = erlangAgents({ volume: 100, ahtSec: 300, targetSec: 20, slTarget: 0.8 })
  const n2 = erlangAgents({ volume: 101, ahtSec: 300, targetSec: 20, slTarget: 0.8 })
  assert.ok(n2 > n1 && n2 - n1 < 0.5, `${n1} → ${n2}`)
  assert.ok(n1 > 100 * 300 / 1800 && n1 < 22, `${n1}`) // above the 16.7 Erlangs of traffic
  assert.ok(fteFor(1000, 420, a, 0.35, 37.5) > 0)
})

test('changes that cut workload release capacity for others', () => {
  const base = BASE
  const a = area({ rows: Array.from({ length: 12 }, () => ({ volume: 50000, aht: 420, operationalFte: Math.ceil(base / 0.98 + 2) })) })
  const digital = { id: 'd', areaId: 'mtg', status: 'approved', inMtp: false, driver: { type: 'aht', startMonth: '2027-01', months: 12, deltaSec: -90, share: 0.5 } }
  const r = assessChange(digital, a, [digital], ctx)
  assert.equal(r.verdict, 'saving')
  assert.ok(r.savingFte > 4)
  const extra = { id: 'e', areaId: 'mtg', status: 'proposed', inMtp: false, driver: { type: 'volume', startMonth: '2027-01', months: 12, mode: 'pct', value: 0.1, aht: 420 } }
  assert.equal(assessChange(extra, a, [extra], ctx).verdict, 'short')
  assert.equal(assessChange(extra, a, [extra, digital], ctx).verdict, 'absorbable')
})
