import { useMemo, useState } from 'react'
import { formatDate, formatTime, weekStart, WEEKDAYS, weekdayIndex } from '../engine/dates.js'
import { toCSV } from '../engine/csv.js'
import { withShrinkage } from '../engine/erlang.js'
import { PageHead, Tile, SelectField } from '../components/ui.jsx'
import { Heatmap, ColumnChart } from '../components/charts.jsx'
import { downloadText, fmtInt, fmt1, fmtPct } from '../format.js'
import { NeedsData } from './Overview.jsx'

export default function StaffingPage({ ws, model }) {
  const { dayReqs } = model
  const s = ws.settings
  const weeks = useMemo(() => {
    const m = new Map()
    for (const d of dayReqs) {
      const wk = weekStart(d.date)
      if (!m.has(wk)) m.set(wk, [])
      m.get(wk).push(d)
    }
    return [...m.entries()].filter(([, days]) => days.length === 7)
  }, [dayReqs])
  const [weekKey, setWeekKey] = useState(null)
  const [dayIdx, setDayIdx] = useState(0)

  if (!dayReqs.length) return <NeedsData title="Intraday staffing" />
  const [wk, days] = weeks.find(([k]) => k === weekKey) ?? weeks[0]
  const day = days[dayIdx] ?? days[0]

  // Show only intervals that are staffed on some day of the week.
  const cols = days[0].intervals.map((_, k) => k).filter((k) => days.some((d) => d.intervals[k].agents > 0))
  const heatRows = days.map((d) => ({
    label: WEEKDAYS[weekdayIndex(d.date)],
    cells: cols.map((k) => {
      const iv = d.intervals[k]
      return { value: iv.agents, tip: `${iv.agents} agents · ${fmtInt(iv.volume)} contacts · AHT ${Math.round(iv.aht)}s${iv.sl != null ? ` · SL ${fmtPct(iv.sl, 0)}` : ''}` }
    }),
  }))
  const dayCols = day.intervals.filter((_, k) => cols.includes(k))
  const peak = Math.max(...days.flatMap((d) => d.intervals.map((iv) => iv.agents)))
  const agentHours = days.reduce((t, d) => t + d.agentHours, 0)

  const exportCsv = () => downloadText(`erlang-desk-intervals-${wk}.csv`, toCSV([
    { label: 'date', get: (r) => r.date },
    { label: 'interval_start', get: (r) => formatTime(r.time) },
    { label: 'forecast_contacts', get: (r) => r.volume.toFixed(2) },
    { label: 'aht_sec', get: (r) => Math.round(r.aht) },
    { label: 'agents_required', get: (r) => r.agents },
    { label: 'agents_scheduled', get: (r) => Math.ceil(withShrinkage(r.agents, s.shrinkage)) },
    { label: 'service_level', get: (r) => (r.sl == null ? '' : r.sl.toFixed(3)) },
    { label: 'occupancy', get: (r) => (r.occ == null ? '' : r.occ.toFixed(3)) },
  ], days.flatMap((d) => d.intervals.map((iv) => ({ date: d.date, ...iv })))))

  return (
    <div className="stack">
      <PageHead title="Intraday staffing" sub={`Agents needed per ${s.intervalMin}-minute interval to hit ${fmtPct(s.slTarget, 0)} in ${s.targetSec}s, using Erlang C.`}>
        <div style={{ width: 220 }}>
          <SelectField label="Week" value={wk} onChange={(v) => setWeekKey(v)} options={weeks.map(([k]) => ({ value: k, label: `Week of ${formatDate(k, { day: 'numeric', month: 'short', year: 'numeric' })}` }))} />
        </div>
        <button className="btn" type="button" onClick={exportCsv} style={{ alignSelf: 'flex-end' }}>Export CSV</button>
      </PageHead>

      <div className="tiles">
        <Tile label="Contacts this week" value={fmtInt(days.reduce((t, d) => t + d.volume, 0))} />
        <Tile label="Peak agents on phones" value={fmtInt(peak)} sub={`${Math.ceil(withShrinkage(peak, s.shrinkage))} scheduled with shrinkage`} />
        <Tile label="Productive agent hours" value={fmtInt(agentHours)} sub={`Workload ${fmtInt(days.reduce((t, d) => t + d.workloadHours, 0))} h before queueing`} />
        <Tile label="Scheduled FTE" value={fmt1(withShrinkage(agentHours, s.shrinkage) / s.fteHoursPerWeek)} sub={`${fmtPct(s.shrinkage, 0)} shrinkage, ${s.fteHoursPerWeek}h FTE`} />
      </div>

      <div className="card">
        <div className="card-head"><h2>Agents required, by day and interval</h2><span className="small muted">Click a day to see its detail below</span></div>
        <Heatmap rows={heatRows} colLabels={cols.map((k) => formatTime(k * s.intervalMin))} selectedRow={dayIdx} onCell={(r) => setDayIdx(r)} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          <span className="small muted">{fmtInt(day.volume)} contacts · {fmt1(day.agentHours)} agent hours</span>
        </div>
        <ColumnChart
          label="Agents required"
          rows={dayCols.map((iv) => ({
            x: formatTime(iv.time),
            value: iv.agents,
            tip: [['Contacts', fmt1(iv.volume)], ['AHT', `${Math.round(iv.aht)}s`], ['Service level', iv.sl == null ? '–' : fmtPct(iv.sl)], ['Occupancy', iv.occ == null ? '–' : fmtPct(iv.occ)]],
          }))}
          yFormat={fmtInt}
        />
        <div className="table-wrap scroll-y" style={{ marginTop: 16 }}>
          <table>
            <thead><tr><th>Interval</th><th>Contacts</th><th>AHT</th><th>Agents</th><th>Scheduled</th><th>Service level</th><th>Occupancy</th></tr></thead>
            <tbody>
              {dayCols.map((iv) => (
                <tr key={iv.time}>
                  <td>{formatTime(iv.time)}</td>
                  <td>{fmt1(iv.volume)}</td>
                  <td>{Math.round(iv.aht)}s</td>
                  <td>{iv.agents}</td>
                  <td>{Math.ceil(withShrinkage(iv.agents, s.shrinkage))}</td>
                  <td>{iv.sl == null ? '–' : fmtPct(iv.sl)}</td>
                  <td>{iv.occ == null ? '–' : fmtPct(iv.occ)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
