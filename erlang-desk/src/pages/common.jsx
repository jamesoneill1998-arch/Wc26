import { PageHead } from '../components/ui.jsx'
import { buildSampleWorkspace } from '../state/sample.js'

export function NoServices({ title, replace }) {
  return (
    <div>
      <PageHead eyebrow="Getting started" title={title} />
      <div className="panel empty">
        <h2>No services yet</h2>
        <p>Load the sample operation (voice, chat, back office and a branch network across UK and offshore sites) or set up your first service.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn primary" type="button" onClick={() => replace(buildSampleWorkspace())}>Load the sample operation</button>
          <a className="btn" href="#/app/service?new=1">Add a service</a>
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
