import { CheckCircle2, CircleAlert, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ToastContext } from './toast-context'

type ToastKind = 'success' | 'error'

type Toast = {
  id: number
  kind: ToastKind
  title: string
  detail?: string
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const timeoutIds = useRef<number[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback((kind: ToastKind, title: string, detail?: string) => {
    const id = nextId.current++
    setToasts((current) => [...current.slice(-2), { id, kind, title, detail }])
    timeoutIds.current.push(window.setTimeout(() => dismiss(id), 5000))
  }, [dismiss])

  useEffect(() => () => {
    timeoutIds.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
  }, [])

  const value = {
    success: (title: string, detail?: string) => show('success', title, detail),
    error: (title: string, detail?: string) => show('error', title, detail),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-label="Notifications">
        {toasts.map((toast) => (
          <section key={toast.id} className={`toast toast--${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
            {toast.kind === 'success' ? <CheckCircle2 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
            <div><strong>{toast.title}</strong>{toast.detail && <p>{toast.detail}</p>}</div>
            <button type="button" aria-label={`Dismiss ${toast.title}`} onClick={() => dismiss(toast.id)}><X aria-hidden="true" /></button>
          </section>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
