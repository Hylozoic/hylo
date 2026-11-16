import { AXOLOTL_ID, isSmallCohort } from '../constants'
import { addPeriod, parseDay, startOfWeek, utcDay } from '../periods'
import { refreshGroupWeek } from '../rollups'
import { connectedPeopleSql } from '../connections'
import { queryRows, saveMetric } from './save'

const CONTRIB = '(posts + comments + reactions + rsvps + votes + project_joins) > 0'
const POSTING = '(posts > 0 or comments > 0)'
const DAY_MS = 24 * 60 * 60 * 1000

/** The half-open range of a stored period. */
function bounds (periodStart, period) {
  const start = parseDay(periodStart)
  const end = addPeriod(start, period)
  return { start, end, days: [utcDay(start), utcDay(end)], iso: [start.toISOString(), end.toISOString()] }
}

/** True once `waitDays` have passed after the period ended. */
function isMature (end, waitDays, now) {
  return end.getTime() + waitDays * DAY_MS <= now.getTime()
}

/** Turns numerator and denominator rows into a rate, hiding small groups. */
function rateRows (rows, dimension = '') {
  const out = []
  for (const row of rows) {
    const denominator = Number(row.denominator)
    const numerator = Number(row.numerator)
    if (!denominator || isSmallCohort(row.group_id, denominator)) continue
    out.push({ group_id: row.group_id, dimension: 'numerator', value: numerator })
    out.push({ group_id: row.group_id, dimension: 'denominator', value: denominator })
    out.push({ group_id: row.group_id, dimension: row.dimension || dimension, value: numerator / denominator })
  }
  return out
}

/** Distinct people per group, plus a platform row, for a day range. */
function peopleSql (where) {
  return `
    select group_id, count(distinct user_id)::int as value from user_day_activity
    where day >= ?::date and day < ?::date and group_id <> 0 and (${where})
    group by group_id
    union all
    select 0, count(distinct user_id)::int from user_day_activity
    where day >= ?::date and day < ?::date and group_id <> 0 and (${where})
  `
}

/** Contributors over the 30 days ending on this day. */
async function contributors30d (knex, periodStart) {
  const end = utcDay(addPeriod(parseDay(periodStart), 'day'))
  const rows = await queryRows(knex, peopleSql(CONTRIB), [periodStart, end, periodStart, end].map((day, index) => {
    if (index % 2 === 0) {
      const from = parseDay(day)
      from.setUTCDate(from.getUTCDate() - 29)
      return utcDay(from)
    }
    return day
  }))
  await saveMetric(knex, 'contributors_30d', 'day', periodStart, rows)
}

