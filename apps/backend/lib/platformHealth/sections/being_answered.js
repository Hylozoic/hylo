import { AXOLOTL_ID } from '../sql'

export const section = {
  id: 'being_answered',
  title: 'Reciprocity',
  question: 'When people speak up, does someone answer?'
}

// Cells describing fewer than this many people are suppressed (returned as null).
const MIN_CELL = 5

const num = v => (v === null || v === undefined ? null : Number(v))
const isoDate = v => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10))
const rate = (n, d) => (d > 0 ? n / d : null)
const suppressedRate = (n, d) => (d >= MIN_CELL ? n / d : null)
const DAY_MS = 24 * 60 * 60 * 1000
const dayNumber = iso => Date.parse(`${iso}T00:00:00Z`) / DAY_MS

// All buckets are cut in UTC (not the database session time zone) so local and
// production runs agree. A post "counts" if it is still up, or was deleted more
// than an hour after posting: quick deletions are treated as retractions, while
// later deletions (mostly unanswered posts) stay in so the rate isn't flattered.
const POST_KEPT = "(p.active or p.deactivated_at >= p.created_at + interval '1 hour')"

// Track actions and funding-round submissions are not announced to group members
// (Post.createActivities skips them), so they are not posts anyone is asked to answer.
const UNANNOUNCED_TYPES = "'action', 'submission'"

