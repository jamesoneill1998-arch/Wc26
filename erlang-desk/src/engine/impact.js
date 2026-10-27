// Aggregate (top-down) capacity and change impact assessment.
//
// An *area* (e.g. Mortgages) holds a monthly plan: forecast volume, AHT and
// operational FTE. Volume converts to required FTE as
//
//   FTE = workload hours ÷ occupancy ÷ (1 − shrinkage) ÷ paid hours per FTE-month
//
// A *change* (a project, campaign, migration) converts its own assumptions
// into extra contacts, workload or abstraction by month. Each change is
// judged against the headroom left after the baseline and every committed
// change that isn't already in the medium-term plan (MTP).

import { serviceLevel } from './erlang.js'
import { erlangA } from './erlangA.js'

// ── Months ──────────────────────────────────────────────────────────────────

export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number)
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

export function monthIndex(from, ym) {
  const [a, b] = from.split('-').map(Number)
  const [c, d] = ym.split('-').map(Number)
  return (c - a) * 12 + (d - b)
}

export function monthLabel(ym, long = false) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: long ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' })
}

export const hoursPerFteMonth = (weeklyHours) => (weeklyHours * 52) / 12

// ── Occupancy ───────────────────────────────────────────────────────────────

/**
 * Staff needed on average across the open hours to meet the service target,
 * as a continuous number (interpolated between whole agents), so small
 * changes give small answers instead of jumping by a whole person.
 */
export function erlangAgents({ volume, ahtSec, intervalSec = 1800, targetSec, slTarget, maxOccupancy = 1, patienceSec = null }) {
  if (!(volume > 0) || !(ahtSec > 0)) return 0
  const traffic = (volume * ahtSec) / intervalSec
  const sl = (n) => (patienceSec ? erlangA(n, { volume, ahtSec, intervalSec, patienceSec, targetSec }).serviceLevel : serviceLevel(n, traffic, ahtSec, targetSec))
  let n = patienceSec ? 1 : Math.floor(traffic) + 1
  while (sl(n) < slTarget && n < traffic * 3 + 50) n++
  const below = n - 1
  const slBelow = below > 0 && (patienceSec || below > traffic) ? sl(below) : 0
  const frac = sl(n) > slBelow ? (slTarget - slBelow) / (sl(n) - slBelow) : 1
  const agents = below + Math.min(1, Math.max(0, frac))
  return Math.max(agents, maxOccupancy > 0 && maxOccupancy < 1 ? traffic / maxOccupancy : 0)
}

/**
 * Occupancy to plan with for a month. Manual: the planner's assumption.
 * Erlang: what the service target allows at the month's typical interval
 * load, scaled up by an intraday peak factor (average load understates the
 * staffing busy intervals need).
 */
export function occupancyFor(workloadHours, ahtSec, a) {
  const s = a.settings
  if (a.channel === 'backoffice' || s.occupancyMode !== 'erlang') return s.occupancy
  const openHours = hoursPerFteMonth(s.openHoursPerWeek)
  if (!(workloadHours > 0) || !(openHours > 0) || !(ahtSec > 0)) return s.occupancy
  const k = Math.max(1, s.concurrency || 1)
  const perInterval = ((workloadHours * 3600) / ahtSec / (openHours * 2)) * (s.peakFactor || 1)
  const agents = erlangAgents({
    volume: perInterval, ahtSec: ahtSec / k, targetSec: s.targetSec, slTarget: s.slTarget,
    maxOccupancy: s.maxOccupancy, patienceSec: a.channel === 'voice' || a.channel === 'chat' ? s.patienceSec : null,
  })
  const traffic = (perInterval * (ahtSec / k)) / 1800
  return agents > 0 ? Math.min(s.maxOccupancy || 1, traffic / agents) : s.occupancy
}

/** Required FTE for a month's workload. */
export function fteFor(workloadHours, ahtSec, a, shrinkage, weeklyHours) {
  if (!(workloadHours > 0)) return 0
  const occ = occupancyFor(workloadHours, ahtSec, a)
  return workloadHours / occ / (1 - shrinkage) / hoursPerFteMonth(weeklyHours)
}

// ── Change drivers ──────────────────────────────────────────────────────────

const PROFILES = {
  flat: (m) => Array.from({ length: m }, () => 1),
  ramp: (m) => Array.from({ length: m }, (_, i) => i + 1),
  front: (m) => Array.from({ length: m }, (_, i) => m - i),
}

/** Units (e.g. acquisitions) landing in each month of the driver window. */
export function unitsByMonth(total, months, profile = 'flat') {
  const w = (PROFILES[profile] ?? PROFILES.flat)(Math.max(1, months))
  const sum = w.reduce((t, v) => t + v, 0)
  return w.map((v) => (total * v) / sum)
}

