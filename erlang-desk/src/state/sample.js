// The demo operation prospects see: four services across two sites.

import { generateSampleHistory } from '../engine/sample.js'
import { aggregateDaily } from '../engine/csv.js'
import { addDays } from '../engine/dates.js'
import { emptyWorkspace, newService, trimIntervalRows } from './store.js'

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
    return svc
  })
  ws.activeServiceId = ws.services[0].id
  return ws
}
