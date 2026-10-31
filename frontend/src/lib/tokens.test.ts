import { describe, expect, it } from 'vitest'

/**
 * The design tokens are the contract between the review's palette and every component. This
 * checks both themes define the same semantic set and that the text pairs meet WCAG AA by
 * calculation (not by eye), so a palette tweak cannot quietly break legibility.
 */

// The app's tsconfig has no Node types; the test runs in Node, so reach fs through a dynamic import.
const fsModule = 'node:fs'
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as { readFileSync: (path: string, enc: string) => string }
const css = readFileSync('src/index.css', 'utf8')

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  const end = css.indexOf('\n}', start)
  const body = css.slice(start, end)
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

const light = block(':root')
const dark = block("[data-theme='dark']")

const REQUIRED = [
  'canvas', 'surface', 'surface-2', 'elevated', 'line', 'line-strong', 'fg', 'fg-2', 'muted',
  'accent', 'accent-hover', 'accent-text', 'accent-soft', 'success', 'danger-text', 'warning',
  'chart-1', 'chart-2', 'chart-compare', 'chart-highlight', 'dawn', 'dawn-ink', 'raised-inset',
]

function hex(v: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(v)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function luminance([r, g, b]: [number, number, number]) {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export function contrast(a: string, b: string): number {
  const la = luminance(hex(a)!)
  const lb = luminance(hex(b)!)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

describe('design tokens', () => {
  it('defines the same semantic set in light and dark', () => {
    for (const k of REQUIRED) {
      expect(light[k], `light --${k}`).toBeTruthy()
      expect(dark[k], `dark --${k}`).toBeTruthy()
    }
  })

  it('uses the review palette and keeps the dawn gradient off buttons', () => {
    expect(light.canvas).toBe('#f6f6f4')
    expect(light.accent).toBe('#2e4bd8')
    expect(dark.canvas).toBe('#0c0d10')
    expect(dark.surface).toBe('#141519')
    expect(dark['raised-inset']).toContain('0.06')
    expect(light.dawn).toContain('#f5a05a')
    expect(css).not.toMatch(/btn-primary[^}]*dawn/)
  })

  it.each([
    ['light', light],
    ['dark', dark],
  ] as const)('%s text meets AA on canvas and surface', (_, t) => {
    for (const bg of ['canvas', 'surface', 'surface-2']) {
      expect(contrast(t.fg, t[bg]), `fg on ${bg}`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t['fg-2'], t[bg]), `fg-2 on ${bg}`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t.muted, t[bg]), `muted on ${bg}`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t['accent-text'], t[bg]), `accent-text on ${bg}`).toBeGreaterThanOrEqual(4.5)
      // Deltas are 12px semibold coloured text: they must clear AA on their own.
      expect(contrast(t.success, t[bg]), `success on ${bg}`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t['danger-text'], t[bg]), `danger on ${bg}`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t.warning, t[bg]), `warning on ${bg}`).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(t['accent-fg'], t.accent), 'button text').toBeGreaterThanOrEqual(4.5)
  })
})
