import { useMemo, useState } from 'react'
import { BRAND, CURRENCY, PLANS } from '../config.js'
import { requiredAgentsA } from '../engine/erlangA.js'
import { fmtPct } from '../format.js'
import { skipToMain } from '../components/ui.jsx'
import { signInHref } from '../state/signin.js'

// A week of half hours, 08:00 to 20:00. Each day carries a share of Monday's
// demand, and each half hour a share of the day's peak.
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_SCALE = [1, 0.96, 0.93, 0.9, 0.88, 0.42, 0.3]
const SHAPE = [0.34, 0.52, 0.74, 0.9, 0.98, 1, 0.95, 0.86, 0.74, 0.7, 0.76, 0.84, 0.88, 0.84, 0.76, 0.68, 0.6, 0.52, 0.44, 0.36, 0.3, 0.24, 0.19, 0.15]
const slotTime = (i) => `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`

/** Erlang A for every half hour of the week. */
function staffWeek(calls, aht, sl) {
  return DAY_SCALE.map((day) => SHAPE.map((share) => {
    const volume = calls * day * share
    const a = requiredAgentsA({ volume, ahtSec: aht, intervalSec: 1800, targetSec: 20, slTarget: sl / 100, patienceSec: 120 })
    return { volume, need: a.agents, abandon: a.pAbandon }
  }))
}

const BASE = { calls: 260, aht: 310, sl: 80 }
// The example roster was built for a typical week with shifts that start late
// and run long: thin through the morning peak, heavy after lunch.
let rosterMemo = null
const exampleRoster = () => (rosterMemo ??= staffWeek(BASE.calls, BASE.aht, BASE.sl).map((row, d) =>
  row.map((c, i) => Math.round(c.need * (i < 3 ? 1 : i < 8 ? 0.88 : i < 15 ? 1.12 : i < 19 ? 1.03 : 0.94) * (d > 4 ? 0.9 : 1)))))

const step3 = (v, max) => (v <= 0 ? 0 : v > max * 0.66 ? 3 : v > max * 0.33 ? 2 : 1)
const VIEWS = [['gap', 'Short or over'], ['need', 'Staff needed'], ['calls', 'Calls']]

