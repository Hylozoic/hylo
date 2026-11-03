const rootPath = require('root-path')
require(rootPath('test/setup'))
const { mockify, unspyify } = require(rootPath('test/setup/helpers'))
const isAdmin = require(rootPath('api/policies/isAdmin'))
const factories = require(rootPath('test/setup/factories'))

describe('isAdmin', function () {
  let req, res, next

  beforeEach(() => {
    req = factories.mock.request()
    res = factories.mock.response()
    next = spy()
    mockify(Admin, 'isSignedIn', () => false)
  })

  afterEach(() => unspyify(Admin, 'isSignedIn'))

  const request = (method, baseUrl, path) => Object.assign(req, { method, baseUrl, path })

  it('lets anyone load kue-ui static files', () => {
    isAdmin(request('GET', '/noo/admin/kue', '/assets/vendor.js'), res, next)
    expect(next).to.have.been.called()
  })

  it('blocks kue api paths that end like a static file', () => {
    isAdmin(request('GET', '/noo/admin/kue', '/api/jobs/0..100/asc.js'), res, next)
    expect(next).not.to.have.been.called()
    expect(res.forbidden).to.have.been.called()
  })

  it('blocks admin routes that end like a static file', () => {
    isAdmin(request('GET', '', '/noo/admin/login-as/123.js'), res, next)
    expect(next).not.to.have.been.called()
  })

  it('blocks paths that climb out of the assets directory', () => {
    isAdmin(request('GET', '/noo/admin/kue', '/assets/../api/jobs/0..100/asc'), res, next)
    expect(next).not.to.have.been.called()
  })

  it('blocks requests without a session', () => {
    req.session = undefined
    isAdmin(request('GET', '/noo/admin/kue', '/api/stats'), res, next)
    expect(next).not.to.have.been.called()
  })

  it('lets admins through', () => {
    unspyify(Admin, 'isSignedIn')
    mockify(Admin, 'isSignedIn', () => true)
    isAdmin(request('GET', '/noo/admin/kue', '/api/stats'), res, next)
    expect(next).to.have.been.called()
  })
})
