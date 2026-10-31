/**
 * 56×20 sparkline: comparison grey with the last quarter of the line in the data primary, so the
 * recent movement is what the eye lands on. Decorative; the card's delta carries the meaning.
 */
export function Sparkline({ values, width = 56, height = 20, className }: { values: number[]; width?: number; height?: number; className?: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pad = 1.5
  const pts = values.map((v, i) => [
    pad + (i / (values.length - 1)) * (width - pad * 2),
    pad + (1 - (v - min) / span) * (height - pad * 2),
  ])
  const d = (ps: number[][]) => ps.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const cut = Math.max(1, Math.floor((values.length - 1) * 0.75))
  const head = pts.slice(0, cut + 1)
  const tail = pts.slice(cut)
  const last = pts[pts.length - 1]
  return (
    <svg aria-hidden width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className}>
      <path d={d(head)} fill="none" stroke="var(--chart-compare)" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
      <path d={d(tail)} fill="none" stroke="var(--chart-1)" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="1.75" fill="var(--chart-1)" />
    </svg>
  )
}
