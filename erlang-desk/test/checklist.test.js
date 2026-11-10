import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checklistItems } from '../src/state/checklist.js'

const done = (items) => items.filter((i) => i.done).map((i) => i.key)

test('first-plan checklist: nothing is ticked on an empty workspace', () => {
  assert.deepEqual(done(checklistItems({ services: [] }, null, [])), [])
  assert.equal(checklistItems({ services: [] }, null, []).length, 6)
})

test('first-plan checklist: data and shifts are read from the workspace, the rest from pages opened', () => {
  const svc = { history: { dailyRows: [{ date: '2026-10-01', volume: 10 }] }, schedule: { patterns: [], shifts: [] } }
  assert.deepEqual(done(checklistItems({}, svc, [])), ['data'])
  assert.deepEqual(done(checklistItems({}, svc, ['sites', 'forecast'])), ['data', 'sites', 'forecast'])
  const rostered = { ...svc, schedule: { patterns: [{ id: 'p' }], shifts: [] } }
  assert.deepEqual(done(checklistItems({}, rostered, ['sites', 'service', 'forecast', 'capacity'])), ['data', 'sites', 'service', 'forecast', 'coverage', 'capacity'])
})

test('first-plan checklist: forecast and capacity need history before they count', () => {
  const svc = { history: null, schedule: { patterns: [], shifts: [] } }
  assert.deepEqual(done(checklistItems({}, svc, ['forecast', 'capacity', 'sites'])), ['sites'])
})
