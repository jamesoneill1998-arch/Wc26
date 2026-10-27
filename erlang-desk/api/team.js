// /api/team — Team-plan owners add or remove up to 4 more planners.
//   GET                     -> { members: [email] }
//   POST   { email }        -> add
//   DELETE { email }        -> remove

import { getConfig } from './_lib/env.js'
import { allowMethods, requireSameOrigin, jsonBody, normaliseEmail, send, handler } from './_lib/http.js'
import { rateLimit } from './_lib/ratelimit.js'
import { currentSession } from './_lib/session.js'
import { stripe, findCustomer, findOrCreateCustomer, teamMembers } from './_lib/stripe.js'

export const MAX_MEMBERS = 4 // plus the owner = 5 planners

export default handler(async (req, res) => {
  if (!allowMethods(req, res, ['GET', 'POST', 'DELETE'])) return
  const cfg = getConfig()
  if (req.method !== 'GET' && !requireSameOrigin(req, res, cfg.appUrl)) return
  const s = await currentSession(req, res, cfg)
  if (!s) return send(res, 401, { error: 'Sign in first.' })
  if (s.plan !== 'team' || s.role !== 'owner' || !s.customerId) return send(res, 403, { error: 'Only the Team plan owner can manage planners.' })

  if (req.method === 'GET') return send(res, 200, { members: await teamMembers(cfg, s.customerId) })

  if (!(await rateLimit(cfg, `team:${s.email}`, 30, 3600))) return send(res, 429, { error: 'Too many changes. Try again later.' })
  const email = normaliseEmail(jsonBody(req)?.email)
  if (!email || email === s.email) return send(res, 400, { error: 'Enter a colleague\'s email address.' })

  if (req.method === 'POST') {
    const members = await teamMembers(cfg, s.customerId)
    if (members.includes(email)) return send(res, 200, { members })
    if (members.length >= MAX_MEMBERS) return send(res, 409, { error: `The Team plan includes ${MAX_MEMBERS + 1} planners.` })
    const c = await findOrCreateCustomer(cfg, email)
    if (c.metadata?.team_owner && c.metadata.team_owner !== s.customerId) return send(res, 409, { error: 'That person already belongs to another team.' })
    await stripe(cfg, 'POST', `/customers/${c.id}`, { metadata: { team_owner: s.customerId } })
    return send(res, 200, { members: [...members, email] })
  }

  const c = await findCustomer(cfg, email)
  if (c?.metadata?.team_owner === s.customerId) await stripe(cfg, 'POST', `/customers/${c.id}`, { metadata: { team_owner: '' } })
  send(res, 200, { members: (await teamMembers(cfg, s.customerId)).filter((m) => m !== email) })
})
