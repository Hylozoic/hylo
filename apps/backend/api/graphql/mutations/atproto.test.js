import crypto from 'crypto'
import nock from 'nock'
import { Secp256k1Keypair } from '@atproto/crypto'
// Must load before ../index, which reads the Stripe placeholders the test setup provides
import '../../../test/setup'
import { createRequestHandler } from '../index'
import factories from '../../../test/setup/factories'
import createFakePlc from '../../../test/setup/fakePlc'

const PLC_URL = 'https://plc.hylo.test'
const uniq = () => crypto.randomBytes(4).toString('hex')

const STATUS_FIELDS = 'enabled eligible proposedHandle identity { did handle status }'

describe('AT Protocol GraphQL', () => {
  let handler, savedEnv, directory

  before(async () => {
    handler = createRequestHandler()
    savedEnv = { ...process.env }
    Object.keys(process.env).filter(k => k.startsWith('ATPROTO_')).forEach(k => delete process.env[k])
    const rotationKey = await Secp256k1Keypair.create({ exportable: true })
    Object.assign(process.env, {
      ATPROTO_ENABLED: 'true',
      ATPROTO_PLC_URL: PLC_URL,
      ATPROTO_PDS_URL: 'https://pds.hylo.test',
      ATPROTO_HANDLE_DOMAIN: 'hylo.test',
      ATPROTO_ALLOWED_EMAIL_DOMAINS: 'hylo.com,terran.io',
      ATPROTO_KEY_ENCRYPTION_SECRET: crypto.randomBytes(32).toString('hex'),
      ATPROTO_PLC_ROTATION_KEY_HEX: Buffer.from(await rotationKey.export()).toString('hex')
    })
  })

  after(() => {
    Object.keys(process.env).filter(k => k.startsWith('ATPROTO_')).forEach(k => delete process.env[k])
    Object.assign(process.env, savedEnv)
  })

  beforeEach(() => { directory = createFakePlc(PLC_URL) })
  afterEach(() => nock.cleanAll())

  async function run (user, document) {
    const req = factories.mock.request()
    Object.assign(req, {
      url: '/noo/graphql',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      session: { userId: user.id, destroy: () => {} },
      user
    })
    const { executionResult } = await handler.inject({ document, serverContext: { req, res: factories.mock.response() } })
    return executionResult
  }

  const createUser = (email, attrs = {}) => factories.user({ email, email_validated: true, ...attrs }).save()
  const meStatus = async user => (await run(user, `{ me { atproto { ${STATUS_FIELDS} } } }`)).data.me.atproto

  describe('me.atproto', () => {
    it('offers eligible users the handle they would get', async () => {
      const name = `gq${uniq()}`
      expect(await meStatus(await createUser(`${name}@hylo.com`))).to.deep.equal({
        enabled: true, eligible: true, proposedHandle: `${name}.hylo.test`, identity: null
      })
    })

    it('tells ineligible users nothing more', async () => {
      expect(await meStatus(await createUser(`gq${uniq()}@gmail.com`))).to.deep.equal({
        enabled: true, eligible: false, proposedHandle: null, identity: null
      })
    })

    it('reports the feature as off when disabled', async () => {
      process.env.ATPROTO_ENABLED = 'false'
      try {
        expect(await meStatus(await createUser(`gq${uniq()}@hylo.com`))).to.deep.equal({
          enabled: false, eligible: false, proposedHandle: null, identity: null
        })
      } finally {
        process.env.ATPROTO_ENABLED = 'true'
      }
    })
  })

  describe('createAtprotoIdentity', () => {
    const create = user => run(user, `mutation { createAtprotoIdentity { ${STATUS_FIELDS} } }`)

    it('creates the identity and returns it', async () => {
      const name = `gq${uniq()}`
      const user = await createUser(`${name}@terran.io`)
      const result = await create(user)

      expect(result.errors).to.be.undefined
      const { identity } = result.data.createAtprotoIdentity
      expect(identity).to.include({ handle: `${name}.hylo.test`, status: 'active' })
      expect(directory.logs[identity.did]).to.have.lengthOf(1)
      expect((await meStatus(user)).identity.did).to.equal(identity.did)
    })

    it('refuses ineligible users', async () => {
      const result = await create(await createUser(`gq${uniq()}@gmail.com`))
      expect(result.errors[0].message).to.equal('You are not able to create an AT Protocol identity')
      expect(directory.posts).to.have.lengthOf(0)
    })

    it('hides PLC failure details from the user', async () => {
      nock.cleanAll()
      nock(PLC_URL).post(/.*/).reply(503, { message: 'internal PLC detail' })
      const result = await create(await createUser(`gq${uniq()}@hylo.com`))
      expect(result.errors[0].message).to.match(/could not be created right now/)
      expect(result.errors[0].message).not.to.match(/PLC detail|503/)
    })
  })
})
