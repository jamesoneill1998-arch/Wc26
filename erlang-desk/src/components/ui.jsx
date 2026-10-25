import { useEffect, useState } from 'react'

const SHORT_UNITS = { sec: 's', weeks: 'wks', 'per week': 'h/wk', 'working days': 'days', months: 'mo', '% per month': '%/mo' }

/**
 * Numeric input that lets people type freely and commits valid numbers.
 * `pct` shows fractions as %. The unit sits inside the field; `slider`
 * adds a range control for quick what-if adjustment.
 */
export function NumberField({ label, value, onChange, pct = false, step = 1, min, max, hint, suffix, id, disabled, slider = false }) {
  const toText = (v) => (v == null || v === '' ? '' : String(pct ? +(v * 100).toFixed(4) : v))
  const [text, setText] = useState(toText(value))
  useEffect(() => setText(toText(value)), [value]) // eslint-disable-line react-hooks/exhaustive-deps
  const fid = id ?? `f-${label.replace(/\W+/g, '-').toLowerCase()}`
  const unit = suffix ? SHORT_UNITS[suffix] ?? suffix : pct ? '%' : null
  const commit = (raw) => {
    const n = Number(raw)
    if (raw === '' || !Number.isFinite(n)) return
    let v = pct ? n / 100 : n
    if (min != null) v = Math.max(pct ? min / 100 : min, v)
    if (max != null) v = Math.min(pct ? max / 100 : max, v)
    onChange(v)
  }
  return (
    <div className="field">
      <label htmlFor={fid}>{label}</label>
      <div className={`input-unit${unit ? '' : ' bare'}`}>
        <input
          id={fid}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={text}
          disabled={disabled}
          onChange={(e) => { setText(e.target.value); commit(e.target.value) }}
          onBlur={() => setText(toText(value))}
        />
        {unit && <span className="unit" aria-hidden="true">{unit}</span>}
      </div>
      {slider && (Array.isArray(slider) || (min != null && max != null)) && (
        <input
          className="slider"
          type="range"
          aria-label={`${label} slider`}
          min={Array.isArray(slider) ? slider[0] : min}
          max={Array.isArray(slider) ? slider[1] : max}
          step={step}
          value={text === '' ? 0 : Number(text)}
          disabled={disabled}
          onChange={(e) => { setText(e.target.value); commit(e.target.value) }}
        />
      )}
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

/**
 * Surplus/shortfall with a glyph and sign, never colour alone. Within half
 * a person either side counts as balanced.
 */
export function Gap({ value, unit = 'FTE' }) {
  if (!Number.isFinite(value)) return '–'
  const state = value >= 0 ? 'good' : value > -0.5 ? 'even' : 'bad'
  return (
    <span className={`status ${state}`}>
      <span className="glyph" aria-hidden="true">{{ good: '▲', even: '●', bad: '▼' }[state]}</span>
      {value >= 0 ? '+' : '−'}{Math.abs(value).toFixed(1)}{unit ? ` ${unit}` : ''}
      <span className="sr-only">{{ good: 'covered', even: 'roughly balanced', bad: 'short' }[state]}</span>
    </span>
  )
}

/** Tiny trend line with a zero rule, for tables. */
export function Sparkline({ values, width = 120, height = 28, label }) {
  const v = values.filter(Number.isFinite)
  if (v.length < 2) return null
  const lo = Math.min(0, ...v)
  const hi = Math.max(0, ...v)
  const span = hi - lo || 1
  const x = (i) => 2 + (i / (v.length - 1)) * (width - 6)
  const y = (n) => 3 + (1 - (n - lo) / span) * (height - 6)
  const d = v.map((n, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(n).toFixed(1)}`).join('')
  const last = v[v.length - 1]
  const worst = v.reduce((m, n, i) => (n < v[m] ? i : m), 0)
  return (
    <svg className="spark" width={width} height={height} role="img" aria-label={label}>
      <line x1="0" x2={width} y1={y(0)} y2={y(0)} stroke="var(--axis)" strokeWidth="1" />
      <path d={d} fill="none" stroke="var(--series-1)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      {v[worst] < -0.5 && <circle cx={x(worst)} cy={y(v[worst])} r="2.6" fill="var(--critical)" stroke="var(--surface)" strokeWidth="1.2" />}
      <circle cx={x(v.length - 1)} cy={y(last)} r="2.8" fill="var(--series-1)" stroke="var(--surface)" strokeWidth="1.2" />
    </svg>
  )
}

/** A 24-hour strip showing when a service is open. */
export function DayTimeline({ open, close }) {
  const toMin = (t) => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m }
  const a = open ? toMin(open) : null
  let b = close ? toMin(close) : null
  if (b != null && a != null && b <= a) b = 1440
  return (
    <div className="timeline" aria-hidden="true">
      {[6, 12, 18].map((h) => <i key={h} style={{ left: `${(h / 24) * 100}%` }} />)}
      {a != null && <b style={{ left: `${(a / 1440) * 100}%`, width: `${((b - a) / 1440) * 100}%` }} />}
    </div>
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
