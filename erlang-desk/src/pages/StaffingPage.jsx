import { useMemo, useState } from 'react'
import { formatDate, formatTime, weekStart, WEEKDAYS, weekdayIndex } from '../engine/dates.js'
import { toCSV } from '../engine/csv.js'
import { withShrinkage } from '../engine/erlang.js'
import { CHANNELS } from '../engine/channels.js'
import { PageHead, Figures, Figure, SelectField, Panel, LoadingPage } from '../components/ui.jsx'
import { Heatmap, ColumnChart } from '../components/charts.jsx'
import { downloadText, fmtInt, fmt1, fmtPct } from '../format.js'
import { NoServices, NeedsHistory, serviceEyebrow } from './common.jsx'

function useWeeks(dayReqs) {
  return useMemo(() => {
    const m = new Map()
    for (const d of dayReqs ?? []) {
      const wk = weekStart(d.date)
      if (!m.has(wk)) m.set(wk, [])
      m.get(wk).push(d)
    }
    return [...m.entries()].filter(([, days]) => days.length === 7)
  }, [dayReqs])
}

function WeekPicker({ weeks, value, onChange }) {
  return (
    <div style={{ width: 230 }}>
      <SelectField label="Week" value={value} onChange={onChange} options={weeks.map(([k]) => ({ value: k, label: `Week of ${formatDate(k, { day: 'numeric', month: 'short', year: 'numeric' })}` }))} />
    </div>
  )
}

