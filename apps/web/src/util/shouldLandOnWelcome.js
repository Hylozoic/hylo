/**
 * First landing after join: welcome view exists and "show to new members" is on.
 * The setting defaults on; only an explicit false skips it.
 */
export default function shouldLandOnWelcome (group, membership, { onWelcomePath = false, views } = {}) {
  if (!membership || membership.lastViewedAt || onWelcomePath) return false
  if (group?.settings?.showWelcomePage === false) return false
  const viewItems = views || group?.groupViews?.items || []
  return viewItems.some(view => view.type === 'welcome')
}
