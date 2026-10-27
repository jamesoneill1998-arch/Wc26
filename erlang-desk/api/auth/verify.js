// GET /api/auth/verify?token=…  (the link in the sign-in email)

import { getConfig } from '../_lib/env.js'
import { allowMethods, parseCookies, redirect, cookie, appendCookie, handler, LOGIN_COOKIE } from '../_lib/http.js'
import { verify, sha256, safeEqual, now } from '../_lib/tokens.js'
import { writeSession, freshEntitlement, SESSION_TTL } from '../_lib/session.js'

export default handler(async (req, res) => {
  if (!allowMethods(req, res, ['GET'])) return
  const cfg = getConfig()
  const url = new URL(req.url, cfg.appUrl)
  const payload = verify(url.searchParams.get('token') || '', cfg.sessionSecret, 'login')
  const nonce = parseCookies(req.headers.cookie)[LOGIN_COOKIE]
  if (!payload || !nonce || !safeEqual(sha256(nonce), payload.n)) {
    return redirect(res, `${cfg.appUrl}/#/app/account?signin=failed`)
  }
  let ent = { plan: null, status: null, role: null, customerId: null }
  let checked = 0 // 0 forces a fresh plan lookup on the next request
  try {
    ent = await freshEntitlement(cfg, payload.email)
    checked = now()
  } catch (e) {
    console.error('entitlement lookup failed', e.message)
  }
  appendCookie(res, cookie(LOGIN_COOKIE, '', 0))
  writeSession(res, cfg, { email: payload.email, ...ent, chk: checked, exp: now() + SESSION_TTL })
  redirect(res, `${cfg.appUrl}/#/app/account?signin=ok`)
})
