import { useId } from 'react'

/**
 * Abstract dawn: concentric horizon arcs rising over a fine grid, drawn in SVG so it scales,
 * themes and costs no network request. Purely decorative.
 *
 * Gradient ids are unique per instance: the phone band and the desktop panel both render this,
 * and a duplicate id would resolve to the hidden copy and paint nothing.
 */
export function BrandArt({ anchor = 'center' }: { anchor?: 'center' | 'horizon' }) {
  const uid = useId().replace(/:/g, '')
  const id = (name: string) => `${name}-${uid}`
  const arcs = [70, 120, 170, 220, 270, 320, 370]
  return (
    <svg
      aria-hidden
      data-testid="brand-art"
      viewBox={anchor === 'horizon' ? '0 380 600 300' : '0 0 600 800'}
      preserveAspectRatio={anchor === 'horizon' ? 'xMidYMax slice' : 'xMidYMid slice'}
      className="absolute inset-0 size-full"
    >
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b0d1f" />
          <stop offset="0.55" stopColor="#1b1d4a" />
          <stop offset="0.82" stopColor="#4a2f78" />
          <stop offset="1" stopColor="#8a3d6e" />
        </linearGradient>
        <radialGradient id={id('sun')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd0a8" stopOpacity="1" />
          <stop offset="0.12" stopColor="#ff9a7a" stopOpacity="0.9" />
          <stop offset="0.32" stopColor="#e0577a" stopOpacity="0.6" />
          <stop offset="0.62" stopColor="#6e48dc" stopOpacity="0.28" />
          <stop offset="1" stopColor="#3a4fe0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('ground')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#120f2c" stopOpacity="0.55" />
          <stop offset="1" stopColor="#07081a" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id={id('arc')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8f9cff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#c9cfff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff9fb5" stopOpacity="0" />
        </linearGradient>
        <pattern id={id('grid')} width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" fill="none" stroke="#ffffff" strokeOpacity="0.05" />
        </pattern>
        <linearGradient id={id('grid-fade')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id={id('grid-mask')}>
          <rect width="600" height="800" fill={`url(#${id('grid-fade')})`} />
        </mask>
      </defs>
      <rect width="600" height="800" fill={`url(#${id('sky')})`} />
      <rect width="600" height="800" fill={`url(#${id('grid')})`} mask={`url(#${id('grid-mask')})`} />
      {/* Glow centred on the horizon so the dawn rises above the line. */}
      <ellipse cx="300" cy="640" rx="460" ry="360" fill={`url(#${id('sun')})`} />
      {arcs.map((r, i) => (
        <path
          key={r}
          d={`M ${300 - r} 640 A ${r} ${r} 0 0 1 ${300 + r} 640`}
          fill="none"
          stroke={`url(#${id('arc')})`}
          strokeWidth={i === 2 ? 1.6 : 1}
          strokeOpacity={1 - i * 0.11}
        />
      ))}
      <path d="M 0 640 H 600" stroke="#ffffff" strokeOpacity="0.35" />
      <rect y="640" width="600" height="160" fill={`url(#${id('ground')})`} />
      <circle cx="300" cy="640" r="3" fill="#fff" />
    </svg>
  )
}
