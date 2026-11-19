/**
 * Labels for the Hylo Pro feature registry (packages/shared HyloProFeatures.js) on the staff
 * tools, by registry key. Most reuse the Billing tab's plan copy (the same English keys); the
 * three features the Pro card lists on one line get their own short labels.
 */
const LABEL_KEYS = {
  anyGroupSize: 'Any group size',
  postAsGroup: 'Set post author as group (group-bot)',
  adminsEditAdminPosts: 'Any admin can edit posts of other admins',
  advancedMetrics: 'Advanced metrics',
  largerUploads: 'Larger file uploads',
  advancedDashboard: 'Advanced group dashboard',
  designedViews: 'Designed views',
  liveAudioVideo: 'Live audio/video (everyone on video/audio)',
  simpleWhitelabel: 'Simple whitelabel (iframe embed)',
  groupThemes: 'Custom group styling (colours, branding, match your website)',
  groupAssistant: 'Axl group assistant',
  setupWizard: 'Group setup wizard',
  matchmaking: 'Matchmaking',
  largerAudioVideo: 'Audio/video with a higher participant limit',
  recording: 'Recording and storage',
  transcriptions: 'Transcriptions',
  broadcast: 'Broadcast (a small group to many; the audience listens only)',
  higherUploadLimits: 'Higher upload limits on attachments',
  collaborativeDocuments: 'Collaborative documents',
  aiWorkflows: 'AI workflows',
  higherAiLimits: 'Higher AI limits, shared across all included groups',
  lowerPlatformFee: 'Better paid-group terms: Hylo keeps 3% instead of 6%',
  childGroupsIncluded: 'Up to 10 child groups included (that the account holder also administers), more per seat',
  customDomain: 'Advanced whitelabel (custom domain)',
  federation: 'Federation: we run a separate server for you',
  singleSignOn: 'Single sign-on'
}

// A feature's label, or its key for one registered after this list (so nothing is hidden)
export function featureLabel (key, t) {
  return LABEL_KEYS[key] ? t(LABEL_KEYS[key]) : key
}

export function tierLabel (tier, t) {
  switch (tier) {
    case 'pro': return t('Pro')
    case 'pro_plus': return t('Pro Plus')
    case 'custom': return t('Custom')
    default: return tier
  }
}
