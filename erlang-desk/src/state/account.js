// Account and plan state from the server. Billing is only enforced when the
// deployment sets VITE_BILLING=on; otherwise every feature is available
// (local development, previews, self-hosted trials).

import { useCallback, useEffect, useState } from 'react'

export const BILLING = import.meta.env.VITE_BILLING === 'on'

const STRIPE_HOSTS = new Set(['checkout.stripe.com', 'billing.stripe.com'])

async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = {}
  try { json = await r.json() } catch { /* empty body */ }
  if (!r.ok) {
    const e = new Error(json.error || `Request failed (${r.status})`)
    e.status = r.status
    e.data = json
    throw e
  }
  return json
}

/** Only ever navigate to Stripe's own hosted pages. */
function goToStripe(url) {
  const u = new URL(url)
  if (u.protocol !== 'https:' || !STRIPE_HOSTS.has(u.hostname)) throw new Error('Unexpected billing address')
  window.location.assign(u.href)
}

export function useAccount() {
  const [state, setState] = useState({ loading: BILLING, signedIn: false })
  const refresh = useCallback(async () => {
    if (!BILLING) return
    try {
      setState({ loading: false, ...(await api('/api/me')) })
    } catch (e) {
      setState({ loading: false, signedIn: false, error: e.message })
    }
  }, [])
  useEffect(() => { refresh() }, [refresh])

  return {
    ...state,
    billing: BILLING,
    entitled: !BILLING || !!state.active,
    refresh,
    requestLink: (email) => api('/api/auth/request', { method: 'POST', body: { email } }),
    signOut: async () => { await api('/api/auth/logout', { method: 'POST', body: {} }); await refresh() },
    checkout: async (plan) => goToStripe((await api('/api/billing/checkout', { method: 'POST', body: { plan } })).url),
    portal: async () => goToStripe((await api('/api/billing/portal', { method: 'POST', body: {} })).url),
    team: {
      list: () => api('/api/team'),
      add: (email) => api('/api/team', { method: 'POST', body: { email } }),
      remove: (email) => api('/api/team', { method: 'DELETE', body: { email } }),
    },
  }
}
