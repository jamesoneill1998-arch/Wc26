import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

process.env.SESSION_SECRET = 'test-secret-that-is-long-enough-1234567890'
process.env.APP_URL = 'https://app.example.com'
process.env.STRIPE_SECRET_KEY = 'sk_test_x'
process.env.STRIPE_PRICE_PRO = 'price_pro'
process.env.STRIPE_PRICE_TEAM = 'price_team'
process.env.RESEND_API_KEY = 're_x'
process.env.EMAIL_FROM = 'Erlang Desk <hello@example.com>'

const { default: request } = await import('../api/auth/request.js')
const { default: verifyLink } = await import('../api/auth/verify.js')
const { default: logout } = await import('../api/auth/logout.js')
const { default: me } = await import('../api/me.js')
const { default: checkout } = await import('../api/billing/checkout.js')
const { default: portal } = await import('../api/billing/portal.js')
const { default: team } = await import('../api/team.js')
const { resetRateLimits } = await import('../api/_lib/ratelimit.js')
const { sign, verify } = await import('../api/_lib/tokens.js')

// ── Fakes ────────────────────────────────────────────────────────────────
let customers, subs, emails, stripeCalls
beforeEach(() => {
  customers = []
  subs = []
  emails = []
  stripeCalls = []
  resetRateLimits()
})

function form(body) {
  const out = {}
  for (const [k, v] of new URLSearchParams(body ?? '')) out[k] = v
  return out
}

globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url)
  const json = (status, body) => ({ ok: status < 400, status, json: async () => body })
  if (u.hostname === 'api.resend.com') {
    emails.push(JSON.parse(init.body))
    return json(200, { id: 'em_1' })
  }
  assert.equal(u.hostname, 'api.stripe.com')
  assert.equal(init.headers.Authorization, 'Bearer sk_test_x')
  const p = form(init.body)
  stripeCalls.push({ method: init.method, path: u.pathname, params: p, query: Object.fromEntries(u.searchParams) })
  if (u.pathname === '/v1/customers' && init.method === 'GET') return json(200, { data: customers.filter((c) => c.email === u.searchParams.get('email')).slice(0, 1) })
  if (u.pathname === '/v1/customers' && init.method === 'POST') {
    const c = { id: `cus_${customers.length + 1}`, email: p.email, metadata: {} }
    customers.push(c)
    return json(200, c)
  }
  if (u.pathname.startsWith('/v1/customers/') && !u.pathname.endsWith('search')) {
    const c = customers.find((x) => x.id === u.pathname.split('/')[3])
    if (p['metadata[team_owner]'] !== undefined) {
      if (p['metadata[team_owner]'] === '') delete c.metadata.team_owner
      else c.metadata.team_owner = p['metadata[team_owner]']
    }
    return json(200, c)
  }
  if (u.pathname === '/v1/customers/search') {
    const owner = /'(cus_\w+)'/.exec(u.searchParams.get('query'))[1]
    return json(200, { data: customers.filter((c) => c.metadata.team_owner === owner) })
  }
  if (u.pathname === '/v1/subscriptions') return json(200, { data: subs.filter((s) => s.customer === u.searchParams.get('customer')) })
  if (u.pathname === '/v1/checkout/sessions') return json(200, { url: 'https://checkout.stripe.com/c/pay/cs_test_1' })
  if (u.pathname === '/v1/billing_portal/sessions') return json(200, { url: 'https://billing.stripe.com/p/session/1' })
  return json(404, { error: { message: 'not found' } })
}

function call(fn, { method = 'GET', url = '/', headers = {}, body } = {}) {
  const res = {
    statusCode: 200, headers: {}, body: '', headersSent: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v },
    getHeader(k) { return this.headers[k.toLowerCase()] },
    end(b = '') { this.body = b; this.headersSent = true },
  }
  const req = { method, url, headers: { 'x-real-ip': '203.0.113.9', ...headers }, body }
  return fn(req, res).then(() => ({ ...res, json: res.body ? JSON.parse(res.body) : null }))
}
const same = { origin: 'https://app.example.com', 'content-type': 'application/json' }
const cookiesFrom = (res) => [].concat(res.headers['set-cookie'] ?? []).map((c) => c.split(';')[0]).join('; ')

