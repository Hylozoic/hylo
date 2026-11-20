import { AXOLOTL_ID } from './constants'

/**
 * A comment, RSVP, vote, project join, or reaction between two people,
 * on a post still inside its connection window. Reactions are optional
 * so the narrower count stays inside the wider one.
 */
export function connectionPredicate (alias = 'e', { reactions = true } = {}) {
  const types = reactions
    ? "'comment_created','reaction_added','event_rsvp','proposal_vote','project_joined'"
    : "'comment_created','event_rsvp','proposal_vote','project_joined'"
  return `${alias}.event_type in (${types})
    and coalesce(${alias}.post_type, '') not in ('thread','chat_activity','welcome')
    and ${alias}.target_user_id is not null and ${alias}.target_user_id <> ${alias}.user_id
    and ${alias}.user_id <> ${AXOLOTL_ID}
    and (
      ${alias}.post_id is null
      or ${alias}.occurred_at <= (select p.created_at from posts p where p.id = ${alias}.post_id) +
        case when coalesce(${alias}.post_type, '') in ('event','proposal','project') then interval '30 days' else interval '14 days' end
    )`
}

/** Distinct people on either side of a connection, per group and for the whole platform. */
export function connectedPeopleSql ({ reactions = true } = {}) {
  const where = connectionPredicate('e', { reactions })
  return `select group_id, count(distinct person)::int as value from (
      select case when g.type = 'space' and g.parent_id is not null then g.parent_id else e.group_id end as group_id, e.user_id as person
      from activity_events e
      join users u on u.id = e.user_id and u.active is not false
      left join groups g on g.id = e.group_id
      where ${where} and e.occurred_at >= ? and e.occurred_at < ? and e.group_id <> 0
      union
      select case when g.type = 'space' and g.parent_id is not null then g.parent_id else e.group_id end, e.target_user_id
      from activity_events e
      join users u on u.id = e.target_user_id and u.active is not false
      left join groups g on g.id = e.group_id
      where ${where} and e.occurred_at >= ? and e.occurred_at < ? and e.group_id <> 0
    ) people group by group_id
    union all
    select 0, count(distinct person)::int from (
      select e.user_id as person from activity_events e
      join users u on u.id = e.user_id and u.active is not false
      where ${where} and e.occurred_at >= ? and e.occurred_at < ?
      union
      select e.target_user_id from activity_events e
      join users u on u.id = e.target_user_id and u.active is not false
      where ${where} and e.occurred_at >= ? and e.occurred_at < ?
    ) people`
}
