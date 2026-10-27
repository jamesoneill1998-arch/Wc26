// GET /api/me — who is signed in and what their plan allows.

import { getConfig } from './_lib/env.js'
import { allowMethods, send, handler } from './_lib/http.js'
import { currentSession } from './_lib/session.js'

const ACTIVE = new Set(['active', 'trialing', 'past_due'])

export default handler(async (req, res) => {
  if (!allowMethods(req, res, ['GET'])) return
  const cfg = getConfig()
  const s = await currentSession(req, res, cfg)
  if (!s) return send(res, 200, { signedIn: false })
  send(res, 200, {
    signedIn: true,
    email: s.email,
    plan: s.plan ?? null,
    status: s.status ?? null,
    role: s.role ?? null,
    active: !!s.plan && ACTIVE.has(s.status),
  })
})
