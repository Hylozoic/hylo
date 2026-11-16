import { GraphQLError } from 'graphql'
import { RATE_LIMITED_ERROR, isRateLimited, recordAttempt } from '../rateLimit'
import { CLIENT_EVENT_NAMES } from './trackActivity'

const MAX_EVENTS = 20
const MAX_PROPERTIES = 12
const MAX_TEXT = 200

/** True when the value is a device id we generated, not an arbitrary string. */
export function isAnonymousId (value) {
  return typeof value === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(value)
}

/** Keeps only small, plain property values the client is allowed to send. */
export function cleanProperties (properties) {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return null
  const clean = {}
  for (const [key, value] of Object.entries(properties)) {
    if (Object.keys(clean).length >= MAX_PROPERTIES) break
    if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(key)) continue
    if (typeof value === 'string') clean[key] = value.slice(0, MAX_TEXT)
    else if (typeof value === 'number' && Number.isFinite(value)) clean[key] = value
    else if (typeof value === 'boolean') clean[key] = value
  }
  return Object.keys(clean).length ? clean : null
}

/** Uses the client time when it is recent, otherwise now. */
function occurredAtFor (value, now) {
  const parsed = value ? new Date(value) : null
  if (!parsed || Number.isNaN(parsed.getTime())) return now
  const drift = parsed.getTime() - now.getTime()
  if (drift > 5 * 60 * 1000 || drift < -7 * 24 * 60 * 60 * 1000) return now
  return parsed
}

/** A numeric group id from properties, or null. */
function groupIdFrom (properties) {
  const value = properties && properties.groupId
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  if (typeof value === 'string' && /^[0-9]+$/.test(value)) return Number(value)
  return null
}

/**
 * Records a batch of browser or app events. Logged-in events go to
 * activity_events. Logged-out events wait in anonymous_events until signup.
 */
export async function recordClientEvents (knex, { userId = null, anonymousId = null, events = [], ip = null, platform = null, now = new Date() } = {}) {
  if (!Array.isArray(events) || events.length === 0) return 0
  if (events.length > MAX_EVENTS) throw new GraphQLError('Too many events')
  if (!userId && !isAnonymousId(anonymousId)) throw new GraphQLError('Missing anonymous id')

  if (ip) {
    const identifiers = { ip }
    if (await isRateLimited('recordEvents', identifiers)) throw new GraphQLError(RATE_LIMITED_ERROR)
    await recordAttempt('recordEvents', identifiers)
  }

  const rows = []
  for (const event of events) {
    const type = CLIENT_EVENT_NAMES[event && event.name]
    if (!type) continue
    const properties = cleanProperties(event.properties)
    rows.push({
      event_type: type,
      occurred_at: occurredAtFor(event.occurredAt, now),
      platform,
      properties: properties ? JSON.stringify(properties) : null,
      groupId: groupIdFrom(properties)
    })
  }
  if (rows.length === 0) return 0

  if (userId) {
    await knex('activity_events').insert(rows.map(row => ({
      occurred_at: row.occurred_at,
      event_type: row.event_type,
      user_id: userId,
      group_id: row.groupId || 0,
      object_type: 'client_event',
      platform: row.platform,
      properties: row.properties,
      source: 'client'
    })))
    return rows.length
  }

  await knex('anonymous_events').insert(rows.map(row => ({
    anonymous_id: anonymousId,
    event_type: row.event_type,
    occurred_at: row.occurred_at,
    platform: row.platform,
    properties: row.properties
  })))
  return rows.length
}

/**
 * Attaches a device's earlier logged-out events to the account that just signed up.
 */
export async function linkAnonymousEvents (knex, userId, anonymousId) {
  if (!userId || !isAnonymousId(anonymousId)) return 0
  await knex('users').where({ id: userId }).whereNull('analytics_anonymous_id').update({ analytics_anonymous_id: anonymousId })
  const copied = await knex.raw(`
    insert into activity_events
      (occurred_at, event_type, user_id, group_id, object_type, platform, properties, source)
    select occurred_at, event_type, ?,
      coalesce(case when properties->>'groupId' ~ '^[0-9]+$' then (properties->>'groupId')::bigint else null end, 0),
      'client_event', platform, properties, 'client'
    from anonymous_events
    where anonymous_id = ? and user_id is null
  `, [userId, anonymousId])
  await knex('anonymous_events')
    .where({ anonymous_id: anonymousId })
    .whereNull('user_id')
    .update({ user_id: userId, linked_at: new Date() })
  return copied.rowCount || 0
}
