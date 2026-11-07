import { AXOLOTL_ID } from '../sql'

export const section = {
  id: 'stewards',
  title: 'Stewardship and safety',
  question: 'Are stewards present and responsive, and do groups feel safe?'
}

// Cells that describe fewer than this many people (or requests/reports) are suppressed.
const MIN_CELL = 5

const num = v => (v === null || v === undefined ? null : Number(v))

// Maps every active group to the group it rolls up to: spaces count toward their parent.
const GMAP = `gmap as (
  select id as gid, case when type = 'space' then parent_id else id end as tgt
  from groups
  where active
)`

// Active groups: active, non-space, created before asOf, at least 2 active human
// memberships, and at least 1 active non-thread human post in the trailing 90 days
// (posts in the group's spaces count toward the parent group).
const ACTIVE_GROUPS = `members as (
  select gm.group_id, count(*) as n
  from group_memberships gm
  join users u on u.id = gm.user_id and u.active and u.id <> ${AXOLOTL_ID}
  where gm.active and gm.created_at < :asOf
  group by gm.group_id
), posting as (
  select distinct gmap.tgt as group_id
  from groups_posts gp
  join gmap on gmap.gid = gp.group_id
  join posts p on p.id = gp.post_id
  join users pu on pu.id = p.user_id and pu.active and pu.id <> ${AXOLOTL_ID}
  where p.active and p.type <> 'thread'
    and p.created_at >= :asOf - interval '90 days'
    and p.created_at < :asOf
), ag as (
  select g.id
  from groups g
  join members m on m.group_id = g.id and m.n >= 2
  join posting ps on ps.group_id = g.id
  where g.active and coalesce(g.type, '') <> 'space' and g.created_at < :asOf
)`

// Active human holders of a role that carries one of the given platform responsibilities.
const holders = titles => `
  select gmgr.group_id, gmgr.user_id, u.last_active_at
  from group_memberships_group_roles gmgr
  join groups_roles gr on gr.id = gmgr.group_role_id and gr.active
  join group_roles_responsibilities grr on grr.group_role_id = gr.id
  join responsibilities r on r.id = grr.responsibility_id and r.type = 'system' and r.group_id is null
       and r.title in (${titles.map(t => `'${t}'`).join(', ')})
  join group_memberships gm on gm.group_id = gmgr.group_id and gm.user_id = gmgr.user_id and gm.active
  join users u on u.id = gmgr.user_id and u.active and u.id <> ${AXOLOTL_ID}
  where gmgr.active`

// A join request is pending at asOf if it is still status 0, or was decided/canceled on or after asOf.
const PENDING_AT_AS_OF = '(jr.status = 0 or jr.updated_at >= :asOf)'

