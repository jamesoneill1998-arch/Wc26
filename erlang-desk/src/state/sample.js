// The demo operation prospects see: four services across two sites.

import { generateSampleHistory } from '../engine/sample.js'
import { aggregateDaily } from '../engine/csv.js'
import { addDays } from '../engine/dates.js'
import { emptyWorkspace, newService, trimIntervalRows, emptySchedule, newArea, thisMonth } from './store.js'
import { areaPlan } from '../engine/impact.js'

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
  const mortgages = sampleArea()
  ws.areas = [mortgages]
  ws.activeAreaId = mortgages.id
  ws.changes = sampleChanges(mortgages)
  return ws
}

/** Mortgages servicing: a year of monthly forecast with a January peak, staffed a few FTE above need. */
function sampleArea() {
  const area = newArea({ name: 'Mortgages', channel: 'voice', siteId: 'uk', startMonth: thisMonth(1) })
  const [y, m] = area.startMonth.split('-').map(Number)
  area.rows = area.rows.map((_, i) => {
    const month = ((m - 1 + i) % 12) + 1
    const season = 1 + 0.12 * Math.cos((2 * Math.PI * (month - 1)) / 12)
    return { volume: Math.round(46000 * season / 100) * 100, aht: 450, operationalFte: null, mtpFte: null }
  })
  const plan = areaPlan(area, { shrinkage: 0.35, weeklyHours: 37.5 })
  area.rows = area.rows.map((r, i) => ({
    ...r,
    // A little above need, eroding through the year with attrition
    operationalFte: Math.round(plan[i].requiredFte * (1.06 - 0.004 * i)),
    mtpFte: Math.round(plan[i].requiredFte * 1.02),
  }))
  return area
}

function sampleChanges(area) {
  const at = (n) => {
    const [y, m] = area.startMonth.split('-').map(Number)
    const t = y * 12 + m - 1 + n
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
  }
  const id = () => Math.random().toString(36).slice(2, 10)
  return [
    {
      id: id(), name: 'Mortgage acquisition launch', areaId: area.id, status: 'proposed', inMtp: false, owner: 'Change delivery',
      notes: 'New-to-bank mortgage proposition. 25,000 completions expected over the first six months; customers call most in their first month.',
      driver: { type: 'acquisitions', startMonth: at(2), months: 6, total: 25000, unitLabel: 'acquisitions', profile: 'flat', contactsPerUnit: 1.5, curve: [0.5, 0.3, 0.2], aht: 540 },
    },
    {
      id: id(), name: 'Remortgage retention campaign', areaId: area.id, status: 'approved', inMtp: false, owner: 'Marketing',
      notes: 'Outbound mailing to customers approaching the end of their fixed rate.',
      driver: { type: 'volume', startMonth: at(1), months: 3, mode: 'pct', value: 0.04, aht: 450 },
    },
    {
      id: id(), name: 'Core platform upgrade training', areaId: area.id, status: 'approved', inMtp: false, owner: 'IT change',
      notes: 'Every adviser off the phones for one day of system training.',
      driver: { type: 'abstraction', startMonth: at(1), months: 1, people: 70, hoursPerPerson: 7.5 },
    },
    {
      id: id(), name: 'Online document upload', areaId: area.id, status: 'proposed', inMtp: false, owner: 'Digital',
      notes: 'Customers upload proof documents online, removing the "where do I send it" part of a third of calls.',
      driver: { type: 'aht', startMonth: at(4), months: 8, deltaSec: -40, share: 0.33 },
    },
  ]
}
