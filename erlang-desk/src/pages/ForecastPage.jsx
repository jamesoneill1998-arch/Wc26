import { useMemo, useState } from 'react'
import { METHODS } from '../engine/forecast.js'
import { formatDate, weekStart, WEEKDAYS, weekdayIndex } from '../engine/dates.js'
import { toCSV } from '../engine/csv.js'
import { PageHead, Tile, SelectField, NumberField, Segmented } from '../components/ui.jsx'
import { LineChart, Legend } from '../components/charts.jsx'
import { downloadText, fmtInt, fmtPct } from '../format.js'
import { NeedsData } from './Overview.jsx'

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

export default function ForecastPage({ ws, update, model }) {
  const [grain, setGrain] = useState('daily')
  const { forecast } = model
  const plan = ws.plan
  const setPlan = (patch) => update({ plan: { ...plan, ...patch } })
  const daily = ws.history?.dailyRows ?? []

  const chartRows = useMemo(() => {
    if (!forecast?.points?.length) return []
    if (grain === 'weekly') {
      const act = byWeek(daily.slice(-364), ['volume'])
      const fc = byWeek(forecast.points, ['volume', 'low', 'high'])
      return [
        ...act.map((w) => ({ x: w.date, actual: w.volume })),
        ...fc.map((w) => ({ x: w.date, forecast: w.volume, low: w.low, high: w.high })),
      ]
    }
    const act = daily.slice(-91).map((r) => ({ x: r.date, actual: r.volume }))
    const fc = forecast.points.slice(0, 91).map((p) => ({ x: p.date, forecast: p.volume, low: p.low, high: p.high }))
    return [...act, ...fc]
  }, [forecast, daily, grain])

  if (daily.length < 7) return <NeedsData title="Forecast" />
  if (forecast?.error) return <div className="notice warn">{forecast.error}</div>

  const weekly = byWeek(forecast.points, ['volume', 'low', 'high'])
  const lastYear = new Map(byWeek(daily, ['volume']).map((w) => [w.date, w.volume]))
  const next4 = weekly.slice(0, 4).reduce((s, w) => s + w.volume, 0)
  const prior4 = byWeek(daily, ['volume']).slice(-4).reduce((s, w) => s + w.volume, 0)

  const exportCsv = () => downloadText('erlang-desk-forecast.csv', toCSV([
    { label: 'date', get: (p) => p.date },
    { label: 'weekday', get: (p) => WEEKDAYS[weekdayIndex(p.date)] },
    { label: 'forecast', get: (p) => p.volume.toFixed(1) },
    { label: 'low_80', get: (p) => p.low.toFixed(1) },
    { label: 'high_80', get: (p) => p.high.toFixed(1) },
  ], forecast.points))

  const methodOptions = Object.entries(METHODS).map(([value, m]) => ({ value, label: m.label }))
  const fd = (d, long) => formatDate(d, long ? { weekday: grain === 'daily' ? 'short' : undefined, day: 'numeric', month: 'short', year: 'numeric' } : undefined)

  return (
    <div className="stack">
      <PageHead title="Forecast" sub={`Daily contacts for the next ${plan.horizonWeeks} weeks. Intervals and staffing follow from this.`}>
        <button className="btn" type="button" onClick={exportCsv}>Export CSV</button>
      </PageHead>

      <div className="card">
        <div className="fields">
          <SelectField label="Method" value={plan.method} onChange={(method) => setPlan({ method })} options={methodOptions} />
          <SelectField label="Horizon" value={String(plan.horizonWeeks)} onChange={(v) => setPlan({ horizonWeeks: Number(v) })}
            options={[13, 26, 39, 52].map((w) => ({ value: String(w), label: `${w} weeks` }))} />
          <NumberField label="Planner adjustment" pct step={1} min={-90} max={500} value={plan.volumeAdjustPct} onChange={(volumeAdjustPct) => setPlan({ volumeAdjustPct })}
            hint="Overlay for known events: campaigns, price changes, migrations" />
        </div>
      </div>

      <div className="tiles">
        <Tile label="Method in use" value={<span style={{ fontSize: 17 }}>{forecast.methodLabel}</span>} sub={plan.method === 'auto' ? 'Chosen by backtest' : 'Chosen manually'} />
        <Tile label="Backtest accuracy" value={forecast.accuracy ? fmtPct(1 - forecast.accuracy.wape) : '–'}
          sub={forecast.accuracy ? `WAPE ${fmtPct(forecast.accuracy.wape)} over the last ${forecast.accuracy.holdoutDays} days` : 'Not enough history to backtest'} />
        <Tile label="Next 4 weeks" value={fmtInt(next4)} sub={prior4 ? `${next4 >= prior4 ? '+' : '−'}${fmtPct(Math.abs(next4 / prior4 - 1))} vs last 4 weeks` : undefined} />
        <Tile label="Bias" value={forecast.accuracy ? `${forecast.accuracy.bias >= 0 ? '+' : '−'}${fmtPct(Math.abs(forecast.accuracy.bias))}` : '–'} sub="Positive means the method over-forecast in the backtest" />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Actuals and forecast</h2>
          <Segmented label="Granularity" value={grain} onChange={setGrain} options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }]} />
        </div>
        <Legend items={[{ label: 'Actual', color: 'var(--series-1)' }, { label: 'Forecast', color: 'var(--series-2)' }, { label: '80% range', color: 'var(--series-2)', band: true }]} />
        <LineChart
          rows={chartRows}
          height={300}
          series={[
            { key: 'actual', label: 'Actual', color: 'var(--series-1)' },
            { key: 'forecast', label: 'Forecast', color: 'var(--series-2)', band: ['low', 'high'] },
          ]}
          xFormat={fd}
          valueFormat={fmtInt}
          markers={[{ x: chartRows.find((r) => r.forecast != null)?.x, label: 'Forecast' }]}
        />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head"><h2>Method backtest</h2><span className="small muted">Last {forecast.accuracy?.holdoutDays ?? 0} days held out</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Method</th><th>Accuracy</th><th>WAPE</th><th>Bias</th></tr></thead>
              <tbody>
                {forecast.backtest.map((r) => (
                  <tr key={r.method} className={r.method === forecast.method ? 'hl' : ''}>
                    <td>{r.label}{r.method === forecast.method ? ' ✓' : ''}</td>
                    <td>{fmtPct(1 - r.wape)}</td>
                    <td>{fmtPct(r.wape)}</td>
                    <td>{r.bias >= 0 ? '+' : '−'}{fmtPct(Math.abs(r.bias))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>WAPE is total absolute error divided by total volume. Under 10% is good for daily contact-centre forecasts.</p>
        </div>
        <div className="card">
          <div className="card-head"><h2>Weekly forecast</h2></div>
          <div className="table-wrap scroll-y">
            <table>
              <thead><tr><th>Week of</th><th>Forecast</th><th>80% range</th><th>Same week last year</th></tr></thead>
              <tbody>
                {weekly.map((w) => {
                  const ly = lastYear.get(weekStart(new Date(Date.parse(w.date) - 364 * 864e5).toISOString().slice(0, 10)))
                  return (
                    <tr key={w.date}>
                      <td>{formatDate(w.date, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td>{fmtInt(w.volume)}</td>
                      <td className="muted">{fmtInt(w.low)}–{fmtInt(w.high)}</td>
                      <td className="muted">{ly ? fmtInt(ly) : '–'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
