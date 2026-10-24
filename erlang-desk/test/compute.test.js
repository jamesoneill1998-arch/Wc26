import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeWorkspace, createCache } from '../src/engine/compute.js'
import { defaultSites, defaultServiceSettings, siteShrinkage, resolveSettings } from '../src/engine/channels.js'
import { generateSampleHistory } from '../src/engine/sample.js'
import { aggregateDaily } from '../src/engine/csv.js'
import { backofficeRequirements } from '../src/engine/capacity.js'

function service(id, channel, siteId) {
  const rows = generateSampleHistory({ channel, endDate: '2026-10-18', days: 400, seed: id.length })
  const interval = channel !== 'backoffice'
  return {
    id, name: id, channel, siteId,
    settings: defaultServiceSettings(channel),
    plan: { method: 'auto', horizonWeeks: 8, volumeAdjustPct: 0, ahtAdjustPct: 0 },
    capacity: { startHeadcount: 40, trainingWeeks: 3, nestingWeeks: 2, nestingProductivity: 0.6, classCadenceWeeks: 4, gapToleranceFte: 0.5 },
    hires: [],
    history: { kind: interval ? 'interval' : 'daily', loadedAt: 'x', dailyRows: interval ? aggregateDaily(rows) : rows, intervalRows: interval ? rows.slice(-6000) : [] },
  }
}

test('default sites carry UK 35% and offshore 20% shrinkage', () => {
  const [uk, os] = defaultSites()
  assert.ok(Math.abs(siteShrinkage(uk) - 0.35) < 1e-9)
  assert.ok(Math.abs(siteShrinkage(os) - 0.2) < 1e-9)
})

test('same work needs more FTE in the UK than offshore', () => {
  const ws = { sites: defaultSites(), services: [service('voice-uk', 'voice', 'uk'), { ...service('voice-uk', 'voice', 'offshore'), id: 'voice-os' }] }
  const out = computeWorkspace(ws)
  const uk = out.services['voice-uk'].weeks[0]
  const os = out.services['voice-os'].weeks[0]
  assert.equal(Math.round(uk.productiveHours), Math.round(os.productiveHours))
  // (1-0.20)/(1-0.35) × 40/37.5 ≈ 1.31
  assert.ok(Math.abs(uk.requiredFte / os.requiredFte - (0.8 / 0.65) * (40 / 37.5)) < 1e-6)
})

test('all four channels plan end to end and roll up', () => {
  const services = [service('v', 'voice', 'uk'), service('ch', 'chat', 'offshore'), service('bo', 'backoffice', 'uk'), service('br', 'branch', 'uk')]
  const cache = createCache()
  const t0 = Date.now()
  const out = computeWorkspace({ sites: defaultSites(), services }, cache)
  const first = Date.now() - t0
  for (const s of services) {
    const r = out.services[s.id]
    assert.equal(r.weeks.length, 8, s.channel)
    assert.ok(r.weeks.every((w) => w.requiredFte > 0), s.channel)
  }
  assert.equal(out.total.length, 8)
  assert.ok(Math.abs(out.total[0].requiredFte - services.reduce((t, s) => t + out.services[s.id].weeks[0].requiredFte, 0)) < 1e-6)
  assert.deepEqual(Object.keys(out.bySite).sort(), ['offshore', 'uk'])
  assert.equal(Object.keys(out.byChannel).length, 4)
  // Branch minimum cover: at least one person per branch whenever open.
  const br = out.services.br.dayReqs.find((d) => d.intervals.some((iv) => iv.open))
  br.intervals.filter((iv) => iv.open).forEach((iv) => assert.ok(iv.agents >= 25))
  // Voice runs Erlang A, so abandonment is reported.
  assert.ok(out.services.v.dayReqs[0].intervals.some((iv) => iv.abandon != null))
  // Second run with the same inputs is served from cache.
  const t1 = Date.now()
  computeWorkspace({ sites: defaultSites(), services }, cache)
  assert.ok(Date.now() - t1 < first / 2 + 50, `cached ${Date.now() - t1}ms vs first ${first}ms`)
})

test('back office rolls weekend work to Monday and smooths over the SLA', () => {
  const s = { ...resolveSettings({ channel: 'backoffice', settings: { ...defaultServiceSettings('backoffice'), slaDays: 1, utilisation: 1 } }, defaultSites()[0]) }
  // Mon 2026-10-19 .. Sun 2026-10-25, 36 items × 100s = 1h each day
  const days = Array.from({ length: 7 }, (_, i) => ({ date: `2026-10-${19 + i}`, volume: 36 }))
  const r = backofficeRequirements(days, new Array(7).fill(100), s)
  assert.deepEqual(r.map((d) => +d.agentHours.toFixed(6)), [1, 1, 1, 1, 1, 0, 0])
  const total = r.reduce((t, d) => t + d.agentHours, 0)
  assert.equal(total, 5) // weekend work lands next Monday, outside this week
  const r2 = backofficeRequirements([...days, { date: '2026-10-26', volume: 36 }], new Array(7).fill(100), s)
  assert.equal(+r2[7].agentHours.toFixed(6), 3)
  const smooth = backofficeRequirements([...days, { date: '2026-10-26', volume: 36 }], new Array(7).fill(100), { ...s, slaDays: 3 })
  assert.ok(smooth[7].agentHours < 3 && smooth[7].agentHours > 1)
})
