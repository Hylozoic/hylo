import { AXOLOTL_ID } from '../sql'

export const section = {
  id: 'missed_connections',
  title: 'Missed connections',
  question: 'Where do people reach out and not get met?'
}

// Cells describing fewer than this many people are suppressed (returned as null).
const MIN_CELL = 5

// pg returns bigint/numeric as strings; keep null as null.
const num = v => (v === null || v === undefined ? null : Number(v))
const isNum = v => typeof v === 'number' && Number.isFinite(v)
const suppressedRate = (n, d) => (d >= MIN_CELL ? n / d : null)

// The same content, human, RSVP, project and space rules as the north star
// (network_alive: weekly_connected_members), so "missed" is exactly the
// inverse of "connected" for people who posted.
const NON_DM_TYPES = "('thread','chat_activity','welcome')"
const human = alias => `and ${alias}.active and ${alias}.id <> ${AXOLOTL_ID}`
const GMAP = "gmap as (select id as gid, case when type = 'space' then parent_id else id end as tgt from groups where active)"
const RSVP_T = 'case when coalesce(ei.ical_sequence, 0) >= 2 then ei.created_at else ei.updated_at end'
const POST_AGE_CAP = "case when np.type in ('event','proposal','project') then interval '30 days' else interval '14 days' end"
const NOT_AUTHOR_ASSIGNED = "pu.created_at > np.created_at + interval '2 minutes'"

// Posts in a `src` CTE (id, user_id, created_at, type) that got a response from
// a different person within 7 days: any north-star interaction on the post (a
// comment, a reaction, an RSVP of yes or interested, a proposal vote, joining
// the project), or, for chat messages, a chat message from someone else in the
// same group or space and the same topic room within 24 hours (the
// being_answered chat rule). Emits `resp` (id).
const RESPONSES = `cp as materialized (
  select s.id, s.user_id, s.created_at, gp.group_id,
    coalesce((select min(pt.tag_id) from posts_tags pt where pt.post_id = s.id), 0) as tag_id
  from src s join groups_posts gp on gp.post_id = s.id
  where s.type = 'chat'
),
cm as materialized (
  select q.user_id, q.created_at, gp.group_id,
    coalesce((select min(pt.tag_id) from posts_tags pt where pt.post_id = q.id), 0) as tag_id
  from posts q
  join users qu on qu.id = q.user_id ${human('qu')}
  join groups_posts gp on gp.post_id = q.id
  where q.type = 'chat' and q.active
    and q.created_at > (select min(created_at) from cp)
    and q.created_at < (select max(created_at) from cp) + interval '24 hours'
),
resp as (
  select s.id from src s
  join comments c on c.post_id = s.id
  join users cu on cu.id = c.user_id ${human('cu')}
  where c.active is not false and c.user_id <> s.user_id and c.created_at < s.created_at + interval '7 days'
  union
  select s.id from src s
  join reactions x on x.entity_id = s.id and x.entity_type = 'post'
  join users xu on xu.id = x.user_id ${human('xu')}
  where x.user_id <> s.user_id and x.date_reacted < s.created_at + interval '7 days'
  union
  select s.id from src s
  join event_invitations ei on ei.event_id = s.id
  join users eu on eu.id = ei.user_id ${human('eu')}
  where s.type = 'event' and ei.response in ('yes','interested') and ei.user_id <> s.user_id
    and ${RSVP_T} < s.created_at + interval '7 days'
  union
  select s.id from src s
  join proposal_votes v on v.post_id = s.id
  join users vu on vu.id = v.user_id ${human('vu')}
  where s.type = 'proposal' and v.user_id <> s.user_id and v.created_at < s.created_at + interval '7 days'
  union
  select s.id from src s
  join posts_users pu on pu.post_id = s.id
  join users ju on ju.id = pu.user_id ${human('ju')}
  where s.type = 'project' and pu.project_role_id is not null and pu.active is not false and pu.user_id <> s.user_id
    and pu.created_at > s.created_at + interval '2 minutes' and pu.created_at < s.created_at + interval '7 days'
  union
  select cp.id from cp
  join cm on cm.group_id = cp.group_id and cm.tag_id = cp.tag_id
  where cm.user_id <> cp.user_id and cm.created_at > cp.created_at and cm.created_at < cp.created_at + interval '24 hours'
)`

