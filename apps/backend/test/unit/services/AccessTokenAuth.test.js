var setup = require('../../setup')
import factories from '../../setup/factories'

describe('AccessTokenAuth', function () {
  describe('.generateToken', () => {
    it('generates a 48 character string', () => {
      return AccessTokenAuth.generateToken()
      .then(token => {
        expect(token.length).to.equal(48)
      })
    })
  })

  describe('.checkAndSetAuthenticated', () => {
    var userWithToken, generatedToken = '1234'

    before(async () => {
      await setup.clearDb()
      UserSession.login = spy(UserSession.login)
      return factories.user()
      .save()
      .then(u => {
        userWithToken = u
        return LinkedAccount.create(u.id, {type: 'token',token: generatedToken})
      })
    })

    // TODO from assistant: the tests below don't return their promises, so their expectations never run
    // (req.session.authenticated is no longer set by UserSession.login).
    it('authenticates only this request, without saving it to the cookie session', () => {
      const req = factories.mock.request()
      req.sessionID = 'anon:abc'
      req.query.access_token = generatedToken
      return AccessTokenAuth.checkAndSetAuthenticated(req)
        .then(() => {
          expect(req.session.userId).to.equal(userWithToken.id)
          expect(req.sessionID).to.equal(undefined)
        })
    })

    it('leaves the cookie session alone when no user has the token', () => {
      const req = factories.mock.request()
      req.sessionID = 'anon:abc'
      req.query.access_token = 'not-a-token'
      return AccessTokenAuth.checkAndSetAuthenticated(req)
        .then(() => {
          expect(req.sessionID).to.equal('anon:abc')
        })
    })

    it('will set the user based on the access token from the req.body', () => {
      var req = factories.mock.request()
      req.body.access_token = generatedToken
      AccessTokenAuth.checkAndSetAuthenticated(req)
      .then(() => {
        expect(UserSession.login).to.have.been.called()
        expect(req.session.userId).to.equal(userWithToken.id)
        expect(req.session.authenticated).to.be.true
      })
    })
    
    it('will set the user based on the access token from the query params', () => {
      var req = factories.mock.request()
      req.query.access_token = generatedToken
      AccessTokenAuth.checkAndSetAuthenticated(req)
      .then(() => {
        expect(UserSession.login).to.have.been.called()
        expect(req.session.userId).to.equal(userWithToken.id)
        expect(req.session.authenticated).to.be.true
      })
    })
    
    it('will set the user based on the x-access-token from the request header', () => {
      var req = factories.mock.request()
      req.headers['x-access-token'] = generatedToken
      AccessTokenAuth.checkAndSetAuthenticated(req)
      .then(() => {
        expect(UserSession.login).to.have.been.called()
        expect(req.session.userId).to.equal(userWithToken.id)
        expect(req.session.authenticated).to.be.true
      })
    })
    
    it('does nothing if no token is specified', () => {
      var req = factories.mock.request()
      AccessTokenAuth.checkAndSetAuthenticated(req)
      .then(() => {
        expect(req.session.authenticated).to.equal(undefined)
        expect(req.session.userId).to.equal(undefined)
      })
    })
    
    it('does nothing if no user is found with that token', () => {
      var req = factories.mock.request()
      req.query.access_token = '4321'
      AccessTokenAuth.checkAndSetAuthenticated(req)
      .then(() => {
        expect(req.session.authenticated).to.equal(undefined)
        expect(req.session.userId).to.equal(undefined)
      })
    })
  })
})