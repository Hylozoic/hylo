// Two years, so a year-over-year comparison of the 26-week trend (whose MAU
// windows reach about 19 months back) still finds every day it needs.
const RETENTION_DAYS = 730
const PAUSE_AFTER_FAILURE_MS = 60 * 1000

let recordedDay = null
let recordedUserIds = new Set()
let pausedUntil = 0

const utcDay = date => date.toISOString().slice(0, 10)

/*
 * Records that a user was active on the current UTC day. Each process writes at
 * most once per user per day, and callers don't await it, so this adds a single
 * insert per person per day instead of work on every request. A failed insert
 * is logged and pauses recording on this process for a minute, so a missing
 * table costs one insert and one log line a minute, and the user is recorded on
 * a later request that day.
 */
export function recordActivityDay (knex, userId, { now = new Date(), log = () => {} } = {}) {
  const day = utcDay(now)
  if (day !== recordedDay) {
    recordedDay = day
    recordedUserIds = new Set()
  }
  const key = String(userId)
  if (recordedUserIds.has(key) || now.getTime() < pausedUntil) return Promise.resolve(false)
  recordedUserIds.add(key)

  return knex.raw('insert into user_activity_days (user_id, day) values (?, ?) on conflict do nothing', [userId, day])
    .then(() => true)
    .catch(err => {
      if (recordedDay === day) recordedUserIds.delete(key)
      if (now.getTime() >= pausedUntil) {
        pausedUntil = now.getTime() + PAUSE_AFTER_FAILURE_MS
        log(err)
      }
      return false
    })
}

export function pruneActivityDays (knex, { now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
  return knex('user_activity_days').where('day', '<', utcDay(cutoff)).del()
}

export function resetActivityDayMemo () {
  recordedDay = null
  recordedUserIds = new Set()
  pausedUntil = 0
}
