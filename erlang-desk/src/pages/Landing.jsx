import { useState } from 'react'
import { BRAND, CURRENCY, PLANS } from '../config.js'
import { requiredAgents, withShrinkage } from '../engine/erlang.js'
import { requiredAgentsA } from '../engine/erlangA.js'
import { defaultSites, siteShrinkage, SHRINKAGE_COMPONENTS } from '../engine/channels.js'
import { fmtPct } from '../format.js'
import { Mark, skipToMain } from '../components/ui.jsx'

const [UK, OFFSHORE] = defaultSites()

function Blank({ value, onChange, label, min = 0, max = 100000 }) {
  return (
    <input
      type="number" inputMode="numeric" aria-label={label} min={min} max={max} value={value}
      onChange={(e) => { const n = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n))) }}
    />
  )
}

function WorkedExample() {
  const [calls, setCalls] = useState(250)
  const [aht, setAht] = useState(300)
  const [patience, setPatience] = useState(120)
  const [sl, setSl] = useState(80)
  const [within, setWithin] = useState(20)
  const q = { volume: calls, ahtSec: Math.max(1, aht), intervalSec: 1800, targetSec: within, slTarget: Math.min(99.9, Math.max(1, sl)) / 100 }
  const a = requiredAgentsA({ ...q, patienceSec: Math.max(5, patience) })
  const c = requiredAgents(q)
  return (
    <aside className="wallboard" aria-label="Worked example">
      <div className="flabel">Worked example · change any figure</div>
      <p className="sentence">
        <Blank label="Calls per half hour" value={calls} onChange={setCalls} /> calls a half hour,{' '}
        <Blank label="Handle time in seconds" value={aht} onChange={setAht} min={1} max={7200} /> seconds each, callers giving up after{' '}
        <Blank label="Patience in seconds" value={patience} onChange={setPatience} min={5} max={3600} /> seconds, and a target of{' '}
        <Blank label="Service level percent" value={sl} onChange={setSl} min={1} max={99} />% answered in{' '}
        <Blank label="Seconds" value={within} onChange={setWithin} max={3600} /> seconds.
      </p>
      <div className="readout" aria-live="polite">
        <div>
          <div className="flabel">Agents needed</div>
          <div className="big">{a.agents}</div>
          <div className="note">Erlang A, allowing for hang-ups</div>
        </div>
        <div>
          <div className="flabel">Erlang C says</div>
          <div className="mid">{c.agents}</div>
          <div className="note">assumes nobody hangs up</div>
        </div>
        <div>
          <div className="flabel">Abandon</div>
          <div className="mid">{fmtPct(a.pAbandon)}</div>
          <div className="note">expected at {a.agents} agents</div>
        </div>
      </div>
      <div className="rostered">
        <span>Rostered in the UK ({fmtPct(siteShrinkage(UK), 0)} shrinkage)<b>{Math.ceil(withShrinkage(a.agents, siteShrinkage(UK)))}</b></span>
        <span>Offshore ({fmtPct(siteShrinkage(OFFSHORE), 0)})<b>{Math.ceil(withShrinkage(a.agents, siteShrinkage(OFFSHORE)))}</b></span>
      </div>
    </aside>
  )
}

const SCREENS = [
  { key: 'overview', tab: 'Operation overview', src: 'screens/overview.jpg', w: 2328, h: 784, alt: 'Stacked weekly required FTE by channel against available FTE', caption: 'Every service and site in one view: required FTE by channel each week, against the people you will actually have after attrition and new starters.' },
  { key: 'coverage', tab: 'Roster coverage', src: 'screens/coverage.jpg', w: 2328, h: 604, alt: 'Heatmap of staff short and over by day and half hour', caption: 'Your roster against the requirement, every half hour. Red is short, blue is over. Here the 10:00 peak and weekends are short while early afternoon carries spare staff.' },
  { key: 'impact', tab: 'Change impact', src: 'screens/impact-chart.jpg', w: 2328, h: 800, alt: 'Monthly FTE chart for a mortgage launch against operational FTE', caption: 'A mortgage launch of 25,000 acquisitions, converted to calls and FTE by month and tested against headroom after other approved changes. Verdict: not absorbable without recruiting.' },
]

