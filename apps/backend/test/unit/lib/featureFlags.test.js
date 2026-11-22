import { expect } from 'chai'
import { isFeatureEnabled } from '../../../lib/featureFlags'

describe('isFeatureEnabled', () => {
  const ENV_KEYS = ['FEATURE_FLAG_SOMETHING_ELSE', 'SENTRY_ENV', 'NODE_ENV']
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

  it('keeps a flag that is not turned on off in every environment', () => {
    for (const NODE_ENV of ['development', 'test', 'production']) {
      setEnv({ NODE_ENV })
      expect(isFeatureEnabled('SOMETHING_ELSE')).to.equal(false)
    }
    setEnv({ NODE_ENV: 'production', SENTRY_ENV: 'staging' })
    expect(isFeatureEnabled('SOMETHING_ELSE')).to.equal(false)
  })

  it('follows an explicit on or off in any environment', () => {
    setEnv({ NODE_ENV: 'production', FEATURE_FLAG_SOMETHING_ELSE: 'on' })
    expect(isFeatureEnabled('SOMETHING_ELSE')).to.equal(true)
    setEnv({ NODE_ENV: 'production', FEATURE_FLAG_SOMETHING_ELSE: ' TRUE ' })
    expect(isFeatureEnabled('SOMETHING_ELSE')).to.equal(true)
    setEnv({ NODE_ENV: 'test', FEATURE_FLAG_SOMETHING_ELSE: 'off' })
    expect(isFeatureEnabled('SOMETHING_ELSE')).to.equal(false)
    setEnv({ NODE_ENV: 'development', FEATURE_FLAG_SOMETHING_ELSE: 'false' })
    expect(isFeatureEnabled('SOMETHING_ELSE')).to.equal(false)
  })
})
