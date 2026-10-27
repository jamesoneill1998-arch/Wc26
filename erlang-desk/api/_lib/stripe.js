// Minimal Stripe REST client. No SDK dependency: a smaller supply chain and
// nothing to keep patched. API version is pinned so behaviour can't drift.

const API = 'https://api.stripe.com/v1'
const VERSION = '2024-06-20'

function encode(params, prefix = '', out = []) {
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === undefined || v === null) continue
    const key = prefix ? `${prefix}[${k}]` : k
    if (typeof v === 'object') encode(v, key, out)
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`)
  }
  return out.join('&')
}

export class StripeError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'StripeError'
    this.status = status
  }
}

export async function stripe(cfg, method, path, params, idempotencyKey) {
  if (!cfg.stripeKey) {
    const e = new Error('Stripe is not configured')
    e.name = 'ConfigError'
    throw e
  }
  const url = method === 'GET' && params ? `${API}${path}?${encode(params)}` : `${API}${path}`
  const headers = { Authorization: `Bearer ${cfg.stripeKey}`, 'Stripe-Version': VERSION }
  let body
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    body = encode(params)
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  }
  const r = await fetch(url, { method, headers, body })
  const json = await r.json().catch(() => ({}))
  if (!r.ok) throw new StripeError(json?.error?.message || `Stripe ${r.status}`, r.status)
  return json
}

const CUS = /^cus_[A-Za-z0-9]+$/

export async function findCustomer(cfg, email) {
  const list = await stripe(cfg, 'GET', '/customers', { email, limit: 1 })
  return list.data?.[0] ?? null
}

export async function findOrCreateCustomer(cfg, email) {
  return (await findCustomer(cfg, email)) ?? stripe(cfg, 'POST', '/customers', { email, metadata: { source: 'erlang-desk' } }, `cus-${email}`)
}

const LIVE = new Set(['active', 'trialing', 'past_due'])

/** The customer's current Erlang Desk plan, judged from their subscriptions' price IDs. */
export async function planFor(cfg, customerId) {
  if (!CUS.test(customerId)) return null
  const subs = await stripe(cfg, 'GET', '/subscriptions', { customer: customerId, status: 'all', limit: 10 })
  let best = null
  for (const s of subs.data ?? []) {
    if (!LIVE.has(s.status)) continue
    for (const item of s.items?.data ?? []) {
      const price = item.price?.id
      const plan = price === cfg.prices.team ? 'team' : price === cfg.prices.pro ? 'pro' : null
      if (plan && (!best || plan === 'team')) best = { plan, status: s.status }
    }
  }
  return best
}

/**
 * Who this email is and what they may use. Team members are linked to the
 * owner's customer via metadata, so Stripe stays the single source of truth.
 */
export async function entitlementFor(cfg, email) {
  const customer = await findCustomer(cfg, email)
  if (!customer) return { plan: null, status: null, role: null, customerId: null }
  const own = await planFor(cfg, customer.id)
  if (own) return { ...own, role: 'owner', customerId: customer.id }
  const owner = customer.metadata?.team_owner
  if (owner && CUS.test(owner)) {
    const shared = await planFor(cfg, owner)
    if (shared?.plan === 'team') return { ...shared, role: 'member', customerId: customer.id }
  }
  return { plan: null, status: null, role: null, customerId: customer.id }
}

export async function teamMembers(cfg, ownerId) {
  if (!CUS.test(ownerId)) return []
  const r = await stripe(cfg, 'GET', '/customers/search', { query: `metadata['team_owner']:'${ownerId}'`, limit: 20 })
  return (r.data ?? []).map((c) => c.email).filter(Boolean)
}
