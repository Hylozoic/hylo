import { AXOLOTL_ID } from '../sql'
import { NON_DM_TYPES, NOT_AUTHOR_ASSIGNED, RSVP_T } from '../contributions'

export const section = {
  id: 'audience',
  title: 'Audience',
  question: 'How many people use Hylo, by the standard measures?'
}

// pg returns bigint/numeric as strings; keep null as null.
const num = v => (v === null || v === undefined ? null : Number(v))
const share = (n, d) => (n !== null && d ? n / d : null)

// Shared SQL fragments, kept identical to network_alive so "contributor" means
// the same thing on every card.
const HUMAN = `us.active and us.id <> ${AXOLOTL_ID}`

// Contributions by anyone in the `win` CTE (s, e). Emits contrib(u, t, pc), where
// pc marks posts and comments. Same rule as weekly active contributors.
const CONTRIBUTIONS = `np as (
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
)`

const ACTIVE_MEANING = '"Active" means the person used Hylo while logged in: their browser or the mobile app made at least one signed-in request to Hylo. Just opening Hylo counts, including visits prompted by a notification or an email; posting is not required. Deactivated accounts, the Axolotl bot and third-party apps signed in through OAuth are not counted.'
const CONTRIBUTION_RULE = 'A contribution is a non-DM post of any type (chat included), a comment on one, a reaction to either, an RSVP of yes or interested to someone else\'s event, a proposal vote, or joining someone else\'s project, the same rule as weekly active contributors.'
const PROJECT_NOTE = 'Project join times are approximate: posts_users has no join timestamp, so the row\'s creation time is used, and members added by the author when creating the project are left out.'
const RSVP_NOTE = 'RSVP times are approximate: editing an event re-stamps every RSVP, so re-sent invitations fall back to when the invitation was created.'
const TOTALS_NOTE = 'These are platform-wide totals, which are exempt from small-number suppression.'

// Past visits can't be rebuilt from last_active_at once more than this share of
// the MAU has been active again since the report date.
const MAX_ACTIVE_SINCE_SHARE = 0.01

const peopleHave = n => `${n.toLocaleString('en-US')} ${n === 1 ? 'person has' : 'people have'}`

// Weekly MAU points share 23 of their 30 days, so compare the latest complete
// point with the one five weeks earlier, whose window doesn't overlap it.
function mauHeadline (data) {
  const line = data.lines.find(l => l.primary)
  const complete = data.partialLast ? line.values.length - 1 : line.values.length
  let i = complete - 1
  while (i >= 0 && line.values[i] === null) i--
  if (i < 0) return null
  const prev = i >= 5 ? line.values[i - 5] : null
  return { value: line.values[i], previous: prev, period: data.x[i] }
}

