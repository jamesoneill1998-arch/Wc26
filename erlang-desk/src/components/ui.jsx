import { useEffect, useState } from 'react'

/** Numeric input that lets people type freely and commits valid numbers. `pct` shows fractions as %. */
export function NumberField({ label, value, onChange, pct = false, step = 1, min, max, hint, suffix, id }) {
  const toText = (v) => (v == null || v === '' ? '' : String(pct ? +(v * 100).toFixed(4) : v))
  const [text, setText] = useState(toText(value))
  useEffect(() => setText(toText(value)), [value]) // eslint-disable-line react-hooks/exhaustive-deps
  const fid = id ?? `f-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className="field">
      <label htmlFor={fid}>{label}{suffix ? ` (${suffix})` : pct ? ' (%)' : ''}</label>
      <input
        id={fid}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const n = Number(e.target.value)
          if (e.target.value !== '' && Number.isFinite(n)) {
            let v = pct ? n / 100 : n
            if (min != null) v = Math.max(pct ? min / 100 : min, v)
            if (max != null) v = Math.min(pct ? max / 100 : max, v)
            onChange(v)
          }
        }}
        onBlur={() => setText(toText(value))}
      />
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

export function SelectField({ label, value, onChange, options, id }) {
  const fid = id ?? `s-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className="field">
      <label htmlFor={fid}>{label}</label>
      <select id={fid} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className={o.value === value ? 'on' : ''} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Tile({ label, value, sub, hero }) {
  return (
    <div className={`tile${hero ? ' hero' : ''}`}>
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {sub && <div className="tile-sub">{sub}</div>}
    </div>
  )
}

/** Surplus/shortfall with icon + sign, never colour alone. */
export function Gap({ value, unit = 'FTE' }) {
  if (!Number.isFinite(value)) return '–'
  const ok = value >= -0.5
  return (
    <span className={`status ${ok ? 'good' : 'bad'}`}>
      <span aria-hidden="true">{ok ? '▲' : '▼'}</span>
      {value >= 0 ? '+' : '−'}{Math.abs(value).toFixed(1)} {unit}
      <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{ok ? 'covered' : 'short'}</span>
    </span>
  )
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  )
}

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
export const Icon = {
  overview: <svg viewBox="0 0 24 24" {...P}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>,
  data: <svg viewBox="0 0 24 24" {...P}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg>,
  forecast: <svg viewBox="0 0 24 24" {...P}><path d="M3 17l5-5 4 3 8-8" /><path d="M15 7h5v5" /></svg>,
  staffing: <svg viewBox="0 0 24 24" {...P}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" /></svg>,
  capacity: <svg viewBox="0 0 24 24" {...P}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><path d="M17 4.5a3.5 3.5 0 010 7M19 14.8c1.4.9 2.2 2.6 2.5 5.2" /></svg>,
  calculator: <svg viewBox="0 0 24 24" {...P}><rect x="5" y="2.5" width="14" height="19" rx="2" /><path d="M8.5 7h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" /></svg>,
  settings: <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>,
  shield: <svg viewBox="0 0 24 24" {...P}><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>,
  upload: <svg viewBox="0 0 24 24" {...P}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" /></svg>,
  moon: <svg viewBox="0 0 24 24" {...P}><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" /></svg>,
}
