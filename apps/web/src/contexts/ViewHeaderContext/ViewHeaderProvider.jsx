// HeaderContext.js
import React, { useState } from 'react'
import { ViewHeaderContext } from './index'

export const ViewHeaderProvider = ({ children }) => {
  const [details, setDetails] = useState({ title: '', icon: '', info: '' })

  return (
    <ViewHeaderContext.Provider value={{ details, setDetails }}>
      {children}
    </ViewHeaderContext.Provider>
  )
}
