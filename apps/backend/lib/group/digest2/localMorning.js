/* global bookshelf */
// Digests in each member's local morning (D41).
//
// The hourly cron runs the daily and weekly digests every hour. Each run sends to the
// members whose scheduled send (their "slot") has just come round: 08:00 in the
// timezone their browser reported (users.settings.timezone), every day for daily
// digests and on their local Wednesday for weekly ones. Members with no timezone keep
// the old noon Pacific send. Each member's digest starts where their last one ended (the
// slot it was sent for) and runs to this slot, so consecutive digests neither overlap
// nor leave a gap, across daylight saving changes and when their timezone changes. With
// no digest in the two days (or two weeks) before, it covers the day (or week) before
// the slot, counted in their own timezone.
//
// A per-membership marker (group_memberships.settings.dailyDigestSentFor /
// weeklyDigestSentFor, the slot it was sent for) is claimed before a digest goes out and
// released if the send fails. A second run in the same hour can't send it again, and a
// failed or missed hour is caught up by the next runs, for up to CATCH_UP_HOURS; after
// that, the member's next digest covers the missed day too. Someone this has never sent
// to is only due in the hour of their slot, so switching from the old noon run never
// sends a second digest on the same day.
//
// Saved-search digests are not part of this: they still go out at noon Pacific.
import { DateTime, IANAZone } from 'luxon'

export const LOCAL_SEND_HOUR = 8
export const FALLBACK_TIMEZONE = 'America/Los_Angeles'
export const FALLBACK_SEND_HOUR = 12
// Luxon weekday: 1 = Monday ... 3 = Wednesday
export const WEEKLY_DIGEST_WEEKDAY = 3
export const CATCH_UP_HOURS = 6

export const SLOT_SETTING = {
  daily: 'dailyDigestSentFor',
  weekly: 'weeklyDigestSentFor'
}

const HOUR_MS = 60 * 60 * 1000

// Browsers report IANA names; anything luxon can't use is ignored
export function isValidTimezone (timezone) {
  return typeof timezone === 'string' && timezone.length > 0 && timezone.length <= 64 && IANAZone.isValidZone(timezone)
}

function toDateTime (at) {
  if (DateTime.isDateTime(at)) return at
  return DateTime.fromJSDate(at instanceof Date ? at : new Date(at))
}

// Where and when this member's digest goes out
export function sendTimeFor (timezone) {
  return isValidTimezone(timezone)
    ? { zone: timezone, hour: LOCAL_SEND_HOUR }
    : { zone: FALLBACK_TIMEZONE, hour: FALLBACK_SEND_HOUR }
}

// The latest scheduled send at or before `at`, as a DateTime in the member's zone
export function latestSlot (type, timezone, at) {
  const { zone, hour } = sendTimeFor(timezone)
  const local = toDateTime(at).setZone(zone)
  let slot = local.startOf('day').set({ hour })
  if (slot > local) slot = slot.minus({ days: 1 })
  if (type === 'weekly') slot = slot.minus({ days: (slot.weekday - WEEKLY_DIGEST_WEEKDAY + 7) % 7 })
  return slot
}

const period = type => type === 'weekly' ? { weeks: 1 } : { days: 1 }
const twoPeriods = type => type === 'weekly' ? { weeks: 2 } : { days: 2 }

// The time range a digest sent for this slot covers. It starts where the member's last
// digest of this kind ended (sentFor, the slot that one was sent for, an ISO string or
// null) when that was less than two days (or two weeks) before, so a skipped slot
// after a timezone change, or a day missed beyond the catch-up, is covered too.
// Otherwise it is the local day (or week) before the slot.
export function windowFor (type, slot, sentFor = null) {
  if (sentFor) {
    const last = DateTime.fromISO(sentFor, { zone: slot.zone })
    if (last.isValid && last < slot && last >= slot.minus(twoPeriods(type))) return [last, slot]
  }
  return [slot.minus(period(type)), slot]
}

// Slots in one timezone are at least 23 hours (or 6 days 23 hours) apart, so a smaller
// gap means the member's timezone changed since their last digest. Under these, the
// slot is skipped and the next digest starts where the last one ended (windowFor).
// Daily: after a move east the last digest went out that same night, so waking up to a
// second one a few hours later isn't useful. Weekly: no second weekly digest within a
// few days; timezone changes move the slot by at most about a day, so any value from
// two to five days behaves the same.
export const MIN_GAP_HOURS = { daily: 8, weekly: 3 * 24 }

