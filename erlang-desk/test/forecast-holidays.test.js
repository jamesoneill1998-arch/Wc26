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

test('Scotland and Northern Ireland follow gov.uk too (2019–2028, every date)', async () => {
  const { readFileSync } = await import('node:fs')
  const fx = JSON.parse(readFileSync(new URL('./fixtures/govuk-bank-holidays.json', import.meta.url), 'utf8'))
  for (const [key, region] of [['england-and-wales', 'england-wales'], ['scotland', 'scotland'], ['northern-ireland', 'northern-ireland']]) {
    assert.deepEqual([...bankHolidays(2019, 2028, region).keys()].sort(), fx[key], region)
  }
  assert.equal(bankHolidays(2026, 2026, 'none').size, 0)
  assert.equal(bankHolidays(2026, 2026, 'scotland').get('2026-06-15'), 'World Cup bank holiday')
  assert.ok(!bankHolidays(2026, 2026, 'england-wales').has('2026-06-15'))
})

test("a site's holiday region reaches its forecast, and each region's holidays are learned", async () => {
  const { buildSampleWorkspace } = await import('../src/state/sample.js')
  const { computeService } = await import('../src/engine/compute.js')
  const ws = buildSampleWorkspace()
  const svc = ws.services[0]
  const site = ws.sites.find((x) => x.id === svc.siteId)
  const learned = (r) => computeService(svc, { ...site, holidayRegion: r }).forecast.holidaysLearned
  assert.equal(learned('none'), 0)
  assert.notEqual(learned('scotland'), learned('england-wales'), 'a different calendar is used')

  // Scottish history: quiet on Scottish bank holidays, normal on English-only ones.
  const scot = bankHolidays(2024, 2027, 'scotland')
  const rows = []
  for (let i = 0; i < 730; i++) {
    const date = addDays('2024-11-04', i)
    const base = weekdayIndex(date) >= 5 ? 300 : 1000
    rows.push({ date, volume: scot.has(date) ? base * 0.3 : base })
  }
  const at = (f, d) => f.points.find((p) => p.date === d)?.volume
  const fScot = forecastDaily(rows, { horizon: 120, holidays: scot })
  const fEw = forecastDaily(rows, { horizon: 120, holidays: bankHolidays(2024, 2027, 'england-wales') })
  assert.ok(at(fScot, '2026-11-30') < 400, "St Andrew's Day dips with the Scottish calendar")
  assert.ok(at(fEw, '2026-11-30') > 800, 'but not with the English one')
})

test('older workspaces and bad values fall back to England and Wales', async () => {
  const { sanitizeWorkspace } = await import('../src/state/store.js')
  const { buildSampleWorkspace } = await import('../src/state/sample.js')
  const ws = buildSampleWorkspace()
  const sites = ws.sites.map((s, i) => { const { holidayRegion, ...rest } = s; return i === 0 ? rest : { ...rest, holidayRegion: 'mars' } })
  const clean = sanitizeWorkspace({ ...ws, sites })
  assert.deepEqual(clean.sites.map((s) => s.holidayRegion), ['england-wales', 'england-wales'])
  assert.equal(sanitizeWorkspace({ ...ws, sites: [{ ...ws.sites[0], holidayRegion: 'scotland' }, ws.sites[1]] }).sites[0].holidayRegion, 'scotland')
})
