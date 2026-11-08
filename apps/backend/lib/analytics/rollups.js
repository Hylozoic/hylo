import { AXOLOTL_ID } from './constants'
import { addPeriod, parseDay, utcDay, utcRange } from './periods'

const NOT_DM = "coalesce(post_type, '') not in ('thread', 'chat_activity', 'welcome')"
const ROLLED = "case when g.type = 'space' and g.parent_id is not null then g.parent_id else e.group_id end"

const USER_DAY = `
with base as (
  select (e.occurred_at at time zone 'UTC')::date as day,
    ${ROLLED} as group_id,
    e.user_id as actor_id,
    e.target_user_id,
    e.event_type,
    e.post_type
  from activity_events e
  left join groups g on g.id = e.group_id
  join users u on u.id = e.user_id and u.active is not false
  where e.occurred_at >= ? and e.occurred_at < ?
    and e.user_id <> ${AXOLOTL_ID}
    and e.group_id <> 0
),
actor as (
  select day, group_id, actor_id as user_id,
    count(*) filter (where event_type = 'post_created' and ${NOT_DM})::int as posts,
    count(*) filter (where event_type = 'comment_created' and ${NOT_DM})::int as comments,
    count(*) filter (where event_type = 'reaction_added' and ${NOT_DM})::int as reactions,
    count(*) filter (where event_type = 'event_rsvp')::int as rsvps,
    count(*) filter (where event_type = 'proposal_vote')::int as votes,
    count(*) filter (where event_type = 'project_joined')::int as project_joins,
    count(*) filter (where event_type = 'invitation_sent')::int as invites_sent,
    count(*) filter (where event_type in ('comment_created','reaction_added','event_rsvp','proposal_vote','project_joined')
      and target_user_id is not null and target_user_id <> actor_id and ${NOT_DM})::int as connections,
    count(*) filter (where event_type in ('comment_created','event_rsvp','proposal_vote','project_joined')
      and target_user_id is not null and target_user_id <> actor_id and ${NOT_DM})::int as connections_beyond_reaction,
    count(*) filter (where target_user_id is not null and target_user_id <> actor_id and (
      (event_type in ('comment_created','reaction_added','event_rsvp','proposal_vote','project_joined') and post_type in ('event','proposal','project'))
      or (event_type = 'comment_created' and post_type in ('request','offer'))
    ))::int as coordinating
  from base
  group by 1, 2, 3
),
received as (
  select b.day, b.group_id, b.target_user_id as user_id,
    count(*) filter (where b.event_type in ('comment_created','reaction_added','event_rsvp','proposal_vote','project_joined') and coalesce(b.post_type, '') not in ('thread', 'chat_activity', 'welcome'))::int as received_connections,
    count(*) filter (where b.event_type in ('comment_created','event_rsvp','proposal_vote','project_joined') and coalesce(b.post_type, '') not in ('thread', 'chat_activity', 'welcome'))::int as received_beyond_reaction,
    count(*) filter (where (
      (b.event_type in ('comment_created','reaction_added','event_rsvp','proposal_vote','project_joined') and b.post_type in ('event','proposal','project'))
      or (b.event_type = 'comment_created' and b.post_type in ('request','offer'))
    ))::int as received_coordinating
  from base b
  join users tu on tu.id = b.target_user_id and tu.active is not false
  where b.target_user_id is not null and b.target_user_id <> b.actor_id and b.target_user_id <> ${AXOLOTL_ID}
  group by 1, 2, 3
)
insert into user_day_activity (
  day, group_id, user_id, posts, comments, reactions, rsvps, votes, project_joins, invites_sent,
  connections, received_connections, connections_beyond_reaction, received_beyond_reaction,
  coordinating, received_coordinating
)
select day, group_id, user_id,
  sum(posts)::int, sum(comments)::int, sum(reactions)::int, sum(rsvps)::int,
  sum(votes)::int, sum(project_joins)::int, sum(invites_sent)::int,
  sum(connections)::int, sum(received_connections)::int,
  sum(connections_beyond_reaction)::int, sum(received_beyond_reaction)::int,
  sum(coordinating)::int, sum(received_coordinating)::int
from (
  select coalesce(a.day, r.day) as day, coalesce(a.group_id, r.group_id) as group_id, coalesce(a.user_id, r.user_id) as user_id,
    coalesce(a.posts, 0) as posts, coalesce(a.comments, 0) as comments, coalesce(a.reactions, 0) as reactions, coalesce(a.rsvps, 0) as rsvps,
    coalesce(a.votes, 0) as votes, coalesce(a.project_joins, 0) as project_joins, coalesce(a.invites_sent, 0) as invites_sent,
    coalesce(a.connections, 0) as connections, coalesce(r.received_connections, 0) as received_connections,
    coalesce(a.connections_beyond_reaction, 0) as connections_beyond_reaction, coalesce(r.received_beyond_reaction, 0) as received_beyond_reaction,
    coalesce(a.coordinating, 0) as coordinating, coalesce(r.received_coordinating, 0) as received_coordinating
  from actor a
  full outer join received r
    on r.day = a.day and r.group_id = a.group_id and r.user_id = a.user_id
) rolled
where day >= ?::date and day < ?::date
group by 1, 2, 3
`

