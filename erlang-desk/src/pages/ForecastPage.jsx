import { useMemo, useState } from 'react'
import { METHODS } from '../engine/forecast.js'
import { formatDate, formatTime, weekStart, WEEKDAYS, weekdayIndex } from '../engine/dates.js'
import { toCSV } from '../engine/csv.js'
import { CHANNELS } from '../engine/channels.js'
import { PageHead, Figures, Figure, SelectField, NumberField, Segmented, Panel, Locked, LoadingPage } from '../components/ui.jsx'
import { LineChart, Legend, Heatmap } from '../components/charts.jsx'
import { downloadText, fmtInt, fmtPct } from '../format.js'
import { NoServices, NeedsHistory, serviceEyebrow } from './common.jsx'

function byWeek(rows, keys) {
  const m = new Map()
  for (const r of rows) {
    const wk = weekStart(r.date)
    const cur = m.get(wk) ?? { date: wk, n: 0, ...Object.fromEntries(keys.map((k) => [k, 0])) }
    for (const k of keys) cur[k] += r[k] ?? 0
    cur.n++
    m.set(wk, cur)
  }
  return [...m.values()].filter((w) => w.n === 7)
}

/** Forecast contacts per interval for one week: where the day's volume actually lands. */
function IntervalHeatmap({ dayReqs, unit, intervalMin, week, setWeek }) {
  const weeks = []
  for (let i = 0; i + 7 <= dayReqs.length; i++) {
    if (weekdayIndex(dayReqs[i].date) === 0) weeks.push(dayReqs.slice(i, i + 7))
  }
  if (!weeks.length) return null
  const days = weeks.find((w) => w[0].date === week) ?? weeks[0]
  const cols = days[0].intervals.map((_, k) => k).filter((k) => days.some((d) => d.intervals[k].volume > 0.05))
  const rows = days.map((d) => ({
    label: WEEKDAYS[weekdayIndex(d.date)],
    cells: cols.map((k) => {
      const iv = d.intervals[k]
      return { value: iv.volume, tip: `${fmtInt(iv.volume)} ${unit} · AHT ${Math.round(iv.aht)}s · ${fmtPct(iv.volume / Math.max(1, d.volume), 1)} of the day` }
    }),
  }))
  return (
    <Panel
      title={`Forecast ${unit} by interval`}
      aside={
        <select aria-label="Week" value={days[0].date} onChange={(e) => setWeek(e.target.value)} style={{ width: 'auto' }}>
          {weeks.map((w) => <option key={w[0].date} value={w[0].date}>Week of {formatDate(w[0].date, { day: 'numeric', month: 'short', year: 'numeric' })}</option>)}
        </select>
      }
    >
      <Heatmap rows={rows} colLabels={cols.map((k) => formatTime(k * intervalMin))} valueLabel={unit} format={(v) => fmtInt(v)} />
      <p className="small faint" style={{ marginTop: 8 }}>Daily forecast spread across the intraday pattern learnt from your interval history. Staff required and roster coverage are on the next pages.</p>
    </Panel>
  )
}

