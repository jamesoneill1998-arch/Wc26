import { useState } from 'react'
import Term from '../components/Term.jsx'
import { formatDate } from '../engine/dates.js'
import { toCSV } from '../engine/csv.js'
import { PageHead, Figures, Figure, NumberField, SelectField, TextField, Gap, Panel, LoadingPage, Segmented } from '../components/ui.jsx'
import { MAX_SCENARIOS } from '../state/store.js'
import { LineChart, GapChart, Legend } from '../components/charts.jsx'
import { downloadText, fmtInt, fmt1, fmtPct } from '../format.js'
import { NoServices, NeedsHistory, serviceEyebrow } from './common.jsx'
import { ShortTermNotice } from './Overview.jsx'

const SCENARIO_LABEL = { plan: 'Plan', high: 'Higher demand', low: 'Lower demand', attrition: 'Higher attrition', both: 'Higher demand and attrition' }
const weekLabel = (d, long) => (long ? `Week of ${formatDate(d, { day: 'numeric', month: 'short', year: 'numeric' })}` : formatDate(d))

export default function CapacityPage({ active, site, result, updateActive, updateService, updateSite, replace, account }) {
  const [newWeek, setNewWeek] = useState('')
  const [newCount, setNewCount] = useState(10)
  const [view, setView] = useState('gap')
  const [editing, setEditing] = useState(null)
  const [scWeek, setScWeek] = useState('')
  const [scCount, setScCount] = useState(10)
  const [draft, setDraft] = useState({ name: '', demand: 0, aht: 0, shrinkage: null, attrition: null })
  if (!active) return <NoServices title="Capacity plan" replace={replace} account={account} />
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

  const own = active.scenarios ?? []
  const full = own.length >= MAX_SCENARIOS
  const near = (x, y) => Math.abs(x - y) < 1e-6
  const addScenario = (e) => {
    e.preventDefault()
    if (!draft.name.trim() || full) return
    const sc = {
      id: Math.random().toString(36).slice(2, 10), name: draft.name.trim(), demand: draft.demand, aht: draft.aht,
      // Left at the current value means "follow the plan", so later changes to the site still apply.
      shrinkage: draft.shrinkage == null || near(draft.shrinkage, s.shrinkage) ? null : draft.shrinkage,
      attrition: draft.attrition == null || near(draft.attrition, attrition) ? null : draft.attrition,
    }
    updateService(active.id, (svc) => ({ scenarios: [...(svc.scenarios ?? []), sc] }))
    setDraft({ name: '', demand: 0, aht: 0, shrinkage: null, attrition: null })
  }
  const edited = own.find((x) => x.id === editing) ?? null
  const setScenarioHires = (id, hires) => updateService(active.id, (svc) => ({ scenarios: (svc.scenarios ?? []).map((x) => (x.id === id ? { ...x, hires } : x)) }))
  const removeScenario = (id) => updateService(active.id, (svc) => ({ scenarios: (svc.scenarios ?? []).filter((x) => x.id !== id) }))
  const signed = (v) => `${v > 0 ? '+' : '−'}${fmtPct(Math.abs(v), 0)}`
  const scenarioDetail = (sc) => (sc.key === 'plan' ? 'Your forecast and assumptions' : [
    sc.demand !== 0 && `Demand ${signed(sc.demand)}`,
    sc.aht && `handle time ${signed(sc.aht)}`,
    sc.custom && !near(sc.shrinkage, s.shrinkage) && `shrinkage ${fmtPct(sc.shrinkage, 0)}`,
    !near(sc.attrition, attrition) && `attrition ${fmtPct(sc.attrition, 1)} a month`,
    sc.ownClasses != null && (sc.ownClasses ? `own hiring plan: ${sc.ownHires} in ${sc.ownClasses} class${sc.ownClasses === 1 ? '' : 'es'}` : 'own hiring plan: no classes'),
  ].filter(Boolean).join(', ').replace(/^[a-z]/, (c) => c.toUpperCase()) || 'Same as the plan')

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

      <Panel title={view === 'gap' ? 'Short or over, week by week' : 'Required against available FTE'} aside={<Segmented label="Chart view" value={view} onChange={setView} options={[{ value: 'gap', label: 'Gap' }, { value: 'lines', label: 'Required vs available' }]} />}>
        {view === 'gap' ? (
          <>
            <Legend items={[{ label: 'Short', color: 'var(--div-n2)', block: true }, { label: 'Over', color: 'var(--div-p2)', block: true }]} />
            <GapChart
              label="Weekly FTE short or over"
              rows={sim.map((w) => ({ x: w.week, value: w.gap, tip: [['Required', fmt1(w.requiredFte)], ['Available', fmt1(w.availableFte)]] }))}
              height={260}
              xFormat={weekLabel}
              valueFormat={fmt1}
            />
          </>
        ) : (
          <>
            <Legend items={[{ label: 'Required', color: 'var(--series-1)' }, { label: 'Available', color: 'var(--series-2)' }]} />
            <LineChart
              rows={sim.map((w) => ({ x: w.week, required: w.requiredFte, available: w.availableFte }))}
              height={280}
              series={[{ key: 'required', label: 'Required', color: 'var(--series-1)' }, { key: 'available', label: 'Available', color: 'var(--series-2)' }]}
              xFormat={weekLabel}
              valueFormat={fmt1}
            />
          </>
        )}
      </Panel>

      <div className="cols">
        <Panel title="Suggested classes" aside={recs.length > 1 && <button className="btn sm" type="button" onClick={() => recs.forEach((r) => addHire(r.week, r.count))}>Accept all</button>}>
          {recs.length === 0 ? (
            <p className="status good"><span className="glyph">▲</span> The plan covers every week a new class could reach.</p>
          ) : (
            <div className="table-wrap">
            <table>
              <thead><tr><th>Starts</th><th>Hires</th><th>Productive from</th><th><span className="sr-only">Actions</span></th></tr></thead>
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
            </div>
          )}
        </Panel>
        <Panel title="Planned classes">
          {active.hires.length === 0 ? (
            <p className="small muted" style={{ marginBottom: 14 }}>None planned yet. Add one, or accept a suggestion.</p>
          ) : (
            <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table>
              <thead><tr><th>Starts</th><th>Hires</th><th><span className="sr-only">Actions</span></th></tr></thead>
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
            </div>
          )}
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 150 }}><SelectField label="Class starts" value={newWeek || weekOpts[0].value} onChange={setNewWeek} options={weekOpts} /></div>
            <div style={{ width: 96 }}><NumberField label="Hires" min={1} value={newCount} onChange={(v) => setNewCount(Math.round(v))} /></div>
            <button className="btn" type="button" onClick={() => addHire(newWeek || weekOpts[0].value, newCount)}>Add</button>
          </div>
        </Panel>
      </div>

      {result.scenarios?.length > 0 && (
        <Panel title="Scenarios" aside={<div style={{ width: 150 }}><NumberField label="Demand swing" pct step={1} min={1} max={50} value={plan.scenarioPct ?? 0.1} onChange={(scenarioPct) => setPlan({ scenarioPct })} /></div>}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Scenario</th><th>Average position</th><th>Worst week</th><th>Weeks short</th><th>Extra hires to close</th><th className="text">First class starts</th><th className="no-print"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {result.scenarios.map((sc) => (
                  <tr key={sc.key} className={sc.key === 'plan' ? 'hl' : ''}>
                    <td style={{ whiteSpace: 'normal' }}><b>{sc.custom ? sc.name : SCENARIO_LABEL[sc.key]}</b><div className="small faint">{scenarioDetail(sc)}</div></td>
                    <td><Gap value={sc.avgGap} unit="" /></td>
                    <td><Gap value={sc.worstGap} unit="" />{sc.worstWeek && <div className="small faint">w/c {formatDate(sc.worstWeek)}</div>}</td>
                    <td>{sc.weeksShort} of {sim.length}</td>
                    <td>{sc.extraHires > 0 ? `${sc.extraHires} in ${sc.classes} class${sc.classes === 1 ? '' : 'es'}` : 'None'}</td>
                    <td className="text">{sc.firstClass ? formatDate(sc.firstClass, { day: 'numeric', month: 'short', year: 'numeric' }) : '–'}</td>
                    <td className="text no-print">{sc.custom && <span className="row" style={{ gap: 14, flexWrap: 'nowrap' }}><button className="btn link" type="button" aria-expanded={editing === sc.id} aria-label={`Hiring plan for ${sc.name}`} onClick={() => setEditing(editing === sc.id ? null : sc.id)}>Classes</button><button className="btn link" type="button" aria-label={`Remove ${sc.name}`} onClick={() => removeScenario(sc.id)}>Remove</button></span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small faint" style={{ marginTop: 10 }}>Each line keeps your planned classes and shows the extra hiring that would close the remaining gaps. Demand cases are re-staffed interval by interval from the scaled forecast. Higher attrition is your site rate plus half. Your own scenarios are saved with this service, and can carry a hiring plan of their own.</p>
          {edited && (
            <div className="scenario-hires no-print">
              <h3>Hiring plan for {edited.name}</h3>
              {edited.hires == null ? (
                <p className="small muted">This scenario follows your planned classes. Give it a hiring plan of its own to compare a different one.</p>
              ) : edited.hires.length === 0 ? (
                <p className="small muted">Its own hiring plan, with no classes yet: the scenario shows the position with no new starters.</p>
              ) : (
                <ul>
                  {edited.hires.map((h) => (
                    <li key={h.week}>{h.count} starting {formatDate(h.week, { day: 'numeric', month: 'short', year: 'numeric' })} <button className="btn link" type="button" aria-label={`Remove the class starting ${formatDate(h.week)}`} onClick={() => setScenarioHires(edited.id, edited.hires.filter((x) => x.week !== h.week))}>Remove</button></li>
                  ))}
                </ul>
              )}
              <div className="row" style={{ alignItems: 'flex-end' }}>
                <div style={{ width: 190 }}><SelectField label="Class starts" id="sc-class-week" value={scWeek || weekOpts[0].value} onChange={setScWeek} options={weekOpts} /></div>
                <div style={{ width: 96 }}><NumberField label="Hires" id="sc-class-count" min={1} value={scCount} onChange={(v) => setScCount(Math.round(v))} /></div>
                <button className="btn sm" type="button" onClick={() => { const week = scWeek || weekOpts[0].value; const rest = (edited.hires ?? []).filter((x) => x.week !== week); setScenarioHires(edited.id, [...rest, { week, count: ((edited.hires ?? []).find((x) => x.week === week)?.count ?? 0) + scCount }].sort((x, y) => (x.week < y.week ? -1 : 1))) }}>Add class</button>
                {edited.hires == null && active.hires.length > 0 && <button className="btn sm" type="button" onClick={() => setScenarioHires(edited.id, active.hires.map((h) => ({ ...h })))}>Start from planned classes</button>}
                {edited.hires != null && <button className="btn sm" type="button" onClick={() => setScenarioHires(edited.id, null)}>Follow planned classes</button>}
              </div>
            </div>
          )}
          <form className="scenario-form no-print" onSubmit={addScenario}>
            <TextField label="Your own scenario" placeholder="Such as: Mortgage launch" value={draft.name} maxLength={60} onChange={(name) => setDraft({ ...draft, name })} />
            <NumberField label="Demand change" id="sc-demand" pct step={1} min={-90} max={200} value={draft.demand} onChange={(demand) => setDraft({ ...draft, demand })} />
            <NumberField label="Handle time change" id="sc-aht" pct step={1} min={-90} max={200} value={draft.aht} onChange={(aht) => setDraft({ ...draft, aht })} />
            <NumberField label="Shrinkage in this case" id="sc-shrink" pct step={1} min={0} max={90} value={draft.shrinkage ?? s.shrinkage} onChange={(shrinkage) => setDraft({ ...draft, shrinkage })} />
            <NumberField label="Attrition in this case" id="sc-att" pct step={0.1} min={0} max={50} value={draft.attrition ?? attrition} onChange={(v) => setDraft({ ...draft, attrition: v })} />
            <button className="btn" type="submit" disabled={!draft.name.trim() || full}>Save scenario</button>
          </form>
          {full && <p className="small faint no-print">Up to {MAX_SCENARIOS} of your own scenarios for each service. Remove one to add another.</p>}
        </Panel>
      )}

      <div className="cols">
        <Panel title="Supply assumptions" aside={<button className="btn link" type="button" onClick={() => setC({ startHeadcount: Math.round(sim[0].requiredFte * 2) / 2 })}>Match next week's need</button>}>
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

      <Panel title="Week by week">
        <div className="table-wrap scroll-y" tabIndex={0} role="region" aria-label="Week by week">
          <table>
            <thead><tr><th>Week of</th><th>Volume</th><th><Term k="aht">AHT</Term></th><th>Required</th><th>Available</th><th>Headcount</th><th>In training</th><th>Gap</th></tr></thead>
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
