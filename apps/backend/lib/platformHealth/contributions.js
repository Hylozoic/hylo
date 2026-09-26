// The contribution rule shared by every contributor count on the panel (Weekly
// and Monthly active contributors, retention and activation): a non-DM post of
// any type, a comment on one, a reaction to either, an RSVP of yes or interested
// to someone else's event, a vote on a proposal, or joining someone else's
// project after it was created.

export const NON_DM_TYPES = "('thread','chat_activity','welcome')"

// RSVP time: event edits re-send invitations and re-stamp updated_at, so once
// ical_sequence shows a re-send we fall back to created_at.
export const RSVP_T = 'case when coalesce(ei.ical_sequence, 0) >= 2 then ei.created_at else ei.updated_at end'

// Project members the author picked while creating the project did nothing
// themselves; rows created within 2 minutes of the post are treated as that.
export const NOT_AUTHOR_ASSIGNED = "pu.created_at > np.created_at + interval '2 minutes'"

// The posts contributions can be made on, as an `np` CTE.
export const CONTRIBUTION_POSTS = `np as (
  select p.id, p.user_id, p.created_at, p.type from posts p
  where p.active and p.type not in ${NON_DM_TYPES}
)`

/*
 * Contribution events as (u, t) rows, one union branch per kind. Needs the
 * CONTRIBUTION_POSTS `np` CTE. `from` is appended to each branch's FROM list
 * (for example ', b' to use a bounds CTE), `userJoin(alias)` can join each
 * branch's user column to a set of people, and `when(column)` is the condition
 * on each branch's time. Callers filter to active humans.
 */
export function contributionEvents ({ from = '', userJoin = () => '', when = () => 'true' } = {}) {
  return `
  select po.user_id as u, po.created_at as t from posts po ${userJoin('po')}${from}
   where po.active and po.type not in ${NON_DM_TYPES} and ${when('po.created_at')}
  union all
  select c.user_id, c.created_at from comments c ${userJoin('c')} join np on np.id = c.post_id${from}
   where c.active is not false and ${when('c.created_at')}
  union all
  select r.user_id, r.date_reacted from reactions r ${userJoin('r')} join np on np.id = r.entity_id${from}
   where r.entity_type = 'post' and ${when('r.date_reacted')}
  union all
  select r.user_id, r.date_reacted from reactions r ${userJoin('r')}
   join comments c on c.id = r.entity_id and c.active is not false join np on np.id = c.post_id${from}
   where r.entity_type = 'comment' and ${when('r.date_reacted')}
  union all
  select ei.user_id, ${RSVP_T} from event_invitations ei ${userJoin('ei')} join np on np.id = ei.event_id and np.type = 'event'${from}
   where ei.response in ('yes', 'interested') and ei.user_id <> np.user_id and ${when(RSVP_T)}
  union all
  select v.user_id, v.created_at from proposal_votes v ${userJoin('v')} join np on np.id = v.post_id and np.type = 'proposal'${from}
   where ${when('v.created_at')}
  union all
  select pu.user_id, pu.created_at from posts_users pu ${userJoin('pu')} join np on np.id = pu.post_id and np.type = 'project'${from}
   where pu.project_role_id is not null and pu.active is not false and pu.user_id <> np.user_id and ${NOT_AUTHOR_ASSIGNED}
     and ${when('pu.created_at')}`
}
