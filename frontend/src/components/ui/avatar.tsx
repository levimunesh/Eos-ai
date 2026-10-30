import type { CSSProperties } from 'react'
import { hueFor, initials } from '@/lib/initials'
import { cn } from '@/lib/utils'

export function Avatar({ name, seed, className }: { name: string; seed?: string; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ '--h': hueFor(seed ?? name) } as CSSProperties}
      className={cn(
        'avatar inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold tracking-tight',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
