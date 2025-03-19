import React from 'react'
import { ContextMenuContext } from './ContextMenuContext'

export default function ContextMenuProvider ({ contextWidgets, activeWidget, children }) {
  return (
    <ContextMenuContext.Provider
      value={{ contextWidgets, activeWidget }}
    >
      {children}
    </ContextMenuContext.Provider>
  )
}