/** Week-sized people counts and the group activity metrics. */
async function computeWeek (knex, periodStart, now) {
  const { end, days, iso } = bounds(periodStart, 'week')
  if (end > now) return
  const [from, to] = days
  const twice = [from, to, from, to]

  await saveMetric(knex, 'contributors_posting', 'week', periodStart, await queryRows(knex, peopleSql(POSTING), twice))
  await saveMetric(knex, 'connected_beyond_reaction', 'week', periodStart, await queryRows(knex, connectedPeopleSql({ reactions: false }), [...iso, ...iso, ...iso, ...iso]))
  await saveMetric(knex, 'coordinating_members', 'week', periodStart, await queryRows(knex, peopleSql('(coordinating + received_coordinating) > 0'), twice))

  const levelRows = await queryRows(knex, `
    select 0 as group_id, '' as dimension, count(*) filter (where voices_28d >= 3)::int as value from group_activity_weeks where week_start = ?::date
    union all select 0, '1', count(*) filter (where voices_28d >= 1)::int from group_activity_weeks where week_start = ?::date
    union all select 0, '5', count(*) filter (where voices_28d >= 5)::int from group_activity_weeks where week_start = ?::date
    union all select 0, '10', count(*) filter (where voices_28d >= 10)::int from group_activity_weeks where week_start = ?::date
    union all select group_id, '', case when voices_28d >= 3 then 1 else 0 end from group_activity_weeks where week_start = ?::date
  `, [from, from, from, from, from])
  await saveMetric(knex, 'live_groups', 'week', periodStart, levelRows)

  const previous = utcDay(new Date(parseDay(from).getTime() - 7 * DAY_MS))
  await saveMetric(knex, 'live_group_survival', 'week', periodStart, await queryRows(knex, `
    with curr as (
      select group_id from group_activity_weeks where week_start = ?::date and voices_28d >= 3
    ), prev as (
      select group_id from group_activity_weeks where week_start = ?::date and voices_28d >= 3
    )
    select 0 as group_id, '' as dimension,
      (select count(*) from curr c join prev p using (group_id))::float / nullif((select count(*) from prev), 0) as value
    union all
    select p.group_id, '', case when c.group_id is null then 0 else 1 end
    from prev p left join curr c using (group_id)
  `, [from, previous]))

  await saveMetric(knex, 'connection_concentration', 'week', periodStart, await queryRows(knex, `
    with ranked as (
      select connections_28d, sum(connections_28d) over () as total,
        row_number() over (order by connections_28d desc, group_id) as n
      from group_activity_weeks where week_start = ?::date and group_id <> 0
    )
    select 0 as group_id, '' as dimension, sum(connections_28d) filter (where n <= 10)::float / nullif(max(total), 0) as value
    from ranked
  `, [from]))

  await saveMetric(knex, 'live_groups_linked', 'week', periodStart, await queryRows(knex, `
    select 0 as group_id, '' as dimension,
      count(*) filter (where exists (
        select 1 from group_relationships r
        where r.active and (r.parent_group_id = w.group_id or r.child_group_id = w.group_id)
      ))::float / nullif(count(*), 0) as value
    from group_activity_weeks w
    where w.week_start = ?::date and w.voices_28d >= 3
  `, [from]))

  await saveMetric(knex, 'place_coverage_live_groups', 'week', periodStart, await queryRows(knex, `
    select 0 as group_id, '' as dimension,
      count(*) filter (where g.location_id is not null)::float / nullif(count(*), 0) as value
    from group_activity_weeks w
    join groups g on g.id = w.group_id
    where w.week_start = ?::date and w.voices_28d >= 3
  `, [from]))

  await saveMetric(knex, 'average_dau', 'week', periodStart, await queryRows(knex, `
    select group_id, '' as dimension, avg(value) as value from metric_snapshots
    where metric = 'active_users' and period = 'day' and dimension = ''
      and period_start >= ?::date and period_start < ?::date
    group by group_id
  `, [from, to]))

  if (isMature(end, 7, now)) await weekResponseMetrics(knex, periodStart, from, to)
  await saveMetric(knex, 'reciprocal_tie_members', 'week', periodStart, await queryRows(knex, `
    with edges as (
      select group_id, user_id, target_user_id, min(occurred_at) as at
      from activity_events
      where event_type in ('comment_created','reaction_added','event_rsvp','proposal_vote','project_joined')
        and target_user_id is not null and target_user_id <> user_id
        and user_id <> ${AXOLOTL_ID} and group_id <> 0
        and occurred_at >= ?::timestamptz - interval '90 days' and occurred_at < ?::timestamptz
      group by 1, 2, 3
    )
    select a.group_id, '' as dimension, count(distinct a.user_id)::int as value
    from edges a
    join edges b on a.group_id = b.group_id and a.user_id = b.target_user_id and a.target_user_id = b.user_id
    group by a.group_id
    union all
    select 0, '', count(distinct a.user_id)::int
    from edges a
    join edges b on a.user_id = b.target_user_id and a.target_user_id = b.user_id
  `, [bounds(periodStart, 'week').iso[0], bounds(periodStart, 'week').iso[1]]))

  await saveMetric(knex, 'join_request_decision_time', 'week', periodStart, await queryRows(knex, `
    select group_id, 'median' as dimension, percentile_cont(0.5) within group (order by hours) as value from (
      ${decisionHours()}
    ) s group by group_id
    union all
    select group_id, 'p90', percentile_cont(0.9) within group (order by hours) from (
      ${decisionHours()}
    ) s group by group_id
    union all
    select group_id, 'within_48', avg(case when hours <= 48 then 1 else 0 end) from (
      ${decisionHours()}
    ) s group by group_id
    union all
    select group_id, '', percentile_cont(0.5) within group (order by hours) from (
      ${decisionHours()}
    ) s group by group_id
  `, [...bounds(periodStart, 'week').iso, ...bounds(periodStart, 'week').iso, ...bounds(periodStart, 'week').iso, ...bounds(periodStart, 'week').iso]))
}

/** Hours from a join request to the decision that closed it. */
function decisionHours () {
  return `
    select c.group_id, extract(epoch from (d.occurred_at - c.occurred_at)) / 3600 as hours
    from activity_events c
    join activity_events d
      on d.object_id = c.object_id and d.group_id = c.group_id and d.event_type = 'join_request_decided'
    where c.event_type = 'join_request_created' and d.occurred_at >= c.occurred_at
      and d.occurred_at >= ? and d.occurred_at < ?
  `
}

