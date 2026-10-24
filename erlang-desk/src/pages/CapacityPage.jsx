import { useState } from 'react'
import { formatDate } from '../engine/dates.js'
import { toCSV } from '../engine/csv.js'
import { PageHead, Tile, NumberField, SelectField, Gap } from '../components/ui.jsx'
import { LineChart, Legend } from '../components/charts.jsx'
import { downloadText, fmtInt, fmt1, fmtPct } from '../format.js'
import { NeedsData, ShortTermNotice } from './Overview.jsx'

export default function CapacityPage({ ws, update, model }) {
  const { sim, recs, weeks, unfixable } = model
  const c = ws.capacity
  const plan = ws.plan
  const setC = (patch) => update({ capacity: { ...c, ...patch } })
  const setPlan = (patch) => update({ plan: { ...plan, ...patch } })
  const setS = (patch) => update({ settings: { ...ws.settings, ...patch } })
  const [newWeek, setNewWeek] = useState('')
  const [newCount, setNewCount] = useState(10)

  if (!sim.length) return <NeedsData title="Capacity plan" />

  const addHire = (week, count) => update((cur) => ({
    hires: [...cur.hires.filter((h) => h.week !== week), { week, count: (cur.hires.find((h) => h.week === week)?.count ?? 0) + count }]
      .sort((a, b) => (a.week < b.week ? -1 : 1)),
  }))
  const removeHire = (week) => update((cur) => ({ hires: cur.hires.filter((h) => h.week !== week) }))
  const weekOpts = weeks.map((w) => ({ value: w.week, label: formatDate(w.week, { day: 'numeric', month: 'short', year: 'numeric' }) }))
  const avgGap = sim.reduce((t, w) => t + w.gap, 0) / sim.length
  const worst = sim.reduce((m, w) => (w.gap < m.gap ? w : m), sim[0])
  const lead = c.trainingWeeks + c.nestingWeeks

  const exportCsv = () => downloadText('erlang-desk-capacity-plan.csv', toCSV([
    { label: 'week_commencing', get: (w) => w.week },
    { label: 'forecast_contacts', get: (w) => Math.round(w.volume) },
    { label: 'aht_sec', get: (w) => Math.round(w.aht) },
    { label: 'required_fte', get: (w) => w.requiredFte.toFixed(2) },
    { label: 'available_fte', get: (w) => w.availableFte.toFixed(2) },
    { label: 'headcount', get: (w) => w.headcount.toFixed(1) },
    { label: 'in_training_or_nesting', get: (w) => w.inTraining.toFixed(1) },
    { label: 'gap_fte', get: (w) => w.gap.toFixed(2) },
  ], sim))

  return (
    <div className="stack">
      <PageHead title="Capacity plan" sub="Week-by-week demand against supply, after attrition and ramp-up of new starters.">
        <button className="btn" type="button" onClick={exportCsv}>Export CSV</button>
      </PageHead>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <h2>Supply assumptions</h2>
            <button className="btn sm ghost" type="button" onClick={() => setC({ startHeadcount: Math.round(sim[0].requiredFte * 2) / 2 })}>Match next week's requirement</button>
          </div>
          <div className="fields">
            <NumberField label="Current productive FTE" value={c.startHeadcount} min={0} step={0.5} onChange={(startHeadcount) => setC({ startHeadcount })} />
            <NumberField label="Monthly attrition" pct step={0.1} min={0} max={50} value={c.monthlyAttrition} onChange={(monthlyAttrition) => setC({ monthlyAttrition })} />
            <NumberField label="Training" suffix="weeks" min={0} max={26} value={c.trainingWeeks} onChange={(trainingWeeks) => setC({ trainingWeeks: Math.round(trainingWeeks) })} />
            <NumberField label="Nesting" suffix="weeks" min={0} max={26} value={c.nestingWeeks} onChange={(nestingWeeks) => setC({ nestingWeeks: Math.round(nestingWeeks) })} />
            <NumberField label="Nesting productivity" pct min={0} max={100} value={c.nestingProductivity} onChange={(nestingProductivity) => setC({ nestingProductivity })} />
            <NumberField label="Min. weeks between classes" min={1} max={26} value={c.classCadenceWeeks} onChange={(classCadenceWeeks) => setC({ classCadenceWeeks: Math.round(classCadenceWeeks) })} />
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>What if…</h2><span className="small muted">Applies across the whole plan</span></div>
          <div className="fields">
            <NumberField label="Volume change" pct step={1} min={-90} max={500} value={plan.volumeAdjustPct} onChange={(volumeAdjustPct) => setPlan({ volumeAdjustPct })} />
            <NumberField label="AHT change" pct step={1} min={-90} max={500} value={plan.ahtAdjustPct} onChange={(ahtAdjustPct) => setPlan({ ahtAdjustPct })} />
            <NumberField label="Shrinkage" pct step={1} min={0} max={90} value={ws.settings.shrinkage} onChange={(shrinkage) => setS({ shrinkage })} />
            <NumberField label="Service level goal" pct step={1} min={1} max={99.9} value={ws.settings.slTarget} onChange={(slTarget) => setS({ slTarget })} />
          </div>
        </div>
      </div>

      <div className="tiles">
        <Tile label="Average weekly position" value={<Gap value={avgGap} />} sub={`Across ${sim.length} weeks`} />
        <Tile label="Worst week" value={<Gap value={worst.gap} />} sub={`w/c ${formatDate(worst.week, { day: 'numeric', month: 'short', year: 'numeric' })}`} />
        <Tile label="Hiring lead time" value={`${lead} weeks`} sub={`${c.trainingWeeks} training + ${c.nestingWeeks} nesting`} />
        <Tile label="Weekly attrition" value={fmtPct(1 - (1 - c.monthlyAttrition) ** (12 / 52), 2)} sub={`≈ ${fmt1(c.startHeadcount * (1 - (1 - c.monthlyAttrition) ** 12))} leavers a year at today's size`} />
      </div>

      {unfixable.length > 0 && <ShortTermNotice weeks={unfixable} />}

      <div className="card">
        <div className="card-head"><h2>Required vs available FTE</h2></div>
        <Legend items={[{ label: 'Required', color: 'var(--series-1)' }, { label: 'Available', color: 'var(--series-2)' }]} />
        <LineChart
          rows={sim.map((w) => ({ x: w.week, required: w.requiredFte, available: w.availableFte }))}
          height={280}
          series={[{ key: 'required', label: 'Required', color: 'var(--series-1)' }, { key: 'available', label: 'Available', color: 'var(--series-2)' }]}
          xFormat={(d, long) => (long ? `Week of ${formatDate(d, { day: 'numeric', month: 'short', year: 'numeric' })}` : formatDate(d))}
          valueFormat={fmt1}
        />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head"><h2>Planned hiring classes</h2></div>
          {ws.hires.length === 0 && <p className="small muted" style={{ marginBottom: 12 }}>No classes planned yet. Add one below or accept a suggestion.</p>}
          {ws.hires.length > 0 && (
            <table style={{ marginBottom: 12 }}>
              <thead><tr><th>Starts</th><th>Hires</th><th /></tr></thead>
              <tbody>
                {ws.hires.map((h) => (
                  <tr key={h.week}>
                    <td>{formatDate(h.week, { day: 'numeric', month: 'short', year: 'numeric' })}{!weeks.some((w) => w.week === h.week) ? ' (outside plan)' : ''}</td>
                    <td>{h.count}</td>
                    <td><button className="btn sm ghost" type="button" onClick={() => removeHire(h.week)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 150 }}><SelectField label="Class start week" value={newWeek || weekOpts[0].value} onChange={setNewWeek} options={weekOpts} /></div>
            <div style={{ width: 100 }}><NumberField label="Hires" min={1} value={newCount} onChange={(v) => setNewCount(Math.round(v))} /></div>
            <button className="btn" type="button" onClick={() => addHire(newWeek || weekOpts[0].value, newCount)}>Add class</button>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Suggested classes</h2>{recs.length > 1 && <button className="btn sm" type="button" onClick={() => recs.forEach((r) => addHire(r.week, r.count))}>Accept all</button>}</div>
          {recs.length === 0 ? (
            <p className="status good">▲ The current plan covers every week within tolerance.</p>
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
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Weekly plan</h2></div>
        <div className="table-wrap scroll-y">
          <table>
            <thead><tr><th>Week of</th><th>Contacts</th><th>AHT</th><th>Required FTE</th><th>Available FTE</th><th>Headcount</th><th>In training</th><th>Gap</th></tr></thead>
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
                  <td><Gap value={w.gap} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
