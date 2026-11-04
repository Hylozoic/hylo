import { AXOLOTL_ID } from './snapshots'
import { windows } from './periods'

const INSERT = `insert into activity_events
  (occurred_at, event_type, user_id, group_id, object_type, object_id, target_user_id, post_type, source)
  `

const DONE = 'on conflict (event_type, object_id, user_id, group_id, occurred_at) do nothing'

// A post shared to several groups gets one row per group. Posts in no group get group 0.
const POSTS = `insert into activity_events
  (occurred_at, event_type, user_id, group_id, object_type, object_id, target_user_id, post_type, properties, source)
  select p.created_at, 'post_created', p.user_id, coalesce(gp.group_id, 0), 'post', p.id, null, p.type,
    jsonb_build_object('isPublic', coalesce(p.is_public, false)), 'backfill'
  from posts p
  left join groups_posts gp on gp.post_id = p.id
  where p.created_at >= ? and p.created_at < ? and p.user_id is not null and p.user_id <> ${AXOLOTL_ID}
    and p.type not in ('thread', 'chat_activity')
  ${DONE}`

const COMMENTS = `${INSERT}
  select c.created_at, 'comment_created', c.user_id, coalesce(gp.group_id, 0), 'comment', c.id, p.user_id, p.type, 'backfill'
  from comments c
  join posts p on p.id = c.post_id
  left join groups_posts gp on gp.post_id = p.id
  where c.created_at >= ? and c.created_at < ? and c.user_id is not null and c.user_id <> ${AXOLOTL_ID}
    and p.type <> 'thread'
  ${DONE}`

const MESSAGES = `${INSERT}
  select c.created_at, 'message_sent', c.user_id, 0, 'comment', c.id, p.user_id, p.type, 'backfill'
  from comments c
  join posts p on p.id = c.post_id and p.type = 'thread'
  where c.created_at >= ? and c.created_at < ? and c.user_id is not null and c.user_id <> ${AXOLOTL_ID}
  ${DONE}`

const POST_REACTIONS = `${INSERT}
  select r.date_reacted, 'reaction_added', r.user_id, coalesce(gp.group_id, 0), 'reaction', r.id, p.user_id, p.type, 'backfill'
  from reactions r
  join posts p on p.id = r.entity_id and r.entity_type = 'post'
  left join groups_posts gp on gp.post_id = p.id
  where r.date_reacted >= ? and r.date_reacted < ? and r.user_id is not null and r.user_id <> ${AXOLOTL_ID}
    and p.type <> 'thread'
  ${DONE}`

const COMMENT_REACTIONS = `${INSERT}
  select r.date_reacted, 'reaction_added', r.user_id,
    case when p.type = 'thread' then 0 else coalesce(gp.group_id, 0) end,
    'reaction', r.id, c.user_id, p.type, 'backfill'
  from reactions r
  join comments c on c.id = r.entity_id and r.entity_type = 'comment'
  join posts p on p.id = c.post_id
  left join groups_posts gp on gp.post_id = p.id and p.type <> 'thread'
  where r.date_reacted >= ? and r.date_reacted < ? and r.user_id is not null and r.user_id <> ${AXOLOTL_ID}
  ${DONE}`

// Editing an event re-stamps RSVP times, so a re-sent invitation falls back to created_at.
const RSVPS = `${INSERT}
  select case when coalesce(ei.ical_sequence, 0) >= 2 then ei.created_at else coalesce(ei.updated_at, ei.created_at) end,
    'event_rsvp', ei.user_id, coalesce(gp.group_id, 0), 'event_invitation', ei.id, p.user_id, 'event', 'backfill'
  from event_invitations ei
  join posts p on p.id = ei.event_id
  left join groups_posts gp on gp.post_id = p.id
  where ei.response in ('yes', 'interested') and ei.user_id <> p.user_id and ei.user_id <> ${AXOLOTL_ID}
    and (case when coalesce(ei.ical_sequence, 0) >= 2 then ei.created_at else coalesce(ei.updated_at, ei.created_at) end) >= ?
    and (case when coalesce(ei.ical_sequence, 0) >= 2 then ei.created_at else coalesce(ei.updated_at, ei.created_at) end) < ?
  ${DONE}`

const VOTES = `${INSERT}
  select v.created_at, 'proposal_vote', v.user_id, coalesce(gp.group_id, 0), 'proposal_vote', v.id, p.user_id, 'proposal', 'backfill'
  from proposal_votes v
  join posts p on p.id = v.post_id
  left join groups_posts gp on gp.post_id = p.id
  where v.created_at >= ? and v.created_at < ? and v.user_id <> ${AXOLOTL_ID}
  ${DONE}`

