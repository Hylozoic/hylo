/**
 * The plans shown on the Billing tab (#1712). Display only: nothing here gates a feature, and
 * none of the Pro / Pro Plus features are checked anywhere. Copy lives in the locale files; the
 * strings below are the English keys.
 *
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
    featureKeys: [
      'Supporter badge',
      'Basic metrics'
    ]
  },
  {
    id: 'pro',
    nameKey: 'Pro',
    subtitleKey: 'For nonprofits and networks',
    priceKind: 'plans',
    ctaKind: 'upgrade',
    featureKeys: [
      'Any group size',
      'Set post author as group (group-bot)',
      'Any admin can edit posts of other admins',
      'Advanced metrics',
      'Larger file uploads',
      'Advanced group dashboard',
      'Designed views',
      'Live audio/video (everyone on video/audio)',
      'Simple whitelabel (iframe embed)',
      'Custom group styling (colours, branding, match your website)',
      'A little AI: group setup wizard, matchmaking, Axl assistant'
    ]
  },
  {
    id: 'pro-plus',
    nameKey: 'Pro Plus',
    subtitleKey: 'For larger networks, organizations and government',
    priceKind: 'comingSoon',
    ctaKind: 'comingSoon',
    featureKeys: [
      'Audio/video with a higher participant limit',
      'Recording and storage',
      'Transcriptions',
      'Broadcast (a small group to many; the audience listens only)',
      'Higher upload limits on attachments',
      'Collaborative documents',
      'AI workflows',
      'Higher AI limits, shared across all included groups',
      'Better paid-group terms: Hylo keeps 3% instead of 6%',
      'Up to 10 child groups included (that the account holder also administers), more per seat'
    ]
  },
  {
    id: 'custom',
    nameKey: 'Custom',
    priceKind: 'contact',
    ctaKind: 'contact',
    featureKeys: [
      'Advanced whitelabel (custom domain)',
      'Federation: we run a separate server for you',
      'Single sign-on',
      'Custom app development',
      'Custom web client development',
      'Custom CSaaS support'
    ]
  }
]