// Whether a member whose latest slot is `slot` is due in the run at `at`, given the slot
// their last digest of this kind was sent for (sentFor, an ISO string or null)
export function isDue (type, slot, sentFor, at) {
  const age = toDateTime(at).toMillis() - slot.toMillis()
  if (age < 0) return false
  if (!sentFor) return age < HOUR_MS
  if (slot.toMillis() - new Date(sentFor).getTime() < MIN_GAP_HOURS[type] * HOUR_MS) return false
  return age < CATCH_UP_HOURS * HOUR_MS
}

// The timezone values (as stored, '' for none) whose slot is recent enough that someone
// there could be due in the run at `at`, each with its slot
export async function dueTimezones (type, at) {
  const { rows } = await bookshelf.knex.raw(
    'select distinct settings->>\'timezone\' as timezone from users where settings->>\'timezone\' is not null'
  )
  const stored = rows.map(row => row.timezone)
  const recent = slot => toDateTime(at).toMillis() - slot.toMillis() < CATCH_UP_HOURS * HOUR_MS
  const due = new Map()
  const fallbackSlot = latestSlot(type, null, at)
  if (recent(fallbackSlot)) due.set('', fallbackSlot)
  for (const timezone of stored) {
    const slot = latestSlot(type, timezone, at)
    if (recent(slot)) due.set(timezone, slot)
  }
  return due
}

// A knex fragment keeping members whose stored timezone is one of `timezones` ('' for
// none), with its bindings
export function timezoneFilter (timezones) {
  const list = [...timezones]
  if (list.length === 0) return { sql: 'false', bindings: [] }
  return {
    sql: `coalesce(users.settings->>'timezone', '') in (${list.map(() => '?').join(', ')})`,
    bindings: list
  }
}

// The group ids with at least one member in a due timezone for this kind of digest, so
// an hourly run only prepares the groups it may send for
export async function groupIdsWithDueMembers (type, timezones, groupIds = null) {
  if (timezones.size === 0) return []
  const filter = timezoneFilter(timezones.keys())
  const frequencies = type === 'weekly' ? ['weekly', 'daily'] : ['daily']
  const query = bookshelf.knex('group_memberships')
    .join('users', 'users.id', 'group_memberships.user_id')
    .join('groups', 'groups.id', 'group_memberships.group_id')
    .where('group_memberships.active', true)
    .where('users.active', true)
    .where('groups.active', true)
    .where(function () {
      this.whereNull('groups.type').orWhere('groups.type', '<>', 'space')
    })
    .whereIn(bookshelf.knex.raw('group_memberships.settings->>\'digestFrequency\''), frequencies)
    .whereRaw(filter.sql, filter.bindings)
    .distinct('group_memberships.group_id')
  if (groupIds) query.whereIn('group_memberships.group_id', groupIds)
  return (await query.pluck('group_memberships.group_id')).map(String)
}

const settingsPath = key => `{${key}}`

// Claims this member's digest for the slot. Resolves true when this run may send it,
// false when it has already been sent (or claimed by another run).
export async function claimSlot (groupId, userId, type, slot) {
  const key = SLOT_SETTING[type]
  const slotIso = slot.toUTC().toISO()
  const rows = await bookshelf.knex('group_memberships')
    .where({ group_id: groupId, user_id: userId })
    .where(function () {
      this.whereRaw('settings->>? is null', [key])
        .orWhereRaw('(settings->>?)::timestamptz < ?::timestamptz', [key, slotIso])
    })
    .update({ settings: bookshelf.knex.raw('jsonb_set(coalesce(settings, \'{}\'::jsonb), ?::text[], to_jsonb(?::text))', [settingsPath(key), slotIso]) })
    .returning('id')
  return rows.length > 0
}

// Gives the claim back after a failed send, so a later run can try again
export async function releaseSlot (groupId, userId, type, slot, previous) {
  const key = SLOT_SETTING[type]
  const query = bookshelf.knex('group_memberships')
    .where({ group_id: groupId, user_id: userId })
    .whereRaw('settings->>? = ?', [key, slot.toUTC().toISO()])
  await (previous
    ? query.update({ settings: bookshelf.knex.raw('jsonb_set(settings, ?::text[], to_jsonb(?::text))', [settingsPath(key), previous]) })
    : query.update({ settings: bookshelf.knex.raw('settings - ?::text', [key]) }))
}

// Marks everyone given as sent for their slot, when there was nothing to send them
export async function markSlots (groupId, type, members) {
  for (const { userId, slot } of members) {
    await claimSlot(groupId, userId, type, slot)
  }
}

// Saved-search digests keep their noon Pacific send: which of them run at `now`
export function savedSearchDigestTypesAt (now) {
  const local = toDateTime(now).setZone(FALLBACK_TIMEZONE)
  if (local.hour !== FALLBACK_SEND_HOUR) return []
  return local.weekday === WEEKLY_DIGEST_WEEKDAY ? ['daily', 'weekly'] : ['daily']
}
