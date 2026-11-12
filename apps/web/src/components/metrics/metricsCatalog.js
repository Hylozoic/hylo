// The report layout for the metrics panel. Each metric keeps the period it is stored in.
// `good` is the direction that counts as better. Current-state metrics are not comparable.

export const SECTIONS = [
  {
    id: 'audience',
    title: 'Audience',
    question: 'How many people use Hylo, by the standard measures?',
    metrics: [
      { id: 'stickiness', period: 'day', good: 'up', unit: 'percent' },
      { id: 'contributors', period: 'day', good: 'up', people: true },
      { id: 'contributors', period: 'month', good: 'up', label: 'Monthly active contributors', people: true },
      { id: 'posts', period: 'day', good: 'up' },
      { id: 'comments', period: 'day', good: 'up' },
      { id: 'reactions', period: 'day', good: 'up' },
      { id: 'joins', period: 'day', good: 'up' },
      { id: 'signups', period: 'day', good: 'neutral', signup: true }
    ]
  },
  {
    id: 'network_alive',
    title: 'Network vitality',
    question: 'Is the network alive, and is life spreading beyond a few places?',
    metrics: [
      { id: 'contributors', period: 'week', good: 'up', label: 'Weekly active contributors', people: true },
      { id: 'contributors_posting', period: 'week', good: 'up', people: true },
      { id: 'connected_beyond_reaction', period: 'week', good: 'up', people: true },
      {
        id: 'live_groups',
        period: 'week',
        good: 'up',
        lines: [
          { dimension: '1', label: '1 or more voices' },
          { dimension: '5', label: '5 or more voices' },
          { dimension: '10', label: '10 or more voices' }
        ]
      },
      { id: 'live_group_survival', period: 'week', good: 'up', unit: 'percent' },
      { id: 'connection_concentration', period: 'week', good: 'down', unit: 'percent' },
      { id: 'live_groups_linked', period: 'week', good: 'up', unit: 'percent' },
      {
        id: 'multi_group_weavers',
        period: 'month',
        good: 'up',
        view: 'latest',
        rows: [
          { dimension: '2', label: 'In 2 or more groups' },
          { dimension: '3', label: 'In 3 or more groups' }
        ]
      }
    ]
  },
  {
    id: 'missed_connections',
    title: 'Missed connections',
    question: 'Where do people reach out and not get met?',
    metrics: [
      { id: 'weekly_missed_connections', period: 'week', good: 'down' },
      {
        id: 'where_connections_are_missed',
        period: 'week',
        good: 'down',
        unit: 'percent',
        view: 'latest',
        rows: [
          { dimension: 'discussion', label: 'Discussion' },
          { dimension: 'request', label: 'Request' },
          { dimension: 'offer', label: 'Offer' },
          { dimension: 'resource', label: 'Resource' },
          { dimension: 'project', label: 'Project' },
          { dimension: 'event', label: 'Event' },
          { dimension: 'proposal', label: 'Proposal' },
          { dimension: 'live', label: 'In a live group' },
          { dimension: 'not_live', label: 'Not in a live group' },
          { dimension: 'newcomer', label: 'Newcomer' },
          { dimension: 'established', label: 'Established' }
        ]
      },
      {
        id: 'after_a_missed_connection',
        period: 'month',
        good: 'up',
        unit: 'percent',
        view: 'months',
        rows: [
          { dimension: 'answered', label: 'Answered, then came back' },
          { dimension: 'missed', label: 'Missed, then came back' }
        ]
      }
    ]
  },
  {
    id: 'finding_home',
    title: 'Arrival and activation',
    question: 'Are new people finding a home, and is growth spreading person to person?',
    metrics: [
      { id: 'signup_joined_group_7d', period: 'month', good: 'up', unit: 'percent' },
      { id: 'signup_contributed_30d', period: 'month', good: 'up', unit: 'percent' },
      { id: 'new_member_contributed_14d', period: 'month', good: 'up', unit: 'percent' },
      { id: 'new_groups_second_voice_30d', period: 'month', good: 'up', unit: 'percent' },
      { id: 'invite_acceptance_14d', period: 'month', good: 'up', unit: 'percent' },
      { id: 'groupless_active_users', period: 'day', good: 'down', comparable: false }
    ]
  },
  {
    id: 'being_answered',
    title: 'Reciprocity',
    question: 'When people speak up, does someone answer?',
    metrics: [
      { id: 'feed_post_response_rate_7d', period: 'week', good: 'up', unit: 'percent' },
      { id: 'first_post_answered_7d', period: 'week', good: 'up', unit: 'percent' },
      { id: 'reciprocal_tie_members', period: 'week', good: 'up' }
    ]
  },
  {
    id: 'real_world_action',
    title: 'Coordination outcomes',
    question: 'Is online activity turning into needs met, gatherings, decisions and projects in the world?',
    metrics: [
      { id: 'coordinating_members', period: 'week', good: 'up', people: true },
      { id: 'needs_answered_14d', period: 'month', good: 'up', unit: 'percent' },
      { id: 'events_that_gathered', period: 'month', good: 'up', unit: 'percent' },
      { id: 'decisions_made', period: 'month', good: 'up' },
      { id: 'projects_with_second_contributor', period: 'month', good: 'up', unit: 'percent' },
      { id: 'place_coverage_live_groups', period: 'week', good: 'up', unit: 'percent' }
    ]
  },
  {
    id: 'coming_back',
    title: 'Retention',
    question: 'Are people coming back?',
    metrics: [
      { id: 'contributor_wow_retention', period: 'week', good: 'up', unit: 'percent' },
      { id: 'new_contributor_retention', period: 'month', good: 'up', unit: 'percent' },
      { id: 'account_deactivations', period: 'month', good: 'down' }
    ]
  },
  {
    id: 'stewards',
    title: 'Stewardship and safety',
    question: 'Are stewards present and responsive, and do groups feel safe?',
    metrics: [
      { id: 'tended_groups_share', period: 'day', good: 'up', unit: 'percent', comparable: false },
      { id: 'join_request_decision_time', period: 'week', good: 'down', unit: 'hours' },
      { id: 'join_requests_unanswered_7d', period: 'month', good: 'down', unit: 'percent' },
      { id: 'stale_join_request_backlog', period: 'day', good: 'down', comparable: false },
      { id: 'steward_coverage', period: 'day', good: 'up', unit: 'percent', comparable: false },
      { id: 'moderation_health', period: 'day', good: 'down', comparable: false }
    ]
  },
  {
    id: 'outbound',
    title: 'Outbound health',
    question: 'Are our notifications and emails helping people, or pushing them away?',
    metrics: [
      { id: 'outbound_to_dormant_share', period: 'day', good: 'down', unit: 'percent', comparable: false },
      { id: 'new_member_notification_turndown', period: 'day', good: 'down', unit: 'percent', comparable: false },
      { id: 'unsubscribe_all_leak', period: 'day', good: 'down', unit: 'percent', comparable: false },
      { id: 'ignored_email_preferences', period: 'day', good: 'down', unit: 'percent', comparable: false },
      { id: 'notification_pipeline_integrity', period: 'day', good: 'down', comparable: false }
    ]
  },
  {
    id: 'trust_numbers',
    title: 'Measurement integrity',
    question: 'Can we trust our numbers?',
    metrics: [
      { id: 'mixpanel_blind_spot', period: 'day', good: 'neutral', unit: 'percent', comparable: false },
      { id: 'data_quality_tripwires', period: 'day', good: 'neutral', comparable: false }
    ]
  }
]

