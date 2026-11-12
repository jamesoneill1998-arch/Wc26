import { useMemo, useState } from 'react'
import { BRAND, CURRENCY, PLANS } from '../config.js'
import { requiredAgents, withShrinkage } from '../engine/erlang.js'
import { requiredAgentsA } from '../engine/erlangA.js'
import { defaultSites, siteShrinkage } from '../engine/channels.js'
import { fmtPct } from '../format.js'
import { Mark, skipToMain } from '../components/ui.jsx'
import { signInHref } from '../state/signin.js'

const [UK] = defaultSites()

// Share of the peak half hour arriving in each half hour, 08:00 to 20:00: a typical weekday.
const DAY_SHAPE = [0.34, 0.52, 0.74, 0.9, 0.98, 1, 0.95, 0.86, 0.74, 0.7, 0.76, 0.84, 0.88, 0.84, 0.76, 0.68, 0.6, 0.52, 0.44, 0.36, 0.3, 0.24, 0.19, 0.15]
const SCALES = [20, 40, 60, 80, 120, 160, 240, 320, 480, 640, 960]
const slotTime = (i) => `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`

function Dial({ label, value, onChange, min, max, step, show }) {
  const id = `dial-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className="dial">
      <label htmlFor={id}>{label}</label>
      <output htmlFor={id}>{show(value)}</output>
      <input id={id} className="slider" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

/** The hero: a day of half hours staffed live as the planner moves the dials. */
function LivePlanner() {
  const [calls, setCalls] = useState(250)
  const [aht, setAht] = useState(300)
  const [sl, setSl] = useState(80)
  const [at, setAt] = useState(null)
  const day = useMemo(() => DAY_SHAPE.map((share) => {
    const q = { volume: calls * share, ahtSec: aht, intervalSec: 1800, targetSec: 20, slTarget: sl / 100 }
    return { volume: q.volume, a: requiredAgentsA({ ...q, patienceSec: 120 }), c: requiredAgents(q) }
  }), [calls, aht, sl])
  const peakIdx = day.reduce((m, d, i) => (d.a.agents > day[m].a.agents ? i : m), 0)
  const idx = at ?? peakIdx
  const cur = day[idx]
  const peak = day[peakIdx].a.agents
  const top = SCALES.find((v) => v >= peak) ?? Math.ceil(peak / 100) * 100
  return (
    <aside className="live" aria-label="Live staffing example">
      <div className="live-dials">
        <Dial label="Calls at the peak" value={calls} onChange={setCalls} min={40} max={600} step={10} show={(v) => `${v} a half hour`} />
        <Dial label="Handle time" value={aht} onChange={setAht} min={120} max={900} step={10} show={(v) => `${Math.floor(v / 60)}m ${String(v % 60).padStart(2, '0')}s`} />
        <Dial label="Answered in 20 seconds" value={sl} onChange={setSl} min={50} max={95} step={1} show={(v) => `${v}%`} />
      </div>
      <div className="live-read" aria-live="polite">
        <div><div className="flabel">Agents at {slotTime(idx)}</div><div className="big">{cur.a.agents}</div></div>
        <div><div className="flabel">Erlang C</div><div className="mid">{cur.c.agents}</div></div>
        <div><div className="flabel">Abandon</div><div className="mid">{fmtPct(cur.a.pAbandon)}</div></div>
        <div><div className="flabel">Rostered, UK</div><div className="mid">{Math.ceil(withShrinkage(cur.a.agents, siteShrinkage(UK)))}</div></div>
      </div>
      <div className="live-chart" role="img" aria-label={`Agents needed each half hour from 08:00 to 20:00, peaking at ${peak} at ${slotTime(peakIdx)}`} onMouseLeave={() => setAt(null)}>
        {day.map((d, i) => (
          <span key={i} className={i === idx ? 'on' : ''} onMouseEnter={() => setAt(i)} onClick={() => setAt(i)}>
            <i style={{ height: `${(d.a.agents / top) * 100}%` }} />
          </span>
        ))}
      </div>
      <div className="live-axis"><span>08:00</span><span>11:00</span><span>14:00</span><span>17:00</span><span>20:00</span></div>
    </aside>
  )
}

const SCREENS = [
  { key: 'overview', src: 'screens/overview.jpg', w: 2328, h: 790, alt: 'Stacked weekly required FTE by channel against available FTE', kicker: 'Capacity', lead: 'See every week, ', strong: 'before it arrives.', text: 'Required FTE by channel against the people you will have, after attrition and new starters.', chip: ['Suggested', 'Hiring classes that close the gaps'] },
  { key: 'coverage', src: 'screens/coverage.jpg', w: 2328, h: 620, alt: 'Heatmap of staff short and over by day and half hour', kicker: 'Schedule', lead: 'Know where the roster ', strong: 'runs short.', text: 'Your shifts against the requirement, every half hour of the week.', chip: ['Every half hour', 'Short or over'] },
  { key: 'impact', src: 'screens/impact-chart.jpg', w: 2328, h: 800, alt: 'Monthly FTE chart for a mortgage launch against operational FTE', kicker: 'Change', lead: 'Test a change ', strong: 'before it lands.', text: 'A launch, campaign or training plan converted to FTE and checked against headroom.', chip: ['Verdict', 'Absorbable or short'] },
]

function InsideThePlanner() {
  return (
    <section className="section" id="inside">
      <div className="wrap features">
        {SCREENS.map((x, n) => (
          <div className="feature" key={x.key}>
            <div className="feature-text">
              <div className="label">{String(n + 1).padStart(2, '0')} · {x.kicker}</div>
              <h2>{x.lead}<strong>{x.strong}</strong></h2>
              <p>{x.text}</p>
            </div>
            <figure className="shot">
              <img src={x.src} width={x.w} height={x.h} alt={x.alt} loading="lazy" decoding="async" />
              <figcaption className="chip"><span>{x.chip[0]}</span><b>{x.chip[1]}</b></figcaption>
            </figure>
          </div>
        ))}
      </div>
    </section>
  )
}

const CHANNELS_COVERED = [
  ['Voice', 'Erlang A'],
  ['Chat', 'Erlang A with concurrency'],
  ['Back office', 'Workload and turnaround'],
  ['Branch', 'Erlang C per branch'],
]

const FAQ = [
  ['Do I need to upload anything?', 'No. Open the planner and load the sample operation. Your own data is read in your browser and never sent to us.'],
  ['What data does it take?', 'A CSV export of daily or interval volumes. Exports from Genesys, NICE CXone, Avaya, Amazon Connect, Five9 and Excel are read as they are.'],
  ['Why Erlang A?', 'Some callers hang up, which shortens the queue for everyone else. Erlang A accounts for that and tells you the abandonment rate to expect.'],
  ['Can I cancel?', 'At any time, from the billing page. You keep access until the end of the period you\'ve paid for.'],
]

function ThemeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
    </svg>
  )
}

export default function Landing({ onToggleTheme, account }) {
  const jump = (id) => (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }
  // Before billing is switched on, paid plans point at the pilot instead of a trial.
  const pilotMode = !account.billing
  const planHref = (p) => (p.id === 'free' ? '#/app/calculator' : pilotMode ? '#pilot' : account.signedIn ? '#/app/account' : signInHref(null, p.id))
  const planCta = (p) => (p.id !== 'free' && pilotMode ? 'Join the pilot' : p.cta)
  return (
    <div>
      <a className="skip" href="#main" onClick={skipToMain}>Skip to content</a>
      <div className="site-top">
        <header className="wrap masthead">
          <a className="nameplate" href="#/"><Mark />Erlang Desk</a>
          <nav aria-label="Site">
            <a href="#inside" className="hide-sm" onClick={jump('inside')}>Product</a>
            <a href="#pilot" className="hide-sm" onClick={jump('pilot')}>Pilot</a>
            <a href="#pricing" className="hide-sm" onClick={jump('pricing')}>Pricing</a>
            <button className="icon-btn" type="button" onClick={onToggleTheme} aria-label="Switch light or dark theme" title="Light or dark"><ThemeIcon /></button>
            {account.billing && !account.signedIn && <a href="#/signin">Sign in</a>}
            <a className="btn primary sm" href="#/app">Open the planner</a>
          </nav>
        </header>
      </div>

      <main id="main" tabIndex={-1}>
      <section className="lp-hero">
        <div className="wrap">
          <div className="label">Workforce planning · Voice · Chat · Back office · Branch</div>
          <h1>The right number of people, <strong>every half hour.</strong></h1>
          <p className="lede">Forecast, staff and hire for your contact centre, from one plan.</p>
          <div className="ctas">
            <a className="btn primary" href="#/app">Open the planner</a>
            <a className="btn" href="#/app/calculator">Erlang calculator</a>
          </div>
          <p className="assure">No sign-up. Your data never leaves your browser.</p>
          <div className="stage">
            <LivePlanner />
            <div className="chip" aria-hidden="true"><span>Live example</span><b>Move a slider</b></div>
          </div>
        </div>
      </section>

      <section className="section" id="channels">
        <div className="wrap">
          <ul className="covered">
            {CHANNELS_COVERED.map(([name, method]) => (
              <li key={name}><b>{name}</b><span>{method}</span></li>
            ))}
          </ul>
        </div>
      </section>

      <InsideThePlanner />

      <section className="section alt" id="pricing">
        <div className="wrap">
          <div className="section-head">
            <div className="label">Pricing</div>
            <h2>Simple, <strong>per planner.</strong></h2>
            <p>{pilotMode ? 'From launch. Pilot teams get three months free.' : 'Fourteen-day trial. Billed monthly, cancel any time.'}</p>
          </div>
          <div className="prices">
            {PLANS.map((p) => (
              <div className={`module price${p.featured ? ' featured' : ''}`} key={p.id}>
                <h3>{p.name}</h3>
                <div className="amt num">{p.price === 0 ? 'Free' : `${CURRENCY}${p.price}`}</div>
                <div className="per">{p.per}</div>
                <ul>{p.features.slice(0, 4).map((f) => <li key={f}>{f}</li>)}</ul>
                <a className={`btn${p.featured ? ' primary' : ''}`} href={planHref(p)} onClick={p.id !== 'free' && pilotMode ? jump('pilot') : undefined}>{planCta(p)}</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="wrap faq">
          <div className="section-head">
            <div className="label">Questions</div>
            <h2>Before you <strong>start.</strong></h2>
          </div>
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
          <p className="small muted" id="security">Your planning data stays in your browser. <a href="security.html">Security overview</a></p>
        </div>
      </section>

      <section className="closing" id="pilot">
        <div className="wrap">
          <div className="label">Founding pilot</div>
          <h2>Start with <strong>your own numbers.</strong></h2>
          <p>Three months free, with a working session on your own data.</p>
          <div className="ctas">
            {BRAND.contactEmail && <a className="btn primary" href={`mailto:${BRAND.contactEmail}?subject=Erlang%20Desk%20pilot`}>Apply for the pilot</a>}
            <a className={`btn${BRAND.contactEmail ? '' : ' primary'}`} href="#/app">Explore the sample</a>
          </div>
        </div>
      </section>
      </main>

      <footer className="site-foot">
        <div className="wrap">
          <div>
            <a className="nameplate" href="#/"><Mark />Erlang Desk</a>
            <p>Workforce planning for contact centres, back offices and branches.</p>
          </div>
          <nav aria-label="Footer">
            <div><span>Product</span><a href="#/app">Planner</a><a href="#/app/calculator">Erlang calculator</a><a href="#pricing" onClick={jump('pricing')}>Pricing</a></div>
            <div><span>Resources</span><a href="glossary.html">Glossary</a><a href="security.html">Security</a>{BRAND.contactEmail && <a href={`mailto:${BRAND.contactEmail}`}>Contact</a>}</div>
            <div><span>Legal</span><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a></div>
          </nav>
        </div>
        <div className="wrap legal-line">© {new Date().getFullYear()} {BRAND.name}</div>
      </footer>
    </div>
  )
}
