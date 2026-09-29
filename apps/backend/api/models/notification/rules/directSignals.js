// Gate passes for signals addressed to the reader (D7 direct class).
import { isAnnouncement, isMention } from './predicates'

// An @-mention in a post or chat always reaches the person, whatever their post
// setting for the group, including "No Posts" (D8, D88). Their email and push toggles
// still apply, and chat mentions stay email-free (see chatNeverEmails).
export const mentionsAlwaysReachYou = ctx => isMention(ctx)

// Announcements reach readers on "Important" (and "Every post").
export const importantAnnouncement = ctx =>
  ctx.postSetting === 'important' && isAnnouncement(ctx)
