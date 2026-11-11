// The planning model for the whole workspace, computed in a Web Worker.
// Falls back to the main thread where workers aren't available.

import { useEffect, useRef, useState } from 'react'

const EMPTY = { services: {}, total: [], bySite: {}, byChannel: {} }

export function useModel(ws) {
  const [state, setState] = useState({ result: EMPTY, busy: false, error: null })
  const worker = useRef(null)
  const seq = useRef(0)
  const fallbackCache = useRef(null)

  useEffect(() => {
    try {
      worker.current = new Worker(new URL('../engine/worker.js', import.meta.url), { type: 'module' })
      worker.current.onmessage = (e) => {
        if (e.data.seq !== seq.current) return // a newer run is on its way
        setState(e.data.error ? (s) => ({ ...s, busy: false, error: e.data.error }) : { result: e.data.result, busy: false, error: null })
      }
    } catch {
      worker.current = null
    }
    return () => worker.current?.terminate()
  }, [])

  const input = { sites: ws.sites, services: ws.services }
  useEffect(() => {
    const id = ++seq.current
    setState((s) => ({ ...s, busy: true }))
    const t = setTimeout(() => {
      if (worker.current) {
        worker.current.postMessage({ seq: id, ws: input })
      } else {
        // No worker here: load the engine on demand and run it on the main thread.
        import('../engine/compute.js').then(({ computeWorkspace, createCache }) => {
          fallbackCache.current ??= createCache()
          const result = computeWorkspace(input, fallbackCache.current)
          if (id === seq.current) setState({ result, busy: false, error: null })
        }).catch((err) => {
          setState((st) => ({ ...st, busy: false, error: String(err.message) }))
        })
      }
    }, 120)
    return () => clearTimeout(t)
  }, [ws.sites, ws.services]) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}
