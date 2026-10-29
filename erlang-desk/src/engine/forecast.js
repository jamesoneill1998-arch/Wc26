// Daily volume forecasting.
//
// Several transparent methods compete on a hold-out backtest and the most
// accurate one (lowest WAPE) is selected automatically. Planners can still
// override the choice. Everything here is deterministic and dependency-free.

import { addDays, daysBetween, weekdayIndex, parseISODate } from './dates.js'

/**
 * Turn sparse {date, volume} rows into a contiguous daily series.
 * A date with no row is either a closure or a gap in the export. If that
 * weekday is normally open in the surrounding weeks it's treated as a gap and
 * filled with the median of the same weekday nearby; otherwise it's closed
 * (zero). Days recorded as zero always stay zero.
 */
export function toDailySeries(rows) {
  if (!rows.length) return { start: null, values: [], filled: [] }
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1))
  const start = sorted[0].date
  const n = daysBetween(start, sorted[sorted.length - 1].date) + 1
  const values = new Array(n).fill(0)
  const present = new Array(n).fill(false)
  for (const r of sorted) { const i = daysBetween(start, r.date); values[i] += r.volume; present[i] = true }
  const filled = []
  for (let i = 0; i < n; i++) {
    if (present[i]) continue
    const same = []
    for (let k = -4; k <= 4; k++) { const j = i + 7 * k; if (k !== 0 && j >= 0 && j < n && present[j]) same.push(values[j]) }
    const open = same.filter((v) => v > 0)
    if (same.length >= 3 && open.length / same.length >= 0.75) {
      open.sort((a, b) => a - b)
      values[i] = open[Math.floor(open.length / 2)]
      filled.push(addDays(start, i))
    }
  }
  return { start, values, filled }
}

// ── Accuracy ────────────────────────────────────────────────────────────────

/** Weighted absolute percentage error: robust to zero-volume (closed) days. */
export function wape(actual, forecast) {
  let err = 0
  let tot = 0
  for (let i = 0; i < actual.length; i++) {
    err += Math.abs(actual[i] - forecast[i])
    tot += Math.abs(actual[i])
  }
  return tot > 0 ? err / tot : 0
}

export function bias(actual, forecast) {
  const a = actual.reduce((s, v) => s + v, 0)
  const f = forecast.reduce((s, v) => s + v, 0)
  return a > 0 ? (f - a) / a : 0
}

// ── Methods ─────────────────────────────────────────────────────────────────
// Each method: (values, startISO, horizon) -> number[] of length horizon.

function seasonalNaive(values, _start, h) {
  const n = values.length
  return Array.from({ length: h }, (_, i) => values[n - 7 + (i % 7)] ?? 0)
}

function weekdayAverage(values, _start, h, weeks = 6) {
  const n = values.length
  const avg = []
  for (let d = 0; d < 7; d++) {
    let s = 0
    let c = 0
    for (let w = 1; w <= weeks; w++) {
      const idx = n - 7 * w + d
      if (idx >= 0) { s += values[idx]; c++ }
    }
    avg.push(c ? s / c : 0)
  }
  return Array.from({ length: h }, (_, i) => avg[i % 7])
}

/** Additive Holt-Winters with damped trend, season length m. Returns fit + forecaster. */
function holtWintersRun(y, m, alpha, beta, gamma, phi) {
  // Initialise level/trend/seasonals from the first two seasons.
  const s1 = y.slice(0, m)
  const s2 = y.slice(m, 2 * m)
  const mean1 = s1.reduce((a, b) => a + b, 0) / m
  const mean2 = s2.reduce((a, b) => a + b, 0) / m
  let level = mean1
  let trend = (mean2 - mean1) / m
  const season = s1.map((v) => v - mean1)
  let sse = 0
  for (let t = m; t < y.length; t++) {
    const sIdx = t % m
    const pred = level + phi * trend + season[sIdx]
    const e = y[t] - pred
    sse += e * e
    const prevLevel = level
    level = alpha * (y[t] - season[sIdx]) + (1 - alpha) * (prevLevel + phi * trend)
    trend = beta * (level - prevLevel) + (1 - beta) * phi * trend
    season[sIdx] = gamma * (y[t] - level) + (1 - gamma) * season[sIdx]
  }
  const n = y.length
  const forecast = (h) => {
    const out = []
    let damp = 0
    for (let i = 1; i <= h; i++) {
      damp += phi ** i
      out.push(level + damp * trend + season[(n + i - 1) % m])
    }
    return out
  }
  return { sse, forecast }
}

function holtWinters(values, _start, h) {
  const m = 7
  if (values.length < 3 * m) return weekdayAverage(values, _start, h)
  let best = null
  for (const alpha of [0.05, 0.1, 0.2, 0.3, 0.45]) {
    for (const beta of [0, 0.01, 0.05]) {
      for (const gamma of [0.05, 0.15, 0.3]) {
        for (const phi of [0.9, 0.98]) {
          const run = holtWintersRun(values, m, alpha, beta, gamma, phi)
          if (!best || run.sse < best.sse) best = run
        }
      }
    }
  }
  return best.forecast(h).map((v) => Math.max(0, v))
}

