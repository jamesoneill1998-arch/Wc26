import { useRef, useState } from 'react'
import { PageHead } from '../components/ui.jsx'
import { buildSampleWorkspace } from '../state/sample.js'

/** Open a workspace file a colleague exported (Data → Export workspace). */
function OpenSharedPlan({ replace }) {
  const ref = useRef(null)
  const [error, setError] = useState(null)
  const open = async (file) => {
    if (!file) return
    if (file.size > 50 * 1024 * 1024) return setError('That file is too large to be a workspace.')
    try { replace(JSON.parse(await file.text())) } catch { setError('That file is not an Erlang Desk workspace export.') }
  }
  return (
    <div className="module start">
      <div className="method">From a colleague</div>
      <h3>Open a shared plan</h3>
      <p>A teammate exports their workspace from Data. Open the file here to pick up exactly where they left off.</p>
      <button className="btn" type="button" onClick={() => ref.current?.click()}>Open a workspace file</button>
      <input ref={ref} type="file" accept=".json,application/json" hidden onChange={(e) => { open(e.target.files[0]); e.target.value = '' }} />
      {error && <p className="status bad" role="alert">{error}</p>}
    </div>
  )
}

export function NoServices({ title, replace, account }) {
  return (
    <div className="stack">
      <PageHead eyebrow="Getting started" title={title === 'Overview' ? 'Welcome to Erlang Desk' : title} lede="Plan one service or a whole operation. Everything you enter stays in this browser." />
      <div className="start-grid">
        <div className="module start featured">
          <div className="method">Fastest way to see it</div>
          <h3>Explore the sample</h3>
          <p>An insurer with voice, chat, back office and a branch network across a UK and an offshore site, with rosters and a change register already filled in.</p>
          <button className="btn primary" type="button" onClick={() => replace(buildSampleWorkspace())}>Load the sample operation</button>
          <span className="small faint">Includes a two-minute guided tour.</span>
        </div>
        <div className="module start">
          <div className="method">Use your own numbers</div>
          <h3>Import history</h3>
          <p>Add a service, then drop in a CSV export from your telephony or workflow system: date, volume and, if you have them, interval and AHT.</p>
          <a className="btn" href="#/app/service?new=1">Add a service</a>
        </div>
        <div className="module start">
          <div className="method">Monthly view</div>
          <h3>Assess a change</h3>
          <p>No interval data needed. Enter a monthly forecast and operational FTE for an area, then test whether a project can be absorbed.</p>
          <a className="btn" href="#/app/impact">Open impact assessment</a>
        </div>
        {account?.entitled && <OpenSharedPlan replace={replace} />}
      </div>
    </div>
  )
}

export function NeedsHistory({ title, eyebrow }) {
  return (
    <div>
      <PageHead eyebrow={eyebrow} title={title} />
      <div className="panel empty">
        <h2>This service has no history yet</h2>
        <p>Import a CSV of past volumes, or load sample data for this channel. A few weeks of daily history is the minimum; two years gives the best forecast.</p>
        <a className="btn primary" href="#/app/data">Go to Data</a>
      </div>
    </div>
  )
}

export function serviceEyebrow(service, site) {
  return [service.name, service.channel === 'backoffice' ? 'Back office' : service.channel[0].toUpperCase() + service.channel.slice(1), site?.name].filter(Boolean).join(' · ')
}
