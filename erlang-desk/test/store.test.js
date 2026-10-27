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
