import { AXOLOTL_ID } from '../sql'
import { NON_DM_TYPES, NOT_AUTHOR_ASSIGNED, RSVP_T } from '../contributions'

export const section = {
  id: 'network_alive',
  title: 'Network vitality',
  question: 'Is the network alive, and is life spreading beyond a few places?'
}

// pg returns bigint/numeric as strings; keep null as null.
const num = v => (v === null || v === undefined ? null : Number(v))

// Shared SQL fragments. Every metric in this section uses the same content,
// human and space-rollup rules so the numbers agree with each other.
const HUMAN = `and {u}.active and {u}.id <> ${AXOLOTL_ID}`
const human = alias => HUMAN.replace(/\{u\}/g, alias)

// Spaces (chat rooms, tracks, funding rounds) roll up to their parent group.
const GMAP = "gmap as (select id as gid, case when type = 'space' then parent_id else id end as tgt from groups where active)"

// Comments and reactions may answer a post up to 14 days old (30 days for
// events, proposals and projects, which stay open longer).
const POST_AGE_CAP = "case when np.type in ('event','proposal','project') then interval '30 days' else interval '14 days' end"

const WEEK_PARAMS = `params as (
  select cast(:asOf as timestamptz) as as_of,
         date_trunc('week', cast(:asOf as timestamptz) at time zone 'UTC') as cur_wk
)`

const MONTH_ENDS = `params as (
  select cast(:asOf as timestamptz) as as_of,
         date_trunc('month', cast(:asOf as timestamptz) at time zone 'UTC') as cur_m
),
ends as (
  select to_char(cur_m - (k * interval '1 month'), 'YYYY-MM-DD') as bucket,
         (cur_m - (k * interval '1 month')) at time zone 'UTC' as e, false as is_current
  from params, generate_series(0, 11) k
  union all
  -- The window ending at asOf, unless asOf is itself a month start (already listed).
  select to_char(as_of at time zone 'UTC', 'YYYY-MM-DD'), as_of, true from params
  where as_of > cur_m at time zone 'UTC'
)`

// Cross-person interactions (the WCM building block). Expects a `win` CTE with
// s (window start), e (window end). Emits k (kind), id, a (actor), b (target
// author), t (time), post_id (target post, for group attribution).
const INTERACTIONS = `np as (
  select p.id, p.user_id, p.created_at, p.type from posts p, win
  where p.active and p.type not in ${NON_DM_TYPES}
    and p.created_at >= win.s - interval '30 days' and p.created_at < win.e
),
nc as (
  select c.id, c.user_id, c.created_at, c.post_id from comments c
  join posts pp on pp.id = c.post_id and pp.active and pp.type not in ${NON_DM_TYPES}, win
  where c.active is not false and c.created_at >= win.s - interval '14 days' and c.created_at < win.e
),
ix as (
  select 'c' k, nc.id, nc.user_id a, np.user_id b, nc.created_at t, np.id post_id
  from nc join np on np.id = nc.post_id, win
  where nc.created_at >= win.s and np.created_at >= nc.created_at - ${POST_AGE_CAP}
  union all
  select 'r', r.id, r.user_id, np.user_id, r.date_reacted, np.id
  from reactions r join np on np.id = r.entity_id and r.entity_type = 'post', win
  where r.date_reacted >= win.s and r.date_reacted < win.e and np.created_at >= r.date_reacted - ${POST_AGE_CAP}
  union all
  select 'r', r.id, r.user_id, nc.user_id, r.date_reacted, nc.post_id
  from reactions r join nc on nc.id = r.entity_id and r.entity_type = 'comment', win
  where r.date_reacted >= win.s and r.date_reacted < win.e and nc.created_at >= r.date_reacted - interval '14 days'
  union all
  select 'e', x.id, x.user_id, np.user_id, x.t, np.id
  from (
    select ei.id, ei.user_id, ei.event_id, ${RSVP_T} t from event_invitations ei
    where ei.response in ('yes','interested')
  ) x join np on np.id = x.event_id and np.type = 'event', win
  where x.t >= win.s and x.t < win.e and np.created_at >= x.t - interval '30 days'
  union all
  select 'v', v.id, v.user_id, np.user_id, v.created_at, np.id
  from proposal_votes v join np on np.id = v.post_id and np.type = 'proposal', win
  where v.created_at >= win.s and v.created_at < win.e and np.created_at >= v.created_at - interval '30 days'
  union all
  select 'j', pu.id, pu.user_id, np.user_id, pu.created_at, np.id
  from posts_users pu join np on np.id = pu.post_id and np.type = 'project', win
  where pu.project_role_id is not null and pu.active is not false and ${NOT_AUTHOR_ASSIGNED}
    and pu.created_at >= win.s and pu.created_at < win.e and np.created_at >= pu.created_at - interval '30 days'
),
hix as (
  select ix.k, ix.id, ix.a, ix.b, ix.t, ix.post_id from ix
  join users ua on ua.id = ix.a ${human('ua')}
  join users ub on ub.id = ix.b ${human('ub')}, win
  where ix.a <> ix.b and ix.t >= win.s and ix.t < win.e
)`

