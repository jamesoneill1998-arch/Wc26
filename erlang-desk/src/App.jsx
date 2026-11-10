import { useEffect, useRef, useState } from 'react'
import { useWorkspace } from './state/store.js'
import { useModel } from './state/model.js'
import { useAccount } from './state/account.js'
import { CHANNELS } from './engine/channels.js'
import { Mark, skipToMain } from './components/ui.jsx'
import Tour, { tourSeen } from './components/Tour.jsx'
import { markPageSeen } from './state/checklist.js'
import Landing from './pages/Landing.jsx'
import Overview from './pages/Overview.jsx'
import DataPage from './pages/DataPage.jsx'
import ForecastPage from './pages/ForecastPage.jsx'
import StaffingPage from './pages/StaffingPage.jsx'
import CoveragePage from './pages/CoveragePage.jsx'
import ImpactPage from './pages/ImpactPage.jsx'
import CapacityPage from './pages/CapacityPage.jsx'
import ServicePage from './pages/ServicePage.jsx'
import SitesPage from './pages/SitesPage.jsx'
import Calculator from './pages/Calculator.jsx'
import AccountPage from './pages/AccountPage.jsx'
import SignInPage from './pages/SignInPage.jsx'

const PAGES = {
  overview: Overview,
  data: DataPage,
  forecast: ForecastPage,
  staffing: StaffingPage,
  coverage: CoveragePage,
  impact: ImpactPage,
  capacity: CapacityPage,
  service: ServicePage,
  sites: SitesPage,
  calculator: Calculator,
  account: AccountPage,
}

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/')
  useEffect(() => {
    const on = () => {
      setHash(window.location.hash || '#/')
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const [path, query = ''] = hash.slice(1).split('?')
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(query) }
}

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('erlang-desk:theme') || '' } catch { return '' }
  })
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme
    else delete document.documentElement.dataset.theme
    try { localStorage.setItem('erlang-desk:theme', theme) } catch { /* private mode */ }
  }, [theme])
  return () => {
    const dark = theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    setTheme(dark ? 'light' : 'dark')
  }
}

function NavLink({ to, label, current, step }) {
  return (
    <a href={`#/app/${to}`} className={current === to ? 'active' : ''} aria-current={current === to ? 'page' : undefined}>
      {step && <span className="step" aria-hidden="true">{step}</span>}{label}
    </a>
  )
}

/** The planning steps for one service, in the order a planner works through them. */
const STEPS = [
  ['data', 'Data'],
  ['forecast', 'Forecast'],
  ['staffing', 'Intraday staffing'],
  ['coverage', 'Schedule & coverage'],
  ['capacity', 'Capacity plan'],
]

