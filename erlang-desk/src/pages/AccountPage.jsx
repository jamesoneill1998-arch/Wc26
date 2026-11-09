import { useEffect, useRef, useState } from 'react'
import { BRAND, CURRENCY, PLANS } from '../config.js'
import { PageHead, Panel, TextField, ConfirmButton, Locked } from '../components/ui.jsx'
import { clearStoredWorkspace, emptyWorkspace } from '../state/store.js'
import { buildSampleWorkspace } from '../state/sample.js'
import { exportWorkspace } from './common.jsx'
import { signInHref } from '../state/signin.js'

function SignIn({ plan }) {
  return (
    <Panel title="Sign in">
      <div className="stack-s">
        <p className="muted">No passwords. We email you a link that signs you in on this device.</p>
        <div><a className="btn primary" href={signInHref('/app/account', plan)}>{plan ? 'Sign in to start your trial' : 'Sign in'}</a></div>
      </div>
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

  // Back from checkout: read the plan straight from Stripe, retrying briefly
  // in case the subscription is still being created.
  const [gaveUp, setGaveUp] = useState(false)
  useEffect(() => {
    if (checkout !== 'success' || !account.billing) return undefined
    let stop = false
    ;(async () => {
      for (let i = 0; i < 6 && !stop; i++) {
        const me = await account.refresh({ force: true })
        if (me?.active) break
        await new Promise((r) => setTimeout(r, 3500))
      }
      if (!stop) setGaveUp(true)
    })()
    return () => { stop = true }
  }, [checkout]) // eslint-disable-line react-hooks/exhaustive-deps

  const wsRef = useRef(null)
  const [wsMsg, setWsMsg] = useState(null)
  const importWorkspace = async (file) => {
    if (!file) return
    if (file.size > 50 * 1024 * 1024) return setWsMsg({ ok: false, text: 'That file is too large to be a workspace.' })
    try {
      replace(JSON.parse(await file.text()))
      setWsMsg({ ok: true, text: 'Workspace opened.' })
    } catch {
      setWsMsg({ ok: false, text: 'That file is not an Erlang Desk workspace export.' })
    }
  }

  const act = (fn) => async () => { setError(null); try { await fn() } catch (e) { setError(e.message) } }

  return (
    <div className="stack">
      <PageHead eyebrow="Account" title="Account & workspace" lede="Your planning data stays in this browser. Your account only holds your email and subscription." />
      {checkout === 'success' && (account.active
        ? <div className="notice ok">Thank you. Your {account.plan === 'team' ? 'Team' : 'Pro'} plan is active.</div>
        : !gaveUp
          ? <div className="notice">Confirming your subscription with Stripe…</div>
          : <div className="notice">Payment received. If your plan doesn't show yet, refresh this page in a minute, or email {BRAND.contactEmail || 'us'}.</div>)}
      {error && <div className="notice" role="alert">{error}</div>}

      {!account.billing && (
        <div className="notice ok">Billing isn't switched on for this installation, so every feature is available.</div>
      )}

      {account.billing && !account.loading && !account.signedIn && <SignIn plan={wanted === 'pro' || wanted === 'team' ? wanted : null} />}

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

      <Panel title="Workspace">
        <div className="stack-s">
          <p className="muted small">Your whole plan lives in this browser. Export a copy to back it up, move it to another device or hand it to a colleague; they open it here or from their welcome screen. Imported files are checked field by field before they load.</p>
          {wsMsg && <p className={`status${wsMsg.ok ? ' good' : ' bad'}`} role="status">{wsMsg.text}</p>}
          {account.entitled ? (
            <div className="row">
              <button className="btn" type="button" onClick={() => exportWorkspace(ws)}>Export workspace</button>
              <button className="btn" type="button" onClick={() => wsRef.current?.click()}>Import workspace</button>
              <input ref={wsRef} type="file" accept=".json,application/json" hidden onChange={(e) => { importWorkspace(e.target.files[0]); e.target.value = '' }} />
            </div>
          ) : <Locked account={account} what="Exporting and importing workspaces" />}
          <p className="muted small" style={{ marginTop: 6 }}>On a shared computer, erase the data when you finish.</p>
          <div className="row">
            <ConfirmButton className="btn sm" confirmLabel="Click again to replace your workspace" onConfirm={() => replace(buildSampleWorkspace())}>Load the sample operation</ConfirmButton>
            <ConfirmButton className="btn sm" confirmLabel="Click again to erase everything" onConfirm={() => { clearStoredWorkspace(); replace(emptyWorkspace()) }}>Erase all data on this device</ConfirmButton>
          </div>
        </div>
      </Panel>
    </div>
  )
}
