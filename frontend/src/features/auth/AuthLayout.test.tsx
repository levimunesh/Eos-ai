import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuthLayout } from './AuthLayout'

describe('auth layout', () => {
  it('gives each brand art instance its own gradient ids', () => {
    const { container } = render(<AuthLayout title="Sign in to EOS AI">form</AuthLayout>)
    const ids = Array.from(container.querySelectorAll('svg [id]')).map((el) => el.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
    // Every url(#...) reference points at an id inside the same svg.
    for (const svg of container.querySelectorAll('svg[data-testid="brand-art"]')) {
      const local = new Set(Array.from(svg.querySelectorAll('[id]')).map((el) => el.id))
      for (const el of svg.querySelectorAll('[fill^="url("], [stroke^="url("], [mask^="url("]')) {
        for (const attr of ['fill', 'stroke', 'mask']) {
          const ref = el.getAttribute(attr)?.match(/^url\(#(.+)\)$/)?.[1]
          if (ref) expect(local.has(ref)).toBe(true)
        }
      }
    }
    expect(screen.getByTestId('brand-panel')).toHaveTextContent('See every branch clearly')
  })
})