// Human authors of the eligible posts: active posts of any non-DM type, chat included.
const SRC_POSTS = `from posts p
  join users au on au.id = p.user_id ${human('au')}, win
  where p.active and p.type not in ${NON_DM_TYPES}
    and p.created_at >= win.s and p.created_at < win.e`

// North-star cross-person interactions, copied from network_alive so the
// "connected" test is identical. Expects a `win` CTE (s, e); emits `hix`.
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
  select nc.user_id a, np.user_id b, nc.created_at t
  from nc join np on np.id = nc.post_id, win
  where nc.created_at >= win.s and np.created_at >= nc.created_at - ${POST_AGE_CAP}
  union all
  select r.user_id, np.user_id, r.date_reacted
  from reactions r join np on np.id = r.entity_id and r.entity_type = 'post', win
  where r.date_reacted >= win.s and r.date_reacted < win.e and np.created_at >= r.date_reacted - ${POST_AGE_CAP}
  union all
  select r.user_id, nc.user_id, r.date_reacted
  from reactions r join nc on nc.id = r.entity_id and r.entity_type = 'comment', win
  where r.date_reacted >= win.s and r.date_reacted < win.e and nc.created_at >= r.date_reacted - interval '14 days'
  union all
  select x.user_id, np.user_id, x.t
  from (
    select ei.user_id, ei.event_id, ${RSVP_T} t from event_invitations ei
    where ei.response in ('yes','interested')
  ) x join np on np.id = x.event_id and np.type = 'event', win
  where x.t >= win.s and x.t < win.e and np.created_at >= x.t - interval '30 days'
  union all
  select v.user_id, np.user_id, v.created_at
  from proposal_votes v join np on np.id = v.post_id and np.type = 'proposal', win
  where v.created_at >= win.s and v.created_at < win.e and np.created_at >= v.created_at - interval '30 days'
  union all
  select pu.user_id, np.user_id, pu.created_at
  from posts_users pu join np on np.id = pu.post_id and np.type = 'project', win
  where pu.project_role_id is not null and pu.active is not false and ${NOT_AUTHOR_ASSIGNED}
    and pu.created_at >= win.s and pu.created_at < win.e and np.created_at >= pu.created_at - interval '30 days'
),
hix as (
  select ix.a, ix.b, ix.t from ix
  join users ua on ua.id = ix.a ${human('ua')}
  join users ub on ub.id = ix.b ${human('ub')}, win
  where ix.a <> ix.b and ix.t >= win.s and ix.t < win.e
)`

const TYPE_LABELS = {
  discussion: 'Discussion',
  request: 'Request',
  offer: 'Offer',
  event: 'Event',
  proposal: 'Proposal',
  project: 'Project',
  resource: 'Resource',
  chat: 'Chat',
  other: 'Other (actions and submissions)'
}
const TYPE_KEYS = Object.keys(TYPE_LABELS).filter(k => k !== 'other')
const STATE_LABELS = { live: 'In a live group', quiet: 'In a quiet group', none: 'Not in an active group' }
const AUTHOR_LABELS = { newcomer: 'Newcomer', established: 'Established' }
const DIMENSIONS = [
  { key: 'overall', label: 'Overall' },
  { key: 'type', label: 'Post type', labels: TYPE_LABELS },
  { key: 'state', label: 'Group state', labels: STATE_LABELS },
  { key: 'author', label: 'Author', labels: AUTHOR_LABELS }
]

const RESPONSE_NOTE = 'A response is a comment, a reaction, an RSVP of yes or interested, a proposal vote or joining the project, by a different person within 7 days of posting; a chat message also counts as answered when someone else sends a chat message in the same group or space and the same topic room within 24 hours. Chat replies are inferred from timing and room, not from an explicit reply link, and untagged chat counts as one room.'
const EXCLUSIONS_NOTE = 'Threads/direct messages, welcome posts and chat activity notices are excluded; deleted posts and posts by deactivated accounts are not counted, and self-responses, the Axolotl bot and deactivated accounts never count as responses. RSVP and project join times are approximate, as in Weekly connected members.'

export const metrics = [
  {
    id: 'weekly_missed_connections',
    label: 'Weekly missed connections',
    definition: 'The inverse of Weekly connected members, for people who spoke up: each Monday–Sunday week (UTC), the number of people who posted at least once (any non-DM post, chat included) and got no response from anyone else on any of that week\'s posts within 7 days. A response is any Weekly connected members interaction on the post (a comment, a reaction, an RSVP of yes or interested, a proposal vote or joining the project); a chat message also counts as answered when someone else posts in the same room within 24 hours. Also shows everyone who posted, the missed share of them, and the isolated: missed people who also had no connection at all that week, neither giving nor getting any Weekly connected members interaction. Because answers get 7 days, the series ends at the last week whose answer window has closed; the headline is that week against the week before.',
    whyItMatters: 'Every missed person is someone who reached out and heard nothing back, the moment people start to drop off. Watching the count and the share shows whether silence is growing or shrinking as a share of the people who speak up.',
    display: 'series',
    unit: 'count',
    goodDirection: 'down',
    vital: true,
    notes: `${RESPONSE_NOTE} ${EXCLUSIONS_NOTE} Weeks newer than the last final week are left off the series, since their posts can still be answered. Missed plus answered people equal posters. Counts are platform-wide totals, so they are shown even when small.`,
    sql: `with bounds as (
  select date_trunc('week', (:asOf::timestamptz at time zone 'UTC') - interval '14 days') as last_wk
),
weeks as (select generate_series(last_wk - interval '25 weeks', last_wk, interval '1 week') as wk from bounds),
win as (
  select (last_wk - interval '25 weeks') at time zone 'UTC' as s, (last_wk + interval '1 week') at time zone 'UTC' as e
  from bounds
),
src as materialized (
  select p.id, p.user_id, p.created_at, p.type, date_trunc('week', p.created_at at time zone 'UTC') as wk
  ${SRC_POSTS}
),
${RESPONSES},
${INTERACTIONS},
conn as (
  select date_trunc('week', t at time zone 'UTC') wk, a u from hix
  union
  select date_trunc('week', t at time zone 'UTC'), b from hix
),
pw as (
  select s.wk, s.user_id, bool_or(r.id is not null) as answered
  from src s left join resp r on r.id = s.id
  group by 1, 2
),
agg as (
  select pw.wk, count(*) as posters,
    count(*) filter (where not pw.answered) as missed,
    count(*) filter (where not pw.answered and c.u is null) as isolated
  from pw left join conn c on c.wk = pw.wk and c.u = pw.user_id
  group by 1
)
select to_char(w.wk, 'YYYY-MM-DD') as bucket,
  coalesce(agg.posters, 0) as posters,
  coalesce(agg.missed, 0) as missed,
  coalesce(agg.isolated, 0) as isolated
