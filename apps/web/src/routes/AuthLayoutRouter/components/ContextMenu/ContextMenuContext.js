import { createContext, useContext } from 'react'

export const ContextMenuContext = createContext()

export function useContextMenuContext () {
  const context = useContext(ContextMenuContext)
  if (!context) {
    throw new Error('useContextMenuContext must be used within a ContextMenu view')
  }
  return context
}
