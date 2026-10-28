// POST /api/billing/checkout  { plan: 'pro' | 'team' } -> { url }
// Prices come from server configuration; the client only names a plan.

import { getConfig } from '../_lib/env.js'
import { allowMethods, requireSameOrigin, jsonBody, send, handler } from '../_lib/http.js'
import { rateLimit } from '../_lib/ratelimit.js'
import { currentSession } from '../_lib/session.js'
import { stripe, findOrCreateCustomer } from '../_lib/stripe.js'

export default handler(async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return
  const cfg = getConfig()
  if (!requireSameOrigin(req, res, cfg.appUrl)) return
  const s = await currentSession(req, res, cfg)
  if (!s) return send(res, 401, { error: 'Sign in first.' })
  const plan = jsonBody(req)?.plan
  if (plan !== 'pro' && plan !== 'team') return send(res, 400, { error: 'Unknown plan.' })
  if (!cfg.prices[plan]) return send(res, 503, { error: 'This plan is not available yet.' })
  if (s.role === 'admin') return send(res, 409, { error: 'Owner access already includes every feature.' })
  if (s.plan && s.role === 'owner') return send(res, 409, { error: 'You already have a subscription. Manage it from billing.', portal: true })
  if (!(await rateLimit(cfg, `checkout:${s.email}`, 10, 3600))) return send(res, 429, { error: 'Too many attempts.' })

  const customer = await findOrCreateCustomer(cfg, s.email)
  const session = await stripe(cfg, 'POST', '/checkout/sessions', {
    mode: 'subscription',
    customer: customer.id,
    line_items: { 0: { price: cfg.prices[plan], quantity: 1 } },
    subscription_data: cfg.trialDays ? { trial_period_days: cfg.trialDays, metadata: { plan } } : { metadata: { plan } },
    allow_promotion_codes: 'true',
    billing_address_collection: 'required',
    success_url: `${cfg.appUrl}/#/app/account?checkout=success`,
    cancel_url: `${cfg.appUrl}/#/app/account?checkout=cancelled`,
  })
  send(res, 200, { url: session.url })
})