export const metrics = [
  {
    id: 'tended_groups_share',
    label: 'Tended active groups',
    definition: 'Share of active groups that are tended right now. Active groups are active, non-space groups with at least 2 active human members and at least 1 active non-thread human post in the last 90 days (posts in a group\'s spaces count toward the group). A group is tended when it has at least 1 administrator active in the last 30 days (an active member holding an active role that carries the Administration responsibility) and no join request from an active person left pending for more than 7 days.',
    whyItMatters: 'It combines steward presence and responsiveness in the places where people actually are.',
    display: 'kpi',
    unit: 'percent',
    goodDirection: 'up',
    vital: true,
    comparable: false,
    notes: 'Point-in-time: administrator activity comes from users.last_active_at, which only holds the latest visit, so past dates cannot be rebuilt until daily snapshots exist. Administrators are identified by the Administration responsibility, not by role name, so custom roles that carry it count. Join requests to spaces roll up to the parent group; requests from deactivated accounts and the Axolotl bot are ignored. Values are counts of groups, not people, so no small-cell suppression applies.',
    sql: `with ${GMAP}, ${ACTIVE_GROUPS}, admin_ok as (
  select distinct h.group_id
  from (${holders(['Administration'])}) h
  where h.group_id in (select id from ag)
    and h.last_active_at >= :asOf - interval '30 days'
), stale as (
  select distinct gmap.tgt as group_id
  from join_requests jr
  join gmap on gmap.gid = jr.group_id
  join users ru on ru.id = jr.user_id and ru.active and ru.id <> ${AXOLOTL_ID}
  where gmap.tgt in (select id from ag)
    and jr.created_at < :asOf - interval '7 days'
    and ${PENDING_AT_AS_OF}
)
select count(*) filter (where a.group_id is not null and s.group_id is null) as numerator,
       count(*) as denominator,
       count(*) filter (where a.group_id is not null) as with_active_admin,
       count(*) filter (where s.group_id is null) as no_stale_request
from ag
left join admin_ok a on a.group_id = ag.id
left join stale s on s.group_id = ag.id`,
    transform: rows => {
      const r = rows[0] || {}
      const denominator = num(r.denominator) || 0
      const share = n => (denominator > 0 ? num(n) / denominator : null)
      return {
        value: share(r.numerator),
        numerator: num(r.numerator),
        denominator,
        breakdown: [
          { label: 'Have an administrator active in the last 30 days', value: share(r.with_active_admin), unit: 'percent' },
          { label: 'Have no join request pending over 7 days', value: share(r.no_stale_request), unit: 'percent' }
        ]
      }
    }
  },
  {
    id: 'join_request_decision_time',
    label: 'Join request time to decision',
    definition: 'For join requests accepted or rejected in each week (weeks start Monday, UTC, bucketed by decision time): the median and 90th percentile hours from request to decision, and the share decided within 48 hours. Last 26 weeks. Counts requests from active human accounts to any group that has not been deactivated, including dormant ones (requests to spaces count toward the parent group). Canceled requests are excluded.',
    whyItMatters: 'Most people who ask to join decide within the first day whether a place is alive.',
    display: 'series',
    unit: 'hours',
    goodDirection: 'down',
    vital: false,
    notes: 'The decision time is approximated by the request\'s updated_at, so any later edit of a decided request would inflate it. Weekly 90th percentiles are noisy because weekly decision counts are small; the decisions line shows n. Weeks with fewer than 5 decisions have their median, 90th percentile and 48-hour share suppressed; the decisions count is a platform-wide total and is always shown.',
    sql: `with ${GMAP}, weeks as (
  select generate_series(date_trunc('week', :asOf at time zone 'UTC') - interval '25 weeks',
                         date_trunc('week', :asOf at time zone 'UTC'), interval '1 week') as bucket
), d as (
  select date_trunc('week', jr.updated_at at time zone 'UTC') as bucket,
         extract(epoch from (jr.updated_at - jr.created_at)) / 3600.0 as hours
  from join_requests jr
  join gmap on gmap.gid = jr.group_id
  join groups g on g.id = gmap.tgt and g.active and coalesce(g.type, '') <> 'space'
  join users u on u.id = jr.user_id and u.active and u.id <> ${AXOLOTL_ID}
  where jr.status in (1, 2)
    and jr.updated_at >= (date_trunc('week', :asOf at time zone 'UTC') - interval '25 weeks') at time zone 'UTC'
    and jr.updated_at < :asOf
    and jr.created_at <= jr.updated_at
), agg as (
  select w.bucket,
         percentile_cont(0.5) within group (order by d.hours) as median_hours,
         percentile_cont(0.9) within group (order by d.hours) as p90_hours,
         count(d.hours) filter (where d.hours <= 48) as within_48h,
         count(d.hours) as decided
  from weeks w
  left join d on d.bucket = w.bucket
  group by w.bucket
)
select to_char(bucket, 'YYYY-MM-DD') as bucket,
       case when decided >= ${MIN_CELL} then round(median_hours::numeric, 1) end as median_hours,
       case when decided >= ${MIN_CELL} then round(p90_hours::numeric, 1) end as p90_hours,
       case when decided >= ${MIN_CELL} then round(within_48h::numeric / decided, 4) end as share_within_48h,
       decided
from agg
order by bucket`,
    transform: rows => ({
      granularity: 'week',
      x: rows.map(r => r.bucket),
      lines: [
        { key: 'median_hours', label: 'Median hours to decision', values: rows.map(r => num(r.median_hours)), primary: true, unit: 'hours' },
        { key: 'p90_hours', label: '90th percentile hours', values: rows.map(r => num(r.p90_hours)), unit: 'hours' },
        { key: 'share_within_48h', label: 'Decided within 48 hours', values: rows.map(r => num(r.share_within_48h)), unit: 'percent' },
        { key: 'decided', label: 'Decisions', values: rows.map(r => num(r.decided)), unit: 'count' }
      ],
      partialLast: true
    })
  },
  {
    id: 'join_requests_unanswered_7d',
    label: 'Join requests unanswered after 7 days',
    definition: 'Monthly cohorts of join requests by creation month (UTC), from active human requesters to active groups (the same definition as Tended active groups: at least 2 active human members and a human post in the last 90 days; requests to spaces count toward the parent group). For each cohort: the share still pending as of the report date, and the share accepted or rejected within 7 days. Only cohorts whose every request is at least 7 days old are shown (the last 12 such months), so the current month usually does not appear yet. Requests to dormant groups are excluded; see Stale join-request backlog.',
    whyItMatters: 'Stewards rarely reject requests, so a pending request is almost always an ignored one. Most requests still pending platform-wide sit in dormant groups, a separate problem covered by Stale join-request backlog.',
    display: 'cohort',
    unit: 'percent',
    goodDirection: 'down',
    vital: false,
    notes: 'Active groups are evaluated at the report date, not at each cohort\'s month, so a group that went dormant since drops out of every cohort. Still pending is censored: older cohorts have had longer to be answered, so their pending share can only fall over time; the headline therefore shows only the latest cohort, with no previous value. Canceled requests count in the cohort size but in neither share. Decision time is approximated by updated_at. Cohorts with fewer than 5 requests are suppressed; within a shown cohort, shares are platform-wide totals and are not suppressed for small counts.',
    sql: `with ${GMAP}, ${ACTIVE_GROUPS}, months as (
  select generate_series(date_trunc('month', (:asOf at time zone 'UTC') - interval '7 days') - interval '12 months',
                         date_trunc('month', (:asOf at time zone 'UTC') - interval '7 days') - interval '1 month',
                         interval '1 month') as bucket
), jr as (
  select date_trunc('month', jr.created_at at time zone 'UTC') as bucket,
         ${PENDING_AT_AS_OF} as pending_at_asof,
         (jr.status in (1, 2) and jr.updated_at < :asOf
          and jr.updated_at - jr.created_at <= interval '7 days') as decided_7d
  from join_requests jr
  join gmap on gmap.gid = jr.group_id
  join ag on ag.id = gmap.tgt
  join users u on u.id = jr.user_id and u.active and u.id <> ${AXOLOTL_ID}
  where jr.created_at >= :asOf - interval '14 months'
    and jr.created_at < :asOf
)
select to_char(m.bucket, 'YYYY-MM-DD') as bucket,
       count(jr.bucket) as requests,
       count(jr.bucket) filter (where jr.pending_at_asof) as pending,
       count(jr.bucket) filter (where jr.decided_7d) as decided_7d
from months m
left join jr on jr.bucket = m.bucket
group by m.bucket
order by m.bucket`,
    transform: rows => ({
      columns: ['Still pending', 'Decided within 7 days'],
      columnDirections: ['down', 'up'],
      rows: rows.map(r => {
        const size = num(r.requests)
        const ok = size >= MIN_CELL
        return {
          label: r.bucket,
          size: ok ? size : null,
          values: [ok ? num(r.pending) / size : null, ok ? num(r.decided_7d) / size : null]
        }
      })
    }),
    // "Still pending" is censored: older cohorts have had longer to be answered, so
    // comparing the latest cohort with the one before would mislead. Report only the
    // latest reading.
    headline: data => {
      const rows = data.rows.filter(r => typeof r.values[0] === 'number')
      const last = rows[rows.length - 1]
      if (!last) return null
      const month = new Date(`${last.label}T00:00:00Z`).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
      return { value: last.values[0], previous: null, period: `${month} requests, still pending at report date` }
    }
  },
  {
    id: 'stale_join_request_backlog',
    label: 'Stale join-request backlog',
    definition: 'Join requests from active humans left pending for more than 7 days in active groups (the same definition as Tended active groups: at least 2 active human members and a human post in the last 90 days; requests to spaces count toward the parent group). The breakdown splits them by age, counts the groups holding them, and gives the share sitting in groups with no Administration or Add Members holder active in the last 30 days. Stale requests in dormant groups are shown separately.',
    whyItMatters: 'Every one of these is a motivated newcomer lost at the door of a group that is otherwise alive. Most of the platform-wide backlog sits in dormant groups, which is a different problem (abandoned groups still accepting requests).',
    display: 'kpi',
    unit: 'count',
    goodDirection: 'down',
    vital: false,
    comparable: false,
    notes: 'Point-in-time: steward activity comes from users.last_active_at, which only holds the latest visit. Dormant groups are active, non-space groups outside the active-group definition. All values are platform-wide totals, so small counts are shown rather than suppressed.',
    sql: `with ${GMAP}, ${ACTIVE_GROUPS}, stale as (
  select gmap.tgt as group_id,
         jr.created_at >= :asOf - interval '90 days' as recent,
         gmap.tgt in (select id from ag) as in_active_group
  from join_requests jr
  join gmap on gmap.gid = jr.group_id
  join groups g on g.id = gmap.tgt and g.active and coalesce(g.type, '') <> 'space'
  join users u on u.id = jr.user_id and u.active and u.id <> ${AXOLOTL_ID}
  where jr.created_at < :asOf - interval '7 days'
    and ${PENDING_AT_AS_OF}
), stewarded as (
  select distinct h.group_id
  from (${holders(['Administration', 'Add Members'])}) h
  where h.group_id in (select group_id from stale where in_active_group)
    and h.last_active_at >= :asOf - interval '30 days'
)
select count(*) filter (where s.in_active_group) as value,
       count(*) filter (where s.in_active_group and s.recent) as recent_90d,
       count(*) filter (where s.in_active_group and not s.recent) as older,
       count(distinct s.group_id) filter (where s.in_active_group) as groups,
       count(*) filter (where s.in_active_group and st.group_id is null) as in_unstewarded_groups,
       count(*) filter (where not s.in_active_group) as in_dormant_groups,
       count(distinct s.group_id) filter (where not s.in_active_group) as dormant_groups
from stale s
left join stewarded st on st.group_id = s.group_id`,
    transform: rows => {
      const r = rows[0] || {}
      const value = num(r.value) || 0
      return {
        value,
        breakdown: [
          { label: 'From the last 90 days', value: num(r.recent_90d), unit: 'count' },
          { label: 'Older than 90 days', value: num(r.older), unit: 'count' },
          { label: 'Active groups holding them', value: num(r.groups), unit: 'count' },
          { label: 'Share in groups with no steward active in 30 days', value: value > 0 ? num(r.in_unstewarded_groups) / value : null, unit: 'percent' },
          { label: 'Stale requests in dormant groups (not in the total)', value: num(r.in_dormant_groups), unit: 'count' },
          { label: 'Dormant groups holding them', value: num(r.dormant_groups), unit: 'count' }
        ]
      }
    }
  },
  {
    id: 'steward_coverage',
    label: 'Steward coverage of active groups',
    definition: 'Groups split by how many administrators they have (active human members holding an active role with the Administration responsibility, regardless of recent activity): none (orphaned), exactly 1 (bus factor 1), or 2 or more. Shown as two rows: active groups (the same definition as Tended active groups, with space posts counting toward the parent group) and all active non-space groups with at least 2 active human members. Shares are within each row.',
    whyItMatters: 'If a group\'s only steward burns out, the group is orphaned.',
    display: 'table',
    unit: 'percent',
    goodDirection: 'up',
    vital: false,
    comparable: false,
    notes: 'One row per population; each share is within its own row (the three shares in a row sum to 100%), and the two rows overlap, so do not add them. The headline is the share of active groups with 2 or more administrators. Administrator counts ignore recent activity; see Tended active groups for presence. Point-in-time: roles and memberships reflect their current state, so a past date does not reproduce history. Values count groups, not people.',
    sql: `with ${GMAP}, ${ACTIVE_GROUPS}, multi as (
  select g.id
  from groups g
  join members m on m.group_id = g.id and m.n >= 2
  where g.active and coalesce(g.type, '') <> 'space' and g.created_at < :asOf
), admins as (
  select h.group_id, count(distinct h.user_id) as n
  from (${holders(['Administration'])}) h
  group by h.group_id
), pop as (
  select 'active' as population, coalesce(a.n, 0) as n
  from ag left join admins a on a.group_id = ag.id
  union all
  select 'multi', coalesce(a.n, 0)
  from multi left join admins a on a.group_id = multi.id
)
select population,
       count(*) filter (where n = 0) as none,
       count(*) filter (where n = 1) as one,
       count(*) filter (where n >= 2) as two_plus,
       count(*) as total
from pop
group by population`,
    transform: rows => {
      const pops = [
        { key: 'active', name: 'Active groups' },
        { key: 'multi', name: 'All groups with 2+ members' }
      ]
      // The card shows the total and the three shares so it fits a half-width card; rows keep the counts too
      return {
        columns: [
          { key: 'population', label: 'Groups' },
          { key: 'total', label: 'Total', unit: 'count' },
          { key: 'none_share', label: 'No admin', unit: 'percent' },
          { key: 'one_share', label: '1 admin', unit: 'percent' },
          { key: 'two_plus_share', label: '2+ admins', unit: 'percent' }
        ],
        rows: pops.map(p => {
          const r = rows.find(row => row.population === p.key) || {}
          const total = num(r.total) || 0
          const share = k => (total > 0 ? (num(r[k]) || 0) / total : null)
          return {
            population: p.name,
            total,
            none: num(r.none) || 0,
            none_share: share('none'),
            one: num(r.one) || 0,
            one_share: share('one'),
            two_plus: num(r.two_plus) || 0,
            two_plus_share: share('two_plus')
          }
        })
      }
    },
    // Point-in-time role state: no comparable previous reading exists.
    headline: data => {
      const active = data.rows.find(r => r.population === 'Active groups')
      return active && typeof active.two_plus_share === 'number'
        ? { value: active.two_plus_share, previous: null, period: 'active groups with 2+ administrators, current roles' }
        : null
    }
  },
  {
    id: 'moderation_health',
    label: 'Moderation backlog and report rate',
    definition: 'Open reports are reports not yet cleared whose post is still active and whose group has not been deactivated (dormant groups included); the table shows how many are older than 7 days and their median age. Uncleared reports whose post was removed, or that have no group or belong to a deactivated group, are counted separately and are not open reports. It also shows the median time to clear for reports cleared in the last 12 months, reports per 1,000 non-thread posts by humans in the last 90 days, and new blocks in the last 90 days.',
    whyItMatters: 'An abandoned report tells the reporter that no one is watching. Volumes are very low, so absolute counts are shown.',
    display: 'table',
    unit: 'count',
    goodDirection: 'down',
    vital: false,
    notes: 'Clear time is approximated by the report\'s updated_at. Medians over fewer than 5 reports are suppressed. Reports and blocks are not filtered by user status, and the report-rate numerator counts every report, including reports on posts later removed, while the denominator counts only active non-thread posts by active humans. All counts are platform-wide totals, so small counts (for example a handful of blocks) are shown rather than suppressed.',
    sql: `with open_r as (
  select extract(epoch from (:asOf - ma.created_at)) / 86400.0 as age_days,
         (coalesce(p.active, false) and g.id is not null) as actionable
  from moderation_actions ma
  left join posts p on p.id = ma.post_id
  left join groups g on g.id = ma.group_id and g.active
  where ma.created_at < :asOf
    and (ma.status = 'active' or (ma.status = 'cleared' and ma.updated_at >= :asOf))
), cleared as (
  select extract(epoch from (ma.updated_at - ma.created_at)) / 86400.0 as days
  from moderation_actions ma
  where ma.status = 'cleared'
    and ma.updated_at >= :asOf - interval '12 months'
    and ma.updated_at < :asOf
), reports_90 as (
  select count(*) as n from moderation_actions ma
  where ma.created_at >= :asOf - interval '90 days' and ma.created_at < :asOf
), reports_12m as (
  select count(*) as n from moderation_actions ma
  where ma.created_at >= :asOf - interval '12 months' and ma.created_at < :asOf
), posts_90 as (
  select count(*) as n from posts p
  join users u on u.id = p.user_id and u.active and u.id <> ${AXOLOTL_ID}
  where p.active and p.type <> 'thread'
    and p.created_at >= :asOf - interval '90 days' and p.created_at < :asOf
), blocks_90 as (
  select count(*) as n from blocked_users b
  where b.created_at >= :asOf - interval '90 days' and b.created_at < :asOf
)
select
  (select count(*) from open_r where actionable and age_days > 7) as open_over_7d,
  (select count(*) from open_r where actionable) as open_total,
  (select case when count(*) >= ${MIN_CELL} then round((percentile_cont(0.5) within group (order by age_days))::numeric, 1) end
     from open_r where actionable) as open_median_age_days,
  (select count(*) from open_r where not actionable) as orphaned_open,
  (select count(*) from cleared) as cleared_12m,
  (select case when count(*) >= ${MIN_CELL} then round((percentile_cont(0.5) within group (order by days))::numeric, 1) end
     from cleared) as clear_median_days,
  (select n from reports_90) as reports_90d,
  (select n from posts_90) as posts_90d,
  (select round(1000.0 * r.n / nullif(p.n, 0), 2) from reports_90 r, posts_90 p) as reports_per_1000_posts_90d,
  (select n from reports_12m) as reports_12m,
  (select n from blocks_90) as blocks_90d`,
    transform: rows => {
      const r = rows[0] || {}
      const row = (measure, value, unit) => ({ measure, value: num(value), unit })
      return {
        columns: [
          { key: 'measure', label: 'Measure' },
          { key: 'value', label: 'Value' },
          { key: 'unit', label: 'Unit' }
        ],
        rows: [
          row('Open reports older than 7 days', r.open_over_7d, 'count'),
          row('Open reports in total', r.open_total, 'count'),
          row('Median age of open reports', r.open_median_age_days, 'days'),
          row('Uncleared reports on removed posts or in missing or deactivated groups', r.orphaned_open, 'count'),
          row('Reports cleared in the last 12 months', r.cleared_12m, 'count'),
          row('Median time to clear (last 12 months)', r.clear_median_days, 'days'),
          row('Reports in the last 90 days', r.reports_90d, 'count'),
          row('Non-thread posts in the last 90 days', r.posts_90d, 'count'),
          row('Reports per 1,000 posts (last 90 days)', r.reports_per_1000_posts_90d, 'ratio'),
          row('Reports in the last 12 months', r.reports_12m, 'count'),
          row('New blocks in the last 90 days', r.blocks_90d, 'count')
        ]
      }
    },
    headline: data => {
      const open = data.rows.find(r => r.measure === 'Open reports older than 7 days')
      return open && typeof open.value === 'number' ? { value: open.value, previous: null, period: 'open reports older than 7 days' } : null
    }
  }
]
