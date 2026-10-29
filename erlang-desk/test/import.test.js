// Real-world export shapes from contact-centre systems.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseHistoryCSV, parseClock, parseDuration } from '../src/engine/csv.js'
import { parseScheduleCSV } from '../src/engine/schedule.js'

const total = (r) => r.rows.reduce((s, x) => s + x.volume, 0)

test('clock and duration formats', () => {
  assert.equal(parseClock('08:30'), 510)
  assert.equal(parseClock('8:30:00'), 510)
  assert.equal(parseClock('8:30 AM'), 510)
  assert.equal(parseClock('12:00 AM'), 0)
  assert.equal(parseClock('12:30 PM'), 750)
  assert.equal(parseClock('1:00pm'), 780)
  assert.equal(parseClock('8:00 AM-8:30 AM'), 480)
  assert.equal(parseClock('08:00 - 08:30'), 480)
  assert.equal(parseClock('25:00'), null)
  assert.equal(parseClock('13:00 PM'), null)
  assert.equal(parseDuration('315'), 315)
  assert.equal(parseDuration('05:15'), 315)
  assert.equal(parseDuration('00:05:15'), 315)
  assert.equal(parseDuration('1:02:03'), 3723)
  assert.equal(parseDuration(''), null)
})

test('Genesys Cloud: combined UTC timestamps, "Offer", handle time in milliseconds', () => {
  const r = parseHistoryCSV('Interval Start,Interval End,Queue,Media Type,Offer,Answer,Avg Handle\n2026-01-05T08:00:00.000Z,2026-01-05T08:30:00.000Z,Sales,voice,40,38,300000\n2026-01-05T08:30:00.000Z,2026-01-05T09:00:00.000Z,Sales,voice,60,55,320000\n')
  assert.equal(r.kind, 'interval')
  assert.equal(total(r), 100)
  assert.equal(r.columns.volume, 'Offer')
  assert.ok(Math.abs(r.rows[0].aht - 300) < 1e-9)
  assert.match(r.notes.join(' '), /milliseconds/)
})

test('NICE CXone: US dates, 12-hour times, "Contacts Offered", mm:ss handle time', () => {
  const r = parseHistoryCSV('Date,Interval,Skill Name,Contacts Offered,Contacts Handled,AHT\n01/13/2026,8:00 AM,Billing,25,24,05:00\n01/13/2026,1:30 PM,Billing,35,33,06:00\n')
  assert.deepEqual(r.rows.map((x) => [x.date, x.time, x.volume, x.aht]), [['2026-01-13', 480, 25, 300], ['2026-01-13', 810, 35, 360]])
  assert.equal(r.columns.volume, 'Contacts Offered')
})

test('Avaya CMS: time ranges and answered-calls warning', () => {
  const r = parseHistoryCSV('Date,Time,Split/Skill,ACD Calls,Avg ACD Time\n01/13/2026,8:00 AM-8:30 AM,1,20,04:30\n')
  assert.equal(r.rows[0].time, 480)
  assert.equal(r.rows[0].aht, 270)
  assert.match(r.notes.join(' '), /answered/)
})

test('Amazon Connect: date and time in one column, "Contacts queued"', () => {
  const r = parseHistoryCSV('StartInterval,EndInterval,Queue,Contacts queued,Average handle time\n2026-02-02 09:00,2026-02-02 09:30,Q1,12,290.5\n')
  assert.deepEqual([r.rows[0].date, r.rows[0].time, r.rows[0].volume, r.rows[0].aht], ['2026-02-02', 540, 12, 290.5])
})

test('Five9: "HALF HOUR" times and hh:mm:ss handle time', () => {
  const r = parseHistoryCSV('DATE,HALF HOUR,SKILL,CALLS,HANDLE TIME\n13/01/2026,08:00,A,10,00:05:00\n13/01/2026,08:30,A,14,00:04:00\n')
  assert.equal(r.kind, 'interval')
  assert.deepEqual(r.rows.map((x) => x.aht), [300, 240])
})

test('Excel (UK): BOM, units in header, thousands separators', () => {
  const r = parseHistoryCSV('﻿Date,Time,Calls Offered,AHT (secs)\n13/01/2026,08:00,"1,250",310\n')
  assert.equal(r.rows[0].volume, 1250)
  assert.equal(r.rows[0].aht, 310)
})

test('total handle time is divided by volume', () => {
  const r = parseHistoryCSV('date,calls,total handle time\n2026-01-05,10,3000\n')
  assert.equal(r.rows[0].aht, 300)
})

test('several queues are reported, and one or all can be imported', () => {
  const text = 'date,time,queue,calls\n2026-01-05,08:00,A,10\n2026-01-05,08:00,B,5\n2026-01-05,08:30,A,20\n'
  const all = parseHistoryCSV(text)
  assert.deepEqual(all.queues, [{ name: 'A', volume: 30 }, { name: 'B', volume: 5 }])
  assert.equal(all.rows.length, 2, 'queues combined per interval')
  assert.equal(total(parseHistoryCSV(text, { queue: 'B' })), 5)
  assert.equal(total(parseHistoryCSV(text, { queue: '*' })), 35)
})

test('duplicate rows merge: the repeated hour when clocks go back, and daily files with several rows a day', () => {
  const dst = parseHistoryCSV('date,time,calls,aht\n2026-10-25,01:00,10,300\n2026-10-25,01:00,10,200\n')
  assert.equal(dst.rows.length, 1)
  assert.equal(dst.rows[0].volume, 20)
  assert.equal(dst.rows[0].aht, 250)
  const daily = parseHistoryCSV('date,calls\n2026-01-05,10\n2026-01-05,15\n2026-01-06,7\n')
  assert.deepEqual(daily.rows.map((x) => x.volume), [25, 7])
})

test('unknown headings say what is needed', () => {
  const r = parseHistoryCSV('Datum;Aantal\n13/01/2026;10\n')
  assert.equal(r.rows.length, 0)
  assert.match(r.errors.join(' '), /date column/)
})

test('roster import reads 12-hour times and looser headings', () => {
  const r = parseScheduleCSV('Agent,Shift Date,Shift Start Time,Shift End Time,Break 1 Start,Break 1 End\nA1,2026-11-02,8:00 AM,4:30 PM,12:00 PM,12:30 PM\n')
  assert.equal(r.errors.length, 0)
  assert.equal(r.shifts.length, 1)
  assert.equal(r.shifts[0].start, 480)
  assert.equal(r.shifts[0].end, 990)
})

test('export gaps are filled on open weekdays; closures and recorded zeros stay zero', async () => {
  const { toDailySeries } = await import('../src/engine/forecast.js')
  const { addDays, weekdayIndex } = await import('../src/engine/dates.js')
  const rows = []
  for (let i = 0; i < 70; i++) {
    const date = addDays('2026-01-05', i) // a Monday
    const wd = weekdayIndex(date) // 0 = Monday
    if (wd >= 5) continue // weekends closed and absent
    if (i === 30) continue // a Wednesday missing from the export
    rows.push({ date, volume: i === 37 ? 0 : 100 }) // recorded zero (e.g. a closure)
  }
  const s = toDailySeries(rows)
  assert.equal(s.values[30], 100)
  assert.deepEqual(s.filled, ['2026-02-04'])
  assert.equal(s.values[5], 0, 'Saturday stays closed')
  assert.equal(s.values[37], 0, 'recorded zero stays zero')
})
