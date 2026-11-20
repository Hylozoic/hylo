import { HYLO_PRO_FEATURES, HYLO_PRO_TIERS } from '@hylo/shared'
import { TIERS, tierCardFor } from './tiers'

describe('Billing tab tiers', () => {
  const cardKeys = card => card.features.flatMap(feature => feature.keys)

  it('shows every registered Pro feature on exactly one card, the card of its tier', () => {
    for (const { key, tier } of HYLO_PRO_FEATURES) {
      const cards = TIERS.filter(card => cardKeys(card).includes(key))
      expect({ key, cards: cards.map(card => card.id) }).toEqual({ key, cards: [expect.any(String)] })
      expect({ key, tier: cards[0].proTier }).toEqual({ key, tier })
    }
  })

  it('names only registered features', () => {
    const registered = HYLO_PRO_FEATURES.map(feature => feature.key)
    for (const card of TIERS) {
      for (const key of cardKeys(card)) expect(registered).toContain(key)
    }
  })

  it('has one card per registry tier, and none for Supporter', () => {
    for (const tier of HYLO_PRO_TIERS) expect(tierCardFor(tier)?.proTier).toBe(tier)
    expect(TIERS.find(card => card.id === 'supporter').proTier).toBeUndefined()
    expect(tierCardFor('supporter')).toBe(null)
  })
})
