/* global bookshelf, Activity, Email, Frontend, Group, JoinRequest, Post, User */
/*
  The daily steward job (cron.js), for D13, D14 and D49:

  1. Tells people whose join request has had no answer for 14 days
     (JoinRequest.notifyUnanswered, D14).
  2. Prompts the stewards of a group that has gone quiet: members, but no posts or
     chats for QUIET_DAYS (D13). One in-app notice per quiet spell, plus a line in that
     week's steward email.
  3. On DIGEST_WEEKDAY, emails each steward of each group one weekly summary (D13):
     new members, join requests waiting more than WAITING_REQUEST_DAYS days, open
     reports in the moderation queue, posts and comments against the week before,
     newcomers' first posts that still have no response (D49), and the quiet line.

  Stewards are the people holding the Administrator, Moderator or Host role
  (group/stewardAudience.js), never people who can only add members. A steward turns
  the email off with the stewardDigest membership setting (false), which the toggle on
  their notification settings and the one-click unsubscribe set. The join-request
  notice itself stays immediate. Each group's email is sent at most once every
  MIN_DAYS_BETWEEN_DIGESTS days, and a group with nothing to report gets none.
*/
import { DateTime } from 'luxon'
import { getLocaleStrings } from '../i18n/locales'
import { senderNameForGroup } from '../email/senderNameViaHylo'
import { stewardIds } from '../../api/models/group/stewardAudience'
import { KIND, claim, lastSentAt, notMarkedSinceCondition } from '../../api/models/group/noticeMarks'
import { stillUnanswered } from '../../api/models/post/firstPostNudge'

export const DIGEST_WEEKDAY = 1 // Luxon: 1 is Monday
export const ZONE = 'America/Los_Angeles'
export const WEEK_DAYS = 7
export const MIN_DAYS_BETWEEN_DIGESTS = 6
export const WAITING_REQUEST_DAYS = 3
export const QUIET_DAYS = 30
// A group whose quiet spell began longer ago than this is left alone, so the first run
// doesn't prompt the stewards of every long-dormant group
export const QUIET_LOOKBACK_DAYS = 60
export const QUIET_MIN_MEMBERS = 2
export const MAX_QUIET_GROUPS_PER_RUN = 500
export const MAX_DIGEST_GROUPS_PER_RUN = 2000
export const LIST_LIMIT = 5
// Unsubscribe choices (email-prefs-delivery) under which a steward gets no steward email
export const SKIPPING_UNSUBSCRIBE_SCOPES = ['everything', 'no_group_emails']
export const QUIET_REASON = 'groupQuiet'

const DAY_MS = 24 * 60 * 60 * 1000
const daysBefore = (now, days) => new Date(now.getTime() - days * DAY_MS)
// Posts that aren't activity of the group's own members
const NOT_ACTIVITY_TYPES = ['chat_activity', 'welcome', 'thread']
const FEED_EXCLUDED_TYPES = ['chat', ...NOT_ACTIVITY_TYPES]
const typeNotIn = (alias, types) =>
  `(${alias}.type IS NULL OR ${alias}.type NOT IN (${types.map(t => `'${t}'`).join(', ')}))`

// Active top-level groups that aren't archived
const liveTopLevelGroup = alias =>
  `${alias}.active = true AND ${alias}.parent_id IS NULL AND ${alias}.type IS DISTINCT FROM 'space' AND ${alias}.status IS DISTINCT FROM 'archived'`

// The group and its spaces
const scopeSql = groupIdSql => `(SELECT s.id FROM groups s WHERE s.id = ${groupIdSql} OR s.parent_id = ${groupIdSql})`

/**
 * Groups that have gone quiet: at least QUIET_MIN_MEMBERS members, no posts or chats
 * (in the group or its spaces) for QUIET_DAYS, and a quiet spell that began less than
 * QUIET_LOOKBACK_DAYS ago with no prompt since. A group that never had a post counts
 * from its creation. Returns [{ groupId, quietSince }].
 */
