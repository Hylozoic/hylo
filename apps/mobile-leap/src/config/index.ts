import Constants from 'expo-constants'

const extra = Constants.expoConfig?.extra ?? {}

export const API_HOST = (extra.API_HOST as string) ?? 'http://localhost:3001'
export const HYLO_WEB_BASE_URL = (extra.HYLO_WEB_BASE_URL as string) ?? 'http://localhost:3000'
export const SESSION_COOKIE_KEY = (extra.SESSION_COOKIE_KEY as string) ?? 'hylo_session_cookie'
export const AUTH_DEBUG = extra.AUTH_DEBUG === 'true' || extra.AUTH_DEBUG === true
export const IOS_GOOGLE_CLIENT_ID = (extra.IOS_GOOGLE_CLIENT_ID as string) ?? ''
export const WEB_GOOGLE_CLIENT_ID = (extra.WEB_GOOGLE_CLIENT_ID as string) ?? ''
export const ONESIGNAL_APP_ID = (extra.ONESIGNAL_APP_ID as string) ?? ''
export const SENTRY_DSN_URL = (extra.SENTRY_DSN_URL as string) ?? ''
export const SENTRY_DEV_DSN_URL = (extra.SENTRY_DEV_DSN_URL as string) ?? ''
export const INTERCOM_APP_ID = (extra.INTERCOM_APP_ID as string) ?? ''
export const INTERCOM_IOS_API_KEY = (extra.INTERCOM_IOS_API_KEY as string) ?? ''
export const INTERCOM_ANDROID_API_KEY = (extra.INTERCOM_ANDROID_API_KEY as string) ?? ''
export const MIXPANEL_TOKEN = (extra.MIXPANEL_TOKEN as string) ?? ''
export const MAPBOX_TOKEN = (extra.MAPBOX_TOKEN as string) ?? ''
