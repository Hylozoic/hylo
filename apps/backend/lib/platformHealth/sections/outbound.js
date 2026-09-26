import { AXOLOTL_ID } from '../sql'

export const section = {
  id: 'outbound',
  title: 'Outbound health',
  question: 'Are our notifications and emails helping people, or pushing them away?'
}

const MIN_CELL = 5
// Memberships created before 2025-04 may still carry the old postNotifications = 'important'
// default, which would read as a turn-down. A UTC wall-clock month start.
const DEFAULT_ALL_FROM = "'2025-04-01'::timestamp"

const num = v => (v === null || v === undefined ? null : Number(v))
const share = (n, d) => {
  const nn = num(n)
  const dd = num(d)
  return dd ? nn / dd : null
}

// A reasons array from activities.meta, or an empty array when it is missing or malformed.
const reasonsArray = expr => `(case when jsonb_typeof(${expr}) = 'array' then ${expr} else '[]'::jsonb end)`

// Ordered like Notification.priorityReason (apps/backend/api/models/Notification.js). A reason
// matches a label when it starts with that label (JS: new RegExp('^' + label)).
// Hard-coded copy: priorityReason keeps its list inside the function, so it cannot be imported.
const PRIORITY_LABELS = [
  'donation to', 'donation from', 'announcement', 'eventInvitation', 'mention', 'commentMention', 'newComment',
  'newContribution', 'chat', 'tag', 'newPost', 'follow', 'followAdd', 'unfollow', 'postFulfilled', 'postUnfulfilled',
  'joinRequest', 'approvedJoinRequest', 'groupInvitation', 'groupChildGroupInviteAccepted', 'groupChildGroupInvite',
  'groupParentGroupJoinRequestAccepted', 'groupParentGroupJoinRequest', 'groupPeerGroupInviteAccepted',
  'groupPeerGroupInvite', 'memberJoinedGroup', 'trackCompleted', 'trackEnrollment',
  'fundingRoundNewSubmission', 'fundingRoundPhaseTransition', 'fundingRoundReminder'
]

// The cases handled by Notification.sendEmail (apps/backend/api/models/Notification.js).
// Keep in sync when sendEmail gains cases.
const EMAIL_HANDLED = [
  'announcement', 'approvedJoinRequest', 'donation to', 'donation from', 'eventInvitation',
  'groupChildGroupInvite', 'groupChildGroupInviteAccepted', 'groupParentGroupJoinRequest',
  'groupParentGroupJoinRequestAccepted', 'groupPeerGroupInvite', 'groupPeerGroupInviteAccepted',
  'joinRequest', 'memberJoinedGroup', 'mention', 'newPost', 'tag', 'trackCompleted', 'trackEnrollment',
  'postFulfilled', 'postUnfulfilled', 'fundingRoundNewSubmission', 'fundingRoundPhaseTransition',
  'fundingRoundReminder'
]
const EMAIL_VIA_DIGEST = ['newComment', 'commentMention']

const sqlList = list => list.map(s => `'${s}'`).join(', ')

// The highest-priority label (Notification.priorityReason) of a reasons array, or null when no
// reason matches a label.
const topLabel = expr => `(
  select pl.l
  from jsonb_array_elements_text(${reasonsArray(expr)}) r(x)
  join (values ${PRIORITY_LABELS.map((l, i) => `('${l}', ${i + 1})`).join(', ')}) pl(l, o)
    on left(r.x, length(pl.l)) = pl.l
  order by pl.o
  limit 1
)`

// True when Notification.sendEmail would actually send an email for these reasons. Comment
// "email" rows are never emailed one by one: comment email goes out through the hourly comment
// digest (Comment.sendDigests), which reads user settings, not notification rows. Rows whose
// top reason sendEmail does not handle are marked sent without any email going out.
const isDispatchableEmail = expr => `coalesce(${topLabel(expr)} in (${sqlList(EMAIL_HANDLED)}), false)`

