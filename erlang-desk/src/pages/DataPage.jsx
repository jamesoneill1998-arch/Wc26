import { useRef, useState } from 'react'
import { parseHistoryCSV, toCSV, MAX_IMPORT_BYTES } from '../engine/csv.js'
import { formatDate } from '../engine/dates.js'
import { unusualDays } from '../engine/forecast.js'
import { bankHolidays } from '../engine/holidays.js'
import { CHANNELS } from '../engine/channels.js'
import { buildSampleWorkspace, historyFrom, sampleHistory } from '../state/sample.js'
import { clearStoredWorkspace, emptyWorkspace } from '../state/store.js'
import { PageHead, Figures, Figure, Panel, Locked, ConfirmButton } from '../components/ui.jsx'
import { LineChart } from '../components/charts.jsx'
import { downloadText, fmtInt, fmtPct } from '../format.js'
import { NoServices, serviceEyebrow } from './common.jsx'

const longDate = (d) => formatDate(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

/**
 * Outages and one-off incidents, left out of the forecast at the planner's
 * request. Suggestions come from days far off the same weekday nearby.
 */
function UnusualDays({ active, site, days, unit, updateActive }) {
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const excluded = active.excludedDays ?? []
  const excludedSet = new Set(excluded.map((x) => x.date))
  const first = days[0].date
  const last = days[days.length - 1].date
  const holidays = bankHolidays(Number(first.slice(0, 4)), Number(last.slice(0, 4)), site?.holidayRegion)
  const suggestions = unusualDays(days, { holidays, excluded: excludedSet })
  const byDate = new Map(days.map((r) => [r.date, r.volume]))
  const save = (list) => updateActive({ excludedDays: [...new Map(list.map((x) => [x.date, x])).values()].sort((a, b) => (a.date < b.date ? -1 : 1)) })
  const leaveOut = (d, why) => save([...excluded, { date: d, note: why.slice(0, 80) }])
  const putBack = (d) => save(excluded.filter((x) => x.date !== d))
  const add = (e) => {
    e.preventDefault()
    if (!date || date < first || date > last) return
    leaveOut(date, note.trim())
    setDate(''); setNote('')
  }
  return (
    <Panel title="Unusual days" aside={excluded.length ? `${excluded.length} left out of the forecast` : undefined}>
      <p className="muted small" style={{ marginBottom: 14 }}>
        Outages, system faults and one-off incidents distort the forecast. A day you leave out is treated like a gap in the export: the forecast,
        handle time and intraday shape use the same weekday in nearby weeks instead. Bank holidays are handled automatically, so they don't need leaving out.
      </p>
      {suggestions.length > 0 ? (
        <>
          <h3 style={{ marginBottom: 6 }}>Worth checking</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Day</th><th>{unit[0].toUpperCase() + unit.slice(1)}</th><th>Typical for that weekday</th><th>Difference</th><th><span className="sr-only">Action</span></th></tr></thead>
              <tbody>
                {suggestions.map((u) => {
                  const diff = u.ratio - 1
                  const why = `${diff < 0 ? 'Unusually low' : 'Unusually high'}: ${diff < 0 ? '−' : '+'}${fmtPct(Math.abs(diff), 0)} on a typical ${formatDate(u.date, { weekday: 'long' })}`
                  return (
                    <tr key={u.date}>
                      <td>{longDate(u.date)}</td>
                      <td>{fmtInt(u.volume)}</td>
                      <td>{fmtInt(u.expected)}</td>
                      <td className={diff < 0 ? 'bad' : ''}>{diff < 0 ? '−' : '+'}{fmtPct(Math.abs(diff), 0)}</td>
                      <td><button className="btn sm" type="button" onClick={() => leaveOut(u.date, why)}>Leave out</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : <p className="small" style={{ marginBottom: 6 }}>{excluded.length ? 'Nothing else stands out in the last year.' : 'Nothing stands out in the last year.'}</p>}

      {excluded.length > 0 && (
        <>
          <h3 style={{ margin: '18px 0 6px' }}>Left out of the forecast</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Day</th><th>{unit[0].toUpperCase() + unit.slice(1)}</th><th className="text">Reason</th><th><span className="sr-only">Action</span></th></tr></thead>
              <tbody>
                {excluded.map((x) => (
                  <tr key={x.date}>
                    <td>{longDate(x.date)}</td>
                    <td>{byDate.has(x.date) ? fmtInt(byDate.get(x.date)) : <span className="faint">not in history</span>}</td>
                    <td className="text">{x.note || <span className="faint">–</span>}</td>
                    <td><button className="btn sm" type="button" onClick={() => putBack(x.date)}>Put back</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <form className="row" style={{ marginTop: 16, alignItems: 'flex-end' }} onSubmit={add}>
        <div className="field">
          <label htmlFor="exclude-date">Leave out another day</label>
          <input id="exclude-date" type="date" min={first} max={last} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 200 }}>
          <label htmlFor="exclude-note">Reason (optional)</label>
          <input id="exclude-note" type="text" maxLength={80} value={note} placeholder="e.g. Telephony outage" onChange={(e) => setNote(e.target.value)} />
        </div>
        <button className="btn" type="submit" disabled={!date || date < first || date > last || excludedSet.has(date)}>Leave out</button>
      </form>
    </Panel>
  )
}

export default function DataPage({ ws, active, site, updateActive, replace, account }) {
  const [msg, setMsg] = useState(null)
  const [over, setOver] = useState(false)
  const [pending, setPending] = useState(null) // a multi-queue file waiting for the planner to pick a queue
  const fileRef = useRef(null)
  const wsRef = useRef(null)
  if (!active) return <NoServices title="Data" replace={replace} account={account} />
  const h = active.history
  const unit = CHANNELS[active.channel].unit

  const commit = (res, source) => {
    if (!res.rows.length) return setMsg({ ok: false, text: res.errors.join(' ') || 'No rows found.' })
    updateActive({ history: historyFrom(res.kind, res.rows, source.slice(0, 120)), hires: [] })
    const c = res.columns
    const read = [`dates${c.time ? '' : res.kind === 'interval' ? ' and times' : ''} from "${c.date}"`, c.time && `times from "${c.time}"`, `volume from "${c.volume}"`, c.aht && `handle time from "${c.aht}"`].filter(Boolean).join(', ')
    const skipped = res.errors.length ? ` ${res.errors.length >= 10 ? '10 or more' : res.errors.length} rows were skipped, e.g. ${res.errors[0]}` : ''
    setMsg({ ok: !res.errors.length, text: `Imported ${fmtInt(res.rows.length)} ${res.kind} rows into ${active.name}. Read ${read}. ${res.notes.join(' ')}${skipped}`.trim() })
  }
  const readFile = async (file) => {
    if (!file) return
    if (file.size > MAX_IMPORT_BYTES) return setMsg({ ok: false, text: 'That file is over 25 MB. Export a shorter date range.' })
    const text = await file.text()
    const res = parseHistoryCSV(text)
    if (res.queues.length > 1 && res.rows.length) { setMsg(null); return setPending({ text, name: file.name, queues: res.queues, column: res.columns.queue }) }
    setPending(null)
    commit(res, file.name)
  }
  const chooseQueue = (queue) => {
    const res = parseHistoryCSV(pending.text, { queue })
    commit(res, queue === '*' ? `${pending.name} (all queues)` : `${pending.name} · ${queue}`)
    setPending(null)
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

      {pending && (
        <Panel title="This file holds several queues" aside={<button className="btn link" type="button" onClick={() => setPending(null)}>Cancel</button>}>
          <p className="muted small" style={{ marginBottom: 12 }}>{`"${pending.column}" has ${pending.queues.length} values. Pick the one that belongs to ${active.name}, or combine them all.`}</p>
          <div className="queue-pick">
            {pending.queues.slice(0, 30).map((q) => (
              <button key={q.name} className="btn" type="button" onClick={() => chooseQueue(q.name)}>{q.name}<span className="faint">{fmtInt(q.volume)}</span></button>
            ))}
            <button className="btn primary" type="button" onClick={() => chooseQueue('*')}>All queues combined</button>
          </div>
        </Panel>
      )}

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
                  Interval or daily exports from Genesys, NICE, Avaya, Amazon Connect, Five9 or Excel. Needs a date (or interval start) and a volume such as
                  calls offered; handle time is used if present. Read on this device; nothing is uploaded.
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
          <UnusualDays active={active} site={site} days={days} unit={unit} updateActive={updateActive} />
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
