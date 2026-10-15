# Hylo as an AT Protocol PDS (experiment)

Goal: Hylo's backend acts as a Personal Data Server (PDS) for the AT Protocol, starting
with **DIDs and handles** for Hylo staff. Posting AT Protocol data, and letting other apps
see it, are explicitly out of scope for now.

Branch: `atproto-pds-experiment`

## Decisions

| Topic | Decision |
| --- | --- |
| Build vs. run the official PDS | Build the identity layer **inside the Hylo backend** |
| DID method | `did:plc`. Portable, so we can move to the official PDS later by updating the DID document |
| Who is eligible | Active users with a **verified** email on `hylo.com` or `terran.io` |
| Handle domain | Everyone eligible gets `<name>.hylo.com`. `*.hylo.social` is reserved for regular members later |
| Initial handle name | Local part of the email (`alice.smith@terran.io` → `alice-smith.hylo.com`), with `-2`, `-3`… on collision. Replaced by user choice in Phase 6 |
| Local dev environment | [Atmosphere in a Box](https://tangled.org/kandake.africa/atmosphereinabox), pinned in `tools/atproto-sandbox/` |
| Reference PDS | Run one stock PDS in the sandbox alongside Hylo for comparison |
| Sandbox data | Hylo's sandbox container seeds its own test users |
| Production PLC | Nothing goes on `plc.directory` until explicitly approved |

## Architecture

```
handle (alice.hylo.com) ──resolves to──▶ did:plc:…
DID document ──alsoKnownAs──▶ at://alice.hylo.com     (must match the handle)
DID document ──#atproto_pds──▶ https://<ATPROTO_PDS_URL> (Hylo backend)
DID document ──#atproto key──▶ user's signing key (encrypted in Postgres)
```

- **Handle resolution:** `GET https://alice.hylo.com/.well-known/atproto-did` returns the DID.
  This needs wildcard DNS and TLS for `*.hylo.com` pointing at the backend, and the Host header
  identifies the user.
- **Rotation key:** one server-wide secp256k1 key (`ATPROTO_PLC_ROTATION_KEY_HEX`) signs all
  PLC operations. If it is lost, Hylo loses control of every DID it created, so back it up.
- **Signing keys:** one per user, encrypted with AES-256-GCM (`ATPROTO_KEY_ENCRYPTION_SECRET`)
  and bound to the user id.
- **Sandbox mode** (`ATPROTO_SANDBOX=true`) lets identity resolution reach private addresses.
  `@atproto/identity` blocks them by default to prevent server-side request forgery (SSRF).
  Sandbox mode is refused when pointed at the production PLC.

Code: `apps/backend/lib/atproto/`, `apps/backend/api/models/AtprotoIdentity.js`,
`tools/atproto-sandbox/`.

## Phases

### ✅ Phase 0: Sandbox and spike
- AiaB pinned at a fixed commit, with a wrapper script (`tools/atproto-sandbox/sandbox.sh`)
- Spike exercising the full `did:plc` lifecycle against the local PLC: create → resolve → rename → tombstone
- Confirmed that the ESM-only `@atproto/*` packages load in the Babel/CommonJS backend on Node 24

### ✅ Phase 1: Data, keys, handles, config
- `atproto_identities` table (`pending → active → tombstoned`; handle unique until tombstoned)
- `AtprotoIdentity` model and `user.atprotoIdentity` relation
- Key encryption, rotation key loading, handle derivation and validation, reserved names
- `ATPROTO_*` config and eligibility rule

### ✅ Phase 2: Provisioning service and CLI
- `AtprotoService.provision(user)`:
  1. check eligibility and choose a handle
  2. generate the signing key
  3. build and sign the genesis op, then store the row as `pending`
  4. submit to the PLC and mark `active`
- Retrying is safe: the stored genesis op is re-sent, and if the DID already exists at the PLC, that counts as success
- `AtprotoService.updateHandle`, `AtprotoService.tombstone` and `AtprotoService.verify`
- Account deletion (`User#sanelyDeleteUser`) queues a tombstone job; it never blocks deletion
- Writes to `plc.directory` are refused unless `ATPROTO_PRODUCTION_PLC_APPROVED=true`
- `yarn atproto` CLI: `keygen`, `list`, `status`, `provision`, `rename`, `tombstone`, `verify`
- Tests use an in-memory PLC that validates signatures; verified live against the sandbox PLC
  (`tools/atproto-sandbox/with-sandbox.sh`)

### Phase 3: Public endpoints
- `GET /.well-known/atproto-did` (Host-based)
- `GET /xrpc/com.atproto.identity.resolveHandle`
- `GET /xrpc/com.atproto.server.describeServer`
- `GET /xrpc/_health`

### Phase 4: Hylo inside the sandbox
- Backend Dockerfile, plus an AiaB app definition for `hylo-backend`, `hylo-postgres`
  and `hylo-redis`, routing `pds.hylo` and `*.hylo`
- Seed test users (`alice@hylo.com`, `bob@terran.io`, ineligible `carol@gmail.com`) and provision them
- Verification script: handle ↔ DID ↔ PLC document, the ineligible user gets nothing,
  and the reference PDS resolves Hylo handles

### Phase 5: Triggers and UI
- Backfill script for eligible users
- GraphQL `me.atprotoIdentity { did handle }` and an opt-in mutation
- Read-only display in settings (translated strings in `public/locales`)

### Phase 6: User-chosen handles
- Users pick their own handle name under `hylo.com`, at provisioning and later as a rename
- Availability check: syntax, reserved names, and uniqueness against active handles
- Rename = PLC `updateHandle` op; the old handle stops resolving immediately
- Decide: a cooldown before a released handle can be reclaimed, and rate limits on renames
- Decide: whether to support bring-your-own-domain handles (DNS TXT or `.well-known` on the user's domain)
- GraphQL mutation and settings UI with translations

### Phase 7: Production rollout
- Wildcard DNS and TLS for `*.hylo.com` to the backend, and choose the PDS hostname
- Check `RESERVED_NAMES` against the real `hylo.com` DNS zone
- Generate and back up the rotation key and encryption secret; set production env
- **With explicit approval:** one test DID on `plc.directory`, then verify with
  `goat resolve` and the public handle debuggers

### Later
- Member handles under `*.hylo.social`
- Signed repositories, `com.atproto.sync.*`, relay and firehose (test with AiaB's `full-stack` preset)
- AT Protocol OAuth, posting Hylo content as AT Protocol records
- User-held recovery rotation keys
