import { useEffect } from 'react'

/** Calls `handler` on Cmd+<key> (macOS) or Ctrl+<key> (elsewhere). */
export function useModHotkey(key: string, handler: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === key) {
        e.preventDefault()
        handler()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [key, handler])
}

export function isApplePlatform(): boolean {
  try {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
    const p = nav.userAgentData?.platform ?? navigator.platform ?? ''
    return /mac|iphone|ipad/i.test(p)
  } catch {
    return false
  }
}