/**
 * Fills post_id, and commentId for reactions on comments, on rows that don't have them yet.
 */
export async function fillEventLinks (knex) {
  await knex.raw("update activity_events set post_id = object_id where event_type = 'post_created' and post_id is null and object_type = 'post'")
  await knex.raw(`
    update activity_events e set post_id = c.post_id,
      properties = coalesce(e.properties, '{}'::jsonb) || jsonb_build_object('commentId', c.id)
    from comments c
    where e.event_type in ('comment_created', 'message_sent') and e.object_id = c.id and e.post_id is null
  `)
  await knex.raw(`
    update activity_events e set post_id = p.id
    from reactions r
    join posts p on p.id = r.entity_id and r.entity_type = 'post'
    where e.event_type = 'reaction_added' and e.object_id = r.id and e.post_id is null
  `)
  await knex.raw(`
    update activity_events e set post_id = c.post_id,
      properties = coalesce(e.properties, '{}'::jsonb) || jsonb_build_object('commentId', c.id)
    from reactions r
    join comments c on c.id = r.entity_id and r.entity_type = 'comment'
    where e.event_type = 'reaction_added' and e.object_id = r.id and e.post_id is null
  `)
  await knex.raw(`
    update activity_events e set post_id = ei.event_id
    from event_invitations ei
    where e.event_type = 'event_rsvp' and e.object_id = ei.id and e.post_id is null
  `)
  await knex.raw(`
    update activity_events e set post_id = v.post_id
    from proposal_votes v
    where e.event_type = 'proposal_vote' and e.object_id = v.id and e.post_id is null
  `)
  await knex.raw(`
    update activity_events e set post_id = pu.post_id
    from posts_users pu
    where e.event_type = 'project_joined' and e.object_id = pu.id and e.post_id is null
  `)
}

/**
 * Rewrites one person's activity counts for a half-open UTC day range.
 * Safe to run again.
 */
export async function refreshUserDays (knex, from, to) {
  const range = utcRange(from, to)
  await knex('user_day_activity').where('day', '>=', range.fromDay).where('day', '<', range.toDay).del()
  await knex.raw(USER_DAY, [range.fromTs, range.toTs, range.fromDay, range.toDay])
}

/** Earliest signup, visit, contribution, post, and each group join. */
export async function refreshMilestones (knex, { replace = false } = {}) {
  if (replace) await knex('user_milestones').del()
  const upsert = (selectSql) => `
    insert into user_milestones (user_id, milestone, group_id, occurred_on)
    ${selectSql}
    on conflict (user_id, milestone, group_id) do update
    set occurred_on = least(user_milestones.occurred_on, excluded.occurred_on)
  `
  await knex.raw(upsert(`
    select user_id, 'signup', 0, min((occurred_at at time zone 'UTC')::date)
    from activity_events
    where event_type = 'signup_completed' and user_id <> ${AXOLOTL_ID}
    group by user_id
  `))
  await knex.raw(upsert(`
    select user_id, 'first_visit', 0, min(day)
    from activity_days
    where group_id = 0 and user_id <> ${AXOLOTL_ID}
    group by user_id
  `))
  await knex.raw(upsert(`
    select user_id, 'first_contribution', 0, min(day)
    from user_day_activity
    where posts + comments + reactions + rsvps + votes + project_joins > 0
    group by user_id
  `))
  await knex.raw(upsert(`
    select user_id, 'first_post', 0, min((occurred_at at time zone 'UTC')::date)
    from activity_events
    where event_type = 'post_created' and coalesce(post_type, '') not in ('thread', 'chat_activity', 'welcome') and user_id <> ${AXOLOTL_ID}
    group by user_id
  `))
  await knex.raw(upsert(`
    select user_id, 'group_joined', group_id, min((occurred_at at time zone 'UTC')::date)
    from activity_events
    where event_type = 'group_joined' and group_id <> 0 and user_id <> ${AXOLOTL_ID}
    group by user_id, group_id
  `))
}

/**
 * Voices and connections over the 28 days ending when this week ends.
 * `weekStart` is the Monday, as YYYY-MM-DD.
 */
export async function refreshGroupWeek (knex, weekStart) {
  const start = parseDay(weekStart)
  const end = addPeriod(start, 'week')
  const from = utcDay(new Date(end.getTime() - 28 * 24 * 60 * 60 * 1000))
  await knex('group_activity_weeks').where({ week_start: weekStart }).del()
  await knex.raw(`
    insert into group_activity_weeks (group_id, week_start, voices_28d, connections_28d)
    select group_id, ?::date,
      count(distinct user_id) filter (where posts > 0 or comments > 0)::int,
      coalesce(sum(connections), 0)::int
    from user_day_activity
    where day >= ?::date and day < ?::date and group_id <> 0
    group by group_id
  `, [weekStart, from, utcDay(end)])
}