/** Solve A·x = b with partial pivoting (small dense systems only). */
export function solveLinear(A, b) {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    if (Math.abs(M[p][c]) < 1e-12) continue
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r][c] / M[c][c]
      if (f === 0) continue
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  return M.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[n] / row[i]))
}

/**
 * Log-linear regression: trend + weekday effects + annual Fourier terms.
 * Captures yearly seasonality when there is enough history (> ~13 months).
 */
function regression(values, start, h) {
  const n = values.length
  const annual = n >= 400 ? 3 : 0
  const features = (t) => {
    const date = addDays(start, t)
    const wd = weekdayIndex(date)
    const row = [1, t / 365]
    for (let d = 1; d < 7; d++) row.push(wd === d ? 1 : 0)
    if (annual) {
      const year = new Date(parseISODate(date)).getUTCFullYear()
      const doy = (parseISODate(date) - Date.UTC(year, 0, 1)) / 86400000
      for (let k = 1; k <= annual; k++) {
        row.push(Math.sin((2 * Math.PI * k * doy) / 365.25), Math.cos((2 * Math.PI * k * doy) / 365.25))
      }
    }
    return row
  }
  // Fit on at most the last two years so old regimes don't dominate.
  const from = Math.max(0, n - 730)
  const p = features(0).length
  const XtX = Array.from({ length: p }, () => new Array(p).fill(0))
  const Xty = new Array(p).fill(0)
  for (let t = from; t < n; t++) {
    const x = features(t)
    const y = Math.log1p(values[t])
    for (let i = 0; i < p; i++) {
      Xty[i] += x[i] * y
      for (let j = 0; j < p; j++) XtX[i][j] += x[i] * x[j]
    }
  }
  for (let i = 1; i < p; i++) XtX[i][i] += 1e-6 // tiny ridge for stability
  const beta = solveLinear(XtX, Xty)
  // Closed weekdays (always zero) should stay zero rather than drift.
  const closed = new Array(7).fill(true)
  for (let t = Math.max(0, n - 56); t < n; t++) if (values[t] > 0) closed[weekdayIndex(addDays(start, t))] = false
  return Array.from({ length: h }, (_, i) => {
    const t = n + i
    if (closed[weekdayIndex(addDays(start, t))]) return 0
    const x = features(t)
    const yhat = x.reduce((s, v, k) => s + v * beta[k], 0)
    return Math.max(0, Math.expm1(yhat))
  })
}

// A 28-day backtest understates how far later weeks can drift; this widens
// the band so it holds about 80% of actual days (checked on NYC 311 calls).
const BAND_SCALE = 1.2

export const METHODS = {
  auto: { label: 'Auto (best or blended)' },
  regression: { label: 'Trend + weekly + annual seasonality', fn: regression, minDays: 56 },
  holtWinters: { label: 'Holt-Winters (damped)', fn: holtWinters, minDays: 21 },
  weekdayAverage: { label: '6-week weekday average', fn: weekdayAverage, minDays: 14 },
  seasonalNaive: { label: 'Same day last week', fn: seasonalNaive, minDays: 7 },
}

const median = (xs) => { const a = [...xs].sort((p, q) => p - q); return a.length ? a[Math.floor(a.length / 2)] : null }

/**
 * How bank holidays run against a normal day, learned from the history:
 * each past holiday is compared with the same weekday in nearby weeks.
 * Models still train on the raw history (tested on real call data, swapping
 * holidays out of it pushed ordinary weeks too high); `factorFor` scales a
 * forecast date that falls on a holiday.
 */
export function holidayEffects(values, start, holidays) {
  if (!holidays?.size) return { factorFor: () => 1, seen: 0 }
  const byName = new Map()
  const all = []
  for (let i = 0; i < values.length; i++) {
    const name = holidays.get(addDays(start, i))
    if (!name) continue
    const same = []
    for (let k = -4; k <= 4; k++) { const j = i + 7 * k; if (k !== 0 && j >= 0 && j < values.length && !holidays.has(addDays(start, j))) same.push(values[j]) }
    const open = same.filter((v) => v > 0)
    if (same.length < 3 || open.length / same.length < 0.75) continue // a weekday that's normally closed
    const r = values[i] / median(open)
    all.push(r)
    byName.set(name, [...(byName.get(name) ?? []), r])
  }
  const overall = all.length >= 2 ? median(all) : 1
  const factorFor = (date) => {
    const name = holidays.get(date)
    if (!name) return 1
    const f = byName.has(name) ? median(byName.get(name)) : overall
    return Math.min(1.5, Math.max(0, f))
  }
  return { factorFor, seen: all.length }
}

