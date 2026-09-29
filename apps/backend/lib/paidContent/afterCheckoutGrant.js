/* global Group, User, Responsibility, Frontend, Queue */
// D62: what follows a new checkout grant, whichever path granted it first (the
// checkout.session.completed webhook or the success page's fulfillStripeCheckoutSession).
// - An "Access Granted" server event, only for buyers who accept analytics.
// - For a subscription, a "new subscriber" email to the selling group's Administrators,
//   matching the cancellation notice they already get.
// A replay (grant.already) does neither again.
import { AnalyticsEvents } from '@hylo/shared'
import { trackServerEvent } from '../analytics/trackServerEvent'
import { normalizeLocaleToFull } from '../localeHelpers'

const SUBSCRIPTION_PERIODS = { day: 'daily', month: 'monthly', season: 'quarterly', annual: 'annual' }

export const subscriptionPeriodFor = duration => SUBSCRIPTION_PERIODS[duration] || duration || null

const formatPrice = (cents, currency) => {
  // Required lazily: StripeService needs a Stripe key when it loads
  const StripeService = require('../../api/services/StripeService')
  return StripeService.formatPrice(cents, currency)
}

/**
 * Queues the "new subscriber" email to each Administrator of the selling group, other
 * than the subscriber. Resolves to how many were queued.
 */
export async function queueNewSubscriberNotice ({ userId, groupId, offering, subscribedAt = new Date() }) {
  const [user, group] = await Promise.all([User.find(userId), Group.find(groupId)])
  if (!user || !group || !offering) return 0

  const admins = await group.membersWithResponsibilities([Responsibility.constants.RESP_ADMINISTRATION]).fetch()
  const amount = formatPrice(offering.get('price_in_cents') || 0, offering.get('currency') || 'usd')
  const period = subscriptionPeriodFor(offering.get('duration'))
  let queued = 0

  for (const admin of admins.models) {
    if (!admin.get('email') || String(admin.id) === String(user.id)) continue
    const locale = admin.getLocale()
    Queue.classMethod('Email', 'sendNewSubscriberAdminNotification', {
      email: admin.get('email'),
      locale,
      data: {
        admin_name: admin.get('name'),
        user_name: user.get('name'),
        user_profile_url: Frontend.Route.profile(user),
        offering_name: offering.get('name'),
        group_name: group.get('name'),
        group_url: Frontend.Route.group(group),
        group_avatar_url: group.get('avatar_url'),
        subscribed_at: subscribedAt.toLocaleDateString(normalizeLocaleToFull(locale), { year: 'numeric', month: 'long', day: 'numeric' }),
        subscription_amount: amount,
        subscription_period: period,
        view_content_access_url: `${Frontend.Route.group(group)}/settings/paid-content/access`,
        contact_user_url: `${Frontend.Route.profile(user)}/message`
      }
    })
    queued += 1
  }
  return queued
}

/**
 * Runs after grantCheckoutSessionAccess. Never throws: the grant has already happened.
 */
export async function afterCheckoutGrant ({ grant, session }) {
  if (!grant?.granted || grant.already) return
  const { userId, groupId, offering, stripeSubscriptionId } = grant
  const isSubscription = session?.mode === 'subscription' && !!stripeSubscriptionId

  await trackServerEvent(userId, AnalyticsEvents.ACCESS_GRANTED, {
    groupId: String(groupId),
    offeringId: String(offering.id),
    trackId: offering.get('track_id') ? String(offering.get('track_id')) : null,
    mode: session?.mode || null,
    subscription: isSubscription
  })

  if (!isSubscription) return
  try {
    await queueNewSubscriberNotice({ userId, groupId, offering })
  } catch (err) {
    console.error('Error queueing new subscriber admin notification emails:', err)
  }
}