export async function quietGroups ({ now = new Date(), limit = MAX_QUIET_GROUPS_PER_RUN } = {}) {
  const quietSince = daysBefore(now, QUIET_DAYS)
  const lookback = daysBefore(now, QUIET_LOOKBACK_DAYS)
  const { rows } = await bookshelf.knex.raw(`
    WITH recent AS (
      SELECT DISTINCT COALESCE(sg.parent_id, sg.id) AS group_id
      FROM posts p
      JOIN groups_posts gp ON gp.post_id = p.id
      JOIN groups sg ON sg.id = gp.group_id
      WHERE p.created_at > :quietSince AND p.active = true AND ${typeNotIn('p', NOT_ACTIVITY_TYPES)}
    ),
    went_quiet AS (
      SELECT COALESCE(sg.parent_id, sg.id) AS group_id, MAX(p.created_at) AS last_post_at
      FROM posts p
      JOIN groups_posts gp ON gp.post_id = p.id
      JOIN groups sg ON sg.id = gp.group_id
      WHERE p.created_at > :lookback AND p.created_at <= :quietSince AND p.active = true AND ${typeNotIn('p', NOT_ACTIVITY_TYPES)}
      GROUP BY 1
    )
    SELECT g.id AS group_id, COALESCE(w.last_post_at, g.created_at) AS quiet_since
    FROM groups g
    LEFT JOIN went_quiet w ON w.group_id = g.id
    WHERE ${liveTopLevelGroup('g')}
      AND g.id NOT IN (SELECT group_id FROM recent)
      AND (
        w.group_id IS NOT NULL
        OR (
          g.created_at > :lookback AND g.created_at <= :quietSince
          AND NOT EXISTS (
            SELECT 1 FROM groups_posts gp JOIN posts p ON p.id = gp.post_id AND p.active = true
            WHERE gp.group_id IN ${scopeSql('g.id')} AND ${typeNotIn('p', NOT_ACTIVITY_TYPES)}
          )
        )
      )
      AND (
        SELECT COUNT(*) FROM group_memberships gm
        JOIN users u ON u.id = gm.user_id AND u.active = true
        WHERE gm.group_id = g.id AND gm.active = true
      ) >= :minMembers
      AND NOT EXISTS (
        SELECT 1 FROM group_notice_marks mark
        WHERE mark.group_id = g.id AND mark.kind = :kind AND mark.sent_at > COALESCE(w.last_post_at, g.created_at)
      )
    ORDER BY g.id
    LIMIT :limit
  `, { quietSince, lookback, minMembers: QUIET_MIN_MEMBERS, kind: KIND.QUIET_PROMPT, limit })
  return rows.map(row => ({ groupId: String(row.group_id), quietSince: row.quiet_since }))
}

/**
 * Sends each quiet group's stewards one in-app prompt for this quiet spell.
 * Returns how many groups were prompted.
 */
export async function promptQuietGroups ({ now = new Date() } = {}) {
  const groups = await quietGroups({ now })
  let prompted = 0
  for (const { groupId, quietSince } of groups) {
    // Recorded first, unless a prompt already went out during this spell
    if (!await claim(groupId, KIND.QUIET_PROMPT, now, { unlessAfter: quietSince })) continue
    const stewards = await stewardIds(groupId)
    await Activity.saveForReasons(stewards.map(stewardId => ({
      actor_id: stewardId,
      reader_id: stewardId,
      group_id: groupId,
      reason: QUIET_REASON,
      meta: { quietDays: QUIET_DAYS }
    })))
    prompted += 1
  }
  return prompted
}

/**
 * Groups with stewards and something to report this week, not emailed in the last
 * MIN_DAYS_BETWEEN_DIGESTS days. Returns group ids.
 */
