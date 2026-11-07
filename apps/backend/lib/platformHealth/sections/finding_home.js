import { AXOLOTL_ID } from '../sql'
import { CONTRIBUTION_POSTS, contributionEvents } from '../contributions'

export const section = {
  id: 'finding_home',
  title: 'Arrival and activation',
  question: 'Are new people finding a home, and is growth spreading person to person?'
}

// All week and month buckets are cut in UTC, whatever the database session
// TimeZone is: bucket starts are UTC wall-clock timestamps ("x AT TIME ZONE 'UTC'")
// and are converted back to timestamptz ("bucket AT TIME ZONE 'UTC'") for range
// filters. Fixed windows after an event use hours, not days, so a DST change in
// the session zone cannot stretch or shrink them.

// Cells describing fewer than this many people are suppressed.
const MIN_CELL = 5

// An inviter who creates more invites than this in one UTC day is uploading a
// list, and one upload can outweigh every other invite sent that month.
const BULK_INVITES_PER_DAY = 100

const num = v => (v === null || v === undefined ? null : Number(v))

const share = (numerator, denominator) => {
  const n = num(numerator)
  const d = num(denominator)
  if (n === null || d === null || d < MIN_CELL) return null
  return n / d
}

// A share whose numerator or complement is 1–4 lets a reader holding the
// published denominator recover a count of 1–4 people, so it is hidden.
const peopleShare = (numerator, denominator) => {
  const n = num(numerator)
  const d = num(denominator)
  if (n === null || d === null) return null
  const small = k => k > 0 && k < MIN_CELL
  if (small(n) || small(d - n)) return null
  return share(n, d)
}

const COMPLETED_SIGNUP = `u.active AND u.id <> ${AXOLOTL_ID}
    AND coalesce(u.settings->>'signup_in_progress', 'false') <> 'true'`

// Maps every active group to itself and every active space to its parent group.
const GMAP = `gmap AS (
  SELECT id AS gid, CASE WHEN type = 'space' THEN parent_id ELSE id END AS tgt
  FROM groups WHERE active
)`

const seriesX = rows => rows.map(r => r.bucket)

const cohortRows = (rows, valuesFor) => rows.map(r => ({
  label: r.bucket,
  size: num(r.denominator),
  values: valuesFor(r)
}))