/**
 * Monthly effect of one change on an area, aligned to the area's months.
 * @returns {{contacts:number[], workloadHours:number[], abstractionHours:number[], beyondPlan:number}}
 */
export function changeEffect(change, a, baseRows) {
  const n = baseRows.length
  const contacts = new Array(n).fill(0)
  const workloadHours = new Array(n).fill(0)
  const abstractionHours = new Array(n).fill(0)
  let beyondPlan = 0
  const d = change.driver
  const start = monthIndex(a.startMonth, d.startMonth)
  const put = (i, c, aht) => {
    if (i < 0) return
    if (i >= n) { beyondPlan += c; return }
    contacts[i] += c
    workloadHours[i] += (c * aht) / 3600
  }
  if (d.type === 'acquisitions') {
    const curve = d.curve?.length ? d.curve : [1]
    const curveSum = curve.reduce((t, v) => t + v, 0) || 1
    unitsByMonth(d.total, d.months, d.profile).forEach((units, j) => {
      curve.forEach((share, lag) => put(start + j + lag, (units * d.contactsPerUnit * share) / curveSum, d.aht))
    })
  } else if (d.type === 'volume') {
    for (let j = 0; j < d.months; j++) {
      const i = start + j
      const base = baseRows[i]
      if (d.mode === 'pct') {
        if (i >= 0 && i < n) put(i, (base.volume || 0) * d.value, base.aht || d.aht)
      } else {
        put(i, d.value, d.aht)
      }
    }
  } else if (d.type === 'aht') {
    for (let j = 0; j < d.months; j++) {
      const i = start + j
      if (i < 0 || i >= n) continue
      workloadHours[i] += ((baseRows[i].volume || 0) * d.share * d.deltaSec) / 3600
    }
  } else if (d.type === 'abstraction') {
    for (let j = 0; j < d.months; j++) {
      const i = start + j
      if (i >= 0 && i < n) abstractionHours[i] += d.people * d.hoursPerPerson
    }
  }
  return { contacts, workloadHours, abstractionHours, beyondPlan }
}

// ── Assessment ──────────────────────────────────────────────────────────────

/** Changes that consume headroom: committed and not already in the MTP forecast. */
export const isCommitted = (c) => (c.status === 'approved' || c.status === 'live') && !c.inMtp

/**
 * Baseline plan for an area: workload, required FTE and headroom by month.
 * @param a      area
 * @param ctx    { shrinkage, weeklyHours } resolved from the area's site
 */
export function areaPlan(a, ctx) {
  const hpf = hoursPerFteMonth(ctx.weeklyHours)
  return a.rows.map((r, i) => {
    const workloadHours = ((r.volume || 0) * (r.aht || 0)) / 3600
    const requiredFte = fteFor(workloadHours, r.aht, a, ctx.shrinkage, ctx.weeklyHours)
    return {
      month: addMonths(a.startMonth, i),
      volume: r.volume || 0,
      aht: r.aht || 0,
      workloadHours,
      occupancy: workloadHours > 0 ? occupancyFor(workloadHours, r.aht, a) : null,
      requiredFte,
      operationalFte: r.operationalFte ?? null,
      mtpFte: r.mtpFte ?? null,
      headroom: r.operationalFte != null ? r.operationalFte - requiredFte : null,
      hpf,
    }
  })
}

/** Average service level the operational FTE would deliver with a month's workload (live channels). */
export function projectedServiceLevel(workloadHours, ahtSec, fte, a, ctx) {
  if (a.channel === 'backoffice' || !(workloadHours > 0) || !(fte > 0) || !(ahtSec > 0)) return null
  const s = a.settings
  const openHours = hoursPerFteMonth(s.openHoursPerWeek)
  const k = Math.max(1, s.concurrency || 1)
  const agents = (fte * hoursPerFteMonth(ctx.weeklyHours) * (1 - ctx.shrinkage)) / openHours * k
  const perInterval = ((workloadHours * 3600) / ahtSec / (openHours * 2)) * (s.peakFactor || 1)
  const aht = ahtSec / k
  const traffic = (perInterval * aht) / 1800
  const sl = (n) => (a.channel === 'branch' || !s.patienceSec
    ? (n > traffic ? serviceLevel(n, traffic, aht, s.targetSec) : 0)
    : erlangA(n, { volume: perInterval, ahtSec: aht, intervalSec: 1800, patienceSec: s.patienceSec, targetSec: s.targetSec }).serviceLevel)
  const lo = Math.floor(agents)
  if (lo <= 0) return 0
  return sl(lo) + (sl(lo + 1) - sl(lo)) * (agents - lo)
}

