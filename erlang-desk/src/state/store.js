// Workspace state, persisted to this browser only. Customer contact data
// never leaves the device — a deliberate selling point for regulated buyers.
//
// Shape (v2):
//   { version, name, sites: Site[], services: Service[], activeServiceId }
// Every workspace that enters the app (storage, file import) goes through
// `sanitizeWorkspace`, which rebuilds it from known fields only.

import { useCallback, useEffect, useState } from 'react'
import { CHANNELS, defaultServiceSettings, defaultSites, SHRINKAGE_COMPONENTS } from '../engine/channels.js'

const KEY = 'erlang-desk:workspace:v2'
const LEGACY_KEY = 'erlang-desk:workspace:v1'

export const DEFAULT_PLAN = { method: 'auto', horizonWeeks: 26, volumeAdjustPct: 0, ahtAdjustPct: 0 }

const TRAINING_WEEKS = { voice: 4, chat: 3, backoffice: 3, branch: 6 }

export function defaultCapacity(channel = 'voice') {
  return {
    startHeadcount: 40,
    trainingWeeks: TRAINING_WEEKS[channel] ?? 4,
    nestingWeeks: 2,
    nestingProductivity: 0.6,
    classCadenceWeeks: 4,
    gapToleranceFte: 0.5,
  }
}

const newId = () => Math.random().toString(36).slice(2, 10)

export function newService({ name, channel = 'voice', siteId = 'uk' } = {}) {
  return {
    id: newId(),
    name: name || `${CHANNELS[channel]?.label ?? 'New'} service`,
    channel,
    siteId,
    settings: defaultServiceSettings(channel),
    plan: { ...DEFAULT_PLAN },
    capacity: defaultCapacity(channel),
    hires: [],
    history: null,
  }
}

export function emptyWorkspace() {
  return { version: 2, name: 'My operation', sites: defaultSites(), services: [], activeServiceId: null }
}

// ── Validation ──────────────────────────────────────────────────────────────

const num = (v, min, max, def) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def)
const str = (v, max, def) => (typeof v === 'string' ? v.slice(0, max) : def)
const ISO = /^\d{4}-\d{2}-\d{2}$/
const HHMM = /^\d{2}:\d{2}$/
const MAX_ROWS = 200000

function sanitizeRows(rows, withTime) {
  if (!Array.isArray(rows)) return []
  const out = []
  for (const r of rows.slice(0, MAX_ROWS)) {
    if (!r || typeof r !== 'object' || !ISO.test(r.date)) continue
    const volume = r.volume
    if (typeof volume !== 'number' || !Number.isFinite(volume) || volume < 0 || volume > 1e7) continue
    const row = { date: r.date, volume }
    if (typeof r.aht === 'number' && r.aht > 0 && r.aht <= 86400) row.aht = r.aht
    if (withTime) {
      if (!Number.isInteger(r.time) || r.time < 0 || r.time >= 1440) continue
      row.time = r.time
    }
    out.push(row)
  }
  return out
}

function sanitizeHistory(h) {
  if (!h || typeof h !== 'object') return null
  const dailyRows = sanitizeRows(h.dailyRows, false)
  if (!dailyRows.length) return null
  return {
    kind: h.kind === 'interval' ? 'interval' : 'daily',
    source: str(h.source, 120, 'Imported'),
    loadedAt: str(h.loadedAt, 40, new Date().toISOString()),
    dailyRows,
    intervalRows: sanitizeRows(h.intervalRows, true),
  }
}

function sanitizeHours(hours, fallback) {
  if (!Array.isArray(hours) || hours.length !== 7) return fallback
  return hours.map((h, i) => (h === null ? null : h && HHMM.test(h.open) && HHMM.test(h.close) ? { open: h.open, close: h.close } : fallback[i]))
}

