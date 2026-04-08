'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const AlertContext = createContext(null)

const STYLES_BY_TYPE = {
  alert: {
    card: 'border-yellow-300 bg-yellow-50 text-yellow-900',
    bar: 'bg-yellow-500',
  },
  error: {
    card: 'border-red-300 bg-red-50 text-red-900',
    bar: 'bg-red-500',
  },
  success: {
    card: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    bar: 'bg-emerald-500',
  },
}

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function AlertItem({ item, onClose }) {
  const [remainingPercent, setRemainingPercent] = useState(100)
  const safeDuration = Math.max(500, item.duration || 5000)
  const typeStyle = STYLES_BY_TYPE[item.type] || STYLES_BY_TYPE.alert

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onClose(item.id)
    }, safeDuration)

    const start = performance.now()
    let frameId = null

    const updateBar = () => {
      const elapsed = performance.now() - start
      const next = Math.max(0, 100 - (elapsed / safeDuration) * 100)
      setRemainingPercent(next)

      if (next > 0) {
        frameId = requestAnimationFrame(updateBar)
      }
    }

    frameId = requestAnimationFrame(updateBar)

    return () => {
      clearTimeout(timeoutId)
      if (frameId) cancelAnimationFrame(frameId)
    }
  }, [item.id, onClose, safeDuration])

  return (
    <div className={`relative w-80 overflow-hidden rounded-lg border shadow-lg backdrop-blur-sm ${typeStyle.card}`} role="alert" aria-live="polite">
      <div className="absolute left-0 top-0 h-1 w-full bg-black/10">
        <div className={`h-full transition-[width] duration-75 ease-linear ${typeStyle.bar}`} style={{ width: `${remainingPercent}%` }} />
      </div>

      <div className="flex items-start gap-3 p-4 pt-5">
        <div className="min-w-0 flex-1">
          {item.title ? <p className="mb-1 text-sm font-semibold">{item.title}</p> : null}
          <p className="wrap-break-word text-sm">{item.message}</p>
        </div>

        <button type="button" onClick={() => onClose(item.id)} className="rounded p-1 text-current/70 transition hover:bg-black/10 hover:text-current" aria-label="Fechar alerta">
          ✕
        </button>
      </div>
    </div>
  )
}

function AlertStack({ items, onClose }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-9999 flex max-h-[90vh] w-80 flex-col gap-3">
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <AlertItem item={item} onClose={onClose} />
        </div>
      ))}
    </div>
  )
}

export function AlertProvider({ children, defaultDuration = 5000, maxStack = 6 }) {
  const [items, setItems] = useState([])

  const removeAlert = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const showAlert = useCallback(
    (message, options = {}) => {
      const newAlert = {
        id: createId(),
        message,
        title: options.title,
        type: options.type || 'alert',
        duration: options.duration ?? defaultDuration,
      }

      setItems((prev) => {
        const next = [...prev, newAlert]
        if (next.length > maxStack) {
          return next.slice(next.length - maxStack)
        }
        return next
      })

      return newAlert.id
    },
    [defaultDuration, maxStack]
  )

  const clearAlerts = useCallback(() => setItems([]), [])

  const contextValue = useMemo(
    () => ({
      showAlert,
      showSuccess: (message, options = {}) => showAlert(message, { ...options, type: 'success' }),
      showError: (message, options = {}) => showAlert(message, { ...options, type: 'error' }),
      removeAlert,
      clearAlerts,
    }),
    [clearAlerts, removeAlert, showAlert]
  )

  return (
    <AlertContext.Provider value={contextValue}>
      {children}
      <AlertStack items={items} onClose={removeAlert} />
    </AlertContext.Provider>
  )
}

export function useAlert() {
  const context = useContext(AlertContext)

  if (!context) {
    throw new Error('useAlert must be used inside AlertProvider')
  }

  return context
}
