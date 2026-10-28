import { useState } from 'react'
import { CHANNELS, defaultServiceSettings } from '../engine/channels.js'
import { WEEKDAYS } from '../engine/dates.js'
import { newService } from '../state/store.js'
import { PageHead, NumberField, SelectField, TextField, Panel, ConfirmButton, DayTimeline, TimeSelect } from '../components/ui.jsx'
import { serviceEyebrow } from './common.jsx'

const channelOptions = Object.entries(CHANNELS).map(([value, c]) => ({ value, label: `${c.label} · ${c.method}` }))

function AddService({ ws, update, onDone }) {
  const [name, setName] = useState('')
  const [channel, setChannel] = useState('voice')
  const [siteId, setSiteId] = useState(ws.sites[0]?.id)
  return (
    <Panel title="Add a service">
      <div className="fields">
        <TextField label="Name" value={name} onChange={setName} placeholder="e.g. Customer service" />
        <SelectField label="Channel" value={channel} onChange={setChannel} options={channelOptions} />
        <SelectField label="Site" value={siteId} onChange={setSiteId} options={ws.sites.map((s) => ({ value: s.id, label: s.name }))} />
      </div>
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn primary" type="button" disabled={ws.services.length >= 30} onClick={() => {
          const svc = newService({ name: name.trim() || undefined, channel, siteId })
          update((cur) => ({ services: [...cur.services, svc], activeServiceId: svc.id }))
          onDone()
        }}>Add service</button>
        {ws.services.length > 0 && <button className="btn" type="button" onClick={onDone}>Cancel</button>}
      </div>
    </Panel>
  )
}

