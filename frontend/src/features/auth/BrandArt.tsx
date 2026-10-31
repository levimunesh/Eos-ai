import { useId } from 'react'

/**
 * First light: a warm horizon rising into a pale sky, concentric arcs over a fine grid, drawn
 * in SVG so it scales, themes and costs no network request. Purely decorative.
 *
 * Gradient ids are unique per instance: the phone band and the desktop panel both render this,
 * and a duplicate id would resolve to the hidden copy and paint nothing.
 */
export function BrandArt({ anchor = 'center' }: { anchor?: 'center' | 'horizon' }) {
  const uid = useId().replace(/:/g, '')
  const id = (name: string) => `${name}-${uid}`
  const arcs = [70, 120, 170, 220, 270, 320, 370]
  const H = 640
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
          <stop offset="0" stopColor="#d9dcf0" />
          <stop offset="0.45" stopColor="#ece3ee" />
          <stop offset="0.72" stopColor="#f6d3c2" />
          <stop offset="0.8" stopColor="#f5b98f" />
        </linearGradient>
        <radialGradient id={id('sun')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff1dc" stopOpacity="1" />
          <stop offset="0.14" stopColor="#f9c48f" stopOpacity="0.95" />
          <stop offset="0.34" stopColor="#f5a05a" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#e0577a" stopOpacity="0.18" />
          <stop offset="1" stopColor="#7a5af0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('ground')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2238" />
          <stop offset="1" stopColor="#15121c" />
        </linearGradient>
        <linearGradient id={id('arc')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7a5af0" stopOpacity="0" />
          <stop offset="0.5" stopColor="#e0577a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#f5a05a" stopOpacity="0" />
        </linearGradient>
        <pattern id={id('grid')} width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" fill="none" stroke="#2b2238" strokeOpacity="0.08" />
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
      {/* Glow centred on the horizon so the light rises above the line. */}
      <ellipse cx="300" cy={H} rx="460" ry="340" fill={`url(#${id('sun')})`} />
      {arcs.map((r, i) => (
        <path key={r} d={`M ${300 - r} ${H} A ${r} ${r} 0 0 1 ${300 + r} ${H}`} fill="none" stroke={`url(#${id('arc')})`} strokeWidth={i === 2 ? 1.6 : 1} strokeOpacity={1 - i * 0.11} />
      ))}
      <rect y={H} width="600" height={800 - H} fill={`url(#${id('ground')})`} />
      <path d={`M 0 ${H} H 600`} stroke="#ffd9b8" strokeOpacity="0.9" />
      <circle cx="300" cy={H} r="3.5" fill="#fff4e6" />
    </svg>
  )
}
