import crypto from 'crypto'
import atprotoMiddleware from '../../../../lib/atproto/http'
import factories from '../../../setup/factories'
require('../../../setup')

const ENV = {
  ATPROTO_ENABLED: 'true',
  ATPROTO_PLC_URL: 'https://plc.hylo.test',
  ATPROTO_PDS_URL: 'https://pds.hylo.test',
  ATPROTO_HANDLE_DOMAIN: 'hylo.test'
}

// Just enough of Express's req/res for the middleware
const request = ({ path, hostname = 'api.hylo.test', method = 'GET', query = {} }) => ({ path, hostname, method, query })

function response () {
  const res = {
    statusCode: 200,
    headers: {},
    status (code) { res.statusCode = code; return res },
    set (name, value) { res.headers[name.toLowerCase()] = value; return res },
    type (value) { res.headers['content-type'] = value; return res },
    send (body) { res.body = body; return res },
    json (body) { res.headers['content-type'] = 'application/json'; res.body = body; return res },
    end () { return res }
  }
  return res
}

async function call (req) {
  const res = response()
  let passedThrough = false
  await atprotoMiddleware(req, res, () => { passedThrough = true })
  return { res, passedThrough }
}

describe('AT Protocol HTTP endpoints', () => {
  let savedEnv, name, did

  before(async () => {
    savedEnv = { ...process.env }
    Object.keys(process.env).filter(k => k.startsWith('ATPROTO_')).forEach(k => delete process.env[k])
    Object.assign(process.env, ENV)

    const user = await factories.user().save()
    name = `res${crypto.randomBytes(4).toString('hex')}`
    did = `did:plc:${crypto.randomBytes(12).toString('hex')}`
    await AtprotoIdentity.forge({
      user_id: user.id,
      did,
      handle: `${name}.hylo.test`,
      status: 'active',
      signing_key_public: 'did:key:zQ3sTest',
      signing_key_encrypted: 'v1:test'
    }).save()

    const tombstonedUser = await factories.user().save()
    await AtprotoIdentity.forge({
      user_id: tombstonedUser.id,
      did: `did:plc:${crypto.randomBytes(12).toString('hex')}`,
      handle: `gone-${name}.hylo.test`,
      status: 'tombstoned',
      signing_key_public: 'did:key:zQ3sTest',
      signing_key_encrypted: 'v1:test'
    }).save()
  })

  after(() => {
    Object.keys(process.env).filter(k => k.startsWith('ATPROTO_')).forEach(k => delete process.env[k])
    Object.assign(process.env, savedEnv)
  })

  describe('/.well-known/atproto-did', () => {
    const wellKnown = hostname => call(request({ path: '/.well-known/atproto-did', hostname }))

    it('returns the DID for an active handle, by Host', async () => {
      const { res } = await wellKnown(`${name}.hylo.test`)
      expect(res.statusCode).to.equal(200)
      expect(res.headers['content-type']).to.equal('text/plain')
      expect(res.body).to.equal(did)
      expect(res.headers['access-control-allow-origin']).to.equal('*')
    })

    it('matches the Host case-insensitively', async () => {
      const { res } = await wellKnown(`${name.toUpperCase()}.Hylo.Test`)
      expect(res.body).to.equal(did)
    })

    it('404s for unknown, tombstoned, deeper and foreign hosts', async () => {
      for (const host of ['nobody.hylo.test', `gone-${name}.hylo.test`, `a.${name}.hylo.test`, 'hylo.test', `${name}.example.com`]) {
        const { res } = await wellKnown(host)
        expect(res.statusCode, host).to.equal(404)
      }
    })
  })

  describe('resolveHandle', () => {
    const resolve = handle => call(request({ path: '/xrpc/com.atproto.identity.resolveHandle', query: { handle } }))

    it('resolves our active handles', async () => {
      const { res } = await resolve(`${name}.HYLO.test`)
      expect(res.statusCode).to.equal(200)
      expect(res.body).to.deep.equal({ did })
    })

    it('rejects missing, invalid, unknown and foreign handles with XRPC errors', async () => {
      expect((await resolve(undefined)).res.body.message).to.match(/Missing/)
      for (const handle of ['not a handle', 'nobody.hylo.test', `gone-${name}.hylo.test`, 'alice.bsky.social']) {
        const { res } = await resolve(handle)
        expect(res.statusCode, handle).to.equal(400)
        expect(res.body.error).to.equal('InvalidRequest')
      }
    })
  })

  it('describes the server', async () => {
    const { res } = await call(request({ path: '/xrpc/com.atproto.server.describeServer' }))
    expect(res.body).to.deep.equal({
      did: 'did:web:pds.hylo.test',
      availableUserDomains: ['.hylo.test'],
      inviteCodeRequired: true,
      links: {},
      contact: {}
    })
  })

  it('reports health', async () => {
    const { res } = await call(request({ path: '/xrpc/_health' }))
    expect(res.body.version).to.be.a('string')
  })

  it('answers unknown XRPC methods with MethodNotImplemented', async () => {
    const { res } = await call(request({ path: '/xrpc/com.atproto.sync.getRepo' }))
    expect(res.statusCode).to.equal(501)
    expect(res.body.error).to.equal('MethodNotImplemented')
  })

  it('handles CORS preflight and rejects writes', async () => {
    const preflight = await call(request({ path: '/xrpc/_health', method: 'OPTIONS' }))
    expect(preflight.res.statusCode).to.equal(204)
    const post = await call(request({ path: '/xrpc/com.atproto.server.createAccount', method: 'POST' }))
    expect(post.res.statusCode).to.equal(405)
  })

  it('passes through other paths, and everything when the feature is off', async () => {
    expect((await call(request({ path: '/noo/graphql' }))).passedThrough).to.be.true

    process.env.ATPROTO_ENABLED = 'false'
    try {
      expect((await call(request({ path: '/xrpc/_health' }))).passedThrough).to.be.true
    } finally {
      process.env.ATPROTO_ENABLED = 'true'
    }
  })
})
