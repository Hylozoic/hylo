const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/
const CANONICAL_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export const EARLIEST_AS_OF = '2014-01-01T00:00:00.000Z'

// The Axolotl bot's user id (User.AXOLOTL_ID); every metric leaves it out. Kept
// here because the CLI runs without Sails, so the User model isn't available.
export const AXOLOTL_ID = 13986

export class InvalidAsOfError extends Error {
  constructor (message) {
    super(message)
    this.name = 'InvalidAsOfError'
  }
}

// Returns a canonical ISO timestamp for "now" (or a validated past moment).
// Only strict UTC date or date-time strings are accepted, because the result is
// interpolated into SQL as a literal.
export function normalizeAsOf (input, now = new Date()) {
  if (input === undefined || input === null || input === '') return now.toISOString()
  if (typeof input !== 'string' || !(DATE_ONLY.test(input) || DATE_TIME.test(input))) {
    throw new InvalidAsOfError('asOf must be a UTC date (YYYY-MM-DD) or date-time (YYYY-MM-DDTHH:MM[:SS]Z)')
  }
  const dateOnly = DATE_ONLY.test(input)
  const date = new Date(dateOnly ? `${input}T00:00:00Z` : input)
  // Date rolls impossible days and hours over ('2026-02-31' is March 3), so the
  // parsed moment must read back as the same day, hour and minute.
  const minute = dateOnly ? `${input}T00:00` : input.slice(0, 16)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 16) !== minute) {
    throw new InvalidAsOfError('asOf is not a valid date')
  }
  if (date.toISOString() < EARLIEST_AS_OF) throw new InvalidAsOfError('asOf is too early')
  if (date.getTime() > now.getTime() + 60 * 1000) throw new InvalidAsOfError('asOf cannot be in the future')
  return date.toISOString()
}

// Requests over HTTP may only ask for whole days, which keeps the number of
// distinct cached computations bounded.
export function normalizeRequestedDate (input, now = new Date()) {
  if (input === undefined || input === null || input === '') return null
  if (typeof input !== 'string' || !DATE_ONLY.test(input)) {
    throw new InvalidAsOfError('asOf must be a UTC date (YYYY-MM-DD)')
  }
  return normalizeAsOf(input, now)
}

// Substitutes the :asOf placeholder with a timestamptz literal and escapes `?`
// (the jsonb key-exists operator) so knex does not treat it as a bind parameter.
export function renderSql (sql, asOfIso) {
  if (!CANONICAL_ISO.test(asOfIso)) throw new Error('renderSql requires a canonical ISO timestamp')
  const rendered = sql.replace(/:asOf\b/g, `('${asOfIso}'::timestamptz)`)
  if (/:as_?of\b/i.test(rendered)) throw new Error('Unrecognized as-of placeholder; use :asOf')
  return rendered.replace(/\\\?/g, '?').replace(/\?/g, '\\?')
}