function InsideThePlanner() {
  const [key, setKey] = useState('coverage')
  const shot = SCREENS.find((x) => x.key === key)
  return (
    <section className="section alt" id="inside">
      <div className="wrap">
        <div className="section-head">
          <h2>Inside the planner</h2>
          <p>Screens from the sample operation that ships with the product: four services across a UK and an offshore site.</p>
        </div>
        <div className="seg" role="tablist" aria-label="Screens">
          {SCREENS.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={x.key === key} className={x.key === key ? 'on' : ''} onClick={() => setKey(x.key)}>{x.tab}</button>
          ))}
        </div>
        <figure className="screen" role="tabpanel">
          <img src={shot.src} width={shot.w} height={shot.h} alt={shot.alt} loading="lazy" decoding="async" />
          <figcaption>{shot.caption}</figcaption>
        </figure>
      </div>
    </section>
  )
}

const CHANNEL_COPY = [
  ['Voice', 'Erlang A', 'Callers hang up. Erlang A models that, so you staff to the service your customers actually get rather than a queue where nobody ever leaves.'],
  ['Chat', 'Erlang A × concurrency', 'Agents run two or three sessions at once, and chat customers are more patient. Both are built into the requirement.'],
  ['Back office', 'Workload & turnaround', 'Items don\'t queue by the minute. Hours needed are workload over utilisation, smoothed across your turnaround SLA, with weekend work rolled forward.'],
  ['Branch', 'Erlang C per branch', 'Twenty-five branches aren\'t one big queue. Each branch is sized on its own share of footfall, with minimum cover, then added up.'],
]


const COMPARE = [
  ['Time to a first plan', 'Days to weeks', 'An afternoon', 'Months of implementation'],
  ['Abandonment-aware staffing', 'Rarely', 'Erlang A, built in', 'Usually'],
  ['Voice, chat, back office, branch', 'One model per tab', 'One workspace', 'Yes'],
  ['UK and offshore shrinkage', 'Hard-coded', 'Itemised per site', 'Yes'],
  ['Hiring plan with training ramp', 'Manual', 'Suggested automatically', 'Often an add-on'],
  ['Where customer data lives', 'Your files', 'Your browser only', 'Vendor cloud'],
  ['Cost', 'Your evenings', `From ${CURRENCY}59 a month`, 'Per agent, annual contract'],
]

const SECURITY = [
  ['Your data stays with you', 'Contact history is read and stored in your browser. We never receive a copy, so there is nothing of yours on our servers to breach.'],
  ['No passwords to steal', 'You sign in with a single-use link sent to your work email. It lasts 15 minutes and only works in the browser that asked for it.'],
  ['Payments by Stripe', 'Card details go straight to Stripe. We never see or store them.'],
]

const SECURITY_DETAIL = [
  'Sessions are Secure, HttpOnly, SameSite cookies with a fixed seven-day life; every change request is checked for origin and rate limited.',
  'A strict Content Security Policy allows only our own code. HSTS is on, framing is blocked, and there are no third-party scripts, trackers or font services.',
  'Imported files are size-limited and validated field by field. CSV exports are protected against spreadsheet formula injection.',
  'Plan prices are fixed on the server; the browser can only name a plan.',
]

