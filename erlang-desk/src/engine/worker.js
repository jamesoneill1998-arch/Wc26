// Runs planning off the main thread so typing in a field never stutters,
// even with Erlang A across several services and a year of intervals.

import { computeWorkspace, createCache } from './compute.js'

const cache = createCache()

self.onmessage = (e) => {
  const { seq, ws } = e.data
  try {
    self.postMessage({ seq, result: computeWorkspace(ws, cache) })
  } catch (err) {
    self.postMessage({ seq, error: String(err?.message ?? err) })
  }
}
