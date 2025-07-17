import { v4 as uuidv4 } from 'uuid'
import isWebView from 'util/webView'

const COOKIE_NAME = 'hylo_cookie_consent'

/**
 * Check if the current environment should skip cookie consent checks
 * (iframe or mobile webView)
 */
export const shouldSkipCookieConsent = () => {
  // Skip for iframe
  if (window.self !== window.top) return true

  // Skip for mobile webView
  if (isWebView()) return true

  return false
}

/**
 * Get cookie consent data from browser
 */
export const getCookieConsent = () => {
  try {
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${COOKIE_NAME}=`))

    if (!cookie) {
      return null
    }

    const cookieValue = cookie.split('=')[1]
    const decodedValue = decodeURIComponent(cookieValue)
    return JSON.parse(decodedValue)
  } catch (error) {
    console.warn('Error parsing cookie consent:', error)
    return null
  }
}

/**
 * Set cookie consent data in browser
 */
export const setCookieConsent = (consentData) => {
  try {
    const cookieValue = JSON.stringify(consentData)
    const encodedValue = encodeURIComponent(cookieValue)

    // Set cookie with appropriate attributes
    document.cookie = `${COOKIE_NAME}=${encodedValue}; path=/; max-age=31536000; SameSite=Lax`

    return true
  } catch (error) {
    console.error('Error setting cookie consent:', error)
    return false
  }
}

/**
 * Create cookie consent data structure
 */
export const createCookieConsentData = (settings, isLinkedToUser = false, userId = null) => {
  return {
    id: uuidv4(),
    analytics: settings.analytics || false,
    support: settings.support || false,
    isLinkedToUser,
    userId,
    lastUpdated: new Date().toISOString()
  }
}

/**
 * Validate cookie consent data structure
 */
export const validateCookieConsent = (data) => {
  if (!data || typeof data !== 'object') {
    return false
  }

  const requiredFields = ['id', 'analytics', 'support', 'isLinkedToUser', 'lastUpdated']
  const hasAllFields = requiredFields.every(field => field in data)

  if (!hasAllFields) {
    return false
  }

  // Validate field types
  if (typeof data.id !== 'string' ||
      typeof data.analytics !== 'boolean' ||
      typeof data.support !== 'boolean' ||
      typeof data.isLinkedToUser !== 'boolean' ||
      typeof data.lastUpdated !== 'string') {
    return false
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(data.id)) {
    return false
  }

  // Validate ISO date format
  const date = new Date(data.lastUpdated)
  if (isNaN(date.getTime())) {
    return false
  }

  return true
}

/**
 * Sync cookie consent with backend API
 */
export const syncCookieConsentWithBackend = async (consentData, userId = null) => {
  try {
    const payload = {
      consent_id: consentData.id,
      settings: {
        analytics: consentData.analytics,
        support: consentData.support
      },
      version: '1.0',
      user_agent: navigator.userAgent
    }

    // Add user_id if provided
    if (userId) {
      payload.user_id = userId
    }

    const response = await fetch('/noo/cookie-consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    return result.success
  } catch (error) {
    console.error('Error syncing cookie consent with backend:', error)
    return false
  }
}

/**
 * Check if database record is more recent than cookie
 */
export const isDatabaseRecordMoreRecent = (cookieData, dbData) => {
  if (!cookieData || !dbData) {
    return false
  }

  const cookieDate = new Date(cookieData.lastUpdated)
  const dbDate = new Date(dbData.updatedAt)

  return dbDate > cookieDate
}

/**
 * Update cookie from database record
 */
export const updateCookieFromDatabase = (dbData, isLinkedToUser = true) => {
  const cookieData = createCookieConsentData({
    analytics: dbData.settings?.analytics || false,
    support: dbData.settings?.support || false
  }, isLinkedToUser, dbData.userId)

  // Use database record's ID and timestamp
  cookieData.id = dbData.id
  cookieData.lastUpdated = dbData.updatedAt

  return setCookieConsent(cookieData)
}

/**
 * Link existing cookie consent to a user
 * This is called when a user logs in and we need to associate their anonymous cookie consent
 */
export const linkCookieConsentToUser = async (userId) => {
  try {
    const existingCookie = getCookieConsent()

    if (!existingCookie || existingCookie.isLinkedToUser) {
      return false
    }

    // Update the cookie to be linked to user
    const updatedCookie = {
      ...existingCookie,
      isLinkedToUser: true,
      userId,
      lastUpdated: new Date().toISOString()
    }

    // Set updated cookie
    const cookieSuccess = setCookieConsent(updatedCookie)
    if (!cookieSuccess) {
      throw new Error('Failed to update cookie')
    }

    // Sync with backend
    const syncSuccess = await syncCookieConsentWithBackend(updatedCookie, userId)
    if (!syncSuccess) {
      throw new Error('Failed to sync with backend')
    }

    return true
  } catch (error) {
    console.error('Error linking cookie consent to user:', error)
    return false
  }
}
