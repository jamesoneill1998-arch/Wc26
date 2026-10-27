// POST /api/auth/logout

import { getConfig } from '../_lib/env.js'
import { allowMethods, requireSameOrigin, send, handler } from '../_lib/http.js'
import { clearSession } from '../_lib/session.js'

export default handler(async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return
  const cfg = getConfig()
  if (!requireSameOrigin(req, res, cfg.appUrl)) return
  clearSession(res)
  send(res, 200, { ok: true })
})
