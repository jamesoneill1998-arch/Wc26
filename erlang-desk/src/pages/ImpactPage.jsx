import { useMemo, useState } from 'react'
import { CHANNELS, siteShrinkage } from '../engine/channels.js'
import { areaPlan, assessChange, summaryText, monthLabel, addMonths, hoursPerFteMonth } from '../engine/impact.js'
import { toCSV } from '../engine/csv.js'
import { newArea, newChange, defaultDriver, thisMonth, CHANGE_STATUSES } from '../state/store.js'
import { buildSampleWorkspace } from '../state/sample.js'
import { PageHead, Figures, Figure, Panel, Segmented, NumberField, SelectField, TextField, ConfirmButton, Gap } from '../components/ui.jsx'
import { LineChart, Legend, StackedColumns } from '../components/charts.jsx'
import { CURRENCY } from '../config.js'
import { downloadText, fmtInt, fmt1, fmtPct } from '../format.js'

const VERDICTS = {
  absorbable: { label: 'Absorbable', glyph: '✓', tone: 'ok', line: 'Fits within operational FTE after committed changes and the buffer.' },
  overtime: { label: 'Absorbable with overtime', glyph: '!', tone: 'warn', line: 'Exceeds headroom, but within the overtime allowance.' },
  short: { label: 'Not absorbable', glyph: '✕', tone: 'bad', line: 'Needs extra resource beyond headroom and overtime.' },
  saving: { label: 'Releases capacity', glyph: '↓', tone: 'ok', line: 'Reduces workload; once approved it adds headroom for other changes.' },
  inMtp: { label: 'In MTP', glyph: '–', tone: 'neutral', line: 'Already in the medium-term plan forecast, so no incremental impact.' },
  none: { label: 'No impact', glyph: '–', tone: 'neutral', line: 'No resourcing effect inside the plan period.' },
  unknown: { label: 'Can’t assess', glyph: '?', tone: 'warn', line: 'Enter operational FTE for the affected months.' },
}
const STATUS_LABEL = { proposed: 'Proposed', approved: 'Approved', live: 'Live', rejected: 'Rejected' }
const DRIVER_LABEL = { acquisitions: 'New business volumes', volume: 'Volume change', aht: 'Handle-time change', abstraction: 'Training or abstraction' }

function Verdict({ v }) {
  const d = VERDICTS[v] ?? VERDICTS.none
  return <span className={`verdict ${d.tone}`}><span aria-hidden="true">{d.glyph}</span> {d.label}</span>
}

export function driverSummary(d) {
  const span = `${d.months} month${d.months === 1 ? '' : 's'} from ${monthLabel(d.startMonth)}`
  if (d.type === 'acquisitions') return `${fmtInt(d.total)} ${d.unitLabel || 'units'} × ${d.contactsPerUnit} contacts, ${span}`
  if (d.type === 'volume') return `${d.mode === 'pct' ? `${d.value >= 0 ? '+' : '−'}${fmtPct(Math.abs(d.value), 1)} volume` : `${d.value >= 0 ? '+' : '−'}${fmtInt(Math.abs(d.value))} contacts a month`}, ${span}`
  if (d.type === 'aht') return `${d.deltaSec >= 0 ? '+' : '−'}${Math.abs(d.deltaSec)}s AHT on ${fmtPct(d.share, 0)} of contacts, ${span}`
  return `${fmtInt(d.people)} people × ${d.hoursPerPerson}h a month, ${span}`
}

/** A numeric cell that accepts a pasted Excel column and fills down. */
function GridInput({ value, onChange, onPasteColumn, label, step = 1, allowEmpty = false }) {
  return (
    <input
      type="number" inputMode="decimal" aria-label={label} step={step} min="0"
      value={value ?? ''}
      onChange={(e) => {
        if (e.target.value === '') return onChange(allowEmpty ? null : 0)
        const n = Number(e.target.value)
        if (Number.isFinite(n) && n >= 0) onChange(n)
      }}
      onPaste={(e) => {
        const text = e.clipboardData.getData('text')
        const cells = text.split(/\r?\n/).map((l) => l.split('\t')[0].trim()).filter((c) => c !== '')
        if (cells.length > 1) {
          e.preventDefault()
          onPasteColumn(cells.map((c) => Number(c.replace(/[,£\s]/g, ''))).map((n) => (Number.isFinite(n) && n >= 0 ? n : null)))
        }
      }}
    />
  )
}

