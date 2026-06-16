import passport from 'passport'
import appleSigninAuth from 'apple-signin-auth'
import crypto from 'crypto'
import OIDCAdapter from '../services/oidc/KnexAdapter'
import { mintTokensForUser } from '../services/OIDCTokens'

const rollbar = require('../../lib/rollbar')

const findUser = function (service, email, id) {
  return User.query(function (qb) {
    qb.leftJoin('linked_account', (q2) => {
      q2.on('linked_account.user_id', '=', 'users.id')
    })

    qb.where(function (q3) {
      q3.where({provider_user_id: id, 'linked_account.provider_key': service})
      .orWhereRaw('lower(email) = ?', email ? email.toLowerCase() : null)
    })
  }).fetchAll({withRelated: ['linkedAccounts']})
  .then(users => {
    // if we find both a user matching the email address and one with a matching
    // linked account, prioritize the latter
    if (users.length >= 2) {
      return users.find(u => _.some(u.relations.linkedAccounts.models, a =>
        a.get('provider_user_id') === id && a.get('provider_key') === service))
    }
    return users.first()
  })
}

// FIXME: this doesn't check that the profile_user_id we just got matches the
// stored one. we should update any existing row to match the new
// profile_user_id as necessary.
const hasLinkedAccount = function (user, service) {
  return !!user.relations.linkedAccounts.where({provider_key: service})[0]
}

// Records a successful login WITHOUT establishing a cookie session. Used by the
// mobile token-auth path so social logins behave exactly like /noo/login/native:
// bearer token only, no server session cookie. Mirrors the reactivation side
// effect of UserSession.login (a self-deactivated account is reactivated on login).
const recordTokenLogin = (user) =>
  user.save({ last_login_at: new Date(), active: true }, { patch: true, autoRefresh: true })

// Resolves (or creates) the user for a verified social profile and always returns
// that user. For web/popup callers (`tokenAuth` falsy) it establishes a cookie
// session via UserSession.login; for mobile token-auth it records the login without
// a cookie (the native app authenticates with the minted bearer token, and a stray
// server session cookie would leak into the WebView jar and desync auth).
const upsertUser = (req, service, profile, { tokenAuth = false } = {}) => {
  return findUser(service, profile.email, profile.id)
  .then(async (user) => {
    if (user) {
      if (tokenAuth) {
        await recordTokenLogin(user)
      } else {
        await UserSession.login(req, user, service)
      }
      // if this is a new account, link it to the user
      if (!(await hasLinkedAccount(user, service))) {
        await LinkedAccount.create(user.id, { type: service, profile }, { updateUser: true })
      }
      return user
    }

    const attrs = _.merge(_.pick(profile, 'email', 'name'), {
      account: {type: service, profile},
      email_validated: true // When using oAuth email is already verified
    })

    const newUser = await User.create(attrs)
    await Analytics.trackSignup(newUser.id, req)
    if (tokenAuth) {
      await recordTokenLogin(newUser)
    } else {
      await UserSession.login(req, newUser, service)
    }
    return newUser
  })
}

const upsertLinkedAccount = (req, service, profile) => {
  var userId = req.session.userId
  return LinkedAccount.where({provider_key: service, provider_user_id: profile.id}).fetch()
  .then(account => {
    if (account) {
      // user has this linked account already
      if (account.get('user_id') === userId) {
        return LinkedAccount.updateUser(userId, {type: service, profile})
      }
      // linked account belongs to someone else -- change its ownership
      return account.save({user_id: userId}, {patch: true})
      .then(() => LinkedAccount.updateUser(userId, {type: service, profile}))
    }
    // we create a new account regardless of whether one exists for the service;
    // this allows the user to continue to log in with the old one
    // NOTE: This is currently having the effect of creating a new LinkedAccount for a service
    // EVERY TIME a user authenticates with that service, even using an already linked account.
    return LinkedAccount.create(userId, {type: service, profile}, {updateUser: true})
  })
}