// Voices: human authors of non-DM posts, or of comments on them, attributed to
// each group the post is in, with spaces mapped to their parent group. Expects
// a `bounds` CTE (s, e) and a `g` CTE of eligible groups.
const VOICE_DAYS = `${GMAP},
voice_events as (
  select gm.tgt as group_id, p.user_id, p.created_at t
  from posts p join users u on u.id = p.user_id ${human('u')}
  join groups_posts gp on gp.post_id = p.id
  join gmap gm on gm.gid = gp.group_id, bounds b
  where p.active and p.type not in ${NON_DM_TYPES} and p.created_at >= b.s and p.created_at < b.e
  union all
  select gm.tgt, c.user_id, c.created_at
  from comments c
  join posts p on p.id = c.post_id and p.active and p.type not in ${NON_DM_TYPES}
  join users u on u.id = c.user_id ${human('u')}
  join groups_posts gp on gp.post_id = p.id
  join gmap gm on gm.gid = gp.group_id, bounds b
  where c.active is not false and c.created_at >= b.s and c.created_at < b.e
),
gv as (
  select ve.group_id, ve.user_id, date_trunc('day', ve.t at time zone 'UTC') d
  from voice_events ve join g on g.id = ve.group_id
  group by 1, 2, 3
)`

const ELIGIBLE_GROUPS = "g as (select id, created_at from groups where active and coalesce(type,'') <> 'space')"

const seriesFrom = (rows, { granularity, lines, partialLast = false, windowDays = null }) => ({
  granularity,
  ...(windowDays ? { xMeaning: 'window-end', windowDays } : {}),
  x: rows.map(r => r.bucket),
  lines: lines.map(({ key, col, label, primary, unit }) => ({
    key,
    label,
    values: rows.map(r => num(r[col || key])),
    ...(primary ? { primary: true } : {}),
    ...(unit ? { unit } : {})
  })),
  partialLast
})

const isNum = v => typeof v === 'number' && Number.isFinite(v)
const DAY_MS = 24 * 60 * 60 * 1000
const dayNumber = iso => Date.parse(`${iso}T00:00:00Z`) / DAY_MS

// Headline for trailing-window series. Neighbouring points of a trailing window
// overlap heavily (a 90-day window moved by a month shares 60 days), so the
// generic "last vs previous point" delta would mostly compare a window with
// itself. Instead compare the latest window with the most recent earlier window
// that overlaps it by less than a week. The period is the window's end date,
// which the panel labels with the series' window length.
const trailingWindowHeadline = windowDays => data => {
  const line = data.lines.find(l => l.primary) || data.lines[0]
  if (!line) return null
  const points = data.x.map((x, i) => ({ x, v: line.values[i] })).filter(p => isNum(p.v))
  if (!points.length) return null
  const last = points[points.length - 1]
  const cutoff = dayNumber(last.x) - windowDays + 6
  const prev = points.slice(0, -1).filter(p => dayNumber(p.x) <= cutoff).pop() || null
  return {
    value: last.v,
    previous: prev ? prev.v : null,
    period: last.x
  }
}

const HEADLINE_28_NOTE = 'The headline compares the latest 28-day window with the most recent earlier window that overlaps it by less than a week.'