export const metrics = [
  {
    id: 'completed_signups',
    label: 'Completed signups per week',
    definition: 'New accounts created each Monday–Sunday week (UTC) that finished signup, over the last 26 weeks. A second line shows accounts from the same week that are still mid-signup. Both lines exclude the bot and deactivated accounts. This is context for the activation rates below, not a goal.',
    whyItMatters: 'This is top-of-funnel volume. It is never a goal on its own, because signups that never activate almost never come back. It is the denominator for the activation rates in this section.',
    display: 'series',
    unit: 'count',
    goodDirection: 'neutral',
    vital: false,
    notes: 'Deactivated accounts are left out of both lines, and out of past weeks too once they are deactivated, so older weeks can shrink slightly over time. Most abandoned signups are deactivated, so the in-progress line undercounts people who started signing up. Both lines are platform-wide totals, so weeks with fewer than 5 in-progress signups are shown rather than hidden. The current week is partial.',
    sql: `
WITH b AS (
  SELECT generate_series(date_trunc('week', :asOf AT TIME ZONE 'UTC') - interval '25 weeks',
                         date_trunc('week', :asOf AT TIME ZONE 'UTC'), interval '1 week') AS bucket
),
s AS (
  SELECT date_trunc('week', u.created_at AT TIME ZONE 'UTC') AS bucket,
         count(*) FILTER (WHERE coalesce(u.settings->>'signup_in_progress', 'false') <> 'true') AS completed,
         count(*) FILTER (WHERE u.settings->>'signup_in_progress' = 'true') AS in_progress
  FROM users u
  WHERE u.created_at >= ((SELECT min(bucket) FROM b) AT TIME ZONE 'UTC')
    AND u.created_at < :asOf
    AND u.active AND u.id <> ${AXOLOTL_ID}
  GROUP BY 1
)
SELECT to_char(b.bucket, 'YYYY-MM-DD') AS bucket,
       coalesce(s.completed, 0)::int AS completed,
       coalesce(s.in_progress, 0)::int AS in_progress
FROM b LEFT JOIN s USING (bucket)
ORDER BY b.bucket`,
    transform: rows => ({
      granularity: 'week',
      x: seriesX(rows),
      lines: [
        { key: 'completed', label: 'Completed signups', values: rows.map(r => num(r.completed)), primary: true, unit: 'count' },
        { key: 'in_progress', label: 'Still in progress (current status)', values: rows.map(r => num(r.in_progress)), unit: 'count' }
      ],
      partialLast: true
    })
  },
  {
    id: 'signup_joined_group_7d',
    label: 'Signups joining a group within 7 days',
    definition: 'Weekly cohorts of completed signups (UTC weeks, 26 cohorts), counting only cohorts whose members are all at least 7 days old. The main line is the share who joined any group within 7 days of signing up. A second line, where lower is better, is the share not in any group by day 30, shown only for cohorts at least 30 days old. Excludes the bot and deactivated accounts. Joining a space counts as joining its parent group.',
    whyItMatters: 'This is the biggest single retention lever: people who join a group are far more likely to come back than people who never join. Very few never-joiners even file a join request, so the fix is wayfinding.',
    display: 'series',
    unit: 'percent',
    goodDirection: 'up',
    vital: true,
    notes: 'Deactivated accounts are removed from past cohorts retroactively; they rarely joined, so a closed cohort\'s rate can drift up slightly over time. Any membership row counts, even if the person later left or the group was deleted, because it shows they landed somewhere. Rates for cohorts under 5 people are hidden.',
    sql: `
WITH p AS (SELECT (:asOf AT TIME ZONE 'UTC') AS a),
b AS (
  SELECT generate_series(date_trunc('week', a - interval '14 days') - interval '25 weeks',
                         date_trunc('week', a - interval '14 days'), interval '1 week') AS bucket
  FROM p
),
u AS (
  SELECT u.id, u.created_at, date_trunc('week', u.created_at AT TIME ZONE 'UTC') AS bucket
  FROM users u
  WHERE u.created_at >= ((SELECT min(bucket) FROM b) AT TIME ZONE 'UTC')
    AND u.created_at < (((SELECT max(bucket) FROM b) + interval '1 week') AT TIME ZONE 'UTC')
    AND ${COMPLETED_SIGNUP}
),
fj AS (
  SELECT gm.user_id, min(gm.created_at) AS first_join
  FROM group_memberships gm
  JOIN u ON u.id = gm.user_id
  WHERE gm.created_at < :asOf
  GROUP BY gm.user_id
),
agg AS (
  SELECT u.bucket,
         count(*) AS denominator,
         count(*) FILTER (WHERE fj.first_join <= u.created_at + interval '168 hours') AS numerator,
         count(*) FILTER (WHERE fj.first_join IS NULL OR fj.first_join > u.created_at + interval '720 hours') AS not_joined_30d
  FROM u LEFT JOIN fj ON fj.user_id = u.id
  GROUP BY u.bucket
)
SELECT to_char(b.bucket, 'YYYY-MM-DD') AS bucket,
       coalesce(a.numerator, 0)::int AS numerator,
       coalesce(a.denominator, 0)::int AS denominator,
       CASE WHEN b.bucket + interval '37 days' <= p.a THEN coalesce(a.not_joined_30d, 0)::int END AS not_joined_30d
FROM b CROSS JOIN p LEFT JOIN agg a USING (bucket)
ORDER BY b.bucket`,
    transform: rows => ({
      granularity: 'week',
      x: seriesX(rows),
      lines: [
        { key: 'joined_7d', label: 'Joined a group within 7 days', values: rows.map(r => share(r.numerator, r.denominator)), primary: true, unit: 'percent' },
        { key: 'not_joined_30d', label: 'Not in a group by day 30', values: rows.map(r => share(r.not_joined_30d, r.denominator)), unit: 'percent' },
        { key: 'cohort_size', label: 'Cohort size', values: rows.map(r => num(r.denominator)), unit: 'count' }
      ],
      partialLast: false
    })
  },
  {
    id: 'signup_contributed_30d',
    label: 'Signups contributing within 30 days',
    definition: 'Monthly cohorts of completed signups (UTC months, 12 cohorts), counting only cohorts whose members are all at least 30 days old. Reports the share whose first contribution came within 30 days of signing up. A contribution is a non-DM post, a comment, a reaction, an RSVP of yes or interested to someone else\'s event, a proposal vote, or joining someone else\'s project, the same rule as Weekly active contributors. Excludes the bot and deactivated accounts.',
    whyItMatters: 'This is the next activation milestone: people who contribute early are much more likely to come back than people who only join a group.',
    display: 'cohort',
    unit: 'percent',
    goodDirection: 'up',
    vital: false,
    notes: 'Deactivated accounts are removed from past cohorts retroactively, which can nudge a closed cohort\'s rate up over time. Project join and RSVP times are approximate, as in Weekly active contributors. Self-reactions count.',
    sql: `
WITH p AS (SELECT (:asOf AT TIME ZONE 'UTC') AS a),
b AS (
  SELECT generate_series(date_trunc('month', a - interval '30 days') - interval '12 months',
                         date_trunc('month', a - interval '30 days') - interval '1 month', interval '1 month') AS bucket
  FROM p
),
u AS (
  SELECT u.id, u.created_at, date_trunc('month', u.created_at AT TIME ZONE 'UTC') AS bucket
  FROM users u
  WHERE u.created_at >= ((SELECT min(bucket) FROM b) AT TIME ZONE 'UTC')
    AND u.created_at < (((SELECT max(bucket) FROM b) + interval '1 month') AT TIME ZONE 'UTC')
    AND ${COMPLETED_SIGNUP}
),
${CONTRIBUTION_POSTS},
ev AS (${contributionEvents({ userJoin: alias => `JOIN u ON u.id = ${alias}.user_id` })}
),
fc AS (
  SELECT ev.u AS user_id, min(ev.t) AS first_contrib FROM ev WHERE ev.t < :asOf GROUP BY ev.u
),
agg AS (
  SELECT u.bucket,
         count(*) AS denominator,
         count(*) FILTER (WHERE fc.first_contrib <= u.created_at + interval '720 hours') AS numerator
  FROM u LEFT JOIN fc ON fc.user_id = u.id
  GROUP BY u.bucket
)
SELECT to_char(b.bucket, 'YYYY-MM-DD') AS bucket,
       coalesce(a.numerator, 0)::int AS numerator,
       coalesce(a.denominator, 0)::int AS denominator
FROM b LEFT JOIN agg a USING (bucket)
ORDER BY b.bucket`,
    transform: rows => ({
      columns: ['Contributed within 30 days'],
      rows: cohortRows(rows, r => [share(r.numerator, r.denominator)])
    })
  },
  {
    id: 'new_member_contributed_14d',
    label: 'New members contributing in their group within 14 days',
    definition: 'Weekly cohorts of new group memberships (UTC weeks, 26 cohorts), counting only cohorts where every membership is at least 14 days old. Reports the share where the new member posted, commented on a post, or reacted to a post in that group within 14 days of joining. Activity in the group\'s spaces counts for the group. Excludes space memberships, the group\'s creator, the bot, deactivated accounts, deleted groups and DMs.',
    whyItMatters: 'This is activation at group level, and stewards and product can act on it weekly through welcome flows and first-post prompts.',
    display: 'series',
    unit: 'percent',
    goodDirection: 'up',
    vital: false,
    notes: 'Someone who leaves and rejoins keeps their original membership date, so they stay in their first cohort. Reactions count on posts only, not on comments. Activity in spaces (chat, tracks, funding rounds moved there in the July 2026 spaces migration) now counts for the parent group. This raises the rate compared with counting the group alone.',
    sql: `
WITH p AS (SELECT (:asOf AT TIME ZONE 'UTC') AS a),
b AS (
  SELECT generate_series(date_trunc('week', a - interval '21 days') - interval '25 weeks',
                         date_trunc('week', a - interval '21 days'), interval '1 week') AS bucket
  FROM p
),
${GMAP},
m AS MATERIALIZED (
  SELECT gm.id, gm.user_id, gm.group_id, gm.created_at, date_trunc('week', gm.created_at AT TIME ZONE 'UTC') AS bucket
  FROM group_memberships gm
  JOIN groups g ON g.id = gm.group_id
  JOIN users u ON u.id = gm.user_id
  WHERE gm.created_at >= ((SELECT min(bucket) FROM b) AT TIME ZONE 'UTC')
    AND gm.created_at < (((SELECT max(bucket) FROM b) + interval '1 week') AT TIME ZONE 'UTC')
    AND g.active AND g.type IS DISTINCT FROM 'space'
    AND gm.user_id IS DISTINCT FROM g.created_by_id
    AND u.active AND u.id <> ${AXOLOTL_ID}
),
w AS (SELECT min(created_at) AS s, max(created_at) + interval '336 hours' AS e FROM m),
ev AS (
  SELECT p.user_id, p.id AS post_id, p.created_at AS t
  FROM posts p, w
  WHERE p.active AND p.type <> 'thread' AND p.created_at >= w.s AND p.created_at <= w.e
    AND p.user_id IN (SELECT user_id FROM m)
  UNION ALL
  SELECT c.user_id, c.post_id, c.created_at
  FROM comments c, w
  WHERE c.active IS NOT FALSE AND c.created_at >= w.s AND c.created_at <= w.e
    AND c.user_id IN (SELECT user_id FROM m)
  UNION ALL
  SELECT r.user_id, r.entity_id, r.date_reacted
  FROM reactions r, w
  WHERE r.entity_type = 'post' AND r.date_reacted >= w.s AND r.date_reacted <= w.e
    AND r.user_id IN (SELECT user_id FROM m)
),
gev AS MATERIALIZED (
  SELECT DISTINCT ev.user_id, gmap.tgt AS group_id, ev.t
  FROM ev
  JOIN posts p ON p.id = ev.post_id AND p.active AND p.type <> 'thread'
  JOIN groups_posts gp ON gp.post_id = p.id
  JOIN gmap ON gmap.gid = gp.group_id
),
hit AS (
  SELECT DISTINCT m.id
  FROM m JOIN gev ON gev.user_id = m.user_id AND gev.group_id = m.group_id
   AND gev.t >= m.created_at AND gev.t <= m.created_at + interval '336 hours'
),
agg AS (
  SELECT m.bucket, count(*) AS denominator, count(hit.id) AS numerator
  FROM m LEFT JOIN hit ON hit.id = m.id
  GROUP BY m.bucket
)
SELECT to_char(b.bucket, 'YYYY-MM-DD') AS bucket,
       coalesce(a.numerator, 0)::int AS numerator,
       coalesce(a.denominator, 0)::int AS denominator
FROM b LEFT JOIN agg a USING (bucket)
ORDER BY b.bucket`,
    transform: rows => ({
      granularity: 'week',
      x: seriesX(rows),
      lines: [
        { key: 'contributed_14d', label: 'Contributed within 14 days', values: rows.map(r => share(r.numerator, r.denominator)), primary: true, unit: 'percent' },
        { key: 'new_memberships', label: 'New memberships', values: rows.map(r => num(r.denominator)), unit: 'count' }
      ],
      partialLast: false
    })
  },
  {
    id: 'new_groups_second_voice_30d',
    label: 'New groups reaching a second voice in 30 days',
    definition: 'Monthly cohorts of new groups (UTC months, 12 cohorts, spaces and deleted groups excluded), counting only cohorts at least 30 days old. Reports the share where someone other than the group\'s creator posted or commented in the group, or in one of its spaces, within 30 days of creation. The second voice must be an active person, not the bot. A second column, for context, shows the share with no post at all in their first 30 days; lower is better there. Cohort size is the number of new groups that month.',
    whyItMatters: 'Creating a group only counts as growth if two or more people meet there.',
    display: 'cohort',
    unit: 'percent',
    goodDirection: 'up',
    vital: false,
    notes: 'Posts in a group\'s spaces (chat, tracks, funding rounds) count toward the parent group. Content dated before the group was created (moved or cross-posted in) does not count. DMs are excluded.',
    sql: `
WITH p AS (SELECT (:asOf AT TIME ZONE 'UTC') AS a),
b AS (
  SELECT generate_series(date_trunc('month', a - interval '30 days') - interval '12 months',
                         date_trunc('month', a - interval '30 days') - interval '1 month', interval '1 month') AS bucket
  FROM p
),
${GMAP},
g AS (
  SELECT g.id, g.created_at, g.created_by_id, date_trunc('month', g.created_at AT TIME ZONE 'UTC') AS bucket
  FROM groups g
  WHERE g.active AND g.type IS DISTINCT FROM 'space'
    AND g.created_at >= ((SELECT min(bucket) FROM b) AT TIME ZONE 'UTC')
    AND g.created_at < (((SELECT max(bucket) FROM b) + interval '1 month') AT TIME ZONE 'UTC')
),
gpost AS (
  SELECT DISTINCT gmap.tgt AS group_id, p.id AS post_id, p.user_id, p.created_at
  FROM g
  JOIN gmap ON gmap.tgt = g.id
  JOIN groups_posts gp ON gp.group_id = gmap.gid
  JOIN posts p ON p.id = gp.post_id AND p.active AND p.type <> 'thread'
),
voice AS (
  SELECT group_id, user_id, created_at FROM gpost
  UNION ALL
  SELECT gpost.group_id, c.user_id, c.created_at
  FROM comments c JOIN gpost ON gpost.post_id = c.post_id
  WHERE c.active IS NOT FALSE
),
second AS (
  SELECT DISTINCT v.group_id
  FROM voice v
  JOIN g ON g.id = v.group_id
  JOIN users u ON u.id = v.user_id AND u.active AND u.id <> ${AXOLOTL_ID}
  WHERE v.user_id IS DISTINCT FROM g.created_by_id
    AND v.created_at >= g.created_at AND v.created_at <= g.created_at + interval '720 hours'
    AND v.created_at < :asOf
),
anypost AS (
  SELECT DISTINCT gpost.group_id FROM gpost JOIN g ON g.id = gpost.group_id
  WHERE gpost.created_at >= g.created_at AND gpost.created_at <= g.created_at + interval '720 hours'
    AND gpost.created_at < :asOf
),
agg AS (
  SELECT g.bucket, count(*) AS denominator,
         count(*) FILTER (WHERE s.group_id IS NOT NULL) AS numerator,
         count(*) FILTER (WHERE a.group_id IS NULL) AS no_post_30d
  FROM g LEFT JOIN second s ON s.group_id = g.id LEFT JOIN anypost a ON a.group_id = g.id
  GROUP BY g.bucket
)
SELECT to_char(b.bucket, 'YYYY-MM-DD') AS bucket,
       coalesce(a.numerator, 0)::int AS numerator,
       coalesce(a.denominator, 0)::int AS denominator,
       coalesce(a.no_post_30d, 0)::int AS no_post_30d
FROM b LEFT JOIN agg a USING (bucket)
ORDER BY b.bucket`,
    transform: rows => ({
      columns: ['Reached a second voice', 'No post in first 30 days'],
      columnDirections: ['up', 'down'],
      rows: cohortRows(rows, r => [share(r.numerator, r.denominator), share(r.no_post_30d, r.denominator)])
    })
  },
  {
    id: 'groupless_active_users',
    label: 'Recently active users with no group',
    definition: 'Of the people active on Hylo in the 30 days before the report date, the share who are not a current member of any active group. Membership in a space counts as membership in its parent group. Excludes the bot and deactivated accounts. This is a point-in-time reading: treat it as "as of today".',
    whyItMatters: 'These are people who showed up and have nowhere to belong, and they can be routed to the group explorer or to join links.',
    display: 'kpi',
    unit: 'percent',
    goodDirection: 'down',
    vital: false,
    comparable: false,
    notes: 'Only accurate for today: the database keeps just each person\'s latest activity time and current membership status, so a past report date cannot be reconstructed. Includes people still partway through signup. The counts are platform-wide totals.',
    sql: `
WITH ${GMAP},
a AS (
  SELECT u.id,
         NOT EXISTS (
           SELECT 1 FROM group_memberships gm
           JOIN gmap ON gmap.gid = gm.group_id
           JOIN groups pg ON pg.id = gmap.tgt AND pg.active
           WHERE gm.user_id = u.id AND gm.active AND gm.created_at < :asOf
         ) AS groupless
  FROM users u
  WHERE u.active AND u.id <> ${AXOLOTL_ID}
    AND u.last_active_at >= :asOf - interval '720 hours'
    AND u.last_active_at < :asOf
)
SELECT count(*) FILTER (WHERE groupless)::int AS numerator,
       count(*)::int AS denominator
FROM a`,
    transform: rows => {
      const r = rows[0] || {}
      return {
        value: share(r.numerator, r.denominator),
        numerator: num(r.numerator),
        denominator: num(r.denominator)
      }
    },
    // A single trailing-window reading with no comparable earlier value.
    headline: data => (typeof data.value === 'number' ? { value: data.value, previous: null, period: 'last 30 days' } : null)
  },
  {
    id: 'new_memberships_by_source',
    label: 'New memberships by attributable source',
    definition: 'New group memberships per UTC week over the last 26 weeks, split by how the person got in. Email invite: they used an email invite to that group within a day of joining. Approved join request: a join request to that group was approved within a day of joining (and no invite matched). Unattributed: everything else, including join links, access codes, open joins, admin adds and parent-group joins. Excludes space memberships, the group\'s creator, the bot, deactivated accounts and deleted groups.',
    whyItMatters: 'This shows which doors people come through. Most memberships are unattributed today; the gap closes once memberships record their source.',
    display: 'series',
    unit: 'count',
    goodDirection: 'neutral',
    vital: false,
    notes: 'Attribution is inferred by matching timestamps within one day, because memberships have no source column. Someone who leaves and rejoins keeps their original membership date, so rejoins are not counted as new. All lines are platform-wide totals, so small weekly counts (for example 2 or 3 email-invite joins) are shown rather than hidden. The current week is partial.',
    sql: `
WITH b AS (
  SELECT generate_series(date_trunc('week', :asOf AT TIME ZONE 'UTC') - interval '25 weeks',
                         date_trunc('week', :asOf AT TIME ZONE 'UTC'), interval '1 week') AS bucket
),
m AS (
  SELECT gm.id, gm.user_id, gm.group_id, gm.created_at, date_trunc('week', gm.created_at AT TIME ZONE 'UTC') AS bucket
  FROM group_memberships gm
  JOIN groups g ON g.id = gm.group_id
  JOIN users u ON u.id = gm.user_id
  WHERE gm.created_at >= ((SELECT min(bucket) FROM b) AT TIME ZONE 'UTC')
    AND gm.created_at < :asOf
    AND g.active AND g.type IS DISTINCT FROM 'space'
    AND gm.user_id IS DISTINCT FROM g.created_by_id
    AND u.active AND u.id <> ${AXOLOTL_ID}
),
inv AS (
  SELECT DISTINCT m.id
  FROM m JOIN group_invites gi
    ON gi.used_by_id = m.user_id AND gi.group_id = m.group_id
   AND gi.used_at BETWEEN m.created_at - interval '24 hours' AND m.created_at + interval '24 hours'
),
jr AS (
  SELECT DISTINCT m.id
  FROM m JOIN join_requests j
    ON j.user_id = m.user_id AND j.group_id = m.group_id AND j.status = 1
   AND j.updated_at BETWEEN m.created_at - interval '24 hours' AND m.created_at + interval '24 hours'
),
agg AS (
  SELECT m.bucket,
         count(*) AS total,
         count(*) FILTER (WHERE inv.id IS NOT NULL) AS email_invite,
         count(*) FILTER (WHERE inv.id IS NULL AND jr.id IS NOT NULL) AS join_request,
         count(*) FILTER (WHERE inv.id IS NULL AND jr.id IS NULL) AS unattributed
  FROM m LEFT JOIN inv ON inv.id = m.id LEFT JOIN jr ON jr.id = m.id
  GROUP BY m.bucket
)
SELECT to_char(b.bucket, 'YYYY-MM-DD') AS bucket,
       coalesce(a.total, 0)::int AS total,
       coalesce(a.email_invite, 0)::int AS email_invite,
       coalesce(a.join_request, 0)::int AS join_request,
       coalesce(a.unattributed, 0)::int AS unattributed
FROM b LEFT JOIN agg a USING (bucket)
ORDER BY b.bucket`,
    transform: rows => ({
      granularity: 'week',
      x: seriesX(rows),
      lines: [
        { key: 'total', label: 'All new memberships', values: rows.map(r => num(r.total)), primary: true, unit: 'count' },
        { key: 'email_invite', label: 'Email invite', values: rows.map(r => num(r.email_invite)), unit: 'count' },
        { key: 'join_request', label: 'Approved join request', values: rows.map(r => num(r.join_request)), unit: 'count' },
        { key: 'unattributed', label: 'Unattributed', values: rows.map(r => num(r.unattributed)), unit: 'count' }
      ],
      partialLast: true
    })
  },
  {
    id: 'invite_k_proxy',
    label: 'Accepted invites per contributor (K proxy)',
    definition: 'Per UTC month over the last 12 months: email invites accepted that month divided by the number of people who contributed that month (the shared contribution definition, active people only, bot excluded). Extra lines: people who sent invites that month; the share of invites sent by the top 10% of inviters over the trailing 12 months; and the share of that month\'s inviters who do not hold the Administration responsibility in the group.',
    whyItMatters: 'This asks whether participation creates more participants, and whether invitations come from many stewards or only a handful.',
    display: 'series',
    unit: 'ratio',
    goodDirection: 'up',
    vital: false,
    notes: 'The top-10% share is pooled over the trailing 12 months, because a single month\'s top decile holds only a handful of people. Administration status is the inviter\'s current role, not their role when they sent the invite. Ordinary members cannot send email invites, so this line does not measure member-to-member inviting (members share join links, which are not attributed). Inviters without Administration are hosts, who can add members without holding Administration, or people whose coordinator role has since ended. The share is hidden when it rests on fewer than 5 inviters, or when 1–4 inviters fall on either side, since the inviter count is shown beside it. Accepted invites, contributors, inviters and invites sent are platform-wide totals and are shown even when small. The current month is partial.',
    sql: `
WITH p AS (SELECT (:asOf AT TIME ZONE 'UTC') AS a),
b AS (
  SELECT generate_series(date_trunc('month', a) - interval '11 months', date_trunc('month', a), interval '1 month') AS bucket
  FROM p
),
w AS (SELECT (min(bucket) AT TIME ZONE 'UTC') AS s, :asOf AS e FROM b),
${CONTRIBUTION_POSTS},
ev AS (${contributionEvents({ from: ', w', when: t => `${t} >= w.s AND ${t} < w.e` })}
),
contrib AS (
  SELECT date_trunc('month', ev.t AT TIME ZONE 'UTC') AS bucket, count(DISTINCT ev.u) AS n
  FROM ev JOIN users u ON u.id = ev.u AND u.active AND u.id <> ${AXOLOTL_ID}
  GROUP BY 1
),
acc AS (
  SELECT date_trunc('month', gi.used_at AT TIME ZONE 'UTC') AS bucket, count(*) AS n
  FROM group_invites gi, w
  WHERE gi.used_by_id IS NOT NULL AND gi.used_at >= w.s AND gi.used_at < w.e
  GROUP BY 1
),
admins AS (
  SELECT DISTINCT mgr.user_id, mgr.group_id
  FROM group_memberships_group_roles mgr
  JOIN group_roles_responsibilities grr ON grr.group_role_id = mgr.group_role_id
  JOIN responsibilities r ON r.id = grr.responsibility_id AND r.title = 'Administration'
  WHERE mgr.active IS NOT FALSE
),
sent AS (
  SELECT date_trunc('month', gi.created_at AT TIME ZONE 'UTC') AS month, gi.invited_by_id,
         count(*) AS n,
         bool_or(ad.user_id IS NOT NULL) AS is_admin
  FROM group_invites gi
  JOIN groups g ON g.id = gi.group_id
  LEFT JOIN admins ad ON ad.user_id = gi.invited_by_id AND ad.group_id = coalesce(g.parent_id, g.id)
  WHERE gi.created_at >= (((SELECT min(bucket) FROM b) - interval '11 months') AT TIME ZONE 'UTC')
    AND gi.created_at < :asOf
    AND gi.invited_by_id <> ${AXOLOTL_ID}
  GROUP BY 1, 2
),
monthly AS (
  SELECT month AS bucket, count(*) AS inviters, sum(n) AS invites_sent,
         count(*) FILTER (WHERE NOT is_admin) AS non_admin_inviters
  FROM sent GROUP BY 1
),
roll AS (
  SELECT b.bucket, s.invited_by_id, sum(s.n) AS n
  FROM b JOIN sent s ON s.month > b.bucket - interval '12 months' AND s.month <= b.bucket
  GROUP BY 1, 2
),
ranked AS (
  SELECT bucket, n, ntile(10) OVER (PARTITION BY bucket ORDER BY n DESC) AS decile FROM roll
),
top AS (
  SELECT bucket, sum(n) AS sent_12m,
         sum(n) FILTER (WHERE decile = 1) AS top10_sent_12m,
         count(*) FILTER (WHERE decile = 1) AS top10_inviters_12m
  FROM ranked GROUP BY bucket
)
SELECT to_char(b.bucket, 'YYYY-MM-DD') AS bucket,
       coalesce(acc.n, 0)::int AS accepted,
       coalesce(contrib.n, 0)::int AS contributors,
       coalesce(mo.inviters, 0)::int AS inviters,
       coalesce(mo.invites_sent, 0)::int AS invites_sent,
       coalesce(mo.non_admin_inviters, 0)::int AS non_admin_inviters,
       coalesce(t.sent_12m, 0)::int AS sent_12m,
       coalesce(t.top10_sent_12m, 0)::int AS top10_sent_12m,
       coalesce(t.top10_inviters_12m, 0)::int AS top10_inviters_12m
FROM b
LEFT JOIN acc ON acc.bucket = b.bucket
LEFT JOIN contrib ON contrib.bucket = b.bucket
LEFT JOIN monthly mo ON mo.bucket = b.bucket
LEFT JOIN top t ON t.bucket = b.bucket
ORDER BY b.bucket`,
    transform: rows => ({
      granularity: 'month',
      x: seriesX(rows),
      lines: [
        {
          key: 'k_proxy',
          label: 'Accepted invites per contributor',
          values: rows.map(r => num(r.contributors) > 0 ? num(r.accepted) / num(r.contributors) : null),
          primary: true,
          unit: 'ratio'
        },
        { key: 'accepted', label: 'Accepted invites', values: rows.map(r => num(r.accepted)), unit: 'count' },
        { key: 'contributors', label: 'Contributors', values: rows.map(r => num(r.contributors)), unit: 'count' },
        { key: 'inviters', label: 'People sending invites', values: rows.map(r => num(r.inviters)), unit: 'count' },
        { key: 'invites_sent', label: 'Invites sent', values: rows.map(r => num(r.invites_sent)), unit: 'count' },
        {
          key: 'top10_share_12m',
          label: 'Share sent by top 10% of inviters (trailing 12 months)',
          values: rows.map(r => num(r.top10_inviters_12m) >= MIN_CELL ? share(r.top10_sent_12m, r.sent_12m) : null),
          unit: 'percent'
        },
        {
          key: 'non_admin_inviter_share',
          label: 'Inviters without Administration (current roles)',
          values: rows.map(r => peopleShare(r.non_admin_inviters, r.inviters)),
          unit: 'percent'
        }
      ],
      partialLast: true
    })
  },
  {
    id: 'invite_acceptance_14d',
    label: 'Invites accepted within 14 days',
    definition: `Monthly cohorts of email invites by the month they were created (UTC months, 12 cohorts), counting only cohorts at least 14 days old. Reports the share accepted within 14 days of creation, leaving out bulk sends (Excl. bulk): invites from someone who created more than ${BULK_INVITES_PER_DAY} that UTC day. Invites that expired unused are excluded. The other columns give the same rate for all invites (All) and for invites resent fewer than 4 times (Resent <4), and, for context, the share of invites resent 4 or more times (Resent 4+, lower is better).`,
    whyItMatters: 'This measures invite quality and landing-page conversion, and guards against resend spam.',
    display: 'cohort',
    unit: 'percent',
    goodDirection: 'up',
    vital: false,
    notes: 'Monthly rates swing on small cohorts. A single uploaded list can hold far more invites than everything else sent that month, so it would set the pooled rate on its own; the headline column leaves bulk sends out, and the All column keeps them. The cohort size counts all invites, bulk sends included. A few accepted invites have no acceptance time and count as not accepted.',
    sql: `
WITH p AS (SELECT (:asOf AT TIME ZONE 'UTC') AS a),
b AS (
  SELECT generate_series(date_trunc('month', a - interval '14 days') - interval '12 months',
                         date_trunc('month', a - interval '14 days') - interval '1 month', interval '1 month') AS bucket
  FROM p
),
sent AS (
  SELECT gi.*,
         count(*) OVER (PARTITION BY coalesce(gi.invited_by_id, -gi.id), date_trunc('day', gi.created_at AT TIME ZONE 'UTC')) > ${BULK_INVITES_PER_DAY} AS bulk
  FROM group_invites gi
  WHERE gi.created_at >= ((SELECT min(bucket) FROM b) AT TIME ZONE 'UTC')
    AND gi.created_at < (((SELECT max(bucket) FROM b) + interval '1 month') AT TIME ZONE 'UTC')
),
i AS (
  SELECT date_trunc('month', gi.created_at AT TIME ZONE 'UTC') AS bucket,
         coalesce(gi.sent_count, 0) >= 4 AS heavy,
         gi.bulk,
         (gi.used_by_id IS NOT NULL AND gi.used_at <= gi.created_at + interval '336 hours' AND gi.used_at < :asOf) AS accepted
  FROM sent gi
  WHERE NOT (gi.expired_at IS NOT NULL AND gi.expired_at < :asOf
             AND NOT (gi.used_by_id IS NOT NULL AND gi.used_at <= gi.expired_at))
),
agg AS (
  SELECT bucket,
         count(*) FILTER (WHERE NOT bulk) AS denominator_individual,
         count(*) FILTER (WHERE accepted AND NOT bulk) AS numerator_individual,
         count(*) AS denominator,
         count(*) FILTER (WHERE accepted) AS numerator,
         count(*) FILTER (WHERE NOT heavy) AS denominator_light,
         count(*) FILTER (WHERE accepted AND NOT heavy) AS numerator_light,
         count(*) FILTER (WHERE heavy) AS heavy_resent
  FROM i GROUP BY bucket
)
SELECT to_char(b.bucket, 'YYYY-MM-DD') AS bucket,
       coalesce(a.numerator_individual, 0)::int AS numerator_individual,
       coalesce(a.denominator_individual, 0)::int AS denominator_individual,
       coalesce(a.numerator, 0)::int AS numerator,
       coalesce(a.denominator, 0)::int AS denominator,
       coalesce(a.numerator_light, 0)::int AS numerator_light,
       coalesce(a.denominator_light, 0)::int AS denominator_light,
       coalesce(a.heavy_resent, 0)::int AS heavy_resent
FROM b LEFT JOIN agg a USING (bucket)
ORDER BY b.bucket`,
    transform: rows => ({
      columns: ['Excl. bulk', 'All', 'Resent <4', 'Resent 4+'],
      columnDirections: ['up', 'up', 'up', 'down'],
      rows: rows.map(r => ({
        label: r.bucket,
        size: num(r.denominator),
        valueSizes: [num(r.denominator_individual), num(r.denominator), num(r.denominator_light), num(r.denominator)],
        values: [
          share(r.numerator_individual, r.denominator_individual),
          share(r.numerator, r.denominator),
          share(r.numerator_light, r.denominator_light),
          share(r.heavy_resent, r.denominator)
        ]
      }))
    })
  }
]
