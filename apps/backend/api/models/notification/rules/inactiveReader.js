// Quieter delivery for members who've stopped visiting (D9). Reads users.last_active_at
// (updated on every signed-in request, api/graphql/index.js), or created_at for someone
// who has never been active. Nothing is stored for the throttle itself, so normal
// delivery returns on the person's next visit.
//
//   30+ days away    no push or email for new posts, topic posts, chats and announcements;
//                    daily digests become weekly (lib/group/digest2/util.js); chat digests
//                    carry only chats that mention them (GroupViewUser)
//   180+ days away   no push or email except direct signals (direct messages, mentions,
//                    replies to you); no group, unified or chat digests; comment digests
//                    only for mentions and replies (comment/notifications.js); one
//                    win-back email (api/models/user/winback.js)
//
// In-app notifications are never affected.
import { CHANNEL } from '../signalClasses'
import { isDirectSignal } from './unsubscribeScope'

export const INACTIVE_DAYS = 30
export const DORMANT_DAYS = 180

const DAY_MS = 24 * 60 * 60 * 1000

// The per-post and chat reasons that stop after INACTIVE_DAYS
export const PER_POST_REASONS = ['newPost', 'tag', 'chat', 'announcement']

// When this person was last seen: their last activity, or when they signed up. Null
// when neither is known, which counts as active.
export function lastSeenAt (user) {
  const get = key => typeof user?.get === 'function' ? user.get(key) : user?.[key]
  const value = get('last_active_at') || get('created_at')
  return value ? new Date(value) : null
}

export function daysAway (user, now = new Date()) {
  const seen = lastSeenAt(user)
  if (!seen || isNaN(seen)) return 0
  return Math.max(0, (now - seen) / DAY_MS)
}

export const isInactive = (user, now) => daysAway(user, now) >= INACTIVE_DAYS
export const isDormant = (user, now) => daysAway(user, now) >= DORMANT_DAYS

export const daysAgo = (days, now = new Date()) => new Date(now.getTime() - days * DAY_MS)

// Reader filter (notification/rules READER_FILTERS)
export function inactiveReaderFilter (ctx) {
  const days = daysAway(ctx.reader)
  if (days < INACTIVE_DAYS || isDirectSignal(ctx)) return
  if (days >= DORMANT_DAYS || PER_POST_REASONS.includes(ctx.reason)) {
    ctx.channels.delete(CHANNEL.EMAIL)
    ctx.channels.delete(CHANNEL.PUSH)
  }
}
