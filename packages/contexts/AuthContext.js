import React, { createContext, useContext, useCallback, useEffect } from 'react'
import { useQuery, useMutation } from 'urql'
import { create } from 'zustand'
import meCheckAuthQuery from '@hylo/graphql/queries/meCheckAuthQuery'
import loginMutation from '@hylo/graphql/mutations/loginMutation'
import logoutMutation from '@hylo/graphql/mutations/logoutMutation'

/*

Hylo Authentication and Authorization state reflected in terms of "Signup State"

  *Authentication*: We know who you are (you've validated your email)
  *Authorization*: You are allowed to access things

  useAuth()         The preferred access to auth state in components
  useAuthStore()    Use when needing POJS access to auth state (i.e. useAuthStore.getState())

*/

export const useAuthStore = create((set) => ({
  isAuthenticated: false,
  isAuthorized: false,
  setIsAuthenticated: isAuthenticated => set({ isAuthenticated }),
  setIsAuthorized: isAuthorized => set({ isAuthorized })
}))

const AuthContext = createContext(null)

export function AuthProvider ({ children }) {
  const { setIsAuthenticated, setIsAuthorized } = useAuthStore()
  const [{ data, fetching, error }, checkAuth] = useQuery({
    requestPolicy: 'cache-and-network',
    query: meCheckAuthQuery
  })
  const [, executeLogin] = useMutation(loginMutation)
  const [, executeLogout] = useMutation(logoutMutation)

  const currentUser = data?.me
  const isAuthenticated = !!currentUser
  const isAuthorized = !!(isAuthenticated &&
    currentUser?.emailValidated &&
    currentUser?.hasRegistered &&
    !currentUser?.settings?.signupInProgress)

  useEffect(() => {
    setIsAuthenticated(isAuthenticated)
    setIsAuthorized(isAuthorized)
  }, [isAuthenticated, isAuthorized])

  // **Login function**
  const login = useCallback(async ({ email, password }) => {
    const { data } = await executeLogin({ email, password })
    if (data?.login?.error) throw new Error(data.login.error)
    // Refresh auth state
    await checkAuth()
  }, [executeLogin, checkAuth])

  // **Logout function**
  const logout = useCallback(async () => {
    await executeLogout()
    // Refresh auth state
    await checkAuth()
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
