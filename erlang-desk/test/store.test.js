import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeWorkspace, emptyWorkspace, newService } from '../src/state/store.js'

test('imports are rebuilt from known fields only', () => {
  const evil = JSON.parse('{"version":2,"__proto__":{"polluted":true},"name":"<img src=x onerror=alert(1)>' + 'x'.repeat(200) + '","sites":[{"id":"uk","name":"UK","shrinkage":{"leave":"lots","sickness":5}}],"services":[{"id":"../../etc","channel":"telepathy","name":"S","settings":{"slTarget":7,"hours":"always"},"history":{"dailyRows":[{"date":"2026-01-01","volume":5},{"date":"DROP TABLE","volume":1},{"date":"2026-01-02","volume":-3},{"date":"2026-01-03","volume":1e12}]},"extra":"x"}]}')
  const ws = sanitizeWorkspace(evil)
  assert.equal({}.polluted, undefined)
  assert.equal(ws.name.length, 80)
  assert.equal(ws.sites[0].shrinkage.leave, 0.12) // non-number replaced with default
  assert.equal(ws.sites[0].shrinkage.sickness, 0.9) // clamped
  const s = ws.services[0]
  assert.equal(s.channel, 'voice')
  assert.notEqual(s.id, '../../etc')
  assert.equal(s.settings.slTarget, 0.999)
  assert.equal(s.settings.hours.length, 7)
  assert.equal(s.extra, undefined)
  assert.deepEqual(s.history.dailyRows.map((r) => r.date), ['2026-01-01']) // bad date, negative and absurd rows dropped
})

test('v1 workspaces migrate to a voice service', () => {
  const ws = sanitizeWorkspace({ name: 'Old', settings: { shrinkage: 0.3, slTarget: 0.9 }, plan: {}, capacity: { startHeadcount: 12 }, hires: [], history: null })
  assert.equal(ws.version, 2)
  assert.equal(ws.services.length, 1)
  assert.equal(ws.services[0].settings.shrinkageOverride, 0.3)
  assert.equal(ws.services[0].capacity.startHeadcount, 12)
})

test('rejects things that are not workspaces', () => {
  assert.throws(() => sanitizeWorkspace([]))
  assert.throws(() => sanitizeWorkspace({ hello: 1 }))
})

test('round-trips a normal workspace', () => {
  const ws = emptyWorkspace()
  ws.services.push(newService({ channel: 'branch', siteId: 'offshore' }))
  const back = sanitizeWorkspace(JSON.parse(JSON.stringify(ws)))
  assert.equal(back.services[0].channel, 'branch')
  assert.equal(back.services[0].siteId, 'offshore')
  assert.equal(back.services[0].settings.branches, 25)
})

test('signed percentages never show a negative zero', async () => {
  const { fmtSignedPct } = await import('../src/format.js')
  assert.equal(fmtSignedPct(-0.0002), '0.0%')
  assert.equal(fmtSignedPct(0), '0.0%')
  assert.equal(fmtSignedPct(0.0372), '+3.7%')
  assert.equal(fmtSignedPct(-0.08), '−8.0%')
  assert.equal(fmtSignedPct(NaN), '–')
})

test('dates read the UK way whatever the browser locale', async () => {
  const { formatDate } = await import('../src/engine/dates.js')
  assert.equal(formatDate('2026-11-16'), '16 Nov')
  assert.equal(formatDate('2026-11-16', { day: 'numeric', month: 'short', year: 'numeric' }), '16 Nov 2026')
})

test('named scenarios are cleaned on load', () => {
  const ws = emptyWorkspace()
  const svc = { ...newService({ name: 'A' }), scenarios: [
    { id: 'ok', name: '  Launch  ', demand: 0.15, aht: 0.05, shrinkage: 0.4, attrition: null },
    { id: '<bad id>', name: 5, demand: 99, aht: 'x', shrinkage: 3, attrition: -1 },
    'junk', null, ...Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, name: `S${i}`, demand: 0, aht: 0 })),
  ] }
  const out = sanitizeWorkspace({ ...ws, services: [svc], activeServiceId: svc.id }).services[0].scenarios
  assert.equal(out.length, 6)
  assert.deepEqual(out[0], { id: 'ok', name: 'Launch', demand: 0.15, aht: 0.05, shrinkage: 0.4, attrition: null, hires: null })
  assert.equal(out[1].name, 'Scenario')
  assert.equal(out[1].demand, 2)
  assert.equal(out[1].aht, 0)
  assert.equal(out[1].shrinkage, 0.9)
  assert.equal(out[1].attrition, 0)
  assert.match(out[1].id, /^[a-z0-9]+$/)
  assert.deepEqual(sanitizeWorkspace({ ...ws, services: [newService({ name: 'B' })] }).services[0].scenarios, [])
})

test('a kept forecast is cleaned on load', () => {
  const ws = emptyWorkspace()
  const good = { madeOn: '2026-11-01', method: 'x'.repeat(200), points: [{ date: '2026-11-02', volume: 100 }, { date: 'bad', volume: 1 }, { date: '2026-11-03', volume: -5 }, null] }
  const out = sanitizeWorkspace({ ...ws, services: [{ ...newService({ name: 'A' }), forecastSnapshot: good }] }).services[0].forecastSnapshot
  assert.deepEqual(out.points, [{ date: '2026-11-02', volume: 100 }, { date: '2026-11-03', volume: 0 }])
  assert.equal(out.method.length, 80)
  for (const bad of [null, 'x', { madeOn: 'nope', points: [] }, { madeOn: '2026-11-01', points: [] }]) {
    assert.equal(sanitizeWorkspace({ ...ws, services: [{ ...newService({ name: 'A' }), forecastSnapshot: bad }] }).services[0].forecastSnapshot, null)
  }
})

test('a scenario\'s own hiring plan is cleaned on load', () => {
  const ws = emptyWorkspace()
  const svc = { ...newService({ name: 'A' }), scenarios: [
    { id: 'a', name: 'A', demand: 0, aht: 0, hires: [{ week: '2026-11-16', count: 7.6 }, { week: 'bad', count: 2 }, null] },
    { id: 'b', name: 'B', demand: 0, aht: 0, hires: [] },
    { id: 'c', name: 'C', demand: 0, aht: 0, hires: 'x' },
  ] }
  const out = sanitizeWorkspace({ ...ws, services: [svc] }).services[0].scenarios
  assert.deepEqual(out[0].hires, [{ week: '2026-11-16', count: 8 }])
  assert.deepEqual(out[1].hires, [])
  assert.equal(out[2].hires, null)
})
