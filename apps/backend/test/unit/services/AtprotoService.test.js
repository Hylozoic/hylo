import crypto from 'crypto'
import nock from 'nock'
import * as plc from '@did-plc/lib'
import { Secp256k1Keypair } from '@atproto/crypto'
import factories from '../../setup/factories'
require('../../setup')

const PLC_URL = 'https://plc.hylo.test'
const ENV = {
  ATPROTO_ENABLED: 'true',
  ATPROTO_PLC_URL: PLC_URL,
  ATPROTO_PDS_URL: 'https://pds.hylo.test',
  ATPROTO_HANDLE_DOMAIN: 'hylo.test',
  ATPROTO_ALLOWED_EMAIL_DOMAINS: 'hylo.com,terran.io',
  ATPROTO_KEY_ENCRYPTION_SECRET: crypto.randomBytes(32).toString('hex')
}

// In-memory PLC directory that validates signatures the way plc.directory does
function fakePlc () {
  const logs = {}
  const posts = []
  const data = did => {
    const { type, prev, sig, ...rest } = plc.normalizeOp(logs[did][logs[did].length - 1])
    return { did, ...rest }
  }

  const scope = nock(PLC_URL).persist()
    .post(/^\/did(:|%3A)plc(:|%3A)[a-z0-9]+$/i).reply(async (path, op) => {
      const did = decodeURIComponent(path).slice(1)
      posts.push({ did, op })
      try {
        if (!logs[did]) {
          await plc.assureValidCreationOp(did, op)
          logs[did] = [op]
        } else {
          const last = logs[did][logs[did].length - 1]
          if (last.type === 'plc_tombstone') return [400, { message: 'DID is tombstoned' }]
          if (op.type !== 'plc_tombstone' && !op.prev) return [400, { message: 'DID already exists' }]
          await plc.assureValidSig(plc.normalizeOp(last).rotationKeys, op)
          logs[did].push(op)
        }
        return [200, '']
      } catch (err) {
        return [400, { message: err.message }]
      }
    })
    .get(/^\/did(:|%3A)plc(:|%3A)[a-z0-9]+\/(data|log\/last)$/i).reply(path => {
      const [, did, kind] = decodeURIComponent(path).match(/^\/([^/]+)\/(.*)$/)
      if (!logs[did]) return [404, { message: 'DID not registered' }]
      const last = logs[did][logs[did].length - 1]
      if (last.type === 'plc_tombstone') return [410, { message: 'DID not available' }]
      return [200, kind === 'data' ? data(did) : last]
    })

  return { logs, posts, scope }
}

const uniq = () => crypto.randomBytes(4).toString('hex')

