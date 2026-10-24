import { CHANNELS, siteShrinkage } from '../engine/channels.js'
import { formatDate } from '../engine/dates.js'
import { PageHead, Figures, Figure, Gap, Panel } from '../components/ui.jsx'
import { StackedColumns, Legend } from '../components/charts.jsx'
import { fmtInt, fmt1, fmtPct } from '../format.js'
import { NoServices } from './common.jsx'

const CHANNEL_COLORS = { voice: 'var(--series-1)', chat: 'var(--series-2)', backoffice: 'var(--series-3)', branch: 'var(--series-4)' }
const ORDER = ['voice', 'chat', 'backoffice', 'branch']

export function ShortTermNotice({ weeks }) {
  const worst = weeks.reduce((m, w) => (w.gap < m.gap ? w : m), weeks[0])
  return (
    <div className="notice">
      <b>{weeks.length} week{weeks.length > 1 ? 's' : ''} short before a new class could be ready.</b>{' '}
      The worst is w/c {formatDate(worst.week)} at {fmt1(-worst.gap)} FTE. Hiring can't land in time; cover these weeks with overtime,
      by moving leave or training, or with outsourced support.
    </div>
  )
}

export default function Overview({ ws, model, replace, update }) {
  if (!ws.services.length) return <NoServices title="Overview" replace={replace} />
  const sites = new Map(ws.sites.map((s) => [s.id, s]))
  const total = model.total
  const next = total[0]
  const rows = ws.services.map((svc) => ({ svc, r: model.services[svc.id] }))
  const channelsPresent = ORDER.filter((c) => model.byChannel[c]?.length)
  const chartRows = total.map((w) => ({
    x: w.week,
    available: w.availableFte,
    ...Object.fromEntries(channelsPresent.map((c) => [c, model.byChannel[c].find((cw) => cw.week === w.week)?.requiredFte ?? 0])),
  }))
  const totalRecs = rows.reduce((t, { r }) => t + (r?.recs ?? []).reduce((a, h) => a + h.count, 0), 0)
  const shortWeeks = total.filter((w) => w.gap < -0.5).length

  return (
    <div className="stack">
      <PageHead
        eyebrow={`Operation overview${next ? ` · plan from ${formatDate(next.week, { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}`}
        title={ws.name}
        lede="Required and available full-time equivalents across every service and site, after shrinkage, attrition and the ramp-up of new starters."
      />
      {next ? (
        <Figures>
          <Figure hero label="Required FTE, next week" value={fmt1(next.requiredFte)} sub={`${ws.services.length} services, ${ws.sites.length} sites`} />
          <Figure label="Available FTE" value={fmt1(next.availableFte)} sub={<Gap value={next.gap} />} />
          <Figure label="Weeks short of cover" value={`${shortWeeks} of ${total.length}`} sub="Across the whole operation" />
          <Figure label="Suggested hires" value={fmtInt(totalRecs)} sub="To cover every reachable shortfall" />
        </Figures>
      ) : (
        <div className="notice">Add history to at least one service to see the plan.</div>
      )}

      {chartRows.length > 0 && (
        <Panel title="Required FTE by channel, against available" aside={`${chartRows.length} weeks`}>
          <Legend items={[
            ...channelsPresent.map((c) => ({ label: CHANNELS[c].label, color: CHANNEL_COLORS[c], block: true })),
            { label: 'Available', color: 'var(--ink)' },
          ]} />
          <StackedColumns
            rows={chartRows}
            series={channelsPresent.map((c) => ({ key: c, label: CHANNELS[c].label, color: CHANNEL_COLORS[c] }))}
            line={{ key: 'available', label: 'Available', color: 'var(--ink)' }}
            height={280}
            xFormat={(d, long) => (long ? `Week of ${formatDate(d, { day: 'numeric', month: 'short', year: 'numeric' })}` : formatDate(d))}
            valueFormat={fmt1}
          />
        </Panel>
      )}

      <Panel title="Services" aside={<a href="#/app/service?new=1">Add a service</a>}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Service</th><th>Site</th><th>Model</th><th>Contacts next wk</th><th>Required</th><th>Available</th><th>Gap</th><th>Suggested hires</th></tr></thead>
            <tbody>
              {rows.map(({ svc, r }) => {
                const w = r?.sim?.[0]
                return (
                  <tr key={svc.id}>
                    <td>
                      <a href="#/app/forecast" onClick={() => update({ activeServiceId: svc.id })}>{svc.name}</a>
                      <span className="faint"> · {CHANNELS[svc.channel].label}</span>
                    </td>
                    <td>{sites.get(svc.siteId)?.code}</td>
                    <td className="faint">{svc.channel === 'backoffice' ? 'Workload' : svc.settings.queueModel === 'erlangA' ? 'Erlang A' : 'Erlang C'}</td>
                    <td>{w ? fmtInt(w.volume) : <span className="faint">No history</span>}</td>
                    <td>{w ? fmt1(w.requiredFte) : '–'}</td>
                    <td>{w ? fmt1(w.availableFte) : '–'}</td>
                    <td>{w ? <Gap value={w.gap} unit="" /> : '–'}</td>
                    <td>{r?.recs?.length ? fmtInt(r.recs.reduce((t, h) => t + h.count, 0)) : '–'}</td>
                  </tr>
                )
              })}
              {next && (
                <tr className="total">
                  <td>Total</td><td /><td /><td />
                  <td>{fmt1(next.requiredFte)}</td><td>{fmt1(next.availableFte)}</td><td><Gap value={next.gap} unit="" /></td><td>{fmtInt(totalRecs)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Sites" aside={<a href="#/app/sites">Edit shrinkage</a>}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Site</th><th>Shrinkage</th><th>Hours / FTE</th><th>Attrition / month</th><th>Required next wk</th><th>Available</th><th>Gap</th></tr></thead>
            <tbody>
              {ws.sites.map((site) => {
                const w = model.bySite[site.id]?.[0]
                return (
                  <tr key={site.id}>
                    <td>{site.name} <span className="faint">{site.code}</span></td>
                    <td>{fmtPct(siteShrinkage(site), 1)}</td>
                    <td>{site.fteHoursPerWeek}</td>
                    <td>{fmtPct(site.monthlyAttrition, 1)}</td>
                    <td>{w ? fmt1(w.requiredFte) : '–'}</td>
                    <td>{w ? fmt1(w.availableFte) : '–'}</td>
                    <td>{w ? <Gap value={w.gap} unit="" /> : '–'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