/** Answered and missed posts, once a week has had 7 days to receive a reply. */
async function weekResponseMetrics (knex, periodStart, from, to) {
  const missed = `
    first_response_hours is null or first_response_hours > 168
  `
  await saveMetric(knex, 'weekly_missed_connections', 'week', periodStart, await queryRows(knex, `
    select group_id, '' as dimension, count(distinct author_id)::int as value from post_outcomes p
    where created_at >= ?::date and created_at < ?::date
      and post_type not in ('thread','chat_activity','welcome','chat')
      and not exists (
        select 1 from post_outcomes answered
        where answered.author_id = p.author_id and answered.group_id = p.group_id
          and answered.created_at >= ?::date and answered.created_at < ?::date
          and answered.first_response_hours is not null and answered.first_response_hours <= 168
      )
    group by group_id
    union all
    select 0, '', count(distinct author_id)::int from post_outcomes p
    where created_at >= ?::date and created_at < ?::date
      and post_type not in ('thread','chat_activity','welcome','chat')
      and not exists (
        select 1 from post_outcomes answered
        where answered.author_id = p.author_id
          and answered.created_at >= ?::date and answered.created_at < ?::date
          and answered.first_response_hours is not null and answered.first_response_hours <= 168
      )
  `, [from, to, from, to, from, to, from, to]))

  await saveMetric(knex, 'where_connections_are_missed', 'week', periodStart, await queryRows(knex, `
    select 0 as group_id, post_type as dimension, avg(case when ${missed} then 1 else 0 end) as value
    from post_outcomes
    where created_at >= ?::date and created_at < ?::date and post_type not in ('thread','chat_activity','welcome','chat')
    group by post_type
    union all
    select 0, case when group_was_live then 'live' else 'not_live' end, avg(case when ${missed} then 1 else 0 end)
    from post_outcomes
    where created_at >= ?::date and created_at < ?::date and post_type not in ('thread','chat_activity','welcome','chat')
    group by 2
    union all
    select 0, case when author_newcomer then 'newcomer' else 'established' end, avg(case when ${missed} then 1 else 0 end)
    from post_outcomes
    where created_at >= ?::date and created_at < ?::date and post_type not in ('thread','chat_activity','welcome','chat')
    group by 2
  `, [from, to, from, to, from, to]))

  await saveMetric(knex, 'feed_post_response_rate_7d', 'week', periodStart, await queryRows(knex, `
    select group_id, '' as dimension,
      count(*) filter (where first_response_hours is not null and first_response_hours <= 168)::float / nullif(count(*), 0) as value
    from post_outcomes
    where created_at >= ?::date and created_at < ?::date and post_type in ('discussion','request','offer','resource','project')
    group by group_id
    union all
    select 0, '',
      count(*) filter (where first_response_hours is not null and first_response_hours <= 168)::float / nullif(count(*), 0)
    from post_outcomes
    where created_at >= ?::date and created_at < ?::date and post_type in ('discussion','request','offer','resource','project')
    union all
    select 0, 'median_hours', percentile_cont(0.5) within group (order by first_response_hours)
    from post_outcomes
    where created_at >= ?::date and created_at < ?::date and post_type in ('discussion','request','offer','resource','project')
      and first_response_hours is not null
  `, [from, to, from, to, from, to]))

  await saveMetric(knex, 'first_post_answered_7d', 'week', periodStart, await queryRows(knex, `
    select 0 as group_id, '' as dimension,
      count(*) filter (where first_response_hours is not null and first_response_hours <= 168)::float / nullif(count(*), 0) as value
    from post_outcomes
    where created_at >= ?::date and created_at < ?::date and is_first_post
  `, [from, to]))
}

