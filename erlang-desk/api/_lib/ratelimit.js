// Fixed-window rate limiting. Uses Upstash Redis (shared across all
// serverless instances) when configured, otherwise a per-instance memory
// map — still useful, but configure Upstash in production.

import { createHash } from 'node:crypto'

const memory = new Map()

export async function rateLimit(cfg, key, max, windowSec) {
  // Keys carry emails and IP addresses, so only a one-way hash leaves this server.
  const [kind] = key.split(':', 1)
  const digest = createHash('sha256').update(`${cfg.sessionSecret}|${key}`).digest('base64url').slice(0, 32)
  const bucket = `rl:${kind}:${digest}:${Math.floor(Date.now() / 1000 / windowSec)}`
  if (cfg.upstashUrl && cfg.upstashToken) {
    try {
      const r = await fetch(`${cfg.upstashUrl}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.upstashToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([['INCR', bucket], ['EXPIRE', bucket, String(windowSec), 'NX']]),
      })
      if (r.ok) {
        const [incr] = await r.json()
        return Number(incr?.result) <= max
      }
      console.error('rate limit store unavailable', r.status)
    } catch (e) {
      console.error('rate limit store unavailable', e.message)
    }
  }
  if (memory.size > 10000) memory.clear()
  const n = (memory.get(bucket) ?? 0) + 1
  memory.set(bucket, n)
  return n <= max
}

export function resetRateLimits() {
  memory.clear()
}
