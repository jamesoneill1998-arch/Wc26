import { useEffect, useState } from 'react'
import { useWorkspace } from './state/store.js'
import { usePlanModel } from './state/model.js'
import { BRAND } from './config.js'
import { Icon } from './components/ui.jsx'
import Landing from './pages/Landing.jsx'
import Overview from './pages/Overview.jsx'
import DataPage from './pages/DataPage.jsx'
import ForecastPage from './pages/ForecastPage.jsx'
import StaffingPage from './pages/StaffingPage.jsx'
import CapacityPage from './pages/CapacityPage.jsx'
import Calculator from './pages/Calculator.jsx'
import SettingsPage from './pages/SettingsPage.jsx'

const NAV = [
  ['overview', 'Overview', Overview],
  ['data', 'Data', DataPage],
  ['forecast', 'Forecast', ForecastPage],
  ['staffing', 'Intraday staffing', StaffingPage],
  ['capacity', 'Capacity plan', CapacityPage],
  ['calculator', 'Erlang calculator', Calculator],
  ['settings', 'Settings', SettingsPage],
]

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
  return hash
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
  const toggle = () => {
    const dark = theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    setTheme(dark ? 'light' : 'dark')
  }
  return toggle
}

export default function App() {
  const hash = useHashRoute()
  const toggleTheme = useTheme()
  const store = useWorkspace()
  const model = usePlanModel(store.ws)

  // After sample data loads, start the demo roughly in balance so the plan
  // shows attrition opening a gap rather than an instant crisis.
  const { ws, update } = store
  useEffect(() => {
    if (ws.capacity.calibrate && model.weeks.length) {
      update((cur) => ({ capacity: { ...cur.capacity, calibrate: false, startHeadcount: Math.round(model.weeks[0].requiredFte + 2) } }))
    }
  }, [ws.capacity.calibrate, model.weeks, update])

  if (!hash.startsWith('#/app')) return <Landing onToggleTheme={toggleTheme} />

  const key = hash.split('/')[2] || 'overview'
  const [, , Page] = NAV.find(([k]) => k === key) ?? NAV[0]

  return (
    <div className="shell">
      <aside className="side">
        <a className="brand" href="#/">
          <span className="brand-mark" aria-hidden="true">E</span>
          <span>{BRAND.name}</span>
        </a>
        <nav className="nav" aria-label="Main">
          {NAV.map(([k, label]) => (
            <a key={k} href={`#/app/${k}`} className={k === key ? 'active' : ''} aria-current={k === key ? 'page' : undefined}>
              {Icon[k]}
              {label}
            </a>
          ))}
        </nav>
        <div className="side-foot">
          <span className="pill">{Icon.shield} Data stays in this browser</span>
          <button className="btn ghost sm" type="button" onClick={toggleTheme}>{Icon.moon} Theme</button>
        </div>
      </aside>
      <main className="main">
        {store.saveError && <div className="notice warn" style={{ marginBottom: 16 }}>{store.saveError}</div>}
        <Page {...store} model={model} />
      </main>
    </div>
  )
}
