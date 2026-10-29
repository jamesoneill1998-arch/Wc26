// CSV import/export for contact history.
//
// Reads the exports contact-centre systems actually produce (Genesys, NICE,
// Avaya, Amazon Connect, Five9, Excel): headers are matched loosely and by
// priority, date and time may share one column, times may be 12-hour or a
// range, and handle time may be seconds, mm:ss, hh:mm:ss or milliseconds.
// Files holding several queues report them so the planner can pick one.

import { parseISODate, toISODate } from './dates.js'

// Ordered by preference: offered beats answered for capacity planning.
const COLUMNS = {
  datetime: ['interval_start', 'interval_start_time', 'startinterval', 'start_interval', 'interval_start_date_time', 'start_date_time', 'start_time', 'datetime', 'date_time', 'timestamp', 'period_start'],
  date: ['date', 'day', 'ds', 'report_date', 'interval_date', 'call_date'],
  time: ['time', 'interval', 'half_hour', 'halfhour', 'quarter_hour', 'time_interval', 'interval_time', 'period', 'start', 'interval_start', 'start_time'],
  volume: ['volume', 'offered', 'calls_offered', 'contacts_offered', 'offer', 'offered_calls', 'presented', 'calls_presented', 'contacts_presented', 'contacts_queued', 'calls_queued', 'queued', 'incoming', 'inbound', 'calls_received', 'contacts_received', 'received', 'total_calls', 'total_contacts', 'calls', 'contacts', 'count', 'y', 'acd_calls', 'calls_handled', 'contacts_handled', 'handled', 'answered', 'answer'],
  aht: ['aht', 'aht_sec', 'aht_secs', 'aht_seconds', 'avg_handle_time', 'average_handle_time', 'avg_handle', 'average_handle', 'handle_time', 'avg_aht', 'avg_acd_time', 'average_acd_time', 'total_handle_time', 'avg_talk_time'],
  queue: ['queue', 'queue_name', 'skill', 'skill_name', 'split', 'split_skill', 'split_skill_name', 'campaign', 'line_of_business', 'lob'],
}
const ANSWERED = new Set(['acd_calls', 'calls_handled', 'contacts_handled', 'handled', 'answered', 'answer'])

export const normaliseHeader = (h) => h.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

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

export function detectDelimiter(header) {
  const counts = [',', ';', '\t'].map((d) => [d, header.split(d).length])
  counts.sort((a, b) => b[1] - a[1])
  return counts[0][0]
}

