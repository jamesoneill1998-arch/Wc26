// The demo operation prospects see: four services across two sites.

import { generateSampleHistory } from '../engine/sample.js'
import { aggregateDaily } from '../engine/csv.js'
import { addDays } from '../engine/dates.js'
import { emptyWorkspace, newService, trimIntervalRows, emptySchedule } from './store.js'

const P = (start, end, breakMin, counts) => ({ id: `${start}${end}`.replace(/:/g, ''), start, end, breakMin, counts })

// Example rosters, deliberately imperfect: weekday voice is close to target,
// weekends run short, and chat is the wrong shape for its evening peak.
const ROSTERS = {
  voice: [
    P('08:00', '16:30', 30, [12, 11, 11, 11, 11, 0, 0]),
    P('08:30', '17:00', 30, [10, 8, 8, 8, 8, 0, 0]),
    P('09:00', '17:30', 30, [8, 8, 8, 8, 7, 0, 0]),
    P('10:00', '18:30', 30, [6, 5, 5, 5, 5, 0, 0]),
    P('11:30', '20:00', 30, [7, 7, 6, 6, 6, 0, 0]),
    P('09:30', '14:30', 0, [10, 8, 6, 6, 6, 0, 0]),
    P('09:00', '17:00', 30, [0, 0, 0, 0, 0, 15, 9]),
    P('10:00', '15:00', 0, [0, 0, 0, 0, 0, 11, 6]),
  ],
  chat: [
    P('08:00', '16:30', 30, [6, 6, 6, 6, 5, 0, 0]),
    P('10:00', '18:30', 30, [7, 7, 7, 7, 6, 0, 0]),
    P('13:30', '22:00', 30, [10, 10, 10, 10, 9, 0, 0]),
    P('10:00', '15:00', 0, [4, 4, 4, 4, 4, 5, 0]),
    P('09:00', '17:30', 30, [0, 0, 0, 0, 0, 8, 0]),
    P('10:00', '16:00', 30, [0, 0, 0, 0, 0, 0, 10]),
  ],
}

const SERVICES = [
  { name: 'Customer service', channel: 'voice', siteId: 'uk', seed: 42, scale: 1 },
  { name: 'Customer service', channel: 'chat', siteId: 'offshore', seed: 7, scale: 1 },
  { name: 'Claims processing', channel: 'backoffice', siteId: 'uk', seed: 11, scale: 1 },
  { name: 'Branch network', channel: 'branch', siteId: 'uk', seed: 19, scale: 1 },
]

export function historyFrom(kind, rows, source) {
  const dailyRows = kind === 'interval' ? aggregateDaily(rows) : [...rows].sort((a, b) => (a.date < b.date ? -1 : 1))
  return {
    kind,
    source,
    loadedAt: new Date().toISOString(),
    dailyRows,
    intervalRows: kind === 'interval' ? trimIntervalRows(rows) : [],
  }
}

export function sampleHistory(channel, { seed = 42, scale = 1 } = {}) {
  const endDate = addDays(new Date().toISOString().slice(0, 10), -1)
  const rows = generateSampleHistory({ channel, endDate, seed, scale })
  return historyFrom(channel === 'backoffice' ? 'daily' : 'interval', rows, 'Sample data')
}

export function buildSampleWorkspace() {
  const ws = emptyWorkspace()
  ws.name = 'Northbridge Insurance (sample)'
  ws.services = SERVICES.map((d) => {
    const svc = newService(d)
    svc.history = sampleHistory(d.channel, d)
    svc.capacity = { ...svc.capacity, calibrate: true }
    if (ROSTERS[d.channel]) svc.schedule = { ...emptySchedule(), patterns: ROSTERS[d.channel] }
    return svc
  })
  ws.activeServiceId = ws.services[0].id
  return ws
}
