import React from 'react'
import { Navigate, useParams } from 'react-router-dom'

export default function NavigateWithParams ({ to, ...rest }) {
  const params = useParams()
  let toValue
  if (typeof to === 'function') {
    toValue = to(params)
  } else {
    toValue = to
  }
  return <Navigate to={toValue} {...rest} />
}
