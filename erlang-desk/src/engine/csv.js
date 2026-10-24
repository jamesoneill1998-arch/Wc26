// CSV import/export for contact history.
//
// Accepted shapes (header names are matched case-insensitively):
//   daily:    date, volume[, aht]
//   interval: date, time|interval, volume[, aht]
// Dates must be YYYY-MM-DD; also accepts DD/MM/YYYY and MM/DD/YYYY when
// unambiguous. Times are HH:MM (interval start).

import { parseISODate, parseTime, toISODate } from './dates.js'

const ALIASES = {
  date: ['date', 'day', 'ds'],
  time: ['time', 'interval', 'interval_start', 'start', 'period'],
  volume: ['volume', 'calls', 'contacts', 'offered', 'calls_offered', 'count', 'y'],
  aht: ['aht', 'aht_sec', 'aht_seconds', 'handle_time', 'avg_handle_time'],
}

export function splitCSVLine(line, delim = ',') {
  const out = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === delim) { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

function detectDelimiter(header) {
  const counts = [',', ';', '\t'].map((d) => [d, header.split(d).length])
  counts.sort((a, b) => b[1] - a[1])
  return counts[0][0]
}

function normaliseDate(raw, slashOrder) {
  const s = raw.trim()
  if (parseISODate(s) != null) return s
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s)
  if (!m) return null
  const [a, b, y] = [+m[1], +m[2], +m[3]]
  const [d, mo] = slashOrder === 'mdy' ? [b, a] : [a, b]
  const t = Date.UTC(y, mo - 1, d)
  const iso = toISODate(t)
  return parseISODate(iso) != null && new Date(t).getUTCDate() === d ? iso : null
}

/** Decide DD/MM vs MM/DD by looking for a first field > 12. */
function guessSlashOrder(values) {
  for (const v of values) {
    const m = /^(\d{1,2})[/.-](\d{1,2})[/.-]\d{4}$/.exec(v.trim())
    if (!m) continue
    if (+m[1] > 12) return 'dmy'
    if (+m[2] > 12) return 'mdy'
  }
  return 'dmy'
}

/**
 * Parse history CSV text.
 * @returns {{kind:'daily'|'interval', rows:Array, errors:string[]}}
 */
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024
export const MAX_IMPORT_ROWS = 500000

export function parseHistoryCSV(text) {
  if (text.length > MAX_IMPORT_BYTES) return { kind: 'daily', rows: [], errors: ['File is larger than 25 MB. Export a shorter date range.'] }
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return { kind: 'daily', rows: [], errors: ['File has no data rows.'] }
  if (lines.length > MAX_IMPORT_ROWS + 1) return { kind: 'daily', rows: [], errors: [`File has more than ${MAX_IMPORT_ROWS.toLocaleString()} rows.`] }
  const delim = detectDelimiter(lines[0])
  const header = splitCSVLine(lines[0], delim).map((h) => h.toLowerCase().replace(/\s+/g, '_'))
  const col = {}
  for (const [key, names] of Object.entries(ALIASES)) {
    col[key] = header.findIndex((h) => names.includes(h))
  }
  const errors = []
  if (col.date < 0) errors.push('Missing a "date" column.')
  if (col.volume < 0) errors.push('Missing a "volume" (or "calls") column.')
  if (errors.length) return { kind: 'daily', rows: [], errors }

  const kind = col.time >= 0 ? 'interval' : 'daily'
  const body = lines.slice(1).map((l) => splitCSVLine(l, delim))
  const order = guessSlashOrder(body.map((r) => r[col.date] ?? ''))
  const rows = []
  body.forEach((r, i) => {
    const date = normaliseDate(r[col.date] ?? '', order)
    const volume = Number(String(r[col.volume] ?? '').replace(/,/g, ''))
    const aht = col.aht >= 0 && r[col.aht] !== '' ? Number(r[col.aht]) : null
    if (volume > 1e7 || (aht != null && aht > 86400)) {
      if (errors.length < 10) errors.push(`Row ${i + 2}: value out of range.`)
      return
    }
    const time = kind === 'interval' ? parseTime(r[col.time] ?? '') : null
    if (!date || !Number.isFinite(volume) || volume < 0 || (kind === 'interval' && time == null)) {
      if (errors.length < 10) errors.push(`Row ${i + 2}: could not read "${r.join(delim)}".`)
      return
    }
    const row = { date, volume }
    if (aht != null && Number.isFinite(aht) && aht > 0) row.aht = aht
    if (kind === 'interval') row.time = time
    rows.push(row)
  })
  return { kind, rows, errors }
}

/** Collapse interval rows to one row per day (volume-weighted AHT). */
export function aggregateDaily(rows) {
  const byDate = new Map()
  for (const r of rows) {
    const d = byDate.get(r.date) ?? { date: r.date, volume: 0, ahtWork: 0, ahtVol: 0 }
    d.volume += r.volume
    if (r.aht) { d.ahtWork += r.aht * r.volume; d.ahtVol += r.volume }
    byDate.set(r.date, d)
  }
  return [...byDate.values()]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((d) => (d.ahtVol > 0 ? { date: d.date, volume: d.volume, aht: d.ahtWork / d.ahtVol } : { date: d.date, volume: d.volume }))
}

const NUMERIC = /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i

function escapeCell(v) {
  let s = v == null ? '' : String(v)
  // Neutralise spreadsheet formula injection: a cell like =HYPERLINK(...)
  // in an exported file would otherwise execute when opened in Excel.
  if (/^[=+\-@\t\r]/.test(s) && !NUMERIC.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(columns, rows) {
  const head = columns.map((c) => escapeCell(c.label)).join(',')
  const body = rows.map((r) => columns.map((c) => escapeCell(c.get(r))).join(','))
  return [head, ...body].join('\n')
}
