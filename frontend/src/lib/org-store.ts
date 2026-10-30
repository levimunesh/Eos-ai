const KEY = 'eos.currentOrgId'

/** Current organisation id, persisted per browser. Storage can be unavailable, so never throw. */
export const orgStore = {
  get(): string | null {
    try {
      return window.localStorage.getItem(KEY)
    } catch {
      return null
    }
  },
  set(id: string | null): void {
    try {
      if (id) window.localStorage.setItem(KEY, id)
      else window.localStorage.removeItem(KEY)
    } catch {
      // Private mode or blocked storage: the choice lasts for this tab only.
    }
  },
}