const SPACES_NOTE = 'Activity in spaces (chat rooms, tracks and funding rounds) counts toward the parent group; spaces are never counted as groups on their own.'
const PROJECT_NOTE = 'Project join times are approximate: posts_users has no join timestamp, so the row\'s creation time is used, and members added by the author when creating the project are left out.'
const RSVP_NOTE = 'RSVP times are approximate: editing an event re-stamps every RSVP, so re-sent invitations fall back to when the invitation was created.'

export const metrics = [
  {
    id: 'weekly_connected_members',
    label: 'Weekly connected members',
    definition: 'Distinct people on either side of a cross-person interaction in each Monday–Sunday week (UTC). An interaction is a comment, a reaction, an RSVP of yes or interested, a proposal vote, or joining a project, on non-DM content. The post or comment being answered must be at most 14 days old, or 30 days for events, proposals and projects. Self-interactions, the Axolotl bot, deactivated accounts, DM threads and project members added by the author at creation are excluded. Shows 26 weeks, a 4-week rolling average of complete weeks, and the current partial week. Also shows the people connected by more than a reaction: the same count with reactions left out, so only comments, RSVPs, proposal votes and project joins count.',
    whyItMatters: 'This is the core-value unit: it rises only when contributions get answered. A reaction is the lightest touch, so the second line shows how much of that connection went further than one.',
    display: 'series',
    unit: 'count',
    goodDirection: 'up',
    vital: true,
    notes: `The current week is partial. ${PROJECT_NOTE} ${RSVP_NOTE}`,
    sql: `with ${WEEK_PARAMS},
win as (select (cur_wk - interval '28 weeks') at time zone 'UTC' as s, as_of as e, cur_wk from params),
weeks as (select generate_series(cur_wk - interval '28 weeks', cur_wk, interval '1 week') as wk from params),
${INTERACTIONS},
m as (
  select date_trunc('week', t at time zone 'UTC') wk, a u, k from hix
  union
  select date_trunc('week', t at time zone 'UTC'), b, k from hix
),
agg as (
  select wk, count(distinct u)::int n, (count(distinct u) filter (where k <> 'r'))::int n_beyond
  from m group by wk
),
series as (
  select w.wk, coalesce(agg.n, 0) n, coalesce(agg.n_beyond, 0) n_beyond, (w.wk = (select cur_wk from win)) is_partial
  from weeks w left join agg on agg.wk = w.wk
)
select to_char(wk, 'YYYY-MM-DD') as bucket, value, beyond_reactions, rolling_avg_4w, is_partial from (
  select wk, n as value, n_beyond as beyond_reactions, is_partial,
         case when is_partial or count(*) over w4 < 4 then null else round(avg(n) over w4, 1) end as rolling_avg_4w
  from series window w4 as (order by wk rows between 3 preceding and current row)
) r where wk >= (select cur_wk from params) - interval '25 weeks'
order by wk`,
    transform: rows => seriesFrom(rows, {
      granularity: 'week',
      partialLast: rows.length > 0 && rows[rows.length - 1].is_partial === true,
      lines: [
        { key: 'value', label: 'Connected members', primary: true },
        { key: 'beyond_reactions', label: 'Connected by more than a reaction' },
        { key: 'rolling_avg_4w', label: '4-week average' }
      ]
    })
  },
  {
    id: 'weekly_active_contributors',
    label: 'Weekly active contributors',
    definition: 'Distinct people with at least one contribution in each Monday–Sunday week (UTC). A contribution is a non-DM post of any type (chat included), a comment on one, a reaction to either, an RSVP of yes or interested to someone else\'s event, a proposal vote, or joining someone else\'s project. The Axolotl bot and deactivated accounts are excluded, as are project members added by the author at creation. Also shows the subset who posted or commented, and a 4-week rolling average of complete weeks.',
    whyItMatters: 'This is the supply side of the network. It replaces daily or weekly active users, which cannot be rebuilt from users.last_active_at.',
    display: 'series',
    unit: 'count',
    goodDirection: 'up',
    vital: false,
    notes: `The current week is partial. ${PROJECT_NOTE} ${RSVP_NOTE}`,
    sql: `with ${WEEK_PARAMS},
win as (select (cur_wk - interval '28 weeks') at time zone 'UTC' as s, as_of as e, cur_wk from params),
weeks as (select generate_series(cur_wk - interval '28 weeks', cur_wk, interval '1 week') as wk from params),
np as (
  select p.id, p.user_id, p.created_at, p.type from posts p
  where p.active and p.type not in ${NON_DM_TYPES}
),
nc as (
  select c.id, c.user_id, c.created_at from comments c join np on np.id = c.post_id
  where c.active is not false
),
contrib as (
  select np.user_id u, np.created_at t, true pc from np, win where np.created_at >= win.s and np.created_at < win.e
  union all
  select nc.user_id, nc.created_at, true from nc, win where nc.created_at >= win.s and nc.created_at < win.e
  union all
  select r.user_id, r.date_reacted, false from reactions r join np on np.id = r.entity_id and r.entity_type = 'post', win
  where r.date_reacted >= win.s and r.date_reacted < win.e
  union all
  select r.user_id, r.date_reacted, false from reactions r join nc on nc.id = r.entity_id and r.entity_type = 'comment', win
  where r.date_reacted >= win.s and r.date_reacted < win.e
  union all
  select x.user_id, x.t, false from (
    select ei.user_id, ei.event_id, ${RSVP_T} t from event_invitations ei
    where ei.response in ('yes','interested')
  ) x join np on np.id = x.event_id and np.type = 'event', win
  where x.t >= win.s and x.t < win.e and x.user_id <> np.user_id
  union all
  select v.user_id, v.created_at, false from proposal_votes v join np on np.id = v.post_id and np.type = 'proposal', win
  where v.created_at >= win.s and v.created_at < win.e
  union all
  select pu.user_id, pu.created_at, false from posts_users pu join np on np.id = pu.post_id and np.type = 'project', win
  where pu.project_role_id is not null and pu.active is not false and pu.user_id <> np.user_id and ${NOT_AUTHOR_ASSIGNED}
    and pu.created_at >= win.s and pu.created_at < win.e
),
hc as (
  select date_trunc('week', c.t at time zone 'UTC') wk, c.u, bool_or(c.pc) pc
  from contrib c join users us on us.id = c.u ${human('us')}
  group by 1, 2
),
agg as (select wk, count(*)::int n, count(*) filter (where pc)::int n_pc from hc group by wk),
series as (
  select w.wk, coalesce(agg.n, 0) n, coalesce(agg.n_pc, 0) n_pc, (w.wk = (select cur_wk from params)) is_partial
  from weeks w left join agg on agg.wk = w.wk
)
select to_char(wk, 'YYYY-MM-DD') as bucket, value, posted_or_commented, rolling_avg_4w, is_partial from (
  select wk, n as value, n_pc as posted_or_commented, is_partial,
         case when is_partial or count(*) over w4 < 4 then null else round(avg(n) over w4, 1) end as rolling_avg_4w
  from series window w4 as (order by wk rows between 3 preceding and current row)
) r where wk >= (select cur_wk from params) - interval '25 weeks'
order by wk`,
    transform: rows => seriesFrom(rows, {
      granularity: 'week',
      partialLast: rows.length > 0 && rows[rows.length - 1].is_partial === true,
      lines: [
        { key: 'value', label: 'Active contributors', primary: true },
        { key: 'posted_or_commented', label: 'Posted or commented' },
        { key: 'rolling_avg_4w', label: '4-week average' }
      ]
    })
  },
  {
    id: 'live_groups',
    label: 'Live groups',
    definition: 'Active groups (farms included) with at least 3 distinct people posting or commenting on non-DM posts in the trailing 28 days. Activity in a group\'s spaces counts toward that group. Each point covers the 28 days before the Monday shown, over 26 weeks. Also shows groups with at least 1, 5 and 10 voices, and the share of all active groups that are live.',
    whyItMatters: 'This is the real size of the network: the rooms where a conversation is actually happening. Most groups that exist are not live.',
    display: 'series',
    unit: 'count',
    goodDirection: 'up',
    vital: true,
    notes: `${SPACES_NOTE} Each point is the 28 days before the Monday shown (UTC), so the latest point lags today by up to 6 days. ${HEADLINE_28_NOTE} The share uses today's active flag for groups, since there is no activation history. Counts here are of groups, not people.`,
    sql: `with ${WEEK_PARAMS},
ends as (
  select (e at time zone 'UTC') as e, e as e_ts
  from params, generate_series(cur_wk - interval '25 weeks', cur_wk, interval '1 week') e
),
bounds as (select min(e) - interval '28 days' s, max(e) e from ends),
${ELIGIBLE_GROUPS},
${VOICE_DAYS},
per_group as (
  select en.e_ts, gv.group_id, count(distinct gv.user_id) voices
  from ends en join gv on gv.d >= en.e_ts - interval '28 days' and gv.d < en.e_ts
  group by 1, 2
),
tot as (
  select en.e_ts, count(g.id)::int total_groups from ends en join g on g.created_at < en.e group by 1
)
select to_char(en.e_ts, 'YYYY-MM-DD') as bucket,
       count(pg.group_id) filter (where pg.voices >= 3)::int as value,
       count(pg.group_id) filter (where pg.voices >= 1)::int as ge1,
       count(pg.group_id) filter (where pg.voices >= 5)::int as ge5,
       count(pg.group_id) filter (where pg.voices >= 10)::int as ge10,
       tot.total_groups as denominator,
       round(count(pg.group_id) filter (where pg.voices >= 3)::numeric / nullif(tot.total_groups, 0), 5) as share
from ends en join tot on tot.e_ts = en.e_ts left join per_group pg on pg.e_ts = en.e_ts
group by en.e_ts, tot.total_groups
order by en.e_ts`,
    transform: rows => seriesFrom(rows, {
      granularity: 'week',
      partialLast: false,
      windowDays: 28,
      lines: [
        { key: 'value', label: 'Live groups (3+ voices)', primary: true },
        { key: 'ge1', label: '1+ voices' },
        { key: 'ge5', label: '5+ voices' },
        { key: 'ge10', label: '10+ voices' },
        { key: 'share', label: 'Share of active groups', unit: 'percent' }
      ]
    }),
    headline: trailingWindowHeadline(28)
  },
  {
    id: 'live_group_survival',
    label: 'Live group survival, lapse and birth',
    definition: 'Compares consecutive, non-overlapping 28-day windows using the live-group rule (at least 3 people posting or commenting, with space activity counted toward the parent group). Survived: live in the prior window and still live. Lapsed: live before but not now. Newly live: live now but not before. The headline is the survival share, survived ÷ live in the prior window. One point every 4 weeks for 12 months.',
    whyItMatters: 'This separates real network growth from churn among community hubs. A flat live-group count can hide heavy churn in one direction and heavy revival in the other.',
    display: 'series',
    unit: 'percent',
    goodDirection: 'up',
    vital: false,
    notes: `${SPACES_NOTE} Each point compares the 28 days before the Monday shown (UTC) with the 28 days before that; points are 4 weeks apart. Counts here are of groups, not people. Groups deactivated since then drop out of every window instead of showing as lapsed, which slightly understates past lapses.`,
    sql: `with ${WEEK_PARAMS},
ends as (
  select k, cur_wk - (k * interval '28 days') as e_ts from params, generate_series(0, 13) k
),
bounds as (select (min(e_ts) - interval '28 days') at time zone 'UTC' s, max(e_ts) at time zone 'UTC' e from ends),
${ELIGIBLE_GROUPS},
${VOICE_DAYS},
live as (
  select en.k, gv.group_id
  from ends en join gv on gv.d >= en.e_ts - interval '28 days' and gv.d < en.e_ts
  group by 1, 2 having count(distinct gv.user_id) >= 3
),
cmp as (
  select en.k, en.e_ts,
    (select count(*) from live l where l.k = en.k)::int live_now,
    (select count(*) from live l where l.k = en.k + 1)::int prior_live,
    (select count(*) from live l join live lp on lp.group_id = l.group_id and lp.k = en.k + 1 where l.k = en.k)::int survived
  from ends en where en.k <= 12
)
select to_char(e_ts, 'YYYY-MM-DD') as bucket,
       round(survived::numeric / nullif(prior_live, 0), 4) as survival,
       survived,
       prior_live - survived as lapsed,
       live_now - survived as newly_live,
       live_now,
       prior_live
from cmp order by e_ts`,
    transform: rows => seriesFrom(rows, {
      granularity: 'week',
      partialLast: false,
      windowDays: 28,
      lines: [
        { key: 'survival', label: 'Survival share', primary: true, unit: 'percent' },
        { key: 'survived', label: 'Survived', unit: 'count' },
        { key: 'lapsed', label: 'Lapsed', unit: 'count' },
        { key: 'newly_live', label: 'Newly live', unit: 'count' }
      ]
    }),
    headline: trailingWindowHeadline(28)
  },
  {
    id: 'connection_concentration',
    label: 'Share of connections in the top 10 groups',
    definition: 'Of all weekly-connected-members interactions in the trailing 28 days that belong to a group (through the answered post, with space posts counted toward the parent group), the share that happened in the 10 groups with the most such interactions. Each interaction counts once, even when its post is in several groups. One point at each month start for 12 months, plus a point for the 28 days ending today. Group names are never shown.',
    whyItMatters: 'This is a fragility signal. If a few communities carry the network, losing one steward becomes a platform-level event. A falling share means growth is broadening.',
    display: 'series',
    unit: 'percent',
    goodDirection: 'down',
    vital: false,
    notes: `${SPACES_NOTE} Each point is the 28 days before the date shown: month starts, plus a last point for the 28 days before the as-of date. ${HEADLINE_28_NOTE} Interactions on posts in no active group are left out of both sides. Counts are platform-wide interaction and group totals. ${PROJECT_NOTE}`,
    sql: `with ${MONTH_ENDS},
win as (select min(e) - interval '28 days' as s, max(e) as e from ends),
${INTERACTIONS},
${GMAP},
gix as (
  select distinct hix.k, hix.id, hix.t, g.id group_id from hix
  join groups_posts gp on gp.post_id = hix.post_id
  join gmap gm on gm.gid = gp.group_id
  join groups g on g.id = gm.tgt and g.active and coalesce(g.type,'') <> 'space'
),
wg as (
  select en.bucket, gix.group_id, count(*) n
  from ends en join gix on gix.t >= en.e - interval '28 days' and gix.t < en.e
  group by 1, 2
),
top10 as (
  select bucket, group_id from (
    select bucket, group_id, row_number() over (partition by bucket order by n desc, group_id) rn from wg
  ) x where rn <= 10
),
res as (
  select en.bucket, en.is_current,
    (select count(distinct (gix.k, gix.id)) from gix where gix.t >= en.e - interval '28 days' and gix.t < en.e) as denom,
    (select count(distinct (gix.k, gix.id)) from gix join top10 t on t.group_id = gix.group_id and t.bucket = en.bucket
       where gix.t >= en.e - interval '28 days' and gix.t < en.e) as numer,
    (select count(*) from wg where wg.bucket = en.bucket) as groups_with_connections,
    (select count(*) from hix where hix.t >= en.e - interval '28 days' and hix.t < en.e) as all_interactions
  from ends en
)
select bucket,
       round(numer::numeric / nullif(denom, 0), 4) as value,
       numer::int as numerator,
       denom::int as denominator,
       groups_with_connections::int as groups_with_connections,
       all_interactions::int as all_interactions,
       is_current
from res order by bucket`,
    transform: rows => seriesFrom(rows, {
      granularity: 'month',
      partialLast: false,
      windowDays: 28,
      lines: [
        { key: 'value', label: 'Top-10 share', primary: true, unit: 'percent' },
        { key: 'denominator', label: 'Group interactions', unit: 'count' },
        { key: 'groups_with_connections', label: 'Groups with interactions', unit: 'count' },
        { key: 'all_interactions', label: 'All interactions', unit: 'count' }
      ]
    }),
    headline: trailingWindowHeadline(28)
  },
  {
    id: 'multi_group_weavers',
    label: 'Contributors active in 2+ groups',
    definition: 'Among people who wrote a non-DM post or a comment in the trailing 90 days, the share whose posts and comments span at least 2 distinct active groups (space posts count toward the parent group). Also shows the share spanning 3 or more groups, and a comment-only share among commenters, because cross-posting can inflate the post-based count. One point at each month start for 12 months, plus a point for the 90 days ending today.',
    whyItMatters: 'Weavers carry trust and knowledge between communities, which is how local work scales into movements.',
    display: 'series',
    unit: 'percent',
    goodDirection: 'up',
    vital: false,
    notes: `${SPACES_NOTE} Each point is the 90 days before the date shown: month starts, plus a last point for the 90 days before the as-of date. The headline compares the latest 90-day window with the most recent earlier window that overlaps it by less than a week, since neighbouring points share about 60 days. Contributors whose content is in no group stay in the denominator. The "2+ groups, space content excluded" line is a sensitivity check: it counts only non-space groups, while keeping the same contributor denominator. All shares are platform-wide, so none is suppressed.`,
    sql: `with ${MONTH_ENDS},
win as (select min(e) - interval '90 days' as s, max(e) as e from ends),
content as (
  select p.user_id u, p.id post_id, p.created_at t, false is_comment from posts p, win
  where p.active and p.type not in ${NON_DM_TYPES} and p.created_at >= win.s and p.created_at < win.e
  union all
  select c.user_id, c.post_id, c.created_at, true from comments c
  join posts p on p.id = c.post_id and p.active and p.type not in ${NON_DM_TYPES}, win
  where c.active is not false and c.created_at >= win.s and c.created_at < win.e
),
hc as (
  select distinct content.u, content.post_id, date_trunc('day', content.t at time zone 'UTC') at time zone 'UTC' d, content.is_comment
  from content join users us on us.id = content.u ${human('us')}
),
pg as (
  select gp.post_id,
         case when g.type = 'space' then null else g.id end ns_group_id,
         case when g.type = 'space' then pg2.id else g.id end rollup_group_id
  from groups_posts gp join groups g on g.id = gp.group_id and g.active
  left join groups pg2 on pg2.id = g.parent_id and pg2.active and coalesce(pg2.type,'') <> 'space'
  where gp.post_id in (select post_id from hc)
),
per_user as (
  select en.bucket, hc.u,
    count(distinct pg.rollup_group_id) n_groups,
    count(distinct pg.rollup_group_id) filter (where hc.is_comment) n_comment_groups,
    count(distinct pg.ns_group_id) n_ns_groups,
    bool_or(hc.is_comment) commented
  from ends en
  join hc on hc.d >= en.e - interval '90 days' and hc.d < en.e
  left join pg on pg.post_id = hc.post_id
  group by 1, 2
)
select en.bucket,
       round((count(*) filter (where n_groups >= 2))::numeric / nullif(count(pu.u), 0), 4) as value,
       count(*) filter (where n_groups >= 2)::int as numerator,
       count(pu.u)::int as denominator,
       round((count(*) filter (where n_groups >= 3))::numeric / nullif(count(pu.u), 0), 4) as ge3_share,
       round((count(*) filter (where n_comment_groups >= 2))::numeric / nullif(count(*) filter (where commented), 0), 4) as comment_ge2_share,
       round((count(*) filter (where n_ns_groups >= 2))::numeric / nullif(count(pu.u), 0), 4) as ns_ge2_share,
       en.is_current
from ends en left join per_user pu on pu.bucket = en.bucket
group by en.bucket, en.is_current
order by en.bucket`,
    transform: rows => seriesFrom(rows, {
      granularity: 'month',
      partialLast: false,
      windowDays: 90,
      lines: [
        { key: 'value', label: '2+ groups', primary: true, unit: 'percent' },
        { key: 'ge3_share', label: '3+ groups', unit: 'percent' },
        { key: 'comment_ge2_share', label: 'Commenters in 2+ groups', unit: 'percent' },
        { key: 'ns_ge2_share', label: '2+ groups, space content excluded', unit: 'percent' },
        { key: 'denominator', label: 'Contributors', unit: 'count' }
      ]
    }),
    headline: trailingWindowHeadline(90)
  },
  {
    id: 'live_groups_linked',
    label: 'Live groups linked to another group',
    definition: 'Share of live groups (at least 3 people posting or commenting in the 28 days before this week\'s Monday, with space activity counted toward the parent group) that have at least one active parent-child or peer relationship with another active group. Also shows network-wide link counts and the new links created in each of the last four full quarters and the current quarter so far.',
    whyItMatters: 'Networks of groups, such as bioregions and alliances, are how regeneration scales without centralizing.',
    display: 'kpi',
    unit: 'percent',
    goodDirection: 'up',
    vital: false,
    notes: `${SPACES_NOTE} Spaces link to their parent through the group itself, not through group relationships, so they are not counted as links. Network-wide link counts include only links between two active groups; quarterly counts include links later removed or whose groups are now inactive. For a past date, links removed since then still count, but groups deactivated since then drop out.`,
    sql: `with params as (
  select cast(:asOf as timestamptz) as as_of,
         date_trunc('week', cast(:asOf as timestamptz) at time zone 'UTC') at time zone 'UTC' as e,
         date_trunc('quarter', cast(:asOf as timestamptz) at time zone 'UTC') as cur_q
),
bounds as (select e - interval '28 days' as s, e from params),
${ELIGIBLE_GROUPS},
${VOICE_DAYS},
live as (
  select gv.group_id from gv group by 1 having count(distinct gv.user_id) >= 3
),
links as (
  select r.parent_group_id a, r.child_group_id b, r.relationship_type from group_relationships r
  join g ga on ga.id = r.parent_group_id join g gb on gb.id = r.child_group_id, params
  where (r.active or r.updated_at >= params.as_of) and r.parent_group_id <> r.child_group_id and r.created_at < params.as_of
),
live_linked as (
  select l.group_id,
    exists (select 1 from links k where k.relationship_type = 0 and (k.a = l.group_id or k.b = l.group_id)) pc,
    exists (select 1 from links k where k.relationship_type = 1 and (k.a = l.group_id or k.b = l.group_id)) peer
  from live l
),
quarters as (
  select q from params, generate_series(cur_q - interval '12 months', cur_q, interval '3 months') q
),
qc as (
  select date_trunc('quarter', r.created_at at time zone 'UTC') q,
         count(*) filter (where r.relationship_type = 0) pc,
         count(*) filter (where r.relationship_type = 1) peer
  from group_relationships r
  join groups ga on ga.id = r.parent_group_id and coalesce(ga.type,'') <> 'space'
  join groups gb on gb.id = r.child_group_id and coalesce(gb.type,'') <> 'space', params
  where r.created_at < params.as_of and r.created_at >= (params.cur_q - interval '12 months') at time zone 'UTC'
  group by 1
)
select
  (select to_char(e at time zone 'UTC', 'YYYY-MM-DD') from params) as window_end,
  round((count(*) filter (where pc or peer))::numeric / nullif(count(*), 0), 4) as value,
  count(*) filter (where pc or peer)::int as numerator,
  count(*)::int as denominator,
  count(*) filter (where pc)::int as live_with_parent_child_link,
  count(*) filter (where peer)::int as live_with_peer_link,
  (select count(*) from links where relationship_type = 0)::int as active_parent_child_links,
  (select count(*) from links where relationship_type = 1)::int as active_peer_links,
  (select json_agg(json_build_object('quarter', to_char(quarters.q, 'YYYY-"Q"Q'), 'parent_child', coalesce(qc.pc, 0), 'peer', coalesce(qc.peer, 0),
      'is_partial', quarters.q = (select cur_q from params)) order by quarters.q)
   from quarters left join qc on qc.q = quarters.q) as created_by_quarter
from live_linked`,
    transform: rows => {
      const r = rows[0] || {}
      const quarters = r.created_by_quarter || []
      const quarterBreakdown = quarters.flatMap(q => {
        const suffix = q.is_partial ? ' (so far)' : ''
        return [
          { label: `New parent-child links, ${q.quarter}${suffix}`, value: num(q.parent_child), unit: 'count' },
          { label: `New peer links, ${q.quarter}${suffix}`, value: num(q.peer), unit: 'count' }
        ]
      })
      return {
        value: num(r.value),
        numerator: num(r.numerator),
        denominator: num(r.denominator),
        windowEnd: r.window_end || null,
        breakdown: [
          { label: 'Live groups with a parent-child link', value: num(r.live_with_parent_child_link), unit: 'count' },
          { label: 'Live groups with a peer link', value: num(r.live_with_peer_link), unit: 'count' },
          { label: 'Active parent-child links, network-wide', value: num(r.active_parent_child_links), unit: 'count' },
          { label: 'Active peer links, network-wide', value: num(r.active_peer_links), unit: 'count' },
          ...quarterBreakdown
        ]
      }
    },
    headline: data => (isNum(data.value) ? { value: data.value, previous: null, period: data.windowEnd, windowDays: 28 } : null)
  }
]
