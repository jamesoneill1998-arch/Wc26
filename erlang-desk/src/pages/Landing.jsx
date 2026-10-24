import { useState } from 'react'
import { BRAND, CURRENCY, PLANS } from '../config.js'
import { requiredAgents, withShrinkage } from '../engine/erlang.js'
import { Icon, NumberField } from '../components/ui.jsx'
import { fmtPct, fmtSec } from '../format.js'

function HeroCalculator() {
  const [volume, setVolume] = useState(250)
  const [aht, setAht] = useState(300)
  const r = requiredAgents({ volume, ahtSec: aht, intervalSec: 1800, targetSec: 20, slTarget: 0.8 })
  return (
    <div className="card" style={{ padding: 22 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <h2>Try it: how many agents?</h2>
        <span className="pill">80% in 20s</span>
      </div>
      <div className="grid grid-2" style={{ gap: 12 }}>
        <NumberField id="hero-vol" label="Contacts per 30 min" value={volume} min={0} max={50000} onChange={setVolume} />
        <NumberField id="hero-aht" label="Handle time" suffix="sec" value={aht} min={1} max={7200} onChange={setAht} />
      </div>
      <div className="grid grid-2" style={{ marginTop: 18, gap: 12 }}>
        <div className="tile">
          <div className="tile-label">Agents on the phones</div>
          <div className="tile-value" style={{ fontSize: 40 }}>{r.agents}</div>
          <div className="tile-sub">{Math.ceil(withShrinkage(r.agents, 0.32))} scheduled at 32% shrinkage</div>
        </div>
        <div className="stack" style={{ gap: 8, justifyContent: 'center' }}>
          <div className="row small"><span className="muted">Service level</span><span className="spacer" /><b className="num">{fmtPct(r.serviceLevel)}</b></div>
          <div className="row small"><span className="muted">Avg speed of answer</span><span className="spacer" /><b className="num">{fmtSec(r.asa)}</b></div>
          <div className="row small"><span className="muted">Occupancy</span><span className="spacer" /><b className="num">{fmtPct(r.occupancy)}</b></div>
        </div>
      </div>
    </div>
  )
}

const FEATURES = [
  [Icon.forecast, 'Forecasts that show their working', 'Four methods compete on a backtest of your own history. The most accurate one is picked automatically, and its error is shown so you know how far to trust it.'],
  [Icon.staffing, 'Interval staffing with Erlang C', 'Turn each day\'s forecast into agents needed per 15, 30 or 60 minutes, with service level, ASA, occupancy caps, chat concurrency and minimum cover built in.'],
  [Icon.capacity, '52-week capacity & hiring plan', 'Project headcount through attrition, training and nesting. Erlang Desk tells you how many people to hire, and when, to cover every week.'],
  [Icon.upload, 'Works with the data you have', 'Upload a CSV export from any ACD or telephony platform, daily or by interval. No integration project and no IT ticket.'],
  [Icon.shield, 'Private by design', 'Calculations run in your browser. Contact history is never uploaded to a server, which takes most of the pain out of procurement and data-protection review.'],
  [Icon.calculator, 'What-if in seconds', 'Change volume, AHT, shrinkage or attrition and watch requirements and hiring move straight away. Export any view to CSV for your finance pack.'],
]

export default function Landing({ onToggleTheme }) {
  return (
    <div className="land">
      <header className="land-nav">
        <a className="brand" href="#/" style={{ padding: 0 }}>
          <span className="brand-mark" aria-hidden="true">E</span>
          <span>{BRAND.name}</span>
        </a>
        <nav className="links">
          <a href="#features" className="hide-sm" onClick={(e) => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }) }}>Features</a>
          <a href="#pricing" className="hide-sm" onClick={(e) => { e.preventDefault(); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }) }}>Pricing</a>
          <button className="btn ghost sm" type="button" onClick={onToggleTheme} aria-label="Toggle theme">{Icon.moon}</button>
          <a className="btn primary sm" href="#/app">Open app</a>
        </nav>
      </header>

      <section className="land-hero">
        <div>
          <div className="eyebrow">WORKFORCE PLANNING FOR CONTACT CENTRES</div>
          <h1>Know how many people you need, every half hour, all year.</h1>
          <p className="lead">
            {BRAND.name} turns your contact history into a forecast, interval staffing requirements and a hiring plan.
            It does the job of a spreadsheet model, without the macros and without a six-figure WFM suite.
          </p>
          <div className="row">
            <a className="btn primary" href="#/app/data">Try it with sample data</a>
            <a className="btn" href="#/app/calculator">Free Erlang calculator</a>
          </div>
          <p className="small muted" style={{ marginTop: 14 }}>No sign-up needed to try it. Your data stays on your device.</p>
        </div>
        <HeroCalculator />
      </section>

      <section className="section" id="features">
        <h2>From history to hiring plan in four steps</h2>
        <p className="muted">Import, forecast, staff, plan. Every number can be traced back to an assumption you control.</p>
        <div className="features">
          {FEATURES.map(([ico, title, body]) => (
            <div className="card feature" key={title}>
              <div className="ico">{ico}</div>
              <h3>{title}</h3>
              <p className="muted small">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="pricing">
        <h2>Simple pricing</h2>
        <p className="muted">Monthly, cancel any time. Annual billing gets two months free.</p>
        <div className="prices">
          {PLANS.map((p) => (
            <div key={p.id} className={`card price${p.featured ? ' featured' : ''}`}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h2>{p.name}</h2>
                {p.featured && <span className="pill">Most popular</span>}
              </div>
              <div>
                <span className="amt">{p.price ? `${CURRENCY}${p.price}` : 'Free'}</span>{' '}
                <span className="muted small">{p.period}</span>
              </div>
              <p className="muted small">{p.blurb}</p>
              <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
              <a className={`btn${p.featured ? ' primary' : ''}`} href={p.href}>{p.cta}</a>
            </div>
          ))}
        </div>
      </section>

      <footer className="foot">
        <span>© {new Date().getFullYear()} {BRAND.name}</span>
        <span className="spacer" />
        {BRAND.contactEmail && <a href={`mailto:${BRAND.contactEmail}`}>Contact</a>}
        <a href="/privacy.html">Privacy</a>
      </footer>
    </div>
  )
}
