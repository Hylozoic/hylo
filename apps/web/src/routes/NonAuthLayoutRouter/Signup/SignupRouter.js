import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import getAuthState, { AuthState } from 'store/selectors/getAuthState'
import Signup from './Signup'
import VerifyEmail from './VerifyEmail'
import Agreements from './Agreements'
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
        // If user is on agreements page, let them stay there
        if (location.pathname === '/signup/agreements') {
          break
        }
        // Otherwise redirect to agreements first, then they can proceed to finish
        if (location.pathname !== '/signup/finish') {
          redirectTo('/signup/agreements')
        }
        break
      }
      // Should never be true as SignupRouter is not active at this state,
      // Routing will have been turned-over to AuthLayoutRouter
      case AuthState.SignupInProgress: {
        redirectTo('/')
        break
      }
    }

    setLoading(false)
  }, [authState, location.pathname])

  if (loading) return <Loading />

  return (
    <Routes>
      <Route
        path=''
        element={<Signup {...props} />}
      />
      <Route
        path='verify-email'
        element={<VerifyEmail {...props} />}
      />
      <Route
        path='agreements'
        element={<Agreements {...props} />}
      />
      <Route
        path='finish'
        element={<FinishRegistration {...props} />}
      />
    </Routes>
  )
}