async function signIn(email = 'planner@acme.co.uk') {
  const r1 = await call(request, { method: 'POST', headers: same, body: { email } })
  assert.equal(r1.statusCode, 200)
  const link = new URL(/https:\/\/\S+/.exec(emails.at(-1).text)[0])
  const r2 = await call(verifyLink, { url: link.pathname + link.search, headers: { cookie: cookiesFrom(r1) } })
  return { r1, r2, link, cookie: cookiesFrom(r2).split('; ').find((c) => c.startsWith('__Host-ed_session')) }
}

// ── Tokens ───────────────────────────────────────────────────────────────
test('tokens are purpose-bound, tamper-evident and expire', () => {
  const secret = process.env.SESSION_SECRET
  const t = sign({ email: 'a@b.co' }, secret, 'login', 60)
  assert.equal(verify(t, secret, 'login').email, 'a@b.co')
  assert.equal(verify(t, secret, 'session'), null)
  assert.equal(verify(t, 'another-secret-another-secret-12345', 'login'), null)
  const [body, sig] = t.split('.')
  const forged = Buffer.from(JSON.stringify({ email: 'evil@x.co', exp: 9e9 })).toString('base64url')
  assert.equal(verify(`${forged}.${sig}`, secret, 'login'), null)
  assert.equal(verify(`${body}.${sig}x`, secret, 'login'), null)
  assert.equal(verify(sign({}, secret, 'login', -1), secret, 'login'), null)
})

// ── Sign-in ──────────────────────────────────────────────────────────────
test('magic-link sign-in sets a hardened session cookie', async () => {
  const { r1, r2, cookie } = await signIn()
  const loginCookie = [].concat(r1.headers['set-cookie'])[0]
  assert.match(loginCookie, /^__Host-ed_login=.+; Path=\/; Max-Age=900; HttpOnly; Secure; SameSite=Lax$/)
  assert.equal(r2.statusCode, 302)
  assert.equal(r2.headers.location, 'https://app.example.com/#/app/account?signin=ok')
  assert.equal(r2.headers['referrer-policy'], 'no-referrer')
  const set = [].concat(r2.headers['set-cookie'])
  assert.ok(set.some((c) => /^__Host-ed_session=.+HttpOnly; Secure; SameSite=Lax/.test(c)))
  assert.ok(set.some((c) => /^__Host-ed_login=; .*Max-Age=0/.test(c)), 'login nonce cleared')
  const who = await call(me, { headers: { cookie } })
  assert.ok(who.json.checked > 0)
  delete who.json.checked
  assert.deepEqual(who.json, { signedIn: true, email: 'planner@acme.co.uk', plan: null, status: null, role: null, active: false })
})

test('a sign-in link opened in another browser (no nonce) is refused', async () => {
  const { link } = await signIn()
  const r = await call(verifyLink, { url: link.pathname + link.search })
  assert.equal(r.headers.location, 'https://app.example.com/#/app/account?signin=failed')
  assert.equal(r.headers['set-cookie'], undefined)
  const wrong = await call(verifyLink, { url: link.pathname + link.search, headers: { cookie: '__Host-ed_login=someone-elses-nonce' } })
  assert.match(wrong.headers.location, /signin=failed/)
})

test('a login token cannot be used as a session cookie', async () => {
  const { link } = await signIn()
  const token = link.searchParams.get('token')
  const r = await call(me, { headers: { cookie: `__Host-ed_session=${token}` } })
  assert.deepEqual(r.json, { signedIn: false })
})

test('sign-in requests: CSRF, validation, no enumeration, rate limits', async () => {
  const cross = await call(request, { method: 'POST', headers: { ...same, origin: 'https://evil.example' }, body: { email: 'a@b.co' } })
  assert.equal(cross.statusCode, 403)
  const noOrigin = await call(request, { method: 'POST', headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }, body: { email: 'a@b.co' } })
  assert.equal(noOrigin.statusCode, 403)
  const get = await call(request, { method: 'GET' })
  assert.equal(get.statusCode, 405)
  for (const bad of ['', 'nope', 'a@b', '<script>@x.co', 'x'.repeat(250) + '@a.co', 42]) {
    const r = await call(request, { method: 'POST', headers: same, body: { email: bad } })
    assert.equal(r.statusCode, 400, String(bad))
  }
  const form = await call(request, { method: 'POST', headers: { ...same, 'content-type': 'application/x-www-form-urlencoded' }, body: 'email=a@b.co' })
  assert.equal(form.statusCode, 400, 'only JSON accepted')
  const a = await call(request, { method: 'POST', headers: same, body: { email: 'known@acme.co.uk' } })
  const b = await call(request, { method: 'POST', headers: same, body: { email: 'unknown@acme.co.uk' } })
  assert.equal(a.body, b.body)
  let last
  for (let i = 0; i < 6; i++) last = await call(request, { method: 'POST', headers: same, body: { email: 'spam@acme.co.uk' } })
  assert.equal(last.statusCode, 429)
})

