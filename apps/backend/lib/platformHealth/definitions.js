// Shared framing for the platform-health panel: the north star, what not to
// optimize, and what cannot be measured until new data is captured.

export const NORTH_STAR = {
  metricId: 'weekly_connected_members',
  name: 'Weekly Connected Members',
  definition: 'People on either side of an interaction between two people in a week: one person commented on, reacted to, RSVPed to, voted on, or joined something a different person recently created. Both people count, whether or not the author responds back. Direct messages, self-interactions and the Axolotl bot are excluded. The chart also shows the people connected by more than a reaction.',
  why: "It counts the moment Hylo creates value: someone showed up and someone else answered. It grows only when real coordination grows, so notification blasts, empty signups and shell groups can't inflate it. It is computed on the server, so it also sees the activity Mixpanel can't."
}

export const ANTI_METRICS = [
  'Total registered users, total groups, or groups created: they only go up. Most groups are dormant, many have one member or none, and many signups never join a group.',
  'Raw signups as a headline: signups that never join a group almost never come back. Show signups only as the denominator for activation rates.',
  'Notifications, pushes or emails sent, or their opens, as engagement: much of push and email reaches people who have been inactive for a month or more, and most pushes are chat or new-post broadcasts. Treat volume as a cost, and watch it through the outbound guardrails.',
  'DAU/WAU/MAU on their own as proof of value: they count anyone who opened Hylo, including visits prompted by notifications, which often go to people who have been away for a month or more. Report them for comparability with other platforms, always beside contributors and connected members. And never build a trend from users.last_active_at, which keeps only the latest visit.',
  'Mixpanel event counts or funnels as platform truth: a large share of content comes from people who opted out of analytics, so client-side numbers undercount heavy contributors in particular.',
  'Raw post, chat, message or reaction counts, especially including DM threads: volume from a few heavy posters or chat broadcasts says nothing about whether anyone was answered. Reactions are cheap, so count them only as a response inside rate metrics.',
  'Invites sent and resend counts: invites resent many times almost never convert, and they put deliverability at risk. Optimise accepted invites per contributor, not sends.',
  'Join-request approval rate: nearly every decided request is already approved, and pushing it higher rewards rubber-stamping. The failure mode is silence, so measure time to decision and the stale backlog.',
  'Events or proposals created: creating is cheap. Many events draw no RSVP from anyone but the host, and casual proposals can never be marked decided. Count outcomes.',
  'Number of administrators or roles assigned: admins who never log in make coverage look good while nobody tends the group. Count only stewards active in the last 30 days.',
  'groups.num_members or total memberships: join links and access codes add members who never show up, and member counts hide single-steward fragility.',
  "Time on site, session length and page views: good coordination is quick (ask, get matched, show up), and long sessions can mean people can't find what they need.",
  'Low report or block counts as proof of safety: reports are rare and open ones can sit untouched for a long time, so few reports may mean people have stopped bothering. Blocking is a healthy tool, not something to drive to zero.',
  "fulfilled_at or Contribution/thanks counts as 'needs met': they are almost never written, so a near-zero value measures a UI habit, not unmet need."
]

