import crypto from 'crypto'
import { expect } from 'chai'
import { Secp256k1Keypair } from '@atproto/crypto'
import {
  parseEncryptionSecret,
  encryptPrivateKey,
  decryptPrivateKey,
  generateSigningKey,
  loadSigningKey,
  loadRotationKey
} from '../../../../lib/atproto/keys'

const secret = crypto.randomBytes(32).toString('hex')

describe('atproto keys', () => {
  describe('parseEncryptionSecret', () => {
    it('accepts 32 bytes as hex or base64', () => {
      const bytes = crypto.randomBytes(32)
      expect(parseEncryptionSecret(bytes.toString('hex')).equals(bytes)).to.be.true
      expect(parseEncryptionSecret(bytes.toString('base64')).equals(bytes)).to.be.true
    })

    it('rejects missing or wrongly sized secrets', () => {
      expect(() => parseEncryptionSecret()).to.throw(/Missing/)
      expect(() => parseEncryptionSecret('abcd')).to.throw(/32 bytes/)
    })
  })

  describe('encryptPrivateKey / decryptPrivateKey', () => {
    const keyBytes = crypto.randomBytes(32)

    it('round-trips and never repeats ciphertext', () => {
      const a = encryptPrivateKey(keyBytes, { secret, userId: 1 })
      const b = encryptPrivateKey(keyBytes, { secret, userId: 1 })
      expect(a).to.match(/^v1:/)
      expect(a).not.to.equal(b)
      expect(Buffer.from(decryptPrivateKey(a, { secret, userId: 1 })).equals(keyBytes)).to.be.true
    })

    it('fails for a different user id (ciphertext is bound to its row)', () => {
      const encrypted = encryptPrivateKey(keyBytes, { secret, userId: 1 })
      expect(() => decryptPrivateKey(encrypted, { secret, userId: 2 })).to.throw()
    })

    it('fails with the wrong secret or tampered data', () => {
      const encrypted = encryptPrivateKey(keyBytes, { secret, userId: 1 })
      const otherSecret = crypto.randomBytes(32).toString('hex')
      expect(() => decryptPrivateKey(encrypted, { secret: otherSecret, userId: 1 })).to.throw()

      const raw = Buffer.from(encrypted.slice(3), 'base64')
      raw[raw.length - 1] ^= 1
      expect(() => decryptPrivateKey(`v1:${raw.toString('base64')}`, { secret, userId: 1 })).to.throw()
    })

    it('rejects unknown formats', () => {
      expect(() => decryptPrivateKey('v0:abc', { secret, userId: 1 })).to.throw(/format/)
    })
  })

  describe('generateSigningKey / loadSigningKey', () => {
    it('restores the same keypair from its encrypted form', async () => {
      const { keypair, publicKey, encrypted } = await generateSigningKey({ secret, userId: 7 })
      expect(publicKey).to.match(/^did:key:zQ3s/)
      const restored = await loadSigningKey(encrypted, { secret, userId: 7 })
      expect(restored.did()).to.equal(keypair.did())

      const data = new TextEncoder().encode('hello')
      expect(Buffer.from(await restored.sign(data)).equals(Buffer.from(await keypair.sign(data)))).to.be.true
    })
  })

  describe('loadRotationKey', () => {
    it('loads a hex secp256k1 private key', async () => {
      const original = await Secp256k1Keypair.create({ exportable: true })
      const hex = Buffer.from(await original.export()).toString('hex')
      expect((await loadRotationKey(hex)).did()).to.equal(original.did())
    })

    it('rejects malformed keys', () => {
      expect(() => loadRotationKey('not-a-key')).to.throw(/64-character hex/)
      expect(() => loadRotationKey()).to.throw()
    })
  })
})