from weeks w left join agg on agg.wk = w.wk
order by w.wk`,
    transform: rows => {
      const posters = rows.map(r => num(r.posters))
      const missed = rows.map(r => num(r.missed))
      return {
        granularity: 'week',
        x: rows.map(r => r.bucket),
        lines: [
          { key: 'missed', label: 'Missed people', values: missed, primary: true, unit: 'count' },
          { key: 'posters', label: 'People who posted', values: posters, unit: 'count' },
          { key: 'missed_share', label: 'Missed share of posters', values: missed.map((m, i) => (posters[i] > 0 ? m / posters[i] : null)), unit: 'percent' },
          { key: 'isolated', label: 'Isolated (missed and no connection that week)', values: rows.map(r => num(r.isolated)), unit: 'count' }
        ],
        // The series stops at the last week whose 7-day answer window has closed.
        partialLast: false
      }
    }
  },
  {
    id: 'where_connections_are_missed',
    label: 'Where connections are missed',
    definition: 'Posts made in the 28 days ending 7 days before the as-of date (so every post had its full 7-day answer window), and the share that got no response from anyone else within 7 days, broken down by post type, by whether the post\'s group was live when it was posted (at least 3 people posting or commenting in the 28 days before that day, with spaces counted toward their parent group), and by author (a newcomer joined Hylo within the 30 days before posting or was making their first-ever post; everyone else is established). Rows are sorted by miss rate within each breakdown, worst first. The headline is the overall miss rate, compared with the 28 days before.',
    whyItMatters: 'This points stewards at the places where people reach out and hear nothing, whether that is a kind of post, quiet groups or newcomers, so effort can go where silence is most common.',
    display: 'table',
    unit: 'percent',
    goodDirection: 'down',
    vital: false,
    notes: `${RESPONSE_NOTE} ${EXCLUSIONS_NOTE} A post shared to several groups counts as in a live group if any of them was live; posts in no active group are shown separately. The Other post type is track actions and funding-round submissions; completing someone else's action is not counted as a response (it is not a Weekly connected members interaction), so these read as missed more often. The newcomer segment swings with welcome activity: a newcomer's first chat message is often answered quickly, so newcomers can be missed less often than established members in some windows and more often in others. Rows with fewer than 5 posts or fewer than 5 authors are hidden (counts and rate shown as blank), and when the missed posts in a row come from fewer than 5 people, its missed count and miss rate are hidden too (the post count stays). Overall rows are platform-wide totals. Days are cut in UTC.`,
    sql: `with bounds as (
  select date_trunc('day', :asOf::timestamptz at time zone 'UTC') - interval '7 days' as end_d
),
win as (
  select (end_d - interval '56 days') at time zone 'UTC' as s,
         (end_d - interval '28 days') at time zone 'UTC' as mid,
         end_d at time zone 'UTC' as e
  from bounds
),
src as materialized (
  select p.id, p.user_id, p.created_at, p.type, p.created_at >= win.mid as is_cur
  ${SRC_POSTS}
),
${RESPONSES},
scored as materialized (
  select s.id, s.user_id, s.type, s.created_at, s.is_cur, r.id is null as missed
  from src s left join resp r on r.id = s.id
),
cur as materialized (
  select sc.id, sc.user_id, sc.missed, sc.created_at,
    case when sc.type in (${TYPE_KEYS.map(t => `'${t}'`).join(', ')}) then sc.type else 'other' end as type,
    (u.created_at > sc.created_at - interval '30 days'
      or not exists (
        select 1 from posts e
        where e.user_id = sc.user_id and e.type not in ${NON_DM_TYPES}
          and (e.created_at < sc.created_at or (e.created_at = sc.created_at and e.id < sc.id)))) as newcomer
  from scored sc join users u on u.id = sc.user_id
  where sc.is_cur
),
${GMAP},
g as (select id from groups where active and coalesce(type, '') <> 'space'),
vb as (select win.mid - interval '28 days' as s, win.e from win),
voice_events as (
  select gm.tgt as group_id, p.user_id, p.created_at t
  from posts p join users u on u.id = p.user_id ${human('u')}
  join groups_posts gp on gp.post_id = p.id
  join gmap gm on gm.gid = gp.group_id, vb
  where p.active and p.type not in ${NON_DM_TYPES} and p.created_at >= vb.s and p.created_at < vb.e
  union all
  select gm.tgt, c.user_id, c.created_at
  from comments c
  join posts p on p.id = c.post_id and p.active and p.type not in ${NON_DM_TYPES}
  join users u on u.id = c.user_id ${human('u')}
  join groups_posts gp on gp.post_id = p.id
  join gmap gm on gm.gid = gp.group_id, vb
  where c.active is not false and c.created_at >= vb.s and c.created_at < vb.e
),
gv as (
  select ve.group_id, ve.user_id, date_trunc('day', ve.t at time zone 'UTC') d
  from voice_events ve join g on g.id = ve.group_id
  group by 1, 2, 3
),
post_groups as (
  select distinct cur.id, gm.tgt as group_id, date_trunc('day', cur.created_at at time zone 'UTC') as d
  from cur
  join groups_posts gp on gp.post_id = cur.id
  join gmap gm on gm.gid = gp.group_id
  join g on g.id = gm.tgt
),
live_at as (
  select gd.group_id, gd.d
  from (select distinct group_id, d from post_groups) gd
  join gv on gv.group_id = gd.group_id and gv.d >= gd.d - interval '28 days' and gv.d < gd.d
  group by 1, 2
  having count(distinct gv.user_id) >= 3
),
post_state as (
  select cur.id,
    case when bool_or(la.group_id is not null) then 'live'
         when count(pg.group_id) > 0 then 'quiet'
         else 'none' end as state
  from cur
  left join post_groups pg on pg.id = cur.id
  left join live_at la on la.group_id = pg.group_id and la.d = pg.d
  group by cur.id
),
seg as (
  select 'type' as dim, cur.type as segment, cur.user_id, cur.missed from cur
  union all
  select 'state', ps.state, cur.user_id, cur.missed from cur join post_state ps on ps.id = cur.id
  union all
  select 'author', case when cur.newcomer then 'newcomer' else 'established' end, cur.user_id, cur.missed from cur
)
select dim, segment, count(*) as posts, count(*) filter (where missed) as missed, count(distinct user_id) as authors,
  count(distinct user_id) filter (where missed) as missed_authors