function sanitizeSettings(s, channel) {
  const d = defaultServiceSettings(channel)
  if (!s || typeof s !== 'object') return d
  return {
    intervalMin: [15, 30, 60].includes(s.intervalMin) ? s.intervalMin : d.intervalMin,
    slTarget: num(s.slTarget, 0.01, 0.999, d.slTarget),
    targetSec: num(s.targetSec, 0, 7200, d.targetSec),
    asaTarget: num(s.asaTarget, 0, 7200, d.asaTarget),
    abandonTarget: num(s.abandonTarget, 0, 0.9, d.abandonTarget),
    maxOccupancy: num(s.maxOccupancy, 0.1, 1, d.maxOccupancy),
    defaultAht: num(s.defaultAht, 1, 86400, d.defaultAht),
    concurrency: num(s.concurrency, 1, 10, d.concurrency),
    minAgents: Math.round(num(s.minAgents, 0, 500, d.minAgents)),
    queueModel: ['erlangA', 'erlangC', 'workload'].includes(s.queueModel) ? s.queueModel : d.queueModel,
    patienceSec: num(s.patienceSec, 5, 3600, d.patienceSec),
    utilisation: num(s.utilisation, 0.3, 1, d.utilisation),
    slaDays: Math.round(num(s.slaDays, 1, 30, d.slaDays)),
    branches: Math.round(num(s.branches, 1, 5000, d.branches)),
    shrinkageOverride: s.shrinkageOverride == null ? null : num(s.shrinkageOverride, 0, 0.9, null),
    hours: sanitizeHours(s.hours, d.hours),
  }
}

function sanitizeService(svc, siteIds) {
  if (!svc || typeof svc !== 'object') return null
  const channel = CHANNELS[svc.channel] ? svc.channel : 'voice'
  const cap = defaultCapacity(channel)
  const c = svc.capacity ?? {}
  const p = svc.plan ?? {}
  return {
    id: typeof svc.id === 'string' && /^[a-z0-9-]{1,40}$/i.test(svc.id) ? svc.id : newId(),
    name: str(svc.name, 80, 'Service'),
    channel,
    siteId: siteIds.includes(svc.siteId) ? svc.siteId : siteIds[0],
    settings: sanitizeSettings(svc.settings, channel),
    plan: {
      method: ['auto', 'regression', 'holtWinters', 'weekdayAverage', 'seasonalNaive'].includes(p.method) ? p.method : 'auto',
      horizonWeeks: [13, 26, 39, 52].includes(p.horizonWeeks) ? p.horizonWeeks : 26,
      volumeAdjustPct: num(p.volumeAdjustPct, -0.9, 5, 0),
      ahtAdjustPct: num(p.ahtAdjustPct, -0.9, 5, 0),
    },
    capacity: {
      startHeadcount: num(c.startHeadcount, 0, 100000, cap.startHeadcount),
      trainingWeeks: Math.round(num(c.trainingWeeks, 0, 52, cap.trainingWeeks)),
      nestingWeeks: Math.round(num(c.nestingWeeks, 0, 52, cap.nestingWeeks)),
      nestingProductivity: num(c.nestingProductivity, 0, 1, cap.nestingProductivity),
      classCadenceWeeks: Math.round(num(c.classCadenceWeeks, 1, 52, cap.classCadenceWeeks)),
      gapToleranceFte: num(c.gapToleranceFte, 0, 100, cap.gapToleranceFte),
      ...(c.calibrate === true ? { calibrate: true } : {}),
    },
    hires: Array.isArray(svc.hires)
      ? svc.hires.filter((h) => h && ISO.test(h.week) && Number.isFinite(h.count)).slice(0, 200).map((h) => ({ week: h.week, count: Math.round(num(h.count, 1, 10000, 1)) }))
      : [],
    history: sanitizeHistory(svc.history),
  }
}

function sanitizeSite(site, i) {
  const d = defaultSites()[Math.min(i, 1)]
  if (!site || typeof site !== 'object') return null
  const shrinkage = {}
  for (const [k] of SHRINKAGE_COMPONENTS) shrinkage[k] = num(site.shrinkage?.[k], 0, 0.9, d.shrinkage[k])
  return {
    id: typeof site.id === 'string' && /^[a-z0-9-]{1,40}$/i.test(site.id) ? site.id : newId(),
    name: str(site.name, 60, d.name),
    code: str(site.code, 4, d.code).toUpperCase(),
    fteHoursPerWeek: num(site.fteHoursPerWeek, 1, 80, d.fteHoursPerWeek),
    monthlyAttrition: num(site.monthlyAttrition, 0, 0.5, d.monthlyAttrition),
    shrinkage,
  }
}

