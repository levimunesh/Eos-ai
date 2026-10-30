import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { readThemePref, resolveTheme, THEME_KEY } from './theme'
import { ThemeProvider, useTheme } from './theme-context'

function Toggle() {
  const { resolved, toggle, setPref } = useTheme()
  return (
    <>
      <span data-testid="resolved">{resolved}</span>
      <button onClick={toggle}>toggle</button>
      <button onClick={() => setPref('system')}>system</button>
    </>
  )
}

describe('theme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
  })

  it('resolves system preference', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
  })

  it('persists the toggle to localStorage and applies data-theme', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <ThemeProvider>
        <Toggle />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('resolved')).toHaveTextContent('light')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')

    await user.click(screen.getByText('toggle'))
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(window.localStorage.getItem(THEME_KEY)).toBe('dark')
    unmount()

    // A fresh mount (page reload) restores the saved choice.
    render(
      <ThemeProvider>
        <Toggle />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
    expect(readThemePref()).toBe('dark')
  })

  it('clears the stored value when returning to system', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(THEME_KEY, 'dark')
    render(
      <ThemeProvider>
        <Toggle />
      </ThemeProvider>,
    )
    await user.click(screen.getByText('system'))
    expect(window.localStorage.getItem(THEME_KEY)).toBeNull()
  })
})
