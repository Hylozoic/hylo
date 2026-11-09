import { GraphQLError } from 'graphql'
import RedisClient from '../api/services/RedisClient'

// Clients match on this exact string.
export const RATE_LIMITED_ERROR = 'Too many attempts. Please wait a few minutes and try again.'

const MINUTE = 60

// Per IP limits are generous because many people can share one IP (offices, events, schools).
const LIMITS = {
  // Failed logins only
  login: { ip: { max: 50, window: 15 * MINUTE }, email: { max: 10, window: 15 * MINUTE } },
  // Failed verification code guesses only
  verifyCode: { ip: { max: 50, window: 60 * MINUTE }, email: { max: 10, window: 60 * MINUTE } },
  // Every request, since each one sends an email
  sendPasswordReset: { ip: { max: 50, window: 60 * MINUTE }, email: { max: 5, window: 60 * MINUTE } },
  sendEmailVerification: { ip: { max: 50, window: 60 * MINUTE }, email: { max: 5, window: 60 * MINUTE } }
}

/**
 * Returns the Redis keys and limits for an action, skipping identifiers that are missing.
 */
function keysFor (action, { ip, email }) {
  const values = { ip, email: email && email.trim().toLowerCase() }
  return Object.entries(LIMITS[action])
    .filter(([by]) => values[by])
    .map(([by, limit]) => ({ key: `ratelimit:${action}:${by}:${values[by]}`, ...limit }))
}

/**
 * True when any identifier has already used up its attempts for this action.
 * Fails open if Redis is unavailable, so an outage doesn't lock everyone out.
 */
export async function isRateLimited (action, identifiers) {
  try {
    const redis = RedisClient.create()
    const counts = await Promise.all(keysFor(action, identifiers).map(({ key }) => redis.get(key)))
    return keysFor(action, identifiers).some(({ max }, i) => parseInt(counts[i] || 0) >= max)
  } catch (err) {
    sails.log.error(`isRateLimited(${action}) failed: ${err.message}`)
    return false
  }
}

/**
 * Counts one attempt for each identifier. Each counter resets a fixed window after its first attempt.
 */
export async function recordAttempt (action, identifiers) {
  try {
    const redis = RedisClient.create()
    await Promise.all(keysFor(action, identifiers).map(async ({ key, window }) => {
      const count = await redis.incr(key)
      if (count === 1) await redis.expire(key, window)
    }))
  } catch (err) {
    sails.log.error(`recordAttempt(${action}) failed: ${err.message}`)
  }
}

/**
 * User.authenticate with a limit on failed attempts per IP and per email.
 */
export async function authenticateWithRateLimit (req, email, password) {
  const identifiers = { ip: req.ip, email }
  if (await isRateLimited('login', identifiers)) throw new GraphQLError(RATE_LIMITED_ERROR)

  try {
    return await User.authenticate(email, password)
  } catch (err) {
    await recordAttempt('login', identifiers)
    throw err
  }
}

/**
 * Removes all rate limit counters. For tests.
 */
export async function clearRateLimits () {
  const redis = RedisClient.create()
  const keys = await redis.keys('ratelimit:*')
  if (keys.length) await redis.del(...keys)
}
