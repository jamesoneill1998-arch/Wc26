import { PageHead } from '../components/ui.jsx'
import { buildSampleWorkspace } from '../state/sample.js'

export function NoServices({ title, replace }) {
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
