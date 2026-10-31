import { createContext, useContext } from 'react'

/** Shell-level actions any page can trigger: open the palette (optionally prefilled) or ask EOS. */
export interface ShellActions {
  openPalette: (prefill?: string) => void
  /** Opens the Ask EOS panel; with a question, sends it straight away. */
  ask: (question?: string) => void
}

export const ShellContext = createContext<ShellActions>({ openPalette: () => undefined, ask: () => undefined })

export function useShell() {
  return useContext(ShellContext)
}