/**
 * Backtest every eligible method on the last `holdout` days, against what
 * actually happened (holiday effects learned from the training part only).
 * @returns {Array<{method, label, wape, bias, forecast}>} sorted best first
 */
export function backtest(values, start, holdout = 28, holidays = null) {
  const results = []
  const n = values.length
  const train = values.slice(0, n - holdout)
  const eff = holidayEffects(train, start, holidays)
  const test = values.slice(n - holdout)
  const factors = test.map((_, i) => eff.factorFor(addDays(start, n - holdout + i)))
  for (const [key, m] of Object.entries(METHODS)) {
    if (!m.fn || train.length < m.minDays) continue
    const fc = m.fn(train, start, holdout).map((v, i) => v * factors[i])
    results.push({ method: key, label: m.label, wape: wape(test, fc), bias: bias(test, fc), forecast: fc })
  }
  results.sort((a, b) => a.wape - b.wape)
  // Blend the methods that beat "same day last week", weighted by accuracy.
  const naive = results.find((r) => r.method === 'seasonalNaive')
  const parts = results.filter((r) => r.method !== 'seasonalNaive' && (!naive || r.wape < naive.wape))
  if (parts.length >= 2) {
    const w = parts.map((r) => 1 / Math.max(r.wape, 0.005))
    const ws = w.reduce((s, x) => s + x, 0)
    const fc = test.map((_, i) => parts.reduce((s, r, k) => s + r.forecast[i] * w[k], 0) / ws)
    results.push({
      method: 'blend', label: `Blend of ${parts.length} methods`, wape: wape(test, fc), bias: bias(test, fc), forecast: fc,
      parts: parts.map((r, k) => ({ method: r.method, weight: w[k] / ws })),
    })
    results.sort((a, b) => a.wape - b.wape)
  }
  return results
}

/**
 * Produce a daily forecast.
 * @param {Array<{date, volume}>} dailyRows
 * @param {object} opts
 * @param {number} opts.horizon days to forecast
 * @param {string} [opts.method] key of METHODS, default 'auto'
 * @param {number} [opts.adjustPct] planner overlay, e.g. 0.05 for +5%
 */
export function forecastDaily(dailyRows, { horizon = 91, method = 'auto', adjustPct = 0, holidays = null } = {}) {
  const { start, values, filled } = toDailySeries(dailyRows)
  if (values.length < 7) {
    return { error: 'Need at least 7 days of history to forecast.', points: [], backtest: [] }
  }
  const holdout = Math.min(28, Math.max(7, Math.floor(values.length / 5)))
  const bt = values.length >= 14 ? backtest(values, start, holdout, holidays) : []
  const chosen = method === 'auto' || !METHODS[method]?.fn ? bt[0]?.method ?? 'seasonalNaive' : method
  const btRow = bt.find((r) => r.method === chosen)
  const eff = holidayEffects(values, start, holidays)
  const run = (key) => METHODS[key].fn(values, start, horizon)
  const base = chosen === 'blend'
    ? btRow.parts.reduce((acc, p) => { const f = run(p.method); return acc.map((v, i) => v + f[i] * p.weight) }, new Array(horizon).fill(0))
    : run(chosen)
  const firstDate = addDays(start, values.length)
  const raw = base.map((v, i) => v * eff.factorFor(addDays(firstDate, i)))
  // Spread of backtest errors drives an approximate 80% band.
  let sigmaPct = 0.1
  if (btRow) {
    const test = values.slice(values.length - holdout)
    const rel = test.map((a, i) => (a > 0 ? (a - btRow.forecast[i]) / a : null)).filter((v) => v != null)
    if (rel.length > 2) {
      const mean = rel.reduce((s, v) => s + v, 0) / rel.length
      sigmaPct = Math.sqrt(rel.reduce((s, v) => s + (v - mean) ** 2, 0) / (rel.length - 1))
    }
  }
  const lastDate = addDays(start, values.length - 1)
  const points = raw.map((v, i) => {
    const volume = v * (1 + adjustPct)
    const spread = 1.2816 * BAND_SCALE * sigmaPct * Math.sqrt(1 + i / 28) // widens with horizon
    return {
      date: addDays(lastDate, i + 1),
      volume,
      low: Math.max(0, volume * (1 - spread)),
      high: volume * (1 + spread),
    }
  })
  return {
    method: chosen,
    methodLabel: chosen === 'blend' ? `${btRow.label}, weighted by accuracy` : METHODS[chosen].label,
    blendParts: chosen === 'blend' ? btRow.parts.map((p) => ({ ...p, label: METHODS[p.method].label })) : null,
    holidaysLearned: eff.seen,
    accuracy: btRow ? { wape: btRow.wape, bias: btRow.bias, holdoutDays: holdout } : null,
    backtest: bt.map(({ forecast, parts, ...r }) => r),
    lastActualDate: lastDate,
    filledDays: filled,
    points,
  }
}