function useNarrow() {
  const q = '(max-width: 900px)'
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setNarrow(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return narrow
}

/** Previous and next planning step, at the foot of each service page. */
function StepNav({ current, label }) {
  const i = STEPS.findIndex(([k]) => k === current)
  if (i < 0) return null
  const prev = STEPS[i - 1]
  const next = STEPS[i + 1]
  return (
    <nav className="step-nav no-print" aria-label="Planning steps">
      {prev ? <a href={`#/app/${prev[0]}`}><span aria-hidden="true">←</span> {label(prev)}</a> : <span />}
      <span className="faint small">Step {i + 1} of {STEPS.length}</span>
      {next
        ? <a className="next" href={`#/app/${next[0]}`}>Next: {label(next)} <span aria-hidden="true">→</span></a>
        : <a className="next" href="#/app/overview">Back to the overview <span aria-hidden="true">→</span></a>}
    </nav>
  )
}

export default function App() {
  const route = useHashRoute()
  const toggleTheme = useTheme()
  const store = useWorkspace()
  const account = useAccount()
  const { result: model, busy, error } = useModel(store.ws)
  const { ws, active, updateService, update } = store
  const [tourStep, setTourStep] = useState(null)
  const narrow = useNarrow()

  // First time the sample operation is loaded, offer the tour automatically.
  const isSample = ws.name.endsWith('(sample)') && ws.services.length > 0
  useEffect(() => {
    if (isSample && !tourSeen() && route.parts[0] === 'app') setTourStep((s) => s ?? 0)
  }, [isSample]) // eslint-disable-line react-hooks/exhaustive-deps

  // After sample data loads, start each demo service roughly in balance so the
  // plan shows attrition opening a gap rather than an instant crisis.
  useEffect(() => {
    const pending = ws.services.filter((s) => s.capacity.calibrate && model.services[s.id]?.weeks.length)
    if (!pending.length) return
    update((cur) => ({
      services: cur.services.map((s) => {
        const w = model.services[s.id]?.weeks[0]
        if (!s.capacity.calibrate || !w) return s
        const { calibrate, ...capacity } = s.capacity
        return { ...s, capacity: { ...capacity, startHeadcount: Math.round(w.requiredFte * 1.03) } }
      }),
    }))
  }, [model, ws.services, update])

  // Moving between pages: put focus on the new page so screen readers announce it.
  const firstRoute = useRef(true)
  const pageKey = route.parts[0] === 'app' ? route.parts[1] ?? 'overview' : 'landing'
  useEffect(() => {
    if (firstRoute.current) { firstRoute.current = false; return }
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [pageKey])

  // First-plan checklist: opening a page ticks its step.
  useEffect(() => { markPageSeen(pageKey) }, [pageKey])

  // On a phone the pages are a scrolling strip of tabs: keep the current one in view.
  useEffect(() => {
    if (narrow) document.querySelector('.nav a.active')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [narrow, pageKey])

  if (route.parts[0] === 'signin') return <SignInPage account={account} query={route.query} />
  if (route.parts[0] !== 'app') return <Landing onToggleTheme={toggleTheme} account={account} />

  const key = PAGES[route.parts[1]] ? route.parts[1] : 'overview'
  const Page = PAGES[key]
  const site = ws.sites.find((s) => s.id === active?.siteId)
  const stepLabel = ([k, l]) => (k === 'staffing' && active?.channel === 'backoffice' ? 'Daily workload' : l)
  const switcher = ws.services.length > 0 && (
    <div className="switcher">
      <label className="sr-only" htmlFor="svc">Service</label>
      <select id="svc" value={active?.id ?? ''} onChange={(e) => update({ activeServiceId: e.target.value })}>
        {ws.services.map((s) => (
          <option key={s.id} value={s.id}>{s.name} · {CHANNELS[s.channel].label} · {ws.sites.find((x) => x.id === s.siteId)?.code}</option>
        ))}
      </select>
      {active && <span className="meta">{CHANNELS[active.channel].method} · {site?.name}</span>}
    </div>
  )

  return (
    <div className="shell">
      <a className="skip" href="#main" onClick={skipToMain}>Skip to content</a>
      {busy && <div className="busy" role="progressbar" aria-label="Recalculating" />}
      <aside className="side">
        <a className="nameplate" href="#/"><Mark />Erlang Desk</a>
        {narrow && switcher}
        <nav className="nav" aria-label="Main">
          <div className="group label">Operation</div>
          <NavLink to="overview" label="Overview" current={key} />
          <NavLink to="sites" label="Sites & shrinkage" current={key} />
          <NavLink to="impact" label="Impact assessment" current={key} />
          <div className="group label">Plan a service</div>
          {!narrow && switcher}
          {STEPS.map((st, i) => <NavLink key={st[0]} to={st[0]} label={stepLabel(st)} current={key} step={i + 1} />)}
          <NavLink to="service" label="Service settings" current={key} />
          <div className="group label">More</div>
          <NavLink to="calculator" label="Erlang calculator" current={key} />
          <NavLink to="account" label="Account & workspace" current={key} />
        </nav>
        <div className="side-foot">
          <span>Data is held in this browser only.</span>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>{account.billing ? (account.signedIn ? account.email : 'Not signed in') : ws.name}</span>
            <button className="btn link small" type="button" onClick={toggleTheme}>Theme</button>
            {isSample && <button className="btn link small" type="button" onClick={() => setTourStep(0)}>Tour</button>}
          </div>
        </div>
      </aside>
      <main className="main" id="main" tabIndex={-1}>
        <div className="print-only print-head">{ws.name} · Erlang Desk · printed {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        {store.saveError && <div className="notice" style={{ marginBottom: 20 }}>{store.saveError}</div>}
        {error && <div className="notice" style={{ marginBottom: 20 }}>The planning model hit a problem: {error}</div>}
        {tourStep != null && <Tour step={tourStep} setStep={setTourStep} />}
        <Page {...store} isSample={isSample} model={model} account={account} query={route.query} result={active ? model.services[active.id] : null} updateActive={(patch) => active && updateService(active.id, patch)} site={site} />
        {active?.history && <StepNav current={key} label={stepLabel} />}
      </main>
    </div>
  )
}
