// Workspace state, persisted to this browser only. Customer contact data
// never leaves the device — a deliberate selling point for regulated buyers.

import { useEffect, useState } from 'react'

const KEY = 'erlang-desk:workspace:v1'

export const DEFAULT_SETTINGS = {
  intervalMin: 30,
  slTarget: 0.8,
  targetSec: 20,
  asaTarget: 0,
  maxOccupancy: 0.88,
  shrinkage: 0.32,
  defaultAht: 300,
  concurrency: 1,
  minAgents: 2,
  fteHoursPerWeek: 37.5,
  hours: [
    { open: '08:00', close: '20:00' },
    { open: '08:00', close: '20:00' },
    { open: '08:00', close: '20:00' },
    { open: '08:00', close: '20:00' },
    { open: '08:00', close: '20:00' },
    { open: '09:00', close: '17:00' },
    { open: '09:00', close: '17:00' },
  ],
}

export const DEFAULT_CAPACITY = {
  startHeadcount: 60,
  monthlyAttrition: 0.035,
  trainingWeeks: 4,
  nestingWeeks: 2,
  nestingProductivity: 0.6,
  classCadenceWeeks: 4,
  gapToleranceFte: 0.5,
}

export const DEFAULT_PLAN = {
  method: 'auto',
  horizonWeeks: 26,
  volumeAdjustPct: 0,
  ahtAdjustPct: 0,
}

export function emptyWorkspace() {
  return {
    name: 'My contact centre',
    settings: DEFAULT_SETTINGS,
    capacity: DEFAULT_CAPACITY,
    plan: DEFAULT_PLAN,
    history: null, // { kind, source, dailyRows, intervalRows }
    hires: [],
  }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyWorkspace()
    const ws = JSON.parse(raw)
    const base = emptyWorkspace()
    return {
      ...base,
      ...ws,
      settings: { ...base.settings, ...ws.settings },
      capacity: { ...base.capacity, ...ws.capacity },
      plan: { ...base.plan, ...ws.plan },
    }
  } catch {
    return emptyWorkspace()
  }
}

export function useWorkspace() {
  const [ws, setWs] = useState(load)
  const [saveError, setSaveError] = useState(null)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(ws))
      setSaveError(null)
    } catch (e) {
      setSaveError('This browser could not save your workspace (storage full or blocked). Export it from the Data page to keep it.')
    }
  }, [ws])
  const update = (patch) => setWs((cur) => ({ ...cur, ...(typeof patch === 'function' ? patch(cur) : patch) }))
  return { ws, update, replace: setWs, saveError }
}

/** Keep only recent interval rows: profiles use the last 8 weeks. */
export function trimIntervalRows(rows, weeks = 12) {
  if (!rows?.length) return []
  const last = rows.reduce((m, r) => (r.date > m ? r.date : m), rows[0].date)
  const cutoff = new Date(Date.parse(last) - weeks * 7 * 864e5).toISOString().slice(0, 10)
  return rows.filter((r) => r.date > cutoff)
}
