// Erlang A (M/M/N+M): Erlang C plus customer abandonment.
//
// Callers who wait longer than their (exponentially distributed) patience
// hang up. Modelling that gives a truer picture than Erlang C, which assumes
// everyone waits forever and so over-staffs when abandonment is material.
//
// Method: exact birth-death stationary distribution (computed in log space so
// thousands of agents stay stable), then service level from the tagged
// customer's queue-position chain, solved by uniformisation.
//
// Service level here excludes contacts that abandon inside the threshold:
//   answered within t / (offered − abandoned within t)
// which is the most common contact-centre reporting convention.

import { requiredAgents as requiredAgentsC, trafficIntensity } from './erlang.js'

const LOG_FLOOR = 40 // ignore states below e^-40 of the peak

function stationary(agents, lambda, mu, theta) {
  const logw = [0]
  for (let n = 1; n <= agents; n++) logw.push(logw[n - 1] + Math.log(lambda / (n * mu)))
  let peak = Math.max(...logw)
  // Queue states: decay is guaranteed once N·mu + k·theta > lambda.
  for (let k = 1; k < 200000; k++) {
    const v = logw[agents + k - 1] + Math.log(lambda / (agents * mu + k * theta))
    logw.push(v)
    if (v > peak) peak = v
    else if (v < peak - LOG_FLOOR && agents * mu + k * theta > lambda) break
  }
  let total = 0
  const p = logw.map((v) => {
    const e = Math.exp(v - peak)
    total += e
    return e
  })
  for (let i = 0; i < p.length; i++) p[i] /= total
  return p
}

/**
 * Performance of an Erlang A queue.
 * @param {number} agents
 * @param {object} q
 * @param {number} q.volume       contacts offered in the interval
 * @param {number} q.ahtSec
 * @param {number} q.intervalSec
 * @param {number} q.patienceSec  mean time callers will wait before abandoning
 * @param {number} [q.targetSec]  service-level threshold
 */
export function erlangA(agents, { volume, ahtSec, intervalSec, patienceSec, targetSec = 20 }) {
  const lambda = volume / intervalSec
  if (lambda <= 0) return { agents, pWait: 0, pAbandon: 0, serviceLevel: 1, avgWait: 0, occupancy: 0, answered: 0 }
  if (agents <= 0) return { agents, pWait: 1, pAbandon: 1, serviceLevel: 0, avgWait: patienceSec, occupancy: 0, answered: 0 }
  const mu = 1 / ahtSec
  const theta = 1 / Math.max(1, patienceSec)
  const p = stationary(agents, lambda, mu, theta)

  let pWait = 0
  let eq = 0
  for (let k = 0; agents + k < p.length; k++) {
    pWait += p[agents + k]
    eq += k * p[agents + k]
  }
  const pAbandon = (theta * eq) / lambda
  const avgWait = eq / lambda

  // Tagged arrival finding N+j in system has j people ahead of it.
  const immediate = 1 - pWait
  const v = []
  for (let j = 0; agents + j < p.length; j++) v.push(p[agents + j])
  const J = v.length
  const Lam = agents * mu + J * theta + theta
  const lt = Lam * targetSec
  const steps = Math.ceil(lt + 10 * Math.sqrt(lt) + 20)
  let served = 0
  let abandoned = 0
  let servedByT = 0
  let abandonedByT = 0
  let waitServed = 0 // Σ answered mass × steps waited, for the average speed of answer
  let logPois = -lt
  for (let m = 0; m <= steps; m++) {
    if (m > 0) {
      // One uniformised step of the position chain.
      let nextServed = 0
      let nextAband = 0
      for (let k = 0; k < J; k++) {
        const mass = v[k]
        if (mass === 0) continue
        const adv = (agents * mu + k * theta) / Lam
        const ab = theta / Lam
        nextAband += mass * ab
        if (k === 0) nextServed += mass * adv
        else v[k - 1] += mass * adv
        v[k] = mass * (1 - adv - ab) // mass arriving from k+1 is added after this, later in the sweep
      }
      served += nextServed
      abandoned += nextAband
      waitServed += nextServed * m
      logPois += Math.log(lt / m)
    }
    const w = targetSec > 0 ? Math.exp(logPois) : m === 0 ? 1 : 0
    servedByT += w * served
    abandonedByT += w * abandoned
  }
  const answeredWithin = immediate + servedByT
  const serviceLevel = Math.min(1, answeredWithin / Math.max(1e-12, 1 - abandonedByT))
  const answered = 1 - pAbandon

  // Average speed of answer over answered calls, as phone systems report it.
  // Worked out only when read: keep stepping the same chain until the
  // waiting mass is spent; a call answered on step m has waited m / Lam.
  const tail = v // not used again below, so the getter can carry on stepping it in place
  let asaMemo = null
  const answeredAsa = () => {
    if (asaMemo != null) return asaMemo
    let total = waitServed
    let left = pWait - served - abandoned
    for (let m = steps + 1; left > 1e-9 * pWait && m < steps + 200000; m++) {
      let nextServed = 0
      let nextAband = 0
      for (let k = 0; k < J; k++) {
        const mass = tail[k]
        if (mass === 0) continue
        const adv = (agents * mu + k * theta) / Lam
        const ab = theta / Lam
        nextAband += mass * ab
        if (k === 0) nextServed += mass * adv
        else tail[k - 1] += mass * adv
        tail[k] = mass * (1 - adv - ab)
      }
      total += nextServed * m
      left -= nextServed + nextAband
    }
    asaMemo = answered > 0 ? total / Lam / answered : 0
    return asaMemo
  }
  const result = {
    agents,
    traffic: trafficIntensity(volume, ahtSec, intervalSec),
    pWait,
    pAbandon,
    serviceLevel,
    avgWait, // every caller, including time spent before hanging up
    occupancy: Math.min(1, (lambda * answered * ahtSec) / agents),
    answered,
  }
  Object.defineProperty(result, 'asa', { enumerable: true, get: answeredAsa }) // answered calls only
  return result
}

