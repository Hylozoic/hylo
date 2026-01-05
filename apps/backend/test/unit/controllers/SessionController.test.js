const setup = require('../../setup')
const SessionController = require('../../../api/controllers/SessionController')
var factories = require('../../setup/factories')
var passport = require('passport')

describe('SessionController.findUser', () => {
  var u1, u2
  var findUser = SessionController.findUser

  before(() => {
    u1 = factories.user()
    u2 = factories.user()
    return Promise.all([u1.save(), u2.save()])
  })

  describe('with no directly linked user', () => {
    it('picks a user with matching email address', () => {
      return findUser('facebook', u2.get('email'), 'foo')
        .then(user => {
          expect(user.id).to.equal(u2.id)
        })
    })
  })

  describe('with a directly linked user', () => {
    before(() => {
      return LinkedAccount.create(u1.id, {type: 'facebook', profile: {id: 'foo'}})
    })

    after(() => {
      return LinkedAccount.query().where('user_id', u1.id).del()
    })

    it('returns that user, not one with a matching email address', () => {
      return findUser('facebook', u2.get('email'), 'foo')
        .then(user => {
          expect(user.id).to.equal(u1.id)
        })
    })
  })
})

describe('SessionController.upsertLinkedAccount', () => {
  var user, req, profile
  const upsertLinkedAccount = SessionController.upsertLinkedAccount
  const facebookUrl = 'http://facebook.com/foo'

  before(() => {
    profile = {
      id: 'foo',
      _json: {
        link: facebookUrl
      }
    }
    user = factories.user()
    return user.save()
      .then(() => {
        req = {session: {userId: user.id}}
      })
  })

  describe('with a directly linked user ', () => {
    before(() => {
      return LinkedAccount.create(user.id, {type: 'facebook', profile: {id: profile.id}})
    })

    after(() => {
      return LinkedAccount.query().where('user_id', user.id).del()
    })

    it('updates the user facebook_url', () => {
      return upsertLinkedAccount(req, 'facebook', profile)
        .then(() => user.refresh())
        .then(() => {
          expect(user.get('facebook_url')).to.equal(facebookUrl)
        })
    })
  })
})

describe('SessionController', function () {
  var req, res, cat

  before(() => {
    req = factories.mock.request()
    res = factories.mock.response()
  })

  describe('.create', function () {
    before(() => {
      _.extend(req, {
        params: {
          email: 'iam@cat.org',
          password: 'password'
        }
      })

      cat = new User({name: 'Cat', email: 'iam@cat.org', active: true})
      return cat.save().then(() =>
        new LinkedAccount({
          provider_user_id: '$2a$10$UPh85nJvMSrm6gMPqYIS.OPhLjAMbZiFnlpjq1xrtoSBTyV6fMdJS',
          provider_key: 'password',
          user_id: cat.id
        }).save())
    })

    it('works with a valid username and password', function () {
      return SessionController.create(req, res)
        .then(() => User.find(cat.id))
        .then(user => {
          expect(res.status).not.to.have.been.called()
          expect(res.ok).to.have.been.called()
          expect(req.session.userId).to.equal(cat.id)
          expect(user.get('last_login_at').getTime()).to.be.closeTo(new Date().getTime(), 2000)
        })
    })
  })

  describe('.createWithToken', () => {
    var user, token

    before(() => {
      UserSession.login = spy(UserSession.login)
      user = factories.user()
      return user.save({created_at: new Date()})
        .then(() => user.generateToken())
        .then(t => token = t)
    })

    it('logs a user in and redirects (Web/GET request)', () => {
      _.extend(req.params, {u: user.id, t: token})
      req.method = 'GET'

      return SessionController.createWithToken(req, res)
        .then(() => {
          expect(UserSession.login).to.have.been.called()
          expect(res.redirect).to.have.been.called()
          expect(res.redirected).to.equal(Frontend.Route.evo.passwordSetting())
        })
    })

    it("logs a user in doesn't redirect (API/POST request)", () => {
      _.extend(req.params, {u: user.id, t: token})
      req.method = 'POST'

      res = factories.mock.response()
      return SessionController.createWithToken(req, res)
        .then(() => {
          expect(UserSession.login).to.have.been.called()
          expect(res.redirect).not.to.have.been.called()
          expect(res.ok).to.have.been.called()
        })
    })

    it('rejects an invalid token', () => {
      var error
      _.extend(req.params, {u: user.id, t: token + 'x'})
      res.send = spy(function (msg) { error = msg })

      return SessionController.createWithToken(req, res)
        .then(() => {
          expect(res.send).to.have.been.called()
          expect(error).to.equal('Link expired')
        })
    })
  })

  describe('.createWithJWT', () => {
    var user, token

    before(async () => {
      user = factories.user()
      await user.save({created_at: new Date()})
        .then(() => user.generateJWT())
        .then(t => token = t)
      req.url = `https://hylo.com?u=${user.id}&token=${token}`
    })

    it('for valid JWT and GET it will redirect', () => {
      _.extend(req.params, {u: user.id, token})
      req.method = 'GET'
      req.session.authenticated = true

      return SessionController.createWithJWT(req, res)
        .then(() => {
          expect(res.redirect).to.have.been.called()
          expect(res.redirected).to.equal(Frontend.Route.evo.passwordSetting())
        })
    })

    it('for valid JWT and POST returns success', () => {
      _.extend(req.params, {u: user.id, token})
      req.method = 'POST'
      req.session.authenticated = true

      return SessionController.createWithJWT(req, res)
        .then(() => {
          expect(res.ok).to.have.been.called()
        })
    })

    it('for invalid token and GET it will still redirect', () => {
      req.method = 'GET'
      req.session.authenticated = false

      return SessionController.createWithJWT(req, res)
        .then(() => {
          expect(res.redirect).to.have.been.called()
          expect(res.redirected).to.equal(Frontend.Route.evo.passwordSetting())
        })
    })

    it('for invalid token and POST it returns error', () => {
      let error
      const send = spy(function (msg) { error = msg })
      res.status = spy(() => ({ send }))
      req.method = 'POST'
      req.session.userId = null

      return SessionController.createWithJWT(req, res)
        .then(() => {
          expect(res.status).to.have.been.called()
          expect(error).to.equal('Invalid link, please try again')
        })
    })
  })
})
