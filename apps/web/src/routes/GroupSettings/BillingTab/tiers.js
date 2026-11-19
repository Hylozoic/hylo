/**
 * The plans shown on the Billing tab (#1712). Display only: nothing here gates a feature. Each
 * feature line names the registry keys (packages/shared HyloProFeatures.js) it describes, so the
 * cards and the registry can't disagree: tiers.test.js checks that every registered feature is on
 * exactly one card, on the card of its tier. Lines with no keys are services or Supporter perks,
 * which aren't Pro features. Copy lives in the locale files; the strings below are the English keys.
 *
 * proTier:   the registry tier this card sells ('pro', 'pro_plus', 'custom'), if any
 * priceKind: 'any' (any amount), 'plans' (from the server's Hylo Pro plans), 'comingSoon', 'contact'
 * ctaKind:   'support' (opens SupportHyloModal), 'upgrade' (Hylo Pro Checkout), 'comingSoon' (disabled), 'contact' (mailto)
 */
export const CONTACT_EMAIL = 'hello@hylo.com'

export const TIERS = [
  {
    id: 'supporter',
    nameKey: 'Supporter',
    priceKind: 'any',
    ctaKind: 'support',
    features: [
      { labelKey: 'Supporter badge', keys: [] }
    ]
  },
  {
    id: 'pro',
    proTier: 'pro',
    nameKey: 'Pro',
    subtitleKey: 'For nonprofits and networks',
    priceKind: 'plans',
    ctaKind: 'upgrade',
    features: [
      { labelKey: 'Any group size', keys: ['anyGroupSize'] },
      { labelKey: 'Set post author as group (group-bot)', keys: ['postAsGroup'] },
      { labelKey: 'Any admin can edit posts of other admins', keys: ['adminsEditAdminPosts'] },
      { labelKey: 'Advanced metrics', keys: ['advancedMetrics'] },
      { labelKey: 'Larger file uploads', keys: ['largerUploads'] },
      { labelKey: 'Advanced group dashboard', keys: ['advancedDashboard'] },
      { labelKey: 'Designed views', keys: ['designedViews'] },
      { labelKey: 'Live audio/video (everyone on video/audio)', keys: ['liveAudioVideo'] },
      { labelKey: 'Simple whitelabel (iframe embed)', keys: ['simpleWhitelabel'] },
      { labelKey: 'Custom group styling (colours, branding, match your website)', keys: ['groupThemes'] },
      { labelKey: 'A little AI: group setup wizard, matchmaking, Axl assistant', keys: ['setupWizard', 'matchmaking', 'groupAssistant'] }
    ]
  },
  {
    id: 'pro-plus',
    proTier: 'pro_plus',
    nameKey: 'Pro Plus',
    subtitleKey: 'For larger networks, organizations and government',
    priceKind: 'comingSoon',
    ctaKind: 'comingSoon',
    features: [
      { labelKey: 'Audio/video with a higher participant limit', keys: ['largerAudioVideo'] },
      { labelKey: 'Recording and storage', keys: ['recording'] },
      { labelKey: 'Transcriptions', keys: ['transcriptions'] },
      { labelKey: 'Broadcast (a small group to many; the audience listens only)', keys: ['broadcast'] },
      { labelKey: 'Higher upload limits on attachments', keys: ['higherUploadLimits'] },
      { labelKey: 'Collaborative documents', keys: ['collaborativeDocuments'] },
      { labelKey: 'AI workflows', keys: ['aiWorkflows'] },
      { labelKey: 'Higher AI limits, shared across all included groups', keys: ['higherAiLimits'] },
      { labelKey: 'Better paid-group terms: Hylo keeps 3% instead of 6%', keys: ['lowerPlatformFee'] },
      { labelKey: 'Up to 10 child groups included (that the account holder also administers), more per seat', keys: ['childGroupsIncluded'] }
    ]
  },
  {
    id: 'custom',
    proTier: 'custom',
    nameKey: 'Custom',
    priceKind: 'contact',
    ctaKind: 'contact',
    features: [
      { labelKey: 'Advanced whitelabel (custom domain)', keys: ['customDomain'] },
      { labelKey: 'Federation: we run a separate server for you', keys: ['federation'] },
      { labelKey: 'Single sign-on', keys: ['singleSignOn'] },
      { labelKey: 'Custom app development', keys: [] },
      { labelKey: 'Custom web client development', keys: [] },
      { labelKey: 'Custom CSaaS support', keys: [] }
    ]
  }
]

// The card that sells a registry tier, e.g. 'pro_plus' -> the 'pro-plus' card
export function tierCardFor (proTier) {
  return TIERS.find(tier => tier.proTier === proTier) || null
}
