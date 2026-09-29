/* global Notification */
// Decides which media (email, push, in-app) an activity creates for its reader.
// Activity.generateNotificationMedia runs these four phases in order:
//
//   1. OVERRIDES       a rule may return a fixed list of media, skipping the rest
//   2. CHANNEL_RULES   which channels this signal may use (signalClasses), narrowed by
//                      the reader's group toggles
//   3. GATE_PASSES     a post or chat reaches the reader only when one pass says so;
//                      every other signal goes through
//   4. READER_FILTERS  per-reader narrowing after the gate
//
// To add a rule, write a module in this folder and add one line to its phase.
import { filter, find, includes, isEmpty } from 'lodash'
import { EMAIL_REASONS } from '../emailReasons'
import { CHANNEL, channelsForReason, classForActivity } from '../signalClasses'

const hasReason = pattern => ctx => ctx.reasons.some(reason => pattern.test(reason))
export const isNewPost = hasReason(/^newPost/)
export const isMention = hasReason(/^mention/)
export const isAnnouncement = hasReason(/^announcement/)
export const isChat = hasReason(/^chat/)

// Phase 1
const groupInvitationOverride = ctx => {
  // Invitees are not members yet, so skip membership-based email.
  // Invitation.send already emails them; in-app (and push) are for existing Hylo users.
  if (ctx.reasons[0] === 'groupInvitation') return [Notification.MEDIUM.InApp, Notification.MEDIUM.Push]
}

export const OVERRIDES = [
  groupInvitationOverride
]

// Phase 2
const classChannels = ctx => {
  ctx.channels = new Set(channelsForReason(ctx.reason))
}

// Chats go out in the hourly digest, never one email per message, even when the chat
// mentions you (D88), so this looks at every reason rather than the priority one.
const chatNeverEmails = ctx => {
  if (isChat(ctx)) ctx.channels.delete(CHANNEL.EMAIL)
}

const emailNeedsTemplate = ctx => {
  if (!EMAIL_REASONS.has(ctx.reason)) ctx.channels.delete(CHANNEL.EMAIL)
}

const groupToggles = ctx => {
  if (isEmpty(ctx.membershipsPermitting('sendEmail'))) ctx.channels.delete(CHANNEL.EMAIL)
  if (isEmpty(ctx.membershipsPermitting('sendPushNotifications'))) ctx.channels.delete(CHANNEL.PUSH)
}

export const CHANNEL_RULES = [
  classChannels,
  chatNeverEmails,
  emailNeedsTemplate,
  groupToggles
]

// Phase 3: only posts and chats are gated by the reader's post setting
// (Membership postNotifications: all / important / none).
const everyPost = ctx => ctx.postSetting === 'all'
const importantAnnouncementOrMention = ctx =>
  ctx.postSetting === 'important' && (isAnnouncement(ctx) || isMention(ctx))

export const GATE_PASSES = [
  everyPost,
  importantAnnouncementOrMention
]

const isGated = ctx => isChat(ctx) || isNewPost(ctx)

// Phase 4
export const READER_FILTERS = []

// The reader's strongest post setting across the memberships this activity touches.
function strongestPostSetting (memberships) {
  return memberships.reduce((acc, mem) => {
    const setting = mem.getSetting('postNotifications')
    if (setting === 'all') return 'all'
    if (setting === 'important' && acc !== 'all') return 'important'
    return acc
  }, 'none')
}

export async function buildContext (activity) {
  const reasons = activity.get('meta').reasons || []
  const reader = activity.relations.reader
  const memberships = (await reader.memberships().fetch({ withRelated: 'group' })).models
  const groupIds = Activity.groupIds(activity)
  const relevantMemberships = filter(memberships, mem =>
    includes(groupIds, mem.related('group').id))

  // Spaces have no channel settings of their own in the UI; they follow the parent group's
  const channelSetting = (mem, key) => {
    const group = mem.related('group')
    const parentId = group.get('type') === 'space' && group.get('parent_id')
    const parentMembership = parentId &&
      find(memberships, m => String(m.related('group').id) === String(parentId))
    return (parentMembership || mem).getSetting(key)
  }

  const reason = Notification.priorityReason(reasons)
  const ctx = {
    activity,
    reasons,
    reason,
    reader,
    memberships,
    relevantMemberships,
    groupIds,
    channelSetting,
    membershipsPermitting: key => filter(relevantMemberships, mem => channelSetting(mem, key)),
    postSetting: strongestPostSetting(relevantMemberships),
    channels: new Set()
  }
  ctx.signalClass = classForActivity(activity, reason)
  return ctx
}

const MEDIUM_FOR_CHANNEL = () => [
  [CHANNEL.EMAIL, Notification.MEDIUM.Email],
  [CHANNEL.PUSH, Notification.MEDIUM.Push],
  [CHANNEL.IN_APP, Notification.MEDIUM.InApp]
]

export async function notificationMedia (activity) {
  const reasons = activity.get('meta').reasons || []
  const skipPostLoad = ['approvedJoinRequest', 'joinRequest', 'groupInvitation'].includes(reasons[0])
  if (!skipPostLoad) await activity.load('post.groups')

  for (const override of OVERRIDES) {
    const media = override({ activity, reasons })
    if (media) return media
  }

  const ctx = await buildContext(activity)

  for (const rule of CHANNEL_RULES) rule(ctx)

  if (isGated(ctx) && !GATE_PASSES.some(pass => pass(ctx))) return []

  for (const readerFilter of READER_FILTERS) readerFilter(ctx)

  return MEDIUM_FOR_CHANNEL()
    .filter(([channel]) => ctx.channels.has(channel))
    .map(([, medium]) => medium)
}
