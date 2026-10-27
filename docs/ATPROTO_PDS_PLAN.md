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
| Staging PLC | Staging runs its **own private PLC directory** (separate small Heroku app plus its own Postgres), so staging DIDs never reach the public `plc.directory` (working assumption; feasibility on Heroku to be confirmed) |
| AppView | **Not in scope.** Hylo is a PDS (it hosts identities and, later, repos); it does not index the network. See "Out of scope" |

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

### ✅ Phase 3: Public endpoints
- `GET /.well-known/atproto-did` (Host-based)
- `GET /xrpc/com.atproto.identity.resolveHandle`
- `GET /xrpc/com.atproto.server.describeServer`
- `GET /xrpc/_health`; any other `/xrpc/*` returns `501 MethodNotImplemented`
- Served by `lib/atproto/http.js`, mounted **before** cookies and sessions in `config/http.js`.
  Anonymous lookups from other servers never create Redis sessions or set cookies.
  CORS is open (`*`) because the endpoints are public and read-only.
- Verified live: the official `@atproto/identity` resolver passes the two-way handle check
  against the running backend (with DNS/TLS simulated; the real thing comes in Phase 4)

### ✅ Phase 4: Hylo in the sandbox (via a bridge to the dev backend)
- Real sandbox DNS + HTTPS for `pds.hylo.atmosbox.test` and `*.hylo.atmosbox.test`, served by
  the normal `yarn backend:dev` on the host and its dev database
- `hylo-proxy`: AiaB managed app (`tools/atproto-sandbox/hylo/`). Managed apps may only join the
  private network, so it forwards to `hylo-host-bridge`, a separate Compose project
  (AiaB's documented exception) that also reaches the host. Neither publishes ports.
- `tools/atproto-sandbox/hylo/verify.sh`, run inside the sandbox, checks:
  - the official resolver goes handle → DID → same handle over HTTPS
  - the DID document points at the Hylo PDS
  - the **reference PDS (`pds1`) resolves Hylo handles**
  - unknown handles don't resolve, and unimplemented XRPC returns 501
- Verified with a `@hylo.com` and a `@terran.io` account, including a rename (the old handle
  stops resolving immediately) and a provision retried after a dropped connection
- Test users come from the dev database rather than seeded fixtures, since the bridge uses
  the real dev backend

### ✅ Phase 5: Staging readiness, management metrics, UI
**✅ 5a: Staging readiness**
- Each identity row stores the instance that created it (`plc_url`, `handle_domain`). Every
  lookup, public endpoint and PLC write is scoped to this instance, so rows from another
  environment (e.g. prod rows in a prod-cloned staging DB) are never served or acted on
- One identity per user **per PLC directory**, so a cloned prod row doesn't block staging
- `yarn atproto purge-foreign [--yes]` deletes other instances' rows (their DIDs are untouched)
- `ATPROTO_ALLOWED_EMAILS` optionally narrows eligibility to specific (test) accounts
- `yarn atproto backfill [--limit N] [--yes]` provisions every eligible user and resubmits
  pending ones; dry run by default, one failure doesn't stop the rest

**✅ 5b: Management page:** Management → AT Protocol → Identities (`/management/atproto/identities`)
- Admin-only (`GET /noo/admin/atproto-metrics`, `POST /noo/admin/atproto-verify-sample`)
- Shows this instance's PLC URL, PDS URL and handle domain (flags the public production directory
  and sandbox mode), eligibility settings and allowlist size
- Counts: active, pending, tombstoned, eligible users without an identity, identities from other
  instances (with the `purge-foreign` hint)
- Stuck pending identities (more than 10 minutes), recent identities, per-day activity (30 days)
- "Verify sample" checks up to 10 random active identities against the PLC
- Not tracked: renames (no history is stored yet; add an event log if needed)
- Screenshots: `HYLO_ADMINS=1 node scripts/run-isolated-e2e.js atproto-management --project=chromium`
  in `apps/web` (needs an E2E database name containing "test")

**✅ 5c: Product UI**
- GraphQL `Me.atproto { enabled eligible proposedHandle identity { did handle status createdAt } }`
  and `createAtprotoIdentity` mutation. Ineligibility reasons and PLC error details stay server-side
