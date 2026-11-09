import { AXOLOTL_ID } from '../sql'
import { CONTRIBUTION_POSTS, contributionEvents } from '../contributions'

export const section = {
  id: 'coming_back',
  title: 'Retention',
  question: 'Are people coming back?'
}

// Smallest group of people a rate may describe before it is suppressed.
const MIN_CELL = 5

const num = v => (v === null || v === undefined ? null : Number(v))
const rate = (n, d) => {
  const nn = num(n)
  const dd = num(d)
  return dd !== null && dd >= MIN_CELL && nn !== null ? nn / dd : null
}

// Contributions follow the shared rule in ../contributions, the same one as
// Weekly and Monthly active contributors. Posts in spaces and groups both count.
const CONTRIBUTION_NOTE = 'Contribution means creating a post, commenting, reacting to a post or comment, RSVPing yes or interested to someone else\'s event, voting on a proposal, or joining someone else\'s project, outside direct messages, the same rule as Weekly active contributors. Contributions in spaces count. RSVP and project join times are approximate, as in Weekly active contributors.'

// Month label for headline phrases, e.g. '2026-02-01' -> 'Feb 2026'.
const monthLabel = iso => new Date(`${iso}T00:00:00Z`).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

// A count that would let a reader identify a handful of people (1–4).
const isSmall = n => n !== null && n >= 1 && n < MIN_CELL

/*
 * Small-cell suppression for segments that partition a shown platform-wide total.
 * cells: [{ n, size }] (n = people counted, size = people in the segment); returns a
 * parallel array of booleans (true = hide). A cell is hidden when its count, or the
 * count of segment members it leaves out, is 1–4. Because the segments add up to the
 * shown total, hiding a single cell would let a reader recover it by subtraction, so a
 * second cell (the smallest) is hidden too, and if the hidden cells together still add
 * up to 1–4 people, every cell is hidden.
 */
function suppressPartition (cells) {
  const sensitive = (n, size) => isSmall(n) || (n !== null && size !== null && isSmall(size - n))
  const hide = cells.map(c => c.n !== null && sensitive(c.n, c.size))
  for (let changed = true; changed;) {
    changed = false
    const hidden = cells.filter((c, i) => hide[i])
    const shown = cells.map((c, i) => i).filter(i => !hide[i] && cells[i].n !== null)
    if (!shown.length) break
    const sumN = hidden.reduce((t, c) => t + c.n, 0)
    const sumSize = hidden.reduce((t, c) => t + c.size, 0)
    if (hidden.length === 1 || (hidden.length > 1 && sensitive(sumN, sumSize))) {
      const next = hidden.length === 1
        ? shown.reduce((a, b) => (cells[b].n < cells[a].n ? b : a))
        : shown[0]
      hide[next] = true
      changed = true
    }
  }
  return hide
}

const SIGNUP_SEGMENTS = [
  { key: 'all', label: 'All signups' },
  { key: 'no_group_30d', label: 'No group in first 30 days' },
  { key: 'joined_no_contrib_30d', label: 'Joined, no contribution in first 30 days' },
  { key: 'contributed_30d', label: 'Contributed in first 30 days' }
]
const SEGMENT_LABEL = Object.fromEntries(SIGNUP_SEGMENTS.map(s => [s.key, s.label]))
const ALL_SIGNUPS_SUFFIX = ` · ${SEGMENT_LABEL.all}`

