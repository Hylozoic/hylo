import isMobile from 'ismobilejs'

export const APP_STORE_APP_ID = '1002185140'
export const APP_STORE_APP_URL = `https://apps.apple.com/us/app/hylo/id${APP_STORE_APP_ID}`
export const ANDROID_APP_PACKAGE = 'com.hylo.hyloandroid'
export const GOOGLE_PLAY_APP_URL = `https://play.google.com/store/apps/details?id=${ANDROID_APP_PACKAGE}`

// Hosts the Android app opens links for (its intent filters); hylo.com itself isn't one yet
const ANDROID_APP_LINK_HOSTS = ['www.hylo.com', 'staging.hylo.com']

/**
 * An Android intent URL that opens this page in the Hylo app, or the Play Store
 * listing when the app isn't installed. Returns null for hosts the app doesn't handle.
 */
export function androidIntentUrl (href) {
  let url
  try {
    url = new URL(href)
  } catch (e) {
    return null
  }
  const host = url.host === 'hylo.com' ? 'www.hylo.com' : url.host
  if (!ANDROID_APP_LINK_HOSTS.includes(host)) return null
  const fallback = encodeURIComponent(GOOGLE_PLAY_APP_URL)
  return `intent://${host}${url.pathname}${url.search}#Intent;scheme=https;package=${ANDROID_APP_PACKAGE};S.browser_fallback_url=${fallback};end`
}

/** An Android browser, not an app's embedded WebView (those add "; wv)" to the user agent). */
export function isAndroidBrowser (userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  return /Android/i.test(userAgent || '') && !/;\s*wv\)/i.test(userAgent || '')
}

export function mobileRedirect () {
  if (isMobileDevice()) {
    if (isMobile.apple.device) {
      return APP_STORE_APP_URL
    } else if (isMobile.android.device) {
      return GOOGLE_PLAY_APP_URL
    }
  }
}

// This I believe could just be an exportable constant
// leaving as function for now
export function isMobileDevice () {
  return (
    isMobile.apple.phone ||
    isMobile.apple.ipod ||
    isMobile.apple.tablet ||
    isMobile.android.phone ||
    isMobile.android.tablet ||
    isMobile.seven_inch ||
    // iPadOS 13+ sends a desktop user agent, so ismobilejs can't detect it.
    // Fall back to checking for a touch-capable Mac (i.e. an iPad).
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

// Phones only — excludes tablets and iPadOS desktop UA (see isMobileDevice).
// Use for layouts that need a side-by-side nav + content column (e.g. DMs).
export function isPhoneDevice () {
  return (
    isMobile.apple.phone ||
    isMobile.apple.ipod ||
    isMobile.android.phone ||
    isMobile.seven_inch
  )
}

// Tablets and iPadOS (desktop UA) — excludes phones.
export function isTabletDevice () {
  return (
    isMobile.apple.tablet ||
    isMobile.android.tablet ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

// Phone-style compact layout: single-column content, drawer nav, smaller typography.
// Tablets need this even when the viewport is >= Tailwind's sm breakpoint (640px).
export function isCompactLayoutDevice () {
  return isPhoneDevice() || isTabletDevice()
}

// Slide-out nav drawer: phones and narrow desktop windows (not tablets).
export function isDrawerNavLayout (viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0) {
  return isPhoneDevice() || viewportWidth < 640
}

export function downloadApp () {
  if (isMobileDevice()) {
    if (isMobile.apple.device) {
      window.open(APP_STORE_APP_URL, '_blank')
    } else if (isMobile.android.device) {
      window.open(GOOGLE_PLAY_APP_URL, '_blank')
    } else {
      return false
    }
  }
}
