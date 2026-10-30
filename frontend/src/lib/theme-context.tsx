import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  applyTheme,
  readThemePref,
  resolveTheme,
  saveThemePref,
  systemPrefersDark,
  type ResolvedTheme,
  type ThemePref,
} from './theme'

interface ThemeState {
  pref: ThemePref
  resolved: ResolvedTheme
  setPref: (pref: ThemePref) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeState | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readThemePref)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    let mq: MediaQueryList | undefined
    try {
      mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    } catch {
      mq = undefined
    }
    if (!mq) return
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq?.removeEventListener?.('change', onChange)
  }, [])

  const resolved = resolveTheme(pref, systemDark)

  useEffect(() => {
    applyTheme(resolved)
  }, [resolved])

  const setPref = useCallback((next: ThemePref) => {
    saveThemePref(next)
    setPrefState(next)
  }, [])

  const value = useMemo<ThemeState>(
    () => ({ pref, resolved, setPref, toggle: () => setPref(resolved === 'dark' ? 'light' : 'dark') }),
    [pref, resolved, setPref],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
