import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bankHolidays, easterSunday } from '../src/engine/holidays.js'
import { forecastDaily } from '../src/engine/forecast.js'
import { addDays, weekdayIndex } from '../src/engine/dates.js'

test('England and Wales bank holidays match gov.uk', () => {
  assert.equal(easterSunday(2026), '2026-04-05')
  assert.equal(easterSunday(2027), '2027-03-28')
  const dates = (y) => [...bankHolidays(y, y).keys()].sort()
  assert.deepEqual(dates(2026), ['2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28'])
  assert.deepEqual(dates(2027), ['2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03', '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28'])
  assert.deepEqual(dates(2022), ['2022-01-03', '2022-04-15', '2022-04-18', '2022-05-02', '2022-06-02', '2022-06-03', '2022-08-29', '2022-09-19', '2022-12-26', '2022-12-27'])
  assert.ok(bankHolidays(2023, 2023).has('2023-05-08'), 'coronation')
  assert.ok(bankHolidays(2020, 2020).has('2020-05-08') && !bankHolidays(2020, 2020).has('2020-05-04'), 'VE Day move')
})

test('forecasts on bank holidays follow how past ones ran', () => {
  const holidays = bankHolidays(2024, 2027)
  const rows = []
  for (let i = 0; i < 730; i++) {
    const date = addDays('2024-11-04', i)
    const wd = weekdayIndex(date)
    const base = wd >= 5 ? 300 : 1000
    rows.push({ date, volume: holidays.has(date) ? base * 0.3 : base })
  }
  const f = forecastDaily(rows, { horizon: 120, holidays })
  const at = (d) => f.points.find((p) => p.date === d)?.volume
  assert.ok(f.holidaysLearned >= 10)
  assert.ok(Math.abs(at('2026-12-25') / 1000 - 0.3) < 0.05, `Christmas ${at('2026-12-25')}`)
  assert.ok(Math.abs(at('2026-12-24') / 1000 - 1) < 0.05, 'Christmas Eve is a normal Thursday here')
  const plain = forecastDaily(rows, { horizon: 120 })
  assert.ok(plain.points.find((p) => p.date === '2026-12-25').volume > 800, 'without the calendar the dip is missed')
})
