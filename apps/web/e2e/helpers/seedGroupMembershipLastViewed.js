import { waitPastRootSessionLoading } from './waitPastRootSessionLoading.js'

/**
 * Visit the group's all view so membership gets `lastViewedAt` and AuthLayoutRouter's
 * first-visit redirect does not replace deep URLs (payment result, offerings, etc.).
 * E2E baseline seed sets membership welcome fields so `GroupWelcomeModal` does not block this flow.
 */
export async function seedGroupMembershipLastViewed (page, groupSlug) {
  await page.goto(`/groups/${groupSlug}/all`)
  await waitPastRootSessionLoading(page)
}
