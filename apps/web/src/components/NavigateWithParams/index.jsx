import React from 'react'
import { Navigate, parsePath, useLocation, useParams } from 'react-router-dom'

// Keeps the current query string and hash unless `to` sets its own
export default function NavigateWithParams ({ to, ...rest }) {
  const params = useParams()
  const { search, hash } = useLocation()
  const toValue = typeof to === 'function' ? to(params) : to
  const target = typeof toValue === 'string' ? parsePath(toValue) : toValue
  return <Navigate to={{ search, hash, ...target }} {...rest} />
}