describe('AtprotoService', () => {
  let savedEnv, rotationKey, directory

  before(async () => {
    savedEnv = { ...process.env }
    // Don't let a developer's .env (e.g. sandbox settings) leak into these tests
    Object.keys(process.env).filter(k => k.startsWith('ATPROTO_')).forEach(k => delete process.env[k])
    rotationKey = await Secp256k1Keypair.create({ exportable: true })
    Object.assign(process.env, ENV, {
      ATPROTO_PLC_ROTATION_KEY_HEX: Buffer.from(await rotationKey.export()).toString('hex')
    })
  })

  after(() => {
    Object.keys(process.env).filter(k => k.startsWith('ATPROTO_')).forEach(k => delete process.env[k])
    Object.assign(process.env, savedEnv)
  })

  beforeEach(() => {
    directory = fakePlc()
  })

  afterEach(() => nock.cleanAll())

  const createUser = (email, attrs = {}) =>
    factories.user({ email, email_validated: true, ...attrs }).save()

  describe('provision', () => {
    it('registers a did:plc with the handle, PDS and keys, signed by our rotation key', async () => {
      const name = `alice${uniq()}`
      const user = await createUser(`${name}@hylo.com`)
      const identity = await AtprotoService.provision(user)

      expect(identity.get('status')).to.equal('active')
      expect(identity.get('handle')).to.equal(`${name}.hylo.test`)
      expect(directory.logs[identity.get('did')]).to.have.lengthOf(1)

      const { problems, document } = await AtprotoService.verify(identity)
      expect(problems).to.deep.equal([])
      expect(document.alsoKnownAs).to.deep.equal([`at://${name}.hylo.test`])
      expect(document.services.atproto_pds.endpoint).to.equal('https://pds.hylo.test')
      expect(document.rotationKeys).to.deep.equal([rotationKey.did()])
      expect(document.verificationMethods.atproto).to.equal((await identity.signingKey()).did())
    })

    it('gives colliding names numeric suffixes, across email domains', async () => {
      const name = `bob${uniq()}`
      const first = await AtprotoService.provision(await createUser(`${name}@hylo.com`))
      const second = await AtprotoService.provision(await createUser(`${name}@terran.io`))
      expect(first.get('handle')).to.equal(`${name}.hylo.test`)
      expect(second.get('handle')).to.equal(`${name}-2.hylo.test`)
    })

    it('accepts an explicit handle name, rejecting reserved and taken ones', async () => {
      const name = `carol${uniq()}`
      const user = await createUser(`x${uniq()}@hylo.com`)
      await expect(AtprotoService.provision(user, { handleName: 'www' })).to.be.rejectedWith(/reserved/)

      const identity = await AtprotoService.provision(user, { handleName: name })
      expect(identity.get('handle')).to.equal(`${name}.hylo.test`)

      const other = await createUser(`y${uniq()}@hylo.com`)
      await expect(AtprotoService.provision(other, { handleName: name })).to.be.rejectedWith(/already taken/)
    })

    it('refuses ineligible users without contacting the PLC', async () => {
      const unverified = await createUser(`dan${uniq()}@hylo.com`, { email_validated: false })
      await expect(AtprotoService.provision(unverified)).to.be.rejectedWith(/not verified/)
      const outsider = await createUser(`erin${uniq()}@gmail.com`)
      await expect(AtprotoService.provision(outsider)).to.be.rejectedWith(/email domain/)
      expect(directory.posts).to.have.lengthOf(0)
    })

    it('is idempotent once active', async () => {
      const user = await createUser(`fay${uniq()}@hylo.com`)
      const first = await AtprotoService.provision(user)
      const second = await AtprotoService.provision(user)
      expect(second.get('did')).to.equal(first.get('did'))
      expect(directory.posts).to.have.lengthOf(1)
    })

    it('leaves the identity pending when the PLC fails, and resubmits the same op on retry', async () => {
      const user = await createUser(`gus${uniq()}@hylo.com`)
      nock.cleanAll()
      nock(PLC_URL).post(/.*/).reply(503, { message: 'down' })
      await expect(AtprotoService.provision(user)).to.be.rejected

      const pending = await AtprotoIdentity.forUser(user.id)
      expect(pending.get('status')).to.equal('pending')

      nock.cleanAll()
      directory = fakePlc()
      const identity = await AtprotoService.provision(user)
      expect(identity.get('status')).to.equal('active')
      expect(identity.get('did')).to.equal(pending.get('did'))
      expect(directory.posts[0].op).to.deep.equal(pending.get('genesis_op'))
    })

    it('marks a pending identity active if the PLC already accepted its genesis op', async () => {
      const user = await createUser(`hal${uniq()}@hylo.com`)
      const identity = await AtprotoService.provision(user)
      await identity.save({ status: 'pending' }, { patch: true })

      // Resubmitting a genesis op for an existing DID is rejected, but the DID exists
      const retried = await AtprotoService.provision(user)
      expect(retried.get('status')).to.equal('active')
    })

    it('refuses to write to plc.directory without explicit approval', async () => {
      process.env.ATPROTO_PLC_URL = 'https://plc.directory'
      try {
        const user = await createUser(`ivy${uniq()}@hylo.com`)
        await expect(AtprotoService.provision(user)).to.be.rejectedWith(/ATPROTO_PRODUCTION_PLC_APPROVED/)
        expect(await AtprotoIdentity.forUser(user.id)).to.be.null
      } finally {
        process.env.ATPROTO_PLC_URL = PLC_URL
      }
    })
  })

  describe('updateHandle', () => {
    it('updates the handle at the PLC and locally', async () => {
      const user = await createUser(`jo${uniq()}@hylo.com`)
      const identity = await AtprotoService.provision(user)
      const newName = `jo-renamed-${uniq()}`

      const updated = await AtprotoService.updateHandle(user, newName)
      expect(updated.get('handle')).to.equal(`${newName}.hylo.test`)
      expect(directory.logs[identity.get('did')]).to.have.lengthOf(2)
      expect((await AtprotoService.verify(updated)).problems).to.deep.equal([])
    })

    it('requires an active identity', async () => {
      const user = await createUser(`kim${uniq()}@hylo.com`)
      await expect(AtprotoService.updateHandle(user, 'whatever')).to.be.rejectedWith(/no active/)
    })
  })

  describe('tombstone', () => {
    it('deactivates the DID and releases the handle', async () => {
      const name = `lee${uniq()}`
      const user = await createUser(`${name}@hylo.com`)
      const identity = await AtprotoService.provision(user)

      const tombstoned = await AtprotoService.tombstone(user)
      expect(tombstoned.get('status')).to.equal('tombstoned')
      expect(tombstoned.get('tombstoned_at')).to.exist
      expect(directory.logs[identity.get('did')].map(op => op.type)).to.deep.equal(['plc_operation', 'plc_tombstone'])
      expect((await AtprotoService.verify(tombstoned)).problems).to.deep.equal([])

      const next = await AtprotoService.provision(await createUser(`${name}@terran.io`))
      expect(next.get('handle')).to.equal(`${name}.hylo.test`)
    })

    it('tombstones a pending identity locally when the PLC never saw it', async () => {
      const user = await createUser(`mo${uniq()}@hylo.com`)
      nock.cleanAll()
      nock(PLC_URL).post(/.*/).reply(503)
      await expect(AtprotoService.provision(user)).to.be.rejected

      nock.cleanAll()
      directory = fakePlc()
      const tombstoned = await AtprotoService.tombstone(user)
      expect(tombstoned.get('status')).to.equal('tombstoned')
      expect(directory.posts).to.have.lengthOf(0)
    })
  })

  describe('instance scoping', () => {
    // A row copied in from another environment's database (e.g. prod → staging)
    const createForeignIdentity = (user, attrs = {}) => AtprotoIdentity.forge({
      user_id: user.id,
      did: `did:plc:${crypto.randomBytes(12).toString('hex')}`,
      handle: `${user.id}-${uniq()}.hylo.com`,
      plc_url: 'https://plc.directory',
      handle_domain: 'hylo.com',
      status: 'active',
      signing_key_public: 'did:key:zQ3sForeign',
      signing_key_encrypted: 'v1:foreign',
      ...attrs
    }).save()

    it('stamps new identities with this instance', async () => {
      const identity = await AtprotoService.provision(await createUser(`rae${uniq()}@hylo.com`))
      expect(identity.get('plc_url')).to.equal(PLC_URL)
      expect(identity.get('handle_domain')).to.equal('hylo.test')
    })

    it("ignores another instance's identity and provisions this instance's own", async () => {
      const user = await createUser(`sam${uniq()}@hylo.com`)
      const foreign = await createForeignIdentity(user)

      expect((await AtprotoService.status(user)).identity).to.be.null
      const ours = await AtprotoService.provision(user)
      expect(ours.id).not.to.equal(foreign.id)
      expect(ours.get('plc_url')).to.equal(PLC_URL)

      // Tombstoning only touches our identity; the foreign row and its DID are left alone
      await AtprotoService.tombstone(user)
      await foreign.refresh()
      expect(foreign.get('status')).to.equal('active')
      expect(directory.posts.map(p => p.did)).not.to.include(foreign.get('did'))
    })

    it('never queues tombstones for foreign identities', async () => {
      const queued = []
      spy.on(Queue, 'classMethod', (...args) => queued.push(args))
      try {
        const user = await createUser(`tia${uniq()}@hylo.com`)
        await createForeignIdentity(user)
        await AtprotoService.queueTombstoneForDeletedUser(user.id)
      } finally {
        spy.restore(Queue, 'classMethod')
      }
      expect(queued).to.have.lengthOf(0)
    })

    it('refuses PLC writes for a foreign identity even if handed one directly', async () => {
      const foreign = await createForeignIdentity(await createUser(`uma${uniq()}@hylo.com`), { status: 'pending' })
      await expect(AtprotoService.submitGenesis(foreign)).to.be.rejectedWith(/another instance/)
      expect(directory.posts).to.have.lengthOf(0)
    })

    it('reports foreign identities in verify without contacting the PLC', async () => {
      const foreign = await createForeignIdentity(await createUser(`val${uniq()}@hylo.com`))
      const { problems } = await AtprotoService.verify(foreign)
      expect(problems[0]).to.match(/another instance/)
    })

    it('purges foreign identities only when asked', async () => {
      const user = await createUser(`wes${uniq()}@hylo.com`)
      const ours = await AtprotoService.provision(user)
      await createForeignIdentity(user)

      const dryRun = await AtprotoService.purgeForeign()
      expect(dryRun.count).to.be.at.least(1)
      expect(dryRun.deleted).to.equal(0)
      expect(dryRun.byInstance.map(r => r.plc_url)).to.include('https://plc.directory')

      const result = await AtprotoService.purgeForeign({ delete: true })
      expect(result.deleted).to.equal(dryRun.count)
      expect((await AtprotoService.purgeForeign()).count).to.equal(0)
      expect(await AtprotoIdentity.where({ id: ours.id }).fetch()).to.exist
    })
  })

  describe('backfill', () => {
    afterEach(() => { delete process.env.ATPROTO_ALLOWED_EMAILS })

    it('provisions eligible users without an identity, honouring the allowlist', async () => {
      const id = uniq()
      const eligible = await createUser(`bf-a-${id}@hylo.com`)
      const pendingUser = await createUser(`bf-b-${id}@terran.io`)
      const unverified = await createUser(`bf-c-${id}@hylo.com`, { email_validated: false })
      const notListed = await createUser(`bf-d-${id}@hylo.com`)

      // pendingUser starts with a pending identity (PLC was down)
      nock.cleanAll()
      nock(PLC_URL).post(/.*/).reply(503)
      await expect(AtprotoService.provision(pendingUser)).to.be.rejected
      nock.cleanAll()
      directory = fakePlc()

      process.env.ATPROTO_ALLOWED_EMAILS = [eligible, pendingUser, unverified].map(u => u.get('email')).join(',')

      const candidates = (await AtprotoService.backfillCandidates()).map(u => u.id)
      expect(candidates).to.have.members([eligible.id, pendingUser.id])
      expect(candidates).not.to.include(notListed.id)

      const seen = []
      const results = await AtprotoService.backfill({ onResult: r => seen.push(r) })
      expect(results).to.deep.equal({ provisioned: 2, failed: 0 })
      expect(seen.every(r => r.identity.get('status') === 'active')).to.be.true
      expect(await AtprotoService.backfillCandidates()).to.have.lengthOf(0)
    })

    it('keeps going when one user fails', async () => {
      const id = uniq()
      const good = await createUser(`bf-e-${id}@hylo.com`)
      // No handle can be derived from this email, so provisioning it fails
      const bad = await createUser(`+${id}@hylo.com`)
      process.env.ATPROTO_ALLOWED_EMAILS = [good, bad].map(u => u.get('email')).join(',')

      const results = await AtprotoService.backfill()
      expect(results).to.deep.equal({ provisioned: 1, failed: 1 })
    })
  })

  describe('queueTombstoneForDeletedUser', () => {
    let queued

    beforeEach(() => {
      queued = []
      spy.on(Queue, 'classMethod', (...args) => queued.push(args))
    })

    afterEach(() => spy.restore(Queue, 'classMethod'))

    it('queues a tombstone only for users with a live identity', async () => {
      const withIdentity = await createUser(`ned${uniq()}@hylo.com`)
      await AtprotoService.provision(withIdentity)
      const without = await createUser(`ola${uniq()}@hylo.com`)

      await AtprotoService.queueTombstoneForDeletedUser(withIdentity.id)
      await AtprotoService.queueTombstoneForDeletedUser(without.id)
      expect(queued).to.deep.equal([['AtprotoService', 'tombstoneForDeletedUser', { userId: withIdentity.id }]])
    })

    it('does nothing when the feature is disabled', async () => {
      const user = await createUser(`pat${uniq()}@hylo.com`)
      await AtprotoService.provision(user)
      process.env.ATPROTO_ENABLED = 'false'
      try {
        await AtprotoService.queueTombstoneForDeletedUser(user.id)
      } finally {
        process.env.ATPROTO_ENABLED = 'true'
      }
      expect(queued).to.have.lengthOf(0)
    })

    it('runs from the queue job for a deleted (inactive) user', async () => {
      const user = await createUser(`quin${uniq()}@hylo.com`)
      await AtprotoService.provision(user)
      await user.save({ active: false }, { patch: true })
      const tombstoned = await AtprotoService.tombstoneForDeletedUser({ userId: user.id })
      expect(tombstoned.get('status')).to.equal('tombstoned')
    })
  })
})
