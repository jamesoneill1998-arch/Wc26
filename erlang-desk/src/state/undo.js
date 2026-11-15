// Undo for deletions. Compares the workspace before and after a change and,
// when something was lost, says what, so the planner can be offered it back.

const names = (list) => (list.length === 1 ? `“${list[0].name}”` : `${list.length}`)
const gone = (before = [], after = []) => {
  const kept = new Set(after.map((x) => x.id))
  return before.filter((x) => !kept.has(x.id))
}

/**
 * @returns a short past-tense label for what was lost, or null when nothing was.
 */
export function describeLoss(before, after) {
  if (!before || !after || before === after) return null
  const services = gone(before.services, after.services)
  const areas = gone(before.areas, after.areas)
  const changes = gone(before.changes, after.changes)
  const hadPlan = before.services.length + (before.areas?.length ?? 0) > 0
  // Everything swapped at once: erased, or replaced by the sample or a file.
  if (hadPlan && services.length === before.services.length && areas.length === (before.areas?.length ?? 0)) {
    return after.services.length + (after.areas?.length ?? 0) === 0 ? 'Erased all data' : 'Replaced your workspace'
  }
  if (services.length) return services.length === 1 ? `Deleted the service ${names(services)}` : `Deleted ${names(services)} services`
  if (areas.length) return areas.length === 1 ? `Deleted the area ${names(areas)}` : `Deleted ${names(areas)} areas`
  if (changes.length) return changes.length === 1 ? `Deleted the change ${names(changes)}` : `Deleted ${names(changes)} changes`
  for (const s of after.services) {
    const was = before.services.find((x) => x.id === s.id)
    if (was?.history && !s.history) return `Cleared the history for “${s.name}”`
  }
  return null
}
