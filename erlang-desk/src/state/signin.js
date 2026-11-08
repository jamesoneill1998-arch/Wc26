// Where the sign-in page sends people afterwards. Kept to the planner's own
// routes so a crafted link can't bounce a signed-in planner somewhere else.

/** Only ever return to a page inside the planner. */
export function safeNext(next) {
  return typeof next === 'string' && /^\/app(\/[a-z]{2,20})?$/.test(next) ? next : '/app/overview'
}

/** Link to the sign-in page that comes back to `next` (a route such as "/app/data"). */
export function signInHref(next, plan) {
  const q = new URLSearchParams()
  if (next) q.set('next', safeNext(next))
  if (plan) q.set('plan', plan)
  const s = q.toString()
  return `#/signin${s ? `?${s}` : ''}`
}
