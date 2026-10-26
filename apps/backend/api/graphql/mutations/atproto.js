import { GraphQLError } from 'graphql'
import { atprotoConfig } from '../../../lib/atproto/config'
import { isEligibleForAtprotoIdentity } from '../../../lib/atproto/eligibility'

/**
 * Experimental: creates the current user's Hylo-hosted AT Protocol identity.
 * Returns their updated AtprotoStatus.
 */
export async function createAtprotoIdentity (userId) {
  const config = atprotoConfig()
  const user = await User.find(userId)
  if (!config.enabled || !isEligibleForAtprotoIdentity(user, config)) {
    throw new GraphQLError('You are not able to create an AT Protocol identity')
  }

  try {
    await AtprotoService.provision(user)
  } catch (err) {
    // Details (PLC errors, config) are for the logs; a pending identity is retried by backfill
    sails.log.error(`createAtprotoIdentity failed for user ${userId}`, err)
    throw new GraphQLError('Your AT Protocol identity could not be created right now. Please try again later.')
  }

  return AtprotoService.meStatus(user)
}
