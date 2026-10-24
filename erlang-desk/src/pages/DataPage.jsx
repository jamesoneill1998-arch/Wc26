import { useRef, useState } from 'react'
import { parseHistoryCSV, aggregateDaily, toCSV } from '../engine/csv.js'
import { generateSampleHistory } from '../engine/sample.js'
import { addDays, formatDate } from '../engine/dates.js'
import { trimIntervalRows, emptyWorkspace } from '../state/store.js'
import { PageHead, Tile, Icon } from '../components/ui.jsx'
import { LineChart } from '../components/charts.jsx'
import { downloadText, fmtInt } from '../format.js'

function historyFrom(kind, rows, source) {
  const dailyRows = kind === 'interval' ? aggregateDaily(rows) : [...rows].sort((a, b) => (a.date < b.date ? -1 : 1))
  return {
    kind,
    source,
    loadedAt: new Date().toISOString(),
    dailyRows,
    intervalRows: kind === 'interval' ? trimIntervalRows(rows) : [],
  }
}

export default function DataPage({ ws, update, replace }) {
  const [msg, setMsg] = useState(null)
  const [over, setOver] = useState(false)
  const fileRef = useRef(null)
  const wsRef = useRef(null)
  const h = ws.history

  const loadSample = () => {
    const yesterday = addDays(new Date().toISOString().slice(0, 10), -1)
    const rows = generateSampleHistory({ endDate: yesterday, intervalMin: ws.settings.intervalMin })
    update((cur) => ({ history: historyFrom('interval', rows, 'Sample data'), hires: [], capacity: { ...cur.capacity, calibrate: true } }))
    setMsg({ ok: true, text: `Loaded two years of sample interval data (${fmtInt(rows.length)} rows). Head to the Forecast page next.` })
  }

  const readFile = async (file) => {
    if (!file) return
    const text = await file.text()
    const res = parseHistoryCSV(text)
    if (!res.rows.length) {
      setMsg({ ok: false, text: res.errors.join(' ') || 'No rows found.' })
      return
    }
    update({ history: historyFrom(res.kind, res.rows, file.name) })
    const skipped = res.errors.length ? ` ${res.errors.length >= 10 ? '10+' : res.errors.length} rows were skipped: ${res.errors[0]}` : ''
    setMsg({ ok: !res.errors.length, text: `Imported ${fmtInt(res.rows.length)} ${res.kind} rows from ${file.name}.${skipped}` })
  }

  const exportWorkspace = () => downloadText(`erlang-desk-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(ws), 'application/json')
  const importWorkspace = async (file) => {
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (!data.settings) throw new Error('not a workspace')
      replace({ ...emptyWorkspace(), ...data })
      setMsg({ ok: true, text: `Restored workspace "${data.name ?? 'workspace'}".` })
    } catch {
      setMsg({ ok: false, text: 'That file is not an Erlang Desk workspace export.' })
    }
  }

  const template = () => downloadText('erlang-desk-template.csv', toCSV(
    [{ label: 'date', get: (r) => r[0] }, { label: 'time', get: (r) => r[1] }, { label: 'volume', get: (r) => r[2] }, { label: 'aht', get: (r) => r[3] }],
    [['2026-01-05', '08:00', 42, 315], ['2026-01-05', '08:30', 61, 298], ['2026-01-05', '09:00', 88, 305]],
  ))

  const days = h?.dailyRows ?? []
  const recent = days.slice(-182)
  const total = days.reduce((s, r) => s + r.volume, 0)
  const withAht = days.filter((r) => r.aht)
  const avgAht = withAht.length ? withAht.reduce((s, r) => s + r.aht * r.volume, 0) / withAht.reduce((s, r) => s + r.volume, 0) : null

  return (
    <div className="stack">
      <PageHead title="Data" sub="Import contact history. Daily totals work; interval data gives you better intraday staffing." />

      {msg && <div className={`notice${msg.ok ? '' : ' warn'}`}>{msg.text}</div>}

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head"><h2>Import a CSV</h2><button className="btn sm ghost" type="button" onClick={template}>Download template</button></div>
          <div
            className={`drop${over ? ' over' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); readFile(e.dataTransfer.files[0]) }}
          >
            <div style={{ width: 28, margin: '0 auto 8px', color: 'var(--accent)' }}>{Icon.upload}</div>
            <b>Drop a CSV here or click to choose</b>
            <p className="small muted" style={{ marginTop: 6 }}>
              Columns: <code>date</code>, optional <code>time</code>, <code>volume</code>, optional <code>aht</code> (seconds).
              Common ACD names like "Calls Offered" are recognised.
            </p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { readFile(e.target.files[0]); e.target.value = '' }} />
        </div>

        <div className="card stack" style={{ gap: 12 }}>
          <h2>No data to hand?</h2>
          <p className="muted small">
            Load two years of realistic interval data, with trend, weekly and annual seasonality and bank-holiday dips,
            to see the whole workflow end to end.
          </p>
          <div><button className="btn primary" type="button" onClick={loadSample}>Load sample data</button></div>
          <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%', margin: '4px 0' }} />
          <h3>Workspace backup</h3>
          <p className="muted small">Settings, history and planned hires are saved in this browser. Export a copy to move to another device or share with a colleague.</p>
          <div className="row">
            <button className="btn sm" type="button" onClick={exportWorkspace}>Export workspace</button>
            <button className="btn sm" type="button" onClick={() => wsRef.current?.click()}>Import workspace</button>
            {h && <button className="btn sm ghost" type="button" onClick={() => { if (confirm('Remove the loaded history from this browser?')) update({ history: null, hires: [] }) }}>Clear history</button>}
          </div>
          <input ref={wsRef} type="file" accept=".json,application/json" hidden onChange={(e) => { importWorkspace(e.target.files[0]); e.target.value = '' }} />
        </div>
      </div>

      {h && days.length > 0 && (
        <>
          <div className="tiles">
            <Tile label="Source" value={<span style={{ fontSize: 18 }}>{h.source}</span>} sub={`${h.kind === 'interval' ? 'Interval' : 'Daily'} data`} />
            <Tile label="Date range" value={<span style={{ fontSize: 18 }}>{formatDate(days[0].date, { day: 'numeric', month: 'short', year: '2-digit' })} – {formatDate(days[days.length - 1].date, { day: 'numeric', month: 'short', year: '2-digit' })}</span>} sub={`${fmtInt(days.length)} days`} />
            <Tile label="Total contacts" value={fmtInt(total)} sub={`${fmtInt(total / days.length)} per day on average`} />
            <Tile label="Average handle time" value={avgAht ? `${Math.round(avgAht)}s` : '–'} sub={avgAht ? 'Volume-weighted' : `Using the default (${ws.settings.defaultAht}s) from Settings`} />
          </div>
          <div className="card">
            <div className="card-head"><h2>Daily contacts, last 26 weeks</h2>
              {h.kind === 'interval' && <span className="small muted">Intraday arrival pattern learnt from the last 8 weeks of intervals</span>}
            </div>
            <LineChart
              rows={recent.map((r) => ({ x: r.date, volume: r.volume }))}
              series={[{ key: 'volume', label: 'Contacts', color: 'var(--series-1)' }]}
              xFormat={(d, long) => formatDate(d, long ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } : undefined)}
              valueFormat={fmtInt}
            />
          </div>
        </>
      )}
    </div>
  )
}