function monthsFromService(result, startMonth, count) {
  if (!result?.dayReqs?.length) return null
  const vol = new Map()
  const work = new Map()
  const days = new Map()
  for (const d of result.dayReqs) {
    const ym = d.date.slice(0, 7)
    vol.set(ym, (vol.get(ym) ?? 0) + d.volume)
    work.set(ym, (work.get(ym) ?? 0) + d.workloadHours)
    days.set(ym, (days.get(ym) ?? 0) + 1)
  }
  const fte = new Map()
  for (const w of result.sim ?? []) {
    const ym = w.week.slice(0, 7)
    const cur = fte.get(ym) ?? []
    cur.push(w.availableFte)
    fte.set(ym, cur)
  }
  return Array.from({ length: count }, (_, i) => {
    const ym = addMonths(startMonth, i)
    if (!days.has(ym)) return null
    const [y, m] = ym.split('-').map(Number)
    const inMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const scale = inMonth / days.get(ym) // part-covered months scaled up to a full month
    const v = vol.get(ym) * scale
    const f = fte.get(ym)
    return { volume: Math.round(v), aht: v > 0 ? Math.round((work.get(ym) * scale * 3600) / v) : null, operationalFte: f ? Math.round((f.reduce((t, x) => t + x, 0) / f.length) * 10) / 10 : null }
  })
}