// The groups Activity.groupIds uses to pick the memberships whose settings decide push and
// email: the post's groups, else the commented post's groups, else the activity's group(s).
const activityGroupMatch = (a, gid) => `(case
  when ${a}.post_id is not null then exists (
    select 1 from groups_posts gp where gp.group_id = ${gid} and gp.post_id = ${a}.post_id)
  when ${a}.comment_id is not null then exists (
    select 1 from comments c join groups_posts gp on gp.post_id = c.post_id
    where c.id = ${a}.comment_id and gp.group_id = ${gid})
  else ${gid} in (${a}.group_id, ${a}.other_group_id)
end)`

// True when a count is 1-4 people, which must not be recoverable from a published value.
const isSmall = n => n !== null && n > 0 && n < MIN_CELL

export const metrics = [
  {
    id: 'outbound_to_dormant_share',
    label: 'Push and email reaching dormant users',
    definition: 'Of push and email notifications created in the trailing 30 days, the share sent to people who had not been active since before the window started (or never). Email rows are counted only when the email sender actually sends them: comment "email" rows are left out, because comment email is sent by the comment digest, not one by one, and so are the few rows whose reason the email sender does not handle. Also shows the share sent to people dormant for more than a year, and the 90th-percentile number of push plus email per recipient, scaled to 30 days.',
    whyItMatters: 'Pushing people who have left burns sender reputation and trust.',
    display: 'kpi',
    unit: 'percent',
    goodDirection: 'down',
    vital: true,
    comparable: false,
    notes: 'Notifications are deleted after about a month, so the window only holds the days still on record (shown as "Days of data"). The per-recipient 90th percentile is measured over those days and then scaled up linearly to 30 days, which only approximates a true 30-day percentile. When no notifications are on record for the window (an asOf older than about a month), the value is empty. Dormancy uses each person\'s current last-active date, so this is accurate only for the current moment. Deactivated accounts are kept as recipients, because sending to them is also waste. Counts notification rows, not people. All counts are platform-wide totals, so small counts are not suppressed.',
    sql: `
with w as (
  select :asOf::timestamptz - interval '30 days' as ws, :asOf::timestamptz as we
), cov as (
  select w.ws, w.we,
         least(w.we, greatest(w.ws, coalesce((select min(n0.created_at) from notifications n0), w.we))) as ds
  from w
), raw as materialized (
  select n.user_id, n.medium,
         case when n.medium = 2 then (select a.meta->'reasons' from activities a where a.id = n.activity_id) end as reasons
  from notifications n
  where n.medium in (1, 2)
    and n.created_at >= :asOf::timestamptz - interval '30 days'
    and n.created_at < :asOf::timestamptz
    and n.user_id <> ${AXOLOTL_ID}
), n as (
  select r.user_id, count(*) as c
  from raw r
  where r.medium = 1 or ${isDispatchableEmail('r.reasons')}
  group by r.user_id
), j as (
  select n.c,
         (u.last_active_at is null or u.last_active_at < cov.ws) as dormant30,
         (u.last_active_at is null or u.last_active_at < cov.we - interval '365 days') as dormant365
  from n join users u on u.id = n.user_id cross join cov
)
select
  coalesce(sum(c) filter (where dormant30), 0)::bigint as numerator,
  coalesce(sum(c), 0)::bigint as denominator,
  coalesce(sum(c) filter (where dormant365), 0)::bigint as dormant365_count,
  count(*)::int as recipients,
  percentile_cont(0.9) within group (order by c) as p90_raw,
  (select extract(epoch from cov.we - cov.ds) / 86400.0 from cov) as coverage_days
from j`,
    transform: rows => {
      const r = rows[0] || {}
      const numerator = num(r.numerator)
      const denominator = num(r.denominator)
      const coverageRaw = num(r.coverage_days)
      const coverage = coverageRaw === null ? null : Math.max(0, coverageRaw)
      const covered = coverage !== null && coverage > 0
      const p90Raw = num(r.p90_raw)
      const p90 = p90Raw !== null && covered ? Math.round((p90Raw * 30 / Math.min(coverage, 30)) * 10) / 10 : null
      return {
        value: covered ? share(numerator, denominator) : null,
        numerator,
        denominator,
        ...(covered ? {} : { note: 'No notifications are on record for this window; they are deleted after about a month.' }),
        breakdown: [
          { label: 'Share to people dormant over a year', value: covered ? share(r.dormant365_count, denominator) : null, unit: 'percent' },
          { label: 'Rows to people dormant over a year', value: num(r.dormant365_count), unit: 'count' },
          { label: 'People receiving push or email', value: num(r.recipients), unit: 'count' },
          { label: 'Push and email per recipient, 90th percentile (per 30 days)', value: p90, unit: 'count' },
          { label: 'Days of data', value: coverage !== null ? Math.round(coverage * 10) / 10 : null, unit: 'days' }
        ]
      }
    },
    headline: data => ({ value: data.value, previous: null, period: 'trailing 30 days' })
  },
  {
    id: 'new_member_notification_turndown',
    label: 'New members turning notifications down',
    definition: 'Monthly cohorts of active memberships (people joining a group or space), for the last 12 complete months whose members have all had at least 7 days, starting no earlier than April 2025. For each cohort, the share whose current settings turn at least one thing down: post notifications not set to "all", digest set to "never", email off, or push off. Also shows the share that turned off both email and push.',
    whyItMatters: 'This is a revealed-preference signal that the "all" post-notification default is over-sending. A rising share means new members are pushing back on the volume.',
    display: 'cohort',
    unit: 'percent',
    goodDirection: 'down',
    vital: false,
    comparable: false,
    notes: 'Uses current settings, because settings have no change history, so older cohorts have had longer to turn things down than younger ones. Cohorts before April 2025 are left out: memberships created before then may still carry the older "important" post-notification default, which this metric would wrongly count as a turn-down. Space memberships are counted on their own, since each has its own notification settings. For privacy, cohorts with fewer than 5 memberships are hidden, and a share is hidden when it would reveal a group of 1 to 4 memberships (on either side of the split). Months are cut in UTC.',
    sql: `
with p as (
  select greatest(date_trunc('month', (:asOf::timestamptz at time zone 'UTC') - interval '7 days') - interval '12 months', ${DEFAULT_ALL_FROM}) as first_m,
         date_trunc('month', (:asOf::timestamptz at time zone 'UTC') - interval '7 days') as end_m
), b as (
  select generate_series(p.first_m, p.end_m - interval '1 month', interval '1 month') as bucket
  from p
), m as (
  select date_trunc('month', gm.created_at at time zone 'UTC') as bucket,
         (gm.settings->>'postNotifications' is distinct from 'all'
          or gm.settings->>'digestFrequency' = 'never'
          or gm.settings->>'sendEmail' = 'false'
          or gm.settings->>'sendPushNotifications' = 'false') as turned_down,
         (gm.settings->>'sendEmail' = 'false' and gm.settings->>'sendPushNotifications' = 'false') as both_off
  from group_memberships gm
  join groups g on g.id = gm.group_id and g.active
  join users u on u.id = gm.user_id and u.active and u.id <> ${AXOLOTL_ID}
  cross join p
  where gm.active
    and gm.created_at >= p.first_m at time zone 'UTC'
    and gm.created_at < p.end_m at time zone 'UTC'
    and gm.created_at < :asOf::timestamptz - interval '168 hours'
)
select to_char(b.bucket, 'YYYY-MM-DD') as bucket,
       count(m.bucket)::int as size,
       count(m.bucket) filter (where m.turned_down)::int as turned_down,
       count(m.bucket) filter (where m.both_off)::int as both_off
from b left join m on m.bucket = b.bucket
group by b.bucket
order by b.bucket`,
    transform: rows => ({
      columns: ['Any turned down', 'Email + push off'],
      rows: rows.map(r => {
        const size = num(r.size)
        const ok = size >= MIN_CELL
        // Hide a share when the count it reveals, or its complement, is 1-4 memberships.
        const safeShare = n => {
          const c = num(n)
          return ok && !isSmall(c) && !isSmall(size - c) ? share(c, size) : null
        }
        return {
          label: r.bucket,
          size: ok ? size : null,
          values: [safeShare(r.turned_down), safeShare(r.both_off)]
        }
      })
    }),
    // Settings are current, so the newest cohort has had the least time to turn things down.
    // Comparing it with the one before would read that censoring as improvement.
    headline: data => {
      const last = data.rows[data.rows.length - 1]
      if (!last || typeof last.values[0] !== 'number') return null
      const month = new Date(last.label + 'T00:00:00Z').toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
      return { value: last.values[0], previous: null, period: `joined ${month}` }
    }
  },
  {
    id: 'unsubscribe_all_leak',
    label: 'Unsubscribe-all users still receiving push or email',
    definition: 'Among people who chose "unsubscribe from all" (direct message, comment and post notifications all off and digest set to never), the number who got at least one push or email in the trailing 30 days that is attributable to a membership where that channel is still on. A membership counts when it is in one of the groups the notification system checks for that activity (the post\'s groups, the commented post\'s groups, or the activity\'s group). Email rows count only when the email sender actually sends them: comment email rows are left out, because the comment digest honours the unsubscribe. Also shows how many unsubscribed people are still exposed today (at least one membership with email or push on). Both figures use active memberships in active groups and spaces. The target is 0.',
    whyItMatters: 'People who unsubscribed from everything expect to hear nothing more, so any push or email that reaches them should be traced to its cause.',
    display: 'kpi',
    unit: 'count',
    goodDirection: 'down',
    vital: false,
    comparable: false,
    notes: 'A lower bound on attributable leaks. Settings and group memberships are current, so sends before someone unsubscribed during the window are only counted when a membership still has that channel on today, and this is accurate only when asOf is close to now. Notifications are deleted after about a month, so an older asOf finds few or none. All figures are platform-wide totals, so small counts are not suppressed.',
    sql: `
with unsub as (
  select u.id
  from users u
  where u.active and u.id <> ${AXOLOTL_ID}
    and u.created_at < :asOf::timestamptz
    and u.settings->>'dm_notifications' = 'none'
    and u.settings->>'comment_notifications' = 'none'
    and u.settings->>'digest_frequency' = 'never'
    and u.settings->>'post_notifications' = 'none'
), leaked as (
  select n.user_id, n.medium
  from notifications n
  join unsub on unsub.id = n.user_id
  join activities a on a.id = n.activity_id
  where n.medium in (1, 2)
    and n.created_at >= :asOf::timestamptz - interval '30 days'
    and n.created_at < :asOf::timestamptz
    and exists (
      select 1 from group_memberships gm
      join groups g on g.id = gm.group_id and g.active
      where gm.user_id = n.user_id and gm.active
        and ${activityGroupMatch('a', 'gm.group_id')}
        and ((n.medium = 2 and gm.settings->>'sendEmail' = 'true')
          or (n.medium = 1 and gm.settings->>'sendPushNotifications' = 'true')))
    and (n.medium = 1 or ${isDispatchableEmail("a.meta->'reasons'")})
)
select
  (select count(distinct user_id) from leaked)::int as value,
  (select count(*) from unsub)::int as unsubscribed_users,
  (select count(*) from unsub where exists (
     select 1 from group_memberships gm join groups g on g.id = gm.group_id and g.active
     where gm.user_id = unsub.id and gm.active
       and (gm.settings->>'sendEmail' = 'true' or gm.settings->>'sendPushNotifications' = 'true')))::int as users_currently_exposed,
  (select count(*) from leaked where medium = 1)::int as leaked_push,
  (select count(*) from leaked where medium = 2)::int as leaked_email,
  (select count(distinct user_id) from leaked where medium = 1)::int as users_leaked_push,
  (select count(distinct user_id) from leaked where medium = 2)::int as users_leaked_email`,
    transform: rows => {
      const r = rows[0] || {}
      return {
        value: num(r.value),
        numerator: num(r.value),
        denominator: num(r.unsubscribed_users),
        breakdown: [
          { label: 'People who unsubscribed from all', value: num(r.unsubscribed_users), unit: 'count' },
          { label: 'Still exposed today (a membership with email or push on)', value: num(r.users_currently_exposed), unit: 'count' },
          { label: 'Attributable push notifications', value: num(r.leaked_push), unit: 'count' },
          { label: 'Attributable emails', value: num(r.leaked_email), unit: 'count' },
          { label: 'People with attributable push', value: num(r.users_leaked_push), unit: 'count' },
          { label: 'People with attributable email', value: num(r.users_leaked_email), unit: 'count' }
        ]
      }
    },
    headline: data => ({ value: data.value, previous: null, period: 'trailing 30 days' })
  },
  {
    id: 'ignored_email_preferences',
    label: 'Account email turn-downs not matched in group settings',
    definition: 'The number of people whose account-level settings turn email down (digest set to "never" or "weekly", or post notifications set to "none") but who still have at least one active membership sending a daily email digest. A point-in-time count, not windowed.',
    whyItMatters: 'Account-level and group-level email settings should agree. People counted here turned email down for their account but still have a group membership set to a daily digest. The target is 0.',
    display: 'kpi',
    unit: 'count',
    goodDirection: 'down',
    vital: false,
    comparable: false,
    notes: 'Only memberships in active groups and spaces count, because inactive groups send no digest. Both counts are platform-wide totals, so small counts are not suppressed.',
    sql: `
with t as (
  select u.id
  from users u
  where u.active and u.id <> ${AXOLOTL_ID}
    and u.created_at < :asOf::timestamptz
    and (u.settings->>'digest_frequency' in ('never', 'weekly')
         or u.settings->>'post_notifications' = 'none')
)
select
  count(*) filter (where exists (
    select 1
    from group_memberships gm
    join groups g on g.id = gm.group_id and g.active
    where gm.user_id = t.id
      and gm.active
      and gm.created_at < :asOf::timestamptz
      and gm.settings->>'digestFrequency' = 'daily'
      and gm.settings->>'sendEmail' = 'true'
  ))::int as value,
  count(*)::int as users_with_user_level_turndown
from t`,
    transform: rows => {
      const r = rows[0] || {}
      const value = num(r.value)
      const denominator = num(r.users_with_user_level_turndown)
      return {
        value,
        numerator: value,
        denominator,
        breakdown: [
          { label: 'People with an account-level email turn-down', value: denominator, unit: 'count' },
          { label: 'Share still getting a daily digest', value: share(value, denominator), unit: 'percent' }
        ]
      }
    }
  },
  {
    id: 'notification_pipeline_integrity',
    label: 'Notification pipeline integrity',
    definition: 'Checks over notifications created in the trailing 30 days: email rows whose highest-priority reason is neither handled by the email sender nor a comment reason delivered by the comment digest (true anomalies, marked sent but never dispatched); comment email rows, which are expected to go out through the comment digest instead (informational); push notifications that failed and were never delivered; push notifications that failed once and then succeeded on retry; and rows of any kind still unsent and unfailed more than an hour after creation.',
    whyItMatters: 'These catch silent delivery breakage. Anomalies, unrecovered push failures and stuck rows should all stay near 0.',
    display: 'table',
    unit: 'percent',
    goodDirection: 'down',
    vital: false,
    comparable: false,
    notes: 'The reason priority order and the list of reasons the email sender handles are hard-coded copies of Notification.priorityReason and Notification.sendEmail, and must be updated when those change. Rows are counted whether or not email sending is switched on in that environment. All counts are platform-wide totals, so small counts are not suppressed.',
    sql: `
with w as not materialized (
  select n.id, n.medium, n.activity_id, n.sent_at, n.failed_at, n.created_at
  from notifications n
  where n.created_at >= :asOf::timestamptz - interval '30 days'
    and n.created_at < :asOf::timestamptz
), lbl(l, o) as (
  select * from unnest(array[${sqlList(PRIORITY_LABELS)}]) with ordinality
), e as materialized (
  select w.id, (select a.meta->'reasons' from activities a where a.id = w.activity_id) as reasons
  from w
  where w.medium = 2
), email_reason as (
  select e.id, min(lbl.o) as o
  from e
  cross join lateral jsonb_array_elements_text(${reasonsArray('e.reasons')}) r(x)
  join lbl on left(r.x, length(lbl.l)) = lbl.l
  group by e.id
), cls as (
  select
    count(*) filter (where lbl.l in (${sqlList(EMAIL_VIA_DIGEST)})) as digest_path,
    count(*) filter (where lbl.l in (${sqlList(EMAIL_HANDLED)})) as dispatched
  from email_reason er
  join lbl on lbl.o = er.o
), agg as (
  select
    count(*) filter (where medium = 2) as email_rows,
    count(*) filter (where medium = 1 and failed_at is not null and sent_at is null) as push_failed,
    count(*) filter (where medium = 1 and failed_at is not null and sent_at is not null) as push_recovered,
    count(*) filter (where medium = 1) as push_rows,
    count(*) filter (where sent_at is null and failed_at is null and created_at < :asOf::timestamptz - interval '1 hour') as stuck,
    count(*) as all_rows
  from w
)
select v.check_id, v.numerator::bigint as numerator, v.denominator::bigint as denominator
from agg cross join cls, lateral (values
  ('email_undispatched', agg.email_rows - cls.dispatched - cls.digest_path, agg.email_rows, 1),
  ('email_comment_via_digest', cls.digest_path, agg.email_rows, 2),
  ('push_failed', agg.push_failed, agg.push_rows, 3),
  ('push_recovered', agg.push_recovered, agg.push_rows, 4),
  ('stuck_unsent', agg.stuck, agg.all_rows, 5)
) v(check_id, numerator, denominator, ord)
order by v.ord`,
    transform: rows => {
      const labels = {
        email_undispatched: 'Email rows with no send path (anomalies)',
        email_comment_via_digest: 'Comment email rows sent by the comment digest (expected)',
        push_failed: 'Push failed and never delivered',
        push_recovered: 'Push failed, then delivered on retry',
        stuck_unsent: 'Rows unsent more than an hour after creation'
      }
      const scope = {
        email_undispatched: 'Email rows',
        email_comment_via_digest: 'Email rows',
        push_failed: 'Push rows',
        push_recovered: 'Push rows',
        stuck_unsent: 'All rows'
      }
      return {
        columns: [
          { key: 'check', label: 'Check' },
          { key: 'rate', label: 'Rate', unit: 'percent' },
          { key: 'count', label: 'Rows', unit: 'count' },
          { key: 'outOf', label: 'Out of', unit: 'count' },
          { key: 'scope', label: 'Scope' }
        ],
        rows: rows.map(r => ({
          check: labels[r.check_id] || r.check_id,
          rate: share(r.numerator, r.denominator),
          count: num(r.numerator),
          outOf: num(r.denominator),
          scope: scope[r.check_id] || null
        }))
      }
    },
    headline: data => {
      const row = data.rows[0]
      return row && typeof row.rate === 'number' ? { value: row.rate, previous: null, period: 'email rows with no send path, trailing 30 days' } : null
    }
  }
]
