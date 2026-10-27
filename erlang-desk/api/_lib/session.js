// Sessions are signed, HttpOnly cookies: no server-side store to breach,
// unreadable by page scripts, and never sent cross-site on POSTs.

import { sign, verify, now } from './tokens.js'
import { parseCookies, cookie, appendCookie, SESSION_COOKIE } from './http.js'
import { entitlementFor } from './stripe.js'

export const SESSION_TTL = 7 * 24 * 3600
const RECHECK_SEC = 10 * 60 // re-read the subscription from Stripe at most every 10 minutes

export function readSession(req, cfg) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
  return token ? verify(token, cfg.sessionSecret, 'session') : null
}

export function writeSession(res, cfg, data) {
  const { iat, exp, ...rest } = data
  // Keep the original expiry so sessions are absolute, not endlessly sliding.
  const remaining = exp ? Math.max(1, exp - now()) : SESSION_TTL
  appendCookie(res, cookie(SESSION_COOKIE, sign(rest, cfg.sessionSecret, 'session', remaining), remaining))
}

export function clearSession(res) {
  appendCookie(res, cookie(SESSION_COOKIE, '', 0))
}

export async function freshEntitlement(cfg, email) {
  if (!cfg.stripeKey) return { plan: null, status: null, role: null, customerId: null }
  return entitlementFor(cfg, email)
}

/** Session with an up-to-date plan; rewrites the cookie when it refreshes. */
export async function currentSession(req, res, cfg) {
  const s = readSession(req, cfg)
  if (!s) return null
  if (now() - (s.chk ?? 0) < RECHECK_SEC) return s
  const ent = await freshEntitlement(cfg, s.email)
  const next = { ...s, ...ent, chk: now() }
  writeSession(res, cfg, next)
  return next
}
