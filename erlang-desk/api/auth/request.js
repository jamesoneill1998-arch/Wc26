// POST /api/auth/request  { email }
// Emails a single-use-browser sign-in link. Always answers the same way
// whether or not the address has an account, so it can't be used to probe
// for customers.

import { getConfig } from '../_lib/env.js'
import { allowMethods, requireSameOrigin, jsonBody, normaliseEmail, send, clientIp, cookie, appendCookie, handler, LOGIN_COOKIE } from '../_lib/http.js'
import { rateLimit } from '../_lib/ratelimit.js'
import { sign, randomToken, sha256 } from '../_lib/tokens.js'
import { sendSignInEmail } from '../_lib/email.js'

export const LOGIN_TTL = 15 * 60

export default handler(async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return
  const cfg = getConfig()
  if (!requireSameOrigin(req, res, cfg.appUrl)) return
  const body = jsonBody(req)
  const email = normaliseEmail(body?.email)
  if (!email) return send(res, 400, { error: 'Enter a valid email address.' })

  const ipOk = await rateLimit(cfg, `login-ip:${clientIp(req)}`, 10, 900)
  const emailOk = await rateLimit(cfg, `login-email:${sha256(email)}`, 5, 900)
  if (!ipOk || !emailOk) return send(res, 429, { error: 'Too many attempts. Try again in 15 minutes.' }, { 'Retry-After': '900' })

  // The link only works alongside this browser's nonce cookie, so a leaked
  // or forwarded email (or a link-scanning proxy) can't open a session.
  const nonce = randomToken()
  const token = sign({ email, n: sha256(nonce) }, cfg.sessionSecret, 'login', LOGIN_TTL)
  appendCookie(res, cookie(LOGIN_COOKIE, nonce, LOGIN_TTL))
  await sendSignInEmail(cfg, email, `${cfg.appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`)
  send(res, 200, { ok: true })
})
