import { DateTime } from 'luxon'
import { includes } from 'lodash'
import { get, pick, some } from 'lodash/fp'

export const defaultTimezone = 'America/Los_Angeles'

export const defaultTimeRange = type => {
  const today = DateTime.now().setZone(defaultTimezone).startOf('day').plus({ hours: 12 })
  switch (type) {
    case 'daily':
      return [today.minus({ day: 1 }), today]
    case 'weekly':
      return [today.minus({ day: 7 }), today]
  }
}

export const isValidPostType = q =>
  q.where(function () {
    this.whereNotIn('posts.type', ['welcome'])
      .orWhere('posts.type', null)
  })

export const relatedUserColumns = (relationName = 'user') => ({
  [relationName]: q => q.column('users.id', 'users.name', 'users.avatar_url')
})

export const shouldSendData = (data, id) =>
  Promise.resolve(
    some(some(x => x), pick(['discussions', 'requests', 'offers', 'events', 'projects', 'resources', 'chats', 'topics_with_chats', 'posts_with_new_comments', 'upcoming', 'ending'], data))
  )

export const getPostsAndComments = async (group, startTime, endTime, digestType) => {
  const posts = await Post.createdInTimeRange(group.posts(), startTime, endTime)
    .query(isValidPostType)
    .query(q => {
      // Only show posts that are not fulfilled and not past end time
      q.whereRaw('posts.fulfilled_at IS NULL')
      q.where(q2 => {
        q2.whereRaw('posts.end_time is NULL')
          .orWhereRaw('posts.end_time > NOW()')
      })
    })
    .fetch({
      withRelated: [
        'tags',
        relatedUserColumns(),
        'linkPreview',
        'media'
      ]
    })
    .then(get('models'))

  const upcomingPostReminders = await Post.upcomingPostReminders(group, digestType)

  const comments = await Comment.createdInTimeRange(group.comments(), startTime, endTime)
    .query(q => {
      isValidPostType(q)
      q.join('posts', 'posts.id', 'comments.post_id')
      q.where('posts.active', true)
      q.orderBy('id', 'asc')
    })
    .fetch({
      withRelated: [
        'post',
        relatedUserColumns(),
        relatedUserColumns('post.user')
      ]
    })
    .then(get('models'))

  if (posts.length === 0 && comments.length === 0 && upcomingPostReminders?.startingSoon?.length === 0 && upcomingPostReminders?.endingSoon?.length === 0) {
    return false
  }

  return {
    posts,
    comments,
    upcomingPostReminders
  }
}

export async function getRecipients (groupId, type) {
  if (!includes(['daily', 'weekly'], type)) {
    throw new Error(`invalid recipient type: ${type}`)
  }

  const group = await Group.find(groupId)
  const recipients = await group.members().query(q => {
    q.whereRaw(`group_memberships.settings->>'digestFrequency' = '${type}'`)
    q.whereRaw('(group_memberships.settings->>\'sendEmail\')::boolean = true')
  }).fetch().then(get('models'))

  // If email notifications are disabled, only send to testers
  return recipients.filter(recipient => process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true' || recipient.isTester())
}
