import Constants from 'expo-constants'

// Get environment variables from Expo config
const config = Constants.expoConfig?.extra || {}

export const API_HOST = config.apiHost || 'https://hylo.com'
export const HYLO_WEB_BASE_URL = config.hyloWebBaseUrl || 'https://hylo.com'
export const IOS_GOOGLE_CLIENT_ID = config.iosGoogleClientId
export const WEB_GOOGLE_CLIENT_ID = config.webGoogleClientId
export const ONESIGNAL_APP_ID = config.oneSignalAppId

export default {
  API_HOST,
  HYLO_WEB_BASE_URL,
  IOS_GOOGLE_CLIENT_ID,
  WEB_GOOGLE_CLIENT_ID,
  ONESIGNAL_APP_ID
}