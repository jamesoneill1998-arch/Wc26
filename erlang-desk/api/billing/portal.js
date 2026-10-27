// POST /api/billing/portal -> { url }  (Stripe-hosted invoices, card, cancel)

import { getConfig } from '../_lib/env.js'
import { allowMethods, requireSameOrigin, send, handler } from '../_lib/http.js'
import { currentSession } from '../_lib/session.js'
import { stripe, findCustomer } from '../_lib/stripe.js'

export default handler(async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return
  const cfg = getConfig()
  if (!requireSameOrigin(req, res, cfg.appUrl)) return
  const s = await currentSession(req, res, cfg)
  if (!s) return send(res, 401, { error: 'Sign in first.' })
  if (s.role === 'member') return send(res, 403, { error: 'Billing is managed by your team owner.' })
  const customer = await findCustomer(cfg, s.email)
  if (!customer) return send(res, 404, { error: 'No billing account yet.' })
  const portal = await stripe(cfg, 'POST', '/billing_portal/sessions', { customer: customer.id, return_url: `${cfg.appUrl}/#/app/account` })
  send(res, 200, { url: portal.url })
})
