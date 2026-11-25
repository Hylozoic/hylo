import featureFlag, { HYLO_PRO, hasFeature, isHyloProEnabled } from 'config/featureFlags'

describe('feature flags', () => {
  const ENV_KEYS = [
    'NODE_ENV',
    'VITE_SENTRY_ENV',
    'VITE_FEATURE_FLAG_HYLO_PRO',
    'FEATURE_FLAG_HYLO_PRO',
    'VITE_FEATURE_FLAG_SOMETHING_ELSE',
    'FEATURE_FLAG_SOMETHING_ELSE'
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

  describe('hasFeature', () => {
    it('turns Hylo Pro on outside production and off in production unless turned on', () => {
      setEnv({ NODE_ENV: 'test' })
      expect(hasFeature(HYLO_PRO)).toBe(true)
      setEnv({ NODE_ENV: 'development' })
      expect(hasFeature(HYLO_PRO)).toBe(true)
      setEnv({ NODE_ENV: 'production', VITE_SENTRY_ENV: 'staging' })
      expect(hasFeature(HYLO_PRO)).toBe(true)
      setEnv({ NODE_ENV: 'production' })
      expect(featureFlag(HYLO_PRO)).toBeUndefined()
      expect(hasFeature(HYLO_PRO)).toBe(false)
      setEnv({ NODE_ENV: 'production', VITE_SENTRY_ENV: 'production' })
      expect(hasFeature(HYLO_PRO)).toBe(false)
    })

    it('follows VITE_FEATURE_FLAG_ (and FEATURE_FLAG_ in tests) in any environment', () => {
      setEnv({ NODE_ENV: 'production', VITE_FEATURE_FLAG_HYLO_PRO: 'on' })
      expect(hasFeature(HYLO_PRO)).toBe(true)
      setEnv({ NODE_ENV: 'test', VITE_FEATURE_FLAG_HYLO_PRO: 'off' })
      expect(hasFeature(HYLO_PRO)).toBe(false)
      setEnv({ NODE_ENV: 'test', FEATURE_FLAG_HYLO_PRO: 'off' })
      expect(hasFeature(HYLO_PRO)).toBe(false)
    })

    it('leaves other flags off unless they are turned on', () => {
      setEnv({ NODE_ENV: 'development' })
      expect(hasFeature('SOMETHING_ELSE')).toBe(false)
      setEnv({ NODE_ENV: 'production', VITE_FEATURE_FLAG_SOMETHING_ELSE: 'on' })
      expect(hasFeature('SOMETHING_ELSE')).toBe(true)
    })

    it("turns a 'testing' flag on only for testers", () => {
      setEnv({ NODE_ENV: 'production', VITE_FEATURE_FLAG_SOMETHING_ELSE: 'testing' })
      expect(hasFeature('SOMETHING_ELSE')).toBe(false)
      expect(hasFeature('SOMETHING_ELSE', true)).toBe(true)
    })

    it('needs a key', () => {
      expect(() => hasFeature()).toThrow()
    })
  })

  describe('isHyloProEnabled', () => {
    it('follows the flag for people who are not Hylo staff', () => {
      setEnv({ NODE_ENV: 'test', VITE_FEATURE_FLAG_HYLO_PRO: 'on' })
      expect(isHyloProEnabled({ isAdmin: false })).toBe(true)
      setEnv({ NODE_ENV: 'test', VITE_FEATURE_FLAG_HYLO_PRO: 'off' })
      expect(isHyloProEnabled({ isAdmin: false })).toBe(false)
      expect(isHyloProEnabled({})).toBe(false)
      expect(isHyloProEnabled(null)).toBe(false)
    })

    it('is on for Hylo staff even when the flag is off', () => {
      setEnv({ NODE_ENV: 'production', VITE_FEATURE_FLAG_HYLO_PRO: 'off' })
      expect(isHyloProEnabled({ isAdmin: true })).toBe(true)
    })
  })
})