export async function digestGroupIds ({ now = new Date(), limit = MAX_DIGEST_GROUPS_PER_RUN } = {}) {
  const weekAgo = daysBefore(now, WEEK_DAYS)
  const notYet = notMarkedSinceCondition('g.id', KIND.STEWARD_DIGEST, daysBefore(now, MIN_DAYS_BETWEEN_DIGESTS))
  const { rows } = await bookshelf.knex.raw(`
    SELECT g.id
    FROM groups g
    WHERE ${liveTopLevelGroup('g')}
      AND ${notYet.sql}
      AND EXISTS (
        SELECT 1 FROM group_memberships_group_roles mgr
        JOIN groups_roles gr ON gr.id = mgr.group_role_id AND gr.group_id = g.id AND gr.active = true
          AND gr.type = 'system' AND gr.name IN ('Administrator', 'Coordinator', 'Moderator', 'Host')
        WHERE mgr.group_id = g.id AND mgr.active IS NOT FALSE
      )
      AND (
        EXISTS (SELECT 1 FROM group_memberships gm WHERE gm.group_id = g.id AND gm.active = true AND gm.created_at > ?)
        OR EXISTS (SELECT 1 FROM join_requests jr WHERE jr.group_id IN ${scopeSql('g.id')} AND jr.status = ?)
        OR EXISTS (SELECT 1 FROM moderation_actions ma WHERE ma.group_id IN ${scopeSql('g.id')} AND ma.queue = 'group' AND ma.status = 'active')
        OR EXISTS (
          SELECT 1 FROM groups_posts gp JOIN posts p ON p.id = gp.post_id AND p.active = true AND p.created_at > ?
          WHERE gp.group_id IN ${scopeSql('g.id')}
        )
        OR EXISTS (SELECT 1 FROM first_post_nudges n WHERE n.group_id IN ${scopeSql('g.id')} AND n.nudged_at > ?)
        OR EXISTS (SELECT 1 FROM group_notice_marks q WHERE q.group_id = g.id AND q.kind = ? AND q.sent_at > ?)
      )
    ORDER BY g.id
    LIMIT ?
  `, [
    ...notYet.bindings,
    weekAgo,
    JoinRequest.STATUS.Pending,
    daysBefore(now, 2 * WEEK_DAYS),
    weekAgo,
    KIND.QUIET_PROMPT,
    weekAgo,
    limit
  ])
  return rows.map(row => String(row.id))
}

async function count (sql, bindings) {
  const { rows } = await bookshelf.knex.raw(sql, bindings)
  return Number(rows[0].count)
}

/**
 * What the week's email reports for a group, the same for each of its stewards.
 */
