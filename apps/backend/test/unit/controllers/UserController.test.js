var root = require('root-path')
var setup = require(root('test/setup'))
var factories = require(root('test/setup/factories'))
var UserController = require(root('api/controllers/UserController'))
import jwt from 'jsonwebtoken'

describe('UserController', function () {
  let req, res

  beforeEach(function () {
    req = factories.mock.request()
    res = factories.mock.response()
    return setup.clearDb()
  })

  describe('.create', function () {
    beforeEach(async () => {
      Object.assign(res, {
        send: console.error
      })
      User.create = spy(User.create)
      await new Group({ access_code: 'foo', name: 'foo', slug: 'foo' }).save()
    })

    it('rejects requests without a super API client', async () => {
      Object.assign(req.params, {
        name: 'yoyo',
        email: 'anon@bar.com',
        isAdministrator: 'true'
      })
      await UserController.create(req, res)

      expect(res.statusCode).to.equal(403)
      expect(User.create).not.to.have.been.called()
      const testUser = await User.where({ email: 'anon@bar.com' }).fetch()
      expect(testUser).to.not.exist
    })

    it('works with a username and password', async () => {
      req.api_client = { id: 'test-client', name: 'Test', super: true }
      Object.assign(req.params, {
        name: 'yoyo',
        email: 'foo@bar.com',
        password: 'password!'
      })
      await UserController.create(req, res)

      expect(User.create).to.have.been.called()
      expect(res.ok).to.have.been.called()

      const testUser = await User.where({email: 'foo@bar.com'}).fetch()

      expect(testUser.get('active')).to.be.false
      expect(testUser.get('name')).to.equal('yoyo')
    })
  })

  describe('with an existing user', () => {
    describe('.create', () => {
      it('halts on duplicate email', async () => {
        req.api_client = { id: 'test-client', name: 'Test', super: true }
        await factories.user({settings: {leftNavIsOpen: true, currentGroupId: '7'}}).save()
        const testUser = await factories.user().save()
        Object.assign(req.params, { name: 'Sweet', email: testUser.get('email')})
        await UserController.create(req, res)

        expect(res.body).to.deep.equal({ message: 'User already exists' })
      })
    })
  })
})
