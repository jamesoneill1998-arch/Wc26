import { SHRINKAGE_COMPONENTS, siteShrinkage, defaultSites } from '../engine/channels.js'
import { PageHead, NumberField, TextField, Panel, Figures, Figure, ConfirmButton } from '../components/ui.jsx'
import { fmtPct } from '../format.js'

function PctCell({ value, onChange, label }) {
  return (
    <input
      type="number" inputMode="decimal" step="0.5" min="0" max="90" aria-label={label}
      value={+(value * 100).toFixed(2)}
      style={{ width: 84, textAlign: 'right' }}
      onChange={(e) => { const n = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(n)) onChange(Math.min(0.9, Math.max(0, n / 100))) }}
    />
  )
}

export default function SitesPage({ ws, update, updateSite }) {
  const used = (id) => ws.services.filter((s) => s.siteId === id).length
  const productive = (site) => site.fteHoursPerWeek * (1 - siteShrinkage(site))
  return (
    <div className="stack">
      <PageHead eyebrow="Operation" title="Sites & shrinkage" lede="Each site carries its own shrinkage, contracted hours and attrition. UK operations typically lose around 35% of paid time to shrinkage; offshore centres nearer 20%. Edit the components to match your own." />

      <Figures>
        {ws.sites.map((site) => (
          <Figure key={site.id} label={site.name} value={fmtPct(siteShrinkage(site), 1)} sub={`${productive(site).toFixed(1)} productive hours from a ${site.fteHoursPerWeek}h week`} />
        ))}
      </Figures>

      <Panel title="Shrinkage by component" aside="Percent of paid hours">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Component</th>{ws.sites.map((s) => <th key={s.id}>{s.code}</th>)}</tr>
            </thead>
            <tbody>
              {SHRINKAGE_COMPONENTS.map(([key, label]) => (
                <tr key={key}>
                  <td>{label}</td>
                  {ws.sites.map((s) => (
                    <td key={s.id}><PctCell label={`${label}, ${s.name}`} value={s.shrinkage[key] ?? 0} onChange={(v) => updateSite(s.id, { shrinkage: { ...s.shrinkage, [key]: v } })} /></td>
                  ))}
                </tr>
              ))}
              <tr className="total">
                <td>Total shrinkage</td>
                {ws.sites.map((s) => <td key={s.id}>{fmtPct(siteShrinkage(s), 1)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="cols">
        {ws.sites.map((site) => (
          <Panel key={site.id} title={site.name} aside={`${used(site.id)} service${used(site.id) === 1 ? '' : 's'}`}>
            <div className="fields">
              <TextField label="Name" value={site.name} maxLength={60} onChange={(name) => updateSite(site.id, { name })} />
              <TextField label="Short code" value={site.code} maxLength={4} onChange={(code) => updateSite(site.id, { code: code.toUpperCase() })} />
              <NumberField label="Contracted hours per FTE" suffix="per week" min={1} max={80} step={0.5} value={site.fteHoursPerWeek} onChange={(fteHoursPerWeek) => updateSite(site.id, { fteHoursPerWeek })} />
              <NumberField label="Attrition" pct suffix="% per month" min={0} max={50} step={0.1} value={site.monthlyAttrition} onChange={(monthlyAttrition) => updateSite(site.id, { monthlyAttrition })} />
            </div>
            {ws.sites.length > 1 && used(site.id) === 0 && (
              <button className="btn sm" type="button" style={{ marginTop: 16 }} onClick={() => update((cur) => ({ sites: cur.sites.filter((s) => s.id !== site.id) }))}>Remove site</button>
            )}
          </Panel>
        ))}
      </div>

      <div className="row">
        <button className="btn" type="button" disabled={ws.sites.length >= 10} onClick={() => update((cur) => ({
          sites: [...cur.sites, { ...defaultSites()[0], id: Math.random().toString(36).slice(2, 10), name: 'New site', code: `S${cur.sites.length + 1}` }],
        }))}>Add a site</button>
        <ConfirmButton confirmLabel="Click again to reset to 35% / 20%" onConfirm={() => update((cur) => ({ sites: cur.sites.map((s) => defaultSites().find((d) => d.id === s.id) ?? s) }))}>Reset UK & offshore defaults</ConfirmButton>
      </div>
    </div>
  )
}