export const metrics = [
  {
    id: 'feed_post_response_rate_7d',
    label: 'Feed posts answered within 7 days',
    definition: 'Weekly cohorts of feed posts by people (not chat, threads/direct messages or welcome posts, and not track actions or funding-round submissions, which are not announced to members). The share that got a comment or a reaction from a different person within 7 days of posting. Only weeks whose 7-day windows have fully closed are shown, 26 weeks in all, with a pooled 4-week average and the median hours to first response among answered posts.',
    whyItMatters: 'A response is the product, and the silence rate is the inverse of Hylo\'s value.',
    display: 'series',
    unit: 'percent',
    goodDirection: 'up',
    vital: true,
    notes: 'Posts deleted more than an hour after posting still count (deleted posts were rarely answered); posts deleted within the hour are treated as retractions and left out. Posts by accounts that have since been deactivated are not counted. Self-comments, the Axolotl bot and deactivated accounts don\'t count as responses. Reactions on a post\'s comments don\'t count. The weekly rate is hidden for weeks with fewer than 5 posts, the 4-week average when its 4 weeks hold fewer than 5 posts, and median hours for weeks with fewer than 5 answered posts. Post counts are platform-wide totals, so they are shown even when small. Weeks are Monday-start in UTC.',
    sql: `
with bounds as (
  select date_trunc('week', (:asOf::timestamptz at time zone 'UTC') - interval '14 days') as last_bucket
),
weeks as (
  select generate_series((select last_bucket from bounds) - interval '28 weeks', (select last_bucket from bounds), interval '1 week') as bucket
),
p as (
  select p.id, p.user_id, p.created_at, date_trunc('week', p.created_at at time zone 'UTC') as bucket
  from posts p
  join users au on au.id = p.user_id and au.active and au.id <> ${AXOLOTL_ID}
  where ${POST_KEPT}
    and p.type not in ('thread', 'chat', 'welcome', 'chat_activity', ${UNANNOUNCED_TYPES})
    and p.created_at >= (select min(bucket) from weeks) at time zone 'UTC'
    and p.created_at < ((select last_bucket from bounds) + interval '1 week') at time zone 'UTC'
),
r as (
  select c.post_id as id, c.created_at as t
  from p
  join comments c on c.post_id = p.id
  join users cu on cu.id = c.user_id and cu.active and cu.id <> ${AXOLOTL_ID}
  where c.active is not false
    and c.user_id <> p.user_id
    and c.created_at < p.created_at + interval '7 days'
  union all
  select x.entity_id, x.date_reacted
  from p
  join reactions x on x.entity_id = p.id and x.entity_type = 'post'
  join users ru on ru.id = x.user_id and ru.active and ru.id <> ${AXOLOTL_ID}
  where x.user_id <> p.user_id
    and x.date_reacted < p.created_at + interval '7 days'
),
f as (select id, min(t) as first_t from r group by id),
agg as (
  select p.bucket, count(*) as total, count(f.id) as answered,
    percentile_cont(0.5) within group (order by extract(epoch from (f.first_t - p.created_at)) / 3600.0) filter (where f.id is not null) as median_hours
  from p left join f on f.id = p.id
  group by p.bucket
),
s as (
  select w.bucket, coalesce(a.total, 0) as total, coalesce(a.answered, 0) as answered, a.median_hours,
    sum(coalesce(a.answered, 0)) over (order by w.bucket rows between 3 preceding and current row) as answered_4w,
    sum(coalesce(a.total, 0)) over (order by w.bucket rows between 3 preceding and current row) as total_4w,
    count(*) over (order by w.bucket rows between 3 preceding and current row) as weeks_4w
  from weeks w left join agg a on a.bucket = w.bucket
)
select to_char(bucket, 'YYYY-MM-DD') as bucket, answered, total, median_hours, answered_4w, total_4w, weeks_4w
from s
where bucket > (select last_bucket from bounds) - interval '26 weeks'
order by bucket`,
    transform: rows => {
      const answered = rows.map(r => num(r.answered))
      const total = rows.map(r => num(r.total))
      return {
        granularity: 'week',
        x: rows.map(r => isoDate(r.bucket)),
        lines: [
          { key: 'rate', label: 'Answered within 7 days', values: rows.map((r, i) => suppressedRate(answered[i], total[i])), primary: true, unit: 'percent' },
          { key: 'rate_4w', label: '4-week average', values: rows.map(r => (num(r.weeks_4w) === 4 ? suppressedRate(num(r.answered_4w), num(r.total_4w)) : null)), unit: 'percent' },
          { key: 'median_hours', label: 'Median hours to first response', values: rows.map((r, i) => (answered[i] >= MIN_CELL && r.median_hours !== null ? Math.round(num(r.median_hours) * 10) / 10 : null)), unit: 'hours' },
          { key: 'answered', label: 'Posts answered', values: answered, unit: 'count' },
          { key: 'total', label: 'Posts in cohort', values: total, unit: 'count' }
        ],
        partialLast: false
      }
    }
  },
  {
    id: 'first_post_answered_7d',
    label: 'Newcomers\' first post answered within 7 days',
    definition: 'Each person\'s first-ever post (feed post or chat message, not threads/direct messages, welcome posts, track actions or funding-round submissions), grouped by the month it was made. A first feed post counts as answered if a different person commented on or reacted to it within 7 days. A first chat message counts as answered if it got a comment or reaction within 7 days, or if a different person sent a chat message in the same group or space and the same topic room within 24 hours. The last 12 months whose 7-day windows have fully closed are shown. The headline uses the Feed column.',
    whyItMatters: 'A newcomer\'s first contribution meeting silence is the moment the loop breaks, and stewards can act on it directly.',
    display: 'cohort',
    unit: 'percent',
    goodDirection: 'up',
    vital: false,
    notes: 'Chat and feed use different answer rules, because in chat people reply with another message, so the two columns aren\'t strictly comparable. The All first posts column combines both rules, and most first posts are chat messages, so the looser chat rule pushes it up; the headline therefore uses the Feed column, which follows the same rule as feed posts answered within 7 days. Posts by accounts that have since been deactivated are not counted. A chat reply is inferred from timing and room, not from an explicit reply link, so it can include messages that weren\'t answers. Untagged chat counts as one room. First posts deleted more than an hour after posting still count; posts deleted within the hour are treated as retractions. Cells with fewer than 5 first posts are hidden. Cohort sizes are platform-wide totals. Months are cut in UTC.',
    sql: `
with bounds as (
  select date_trunc('month', (:asOf::timestamptz at time zone 'UTC') - interval '7 days') - interval '1 month' as last_bucket
),
months as (
  select generate_series((select last_bucket from bounds) - interval '11 months', (select last_bucket from bounds), interval '1 month') as bucket
),
kinds as (select unnest(array['feed', 'chat']) as kind),
firsts as (
  select distinct on (p.user_id) p.id, p.user_id, p.created_at, p.type
  from posts p
  join users au on au.id = p.user_id and au.active and au.id <> ${AXOLOTL_ID}
  where ${POST_KEPT}
    and p.type not in ('thread', 'welcome', 'chat_activity', ${UNANNOUNCED_TYPES})
    and p.created_at < :asOf::timestamptz
  order by p.user_id, p.created_at, p.id
),
g as (
  select id, user_id, created_at,
    date_trunc('month', created_at at time zone 'UTC') as bucket,
    case when type = 'chat' then 'chat' else 'feed' end as kind
  from firsts
  where created_at >= (select min(bucket) from months) at time zone 'UTC'
    and created_at < ((select last_bucket from bounds) + interval '1 month') at time zone 'UTC'
),
chat_firsts as (
  select g.id, g.user_id, g.created_at, gp.group_id,
    coalesce((select min(tag_id) from posts_tags where post_id = g.id), 0) as tag_id
  from g
  join groups_posts gp on gp.post_id = g.id
  where g.kind = 'chat'
),
chat_msgs as (
  select q.id, q.user_id, q.created_at, gp.group_id,
    coalesce((select min(tag_id) from posts_tags where post_id = q.id), 0) as tag_id
  from posts q
  join users qu on qu.id = q.user_id and qu.active and qu.id <> ${AXOLOTL_ID}
  join groups_posts gp on gp.post_id = q.id
  where q.type = 'chat' and q.active
    and q.created_at > (select min(created_at) from chat_firsts)
    and q.created_at < (select max(created_at) from chat_firsts) + interval '24 hours'
),
chat_answered as (
  select distinct cf.id
  from chat_firsts cf
  join chat_msgs m on m.group_id = cf.group_id and m.tag_id = cf.tag_id
  where m.user_id <> cf.user_id
    and m.created_at > cf.created_at and m.created_at < cf.created_at + interval '24 hours'
),
scored as materialized (
  select g.bucket, g.kind, (exists (
      select 1 from comments c
      join users cu on cu.id = c.user_id and cu.active and cu.id <> ${AXOLOTL_ID}
      where c.post_id = g.id and c.active is not false and c.user_id <> g.user_id
        and c.created_at < g.created_at + interval '7 days')
    or exists (
      select 1 from reactions x
      join users ru on ru.id = x.user_id and ru.active and ru.id <> ${AXOLOTL_ID}
      where x.entity_type = 'post' and x.entity_id = g.id and x.user_id <> g.user_id
        and x.date_reacted < g.created_at + interval '7 days')
    or exists (select 1 from chat_answered ca where ca.id = g.id)) as is_answered
  from g
),
agg as (
  select bucket, kind, count(*) as total, count(*) filter (where is_answered) as answered
  from scored
  group by 1, 2
)
select to_char(m.bucket, 'YYYY-MM-DD') as bucket, k.kind,
  coalesce(a.answered, 0) as answered,
  coalesce(a.total, 0) as total
from months m cross join kinds k
left join agg a on a.bucket = m.bucket and a.kind = k.kind
order by m.bucket, k.kind`,
    transform: rows => {
      const byMonth = new Map()
      for (const r of rows) {
        const label = isoDate(r.bucket)
        if (!byMonth.has(label)) byMonth.set(label, {})
        byMonth.get(label)[r.kind] = { answered: num(r.answered), total: num(r.total) }
      }
      const empty = { answered: 0, total: 0 }
      return {
        columns: ['Feed', 'Chat', 'All first posts'],
        rows: [...byMonth.entries()].map(([label, k]) => {
          const feed = k.feed || empty
          const chat = k.chat || empty
          const all = { answered: feed.answered + chat.answered, total: feed.total + chat.total }
          return {
            label,
            size: all.total,
            values: [
              suppressedRate(feed.answered, feed.total),
              suppressedRate(chat.answered, chat.total),
              suppressedRate(all.answered, all.total)
            ]
          }
        })
      }
    },
    // Headline on the Feed column (first column): the pooled column mixes the
    // feed and chat answer rules and is dominated by the looser chat rule.
    headline: data => {
      const rows = data.rows.filter(r => typeof r.values[0] === 'number')
      if (!rows.length) return null
      const last = rows[rows.length - 1]
      const prev = rows.length > 1 ? rows[rows.length - 2] : null
      return { value: last.values[0], previous: prev ? prev.values[0] : null, period: last.label }
    }
  },
  {
    id: 'reciprocal_tie_members',
    label: 'People with a two-way tie',
    definition: 'Over the 90 days before each date (the first of each month, plus the as-of date): people who responded to someone who also responded to them. A response is a comment on their post, a reply to their comment, or a reaction to their post or comment, on any content except threads/direct messages and welcome posts (chat included). Also shown: the share of everyone who gave or received any response, and the number of two-way pairs.',
    whyItMatters: 'Two-way ties, unlike one-way audiences, are what hold communities together through hard times.',
    display: 'series',
    unit: 'count',
    goodDirection: 'up',
    vital: false,
    notes: 'Each point covers the 90 days before its date, so neighbouring points overlap heavily. The headline therefore compares the latest 90-day window with the most recent earlier window that does not overlap it. A reply to a comment is credited to that comment\'s author, not the post author. Self-responses, the Axolotl bot and deactivated accounts are excluded, as are responses on posts that have since been deleted. Counts are platform-wide totals, so they are shown even when small. Dates are in UTC.',
    sql: `
with months as (
  select m as bucket,
         least((m + interval '1 month') at time zone 'UTC', :asOf::timestamptz) as window_end
  from generate_series(date_trunc('month', :asOf::timestamptz at time zone 'UTC') - interval '11 months', date_trunc('month', :asOf::timestamptz at time zone 'UTC'), interval '1 month') as m
),
range as (
  select min(window_end) - interval '90 days' as lo, max(window_end) as hi from months
),
edges as (
  select c.user_id as a, coalesce(pc.user_id, p.user_id) as b, c.created_at as t
  from comments c
  join posts p on p.id = c.post_id
  left join comments pc on pc.id = c.comment_id and pc.active is not false
  where c.active is not false
    and c.created_at >= (select lo from range) and c.created_at < (select hi from range)
    and p.active and p.type not in ('thread', 'welcome', 'chat_activity')
    and c.user_id <> coalesce(pc.user_id, p.user_id)
  union all
  select x.user_id, p.user_id, x.date_reacted
  from reactions x
  join posts p on p.id = x.entity_id
  where x.entity_type = 'post'
    and x.date_reacted >= (select lo from range) and x.date_reacted < (select hi from range)
    and p.active and p.type not in ('thread', 'welcome', 'chat_activity')
    and x.user_id <> p.user_id
  union all
  select x.user_id, c.user_id, x.date_reacted
  from reactions x
  join comments c on c.id = x.entity_id
  join posts p on p.id = c.post_id
  where x.entity_type = 'comment'
    and x.date_reacted >= (select lo from range) and x.date_reacted < (select hi from range)
    and c.active is not false
    and p.active and p.type not in ('thread', 'welcome', 'chat_activity')
    and x.user_id <> c.user_id
),
human_edges as (
  select e.a, e.b, e.t
  from edges e
  join users ua on ua.id = e.a and ua.active and ua.id <> ${AXOLOTL_ID}
  join users ub on ub.id = e.b and ub.active and ub.id <> ${AXOLOTL_ID}
),
we as (
  select distinct m.bucket, e.a, e.b
  from months m
  join human_edges e on e.t >= m.window_end - interval '90 days' and e.t < m.window_end
),
recip as (
  select we.bucket, we.a, we.b
  from we
  join we r on r.bucket = we.bucket and r.a = we.b and r.b = we.a
),
graph as (
  select bucket, count(distinct person) as people
  from (select bucket, a as person from we union all select bucket, b from we) z
  group by bucket
),
rs as (
  select bucket, count(distinct a) as tied, count(*) / 2 as pairs
  from recip group by bucket
)
select to_char(m.window_end at time zone 'UTC', 'YYYY-MM-DD') as window_end,
  coalesce(rs.tied, 0) as tied,
  coalesce(g.people, 0) as people,
  coalesce(rs.pairs, 0) as pairs
from months m
left join rs on rs.bucket = m.bucket
left join graph g on g.bucket = m.bucket
order by m.bucket`,
    // Each point is a full 90-day window ending at x (exclusive), so none is
    // partial. When asOf falls on the 1st, the current month's window ends at the
    // same moment as the previous month's, so the duplicate point is dropped.
    transform: allRows => {
      const rows = allRows.filter((r, i) => i === 0 || isoDate(r.window_end) !== isoDate(allRows[i - 1].window_end))
      return {
        granularity: 'month',
        xMeaning: 'window-end',
        windowDays: 90,
        x: rows.map(r => isoDate(r.window_end)),
        lines: [
          { key: 'tied', label: 'People with a two-way tie', values: rows.map(r => num(r.tied)), primary: true, unit: 'count' },
          { key: 'share', label: 'Share of people in the response graph', values: rows.map(r => rate(num(r.tied), num(r.people))), unit: 'percent' },
          { key: 'people', label: 'People who gave or received a response', values: rows.map(r => num(r.people)), unit: 'count' },
          { key: 'pairs', label: 'Two-way pairs', values: rows.map(r => num(r.pairs)), unit: 'count' }
        ],
        partialLast: false
      }
    },
    // Neighbouring 90-day windows share about 60 days, so compare the latest
    // window with the latest earlier one that ends on or before the latest
    // window's start (window ends are exclusive, so the two share no day).
    headline: data => {
      const values = data.lines.find(l => l.primary).values
      const i = values.length - 1
      if (i < 0 || typeof values[i] !== 'number') return null
      const cutoff = dayNumber(data.x[i]) - 90
      let j = i - 1
      while (j >= 0 && dayNumber(data.x[j]) > cutoff) j--
      const previous = j >= 0 && typeof values[j] === 'number' ? values[j] : null
      return { value: values[i], previous, period: data.x[i] }
    }
  }
]
