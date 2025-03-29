import React from 'react'
import { ContextMenuContext } from './ContextMenuContext'

export default function ContextMenuProvider ({
  contextWidgets,
  activeWidget,
  isEditing,
  canAdminister,
  rootPath,
  group,
  groupSlug,
  handlePositionedAdd,
  children
}) {
  return (
    <ContextMenuContext.Provider
      value={{
        contextWidgets,
        activeWidget,
        isEditing,
        canAdminister,
        rootPath,
        group,
        groupSlug,
        handlePositionedAdd
      }}
    >
      {children}
    </ContextMenuContext.Provider>
  )
}
