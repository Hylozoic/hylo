// Phase 0 spike: exercise the did:plc lifecycle Hylo will need, against the AiaB PLC.
// Run inside the sandbox network via ./run.sh (never against plc.directory).
import assert from 'node:assert/strict'
import { Secp256k1Keypair } from '@atproto/crypto'
import * as plc from '@did-plc/lib'
import { DidResolver } from '@atproto/identity'

const PLC_URL = process.env.ATPROTO_PLC_URL || 'https://plc.atmosbox.test'
const HANDLE_DOMAIN = process.env.ATPROTO_HANDLE_DOMAIN || 'hylo.atmosbox.test'
const PDS_URL = process.env.ATPROTO_PDS_URL || 'https://pds.hylo.atmosbox.test'

assert.ok(!PLC_URL.includes('plc.directory'), 'Refusing to run spike against production PLC')

const step = (msg) => console.log(`\n▶ ${msg}`)

// Server-level rotation key (prod: env var / KMS) and per-user repo signing key (prod: encrypted in Postgres)
const rotationKey = await Secp256k1Keypair.create({ exportable: true })
const signingKey = await Secp256k1Keypair.create({ exportable: true })

step('Key export/import round-trip (what we would encrypt + store)')
const restored = await Secp256k1Keypair.import(await signingKey.export(), { exportable: true })
assert.equal(restored.did(), signingKey.did())
console.log('  signing key', signingKey.did())
console.log('  rotation key', rotationKey.did())

const client = new plc.Client(PLC_URL)
const handle = `spike-${Date.now().toString(36)}.${HANDLE_DOMAIN}`

step(`Create genesis op for ${handle}`)
const { op, did } = await plc.createOp({
  signingKey: signingKey.did(),
  handle,
  pds: PDS_URL,
  rotationKeys: [rotationKey.did()],
  signer: rotationKey
})
await client.sendOperation(did, op)
console.log('  did', did)

step('Resolve DID document via PLC client')
const data = await client.getDocumentData(did)
assert.deepEqual(data.alsoKnownAs, [`at://${handle}`])
assert.equal(data.services.atproto_pds.endpoint, PDS_URL)
assert.equal(data.verificationMethods.atproto, signingKey.did())
console.log(JSON.stringify(await client.getDocument(did), null, 2))

step('Resolve + parse via @atproto/identity (what other atproto services do)')
// The default fetch is SSRF-protected and refuses AiaB's private IPs. Plain fetch still
// verifies TLS (via NODE_EXTRA_CA_CERTS); Hylo must only do this behind a sandbox-only flag.
const resolver = new DidResolver({ plcUrl: PLC_URL, fetch: globalThis.fetch })
const atpData = await resolver.resolveAtprotoData(did, true)
assert.equal(atpData.handle, handle)
assert.equal(atpData.pds, PDS_URL)
assert.equal(atpData.signingKey, signingKey.did())
console.log('  ok', atpData)

step('Update handle (user renames)')
const newHandle = `renamed-${Date.now().toString(36)}.${HANDLE_DOMAIN}`
await client.updateHandle(did, rotationKey, newHandle)
assert.deepEqual((await client.getDocumentData(did)).alsoKnownAs, [`at://${newHandle}`])
console.log('  now', newHandle)

step('Reject update signed by a non-rotation key')
await assert.rejects(client.updateHandle(did, signingKey, `nope.${HANDLE_DOMAIN}`))
console.log('  rejected as expected')

step('Tombstone (account deleted)')
await client.tombstone(did, rotationKey)
await assert.rejects(client.getDocumentData(did))
const log = await client.getAuditableLog(did)
console.log(`  tombstoned; audit log has ${log.length} ops:`, log.map(e => e.operation.type).join(' → '))

console.log('\n✅ PLC lifecycle spike passed')
