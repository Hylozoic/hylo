// HeaderContext.js
import React, { useState } from 'react'
import { ViewHeaderContext } from './index'

export const ViewHeaderProvider = ({ children }) => {
  const [headerDetails, setHeaderDetails] = useState({ title: '', icon: '', info: '' })

  return (
    <ViewHeaderContext.Provider value={{ headerDetails, setHeaderDetails }}>
      {children}
    </ViewHeaderContext.Provider>
  )
}
