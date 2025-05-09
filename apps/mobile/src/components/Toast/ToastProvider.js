import React, { createContext, useCallback, useContext, useState } from 'react'
import Toast from './Toast'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)

  const showToast = useCallback(({ text1, text2, type, duration }) => {
    setToast({ text1, text2, type, duration })
  }, [])

  const hideToast = useCallback(() => {
    setToast(null)
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && (
        <Toast
          text1={toast.text1}
          text2={toast.text2}
          type={toast.type}
          onHide={hideToast}
          duration={toast.duration}
        />
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
} 