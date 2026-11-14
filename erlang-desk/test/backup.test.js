import { test } from 'node:test'
import assert from 'node:assert/strict'
import { backupStatus, REMIND_AFTER_DAYS } from '../src/state/backup.js'

const DAY = 864e5
const now = Date.parse('2026-11-14T12:00:00Z')

test('backup reminder: due when a changed plan has never been exported', () => {
  assert.deepEqual(backupStatus({ changedAt: now - 1000, backupAt: null, snoozedUntil: null }, now), { due: true, never: true, days: null })
  // Nothing changed yet, or nothing to lose: no reminder.
  assert.equal(backupStatus({ changedAt: null, backupAt: null, snoozedUntil: null }, now).due, false)
  assert.equal(backupStatus({ changedAt: now - 1000, backupAt: null, snoozedUntil: null }, now, false).due, false)
})

test('backup reminder: after an export, due only once changes are a week old', () => {
  const recent = { changedAt: now - DAY, backupAt: now - 2 * DAY, snoozedUntil: null }
  assert.deepEqual(backupStatus(recent, now), { due: false, never: false, days: 2 })
  const stale = { changedAt: now - DAY, backupAt: now - (REMIND_AFTER_DAYS + 2) * DAY, snoozedUntil: null }
  assert.deepEqual(backupStatus(stale, now), { due: true, never: false, days: REMIND_AFTER_DAYS + 2 })
  // Old backup, but nothing changed since: still safe.
  assert.equal(backupStatus({ changedAt: now - 30 * DAY, backupAt: now - 20 * DAY, snoozedUntil: null }, now).due, false)
  assert.equal(backupStatus({ changedAt: null, backupAt: now - 20 * DAY, snoozedUntil: null }, now).due, false)
})

test('backup reminder: "not now" quiets it for a week', () => {
  const s = { changedAt: now - 1000, backupAt: null, snoozedUntil: now + DAY }
  assert.equal(backupStatus(s, now).due, false)
  assert.equal(backupStatus(s, now + 2 * DAY).due, true)
})