/**
 * Assess one change against an area.
 * @returns per-month rows, a verdict and the numbers a change board needs.
 */
export function assessChange(change, a, changes, ctx) {
  const base = areaPlan(a, ctx)
  const committed = changes.filter((c) => c.id !== change.id && c.areaId === a.id && isCommitted(c))
  const sumEffects = (list) => {
    const out = { contacts: base.map(() => 0), workloadHours: base.map(() => 0), abstractionHours: base.map(() => 0) }
    for (const c of list) {
      const e = changeEffect(c, a, a.rows)
      base.forEach((_, i) => {
        out.contacts[i] += e.contacts[i]
        out.workloadHours[i] += e.workloadHours[i]
        out.abstractionHours[i] += e.abstractionHours[i]
      })
    }
    return out
  }
  const before = sumEffects(committed)
  const mine = changeEffect(change, a, a.rows)
  const s = a.settings
  const fteAt = (i, extraContacts, extraWork, abstraction) => {
    const b = base[i]
    const work = b.workloadHours + extraWork
    const vol = b.volume + extraContacts
    const aht = vol > 0 ? (work * 3600) / vol : b.aht
    return fteFor(work, aht, a, ctx.shrinkage, ctx.weeklyHours) + abstraction / b.hpf
  }

  const rows = base.map((b, i) => {
    const committedFte = fteAt(i, before.contacts[i], before.workloadHours[i], before.abstractionHours[i])
    const withFte = fteAt(i, before.contacts[i] + mine.contacts[i], before.workloadHours[i] + mine.workloadHours[i], before.abstractionHours[i] + mine.abstractionHours[i])
    const incrementalFte = change.inMtp ? 0 : withFte - committedFte
    const op = b.operationalFte
    const buffer = op != null ? op * (s.bufferPct || 0) : 0
    const headroom = op != null ? op - committedFte - buffer : null
    const shortfall = headroom != null ? Math.max(0, incrementalFte - Math.max(0, headroom)) : null
    // Overtime already needed to cover committed work isn't available again.
    const overtimeLeft = op != null ? Math.max(0, op * (s.overtimePct || 0) + Math.min(0, headroom)) : 0
    let status = 'none'
    if (incrementalFte > 0.05 && op != null) status = shortfall <= 0.05 ? 'absorbable' : shortfall <= overtimeLeft + 0.05 ? 'overtime' : 'short'
    const workBefore = b.workloadHours + before.workloadHours[i]
    const workAfter = workBefore + (change.inMtp ? 0 : mine.workloadHours[i])
    const volBefore = b.volume + before.contacts[i]
    const volAfter = volBefore + (change.inMtp ? 0 : mine.contacts[i])
    const availableFte = op != null ? op - (before.abstractionHours[i] + (change.inMtp ? 0 : mine.abstractionHours[i])) / b.hpf : null
    return {
      month: b.month,
      baseFte: b.requiredFte,
      committedFte,
      incrementalFte,
      contacts: mine.contacts[i],
      workloadHours: mine.workloadHours[i],
      abstractionHours: mine.abstractionHours[i],
      operationalFte: op,
      headroom,
      shortfall,
      status,
      slBefore: op != null ? projectedServiceLevel(workBefore, volBefore > 0 ? (workBefore * 3600) / volBefore : b.aht, op - before.abstractionHours[i] / b.hpf, a, ctx) : null,
      slAfter: availableFte != null ? projectedServiceLevel(workAfter, volAfter > 0 ? (workAfter * 3600) / volAfter : b.aht, availableFte, a, ctx) : null,
    }
  })

  const affected = rows.filter((r) => r.incrementalFte > 0.05)
  const short = rows.filter((r) => r.status === 'short')
  const overtime = rows.filter((r) => r.status === 'overtime')
  const missingOps = affected.some((r) => r.operationalFte == null)
  let verdict = 'none'
  if (change.inMtp) verdict = 'inMtp'
  else if (!affected.length) verdict = rows.some((r) => r.incrementalFte < -0.05) ? 'saving' : 'none'
  else if (missingOps) verdict = 'unknown'
  else if (short.length) verdict = 'short'
  else if (overtime.length) verdict = 'overtime'
  else verdict = 'absorbable'

  const peakShortfall = Math.max(0, ...rows.map((r) => r.shortfall ?? 0))
  const firstShort = short[0]?.month ?? overtime[0]?.month ?? null
  const fteMonths = rows.reduce((t, r) => t + Math.max(0, r.incrementalFte), 0)
  const leadMonths = Math.ceil(((s.leadTimeWeeks || 0) * 7) / 30.4)
  return {
    rows,
    verdict,
    peakFte: Math.max(0, ...rows.map((r) => r.incrementalFte)),
    savingFte: Math.max(0, ...rows.map((r) => -r.incrementalFte)),
    peakMonth: affected.length ? affected.reduce((m, r) => (r.incrementalFte > m.incrementalFte + 1e-6 ? r : m)).month : null,
    totalContacts: rows.reduce((t, r) => t + r.contacts, 0),
    beyondPlan: mine.beyondPlan,
    totalWorkloadHours: rows.reduce((t, r) => t + r.workloadHours, 0),
    fteMonths,
    cost: fteMonths * ((s.costPerFte || 0) / 12),
    peakShortfall,
    monthsShort: short.length,
    monthsOvertime: overtime.length,
    firstShort,
    hireBy: firstShort && peakShortfall > 0 ? addMonths(firstShort, -leadMonths) : null,
    hireCount: Math.ceil(peakShortfall - 0.05),
    worstSl: Math.min(...rows.filter((r) => r.incrementalFte > 0.05 && r.slAfter != null).map((r) => r.slAfter), Infinity),
    committedCount: committed.length,
  }
}

