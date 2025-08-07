import Constants from 'expo-constants'
import { once } from 'lodash'
import { version } from '../package.json'

export const environment = process.env.NODE_ENV || 'development'
export const isTest = environment === 'test'
export const isDev = environment === 'development'
export const isProduction = environment === 'production'

// Get environment variables from Expo's extra config
const extra = Constants.expoConfig?.extra || {}
export const onStagingAPI = extra.apiHost?.includes('staging') || false

export const sentryConfig = {
  dsn: isDev && extra.sentryDevDsn
    ? extra.sentryDevDsn
    : extra.sentryDsn,
  enabled: isProduction || (isDev && !!extra.sentryDevDsn),
  release: `hyloreactnative@${version}`,
  environment: isDev || isTest
    ? 'local'
    : onStagingAPI
      ? 'staging'
      : 'production'
}

export const filestackKey = extra.filestackApiKey || extra.filepickerApiKey
export const logLevel = extra.logLevel
export const socketHost = extra.socketHost
export const host = extra.host
export const slack = {
  clientId: extra.slackAppClientId
}
export const s3 = {
  bucket: extra.awsS3Bucket,
  host: extra.awsS3Host
}
export const google = {
  key: extra.googleBrowserKey,
  clientId: extra.googleClientId
}
export const facebook = {
  appId: extra.facebookAppId
}
export const segment = {
  writeKey: extra.segmentKey
}
export const intercom = {
  appId: extra.intercomAppId
}
export const mixpanel = {
  token: extra.mixpanelToken
}
export const mapbox = {
  token: extra.mapboxToken
}

export const featureFlags = () => {
  if (!isTest) {
    return once(() => {
      // Extract feature flags from extra config
      const flags = {}
      Object.keys(extra).forEach(key => {
        if (key.startsWith('featureFlag')) {
          flags[key.replace('featureFlag', '')] = extra[key]
        }
      })
      return flags
    })()
  } else {
    return window.FEATURE_FLAGS || {}
  }
}

const config = {
  environment,
  filestackKey,
  logLevel,
  host,
  slack,
  s3,
  google,
  facebook,
  segment,
  featureFlags,
  intercom,
  mixpanel,
  mapbox
}

if (!isTest) window.__appConfig = config

export default config 