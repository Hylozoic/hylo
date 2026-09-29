// Tests on an activity's reasons, shared by the rule modules. `ctx` is the context
// notification/rules builds for one activity and reader.
const hasReason = pattern => ctx => ctx.reasons.some(reason => pattern.test(reason))

export const isNewPost = hasReason(/^newPost/)
export const isMention = hasReason(/^mention/)
export const isAnnouncement = hasReason(/^announcement/)
export const isChat = hasReason(/^chat/)
