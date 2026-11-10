// First-plan checklist: the steps from an empty workspace to a first plan.
// Steps that leave a trace in the workspace are read from it; the rest are
// ticked when the planner opens the page. Kept per browser, like the tour.

const KEY = 'erlang-desk:checklist'
const PAGES = ['sites', 'forecast', 'service', 'capacity']

export function readChecklist() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    return { seen: Array.isArray(raw.seen) ? raw.seen.filter((p) => PAGES.includes(p)) : [], hidden: raw.hidden === true }
  } catch {
    return { seen: [], hidden: false }
  }
}

function write(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* storage blocked */ }
}

/** Record that a page was opened. Returns true when that ticked a new step. */
export function markPageSeen(page) {
  if (!PAGES.includes(page)) return false
  const cur = readChecklist()
  if (cur.seen.includes(page)) return false
  write({ ...cur, seen: [...cur.seen, page] })
  return true
}

export function setChecklistHidden(hidden) {
  write({ ...readChecklist(), hidden })
}

/**
 * The steps and whether each is done.
 * @param ws      workspace
 * @param active  the service being planned (may be null)
 * @param seen    pages the planner has opened
 */
export function checklistItems(ws, active, seen = []) {
  const has = (p) => seen.includes(p)
  const history = Boolean(active?.history?.dailyRows?.length)
  const roster = Boolean(active?.schedule?.patterns?.length || active?.schedule?.shifts?.length)
  return [
    { key: 'data', to: 'data', label: 'Import your contact history', detail: 'A CSV export of daily or interval volumes from your telephony or workflow system.', done: history },
    { key: 'sites', to: 'sites', label: 'Check shrinkage for each site', detail: 'Leave, sickness, breaks and training, with contracted hours and attrition.', done: has('sites') },
    { key: 'service', to: 'service', label: 'Set the service target and opening hours', detail: 'The service level goal, answer time and the hours the service is open.', done: has('service') },
    { key: 'forecast', to: 'forecast', label: 'Review the forecast', detail: 'See which method was chosen and how accurate it was on recent weeks.', done: history && has('forecast') },
    { key: 'coverage', to: 'coverage', label: 'Add your shifts', detail: 'Shift patterns or a roster file, to see cover against the requirement every half hour.', done: roster },
    { key: 'capacity', to: 'capacity', label: 'Set today\'s headcount and plan hiring', detail: 'Productive FTE today, training and nesting time, then the classes that close the gaps.', done: history && has('capacity') },
  ]
}
