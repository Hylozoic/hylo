import { existsSync } from 'fs'
import path from 'path'
import { ExpoConfig, ConfigContext } from 'expo/config'

const projectRoot = __dirname

const API_HOST = process.env.API_HOST ?? 'http://localhost:3001'
const HYLO_WEB_BASE_URL = process.env.HYLO_WEB_BASE_URL ?? 'http://localhost:3000'
const SESSION_COOKIE_KEY = process.env.SESSION_COOKIE_KEY ?? 'hylo_session_cookie'
const AUTH_DEBUG = process.env.AUTH_DEBUG ?? 'false'
const IOS_GOOGLE_CLIENT_ID = process.env.IOS_GOOGLE_CLIENT_ID ?? ''
const WEB_GOOGLE_CLIENT_ID = process.env.WEB_GOOGLE_CLIENT_ID ?? ''
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID ?? ''
const ONESIGNAL_APN_MODE = process.env.ONESIGNAL_APN_MODE === 'production' ? 'production' : 'development'
const SENTRY_DSN_URL = process.env.SENTRY_DSN_URL ?? ''
const SENTRY_DEV_DSN_URL = process.env.SENTRY_DEV_DSN_URL ?? ''
const INTERCOM_APP_ID = process.env.INTERCOM_APP_ID ?? ''
const INTERCOM_IOS_API_KEY = process.env.INTERCOM_IOS_API_KEY ?? ''
const INTERCOM_ANDROID_API_KEY = process.env.INTERCOM_ANDROID_API_KEY ?? ''
const MIXPANEL_TOKEN = process.env.MIXPANEL_TOKEN ?? ''
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN ?? ''
// Same identifiers as the legacy apps/mobile app — leap replaces it in the same store listings
const IOS_BUNDLE_ID = 'com.hylo.HyloA'
// CI (Bitrise) injects a monotonically increasing build number; EAS uses autoIncrement instead.
const BUILD_NUMBER = process.env.BITRISE_BUILD_NUMBER ?? process.env.BUILD_NUMBER ?? ''

function getIosUrlScheme (iosGoogleClientId: string): string | undefined {
  const match = iosGoogleClientId.match(/^([\w-]+)\.apps\.googleusercontent\.com$/)
  if (!match) return undefined
  return `com.googleusercontent.apps.${match[1]}`
}

const iosUrlScheme = getIosUrlScheme(IOS_GOOGLE_CLIENT_ID)

function buildPlugins (): NonNullable<ExpoConfig['plugins']> {
  const plugins: NonNullable<ExpoConfig['plugins']> = []

  if (INTERCOM_APP_ID && INTERCOM_IOS_API_KEY && INTERCOM_ANDROID_API_KEY) {
    plugins.push([
      '@intercom/intercom-react-native',
      {
        appId: INTERCOM_APP_ID,
        iosApiKey: INTERCOM_IOS_API_KEY,
        androidApiKey: INTERCOM_ANDROID_API_KEY
      }
    ])
  }

  if (ONESIGNAL_APP_ID) {
    plugins.push(['onesignal-expo-plugin', { mode: ONESIGNAL_APN_MODE }])
  }

  plugins.push(
    'expo-asset',
    'expo-apple-authentication',
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow Hylo to access your photos for profile pictures.',
        cameraPermission: 'Allow Hylo to use your camera for profile pictures.'
      }
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Allow Hylo to use your location to find nearby content.'
      }
    ],
    [
      'expo-build-properties',
      {
        ios: {
          extraPods: [
            { name: 'AppAuth', modular_headers: true },
            { name: 'GTMAppAuth', modular_headers: true },
            { name: 'GTMSessionFetcher', modular_headers: true },
            { name: 'GoogleUtilities', modular_headers: true },
            { name: 'RecaptchaInterop', modular_headers: true }
          ]
        },
        android: {
          // Play Console requires target API 36 (Android 16) as of 31 Aug 2026
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          buildToolsVersion: '36.0.0',
          usesCleartextTraffic: true
        }
      }
    ],
    iosUrlScheme
      ? ['@react-native-google-signin/google-signin', { iosUrlScheme }]
      : '@react-native-google-signin/google-signin'
  )

  // Local dev client only — omit on Bitrise release (smaller APK, correct launcher icon)
  if (process.env.USE_EXPO_DEV_CLIENT === 'true') {
    plugins.unshift('expo-dev-client')
  }

  if (process.env.SENTRY_ORG && process.env.SENTRY_PROJECT) {
    plugins.push([
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT
      }
    ])
  }

  return plugins
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Hylo',
  slug: 'hylo-mobile-leap',
  scheme: 'hyloapp',
  version: '7.0.0', // keep in lockstep with apps/mobile until cutover
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/merkaba_white.png',
    resizeMode: 'contain',
    backgroundColor: '#0DC39F'
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: IOS_BUNDLE_ID,
    ...(BUILD_NUMBER ? { buildNumber: BUILD_NUMBER } : {}),
    ...(process.env.APPLE_TEAM_ID ? { appleTeamId: process.env.APPLE_TEAM_ID } : {}),
    infoPlist: {
      // Same as legacy apps/mobile — only HTTPS via OS APIs; skip export compliance prompt on upload
      ITSAppUsesNonExemptEncryption: false,
      ...(ONESIGNAL_APP_ID ? { UIBackgroundModes: ['remote-notification'] } : {})
    },
    ...(ONESIGNAL_APP_ID
      ? {
          entitlements: {
            'aps-environment': ONESIGNAL_APN_MODE,
            'com.apple.security.application-groups': [`group.${IOS_BUNDLE_ID}.onesignal`]
          }
        }
      : {})
  },
  android: {
    // Legacy home-screen look: App Store icon (dark gray + white merkaba). Match background
    // to the icon plate — not merkaba-green-on-white (reads as a green blob when masked).
    adaptiveIcon: {
      foregroundImage: './assets/icon.png',
      backgroundColor: '#333333'
    },
    package: 'com.hylo.hyloandroid',
    ...(BUILD_NUMBER ? { versionCode: parseInt(BUILD_NUMBER, 10) } : {}),
    ...(existsSync(path.join(projectRoot, 'google-services.json'))
      ? { googleServicesFile: './google-services.json' }
      : {}),
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: 'www.hylo.com', pathPrefix: '/' },
          { scheme: 'https', host: 'staging.hylo.com', pathPrefix: '/' }
        ],
        category: ['BROWSABLE', 'DEFAULT']
      }
    ],
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'CAMERA'
    ]
  },
  plugins: buildPlugins(),
  extra: {
    API_HOST,
    HYLO_WEB_BASE_URL,
    SESSION_COOKIE_KEY,
    AUTH_DEBUG: AUTH_DEBUG === 'true',
    IOS_GOOGLE_CLIENT_ID,
    WEB_GOOGLE_CLIENT_ID,
    ONESIGNAL_APP_ID,
    SENTRY_DSN_URL,
    SENTRY_DEV_DSN_URL,
    INTERCOM_APP_ID,
    INTERCOM_IOS_API_KEY,
    INTERCOM_ANDROID_API_KEY,
    MIXPANEL_TOKEN,
    MAPBOX_TOKEN,
    eas: {
      projectId: process.env.EAS_PROJECT_ID
    }
  }
})
