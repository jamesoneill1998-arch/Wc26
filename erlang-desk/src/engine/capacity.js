// From forecast to people: interval staffing requirements (Erlang C) and a
// week-by-week long-term capacity plan with attrition, hiring and ramp-up.

import { requiredAgents, withShrinkage } from './erlang.js'
import { addDays, weekdayIndex, weekStart } from './dates.js'
import { isOpen, slotsPerDay } from './profiles.js'

/**
 * Interval-level requirements for each forecast day.
 * @param {Array<{date, volume}>} days forecast points
 * @param {{volume:number[][], aht:(number|null)[][]|null}} profiles
 * @param {number[]} ahtByWeekday fallback AHT per weekday
 * @param {object} s settings
 */
export function intervalRequirements(days, profiles, ahtByWeekday, s, { ahtAdjustPct = 0 } = {}) {
  const n = slotsPerDay(s.intervalMin)
  const intervalSec = s.intervalMin * 60
  return days.map((d) => {
    const wd = weekdayIndex(d.date)
    const intervals = []
    let agentHours = 0
    let workloadHours = 0
    for (let k = 0; k < n; k++) {
      const time = k * s.intervalMin
      const volume = d.volume * (profiles.volume[wd][k] ?? 0)
      const aht = (profiles.aht?.[wd]?.[k] ?? ahtByWeekday[wd] ?? s.defaultAht) * (1 + ahtAdjustPct)
      const open = isOpen(s, wd, time)
      let agents = 0
      let sl = null
      let occ = null
      if (volume > 0.01) {
        const r = requiredAgents({
          volume, ahtSec: aht, intervalSec,
          targetSec: s.targetSec, slTarget: s.slTarget, asaTarget: s.asaTarget || null,
          maxOccupancy: s.maxOccupancy, concurrency: s.concurrency,
        })
        agents = r.agents
        sl = r.serviceLevel
        occ = r.occupancy
      }
      if (open) agents = Math.max(agents, s.minAgents ?? 0)
      agentHours += (agents * s.intervalMin) / 60
      workloadHours += (volume * aht) / 3600
      intervals.push({ time, volume, aht, agents, sl, occ, open })
    }
    return { date: d.date, volume: d.volume, agentHours, workloadHours, intervals }
  })
}

/** Roll interval requirements up to planning weeks (Mon-Sun). */
export function weeklyRequirements(dayReqs, s) {
  const byWeek = new Map()
  for (const d of dayReqs) {
    const wk = weekStart(d.date)
    const w = byWeek.get(wk) ?? { week: wk, volume: 0, agentHours: 0, workloadHours: 0, days: 0, ahtWork: 0 }
    w.volume += d.volume
    w.agentHours += d.agentHours
    w.workloadHours += d.workloadHours
    w.days += 1
    byWeek.set(wk, w)
  }
  return [...byWeek.values()].map((w) => {
    const scale = 7 / w.days // partial first/last weeks scaled to a full week
    const productiveHours = w.agentHours * scale
    return {
      week: w.week,
      partial: w.days < 7,
      volume: w.volume * scale,
      aht: w.volume > 0 ? (w.workloadHours * 3600) / w.volume : 0,
      productiveHours,
      requiredFte: withShrinkage(productiveHours, s.shrinkage) / s.fteHoursPerWeek,
      // Pure workload FTE ignores queueing; the difference is the cost of the SL target.
      workloadFte: withShrinkage(w.workloadHours * scale, s.shrinkage) / s.fteHoursPerWeek,
    }
  })
}

const weeklyAttrition = (monthly) => 1 - (1 - monthly) ** (12 / 52)

/** Productivity of a hire `age` weeks after their start date. */
function rampFactor(age, c) {
  if (age < 0) return 0
  if (age < c.trainingWeeks) return 0
  if (age < c.trainingWeeks + c.nestingWeeks) return c.nestingProductivity
  return 1
}

/**
 * Simulate supply against demand week by week.
 * @param {Array<{week, requiredFte}>} weeks
 * @param {object} c capacity assumptions
 * @param {Array<{week:string, count:number}>} hires planned classes (week = Monday ISO date)
 */
export function simulateSupply(weeks, c, hires = []) {
  const att = weeklyAttrition(c.monthlyAttrition)
  let tenured = c.startHeadcount
  // Each class carries its surviving heads; attrition hits everyone equally.
  const classes = hires.map((h) => ({ ...h, heads: h.count, startIdx: weeks.findIndex((w) => w.week === h.week) }))
  return weeks.map((w, i) => {
    let productive = tenured
    let headcount = tenured
    let inTraining = 0
    for (const cl of classes) {
      if (cl.startIdx < 0 || i < cl.startIdx) continue
      const f = rampFactor(i - cl.startIdx, c)
      productive += cl.heads * f
      headcount += cl.heads
      if (f < 1) inTraining += cl.heads
    }
    const row = {
      ...w,
      headcount,
      inTraining,
      availableFte: productive,
      gap: productive - w.requiredFte,
    }
    tenured *= 1 - att
    for (const cl of classes) if (cl.startIdx >= 0 && i >= cl.startIdx) cl.heads *= 1 - att
    return row
  })
}

/**
 * Suggest hiring classes that close every shortfall, respecting the ramp
 * lead time and a minimum gap between classes. Shortfalls inside the lead
 * time can't be fixed by hiring (see `unfixableWeeks`), so they are skipped.
 */
export function recommendHires(weeks, c, planned = []) {
  const lead = c.trainingWeeks + c.nestingWeeks
  const cadence = Math.max(1, c.classCadenceWeeks ?? 4)
  const tolerance = c.gapToleranceFte ?? 0.5
  const recs = []
  for (let guard = 0; guard < 52; guard++) {
    const sim = simulateSupply(weeks, c, [...planned, ...recs])
    const i = sim.findIndex((r, idx) => idx >= lead && r.gap < -tolerance)
    if (i < 0) break
    const startIdx = i - lead
    // Size the class for the worst gap in the window it is meant to cover,
    // grossed up for attrition between start and that week.
    const att = weeklyAttrition(c.monthlyAttrition)
    let need = 0
    for (let j = i; j < Math.min(sim.length, i + cadence); j++) {
      const survival = (1 - att) ** (j - startIdx)
      need = Math.max(need, -sim[j].gap / survival)
    }
    const count = Math.ceil(need)
    const existing = recs.find((r) => r.week === weeks[startIdx].week)
    if (existing) existing.count += count
    else recs.push({ week: weeks[startIdx].week, count, coversWeek: weeks[i].week })
  }
  return recs
}

/** Short weeks that fall before any new class could be productive: cover with overtime, leave moves or outsourcing. */
export function unfixableWeeks(sim, c) {
  const lead = c.trainingWeeks + c.nestingWeeks
  const tolerance = c.gapToleranceFte ?? 0.5
  return sim.slice(0, lead).filter((r) => r.gap < -tolerance)
}

/** Monday-aligned list of weeks starting at or after `fromISO`. */
export function planWeeks(fromISO, count) {
  const first = weekStart(fromISO) < fromISO ? addDays(weekStart(fromISO), 7) : weekStart(fromISO)
  return Array.from({ length: count }, (_, i) => addDays(first, i * 7))
}
