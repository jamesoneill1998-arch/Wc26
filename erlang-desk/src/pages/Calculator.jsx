import { useState } from 'react'
import { requiredAgents, staffingTable, withShrinkage } from '../engine/erlang.js'
import { PageHead, Tile, NumberField, SelectField } from '../components/ui.jsx'
import { fmtPct, fmtSec, fmt1 } from '../format.js'

export default function Calculator() {
  const [p, setP] = useState({ volume: 250, intervalMin: 30, ahtSec: 300, slTarget: 0.8, targetSec: 20, maxOccupancy: 0.88, shrinkage: 0.32, concurrency: 1 })
  const set = (k) => (v) => setP((cur) => ({ ...cur, [k]: v }))
  const args = { ...p, intervalSec: p.intervalMin * 60 }
  let r = null
  let table = []
  let error = null
  try {
    r = requiredAgents(args)
    table = r.agents > 0 && p.concurrency === 1 ? staffingTable(args, 9) : []
  } catch (e) {
    error = e.message
  }

  return (
    <div className="stack">
      <PageHead title="Erlang C calculator" sub="How many agents a single interval needs to hit your service target." />
      <div className="card">
        <div className="fields">
          <NumberField label="Contacts in interval" min={0} max={100000} value={p.volume} onChange={set('volume')} />
          <SelectField label="Interval length" value={String(p.intervalMin)} onChange={(v) => set('intervalMin')(Number(v))} options={[15, 30, 60].map((m) => ({ value: String(m), label: `${m} minutes` }))} />
          <NumberField label="Average handle time" suffix="sec" min={1} max={14400} value={p.ahtSec} onChange={set('ahtSec')} />
          <NumberField label="Service level goal" pct min={1} max={99.9} value={p.slTarget} onChange={set('slTarget')} />
          <NumberField label="Answered within" suffix="sec" min={0} max={3600} value={p.targetSec} onChange={set('targetSec')} />
          <NumberField label="Max occupancy" pct min={10} max={100} value={p.maxOccupancy} onChange={set('maxOccupancy')} />
          <NumberField label="Shrinkage" pct min={0} max={90} value={p.shrinkage} onChange={set('shrinkage')} />
          <NumberField label="Concurrency" min={1} max={10} step={0.5} value={p.concurrency} onChange={set('concurrency')} hint="Chats per agent; 1 for voice" />
        </div>
      </div>
      {error && <div className="notice warn">{error}</div>}
      {r && (
        <div className="tiles">
          <Tile hero label="Agents required" value={r.agents} sub={`${fmt1(r.traffic)} Erlangs of traffic`} />
          <Tile label="Agents to schedule" value={Math.ceil(withShrinkage(r.agents, p.shrinkage))} sub={`After ${fmtPct(p.shrinkage, 0)} shrinkage`} />
          <Tile label="Service level" value={fmtPct(r.serviceLevel)} sub={`answered in ${p.targetSec}s`} />
          <Tile label="Average speed of answer" value={fmtSec(r.asa)} />
          <Tile label="Occupancy" value={fmtPct(r.occupancy)} sub={`Probability of waiting ${fmtPct(r.pWait)}`} />
        </div>
      )}
      {table.length > 0 && (
        <div className="card">
          <div className="card-head"><h2>What each extra agent buys you</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Agents</th><th>Service level</th><th>ASA</th><th>Occupancy</th><th>Chance of waiting</th></tr></thead>
              <tbody>
                {table.map((row) => (
                  <tr key={row.agents} className={row.agents === r.agents ? 'hl' : ''}>
                    <td>{row.agents}{row.agents === r.agents ? ' ✓' : ''}</td>
                    <td>{fmtPct(row.serviceLevel)}</td>
                    <td>{fmtSec(row.asa)}</td>
                    <td>{fmtPct(row.occupancy)}</td>
                    <td>{fmtPct(row.pWait)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>
            Erlang C assumes callers wait rather than hang up, so it slightly overstates the agents you need when abandonment is high.
          </p>
        </div>
      )}
    </div>
  )
}