/**
 * One outcome row per post and rolled-up group, for posts created in the range.
 * The response window runs until `to`.
 */
export async function refreshPostOutcomes (knex, from, to) {
  await knex('post_outcomes').where('created_at', '>=', from).where('created_at', '<', to).del()
  const inserted = await knex.raw(`
    insert into post_outcomes (
      post_id, group_id, author_id, post_type, created_at, is_first_post, author_newcomer,
      first_response_hours, first_comment_hours, responder_count, chat_reply_24h,
      event_start, other_rsvps, proposal_status, voting_end, voter_count,
      project_self_joins, project_author_adds, group_was_live, refreshed_at
    )
    select p.id,
      gp.group_id,
      p.user_id, p.type, p.created_at,
      not exists (
        select 1 from activity_events earlier
        where earlier.user_id = p.user_id and earlier.event_type = 'post_created'
          and earlier.occurred_at < p.created_at
          and coalesce(earlier.post_type, '') not in ('thread', 'chat_activity', 'welcome')
      ),
      exists (
        select 1 from group_memberships gm
        where gm.user_id = p.user_id
          and gm.group_id = gp.group_id
          and gm.created_at <= p.created_at
          and gm.created_at >= p.created_at - interval '30 days'
      ),
      (
        select extract(epoch from min(e.occurred_at) - p.created_at) / 3600
        from activity_events e
        where e.post_id = p.id and e.user_id <> p.user_id
          and e.event_type in ('comment_created','reaction_added','event_rsvp','proposal_vote','project_joined')
          and e.occurred_at >= p.created_at and e.occurred_at < ?
      ),
      (
        select extract(epoch from min(e.occurred_at) - p.created_at) / 3600
        from activity_events e
        where e.post_id = p.id and e.user_id <> p.user_id and e.event_type = 'comment_created'
          and e.occurred_at >= p.created_at and e.occurred_at < ?
      ),
      (
        select count(distinct e.user_id)::int from activity_events e
        where e.post_id = p.id and e.user_id <> p.user_id
          and e.event_type in ('comment_created','reaction_added','event_rsvp','proposal_vote','project_joined')
          and e.occurred_at >= p.created_at and e.occurred_at < ?
      ),
      p.type = 'chat' and exists (
        select 1 from activity_events e
        where e.post_id = p.id and e.user_id <> p.user_id and e.event_type = 'comment_created'
          and e.occurred_at >= p.created_at and e.occurred_at < p.created_at + interval '24 hours'
      ),
      case when p.type = 'event' then p.start_time else null end,
      (
        select count(distinct e.user_id)::int from activity_events e
        where e.post_id = p.id and e.event_type = 'event_rsvp' and e.user_id <> p.user_id
      ),
      p.proposal_status,
      case when p.type = 'proposal' then p.end_time else null end,
      (
        select count(distinct e.user_id)::int from activity_events e
        where e.post_id = p.id and e.event_type = 'proposal_vote'
      ),
      (
        select count(*)::int from posts_users pu
        where pu.post_id = p.id and pu.user_id <> p.user_id
          and pu.created_at > p.created_at + interval '2 minutes'
          and pu.created_at < p.created_at + interval '30 days'
      ),
      (
        select count(*)::int from posts_users pu
        where pu.post_id = p.id and pu.user_id <> p.user_id
          and pu.created_at <= p.created_at + interval '2 minutes'
      ),
      exists (
        select 1 from group_activity_weeks w
        where w.group_id = gp.group_id
          and w.week_start = date_trunc('week', p.created_at at time zone 'UTC')::date
          and w.voices_28d >= 3
      ),
      now()
    from posts p
    join (
      select gp.post_id,
        case when g.type = 'space' and g.parent_id is not null then g.parent_id else gp.group_id end as group_id
      from groups_posts gp
      left join groups g on g.id = gp.group_id
      group by 1, 2
    ) gp on gp.post_id = p.id
    where p.created_at >= ? and p.created_at < ?
      and p.user_id is not null and p.user_id <> ${AXOLOTL_ID}
      and p.type not in ('thread', 'chat_activity')
  `, [to, to, to, from, to])
  return inserted.rowCount || 0
}

/**
 * Refreshes yesterday's person rows, milestones, and outcomes for posts from the last 45 days.
 */
export async function refreshDailyRollups (knex, yesterday, today) {
  await refreshUserDays(knex, yesterday, today)
  await refreshMilestones(knex)
  const from = new Date(`${today}T00:00:00.000Z`)
  from.setUTCDate(from.getUTCDate() - 45)
  await refreshPostOutcomes(knex, from.toISOString(), `${today}T00:00:00.000Z`)
}
