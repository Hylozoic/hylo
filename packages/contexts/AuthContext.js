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

export function AuthProvider ({ children, authAdapter }) {
  const { setIsAuthenticated, setIsAuthorized } = useAuthStore()
  // network-only is required here (not cache-and-network):
  // After social login (Google/Apple), the urql cache still holds {me: null} from
  // the pre-login unauthenticated state. cache-and-network would return that stale
  // null first, causing isAuthorized=false and leaving the app stuck on the loading
  // screen. network-only skips the cache and returns only the fresh server response,
  // giving a single clean false→true transition after any login.
  // RootNavigator's hasCompletedInitialAuthFetch guard prevents NavigationContainer
  // from unmounting on background network-only refetches.
  const [{ data, fetching, error }, checkAuth] = useQuery({
    requestPolicy: 'network-only',
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
  // When an authAdapter is provided (mobile token auth) the login mechanism is
  // delegated to it; otherwise we use the default cookie-session login mutation
  // (web/desktop). Either way we refresh auth state afterwards.
  const login = useCallback(async ({ email, password }) => {
    if (authAdapter?.login) {
      await authAdapter.login({ email, password })
    } else {
      const { data } = await executeLogin({ email, password })
      if (data?.login?.error) throw new Error(data.login.error)
    }
    // Refresh auth state
    await checkAuth()
  }, [authAdapter, executeLogin, checkAuth])

  // **Logout function**
  // Always tear down the server session, then let the adapter revoke/clear any
  // native tokens. Both are safe no-ops when not applicable, so cookie and token
  // sessions are cleaned up regardless of how the user logged in.
  const logout = useCallback(async () => {
    await executeLogout()
    try {
      await authAdapter?.logout?.()
    } catch (err) {
      console.warn('authAdapter.logout failed:', err)
    }
    // Refresh auth state
    await checkAuth()
  }, [authAdapter, executeLogout, checkAuth])

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
