import { useMemo, useRef, useState } from 'react'
import { formatDate, formatTime, WEEKDAYS, weekdayIndex, parseTime } from '../engine/dates.js'
import { CHANNELS } from '../engine/channels.js'
import { coverageForDays, defaultInDayShrinkage, parseScheduleCSV, suggestPatterns, suggestDailyPatterns } from '../engine/schedule.js'
import { emptySchedule } from '../state/store.js'
import { PageHead, Figures, Figure, Panel, Segmented, NumberField, Locked, ConfirmButton, Gap, LoadingPage, TimeSelect } from '../components/ui.jsx'
import { Heatmap, LineChart, Legend } from '../components/charts.jsx'
import { fmtInt, fmt1, fmtPct } from '../format.js'
import { NoServices, NeedsHistory, serviceEyebrow } from './common.jsx'

const MODES = [
  { value: 'gap', label: 'Short / over' },
  { value: 'required', label: 'Required' },
  { value: 'available', label: 'Rostered' },
  { value: 'sl', label: 'Service level' },
]

function shiftMinutes(p) {
  const s = parseTime(p.start)
  let e = parseTime(p.end)
  if (s == null || e == null) return 0
  if (e <= s) e += 1440
  return e - s - (p.breakMin || 0)
}

function RosterEditor({ schedule, setSchedule, onSuggest, intervalMin }) {
  const patterns = schedule.patterns
  const setPattern = (id, patch) => setSchedule({ patterns: patterns.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  const totals = WEEKDAYS.map((_, wd) => patterns.reduce((t, p) => t + (p.counts[wd] || 0), 0))
  const weeklyHours = patterns.reduce((t, p) => t + (shiftMinutes(p) / 60) * p.counts.reduce((a, b) => a + b, 0), 0)
  return (
    <Panel
      title="Shift patterns"
      aside={patterns.length
        ? <ConfirmButton className="btn sm" confirmLabel="Click again to replace these shifts" onConfirm={onSuggest}>Suggest shifts from requirement</ConfirmButton>
        : <button className="btn sm primary" type="button" onClick={onSuggest}>Suggest shifts from requirement</button>}
    >
      <p className="small muted" style={{ marginBottom: 14 }}>
        People on each shift, by day. Applied to every week; dates with an imported schedule use that instead. Breaks are unpaid and assumed staggered across the middle of the shift.
      </p>
      <div className="table-wrap">
        <table className="roster">
          <thead>
            <tr><th>Start</th><th>End</th><th>Break (min)</th>{WEEKDAYS.map((d) => <th key={d}>{d}</th>)}<th>Paid h / wk</th><th /></tr>
          </thead>
          <tbody>
            {patterns.map((p) => (
              <tr key={p.id}>
                <td><TimeSelect label="Shift start" step={intervalMin} value={p.start} onChange={(v) => setPattern(p.id, { start: v })} /></td>
                <td><TimeSelect label="Shift end" step={intervalMin} allowMidnightEnd value={p.end} onChange={(v) => setPattern(p.id, { end: v })} /></td>
                <td><input type="number" aria-label="Break minutes" min="0" max="240" step="5" value={p.breakMin} onChange={(e) => setPattern(p.id, { breakMin: Math.max(0, Math.min(240, Math.round(Number(e.target.value) || 0))) })} /></td>
                {p.counts.map((c, wd) => (
                  <td key={wd}><input type="number" aria-label={`${WEEKDAYS[wd]} headcount`} min="0" max="10000" value={c} onChange={(e) => setPattern(p.id, { counts: p.counts.map((x, i) => (i === wd ? Math.max(0, Math.min(10000, Math.round(Number(e.target.value) || 0))) : x)) })} /></td>
                ))}
                <td>{fmt1((shiftMinutes(p) / 60) * p.counts.reduce((a, b) => a + b, 0))}</td>
                <td><button className="btn link" type="button" onClick={() => setSchedule({ patterns: patterns.filter((x) => x.id !== p.id) })}>Remove</button></td>
              </tr>
            ))}
            {patterns.length > 0 && (
              <tr className="total"><td>People on shift</td><td /><td />{totals.map((t, i) => <td key={i}>{t}</td>)}<td>{fmt1(weeklyHours)}</td><td /></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn sm" type="button" disabled={patterns.length >= 100} onClick={() => setSchedule({
          patterns: [...patterns, { id: Math.random().toString(36).slice(2, 10), start: '09:00', end: '17:30', breakMin: 30, counts: [0, 0, 0, 0, 0, 0, 0] }],
        })}>Add a shift</button>
      </div>
    </Panel>
  )
}

function ImportPanel({ schedule, setSchedule, account }) {
  const ref = useRef(null)
  const [msg, setMsg] = useState(null)
  const read = async (file) => {
    if (!file) return
    const r = parseScheduleCSV(await file.text())
    if (!r.shifts.length) return setMsg({ ok: false, text: r.errors.join(' ') || 'No shifts found.' })
    setSchedule({ shifts: r.shifts, source: file.name.slice(0, 120) })
    setMsg({ ok: !r.errors.length, text: `Read ${fmtInt(r.rows)} shifts${r.errors.length ? `; ${r.errors.length >= 10 ? '10 or more' : r.errors.length} rows skipped, e.g. ${r.errors[0]}` : ''}. Names and IDs were discarded.` })
  }
  const dates = [...new Set(schedule.shifts.map((s) => s.date))].sort()
  return (
    <Panel title="Import a schedule" aside={schedule.shifts.length > 0 && <ConfirmButton className="btn sm" confirmLabel="Click again to remove" onConfirm={() => setSchedule({ shifts: [], source: null })}>Remove imported schedule</ConfirmButton>}>
      <div className="stack-s">
        <p className="small muted">
          A CSV export from your rostering or WFM system, one row per shift: <code>date</code>, <code>start</code>, <code>end</code>, and optionally{' '}
          <code>break_start</code>/<code>break_end</code>, <code>lunch_start</code>/<code>lunch_end</code>, <code>break_minutes</code> or <code>headcount</code>.
          Agent names are ignored, so no personal data is kept.
        </p>
        {schedule.shifts.length > 0 && (
          <p className="notice ok">{schedule.source}: {fmtInt(schedule.shifts.reduce((t, s) => t + s.count, 0))} shifts from {formatDate(dates[0], { day: 'numeric', month: 'short' })} to {formatDate(dates[dates.length - 1], { day: 'numeric', month: 'short', year: 'numeric' })}. These dates use the imported shifts.</p>
        )}
        {msg && <p className={`small ${msg.ok ? 'muted' : 'status bad'}`} role="status">{msg.text}</p>}
        {account.entitled ? (
          <div>
            <button className="btn" type="button" onClick={() => ref.current?.click()}>Choose a schedule CSV</button>
            <input ref={ref} type="file" accept=".csv,text/csv" hidden onChange={(e) => { read(e.target.files[0]); e.target.value = '' }} />
          </div>
        ) : <Locked account={account} what="Importing schedules" />}
      </div>
    </Panel>
  )
}

export default function CoveragePage({ active, site, result, updateActive, replace, account }) {
  const [weekKey, setWeekKey] = useState(null)
  const [mode, setMode] = useState('gap')
  const [dayIdx, setDayIdx] = useState(0)
  const dayReqs = result?.dayReqs
  const weeks = useMemo(() => {
    const out = []
    for (let i = 0; dayReqs && i + 7 <= dayReqs.length; i++) if (weekdayIndex(dayReqs[i].date) === 0) out.push(dayReqs.slice(i, i + 7))
    return out
  }, [dayReqs])
  const schedule = active?.schedule ?? emptySchedule()
  const s = result?.settings
  const inDay = schedule.inDayShrinkage ?? defaultInDayShrinkage(site)
  const days = weeks.find((w) => w[0].date === weekKey) ?? weeks[0]
  const cov = useMemo(() => (days && s ? coverageForDays(days, schedule, s, inDay) : null), [days, schedule, s, inDay])

  if (!active) return <NoServices title="Schedule & coverage" replace={replace} account={account} />
  const eyebrow = serviceEyebrow(active, site)
  if (!active.history) return <NeedsHistory title="Schedule & coverage" eyebrow={eyebrow} />
  if (!cov) return <LoadingPage eyebrow={eyebrow} title="Schedule & coverage" />

  const setSchedule = (patch) => updateActive({ schedule: { ...schedule, ...patch } })
  const live = active.channel !== 'backoffice'
  const unit = CHANNELS[active.channel].unit
  const hasRoster = schedule.patterns.length > 0 || schedule.shifts.length > 0
  const requiredFte = result.weeks.find((w) => w.week === days[0].date)?.requiredFte
  const rosteredFte = cov.paidHours / s.fteHoursPerWeek
  const onSuggest = () => {
    const p = live ? suggestPatterns(days.map((d) => d.intervals.map((iv) => iv.agents)), s, { inDay }) : suggestDailyPatterns(days, s, { inDay })
    setSchedule({ patterns: p.map((x) => ({ ...x, id: Math.random().toString(36).slice(2, 10) })) })
  }

  const figures = (
    <Figures>
      {live ? (
        <Figure hero label="Projected service level" value={cov.serviceLevel == null ? '–' : fmtPct(cov.serviceLevel, 1)} sub={`Target ${fmtPct(s.slTarget, 0)} in ${s.targetSec}s${cov.abandonRate != null ? ` · abandon ${fmtPct(cov.abandonRate, 1)}` : ''}`} />
      ) : (
        <Figure hero label="Hours covered" value={fmtPct(Math.min(1, cov.days.reduce((t, d) => t + Math.min(d.availableHours, d.requiredHours), 0) / Math.max(1, cov.days.reduce((t, d) => t + d.requiredHours, 0))), 0)} sub="Of the hours needed this week" />
      )}
      <Figure label="Short" value={`${fmtInt(cov.shortHours)} h`} sub={live ? `${cov.days.reduce((t, d) => t + d.intervals.filter((iv) => iv.gap < -0.5).length, 0)} intervals understaffed` : 'Staff hours below need'} />
      <Figure label="Over" value={`${fmtInt(cov.overHours)} h`} sub="Staff hours above need" />
      <Figure label="Rostered FTE" value={fmt1(rosteredFte)} sub={requiredFte ? `Plan needs ${fmt1(requiredFte)} incl. leave` : `${fmtInt(cov.paidHours)} paid hours`} />
    </Figures>
  )

  const head = (
    <PageHead eyebrow={eyebrow} title="Schedule & coverage" lede={`Staff your roster puts on duty in each ${live ? `${s.intervalMin}-minute interval` : 'day'}, after ${fmtPct(inDay, 0)} in-day shrinkage, against what the forecast needs.`}>
      <div style={{ width: 230 }} className="field">
        <label htmlFor="cov-week">Week</label>
        <select id="cov-week" value={days[0].date} onChange={(e) => setWeekKey(e.target.value)}>
          {weeks.map((w) => <option key={w[0].date} value={w[0].date}>Week of {formatDate(w[0].date, { day: 'numeric', month: 'short', year: 'numeric' })}</option>)}
        </select>
      </div>
    </PageHead>
  )

  const shrinkPanel = (
    <Panel title="In-day shrinkage">
      <div className="fields">
        <NumberField label="Applied to rostered staff" pct min={0} max={90} step={0.5} value={inDay} onChange={(v) => setSchedule({ inDayShrinkage: v })}
          hint={schedule.inDayShrinkage == null ? `${site?.name} default: sickness, training, meetings and other` : <button className="btn link small" type="button" onClick={() => setSchedule({ inDayShrinkage: null })}>Use {site?.name} default ({fmtPct(defaultInDayShrinkage(site), 0)})</button>} />
      </div>
      <p className="small faint" style={{ marginTop: 10 }}>Leave and breaks aren't included: people on leave aren't rostered, and breaks are already in the shifts.</p>
    </Panel>
  )

  if (!live) {
    return (
      <div className="stack">
        {head}
        {figures}
        <Panel title="Hours needed against hours rostered">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Day</th><th>Items</th><th>Hours needed</th><th>Hours rostered (net)</th><th>Gap</th></tr></thead>
              <tbody>
                {cov.days.map((d) => (
                  <tr key={d.date}>
                    <td>{formatDate(d.date, { weekday: 'long', day: 'numeric', month: 'short' })}</td>
                    <td>{fmtInt(d.volume)}</td>
                    <td>{fmt1(d.requiredHours)}</td>
                    <td>{fmt1(d.availableHours)}</td>
                    <td><Gap value={d.gapHours} unit="h" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <RosterEditor schedule={schedule} setSchedule={setSchedule} onSuggest={onSuggest} intervalMin={s.intervalMin} />
        <div className="cols">
          <ImportPanel schedule={schedule} setSchedule={setSchedule} account={account} />
          {shrinkPanel}
        </div>
      </div>
    )
  }

  const cols = days[0].intervals.map((_, k) => k).filter((k) => cov.days.some((d) => d.intervals[k].required > 0 || d.intervals[k].available > 0.05))
  const cellValue = (iv) => {
    if (mode === 'gap') return iv.required > 0 || iv.available > 0.05 ? iv.gap : null
    if (mode === 'required') return iv.required
    if (mode === 'available') return iv.available
    return iv.sl == null ? null : iv.sl - s.slTarget
  }
  const heatRows = cov.days.map((d) => ({
    label: WEEKDAYS[weekdayIndex(d.date)],
    cells: cols.map((k) => {
      const iv = d.intervals[k]
      return {
        value: cellValue(iv),
        tip: `needs ${iv.required} · rostered ${fmt1(iv.available)} (${fmt1(iv.onDuty)} on shift) · ${iv.gap >= 0 ? '+' : '−'}${fmt1(Math.abs(iv.gap))}${iv.sl != null ? ` · SL ${fmtPct(iv.sl, 0)}` : ''}${iv.abandon != null ? ` · abandon ${fmtPct(iv.abandon, 1)}` : ''}`,
      }
    }),
  }))
  const heatProps = {
    gap: { scale: 'div', domain: 6, neutral: 0.5, lowLabel: 'Short 6+', highLabel: '6+ over', format: fmt1, valueLabel: 'staff' },
    required: { scale: 'seq', valueLabel: 'Staff', format: (v) => fmtInt(v) },
    available: { scale: 'seq', valueLabel: 'Staff', format: (v) => fmt1(v) },
    sl: { scale: 'div', domain: 0.3, neutral: 0.015, lowLabel: `${fmtPct(Math.max(0, s.slTarget - 0.3), 0)} or less`, highLabel: `${fmtPct(Math.min(1, s.slTarget + 0.3), 0)}+`, format: (v) => fmtPct(v + s.slTarget, 0), valueLabel: 'service level' },
  }[mode]
  const day = cov.days[dayIdx] ?? cov.days[0]
  const dayCols = day.intervals.filter((_, k) => cols.includes(k))

  return (
    <div className="stack">
      {head}
      {figures}
      {!hasRoster && (
        <div className="notice">No roster yet. Add shift patterns below, use <b>Suggest shifts from requirement</b> for a first draft, or import a schedule from your rostering system.</div>
      )}

      <Panel title="Coverage by interval" aside={<Segmented label="Heatmap view" value={mode} onChange={setMode} options={MODES} />}>
        <Heatmap rows={heatRows} colLabels={cols.map((k) => formatTime(k * s.intervalMin))} selectedRow={dayIdx} onCell={(r) => setDayIdx(r)} {...heatProps} />
        <p className="small faint" style={{ marginTop: 8 }}>
          {mode === 'gap' && 'Red: fewer staff rostered than the requirement. Blue: more. Grey: within half a person.'}
          {mode === 'required' && `Staff needed on duty to hit ${fmtPct(s.slTarget, 0)} in ${s.targetSec}s.`}
          {mode === 'available' && `Staff on shift, minus breaks and ${fmtPct(inDay, 0)} in-day shrinkage.`}
          {mode === 'sl' && `Service level the roster would deliver, against the ${fmtPct(s.slTarget, 0)} target: red below, blue above.`}
          {' '}Select a day for its detail.
        </p>
      </Panel>

      <Panel title={formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' })} aside={`${fmtInt(day.volume)} ${unit}${day.serviceLevel != null ? ` · projected SL ${fmtPct(day.serviceLevel, 1)}` : ''}${day.source === 'imported' ? ' · imported schedule' : ''}`}>
        <Legend items={[{ label: 'Required', color: 'var(--series-1)' }, { label: 'Rostered (net)', color: 'var(--series-2)' }]} />
        <LineChart
          rows={dayCols.map((iv) => ({ x: formatTime(iv.time), required: iv.required, available: iv.available }))}
          series={[{ key: 'required', label: 'Required', color: 'var(--series-1)' }, { key: 'available', label: 'Rostered (net)', color: 'var(--series-2)' }]}
          height={240}
          valueFormat={fmt1}
          yFormat={(v) => fmtInt(v)}
        />
        <div className="table-wrap scroll-y" style={{ marginTop: 16 }}>
          <table>
            <thead><tr><th>Interval</th><th>{unit}</th><th>Required</th><th>On shift</th><th>Rostered (net)</th><th>Gap</th><th>Projected SL</th>{s.queueModel === 'erlangA' && <th>Abandon</th>}</tr></thead>
            <tbody>
              {dayCols.map((iv) => (
                <tr key={iv.time}>
                  <td>{formatTime(iv.time)}</td>
                  <td>{fmt1(iv.volume)}</td>
                  <td>{iv.required}</td>
                  <td>{fmt1(iv.onDuty)}</td>
                  <td>{fmt1(iv.available)}</td>
                  <td><Gap value={iv.gap} unit="" /></td>
                  <td>{iv.sl == null ? '–' : fmtPct(iv.sl, 1)}</td>
                  {s.queueModel === 'erlangA' && <td>{iv.abandon == null ? '–' : fmtPct(iv.abandon, 1)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <RosterEditor schedule={schedule} setSchedule={setSchedule} onSuggest={onSuggest} intervalMin={s.intervalMin} />
      <div className="cols">
        <ImportPanel schedule={schedule} setSchedule={setSchedule} account={account} />
        {shrinkPanel}
      </div>
    </div>
  )
}