const FAQ = [
  ['Do I need to upload anything to try it?', 'No. Open the planner and load the sample operation: four services across a UK and an offshore site. When you import your own data, it is read in your browser and never sent to us.'],
  ['What is Erlang A, and why does it need fewer people?', 'Erlang C assumes every caller waits until answered. In reality some hang up, which shortens the queue for everyone else. Erlang A accounts for that, typically needing 5–15% fewer agents for the same service level, and it reports the abandonment rate you should expect.'],
  ['Can I plan UK and offshore teams together?', 'Yes. Each service belongs to a site, and each site has its own shrinkage components, contracted hours and attrition. The overview adds them up.'],
  ['What data format do you accept?', 'A CSV with a date column, a volume column, and optionally an interval start time and average handle time. Column names from common ACDs are recognised.'],
  ['Can colleagues share a workspace?', 'On the Team plan each planner has their own sign-in. Workspaces are exported and imported as files, so nothing sits on a shared server.'],
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

function initials(name) {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function Landing({ onToggleTheme, account }) {
  const jump = (id) => (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }
  // Before billing is switched on, paid plans point at the pilot instead of a trial.
  const pilotMode = !account.billing
  const planHref = (p) => (p.id === 'free' ? '#/app/calculator' : pilotMode ? '#pilot' : `#/app/account?plan=${p.id}`)
  const planCta = (p) => (p.id !== 'free' && pilotMode ? 'Join the pilot' : p.cta)
  return (
    <div>
      <a className="skip" href="#main" onClick={skipToMain}>Skip to content</a>
      <div className="site-top">
        <header className="wrap masthead">
          <a className="nameplate" href="#/"><Mark />Erlang Desk</a>
          <nav aria-label="Site">
            <a href="#channels" className="hide-sm" onClick={jump('channels')}>Method</a>
            <a href="#security" className="hide-sm" onClick={jump('security')}>Security</a>
            <a href="#pilot" className="hide-sm" onClick={jump('pilot')}>Pilot</a>
            <a href="#pricing" className="hide-sm" onClick={jump('pricing')}>Pricing</a>
            <button className="icon-btn" type="button" onClick={onToggleTheme} aria-label="Switch light or dark theme" title="Light or dark"><ThemeIcon /></button>
            {account.billing && !account.signedIn && <a href="#/app/account">Sign in</a>}
            <a className="btn dark sm" href="#/app">Open the planner</a>
          </nav>
        </header>
      </div>

      <main id="main" tabIndex={-1}>
      <section className="lp-hero">
        <div className="wrap">
          <div>
            <div className="label">Workforce planning · contact centres, back offices, branches</div>
            <h1>The right number of people, <span>every half hour</span> of the year.</h1>
            <p className="lede">
              {BRAND.name} turns your contact history into a forecast, an interval staffing plan and a hiring plan, across voice, chat,
              back office and branches, onshore and offshore. It replaces the spreadsheet model, and does the maths properly.
            </p>
            <div className="ctas">
              <a className="btn primary" href="#/app">Open the planner</a>
              <a className="btn" href="#/app/calculator">Free Erlang calculator</a>
            </div>
            <p className="assure">Explore a sample operation without signing up. Your own data never leaves your browser.</p>
          </div>
          <WorkedExample />
        </div>
      </section>

      <InsideThePlanner />

      <section className="section" id="channels">
        <div className="wrap">
          <div className="section-head">
            <h2>Each channel, planned the way its work behaves</h2>
            <p>Running one Erlang formula across every queue is the commonest error in capacity models. {BRAND.name} picks the model that fits how each channel's work arrives and waits.</p>
          </div>
          <div className="grid-4">
            {CHANNEL_COPY.map(([name, method, body]) => (
              <div className="module" key={name}>
                <div className="method">{method}</div>
                <h3>{name}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="wrap cols">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <h2>Onshore and offshore, each on its own terms</h2>
            <p>A UK operation typically loses about 35% of paid hours to leave, sickness, breaks and training; offshore centres nearer 20%. Each site keeps its own shrinkage, contracted hours and attrition, and the plan adds them up.</p>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Shrinkage</th><th>UK</th><th>Offshore</th></tr></thead>
              <tbody>
                {SHRINKAGE_COMPONENTS.map(([k, label]) => (
                  <tr key={k}><td>{label}</td><td>{fmtPct(UK.shrinkage[k], 0)}</td><td>{fmtPct(OFFSHORE.shrinkage[k], 0)}</td></tr>
                ))}
                <tr className="total"><td>Total, editable per site</td><td>{fmtPct(siteShrinkage(UK), 0)}</td><td>{fmtPct(siteShrinkage(OFFSHORE), 0)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>


      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2>Between the spreadsheet and the suite</h2>
            <p>Enterprise WFM earns its keep at thousands of agents. Below that, most teams are better served by something they can set up this afternoon.</p>
          </div>
          <div className="table-wrap">
            <table className="compare">
              <thead><tr><th><span className="sr-only">Compared on</span></th><th>Spreadsheet model</th><th className="us">{BRAND.name}</th><th>Enterprise WFM suite</th></tr></thead>
              <tbody>
                {COMPARE.map(([row, a, b, c]) => (
                  <tr key={row}><td>{row}</td><td>{a}</td><td className="us">{b}</td><td>{c}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section alt" id="pilot">
        <div className="wrap cols">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <div className="label">Now taking pilots</div>
            <h2>Founding pilot programme</h2>
            <p>We're working with a small number of planning teams to shape the product. Pilots get three months free, a working session with their own data, and a direct line to the person building it.</p>
            <div className="row" style={{ marginTop: 22 }}>
              {BRAND.contactEmail
                ? <a className="btn primary" href={`mailto:${BRAND.contactEmail}?subject=Erlang%20Desk%20pilot`}>Apply for the pilot</a>
                : <a className="btn primary" href="#/app">Explore the sample first</a>}
              {BRAND.contactEmail ? <a className="btn" href="#/app">Explore the sample</a> : <a className="btn" href="#/app/calculator">Try the free calculator</a>}
            </div>
            {BRAND.contactEmail && <p className="small faint" style={{ marginTop: 10 }}>Or email {BRAND.contactEmail}</p>}
          </div>
          <div className="module pilot-card">
            <div className="method">What a pilot looks like</div>
            <ol className="pilot-steps">
              <li><b>30-minute session.</b> Load an anonymised export of your volumes together and check the forecast against what actually happened.</li>
              <li><b>Your own plan.</b> Staffing, roster coverage and a six-month capacity plan for one service.</li>
              <li><b>One real change.</b> Run a live project through impact assessment and take the summary to your change board.</li>
              <li><b>Tell us what's missing.</b> Pilot feedback decides what gets built next.</li>
            </ol>
          </div>
        </div>
        {BRAND.founderName && (
          <div className="wrap">
            <div className="founder">
              {BRAND.founderPhoto
                ? <img className="founder-photo" src={BRAND.founderPhoto} alt={BRAND.founderName} width="96" height="96" loading="lazy" />
                : <div className="founder-photo initials" aria-hidden="true">{initials(BRAND.founderName)}</div>}
              <div>
                <div className="label">Who's behind it</div>
                <h3>{BRAND.founderName}</h3>
                {BRAND.founderRole && <p className="muted small">{BRAND.founderRole}</p>}
                {BRAND.founderBio && <p className="founder-bio">{BRAND.founderBio}</p>}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="section" id="security">
        <div className="wrap">
          <div className="section-head">
            <h2>Security you can show procurement</h2>
            <p>Most of the risk in a planning tool sits in the customer data it holds. {BRAND.name} is built so it holds none.</p>
          </div>
          <div className="grid-3">
            {SECURITY.map(([t, body]) => (
              <div className="module" key={t}><h3>{t}</h3><p>{body}</p></div>
            ))}
          </div>
          <details className="tech-detail">
            <summary>Technical detail for your security team</summary>
            <ul>{SECURITY_DETAIL.map((d) => <li key={d}>{d}</li>)}</ul>
          </details>
        </div>
      </section>

      <section className="section alt" id="pricing">
        <div className="wrap">
          <div className="section-head">
            <h2>Priced per planner, not per agent</h2>
            <p>{pilotMode
              ? 'Pricing from launch. Pilot teams get three months free first, with no card needed.'
              : 'Fourteen-day trial on Pro and Team. Billed monthly, cancel any time. Prices exclude VAT.'}</p>
          </div>
          <div className="prices">
            {PLANS.map((p) => (
              <div key={p.id} className={`module price${p.featured ? ' featured' : ''}`}>
                <h3>{p.name}</h3>
                <div className="amt">{p.price ? `${CURRENCY}${p.price}` : 'Free'}</div>
                <div className="per">{p.per}{p.price && pilotMode ? ' · from launch' : ''}</div>
                <p className="muted">{p.blurb}</p>
                <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
                <a className={`btn${p.featured ? ' primary' : ''}`} href={planHref(p)} onClick={p.id !== 'free' && pilotMode ? jump('pilot') : undefined}>{planCta(p)}</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="wrap">
          <div className="faq">
            <div className="section-head">
              <h2>Questions planners ask</h2>
            </div>
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      </main>

      <footer className="wrap colophon">
        <span>© {new Date().getFullYear()} {BRAND.name}</span>
        <span>Named for A. K. Erlang, who worked out the mathematics of call queues for the Copenhagen Telephone Company.</span>
        <span className="spacer" />
        <a href="privacy.html">Privacy</a>
        <a href="terms.html">Terms</a>
        {BRAND.contactEmail && <a href={`mailto:${BRAND.contactEmail}`}>Contact</a>}
      </footer>
    </div>
  )
}