/** Convert the single-queue v1 workspace into a v2 voice service. */
function migrateV1(ws) {
  const base = emptyWorkspace()
  const svc = newService({ name: 'Voice', channel: 'voice', siteId: 'uk' })
  svc.settings = { ...svc.settings, ...ws.settings, queueModel: 'erlangC' }
  if (ws.settings?.shrinkage != null) svc.settings.shrinkageOverride = ws.settings.shrinkage
  svc.plan = { ...svc.plan, ...ws.plan }
  svc.capacity = { ...svc.capacity, ...ws.capacity }
  svc.hires = ws.hires ?? []
  svc.history = ws.history ?? null
  return { ...base, name: ws.name ?? base.name, services: [svc], activeServiceId: svc.id }
}

export function sanitizeWorkspace(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Not a workspace')
  const ws = raw.version === 2 ? raw : raw.settings ? migrateV1(raw) : null
  if (!ws) throw new Error('Not a workspace')
  const sites = (Array.isArray(ws.sites) ? ws.sites : []).slice(0, 10).map(sanitizeSite).filter(Boolean)
  if (!sites.length) sites.push(...defaultSites())
  const siteIds = sites.map((s) => s.id)
  const services = (Array.isArray(ws.services) ? ws.services : []).slice(0, 30).map((s) => sanitizeService(s, siteIds)).filter(Boolean)
  const ids = new Set()
  for (const s of services) { while (ids.has(s.id)) s.id = newId(); ids.add(s.id) }
  return {
    version: 2,
    name: str(ws.name, 80, 'My operation'),
    sites,
    services,
    activeServiceId: services.some((s) => s.id === ws.activeServiceId) ? ws.activeServiceId : services[0]?.id ?? null,
  }
}

// ── Persistence ─────────────────────────────────────────────────────────────

function load() {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY)
    return raw ? sanitizeWorkspace(JSON.parse(raw)) : emptyWorkspace()
  } catch {
    return emptyWorkspace()
  }
}

export function clearStoredWorkspace() {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(LEGACY_KEY)
  } catch { /* storage blocked */ }
}

export function useWorkspace() {
  const [ws, setWs] = useState(load)
  const [saveError, setSaveError] = useState(null)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(ws))
        localStorage.removeItem(LEGACY_KEY)
        setSaveError(null)
      } catch {
        setSaveError('This browser could not save your workspace (storage full or blocked). Export it from the Data page to keep it.')
      }
    }, 250)
    return () => clearTimeout(t)
  }, [ws])

  const update = useCallback((patch) => setWs((cur) => ({ ...cur, ...(typeof patch === 'function' ? patch(cur) : patch) })), [])
  const updateService = useCallback((id, patch) => setWs((cur) => ({
    ...cur,
    services: cur.services.map((s) => (s.id === id ? { ...s, ...(typeof patch === 'function' ? patch(s) : patch) } : s)),
  })), [])
  const updateSite = useCallback((id, patch) => setWs((cur) => ({
    ...cur,
    sites: cur.sites.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  })), [])
  const replace = useCallback((next) => setWs(sanitizeWorkspace(next)), [])

  const active = ws.services.find((s) => s.id === ws.activeServiceId) ?? ws.services[0] ?? null
  return { ws, active, update, updateService, updateSite, replace, saveError }
}

/** Keep only recent interval rows: profiles use the last 8 weeks. */
export function trimIntervalRows(rows, weeks = 12) {
  if (!rows?.length) return []
  const last = rows.reduce((m, r) => (r.date > m ? r.date : m), rows[0].date)
  const cutoff = new Date(Date.parse(last) - weeks * 7 * 864e5).toISOString().slice(0, 10)
  return rows.filter((r) => r.date > cutoff)
}