function Dial({ id, label, value, onChange, min, max, step, show }) {
  return (
    <div className="dial">
      <label htmlFor={id}>{label}</label>
      <output htmlFor={id}>{show(value)}</output>
      <input id={id} className="slider" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

/** The landing page's centrepiece: a live week, staffed as the planner moves the dials. */
function WeekGrid() {
  const [calls, setCalls] = useState(BASE.calls)
  const [aht, setAht] = useState(BASE.aht)
  const [sl, setSl] = useState(BASE.sl)
  const [view, setView] = useState('gap')
  const [at, setAt] = useState([1, 5])
  const roster = exampleRoster()
  const week = useMemo(() => staffWeek(calls, aht, sl), [calls, aht, sl])
  let short = 0
  let worst = null
  let maxNeed = 1
  week.forEach((row, d) => row.forEach((c, i) => {
    const gap = roster[d][i] - c.need
    if (gap < 0) { short++; if (!worst || gap < worst.gap) worst = { d, i, gap } }
    maxNeed = Math.max(maxNeed, c.need)
  }))
  const tone = (d, i) => {
    const c = week[d][i]
    const gap = roster[d][i] - c.need
    if (view === 'gap') return gap < 0 ? `short-${step3(-gap, 5)}` : gap > 0 ? `over-${step3(gap, 5)}` : 'level'
    if (view === 'need') return `ink-${step3(c.need, maxNeed)}`
    return `over-${step3(c.volume, calls)}`
  }
  const [d, i] = at
  const cur = week[d][i]
  const gap = roster[d][i] - cur.need
  return (
    <>
      <section className="lp-head">
        <h1>The right number of people, every half hour.</h1>
        <div className="tally" aria-live="polite">
          <div className={`n num${short ? '' : ' ok'}`}>{short}</div>
          <p>{short
            ? `half hours short this week. The worst is ${DAY_LONG[worst.d]} ${slotTime(worst.i)}, ${-worst.gap} ${worst.gap === -1 ? 'person' : 'people'} under.`
            : 'half hours short this week. The roster covers every one.'}</p>
          <div className="ctas">
            <a className="btn primary" href="#/app">Open the planner</a>
            <a className="btn" href="#/app/calculator">Erlang calculator</a>
          </div>
        </div>
      </section>

      <section className="week" aria-label="A week of half hours">
        <div className="week-controls">
          <Dial id="dial-calls" label="Calls at the peak" value={calls} onChange={setCalls} min={80} max={520} step={10} show={(v) => `${v} a half hour`} />
          <Dial id="dial-aht" label="Handle time" value={aht} onChange={setAht} min={150} max={720} step={10} show={(v) => `${Math.floor(v / 60)}m ${String(v % 60).padStart(2, '0')}s`} />
          <Dial id="dial-sl" label="Answered in 20 seconds" value={sl} onChange={setSl} min={60} max={95} step={1} show={(v) => `${v}%`} />
          <div className="seg" role="group" aria-label="What the grid shows">
            {VIEWS.map(([k, label]) => <button key={k} type="button" className={view === k ? 'on' : ''} aria-pressed={view === k} onClick={() => setView(k)}>{label}</button>)}
          </div>
        </div>
        <div className="week-grid" role="img" aria-label={`Seven days by 24 half hours from 08:00 to 20:00. ${short} half hours are short of staff.`}>
          {DAYS.map((day, dd) => (
            <div className="week-row" key={day}>
              <span className="d">{day}</span>
              {SHAPE.map((_, ii) => (
                <span key={ii} className={`cell ${tone(dd, ii)}${dd === d && ii === i ? ' on' : ''}`} onPointerEnter={() => setAt([dd, ii])} onPointerDown={() => setAt([dd, ii])} />
              ))}
            </div>
          ))}
          <div className="week-row axis" aria-hidden="true">
            <span className="d" />
            {Array.from({ length: 12 }, (_, h) => <span key={h} className={`t${h % 2 ? ' minor' : ''}`}>{slotTime(h * 2)}</span>)}
          </div>
        </div>
        <div className="week-read">
          <span aria-live="polite">
            <b>{DAYS[d]} {slotTime(i)}</b> · {Math.round(cur.volume)} calls · need <b>{cur.need}</b> · rostered <b>{roster[d][i]}</b> · {gap < 0 ? <b>{-gap} short</b> : gap > 0 ? `${gap} over` : 'level'} · {fmtPct(cur.abandon)} abandon
          </span>
          <span className="week-key" aria-hidden="true">
            {view === 'gap' ? <><i className="cell short-3" />short<i className="cell level" />level<i className="cell over-3" />over</>
              : view === 'need' ? <><i className="cell ink-1" />fewer<i className="cell ink-3" />more staff</>
                : <><i className="cell over-1" />fewer<i className="cell over-3" />more calls</>}
          </span>
        </div>
        <p className="assure">An example week, staffed with Erlang A. No sign-up: your own data never leaves your browser.</p>
      </section>
    </>
  )
}

const STEPS = [
  ['Forecast', 'Your contact history becomes a daily forecast, tested against recent weeks.'],
  ['Staff', 'Erlang A sets the people needed in every half hour.'],
  ['Schedule', 'Your shifts are laid over the requirement, as in the grid above.'],
  ['Hire', 'Attrition and training time turn the gaps into class dates.'],
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
    <div className="lp">
      <a className="skip" href="#main" onClick={skipToMain}>Skip to content</a>
      <header className="wrap masthead">
        <a className="nameplate" href="#/">Erlang Desk</a>
        <nav aria-label="Site">
          <a href="#steps" className="hide-sm" onClick={jump('steps')}>How it works</a>
          <a href="#pricing" className="hide-sm" onClick={jump('pricing')}>Pricing</a>
          <button className="icon-btn" type="button" onClick={onToggleTheme} aria-label="Switch light or dark theme" title="Light or dark"><ThemeIcon /></button>
          {account.billing && !account.signedIn && <a href="#/signin">Sign in</a>}
          <a className="btn primary sm" href="#/app">Open the planner</a>
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="wrap">
        <WeekGrid />

        <section className="lp-steps" id="steps">
          <h2 className="sr-only">How it works</h2>
          {STEPS.map(([name, text], n) => (
            <div key={name}><span className="k">Step {n + 1}</span><h3>{name}</h3><p>{text}</p></div>
          ))}
        </section>

        <section className="lp-rows" id="pricing">
          <h2 className="sr-only">Pricing</h2>
          {PLANS.map((p) => (
            <div className="price" key={p.id}>
              <h3>{p.name}</h3>
              <div className="amt num">{p.price === 0 ? 'Free' : `${CURRENCY}${p.price}`}<small>{p.per}</small></div>
              <p>{p.blurb}</p>
              <a className={`btn${p.featured ? ' primary' : ''}`} href={planHref(p)} onClick={p.id !== 'free' && pilotMode ? jump('pilot') : undefined}>{planCta(p)}</a>
            </div>
          ))}
          <div className="price" id="pilot">
            <h3>Founding pilot</h3>
            <div className="amt">Free<small>for three months</small></div>
            <p>A working session on your own data, and a say in what gets built next.</p>
            {BRAND.contactEmail
              ? <a className="btn" href={`mailto:${BRAND.contactEmail}?subject=Erlang%20Desk%20pilot`}>Apply</a>
              : <a className="btn" href="#/app">Explore the sample</a>}
          </div>
        </section>

        <section className="lp-faq" id="faq">
          <h2 className="sr-only">Questions</h2>
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
      </main>

      <footer className="wrap colophon">
        <span>© {new Date().getFullYear()} {BRAND.name}</span>
        <span className="spacer" />
        <a href="glossary.html">Glossary</a>
        <a href="security.html" id="security">Security</a>
        <a href="privacy.html">Privacy</a>
        <a href="terms.html">Terms</a>
        {BRAND.contactEmail && <a href={`mailto:${BRAND.contactEmail}`}>Contact</a>}
      </footer>
    </div>
  )
}