function AggregatePlan({ ws, area, site, ctx, plan, setArea, update, model }) {
  const [svcId, setSvcId] = useState(ws.services[0]?.id ?? '')
  const [msg, setMsg] = useState(null)
  const setRow = (i, patch) => setArea({ rows: area.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  const pasteCol = (i, key) => (vals) => setArea({ rows: area.rows.map((r, j) => (j >= i && j - i < vals.length && vals[j - i] != null ? { ...r, [key]: vals[j - i] } : r)) })
  const st = area.settings
  const setS = (patch) => setArea({ settings: { ...st, ...patch } })
  const hasMtp = plan.some((m) => m.mtpFte != null)
  const withOps = plan.filter((m) => m.operationalFte != null)
  const tightest = withOps.length ? withOps.reduce((a, b) => (b.headroom < a.headroom ? b : a)) : null
  const live = area.channel !== 'backoffice'

  const fill = () => {
    const rows = monthsFromService(model.services[svcId], area.startMonth, area.rows.length)
    if (!rows || !rows.some(Boolean)) return setMsg('That service has no forecast in these months.')
    setArea({ rows: area.rows.map((r, i) => { if (!rows[i]) return r; return { ...r, volume: rows[i].volume, aht: rows[i].aht ?? r.aht, operationalFte: rows[i].operationalFte ?? r.operationalFte } }) })
    setMsg(`Filled ${rows.filter(Boolean).length} months of volume, AHT and available FTE from the service's forecast and capacity plan.`)
  }

  return (
    <div className="stack">
      <Figures>
        <Figure hero label="Required FTE, average" value={fmt1(plan.reduce((t, m) => t + m.requiredFte, 0) / plan.length)} sub={`${fmtInt(plan.reduce((t, m) => t + m.volume, 0))} contacts over ${plan.length} months`} />
        <Figure label="Operational FTE, average" value={withOps.length ? fmt1(withOps.reduce((t, m) => t + m.operationalFte, 0) / withOps.length) : '–'} sub={withOps.length < plan.length ? `${plan.length - withOps.length} months not entered` : 'All months entered'} />
        <Figure label="Tightest month" value={tightest ? <Gap value={tightest.headroom} /> : '–'} sub={tightest ? `${monthLabel(tightest.month, true)} headroom` : 'Enter operational FTE'} />
        <Figure label="Months below need" value={`${withOps.filter((m) => m.headroom < -0.05).length} of ${plan.length}`} sub="Before any change" />
      </Figures>

      <Panel title="Required against operational FTE" aside={`${fmtPct(ctx.shrinkage, 0)} shrinkage · ${ctx.weeklyHours}h week · ${fmt1(hoursPerFteMonth(ctx.weeklyHours))} paid hours per FTE-month`}>
        <Legend items={[{ label: 'Required', color: 'var(--series-1)' }, { label: 'Operational', color: 'var(--series-2)' }, ...(hasMtp ? [{ label: 'MTP', color: 'var(--series-3)' }] : [])]} />
        <LineChart
          rows={plan.map((m) => ({ x: m.month, required: m.requiredFte, operational: m.operationalFte, mtp: m.mtpFte }))}
          series={[{ key: 'required', label: 'Required', color: 'var(--series-1)' }, { key: 'operational', label: 'Operational', color: 'var(--series-2)' }, ...(hasMtp ? [{ key: 'mtp', label: 'MTP', color: 'var(--series-3)' }] : [])]}
          xFormat={(m, long) => monthLabel(m, long)}
          valueFormat={fmt1}
          height={260}
        />
      </Panel>

      <Panel title="Monthly plan" aside="Type, or paste a column from Excel into the first cell">
        <div className="table-wrap">
          <table className="grid-table">
            <thead><tr><th>Month</th><th>Forecast volume</th><th>AHT (s)</th><th>Workload h</th><th>{live ? 'Occupancy' : 'Utilisation'}</th><th>Required FTE</th><th>Operational FTE</th><th>MTP FTE</th><th>Headroom</th></tr></thead>
            <tbody>
              {plan.map((m, i) => (
                <tr key={m.month}>
                  <td>{monthLabel(m.month)}</td>
                  <td><GridInput label={`${monthLabel(m.month)} volume`} value={area.rows[i].volume} onChange={(v) => setRow(i, { volume: v })} onPasteColumn={pasteCol(i, 'volume')} /></td>
                  <td><GridInput label={`${monthLabel(m.month)} AHT`} value={area.rows[i].aht} onChange={(v) => setRow(i, { aht: v })} onPasteColumn={pasteCol(i, 'aht')} /></td>
                  <td>{fmtInt(m.workloadHours)}</td>
                  <td>{m.occupancy == null ? '–' : fmtPct(m.occupancy, 0)}</td>
                  <td>{fmt1(m.requiredFte)}</td>
                  <td><GridInput label={`${monthLabel(m.month)} operational FTE`} step={0.1} allowEmpty value={area.rows[i].operationalFte} onChange={(v) => setRow(i, { operationalFte: v })} onPasteColumn={pasteCol(i, 'operationalFte')} /></td>
                  <td><GridInput label={`${monthLabel(m.month)} MTP FTE`} step={0.1} allowEmpty value={area.rows[i].mtpFte} onChange={(v) => setRow(i, { mtpFte: v })} onPasteColumn={pasteCol(i, 'mtpFte')} /></td>
                  <td>{m.headroom == null ? '–' : <Gap value={m.headroom} unit="" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ws.services.length > 0 && (
          <div className="row" style={{ marginTop: 16, alignItems: 'flex-end' }}>
            <div style={{ minWidth: 260 }}>
              <SelectField label="Fill from a service's forecast" value={svcId} onChange={setSvcId} options={ws.services.map((s) => ({ value: s.id, label: `${s.name} · ${CHANNELS[s.channel].label}` }))} />
            </div>
            <button className="btn" type="button" onClick={fill}>Fill months</button>
            {msg && <span className="small muted" role="status">{msg}</span>}
          </div>
        )}
      </Panel>

      <Panel title="Assumptions">
        <div className="fields">
          <TextField label="Area name" value={area.name} onChange={(name) => setArea({ name })} />
          <SelectField label="Channel" value={area.channel} onChange={(channel) => setArea({ channel })} options={Object.entries(CHANNELS).map(([value, c]) => ({ value, label: c.label }))} />
          <SelectField label="Site" value={area.siteId} onChange={(siteId) => setArea({ siteId })} options={ws.sites.map((s) => ({ value: s.id, label: s.name }))} hint={`${fmtPct(siteShrinkage(site), 0)} shrinkage, ${site?.fteHoursPerWeek}h week`} />
          <div className="field">
            <label htmlFor="area-start">First month</label>
            <input id="area-start" type="month" value={area.startMonth} onChange={(e) => /^\d{4}-\d{2}$/.test(e.target.value) && setArea({ startMonth: e.target.value })} />
          </div>
          <SelectField label="Months" value={String(area.rows.length)} onChange={(v) => {
            const n = Number(v)
            setArea({ rows: n <= area.rows.length ? area.rows.slice(0, n) : [...area.rows, ...Array.from({ length: n - area.rows.length }, () => ({ ...area.rows[area.rows.length - 1], operationalFte: null, mtpFte: null }))] })
          }} options={[12, 18, 24, 36].map((n) => ({ value: String(n), label: `${n} months` }))} />
          {live && <SelectField label="Occupancy method" value={st.occupancyMode} onChange={(occupancyMode) => setS({ occupancyMode })} options={[{ value: 'manual', label: 'Planning assumption' }, { value: 'erlang', label: 'Erlang at the service target' }]} />}
          {(!live || st.occupancyMode === 'manual') && <NumberField label={live ? 'Occupancy' : 'Utilisation'} pct min={20} max={100} value={st.occupancy} onChange={(occupancy) => setS({ occupancy })} />}
          {live && st.occupancyMode === 'erlang' && (
            <>
              <NumberField label="Service level goal" pct min={1} max={99.9} value={st.slTarget} onChange={(slTarget) => setS({ slTarget })} />
              <NumberField label="Answered within" suffix="sec" min={0} max={7200} value={st.targetSec} onChange={(targetSec) => setS({ targetSec })} />
              <NumberField label="Open hours" suffix="per week" min={1} max={168} value={st.openHoursPerWeek} onChange={(openHoursPerWeek) => setS({ openHoursPerWeek })} />
              <NumberField label="Intraday peak factor" min={1} max={3} step={0.05} value={st.peakFactor} onChange={(peakFactor) => setS({ peakFactor })} hint="Average load understates peaks; 1.2 is typical" />
              <NumberField label="Maximum occupancy" pct min={20} max={100} value={st.maxOccupancy} onChange={(maxOccupancy) => setS({ maxOccupancy })} />
            </>
          )}
          <NumberField label="Shrinkage" pct min={0} max={90} value={ctx.shrinkage} onChange={(shrinkageOverride) => setS({ shrinkageOverride })} hint={st.shrinkageOverride == null ? `${site?.name} default` : <button className="btn link small" type="button" onClick={() => setS({ shrinkageOverride: null })}>Use site default</button>} />
          <NumberField label="Buffer to keep" pct min={0} max={50} step={0.5} value={st.bufferPct} onChange={(bufferPct) => setS({ bufferPct })} hint="Headroom held back from changes" />
          <NumberField label="Overtime allowance" pct min={0} max={50} step={0.5} value={st.overtimePct} onChange={(overtimePct) => setS({ overtimePct })} hint="Of operational FTE" />
          <NumberField label="Hiring lead time" suffix="weeks" min={0} max={104} value={st.leadTimeWeeks} onChange={(leadTimeWeeks) => setS({ leadTimeWeeks })} hint="Recruit, train and nest" />
          <NumberField label={`Cost per FTE (${CURRENCY} a year)`} min={0} max={1e7} step={500} value={st.costPerFte} onChange={(costPerFte) => setS({ costPerFte })} />
        </div>
        <div className="row" style={{ marginTop: 18 }}>
          <ConfirmButton className="btn sm" confirmLabel={`Click again to delete ${area.name} and its changes`} onConfirm={() => update((cur) => {
            const areas = cur.areas.filter((x) => x.id !== area.id)
            return { areas, changes: cur.changes.filter((c) => c.areaId !== area.id), activeAreaId: areas[0]?.id ?? null }
          })}>Delete area</ConfirmButton>
        </div>
      </Panel>
    </div>
  )
}

function DriverFields({ driver, setDriver, weeklyHours }) {
  const d = driver
  const set = (patch) => setDriver({ ...d, ...patch })
  const monthField = (
    <div className="field">
      <label htmlFor="drv-start">Starts</label>
      <input id="drv-start" type="month" value={d.startMonth} onChange={(e) => /^\d{4}-\d{2}$/.test(e.target.value) && set({ startMonth: e.target.value })} />
    </div>
  )
  const months = <NumberField label="For" suffix="months" min={1} max={60} value={d.months} onChange={(v) => set({ months: Math.round(v) })} />
  if (d.type === 'acquisitions') {
    const curveSum = d.curve.reduce((t, v) => t + v, 0) || 1
    return (
      <>
        <div className="fields">
          <NumberField label={`Total ${d.unitLabel || 'units'}`} min={0} max={1e8} step={100} value={d.total} onChange={(total) => set({ total })} />
          <TextField label="Called" value={d.unitLabel} maxLength={40} onChange={(unitLabel) => set({ unitLabel })} />
          {monthField}
          <NumberField label="Arriving over" suffix="months" min={1} max={60} value={d.months} onChange={(v) => set({ months: Math.round(v) })} />
          <SelectField label="Arrival profile" value={d.profile} onChange={(profile) => set({ profile })} options={[{ value: 'flat', label: 'Even' }, { value: 'ramp', label: 'Ramping up' }, { value: 'front', label: 'Front-loaded' }]} />
          <NumberField label={`Contacts per ${(d.unitLabel || 'unit').replace(/s$/, '')}`} min={0} max={100} step={0.1} value={d.contactsPerUnit} onChange={(contactsPerUnit) => set({ contactsPerUnit })} />
          <NumberField label="AHT of these contacts" suffix="sec" min={1} max={86400} value={d.aht} onChange={(aht) => set({ aht })} />
        </div>
        <div style={{ marginTop: 16 }}>
          <div className="field"><label>When the contacts happen, by month after each {(d.unitLabel || 'unit').replace(/s$/, '')} (%)</label></div>
          <div className="row" style={{ marginTop: 6 }}>
            {d.curve.map((v, i) => (
              <div key={i} className="field" style={{ width: 92 }}>
                <label htmlFor={`curve-${i}`} className="small faint">{i === 0 ? 'Same month' : `+${i}`}</label>
                <input id={`curve-${i}`} type="number" min="0" max="100" value={Math.round((v / curveSum) * 1000) / 10} onChange={(e) => set({ curve: d.curve.map((x, j) => (j === i ? Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100 : x / curveSum)) })} />
              </div>
            ))}
            {d.curve.length < 12 && <button className="btn sm" type="button" onClick={() => set({ curve: [...d.curve, 0] })} style={{ alignSelf: 'flex-end' }}>Add month</button>}
            {d.curve.length > 1 && <button className="btn link small" type="button" onClick={() => set({ curve: d.curve.slice(0, -1) })} style={{ alignSelf: 'flex-end' }}>Remove last</button>}
          </div>
          <p className="small faint" style={{ marginTop: 8 }}>{fmtInt(d.total * d.contactsPerUnit)} contacts in total. Shares are normalised to 100%.</p>
        </div>
      </>
    )
  }
  if (d.type === 'volume') {
    return (
      <div className="fields">
        {monthField}{months}
        <SelectField label="Change as" value={d.mode} onChange={(mode) => set({ mode, value: mode === 'pct' ? 0.05 : 1000 })} options={[{ value: 'pct', label: '% of forecast volume' }, { value: 'abs', label: 'Contacts per month' }]} />
        {d.mode === 'pct'
          ? <NumberField label="Volume change" pct min={-100} max={500} step={0.5} value={d.value} onChange={(value) => set({ value })} hint="Negative for a reduction" />
          : <NumberField label="Contacts per month" min={-1e7} max={1e7} step={100} value={d.value} onChange={(value) => set({ value })} hint="Negative for a reduction" />}
        {d.mode === 'abs' && <NumberField label="AHT of these contacts" suffix="sec" min={1} max={86400} value={d.aht} onChange={(aht) => set({ aht })} />}
      </div>
    )
  }
  if (d.type === 'aht') {
    return (
      <div className="fields">
        {monthField}{months}
        <NumberField label="AHT change" suffix="sec" min={-3600} max={3600} value={d.deltaSec} onChange={(deltaSec) => set({ deltaSec })} hint="Negative for a saving" />
        <NumberField label="Share of contacts affected" pct min={0} max={100} value={d.share} onChange={(share) => set({ share })} />
      </div>
    )
  }
  return (
    <div className="fields">
      {monthField}{months}
      <NumberField label="People" min={0} max={100000} value={d.people} onChange={(people) => set({ people })} />
      <NumberField label="Hours each, per month" min={0} max={744} step={0.5} value={d.hoursPerPerson} onChange={(hoursPerPerson) => set({ hoursPerPerson })} hint={`${fmt1((d.people * d.hoursPerPerson) / hoursPerFteMonth(weeklyHours))} FTE-months of paid time`} />
    </div>
  )
}

function ChangeRegister({ ws, area, ctx, update, account }) {
  const changes = ws.changes.filter((c) => c.areaId === area.id)
  const [selId, setSelId] = useState(changes[0]?.id ?? null)
  const [copied, setCopied] = useState(null)
  const results = useMemo(() => Object.fromEntries(changes.map((c) => [c.id, assessChange(c, area, ws.changes, ctx)])), [changes, area, ws.changes, ctx])
  const sel = changes.find((c) => c.id === selId) ?? changes[0]
  const setChange = (patch) => update((cur) => ({ changes: cur.changes.map((c) => (c.id === sel.id ? { ...c, ...patch } : c)) }))
  const add = () => {
    const c = newChange({ name: 'New change', areaId: area.id, startMonth: addMonths(area.startMonth, 1) })
    update((cur) => ({ changes: [...cur.changes, c] }))
    setSelId(c.id)
  }
  if (!changes.length) {
    return (
      <div className="panel empty">
        <h2>No changes logged for {area.name}</h2>
        <p>Log a project, campaign, migration or training plan, and see whether the area can absorb it.</p>
        <button className="btn primary" type="button" onClick={add}>Add a change</button>
      </div>
    )
  }
  const r = results[sel.id]
  const v = VERDICTS[r.verdict]
  const late = r.hireBy && r.hireBy < thisMonth()
  const text = summaryText(sel, area, r, { currency: CURRENCY, nowMonth: thisMonth() })
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied('Copied. Paste it into your change paper or email.')
    } catch {
      setCopied('select')
    }
  }
  const exportCsv = () => downloadText(`impact-${sel.name}.csv`, toCSV([
    { label: 'month', get: (m) => m.month },
    { label: 'incremental_contacts', get: (m) => Math.round(m.contacts) },
    { label: 'incremental_workload_hours', get: (m) => m.workloadHours.toFixed(1) },
    { label: 'abstraction_hours', get: (m) => m.abstractionHours.toFixed(1) },
    { label: 'baseline_required_fte', get: (m) => m.baseFte.toFixed(2) },
    { label: 'committed_required_fte', get: (m) => m.committedFte.toFixed(2) },
    { label: 'incremental_fte', get: (m) => m.incrementalFte.toFixed(2) },
    { label: 'operational_fte', get: (m) => (m.operationalFte ?? '') },
    { label: 'headroom_before_fte', get: (m) => (m.headroom == null ? '' : m.headroom.toFixed(2)) },
    { label: 'shortfall_fte', get: (m) => (m.shortfall == null ? '' : m.shortfall.toFixed(2)) },
    { label: 'status', get: (m) => m.status },
  ], r.rows))

  return (
    <div className="stack">
      <Panel title="Change register" aside={<button className="btn sm primary" type="button" onClick={add}>Add a change</button>}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Change</th><th>Driver</th><th>Status</th><th>Peak FTE</th><th>Assessment</th></tr></thead>
            <tbody>
              {changes.map((c) => {
                const cr = results[c.id]
                return (
                  <tr key={c.id} className={c.id === sel.id ? 'hl' : ''} onClick={() => setSelId(c.id)} style={{ cursor: 'pointer' }}>
                    <td><button className="btn link" type="button" onClick={() => setSelId(c.id)}>{c.name}</button>{c.inMtp && <span className="faint"> · in MTP</span>}</td>
                    <td className="faint" style={{ whiteSpace: 'normal', minWidth: 220 }}>{driverSummary(c.driver)}</td>
                    <td>{STATUS_LABEL[c.status]}</td>
                    <td>{cr.verdict === 'saving' ? `−${fmt1(cr.savingFte)}` : fmt1(cr.peakFte)}</td>
                    <td><Verdict v={cr.verdict} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="small faint" style={{ marginTop: 10 }}>Each change is assessed after approved and live changes that aren't in the MTP. Rejected changes and proposals don't consume headroom.</p>
      </Panel>

      <Figures>
        <Figure hero text label="Assessment" value={<span><span aria-hidden="true">{v.glyph}</span> {v.label}</span>} sub={v.line} />
        <Figure label={r.verdict === 'saving' ? 'Capacity released' : 'Peak incremental FTE'} value={r.verdict === 'saving' ? fmt1(r.savingFte) : fmt1(r.peakFte)} sub={r.peakMonth ? monthLabel(r.peakMonth, true) : `${fmt1(r.fteMonths)} FTE-months in total`} />
        <Figure label="Shortfall" value={r.peakShortfall > 0.05 ? fmt1(r.peakShortfall) : '0.0'} sub={r.peakShortfall > 0.05 ? `${r.monthsShort} month${r.monthsShort === 1 ? '' : 's'} short, ${r.monthsOvertime} on overtime` : 'Within headroom'} />
        <Figure label="Incremental cost" value={`${CURRENCY}${fmtInt(r.cost)}`} sub={`${fmt1(r.fteMonths)} FTE-months at ${CURRENCY}${fmtInt(area.settings.costPerFte)} a year`} />
      </Figures>

      {(r.verdict === 'short' || r.verdict === 'overtime') && (
        <div className="notice">
          {r.hireBy && (late
            ? <><b>Recruit {r.hireCount} FTE now.</b> The {area.settings.leadTimeWeeks}-week lead time already runs past {monthLabel(r.firstShort, true)}, so cover the gap with overtime, temporary staff or by moving work. </>
            : <><b>Start recruiting {r.hireCount} FTE by {monthLabel(r.hireBy, true)}</b> to be productive for {monthLabel(r.firstShort, true)}. </>)}
          {Number.isFinite(r.worstSl) && <>Unmitigated, service level falls to about <b>{fmtPct(r.worstSl, 0)}</b> against the {fmtPct(area.settings.slTarget, 0)} target in the worst month.</>}
        </div>
      )}

      <Panel title={`${sel.name}: FTE by month`} aside={`${fmtInt(r.totalContacts)} contacts${r.beyondPlan > 0.5 ? ` (+${fmtInt(r.beyondPlan)} after the plan period)` : ''}`}>
        <Legend items={[{ label: 'Required before this change', color: 'var(--series-1)', block: true }, { label: 'This change', color: 'var(--series-2)', block: true }, { label: 'Operational FTE', color: 'var(--ink)' }]} />
        <StackedColumns
          rows={r.rows.map((m) => ({ x: m.month, before: m.committedFte, change: Math.max(0, m.incrementalFte), operational: m.operationalFte }))}
          series={[{ key: 'before', label: 'Required before', color: 'var(--series-1)' }, { key: 'change', label: 'This change', color: 'var(--series-2)' }]}
          line={{ key: 'operational', label: 'Operational FTE', color: 'var(--ink)' }}
          xFormat={(m, long) => monthLabel(m, long)}
          valueFormat={fmt1}
          height={260}
        />
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead><tr><th>Month</th><th>Contacts</th><th>Workload h</th><th>Incremental FTE</th><th>Headroom before</th><th>After</th><th>Service level</th><th>Status</th></tr></thead>
            <tbody>
              {r.rows.map((m) => (
                <tr key={m.month} style={{ opacity: Math.abs(m.incrementalFte) > 0.05 ? 1 : 0.55 }}>
                  <td>{monthLabel(m.month)}</td>
                  <td>{fmtInt(m.contacts)}</td>
                  <td>{fmtInt(m.workloadHours + m.abstractionHours)}</td>
                  <td>{fmt1(m.incrementalFte)}</td>
                  <td>{m.headroom == null ? '–' : <Gap value={m.headroom} unit="" />}</td>
                  <td>{m.headroom == null ? '–' : <Gap value={m.headroom - m.incrementalFte} unit="" />}</td>
                  <td>{m.slBefore == null ? '–' : `${fmtPct(m.slBefore, 0)} → ${fmtPct(m.slAfter, 0)}`}</td>
                  <td>{m.status === 'none' ? '' : <Verdict v={m.status === 'short' ? 'short' : m.status} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Change details" aside={
        <div className="row">
          <button className="btn sm" type="button" onClick={copy}>Copy summary</button>
          {account.entitled && <button className="btn sm" type="button" onClick={exportCsv}>Export CSV</button>}
          <ConfirmButton className="btn sm" confirmLabel="Click again to delete" onConfirm={() => update((cur) => ({ changes: cur.changes.filter((c) => c.id !== sel.id) }))}>Delete</ConfirmButton>
        </div>
      }>
        {copied && copied !== 'select' && <p className="small muted" role="status" style={{ marginBottom: 12 }}>{copied}</p>}
        {copied === 'select' && (
          <div className="field" style={{ marginBottom: 14 }}>
            <label htmlFor="summary-text">Copy this summary</label>
            <textarea id="summary-text" readOnly rows={10} value={text} onFocus={(e) => e.target.select()} autoFocus />
          </div>
        )}
        <div className="fields">
          <TextField label="Name" value={sel.name} maxLength={100} onChange={(name) => setChange({ name })} />
          <TextField label="Owner" value={sel.owner} maxLength={80} onChange={(owner) => setChange({ owner })} />
          <SelectField label="Status" value={sel.status} onChange={(status) => setChange({ status })} options={CHANGE_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
          <SelectField label="Driver" value={sel.driver.type} onChange={(type) => setChange({ driver: defaultDriver(type, sel.driver.startMonth) })} options={Object.entries(DRIVER_LABEL).map(([value, label]) => ({ value, label }))} />
          <div className="field">
            <label htmlFor="in-mtp">Medium-term plan</label>
            <label className="row small" style={{ gap: 8, minHeight: 38 }}>
              <input id="in-mtp" type="checkbox" checked={sel.inMtp} onChange={(e) => setChange({ inMtp: e.target.checked })} />
              Already in the MTP forecast
            </label>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <DriverFields driver={sel.driver} setDriver={(driver) => setChange({ driver })} weeklyHours={ctx.weeklyHours} />
        </div>
        <div className="field" style={{ marginTop: 18 }}>
          <label htmlFor="change-notes">Notes and assumptions</label>
          <textarea id="change-notes" rows={3} maxLength={1000} value={sel.notes} onChange={(e) => setChange({ notes: e.target.value })} />
        </div>
      </Panel>
    </div>
  )
}

export default function ImpactPage({ ws, update, replace, model, account, query }) {
  const [tab, setTab] = useState(query?.get('tab') === 'plan' ? 'plan' : 'changes')
  const area = ws.areas.find((a) => a.id === ws.activeAreaId) ?? ws.areas[0]
  const site = ws.sites.find((s) => s.id === area?.siteId) ?? ws.sites[0]
  const ctx = useMemo(() => ({ shrinkage: area?.settings.shrinkageOverride ?? siteShrinkage(site), weeklyHours: site?.fteHoursPerWeek ?? 37.5 }), [area, site])
  const plan = useMemo(() => (area ? areaPlan(area, ctx) : []), [area, ctx])
  const setArea = (patch) => update((cur) => ({ areas: cur.areas.map((a) => (a.id === area.id ? { ...a, ...patch } : a)) }))
  const addArea = () => {
    const a = newArea({ name: `Area ${ws.areas.length + 1}`, siteId: ws.sites[0]?.id })
    update((cur) => ({ areas: [...cur.areas, a], activeAreaId: a.id }))
    setTab('plan')
  }

  const head = (
    <PageHead eyebrow="Change delivery" title="Impact assessment" lede="Convert change assumptions into contacts and FTE, and test them against each area's operational capacity before they reach the change board.">
      {area && (
        <div className="field" style={{ minWidth: 200 }}>
          <label htmlFor="area-pick">Area</label>
          <select id="area-pick" value={area.id} onChange={(e) => update({ activeAreaId: e.target.value })}>
            {ws.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}
      <button className="btn" type="button" onClick={addArea} style={{ alignSelf: 'flex-end' }} disabled={ws.areas.length >= 30}>Add an area</button>
    </PageHead>
  )

  if (!area) {
    return (
      <div className="stack">
        {head}
        <div className="panel empty">
          <h2>No areas yet</h2>
          <p>An area is a business line or team planned at monthly level, such as Mortgages or Savings. Add its forecast and operational FTE, then log the changes coming its way.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn primary" type="button" onClick={addArea}>Add an area</button>
            {!ws.services.length && <button className="btn" type="button" onClick={() => replace(buildSampleWorkspace())}>Load the sample operation</button>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="stack">
      {head}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Segmented label="View" value={tab} onChange={setTab} options={[{ value: 'changes', label: 'Impact assessments' }, { value: 'plan', label: 'Aggregate plan' }]} />
        <span className="small muted">{area.name} · {CHANNELS[area.channel].label} · {site?.name} · {monthLabel(area.startMonth)} to {monthLabel(addMonths(area.startMonth, area.rows.length - 1))}</span>
      </div>
      {tab === 'plan'
        ? <AggregatePlan ws={ws} area={area} site={site} ctx={ctx} plan={plan} setArea={setArea} update={update} model={model} />
        : <ChangeRegister key={area.id} ws={ws} area={area} ctx={ctx} update={update} account={account} />}
    </div>
  )
}

