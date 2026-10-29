import { useEffect } from 'react'

// A short walk through the sample operation for first-time visitors. Each
// step opens a real page and says what to look at; nothing is mocked.
export const TOUR = [
  { page: 'overview', title: 'The whole operation', text: 'Required against available FTE for every service and site. "Needs attention" lists what to act on this week: hiring deadlines and shortfalls.' },
  { page: 'sites', title: 'UK and offshore', text: 'Each site has its own shrinkage, contracted hours and attrition. Change a component and every plan updates.' },
  { page: 'forecast', title: 'Forecast', text: 'Four methods are tested against recent history and the most accurate is used. The heatmap shows where each day\'s calls land.' },
  { page: 'coverage', title: 'Roster coverage', text: 'The roster against the requirement, every half hour. Red is short, blue is over. Switch to "Service level" to see what the roster delivers.' },
  { page: 'capacity', title: 'Capacity plan', text: 'Six months of supply against demand through attrition and training, with the hiring classes that close the gaps.' },
  { page: 'impact', title: 'Change impact', text: 'A mortgage launch of 25,000 acquisitions, converted to calls and FTE and tested against headroom. Print it for the change board.' },
]

const KEY = 'erlang-desk:tour'
export function tourSeen() {
  try { return localStorage.getItem(KEY) === 'done' } catch { return true }
}
function markSeen() {
  try { localStorage.setItem(KEY, 'done') } catch { /* storage blocked */ }
}

export default function Tour({ step, setStep }) {
  const s = TOUR[step]
  useEffect(() => {
    if (s) window.location.hash = `#/app/${s.page}`
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { markSeen(); setStep(null) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setStep])
  if (!s) return null
  const end = () => { markSeen(); setStep(null) }
  return (
    <aside className="tour" role="dialog" aria-label="Guided tour" aria-live="polite">
      <div className="tour-top">
        <span className="label">Tour · {step + 1} of {TOUR.length}</span>
        <button className="btn link small" type="button" onClick={end}>Close</button>
      </div>
      <h3>{s.title}</h3>
      <p>{s.text}</p>
      <div className="tour-dots" aria-hidden="true">{TOUR.map((_, i) => <i key={i} className={i === step ? 'on' : ''} />)}</div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {step > 0 && <button className="btn sm" type="button" onClick={() => setStep(step - 1)}>Back</button>}
        {step < TOUR.length - 1
          ? <button className="btn sm primary" type="button" onClick={() => setStep(step + 1)}>Next</button>
          : <button className="btn sm primary" type="button" onClick={end}>Finish</button>}
      </div>
    </aside>
  )
}
