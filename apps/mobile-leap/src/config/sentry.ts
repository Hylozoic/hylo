import Constants from 'expo-constants'
import { API_HOST } from './index'

const extra = Constants.expoConfig?.extra ?? {}
const version = Constants.expoConfig?.version ?? '1.0.0'
const buildNumber = extra.BITRISE_BUILD_NUMBER as string | undefined

export const isDev = __DEV__
export const onStagingAPI = String(API_HOST).includes('staging')

const dsn = isDev && extra.SENTRY_DEV_DSN_URL
  ? (extra.SENTRY_DEV_DSN_URL as string)
  : (extra.SENTRY_DSN_URL as string | undefined)

export const sentryConfig = {
  dsn,
  enabled: !!dsn,
  release: `hyloleap@${version}${buildNumber ? `+${buildNumber}` : ''}`,
  environment: isDev
    ? 'local'
    : onStagingAPI
      ? 'staging'
      : 'production'
}