// Members added by the author while creating the project did nothing themselves.
const PROJECTS = `${INSERT}
  select pu.created_at, 'project_joined', pu.user_id, coalesce(gp.group_id, 0), 'posts_users', pu.id, p.user_id, 'project', 'backfill'
  from posts_users pu
  join posts p on p.id = pu.post_id and p.type = 'project'
  left join groups_posts gp on gp.post_id = p.id
  where pu.project_role_id is not null and pu.active is not false and pu.user_id <> p.user_id
    and pu.user_id <> ${AXOLOTL_ID}
    and pu.created_at > p.created_at + interval '2 minutes'
    and pu.created_at >= ? and pu.created_at < ?
  ${DONE}`

const JOINS = `${INSERT}
  select gm.created_at, 'group_joined', gm.user_id, gm.group_id, 'group_membership', gm.id, null, null, 'backfill'
  from group_memberships gm
  where gm.created_at >= ? and gm.created_at < ? and gm.user_id <> ${AXOLOTL_ID}
  ${DONE}`

const REQUESTS = `${INSERT}
  select jr.created_at, 'join_request_created', jr.user_id, jr.group_id, 'join_request', jr.id, null, null, 'backfill'
  from join_requests jr
  where jr.created_at >= ? and jr.created_at < ? and jr.user_id is not null
  ${DONE}`

const DECISIONS = `${INSERT}
  select coalesce(jr.updated_at, jr.created_at), 'join_request_decided', jr.user_id, jr.group_id, 'join_request', jr.id, jr.processed_by_id, null, 'backfill'
  from join_requests jr
  where jr.status in (1, 2) and coalesce(jr.updated_at, jr.created_at) >= ? and coalesce(jr.updated_at, jr.created_at) < ?
    and jr.user_id is not null
  ${DONE}`

const INVITES_SENT = `${INSERT}
  select gi.created_at, 'invitation_sent', gi.invited_by_id, gi.group_id, 'invitation', gi.id, null, null, 'backfill'
  from group_invites gi
  where gi.created_at >= ? and gi.created_at < ?
  ${DONE}`

const INVITES_ACCEPTED = `${INSERT}
  select gi.used_at, 'invitation_accepted', gi.used_by_id, gi.group_id, 'invitation', gi.id, gi.invited_by_id, null, 'backfill'
  from group_invites gi
  where gi.used_by_id is not null and gi.used_at >= ? and gi.used_at < ?
  ${DONE}`

const ROLES = `${INSERT}
  select coalesce(gr.created_at, gr.updated_at), 'role_granted', gr.user_id, gr.group_id, 'member_group_role', gr.id, null, null, 'backfill'
  from group_memberships_group_roles gr
  where gr.active is not false and coalesce(gr.created_at, gr.updated_at) >= ? and coalesce(gr.created_at, gr.updated_at) < ?
  ${DONE}`

const GROUPS = `${INSERT}
  select g.created_at, 'group_created', g.created_by_id, g.id, 'group', g.id, null, null, 'backfill'
  from groups g
  where g.created_at >= ? and g.created_at < ? and g.created_by_id is not null
  ${DONE}`

const SIGNUPS = `${INSERT}
  select u.created_at, 'signup_completed', u.id, 0, 'user', u.id, null, null, 'backfill'
  from users u
  where u.created_at >= ? and u.created_at < ? and u.email_validated and u.id <> ${AXOLOTL_ID}
  ${DONE}`

const STATEMENTS = [POSTS, COMMENTS, MESSAGES, POST_REACTIONS, COMMENT_REACTIONS, RSVPS, VOTES, PROJECTS, JOINS, REQUESTS, DECISIONS, INVITES_SENT, INVITES_ACCEPTED, ROLES, GROUPS, SIGNUPS]

/**
 * Copies historical actions into activity_events. Safe to run again: a row
 * already copied is skipped. `from` and `to` are UTC days, and `to` is excluded.
 */
export async function backfillEvents (knex, { from, to, log = () => {} }) {
  const chunks = windows(from, to, 31)
  for (const chunk of chunks) {
    log(`${chunk.from.slice(0, 10)}`)
    for (const sql of STATEMENTS) {
      await knex.raw(sql, [chunk.from, chunk.to])
    }
  }
  return chunks.length
}
