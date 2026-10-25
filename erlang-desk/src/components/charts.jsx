import { useEffect, useMemo, useRef, useState } from 'react'
import { fmtCompact } from '../format.js'

function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(600)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

export function niceTicks(max, count = 4) {
  if (!(max > 0)) return [0, 1]
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)
  const ticks = []
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v)
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step)
  return ticks
}

function Tooltip({ x, y, width, children }) {
  const left = x > width * 0.6 ? undefined : x + 14
  const right = x > width * 0.6 ? width - x + 14 : undefined
  return (
    <div className="tooltip" style={{ left, right, top: Math.max(0, y - 10) }}>
      {children}
    </div>
  )
}

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label}>
          <i className={it.band ? 'key-band' : it.block ? 'key-block' : 'key-line'} style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}

/**
 * Multi-series line chart on one y-axis with a hover crosshair.
 * rows: [{x, [seriesKey]: number|null, ...}]
 * series: [{key, label, color, band?: [lowKey, highKey]}]
 */
export function LineChart({ rows, series, height = 260, xFormat = (x) => x, yFormat = fmtCompact, valueFormat = fmtCompact, markers = [] }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const m = { t: 10, r: 12, b: 26, l: 44 }
  const iw = width - m.l - m.r
  const ih = height - m.t - m.b
  const max = useMemo(() => {
    let mx = 0
    for (const r of rows) for (const s of series) {
      mx = Math.max(mx, r[s.key] ?? 0)
      if (s.band) mx = Math.max(mx, r[s.band[1]] ?? 0)
    }
    return mx
  }, [rows, series])
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]
  const xs = (i) => m.l + (rows.length <= 1 ? iw / 2 : (i / (rows.length - 1)) * iw)
  const ys = (v) => m.t + ih - (v / top) * ih

  const pathFor = (key) => {
    let d = ''
    let pen = false
    rows.forEach((r, i) => {
      const v = r[key]
      if (v == null) { pen = false; return }
      d += `${pen ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`
      pen = true
    })
    return d
  }
  const bandFor = ([lo, hi]) => {
    const pts = rows.map((r, i) => [i, r[lo], r[hi]]).filter((p) => p[1] != null && p[2] != null)
    if (!pts.length) return ''
    const upper = pts.map(([i, , h]) => `${xs(i).toFixed(1)},${ys(h).toFixed(1)}`)
    const lower = pts.reverse().map(([i, l]) => `${xs(i).toFixed(1)},${ys(l).toFixed(1)}`)
    return `M${upper.join('L')}L${lower.join('L')}Z`
  }
  const tickEvery = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(iw / 90))))

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const i = Math.round(((px - m.l) / iw) * (rows.length - 1))
    setHover(Math.min(rows.length - 1, Math.max(0, i)))
  }

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={series.map((s) => s.label).join(' and ')}>
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? 'axis-line' : 'grid-line'} x1={m.l} x2={width - m.r} y1={ys(t)} y2={ys(t)} />
            <text className="tick" x={m.l - 8} y={ys(t)} dy="0.32em" textAnchor="end">{yFormat(t)}</text>
          </g>
        ))}
        {rows.map((r, i) => (i % tickEvery === 0 ? (
          <text key={i} className="tick" x={xs(i)} y={height - 6} textAnchor="middle">{xFormat(r.x)}</text>
        ) : null))}
        {markers.map((mk) => {
          const i = rows.findIndex((r) => r.x === mk.x)
          if (i < 0) return null
          return (
            <g key={mk.x}>
              <line className="axis-line" x1={xs(i)} x2={xs(i)} y1={m.t} y2={m.t + ih} />
              <text className="tick" x={xs(i) + 6} y={m.t + 10}>{mk.label}</text>
            </g>
          )
        })}
        {series.filter((s) => s.band).map((s) => (
          <path key={`${s.key}-band`} d={bandFor(s.band)} fill={s.color} opacity="0.12" />
        ))}
        {series.map((s) => (
          <path key={s.key} d={pathFor(s.key)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {hover != null && (
          <g>
            <line className="cross" x1={xs(hover)} x2={xs(hover)} y1={m.t} y2={m.t + ih} />
            {series.map((s) => rows[hover][s.key] != null && (
              <circle key={s.key} cx={xs(hover)} cy={ys(rows[hover][s.key])} r="4.5" fill={s.color} stroke="var(--surface)" strokeWidth="2" />
            ))}
          </g>
        )}
        <rect x={m.l} y={m.t} width={iw} height={ih} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>
      {hover != null && (
        <Tooltip x={xs(hover)} y={m.t} width={width}>
          <div className="tt-title">{xFormat(rows[hover].x, true)}</div>
          {series.map((s) => rows[hover][s.key] != null && (
            <div className="tt-row" key={s.key}>
              <span className="row" style={{ gap: 6 }}><i className="dot" style={{ background: s.color }} />{s.label}</span>
              <b>{valueFormat(rows[hover][s.key])}</b>
            </div>
          ))}
          {series.filter((s) => s.band && rows[hover][s.band[0]] != null).map((s) => (
            <div className="tt-row muted" key={`${s.key}-b`}>
              <span>80% range</span>
              <b>{valueFormat(rows[hover][s.band[0]])}–{valueFormat(rows[hover][s.band[1]])}</b>
            </div>
          ))}
        </Tooltip>
      )}
    </div>
  )
}

/** Single-series columns with a per-column tooltip. rows: [{x, value, tip?: [[label, value]]}] */
export function ColumnChart({ rows, color = 'var(--series-1)', height = 220, xFormat = (x) => x, yFormat = fmtCompact, label = 'Value' }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const m = { t: 10, r: 8, b: 26, l: 40 }
  const iw = width - m.l - m.r
  const ih = height - m.t - m.b
  const ticks = niceTicks(Math.max(...rows.map((r) => r.value), 1))
  const top = ticks[ticks.length - 1]
  const band = iw / Math.max(1, rows.length)
  const bw = Math.max(2, Math.min(24, band - 2))
  const ys = (v) => m.t + ih - (v / top) * ih
  const tickEvery = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(iw / 56))))
  const col = (x, y, w, h) => {
    const r = Math.min(4, w / 2, h)
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
  }
  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? 'axis-line' : 'grid-line'} x1={m.l} x2={width - m.r} y1={ys(t)} y2={ys(t)} />
            <text className="tick" x={m.l - 8} y={ys(t)} dy="0.32em" textAnchor="end">{yFormat(t)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const x = m.l + i * band + (band - bw) / 2
          const h = ih - (ys(r.value) - m.t)
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={m.l + i * band} y={m.t} width={band} height={ih} fill="transparent" />
              {r.value > 0 && <path d={col(x, ys(r.value), bw, h)} fill={color} opacity={hover == null || hover === i ? 1 : 0.55} />}
              {i % tickEvery === 0 && <text className="tick" x={x + bw / 2} y={height - 6} textAnchor="middle">{xFormat(r.x)}</text>}
            </g>
          )
        })}
      </svg>
      {hover != null && (
        <Tooltip x={m.l + hover * band + band / 2} y={m.t} width={width}>
          <div className="tt-title">{xFormat(rows[hover].x)}</div>
          <div className="tt-row"><span className="row" style={{ gap: 6 }}><i className="dot" style={{ background: color }} />{label}</span><b>{yFormat(rows[hover].value)}</b></div>
          {(rows[hover].tip ?? []).map(([k, v]) => <div className="tt-row muted" key={k}><span>{k}</span><b>{v}</b></div>)}
        </Tooltip>
      )}
    </div>
  )
}

