import { createHash } from 'node:crypto'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Offline support. Writes /sw.js at build time with this build's file list,
 * so the planner keeps working without a connection once it has been opened.
 *
 * Rules that keep it from serving a stale site:
 *  - pages (HTML) always come from the network when there is one; the cached
 *    copy is used only when the network fails
 *  - hashed files under /assets/ never change, so the cache is used first
 *  - /api/ is never touched
 *  - each build has its own cache; older ones are deleted on activation
 */
function offline() {
  return {
    name: 'erlang-desk-offline',
    apply: 'build',
    generateBundle(_, bundle) {
      const all = Object.keys(bundle).filter((f) => f.startsWith('assets/')).sort()
      const version = createHash('sha256').update(all.join('|')).digest('hex').slice(0, 12)
      // Stored ahead of time: scripts, styles and the Latin fonts. Other alphabets' font files are fetched if ever needed.
      const assets = all.filter((f) => /\.(js|css)$/.test(f) || /-latin-wght-normal-/.test(f)).map((f) => `/${f}`)
      const source = `// Generated at build time by vite.config.js. Do not edit.
const CACHE = 'erlang-desk-${version}'
const PRECACHE = ${JSON.stringify(['/', '/favicon.svg', '/legal.css', '/glossary.html', ...assets])}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})))).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('erlang-desk-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

const keep = (request, response) => {
  if (response.ok && response.type === 'basic') {
    const copy = response.clone()
    caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  if (url.pathname.startsWith('/assets/')) {
    // Hashed and immutable: the cached copy is always right.
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((r) => keep(request, r))))
    return
  }
  // Everything else, pages included: the network first, the cache only when it fails.
  event.respondWith(
    fetch(request).then((r) => keep(request, r)).catch(() =>
      caches.match(request, { ignoreSearch: true }).then((hit) => hit || (request.mode === 'navigate' ? caches.match('/') : undefined)).then((hit) => hit || Response.error())),
  )
})
`
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  plugins: [react(), offline()],
  // Never inline assets as data: URIs; the Content Security Policy only allows files from our own origin.
  build: { assetsInlineLimit: 0 },
})