function BackOffice({ s, days, wk, weeks, setWeekKey, eyebrow, account }) {
  const dailyPaid = s.fteHoursPerWeek / 5
  const people = (h) => (h > 0 ? withShrinkage(h, s.shrinkage) / dailyPaid : 0)
  const hours = days.reduce((t, d) => t + d.agentHours, 0)
  const exportCsv = () => downloadText(`erlang-desk-workload-${wk}.csv`, toCSV([
    { label: 'date', get: (d) => d.date },
    { label: 'items_forecast', get: (d) => d.volume.toFixed(1) },
    { label: 'workload_hours', get: (d) => d.workloadHours.toFixed(2) },
    { label: 'productive_hours_required', get: (d) => d.agentHours.toFixed(2) },
    { label: 'people_scheduled', get: (d) => people(d.agentHours).toFixed(1) },
  ], days))
  return (
    <div className="stack">
      <PageHead eyebrow={eyebrow} title="Daily workload" lede={`Back-office work doesn't queue by the minute. Hours needed are workload divided by ${fmtPct(s.utilisation, 0)} utilisation, with weekend arrivals rolled to the next open day and smoothed over a ${s.slaDays}-day turnaround.`}>
        <WeekPicker weeks={weeks} value={wk} onChange={setWeekKey} />
        {account.entitled && <button className="btn" type="button" onClick={exportCsv} style={{ alignSelf: 'flex-end' }}>Export CSV</button>}
      </PageHead>
      <Figures>
        <Figure label="Items this week" value={fmtInt(days.reduce((t, d) => t + d.volume, 0))} />
        <Figure label="Productive hours needed" value={fmtInt(hours)} sub={`Raw workload ${fmtInt(days.reduce((t, d) => t + d.workloadHours, 0))} h`} />
        <Figure label="Peak day" value={fmt1(Math.max(...days.map((d) => people(d.agentHours))))} sub="People scheduled, after shrinkage" />
        <Figure label="Scheduled FTE" value={fmt1(withShrinkage(hours, s.shrinkage) / s.fteHoursPerWeek)} sub={`${fmtPct(s.shrinkage, 0)} shrinkage · ${s.fteHoursPerWeek}h week`} />
      </Figures>
      <Panel title="People needed each day">
        <ColumnChart
          label="People scheduled"
          rows={days.map((d) => ({ x: `${WEEKDAYS[weekdayIndex(d.date)]} ${formatDate(d.date, { day: 'numeric' })}`, value: people(d.agentHours), tip: [['Items', fmtInt(d.volume)], ['Productive hours', fmt1(d.agentHours)]] }))}
          yFormat={fmt1}
        />
        <div className="table-wrap" style={{ marginTop: 18 }}>
          <table>
            <thead><tr><th>Day</th><th>Items</th><th>Workload h</th><th>Hours needed</th><th>People</th></tr></thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date}>
                  <td>{formatDate(d.date, { weekday: 'long', day: 'numeric', month: 'short' })}{!d.open && <span className="faint"> · closed</span>}</td>
                  <td>{fmtInt(d.volume)}</td>
                  <td>{fmt1(d.workloadHours)}</td>
                  <td>{fmt1(d.agentHours)}</td>
                  <td>{fmt1(people(d.agentHours))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

export default function StaffingPage({ active, site, result, replace, account }) {
  const weeks = useWeeks(result?.dayReqs)
  const [weekKey, setWeekKey] = useState(null)
  const [dayIdx, setDayIdx] = useState(0)
  if (!active) return <NoServices title="Intraday staffing" replace={replace} />
  const eyebrow = serviceEyebrow(active, site)
  if (!active.history) return <NeedsHistory title="Intraday staffing" eyebrow={eyebrow} />
  if (!weeks.length) return <LoadingPage eyebrow={eyebrow} title="Intraday staffing" />

  const s = result.settings
  const [wk, days] = weeks.find(([k]) => k === weekKey) ?? weeks[0]
  if (active.channel === 'backoffice') return <BackOffice s={s} days={days} wk={wk} weeks={weeks} setWeekKey={setWeekKey} eyebrow={eyebrow} account={account} />

  const day = days[dayIdx] ?? days[0]
  const isA = s.queueModel === 'erlangA'
  const branches = active.channel === 'branch' ? s.branches : 1
  const unit = CHANNELS[active.channel].unit
  const cols = days[0].intervals.map((_, k) => k).filter((k) => days.some((d) => d.intervals[k].agents > 0))
  const heatRows = days.map((d) => ({
    label: WEEKDAYS[weekdayIndex(d.date)],
    cells: cols.map((k) => {
      const iv = d.intervals[k]
      return { value: iv.agents, tip: `${iv.agents} staff · ${fmtInt(iv.volume)} ${unit}${iv.sl != null ? ` · SL ${fmtPct(iv.sl, 0)}` : ''}${iv.abandon != null ? ` · abandon ${fmtPct(iv.abandon, 1)}` : ''}` }
    }),
  }))
  const dayCols = day.intervals.filter((_, k) => cols.includes(k))
  const peak = Math.max(...days.flatMap((d) => d.intervals.map((iv) => iv.agents)))
  const agentHours = days.reduce((t, d) => t + d.agentHours, 0)
  const offered = days.reduce((t, d) => t + d.volume, 0)
  const abandoned = isA ? days.reduce((t, d) => t + d.intervals.reduce((a, iv) => a + (iv.abandon ?? 0) * iv.volume, 0), 0) : null

  const exportCsv = () => downloadText(`erlang-desk-intervals-${wk}.csv`, toCSV([
    { label: 'date', get: (r) => r.date },
    { label: 'interval_start', get: (r) => formatTime(r.time) },
    { label: `forecast_${unit}`, get: (r) => r.volume.toFixed(2) },
    { label: 'aht_sec', get: (r) => Math.round(r.aht) },
    { label: 'staff_required', get: (r) => r.agents },
    { label: 'staff_scheduled', get: (r) => Math.ceil(withShrinkage(r.agents, s.shrinkage)) },
    { label: 'service_level', get: (r) => (r.sl == null ? '' : r.sl.toFixed(3)) },
    { label: 'abandon_rate', get: (r) => (r.abandon == null ? '' : r.abandon.toFixed(4)) },
    { label: 'occupancy', get: (r) => (r.occ == null ? '' : r.occ.toFixed(3)) },
  ], days.flatMap((d) => d.intervals.map((iv) => ({ date: d.date, ...iv })))))

  return (
    <div className="stack">
      <PageHead
        eyebrow={eyebrow}
        title="Intraday staffing"
        lede={`Staff needed each ${s.intervalMin} minutes to answer ${fmtPct(s.slTarget, 0)} within ${s.targetSec}s, using ${isA ? `Erlang A (callers wait ${s.patienceSec}s on average before abandoning)` : 'Erlang C'}${branches > 1 ? `, sized branch by branch across ${branches} branches` : ''}${s.concurrency > 1 ? `, with ${s.concurrency} concurrent sessions per agent` : ''}.`}
      >
        <WeekPicker weeks={weeks} value={wk} onChange={setWeekKey} />
        {account.entitled && <button className="btn" type="button" onClick={exportCsv} style={{ alignSelf: 'flex-end' }}>Export CSV</button>}
      </PageHead>

      <Figures>
        <Figure label={`${unit[0].toUpperCase() + unit.slice(1)} this week`} value={fmtInt(offered)} sub={isA ? `≈ ${fmtInt(abandoned)} abandon (${fmtPct(abandoned / offered, 1)})` : undefined} />
        <Figure label="Peak staff on duty" value={fmtInt(peak)} sub={`${fmtInt(Math.ceil(withShrinkage(peak, s.shrinkage)))} rostered with shrinkage`} />
        <Figure label="Productive hours" value={fmtInt(agentHours)} sub={`Workload ${fmtInt(days.reduce((t, d) => t + d.workloadHours, 0))} h before queueing`} />
        <Figure label="Scheduled FTE" value={fmt1(withShrinkage(agentHours, s.shrinkage) / s.fteHoursPerWeek)} sub={`${fmtPct(s.shrinkage, 0)} shrinkage · ${s.fteHoursPerWeek}h week`} />
      </Figures>

      <Panel title="Staff required by day and interval" aside="Select a day to see its detail">
        <Heatmap rows={heatRows} colLabels={cols.map((k) => formatTime(k * s.intervalMin))} selectedRow={dayIdx} onCell={(r) => setDayIdx(r)} valueLabel="Staff" />
      </Panel>

      <Panel title={formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' })} aside={`${fmtInt(day.volume)} ${unit} · ${fmt1(day.agentHours)} productive hours`}>
        <ColumnChart
          label="Staff required"
          rows={dayCols.map((iv) => ({
            x: formatTime(iv.time),
            value: iv.agents,
            tip: [[unit[0].toUpperCase() + unit.slice(1), fmt1(iv.volume)], ['AHT', `${Math.round(iv.aht)}s`], ['Service level', iv.sl == null ? '–' : fmtPct(iv.sl)], ...(isA ? [['Abandonment', iv.abandon == null ? '–' : fmtPct(iv.abandon)]] : []), ['Occupancy', iv.occ == null ? '–' : fmtPct(iv.occ)]],
          }))}
          yFormat={fmtInt}
        />
        <div className="table-wrap scroll-y" style={{ marginTop: 18 }}>
          <table>
            <thead><tr><th>Interval</th><th>{unit}</th><th>AHT</th><th>Staff</th><th>Rostered</th><th>Service level</th>{isA && <th>Abandon</th>}<th>Occupancy</th></tr></thead>
            <tbody>
              {dayCols.map((iv) => (
                <tr key={iv.time}>
                  <td>{formatTime(iv.time)}</td>
                  <td>{fmt1(iv.volume)}</td>
                  <td>{Math.round(iv.aht)}s</td>
                  <td>{iv.agents}</td>
                  <td>{Math.ceil(withShrinkage(iv.agents, s.shrinkage))}</td>
                  <td>{iv.sl == null ? '–' : fmtPct(iv.sl)}</td>
                  {isA && <td>{iv.abandon == null ? '–' : fmtPct(iv.abandon)}</td>}
                  <td>{iv.occ == null ? '–' : fmtPct(iv.occ)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
