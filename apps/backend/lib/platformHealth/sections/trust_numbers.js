import { AXOLOTL_ID } from '../sql'

export const section = {
  id: 'trust_numbers',
  title: 'Measurement integrity',
  question: 'Can we trust our numbers?'
}

const num = v => (v === null || v === undefined ? null : Number(v))

export const metrics = [
  {
    id: 'mixpanel_blind_spot',
    label: 'Content creators invisible to Mixpanel',
    definition: 'Each calendar month (UTC) since August 2025, when consent records begin: of the distinct people who wrote a post or comment (excluding private messages; active human accounts only, bot excluded; content in spaces included), the share whose saved cookie consent had analytics turned off by the end of that month (for the current month, at the as-of moment). Because consent is stored as a single row that is overwritten in place, a person whose row was changed after the month is counted as unknown rather than guessed. Also shown: the share with no consent record by month end, the share whose state at month end is unknown, and the share of that month\'s posts and comments written by people known to have opted out.',
    whyItMatters: 'Mixpanel does not see people who turn analytics off, and they write a large share of the content. This tells the team how far to trust client-side analytics, and why this panel is the source of truth.',
    display: 'series',
    unit: 'percent',
    goodDirection: 'down',
    vital: false,
    comparable: false,
    notes: 'Only the current month is a reliable reading, so the headline shows it without a month-over-month change. The rising line is an artifact, not a trend: consent is one row per person, overwritten on every change with no history, so older months have more people whose row was changed later (counted as unknown) and fewer who can be confirmed as opted out. Do not read the slope as a trend until a consent-history table exists. Opted-out share is a lower bound in every month. A consent row saved partway through a month classifies that person for the whole month, although Mixpanel tracked them before the row existed, which slightly inflates the opted-out share. Mixpanel actually follows each browser\'s local cookie; declines saved while logged out stay anonymous and cannot be tied to a person, so "no record" people were usually, but not always, tracked. Counts here are platform-wide totals, so small counts (for example a handful of unknown creators in the current month) are shown rather than suppressed.',
    sql: `with bounds as (
  select timestamptz '2025-08-01 00:00:00+00' as start_ts,
         date_trunc('month', :asOf::timestamptz at time zone 'UTC')::date as end_m
),
months as (
  select generate_series(date '2025-08-01', (select end_m from bounds), interval '1 month')::date as bucket
),
content as (
  select p.user_id, p.created_at
  from posts p
  where p.active and p.type <> 'thread'
    and p.created_at >= (select start_ts from bounds) and p.created_at < :asOf::timestamptz
  union all
  select c.user_id, c.created_at
  from comments c
  join posts p on p.id = c.post_id and p.active and p.type <> 'thread'
  where c.active is not false
    and c.created_at >= (select start_ts from bounds) and c.created_at < :asOf::timestamptz
),
human_content as (
  select date_trunc('month', ct.created_at at time zone 'UTC')::date as bucket, ct.user_id
  from content ct
  join users u on u.id = ct.user_id and u.active and u.id <> ${AXOLOTL_ID}
),
consent as (
  select distinct on (user_id) user_id,
         settings->>'analytics' as analytics,
         updated_at,
         min(created_at) over (partition by user_id) as first_created
  from cookie_consents
  where user_id is not null
  order by user_id, created_at desc, id desc
),
classified as (
  select hc.bucket, hc.user_id,
         case
           when cs.user_id is null
             or cs.first_created >= least((hc.bucket + interval '1 month') at time zone 'UTC', :asOf::timestamptz) then 'no_record'
           when cs.updated_at >= least((hc.bucket + interval '1 month') at time zone 'UTC', :asOf::timestamptz) then 'unknown'
           when cs.analytics = 'false' then 'opted_out'
           else 'opted_in'
         end as state
  from human_content hc
  left join consent cs on cs.user_id = hc.user_id
),
per_month as (
  select bucket,
         count(distinct user_id) as creators,
         count(distinct user_id) filter (where state = 'opted_out') as opted_out_creators,
         count(distinct user_id) filter (where state = 'no_record') as no_record_creators,
         count(distinct user_id) filter (where state = 'unknown') as unknown_creators,
         count(*) as content_items,
         count(*) filter (where state = 'opted_out') as opted_out_items
  from classified
  group by bucket
)
select to_char(m.bucket, 'YYYY-MM-DD') as bucket,
       coalesce(pm.creators, 0) as creators,
       coalesce(pm.opted_out_creators, 0) as opted_out_creators,
       coalesce(pm.no_record_creators, 0) as no_record_creators,
       coalesce(pm.unknown_creators, 0) as unknown_creators,
       coalesce(pm.content_items, 0) as content_items,
       coalesce(pm.opted_out_items, 0) as opted_out_items,
       (m.bucket = (select end_m from bounds)) as partial
from months m
left join per_month pm on pm.bucket = m.bucket
order by m.bucket`,
    transform: (rows, { asOf }) => {
      const share = (n, d) => (Number(d) > 0 ? Number(n) / Number(d) : null)
      return {
        judgedAt: asOf ? asOf.slice(0, 10) : null,
        granularity: 'month',
        x: rows.map(r => r.bucket),
        lines: [
          { key: 'opted_out_share', label: 'Creators opted out of analytics', values: rows.map(r => share(r.opted_out_creators, r.creators)), primary: true, unit: 'percent' },
          { key: 'no_record_share', label: 'Creators with no consent record', values: rows.map(r => share(r.no_record_creators, r.creators)), unit: 'percent' },
          { key: 'unknown_share', label: 'Creators with unknown consent (changed later)', values: rows.map(r => share(r.unknown_creators, r.creators)), unit: 'percent' },
          { key: 'content_opted_out_share', label: 'Posts and comments by opted-out creators', values: rows.map(r => share(r.opted_out_items, r.content_items)), unit: 'percent' },
          { key: 'creators', label: 'Content creators', values: rows.map(r => num(r.creators)), unit: 'count' },
          { key: 'opted_out_creators', label: 'Opted-out creators', values: rows.map(r => num(r.opted_out_creators)), unit: 'count' }
        ],
        partialLast: rows.length > 0 && rows[rows.length - 1].partial === true
      }
    },
    // Earlier months are censored by in-place consent overwrites, so a
    // month-over-month change is not meaningful. Report only the as-of month,
    // judged at the as-of moment, with no comparison.
    headline: data => {
      const line = data.lines.find(l => l.primary)
      const i = data.x.length - 1
      const value = line && i >= 0 ? line.values[i] : null
      if (typeof value !== 'number') return null
      return { value, previous: null, period: data.judgedAt ? `as of ${data.judgedAt}` : data.x[i] }
    }
  },
  {
    id: 'data_quality_tripwires',
    label: 'Data-quality tripwires',
    definition: 'How often columns that other metrics depend on are actually filled in, over the 90 days before the as-of date unless noted: who processed a join request (accepted or rejected requests); when a request or offer post was fulfilled (posts created 30 to 120 days ago, so each has had at least 30 days to be marked); the deactivation date on deactivated accounts; new contribution records; and whether posts and comments record where they were created. "Last written" is the most recent date each column was ever set. Days since the last daily snapshot will appear once that table exists.',
    whyItMatters: 'Several metrics silently depend on columns nothing writes. A low fulfillment number here means missing data, not unmet need, so metrics built on these columns should be read with care.',
    display: 'table',
    unit: 'percent',
    goodDirection: 'up',
    vital: false,
    notes: 'Join requests have no decision timestamp, so the last update stands in for the decision time. Deactivated accounts are keyed on their last update because the deactivation date is the column being tested. Where a post or comment was created is only recorded for email replies and the email post form. The daily snapshot row stays empty until a snapshot table is added. A blank "Last written" means the column has never been written (the check says so), or for the snapshot row that the table does not exist. Counts are platform-wide totals, so small counts are shown rather than suppressed.',
    sql: `with w as (
  select :asOf::timestamptz - interval '90 days' as lo, :asOf::timestamptz as hi
),
jr as (
  select 'Join request processed by'::text as field,
         'Accepted or rejected join requests updated in the last 90 days'::text as population,
         count(*) filter (where processed_by_id is not null)::bigint as numerator,
         count(*)::bigint as denominator,
         (select max(updated_at) from join_requests where processed_by_id is not null and updated_at < (select hi from w))::date as last_set_on,
         1 as ord
  from join_requests, w
  where status in (1, 2) and updated_at >= w.lo and updated_at < w.hi
),
ful as (
  select 'Post fulfilled at'::text,
         'Active request and offer posts created 30 to 120 days ago'::text,
         count(*) filter (where p.fulfilled_at is not null and p.fulfilled_at < w.hi)::bigint,
         count(*)::bigint,
         (select max(fulfilled_at) from posts where type in ('request', 'offer') and fulfilled_at < (select hi from w))::date,
         2
  from posts p join users u on u.id = p.user_id and u.active and u.id <> ${AXOLOTL_ID}, w
  where p.active and p.type in ('request', 'offer')
    and p.created_at >= w.hi - interval '120 days' and p.created_at < w.hi - interval '30 days'
),
deact as (
  select 'User deactivation date'::text,
         'Deactivated accounts updated in the last 90 days'::text,
         count(*) filter (where date_deactivated is not null)::bigint,
         count(*)::bigint,
         (select max(date_deactivated) from users where date_deactivated < (select hi from w))::date,
         3
  from users, w
  where active = false and updated_at >= w.lo and updated_at < w.hi
),
contrib as (
  select 'Contribution records created'::text,
         'Contribution rows dated in the last 90 days (a count, not a rate)'::text,
         count(*)::bigint,
         null::bigint,
         (select max(contributed_at) from contributions where contributed_at < (select hi from w))::date,
         4
  from contributions, w
  where contributed_at >= w.lo and contributed_at < w.hi
),
pcf as (
  select 'Post created-from source'::text,
         'Active posts (excluding private messages) created in the last 90 days'::text,
         count(*) filter (where p.created_from is not null)::bigint,
         count(*)::bigint,
         (select max(created_at) from posts where created_from is not null and created_at < (select hi from w))::date,
         5
  from posts p join users u on u.id = p.user_id and u.active and u.id <> ${AXOLOTL_ID}, w
  where p.active and p.type <> 'thread' and p.created_at >= w.lo and p.created_at < w.hi
),
ccf as (
  select 'Comment created-from source'::text,
         'Active comments on active posts (excluding private messages) created in the last 90 days'::text,
         count(*) filter (where c.created_from is not null)::bigint,
         count(*)::bigint,
         (select max(created_at) from comments where created_from is not null and created_at < (select hi from w))::date,
         6
  from comments c
  join posts p on p.id = c.post_id and p.active and p.type <> 'thread'
  join users u on u.id = c.user_id and u.active and u.id <> ${AXOLOTL_ID}, w
  where c.active is not false and c.created_at >= w.lo and c.created_at < w.hi
),
snap as (
  select 'Days since last daily snapshot'::text,
         'Daily snapshot table does not exist yet'::text,
         null::bigint, null::bigint, null::date, 7
),
allrows as (
  select * from jr union all select * from ful union all select * from deact
  union all select * from contrib union all select * from pcf union all select * from ccf
  union all select * from snap
)
select field, population, numerator, denominator,
       case when denominator is null then null else numerator::numeric / nullif(denominator, 0) end as fill_rate,
       to_char(last_set_on, 'YYYY-MM-DD') as last_set_on
from allrows
order by ord`,
    transform: rows => ({
      columns: [
        { key: 'field', label: 'Check' },
        { key: 'population', label: 'Rows checked' },
        { key: 'fill_rate', label: 'Filled in', unit: 'percent' },
        { key: 'numerator', label: 'Filled / created', unit: 'count' },
        { key: 'denominator', label: 'Total', unit: 'count' },
        { key: 'last_set_on', label: 'Last written' }
      ],
      rows: rows.map(r => ({
        field: r.field,
        population: r.last_set_on || r.numerator === null ? r.population : `${r.population} (column never written)`,
        fill_rate: num(r.fill_rate),
        numerator: num(r.numerator),
        denominator: num(r.denominator),
        last_set_on: r.last_set_on || null
      }))
    })
  }
]
