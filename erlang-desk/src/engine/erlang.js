// Erlang C queueing maths for inbound contact centres.
//
// Model: Poisson arrivals, exponential handle times, N identical agents,
// infinite queue, no abandonment (M/M/N). This is the industry-standard
// staffing model; it is slightly conservative when customers abandon.
//
// All functions are pure and work in seconds unless stated otherwise.

/** Traffic intensity in Erlangs: average number of agents busy. */
export function trafficIntensity(volume, ahtSec, intervalSec) {
  if (!(intervalSec > 0)) throw new Error('intervalSec must be > 0')
  return (Math.max(0, volume) * Math.max(0, ahtSec)) / intervalSec
}

/**
 * Erlang B (blocking probability) via the numerically stable recursion
 * B(0) = 1, B(n) = A·B(n-1) / (n + A·B(n-1)). Safe for thousands of agents.
 */
export function erlangB(agents, traffic) {
  let b = 1
  for (let n = 1; n <= agents; n++) b = (traffic * b) / (n + traffic * b)
  return b
}

/** Erlang C from a precomputed Erlang B value. */
function erlangCFromB(agents, traffic, b) {
  if (agents <= traffic) return 1
  return (agents * b) / (agents - traffic * (1 - b))
}

/** Probability an arriving contact has to wait at all. */
export function erlangC(agents, traffic) {
  if (traffic <= 0) return 0
  if (agents <= traffic) return 1
  return erlangCFromB(agents, traffic, erlangB(agents, traffic))
}

/** Fraction of contacts answered within `targetSec`. */
export function serviceLevel(agents, traffic, ahtSec, targetSec) {
  if (traffic <= 0) return 1
  if (agents <= traffic) return 0
  const pw = erlangC(agents, traffic)
  return 1 - pw * Math.exp((-(agents - traffic) * targetSec) / ahtSec)
}

/** Average speed of answer in seconds (across all contacts). */
export function asa(agents, traffic, ahtSec) {
  if (traffic <= 0) return 0
  if (agents <= traffic) return Infinity
  return (erlangC(agents, traffic) * ahtSec) / (agents - traffic)
}

/** Agent occupancy: share of logged-in time spent handling contacts. */
export function occupancy(agents, traffic) {
  if (agents <= 0) return 0
  return Math.min(1, traffic / agents)
}

/** Full set of KPIs for a given staffing level. */
export function metricsFor(agents, { volume, ahtSec, intervalSec, targetSec }) {
  const a = trafficIntensity(volume, ahtSec, intervalSec)
  return {
    agents,
    traffic: a,
    pWait: erlangC(agents, a),
    serviceLevel: serviceLevel(agents, a, ahtSec, targetSec),
    asa: asa(agents, a, ahtSec),
    occupancy: occupancy(agents, a),
  }
}

/**
 * Minimum agents that meet every target supplied.
 *
 * @param {object} p
 * @param {number} p.volume        contacts offered in the interval
 * @param {number} p.ahtSec        average handle time (seconds)
 * @param {number} p.intervalSec   interval length (seconds)
 * @param {number} [p.targetSec]   service-level threshold, e.g. 20
 * @param {number} [p.slTarget]    service-level goal as a fraction, e.g. 0.8
 * @param {number} [p.asaTarget]   maximum ASA in seconds
 * @param {number} [p.maxOccupancy] occupancy cap as a fraction, e.g. 0.85
 * @param {number} [p.concurrency] simultaneous contacts per agent (chat), default 1
 * @returns {{agents:number, traffic:number, pWait:number, serviceLevel:number, asa:number, occupancy:number}}
 */
export function requiredAgents(p) {
  const {
    volume, ahtSec, intervalSec,
    targetSec = 20, slTarget = 0.8, asaTarget = null,
    maxOccupancy = 1, concurrency = 1,
  } = p
  // Concurrency approximation: an agent working k chats behaves like k
  // servers, so we size in "slots" and divide back to people at the end.
  const k = Math.max(1, concurrency)
  const a = trafficIntensity(volume, ahtSec, intervalSec)
  if (a <= 0) {
    return { agents: 0, traffic: 0, pWait: 0, serviceLevel: 1, asa: 0, occupancy: 0 }
  }

  const occFloor = maxOccupancy > 0 && maxOccupancy < 1 ? Math.ceil(a / maxOccupancy) : 0
  let n = Math.max(1, Math.floor(a) + 1)
  // Walk the Erlang B recursion upward instead of restarting it for each N,
  // so the search is O(N) rather than O(N²).
  let b = erlangB(n - 1, a)
  const cap = Math.ceil(a) + 10000
  for (; n <= cap; n++) {
    b = (a * b) / (n + a * b)
    if (n < occFloor) continue
    const pw = erlangCFromB(n, a, b)
    const sl = 1 - pw * Math.exp((-(n - a) * targetSec) / ahtSec)
    const speed = (pw * ahtSec) / (n - a)
    const slOk = slTarget == null || sl >= slTarget
    const asaOk = asaTarget == null || speed <= asaTarget
    if (slOk && asaOk) {
      return {
        agents: Math.ceil(n / k),
        traffic: a,
        pWait: pw,
        serviceLevel: sl,
        asa: speed,
        occupancy: a / n,
      }
    }
  }
  throw new Error('No staffing level found within search cap')
}

/** Gross up productive agents for shrinkage (breaks, training, absence…). */
export function withShrinkage(agents, shrinkage) {
  const s = Math.min(Math.max(shrinkage, 0), 0.95)
  return agents / (1 - s)
}

/** A staffing table around the required level: useful for "what if I had N?". */
export function staffingTable(p, rows = 8) {
  const req = requiredAgents(p)
  const start = Math.max(Math.floor(req.traffic) + 1, req.agents - 3)
  const out = []
  for (let n = start; n < start + rows; n++) out.push(metricsFor(n, p))
  return out
}
