// Date helpers that work on plain "YYYY-MM-DD" strings in UTC, so results
// never shift with the viewer's time zone or daylight saving.

const DAY_MS = 86400000

export function parseISODate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim())
  if (!m) return null
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3])
  return Number.isNaN(t) ? null : t
}

export function toISODate(t) {
  return new Date(t).toISOString().slice(0, 10)
}

export function addDays(iso, n) {
  return toISODate(parseISODate(iso) + n * DAY_MS)
}

export function daysBetween(a, b) {
  return Math.round((parseISODate(b) - parseISODate(a)) / DAY_MS)
}

/** 0 = Monday … 6 = Sunday (ISO weekday order, how planners think). */
export function weekdayIndex(iso) {
  return (new Date(parseISODate(iso)).getUTCDay() + 6) % 7
}

/** The Monday on or before the given date. */
export function weekStart(iso) {
  return addDays(iso, -weekdayIndex(iso))
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** "HH:MM" -> minutes after midnight. */
export function parseTime(s) {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(s).trim())
  if (!m) return null
  const mins = +m[1] * 60 + +m[2]
  return mins >= 0 && mins < 1440 ? mins : null
}

export function formatTime(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatDate(iso, opts = { day: 'numeric', month: 'short' }) {
  return new Date(parseISODate(iso)).toLocaleDateString(undefined, { timeZone: 'UTC', ...opts })
}
