// Verifies Hylo-hosted identities the way other AT Protocol services see them: over the
// sandbox's real DNS + HTTPS, using the official resolver and the reference PDS (pds1).
// Usage (via ../hylo/verify.sh): node verify-hylo.mjs <handle> [<handle>...]
import { IdResolver } from '@atproto/identity'

const DOMAIN = process.env.AIAB_DOMAIN || 'atmosbox.test'
const HYLO_PDS = `https://pds.hylo.${DOMAIN}`
const REFERENCE_PDS = `https://pds1.${DOMAIN}`

// The default fetch is SSRF-protected and refuses the sandbox's private addresses.
// Plain fetch still verifies TLS against the sandbox CA (NODE_EXTRA_CA_CERTS).
const resolver = new IdResolver({ plcUrl: `https://plc.${DOMAIN}`, fetch: globalThis.fetch })

let failures = 0
const check = (ok, label, detail = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? '✔' : '✘'} ${label}${detail ? ` — ${detail}` : ''}`)
}

async function resolveVia (pds, handle) {
  const res = await fetch(`${pds}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`)
  const body = await res.json().catch(() => ({}))
  return res.ok ? body.did : undefined
}

async function verifyHandle (handle) {
  console.log(`\n${handle}`)
  const did = await resolver.handle.resolve(handle)
  check(!!did, 'official resolver: handle → DID over HTTPS', did)
  if (!did) return

  const data = await resolver.did.resolveAtprotoData(did, true).catch(err => ({ error: err.message }))
  check(data.handle === handle, 'DID document lists the same handle (bidirectional)', data.error || data.handle)
  check(data.pds === HYLO_PDS, 'DID document points at the Hylo PDS', data.pds)

  check(await resolveVia(REFERENCE_PDS, handle) === did, 'reference PDS (pds1) resolves it to the same DID')
  check(await resolveVia(HYLO_PDS, handle) === did, 'Hylo PDS resolveHandle agrees')
}

async function verifyServer () {
  console.log(`\n${HYLO_PDS}`)
  const describe = await fetch(`${HYLO_PDS}/xrpc/com.atproto.server.describeServer`).then(r => r.json())
  check(describe.availableUserDomains?.includes(`.hylo.${DOMAIN}`), 'describeServer advertises the handle domain')
  const unknown = await fetch(`${HYLO_PDS}/xrpc/com.atproto.sync.getRepo?did=did:plc:x`)
  check(unknown.status === 501, 'unimplemented XRPC methods return 501', String(unknown.status))

  const nobody = `nobody-${Date.now().toString(36)}.hylo.${DOMAIN}`
  check(await resolver.handle.resolve(nobody) === undefined, 'unknown handles do not resolve', nobody)
  check(await resolveVia(REFERENCE_PDS, nobody) === undefined, 'reference PDS cannot resolve unknown handles either')
}

const handles = process.argv.slice(2)
if (handles.length === 0) {
  console.error('No handles to verify (provision some with `yarn atproto provision`)')
  process.exit(1)
}

await verifyServer()
for (const handle of handles) await verifyHandle(handle)

console.log(failures === 0 ? '\n✅ All checks passed' : `\n❌ ${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
