/* global bookshelf, Group, GroupMembership, Notification, Queue, sails */
import sentry from '../../../lib/sentry'
import { KIND, claim, notMarkedSinceCondition } from './noticeMarks'
/*
  D38: once a week, each group with new members tells its recently active members
  "N people joined this week, say hi", as one in-app notice per group with a link to
  the members list sorted by join date. It is an ambient notice: no push and no email.

  - New members: active memberships of the group created in the last
    NEW_MEMBER_WINDOW_DAYS days, by active accounts, not counting the group's creator.
  - Readers: active members who were active on Hylo in the last RECENTLY_ACTIVE_DAYS
    days, leaving out the new members themselves.
  - Top-level groups only: spaces that add everyone would repeat their group's notice.
    Archived groups are skipped.
  - Each group is marked (group_notice_marks, kind newcomer_notice) before its notices
    are written, and is due again only after MIN_DAYS_BETWEEN_NOTICES days, so a
    second run in the same week sends nothing.
  - One run handles at most MAX_GROUPS_PER_RUN groups and writes the activities and
    in-app notifications in batches of INSERT_BATCH_SIZE, so a large group doesn't go
    through the per-reader notification rules one by one. Groups that went longest
    without a notice come first (never first of all), then the busiest, so a group
    left out by the cap one week is among the first the next week.
*/

export const REASON = 'newMembersJoined'
export const NEW_MEMBER_WINDOW_DAYS = 7
export const RECENTLY_ACTIVE_DAYS = 14
export const MIN_DAYS_BETWEEN_NOTICES = 6
export const MAX_GROUPS_PER_RUN = 200
export const INSERT_BATCH_SIZE = 500

const DAY_MS = 24 * 60 * 60 * 1000

const daysBefore = (now, days) => new Date(now.getTime() - days * DAY_MS)

// Groups due a notice this week, with how many new members they have and the newest
// one: those that went longest without a notice first, then the busiest
export async function groupsWithNewMembers ({ now = new Date(), maxGroups = MAX_GROUPS_PER_RUN } = {}) {
  const notYet = notMarkedSinceCondition('g.id', KIND.NEWCOMER_NOTICE, daysBefore(now, MIN_DAYS_BETWEEN_NOTICES))
  const { rows } = await bookshelf.knex.raw(`
    SELECT g.id AS group_id,
      COUNT(*) AS new_member_count,
      (ARRAY_AGG(gm.user_id ORDER BY gm.created_at DESC, gm.id DESC))[1] AS newest_member_id
    FROM groups g
    JOIN group_memberships gm ON gm.group_id = g.id AND gm.active = true AND gm.created_at > ?
    JOIN users u ON u.id = gm.user_id AND u.active = true
    LEFT JOIN group_notice_marks served ON served.group_id = g.id AND served.kind = ?
    WHERE g.active = true AND g.parent_id IS NULL AND g.type IS DISTINCT FROM 'space'
      AND g.status IS DISTINCT FROM ?
      AND COALESCE(gm.settings->>'joinSource', '') <> ?
      AND ${notYet.sql}
    GROUP BY g.id, served.sent_at
    ORDER BY served.sent_at ASC NULLS FIRST, COUNT(*) DESC, g.id
    LIMIT ?
  `, [
    daysBefore(now, NEW_MEMBER_WINDOW_DAYS),
    KIND.NEWCOMER_NOTICE,
    Group.Status.ARCHIVED,
    GroupMembership.JoinSource.CREATOR,
    ...notYet.bindings,
    maxGroups
  ])
  return rows.map(row => ({
    groupId: String(row.group_id),
    newMemberCount: Number(row.new_member_count),
    newestMemberId: String(row.newest_member_id)
  }))
}

// Members active on Hylo lately who aren't new to the group themselves
export async function readerIds (groupId, { now = new Date() } = {}) {
  const { rows } = await bookshelf.knex.raw(`
    SELECT gm.user_id
    FROM group_memberships gm
    JOIN users u ON u.id = gm.user_id AND u.active = true
    WHERE gm.group_id = ? AND gm.active = true
      AND gm.created_at <= ?
      AND u.last_active_at > ?
    ORDER BY gm.user_id
  `, [groupId, daysBefore(now, NEW_MEMBER_WINDOW_DAYS), daysBefore(now, RECENTLY_ACTIVE_DAYS)])
  return rows.map(row => String(row.user_id))
}

// Writes one activity and one in-app notification per reader, batchSize at a time
async function insertNotices ({ groupId, newMemberCount, newestMemberId, readers, now, batchSize }) {
  const meta = JSON.stringify({ reasons: [REASON], newMemberCount })
  for (let i = 0; i < readers.length; i += batchSize) {
    const batch = readers.slice(i, i + batchSize)
    await bookshelf.transaction(async trx => {
      const activities = await bookshelf.knex('activities')
        .insert(batch.map(readerId => ({
          actor_id: newestMemberId,
          reader_id: readerId,
          group_id: groupId,
          meta,
          unread: true,
          created_at: now,
          updated_at: now
        })))
        .returning(['id', 'reader_id'])
        .transacting(trx)
      await bookshelf.knex('notifications')
        .insert(activities.map(activity => ({
          activity_id: activity.id,
          user_id: activity.reader_id,
          medium: Notification.MEDIUM.InApp,
          created_at: now,
          updated_at: now
        })))
        .transacting(trx)
    })
  }
}

/**
 * The weekly run (cron.js). Returns { groups, notices }: how many groups sent a
 * notice and how many notices were written. A group that fails is logged and
 * skipped, so it doesn't stop the rest.
 */
export async function runWeekly ({ now = new Date(), maxGroups = MAX_GROUPS_PER_RUN, batchSize = INSERT_BATCH_SIZE } = {}) {
  const due = await groupsWithNewMembers({ now, maxGroups })
  let groups = 0
  let notices = 0
  for (const { groupId, newMemberCount, newestMemberId } of due) {
    try {
      if (!await claim(groupId, KIND.NEWCOMER_NOTICE, now, { unlessAfter: daysBefore(now, MIN_DAYS_BETWEEN_NOTICES) })) continue
      const readers = await readerIds(groupId, { now })
      if (readers.length === 0) continue
      await insertNotices({ groupId, newMemberCount, newestMemberId, readers, now, batchSize })
      groups += 1
      notices += readers.length
    } catch (err) {
      sails.log.error(`New-member notices failed for group ${groupId}: ${err.message}`, err.stack)
      sentry.captureException(err, { extra: { job: 'newcomerBatch', groupId } })
    }
  }
  // The in-app notifications are sent (unread count and live update) by the usual job
  if (notices > 0) Queue.classMethod('Notification', 'sendUnsent')
  return { groups, notices }
}
