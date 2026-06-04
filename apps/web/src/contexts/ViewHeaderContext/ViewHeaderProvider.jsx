// HeaderContext.js
import React, { useState, useCallback } from 'react'
import { ViewHeaderContext } from './index'

const defaultHeaderDetails = {
  backButton: false,
  backTo: null,
  mobileBackButton: false,
  icon: '',
  info: '',
  title: {
    mobile: '',
    desktop: ''
  },
  search: false,
  centered: false
}

export const ViewHeaderProvider = ({ children }) => {
  const [headerDetails, setHeaderDetailsRaw] = useState(defaultHeaderDetails)

  // Always merge with defaults so flags like mobileBackButton reset
  // when a new route doesn't explicitly set them
  const setHeaderDetails = useCallback((details) => {
    setHeaderDetailsRaw({ ...defaultHeaderDetails, ...details })
  }, [])

  return (
    <ViewHeaderContext.Provider value={{ headerDetails, setHeaderDetails }}>
      {children}
    </ViewHeaderContext.Provider>
  )
}
