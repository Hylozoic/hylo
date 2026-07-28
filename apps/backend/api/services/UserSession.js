import { omitBy, isNil } from 'lodash/fp'
import { Validators } from '@hylo/shared'

module.exports = {
  // logic for setting up the session when a user logs in
  login: async function (req, user, providerKey, { transacting } = {}) {
    // So when an anonmyous person logs in we generate a new session for them (handles session fixation)
    // XXX: not working on production for some reason
    // req.userId = user.id
    // const regenerateSession = Promise.promisify(req.session.regenerate, req.session)
    // const session = await regenerateSession()

    req.session.userId = user.id
    req.session.userEmail = user.get('email')

    req.rollbar_person = user.pick('id', 'name', 'email')

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