from seg group by 1, 2
union all
select 'overall', case when is_cur then 'current' else 'previous' end,
  count(*), count(*) filter (where missed), count(distinct user_id), count(distinct user_id) filter (where missed)
from scored group by is_cur
union all
select 'window', to_char(end_d - interval '1 day', 'YYYY-MM-DD'), 0, 0, 0, 0 from bounds
union all
select 'window', to_char(end_d - interval '29 days', 'YYYY-MM-DD'), 0, 0, 0, 0 from bounds`,
    transform: rows => {
      const windows = rows.filter(r => r.dim === 'window').map(r => r.segment).sort()
      const [prevEnd, curEnd] = windows
      const overallLabels = { current: `28 days to ${curEnd}`, previous: `Previous 28 days (to ${prevEnd})` }
      const out = []
      for (const dim of DIMENSIONS) {
        const labels = dim.key === 'overall' ? overallLabels : dim.labels
        const keys = Object.keys(labels)
        const found = new Map(rows.filter(r => r.dim === dim.key).map(r => [r.segment, r]))
        const segRows = keys.map(key => {
          const r = found.get(key)
          const posts = r ? num(r.posts) : 0
          const missed = r ? num(r.missed) : 0
          const authors = r ? num(r.authors) : 0
          const missedAuthors = r ? num(r.missed_authors) : 0
          // Overall rows are platform-wide totals and are never suppressed.
          // Otherwise the row needs 5+ posts and 5+ authors, and the missed
          // count and rate also need 5+ distinct missed authors behind them.
          const overall = dim.key === 'overall'
          const show = overall || (posts >= MIN_CELL && authors >= MIN_CELL)
          const showMissed = show && (overall || missedAuthors >= MIN_CELL)
          return {
            dimension: dim.label,
            segment: labels[key],
            posts: show ? posts : null,
            missed: showMissed ? missed : null,
            miss_rate: showMissed && posts > 0 ? missed / posts : null
          }
        })
        // Segments with no posts at all are dropped; the rest sort worst first,
        // with hidden rows last. The overall rows keep current-then-previous order.
        const kept = segRows.filter((r, i) => dim.key === 'overall' || found.has(keys[i]))
        if (dim.key !== 'overall') {
          kept.sort((a, b) => (isNum(b.miss_rate) ? b.miss_rate : -1) - (isNum(a.miss_rate) ? a.miss_rate : -1))
        }
        out.push(...kept)
      }
      return {
        columns: [
          { key: 'dimension', label: 'Breakdown' },
          { key: 'segment', label: 'Segment' },
          { key: 'posts', label: 'Posts', unit: 'count' },
          { key: 'missed', label: 'Missed', unit: 'count' },
          { key: 'miss_rate', label: 'Miss rate', unit: 'percent' }
        ],
        rows: out,
        windowEnd: curEnd
      }
    },
    headline: data => {
      const overall = data.rows.filter(r => r.dimension === 'Overall')
      const [cur, prev] = overall
      if (!cur || !isNum(cur.miss_rate)) return null
      return { value: cur.miss_rate, previous: prev && isNum(prev.miss_rate) ? prev.miss_rate : null, period: data.windowEnd, windowDays: 28 }
    }
  },
  {
    id: 'after_a_missed_connection',
    label: 'Coming back after a missed connection',
    definition: 'Monthly cohorts (UTC calendar months) of people who posted (any non-DM post, chat included), split by whether their first post that month got a response from someone else within 7 days (the same rule as Weekly missed connections) or was missed. The Answered and Missed columns are the share of each group who contributed again between 1 and 30 days after that first post, where a contribution is anything counted in Weekly active contributors: a post, a comment, a reaction, an RSVP of yes or interested, a proposal vote or joining someone else\'s project. The gap is the answered share minus the missed share. Shows the last 12 months whose 30-day follow-up and 7-day answer windows have both closed. The headline is the missed column.',
    whyItMatters: 'If people who hear nothing come back far less often than people who get an answer, missed connections are where the network loses people, and answering first posts is the lever.',
    display: 'cohort',
    unit: 'percent',
    goodDirection: 'up',
    vital: false,
    notes: `This shows an association, not a cause: people whose posts go unanswered differ from those who get answers (for example, chat posters and feed posters behave differently, and one-off posters are more often missed). Feed first posts are missed more often than chat ones, but the gap also shows within each kind, so it is not just a chat-versus-feed mix effect. Answered people also have a reason to come back, replying to whoever answered them, so part of the gap is the conversation itself; the 1-day gap before counting a return leaves out same-day replies. The gap column has no good direction of its own: it can shrink because missed people come back more (good) or because answered people come back less (bad). ${RESPONSE_NOTE} ${EXCLUSIONS_NOTE} Rates are hidden when fewer than 5 people are behind them. Cohort sizes are platform-wide totals.`,
    sql: `with bounds as (
  select date_trunc('month', (:asOf::timestamptz at time zone 'UTC') - interval '30 days') - interval '1 month' as last_m
),
months as (select generate_series(last_m - interval '11 months', last_m, interval '1 month') as m from bounds),
win as (
  select (last_m - interval '11 months') at time zone 'UTC' as s, (last_m + interval '1 month') at time zone 'UTC' as e
  from bounds
),
src as materialized (
  select distinct on (p.user_id, date_trunc('month', p.created_at at time zone 'UTC'))
    p.id, p.user_id, p.created_at, p.type, date_trunc('month', p.created_at at time zone 'UTC') as m
  ${SRC_POSTS}
  order by p.user_id, date_trunc('month', p.created_at at time zone 'UTC'), p.created_at, p.id
),
${RESPONSES},
cw as (select win.s + interval '1 day' as s, win.e + interval '30 days' as e from win),
cohort_users as (select distinct user_id from src),
np as (select p.id, p.user_id, p.type from posts p where p.active and p.type not in ${NON_DM_TYPES}),
contrib as (
  select p.user_id u, p.created_at t from posts p join cohort_users cu on cu.user_id = p.user_id, cw
  where p.active and p.type not in ${NON_DM_TYPES} and p.created_at > cw.s and p.created_at <= cw.e
  union all
  select c.user_id, c.created_at from comments c
  join cohort_users cu on cu.user_id = c.user_id
  join np on np.id = c.post_id, cw
  where c.active is not false and c.created_at > cw.s and c.created_at <= cw.e
  union all
  select r.user_id, r.date_reacted from reactions r
  join cohort_users cu on cu.user_id = r.user_id
  join np on np.id = r.entity_id and r.entity_type = 'post', cw
  where r.date_reacted > cw.s and r.date_reacted <= cw.e
  union all
  select r.user_id, r.date_reacted from reactions r
  join cohort_users cu on cu.user_id = r.user_id
  join comments c on c.id = r.entity_id and r.entity_type = 'comment' and c.active is not false
  join np on np.id = c.post_id, cw
  where r.date_reacted > cw.s and r.date_reacted <= cw.e
  union all
  select x.user_id, x.t from (
    select ei.user_id, ei.event_id, ${RSVP_T} t from event_invitations ei
    where ei.response in ('yes','interested')
  ) x
  join cohort_users cu on cu.user_id = x.user_id
  join np on np.id = x.event_id and np.type = 'event', cw
  where x.t > cw.s and x.t <= cw.e
  union all
  select v.user_id, v.created_at from proposal_votes v
  join cohort_users cu on cu.user_id = v.user_id
  join np on np.id = v.post_id and np.type = 'proposal', cw
  where v.created_at > cw.s and v.created_at <= cw.e
  union all
  select pu.user_id, pu.created_at from posts_users pu
  join cohort_users cu on cu.user_id = pu.user_id
  join posts pp on pp.id = pu.post_id and pp.active and pp.type = 'project', cw
  where pu.project_role_id is not null and pu.active is not false and pu.user_id <> pp.user_id
    and pu.created_at > pp.created_at + interval '2 minutes'
    and pu.created_at > cw.s and pu.created_at <= cw.e
),
back as (
  select distinct s.id from src s
  join contrib c on c.u = s.user_id
    and c.t > s.created_at + interval '1 day' and c.t <= s.created_at + interval '30 days'
),
scored as (
  select s.m, r.id is not null as answered, b.id is not null as came_back
  from src s left join resp r on r.id = s.id left join back b on b.id = s.id
),
agg as (
  select m,
    count(*) filter (where answered) as answered_n,
    count(*) filter (where answered and came_back) as answered_back,
    count(*) filter (where not answered) as missed_n,
    count(*) filter (where not answered and came_back) as missed_back
  from scored group by m
)
select to_char(months.m, 'YYYY-MM-DD') as bucket,
  coalesce(answered_n, 0) as answered_n, coalesce(answered_back, 0) as answered_back,
  coalesce(missed_n, 0) as missed_n, coalesce(missed_back, 0) as missed_back
from months left join agg on agg.m = months.m
order by months.m`,
    transform: rows => ({
      columns: ['Answered', 'Missed', 'Gap'],
      columnDirections: ['up', 'up', 'neutral'],
      rows: rows.map(r => {
        const answered = suppressedRate(num(r.answered_back), num(r.answered_n))
        const missed = suppressedRate(num(r.missed_back), num(r.missed_n))
        return {
          label: r.bucket,
          size: num(r.answered_n) + num(r.missed_n),
          values: [answered, missed, isNum(answered) && isNum(missed) ? answered - missed : null]
        }
      })
    }),
    // Headline on the missed column: this section is about the people who
    // weren't met, and a rising return rate among them is the good outcome.
    headline: data => {
      const rows = data.rows.filter(r => isNum(r.values[1]))
      if (!rows.length) return null
      const last = rows[rows.length - 1]
      const prev = rows.length > 1 ? rows[rows.length - 2] : null
      const month = new Date(`${last.label.slice(0, 7)}-01T00:00:00Z`).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
      return { value: last.values[1], previous: prev ? prev.values[1] : null, period: `Missed posters, ${month}` }
    }
  }
]