export async function sectionsFor (group, { now = new Date() } = {}) {
  const groupId = group.id
  const weekAgo = daysBefore(now, WEEK_DAYS)
  const twoWeeksAgo = daysBefore(now, 2 * WEEK_DAYS)
  const scope = scopeSql('?')

  const newMembers = (await bookshelf.knex.raw(`
    SELECT u.id, u.name, u.avatar_url, COUNT(*) OVER () AS total
    FROM group_memberships gm
    JOIN users u ON u.id = gm.user_id AND u.active = true
    WHERE gm.group_id = ? AND gm.active = true AND gm.created_at > ?
    ORDER BY gm.created_at DESC, gm.id DESC
    LIMIT ?
  `, [groupId, weekAgo, LIST_LIMIT])).rows

  const waitingRequests = (await bookshelf.knex.raw(`
    SELECT u.id, u.name, u.avatar_url, jr.created_at, COUNT(*) OVER () AS total
    FROM join_requests jr
    JOIN users u ON u.id = jr.user_id AND u.active = true
    WHERE jr.group_id IN ${scope} AND jr.status = ? AND jr.created_at < ?
    ORDER BY jr.created_at ASC, jr.id ASC
    LIMIT ?
  `, [groupId, groupId, JoinRequest.STATUS.Pending, daysBefore(now, WAITING_REQUEST_DAYS), LIST_LIMIT])).rows

  // Reports in the group's moderation queue (posts and comments), not the legacy flags
  const openReports = await count(`
    SELECT COUNT(*) AS count FROM moderation_actions
    WHERE group_id IN ${scope} AND queue = 'group' AND status = 'active'
  `, [groupId, groupId])
  const newReports = await count(`
    SELECT COUNT(*) AS count FROM moderation_actions
    WHERE group_id IN ${scope} AND queue = 'group' AND created_at > ?
  `, [groupId, groupId, weekAgo])

  const postsBetween = (from, to) => count(`
    SELECT COUNT(DISTINCT p.id) AS count FROM posts p
    JOIN groups_posts gp ON gp.post_id = p.id AND gp.group_id IN ${scope}
    WHERE p.active = true AND ${typeNotIn('p', FEED_EXCLUDED_TYPES)} AND p.created_at > ? AND p.created_at <= ?
  `, [groupId, groupId, from, to])
  const commentsBetween = (from, to) => count(`
    SELECT COUNT(DISTINCT c.id) AS count FROM comments c
    JOIN groups_posts gp ON gp.post_id = c.post_id AND gp.group_id IN ${scope}
    WHERE c.active = true AND c.created_at > ? AND c.created_at <= ?
  `, [groupId, groupId, from, to])

  const scopeIds = (await bookshelf.knex.raw('SELECT id FROM groups WHERE id = ? OR parent_id = ?', [groupId, groupId])).rows.map(row => String(row.id))
  const firstPosts = await stillUnanswered(scopeIds, { since: weekAgo, limit: LIST_LIMIT })

  const quietPromptAt = await lastSentAt(groupId, KIND.QUIET_PROMPT)

  return {
    newMembers,
    newMemberCount: newMembers.length ? Number(newMembers[0].total) : 0,
    waitingRequests,
    waitingRequestCount: waitingRequests.length ? Number(waitingRequests[0].total) : 0,
    openReports,
    newReports,
    postsThisWeek: await postsBetween(weekAgo, now),
    postsLastWeek: await postsBetween(twoWeeksAgo, weekAgo),
    commentsThisWeek: await commentsBetween(weekAgo, now),
    commentsLastWeek: await commentsBetween(twoWeeksAgo, weekAgo),
    firstPosts,
    quiet: !!quietPromptAt && new Date(quietPromptAt) > weekAgo
  }
}

export function hasNews (sections) {
  return sections.newMemberCount > 0 ||
    sections.waitingRequestCount > 0 ||
    sections.openReports > 0 ||
    sections.postsThisWeek + sections.postsLastWeek + sections.commentsThisWeek + sections.commentsLastWeek > 0 ||
    sections.firstPosts.length > 0 ||
    sections.quiet
}

/**
 * The group's stewards who get the email: not turned off (stewardDigest false), with
 * an email address, and no unsubscribe choice that stops group email.
 */
export async function recipients (groupId) {
  const ids = await stewardIds(groupId)
  if (ids.length === 0) return []
  const { rows } = await bookshelf.knex.raw(`
    SELECT u.id FROM users u
    JOIN group_memberships gm ON gm.user_id = u.id AND gm.group_id = ? AND gm.active = true
    WHERE u.id IN (${ids.map(() => '?').join(', ')})
      AND u.email IS NOT NULL AND u.email <> ''
      AND COALESCE(gm.settings->>'stewardDigest', 'true') <> 'false'
      AND COALESCE(u.settings->>'email_unsubscribe_scope', '') NOT IN (${SKIPPING_UNSUBSCRIBE_SCOPES.map(() => '?').join(', ')})
    ORDER BY u.id
  `, [groupId, ...ids, ...SKIPPING_UNSUBSCRIBE_SCOPES])
  return rows.map(row => String(row.id))
}

