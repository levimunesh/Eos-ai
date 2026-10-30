export type ThemePref = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_KEY = 'eos.theme'

export function readThemePref(): ThemePref {
  try {
    const v = window.localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function saveThemePref(pref: ThemePref): void {
  try {
    if (pref === 'system') window.localStorage.removeItem(THEME_KEY)
    else window.localStorage.setItem(THEME_KEY, pref)
  } catch {
    // Storage blocked: the choice lasts for this tab.
  }
}

export function systemPrefersDark(): boolean {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  } catch {
    return false
  }
}

export function resolveTheme(pref: ThemePref, systemDark = systemPrefersDark()): ResolvedTheme {
  if (pref === 'system') return systemDark ? 'dark' : 'light'
  return pref
}

export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.setAttribute('data-theme', theme)
}
