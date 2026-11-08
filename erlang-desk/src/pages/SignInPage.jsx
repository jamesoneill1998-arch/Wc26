import { useEffect, useState } from 'react'
import { CURRENCY, PLANS } from '../config.js'
import { Mark } from '../components/ui.jsx'
import { safeNext, signInHref } from '../state/signin.js'

const AFTER = 'erlang-desk:after-signin'
const PLAN = 'erlang-desk:plan'

const store = (k, v) => { try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k) } catch { /* storage blocked */ } }
const read = (k) => { try { return sessionStorage.getItem(k) } catch { return null } }

/**
 * Sign in, and start a trial: one page for both, outside the app shell.
 * The emailed link lands back here (?signin=ok), and we send the planner on
 * to checkout if they chose a plan, otherwise to where they were going.
 */
export default function SignInPage({ account, query }) {
  const signin = query.get('signin')
  const plan = PLANS.find((p) => p.id === query.get('plan') && p.price) ?? null
  const next = safeNext(query.get('next'))
  const [email, setEmail] = useState('')
  const [state, setState] = useState({ sent: false, error: null, busy: false })

  useEffect(() => {
    if (account.loading) return
    if (!account.billing) { window.location.replace('#/app/overview'); return }
    if (!account.signedIn) return
    // Signed in, by the emailed link or already: carry on.
    const wanted = read(PLAN)
    const to = read(AFTER) ?? next
    store(AFTER, null)
    window.location.replace(wanted ? '#/app/account?signin=ok' : `#${safeNext(to)}`)
  }, [account.loading, account.billing, account.signedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (e) => {
    e?.preventDefault()
    setState({ sent: false, error: null, busy: true })
    try {
      await account.requestLink(email)
      store(AFTER, next)
      store(PLAN, plan?.id ?? null)
      setState({ sent: true, error: null, busy: false })
    } catch (err) {
      setState({ sent: false, error: err.message, busy: false })
    }
  }

  if (account.loading || !account.billing || account.signedIn) return <div className="signin-page" aria-busy="true" />

  return (
    <div className="signin-page">
      <main id="main" className="signin-card" tabIndex={-1}>
        <a className="nameplate" href="#/"><Mark />Erlang Desk</a>
        {state.sent ? (
          <div className="stack-s" role="status">
            <h1>Check your inbox</h1>
            <p>We've sent a sign-in link to <b>{email}</b>. It works for 15 minutes, and only in this browser.</p>
            <p className="muted small">Not there after a minute? Check your junk or spam folder: links from a new sender sometimes land there.</p>
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn" type="button" onClick={send} disabled={state.busy}>Send it again</button>
              <button className="btn link" type="button" onClick={() => setState({ sent: false, error: null, busy: false })}>Use a different email</button>
            </div>
            {state.error && <p className="status bad" role="alert">{state.error}</p>}
          </div>
        ) : (
          <form className="stack-s" onSubmit={send}>
            <h1>{plan ? `Start your 14-day ${plan.name} trial` : 'Sign in to Erlang Desk'}</h1>
            {signin === 'failed' && (
              <p className="notice" role="alert">That link didn't work. Links last 15 minutes and must be opened in the browser that asked for them. Request a new one below.</p>
            )}
            <p className="muted">
              {plan
                ? `Enter your work email and we'll send a link to sign in. Then you add a card with Stripe: nothing is charged for 14 days, and after that it's ${CURRENCY}${plan.price} ${plan.per}.`
                : "No password. We'll email you a link that signs you in on this device."}
            </p>
            <div className="field">
              <label htmlFor="signin-email">Work email</label>
              <input id="signin-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            {state.error && <p className="status bad" role="alert">{state.error}</p>}
            <button className="btn primary" type="submit" disabled={state.busy || !email}>Email me a link</button>
          </form>
        )}
        <div className="signin-foot">
          {plan ? (
            <p className="small">Already subscribed? <a href={signInHref(query.get('next'))}>Just sign in</a></p>
          ) : (
            <p className="small">
              No account yet? Start a 14-day trial:{' '}
              {PLANS.filter((p) => p.price).map((p, i) => (
                <span key={p.id}>{i > 0 && ' or '}<a href={signInHref(query.get('next'), p.id)}>{p.name} ({CURRENCY}{p.price})</a></span>
              ))}
            </p>
          )}
          <p className="small faint">Your planning data stays in your browser. Your account only holds your email and subscription.</p>
        </div>
      </main>
    </div>
  )
}
