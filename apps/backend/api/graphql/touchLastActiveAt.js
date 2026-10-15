const LAST_ACTIVE_WRITE_INTERVAL_MS = 5 * 60 * 1000

/**
 * Update users.last_active_at at most once every five minutes.
 * The last write time is stored on the Redis-backed session, which is already
 * loaded for the request. The UPDATE is not awaited.
 */
export function touchLastActiveAt (req, updateLastActiveAt = writeLastActiveAt) {
  const userId = req.session && req.session.userId
  if (!userId || req.api_client) return

  const now = Date.now()
  const touchedAt = Number(req.session.lastActiveAtTouchedAt) || 0
  if (now - touchedAt < LAST_ACTIVE_WRITE_INTERVAL_MS) return

  req.session.lastActiveAtTouchedAt = now
  try {
    Promise.resolve(updateLastActiveAt(userId, new Date(now))).catch(logLastActiveError)
  } catch (err) {
    logLastActiveError(err)
  }
}

function logLastActiveError (err) {
  if (typeof sails !== 'undefined' && sails.log) {
    sails.log.error('Failed to update last_active_at', err)
  }
}

function writeLastActiveAt (userId, at) {
  return User.query().where({ id: userId }).update({ last_active_at: at })
}
