import { GraphQLError } from 'graphql'
import { addPeriod, parseDay, utcDay } from '../periods'
import { METRICS } from './registry'

const FILTERS = {
  contributors: '(posts + comments + reactions + rsvps + votes + project_joins) > 0',
  contributors_30d: '(posts + comments + reactions + rsvps + votes + project_joins) > 0',
  contributors_posting: '(posts > 0 or comments > 0)',
  connected_members: '(connections + received_connections) > 0',
  connected_beyond_reaction: '(connections_beyond_reaction + received_beyond_reaction) > 0',
  coordinating_members: '(coordinating + received_coordinating) > 0',
  weekly_active_contributors: '(posts + comments + reactions + rsvps + votes + project_joins) > 0',
  monthly_active_contributors: '(posts + comments + reactions + rsvps + votes + project_joins) > 0',
  weekly_connected_members: '(connections + received_connections) > 0'
}

/**
 * Hylo admins can see anyone. A group's stewards can see that group's members.
 */
async function assertAccess (userId, groupId) {
  if (!groupId || String(groupId) === '0') {
    if (!(await Admin.isSuperAdmin(userId))) throw new GraphQLError('Unauthorized')
    return 0
  }
  const allowed = await GroupMembership.hasResponsibility(userId, groupId, Responsibility.constants.RESP_ADMINISTRATION)
  if (!allowed) throw new GraphQLError("You don't have permission to view this group's metrics")
  return Number(groupId)
}

/**
 * The people counted in a person-based metric for one period.
 * Group stewards only see members of their group.
 */
export async function readMetricPeople (userId, { metric, groupId = 0, period = 'week', periodStart, offset = 0 }) {
  const entry = METRICS[metric]
  const listsPeople = entry && (entry.people || FILTERS[metric] || metric === 'active_users')
  if (!listsPeople) throw new GraphQLError('This metric does not list people')
  const scopedGroup = await assertAccess(userId, groupId)
  const start = parseDay(periodStart)
  const end = utcDay(addPeriod(start, period === 'day' ? 'day' : period === 'month' ? 'month' : 'week'))
  const fromDate = parseDay(periodStart)
  if (metric === 'contributors_30d') fromDate.setUTCDate(fromDate.getUTCDate() - 29)
  const from = utcDay(fromDate)
  const limit = 50
  const startAt = Math.max(0, Number(offset) || 0)
  const memberOnly = scopedGroup
    ? 'and exists (select 1 from group_memberships gm where gm.user_id = u.id and gm.group_id = ? and gm.active)'
    : ''
  const memberBinding = scopedGroup ? [scopedGroup] : []

  const filter = FILTERS[metric]
  const listSql = metric === 'active_users' || !filter
    ? `
      select u.id, u.name, u.avatar_url, count(*)::int as count
      from activity_days d
      join users u on u.id = d.user_id and u.active is not false
      where d.day >= ?::date and d.day < ?::date and d.user_id <> 13986
        and ${scopedGroup ? 'd.group_id = ?' : 'd.group_id = 0'}
        ${memberOnly}
      group by u.id, u.name, u.avatar_url
      order by count desc, u.id
      limit ${limit} offset ${startAt}
    `
    : `
      select u.id, u.name, u.avatar_url,
        sum(posts + comments + reactions + rsvps + votes + project_joins)::int as count
      from user_day_activity a
      join users u on u.id = a.user_id and u.active is not false
      where a.day >= ?::date and a.day < ?::date and (${filter})
        and ${scopedGroup ? 'a.group_id = ?' : 'a.group_id <> 0'}
        ${memberOnly}
      group by u.id, u.name, u.avatar_url
      order by count desc, u.id
      limit ${limit} offset ${startAt}
    `
  const bindings = scopedGroup ? [from, end, scopedGroup, ...memberBinding] : [from, end]
  const rows = (await bookshelf.knex.raw(listSql, bindings)).rows || []
  return {
    total: rows.length < limit ? startAt + rows.length : startAt + limit + 1,
    people: rows.map(row => ({
      id: row.id,
      name: row.name,
      avatarUrl: row.avatar_url,
      count: Number(row.count) || 0
    }))
  }
}
