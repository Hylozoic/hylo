import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import getSignupState, { SignupState } from 'store/selectors/getSignupState'
import Signup from './Signup'
import VerifyEmail from './VerifyEmail'
import Agreements from './Agreements'
import FinishRegistration from './FinishRegistration'
import Loading from 'components/Loading'

export default function SignupRouter (props) {
  const location = useLocation()
  const navigate = useNavigate()
  const signupState = useSelector(getSignupState)
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

    switch (signupState) {
      case SignupState.None: {
        if (location.pathname !== '/signup/verify-email') {
          redirectTo('/signup')
        }
        break
      }
      case SignupState.EmailValidation: {
        redirectTo('/signup/verify-email')
        break
      }
      case SignupState.Registration: {
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
      // Should never be true as SignupRouter is not active once authorized,
      // Routing will have been turned-over to AuthLayoutRouter
      case SignupState.Complete: {
        redirectTo('/')
        break
      }
    }

    setLoading(false)
  }, [signupState, location.pathname])

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
