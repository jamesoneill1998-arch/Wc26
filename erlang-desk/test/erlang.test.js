import { test } from 'node:test'
import assert from 'node:assert/strict'
import { erlangC, serviceLevel, asa, requiredAgents, trafficIntensity, withShrinkage, erlangB } from '../src/engine/erlang.js'

const close = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${a} !≈ ${b}`)

// Textbook example: 100 calls / 30 min, AHT 180s => 10 Erlangs.
test('traffic intensity', () => {
  close(trafficIntensity(100, 180, 1800), 10)
})

test('Erlang C matches published values for A=10', () => {
  close(erlangC(11, 10), 0.6821)
  close(erlangC(12, 10), 0.4494)
  close(erlangC(13, 10), 0.2853)
  close(erlangC(14, 10), 0.1741)
})

test('Erlang C agrees with the closed-form factorial formula', () => {
  const direct = (N, A) => {
    let sum = 0
    let term = 1
    for (let k = 0; k < N; k++) { sum += term; term *= A / (k + 1) }
    const top = term * (N / (N - A))
    return top / (sum + top)
  }
  for (const [N, A] of [[5, 3.2], [20, 17.5], [40, 31]]) close(erlangC(N, A), direct(N, A), 1e-9)
})

test('service level and ASA for the textbook example', () => {
  close(serviceLevel(14, 10, 180, 20), 0.8884)
  close(asa(14, 10, 180), 7.83, 0.01)
})

test('required agents hits 80/20 with 14 agents', () => {
  const r = requiredAgents({ volume: 100, ahtSec: 180, intervalSec: 1800, targetSec: 20, slTarget: 0.8 })
  assert.equal(r.agents, 14)
  assert.ok(r.serviceLevel >= 0.8)
})

test('occupancy cap and ASA target can raise the requirement', () => {
  const base = requiredAgents({ volume: 1000, ahtSec: 300, intervalSec: 1800, slTarget: 0.8, targetSec: 20 })
  const capped = requiredAgents({ volume: 1000, ahtSec: 300, intervalSec: 1800, slTarget: 0.8, targetSec: 20, maxOccupancy: 0.8 })
  assert.ok(capped.agents >= Math.ceil(base.traffic / 0.8))
  assert.ok(capped.occupancy <= 0.8)
  const asaT = requiredAgents({ volume: 1000, ahtSec: 300, intervalSec: 1800, slTarget: null, asaTarget: 2 })
  assert.ok(asaT.asa <= 2)
})

test('zero volume needs zero agents', () => {
  assert.equal(requiredAgents({ volume: 0, ahtSec: 300, intervalSec: 1800 }).agents, 0)
})

test('large traffic stays numerically stable', () => {
  const r = requiredAgents({ volume: 20000, ahtSec: 400, intervalSec: 1800, slTarget: 0.9, targetSec: 15 })
  assert.ok(Number.isFinite(r.serviceLevel) && r.agents > r.traffic)
  assert.ok(erlangB(5000, 4400) >= 0)
})

test('concurrency divides seats', () => {
  const one = requiredAgents({ volume: 300, ahtSec: 600, intervalSec: 1800 })
  const three = requiredAgents({ volume: 300, ahtSec: 600, intervalSec: 1800, concurrency: 3 })
  assert.equal(three.agents, Math.ceil(one.agents / 3))
})

test('shrinkage gross-up', () => {
  close(withShrinkage(70, 0.3), 100)
})
