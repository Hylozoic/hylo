import React from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import checkLogin from 'store/actions/checkLogin'

const CheckAuth = ({ authenticated = true }) => {
  const dispatch = useDispatch()
  const me = dispatch(checkLogin())

  if (authenticated && !me) {
    // If we are requiring auth and we are not logged in, redirect to the login page
    return <Navigate to='/login' />
  } else if (!authenticated && me) {
    // If we are not requiring auth and we are logged in, redirect to the home page
    return <Navigate to='/' />
  } else {
    // Otherwise, render the protected route
    return <Outlet />
  }
}

export default CheckAuth
