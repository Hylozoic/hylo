/*
  Sentry-backed error reporter for the backend (Rollbar replacement).

  Runtime env (set on the API / worker / cron dynos — not Vite-prefixed):
    SENTRY_DSN   - enables reporting when set (server key for the shared Sentry project)
    SENTRY_ENV   - environment tag (production / staging / reviewApp); falls back to NODE_ENV

  Init as early as possible from process entrypoints so uncaught errors are captured.
  Tag the process after require, e.g. sentry.setProcess('web'|'worker'|'cron').
*/

const Sentry = require('@sentry/node')

const dsn = process.env.SENTRY_DSN
const environment = process.env.SENTRY_ENV || process.env.NODE_ENV
const enabled = !!dsn && process.env.NODE_ENV !== 'test'

if (enabled) {
  Sentry.init({
    dsn,
    environment,
    // Error reporting only — no performance tracing (matches web policy)
    tracesSampleRate: 0,
    // Align with existing Rollbar person fields (id / name / email via setUser)
    sendDefaultPii: true,
    initialScope: {
      tags: {
        surface: 'backend'
      }
    }
  })
}

/**
 * Attaches Express/Sails request basics to the current scope when present.
 * @param {object|null} req
 */
function applyRequestContext (req) {
  if (!req || typeof req !== 'object') return

  Sentry.setContext('request', {
    method: req.method,
    url: req.originalUrl || req.url,
    headers: req.headers && {
      host: req.headers.host,
      'user-agent': req.headers['user-agent']
    }
  })

  if (req.user && (req.user.id || req.user.get)) {
    const id = req.user.id || (req.user.get && req.user.get('id'))
    if (id) Sentry.setUser({ id: String(id) })
  } else if (req.rollbar_person) {
    // Temporary until UserSession switches to sentry.setUser
    const person = req.rollbar_person
    Sentry.setUser({
      id: person.id != null ? String(person.id) : undefined,
      username: person.name,
      email: person.email
    })
  }
}

const sentry = {
  disabled: !enabled,

  /**
   * Reports an exception to Sentry.
   * Compatible with common Rollbar call shapes:
   *   error(err)
   *   error(err, req)
   *   error(err, null, extra)
   *   error(err, callback) — flushes then invokes callback (cron)
   */
  error (err, reqOrCallback, extra) {
    if (!enabled) {
      if (typeof reqOrCallback === 'function') reqOrCallback()
      return
    }

    const callback = typeof reqOrCallback === 'function' ? reqOrCallback : null
    const req = callback ? null : reqOrCallback

    Sentry.withScope((scope) => {
      applyRequestContext(req)
      if (extra && typeof extra === 'object') {
        scope.setExtras(extra)
      }
      Sentry.captureException(err instanceof Error ? err : new Error(String(err)))
    })

    if (callback) {
      Sentry.flush(2000).then(() => callback(), () => callback())
    }
  },

  /**
   * Captures an exception with optional Sentry CaptureContext.
   * @param {Error} err
   * @param {object} [captureContext]
   */
  captureException (err, captureContext) {
    if (!enabled) return
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)), captureContext)
  },

  /**
   * Sets or clears the Sentry user (id, username, email).
   * @param {{ id?: *, name?: string, username?: string, email?: string }|null} user
   */
  setUser (user) {
    if (!enabled) return
    if (!user) {
      Sentry.setUser(null)
      return
    }
    Sentry.setUser({
      id: user.id != null ? String(user.id) : undefined,
      username: user.username || user.name,
      email: user.email
    })
  },

  /**
   * Tags which backend process emitted the event (web | worker | cron).
   * @param {string} processName
   */
  setProcess (processName) {
    if (!enabled) return
    Sentry.setTag('process', processName)
  },

  /**
   * Flushes pending events (e.g. before process exit).
   * @param {number} [timeout=2000]
   * @returns {Promise<boolean>}
   */
  flush (timeout = 2000) {
    if (!enabled) return Promise.resolve(true)
    return Sentry.flush(timeout)
  },

  // Passthrough no-op so http middleware can swap gradually in a later phase
  errorHandler () {
    return (req, res, next) => next()
  }
}

module.exports = sentry
