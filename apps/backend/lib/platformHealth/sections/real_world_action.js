import { AXOLOTL_ID } from '../sql'

export const section = {
  id: 'real_world_action',
  title: 'Coordination outcomes',
  question: 'Is online activity turning into needs met, gatherings, decisions and projects in the world?'
}

// All month buckets are pinned to UTC: timestamps are converted to UTC wall-clock
// time (`ts at time zone 'UTC'`) before date_trunc and interval arithmetic, so the
// results do not depend on the database session time zone. Day windows applied to
// timestamptz values are written in hours (720 hours = 30 days) because day intervals
// on timestamptz follow the session time zone's DST changes.

// Rates computed over fewer than this many items are returned as null.
const MIN_N = 5

// Shared SQL fragments, kept identical to network_alive so the sections agree.
// Non-DM content types excluded from "posting or commenting".
const NON_DM_TYPES = "('thread','chat_activity','welcome')"
// RSVP time: event edits re-send invitations and re-stamp updated_at, so once
// ical_sequence shows a re-send we fall back to created_at.
const RSVP_T = 'case when coalesce(ei.ical_sequence, 0) >= 2 then ei.created_at else ei.updated_at end'
// Project members added by the creator: rows created within 2 minutes of the
// project (listed at creation), or within 5 seconds of the project's last edit
// (added by editing it; updatePost stamps edited_at, then sets members). Only the
// most recent edit is recorded, so members added in earlier edits still look like joins.
const CREATOR_ADDED = "(pu.created_at < {pj}.created_at + interval '2 minutes' or ({pj}.edited_at is not null and pu.created_at >= {pj}.edited_at - interval '5 seconds' and pu.created_at <= {pj}.edited_at + interval '5 seconds'))"
const creatorAdded = alias => CREATOR_ADDED.replace(/\{pj\}/g, alias)

