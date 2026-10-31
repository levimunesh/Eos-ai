import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { t } from './strings'
import { cn } from './utils'

type Tone = 'success' | 'error'
interface Toast {
  id: number
  message: string
  tone: Tone
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)
const noop: ToastApi = { success: () => undefined, error: () => undefined }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((x) => x.id !== id)), [])

  const push = useCallback(
    (message: string, tone: Tone) => {
      const id = nextId.current++
      setToasts((all) => [...all.slice(-2), { id, message, tone }])
      window.setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 3500)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push(m, 'success'), error: (m) => push(m, 'error') }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="region"
        aria-label={t('common.notifications')}
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:end-0 sm:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className="anim-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line bg-elevated px-4 py-3 text-body text-fg shadow-lg"
          >
            {toast.tone === 'success' ? (
              <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
            ) : (
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger-text" />
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={t('common.dismiss')}
              className={cn('-m-1 rounded-sm p-1 text-muted hover:text-fg')}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** Outside a provider (e.g. isolated tests) toasts are a no-op. */
// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? noop
}
