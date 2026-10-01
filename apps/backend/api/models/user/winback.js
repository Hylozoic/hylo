/* global bookshelf, Email, Frontend, User, sails */
// One win-back email when a member passes 180 days away (D9). Runs daily (cron.js).
//
// Each absence gets at most one: users.settings.winback_sent_at is written before the
// email goes out, and a visit after it resets it (the daily run clears it for anyone
// active since), so the next absence can have its own.
//
// Only people who crossed the line in the last WINDOW_DAYS are emailed, so nobody gets a
// win-back for an absence that began long before this shipped, and a missed run still
// catches up. Nothing is sent, and nobody is marked, until the template exists
// (Email.winbackTemplateReady).
import { DORMANT_DAYS, daysAgo } from '../notification/rules/inactiveReader'
import { UNSUBSCRIBE_SCOPE, UNSUBSCRIBE_SCOPE_SETTING } from '../notification/rules/unsubscribeScope'

export const WINBACK_SETTING = 'winback_sent_at'
export const WINDOW_DAYS = 14
const BATCH_SIZE = 500
const GROUPS_IN_EMAIL = 3

const LAST_SEEN = 'coalesce(users.last_active_at, users.created_at)'

const setSetting = (userId, values) => bookshelf.knex('users')
  .where({ id: userId })
  .update({ settings: bookshelf.knex.raw('coalesce(settings, \'{}\'::jsonb) || ?::jsonb', [JSON.stringify(values)]) })

// A visit after the win-back went out resets it
export function resetReturnedMembers () {
  return bookshelf.knex('users')
    .whereRaw('settings->>? is not null', [WINBACK_SETTING])
    .whereRaw('users.last_active_at > (settings->>?)::timestamptz', [WINBACK_SETTING])
    .update({ settings: bookshelf.knex.raw('settings - ?::text', [WINBACK_SETTING]) })
}

// Members who passed DORMANT_DAYS away in the last WINDOW_DAYS and haven't had a win-back
// for this absence: active accounts in at least one active group, with a deliverable
// address and no unsubscribe choice that rules this email out
export function winbackCandidateIds (now = new Date()) {
  return bookshelf.knex('users')
    .where('users.active', true)
    .whereNull('users.email_undeliverable_at')
    .whereRaw(`${LAST_SEEN} <= ?`, [daysAgo(DORMANT_DAYS, now)])
    .whereRaw(`${LAST_SEEN} > ?`, [daysAgo(DORMANT_DAYS + WINDOW_DAYS, now)])
    .whereRaw(`(users.settings->>'${WINBACK_SETTING}' is null or (users.settings->>'${WINBACK_SETTING}')::timestamptz < ${LAST_SEEN})`)
    .whereRaw(`coalesce(users.settings->>'${UNSUBSCRIBE_SCOPE_SETTING}', '') not in (?, ?)`,
      [UNSUBSCRIBE_SCOPE.ALL_BUT_DIRECT, UNSUBSCRIBE_SCOPE.EVERYTHING])
    .whereExists(function () {
      this.select(bookshelf.knex.raw(1))
        .from('group_memberships')
        .join('groups', 'groups.id', 'group_memberships.group_id')
        .whereRaw('group_memberships.user_id = users.id')
        .where('group_memberships.active', true)
        .where('groups.active', true)
    })
    .orderBy('users.id')
    .limit(BATCH_SIZE)
    .pluck('users.id')
}

// Up to three of their groups, busiest first, with how many posts went up while they were away
async function groupsFor (user, since) {
  const rows = await bookshelf.knex('group_memberships')
    .join('groups', 'groups.id', 'group_memberships.group_id')
    .where('group_memberships.user_id', user.id)
    .where('group_memberships.active', true)
    .where('groups.active', true)
    .where(function () {
      this.whereNull('groups.type').orWhere('groups.type', '<>', 'space')
    })
    .select('groups.id', 'groups.name', 'groups.slug', bookshelf.knex.raw(`(
      select count(*) from groups_posts
      join posts on posts.id = groups_posts.post_id
      where groups_posts.group_id = groups.id
        and posts.active = true
        and posts.created_at > ?
        and (posts.type is null or posts.type not in ('chat', 'welcome', 'thread'))
    )::int as new_post_count`, [since]))
    .orderBy('new_post_count', 'desc')
    .orderBy('groups.id')
    .limit(GROUPS_IN_EMAIL)

  return rows.map(row => ({
    name: row.name,
    url: Frontend.Route.group(row.slug),
    new_post_count: row.new_post_count
  }))
}

export async function winbackData (user) {
  const clickthroughParams = '?' + new URLSearchParams({ ctt: 'winback_email', cti: user.id }).toString()
  const name = user.get('name') || ''
  const since = user.get('last_active_at') || user.get('created_at')
  return {
    first_name: user.get('first_name') || name.split(' ')[0] || name,
    home_url: Frontend.appendQueryString(Frontend.Route.root(), clickthroughParams),
    email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, user),
    groups: await groupsFor(user, since)
  }
}

export async function sendWinbackEmails ({ now = new Date() } = {}) {
  await resetReturnedMembers()
  if (!Email.winbackTemplateReady()) return 0

  const ids = await winbackCandidateIds(now)
  let sent = 0
  for (const id of ids) {
    try {
      const user = await User.where({ id }).fetch()
      if (!user) continue
      // Marked first, so a failure or a second run never sends a second one
      await setSetting(user.id, { [WINBACK_SETTING]: now.toISOString() })
      const result = await Email.sendWinbackEmail({
        email: user.get('email'),
        locale: user.getLocale(),
        data: await winbackData(user)
      })
      if (result && result !== Email.SKIPPED) sent += 1
    } catch (err) {
      sails.log.error(`winback: could not send to user ${id}: ${err.message}`)
    }
  }
  return sent
}
