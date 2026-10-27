// Channels, sites and shrinkage: the planning vocabulary shared by the
// engine and the UI.
//
// Each channel is staffed with the model that fits how its work arrives:
//   voice       live queue, callers abandon       -> Erlang A (or C)
//   chat        live queue, agents run k sessions -> Erlang A with concurrency
//   back office deferred work with a turnaround   -> workload ÷ utilisation, smoothed over the SLA
//   branch      walk-ins queue at each branch     -> Erlang C per branch, × branches

export const CHANNELS = {
  voice: { label: 'Voice', unit: 'calls', live: true, method: 'Erlang A' },
  chat: { label: 'Chat', unit: 'chats', live: true, method: 'Erlang A with concurrency' },
  backoffice: { label: 'Back office', unit: 'items', live: false, method: 'Workload and turnaround SLA' },
  branch: { label: 'Branch', unit: 'visitors', live: true, method: 'Erlang C per branch' },
}

const weekdays = (open, close) => Array.from({ length: 5 }, () => ({ open, close }))

export function defaultServiceSettings(channel) {
  const common = {
    intervalMin: 30,
    slTarget: 0.8,
    targetSec: 20,
    asaTarget: 0,
    abandonTarget: 0,
    maxOccupancy: 0.88,
    defaultAht: 300,
    concurrency: 1,
    minAgents: 2,
    queueModel: 'erlangA',
    patienceSec: 120,
    utilisation: 0.85,
    slaDays: 2,
    branches: 1,
    shrinkageOverride: null,
    hours: [...weekdays('08:00', '20:00'), { open: '09:00', close: '17:00' }, { open: '09:00', close: '17:00' }],
  }
  switch (channel) {
    case 'chat':
      return { ...common, targetSec: 60, defaultAht: 720, concurrency: 2, patienceSec: 240, maxOccupancy: 0.85, hours: [...weekdays('08:00', '22:00'), { open: '09:00', close: '18:00' }, { open: '10:00', close: '16:00' }] }
    case 'backoffice':
      return { ...common, defaultAht: 420, minAgents: 0, queueModel: 'workload', hours: [...weekdays('08:00', '18:00'), null, null] }
    case 'branch':
      return { ...common, targetSec: 300, defaultAht: 600, minAgents: 1, queueModel: 'erlangC', maxOccupancy: 0.8, branches: 25, hours: [...weekdays('09:00', '17:30'), { open: '09:00', close: '16:00' }, null] }
    default:
      return common
  }
}

export const SHRINKAGE_COMPONENTS = [
  ['leave', 'Annual leave & bank holidays'],
  ['sickness', 'Sickness absence'],
  ['breaks', 'Paid breaks'],
  ['training', 'Training & coaching'],
  ['meetings', 'Team meetings & 1:1s'],
  ['other', 'Systems downtime & other'],
]

// Typical shrinkage profiles: UK operations carry more leave, sickness and
// paid breaks (≈35%); offshore delivery centres typically run nearer 20%.
export function defaultSites() {
  return [
    {
      id: 'uk',
      name: 'United Kingdom',
      code: 'UK',
      fteHoursPerWeek: 37.5,
      monthlyAttrition: 0.025,
      shrinkage: { leave: 0.12, sickness: 0.05, breaks: 0.08, training: 0.05, meetings: 0.03, other: 0.02 },
    },
    {
      id: 'offshore',
      name: 'Offshore',
      code: 'OS',
      fteHoursPerWeek: 40,
      monthlyAttrition: 0.045,
      shrinkage: { leave: 0.07, sickness: 0.03, breaks: 0.05, training: 0.03, meetings: 0.01, other: 0.01 },
    },
  ]
}

export function siteShrinkage(site) {
  if (!site) return 0.3
  return Object.values(site.shrinkage ?? {}).reduce((s, v) => s + (Number(v) || 0), 0)
}

/** Settings as the engine needs them: service settings plus channel and site context. */
export function resolveSettings(service, site) {
  const s = service.settings
  return {
    ...s,
    channel: service.channel,
    shrinkage: s.shrinkageOverride != null ? s.shrinkageOverride : siteShrinkage(site),
    fteHoursPerWeek: site?.fteHoursPerWeek ?? 37.5,
  }
}

export function resolveCapacity(service, site) {
  return { ...service.capacity, monthlyAttrition: site?.monthlyAttrition ?? 0.03 }
}
