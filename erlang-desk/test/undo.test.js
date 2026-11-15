import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeLoss } from '../src/state/undo.js'

const svc = (id, over = {}) => ({ id, name: id.toUpperCase(), history: { dailyRows: [1] }, ...over })
const ws = (over = {}) => ({ services: [svc('a'), svc('b')], areas: [{ id: 'm', name: 'Mortgages' }], changes: [{ id: 'c1', name: 'Launch', areaId: 'm' }, { id: 'c2', name: 'Campaign', areaId: 'm' }], ...over })

test('undo: ordinary edits lose nothing', () => {
  const w = ws()
  assert.equal(describeLoss(w, w), null)
  assert.equal(describeLoss(w, { ...w, activeServiceId: 'b' }), null)
  assert.equal(describeLoss(w, { ...w, services: [...w.services, svc('c')] }), null)
  assert.equal(describeLoss(w, { ...w, services: w.services.map((s) => ({ ...s, name: 'Renamed' })) }), null)
  assert.equal(describeLoss(null, w), null)
})

test('undo: deletions are named', () => {
  const w = ws()
  assert.equal(describeLoss(w, { ...w, services: [w.services[0]] }), 'Deleted the service “B”')
  assert.equal(describeLoss(w, { ...w, changes: [w.changes[1]] }), 'Deleted the change “Launch”')
  assert.equal(describeLoss(w, { ...w, changes: [] }), 'Deleted 2 changes')
  assert.equal(describeLoss({ ...w, areas: [...w.areas, { id: 's', name: 'Savings' }] }, w), 'Deleted the area “Savings”')
  assert.equal(describeLoss(w, { ...w, services: [w.services[0], { ...w.services[1], history: null }] }), 'Cleared the history for “B”')
})

test('undo: erasing and replacing the whole workspace', () => {
  const w = ws()
  assert.equal(describeLoss(w, { services: [], areas: [], changes: [] }), 'Erased all data')
  assert.equal(describeLoss(w, { services: [svc('x')], areas: [{ id: 'y', name: 'Y' }], changes: [] }), 'Replaced your workspace')
  // Nothing to lose in an empty workspace.
  assert.equal(describeLoss({ services: [], areas: [], changes: [] }, w), null)
})
