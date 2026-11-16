import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { useCurrentUser } from 'hooks/useCurrentUser'
import { getAuthSessionStatus } from 'store/selectors/getAuthSession'
import { AuthSessionStatus } from 'store/reducers/authSession'
import {
  shouldSkipCookieConsent,
  getCookieConsent,
  setCookieConsent,
  validateCookieConsent,
  syncCookieConsentWithBackend,
  updateCookieFromDatabase,
  createCookieConsentData,
  linkCookieConsentToUser
} from 'util/cookieConsent'

const CookieConsentContext = createContext()

export const useCookieConsent = () => {
  const context = useContext(CookieConsentContext)
  if (!context) {
    throw new Error('useCookieConsent must be used within a CookieConsentProvider')
  }
  return context
}

export const CookieConsentProvider = ({ children }) => {
  const [cookieData, setCookieData] = useState(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [showPreferencesPanel, setShowPreferencesPanel] = useState(false)

  // Get current user from Redux store
  const currentUser = useCurrentUser()
  const authStatus = useSelector(getAuthSessionStatus)
  const isLoggedIn = !!currentUser || authStatus === AuthSessionStatus.Authenticated

  /**
   * Initialize cookie consent check.
   * A previous accept/reject stored on the account hides the banner after login,
   * even when this browser has no consent cookie yet.
   */
  const initializeCookieConsent = useCallback(async () => {
    // Skip if in iframe or mobile webView
    if (shouldSkipCookieConsent()) {
      setIsInitialized(true)
      return
    }

    try {
      // Check for existing cookie
      const existingCookie = getCookieConsent()

      if (existingCookie && validateCookieConsent(existingCookie)) {
        // Valid cookie exists. A choice was already made in this browser
        setCookieData(existingCookie)
        setShowPreferencesPanel(false)
        setIsInitialized(true)
        return
      }

      // No valid cookie found
      if (isLoggedIn) {
        const userPreferences = currentUser?.cookieConsentPreferences

        // Login/session payload has not included consent yet. Keep the banner
        // as-is until we know whether this account already chose.
        if (userPreferences === undefined) {
          setIsInitialized(true)
          return
        }

        if (userPreferences) {
          const success = updateCookieFromDatabase(userPreferences, true)
          if (success) {
            setCookieData(getCookieConsent())
            setShowPreferencesPanel(false)
            setIsInitialized(true)
            return
          }
        }

        // Logged in and the account has no saved choice
        setShowPreferencesPanel(true)
      } else if (authStatus === AuthSessionStatus.Unknown) {
        // Session check still in flight. Don't flash the banner for someone
        // who is about to be recognized as logged in.
      } else {
        // Confirmed logged out, show preferences panel
        setShowPreferencesPanel(true)
      }

      setIsInitialized(true)
    } catch (error) {
      console.error('Error initializing cookie consent:', error)
      setIsInitialized(true)
    }
  }, [isLoggedIn, currentUser?.cookieConsentPreferences, authStatus])

  /**
   * Update cookie consent preferences
   */
  const updateCookieConsent = useCallback(async (settings) => {
    try {
      const newCookieData = createCookieConsentData(
        settings,
        isLoggedIn,
        isLoggedIn ? currentUser?.id : null
      )

      // Set cookie in browser
      const success = setCookieConsent(newCookieData)
      if (!success) {
        throw new Error('Failed to set cookie')
      }

      // Update state
      setCookieData(newCookieData)
      setShowPreferencesPanel(false)

      // Sync with backend
      await syncCookieConsentWithBackend(newCookieData, isLoggedIn ? currentUser?.id : null)

      return true
    } catch (error) {
      console.error('Error updating cookie consent:', error)
      return false
    }
  }, [isLoggedIn, currentUser?.id])

  /**
   * Link existing cookie consent to user when they log in
   */
  const linkConsentToUser = useCallback(async (userId) => {
    try {
      const success = await linkCookieConsentToUser(userId)
      if (success) {
        // Update state with linked cookie
        setCookieData(getCookieConsent())
      }
      return success
    } catch (error) {
      console.error('Error linking consent to user:', error)
      return false
    }
  }, [])

  /**
   * Check if user has given consent for analytics
   */
  const hasAnalyticsConsent = useCallback(() => {
    return cookieData?.analytics === true
  }, [cookieData])

  /**
   * Check if user has given consent for support cookies
   */
  const hasSupportConsent = useCallback(() => {
    return cookieData?.support === true
  }, [cookieData])

  /**
   * Get current consent data
   */
  const getConsentData = useCallback(() => {
    return cookieData
  }, [cookieData])

  /**
   * Show preferences panel
   */
  const showPreferences = useCallback(() => {
    setShowPreferencesPanel(true)
  }, [])

  /**
   * Hide preferences panel
   */
  const hidePreferences = useCallback(() => {
    setShowPreferencesPanel(false)
  }, [])

  // Initialize on mount and again when login or saved account consent changes.
  // initializeCookieConsent already depends on those values.
  useEffect(() => {
    initializeCookieConsent()
  }, [initializeCookieConsent])

  const value = {
    cookieData,
    isInitialized,
    showPreferencesPanel,
    hasAnalyticsConsent,
    hasSupportConsent,
    getConsentData,
    updateCookieConsent,
    linkConsentToUser,
    showPreferences,
    hidePreferences
  }

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  )
}
