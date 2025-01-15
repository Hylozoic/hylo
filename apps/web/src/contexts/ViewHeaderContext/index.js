import { createContext, useContext } from 'react'
const ViewHeaderContext = createContext()
const useViewHeader = () => useContext(ViewHeaderContext)
export { ViewHeaderContext, useViewHeader }
