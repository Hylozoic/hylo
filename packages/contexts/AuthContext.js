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

const AuthContext = createContext(null)

export function AuthProvider ({ children }) {
  const [{ data, fetching, error }, checkAuth] = useQuery({
    requestPolicy: 'cache-and-network',
    query: meCheckAuthQuery
  })
  const [, executeLogin] = useMutation(loginMutation)
  const [, executeLogout] = useMutation(logoutMutation)

  const currentUser = data?.me
  const isAuthenticated = currentUser
  const isAuthorized = isAuthenticated &&
    currentUser?.emailValidated &&
    currentUser?.hasRegistered &&
    !currentUser?.settings?.signupInProgress

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
    <AuthContext.Provider value={{ isAuthenticated, isAuthorized, login, logout, error, fetching, currentUser, checkAuth }}>
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
