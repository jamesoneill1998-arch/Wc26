import { useEffect, useState } from 'react'
import { CURRENCY, PLANS } from '../config.js'
import { PageHead, Panel, TextField, ConfirmButton } from '../components/ui.jsx'
import { clearStoredWorkspace, emptyWorkspace } from '../state/store.js'

function SignIn({ account, plan }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState({ sent: false, error: null, busy: false })
  return (
    <Panel title="Sign in">
      {state.sent ? (
        <p>Check <b>{email}</b> for a sign-in link. It works for 15 minutes, in this browser only.{plan ? ' You\'ll come back here to finish starting your trial.' : ''}</p>
      ) : (
        <form className="stack-s" onSubmit={async (e) => {
          e.preventDefault()
          setState({ sent: false, error: null, busy: true })
          try {
            await account.requestLink(email)
            try { if (plan) sessionStorage.setItem('erlang-desk:plan', plan) } catch { /* storage blocked */ }
            setState({ sent: true, error: null, busy: false })
          } catch (err) {
            setState({ sent: false, error: err.message, busy: false })
          }
        }}>
          <p className="muted">No passwords. We'll email you a link that signs you in on this device.</p>
          <div style={{ maxWidth: 380 }}><TextField label="Work email" type="email" autoComplete="email" maxLength={254} value={email} onChange={setEmail} /></div>
          {state.error && <p className="status bad" role="alert">{state.error}</p>}
          <div><button className="btn primary" type="submit" disabled={state.busy || !email}>Email me a link</button></div>
        </form>
      )}
    </Panel>
  )
}

function Team({ account }) {
  const [members, setMembers] = useState(null)
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  useEffect(() => { account.team.list().then((r) => setMembers(r.members)).catch((e) => setError(e.message)) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (fn) => { setError(null); try { setMembers((await fn()).members) } catch (e) { setError(e.message) } }
  return (
    <Panel title="Planners on your team" aside={members ? `${members.length + 1} of 5 seats` : ''}>
      <table style={{ marginBottom: 16 }}>
        <tbody>
          <tr><td>{account.email}</td><td className="faint">Owner</td></tr>
          {(members ?? []).map((m) => (
            <tr key={m}><td>{m}</td><td><button className="btn link" type="button" onClick={() => run(() => account.team.remove(m))}>Remove</button></td></tr>
          ))}
        </tbody>
      </table>
      <form className="row" style={{ alignItems: 'flex-end' }} onSubmit={(e) => { e.preventDefault(); run(() => account.team.add(email)).then(() => setEmail('')) }}>
        <div style={{ flex: 1, minWidth: 220 }}><TextField label="Colleague's email" type="email" value={email} maxLength={254} onChange={setEmail} /></div>
        <button className="btn" type="submit" disabled={!email}>Add planner</button>
      </form>
      {error && <p className="status bad" role="alert" style={{ marginTop: 10 }}>{error}</p>}
      <p className="small faint" style={{ marginTop: 10 }}>Each planner signs in with their own email. Workspaces stay on each planner's device; share them with Export and Import.</p>
    </Panel>
  )
}

export default function AccountPage({ account, query, replace, ws, update }) {
  const [error, setError] = useState(null)
  const signin = query?.get('signin')
  const checkout = query?.get('checkout')
  const wanted = query?.get('plan') || (() => { try { return sessionStorage.getItem('erlang-desk:plan') } catch { return null } })()

  // Coming back from a sign-in link with a plan chosen on the pricing page: go straight to checkout.
  useEffect(() => {
    if (account.billing && account.signedIn && !account.active && (wanted === 'pro' || wanted === 'team') && signin === 'ok') {
      try { sessionStorage.removeItem('erlang-desk:plan') } catch { /* storage blocked */ }
      account.checkout(wanted).catch((e) => setError(e.message))
    }
  }, [account.signedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = (fn) => async () => { setError(null); try { await fn() } catch (e) { setError(e.message) } }

  return (
    <div className="stack">
      <PageHead eyebrow="Account" title="Account and billing" lede="Your planning data never leaves this browser. Your account only holds your email and subscription." />
      {signin === 'failed' && <div className="notice">That sign-in link didn't work. Links last 15 minutes and must be opened in the browser that asked for them. Request a new one below.</div>}
      {checkout === 'success' && <div className="notice ok">Thank you. Your subscription is active; it may take a moment to show here.</div>}
      {error && <div className="notice" role="alert">{error}</div>}

      {!account.billing && (
        <div className="notice ok">Billing isn't switched on for this installation, so every feature is available.</div>
      )}

      {account.billing && !account.loading && !account.signedIn && <SignIn account={account} plan={wanted} />}

      {account.billing && account.signedIn && (
        <Panel title={account.email} aside={<button className="btn link" type="button" onClick={act(account.signOut)}>Sign out</button>}>
          {account.role === 'admin' ? (
            <p>You have <b>owner access</b>: every feature, with no subscription.</p>
          ) : account.active ? (
            <div className="stack-s">
              <p>You're on <b>{account.plan === 'team' ? 'Team' : 'Pro'}</b>{account.status === 'trialing' ? ', in your free trial' : ''}{account.status === 'past_due' ? '. Your last payment failed; update your card to keep access' : ''}.</p>
              {account.role === 'member' ? <p className="muted">Your team owner manages billing.</p> : <div><button className="btn" type="button" onClick={act(account.portal)}>Invoices, card and cancellation</button></div>}
            </div>
          ) : (
            <div className="stack-s">
              <p className="muted">No active plan. Start a 14-day trial to import your own data and export plans.</p>
              <div className="row">
                {PLANS.filter((p) => p.price).map((p) => (
                  <button key={p.id} className={`btn${p.featured ? ' primary' : ''}`} type="button" onClick={act(() => account.checkout(p.id))}>{p.name} · {CURRENCY}{p.price} {p.id === 'pro' ? 'a month' : 'a month, five planners'}</button>
                ))}
              </div>
            </div>
          )}
        </Panel>
      )}

      {account.billing && account.active && account.plan === 'team' && account.role === 'owner' && <Team account={account} />}

      <Panel title="Organisation">
        <div style={{ maxWidth: 420 }}>
          <TextField label="Name shown on plans and summaries" value={ws.name} maxLength={80} onChange={(name) => update({ name })} />
        </div>
      </Panel>

      <Panel title="Data on this device">
        <div className="stack-s">
          <p className="muted small">Workspaces are kept in this browser's storage. On a shared computer, erase them when you finish.</p>
          <div><ConfirmButton confirmLabel="Click again to erase everything" onConfirm={() => { clearStoredWorkspace(); replace(emptyWorkspace()) }}>Erase all data on this device</ConfirmButton></div>
        </div>
      </Panel>
    </div>
  )
}