const PRIVACY_TOTALS_NOTE = 'All counts are platform-wide totals, which are exempt from small-count suppression, so values under 5 can appear.'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthLabel = iso => {
  const [y, m] = String(iso).split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
const addMonths = (iso, k) => {
  const [y, m] = String(iso).split('-').map(Number)
  const t = y * 12 + (m - 1) + k
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`
}

const num = v => (v === null || v === undefined ? null : Number(v))
const isoDate = v => {
  if (v === null || v === undefined) return null
  if (v instanceof Date) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(v).slice(0, 10)
}
const rate = (numerator, denominator) => {
  const n = num(numerator)
  const d = num(denominator)
  if (n === null || d === null || d < MIN_N) return null
  return Math.round((n / d) * 10000) / 10000
}

let regionNames = null
try {
  regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
} catch (e) {
  regionNames = null
}
const countryName = code => {
  const upper = String(code).toUpperCase()
  try {
    return (regionNames && regionNames.of(upper)) || upper
  } catch (e) {
    return upper
  }
}

export const metrics = [
  {
    id: 'coordinating_members',
    label: 'Coordinating members',
    definition: "Distinct people in each calendar month (UTC) who took part in at least one two-sided coordination act: RSVPed yes or interested to someone else's event that started in the month, or hosted an event that got such an RSVP; commented on someone else's request or offer, or had their own request or offer answered that way; voted on someone else's proposal (the proposer's own vote does not count); joined someone else's project after it was created, or created a project that someone else joined. Members the creator listed when creating a project, or added in the project's most recent edit, do not count as joining. Active humans only (the Axolotl bot is excluded), and both sides of each act must be human. The headline is the last 30 days compared with the 30 days before.",
    whyItMatters: 'This is the real-world side of connection: people doing things together, not just talking. It overlaps heavily with connected members but uses its own timing (events count when they start, and answers to requests, offers and proposals have no age limit), so some coordinating members have no connected-members interaction in the same period. Component lines show which kind of coordination is driving it.',
    display: 'series',
    unit: 'count',
    goodDirection: 'up',
    vital: true,
    notes: `Project join dates are approximate: posts_users has no join timestamp. When someone who already followed a project (for example by commenting) later joins it, the join is dated to when they first followed, so it can land in an earlier month or be missed. Only the project's most recent edit is recorded, so members the creator added in an earlier edit still count as joining (and the creator counts with them). RSVP times are approximate: editing an event re-stamps every RSVP, so re-sent invitations fall back to when the invitation was created. Components overlap, so they do not add up to the total. The contributors line (people who posted or commented, excluding DMs) is for scale only: some coordinating members, such as voters or RSVPers, never post. An RSVP is intent, not attendance. The current month is partial. ${PRIVACY_TOTALS_NOTE}`,
    sql: `
with p0 as (
  select :asOf as as_of,
         date_trunc('month', :asOf at time zone 'UTC') as cur_m
),
p as (
  select as_of, cur_m,
         cur_m - interval '11 months' as start_m,
         (cur_m - interval '11 months') at time zone 'UTC' as start_ts,
         as_of - interval '720 hours' as start_30,
         as_of - interval '1440 hours' as start_60
  from p0
),
humans as (select id from users where active and id <> ${AXOLOTL_ID}),
acts as (
  select x.uid, x.ts, 'events'::text as comp
  from (
    select e.user_id as host, ei.user_id as rsvper, e.start_time as ts
    from posts e
    join event_invitations ei on ei.event_id = e.id
    cross join p
    where e.type = 'event' and e.active
      and e.start_time >= p.start_ts and e.start_time < p.as_of
      and ei.response in ('yes', 'interested')
      and ei.user_id <> e.user_id
      and ${RSVP_T} < p.as_of
      and e.user_id in (select id from humans) and ei.user_id in (select id from humans)
  ) s
  cross join lateral (values (s.host, s.ts), (s.rsvper, s.ts)) as x(uid, ts)
  union all
  select x.uid, x.ts, 'requests_offers'
  from (
    select r.user_id as author, c.user_id as commenter, c.created_at as ts
    from comments c
    join posts r on r.id = c.post_id
    cross join p
    where r.type in ('request', 'offer') and r.active
      and c.active is not false
      and c.created_at >= p.start_ts and c.created_at < p.as_of
      and c.user_id <> r.user_id
      and r.user_id in (select id from humans) and c.user_id in (select id from humans)
  ) s
  cross join lateral (values (s.author, s.ts), (s.commenter, s.ts)) as x(uid, ts)
  union all
  select v.user_id, v.created_at, 'votes'
  from proposal_votes v
  join posts pr on pr.id = v.post_id
  cross join p
  where pr.type = 'proposal' and pr.active
    and v.created_at >= p.start_ts and v.created_at < p.as_of
    and v.user_id <> pr.user_id
    and v.user_id in (select id from humans) and pr.user_id in (select id from humans)
  union all
  select x.uid, x.ts, 'projects'
  from (
    select pj.user_id as creator, pu.user_id as joiner, pu.created_at as ts
    from posts_users pu
    join posts pj on pj.id = pu.post_id
    cross join p
    where pj.type = 'project' and pj.active
      and pu.project_role_id is not null and pu.active
      and not ${creatorAdded('pj')}
      and pu.created_at >= p.start_ts and pu.created_at < p.as_of
      and pu.user_id <> pj.user_id
      and pj.user_id in (select id from humans) and pu.user_id in (select id from humans)
  ) s
  cross join lateral (values (s.creator, s.ts), (s.joiner, s.ts)) as x(uid, ts)
),
contrib as (
  select po.user_id as uid, po.created_at as ts
  from posts po cross join p
  where po.active and po.type not in ${NON_DM_TYPES}
    and po.created_at >= p.start_ts and po.created_at < p.as_of
    and po.user_id in (select id from humans)
  union all
  select c.user_id, c.created_at
  from comments c join posts po on po.id = c.post_id cross join p
  where c.active is not false and po.active and po.type not in ${NON_DM_TYPES}
    and c.created_at >= p.start_ts and c.created_at < p.as_of
    and c.user_id in (select id from humans)
),
tagged as (
  select a.uid, a.comp,
         date_trunc('month', a.ts at time zone 'UTC') as m,
         case when a.ts >= p.start_30 then 'cur30'
              when a.ts >= p.start_60 then 'prev30' end as win
  from (select uid, ts, comp from acts union all select uid, ts, 'contrib' from contrib) a
  cross join p
),
agg as (
  select 'month'::text as kind, m as b_start,
         count(distinct uid) filter (where comp <> 'contrib') as value,
         count(distinct uid) filter (where comp = 'events') as events,
         count(distinct uid) filter (where comp = 'requests_offers') as requests_offers,
         count(distinct uid) filter (where comp = 'votes') as votes,
         count(distinct uid) filter (where comp = 'projects') as projects,
         count(distinct uid) filter (where comp = 'contrib') as contributors
  from tagged group by m
  union all
  select win, null::timestamp,
         count(distinct uid) filter (where comp <> 'contrib'),
         count(distinct uid) filter (where comp = 'events'),
         count(distinct uid) filter (where comp = 'requests_offers'),
         count(distinct uid) filter (where comp = 'votes'),
         count(distinct uid) filter (where comp = 'projects'),
         count(distinct uid) filter (where comp = 'contrib')
  from tagged where win is not null group by win
),
buckets as (
  select 'month'::text as kind, m as b_start,
         (m + interval '1 month' > (select as_of at time zone 'UTC' from p)) as is_partial
  from generate_series((select start_m from p), (select cur_m from p), interval '1 month') as m
  union all
  select 'cur30', null::timestamp, false
  union all
  select 'prev30', null::timestamp, false
)
select b.kind,
       to_char(b.b_start, 'YYYY-MM-DD') as bucket,
       b.is_partial,
       coalesce(a.value, 0)::int as value,
       coalesce(a.events, 0)::int as events,
       coalesce(a.requests_offers, 0)::int as requests_offers,
       coalesce(a.votes, 0)::int as votes,
       coalesce(a.projects, 0)::int as projects,
       coalesce(a.contributors, 0)::int as contributors
from buckets b
left join agg a on a.kind = b.kind and a.b_start is not distinct from b.b_start
order by b.kind, b.b_start`,
    transform: rows => {
      const months = rows.filter(r => r.kind === 'month')
      const cur = rows.find(r => r.kind === 'cur30')
      const prev = rows.find(r => r.kind === 'prev30')
      const line = (key, label, extra = {}) => ({ key, label, values: months.map(r => num(r[key])), unit: 'count', ...extra })
      return {
        granularity: 'month',
        x: months.map(r => isoDate(r.bucket)),
        lines: [
          line('value', 'Coordinating members', { primary: true }),
          line('events', 'Events (RSVPs and hosts)'),
          line('requests_offers', 'Requests and offers answered'),
          line('votes', 'Proposal votes'),
          line('projects', 'Project joins'),
          line('contributors', 'Contributors (for scale)')
        ],
        partialLast: months.length ? Boolean(months[months.length - 1].is_partial) : false,
        trailing30d: cur
          ? {
              value: num(cur.value),
              previous: prev ? num(prev.value) : null,
              contributors: num(cur.contributors),
              breakdown: [
                { label: 'Events', value: num(cur.events), unit: 'count' },
                { label: 'Requests and offers', value: num(cur.requests_offers), unit: 'count' },
                { label: 'Proposal votes', value: num(cur.votes), unit: 'count' },
                { label: 'Project joins', value: num(cur.projects), unit: 'count' }
              ]
            }
          : null
      }
    },
    headline: data => {
      if (data && data.trailing30d && data.trailing30d.value !== null) {
        return { value: data.trailing30d.value, previous: data.trailing30d.previous, period: 'last 30 days' }
      }
      return null
    }
  },
  {
    id: 'needs_answered_14d',
    label: 'Requests and offers answered within 14 days',
    definition: 'Monthly cohorts (UTC) of active request and offer posts by human authors. For each cohort, the share that got a comment from a different person within 14 days of posting, shown separately for requests and offers. A secondary rate also counts a reaction from a different person as a response. Only cohorts whose 14-day window has fully closed are shown. The headline is the 3-month rolling rate for requests, compared with the non-overlapping 3-month window before it.',
    whyItMatters: 'Mutual aid starts when a request or offer gets an answer. A falling answer rate means people are asking into silence.',
    display: 'series',
    unit: 'percent',
    goodDirection: 'up',
    vital: false,
    notes: 'Each point is a posting cohort, not the month the answer came. Monthly counts are small, so the 3-month rolling rates are the more reliable signal. Rates over fewer than 5 posts are left blank. Posts whose authors were later deactivated are excluded. posts.fulfilled_at is not used because it is rarely set.',
    sql: `
with p as (
  select :asOf as as_of,
         date_trunc('month', (:asOf at time zone 'UTC') - interval '14 days') - interval '1 month' as last_m
),
p2 as (
  select as_of, last_m,
         last_m - interval '13 months' as first_m,
         (last_m - interval '13 months') at time zone 'UTC' as first_ts,
         (last_m + interval '1 month') at time zone 'UTC' as end_ts
  from p
),
humans as (select id from users where active and id <> ${AXOLOTL_ID}),
posts_c as (
  select r.id, r.type, r.user_id, r.created_at, date_trunc('month', r.created_at at time zone 'UTC') as m
  from posts r cross join p2
  where r.type in ('request', 'offer') and r.active
    and r.created_at >= p2.first_ts and r.created_at < p2.end_ts
    and r.user_id in (select id from humans)
),
cmt as (
  select distinct pc.id
  from posts_c pc
  join comments c on c.post_id = pc.id
  join humans h on h.id = c.user_id
  where c.active is not false and c.user_id <> pc.user_id
    and c.created_at >= pc.created_at and c.created_at < pc.created_at + interval '336 hours'
),
rct as (
  select distinct pc.id
  from posts_c pc
  join reactions x on x.entity_id = pc.id and x.entity_type = 'post'
  join humans h on h.id = x.user_id
  where x.user_id <> pc.user_id
    and x.date_reacted >= pc.created_at and x.date_reacted < pc.created_at + interval '336 hours'
),
flags as (
  select pc.m, pc.type, (cmt.id is not null) as commented, (rct.id is not null) as reacted
  from posts_c pc
  left join cmt on cmt.id = pc.id
  left join rct on rct.id = pc.id
),
grid as (
  select m, t.type
  from generate_series((select first_m from p2), (select last_m from p2), interval '1 month') as m
  cross join (values ('request'), ('offer')) as t(type)
),
monthly as (
  select g.m, g.type,
         count(f.type) as n,
         count(*) filter (where f.commented) as answered,
         count(*) filter (where f.commented or f.reacted) as answered_or_reacted
  from grid g left join flags f on f.m = g.m and f.type = g.type
  group by g.m, g.type
),
rolled as (
  select m, type, n, answered, answered_or_reacted,
         sum(n) over w as n_3m,
         sum(answered) over w as answered_3m
  from monthly
  window w as (partition by type order by m rows between 2 preceding and current row)
)
select to_char(m, 'YYYY-MM-DD') as bucket, type,
       n::int, answered::int, answered_or_reacted::int,
       n_3m::int, answered_3m::int
from rolled
where m >= (select last_m - interval '11 months' from p2)
order by m, type`,
    transform: rows => {
      const x = [...new Set(rows.map(r => isoDate(r.bucket)))]
      const get = (type, fn) => x.map(b => {
        const r = rows.find(row => isoDate(row.bucket) === b && row.type === type)
        return r ? fn(r) : null
      })
      return {
        granularity: 'month',
        x,
        lines: [
          { key: 'requests_rolling', label: 'Requests answered, 3-month rolling', values: get('request', r => rate(r.answered_3m, r.n_3m)), primary: true, unit: 'percent' },
          { key: 'offers_rolling', label: 'Offers answered, 3-month rolling', values: get('offer', r => rate(r.answered_3m, r.n_3m)), unit: 'percent' },
          { key: 'requests', label: 'Requests answered by comment', values: get('request', r => rate(r.answered, r.n)), unit: 'percent' },
          { key: 'offers', label: 'Offers answered by comment', values: get('offer', r => rate(r.answered, r.n)), unit: 'percent' },
          { key: 'requests_incl_reactions', label: 'Requests answered, including reactions', values: get('request', r => rate(r.answered_or_reacted, r.n)), unit: 'percent' },
          { key: 'offers_incl_reactions', label: 'Offers answered, including reactions', values: get('offer', r => rate(r.answered_or_reacted, r.n)), unit: 'percent' },
          { key: 'requests_n', label: 'Requests posted', values: get('request', r => num(r.n)), unit: 'count' },
          { key: 'offers_n', label: 'Offers posted', values: get('offer', r => num(r.n)), unit: 'count' },
          { key: 'requests_n_3m', label: 'Requests posted, 3-month pooled', values: get('request', r => num(r.n_3m)), unit: 'count' }
        ],
        partialLast: false
      }
    },
    // Adjacent rolling points share 2 of their 3 months, so compare the latest
    // pooled request rate with the non-overlapping window 3 months earlier, and
    // name the pooled months and their n in the period.
    headline: data => {
      const line = data && data.lines && data.lines.find(l => l.primary)
      if (!line) return null
      const idx = line.values.map((v, i) => i).filter(i => typeof line.values[i] === 'number')
      if (!idx.length) return null
      const i = idx[idx.length - 1]
      const lastLabel = data.x[i]
      const j = data.x.indexOf(addMonths(lastLabel, -3))
      const nLine = data.lines.find(l => l.key === 'requests_n_3m')
      const n = nLine ? nLine.values[i] : null
      return {
        value: line.values[i],
        previous: j >= 0 && typeof line.values[j] === 'number' ? line.values[j] : null,
        period: `${monthLabel(addMonths(lastLabel, -2))} to ${monthLabel(lastLabel)}${n !== null ? `, ${n} requests` : ''}`
      }
    }
  },
  {
    id: 'events_that_gathered',
    label: 'Events that drew people',
    definition: 'Active events with a human host whose start time falls in the month (UTC) and before the as-of date. The share that got a yes or interested RSVP from at least 1, and from at least 3, distinct people other than the host. Only current event invitations are used, not the legacy event responses.',
    whyItMatters: 'Gatherings are where coordination turns into relationships in person. An event nobody RSVPs to is a sign the network is not showing up for each other.',
    display: 'series',
    unit: 'percent',
    goodDirection: 'up',
    vital: false,
    notes: 'An RSVP is intent, not attendance: there is no record of who actually came. RSVP times are approximate: editing an event re-stamps every RSVP, so re-sent invitations fall back to when the invitation was created. The current month is partial and includes only events that have already started. Rates over fewer than 5 events are left blank; event counts are platform-wide totals.',
    sql: `
with p0 as (
  select :asOf as as_of,
         date_trunc('month', :asOf at time zone 'UTC') as cur_m
),
p as (
  select as_of, cur_m,
         cur_m - interval '11 months' as start_m,
         (cur_m - interval '11 months') at time zone 'UTC' as start_ts
  from p0
),
humans as (select id from users where active and id <> ${AXOLOTL_ID}),
ev as (
  select e.id, e.user_id, date_trunc('month', e.start_time at time zone 'UTC') as m
  from posts e cross join p
  where e.type = 'event' and e.active
    and e.start_time >= p.start_ts and e.start_time < p.as_of
    and e.user_id in (select id from humans)
),
rsvp as (
  select ev.id, count(distinct ei.user_id) as n
  from ev
  join event_invitations ei on ei.event_id = ev.id
  join humans h on h.id = ei.user_id
  cross join p
  where ei.response in ('yes', 'interested')
    and ei.user_id <> ev.user_id
    and ${RSVP_T} < p.as_of
  group by ev.id
),
monthly as (
  select ev.m,
         count(*) as events,
         count(*) filter (where coalesce(r.n, 0) >= 1) as with_1,
         count(*) filter (where coalesce(r.n, 0) >= 3) as with_3
  from ev left join rsvp r on r.id = ev.id
  group by ev.m
)
select to_char(m, 'YYYY-MM-DD') as bucket,
       (m + interval '1 month' > (select as_of at time zone 'UTC' from p)) as is_partial,
       coalesce(mo.events, 0)::int as events,
       coalesce(mo.with_1, 0)::int as with_1,
       coalesce(mo.with_3, 0)::int as with_3
from generate_series((select start_m from p), (select cur_m from p), interval '1 month') as m
left join monthly mo using (m)
order by m`,
    transform: rows => ({
      granularity: 'month',
      x: rows.map(r => isoDate(r.bucket)),
      lines: [
        { key: 'with_1', label: 'Drew at least 1 RSVP', values: rows.map(r => rate(r.with_1, r.events)), primary: true, unit: 'percent' },
        { key: 'with_3', label: 'Drew at least 3 RSVPs', values: rows.map(r => rate(r.with_3, r.events)), unit: 'percent' },
        { key: 'events', label: 'Events started', values: rows.map(r => num(r.events)), unit: 'count' },
        { key: 'events_with_1', label: 'Events with at least 1 RSVP', values: rows.map(r => num(r.with_1)), unit: 'count' },
        { key: 'events_with_3', label: 'Events with at least 3 RSVPs', values: rows.map(r => num(r.with_3)), unit: 'count' }
      ],
      partialLast: rows.length ? Boolean(rows[rows.length - 1].is_partial) : false
    })
  },
  {
    id: 'decisions_made',
    label: 'Time-boxed proposals decided with 2+ voters',
    definition: 'Monthly cohorts (UTC) of active proposals by human authors, shown once every proposal in the cohort is at least 30 days old. Time-boxed proposals (those with a voting window) count as decided when their voting has completed and at least 2 distinct people voted. Casual proposals have no voting window and can never complete, so they are reported separately as the share that drew at least 2 voters. Because only a handful of proposals are made each month, those two rates pool the cohort month with the 2 months before it. The last column is the share of proposals created that month that got any vote, and the row size is all proposals created that month, so it is the denominator only for that last column. The headline is the latest pooled time-boxed rate compared with the non-overlapping 3-month window before it.',
    whyItMatters: 'Shared decisions show that self-governance is actually working. Separating casual polls from time-boxed votes keeps proposals that can never close from looking like failures.',
    display: 'cohort',
    unit: 'percent',
    goodDirection: 'up',
    vital: false,
    notes: "Voting on a time-boxed proposal closes at its end time, so a proposal counts as decided once its end time has passed by the as-of date and at least 2 people voted before then. Monthly counts are small, and rates over fewer than 5 proposals are left blank. The proposer's own vote counts toward the 2 voters. Each row also carries the pooled number of time-boxed and casual proposals behind its first two rates. Proposal counts are platform-wide totals. Free-text proposal outcomes are never read.",
    sql: `
with p as (
  select :asOf as as_of,
         date_trunc('month', (:asOf at time zone 'UTC') - interval '30 days') - interval '1 month' as last_m
),
humans as (select id from users where active and id <> ${AXOLOTL_ID}),
props as (
  select pr.id, pr.end_time,
         (pr.proposal_status = 'casual') as is_casual,
         date_trunc('month', pr.created_at at time zone 'UTC') as m
  from posts pr cross join p
  where pr.type = 'proposal' and pr.active
    and pr.created_at >= (p.last_m - interval '13 months') at time zone 'UTC'
    and pr.created_at < (p.last_m + interval '1 month') at time zone 'UTC'
    and pr.user_id in (select id from humans)
),
voters as (
  select v.post_id, count(distinct v.user_id) as n
  from proposal_votes v
  join props on props.id = v.post_id
  join humans h on h.id = v.user_id
  cross join p
  where v.created_at < p.as_of
  group by v.post_id
),
monthly as (
  select props.m,
         count(*) as proposals,
         count(*) filter (where not props.is_casual) as timeboxed,
         count(*) filter (where not props.is_casual and props.end_time < p.as_of and coalesce(vt.n, 0) >= 2) as timeboxed_decided,
         count(*) filter (where props.is_casual) as casual,
         count(*) filter (where props.is_casual and coalesce(vt.n, 0) >= 2) as casual_2plus,
         count(*) filter (where coalesce(vt.n, 0) >= 1) as any_vote
  from props left join voters vt on vt.post_id = props.id cross join p
  group by props.m
),
grid as (
  select m,
         coalesce(mo.proposals, 0) as proposals,
         coalesce(mo.any_vote, 0) as any_vote,
         sum(coalesce(mo.timeboxed, 0)) over w as timeboxed_3m,
         sum(coalesce(mo.timeboxed_decided, 0)) over w as timeboxed_decided_3m,
         sum(coalesce(mo.casual, 0)) over w as casual_3m,
         sum(coalesce(mo.casual_2plus, 0)) over w as casual_2plus_3m
  from generate_series((select last_m - interval '13 months' from p), (select last_m from p), interval '1 month') as m
  left join monthly mo using (m)
  window w as (order by m rows between 2 preceding and current row)
)
select to_char(m, 'YYYY-MM-DD') as cohort,
       proposals::int, any_vote::int,
       timeboxed_3m::int, timeboxed_decided_3m::int,
       casual_3m::int, casual_2plus_3m::int
from grid
where m >= (select last_m - interval '11 months' from p)
order by m`,
    transform: rows => ({
      columns: ['Time-boxed decided (3-month pooled)', 'Casual with 2+ voters (3-month pooled)', 'Any vote'],
      rows: rows.map(r => ({
        label: isoDate(r.cohort),
        size: num(r.proposals),
        // Denominator behind each value (parallel to values): the first two
        // rates pool 3 months, so their n differs from the row size.
        valueSizes: [num(r.timeboxed_3m), num(r.casual_3m), num(r.proposals)],
        values: [
          rate(r.timeboxed_decided_3m, r.timeboxed_3m),
          rate(r.casual_2plus_3m, r.casual_3m),
          rate(r.any_vote, r.proposals)
        ]
      }))
    }),
    // The pooled windows of adjacent rows share 2 of their 3 months, so compare
    // the latest pooled rate with the non-overlapping window 3 months earlier,
    // and name the pooled window and its n in the period.
    headline: data => {
      const rows = (data && data.rows) || []
      const idx = rows.map((r, i) => i).filter(i => typeof rows[i].values[0] === 'number')
      if (!idx.length) return null
      const last = rows[idx[idx.length - 1]]
      const prevRow = rows.find(r => r.label === addMonths(last.label, -3))
      const n = last.valueSizes ? last.valueSizes[0] : null
      return {
        value: last.values[0],
        previous: prevRow && typeof prevRow.values[0] === 'number' ? prevRow.values[0] : null,
        period: `${monthLabel(addMonths(last.label, -2))} to ${monthLabel(last.label)}${n !== null ? `, ${n} time-boxed proposals` : ''}`
      }
    }
  },
  {
    id: 'projects_with_second_contributor',
    label: 'Projects gaining a second member',
    definition: 'Monthly cohorts (UTC) of active projects by human creators, shown once every project in the cohort is at least 30 days old. The main rate is the share where at least one other person joined as a project member after the project was created and within 30 days. Members the creator added (listed when creating the project, or added in the project\'s most recent edit) are reported separately, along with the share that has either kind of member.',
    whyItMatters: 'A project with only its creator is still just an idea. Someone choosing to join is the first sign it is becoming a shared effort.',
    display: 'cohort',
    unit: 'percent',
    goodDirection: 'up',
    vital: false,
    notes: 'Project join dates are approximate: posts_users has no join timestamp. If someone followed a project (for example by commenting) and joined later, the join is dated to when they first followed. Members added within 2 minutes of the project being created, or within 5 seconds of its most recent edit, are treated as added by the creator. Only the most recent edit is recorded, so members the creator added in an earlier edit also count as joining; the joined-after-creation rate is an upper bound. Rates over fewer than 5 projects are left blank; project counts are platform-wide totals.',
    sql: `
with p as (
  select :asOf as as_of,
         date_trunc('month', (:asOf at time zone 'UTC') - interval '30 days') - interval '1 month' as last_m
),
humans as (select id from users where active and id <> ${AXOLOTL_ID}),
proj as (
  select pj.id, pj.user_id, pj.created_at, pj.edited_at, date_trunc('month', pj.created_at at time zone 'UTC') as m
  from posts pj cross join p
  where pj.type = 'project' and pj.active
    and pj.created_at >= (p.last_m - interval '11 months') at time zone 'UTC'
    and pj.created_at < (p.last_m + interval '1 month') at time zone 'UTC'
    and pj.user_id in (select id from humans)
),
members as (
  select proj.id,
         bool_or(not ${creatorAdded('proj')}) as joined_after,
         bool_or(${creatorAdded('proj')}) as listed
  from proj
  join posts_users pu on pu.post_id = proj.id
  join humans h on h.id = pu.user_id
  where pu.project_role_id is not null and pu.active
    and pu.user_id <> proj.user_id
    and pu.created_at < proj.created_at + interval '720 hours'
  group by proj.id
),
monthly as (
  select proj.m,
         count(*) as projects,
         count(*) filter (where mb.joined_after) as joined_after,
         count(*) filter (where mb.listed) as listed,
         count(mb.id) as either
  from proj left join members mb on mb.id = proj.id
  group by proj.m
)
select to_char(m, 'YYYY-MM-DD') as cohort,
       coalesce(mo.projects, 0)::int as projects,
       coalesce(mo.joined_after, 0)::int as joined_after,
       coalesce(mo.listed, 0)::int as listed,
       coalesce(mo.either, 0)::int as either
from generate_series((select last_m - interval '11 months' from p), (select last_m from p), interval '1 month') as m
left join monthly mo using (m)
order by m`,
    transform: rows => ({
      columns: ['Joined after creation', 'Added by creator', 'Either'],
      rows: rows.map(r => ({
        label: isoDate(r.cohort),
        size: num(r.projects),
        values: [
          rate(r.joined_after, r.projects),
          rate(r.listed, r.projects),
          rate(r.either, r.projects)
        ]
      }))
    })
  },
  {
    id: 'place_coverage_live_groups',
    label: 'Live groups with a structured place',
    definition: 'Live groups are active groups with at least 3 distinct people posting or commenting (excluding DMs) in the 28 days before this week\'s Monday (UTC), the same live-group definition and window used in Network vitality; activity in a space counts toward its parent group. The headline is the share of live groups with a structured map location. Also shown: the number of distinct countries, the number of distinct city (or locality) and country pairs, the share with only a free-text location, and the number with no place at all. Countries are listed by name only when 3 or more non-hidden live groups are in them.',
    whyItMatters: 'Regeneration happens in places. Groups without a structured location are invisible on the map and cannot be matched to nearby people.',
    display: 'kpi',
    unit: 'percent',
    goodDirection: 'up',
    vital: false,
    comparable: false,
    notes: 'Point-in-time: group locations and visibility have no history, so a past date applies today\'s locations to that date\'s live groups. The 28-day window ends at the Monday of the as-of week, so it lags the as-of date by up to 6 days. Some structured locations have no country code, so they are not counted as a country. Hidden groups count in the totals but never in the country list. Counts are of groups, not people, and are platform-wide totals. No group names are returned.',
    sql: `
with p as (
  select date_trunc('week', :asOf at time zone 'UTC') at time zone 'UTC' as as_of,
         (date_trunc('week', :asOf at time zone 'UTC') - interval '28 days') at time zone 'UTC' as start_28
),
humans as (select id from users where active and id <> ${AXOLOTL_ID}),
gmap as (
  select id as gid, case when type = 'space' then parent_id else id end as tgt
  from groups where active
),
voices as (
  select gm.tgt as group_id, po.user_id as uid
  from posts po
  join groups_posts gp on gp.post_id = po.id
  join gmap gm on gm.gid = gp.group_id
  cross join p
  where po.active and po.type not in ${NON_DM_TYPES}
    and po.created_at >= p.start_28 and po.created_at < p.as_of
  union
  select gm.tgt, c.user_id
  from comments c
  join posts po on po.id = c.post_id
  join groups_posts gp on gp.post_id = po.id
  join gmap gm on gm.gid = gp.group_id
  cross join p
  where c.active is not false and po.active and po.type not in ${NON_DM_TYPES}
    and c.created_at >= p.start_28 and c.created_at < p.as_of
),
live as (
  select g.id, g.visibility, g.location, g.location_id
  from groups g
  join (
    select v.group_id
    from voices v join humans h on h.id = v.uid
    where v.group_id is not null
    group by v.group_id
    having count(distinct v.uid) >= 3
  ) lv on lv.group_id = g.id
  where g.active and g.type is distinct from 'space'
),
lg as (
  select live.*,
         nullif(lower(trim(l.country_code)), '') as cc,
         nullif(lower(trim(coalesce(nullif(trim(l.city), ''), l.locality))), '') as city,
         (l.id is not null) as structured
  from live left join locations l on l.id = live.location_id
),
country_list as (
  select jsonb_object_agg(cc, n) as j
  from (
    select cc, count(*) as n
    from lg
    where structured and cc is not null and visibility <> 0
    group by cc
    having count(*) >= 3
  ) x
)
select to_char((select as_of from p) at time zone 'UTC', 'YYYY-MM-DD') as window_end,
       count(*)::int as live_groups,
       count(*) filter (where structured)::int as structured,
       count(distinct cc) filter (where structured)::int as countries,
       count(distinct (city, cc)) filter (where structured and city is not null and cc is not null)::int as city_country_pairs,
       count(*) filter (where not structured and coalesce(trim(location), '') <> '')::int as free_text_only,
       count(*) filter (where not structured and coalesce(trim(location), '') = '')::int as no_place,
       (select coalesce(j, '{}'::jsonb) from country_list) as country_counts
from lg`,
    transform: rows => {
      const r = rows[0] || {}
      const total = num(r.live_groups)
      const share = (n, d) => (d ? Math.round((num(n) / d) * 10000) / 10000 : null)
      const countries = Object.entries(r.country_counts || {})
        .map(([code, n]) => ({ label: `Live groups in ${countryName(code)}`, value: num(n), unit: 'count' }))
        .sort((a, b) => b.value - a.value)
      const windowEnd = r.window_end ? isoDate(r.window_end) : null
      return {
        value: share(r.structured, total),
        numerator: num(r.structured),
        denominator: total,
        windowEnd,
        note: windowEnd ? `Live groups over the 28 days to ${windowEnd} (UTC).` : null,
        breakdown: [
          { label: 'Countries', value: num(r.countries), unit: 'count' },
          { label: 'City and country pairs', value: num(r.city_country_pairs), unit: 'count' },
          { label: 'Free-text location only', value: share(r.free_text_only, total), unit: 'percent' },
          { label: 'No place at all', value: num(r.no_place), unit: 'count' },
          ...countries
        ]
      }
    },
    headline: data => (typeof data.value === 'number' ? { value: data.value, previous: null, period: data.windowEnd, windowDays: 28 } : null)
  }
]
