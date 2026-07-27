import { createContext, useContext } from 'react'

export const ViewHeaderContext = createContext()

export const useViewHeader = () => useContext(ViewHeaderContext)
