// Backup reminder. Plans live only in this browser, so clearing site data or
// changing computer loses them. This tracks, per browser, when the plan last
// changed and when it was last exported, and says when a nudge is due.

const KEY = 'erlang-desk:backup'
const DAY = 864e5
export const REMIND_AFTER_DAYS = 7

export function readBackup() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    const t = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)
    return { changedAt: t(raw.changedAt), backupAt: t(raw.backupAt), snoozedUntil: t(raw.snoozedUntil) }
  } catch {
    return { changedAt: null, backupAt: null, snoozedUntil: null }
  }
}
function write(patch) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...readBackup(), ...patch })) } catch { /* storage blocked */ }
}
export const markChanged = (now = Date.now()) => write({ changedAt: now })
/** The plan now matches a file the planner holds: just exported, or just opened from one. */
export const markBackedUp = (now = Date.now()) => write({ backupAt: now, changedAt: null, snoozedUntil: null })
export const snoozeBackup = (now = Date.now()) => write({ snoozedUntil: now + REMIND_AFTER_DAYS * DAY })

/**
 * Whether to remind, and what to say.
 * @returns {{ due: boolean, never: boolean, days: number|null }}
 */
export function backupStatus({ changedAt, backupAt, snoozedUntil }, now = Date.now(), hasData = true) {
  const never = backupAt == null
  const days = never ? null : Math.floor((now - backupAt) / DAY)
  const snoozed = snoozedUntil != null && now < snoozedUntil
  const unsaved = changedAt != null && (never || changedAt > backupAt)
  const due = hasData && unsaved && !snoozed && (never || days >= REMIND_AFTER_DAYS)
  return { due, never, days }
}
