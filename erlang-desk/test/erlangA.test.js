import { test } from 'node:test'
import assert from 'node:assert/strict'
import { erlangA, requiredAgentsA } from '../src/engine/erlangA.js'
import { serviceLevel, erlangC, requiredAgents } from '../src/engine/erlang.js'

// Discrete-event simulation of M/M/N+M, used as an independent check.
function simulate({ agents, lambda, aht, patience, target, n = 300000, seed = 7 }) {
  let s = seed >>> 0
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return (((t ^ (t >>> 14)) >>> 0) + 1) / 4294967297 }
  const exp = (mean) => -Math.log(rnd()) * mean
  const free = new Array(agents).fill(0) // time each agent frees up
  // FCFS with abandonment: agents are allocated in arrival order, so we can
  // track the earliest free agent; customers whose wait exceeds patience leave.
  let t = 0
  let within = 0, abandWithin = 0, aband = 0, waited = 0
  for (let i = 0; i < n; i++) {
    t += exp(1 / lambda)
    let idx = 0
    for (let a = 1; a < agents; a++) if (free[a] < free[idx]) idx = a
    const wait = Math.max(0, free[idx] - t)
    const pat = exp(patience)
    if (wait > pat) { aband++; if (pat <= target) abandWithin++; waited += pat; continue }
    waited += wait
    if (wait <= target) within++
    free[idx] = t + wait + exp(aht)
  }
  return { sl: within / (n - abandWithin), pAbandon: aband / n, avgWait: waited / n }
}

test('Erlang A converges to Erlang C when callers are very patient', () => {
  const r = erlangA(14, { volume: 100, ahtSec: 180, intervalSec: 1800, patienceSec: 1e6, targetSec: 20 })
  assert.ok(Math.abs(r.pWait - erlangC(14, 10)) < 1e-3, `${r.pWait}`)
  assert.ok(Math.abs(r.serviceLevel - serviceLevel(14, 10, 180, 20)) < 2e-3, `${r.serviceLevel}`)
  assert.ok(r.pAbandon < 1e-3)
})

test('Erlang A matches simulation under heavy load', () => {
  const q = { volume: 400, ahtSec: 240, intervalSec: 1800, patienceSec: 90, targetSec: 20 }
  const agents = 50 // 53.3 Erlangs offered: overloaded without abandonment
  const r = erlangA(agents, q)
  const sim = simulate({ agents, lambda: 400 / 1800, aht: 240, patience: 90, target: 20 })
  assert.ok(Math.abs(r.pAbandon - sim.pAbandon) < 0.01, `abandon ${r.pAbandon} vs sim ${sim.pAbandon}`)
  assert.ok(Math.abs(r.serviceLevel - sim.sl) < 0.015, `SL ${r.serviceLevel} vs sim ${sim.sl}`)
  assert.ok(Math.abs(r.avgWait - sim.avgWait) < 1.5, `wait ${r.avgWait} vs sim ${sim.avgWait}`)
})

test('Erlang A matches simulation at a normal load', () => {
  const q = { volume: 120, ahtSec: 300, intervalSec: 1800, patienceSec: 150, targetSec: 30 }
  const agents = 21
  const r = erlangA(agents, q)
  const sim = simulate({ agents, lambda: 120 / 1800, aht: 300, patience: 150, target: 30 })
  assert.ok(Math.abs(r.serviceLevel - sim.sl) < 0.015, `SL ${r.serviceLevel} vs sim ${sim.sl}`)
  assert.ok(Math.abs(r.pAbandon - sim.pAbandon) < 0.006, `abandon ${r.pAbandon} vs sim ${sim.pAbandon}`)
})

test('Erlang A needs no more agents than Erlang C, and meets the target', () => {
  for (const [volume, aht] of [[100, 180], [600, 300], [30, 420], [2500, 280]]) {
    const base = { volume, ahtSec: aht, intervalSec: 1800, targetSec: 20, slTarget: 0.8 }
    const c = requiredAgents(base)
    const a = requiredAgentsA({ ...base, patienceSec: 120 })
    assert.ok(a.agents <= c.agents, `${volume}: A ${a.agents} > C ${c.agents}`)
    assert.ok(a.serviceLevel >= 0.8)
    const below = erlangA(a.agents - 1, { ...base, patienceSec: 120 })
    assert.ok(below.serviceLevel < 0.8, 'search returned the minimum')
  }
})

test('abandonment target can drive the requirement', () => {
  const r = requiredAgentsA({ volume: 300, ahtSec: 300, intervalSec: 1800, patienceSec: 60, slTarget: null, abandonTarget: 0.03 })
  assert.ok(r.pAbandon <= 0.03)
})