export const metrics = [
  {
    id: 'contributor_wow_retention',
    label: 'Contributor week-over-week retention',
    definition: 'Of the people who contributed in the previous week, the share who contributed again this week. Weeks run Monday to Sunday (UTC); 26 weeks are shown. The 4-week average pools the four most recent complete weeks that are not holiday-affected, up to and including that week, so right after the holidays it reaches back past them. It is blank for holiday-affected weeks and the week in progress.',
    whyItMatters: 'This is the fastest-moving retention signal. It drops sharply over the Christmas holidays, which is why holiday weeks are kept out of the average and the headline.',
    display: 'series',
    unit: 'percent',
    goodDirection: 'up',
    vital: true,
    notes: `${CONTRIBUTION_NOTE} Holiday-affected weeks are the weeks containing Dec 25 or Jan 1 and the week after them (whose starting group is the holiday week's contributors). They stay on the weekly line and are flagged, but they are left out of the 4-week average and of the headline, which compares the latest complete unaffected week with the unaffected week before it. The current week is partial. Rates are hidden when the prior week had fewer than 5 contributors. Counts are platform-wide totals, which are exempt from small-number suppression.`,
    sql: `with p as (select date_trunc('week', :asOf::timestamptz at time zone 'UTC') cw, :asOf::timestamptz asof),
b as (select (cw - interval '34 weeks') at time zone 'UTC' s, asof e from p),
${CONTRIBUTION_POSTS},
ev as (${contributionEvents({ from: ', b', when: t => `${t} >= b.s and ${t} < b.e` })}
),
wk as (select distinct date_trunc('week', ev.t at time zone 'UTC') w, ev.u from ev join users us on us.id = ev.u where us.active and us.id <> ${AXOLOTL_ID}),
wc as (select w, count(*) n from wk group by w),
rc as (select c.w, count(*) n from wk a join wk c on c.u = a.u and c.w = a.w + interval '1 week' group by c.w),
s as (
  select g.w, coalesce(wc.n, 0) denom, coalesce(rc.n, 0) num,
    ((extract(month from g.w) = 12 and extract(day from g.w) >= 19)
      or (extract(month from g.w + interval '6 days') = 1 and extract(day from g.w + interval '6 days') <= 7)) hol,
    (g.w = p.cw) part
  from p, generate_series(p.cw - interval '33 weeks', p.cw, interval '1 week') g(w)
  left join wc on wc.w = g.w - interval '1 week'
  left join rc on rc.w = g.w
),
-- Holiday-affected: a holiday week, or the week after one (its denominator is the contributors of the holiday week).
s2 as (select s.*, hol or coalesce(lag(hol) over (order by w), false) aff from s),
-- Rolling average pools the four most recent complete, unaffected weeks; null until four are available.
el as (
  select w, sum(num) over wnd n4, sum(denom) over wnd d4, count(*) over wnd k
  from s2 where not aff and not part
  window wnd as (order by w rows between 3 preceding and current row)
)
select s2.w::date::text as bucket, s2.num::int as numerator, s2.denom::int as denominator,
  case when el.k = 4 then el.n4 end::int as n4, case when el.k = 4 then el.d4 end::int as d4,
  s2.part as is_partial, s2.aff as is_holiday
from s2 left join el on el.w = s2.w, p where s2.w > p.cw - interval '26 weeks' order by s2.w`,
    transform: rows => ({
      granularity: 'week',
      x: rows.map(r => r.bucket),
      lines: [
        {
          key: 'retention',
          label: 'Contributed again this week',
          values: rows.map(r => rate(r.numerator, r.denominator)),
          primary: true,
          unit: 'percent'
        },
        {
          key: 'rolling_4wk',
          label: '4-week average (complete, non-holiday weeks)',
          values: rows.map(r => (r.is_partial ? null : rate(r.n4, r.d4))),
          unit: 'percent'
        },
        {
          key: 'retained',
          label: 'Contributors retained',
          values: rows.map(r => num(r.numerator)),
          unit: 'count'
        },
        {
          key: 'prior_week_contributors',
          label: 'Contributors in prior week',
          values: rows.map(r => num(r.denominator)),
          unit: 'count'
        }
      ],
      partialLast: rows.length > 0 && rows[rows.length - 1].is_partial === true,
      // Weeks (x values) that are holiday-affected; the UI can annotate them.
      holidayWeeks: rows.filter(r => r.is_holiday === true).map(r => r.bucket)
    }),
    // Skip holiday-affected weeks and the week in progress, so a holiday dip is not read as a drop.
    headline: data => {
      const line = data.lines.find(l => l.primary)
      const skip = new Set(data.holidayWeeks || [])
      const usable = data.x
        .map((x, i) => ({ x, v: line.values[i] }))
        .filter((p, i) => typeof p.v === 'number' && !skip.has(p.x) && !(data.partialLast && i === data.x.length - 1))
      if (!usable.length) return null
      const last = usable[usable.length - 1]
      const prev = usable.length > 1 ? usable[usable.length - 2] : null
      return { value: last.v, previous: prev ? prev.v : null, period: last.x }
    }
  },
  {
    id: 'new_contributor_retention',
    label: 'New-contributor retention, days 8–35',
    definition: 'Monthly cohorts of people grouped by the month of their first-ever contribution. For each cohort, the share who contributed again between day 8 and day 35 after that first contribution. The 12 most recent cohorts whose window has fully closed are shown, so the latest cohort appears about five weeks after its month ends.',
    whyItMatters: 'This shows whether first-time participants become regulars.',
    display: 'cohort',
    unit: 'percent',
    goodDirection: 'up',
    vital: false,
    notes: `${CONTRIBUTION_NOTE} Months are UTC. Deactivated accounts are left out of cohorts, which slightly raises retention for older cohorts. Rates are hidden for cohorts under 5 people.`,
    sql: `with p as (select :asOf::timestamptz asof, :asOf::timestamptz at time zone 'UTC' asof_utc),
${CONTRIBUTION_POSTS},
ev as (${contributionEvents({ from: ', p', when: t => `${t} < p.asof` })}
),
h as (select ev.u, ev.t from ev join users us on us.id = ev.u where us.active and us.id <> ${AXOLOTL_ID} and ev.t is not null),
f as (select u, min(t) ft from h group by u),
coh as (
  select f.u, f.ft, date_trunc('month', f.ft at time zone 'UTC') m from f, p
  where f.ft >= (date_trunc('month', p.asof_utc - interval '36 days') - interval '12 months') at time zone 'UTC'
    and date_trunc('month', f.ft at time zone 'UTC') + interval '1 month' + interval '36 days' <= p.asof_utc
),
ret as (select distinct coh.u from coh join h on h.u = coh.u and h.t >= coh.ft + interval '8 days' and h.t < coh.ft + interval '36 days'),
g as (
  select generate_series(date_trunc('month', p.asof_utc - interval '36 days') - interval '12 months',
    date_trunc('month', p.asof_utc - interval '36 days') - interval '1 month', interval '1 month') m from p
)
select g.m::date::text as bucket, count(ret.u)::int as numerator, count(coh.u)::int as denominator
from g left join coh on coh.m = g.m left join ret on ret.u = coh.u
group by g.m order by g.m`,
    transform: rows => ({
      columns: ['Contributed again, days 8–35'],
      rows: rows.map(r => ({
        label: r.bucket,
        size: num(r.denominator),
        values: [rate(r.numerator, r.denominator)]
      }))
    })
  },
  {
    id: 'signup_cohort_curve',
    label: 'Signup cohort contribution curve',
    definition: 'Monthly cohorts of people who completed signup. For each cohort, the share who contributed in week 1, weeks 3–4, weeks 7–8 and weeks 11–12 after signup, overall and by what they did in their first 30 days: joined no group; joined a group but did not contribute; or contributed. A later column fills in only once that window has closed for the whole cohort.',
    whyItMatters: "This replaces 'last active in the last 30 days', which only measures recency, with a real cohort curve. It shows how much more likely people who contribute in their first month are to still be contributing two to three months later.",
    display: 'cohort',
    unit: 'percent',
    goodDirection: 'up',
    vital: false,
    notes: `${CONTRIBUTION_NOTE} Segments are fixed at day 30 so they do not use later information; joining a space counts as joining a group. For the two segments that did not contribute in the first 30 days, week 1 and weeks 3–4 are empty because they are zero by definition. Signups still in progress are excluded, and so are deactivated accounts, which slightly flatters the curve. The headline is the weeks 7–8 rate for all signups in the latest cohort where that window has closed. The all-signups rows are platform-wide totals and are shown in full. In the segment rows, a rate is hidden when it would reveal 1–4 people (who contributed, or who did not); because the segments add up to the all-signups row, a second segment is then hidden too so the first cannot be worked out by subtraction. This hides most segment rates for weeks 7–8 and 11–12 in the two non-contributing segments, where only a handful of people come back.`,
    sql: `with p as (select :asOf::timestamptz asof, :asOf::timestamptz at time zone 'UTC' asof_utc),
g as (
  select generate_series(date_trunc('month', p.asof_utc - interval '30 days') - interval '12 months',
    date_trunc('month', p.asof_utc - interval '30 days') - interval '1 month', interval '1 month') m from p
),
u as (
  select us.id, us.created_at, date_trunc('month', us.created_at at time zone 'UTC') m from users us, p
  where us.active and us.id <> ${AXOLOTL_ID} and coalesce(us.settings->>'signup_in_progress', 'false') <> 'true'
    and us.created_at >= (date_trunc('month', p.asof_utc - interval '30 days') - interval '12 months') at time zone 'UTC'
    and date_trunc('month', us.created_at at time zone 'UTC') + interval '1 month' + interval '30 days' <= p.asof_utc
),
${CONTRIBUTION_POSTS},
ev as (${contributionEvents({ userJoin: alias => `join u on u.id = ${alias}.user_id` })}
),
flags as (
  select u.id, u.m,
    exists (select 1 from group_memberships gm where gm.user_id = u.id and gm.created_at < u.created_at + interval '30 days') joined30,
    bool_or(ev.t >= u.created_at and ev.t < u.created_at + interval '30 days') c30,
    bool_or(ev.t >= u.created_at and ev.t < u.created_at + interval '7 days') w1,
    bool_or(ev.t >= u.created_at + interval '14 days' and ev.t < u.created_at + interval '28 days') w3_4,
    bool_or(ev.t >= u.created_at + interval '42 days' and ev.t < u.created_at + interval '56 days') w7_8,
    bool_or(ev.t >= u.created_at + interval '70 days' and ev.t < u.created_at + interval '84 days') w11_12
  from u left join ev on ev.u = u.id group by u.id, u.m, u.created_at
),
seg as (
  select m, case when coalesce(c30, false) then 'contributed_30d' when joined30 then 'joined_no_contrib_30d' else 'no_group_30d' end segment,
    w1, w3_4, w7_8, w11_12
  from flags
),
segs as (select unnest(array['all', 'no_group_30d', 'joined_no_contrib_30d', 'contributed_30d']) segment),
agg as (
  select m, segment, count(*) n, count(*) filter (where w1) w1, count(*) filter (where w3_4) w3_4,
    count(*) filter (where w7_8) w7_8, count(*) filter (where w11_12) w11_12
  from seg group by grouping sets ((m, segment), (m))
)
select g.m::date::text as bucket, s.segment,
  coalesce(a.n, 0)::int as cohort_size,
  coalesce(a.w1, 0)::int as w1_num,
  case when g.m + interval '1 month' + interval '28 days' <= p.asof_utc then coalesce(a.w3_4, 0)::int end as w3_4_num,
  case when g.m + interval '1 month' + interval '56 days' <= p.asof_utc then coalesce(a.w7_8, 0)::int end as w7_8_num,
  case when g.m + interval '1 month' + interval '84 days' <= p.asof_utc then coalesce(a.w11_12, 0)::int end as w11_12_num
from p, g cross join segs s
left join agg a on a.m = g.m and coalesce(a.segment, 'all') = s.segment
order by g.m, array_position(array['all', 'no_group_30d', 'joined_no_contrib_30d', 'contributed_30d'], s.segment)`,
    transform: rows => {
      const COLS = ['w1_num', 'w3_4_num', 'w7_8_num', 'w11_12_num']
      // Segments defined by not contributing in days 0–30 cannot contribute in week 1 or weeks 3–4.
      const earlyNotApplicable = r => r.segment === 'no_group_30d' || r.segment === 'joined_no_contrib_30d'
      const out = []
      const months = [...new Set(rows.map(r => r.bucket))]
      for (const month of months) {
        const monthRows = rows.filter(r => r.bucket === month)
        const all = monthRows.find(r => r.segment === 'all')
        const segs = monthRows.filter(r => r.segment !== 'all')
        const sizes = segs.map(r => num(r.cohort_size))
        // The all-signups row is a platform-wide total and is shown as is; the segments
        // partition it, so they get small-cell suppression with complementary hiding.
        const hideSize = suppressPartition(sizes.map(n => ({ n, size: null })))
        const hideCell = COLS.map(col => suppressPartition(segs.map((r, i) => ({
          n: earlyNotApplicable(r) && (col === 'w1_num' || col === 'w3_4_num') ? 0 : num(r[col]),
          size: sizes[i]
        }))))
        const toRow = (r, i) => ({
          label: `${r.bucket} · ${SEGMENT_LABEL[r.segment] || r.segment}`,
          size: i === null ? num(r.cohort_size) : (hideSize[i] ? null : sizes[i]),
          values: COLS.map((col, c) => {
            if (i === null) return rate(r[col], r.cohort_size)
            if (hideSize[i] || hideCell[c][i]) return null
            if (earlyNotApplicable(r) && c < 2) return null
            return rate(r[col], r.cohort_size)
          })
        })
        if (all) out.push(toRow(all, null))
        segs.forEach((r, i) => out.push(toRow(r, i)))
      }
      return { columns: ['Week 1', 'Weeks 3–4', 'Weeks 7–8', 'Weeks 11–12'], rows: out }
    },
    headline: data => {
      const all = data.rows.filter(r => r.label.endsWith(ALL_SIGNUPS_SUFFIX) && typeof r.values[2] === 'number')
      if (!all.length) return null
      const last = all[all.length - 1]
      const prev = all.length > 1 ? all[all.length - 2] : null
      return {
        value: last.values[2],
        previous: prev ? prev.values[2] : null,
        period: last.label.slice(0, -ALL_SIGNUPS_SUFFIX.length)
      }
    }
  },
  {
    id: 'account_deactivations',
    label: 'Account deactivations and deletions per month (proxy)',
    definition: 'Accounts that are now deactivated or deleted, counted in the month of their last profile update, for the trailing 12 months, split into deletions and other deactivations. Abandoned signups (people who requested a verification code but never finished registering) are not counted. Also shown per 1,000 people who visited in the last 30 days.',
    whyItMatters: 'This is churn by choice, and it tracks notification load.',
    display: 'series',
    unit: 'count',
    goodDirection: 'down',
    vital: false,
    comparable: false,
    notes: 'Proxy: current code never writes users.date_deactivated, so the month is the account\'s last profile update. Deleting an account does not update that time, so a deletion lands in the month of the person\'s last profile save, not the month they deleted. Accounts that were deactivated and later logged in again are reactivated and drop out of history. Deletions by people who have not saved their profile within the 12 months shown are not counted at all (most deleted accounts last saved their profile years earlier), and past months can grow as people delete later, so this undercounts recent deletions and is not a deletion rate. For the same reason the headline shows only the latest complete month, with no comparison to the month before. Admin and spam deactivations cannot be told apart from ones people chose. The per-1,000 line divides every month by the 30-day visitor count at the report date (no history exists), so read it as a scaled count. Monthly counts are platform-wide totals and are shown even when under 5, since platform-wide totals are exempt from small-number suppression. Months are UTC; the current month is partial.',
    sql: `with p as (select :asOf::timestamptz asof, date_trunc('month', :asOf::timestamptz at time zone 'UTC') cm),
g as (select generate_series(p.cm - interval '11 months', p.cm, interval '1 month') m from p),
d as (
  select date_trunc('month', us.updated_at at time zone 'UTC') m, count(*) n,
    count(*) filter (where us.name = 'Deleted User') deleted
  from users us, p
  where us.active is false and us.id <> ${AXOLOTL_ID}
    and coalesce(us.settings->>'signup_in_progress', 'false') <> 'true'
    and us.updated_at >= (p.cm - interval '11 months') at time zone 'UTC' and us.updated_at < p.asof
  group by 1
),
v as (select count(*) v30 from users us, p where us.active and us.id <> ${AXOLOTL_ID} and us.last_active_at > p.asof - interval '30 days' and us.last_active_at <= p.asof)
select g.m::date::text as bucket, coalesce(d.n, 0)::int as total, coalesce(d.deleted, 0)::int as deleted,
  v.v30::int as visitors_30d, (g.m = p.cm) as is_partial
from p, g left join d on d.m = g.m cross join v order by g.m`,
    transform: rows => ({
      granularity: 'month',
      x: rows.map(r => r.bucket),
      lines: [
        {
          key: 'total',
          label: 'Deactivated or deleted',
          values: rows.map(r => num(r.total)),
          primary: true,
          unit: 'count'
        },
        {
          key: 'deleted',
          label: 'Deleted accounts',
          values: rows.map(r => num(r.deleted)),
          unit: 'count'
        },
        {
          key: 'deactivated',
          label: 'Deactivated, not deleted',
          values: rows.map(r => num(r.total) - num(r.deleted)),
          unit: 'count'
        },
        {
          key: 'per_1000_visitors',
          label: 'Per 1,000 current 30-day visitors',
          values: rows.map(r => {
            const v30 = num(r.visitors_30d)
            return v30 ? (1000 * num(r.total)) / v30 : null
          }),
          unit: 'ratio'
        }
      ],
      partialLast: rows.length > 0 && rows[rows.length - 1].is_partial === true
    }),
    // Recent months keep filling in as people delete later, so a month-over-month
    // comparison would be biased; report only the latest complete month.
    headline: data => {
      const line = data.lines.find(l => l.primary)
      const i = data.partialLast ? data.x.length - 2 : data.x.length - 1
      if (i < 0 || typeof line.values[i] !== 'number') return null
      return { value: line.values[i], previous: null, period: `${monthLabel(data.x[i])}, by month of last profile save` }
    }
  }
]