const SEQ = ['--seq-1', '--seq-2', '--seq-3', '--seq-4', '--seq-5', '--seq-6', '--seq-7']
const DIV_NEG = ['--div-n1', '--div-n2', '--div-n3']
const DIV_POS = ['--div-p1', '--div-p2', '--div-p3']

/**
 * Weekday × interval heatmap.
 * rows: [{label, cells:[{value, tip}]}] — value null for closed intervals
 * scale 'seq' (magnitude, one hue) or 'div' (polarity around 0: red below, blue above)
 */
export function Heatmap({ rows, colLabels, onCell, selectedRow, valueLabel = 'Agents', scale = 'seq', domain, neutral = 0, lowLabel, highLabel, format = (v) => v }) {
  const [hover, setHover] = useState(null)
  const values = rows.flatMap((r) => r.cells.map((c) => c.value)).filter((v) => v != null)
  const max = scale === 'div' ? domain ?? Math.max(1, ...values.map(Math.abs)) : Math.max(1, ...values)
  const color = (v) => {
    if (v == null) return 'var(--heat-off)'
    if (scale === 'div') {
      if (Math.abs(v) <= neutral) return 'var(--div-0)'
      const t = Math.min(1, Math.abs(v) / max)
      const ramp = v < 0 ? DIV_NEG : DIV_POS
      return `var(${ramp[t < 1 / 3 ? 0 : t < 2 / 3 ? 1 : 2]})`
    }
    return v <= 0 ? 'var(--seq-0)' : `var(${SEQ[Math.min(SEQ.length - 1, Math.floor((v / max) * SEQ.length - 1e-9))]})`
  }
  const every = Math.max(1, Math.ceil(colLabels.length / 12))
  return (
    <div className="chart">
      <div className="table-wrap">
        <div className="heat" style={{ gridTemplateColumns: `44px repeat(${colLabels.length}, minmax(14px, 1fr))`, minWidth: 44 + colLabels.length * 16 }}>
          {rows.map((r, ri) => (
            <div key={r.label} style={{ display: 'contents' }}>
              <div className="lab" style={{ fontWeight: selectedRow === ri ? 700 : 400, color: selectedRow === ri ? 'var(--ink)' : undefined }}>{r.label}</div>
              {r.cells.map((c, ci) => (
                <div
                  key={ci}
                  className="cell"
                  style={{ background: color(c.value), outline: hover?.r === ri && hover?.c === ci ? '2px solid var(--ink)' : undefined, cursor: onCell ? 'pointer' : 'default' }}
                  onMouseEnter={() => setHover({ r: ri, c: ci })}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onCell?.(ri, ci)}
                  aria-label={`${r.label} ${colLabels[ci]}: ${c.value == null ? 'closed' : `${format(c.value)} ${valueLabel}`}`}
                />
              ))}
            </div>
          ))}
          <div />
          {colLabels.map((l, i) => (
            <div key={l} className="lab" style={{ height: 16 }}>{i % every === 0 ? l : ''}</div>
          ))}
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
        {scale === 'div' ? (
          <div className="scale">
            <span>{lowLabel ?? `−${format(max)}`}</span>
            {[...DIV_NEG].reverse().map((t) => <i key={t} style={{ background: `var(${t})` }} />)}
            <i style={{ background: 'var(--div-0)' }} />
            {DIV_POS.map((t) => <i key={t} style={{ background: `var(${t})` }} />)}
            <span>{highLabel ?? `+${format(max)}`}</span>
          </div>
        ) : (
          <div className="scale">
            <span>0</span>
            <i style={{ background: 'var(--seq-0)' }} />
            {SEQ.map((t) => <i key={t} style={{ background: `var(${t})` }} />)}
            <span>{format(max)} {valueLabel.toLowerCase()}</span>
          </div>
        )}
        <div className="small muted" style={{ minHeight: 20 }}>
          {hover ? (
            <span>
              <b style={{ color: 'var(--ink)' }}>{rows[hover.r].label} {colLabels[hover.c]}</b>
              {' · '}{rows[hover.r].cells[hover.c].tip}
            </span>
          ) : 'Hover a cell for detail'}
        </div>
      </div>
    </div>
  )
}

