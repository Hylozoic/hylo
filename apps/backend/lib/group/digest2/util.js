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
    some(some(x => x), pick(['discussions', 'requests', 'offers', 'events', 'projects', 'resources', 'chats', 'topics_with_chats', 'posts_with_new_comments', 'upcoming', 'ending', 'funding_rounds'], data))
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

  // Get funding round submissions for participating users
  const fundingRoundSubmissions = await bookshelf.knex('funding_rounds_posts')
    .join('funding_rounds', 'funding_rounds_posts.funding_round_id', 'funding_rounds.id')
    .join('posts', 'funding_rounds_posts.post_id', 'posts.id')
    .where('funding_rounds.group_id', group.id)
    .whereBetween('funding_rounds_posts.created_at', [startTime.toJSDate(), endTime.toJSDate()])
    .where('posts.active', true)
    .where('posts.type', Post.Type.SUBMISSION)
    .select(
      'funding_rounds.id as funding_round_id',
      'funding_rounds.title as funding_round_title',
      bookshelf.knex.raw('COUNT(posts.id) as submission_count')
    )
    .groupBy('funding_rounds.id', 'funding_rounds.title')
    .then(rows => rows.map(row => ({
      fundingRoundId: row.funding_round_id,
      fundingRoundTitle: row.funding_round_title,
      submissionCount: parseInt(row.submission_count)
    })))

  if (posts.length === 0 && comments.length === 0 && upcomingPostReminders?.startingSoon?.length === 0 && upcomingPostReminders?.endingSoon?.length === 0 && fundingRoundSubmissions.length === 0) {
    return false
  }

  return {
    posts,
    comments,
    upcomingPostReminders,
    fundingRoundSubmissions
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
  const testerChecks = await Promise.all(recipients.map(async recipient => {
    const isTester = await recipient.isTester()
    return process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true' || isTester
  }))
  return recipients.filter((recipient, index) => testerChecks[index])
}