/** Plain-text summary for a change board paper or email. */
export function summaryText(change, a, r, { currency = '£', nowMonth = null } = {}) {
  const f1 = (v) => v.toLocaleString('en-GB', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
  const f0 = (v) => Math.round(v).toLocaleString('en-GB')
  const verdict = {
    absorbable: 'ABSORBABLE within current operational FTE',
    overtime: 'ABSORBABLE WITH OVERTIME',
    short: 'NOT ABSORBABLE without additional resource',
    inMtp: 'Already included in the MTP forecast: no incremental impact',
    saving: `RELEASES CAPACITY: up to ${f1(r.savingFte)} FTE`,
    none: 'No resourcing impact in the plan period',
    unknown: 'Cannot assess: operational FTE missing for affected months',
  }[r.verdict]
  const lines = [
    `Impact assessment: ${change.name}`,
    `Area: ${a.name}`,
    `Verdict: ${verdict}`,
    '',
    `Incremental contacts: ${f0(r.totalContacts)}${r.beyondPlan > 0.5 ? ` (plus ${f0(r.beyondPlan)} after the plan period)` : ''}`,
    `Incremental workload: ${f0(r.totalWorkloadHours)} hours`,
    `Peak incremental FTE: ${f1(r.peakFte)}${r.peakMonth ? ` in ${monthLabel(r.peakMonth, true)}` : ''}`,
    `Total effort: ${f1(r.fteMonths)} FTE-months, about ${currency}${f0(r.cost)}`,
  ]
  if (r.verdict === 'short' || r.verdict === 'overtime') {
    lines.push(`Shortfall: up to ${f1(r.peakShortfall)} FTE; ${r.monthsShort} month(s) beyond overtime cover, ${r.monthsOvertime} month(s) coverable by overtime`)
    if (r.hireBy) {
      const late = nowMonth && r.hireBy < nowMonth
      lines.push(late
        ? `Recruitment: ${r.hireCount} FTE needed for ${monthLabel(r.firstShort, true)}; the hiring lead time already runs past that, so start now and cover the gap with overtime or temporary resource`
        : `Recruitment: ${r.hireCount} FTE starting by ${monthLabel(r.hireBy, true)} to be productive for ${monthLabel(r.firstShort, true)}`)
    }
  }
  if (Number.isFinite(r.worstSl)) lines.push(`Service level if unmitigated: lowest ${Math.round(r.worstSl * 100)}% against a ${Math.round(a.settings.slTarget * 100)}% target`)
  lines.push('', 'Month, contacts, incremental FTE, headroom before, status')
  for (const m of r.rows.filter((x) => x.incrementalFte > 0.05)) {
    lines.push(`${monthLabel(m.month)}, ${f0(m.contacts)}, ${f1(m.incrementalFte)}, ${m.headroom == null ? 'n/a' : f1(m.headroom)}, ${{ absorbable: 'absorbable', overtime: 'overtime', short: 'short' }[m.status] ?? ''}`)
  }
  const occ = a.channel === 'backoffice' ? `${Math.round(a.settings.occupancy * 100)}% utilisation` : a.settings.occupancyMode === 'erlang' ? 'occupancy from Erlang at the service target' : `${Math.round(a.settings.occupancy * 100)}% occupancy`
  lines.push('', `Assumptions: ${occ}, ${Math.round((a.settings.bufferPct || 0) * 100)}% buffer kept, overtime up to ${Math.round((a.settings.overtimePct || 0) * 100)}% of operational FTE. ${r.committedCount} committed change(s) assessed first.`)
  return lines.join('\n')
}
