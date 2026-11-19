import {
  HYLO_PRO_FEATURES,
  HYLO_PRO_FEATURE_KEYS,
  HYLO_PRO_TIERS,
  featuresForTier,
  higherProTier,
  isProFeature,
  proFeatureOverrides,
  resolveProFeatures,
  tierIncludesProFeature,
  tierOfProFeature
} from './HyloProFeatures'

describe('HyloProFeatures', () => {
  it('registers every feature once, under a known tier, with a camelCase key', () => {
    expect(new Set(HYLO_PRO_FEATURE_KEYS).size).toBe(HYLO_PRO_FEATURES.length)
    for (const { key, tier } of HYLO_PRO_FEATURES) {
      expect(HYLO_PRO_TIERS).toContain(tier)
      expect(key).toMatch(/^[a-z][A-Za-z0-9]*$/)
    }
  })

  it('includes every lower tier in a higher one', () => {
    const pro = featuresForTier('pro')
    const proPlus = featuresForTier('pro_plus')
    const custom = featuresForTier('custom')
    expect(pro).toContain('groupThemes')
    expect(pro).not.toContain('recording')
    expect(proPlus).toEqual(expect.arrayContaining(pro))
    expect(proPlus).toContain('recording')
    expect(proPlus).not.toContain('singleSignOn')
    expect(custom).toEqual(expect.arrayContaining(proPlus))
    expect(custom).toEqual(HYLO_PRO_FEATURE_KEYS)
    expect(() => featuresForTier('gold')).toThrow('Unknown Hylo Pro tier: gold')
  })

  it('knows its features and fails loudly on a typo', () => {
    expect(isProFeature('designedViews')).toBe(true)
    expect(isProFeature('designedView')).toBe(false)
    expect(tierOfProFeature('federation')).toBe('custom')
    expect(() => tierOfProFeature('designedView')).toThrow('Unknown Hylo Pro feature: designedView')
    expect(tierIncludesProFeature('pro', 'designedViews')).toBe(true)
    expect(tierIncludesProFeature('pro', 'federation')).toBe(false)
  })

  it('orders tiers', () => {
    expect(higherProTier('pro', 'pro_plus')).toBe('pro_plus')
    expect(higherProTier('custom', 'pro')).toBe('custom')
    expect(higherProTier(null, 'pro')).toBe('pro')
    expect(higherProTier(null, null)).toBe(null)
  })

  describe('resolveProFeatures', () => {
    it('gives nothing without entitlements, with every key present', () => {
      const features = resolveProFeatures([])
      expect(Object.keys(features)).toEqual(HYLO_PRO_FEATURE_KEYS)
      expect(Object.values(features).every(value => value === false)).toBe(true)
    })

    it("gives a tier's bundle, with overrides adding and removing single features", () => {
      const features = resolveProFeatures([{ tier: 'pro', features: { recording: true, groupThemes: false } }])
      expect(features.designedViews).toBe(true)
      expect(features.recording).toBe(true)
      expect(features.groupThemes).toBe(false)
      expect(features.transcriptions).toBe(false)
    })

    it('unions several entitlements, so one row cannot take away what another gives', () => {
      const features = resolveProFeatures([
        { tier: 'pro', features: { groupThemes: false } },
        { tier: 'pro', features: null }
      ])
      expect(features.groupThemes).toBe(true)
    })

    it('ignores overrides for keys that are no longer registered', () => {
      const features = resolveProFeatures([{ tier: 'pro', features: { retiredFeature: true } }])
      expect(features).not.toHaveProperty('retiredFeature')
    })

    it('treats a missing tier as Pro', () => {
      expect(resolveProFeatures([{}]).designedViews).toBe(true)
    })
  })

  describe('proFeatureOverrides', () => {
    it('records only the differences from the tier', () => {
      const pro = featuresForTier('pro')
      expect(proFeatureOverrides('pro', pro)).toBe(null)
      expect(proFeatureOverrides('pro', pro.filter(key => key !== 'groupThemes').concat('recording')))
        .toEqual({ groupThemes: false, recording: true })
    })

    it('round-trips through resolveProFeatures', () => {
      const chosen = ['postAsGroup', 'singleSignOn']
      const overrides = proFeatureOverrides('pro', chosen)
      const features = resolveProFeatures([{ tier: 'pro', features: overrides }])
      expect(HYLO_PRO_FEATURE_KEYS.filter(key => features[key])).toEqual(chosen)
    })
  })
})
