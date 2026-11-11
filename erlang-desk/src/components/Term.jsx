import { useEffect, useId, useRef, useState } from 'react'
import { TERMS } from '../glossary.js'

/**
 * A planning term explained in place. With children it underlines the word;
 * without, it shows a small "?" beside a field label. The explanation opens
 * on hover, focus or tap, stays while the pointer is over it, and closes on
 * Escape or when focus leaves.
 */
export default function Term({ k, children }) {
  const t = TERMS[k]
  const id = useId()
  const btn = useRef(null)
  const wrap = useRef(null)
  const [pos, setPos] = useState(null)
  const open = () => {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.min(300, window.innerWidth - 24)
    const left = Math.max(12, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 12))
    const below = r.bottom + 8
    // Above the word when there's no room beneath it.
    setPos(below + 150 > window.innerHeight && r.top > 170 ? { left, width, bottom: window.innerHeight - r.top + 8 } : { left, width, top: below })
  }
  const close = () => setPos(null)
  useEffect(() => {
    if (!pos) return
    const onKey = (e) => { if (e.key === 'Escape') close() }
    // A tap or click anywhere else closes it (touch screens don't blur a button on their own).
    const onDown = (e) => { if (!wrap.current?.contains(e.target)) close() }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    // Follow the word if the page scrolls or resizes underneath it.
    window.addEventListener('scroll', open, true)
    window.addEventListener('resize', open)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', open, true)
      window.removeEventListener('resize', open)
    }
  }, [!!pos]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!t) return children ?? null
  return (
    <span ref={wrap} className="term-wrap" onPointerEnter={(e) => { if (e.pointerType === 'mouse') open() }} onPointerLeave={(e) => { if (e.pointerType === 'mouse') close() }}>
      <button
        ref={btn} type="button" className={children ? 'term' : 'term hint'}
        aria-label={children ? undefined : `What is ${t.term}?`} aria-describedby={pos ? id : undefined} aria-expanded={!!pos}
        onFocus={open} onBlur={close} onClick={(e) => { e.stopPropagation(); open() }}
      >
        {children ?? '?'}
      </button>
      {pos && <span role="tooltip" id={id} className="term-pop" style={pos}><b>{t.term}</b>{t.text}</span>}
    </span>
  )
}
