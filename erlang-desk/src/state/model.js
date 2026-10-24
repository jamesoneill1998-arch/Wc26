// Everything derived from the workspace: forecast -> intervals -> weeks ->
// supply -> hiring. Memoised in stages so editing a capacity assumption
// doesn't re-run the forecast.

import { useMemo } from 'react'
import { forecastDaily } from '../engine/forecast.js'
import { defaultProfiles, learnProfiles, weekdayAht } from '../engine/profiles.js'
import { intervalRequirements, weeklyRequirements, simulateSupply, recommendHires, unfixableWeeks } from '../engine/capacity.js'
import { weekStart, addDays } from '../engine/dates.js'

export function usePlanModel(ws) {
  const { history, settings, plan, capacity, hires } = ws
  const daily = history?.dailyRows ?? []

  const forecast = useMemo(() => {
    if (daily.length < 7) return null
    // Forecast far enough to fill whole plan weeks after the last actual day.
    const last = daily[daily.length - 1].date
    const firstMonday = addDays(weekStart(addDays(last, 1)), weekStart(addDays(last, 1)) === addDays(last, 1) ? 0 : 7)
    const lead = Math.round((Date.parse(firstMonday) - Date.parse(last)) / 864e5) - 1
    return forecastDaily(daily, { horizon: lead + plan.horizonWeeks * 7, method: plan.method, adjustPct: plan.volumeAdjustPct })
  }, [daily, plan.method, plan.horizonWeeks, plan.volumeAdjustPct])

  const profiles = useMemo(() => {
    const learnt = history?.intervalRows?.length ? learnProfiles(history.intervalRows, settings.intervalMin) : null
    return learnt ?? defaultProfiles(settings)
  }, [history, settings])

  const ahtByWeekday = useMemo(() => weekdayAht(daily, settings.defaultAht), [daily, settings.defaultAht])

  const dayReqs = useMemo(() => {
    if (!forecast?.points?.length) return []
    return intervalRequirements(forecast.points, profiles, ahtByWeekday, settings, { ahtAdjustPct: plan.ahtAdjustPct })
  }, [forecast, profiles, ahtByWeekday, settings, plan.ahtAdjustPct])

  const weeks = useMemo(() => weeklyRequirements(dayReqs, settings).filter((w) => !w.partial), [dayReqs, settings])

  const supply = useMemo(() => {
    if (!weeks.length) return { sim: [], recs: [], simWithRecs: [], unfixable: [] }
    const sim = simulateSupply(weeks, capacity, hires)
    const recs = recommendHires(weeks, capacity, hires)
    const simWithRecs = recs.length ? simulateSupply(weeks, capacity, [...hires, ...recs]) : sim
    return { sim, recs, simWithRecs, unfixable: unfixableWeeks(sim, capacity) }
  }, [weeks, capacity, hires])

  return { forecast, profiles, ahtByWeekday, dayReqs, weeks, ...supply }
}