export default function ServicePage({ ws, active, site, update, updateActive, query }) {
  const [adding, setAdding] = useState(query?.get('new') === '1' || !active)
  if (adding || !active) {
    return (
      <div className="stack">
        <PageHead eyebrow="Services" title="Add a service" lede="A service is one stream of work at one site: say, UK voice or offshore chat. Each is forecast and staffed on its own, then rolled up on the Overview." />
        <AddService ws={ws} update={update} onDone={() => { setAdding(false); window.location.hash = '#/app/data' }} />
      </div>
    )
  }
  const s = active.settings
  const set = (patch) => updateActive({ settings: { ...s, ...patch } })
  const live = active.channel !== 'backoffice'
  const setHours = (wd, h) => set({ hours: s.hours.map((x, i) => (i === wd ? h : x)) })

  return (
    <div className="stack">
      <PageHead eyebrow={serviceEyebrow(active, site)} title="Service settings" lede={`${CHANNELS[active.channel].label} is planned with ${CHANNELS[active.channel].method}. Targets and hours here drive the staffing, coverage and capacity pages.`}>
        <button className="btn" type="button" onClick={() => setAdding(true)}>Add a service</button>
      </PageHead>

      <Panel title="Identity">
        <div className="fields">
          <TextField label="Name" value={active.name} onChange={(name) => updateActive({ name })} />
          <SelectField label="Channel" value={active.channel} onChange={(channel) => updateActive({ channel, settings: defaultServiceSettings(channel) })} options={channelOptions} hint="Changing channel resets targets to that channel's defaults" />
          <SelectField label="Site" value={active.siteId} onChange={(siteId) => updateActive({ siteId })} options={ws.sites.map((x) => ({ value: x.id, label: x.name }))} hint="Sets shrinkage, hours per FTE and attrition" />
        </div>
      </Panel>

      {live ? (
        <Panel title="Service targets and queue model">
          <div className="fields">
            <SelectField label="Queue model" value={s.queueModel === 'workload' ? 'erlangC' : s.queueModel} onChange={(queueModel) => set({ queueModel })} options={[{ value: 'erlangA', label: 'Erlang A (with abandonment)' }, { value: 'erlangC', label: 'Erlang C (no abandonment)' }]} />
            {s.queueModel === 'erlangA' && <NumberField label="Average patience" suffix="sec" min={5} max={3600} value={s.patienceSec} onChange={(patienceSec) => set({ patienceSec })} hint="Mean wait before a customer gives up" />}
            <NumberField label="Service level goal" pct min={1} max={99.9} value={s.slTarget} onChange={(slTarget) => set({ slTarget })} />
            <NumberField label="Answered within" suffix="sec" min={0} max={7200} value={s.targetSec} onChange={(targetSec) => set({ targetSec })} />
            <NumberField label="Average wait ceiling" suffix="sec" min={0} max={7200} value={s.asaTarget} onChange={(asaTarget) => set({ asaTarget })} hint="0 = no ceiling" />
            {s.queueModel === 'erlangA' && <NumberField label="Abandonment ceiling" pct min={0} max={90} step={0.5} value={s.abandonTarget} onChange={(abandonTarget) => set({ abandonTarget })} hint="0 = no ceiling" />}
            <NumberField label="Maximum occupancy" pct min={10} max={100} value={s.maxOccupancy} onChange={(maxOccupancy) => set({ maxOccupancy })} />
            <NumberField label={active.channel === 'branch' ? 'Minimum staff per branch' : 'Minimum staff when open'} min={0} max={500} value={s.minAgents} onChange={(v) => set({ minAgents: Math.round(v) })} />
            {active.channel === 'chat' && <NumberField label="Concurrent chats per agent" min={1} max={10} step={0.5} value={s.concurrency} onChange={(concurrency) => set({ concurrency })} />}
            {active.channel === 'branch' && <NumberField label="Number of branches" min={1} max={5000} value={s.branches} onChange={(v) => set({ branches: Math.round(v) })} hint="Volume is spread evenly; each branch queues on its own" />}
            <SelectField label="Interval" value={String(s.intervalMin)} onChange={(v) => set({ intervalMin: Number(v) })} options={[15, 30, 60].map((m) => ({ value: String(m), label: `${m} minutes` }))} />
            <NumberField label="Default handle time" suffix="sec" min={1} max={86400} value={s.defaultAht} onChange={(defaultAht) => set({ defaultAht })} hint="Used when history has no AHT" />
          </div>
        </Panel>
      ) : (
        <Panel title="Workload and turnaround">
          <div className="fields">
            <NumberField label="Turnaround SLA" suffix="working days" min={1} max={30} value={s.slaDays} onChange={(v) => set({ slaDays: Math.round(v) })} hint="Work is smoothed over this window" />
            <NumberField label="Utilisation" pct min={30} max={100} value={s.utilisation} onChange={(utilisation) => set({ utilisation })} hint="Share of productive time on items" />
            <NumberField label="Default handle time" suffix="sec" min={1} max={86400} value={s.defaultAht} onChange={(defaultAht) => set({ defaultAht })} hint="Per item, when history has no AHT" />
          </div>
        </Panel>
      )}

      <Panel title="Opening hours" aside={live ? 'Minimum staffing applies inside these hours' : 'Work arriving on closed days rolls to the next open day'}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Day</th><th style={{ textAlign: 'left' }}>Open</th><th style={{ textAlign: 'left' }}>From</th><th style={{ textAlign: 'left' }}>To</th><th style={{ textAlign: 'left', width: '40%' }}>Day at a glance</th></tr></thead>
            <tbody>
              {WEEKDAYS.map((d, wd) => {
                const h = s.hours[wd]
                return (
                  <tr key={d}>
                    <td>{d}</td>
                    <td style={{ textAlign: 'left' }}><input type="checkbox" aria-label={`Open on ${d}`} checked={!!h} onChange={(e) => setHours(wd, e.target.checked ? { open: '09:00', close: '17:00' } : null)} /></td>
                    <td style={{ textAlign: 'left' }}>{h && <TimeSelect label={`${d} opens`} step={s.intervalMin} value={h.open} onChange={(v) => setHours(wd, { ...h, open: v })} />}</td>
                    <td style={{ textAlign: 'left' }}>{h && <TimeSelect label={`${d} closes`} step={s.intervalMin} allowMidnightEnd value={h.close} onChange={(v) => setHours(wd, { ...h, close: v })} />}</td>
                    <td style={{ textAlign: 'left' }}>{h ? <DayTimeline open={h.open} close={h.close} /> : <span className="faint small">Closed</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="row">
        <ConfirmButton confirmLabel="Click again to reset targets" onConfirm={() => updateActive({ settings: defaultServiceSettings(active.channel) })}>Reset to defaults</ConfirmButton>
        <ConfirmButton confirmLabel={`Click again to delete ${active.name}`} onConfirm={() => update((cur) => {
          const services = cur.services.filter((x) => x.id !== active.id)
          return { services, activeServiceId: services[0]?.id ?? null }
        })}>Delete service</ConfirmButton>
      </div>
    </div>
  )
}
