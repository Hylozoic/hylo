import crypto from 'crypto'
import { generateSigningKey } from '../../../lib/atproto/keys'
require('../../setup')
const factories = require('../../setup/factories')

const secret = crypto.randomBytes(32).toString('hex')
const PLC_URL = 'https://plc.hylo.test'
const OTHER_PLC_URL = 'https://plc.other.test'
const config = { plcUrl: PLC_URL, handleDomain: 'hylo.test', keyEncryptionSecret: secret }
const otherConfig = { plcUrl: OTHER_PLC_URL, handleDomain: 'other.test', keyEncryptionSecret: secret }

async function createIdentity (user, attrs = {}) {
  const { publicKey, encrypted } = await generateSigningKey({ secret, userId: user.id })
  return AtprotoIdentity.forge({
    user_id: user.id,
    did: `did:plc:${crypto.randomBytes(12).toString('hex')}`,
    handle: `u${user.id}.hylo.test`,
    plc_url: PLC_URL,
    handle_domain: 'hylo.test',
    signing_key_public: publicKey,
    signing_key_encrypted: encrypted,
    ...attrs
  }).save()
}

describe('AtprotoIdentity', () => {
  let alice, bob

  beforeEach(async () => {
    alice = await factories.user().save()
    bob = await factories.user().save()
  })

  it('defaults to pending and decrypts its signing key', async () => {
    const identity = await createIdentity(alice)
    await identity.refresh()
    expect(identity.get('status')).to.equal(AtprotoIdentity.STATUS.Pending)
    expect(identity.isActive()).to.be.false
    const key = await identity.signingKey(config)
    expect(key.did()).to.equal(identity.get('signing_key_public'))
  })

  it('is reachable from the user', async () => {
    const identity = await createIdentity(alice)
    await alice.load('atprotoIdentity')
    expect(alice.relations.atprotoIdentity.id).to.equal(identity.id)
  })

  it('finds active identities by handle case-insensitively', async () => {
    const identity = await createIdentity(alice, { handle: 'alice-find.hylo.test', status: 'active' })
    const found = await AtprotoIdentity.findActiveByHandle('Alice-Find.hylo.test', { config })
    expect(found.id).to.equal(identity.id)

    await identity.save({ status: 'tombstoned' })
    expect(await AtprotoIdentity.findActiveByHandle('alice-find.hylo.test', { config })).to.be.null
  })

  describe('instance scoping', () => {
    it("only finds this instance's identities", async () => {
      const ours = await createIdentity(alice, { status: 'active' })
      const theirs = await createIdentity(bob, {
        plc_url: OTHER_PLC_URL, handle_domain: 'other.test', handle: `u${bob.id}.other.test`, status: 'active'
      })

      expect((await AtprotoIdentity.forUser(alice.id, { config })).id).to.equal(ours.id)
      expect(await AtprotoIdentity.forUser(bob.id, { config })).to.be.null
      expect(await AtprotoIdentity.findByDid(theirs.get('did'), { config })).to.be.null
      expect(await AtprotoIdentity.findActiveByHandle(theirs.get('handle'), { config })).to.be.null
      expect((await AtprotoIdentity.forUser(bob.id, { config: otherConfig })).id).to.equal(theirs.id)

      expect(ours.belongsToInstance(config)).to.be.true
      expect(theirs.belongsToInstance(config)).to.be.false
    })

    it('counts and selects foreign rows', async () => {
      const theirs = await createIdentity(bob, { plc_url: OTHER_PLC_URL, handle_domain: 'other.test', handle: `u${bob.id}.other.test` })
      const ids = (await AtprotoIdentity.foreignQuery(config).select('id')).map(r => r.id)
      expect(ids).to.include(theirs.id)
    })
  })

  it('allows one identity per user per PLC directory', async () => {
    await createIdentity(alice)
    await expect(createIdentity(alice, { handle: 'other.hylo.test' })).to.be.rejectedWith(/unique/)

    // The same user can also have an identity from another instance (e.g. a prod clone)
    const foreign = await createIdentity(alice, { plc_url: OTHER_PLC_URL, handle_domain: 'other.test', handle: `u${alice.id}.other.test` })
    expect(foreign.id).to.exist
  })

  it('keeps handles unique until an identity is tombstoned', async () => {
    const handle = `shared-${crypto.randomBytes(3).toString('hex')}.hylo.test`
    const first = await createIdentity(alice, { handle, status: 'active' })
    await expect(createIdentity(bob, { handle })).to.be.rejectedWith(/unique/)

    await first.save({ status: 'tombstoned', tombstoned_at: new Date() })
    const second = await createIdentity(bob, { handle })
    expect(second.get('handle')).to.equal(handle)
  })
})