test('email HTML escapes the link', async () => {
  await call(request, { method: 'POST', headers: same, body: { email: 'x@acme.co.uk' } })
  assert.ok(!emails[0].html.includes('<script'))
  assert.match(emails[0].html, /href="https:\/\/app\.example\.com\/api\/auth\/verify\?token=/)
})

test('logout clears the session and requires same origin', async () => {
  const bad = await call(logout, { method: 'POST', headers: { origin: 'https://evil.example' } })
  assert.equal(bad.statusCode, 403)
  const ok = await call(logout, { method: 'POST', headers: same })
  assert.match([].concat(ok.headers['set-cookie'])[0], /^__Host-ed_session=; .*Max-Age=0/)
})

// ── Billing ──────────────────────────────────────────────────────────────
test('checkout needs a session, whitelists plans and uses server-side prices', async () => {
  const anon = await call(checkout, { method: 'POST', headers: same, body: { plan: 'pro' } })
  assert.equal(anon.statusCode, 401)
  const { cookie } = await signIn()
  const h = { ...same, cookie }
  const bad = await call(checkout, { method: 'POST', headers: h, body: { plan: 'price_free_forever' } })
  assert.equal(bad.statusCode, 400)
  const cross = await call(checkout, { method: 'POST', headers: { ...h, origin: 'https://evil.example' }, body: { plan: 'pro' } })
  assert.equal(cross.statusCode, 403)
  const ok = await call(checkout, { method: 'POST', headers: h, body: { plan: 'pro' } })
  assert.equal(ok.json.url, 'https://checkout.stripe.com/c/pay/cs_test_1')
  const created = stripeCalls.find((c) => c.path === '/v1/checkout/sessions')
  assert.equal(created.params['line_items[0][price]'], 'price_pro')
  assert.equal(created.params['subscription_data[trial_period_days]'], '14')
  assert.equal(created.params.success_url, 'https://app.example.com/#/app/account?checkout=success')
  assert.equal(created.params.ui_mode, 'hosted')
  assert.equal(created.params.billing_address_collection, 'auto')
  assert.equal(created.params['phone_number_collection[enabled]'], 'false')
  assert.equal(created.params['automatic_tax[enabled]'], 'false')
  assert.equal(created.params.allow_promotion_codes, 'false')
  assert.equal(created.params.payment_method_collection, 'always')
})

test('plan is read from Stripe and refreshed on a stale session', async () => {
  const { cookie } = await signIn('owner@acme.co.uk')
  customers[0] ??= { id: 'cus_1', email: 'owner@acme.co.uk', metadata: {} }
  subs.push({ customer: customers[0].id, status: 'trialing', items: { data: [{ price: { id: 'price_team' } }] } })
  // Forge-free way to age the session: re-sign with chk = 0 using the server secret.
  const payload = verify(decodeURIComponent(cookie.split('=')[1]), process.env.SESSION_SECRET, 'session')
  const stale = sign({ ...payload, chk: 0 }, process.env.SESSION_SECRET, 'session', 3600)
  const r = await call(me, { headers: { cookie: `__Host-ed_session=${stale}` } })
  assert.equal(r.json.plan, 'team')
  assert.equal(r.json.active, true)
  assert.ok(r.headers['set-cookie'], 'refreshed cookie issued')
  const again = await call(checkout, { method: 'POST', headers: { ...same, cookie: `__Host-ed_session=${stale}` }, body: { plan: 'pro' } })
  assert.equal(again.statusCode, 409)
  const p = await call(portal, { method: 'POST', headers: { ...same, cookie: `__Host-ed_session=${stale}` } })
  assert.equal(p.json.url, 'https://billing.stripe.com/p/session/1')
})

test('a new subscription shows straight away on refresh, and a second checkout is refused', async () => {
  const { cookie } = await signIn('buyer@acme.co.uk')
  customers[0] ??= { id: 'cus_1', email: 'buyer@acme.co.uk', metadata: {} }
  // Signed in seconds ago, then paid: the cached plan is empty.
  subs.push({ customer: customers[0].id, status: 'trialing', items: { data: [{ price: { id: 'price_team' } }] } })
  assert.equal((await call(me, { headers: { cookie } })).json.active, false, 'normal reads use the cached plan')
  // Forced reads have a 3-second floor; age the session past it.
  const payload = verify(decodeURIComponent(cookie.split('=')[1]), process.env.SESSION_SECRET, 'session')
  const aged = `__Host-ed_session=${sign({ ...payload, chk: payload.chk - 5 }, process.env.SESSION_SECRET, 'session', 3600)}`
  const fresh = await call(me, { url: '/api/me?refresh=1', headers: { cookie: aged } })
  assert.equal(fresh.json.active, true)
  assert.equal(fresh.json.plan, 'team')
  const again = await call(checkout, { method: 'POST', headers: { ...same, cookie: aged }, body: { plan: 'pro' } })
  assert.equal(again.statusCode, 409, 'checkout re-reads Stripe before selling a second plan')
  assert.equal(stripeCalls.filter((c) => c.path === '/v1/checkout/sessions').length, 0)
})

test('ADMIN_EMAILS gives owners full access without Stripe, and removal revokes it', async () => {
  process.env.ADMIN_EMAILS = ' Founder@ErlangDesk.com , other@x.co '
  try {
    const { cookie } = await signIn('founder@erlangdesk.com')
    const who = await call(me, { headers: { cookie } })
    delete who.json.checked
    assert.deepEqual(who.json, { signedIn: true, email: 'founder@erlangdesk.com', plan: 'team', status: 'active', role: 'admin', active: true })
    assert.ok(!stripeCalls.some((c) => c.path.includes('/customers')), 'no Stripe lookup for an owner')
    const c = await call(checkout, { method: 'POST', headers: { ...same, cookie }, body: { plan: 'pro' } })
    assert.equal(c.statusCode, 409)
    const other = await signIn('planner@acme.co.uk')
    assert.equal((await call(me, { headers: { cookie: other.cookie } })).json.active, false)
    process.env.ADMIN_EMAILS = ''
    const payload = verify(decodeURIComponent(cookie.split('=')[1]), process.env.SESSION_SECRET, 'session')
    const stale = sign({ ...payload, chk: 0 }, process.env.SESSION_SECRET, 'session', 3600)
    const after = await call(me, { headers: { cookie: `__Host-ed_session=${stale}` } })
    assert.equal(after.json.active, false)
    assert.equal(after.json.role, null)
  } finally {
    delete process.env.ADMIN_EMAILS
  }
})

test('team owners can add up to four planners, who inherit the plan', async () => {
  customers.push({ id: 'cus_9', email: 'owner@acme.co.uk', metadata: {} })
  subs.push({ customer: 'cus_9', status: 'active', items: { data: [{ price: { id: 'price_team' } }] } })
  const { cookie } = await signIn('owner@acme.co.uk')
  const h = { ...same, cookie }
  for (const n of [1, 2, 3, 4]) {
    const r = await call(team, { method: 'POST', headers: h, body: { email: `p${n}@acme.co.uk` } })
    assert.equal(r.statusCode, 200)
  }
  const full = await call(team, { method: 'POST', headers: h, body: { email: 'p5@acme.co.uk' } })
  assert.equal(full.statusCode, 409)
  const list = await call(team, { headers: { cookie } })
  assert.equal(list.json.members.length, 4)
  // A member signs in and gets the Team plan, but can't manage billing or the team.
  const member = await signIn('p1@acme.co.uk')
  const who = await call(me, { headers: { cookie: member.cookie } })
  assert.equal(who.json.plan, 'team')
  assert.equal(who.json.role, 'member')
  assert.equal((await call(team, { headers: { cookie: member.cookie } })).statusCode, 403)
  assert.equal((await call(portal, { method: 'POST', headers: { ...same, cookie: member.cookie } })).statusCode, 403)
  // Removal revokes the link.
  await call(team, { method: 'DELETE', headers: h, body: { email: 'p1@acme.co.uk' } })
  assert.equal(customers.find((c) => c.email === 'p1@acme.co.uk').metadata.team_owner, undefined)
})

test('non-team users cannot manage a team', async () => {
  const { cookie } = await signIn()
  const r = await call(team, { method: 'POST', headers: { ...same, cookie }, body: { email: 'x@acme.co.uk' } })
  assert.equal(r.statusCode, 403)
})

test('misconfiguration fails closed without leaking details', async () => {
  const keep = process.env.SESSION_SECRET
  process.env.SESSION_SECRET = 'short'
  const r = await call(me, {})
  process.env.SESSION_SECRET = keep
  assert.equal(r.statusCode, 503)
  assert.deepEqual(r.json, { error: 'Service not configured' })
})
