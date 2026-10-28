import { useState } from 'react'
import { formatDate } from '../engine/dates.js'
import { toCSV } from '../engine/csv.js'
import { PageHead, Figures, Figure, NumberField, SelectField, Gap, Panel, LoadingPage } from '../components/ui.jsx'
import { LineChart, Legend } from '../components/charts.jsx'
import { downloadText, fmtInt, fmt1, fmtPct } from '../format.js'
import { NoServices, NeedsHistory, serviceEyebrow } from './common.jsx'
import { ShortTermNotice } from './Overview.jsx'

export default function CapacityPage({ active, site, result, updateActive, updateService, updateSite, replace, account }) {
  const [newWeek, setNewWeek] = useState('')
  const [newCount, setNewCount] = useState(10)
  if (!active) return <NoServices title="Capacity plan" replace={replace} />
  const eyebrow = serviceEyebrow(active, site)
  if (!active.history) return <NeedsHistory title="Capacity plan" eyebrow={eyebrow} />
  if (!result?.sim?.length) return <LoadingPage eyebrow={eyebrow} title="Capacity plan" />

  const { sim, recs, weeks, unfixable, settings: s } = result
  const c = active.capacity
  const plan = active.plan
  const setC = (patch) => updateActive({ capacity: { ...c, ...patch } })
  const setPlan = (patch) => updateActive({ plan: { ...plan, ...patch } })
  const setS = (patch) => updateActive({ settings: { ...active.settings, ...patch } })
  const addHire = (week, count) => updateService(active.id, (svc) => ({
    hires: [...svc.hires.filter((h) => h.week !== week), { week, count: (svc.hires.find((h) => h.week === week)?.count ?? 0) + count }]
      .sort((a, b) => (a.week < b.week ? -1 : 1)),
  }))
  const removeHire = (week) => updateService(active.id, (svc) => ({ hires: svc.hires.filter((h) => h.week !== week) }))
  const weekOpts = weeks.map((w) => ({ value: w.week, label: formatDate(w.week, { day: 'numeric', month: 'short', year: 'numeric' }) }))
  const avgGap = sim.reduce((t, w) => t + w.gap, 0) / sim.length
  const worst = sim.reduce((m, w) => (w.gap < m.gap ? w : m), sim[0])
  const lead = c.trainingWeeks + c.nestingWeeks
  const attrition = result.capacity.monthlyAttrition

  const exportCsv = () => downloadText(`erlang-desk-capacity-${active.name}.csv`, toCSV([
    { label: 'week_commencing', get: (w) => w.week },
    { label: 'forecast_volume', get: (w) => Math.round(w.volume) },
    { label: 'aht_sec', get: (w) => Math.round(w.aht) },
    { label: 'required_fte', get: (w) => w.requiredFte.toFixed(2) },
    { label: 'available_fte', get: (w) => w.availableFte.toFixed(2) },
    { label: 'headcount', get: (w) => w.headcount.toFixed(1) },
    { label: 'in_training_or_nesting', get: (w) => w.inTraining.toFixed(1) },
    { label: 'gap_fte', get: (w) => w.gap.toFixed(2) },
  ], sim))

  return (
    <div className="stack">
      <PageHead eyebrow={eyebrow} title="Capacity plan" lede="Week by week, the FTE this service needs against the FTE it will have, after attrition and the ramp-up of new starters.">
        <button className="btn" type="button" onClick={() => window.print()}>Print</button>
        {account.entitled && <button className="btn" type="button" onClick={exportCsv}>Export CSV</button>}
      </PageHead>

      <Figures>
        <Figure label="Average weekly position" value={<Gap value={avgGap} />} sub={`Over ${sim.length} weeks`} />
        <Figure label="Worst week" value={<Gap value={worst.gap} />} sub={`w/c ${formatDate(worst.week, { day: 'numeric', month: 'short', year: 'numeric' })}`} />
        <Figure label="Hiring lead time" value={`${lead} weeks`} sub={`${c.trainingWeeks} training, ${c.nestingWeeks} nesting`} />
        <Figure label="Shrinkage applied" value={fmtPct(s.shrinkage, 0)} sub={active.settings.shrinkageOverride != null ? 'Service override' : `${site?.name} site default`} />
      </Figures>

      {unfixable.length > 0 && <ShortTermNotice weeks={unfixable} />}

      <Panel title="Required against available FTE">
        <Legend items={[{ label: 'Required', color: 'var(--series-1)' }, { label: 'Available', color: 'var(--series-2)' }]} />
        <LineChart
          rows={sim.map((w) => ({ x: w.week, required: w.requiredFte, available: w.availableFte }))}
          height={280}
          series={[{ key: 'required', label: 'Required', color: 'var(--series-1)' }, { key: 'available', label: 'Available', color: 'var(--series-2)' }]}
          xFormat={(d, long) => (long ? `Week of ${formatDate(d, { day: 'numeric', month: 'short', year: 'numeric' })}` : formatDate(d))}
          valueFormat={fmt1}
        />
      </Panel>

      <div className="cols">
        <Panel title="Supply" aside={<button className="btn link" type="button" onClick={() => setC({ startHeadcount: Math.round(sim[0].requiredFte * 2) / 2 })}>Match next week's need</button>}>
          <div className="fields">
            <NumberField label="Productive FTE today" value={c.startHeadcount} min={0} step={0.5} onChange={(startHeadcount) => setC({ startHeadcount })} />
            <NumberField label={`Monthly attrition, ${site?.code}`} pct step={0.1} min={0} max={50} value={attrition} onChange={(monthlyAttrition) => updateSite(site.id, { monthlyAttrition })} hint="Set per site" />
            <NumberField label="Training" suffix="weeks" min={0} max={52} value={c.trainingWeeks} onChange={(v) => setC({ trainingWeeks: Math.round(v) })} />
            <NumberField label="Nesting" suffix="weeks" min={0} max={52} value={c.nestingWeeks} onChange={(v) => setC({ nestingWeeks: Math.round(v) })} />
            <NumberField label="Nesting productivity" pct min={0} max={100} value={c.nestingProductivity} onChange={(nestingProductivity) => setC({ nestingProductivity })} />
            <NumberField label="Weeks between classes" min={1} max={52} value={c.classCadenceWeeks} onChange={(v) => setC({ classCadenceWeeks: Math.round(v) })} />
          </div>
        </Panel>
        <Panel title="What if" aside="Applies across this service's plan">
          <div className="fields">
            <NumberField label="Volume change" pct step={1} min={-90} max={500} slider={[-50, 100]} value={plan.volumeAdjustPct} onChange={(volumeAdjustPct) => setPlan({ volumeAdjustPct })} />
            <NumberField label="AHT change" pct step={1} min={-90} max={500} slider={[-50, 100]} value={plan.ahtAdjustPct} onChange={(ahtAdjustPct) => setPlan({ ahtAdjustPct })} />
            {active.channel !== 'backoffice' && <NumberField label="Service level goal" pct step={1} min={1} max={99.9} slider={[50, 99]} value={active.settings.slTarget} onChange={(slTarget) => setS({ slTarget })} />}
            <NumberField label="Shrinkage override" pct step={1} min={0} max={90} slider={[10, 60]} value={active.settings.shrinkageOverride ?? s.shrinkage} onChange={(shrinkageOverride) => setS({ shrinkageOverride })} hint={active.settings.shrinkageOverride != null ? <button className="btn link small" type="button" onClick={() => setS({ shrinkageOverride: null })}>Use site default</button> : 'Site default in use'} />
          </div>
        </Panel>
      </div>

      <div className="cols">
        <Panel title="Planned classes">
          {active.hires.length === 0 ? (
            <p className="small muted" style={{ marginBottom: 14 }}>None planned yet. Add one, or accept a suggestion.</p>
          ) : (
            <table style={{ marginBottom: 16 }}>
              <thead><tr><th>Starts</th><th>Hires</th><th /></tr></thead>
              <tbody>
                {active.hires.map((h) => (
                  <tr key={h.week}>
                    <td>{formatDate(h.week, { day: 'numeric', month: 'short', year: 'numeric' })}{!weeks.some((w) => w.week === h.week) ? <span className="faint"> · outside plan</span> : ''}</td>
                    <td>{h.count}</td>
                    <td><button className="btn link" type="button" onClick={() => removeHire(h.week)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 150 }}><SelectField label="Class starts" value={newWeek || weekOpts[0].value} onChange={setNewWeek} options={weekOpts} /></div>
            <div style={{ width: 96 }}><NumberField label="Hires" min={1} value={newCount} onChange={(v) => setNewCount(Math.round(v))} /></div>
            <button className="btn" type="button" onClick={() => addHire(newWeek || weekOpts[0].value, newCount)}>Add</button>
          </div>
        </Panel>
        <Panel title="Suggested classes" aside={recs.length > 1 && <button className="btn sm" type="button" onClick={() => recs.forEach((r) => addHire(r.week, r.count))}>Accept all</button>}>
          {recs.length === 0 ? (
            <p className="status good"><span className="glyph">▲</span> The plan covers every week a new class could reach.</p>
          ) : (
            <table>
              <thead><tr><th>Starts</th><th>Hires</th><th>Productive from</th><th /></tr></thead>
              <tbody>
                {recs.map((r) => (
                  <tr key={r.week}>
                    <td>{formatDate(r.week, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td>{r.count}</td>
                    <td>{formatDate(new Date(Date.parse(r.week) + lead * 7 * 864e5).toISOString().slice(0, 10))}</td>
                    <td><button className="btn sm" type="button" onClick={() => addHire(r.week, r.count)}>Add to plan</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <Panel title="Week by week">
        <div className="table-wrap scroll-y">
          <table>
            <thead><tr><th>Week of</th><th>Volume</th><th>AHT</th><th>Required</th><th>Available</th><th>Headcount</th><th>In training</th><th>Gap</th></tr></thead>
            <tbody>
              {sim.map((w) => (
                <tr key={w.week}>
                  <td>{formatDate(w.week, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td>{fmtInt(w.volume)}</td>
                  <td>{Math.round(w.aht)}s</td>
                  <td>{fmt1(w.requiredFte)}</td>
                  <td>{fmt1(w.availableFte)}</td>
                  <td>{fmt1(w.headcount)}</td>
                  <td>{w.inTraining > 0 ? fmt1(w.inTraining) : '–'}</td>
                  <td><Gap value={w.gap} unit="" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
