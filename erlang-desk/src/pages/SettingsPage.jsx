import { WEEKDAYS } from '../engine/dates.js'
import { DEFAULT_SETTINGS } from '../state/store.js'
import { PageHead, NumberField, SelectField } from '../components/ui.jsx'

export default function SettingsPage({ ws, update }) {
  const s = ws.settings
  const set = (patch) => update({ settings: { ...s, ...patch } })
  const setHours = (wd, h) => set({ hours: s.hours.map((x, i) => (i === wd ? h : x)) })

  return (
    <div className="stack">
      <PageHead title="Settings" sub="Service targets and working assumptions used across the forecast, staffing and plan." />

      <div className="card">
        <div className="card-head"><h2>Workspace</h2></div>
        <div className="fields">
          <div className="field">
            <label htmlFor="ws-name">Name</label>
            <input id="ws-name" value={ws.name} onChange={(e) => update({ name: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Service targets</h2></div>
        <div className="fields">
          <NumberField label="Service level goal" pct min={1} max={99.9} value={s.slTarget} onChange={(slTarget) => set({ slTarget })} />
          <NumberField label="Answered within" suffix="sec" min={0} max={3600} value={s.targetSec} onChange={(targetSec) => set({ targetSec })} />
          <NumberField label="ASA ceiling" suffix="sec" min={0} max={3600} value={s.asaTarget} onChange={(asaTarget) => set({ asaTarget })} hint="0 = no ASA target" />
          <NumberField label="Max occupancy" pct min={10} max={100} value={s.maxOccupancy} onChange={(maxOccupancy) => set({ maxOccupancy })} />
          <NumberField label="Minimum agents when open" min={0} max={100} value={s.minAgents} onChange={(minAgents) => set({ minAgents: Math.round(minAgents) })} />
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Workload & people</h2></div>
        <div className="fields">
          <SelectField label="Interval length" value={String(s.intervalMin)} onChange={(v) => set({ intervalMin: Number(v) })} options={[15, 30, 60].map((m) => ({ value: String(m), label: `${m} minutes` }))} />
          <NumberField label="Default AHT" suffix="sec" min={1} max={14400} value={s.defaultAht} onChange={(defaultAht) => set({ defaultAht })} hint="Used when history has no AHT" />
          <NumberField label="Concurrency" min={1} max={10} step={0.5} value={s.concurrency} onChange={(concurrency) => set({ concurrency })} hint="Chats per agent; 1 for voice" />
          <NumberField label="Shrinkage" pct min={0} max={90} value={s.shrinkage} onChange={(shrinkage) => set({ shrinkage })} hint="Breaks, training, absence, meetings" />
          <NumberField label="Hours per FTE" suffix="per week" min={1} max={80} step={0.5} value={s.fteHoursPerWeek} onChange={(fteHoursPerWeek) => set({ fteHoursPerWeek })} />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Opening hours</h2>
          <span className="small muted">Minimum staffing applies inside these hours. With interval history, arrivals follow your data.</span>
        </div>
        <div className="table-wrap">
          <table style={{ maxWidth: 520 }}>
            <thead><tr><th>Day</th><th style={{ textAlign: 'left' }}>Open</th><th style={{ textAlign: 'left' }}>Opens</th><th style={{ textAlign: 'left' }}>Closes</th></tr></thead>
            <tbody>
              {WEEKDAYS.map((d, wd) => {
                const h = s.hours[wd]
                return (
                  <tr key={d}>
                    <td>{d}</td>
                    <td style={{ textAlign: 'left' }}>
                      <input type="checkbox" aria-label={`Open on ${d}`} style={{ width: 'auto' }} checked={!!h}
                        onChange={(e) => setHours(wd, e.target.checked ? { open: '09:00', close: '17:00' } : null)} />
                    </td>
                    <td style={{ textAlign: 'left' }}>{h && <input type="time" aria-label={`${d} opens`} value={h.open} step={s.intervalMin * 60} onChange={(e) => setHours(wd, { ...h, open: e.target.value })} />}</td>
                    <td style={{ textAlign: 'left' }}>{h && <input type="time" aria-label={`${d} closes`} value={h.close} step={s.intervalMin * 60} onChange={(e) => setHours(wd, { ...h, close: e.target.value })} />}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div><button className="btn ghost" type="button" onClick={() => { if (confirm('Reset all settings to defaults?')) set(DEFAULT_SETTINGS) }}>Reset to defaults</button></div>
    </div>
  )
}
