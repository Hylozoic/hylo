/**
 * Key management for AT Protocol identities.
 *
 * - Rotation key: one server-wide secp256k1 key (from env) that signs PLC operations.
 *   Losing it means losing control of every DID Hylo has created, so it must be backed up.
 * - Signing keys: one secp256k1 key per user (their repo signing key), stored encrypted
 *   with AES-256-GCM. Ciphertext is bound to the user id so it can't be moved between rows.
 */
import crypto from 'crypto'
import { Secp256k1Keypair } from '@atproto/crypto'

const VERSION = 'v1'
const IV_BYTES = 12
const TAG_BYTES = 16

export function parseEncryptionSecret (secret) {
  if (!secret) throw new Error('Missing AT Protocol key encryption secret')
  const key = /^[0-9a-f]{64}$/i.test(secret)
    ? Buffer.from(secret, 'hex')
    : Buffer.from(secret, 'base64')
  if (key.length !== 32) throw new Error('AT Protocol key encryption secret must be 32 bytes (hex or base64)')
  return key
}

const aadFor = userId => Buffer.from(`hylo-atproto-signing-key:user:${userId}`)

export function encryptPrivateKey (privateKeyBytes, { secret, userId }) {
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv('aes-256-gcm', parseEncryptionSecret(secret), iv)
  cipher.setAAD(aadFor(userId))
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(privateKeyBytes)), cipher.final()])
  return `${VERSION}:${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')}`
}

export function decryptPrivateKey (encrypted, { secret, userId }) {
  const [version, payload] = (encrypted || '').split(':')
  if (version !== VERSION || !payload) throw new Error('Unrecognized encrypted key format')

  const data = Buffer.from(payload, 'base64')
  const iv = data.subarray(0, IV_BYTES)
  const tag = data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = data.subarray(IV_BYTES + TAG_BYTES)

  const decipher = crypto.createDecipheriv('aes-256-gcm', parseEncryptionSecret(secret), iv)
  decipher.setAAD(aadFor(userId))
  decipher.setAuthTag(tag)
  return new Uint8Array(Buffer.concat([decipher.update(ciphertext), decipher.final()]))
}

/**
 * Creates a new signing keypair for a user.
 * Returns the keypair, its public did:key, and the encrypted private key to store.
 */
export async function generateSigningKey ({ secret, userId }) {
  const keypair = await Secp256k1Keypair.create({ exportable: true })
  const encrypted = encryptPrivateKey(await keypair.export(), { secret, userId })
  return { keypair, publicKey: keypair.did(), encrypted }
}

export function loadSigningKey (encrypted, { secret, userId }) {
  return Secp256k1Keypair.import(decryptPrivateKey(encrypted, { secret, userId }))
}

export function loadRotationKey (hex) {
  if (!/^[0-9a-f]{64}$/i.test(hex || '')) throw new Error('AT Protocol rotation key must be a 64-character hex secp256k1 private key')
  return Secp256k1Keypair.import(hex)
}
