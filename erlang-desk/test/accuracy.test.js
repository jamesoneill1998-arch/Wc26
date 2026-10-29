// Reference checks against published tables and an independent simulation
// (200,000 simulated calls per scenario; see the testing notes).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { erlangC } from '../src/engine/erlang.js'
import { erlangA } from '../src/engine/erlangA.js'

test('Erlang C matches published tables at 10 Erlangs', () => {
  for (const [n, want] of [[11, 0.6821], [12, 0.4494], [13, 0.2853], [14, 0.1741], [15, 0.1020]]) {
    assert.ok(Math.abs(erlangC(n, 10) - want) < 5e-5, `${n} agents`)
  }
})

test('Erlang A matches an independent simulation, with ASA over answered calls', () => {
  const cases = [
    // calls per 30 min, AHT, agents, patience → simulated SL, abandon, ASA (answered only)
    [60, 300, 12, 120, 0.848, 0.072, 6.8],
    [300, 300, 54, 180, 0.890, 0.030, 5.0],
    [300, 300, 48, 45, 0.917, 0.104, 4.0],
  ]
  for (const [volume, ahtSec, n, patienceSec, sl, ab, asa] of cases) {
    const r = erlangA(n, { volume, ahtSec, intervalSec: 1800, patienceSec, targetSec: 20 })
    assert.ok(Math.abs(r.serviceLevel - sl) < 0.01, `SL ${r.serviceLevel} vs ${sl}`)
    assert.ok(Math.abs(r.pAbandon - ab) < 0.005, `abandon ${r.pAbandon} vs ${ab}`)
    assert.ok(Math.abs(r.asa - asa) < 0.5, `ASA ${r.asa} vs ${asa}`)
    assert.ok(r.asa < r.avgWait, 'answered-only ASA is below the all-caller average wait')
  }
})
