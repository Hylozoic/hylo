import React, { createContext, useContext, useState } from 'react'

const DropdownContext = createContext()

export function DropdownProvider ({ children }) {
  const [activeDropdownId, setActiveDropdownId] = useState(null)

  const closeAllDropdowns = () => {
    setActiveDropdownId(null)
  }

  const openDropdown = (id) => {
    setActiveDropdownId(id)
  }

  return (
    <DropdownContext.Provider value={{ activeDropdownId, closeAllDropdowns, openDropdown }}>
      {children}
    </DropdownContext.Provider>
  )
}

export function useDropdown () {
  const context = useContext(DropdownContext)
  if (!context) {
    throw new Error('useDropdown must be used within a DropdownProvider')
  }
  return context
} 