/**
 * Stacked columns (e.g. required FTE by channel per week) with a 2px surface
 * gap between segments and a per-column tooltip.
 * rows: [{x, [key]: number}], series: [{key, label, color}]
 */
export function StackedColumns({ rows, series, height = 260, xFormat = (x) => x, yFormat = fmtCompact, valueFormat = fmtCompact, line }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const m = { t: 10, r: 8, b: 26, l: 44 }
  const iw = width - m.l - m.r
  const ih = height - m.t - m.b
  const totals = rows.map((r) => series.reduce((t, s) => t + (r[s.key] ?? 0), 0))
  const ticks = niceTicks(Math.max(1, ...totals, ...(line ? rows.map((r) => r[line.key] ?? 0) : [])))
  const top = ticks[ticks.length - 1]
  const band = iw / Math.max(1, rows.length)
  const bw = Math.max(3, Math.min(24, band - 3))
  const ys = (v) => m.t + ih - (v / top) * ih
  const tickEvery = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(iw / 80))))
  const cx = (i) => m.l + i * band + band / 2
  let linePath = ''
  if (line) rows.forEach((r, i) => { if (r[line.key] != null) linePath += `${linePath ? 'L' : 'M'}${cx(i).toFixed(1)},${ys(r[line.key]).toFixed(1)}` })
  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={series.map((s) => s.label).join(', ')}>
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? 'axis-line' : 'grid-line'} x1={m.l} x2={width - m.r} y1={ys(t)} y2={ys(t)} />
            <text className="tick" x={m.l - 8} y={ys(t)} dy="0.32em" textAnchor="end">{yFormat(t)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          let acc = 0
          const x = cx(i) - bw / 2
          const segs = series.map((s) => {
            const v = r[s.key] ?? 0
            const y0 = ys(acc)
            acc += v
            const y1 = ys(acc)
            return { s, y: y1, h: Math.max(0, y0 - y1 - (acc > v ? 2 : 0)) }
          })
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} opacity={hover == null || hover === i ? 1 : 0.6}>
              <rect x={m.l + i * band} y={m.t} width={band} height={ih} fill="transparent" />
              {segs.map(({ s, y, h }) => h > 0 && <rect key={s.key} x={x} y={y} width={bw} height={h} fill={s.color} />)}
              {i % tickEvery === 0 && <text className="tick" x={cx(i)} y={height - 6} textAnchor="middle">{xFormat(r.x)}</text>}
            </g>
          )
        })}
        {line && <path d={linePath} fill="none" stroke={line.color} strokeWidth="2" strokeLinejoin="round" pointerEvents="none" />}
      </svg>
      {hover != null && (
        <Tooltip x={cx(hover)} y={m.t} width={width}>
          <div className="tt-title">{xFormat(rows[hover].x, true)}</div>
          {[...series].reverse().map((s) => (
            <div className="tt-row" key={s.key}><span className="row" style={{ gap: 6 }}><i className="key-block" style={{ background: s.color }} />{s.label}</span><b>{valueFormat(rows[hover][s.key] ?? 0)}</b></div>
          ))}
          <div className="tt-row" style={{ borderTop: '1px solid var(--rule)', marginTop: 4, paddingTop: 4 }}><span>Total required</span><b>{valueFormat(totals[hover])}</b></div>
          {line && rows[hover][line.key] != null && <div className="tt-row"><span className="row" style={{ gap: 6 }}><i className="key-line" style={{ background: line.color }} />{line.label}</span><b>{valueFormat(rows[hover][line.key])}</b></div>}
        </Tooltip>
      )}
    </div>
  )
}
