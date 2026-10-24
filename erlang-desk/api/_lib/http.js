// Request/response helpers with security defaults baked in.

export const SESSION_COOKIE = '__Host-ed_session'
export const LOGIN_COOKIE = '__Host-ed_login'

export function send(res, status, body, headers = {}) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
  res.end(JSON.stringify(body))
}

export function redirect(res, location) {
  res.statusCode = 302
  res.setHeader('Location', location)
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Referrer-Policy', 'no-referrer') // keep tokens out of Referer
  res.end()
}

export function parseCookies(header = '') {
  const out = {}
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    if (k && !(k in out)) {
      try { out[k] = decodeURIComponent(part.slice(i + 1).trim()) } catch { /* ignore bad encoding */ }
    }
  }
  return out
}

/** __Host- cookies must be Secure, Path=/ and have no Domain: they can't be set or read by subdomains. */
export function cookie(name, value, maxAgeSec) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.max(0, Math.floor(maxAgeSec))}; HttpOnly; Secure; SameSite=Lax`
}

export function appendCookie(res, value) {
  const prev = res.getHeader('Set-Cookie')
  res.setHeader('Set-Cookie', prev ? [].concat(prev, value) : [value])
}

export function allowMethods(req, res, methods) {
  if (methods.includes(req.method)) return true
  res.setHeader('Allow', methods.join(', '))
  send(res, 405, { error: 'Method not allowed' })
  return false
}

/**
 * CSRF defence for state-changing requests: the browser-supplied Origin (or,
 * failing that, Sec-Fetch-Site) must show the request came from our own app.
 * Combined with SameSite=Lax cookies and JSON-only bodies.
 */
export function sameOrigin(req, appUrl) {
  const origin = req.headers.origin
  if (origin) return origin === appUrl
  return req.headers['sec-fetch-site'] === 'same-origin'
}

export function requireSameOrigin(req, res, appUrl) {
  if (sameOrigin(req, appUrl)) return true
  send(res, 403, { error: 'Cross-site request refused' })
  return false
}

/** Parse a small JSON body. Vercel pre-parses JSON; we still enforce type and size. */
export function jsonBody(req, maxBytes = 4096) {
  const type = String(req.headers['content-type'] || '')
  if (!type.startsWith('application/json')) return null
  const len = Number(req.headers['content-length'] || 0)
  if (len > maxBytes) return null
  let body = req.body
  if (typeof body === 'string') {
    if (body.length > maxBytes) return null
    try { body = JSON.parse(body) } catch { return null }
  }
  return body && typeof body === 'object' && !Array.isArray(body) ? body : null
}

export function clientIp(req) {
  const real = req.headers['x-real-ip']
  if (real) return String(real)
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return fwd || req.socket?.remoteAddress || 'unknown'
}

const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/

export function normaliseEmail(input) {
  if (typeof input !== 'string') return null
  const e = input.trim().toLowerCase()
  return e.length <= 254 && EMAIL.test(e) ? e : null
}

/** Wrap a handler so unexpected errors never leak internals to the client. */
export function handler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res)
    } catch (err) {
      console.error(`[${req.method} ${req.url}]`, err?.name, err?.message)
      if (!res.headersSent) send(res, err?.name === 'ConfigError' ? 503 : 500, { error: err?.name === 'ConfigError' ? 'Service not configured' : 'Something went wrong' })
    }
  }
}
