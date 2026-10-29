// Sessions are signed, HttpOnly cookies: no server-side store to breach,
// unreadable by page scripts, and never sent cross-site on POSTs.

import { sign, verify, now } from './tokens.js'
import { parseCookies, cookie, appendCookie, SESSION_COOKIE } from './http.js'
import { entitlementFor } from './stripe.js'
import { rateLimit } from './ratelimit.js'

export const SESSION_TTL = 7 * 24 * 3600
const RECHECK_SEC = 10 * 60 // re-read the subscription from Stripe at most every 10 minutes
const FORCE_MIN_SEC = 3 // ...or sooner on request (just back from checkout), but not in a tight loop

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

export const ADMIN_ENTITLEMENT = { plan: 'team', status: 'active', role: 'admin', customerId: null }

export async function freshEntitlement(cfg, email) {
  if (cfg.adminEmails?.includes(email)) return ADMIN_ENTITLEMENT
  if (!cfg.stripeKey) return { plan: null, status: null, role: null, customerId: null }
  return entitlementFor(cfg, email)
}

/** Session with an up-to-date plan; rewrites the cookie when it refreshes. */
export async function currentSession(req, res, cfg, { force = false } = {}) {
  const s = readSession(req, cfg)
  if (!s) return null
  const age = now() - (s.chk ?? 0)
  if (age < (force ? FORCE_MIN_SEC : RECHECK_SEC)) return s
  // An old cookie can be replayed to dodge the floor, so forced reads are also capped per person.
  if (force && age < RECHECK_SEC && !(await rateLimit(cfg, `refresh:${s.email}`, 30, 600))) return s
  const ent = await freshEntitlement(cfg, s.email)
  const next = { ...s, ...ent, chk: now() }
  writeSession(res, cfg, next)
  return next
}
