import { formatDate } from '../engine/dates.js'
import { PageHead, Tile, Gap } from '../components/ui.jsx'
import { LineChart, Legend } from '../components/charts.jsx'
import { fmtInt, fmt1, fmtPct } from '../format.js'

export function NeedsData({ title }) {
  return (
    <div className="stack">
      <PageHead title={title} />
      <div className="card empty">
        <h2>Start with some history</h2>
        <p className="muted">Import a CSV of past contact volumes, or load the sample data set to explore. At least a few weeks of daily history is needed.</p>
        <a className="btn primary" href="#/app/data">Go to Data</a>
      </div>
    </div>
  )
}

export function ShortTermNotice({ weeks }) {
  const worst = weeks.reduce((m, w) => (w.gap < m.gap ? w : m), weeks[0])
  return (
    <div className="notice warn">
      <b>▼ {weeks.length} week{weeks.length > 1 ? 's' : ''} short before a new class could be ready.</b>{' '}
      The worst is w/c {formatDate(worst.week)} at {fmt1(-worst.gap)} FTE. Hiring can't land in time, so plan overtime,
      move leave or training, or bring in outsourced support for these weeks.
    </div>
  )
}

export default function Overview({ ws, model }) {
  if (!ws.history?.dailyRows?.length) {
    return (
      <div className="stack">
        <PageHead title={`Welcome to Erlang Desk`} sub="Forecast, staff and plan your contact centre in four steps." />
        <div className="grid grid-2">
          {[
            ['1. Bring your data', 'Upload a CSV of daily or interval contact volumes, or start with sample data.', '#/app/data', 'Import data'],
            ['2. Check the forecast', 'Methods are backtested on your history and the most accurate is chosen. Add overlays for known events.', '#/app/forecast', 'Forecast'],
            ['3. Set service targets', 'Service level, occupancy cap, shrinkage and opening hours drive interval requirements.', '#/app/settings', 'Settings'],
            ['4. Plan hiring', 'Project attrition and training to see when you will run short, and how many to hire.', '#/app/capacity', 'Capacity plan'],
          ].map(([t, d, href, cta]) => (
            <div className="card stack" style={{ gap: 10 }} key={t}>
              <h2>{t}</h2>
              <p className="muted small">{d}</p>
              <div><a className="btn sm" href={href}>{cta}</a></div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  const { forecast, simWithRecs, sim, recs, unfixable } = model
  if (!sim.length) return <NeedsData title="Overview" />
  const next = sim[0]
  const shortWeeks = sim.filter((w) => w.gap < -0.5)
  const firstShort = shortWeeks[0]
  const totalRec = recs.reduce((s, r) => s + r.count, 0)
  const rows = sim.map((w, i) => ({ x: w.week, required: w.requiredFte, available: w.availableFte, withHires: simWithRecs[i].availableFte }))

  return (
    <div className="stack">
      <PageHead title="Overview" sub={`${ws.name} · plan from ${formatDate(sim[0].week, { day: 'numeric', month: 'short', year: 'numeric' })}`} />
      <div className="tiles">
        <Tile hero label="Required FTE next week" value={fmt1(next.requiredFte)} sub={`${fmtInt(next.volume)} contacts forecast`} />
        <Tile label="Available FTE next week" value={fmt1(next.availableFte)} sub={<Gap value={next.gap} />} />
        <Tile label="Weeks short of cover" value={`${shortWeeks.length} of ${sim.length}`} sub={firstShort ? `First shortfall: w/c ${formatDate(firstShort.week)}` : 'Fully covered with current plan'} />
        <Tile label="Suggested hires" value={fmtInt(totalRec)} sub={recs.length ? `${recs.length} class${recs.length > 1 ? 'es' : ''}, first starts ${formatDate(recs[0].week)}` : 'None needed'} />
        <Tile label="Forecast accuracy" value={forecast?.accuracy ? fmtPct(1 - forecast.accuracy.wape) : '–'} sub={forecast?.methodLabel} />
      </div>
      <div className="card">
        <div className="card-head"><h2>Required vs available FTE</h2><a className="small" href="#/app/capacity">Open capacity plan →</a></div>
        <Legend items={[
          { label: 'Required', color: 'var(--series-1)' },
          { label: 'Available (planned hires)', color: 'var(--series-2)' },
          ...(recs.length ? [{ label: 'Available with suggested hires', color: 'var(--muted)' }] : []),
        ]} />
        <LineChart
          rows={rows}
          height={280}
          series={[
            { key: 'required', label: 'Required', color: 'var(--series-1)' },
            { key: 'available', label: 'Available', color: 'var(--series-2)' },
            ...(recs.length ? [{ key: 'withHires', label: 'With suggested hires', color: 'var(--muted)' }] : []),
          ]}
          xFormat={(d, long) => (long ? `Week of ${formatDate(d, { day: 'numeric', month: 'short', year: 'numeric' })}` : formatDate(d))}
          valueFormat={fmt1}
        />
      </div>
      {unfixable.length > 0 && <ShortTermNotice weeks={unfixable} />}
      {recs.length > 0 && (
        <div className="card">
          <div className="card-head"><h2>Hiring you need to start</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Class starts</th><th>Hires</th><th>Covers shortfall from</th></tr></thead>
              <tbody>
                {recs.map((r) => (
                  <tr key={r.week}>
                    <td>{formatDate(r.week, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td>{r.count}</td>
                    <td>{formatDate(r.coversWeek)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