- Settings → Account → "AT Protocol identity" (marked Experimental): eligible users see the handle
  they'll get and a create button; users with an identity see handle, DID and status. Everyone
  else sees nothing
- Strings translated in all locales
- Verified end to end: the browser creates a real DID on the sandbox PLC
  (`e2e/authenticated.atproto-settings.spec.js`, run under `with-sandbox.sh`)

### Staging deployment (Heroku)
- **Private PLC:** Bluesky's PLC server as its own Heroku app with its own Postgres add-on.
  Wipe it whenever staging is reset. Tested locally under Heroku-like conditions
  ([tools/atproto-plc-heroku/](../tools/atproto-plc-heroku/README.md)):
  - One web dyno, configured by Heroku's own `DATABASE_URL` and `PORT`
  - Heroku Postgres SSL needs `PGSSLMODE=no-verify`, which the image sets
  - Deployed as a container built from Bluesky's source at a pinned commit, not the Node buildpack
  - Still to check: that the build from upstream source works (`deploy.sh`, then `simulate.sh`)
- Wildcard DNS + TLS for the staging handle domain (e.g. `*.staging.hylo.com`) to the API app.
  Heroku's automatic certificates don't cover wildcards, so upload one or use Cloudflare
- Staging-only rotation key and encryption secret. **Never copy production keys to staging**
- Staging refresh procedure, after cloning the prod DB:
  1. `yarn atproto purge-foreign --yes` (removes prod's identity rows from the clone)
  2. Reset the staging PLC's database, so staging's old DIDs go with the old staging data
  3. Re-provision test accounts (`yarn atproto backfill --yes`, scoped by `ATPROTO_ALLOWED_EMAILS`)
- Staging must never ask relays to crawl it (`requestCrawl`), even after posting support exists

### Phase 6: User-chosen handles
- Users pick their own handle name under `hylo.com`, at provisioning and later as a rename
- Availability check: syntax, reserved names, and uniqueness against active handles
- Adopt Bluesky's official reserved-handle list (several hundred names; AiaB vendors a copy
  in `lib/manifest.mjs`) in place of our short `RESERVED_NAMES`
- Rename = PLC `updateHandle` op; the old handle stops resolving immediately
- Decide: a cooldown before a released handle can be reclaimed, and rate limits on renames
- Decide: whether to support bring-your-own-domain handles (DNS TXT or `.well-known` on the user's domain)
- GraphQL mutation and settings UI with translations

### Phase 7: Production rollout
- Wildcard DNS and TLS for `*.hylo.com` to the backend, and choose the PDS hostname
- Check `RESERVED_NAMES` against the real `hylo.com` DNS zone
- Generate and back up the rotation key and encryption secret; set production env
- Replace `@did-plc/lib`'s HTTP client: it bundles axios 1.3.4, which has known advisories.
  Keep the library's op-building functions and use a small `fetch`-based client
- Rate-limit or cache the public endpoints at the edge (e.g. Cloudflare); every lookup is a DB query
- Serve the PDS's own `did:web` document at `https://<pds host>/.well-known/did.json`
  (`describeServer` already advertises it; it becomes necessary for service auth)
- **With explicit approval:** one test DID on `plc.directory`, then verify with
  `goat resolve` and the public handle debuggers

### Later
- Member handles under `*.hylo.social`
- Fully containerised Hylo in the sandbox (backend Dockerfile, Postgres/PostGIS, Redis), so CI
  can run `verify.sh` without a developer's machine
- Signed repositories, `com.atproto.sync.*`, relay and firehose (test with AiaB's `full-stack` preset)
- AT Protocol OAuth, posting Hylo content as AT Protocol records
- User-held recovery rotation keys

### Out of scope
- **Running an AppView.** An AppView indexes records from across the network and serves them back
  (Bluesky's AppView powers the Bluesky app). Publishing Hylo content to Bluesky only needs the
  "Later" PDS work (repos, sync, relay); Bluesky's AppView would then index it. AiaB's `full-stack`
  preset includes a local AppView purely for testing that. A Hylo-specific AppView (e.g. indexing
  custom Hylo lexicons from other PDSes) would be a separate future project
