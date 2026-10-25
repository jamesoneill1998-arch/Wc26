import { useEffect, useState } from 'react'
import { useWorkspace } from './state/store.js'
import { useModel } from './state/model.js'
import { useAccount } from './state/account.js'
import { CHANNELS } from './engine/channels.js'
import { Mark } from './components/ui.jsx'
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

function NavLink({ to, label, current }) {
  return (
    <a href={`#/app/${to}`} className={current === to ? 'active' : ''} aria-current={current === to ? 'page' : undefined}>{label}</a>
  )
}

export default function App() {
  const route = useHashRoute()
  const toggleTheme = useTheme()
  const store = useWorkspace()
  const account = useAccount()
  const { result: model, busy, error } = useModel(store.ws)
  const { ws, active, updateService, update } = store

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

  if (route.parts[0] !== 'app') return <Landing onToggleTheme={toggleTheme} account={account} />

  const key = PAGES[route.parts[1]] ? route.parts[1] : 'overview'
  const Page = PAGES[key]
  const site = ws.sites.find((s) => s.id === active?.siteId)

  return (
    <div className="shell">
      {busy && <div className="busy" role="progressbar" aria-label="Recalculating" />}
      <aside className="side">
        <a className="nameplate" href="#/"><Mark />Erlang Desk</a>
        {ws.services.length > 0 && (
          <div className="switcher">
            <label className="label" htmlFor="svc">Service</label>
            <select id="svc" value={active?.id ?? ''} onChange={(e) => update({ activeServiceId: e.target.value })}>
              {ws.services.map((s) => (
                <option key={s.id} value={s.id}>{s.name} · {CHANNELS[s.channel].label} · {ws.sites.find((x) => x.id === s.siteId)?.code}</option>
              ))}
            </select>
            {active && <span className="meta">{CHANNELS[active.channel].method} · {site?.name}</span>}
          </div>
        )}
        <nav className="nav" aria-label="Main">
          <div className="group label">Operation</div>
          <NavLink to="overview" label="Overview" current={key} />
          <NavLink to="sites" label="Sites & shrinkage" current={key} />
          <div className="group label">This service</div>
          <NavLink to="data" label="Data" current={key} />
          <NavLink to="forecast" label="Forecast" current={key} />
          <NavLink to="staffing" label={active?.channel === 'backoffice' ? 'Daily workload' : 'Intraday staffing'} current={key} />

          <NavLink to="coverage" label="Schedule & coverage" current={key} />
          <NavLink to="capacity" label="Capacity plan" current={key} />
          <NavLink to="service" label="Service settings" current={key} />
          <div className="group label">Change delivery</div>
          <NavLink to="impact" label="Impact assessment" current={key} />
          <div className="group label">Tools</div>
          <NavLink to="calculator" label="Erlang calculator" current={key} />
          <NavLink to="account" label="Account" current={key} />
        </nav>
        <div className="side-foot">
          <span>Data is held in this browser only.</span>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>{account.billing ? (account.signedIn ? account.email : 'Not signed in') : 'Preview build'}</span>
            <button className="btn link small" type="button" onClick={toggleTheme}>Theme</button>
          </div>
        </div>
      </aside>
      <main className="main" id="main">
        {store.saveError && <div className="notice" style={{ marginBottom: 20 }}>{store.saveError}</div>}
        {error && <div className="notice" style={{ marginBottom: 20 }}>The planning model hit a problem: {error}</div>}
        <Page {...store} model={model} account={account} query={route.query} result={active ? model.services[active.id] : null} updateActive={(patch) => active && updateService(active.id, patch)} site={site} />
      </main>
    </div>
  )
}
