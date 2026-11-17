import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

/** Legacy `/projects` view URLs → `/tasks`, keeping any trailing path (e.g. `/post/:id`) and query. */
export default function RedirectProjectsToTasks () {
  const { pathname, search, hash } = useLocation()
  const to = pathname.replace(/\/projects(\/|$)/, '/tasks$1')
  return <Navigate to={`${to}${search}${hash}`} replace />
}
