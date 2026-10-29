import { useRef, useState } from 'react'
import { parseHistoryCSV, toCSV, MAX_IMPORT_BYTES } from '../engine/csv.js'
import { formatDate } from '../engine/dates.js'
import { CHANNELS } from '../engine/channels.js'
import { buildSampleWorkspace, historyFrom, sampleHistory } from '../state/sample.js'
import { clearStoredWorkspace, emptyWorkspace } from '../state/store.js'
import { PageHead, Figures, Figure, Panel, Locked, ConfirmButton } from '../components/ui.jsx'
import { LineChart } from '../components/charts.jsx'
import { downloadText, fmtInt } from '../format.js'
import { NoServices, serviceEyebrow } from './common.jsx'

export default function DataPage({ ws, active, site, updateActive, replace, account }) {
  const [msg, setMsg] = useState(null)
  const [over, setOver] = useState(false)
  const fileRef = useRef(null)
  const wsRef = useRef(null)
  if (!active) return <NoServices title="Data" replace={replace} account={account} />
  const h = active.history
  const unit = CHANNELS[active.channel].unit

  const readFile = async (file) => {
    if (!file) return
    if (file.size > MAX_IMPORT_BYTES) return setMsg({ ok: false, text: 'That file is over 25 MB. Export a shorter date range.' })
    const res = parseHistoryCSV(await file.text())
    if (!res.rows.length) return setMsg({ ok: false, text: res.errors.join(' ') || 'No rows found.' })
    updateActive({ history: historyFrom(res.kind, res.rows, file.name.slice(0, 120)), hires: [] })
    const skipped = res.errors.length ? ` ${res.errors.length >= 10 ? '10 or more' : res.errors.length} rows were skipped, e.g. ${res.errors[0]}` : ''
    setMsg({ ok: !res.errors.length, text: `Imported ${fmtInt(res.rows.length)} ${res.kind} rows into ${active.name}.${skipped}` })
  }

  const exportWorkspace = () => downloadText(`erlang-desk-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(ws), 'application/json')
  const importWorkspace = async (file) => {
    if (!file) return
    if (file.size > 50 * 1024 * 1024) return setMsg({ ok: false, text: 'That file is too large to be a workspace.' })
    try {
      replace(JSON.parse(await file.text()))
      setMsg({ ok: true, text: 'Workspace restored.' })
    } catch {
      setMsg({ ok: false, text: 'That file is not an Erlang Desk workspace export.' })
    }
  }
  const template = () => downloadText('erlang-desk-template.csv', toCSV(
    [{ label: 'date', get: (r) => r[0] }, { label: 'time', get: (r) => r[1] }, { label: 'volume', get: (r) => r[2] }, { label: 'aht', get: (r) => r[3] }],
    [['2026-01-05', '08:00', 42, 315], ['2026-01-05', '08:30', 61, 298], ['2026-01-05', '09:00', 88, 305]],
  ))

  const days = h?.dailyRows ?? []
  const total = days.reduce((s, r) => s + r.volume, 0)
  const withAht = days.filter((r) => r.aht)
  const ahtVol = withAht.reduce((s, r) => s + r.volume, 0)
  const avgAht = ahtVol ? withAht.reduce((s, r) => s + r.aht * r.volume, 0) / ahtVol : null

  return (
    <div className="stack">
      <PageHead eyebrow={serviceEyebrow(active, site)} title="Data" lede={`History of ${unit} for this service. Daily totals are enough; interval data gives truer intraday staffing.`} />

      {msg && <div className={`notice${msg.ok ? ' ok' : ''}`} role="status">{msg.text}</div>}

      <div className="cols">
        <Panel title="Import a CSV" aside={<button className="btn link" type="button" onClick={template}>Download template</button>}>
          {account.entitled ? (
            <>
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
                <b>Drop a CSV here, or choose a file</b>
                <p className="small muted" style={{ marginTop: 8 }}>
                  Columns <code>date</code>, <code>volume</code>, and optionally <code>time</code> and <code>aht</code> (seconds).
                  Common ACD headings such as "Calls Offered" are recognised. Read on this device; nothing is uploaded.
                </p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { readFile(e.target.files[0]); e.target.value = '' }} />
            </>
          ) : (
            <Locked account={account} what="Importing your own data" />
          )}
        </Panel>

        <Panel title="Sample data">
          <div className="stack-s">
            <p className="muted small">Two years of realistic {CHANNELS[active.channel].label.toLowerCase()} history with trend, weekly and annual seasonality and bank-holiday dips.</p>
            <div className="row">
              <button className="btn" type="button" onClick={() => { updateActive({ history: sampleHistory(active.channel), hires: [], capacity: { ...active.capacity, calibrate: true } }); setMsg({ ok: true, text: `Loaded sample ${CHANNELS[active.channel].label.toLowerCase()} history into ${active.name}.` }) }}>Sample for this service</button>
              <ConfirmButton confirmLabel="Click again to replace your workspace" onConfirm={() => replace(buildSampleWorkspace())}>Load the sample operation</ConfirmButton>
            </div>
          </div>
        </Panel>
      </div>

      {h && days.length > 0 && (
        <>
          <Figures>
            <Figure label="Source" value={h.source} text sub={h.kind === 'interval' ? 'Interval data' : 'Daily totals'} />
            <Figure label="Period" value={`${fmtInt(days.length)} days`} sub={`${formatDate(days[0].date, { day: 'numeric', month: 'short', year: 'numeric' })} to ${formatDate(days[days.length - 1].date, { day: 'numeric', month: 'short', year: 'numeric' })}`} />
            <Figure label={`Total ${unit}`} value={fmtInt(total)} sub={`${fmtInt(total / days.length)} a day on average`} />
            <Figure label="Average handle time" value={avgAht ? `${Math.round(avgAht)}s` : '–'} sub={avgAht ? 'Volume-weighted' : `Using ${active.settings.defaultAht}s from service settings`} />
          </Figures>
          <Panel title={`Daily ${unit}, last 26 weeks`}>
            <LineChart
              rows={days.slice(-182).map((r) => ({ x: r.date, volume: r.volume }))}
              series={[{ key: 'volume', label: unit[0].toUpperCase() + unit.slice(1), color: 'var(--series-1)' }]}
              xFormat={(d, long) => formatDate(d, long ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } : undefined)}
              valueFormat={fmtInt}
            />
          </Panel>
        </>
      )}

      <Panel title="Workspace">
        <div className="stack-s">
          <p className="muted small">Everything lives in this browser. Export a copy to move it to another device or hand it to a colleague. Imported workspaces are checked field by field before they load.</p>
          {account.entitled ? (
            <div className="row">
              <button className="btn" type="button" onClick={exportWorkspace}>Export workspace</button>
              <button className="btn" type="button" onClick={() => wsRef.current?.click()}>Import workspace</button>
              <input ref={wsRef} type="file" accept=".json,application/json" hidden onChange={(e) => { importWorkspace(e.target.files[0]); e.target.value = '' }} />
            </div>
          ) : <Locked account={account} what="Exporting and importing workspaces" />}
          <div className="row">
            {h && <ConfirmButton className="btn sm" confirmLabel="Click again to clear" onConfirm={() => updateActive({ history: null, hires: [] })}>Clear this service's history</ConfirmButton>}
            <ConfirmButton className="btn sm" confirmLabel="Click again to erase everything" onConfirm={() => { clearStoredWorkspace(); replace(emptyWorkspace()) }}>Erase all data on this device</ConfirmButton>
          </div>
        </div>
      </Panel>
    </div>
  )
}