const cache = new Map()

/**
 * Minimum agents meeting the targets under Erlang A. Uses the Erlang C
 * requirement as an upper bound and binary-searches below it.
 */
export function requiredAgentsA(p) {
  const {
    volume, ahtSec, intervalSec, patienceSec = 120,
    targetSec = 20, slTarget = 0.8, asaTarget = null, abandonTarget = null,
    maxOccupancy = 1, concurrency = 1,
  } = p
  const key = [volume.toFixed(2), ahtSec.toFixed(1), intervalSec, patienceSec, targetSec, slTarget, asaTarget, abandonTarget, maxOccupancy, concurrency].join('|')
  if (cache.has(key)) return cache.get(key)
  const k = Math.max(1, concurrency)
  const q = { volume, ahtSec, intervalSec, patienceSec, targetSec }
  const ok = (r) =>
    (slTarget == null || r.serviceLevel >= slTarget) &&
    (asaTarget == null || r.asa <= asaTarget) &&
    (abandonTarget == null || r.pAbandon <= abandonTarget) &&
    (!(maxOccupancy > 0 && maxOccupancy < 1) || r.occupancy <= maxOccupancy)

  let result
  if (volume <= 0) {
    result = { agents: 0, traffic: 0, pWait: 0, pAbandon: 0, serviceLevel: 1, asa: 0, avgWait: 0, occupancy: 0, answered: 1 }
  } else {
    let hi = requiredAgentsC({ volume, ahtSec, intervalSec, targetSec, slTarget, asaTarget, maxOccupancy }).agents
    let hiR = erlangA(hi, q)
    while (!ok(hiR)) { hi += 1; hiR = erlangA(hi, q) }
    let lo = 0
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      const r = erlangA(mid, q)
      if (ok(r)) { hi = mid; hiR = r } else lo = mid
    }
    // hiR is a fresh object; set agents in place (spreading would read the lazy ASA for every interval).
    hiR.agents = Math.ceil(hi / k)
    result = hiR
  }
  if (cache.size > 50000) cache.clear()
  cache.set(key, result)
  return result
}
