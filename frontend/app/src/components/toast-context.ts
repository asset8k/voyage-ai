import { createContext, useContext } from 'react'

export type ToastContextValue = {
  success: (title: string, detail?: string) => void
  error: (title: string, detail?: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider')
  return context
}
