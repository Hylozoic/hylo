// Where each metric's numbers come from. `version` is stored with the snapshot
// rows so a changed definition can be rebuilt without mixing old and new values.
const stored = (section, extra = {}) => ({ kind: 'stored', version: 1, section, periods: ['day', 'week', 'month', 'year'], ...extra })

export const METRICS = {
  active_users: stored('audience', { people: true }),
  wau: stored('audience', { people: true, periods: ['day'] }),
  mau: stored('audience', { people: true, periods: ['day'] }),
  contributors: stored('audience', { people: true }),
  connected_members: stored('network_alive', { people: true }),
  posts: stored('audience'),
  comments: stored('audience'),
  reactions: stored('audience'),
  rsvps: stored('audience'),
  votes: stored('audience'),
  messages: stored('audience'),
  joins: stored('finding_home'),
  signups: stored('finding_home'),
  members: stored('finding_home', { periods: ['day'] }),
  open_join_requests: stored('stewards', { periods: ['day'] }),
  contributor_cohort: stored('coming_back', { periods: ['week'] }),
  contributor_retained: stored('coming_back', { periods: ['week'] }),

  contributors_30d: stored('audience', { people: true, periods: ['day'] }),
  contributors_posting: stored('network_alive', { people: true, periods: ['week', 'month'] }),
  connected_beyond_reaction: stored('network_alive', { people: true, periods: ['week'], version: 2 }),
  average_dau: stored('audience', { periods: ['week'] }),
  coordinating_members: stored('real_world_action', { people: true, periods: ['week'] }),
  live_groups: stored('network_alive', { periods: ['week'] }),
  live_group_survival: stored('network_alive', { periods: ['week'] }),
  connection_concentration: stored('network_alive', { periods: ['week'] }),
  multi_group_weavers: stored('network_alive', { periods: ['month'] }),
  live_groups_linked: stored('network_alive', { periods: ['week'] }),
  place_coverage_live_groups: stored('real_world_action', { periods: ['week'] }),
  weekly_missed_connections: stored('missed_connections', { periods: ['week'] }),
  where_connections_are_missed: stored('missed_connections', { periods: ['week'] }),
  after_a_missed_connection: stored('missed_connections', { periods: ['month'] }),
  feed_post_response_rate_7d: stored('being_answered', { periods: ['week'] }),
  first_post_answered_7d: stored('being_answered', { periods: ['week'] }),
  needs_answered_14d: stored('real_world_action', { periods: ['month'] }),
  events_that_gathered: stored('real_world_action', { periods: ['month'] }),
  decisions_made: stored('real_world_action', { periods: ['month'] }),
  projects_with_second_contributor: stored('real_world_action', { periods: ['month'] }),
  signup_joined_group_7d: stored('finding_home', { periods: ['month'] }),
  signup_contributed_30d: stored('finding_home', { periods: ['month'] }),
  new_member_contributed_14d: stored('finding_home', { periods: ['month'] }),
  new_contributor_retention: stored('coming_back', { periods: ['month'] }),
  signup_cohort_curve: stored('coming_back', { periods: ['month'] }),
  new_groups_second_voice_30d: stored('finding_home', { periods: ['month'] }),
  new_memberships_by_source: stored('finding_home', { periods: ['month'] }),
  account_deactivations: stored('coming_back', { periods: ['month'] }),
  invite_k_proxy: stored('finding_home', { periods: ['month'] }),
  invite_acceptance_14d: stored('finding_home', { periods: ['month'] }),
  reciprocal_tie_members: stored('being_answered', { periods: ['week'] }),
  join_request_decision_time: stored('stewards', { periods: ['week'] }),
  join_requests_unanswered_7d: stored('stewards', { periods: ['month'] }),

  tended_groups_share: stored('stewards', { kind: 'state', periods: ['day'] }),
  stale_join_request_backlog: stored('stewards', { kind: 'state', periods: ['day'] }),
  steward_coverage: stored('stewards', { kind: 'state', periods: ['day'] }),
  moderation_health: stored('stewards', { kind: 'state', periods: ['day'] }),
  groupless_active_users: stored('finding_home', { kind: 'state', periods: ['day'] }),
  mid_signup: stored('finding_home', { kind: 'state', periods: ['day'] }),
  outbound_to_dormant_share: stored('outbound', { kind: 'state', periods: ['day'] }),
  new_member_notification_turndown: stored('outbound', { kind: 'state', periods: ['day'] }),
  unsubscribe_all_leak: stored('outbound', { kind: 'state', periods: ['day'] }),
  ignored_email_preferences: stored('outbound', { kind: 'state', periods: ['day'] }),
  notification_pipeline_integrity: stored('outbound', { kind: 'state', periods: ['day'] }),
  mixpanel_blind_spot: stored('trust_numbers', { kind: 'state', periods: ['day'] }),
  data_quality_tripwires: stored('trust_numbers', { kind: 'state', periods: ['day'] }),

  stickiness: { kind: 'derived', version: 1, section: 'audience', needs: ['active_users', 'mau'], periods: ['day'] },
  active_users_now: { kind: 'display', version: 1, section: 'audience', needs: ['active_users', 'wau', 'mau', 'contributors_30d'] },
  active_users_trend: { kind: 'display', version: 1, section: 'audience', needs: ['active_users', 'mau', 'average_dau'] },
  weekly_active_contributors: { kind: 'alias', version: 1, section: 'network_alive', of: 'contributors', periods: ['week'] },
  monthly_active_contributors: { kind: 'alias', version: 1, section: 'audience', of: 'contributors', periods: ['month'] },
  weekly_connected_members: { kind: 'alias', version: 1, section: 'network_alive', of: 'connected_members', periods: ['week'] },
  completed_signups: { kind: 'alias', version: 1, section: 'finding_home', of: 'signups' },
  contributor_wow_retention: { kind: 'display', version: 1, section: 'coming_back', needs: ['contributor_cohort', 'contributor_retained'] }
}

/** Every metric id the read API accepts. */
export function metricIds () {
  return Object.keys(METRICS)
}

/**
 * Stored metric ids that have to be loaded to answer `requested`, including
 * aliases and the inputs of derived metrics.
 */
export function storedIdsFor (requested) {
  const ids = []
  for (const id of requested) {
    const entry = METRICS[id]
    if (!entry) continue
    if (entry.kind === 'alias') ids.push(entry.of)
    else if (entry.kind === 'derived' || entry.kind === 'display') ids.push(...entry.needs)
    else ids.push(id)
  }
  return [...new Set(ids)]
}

/** The stored metric a request is actually read from, when it is an alias. */
export function sourceMetric (id) {
  const entry = METRICS[id]
  if (entry && entry.kind === 'alias') return entry.of
  return id
}
