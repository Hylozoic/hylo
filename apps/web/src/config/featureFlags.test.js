import featureFlag, { MEMBER_INVITES, PROJECT_CONTRIBUTIONS } from 'config/featureFlags'
import { hasFeature } from 'store/models/Me'

describe('featureFlag', () => {
  const ENV_KEYS = [
    'NODE_ENV',
    'VITE_SENTRY_ENV',
    'VITE_FEATURE_FLAG_MEMBER_INVITES',
    'FEATURE_FLAG_MEMBER_INVITES',
    'VITE_FEATURE_FLAG_PROJECT_CONTRIBUTIONS',
    'FEATURE_FLAG_PROJECT_CONTRIBUTIONS'
  ]
  let saved

  function setEnv (values) {
    ENV_KEYS.forEach(key => {
      if (values[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = values[key]
      }
    })
  }

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]))
  })

  afterEach(() => setEnv(saved))

  it('turns member invitations on in development, test and staging builds', () => {
    setEnv({ NODE_ENV: 'test' })
    expect(hasFeature(MEMBER_INVITES)).toBe(true)
    setEnv({ NODE_ENV: 'development' })
    expect(hasFeature(MEMBER_INVITES)).toBe(true)
    setEnv({ NODE_ENV: 'production', VITE_SENTRY_ENV: 'staging' })
    expect(hasFeature(MEMBER_INVITES)).toBe(true)
  })

  it('turns member invitations off in production builds', () => {
    setEnv({ NODE_ENV: 'production' })
    expect(featureFlag(MEMBER_INVITES)).toBeUndefined()
    expect(hasFeature(MEMBER_INVITES)).toBe(false)
    setEnv({ NODE_ENV: 'production', VITE_SENTRY_ENV: 'production' })
    expect(hasFeature(MEMBER_INVITES)).toBe(false)
  })

  it('follows VITE_FEATURE_FLAG_ in any environment', () => {
    setEnv({ NODE_ENV: 'production', VITE_FEATURE_FLAG_MEMBER_INVITES: 'on' })
    expect(hasFeature(MEMBER_INVITES)).toBe(true)
    setEnv({ NODE_ENV: 'test', VITE_FEATURE_FLAG_MEMBER_INVITES: 'off' })
    expect(hasFeature(MEMBER_INVITES)).toBe(false)
    setEnv({ NODE_ENV: 'test', FEATURE_FLAG_MEMBER_INVITES: 'off' })
    expect(hasFeature(MEMBER_INVITES)).toBe(false)
  })

  it('leaves other flags off unless they are turned on', () => {
    setEnv({ NODE_ENV: 'development' })
    expect(hasFeature(PROJECT_CONTRIBUTIONS)).toBe(false)
    setEnv({ NODE_ENV: 'production', VITE_FEATURE_FLAG_PROJECT_CONTRIBUTIONS: 'on' })
    expect(hasFeature(PROJECT_CONTRIBUTIONS)).toBe(true)
  })
})
