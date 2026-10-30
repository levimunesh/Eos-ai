/** Up to two initials from a name or email, and a stable hue for the avatar tint. */
export function initials(nameOrEmail: string): string {
  const base = nameOrEmail.includes('@') && !nameOrEmail.includes(' ') ? nameOrEmail.split('@')[0] : nameOrEmail
  const parts = base.split(/[\s._-]+/).filter(Boolean)
  const letters = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

export function hueFor(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h % 360
}