export default function ForecastPage({ active, site, result, updateActive, replace, account }) {
  const [grain, setGrain] = useState('daily')
  const [heatWeek, setHeatWeek] = useState(null)
  const daily = active?.history?.dailyRows ?? []
  const forecast = result?.forecast
  const chartRows = useMemo(() => {
    if (!forecast?.points?.length) return []
    if (grain === 'weekly') {
      return [
        ...byWeek(daily.slice(-364), ['volume']).map((w) => ({ x: w.date, actual: w.volume })),
        ...byWeek(forecast.points, ['volume', 'low', 'high']).map((w) => ({ x: w.date, forecast: w.volume, low: w.low, high: w.high })),
      ]
    }
    return [
      ...daily.slice(-91).map((r) => ({ x: r.date, actual: r.volume })),
      ...forecast.points.slice(0, 91).map((p) => ({ x: p.date, forecast: p.volume, low: p.low, high: p.high })),
    ]
  }, [forecast, daily, grain])

  if (!active) return <NoServices title="Forecast" replace={replace} account={account} />
  const eyebrow = serviceEyebrow(active, site)
  if (daily.length < 7) return <NeedsHistory title="Forecast" eyebrow={eyebrow} />
  if (!forecast) return <LoadingPage eyebrow={eyebrow} title="Forecast" />
  if (forecast.error) return <div className="notice">{forecast.error}</div>

  const plan = active.plan
  const setPlan = (patch) => updateActive({ plan: { ...plan, ...patch } })
  const unit = CHANNELS[active.channel].unit
  const weekly = byWeek(forecast.points, ['volume', 'low', 'high'])
  const lastYear = new Map(byWeek(daily, ['volume']).map((w) => [w.date, w.volume]))
  const next4 = weekly.slice(0, 4).reduce((s, w) => s + w.volume, 0)
  const prior4 = byWeek(daily, ['volume']).slice(-4).reduce((s, w) => s + w.volume, 0)
  const fd = (d, long) => formatDate(d, long ? { weekday: grain === 'daily' ? 'short' : undefined, day: 'numeric', month: 'short', year: 'numeric' } : undefined)

  const exportCsv = () => downloadText(`erlang-desk-forecast-${active.name}.csv`, toCSV([
    { label: 'date', get: (p) => p.date },
    { label: 'weekday', get: (p) => WEEKDAYS[weekdayIndex(p.date)] },
    { label: 'forecast', get: (p) => p.volume.toFixed(1) },
    { label: 'low_80', get: (p) => p.low.toFixed(1) },
    { label: 'high_80', get: (p) => p.high.toFixed(1) },
  ], forecast.points))

  return (
    <div className="stack">
      <PageHead eyebrow={eyebrow} title="Forecast" lede={`Daily ${unit} for the next ${plan.horizonWeeks} weeks. Staffing and the capacity plan follow from this.`}>
        {account.entitled && <button className="btn" type="button" onClick={exportCsv}>Export CSV</button>}
      </PageHead>

      <Figures>
        <Figure label="Method" value={forecast.methodLabel} text sub={plan.method === 'auto' ? 'Chosen by backtest' : 'Chosen by you'} />
        <Figure label="Backtest accuracy" value={forecast.accuracy ? fmtPct(1 - forecast.accuracy.wape) : '–'} sub={forecast.accuracy ? `WAPE ${fmtPct(forecast.accuracy.wape)} over ${forecast.accuracy.holdoutDays} days held out` : 'Not enough history'} />
        <Figure label="Next four weeks" value={fmtInt(next4)} sub={prior4 ? `${next4 >= prior4 ? '+' : '−'}${fmtPct(Math.abs(next4 / prior4 - 1))} on the last four` : undefined} />
        <Figure label="Bias" value={forecast.accuracy ? `${forecast.accuracy.bias >= 0 ? '+' : '−'}${fmtPct(Math.abs(forecast.accuracy.bias))}` : '–'} sub="Positive means it over-forecast" />
      </Figures>
      {forecast.filledDays?.length > 0 && (
        <p className="small muted">
          {forecast.filledDays.length} day{forecast.filledDays.length > 1 ? 's were' : ' was'} missing from the history on a normally open weekday
          {forecast.filledDays.length <= 4 ? ` (${forecast.filledDays.map((d) => formatDate(d, { day: 'numeric', month: 'short', year: 'numeric' })).join(', ')})` : ''} and
          {forecast.filledDays.length > 1 ? ' were' : ' was'} filled from the same weekday in nearby weeks, so an export gap doesn't pull the forecast down.
        </p>
      )}

      <Panel>
        <div className="fields">
          <SelectField label="Method" value={plan.method} onChange={(method) => setPlan({ method })} options={Object.entries(METHODS).map(([value, m]) => ({ value, label: m.label }))} />
          <SelectField label="Horizon" value={String(plan.horizonWeeks)} onChange={(v) => setPlan({ horizonWeeks: Number(v) })} options={[13, 26, 39, 52].map((w) => ({ value: String(w), label: `${w} weeks` }))} />
          <NumberField label="Planner overlay" pct step={1} min={-90} max={500} value={plan.volumeAdjustPct} onChange={(volumeAdjustPct) => setPlan({ volumeAdjustPct })} hint="For known events: campaigns, price changes, migrations" />
        </div>
      </Panel>

      <Panel title="Actuals and forecast" aside={<Segmented label="Granularity" value={grain} onChange={setGrain} options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }]} />}>
        <Legend items={[{ label: 'Actual', color: 'var(--series-1)' }, { label: 'Forecast', color: 'var(--series-2)' }, { label: '80% range', color: 'var(--series-2)', band: true }]} />
        <LineChart
          rows={chartRows}
          height={300}
          series={[{ key: 'actual', label: 'Actual', color: 'var(--series-1)' }, { key: 'forecast', label: 'Forecast', color: 'var(--series-2)', band: ['low', 'high'] }]}
          xFormat={fd}
          valueFormat={fmtInt}
          markers={[{ x: chartRows.find((r) => r.forecast != null)?.x, label: 'Forecast' }]}
        />
      </Panel>

      {active.channel !== 'backoffice' && result?.dayReqs?.length > 0 && (
        <IntervalHeatmap dayReqs={result.dayReqs} unit={unit} intervalMin={result.settings.intervalMin} week={heatWeek} setWeek={setHeatWeek} />
      )}

      <div className="cols">
        <Panel title="How each method did" aside={`Last ${forecast.accuracy?.holdoutDays ?? 0} days held out`}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Method</th><th>Accuracy</th><th>Bias</th></tr></thead>
              <tbody>
                {forecast.backtest.map((r) => (
                  <tr key={r.method} className={r.method === forecast.method ? 'hl' : ''}>
                    <td>{r.label}</td>
                    <td>{fmtPct(1 - r.wape)}</td>
                    <td>{r.bias >= 0 ? '+' : '−'}{fmtPct(Math.abs(r.bias))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small faint" style={{ marginTop: 12 }}>Accuracy is 1 − WAPE: total absolute error over total volume. Above 90% is good for a daily contact-centre forecast.</p>
        </Panel>
        <Panel title="By week">
          <div className="table-wrap scroll-y">
            <table>
              <thead><tr><th>Week of</th><th>Forecast</th><th>80% range</th><th>Last year</th></tr></thead>
              <tbody>
                {weekly.map((w) => {
                  const ly = lastYear.get(weekStart(new Date(Date.parse(w.date) - 364 * 864e5).toISOString().slice(0, 10)))
                  return (
                    <tr key={w.date}>
                      <td>{formatDate(w.date, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td>{fmtInt(w.volume)}</td>
                      <td className="faint">{fmtInt(w.low)}–{fmtInt(w.high)}</td>
                      <td className="faint">{ly ? fmtInt(ly) : '–'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      {!account.entitled && <Locked account={account} what="Exporting forecasts" />}
    </div>
  )
}
