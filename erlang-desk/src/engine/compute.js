// Whole-workspace planning run: every service from forecast to hiring plan,
// plus portfolio totals by site and channel. Pure and deterministic so it
// can run in a Web Worker, in tests, or (later) on a server.
//
// `cache` persists between runs so editing one assumption only recomputes
// the stages downstream of it.

import { forecastDaily } from './forecast.js'
import { bankHolidays } from './holidays.js'
import { defaultProfiles, learnProfiles, weekdayAht } from './profiles.js'
import { intervalRequirements, weeklyRequirements, simulateSupply, recommendHires, unfixableWeeks } from './capacity.js'
import { resolveSettings, resolveCapacity } from './channels.js'
import { weekStart, addDays } from './dates.js'

export function createCache() {
  return new Map()
}

function memo(cache, key, fn) {
  if (cache.has(key)) return cache.get(key)
  const v = fn()
  cache.set(key, v)
  return v
}

function historyKey(h) {
  if (!h?.dailyRows?.length) return 'none'
  const d = h.dailyRows
  return `${h.loadedAt}|${d.length}|${d[0].date}|${d[d.length - 1].date}|${h.intervalRows?.length ?? 0}`
}

export function computeService(service, site, cache = createCache()) {
  const s = resolveSettings(service, site)
  const capacity = resolveCapacity(service, site)
  const plan = service.plan
  const daily = service.history?.dailyRows ?? []
  const hk = `${service.id}|${historyKey(service.history)}`
  const empty = { serviceId: service.id, forecast: null, dayReqs: [], weeks: [], sim: [], recs: [], simWithRecs: [], unfixable: [], settings: s }
  if (daily.length < 7) return empty

  const fKey = `${hk}|f|${plan.method}|${plan.horizonWeeks}|${plan.volumeAdjustPct}`
  const forecast = memo(cache, fKey, () => {
    const last = daily[daily.length - 1].date
    const next = addDays(last, 1)
    const firstMonday = weekStart(next) === next ? next : addDays(weekStart(next), 7)
    const lead = Math.round((Date.parse(firstMonday) - Date.parse(last)) / 864e5) - 1
    const holidays = bankHolidays(Number(daily[0].date.slice(0, 4)), Number(addDays(last, lead + plan.horizonWeeks * 7).slice(0, 4)))
    return forecastDaily(daily, { horizon: lead + plan.horizonWeeks * 7, method: plan.method, adjustPct: plan.volumeAdjustPct, holidays })
  })
  if (forecast.error) return { ...empty, forecast }

  const profiles = memo(cache, `${hk}|p|${s.intervalMin}|${JSON.stringify(s.hours)}`, () => {
    const learnt = service.history?.intervalRows?.length ? learnProfiles(service.history.intervalRows, s.intervalMin) : null
    return learnt ?? defaultProfiles(s)
  })
  const ahtByWeekday = memo(cache, `${hk}|a|${s.defaultAht}`, () => weekdayAht(daily, s.defaultAht))
  const dayReqs = memo(cache, `${fKey}|r|${JSON.stringify(s)}|${plan.ahtAdjustPct}`, () =>
    intervalRequirements(forecast.points, profiles, ahtByWeekday, s, { ahtAdjustPct: plan.ahtAdjustPct }))
  const weeks = weeklyRequirements(dayReqs, s).filter((w) => !w.partial)
  const sim = simulateSupply(weeks, capacity, service.hires)
  const recs = recommendHires(weeks, capacity, service.hires)
  const simWithRecs = recs.length ? simulateSupply(weeks, capacity, [...service.hires, ...recs]) : sim
  return {
    serviceId: service.id,
    settings: s,
    capacity,
    forecast,
    dayReqs,
    weeks,
    sim,
    recs,
    simWithRecs,
    unfixable: unfixableWeeks(sim, capacity),
  }
}

/** Sum weekly required/available FTE across services, grouped by any key. */
export function aggregateWeeks(results, services, groupBy = () => 'all') {
  const byId = new Map(services.map((s) => [s.id, s]))
  const groups = new Map()
  for (const r of results) {
    const svc = byId.get(r.serviceId)
    if (!svc || !r.sim.length) continue
    const g = groupBy(svc)
    if (!groups.has(g)) groups.set(g, new Map())
    const weeks = groups.get(g)
    for (const w of r.sim) {
      const cur = weeks.get(w.week) ?? { week: w.week, requiredFte: 0, availableFte: 0, headcount: 0, services: 0 }
      cur.requiredFte += w.requiredFte
      cur.availableFte += w.availableFte
      cur.headcount += w.headcount
      cur.services += 1
      weeks.set(w.week, cur)
    }
  }
  const out = {}
  for (const [g, weeks] of groups) {
    out[g] = [...weeks.values()].sort((a, b) => (a.week < b.week ? -1 : 1)).map((w) => ({ ...w, gap: w.availableFte - w.requiredFte }))
  }
  return out
}

export function computeWorkspace(ws, cache = createCache()) {
  const sites = new Map(ws.sites.map((s) => [s.id, s]))
  const results = ws.services.map((svc) => computeService(svc, sites.get(svc.siteId), cache))
  // Keep the cache from growing without bound across a long session.
  if (cache.size > 400) {
    const keep = [...cache.keys()].slice(-200)
    for (const k of [...cache.keys()]) if (!keep.includes(k)) cache.delete(k)
  }
  const total = aggregateWeeks(results, ws.services).all ?? []
  return {
    services: Object.fromEntries(results.map((r) => [r.serviceId, r])),
    total,
    bySite: aggregateWeeks(results, ws.services, (s) => s.siteId),
    byChannel: aggregateWeeks(results, ws.services, (s) => s.channel),
  }
}
