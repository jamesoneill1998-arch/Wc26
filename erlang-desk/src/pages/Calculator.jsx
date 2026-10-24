import { useState } from 'react'
import { requiredAgents, metricsFor, withShrinkage } from '../engine/erlang.js'
import { requiredAgentsA, erlangA } from '../engine/erlangA.js'
import { siteShrinkage } from '../engine/channels.js'
import { PageHead, Figures, Figure, NumberField, SelectField, Panel } from '../components/ui.jsx'
import { fmtPct, fmtSec, fmt1 } from '../format.js'

export default function Calculator({ ws }) {
  const [p, setP] = useState({ volume: 250, intervalMin: 30, ahtSec: 300, slTarget: 0.8, targetSec: 20, maxOccupancy: 0.88, patienceSec: 120, concurrency: 1 })
  const set = (k) => (v) => setP((cur) => ({ ...cur, [k]: v }))
  const args = { ...p, intervalSec: p.intervalMin * 60 }
  const c = requiredAgents(args)
  const a = requiredAgentsA(args)
  const saved = c.agents - a.agents
  const k = Math.max(1, p.concurrency)
  const start = Math.max(1, Math.min(a.agents, c.agents) * k - 3)
  const rows = Array.from({ length: Math.max(c.agents, a.agents) * k - start + 3 }, (_, i) => start + i)

  return (
    <div className="stack">
      <PageHead eyebrow="Free tool" title="Erlang calculator" lede="Staff needed for a single interval, with Erlang C (everyone waits) and Erlang A (some give up) side by side." />
      <Panel>
        <div className="fields">
          <NumberField label="Contacts in interval" min={0} max={100000} value={p.volume} onChange={set('volume')} />
          <SelectField label="Interval" value={String(p.intervalMin)} onChange={(v) => set('intervalMin')(Number(v))} options={[15, 30, 60].map((m) => ({ value: String(m), label: `${m} minutes` }))} />
          <NumberField label="Average handle time" suffix="sec" min={1} max={14400} value={p.ahtSec} onChange={set('ahtSec')} />
          <NumberField label="Service level goal" pct min={1} max={99.9} value={p.slTarget} onChange={set('slTarget')} />
          <NumberField label="Answered within" suffix="sec" min={0} max={3600} value={p.targetSec} onChange={set('targetSec')} />
          <NumberField label="Average patience" suffix="sec" min={5} max={3600} value={p.patienceSec} onChange={set('patienceSec')} hint="Erlang A only" />
          <NumberField label="Maximum occupancy" pct min={10} max={100} value={p.maxOccupancy} onChange={set('maxOccupancy')} />
          <NumberField label="Concurrency" min={1} max={10} step={0.5} value={p.concurrency} onChange={set('concurrency')} hint="Chats per agent; 1 for voice" />
        </div>
      </Panel>

      <Figures>
        <Figure hero label="Erlang A" value={a.agents} sub={`SL ${fmtPct(a.serviceLevel)} · abandon ${fmtPct(a.pAbandon)} · wait ${fmtSec(a.avgWait)}`} />
        <Figure label="Erlang C" value={c.agents} sub={`SL ${fmtPct(c.serviceLevel)} · ASA ${fmtSec(c.asa)}`} />
        <Figure label="Difference" value={saved > 0 ? `${saved} fewer` : saved < 0 ? `${-saved} more` : 'None'} sub={saved > 0 ? `${fmtPct(saved / c.agents, 0)} lower with Erlang A` : 'Abandonment makes little difference here'} />
        <Figure label="Traffic" value={`${fmt1(c.traffic)} E`} sub="Erlangs: agents busy on average" />
      </Figures>

      <Panel title="Rostered, by site" aside="Staff on duty grossed up for each site's shrinkage">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Site</th><th>Shrinkage</th><th>Erlang A</th><th>Erlang C</th></tr></thead>
            <tbody>
              {ws.sites.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{fmtPct(siteShrinkage(s), 0)}</td>
                  <td>{Math.ceil(withShrinkage(a.agents, siteShrinkage(s)))}</td>
                  <td>{Math.ceil(withShrinkage(c.agents, siteShrinkage(s)))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="What each extra person buys">
        <div className="table-wrap">
          <table>
            <thead><tr><th>{k > 1 ? 'Chat slots' : 'Staff'}</th><th>SL · Erlang A</th><th>Abandon</th><th>SL · Erlang C</th><th>ASA · Erlang C</th><th>Occupancy</th></tr></thead>
            <tbody>
              {rows.map((n) => {
                const ra = erlangA(n, { volume: p.volume, ahtSec: p.ahtSec, intervalSec: args.intervalSec, patienceSec: p.patienceSec, targetSec: p.targetSec })
                const rc = metricsFor(n, args)
                return (
                  <tr key={n} className={n === a.agents * k ? 'hl' : ''}>
                    <td>{n}{n === a.agents * k ? ' · Erlang A' : ''}{n === c.agents * k ? ' · Erlang C' : ''}</td>
                    <td>{fmtPct(ra.serviceLevel)}</td>
                    <td>{fmtPct(ra.pAbandon)}</td>
                    <td>{n > rc.traffic ? fmtPct(rc.serviceLevel) : '–'}</td>
                    <td>{n > rc.traffic ? fmtSec(rc.asa) : '–'}</td>
                    <td>{fmtPct(ra.occupancy)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="small faint" style={{ marginTop: 12 }}>
          Erlang A service level counts calls answered within the threshold out of those that didn't hang up inside it, the usual reporting convention.
        </p>
      </Panel>
    </div>
  )
}
