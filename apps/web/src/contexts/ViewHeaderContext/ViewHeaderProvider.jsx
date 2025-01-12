// HeaderContext.js
import React, { useState } from 'react'
import { ViewHeaderContext } from './index'

export const ViewHeaderProvider = ({ children }) => {
  const [title, setTitle] = useState()
  const [icon, setIcon] = useState()
  const [info, setInfo] = useState()

  return (
    <ViewHeaderContext.Provider value={{ title, setTitle, icon, setIcon, info, setInfo }}>
      {children}
    </ViewHeaderContext.Provider>
  )
}
