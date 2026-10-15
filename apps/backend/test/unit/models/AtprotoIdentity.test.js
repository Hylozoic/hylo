import crypto from 'crypto'
import { generateSigningKey } from '../../../lib/atproto/keys'
require('../../setup')
const factories = require('../../setup/factories')

const secret = crypto.randomBytes(32).toString('hex')
const config = { keyEncryptionSecret: secret }

async function createIdentity (user, attrs = {}) {
  const { publicKey, encrypted } = await generateSigningKey({ secret, userId: user.id })
  return AtprotoIdentity.forge({
    user_id: user.id,
    did: `did:plc:${crypto.randomBytes(12).toString('hex')}`,
    handle: `${user.id}.hylo.atmosbox.test`,
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
    const identity = await createIdentity(alice, { handle: 'alice-find.hylo.atmosbox.test', status: 'active' })
    const found = await AtprotoIdentity.findActiveByHandle('Alice-Find.hylo.atmosbox.test')
    expect(found.id).to.equal(identity.id)

    await identity.save({ status: 'tombstoned' })
    expect(await AtprotoIdentity.findActiveByHandle('alice-find.hylo.atmosbox.test')).to.be.null
  })

  it('allows one identity per user', async () => {
    await createIdentity(alice)
    await expect(createIdentity(alice, { handle: 'other.hylo.atmosbox.test' })).to.be.rejectedWith(/unique/)
  })

  it('keeps handles unique until an identity is tombstoned', async () => {
    const handle = 'shared.hylo.atmosbox.test'
    const first = await createIdentity(alice, { handle, status: 'active' })
    await expect(createIdentity(bob, { handle })).to.be.rejectedWith(/unique/)

    await first.save({ status: 'tombstoned', tombstoned_at: new Date() })
    const second = await createIdentity(bob, { handle })
    expect(second.get('handle')).to.equal(handle)
  })
})
