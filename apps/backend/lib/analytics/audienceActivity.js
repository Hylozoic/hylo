import { AXOLOTL_ID } from './constants'
import { parseDay, utcDay } from './periods'

/** A YYYY-MM-DD that many days away. Negative steps go backward. */
function shiftDay (day, days) {
  const date = parseDay(String(day).slice(0, 10))
  date.setUTCDate(date.getUTCDate() + days)
  return utcDay(date)
}

/** A date from Postgres as YYYY-MM-DD. */
function dayString (value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

/**
 * Daily, weekly and monthly active people for each day from `from` through `to`.
 * A person counts when they opened Hylo or did anything that day. Weekly is the
 * 7 days ending that day, monthly the 30 days ending that day.
 */
export async function audienceActivity ({ knex, groupId, from, to }) {
  const start = shiftDay(from, -30)
  const end = shiftDay(to, 1)
  const id = Number(groupId) || 0
  const result = await knex.raw(`
    with events as (
      select (e.occurred_at at time zone 'UTC')::date as day,
        case when e.group_id = 0 then 0 when g.type = 'space' and g.parent_id is not null then g.parent_id else e.group_id end as group_id,
        e.user_id
      from activity_events e
      join users u on u.id = e.user_id and u.active is not false
      left join groups g on g.id = e.group_id
      where e.occurred_at >= ? and e.occurred_at < ?
        and e.user_id <> ${AXOLOTL_ID}
    ),
    visits as (
      select d.day,
        case when d.group_id = 0 then 0 when g.type = 'space' and g.parent_id is not null then g.parent_id else d.group_id end as group_id,
        d.user_id
      from activity_days d
      join users u on u.id = d.user_id and u.active is not false
      left join groups g on g.id = d.group_id
      where d.day >= ?::date and d.day < ?::date
        and d.user_id <> ${AXOLOTL_ID}
    ),
    people as (
      select distinct day, user_id from (
        select day, group_id, user_id from events
        union all
        select day, group_id, user_id from visits
      ) rows
      where (?::int = 0 or group_id = ?::int)
    ),
    days as (
      select generate_series(?::date, ?::date, interval '1 day')::date as day
    )
    select d.day as period_start,
      count(distinct p.user_id) filter (where p.day = d.day)::int as dau,
      count(distinct p.user_id) filter (where p.day > d.day - 7 and p.day <= d.day)::int as wau,
      count(distinct p.user_id) filter (where p.day > d.day - 30 and p.day <= d.day)::int as mau
    from days d
    left join people p on p.day > d.day - 30 and p.day <= d.day
    group by d.day
    order by d.day
  `, [
    `${start}T00:00:00.000Z`,
    `${end}T00:00:00.000Z`,
    start,
    end,
    id,
    id,
    String(from).slice(0, 10),
    String(to).slice(0, 10)
  ])

  const points = { active_users: [], wau: [], mau: [] }
  for (const row of result.rows || []) {
    const periodStart = dayString(row.period_start)
    points.active_users.push({ periodStart, value: Number(row.dau) || 0, dimension: '' })
    points.wau.push({ periodStart, value: Number(row.wau) || 0, dimension: '' })
    points.mau.push({ periodStart, value: Number(row.mau) || 0, dimension: '' })
  }
  return points
}
