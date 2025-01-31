import React, { createContext, useContext, useCallback } from 'react'
import { useQuery, useMutation } from 'urql'
import meCheckAuthQuery from '@hylo/graphql/queries/meCheckAuthQuery'
import loginMutation from '@hylo/graphql/mutations/loginMutation'
import logoutMutation from '@hylo/graphql/mutations/logoutMutation'

/*

Hylo Authentication and Authorization state reflected in terms of "Signup State"

  *Authentication*: We know who you are (you've validated your email)
  *Authorization*: You are allowed to access things

The state statuses return are intended for managing the Signup Flow when a user is
authorized but has not finished required steps in the registration of their account.

Each state below below implies transition from the previous state has completed, e.g.:

  None > EmailValidation > Registration > SignupInProgress > Complete

*/

export const AuthState = {
  None: 'None',
  EmailValidation: 'EmailValidation',
  Registration: 'Registration',
  SignupInProgress: 'SignupInProgress',
  Authorized: 'Authorized'
}

// Determines the current user's authentication state
function getAuthState (currentUser) {
  if (!currentUser) return AuthState.None

  const { emailValidated, hasRegistered, settings } = currentUser
  const { signupInProgress } = settings

  switch (true) {
    case !emailValidated:
      return AuthState.EmailValidation
    case !hasRegistered:
      return AuthState.Registration
    case signupInProgress:
      return AuthState.SignupInProgress
    default:
      return AuthState.Authorized
  }
}

// Computes derived authentication statuses based on authState
function getAuthStatuses (authState) {
  return {
    isAuthenticated: authState !== AuthState.None,
    // Signup statuses
    isEmailValidated: authState === AuthState.EmailValidation,
    isRegistered: authState === AuthState.Registration,
    isSignupInProgress: authState === AuthState.SignupInProgress,
    // Signup complete
    isAuthorized: authState === AuthState.Authorized
  }
}

// Create Auth Context
const AuthContext = createContext(null)

export function AuthProvider ({ children }) {
  const [{ data, fetching, error }, checkAuth] = useQuery({
    requestPolicy: 'cache-and-network',
    query: meCheckAuthQuery
  })

  const [, executeLogin] = useMutation(loginMutation)
  const [, executeLogout] = useMutation(logoutMutation)

  const currentUser = data?.me
  const authState = getAuthState(currentUser)
  const authStatuses = getAuthStatuses(authState)

  // **Login function**
  const login = useCallback(async ({ email, password }) => {
    try {
      const { data } = await executeLogin({ email, password })
      if (data?.login?.error) throw new Error(data.login.error)
      await checkAuth() // Refresh auth state
    } catch (err) {
      console.error('Login failed:', err.message)
      throw err
    }
  }, [executeLogin, checkAuth])

  // **Logout function**
  const logout = useCallback(async () => {
    try {
      await executeLogout()
      await checkAuth() // Refresh auth state
    } catch (err) {
      console.error('Logout failed:', err.message)
      throw err
    }
  }, [executeLogout, checkAuth])

  return (
    <AuthContext.Provider value={{ ...authStatuses, login, logout, error, fetching, checkAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook for consuming auth state & actions
export function useAuth () {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