export const metrics = [
  {
    id: 'active_users_now',
    label: 'Active users (DAU, WAU, MAU)',
    definition: `The number of people active in the 1, 7 and 30 days before the report date: daily, weekly and monthly active users (DAU, WAU and MAU). ${ACTIVE_MEANING} The headline is MAU. Stickiness is DAU ÷ MAU, the share of the month's users who come on a given day; WAU ÷ MAU is the same for a week. Also shows the people who contributed in the last 30 days and the number of monthly active users per contributor.`,
    whyItMatters: 'These are the standard audience measures that funders and partners know. MAU is the size of the audience, stickiness shows how much of it comes back often, and visitors per contributor shows how many people read without posting.',
    display: 'kpi',
    unit: 'count',
    goodDirection: 'up',
    vital: true,
    comparable: false,
    notes: `This is a point-in-time count taken from each account's last-active time, which is overwritten on every visit, so it only works for recent dates. A report date of today means right now. For a past date it is blank once more than 1% of that date's MAU have been active again since (allowing one hour after the report time). The weekly trend is in "Active users over time". ${CONTRIBUTION_RULE} ${TOTALS_NOTE}`,
    sql: `with p as (
  -- A report date of today (UTC) means right now: today's visits would otherwise
  -- overwrite the last-active times this count depends on.
  select case when q.a >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') then now() else q.a end as as_of
  from (select cast(:asOf as timestamptz) as a) q
),
win as (select as_of - interval '30 days' as s, as_of as e from p),
v as (
  select
    count(*) filter (where us.last_active_at >= p.as_of - interval '1 day' and us.last_active_at < p.as_of) dau,
    count(*) filter (where us.last_active_at >= p.as_of - interval '7 days' and us.last_active_at < p.as_of) wau,
    count(*) filter (where us.last_active_at < p.as_of) mau,
    count(*) filter (where us.last_active_at > p.as_of + interval '1 hour') active_since
  from users us, p
  where ${HUMAN} and us.last_active_at >= p.as_of - interval '30 days'
),
${CONTRIBUTIONS},
c as (select count(distinct contrib.u) c30 from contrib join users us on us.id = contrib.u and ${HUMAN})
select v.dau::int as dau, v.wau::int as wau, v.mau::int as mau, v.active_since::int as active_since,
  c.c30::int as contributors_30d
from v, c`,
    transform: rows => {
      const r = rows[0] || {}
      const dau = num(r.dau)
      const wau = num(r.wau)
      const mau = num(r.mau)
      const c30 = num(r.contributors_30d)
      const since = num(r.active_since)
      const stale = since !== null && mau !== null && since > MAX_ACTIVE_SINCE_SHARE * mau
      const ok = v => (stale ? null : v)
      return {
        value: ok(mau),
        breakdown: [
          { label: 'DAU (last day)', value: ok(dau), unit: 'count' },
          { label: 'WAU (last 7 days)', value: ok(wau), unit: 'count' },
          { label: 'MAU (last 30 days)', value: ok(mau), unit: 'count' },
          { label: 'Stickiness (DAU ÷ MAU)', value: ok(share(dau, mau)), unit: 'percent' },
          { label: 'WAU ÷ MAU', value: ok(share(wau, mau)), unit: 'percent' },
          { label: '30-day contributors', value: ok(c30), unit: 'count' },
          { label: 'Visitors per contributor', value: ok(share(mau, c30)), unit: 'ratio' }
        ],
        note: stale
          ? `Only available for recent dates: ${peopleHave(since)} been active since then, so past visitors can't be reconstructed.`
          : null
      }
    },
    headline: data => (typeof data.value === 'number' ? { value: data.value, previous: null, period: 'last 30 days' } : null)
  },
  {
    id: 'active_users_trend',
    label: 'Active users over time',
    definition: `Weekly points (Monday to Sunday, UTC) for 26 weeks, from a daily record of who was active. MAU is the number of people active in the 30 days ending on the week's last day; WAU is the number active during the week; average DAU is the average number active per day across the week. Stickiness is average DAU ÷ MAU. For the current week, WAU and average DAU cover its complete days so far and MAU covers the 30 complete days before the report date. ${ACTIVE_MEANING}`,
    whyItMatters: 'This is the DAU, WAU and MAU trend in the form outsiders expect. Unlike the point-in-time count, it keeps its history, so growth and seasonality show week by week.',
    display: 'series',
    unit: 'count',
    goodDirection: 'up',
    vital: false,
    notes: `The daily record starts on the day it was deployed and has no earlier history, so weeks before recording began, and MAU points whose 30-day window starts before it, are blank rather than zero. The day in progress is not counted. Account status (deactivated or not) is today's. Daily records are kept for 2 years. ${TOTALS_NOTE}`,
    sql: `with p as (
  select date_trunc('week', cast(:asOf as timestamptz) at time zone 'UTC') as cur_wk,
         (cast(:asOf as timestamptz) at time zone 'UTC')::date - 1 as last_day
),
-- The first recorded day may be partial (tracking deploys mid-day, and pruning
-- runs mid-day), so counting starts the day after it.
cov as (select min(day) as recorded_from, min(day) + 1 as first_day from user_activity_days),
b as (
  select w::date as ws, least(w::date + 6, p.last_day) as we, (w = p.cur_wk) as is_partial
  from p, generate_series(p.cur_wk - interval '25 weeks', p.cur_wk, interval '1 week') w
),
d as (
  select a.user_id, a.day from user_activity_days a
  join users us on us.id = a.user_id and ${HUMAN}, p
  where a.day >= (p.cur_wk - interval '25 weeks')::date - 29 and a.day <= p.last_day
),
wk as (
  select ws, count(*) as wau, sum(n) as user_days from (
    select b.ws, d.user_id, count(*) n from b join d on d.day between b.ws and b.we group by 1, 2
  ) x group by ws
),
mo as (
  select ws, count(*) as mau from (
    select distinct b.ws, d.user_id from b join d on d.day between b.we - 29 and b.we
  ) x group by ws
)
-- A value is only shown when recording covers its whole window: blank, not zero.
select to_char(b.ws, 'YYYY-MM-DD') as bucket, b.is_partial,
  greatest(b.we - b.ws + 1, 0) as days_counted,
  to_char(cov.recorded_from, 'YYYY-MM-DD') as recorded_from,
  to_char(cov.first_day, 'YYYY-MM-DD') as first_day,
  case when cov.first_day <= b.ws and b.we >= b.ws then coalesce(wk.wau, 0) end::int as wau,
  case when cov.first_day <= b.ws and b.we >= b.ws then coalesce(wk.user_days, 0) end::int as user_days,
  case when cov.first_day <= b.we - 29 then coalesce(mo.mau, 0) end::int as mau
from b cross join cov
left join wk on wk.ws = b.ws
left join mo on mo.ws = b.ws
order by b.ws`,
    transform: rows => {
      const days = rows.map(r => num(r.days_counted))
      const mau = rows.map(r => num(r.mau))
      const dauAvg = rows.map((r, i) => {
        const userDays = num(r.user_days)
        return userDays !== null && days[i] ? userDays / days[i] : null
      })
      const firstDay = rows.length ? rows[0].first_day : null
      const recordedFrom = rows.length ? rows[0].recorded_from : null
      return {
        granularity: 'week',
        x: rows.map(r => r.bucket),
        lines: [
          { key: 'mau', label: 'MAU (30 days to week end)', values: mau, primary: true, unit: 'count' },
          { key: 'wau', label: 'WAU', values: rows.map(r => num(r.wau)), unit: 'count' },
          { key: 'dau_avg', label: 'Average DAU', values: dauAvg.map(v => (v === null ? null : Math.round(v * 10) / 10)), unit: 'count' },
          { key: 'stickiness', label: 'Stickiness (average DAU ÷ MAU)', values: dauAvg.map((v, i) => share(v, mau[i])), unit: 'percent' }
        ],
        partialLast: rows.length > 0 && rows[rows.length - 1].is_partial === true,
        note: firstDay
          ? `Daily records start on ${recordedFrom}; counting starts the next day, ${firstDay}. Earlier weeks are blank, not zero.`
          : 'No activity has been recorded yet; this fills in from the day the tracking change is deployed.'
      }
    },
    headline: mauHeadline
  },
  {
    id: 'monthly_active_contributors',
    label: 'Monthly active contributors',
    definition: `Monthly active contributors, a stricter measure than MAU: distinct people with at least one contribution in each calendar month (UTC), for 24 months including the current month so far. ${CONTRIBUTION_RULE} The Axolotl bot and deactivated accounts are excluded. Also shows the subset who posted or commented.`,
    whyItMatters: 'Contributions are stored with their dates, so unlike MAU this has full history: it is the long-run line outsiders can see today, while the MAU trend fills in. Every contributor is also an active user, so it is a floor under MAU.',
    display: 'series',
    unit: 'count',
    goodDirection: 'up',
    vital: false,
    notes: `The current month is partial. ${PROJECT_NOTE} ${RSVP_NOTE} ${TOTALS_NOTE}`,
    sql: `with params as (
  select cast(:asOf as timestamptz) as as_of,
         date_trunc('month', cast(:asOf as timestamptz) at time zone 'UTC') as cur_m
),
win as (select (cur_m - interval '23 months') at time zone 'UTC' as s, as_of as e from params),
months as (select generate_series(cur_m - interval '23 months', cur_m, interval '1 month') as m from params),
${CONTRIBUTIONS},
hc as (
  select date_trunc('month', c.t at time zone 'UTC') m, c.u, bool_or(c.pc) pc
  from contrib c join users us on us.id = c.u and ${HUMAN}
  group by 1, 2
),
agg as (select m, count(*)::int n, count(*) filter (where pc)::int n_pc from hc group by m)
select to_char(months.m, 'YYYY-MM-DD') as bucket,
  coalesce(agg.n, 0) as contributors,
  coalesce(agg.n_pc, 0) as posters_commenters,
  (months.m = params.cur_m) as is_partial
from params, months left join agg on agg.m = months.m
order by months.m`,
    transform: rows => ({
      granularity: 'month',
      x: rows.map(r => r.bucket),
      lines: [
        { key: 'contributors', label: 'Active contributors', values: rows.map(r => num(r.contributors)), primary: true, unit: 'count' },
        { key: 'posters_commenters', label: 'Posted or commented', values: rows.map(r => num(r.posters_commenters)), unit: 'count' }
      ],
      partialLast: rows.length > 0 && rows[rows.length - 1].is_partial === true
    })
  }
]
