import { DateTime } from 'luxon'
import { includes } from 'lodash'
import { get, pick, some } from 'lodash/fp'
import { UNSUBSCRIBE_SCOPE, UNSUBSCRIBE_SCOPE_SETTING } from '../../../api/models/notification/rules/unsubscribeScope'
import { DORMANT_DAYS, INACTIVE_DAYS, daysAgo } from '../../../api/models/notification/rules/inactiveReader'
import { SLOT_SETTING, isDue, timezoneFilter, windowFor } from './localMorning'

// When a member was last seen (D9): their last activity, else when they signed up
const LAST_SEEN = 'coalesce(users.last_active_at, users.created_at, now())'

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
        space_id: chat.space_id || null,
        source_group_id: chat.source_group_id
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
      'groups.name as funding_round_title',
      bookshelf.knex.raw('COUNT(posts.id) as submission_count')
    )
    .groupBy('funding_rounds.id', 'groups.name')
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

// Marks the weekly recipients who are here because their daily digest was slowed down
// (user.digestSlowed), so the digest can say so once (lib/group/digest2/index.js)
async function markSlowedDigests (groupId, recipients, inactiveSince) {
  const awayIds = recipients
    .filter(user => {
      const seen = user.get('last_active_at') || user.get('created_at')
      return seen && new Date(seen) <= inactiveSince
    })
    .map(user => user.id)
  if (awayIds.length === 0) return
  const dailyIds = (await bookshelf.knex('group_memberships')
    .where({ group_id: groupId, active: true })
    .whereIn('user_id', awayIds)
    .whereRaw('settings->>\'digestFrequency\' = \'daily\'')
    .pluck('user_id')).map(String)
  recipients.forEach(user => {
    if (dailyIds.includes(String(user.id))) user.digestSlowed = true
  })
}

// For an hourly run (D41): keeps the recipients whose local-morning slot is due, and
// gives each their slot (digestSlot), the window their digest covers (digestWindow,
// with a key to group by) and the slot their last one was sent for (digestSentFor)
async function dueForSchedule (groupId, type, recipients, { at, timezones }) {
  if (recipients.length === 0) return recipients
  const key = SLOT_SETTING[type]
  const rows = await bookshelf.knex('group_memberships')
    .where('group_id', groupId)
    .whereIn('user_id', recipients.map(user => user.id))
    .select('user_id', bookshelf.knex.raw('settings->>? as sent_for', [key]))
  const sentFor = {}
  rows.forEach(row => { sentFor[String(row.user_id)] = row.sent_for || null })

  return recipients.filter(user => {
    const timezone = user.get('settings')?.timezone
    const slot = timezones.get(timezone == null ? '' : String(timezone))
    if (!slot) return false
    const lastSentFor = sentFor[String(user.id)] || null
    if (!isDue(type, slot, lastSentFor, at)) return false
    const window = windowFor(type, slot, lastSentFor)
    user.digestSlot = slot
    user.digestSentFor = lastSentFor
    user.digestWindow = window
    user.digestWindowKey = window.map(time => time.toMillis()).join('-')
    return true
  })
}

// schedule (optional, for the hourly local-morning runs): { at, timezones } from
// localMorning.dueTimezones; only members whose slot is due are returned
export async function getRecipients (groupId, type, schedule = null) {
  if (!includes(['daily', 'weekly'], type)) {
    throw new Error(`invalid recipient type: ${type}`)
  }

  const group = await Group.find(groupId)
  const now = schedule?.at ? new Date(schedule.at) : new Date()
  const inactiveSince = daysAgo(INACTIVE_DAYS, now)
  let recipients = await group.members().query(q => {
    // Members away 30 days or more get the weekly digest instead of the daily one, and
    // members away 180 days or more get none (D9)
    if (type === 'daily') {
      q.whereRaw('group_memberships.settings->>\'digestFrequency\' = \'daily\'')
      q.whereRaw(`${LAST_SEEN} > ?`, [inactiveSince])
    } else {
      q.where(function () {
        this.whereRaw('group_memberships.settings->>\'digestFrequency\' = \'weekly\'')
          .orWhere(function () {
            this.whereRaw('group_memberships.settings->>\'digestFrequency\' = \'daily\'')
              .whereRaw(`${LAST_SEEN} <= ?`, [inactiveSince])
          })
      })
    }
    q.whereRaw(`${LAST_SEEN} > ?`, [daysAgo(DORMANT_DAYS, now)])
    q.whereRaw('(group_memberships.settings->>\'sendEmail\')::boolean = true')
    // 'Everything except direct' and 'everything' stop group digests (D35); 'no group
    // emails' already turned sendEmail off, and 'digest only' keeps them
    q.whereRaw(`coalesce(users.settings->>'${UNSUBSCRIBE_SCOPE_SETTING}', '') not in (?, ?)`,
      [UNSUBSCRIBE_SCOPE.ALL_BUT_DIRECT, UNSUBSCRIBE_SCOPE.EVERYTHING])
    if (schedule) {
      const filter = timezoneFilter(schedule.timezones.keys())
      q.whereRaw(filter.sql, filter.bindings)
    }
  }).fetch().then(get('models'))

  if (schedule) recipients = await dueForSchedule(groupId, type, recipients, schedule)

  if (type === 'weekly') await markSlowedDigests(groupId, recipients, inactiveSince)

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