export const VITAL = [
  { id: 'active_users', period: 'day', good: 'up' },
  { id: 'live_groups', period: 'week', good: 'up' },
  { id: 'weekly_missed_connections', period: 'week', good: 'down' },
  { id: 'feed_post_response_rate_7d', period: 'week', good: 'up', unit: 'percent' },
  { id: 'tended_groups_share', period: 'day', good: 'up', unit: 'percent', comparable: false }
]

export const AVOID = [
  'Total registered users and total groups only go up. Most groups are quiet, and many signups never join one.',
  'Daily, weekly and monthly active people count anyone who opened Hylo, including visits prompted by a notification. Read them next to contributors and connected members.',
  'Posts, messages and reactions can come from a few heavy posters. A reaction is a cheap response, so it is not the goal on its own.',
  'Invites sent reward resending. Accepted invites per contributor is the number that matters.',
  'Join-request approval rate is already high. Silence is the failure, so watch time to a decision and the stale backlog.',
  'Events and proposals created are cheap. Count the ones that gathered people or reached a decision.'
]

export const GAPS = [
  'Whether a request was actually fulfilled, and who helped. A comment is only a stand-in.',
  'Whether an event happened and who came. An RSVP is intent.',
  'Where a new member came from, and who invited them, for most joins.',
  'Email bounces, spam complaints and push taps. Sending is not the same as arriving.'
]

/** The stored metrics to request for one period. */
export function metricsForPeriod (period, { signupMetric = false } = {}) {
  const ids = new Set()
  if (period === 'day') ids.add('active_users').add('mau').add('wau')
  if (period === 'week') {
    ids.add('connected_members').add('connected_beyond_reaction')
    ids.add('contributor_cohort').add('contributor_retained')
  }
  SECTIONS.forEach(section => {
    section.metrics.forEach(metric => {
      if (metric.period !== period) return
      if (metric.signup && !signupMetric) return
      if (metric.id === 'contributor_wow_retention') return
      ids.add(metric.id)
    })
  })
  return [...ids]
}
