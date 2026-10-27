// Compact signed tokens (HMAC-SHA256), used for magic links and sessions.
// Each token is bound to a purpose so a login link can never be replayed as
// a session cookie, and comparisons are constant-time.

import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto'

const b64url = (buf) => Buffer.from(buf).toString('base64url')

function mac(secret, purpose, body) {
  return createHmac('sha256', secret).update(`${purpose}.${body}`).digest()
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && timingSafeEqual(x, y)
}

export const now = () => Math.floor(Date.now() / 1000)

export function sign(payload, secret, purpose, ttlSec) {
  const body = b64url(JSON.stringify({ ...payload, iat: now(), exp: now() + ttlSec }))
  return `${body}.${b64url(mac(secret, purpose, body))}`
}

/** @returns the payload, or null if malformed, forged, for another purpose, or expired. */
export function verify(token, secret, purpose) {
  if (typeof token !== 'string' || token.length > 4096) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  let given
  try { given = Buffer.from(sig, 'base64url') } catch { return null }
  const expected = mac(secret, purpose, body)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  let payload
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) } catch { return null }
  if (!payload || typeof payload !== 'object' || typeof payload.exp !== 'number' || payload.exp < now()) return null
  return payload
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')
export const sha256 = (s) => createHash('sha256').update(String(s)).digest('base64url')