const finishOAuth = function (strategy, req, res, next) {
  var provider = strategy
  if (strategy === 'facebook-token') {
    provider = 'facebook'
  } else if (strategy === 'google-token') {
    provider = 'google'
  } else if (strategy === 'linkedin-token') {
    provider = 'linkedin'
  }

  return new Promise((resolve, reject) => {
    var respond = error => {
      if (error && error.stack) rollbar.error(error, req)
      if (req.headers.accept === 'application/json') {
        error ? res.serverError(error) : res.ok({})
        return resolve()
      }

      return resolve(res.view('popupDone', {
        error,
        provider,
        context: req.session.authContext || 'login',
        layout: null,
        returnDomain: req.session.returnDomain || (process.env.PROTOCOL + '://' + process.env.DOMAIN)
      }))
    }

    var authCallback = function (err, profile, info) {
      if (err || !profile) return respond(err || 'no user')
      if (!profile.email) return respond('no email')

      const isTokenAuth = req.get('X-Hylo-Token-Auth') === '1'

      // Mobile token-auth: always a fresh LOGIN resolved from the verified social
      // profile (never "attach to the account I'm already in" — that path is web-only
      // and a stale session cookie there resolved to the wrong account). Returns a
      // token pair and establishes NO cookie session, so the resolved `user` (not
      // req.session.userId) drives the downstream writes and token mint.
      if (isTokenAuth) {
        return upsertUser(req, provider, profile, { tokenAuth: true })
        .then(async (user) => {
          await UserExternalData.store(user.id, provider, profile._json)
          res.ok(await mintTokensForUser(user))
          return resolve()
        })
        .catch(respond)
      }

      // Web/popup flow (cookie session, unchanged): attach to the current session
      // when already logged in, otherwise resolve/create from the profile.
      return (UserSession.isLoggedIn(req) ? upsertLinkedAccount : upsertUser)(req, provider, profile)
      .then(() => UserExternalData.store(req.session.userId, provider, profile._json))
      .then(() => respond())
      .catch(respond)
    }

    passport.authenticate(strategy, authCallback)(req, res, next)
  })
}

// save params into session variables so that they can be used to return to the
// right control flow
const setSessionFromParams = fn => (req, res) => {
  req.session.returnDomain = req.param('returnDomain')
  req.session.authContext = req.param('authContext')
  return fn(req, res)
}