/** Month-sized activation, retention and outcome metrics. */
async function computeMonth (knex, periodStart, now) {
  const { end, days, iso } = bounds(periodStart, 'month')
  if (end > now) return
  const [from, to] = days

  if (isMature(end, 7, now)) {
    await saveMetric(knex, 'signup_joined_group_7d', 'month', periodStart, rateRows(await queryRows(knex, `
      with signups as (
        select user_id, occurred_on from user_milestones
        where milestone = 'signup' and group_id = 0 and occurred_on >= ?::date and occurred_on < ?::date
      )
      select 0 as group_id,
        count(*) filter (where exists (
          select 1 from user_milestones j
          where j.user_id = signups.user_id and j.milestone = 'group_joined'
            and j.occurred_on >= signups.occurred_on and j.occurred_on <= signups.occurred_on + 7
        ))::int as numerator,
        count(*)::int as denominator
      from signups
    `, [from, to])))
  }

  if (isMature(end, 30, now)) {
    await saveMetric(knex, 'signup_contributed_30d', 'month', periodStart, rateRows(await queryRows(knex, `
      with signups as (
        select user_id, occurred_on from user_milestones
        where milestone = 'signup' and group_id = 0 and occurred_on >= ?::date and occurred_on < ?::date
      )
      select 0 as group_id,
        count(*) filter (where exists (
          select 1 from user_day_activity a
          where a.user_id = signups.user_id and a.day >= signups.occurred_on and a.day < signups.occurred_on + 30
            and ${CONTRIB}
        ))::int as numerator,
        count(*)::int as denominator
      from signups
    `, [from, to])))
    await saveMetric(knex, 'new_groups_second_voice_30d', 'month', periodStart, rateRows(await queryRows(knex, `
      with created as (
        select object_id as group_id, user_id as creator, (occurred_at at time zone 'UTC')::date as day
        from activity_events
        where event_type = 'group_created' and occurred_at >= ? and occurred_at < ? and user_id is not null
      )
      select 0 as group_id,
        count(*) filter (where exists (
          select 1 from user_day_activity a
          where a.group_id = created.group_id and a.user_id <> created.creator
            and a.day >= created.day and a.day < created.day + 30 and (a.posts > 0 or a.comments > 0)
        ))::int as numerator,
        count(*)::int as denominator
      from created
    `, iso)))
  }

  if (isMature(end, 14, now)) {
    await saveMetric(knex, 'new_member_contributed_14d', 'month', periodStart, rateRows(await queryRows(knex, `
      with joined as (
        select user_id, group_id, occurred_on from user_milestones
        where milestone = 'group_joined' and occurred_on >= ?::date and occurred_on < ?::date and group_id <> 0
      )
      select group_id,
        count(*) filter (where exists (
          select 1 from user_day_activity a
          where a.user_id = joined.user_id and a.group_id = joined.group_id
            and a.day >= joined.occurred_on and a.day < joined.occurred_on + 14
            and (a.posts + a.comments + a.reactions) > 0
        ))::int as numerator,
        count(*)::int as denominator
      from joined group by group_id
      union all
      select 0,
        count(*) filter (where exists (
          select 1 from user_day_activity a
          where a.user_id = joined.user_id and a.group_id = joined.group_id
            and a.day >= joined.occurred_on and a.day < joined.occurred_on + 14
            and (a.posts + a.comments + a.reactions) > 0
        ))::int,
        count(*)::int
      from joined
    `, [from, to])))
  }

  if (isMature(end, 35, now)) {
    await saveMetric(knex, 'new_contributor_retention', 'month', periodStart, rateRows(await queryRows(knex, `
      with firsts as (
        select user_id, occurred_on from user_milestones
        where milestone = 'first_contribution' and group_id = 0 and occurred_on >= ?::date and occurred_on < ?::date
      )
      select 0 as group_id,
        count(*) filter (where exists (
          select 1 from user_day_activity a
          where a.user_id = firsts.user_id and a.day >= firsts.occurred_on + 8 and a.day < firsts.occurred_on + 35
            and ${CONTRIB}
        ))::int as numerator,
        count(*)::int as denominator
      from firsts
    `, [from, to])))
  }

  if (isMature(end, 84, now)) await signupCohortCurve(knex, periodStart, from, to)

  const lookback = utcDay(new Date(end.getTime() - 90 * DAY_MS))
  await saveMetric(knex, 'multi_group_weavers', 'month', periodStart, await queryRows(knex, `
    with spans as (
      select user_id, count(distinct group_id)::int as groups
      from user_day_activity
      where day >= ?::date and day < ?::date and group_id <> 0 and (posts > 0 or comments > 0)
      group by user_id
    )
    select 0 as group_id, '2' as dimension, count(*) filter (where groups >= 2)::int as value from spans
    union all
    select 0, '3', count(*) filter (where groups >= 3)::int from spans
  `, [lookback, to]))

  await saveMetric(knex, 'new_memberships_by_source', 'month', periodStart, await queryRows(knex, `
    select group_id, coalesce(nullif(properties->>'source', ''), 'unknown') as dimension, count(*)::int as value
    from activity_events
    where event_type = 'group_joined' and occurred_at >= ? and occurred_at < ? and group_id <> 0 and user_id <> ${AXOLOTL_ID}
    group by 1, 2
    union all
    select 0, coalesce(nullif(properties->>'source', ''), 'unknown'), count(*)::int
    from activity_events
    where event_type = 'group_joined' and occurred_at >= ? and occurred_at < ? and user_id <> ${AXOLOTL_ID}
    group by 2
    union all
    select 0, '', count(*)::int from activity_events
    where event_type = 'group_joined' and occurred_at >= ? and occurred_at < ? and user_id <> ${AXOLOTL_ID}
  `, [...iso, ...iso, ...iso]))

  const lastDay = utcDay(new Date(end.getTime() - DAY_MS))
  await saveMetric(knex, 'account_deactivations', 'month', periodStart, await queryRows(knex, `
    select 0 as group_id, '' as dimension, count(*)::int as value from activity_events
    where event_type in ('account_deactivated', 'account_deleted') and occurred_at >= ? and occurred_at < ?
    union all
    select 0, 'per_1000', count(*)::float * 1000 / nullif((
      select value from metric_snapshots
      where metric = 'mau' and period = 'day' and group_id = 0 and dimension = '' and period_start = ?::date
    ), 0)
    from activity_events
    where event_type in ('account_deactivated', 'account_deleted') and occurred_at >= ? and occurred_at < ?
  `, [...iso, lastDay, ...iso]))

  await saveMetric(knex, 'invite_k_proxy', 'month', periodStart, await inviteRows(knex, from, to, iso))

  if (isMature(end, 14, now)) {
    await saveMetric(knex, 'invite_acceptance_14d', 'month', periodStart, rateRows(await queryRows(knex, `
      with sent as (
        select object_id, group_id, user_id as inviter, occurred_at
        from activity_events
        where event_type = 'invitation_sent' and occurred_at >= ? and occurred_at < ?
      ), bulk as (
        select inviter from sent group by inviter having count(*) > 30
      )
      select 0 as group_id,
        count(*) filter (where exists (
          select 1 from activity_events a
          where a.event_type = 'invitation_accepted' and a.object_id = sent.object_id
            and a.occurred_at >= sent.occurred_at and a.occurred_at < sent.occurred_at + interval '14 days'
        ))::int as numerator,
        count(*)::int as denominator
      from sent where inviter not in (select inviter from bulk)
    `, iso)))
    await saveMetric(knex, 'needs_answered_14d', 'month', periodStart, await queryRows(knex, `
      select group_id, '' as dimension,
        count(*) filter (where first_comment_hours is not null and first_comment_hours <= 336)::float / nullif(count(*), 0) as value
      from post_outcomes where created_at >= ?::date and created_at < ?::date and post_type in ('request','offer')
      group by group_id
      union all
      select 0, 'any',
        count(*) filter (where first_response_hours is not null and first_response_hours <= 336)::float / nullif(count(*), 0)
      from post_outcomes where created_at >= ?::date and created_at < ?::date and post_type in ('request','offer')
    `, [from, to, from, to]))
  }

  if (isMature(end, 30, now)) {
    await saveMetric(knex, 'after_a_missed_connection', 'month', periodStart, await missedReturnRows(knex, from, to))
    await saveMetric(knex, 'projects_with_second_contributor', 'month', periodStart, await queryRows(knex, `
      select 0 as group_id, '' as dimension,
        count(*) filter (where project_self_joins > 0)::float / nullif(count(*), 0) as value
      from post_outcomes where created_at >= ?::date and created_at < ?::date and post_type = 'project'
      union all
      select 0, 'author_added', count(*) filter (where project_author_adds > 0)::int
      from post_outcomes where created_at >= ?::date and created_at < ?::date and post_type = 'project'
    `, [from, to, from, to]))
  }

  await saveMetric(knex, 'events_that_gathered', 'month', periodStart, await queryRows(knex, `
    select 0 as group_id, 'one' as dimension, count(*) filter (where other_rsvps >= 1)::int as value
    from post_outcomes where post_type = 'event' and event_start >= ? and event_start < ?
    union all
    select 0, 'three', count(*) filter (where other_rsvps >= 3)::int
    from post_outcomes where post_type = 'event' and event_start >= ? and event_start < ?
    union all
    select 0, '', count(*) filter (where other_rsvps >= 1)::float / nullif(count(*), 0)
    from post_outcomes where post_type = 'event' and event_start >= ? and event_start < ?
  `, [...iso, ...iso, ...iso]))

  await saveMetric(knex, 'decisions_made', 'month', periodStart, await queryRows(knex, `
    select 0 as group_id, '' as dimension, count(*) filter (where voter_count >= 2)::int as value
    from post_outcomes where post_type = 'proposal' and created_at >= ? and created_at < ?
    union all
    select 0, 'casual', count(*) filter (where voter_count >= 2 and proposal_status = 'casual')::int
    from post_outcomes where post_type = 'proposal' and created_at >= ? and created_at < ?
  `, [...iso, ...iso]))

  await saveMetric(knex, 'join_requests_unanswered_7d', 'month', periodStart, rateRows(await queryRows(knex, `
    with created as (
      select object_id, group_id, occurred_at from activity_events
      where event_type = 'join_request_created' and occurred_at >= ? and occurred_at < ?
    )
    select group_id,
      count(*) filter (where not exists (
        select 1 from activity_events d
        where d.event_type = 'join_request_decided' and d.object_id = created.object_id and d.group_id = created.group_id
          and d.occurred_at >= created.occurred_at and d.occurred_at < created.occurred_at + interval '7 days'
      ))::int as numerator,
      count(*)::int as denominator
    from created group by group_id
    union all
    select 0,
      count(*) filter (where not exists (
        select 1 from activity_events d
        where d.event_type = 'join_request_decided' and d.object_id = created.object_id
          and d.occurred_at >= created.occurred_at and d.occurred_at < created.occurred_at + interval '7 days'
      ))::int,
      count(*)::int
    from created
  `, iso)))
}