// The template data for one steward
export async function emailData ({ group, sections, steward, locale }) {
  const clickthroughParams = '?' + new URLSearchParams({
    ctt: 'steward_weekly_email',
    cti: steward.id,
    ctcn: group.get('name')
  }).toString()
  const link = url => Frontend.appendQueryString(url, clickthroughParams)
  const groupUrl = Frontend.Route.group(group)
  const now = Date.now()

  const people = await User.query(q => q.whereIn('id', sections.firstPosts.map(p => p.userId))).fetchAll()
  const posts = await Post.query(q => q.whereIn('id', sections.firstPosts.map(p => p.postId))).fetchAll()

  return {
    subject: getLocaleStrings(locale).stewardWeeklySubject(group.get('name')),
    first_name: steward.get('first_name') || steward.get('name'),
    group_name: group.get('name'),
    group_avatar_url: group.get('avatar_url'),
    group_url: link(Frontend.Route.groupHome(group)),

    new_member_count: sections.newMemberCount,
    new_members: sections.newMembers.map(member => ({
      name: member.name,
      avatar_url: member.avatar_url,
      profile_url: link(Frontend.Route.profile(member.id, group))
    })),
    members_url: link(groupUrl + '/members?s=join'),

    waiting_request_count: sections.waitingRequestCount,
    waiting_requests: sections.waitingRequests.map(request => ({
      name: request.name,
      avatar_url: request.avatar_url,
      days_waiting: Math.floor((now - new Date(request.created_at).getTime()) / DAY_MS)
    })),
    join_requests_url: link(Frontend.Route.groupJoinRequests(group)),

    open_report_count: sections.openReports,
    new_report_count: sections.newReports,
    moderation_url: link(groupUrl + '/moderation'),

    posts_this_week: sections.postsThisWeek,
    posts_last_week: sections.postsLastWeek,
    comments_this_week: sections.commentsThisWeek,
    comments_last_week: sections.commentsLastWeek,

    unanswered_first_posts: sections.firstPosts.map(({ postId, userId }) => {
      const author = people.find(person => String(person.id) === String(userId))
      const post = posts.find(p => String(p.id) === String(postId))
      return {
        author_name: author ? author.get('name') : null,
        author_avatar_url: author ? author.get('avatar_url') : null,
        title: post ? post.summary() : null,
        url: post ? link(Frontend.Route.post(post, group)) : null
      }
    }),

    group_quiet: sections.quiet,
    quiet_days: QUIET_DAYS,
    create_post_url: link(Frontend.Route.groupHome(group) + '?create=post&newPostType=discussion'),

    email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, steward),
    steward_settings_url: link(Frontend.Route.prefix + `/my/notifications?group=${group.id}`)
  }
}

/**
 * Emails each group's stewards their weekly summary. Returns { groups, emails }.
 */
export async function sendWeeklyEmails ({ now = new Date(), limit = MAX_DIGEST_GROUPS_PER_RUN } = {}) {
  const groupIds = await digestGroupIds({ now, limit })
  let groups = 0
  let emails = 0
  for (const groupId of groupIds) {
    const group = await Group.find(groupId)
    if (!group) continue
    const sections = await sectionsFor(group, { now })
    if (!hasNews(sections)) continue
    const stewardIdsToEmail = await recipients(groupId)
    if (stewardIdsToEmail.length === 0) continue
    // Recorded first, so an overlapping run doesn't send the same week twice
    if (!await claim(groupId, KIND.STEWARD_DIGEST, now, { unlessAfter: daysBefore(now, MIN_DAYS_BETWEEN_DIGESTS) })) continue
    groups += 1
    for (const stewardId of stewardIdsToEmail) {
      const steward = await User.find(stewardId)
      if (!steward) continue
      const locale = steward.getLocale()
      await Email.sendStewardWeekly({
        email: steward.get('email'),
        locale,
        sender: { name: await senderNameForGroup(group, locale) },
        data: await emailData({ group, sections, steward, locale }),
        // For the one-click unsubscribe: it turns off this steward's stewardDigest
        // setting for this group (lib/email/emailTypes.js)
        unsubscribe: { userId: steward.id, groupId: group.id }
      })
      emails += 1
    }
  }
  return { groups, emails }
}

/**
 * The daily run. `weekday` is Luxon's (1 is Monday) in ZONE.
 */
export async function runDaily ({ now = new Date(), weekday = DateTime.fromJSDate(now).setZone(ZONE).weekday } = {}) {
  const unanswered = await JoinRequest.notifyUnanswered({ now })
  const quiet = await promptQuietGroups({ now })
  const weekly = weekday === DIGEST_WEEKDAY
    ? await sendWeeklyEmails({ now })
    : { groups: 0, emails: 0 }
  return { unanswered, quiet, weekly }
}
