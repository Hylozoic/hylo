import { omitBy, isNil } from 'lodash/fp'
import { Validators } from '@hylo/shared'
import sentry from '../../lib/sentry'

/**
 * Replaces the session with a fresh one (new ID) so a session ID planted before login
 * can't be reused afterwards (session fixation). Non-auth data such as the OAuth
 * popup's returnDomain/authContext is carried over. req.userId makes config/session.js
 * genid prefix the new ID with the user id, which User.clearSessionsFor relies on.
 */
function regenerateSession (req, userId) {
  if (typeof req.session?.regenerate !== 'function') return Promise.resolve()
  const { cookie, userId: _userId, userEmail, ...carryOver } = req.session
  req.userId = userId
  return new Promise(resolve => {
    req.session.regenerate(err => {
      if (err) sails.log.error(`UserSession.login: could not regenerate session: ${err.message}`)
      Object.assign(req.session, carryOver)
      resolve()
    })
  })
}

module.exports = {
  // logic for setting up the session when a user logs in
  login: async function (req, user, providerKey, { transacting } = {}) {
    // 'token' authenticates individual API requests, not an interactive login
    if (providerKey !== 'token') await regenerateSession(req, user.id)

    req.session.userId = user.id
    req.session.userEmail = user.get('email')

    sentry.setUser(user.pick('id', 'name', 'email'))

    if (providerKey === 'admin' || providerKey === 'token') return

    if (req.headers['ios-version'] || req.headers['android-version']) {
      const properties = omitBy(isNil, {
        iosVersion: req.headers['ios-version'],
        androidVersion: req.headers['android-version']
      })

      Analytics.track({
        userId: user.id,
        event: 'Login from mobile app',
        properties
      })
    }

    // Never activate an account without a valid name — email-verification stubs
    // start with name null; they must complete register() or OAuth that supplies a name.
    const updates = { last_login_at: new Date() }
    if (!Validators.validateUser.name(user.get('name'))) {
      updates.active = true
    }

    return user.save(updates, { patch: true, autoRefresh: true, transacting })
  },

  isLoggedIn: function (req) {
    return !!req?.session?.userId
  }
}
