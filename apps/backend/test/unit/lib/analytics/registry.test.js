import { expect } from 'chai'
import { GraphQLError } from 'graphql'
import { isSmallCohort } from '../../../../lib/analytics/constants'
import { METRICS, storedIdsFor } from '../../../../lib/analytics/metrics/registry'
import { validateRetention } from '../../../../lib/analytics/metrics/retention'

const HEALTH_IDS = [
  'active_users_now', 'active_users_trend', 'monthly_active_contributors', 'weekly_active_contributors',
  'weekly_connected_members', 'live_groups', 'live_group_survival', 'connection_concentration',
  'multi_group_weavers', 'live_groups_linked', 'weekly_missed_connections', 'where_connections_are_missed',
  'after_a_missed_connection', 'completed_signups', 'signup_joined_group_7d', 'signup_contributed_30d',
  'new_member_contributed_14d', 'new_groups_second_voice_30d', 'groupless_active_users',
  'new_memberships_by_source', 'invite_k_proxy', 'invite_acceptance_14d', 'feed_post_response_rate_7d',
  'first_post_answered_7d', 'reciprocal_tie_members', 'contributor_wow_retention', 'new_contributor_retention',
  'signup_cohort_curve', 'account_deactivations', 'coordinating_members', 'needs_answered_14d',
  'events_that_gathered', 'decisions_made', 'projects_with_second_contributor', 'place_coverage_live_groups',
  'tended_groups_share', 'join_request_decision_time', 'join_requests_unanswered_7d', 'stale_join_request_backlog',
  'steward_coverage', 'moderation_health', 'outbound_to_dormant_share', 'new_member_notification_turndown',
  'unsubscribe_all_leak', 'ignored_email_preferences', 'notification_pipeline_integrity',
  'mixpanel_blind_spot', 'data_quality_tripwires'
]

describe('metric registry', () => {
  it('includes every health metric', () => {
    for (const id of HEALTH_IDS) expect(METRICS[id], id).to.be.ok // eslint-disable-line no-unused-expressions
    expect(HEALTH_IDS).to.have.length(48)
  })

  it('loads the stored inputs of an alias and a derived metric', () => {
    expect(storedIdsFor(['weekly_active_contributors', 'stickiness'])).to.deep.equal(['contributors', 'active_users', 'mau'])
  })

  it('hides a small group rate and keeps the platform rate', () => {
    expect(isSmallCohort(4, 3)).to.equal(true)
    expect(isSmallCohort(0, 3)).to.equal(false)
    expect(isSmallCohort(4, 5)).to.equal(false)
  })
})

describe('validateRetention', () => {
  it('clamps the size of a question', () => {
    const question = validateRetention({ start: 'signup', returning: 'contribution', period: 'week', cohorts: 100, periods: 0 })
    expect(question.cohorts).to.equal(24)
    expect(question.periods).to.equal(1)
  })

  it('rejects an unknown starting point', () => {
    expect(() => validateRetention({ start: 'revenue', returning: 'visit', period: 'day' })).to.throw(GraphQLError)
  })
})