export const INSTRUMENTATION_GAPS = [
  {
    name: 'Nightly platform-health snapshot',
    why: 'Notifications are pruned after about 30 days, and last_active_at, steward presence, backlog and consent are point-in-time. Without persistence, the tended-groups, outbound and deactivation metrics can never become trends, and the panel re-scans large tables on every load.',
    capture: 'A nightly job writes every panel aggregate to a platform_health_daily(date, metric_id, dimension, value) table. It includes notification counts by medium × reason × recipient-activity bucket (captured before removeOldNotifications runs), tended-group counts, visitor counts and unsubscribe leaks.'
  },
  {
    name: 'Membership source and inviter',
    why: 'Most new memberships have no recorded source. A true K-factor that credits join-link sharers and ordinary members, not just email-invite stewards, is impossible without it.',
    capture: 'Add group_memberships.source (email_invite, join_link, access_code, open_join, join_request, admin_add, parent_group, group_creation) plus nullable inviter_id and invite_id, set in every membership-creation path.'
  },
  {
    name: 'Signup acquisition context',
    why: "Organic, invited and group-link signups can't be told apart, so their activation rates can't be compared.",
    capture: 'Store the landing referrer, UTM parameters, and the invite or join-link token on users at signup (not in URL-logged analytics), keyed to the membership-source values.'
  },
  {
    name: 'Need fulfilment and helper recognition',
    why: "fulfilled_at is rarely set on requests, and Contribution rows are only written when a post is marked fulfilled with contributors, so 'needs met' is only inferred from comments.",
    capture: 'After 7–14 days, prompt request and offer authors to say whether the need was met and who helped. Write posts.fulfilled_at and a Contribution row (post_id, helper_id, created_at).'
  },
  {
    name: 'Gathering attendance',
    why: "An RSVP is intent. There is no record of whether an event happened or how many people came, and meeting_link is empty, so place-based and virtual gatherings can't be separated.",
    capture: "A post-event host prompt ('did it happen? about how many came?') or attendee check-in stored on the event, plus a structured is_virtual flag or a populated meeting_link."
  },
  {
    name: 'Proposal and project lifecycle timestamps',
    why: "Proposal completion time has to be inferred from posts.updated_at, and projects have no status or progress, so decisions and projects can't be trended by completion date.",
    capture: 'proposals voting_closed_at / completed_at and an optional structured implemented flag (kept separate from the free-text proposal_outcome); projects status (active/completed) and completed_at.'
  },
  {
    name: 'Role grant and revoke log',
    why: "The 2026-06 consolidate_common_roles migration re-stamped all role created_at values, and revocations delete rows. The steward pipeline and last-admin loss can't be trended or alerted on.",
    capture: 'An append-only role_events(group_id, user_id, group_role_id, action grant/revoke, actor_id, created_at) table written by the role mutations, plus a last-admin-departure alert.'
  },
  {
    name: 'Join request decider and decision time',
    why: 'The accept and reject code never sets processed_by_id, and decision time is proxied by updated_at, so per-steward load and exact latency are unknown.',
    capture: 'Set join_requests.processed_by_id and a new decided_at in the accept and reject mutations.'
  },
  {
    name: 'Moderation lifecycle',
    why: 'moderation_actions has only status and updated_at, and flagged_items has no timestamps, so resolution time and outcome are approximate.',
    capture: 'Add resolved_at, resolved_by_id and a resolution outcome (content_removed, cleared, user_removed) to moderation_actions, and created_at to flagged_items.'
  },
  {
    name: 'Deactivation timestamp and reason',
    why: 'Current code never writes date_deactivated, so churn is proxied by updated_at, which changes for other reasons.',
    capture: 'Set users.date_deactivated and an optional reason code in the deactivate and delete-account flows.'
  },
  {
    name: 'Email and push delivery outcomes',
    why: "sent_at marks enqueue, not delivery. Bounces, spam complaints, opens and tap-throughs are invisible, so sender reputation and per-reason effectiveness can't be measured.",
    capture: 'Ingest email-provider webhooks (delivered, bounce, complaint, unsubscribe) and push tap-through, aggregated daily by medium × reason.'
  },
  {
    name: 'Platform of creation and visit',
    why: "posts.created_from and comments.created_from are NULL except for email replies, and the device-registration mutation no longer stores devices, so mobile and web health can't be split.",
    capture: 'Stamp web, ios-webview, android-webview or email on post and comment creation and on the daily activity row, and restore device registration.'
  },
  {
    name: 'Post views and reads',
    why: "Only the latest last_read_at is kept, so 'unanswered because unseen' can't be told apart from 'seen but ignored', and readers are invisible.",
    capture: 'A daily aggregated post_view_counts(post_id, date, distinct_viewers) table, written from the post-open path, with no per-user history retained.'
  },
  {
    name: 'Structured place',
    why: 'Many live groups have no location_id, so geographic spread and bioregional coverage are undercounted.',
    capture: "Prompt stewards to geocode their group's location, and backfill location_id from free-text groups.location where the match is unambiguous."
  },
  {
    name: 'Steward-reported real-world outcomes',
    why: 'No column captures regeneration impact such as meals shared, land stewarded or funds moved.',
    capture: 'An optional quarterly steward pulse with structured outcome tags and rough counts, stored per group, and shown on the panel only as aggregates.'
  }
]