/** Signup cohort sizes and how many of each segment contributed in later windows. */
async function signupCohortCurve (knex, periodStart, from, to) {
  const sizes = await queryRows(knex, `
    with signups as (
      select user_id, occurred_on from user_milestones
      where milestone = 'signup' and group_id = 0 and occurred_on >= ?::date and occurred_on < ?::date
    ), classed as (
      select user_id, occurred_on,
        case
          when exists (
            select 1 from user_day_activity a where a.user_id = signups.user_id
              and a.day >= signups.occurred_on and a.day < signups.occurred_on + 30 and ${CONTRIB}
          ) then 'contributed'
          when exists (
            select 1 from user_milestones j where j.user_id = signups.user_id and j.milestone = 'group_joined'
              and j.occurred_on >= signups.occurred_on and j.occurred_on < signups.occurred_on + 30
          ) then 'joined'
          else 'no_group'
        end as segment
      from signups
    )
    select 0 as group_id, segment as dimension, count(*)::int as value from classed group by segment
    union all
    select 0, 'size', count(*)::int from signups
  `, [from, to])
  const windows = [['w1', 0, 7], ['w4', 14, 28], ['w8', 42, 56], ['w12', 70, 84]]
  const returns = []
  for (const [label, startDay, endDay] of windows) {
    const rows = await queryRows(knex, `
      with signups as (
        select user_id, occurred_on from user_milestones
        where milestone = 'signup' and group_id = 0 and occurred_on >= ?::date and occurred_on < ?::date
      ), classed as (
        select user_id, occurred_on,
          case
            when exists (
              select 1 from user_day_activity a where a.user_id = signups.user_id
                and a.day >= signups.occurred_on and a.day < signups.occurred_on + 30 and ${CONTRIB}
            ) then 'contributed'
            when exists (
              select 1 from user_milestones j where j.user_id = signups.user_id and j.milestone = 'group_joined'
                and j.occurred_on >= signups.occurred_on and j.occurred_on < signups.occurred_on + 30
            ) then 'joined'
            else 'no_group'
          end as segment
        from signups
      )
      select 0 as group_id, segment || ':' || ? as dimension,
        count(*) filter (where exists (
          select 1 from user_day_activity a where a.user_id = classed.user_id
            and a.day >= classed.occurred_on + ?::int and a.day < classed.occurred_on + ?::int and ${CONTRIB}
        ))::float / nullif(count(*), 0) as value
      from classed group by segment
    `, [from, to, label, startDay, endDay])
    returns.push(...rows)
  }
  await saveMetric(knex, 'signup_cohort_curve', 'month', periodStart, [...sizes, ...returns])
}

