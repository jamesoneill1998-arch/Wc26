// Deterministic demo data: two years of contact history per channel, with
// trend, weekly and annual seasonality, channel-specific intraday curves,
// bank-holiday dips and noise. Lets prospects try the product instantly.

import { addDays, weekdayIndex, parseISODate } from './dates.js'
import { bankHolidays } from './holidays.js'

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(rand) {
  const u = Math.max(rand(), 1e-12)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

const bump = (h, mid, width) => Math.exp(-((h - mid) ** 2) / width)

const PROFILES = {
  voice: {
    baseDaily: 2400,
    aht: 300,
    weekday: [1.18, 1.06, 1.0, 0.98, 0.94, 0.52, 0.3],
    intraday(h, wd) {
      if (wd >= 5) return h < 9 || h >= 17 ? 0 : bump(h, 12.5, 6)
      if (h < 8 || h >= 20) return 0
      return bump(h, 10.5, 3.2) + 0.8 * bump(h, 14.5, 4.5) + 0.25 * bump(h, 18.5, 2)
    },
  },
  chat: {
    baseDaily: 1100,
    aht: 720,
    weekday: [1.05, 1.02, 1.0, 1.0, 0.95, 0.6, 0.42],
    intraday(h, wd) {
      if (wd === 6) return h < 10 || h >= 16 ? 0 : 1
      if (wd === 5) return h < 9 || h >= 18 ? 0 : bump(h, 13, 8)
      if (h < 8 || h >= 22) return 0
      return 0.7 * bump(h, 11, 5) + 0.6 * bump(h, 14, 5) + bump(h, 19.5, 3.5)
    },
  },
  backoffice: { baseDaily: 1500, aht: 420, weekday: [1.3, 1.1, 1.0, 1.0, 0.95, 0.25, 0.15], intraday: null },
  branch: {
    baseDaily: 2600,
    aht: 600,
    weekday: [1.0, 0.9, 0.9, 0.95, 1.15, 0.85, 0],
    intraday(h, wd) {
      if (wd === 6) return 0
      if (wd === 5) return h < 9 || h >= 16 ? 0 : bump(h, 11.5, 4)
      if (h < 9 || h >= 17.5) return 0
      return 0.6 * bump(h, 10, 2) + bump(h, 12.75, 1.2) + 0.7 * bump(h, 16, 1.5)
    },
  },
}

/** Back-compat helper for the voice curve. */
export function demoIntradayWeight(mins, weekday) {
  return PROFILES.voice.intraday(mins / 60, weekday)
}

/**
 * @returns rows of {date, time, volume, aht} (interval channels) or
 *          {date, volume, aht} (back office, which is planned daily)
 */
export function generateSampleHistory({ channel = 'voice', endDate, days = 728, intervalMin = 30, seed = 42, scale = 1 } = {}) {
  const prof = PROFILES[channel] ?? PROFILES.voice
  const rand = mulberry32(seed)
  const end = endDate ?? new Date().toISOString().slice(0, 10)
  const start = addDays(end, -(days - 1))
  const bank = bankHolidays(Number(start.slice(0, 4)), Number(end.slice(0, 4)))
  const rows = []
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i)
    const wd = weekdayIndex(date)
    const t = new Date(parseISODate(date))
    const doy = t.getUTCMonth() * 30.4 + t.getUTCDate()
    const trend = 1 + 0.12 * (i / 365)
    const annual = 1 + 0.12 * Math.cos((2 * Math.PI * (doy - 15)) / 365) // January peak
    rand() // keeps the random sequence stable for the rest of the sample
    const holiday = bank.has(date) ? 0.35 : 1
    const daily = prof.baseDaily * scale * trend * annual * prof.weekday[wd] * holiday * (1 + 0.05 * gaussian(rand))
    const ahtBase = prof.aht * (1 + (wd === 0 ? 0.05 : 0) + 0.03 * Math.sin((2 * Math.PI * i) / 365))
    if (!prof.intraday) {
      rows.push({ date, volume: Math.max(0, Math.round(daily)), aht: Math.round(ahtBase * (1 + 0.04 * gaussian(rand))) })
      continue
    }
    const weights = []
    for (let m = 0; m < 1440; m += intervalMin) weights.push(prof.intraday((m + intervalMin / 2) / 60, wd))
    const total = weights.reduce((s, w) => s + w, 0)
    if (total <= 0) continue
    weights.forEach((w, k) => {
      if (w <= 0) return
      const mean = (daily * w) / total
      const volume = Math.max(0, Math.round(mean + Math.sqrt(mean) * gaussian(rand)))
      const aht = Math.round(ahtBase * (1 + 0.06 * gaussian(rand)))
      rows.push({ date, time: k * intervalMin, volume, aht })
    })
  }
  return rows
}