export function normaliseDate(raw, slashOrder) {
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
export function guessSlashOrder(values) {
  for (const v of values) {
    const m = /^(\d{1,2})[/.-](\d{1,2})[/.-]\d{4}/.exec(v.trim())
    if (!m) continue
    if (+m[1] > 12) return 'dmy'
    if (+m[2] > 12) return 'mdy'
  }
  return 'dmy'
}

/** Clock time to minutes after midnight: 08:00, 8:00:00, 8:00 AM, or the start of a range like "8:00 AM-8:30 AM". */
export function parseClock(raw) {
  const s = String(raw ?? '').trim()
  const m = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*([ap]\.?m\.?)?(?=$|\s*[-–]|\s+to\s)/i.exec(s)
  if (!m) return null
  let h = +m[1]
  const mins = +m[2]
  if (m[3]) {
    if (h < 1 || h > 12) return null
    const pm = m[3][0].toLowerCase() === 'p'
    h = (h % 12) + (pm ? 12 : 0)
  }
  const t = h * 60 + mins
  return h < 24 && mins < 60 ? t : null
}

/**
 * A combined date and time. Timestamps carrying a zone (…Z or +01:00) are
 * converted to the planner's local clock, which is how the centre's day runs.
 */
export function parseDateTime(raw, slashOrder) {
  const s = String(raw ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const t = new Date(s)
    if (Number.isNaN(t.getTime())) return null
    const pad = (n) => String(n).padStart(2, '0')
    return { date: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`, time: t.getHours() * 60 + t.getMinutes(), zoned: true }
  }
  const m = /^(\S+?)(?:T|\s+)(.+)$/.exec(s)
  if (!m) return null
  const date = normaliseDate(m[1], slashOrder)
  const time = parseClock(m[2].replace(/(Z|[+-]\d{2}:?\d{2})$/, ''))
  return date && time != null ? { date, time, zoned: false } : null
}

/** Seconds from 315, 315.5, "05:15" or "00:05:15". */
export function parseDuration(raw) {
  const s = String(raw ?? '').trim()
  if (s === '') return null
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s)
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d+)?)$/.exec(s)
  if (!m) return null
  return (m[1] ? +m[1] * 3600 : 0) + +m[2] * 60 + +m[3]
}

function pick(header, names, exclude = new Set()) {
  for (const n of names) {
    const i = header.findIndex((h, j) => h === n && !exclude.has(j))
    if (i >= 0) return i
  }
  return -1
}

const median = (xs) => { const a = xs.filter((x) => x > 0).sort((p, q) => p - q); return a.length ? a[Math.floor(a.length / 2)] : 0 }

/**
 * Parse history CSV text.
 * @param {string} text
 * @param {{queue?: string}} [opts] queue to keep when the file holds several ('*' keeps all, combined)
 * @returns {{kind:'daily'|'interval', rows:Array, errors:string[], queues:Array<{name:string, volume:number}>, columns:Object, notes:string[]}}
 */
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024
export const MAX_IMPORT_ROWS = 500000

export function parseHistoryCSV(text, { queue } = {}) {
  const empty = (errors) => ({ kind: 'daily', rows: [], errors, queues: [], columns: {}, notes: [] })
  if (text.length > MAX_IMPORT_BYTES) return empty(['File is larger than 25 MB. Export a shorter date range.'])
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return empty(['File has no data rows.'])
  if (lines.length > MAX_IMPORT_ROWS + 1) return empty([`File has more than ${MAX_IMPORT_ROWS.toLocaleString()} rows.`])
  const delim = detectDelimiter(lines[0])
  const raw = splitCSVLine(lines[0], delim)
  const header = raw.map(normaliseHeader)
  const body = lines.slice(1).map((l) => splitCSVLine(l, delim))
  const sample = body.slice(0, 50)

  // A column is a combined timestamp if its values carry both a date and a time.
  const looksDateTime = (i) => i >= 0 && sample.some((r) => /\d{4}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(r[i] ?? '') && /\d{1,2}:\d{2}/.test(r[i] ?? ''))
  let date = pick(header, COLUMNS.date)
  let dt = -1
  if (date >= 0 && looksDateTime(date)) { dt = date; date = -1 }
  if (date < 0 && dt < 0) { const c = pick(header, COLUMNS.datetime); if (looksDateTime(c)) dt = c }
  const used = new Set([date, dt].filter((i) => i >= 0))
  const time = date >= 0 ? pick(header, COLUMNS.time, used) : -1
  if (time >= 0) used.add(time)
  const volume = pick(header, COLUMNS.volume, used)
  if (volume >= 0) used.add(volume)
  const aht = pick(header, COLUMNS.aht, used)
  const q = pick(header, COLUMNS.queue, used)

  const errors = []
  if (date < 0 && dt < 0) errors.push('Missing a date column (for example "Date" or "Interval Start").')
  if (volume < 0) errors.push('Missing a volume column (for example "Calls Offered", "Offered" or "Contacts").')
  if (errors.length) return empty(errors)

  const kind = dt >= 0 || time >= 0 ? 'interval' : 'daily'
  const order = guessSlashOrder(body.map((r) => r[dt >= 0 ? dt : date] ?? ''))
  const notes = []
  if (ANSWERED.has(header[volume])) notes.push(`"${raw[volume]}" counts answered contacts, so abandoned ones are not in the forecast; use an offered column if your system has one.`)

  // Handle time: totals are divided by volume; values far too large for seconds are milliseconds.
  const ahtTotal = aht >= 0 && header[aht].includes('total')
  let ahtScale = 1
  if (aht >= 0 && !ahtTotal) {
    const typical = median(sample.map((r) => parseDuration(r[aht])).filter((x) => x != null))
    if (typical > 7200 && typical / 1000 <= 7200) { ahtScale = 0.001; notes.push(`"${raw[aht]}" read as milliseconds.`) }
  }

  const queues = new Map()
  const merged = new Map()
  let zoned = false
  body.forEach((r, i) => {
    let d, t = null
    if (dt >= 0) {
      const x = parseDateTime(r[dt], order)
      if (x) { d = x.date; t = x.time; zoned ||= x.zoned }
    } else {
      d = normaliseDate(r[date] ?? '', order)
      if (kind === 'interval') t = parseClock(r[time])
    }
    const v = Number(String(r[volume] ?? '').replace(/[,\s]/g, ''))
    if (v > 1e7) {
      if (errors.length < 10) errors.push(`Row ${i + 2}: volume out of range.`)
      return
    }
    if (!d || !Number.isFinite(v) || v < 0 || (kind === 'interval' && t == null)) {
      if (errors.length < 10) errors.push(`Row ${i + 2}: could not read "${r.join(delim).slice(0, 80)}".`)
      return
    }
    const name = q >= 0 ? (r[q] || '(blank)') : ''
    if (q >= 0) queues.set(name, (queues.get(name) ?? 0) + v)
    if (queue && queue !== '*' && name !== queue) return
    let a = aht >= 0 ? parseDuration(r[aht]) : null
    if (a != null) a = ahtTotal ? (v > 0 ? a / v : null) : a * ahtScale
    if (a != null && a > 86400) {
      if (errors.length < 10) errors.push(`Row ${i + 2}: handle time out of range.`)
      return
    }
    if (a != null && !(a > 0)) a = null
    const key = kind === 'interval' ? `${d} ${t}` : d
    const m = merged.get(key) ?? { date: d, time: t, volume: 0, work: 0, workVol: 0 }
    m.volume += v
    if (a != null && v > 0) { m.work += a * v; m.workVol += v }
    merged.set(key, m)
  })
  if (zoned) notes.push('Timestamps were converted from UTC to this computer\'s local time.')
  const rows = [...merged.values()]
    .sort((a, b) => (a.date === b.date ? (a.time ?? 0) - (b.time ?? 0) : a.date < b.date ? -1 : 1))
    .map((m) => {
      const row = { date: m.date, volume: m.volume }
      if (m.workVol > 0) row.aht = m.work / m.workVol
      if (kind === 'interval') row.time = m.time
      return row
    })
  const columns = {
    date: dt >= 0 ? raw[dt] : raw[date],
    ...(time >= 0 ? { time: raw[time] } : {}),
    volume: raw[volume],
    ...(aht >= 0 ? { aht: raw[aht] } : {}),
    ...(q >= 0 ? { queue: raw[q] } : {}),
  }
  return {
    kind, rows, errors, notes, columns,
    queues: [...queues.entries()].map(([name, v]) => ({ name, volume: v })).sort((a, b) => b.volume - a.volume),
  }
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
