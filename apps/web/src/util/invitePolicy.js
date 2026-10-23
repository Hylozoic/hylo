import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'

/**
 * Analytics for a saved invite policy. `surface` is where it was saved:
 * 'create' (the create-group form) or 'settings' (Roles & Badges).
 */
export function trackInvitePolicySet (mode, surface) {
  return trackAnalyticsEvent('Group Invite Policy Set', { mode, surface })
}
