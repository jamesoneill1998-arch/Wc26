export const fmtInt = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString() : '–')
export const fmt1 = (n) => (Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '–')
export const fmtPct = (n, d = 1) => (Number.isFinite(n) ? `${(n * 100).toFixed(d)}%` : '–')
export const fmtSec = (n) => (Number.isFinite(n) ? `${n < 10 ? n.toFixed(1) : Math.round(n)}s` : '∞')
export function fmtCompact(n) {
  if (!Number.isFinite(n)) return '–'
  const a = Math.abs(n)
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`
  if (a >= 1e3) return `${(n / 1e3).toFixed(a >= 1e4 ? 0 : 1)}K`
  return `${Math.round(n)}`
}
export function downloadText(filename, text, type = 'text/csv') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