/** Accepted invites per contributor, plus who the invites came from. */
async function inviteRows (knex, from, to, iso) {
  const rates = await queryRows(knex, `
    with accepts as (
      select group_id, count(*)::int as accepts from activity_events
      where event_type = 'invitation_accepted' and occurred_at >= ? and occurred_at < ?
      group by group_id
    ), people as (
      select group_id, count(distinct user_id)::int as contributors from user_day_activity
      where day >= ?::date and day < ?::date and ${CONTRIB}
      group by group_id
    )
    select p.group_id, '' as dimension, a.accepts::float / nullif(p.contributors, 0) as value
    from people p left join accepts a on a.group_id = p.group_id
    where p.contributors > 0
  `, [...iso, from, to])
  const extras = await queryRows(knex, `
    with inviters as (
      select user_id, count(*)::int as sends from activity_events
      where event_type = 'invitation_sent' and occurred_at >= ? and occurred_at < ? and user_id is not null
      group by user_id
    ), ranked as (
      select user_id, sends, ntile(10) over (order by sends desc, user_id) as bucket, sum(sends) over () as total
      from inviters
    )
    select 0 as group_id, 'inviters' as dimension, count(*)::int as value from inviters
    union all
    select 0, 'top_share', sum(sends) filter (where bucket = 1)::float / nullif(max(total), 0) from ranked
    union all
    select 0, 'without_admin', count(*)::int from inviters i
    where not exists (
      select 1 from group_memberships_group_roles mgr
      join group_roles_responsibilities grr on grr.group_role_id = mgr.group_role_id
      join responsibilities r on r.id = grr.responsibility_id and r.title = 'Administration' and r.type = 'system'
      where mgr.user_id = i.user_id and mgr.active is not false
    )
  `, iso)
  return [...rates, ...extras]
}

