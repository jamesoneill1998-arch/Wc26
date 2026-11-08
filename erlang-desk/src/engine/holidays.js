// Public holidays that change contact demand. Customers ring less on bank
// holidays, wherever the agents sit, so the region follows the customers.

import { addDays, toISODate, weekdayIndex } from './dates.js'

/** Easter Sunday (Anonymous Gregorian algorithm). */
export function easterSunday(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1
  return toISODate(Date.UTC(y, month - 1, day))
}

const iso = (y, m, d) => toISODate(Date.UTC(y, m - 1, d))
const firstMonday = (y, m) => { let d = iso(y, m, 1); while (weekdayIndex(d) !== 0) d = addDays(d, 1); return d }
const lastMonday = (y, m) => { let d = addDays(iso(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1), -1); while (weekdayIndex(d) !== 0) d = addDays(d, -1); return d }
const nextWeekday = (d) => { while (weekdayIndex(d) >= 5) d = addDays(d, 1); return d }

// One-off changes announced by the government, by region.
const SPECIAL = {
  2011: { add: [['2011-04-29', 'Royal wedding']] },
  2012: { move: { spring: '2012-06-04' }, add: [['2012-06-05', 'Diamond Jubilee']] },
  2020: { move: { earlyMay: '2020-05-08' } },
  2022: { move: { spring: '2022-06-02' }, add: [['2022-06-03', 'Platinum Jubilee'], ['2022-09-19', 'State funeral']] },
  2023: { add: [['2023-05-08', 'Coronation']] },
  2026: { add: [['2026-06-15', 'World Cup bank holiday', ['scotland']]] },
}

export const HOLIDAY_REGIONS = {
  'england-wales': 'England and Wales',
  scotland: 'Scotland',
  'northern-ireland': 'Northern Ireland',
  none: 'None',
}

/**
 * UK bank holidays for the given years, following gov.uk's rules for each
 * region, including substitute days and announced one-offs.
 * @param {'england-wales'|'scotland'|'northern-ireland'|'none'} region
 * @returns {Map<string, string>} ISO date → holiday name
 */
export function bankHolidays(fromYear, toYear, region = 'england-wales') {
  const out = new Map()
  if (region === 'none' || !HOLIDAY_REGIONS[region]) return out
  const scot = region === 'scotland'
  const ni = region === 'northern-ireland'
  for (let y = fromYear; y <= toYear; y++) {
    const sp = SPECIAL[y] ?? {}
    const easter = easterSunday(y)
    const newYear = nextWeekday(iso(y, 1, 1))
    out.set(newYear, "New Year's Day")
    if (scot) {
      const second = iso(y, 1, 2) > newYear ? iso(y, 1, 2) : addDays(newYear, 1)
      out.set(nextWeekday(second), '2nd January')
    }
    if (ni) out.set(nextWeekday(iso(y, 3, 17)), "St Patrick's Day")
    out.set(addDays(easter, -2), 'Good Friday')
    if (!scot) out.set(addDays(easter, 1), 'Easter Monday')
    out.set(sp.move?.earlyMay ?? firstMonday(y, 5), 'Early May bank holiday')
    out.set(sp.move?.spring ?? lastMonday(y, 5), 'Spring bank holiday')
    if (ni) out.set(nextWeekday(iso(y, 7, 12)), 'Battle of the Boyne')
    out.set(scot ? firstMonday(y, 8) : lastMonday(y, 8), 'Summer bank holiday')
    if (scot) out.set(nextWeekday(iso(y, 11, 30)), "St Andrew's Day")
    // Christmas and Boxing Day move to the next free weekdays.
    const xmas = iso(y, 12, 25)
    const xmasWd = weekdayIndex(xmas)
    if (xmasWd === 5) { out.set(iso(y, 12, 27), 'Christmas Day'); out.set(iso(y, 12, 28), 'Boxing Day') }
    else if (xmasWd === 6) { out.set(iso(y, 12, 26), 'Boxing Day'); out.set(iso(y, 12, 27), 'Christmas Day') }
    else if (xmasWd === 4) { out.set(xmas, 'Christmas Day'); out.set(iso(y, 12, 28), 'Boxing Day') }
    else { out.set(xmas, 'Christmas Day'); out.set(iso(y, 12, 26), 'Boxing Day') }
    for (const [d, name, regions] of sp.add ?? []) if (!regions || regions.includes(region)) out.set(d, name)
  }
  return out
}
