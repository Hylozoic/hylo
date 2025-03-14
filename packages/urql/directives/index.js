import { AnalyticsEvents } from '@hylo/shared'

// TODO: URQL - analytics
// analytics: {
//   eventName: AnalyticsEvents.COMMENT_CREATED,
//   commentLength: TextHelpers.textLengthHTML(text),
//   groupId: post.groups.map(g => g.id),
//   hasAttachments: attachments && attachments.length > 0,
//   parentCommentId,
//   postId
// }

export default {
  analytics: (directiveArgs) => {
    console.log('!!!! directiveArgs', directiveArgs)
    // This resolver is called for @_analytics directives
    return (parent, args, cache, info) => {
      console.log('!!!! args in analytics', directiveArgs, args, info, AnalyticsEvents.COMMENT_CREATED)

      return null
    }
  }
}
