import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Route, Routes, useLocation, useNavigate, Outlet } from 'react-router-dom'
import getAuthState, { AuthState } from 'store/selectors/getAuthState'
import Signup from './Signup'
import VerifyEmail from './VerifyEmail'
import FinishRegistration from './FinishRegistration'
import Loading from 'components/Loading'

export default function SignupRouter (props) {
  const location = useLocation()
  const navigate = useNavigate()
  const authState = useSelector(getAuthState)
  const [loading, setLoading] = useState(true)

  // Ensures user is direct to the appropriate Signup screen regardless
  // of which `/signup/*` path navigated to
  useEffect(() => {
    setLoading(true)

    const redirectTo = path => {
      if (path && (path !== location.pathname)) {
        navigate(path)
        return null
      }
    }

    switch (authState) {
      case AuthState.None: {
        if (location.pathname !== '/signup/verify-email') {
          redirectTo('/signup')
        }
        break
      }
      case AuthState.EmailValidation: {
        redirectTo('/signup/verify-email')
        break
      }
      case AuthState.Registration: {
        redirectTo('/signup/finish')
        break
      }
      // Should never be true as SignupRouter is not active at this state,
      // Routing will have been turned-over to AuthLayout
      case AuthState.SignupInProgress: {
        redirectTo('/')
        break
      }
    }

    setLoading(false)
  }, [authState, location.pathname])

  if (loading) return <Loading />

  return <Outlet />
}
