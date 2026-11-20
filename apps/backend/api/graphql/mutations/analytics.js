import { GraphQLError } from 'graphql'
import { recordClientEvents } from '../../../lib/analytics/clientEvents'
import { readMetricPeople } from '../../../lib/analytics/metrics/people'
import { exploreRetention } from '../../../lib/analytics/metrics/retention'
import { platformFromHeaders } from '../../../lib/analytics/recordActivityDay'

/**
 * Records a small batch of browser or app events. Logged-out callers send an anonymous id.
 */
export async function recordEvents (root, { anonymousId, events }, context) {
  const userId = context.currentUserId || context.req?.session?.userId || null
  const platform = platformFromHeaders(context.req?.headers || {})
  const recorded = await recordClientEvents(bookshelf.knex, {
    userId,
    anonymousId,
    events,
    ip: context.req?.ip,
    platform
  })
  return { recorded }
}

/** The people behind one metric, for an admin or a group's stewards. */
export async function metricPeople (root, args, context) {
  if (!context.currentUserId) throw new GraphQLError('Unauthorized')
  return readMetricPeople(context.currentUserId, args)
}

/** A one-off retention question. Admins can ask for the platform. Stewards can ask for their group. */
export async function retentionExplore (root, args, context) {
  if (!context.currentUserId) throw new GraphQLError('Unauthorized')
  const groupId = Number(args.groupId) || 0
  if (!groupId) {
    if (!(await Admin.isSuperAdmin(context.currentUserId))) throw new GraphQLError('Unauthorized')
  } else {
    const allowed = await GroupMembership.hasResponsibility(context.currentUserId, groupId, Responsibility.constants.RESP_ADMINISTRATION)
    if (!allowed) throw new GraphQLError("You don't have permission to view this group's metrics")
  }
  return exploreRetention(bookshelf.knex, context.currentUserId, args)
}
