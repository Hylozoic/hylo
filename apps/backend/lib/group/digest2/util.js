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
    this.whereNotIn('posts.type', ['welcome', ...Post.NOTICE_TYPES])
      .orWhere('posts.type', null)
  })

export const relatedUserColumns = (relationName = 'user') => ({
  [relationName]: q => q.column('users.id', 'users.name', 'users.avatar_url')
})

/** Parent group plus its active child spaces. */
export const scopeGroupIds = (group, spaces = []) =>
  [group.id, ...spaces.map(s => s.id)].filter(id => id != null)

/** Restrict a posts query to rows linked to any of the given groups. */
export const wherePostedInGroups = (q, groupIds) => {
  q.whereIn('posts.id', function () {
    this.select('groups_posts.post_id')
      .from('groups_posts')
      .whereIn('groups_posts.group_id', groupIds)
  })
}

/** Collapse chat posts into one row per room for the digest template. */
export const aggregateChatRooms = (chats) => {
  const rooms = Object.values((chats || []).reduce((acc, chat) => {
    const key = chat.source_group_id != null ? String(chat.source_group_id) : 'parent'
    if (acc[key]) {
      acc[key].num_new_chats++
    } else {
      acc[key] = {
        name: chat.source_group_name,
        num_new_chats: 1,
        url: chat.chat_url,
        space_id: chat.space_id || null
      }
    }
    return acc
  }, {}))

  return rooms.sort((a, b) => {
    if (!a.space_id && b.space_id) return -1
    if (a.space_id && !b.space_id) return 1
    return (a.name || '').localeCompare(b.name || '')
  })
}

/** Parse one or more group ids from a CLI flag, number, or comma-separated string. */
export const parseGroupIds = (raw) => {
  if (raw == null || raw === true || raw === false) return []
  const values = Array.isArray(raw) ? raw : [raw]
  return [...new Set(
    values
      .flatMap(v => String(v).split(','))
      .map(s => s.trim().replace(/^--?groups?=/, ''))
      .filter(s => /^\d+$/.test(s))
  )]
}

export const shouldSendData = (data, id) =>
  Promise.resolve(
    some(some(x => x), pick([
      'discussions',
      'requests',
      'offers',
      'events',
      'projects',
      'proposals',
      'resources',
      'chat_rooms',
      'posts_with_new_comments',
      'upcoming',
      'ending',
      'funding_rounds'
    ], data || {}))
  )

export const getPostsAndComments = async (group, startTime, endTime, digestType, spaces = []) => {
  const groupIds = scopeGroupIds(group, spaces)

  const posts = await Post.createdInTimeRange(Post.collection(), startTime, endTime)
    .query(isValidPostType)
    .query(q => {
      wherePostedInGroups(q, groupIds)
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
        'media',
        'groups'
      ]
    })
    .then(get('models'))

  const upcomingPostReminders = await Post.upcomingPostReminders(group, digestType, spaces.map(s => s.id))

  const comments = await Comment.createdInTimeRange(Comment.collection(), startTime, endTime)
    .query(q => {
      isValidPostType(q)
      q.join('posts', 'posts.id', 'comments.post_id')
      q.where('posts.active', true)
      q.whereIn('comments.post_id', function () {
        this.select('groups_posts.post_id')
          .from('groups_posts')
          .whereIn('groups_posts.group_id', groupIds)
      })
      q.orderBy('id', 'asc')
    })
    .fetch({
      withRelated: [
        'post',
        'post.groups',
        relatedUserColumns(),
        relatedUserColumns('post.user')
      ]
    })
    .then(get('models'))

  // Get funding round submissions for spaces under this group (or the group itself)
  const fundingRoundSubmissions = await bookshelf.knex('groups_posts')
    .join('posts', 'posts.id', 'groups_posts.post_id')
    .join('funding_rounds', 'funding_rounds.group_id', 'groups_posts.group_id')
    .join('groups', 'groups.id', 'groups_posts.group_id')
    .where(function () {
      this.where('groups.parent_id', group.id).orWhere('groups.id', group.id)
    })
    .whereBetween('posts.created_at', [startTime.toJSDate(), endTime.toJSDate()])
    .where('posts.active', true)
    .where('posts.type', Post.Type.SUBMISSION)
    .whereNull('funding_rounds.deactivated_at')
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
    fundingRoundSubmissions,
    spaces
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

  if (process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true') {
    return recipients
  }

  // If email notifications are disabled, only send to testers
  const testerChecks = await Promise.all(recipients.map(async recipient => {
    const isTester = await recipient.isTester()
    return isTester
  }))
  return recipients.filter((recipient, index) => testerChecks[index])
}