/** Whether someone's next month of activity differed after an answered or missed first post. */
async function missedReturnRows (knex, from, to) {
  return queryRows(knex, `
    with firsts as (
      select distinct on (author_id) author_id, created_at,
        first_response_hours is not null and first_response_hours <= 168 as answered
      from post_outcomes
      where created_at >= ?::date and created_at < ?::date
        and post_type not in ('thread','chat_activity','welcome','chat')
      order by author_id, created_at
    )
    select 0 as group_id, 'answered' as dimension,
      count(*) filter (where answered and exists (
        select 1 from user_day_activity a where a.user_id = firsts.author_id
          and a.day >= (firsts.created_at at time zone 'UTC')::date + 1
          and a.day < (firsts.created_at at time zone 'UTC')::date + 30 and ${CONTRIB}
      ))::float / nullif(count(*) filter (where answered), 0) as value
    from firsts
    union all
    select 0, 'missed',
      count(*) filter (where not answered and exists (
        select 1 from user_day_activity a where a.user_id = firsts.author_id
          and a.day >= (firsts.created_at at time zone 'UTC')::date + 1
          and a.day < (firsts.created_at at time zone 'UTC')::date + 30 and ${CONTRIB}
      ))::float / nullif(count(*) filter (where not answered), 0)
    from firsts
  `, [from, to])
}

/**
 * Recomputes the recent closed weeks and months. Weeks are refreshed from the
 * person table first. A metric that still needs time to settle is left as it was.
 */
export async function computeRecentHealth (knex, now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const yesterday = utcDay(new Date(today.getTime() - DAY_MS))
  await contributors30d(knex, yesterday)

  let monday = startOfWeek(new Date(today.getTime() - 7 * DAY_MS))
  for (let i = 0; i < 16; i++) {
    const weekStart = utcDay(monday)
    await refreshGroupWeek(knex, weekStart)
    await computeWeek(knex, weekStart, now)
    monday = new Date(monday.getTime() - 7 * DAY_MS)
  }

  for (let i = 1; i <= 5; i++) {
    const month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1))
    await computeMonth(knex, utcDay(month), now)
  }
}

