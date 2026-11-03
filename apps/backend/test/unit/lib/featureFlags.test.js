import { expect } from 'chai'
import { isFeatureEnabled, MEMBER_INVITES } from '../../../lib/featureFlags'

describe('isFeatureEnabled', () => {
  const ENV_KEYS = ['FEATURE_FLAG_MEMBER_INVITES', 'FEATURE_FLAG_SOMETHING_ELSE', 'SENTRY_ENV', 'NODE_ENV']
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

  it('turns member invitations on by default in development, test and staging', () => {
    for (const NODE_ENV of ['development', 'test']) {
      setEnv({ NODE_ENV })
      expect(isFeatureEnabled(MEMBER_INVITES)).to.equal(true)
    }
    setEnv({ NODE_ENV: 'production', SENTRY_ENV: 'staging' })
    expect(isFeatureEnabled(MEMBER_INVITES)).to.equal(true)
  })

  it('turns member invitations off by default in production and in unknown environments', () => {
    setEnv({ NODE_ENV: 'production' })
    expect(isFeatureEnabled(MEMBER_INVITES)).to.equal(false)
    setEnv({ NODE_ENV: 'development', SENTRY_ENV: 'production' })
    expect(isFeatureEnabled(MEMBER_INVITES)).to.equal(false)
    setEnv({ NODE_ENV: 'production', SENTRY_ENV: 'reviewApp' })
    expect(isFeatureEnabled(MEMBER_INVITES)).to.equal(false)
    setEnv({})
    expect(isFeatureEnabled(MEMBER_INVITES)).to.equal(false)
  })

  it('follows an explicit on or off in any environment', () => {
    setEnv({ NODE_ENV: 'production', FEATURE_FLAG_MEMBER_INVITES: 'on' })
    expect(isFeatureEnabled(MEMBER_INVITES)).to.equal(true)
    setEnv({ NODE_ENV: 'production', FEATURE_FLAG_MEMBER_INVITES: ' TRUE ' })
    expect(isFeatureEnabled(MEMBER_INVITES)).to.equal(true)
    setEnv({ NODE_ENV: 'test', FEATURE_FLAG_MEMBER_INVITES: 'off' })
    expect(isFeatureEnabled(MEMBER_INVITES)).to.equal(false)
    setEnv({ NODE_ENV: 'development', FEATURE_FLAG_MEMBER_INVITES: 'false' })
    expect(isFeatureEnabled(MEMBER_INVITES)).to.equal(false)
  })

  it('keeps other flags off unless they are turned on', () => {
    setEnv({ NODE_ENV: 'development' })
    expect(isFeatureEnabled('SOMETHING_ELSE')).to.equal(false)
    setEnv({ NODE_ENV: 'production', FEATURE_FLAG_SOMETHING_ELSE: 'on' })
    expect(isFeatureEnabled('SOMETHING_ELSE')).to.equal(true)
  })
})