module.exports = {
  create: function (req, res) {
    var email = req.param('email') ? req.param('email').toLowerCase() : null
    var password = req.param('password')

    return User.authenticate(email, password)
    .then(async (user) => {
      await UserSession.login(req, user, 'password')
      await res.ok({})
      return user
    }).catch(function (err) {
      // 422 means 'well-formed but semantically invalid'
      res.status(422).send(err.message)
    })
  },

  // First-party native login: validates email/password the same way as `create` but
  // returns an OAuth token pair (for the mobile app) instead of establishing a cookie
  // session. The mobile app stores these in the device Keychain.
  nativeLogin: async function (req, res) {
    try {
      const email = req.param('email') ? req.param('email').toLowerCase() : null
      const password = req.param('password')
      const user = await User.authenticate(email, password)
      // Mirror UserSession.login: a successful login reactivates a self-deactivated
      // account. Deleted/pending accounts can't authenticate, so this is safe.
      await user.save({ active: true, last_login_at: new Date() }, { patch: true, autoRefresh: true })
      const tokens = await mintTokensForUser(user)
      return res.ok(tokens)
    } catch (err) {
      // 422 means 'well-formed but semantically invalid'
      return res.status(422).send(err.message)
    }
  },

  // Exchanges a valid mobile access token (Authorization: Bearer) for a server session,
  // emitting a Set-Cookie. The mobile app calls this just before loading the WebView so
  // the embedded web app is authenticated with a freshly-derived session.
  fromToken: async function (req, res) {
    try {
      const match = (req.headers.authorization || '').match(/^Bearer (.+)$/i)
      if (!match) return res.status(401).json({ error: 'Missing bearer token' })

      const accessToken = await (new OIDCAdapter('AccessToken')).find(match[1])
      const valid = accessToken && accessToken.exp && new Date(accessToken.exp * 1000) > Date.now()
      if (!valid) return res.status(401).json({ error: 'Invalid token' })

      // Skip the active-user filter (third arg false), matching how checkJWT resolves
      // the authenticated user from a token.
      const user = await User.find(accessToken.accountId, {}, false)
      if (!user) return res.status(401).json({ error: 'Unknown user' })

      await UserSession.login(req, user, 'token')
      return res.ok({ success: true })
    } catch (err) {
      return res.status(401).json({ error: err.message })
    }
  },

  finishAppleOAuth: async function (req, res, next) {
    const { nonce, user, identityToken, email, fullName } = req.body
    // Check nonce or identityToken with nonce or audience (clientId) or both? See:
    //    https://medium.com/@rossbulat/react-native-sign-in-with-apple-75733d3fbc3 (search "As a side note...")
    const appleIdTokenClaims = await appleSigninAuth.verifyIdToken(identityToken, {
      /** sha256 hex hash of raw nonce */
      nonce: nonce
        ? crypto.createHash('sha256').update(nonce).digest('hex')
        : undefined
    })

    // Confirm that identityToken was verified:
    if (appleIdTokenClaims.sub === user) {
      const isTokenAuth = req.get('X-Hylo-Token-Auth') === '1'
      upsertUser(req, 'apple', {
        id: user,
        email,
        name: fullName.givenName + ' ' + fullName.familyName
      }, { tokenAuth: isTokenAuth })
        .then(async authedUser => {
          // Mobile token-auth clients opt in via header and get a token pair back
          // (no cookie session was created — mint from the resolved user). Existing
          // (web) callers are unaffected.
          if (isTokenAuth) {
            return res.ok(await mintTokensForUser(authedUser))
          }
          return res.ok(authedUser)
        })
        .catch(function (err) {
          // 422 means 'well-formed but semantically invalid'
          res.status(422).send(err.message)
        })
    }
  },

  startGoogleOAuth: setSessionFromParams(function (req, res) {
    passport.authenticate('google', {scope: ['email', 'profile']})(req, res)
  }),

  finishGoogleOAuth: function (req, res, next) {
    return finishOAuth('google', req, res, next)
  },

  startFacebookOAuth: setSessionFromParams(function (req, res) {
    passport.authenticate('facebook', {
      display: 'popup',
      scope: ['email', 'public_profile']
    })(req, res)
  }),

  finishFacebookOAuth: function (req, res, next) {
    return finishOAuth('facebook', req, res, next)
  },

  finishFacebookTokenOAuth: function (req, res, next) {
    return finishOAuth('facebook-token', req, res, next)
  },

  finishGoogleTokenOAuth: function (req, res, next) {
    return finishOAuth('google-token', req, res, next)
  },

  startLinkedinOAuth: setSessionFromParams(function (req, res) {
    passport.authenticate('linkedin')(req, res)
  }),

  finishLinkedinOauth: function (req, res, next) {
    return finishOAuth('linkedin', req, res, next)
  },

  finishLinkedinTokenOauth: function (req, res, next) {
    return finishOAuth('linkedin-token', req, res, next)
  },

  destroy: function (req, res) {
    req.session.destroy()
    res.redirect('/')
  },

  // a 'pure' version of the above for API-only use
  destroySession: function (req, res) {
    req.session.destroy()
    res.ok({})
  },

  createWithJWT: async function (req, res) {
    // Web links will go directly to the server and redirects from here,
    // Native does a POST as an API call and this should not redirect
    const shouldRedirect = req.method === 'GET'
    const nextUrl = req.param('n') || Frontend.Route.evo.passwordSetting()

    // NOTE: this was `req.session.authenticated` but that doesn't seem to
    // populate in the case (or in time) for a POST request? This works.
    if (req.session.userId) {
      // Mobile token-auth clients opt in via header and get a token pair back
      // (e.g. the password-reset magic link), so the native app ends up on the
      // same Keychain-token path as the other login methods. Web is unaffected.
      if (req.get('X-Hylo-Token-Auth') === '1') {
        const user = await User.find(req.session.userId, {}, false)
        return res.ok(await mintTokensForUser(user))
      }
      return shouldRedirect
        ? res.redirect(nextUrl)
        : res.ok({ success: true })
    } else {
      // still redirect, to give the user a chance to log in manually
      // if a specific URL other than the default was the entry point
      return shouldRedirect && req.param('n')
        ? res.redirect(nextUrl)
        : res.status(422).send('Invalid link, please try again')
    }
  },

  // TODO: remove once we are all switched to JWTs
  createWithToken: async function (req, res) {
    // Web links will go directly to the server and redirects from here,
    // Native does a POST as an API call and this should not redirect
    const shouldRedirect = req.method === 'GET'
    const nextUrl = req.param('n') || Frontend.Route.evo.passwordSetting()
    try {
      const user = await User.find(req.param('u'))
      if (!user) return res.status(422).send('Link expired')
      const match = await user.checkToken(req.param('t'))
      if (match) {
        UserSession.login(req, user, 'password')
        return shouldRedirect
          ? res.redirect(nextUrl)
          : res.ok({success: true})
      } else {
        // still redirect, to give the user a chance to log in manually
        // if a specific URL other than the default was the entry point
        return shouldRedirect && req.param('n')
          ? res.redirect(nextUrl)
          : res.status(422).send('Link expired')
      }
    } catch (e) {
      return res.serverError
    }
  },
  
  // these are here for testing
  findUser,
  upsertLinkedAccount
}
