const PAUSE_AFTER_FAILURE_MS = 60 * 1000
const MAX_MEMO_ENTRIES = 500000

let recordedDay = null
let recordedKeys = new Set()
let pausedUntil = 0

const utcDay = date => date.toISOString().slice(0, 10)

// Header values are untrusted: only plain slugs are accepted.
export function parseGroupSlug (value) {
  const text = String(value === undefined || value === null ? '' : value).trim().toLowerCase()
  return /^[a-z0-9][a-z0-9-]{0,99}$/.test(text) ? text : null
}

// The platform a request came from, using the same headers as Analytics.trackSignup.
export function platformFromHeaders (headers = {}) {
  if (headers['ios-version']) return 'ios'
  if (headers['android-version']) return 'android'
  return 'web'
}

/*
 * Records that a user was active on the current UTC day, once platform-wide
 * (group_id 0) and once for the group they were looking at, if they belong to
 * it. Each process writes at most once per user, group and day, and callers
 * don't await it, so this adds a few inserts per person per day instead of work
 * on every request. A failed insert is logged and pauses recording on this
 * process for a minute; the visit is recorded on a later request that day.
 */
export function recordActivityDay (knex, { userId, groupSlug = null, platform = 'unknown', now = new Date(), log = () => {} }) {
  const day = utcDay(now)
  if (day !== recordedDay || recordedKeys.size > MAX_MEMO_ENTRIES) {
    recordedDay = day
    recordedKeys = new Set()
  }
  if (now.getTime() < pausedUntil) return Promise.resolve(false)

  const keys = [`${userId}:0`]
  if (groupSlug) keys.push(`${userId}:${groupSlug}`)
  const newKeys = keys.filter(key => !recordedKeys.has(key))
  if (newKeys.length === 0) return Promise.resolve(false)
  newKeys.forEach(key => recordedKeys.add(key))

  const writes = []
  if (newKeys.includes(`${userId}:0`)) {
    writes.push(knex.raw(
      'insert into activity_days (day, group_id, user_id, platform) values (?, 0, ?, ?) on conflict do nothing',
      [day, userId, platform]
    ))
  }
  if (groupSlug && newKeys.includes(`${userId}:${groupSlug}`)) {
    // Only active members are credited, so a made-up group slug records nothing.
    writes.push(knex.raw(
      `insert into activity_days (day, group_id, user_id, platform)
       select ?, gm.group_id, gm.user_id, ? from group_memberships gm
       join groups g on g.id = gm.group_id
       where gm.user_id = ? and g.slug = ? and gm.active
       on conflict do nothing`,
      [day, platform, userId, groupSlug]
    ))
  }

  return Promise.all(writes)
    .then(() => true)
    .catch(err => {
      if (recordedDay === day) newKeys.forEach(key => recordedKeys.delete(key))
      if (now.getTime() >= pausedUntil) {
        pausedUntil = now.getTime() + PAUSE_AFTER_FAILURE_MS
        log(err)
      }
      return false
    })
}

export function resetActivityDayMemo () {
  recordedDay = null
  recordedKeys = new Set()
  pausedUntil = 0
}