/** Current-state counts. These describe today, so they are not rebuilt for the past. */
export async function computeStateMetrics (knex, periodStart) {
  await saveMetric(knex, 'tended_groups_share', 'day', periodStart, await queryRows(knex, `
    with admins as (
      select distinct mgr.group_id, mgr.user_id
      from group_memberships_group_roles mgr
      join group_roles_responsibilities grr on grr.group_role_id = mgr.group_role_id
      join responsibilities r on r.id = grr.responsibility_id and r.title = 'Administration' and r.type = 'system'
      where mgr.active is not false
    ), groups_in as (
      select id from groups where active is not false and coalesce(type, '') <> 'space'
    ), tended as (
      select distinct a.group_id from admins a
      join activity_days d on d.user_id = a.user_id and d.day > ?::date - 30
    )
    select 0 as group_id, '' as dimension, (select count(*) from tended t join groups_in g on g.id = t.group_id)::float / nullif((select count(*) from groups_in), 0) as value
  `, [periodStart]))

  await saveMetric(knex, 'stale_join_request_backlog', 'day', periodStart, await queryRows(knex, `
    select group_id, '' as dimension, count(*)::int as value from join_requests
    where status = 0 and created_at < now() - interval '7 days'
    group by group_id
    union all
    select 0, '', count(*)::int from join_requests where status = 0 and created_at < now() - interval '7 days'
  `))

  await saveMetric(knex, 'steward_coverage', 'day', periodStart, await queryRows(knex, `
    with admins as (
      select distinct mgr.group_id from group_memberships_group_roles mgr
      join group_roles_responsibilities grr on grr.group_role_id = mgr.group_role_id
      join responsibilities r on r.id = grr.responsibility_id and r.title = 'Administration' and r.type = 'system'
      where mgr.active is not false
    )
    select 0 as group_id, '' as dimension,
      (select count(*) from admins a join groups g on g.id = a.group_id and g.active is not false and coalesce(g.type, '') <> 'space')::float
      / nullif((select count(*) from groups where active is not false and coalesce(type, '') <> 'space'), 0) as value
  `))

  await saveMetric(knex, 'moderation_health', 'day', periodStart, await queryRows(knex, `
    select coalesce(group_id, 0) as group_id, '' as dimension, count(*) filter (where status = 'active')::int as value
    from moderation_actions group by group_id
    union all
    select 0, 'cleared_30d', count(*) filter (where status = 'cleared' and updated_at >= now() - interval '30 days')::int
    from moderation_actions
  `))

  await saveMetric(knex, 'groupless_active_users', 'day', periodStart, await queryRows(knex, `
    select 0 as group_id, '' as dimension, count(*)::int as value from (
      select distinct d.user_id from activity_days d
      join users u on u.id = d.user_id and u.active is not false
      where d.group_id = 0 and d.day > ?::date - 30 and d.user_id <> ${AXOLOTL_ID}
        and not exists (
          select 1 from group_memberships gm where gm.user_id = d.user_id and gm.active
        )
    ) people
  `, [periodStart]))

  await saveMetric(knex, 'mid_signup', 'day', periodStart, await queryRows(knex, `
    select 0 as group_id, '' as dimension, count(*)::int as value from users
    where created_at >= now() - interval '14 days' and id <> ${AXOLOTL_ID}
      and (active is not true or email_validated is not true)
  `))

  await saveMetric(knex, 'outbound_to_dormant_share', 'day', periodStart, await queryRows(knex, `
    select 0 as group_id, '' as dimension,
      count(*) filter (where not exists (
        select 1 from activity_days d where d.user_id = n.user_id and d.day > ?::date - 30
      ))::float / nullif(count(*), 0) as value
    from notifications n
    where n.created_at >= ?::date and n.created_at < ?::date + 1
  `, [periodStart, periodStart, periodStart]))

  await saveMetric(knex, 'new_member_notification_turndown', 'day', periodStart, await queryRows(knex, `
    select 0 as group_id, '' as dimension,
      count(*) filter (where coalesce(u.settings->>'digest_frequency', '') = 'never' or coalesce(u.settings->>'dm_notifications', '') = 'none')::float
      / nullif(count(*), 0) as value
    from group_memberships gm
    join users u on u.id = gm.user_id
    where gm.created_at >= now() - interval '30 days' and gm.active
  `))

  await saveMetric(knex, 'unsubscribe_all_leak', 'day', periodStart, await queryRows(knex, `
    select 0 as group_id, '' as dimension,
      count(*) filter (where coalesce(settings->>'digest_frequency', '') = 'never')::float / nullif(count(*), 0) as value
    from users where active is not false and id <> ${AXOLOTL_ID}
  `))

  await saveMetric(knex, 'ignored_email_preferences', 'day', periodStart, await queryRows(knex, `
    select 0 as group_id, '' as dimension,
      count(*) filter (where coalesce(settings->>'dm_notifications', '') = 'none')::float / nullif(count(*), 0) as value
    from users where active is not false and id <> ${AXOLOTL_ID}
  `))

  await saveMetric(knex, 'notification_pipeline_integrity', 'day', periodStart, await queryRows(knex, `
    select 0 as group_id, '' as dimension,
      count(*) filter (where sent_at is not null)::float / nullif(count(*), 0) as value
    from notifications
    where medium <> 0 and created_at >= ?::date and created_at < ?::date + 1
  `, [periodStart, periodStart]))

  await saveMetric(knex, 'mixpanel_blind_spot', 'day', periodStart, await queryRows(knex, `
    select 0 as group_id, '' as dimension,
      count(distinct d.user_id) filter (where cc.settings->>'analytics' = 'false')::float
      / nullif(count(distinct d.user_id), 0) as value
    from activity_days d
    left join cookie_consents cc on cc.user_id = d.user_id
    where d.group_id = 0 and d.day > ?::date - 30 and d.user_id <> ${AXOLOTL_ID}
  `, [periodStart]))

  await saveMetric(knex, 'data_quality_tripwires', 'day', periodStart, await queryRows(knex, `
    select 0 as group_id, 'snapshot_lag_days' as dimension,
      (?::date - max(period_start))::int as value
    from metric_snapshots where period = 'day' and metric = 'active_users'
    union all
    select 0, 'event_types_2d', count(distinct event_type)::int
    from activity_events where occurred_at >= ?::date - 2
    union all
    select 0, 'mixed_versions', count(*)::int from (
      select metric from metric_snapshots group by metric having count(distinct definition_version) > 1
    ) mixed
  `, [periodStart, periodStart]))
}

export { computeWeek, computeMonth }
