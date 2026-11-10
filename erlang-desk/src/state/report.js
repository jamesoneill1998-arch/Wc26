// The Excel report: the whole plan as one workbook, one sheet per subject.
// Pure: takes the workspace and the computed model, returns sheets for
// engine/xlsx.js. Figures are the same ones shown on screen.

import { CHANNELS, siteShrinkage, SHRINKAGE_COMPONENTS } from '../engine/channels.js'
import { assessChange, combinedPlan, monthLabel } from '../engine/impact.js'

const SCENARIO = { plan: 'Plan', high: 'Higher demand', low: 'Lower demand', attrition: 'Higher attrition', both: 'Higher demand and attrition' }
const VERDICT = { absorbable: 'Absorbable', overtime: 'Absorbable with overtime', short: 'Not absorbable', saving: 'Releases capacity', inMtp: 'In MTP', none: 'No impact', unknown: 'Cannot assess' }
const STATUS = { proposed: 'Proposed', approved: 'Approved', live: 'Live', rejected: 'Rejected' }

const longDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

export function buildReport(ws, model, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const site = (id) => ws.sites.find((s) => s.id === id)
  const planned = ws.services.map((svc) => ({ svc, r: model.services?.[svc.id] })).filter((x) => x.r?.sim?.length)
  const total = model.total ?? []
  const short = total.filter((w) => w.gap < -0.5)
  const hires = planned.reduce((t, { r }) => t + r.recs.reduce((a, h) => a + h.count, 0), 0)

  const sheets = [{
    name: 'Summary',
    intro: [
      `${ws.name}: capacity plan`,
      `Prepared ${longDate(today)} with Erlang Desk. ${planned.length} service${planned.length === 1 ? '' : 's'} across ${ws.sites.length} site${ws.sites.length === 1 ? '' : 's'}, ${total.length} weeks.`,
      total.length ? `${short.length} of ${total.length} weeks are short of cover${short.length ? `, the first in the week of ${longDate(short[0].week)}` : ''}. Suggested hires: ${hires}.` : 'No plan yet: import contact history for a service.',
    ],
    columns: [{ header: 'Week commencing', format: 'date', width: 18 }, { header: 'Required FTE', format: 'dec1', width: 14 }, { header: 'Available FTE', format: 'dec1', width: 14 }, { header: 'Gap FTE', format: 'dec1', width: 12 }],
    rows: total.map((w) => [w.week, w.requiredFte, w.availableFte, w.gap]),
  }, {
    name: 'Services',
    columns: [{ header: 'Service', width: 26 }, { header: 'Channel', width: 14 }, { header: 'Site', width: 18 }, { header: 'Model', width: 22 }, { header: 'Contacts next week', format: 'int', width: 18 }, { header: 'Required FTE', format: 'dec1', width: 14 }, { header: 'Available FTE', format: 'dec1', width: 14 }, { header: 'Gap FTE', format: 'dec1', width: 12 }, { header: 'Weeks short', format: 'int', width: 12 }, { header: 'Suggested hires', format: 'int', width: 16 }, { header: 'Forecast method', width: 30 }, { header: 'Forecast error (WAPE)', format: 'pct', width: 20 }],
    rows: planned.map(({ svc, r }) => {
      const w = r.sim[0]
      return [svc.name, CHANNELS[svc.channel].label, site(svc.siteId)?.name ?? '', CHANNELS[svc.channel].method, w.volume, w.requiredFte, w.availableFte, w.gap, r.sim.filter((x) => x.gap < -0.5).length, r.recs.reduce((a, h) => a + h.count, 0), r.forecast?.methodLabel ?? '', r.forecast?.accuracy?.wape ?? null]
    }),
  }, {
    name: 'Capacity by week',
    columns: [{ header: 'Service', width: 26 }, { header: 'Week commencing', format: 'date', width: 18 }, { header: 'Forecast volume', format: 'int', width: 16 }, { header: 'AHT (seconds)', format: 'int', width: 14 }, { header: 'Required FTE', format: 'dec1', width: 14 }, { header: 'Available FTE', format: 'dec1', width: 14 }, { header: 'Headcount', format: 'dec1', width: 12 }, { header: 'In training or nesting', format: 'dec1', width: 20 }, { header: 'Gap FTE', format: 'dec1', width: 12 }],
    rows: planned.flatMap(({ svc, r }) => r.sim.map((w) => [svc.name, w.week, w.volume, w.aht, w.requiredFte, w.availableFte, w.headcount, w.inTraining, w.gap])),
  }, {
    name: 'Scenarios',
    columns: [{ header: 'Service', width: 26 }, { header: 'Scenario', width: 30 }, { header: 'Demand change', format: 'pct', width: 15 }, { header: 'Monthly attrition', format: 'pct', width: 17 }, { header: 'Average gap FTE', format: 'dec1', width: 16 }, { header: 'Worst gap FTE', format: 'dec1', width: 14 }, { header: 'Worst week', format: 'date', width: 14 }, { header: 'Weeks short', format: 'int', width: 12 }, { header: 'Extra hires to close', format: 'int', width: 19 }, { header: 'First class starts', format: 'date', width: 17 }],
    rows: planned.flatMap(({ svc, r }) => (r.scenarios ?? []).map((sc) => [svc.name, SCENARIO[sc.key] ?? sc.key, sc.demand, sc.attrition, sc.avgGap, sc.worstGap, sc.worstWeek, sc.weeksShort, sc.extraHires, sc.firstClass])),
  }, {
    name: 'Hiring',
    columns: [{ header: 'Service', width: 26 }, { header: 'Class starts', format: 'date', width: 14 }, { header: 'Hires', format: 'int', width: 10 }, { header: 'Status', width: 14 }],
    rows: planned.flatMap(({ svc, r }) => [...svc.hires.map((h) => [svc.name, h.week, h.count, 'Planned']), ...r.recs.map((h) => [svc.name, h.week, h.count, 'Suggested'])]),
  }, {
    name: 'Forecast by day',
    columns: [{ header: 'Service', width: 26 }, { header: 'Date', format: 'date', width: 14 }, { header: 'Forecast volume', format: 'int', width: 16 }, { header: 'Low', format: 'int', width: 12 }, { header: 'High', format: 'int', width: 12 }],
    rows: planned.flatMap(({ svc, r }) => (r.forecast?.points ?? []).map((p) => [svc.name, p.date, p.volume, p.low, p.high])),
  }]

  const changeRows = []
  const areaRows = []
  for (const area of ws.areas ?? []) {
    const st = site(area.siteId)
    const ctx = { shrinkage: area.settings.shrinkageOverride ?? siteShrinkage(st), weeklyHours: st?.fteHoursPerWeek ?? 37.5 }
    for (const c of ws.changes.filter((x) => x.areaId === area.id)) {
      const a = assessChange(c, area, ws.changes, ctx)
      changeRows.push([area.name, c.name, c.owner ?? '', STATUS[c.status] ?? c.status, c.inMtp ? 'Yes' : 'No', a.verdict === 'saving' ? -a.savingFte : a.peakFte, a.peakMonth ? monthLabel(a.peakMonth, true) : '', a.peakShortfall, a.fteMonths, a.cost, a.hireBy ? a.hireCount : null, a.hireBy ? monthLabel(a.hireBy, true) : '', VERDICT[a.verdict] ?? a.verdict, c.notes ?? ''])
    }
    const all = combinedPlan(area, ws.changes, ctx)
    for (const m of all.rows) areaRows.push([area.name, monthLabel(m.month, true), m.baseFte, m.committedFte, m.proposedFte, m.operationalFte, m.headroom, m.after, m.status === 'none' ? '' : VERDICT[m.status]])
  }
  if (changeRows.length) {
    sheets.push({
      name: 'Changes',
      columns: [{ header: 'Area', width: 20 }, { header: 'Change', width: 32 }, { header: 'Owner', width: 18 }, { header: 'Status', width: 12 }, { header: 'In MTP', width: 9 }, { header: 'Peak FTE', format: 'dec1', width: 11 }, { header: 'Peak month', width: 16 }, { header: 'Shortfall FTE', format: 'dec1', width: 14 }, { header: 'FTE-months', format: 'dec1', width: 12 }, { header: 'Cost', format: 'int', width: 12 }, { header: 'Recruit FTE', format: 'int', width: 12 }, { header: 'Recruit by', width: 16 }, { header: 'Assessment', width: 26 }, { header: 'Notes', width: 50 }],
      rows: changeRows,
    }, {
      name: 'Areas by month',
      columns: [{ header: 'Area', width: 20 }, { header: 'Month', width: 16 }, { header: 'Baseline required FTE', format: 'dec1', width: 21 }, { header: 'With committed changes', format: 'dec1', width: 22 }, { header: 'Open proposals FTE', format: 'dec1', width: 19 }, { header: 'Operational FTE', format: 'dec1', width: 16 }, { header: 'Headroom before', format: 'dec1', width: 16 }, { header: 'Headroom after', format: 'dec1', width: 15 }, { header: 'If all approved', width: 26 }],
      rows: areaRows,
    })
  }

  sheets.push({
    name: 'Sites',
    columns: [{ header: 'Site', width: 20 }, { header: 'Code', width: 8 }, { header: 'Shrinkage', format: 'pct', width: 12 }, { header: 'Paid hours a week', format: 'dec1', width: 18 }, { header: 'Monthly attrition', format: 'pct', width: 17 }, ...SHRINKAGE_COMPONENTS.map(([, label]) => ({ header: label, format: 'pct', width: Math.max(14, label.length + 2) }))],
    rows: ws.sites.map((s) => [s.name, s.code, siteShrinkage(s), s.fteHoursPerWeek, s.monthlyAttrition, ...SHRINKAGE_COMPONENTS.map(([k]) => s.shrinkage?.[k] ?? null)]),
  })
  return sheets
}
