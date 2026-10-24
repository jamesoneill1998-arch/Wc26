import { useEffect, useState } from 'react'

/** Numeric input that lets people type freely and commits valid numbers. `pct` shows fractions as %. */
export function NumberField({ label, value, onChange, pct = false, step = 1, min, max, hint, suffix, id, disabled }) {
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
        disabled={disabled}
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

export function SelectField({ label, value, onChange, options, id, hint }) {
  const fid = id ?? `s-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className="field">
      <label htmlFor={fid}>{label}</label>
      <select id={fid} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

export function TextField({ label, value, onChange, id, maxLength = 80, type = 'text', placeholder, autoComplete }) {
  const fid = id ?? `t-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className="field">
      <label htmlFor={fid}>{label}</label>
      <input id={fid} type={type} value={value} maxLength={maxLength} placeholder={placeholder} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
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

export function Figures({ children }) {
  return <div className="board" role="group" aria-label="Headline figures">{children}</div>
}

export function Figure({ label, value, sub, hero, text }) {
  return (
    <div className={`figure${hero ? ' hero' : ''}`}>
      <div className="flabel">{label}</div>
      <div className={`value${text ? ' text' : ''}`}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

/** Surplus/shortfall with a glyph and sign, never colour alone. */
export function Gap({ value, unit = 'FTE' }) {
  if (!Number.isFinite(value)) return '–'
  const ok = value >= -0.5
  return (
    <span className={`status ${ok ? 'good' : 'bad'}`}>
      <span className="glyph" aria-hidden="true">{ok ? '▲' : '▼'}</span>
      {value >= 0 ? '+' : '−'}{Math.abs(value).toFixed(1)}{unit ? ` ${unit}` : ''}
      <span className="sr-only">{ok ? 'covered' : 'short'}</span>
    </span>
  )
}

export function PageHead({ eyebrow, title, lede, children }) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <div className="label">{eyebrow}</div>}
        <h1>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </header>
  )
}

export function Panel({ title, aside, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      {(title || aside) && (
        <div className="panel-head">
          {title && <h2>{title}</h2>}
          {aside && <div className="row small muted">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

/** Shown in place of a paid action when billing is on and the user isn't entitled. */
export function Locked({ account, what }) {
  return (
    <div className="lock">
      <div>
        <b>{what} is part of Pro.</b>{' '}
        <span className="muted">{account.signedIn ? 'Start a 14-day trial to use it with your own data.' : 'Sign in, then start a 14-day trial. No card needed to explore the sample.'}</span>
      </div>
      <a className="btn primary sm" href="#/app/account">{account.signedIn ? 'Start trial' : 'Sign in'}</a>
    </div>
  )
}

/** Brand mark: a queue of three calls shortening as agents pick up. */
export function Mark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M4 6h16M4 12h11M4 18h6" />
    </svg>
  )
}

/**
 * A destructive action that needs a second click within a few seconds.
 * Used instead of window.confirm(), which some embedded viewers suppress.
 */
export function ConfirmButton({ children, confirmLabel = 'Click again to confirm', onConfirm, className = 'btn' }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return undefined
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button type="button" className={`${className}${armed ? ' armed' : ''}`} aria-live="polite" onClick={() => { if (armed) { setArmed(false); onConfirm() } else setArmed(true) }}>
      {armed ? confirmLabel : children}
    </button>
  )
}
