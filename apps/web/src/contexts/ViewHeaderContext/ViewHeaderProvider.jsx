// HeaderContext.js
import React, { useState } from 'react'
import { ViewHeaderContext } from './index'

export const ViewHeaderProvider = ({ children }) => {
  const [headerDetails, setHeaderDetails] = useState({
    backButton: false,
    backTo: null,
    icon: '',
    info: '',
    title: {
      mobile: '',
      desktop: ''
    },
    search: false,
    centered: false
  })

  return (
    <ViewHeaderContext.Provider value={{ headerDetails, setHeaderDetails }}>
      {children}
    </ViewHeaderContext.Provider>
  )
}
