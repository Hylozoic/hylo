import Config from 'react-native-config'
import { once } from 'lodash'
import { version } from '../package.json'

export const environment = process.env.NODE_ENV || 'development'
export const isTest = environment === 'test'
export const isDev = environment === 'development'
export const isProduction = environment === 'production'
export const onStagingAPI = Config.API_HOST.includes('staging')

export const sentryConfig = {
  dsn: isDev && Config.SENTRY_DEV_DSN_URL
    ? Config.SENTRY_DEV_DSN_URL
    : Config.SENTRY_DSN_URL,
  enabled: isProduction || (isDev && !!Config.SENTRY_DEV_DSN_URL),
  release: `hyloreactnative@${version}${Config.BITRISE_BUILD_NUMBER ? '+' + Config.BITRISE_BUILD_NUMBER : ''}`,
  environment: isDev || isTest
    ? 'local'
    : onStagingAPI
      ? 'staging'
      : 'production'
}

export const filestackKey = Config.FILESTACK_API_KEY || Config.FILEPICKER_API_KEY
export const logLevel = Config.LOG_LEVEL
export const socketHost = Config.SOCKET_HOST
export const host = Config.HOST
export const slack = {
  clientId: Config.SLACK_APP_CLIENT_ID
}
export const s3 = {
  bucket: Config.AWS_S3_BUCKET,
  host: Config.AWS_S3_HOST
}
export const google = {
  key: Config.GOOGLE_BROWSER_KEY,
  clientId: Config.GOOGLE_CLIENT_ID
}
export const facebook = {
  appId: Config.FACEBOOK_APP_ID
}
export const segment = {
  writeKey: Config.SEGMENT_KEY
}
export const intercom = {
  appId: Config.INTERCOM_APP_ID
}
export const mixpanel = {
  token: Config.MIXPANEL_TOKEN
}
export const mapbox = {
  token: Config.MAPBOX_TOKEN
}

export const featureFlags = () => {
  if (!isTest) {
    return once(() =>
      Object.keys(Config).reduce((flags, key) => {
        if (key.startsWith('FEATURE_FLAG_')) {
          flags[key.replace('FEATURE_FLAG_', '')] = Config[key]
        }
        return flags
      }, {}))()
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
