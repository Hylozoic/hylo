# AT Protocol sandbox

Local, private AT Protocol network for the Hylo PDS experiment, built on
[Atmosphere in a Box](https://tangled.org/kandake.africa/atmosphereinabox) (AiaB).
Nothing here touches the public `plc.directory`. See `docs/ATPROTO_PDS_PLAN.md`.

`sandbox.sh` clones AiaB into `.aiab/` (gitignored) at the commit pinned in the
script, installs Hylo's sandbox app (`hylo/`) into it, then forwards arguments to
AiaB's CLI. AiaB's images use `:latest` tags, so bump `AIAB_COMMIT` deliberately
and recreate the sandbox when you do.

## How Hylo fits in

```
pds1 / resolvers / scripts (inside the sandbox)
   │  https://<name>.hylo.atmosbox.test, https://pds.hylo.atmosbox.test
   │  (DNS + TLS from AiaB's gateway)
   ▼
hylo-proxy        AiaB managed app (hylo/hylo.yaml); private network only
   ▼
hylo-host-bridge  separate Compose project (hylo/bridge.compose.yaml); no published ports
   ▼
yarn backend:dev on the host (port 3001), using your normal dev database
```

The other direction, from the host into the sandbox (`yarn atproto` talking to the
PLC), goes through AiaB's loopback relay on `127.0.0.1:443` plus a dev-only Node
preload (`host-env.cjs`, applied by `with-sandbox.sh`). That preload maps
`*.atmosbox.test` to the relay and trusts the sandbox CA, so `/etc/hosts` and
your keychain are never touched.

## Requirements

- Deno 2.8+, Node 24, Docker (Docker Desktop on macOS works, though AiaB only
  officially verifies Fedora)
- `172.30.249.0/24` must not overlap your VPN or other Docker networks

## First-time setup

```sh
tools/atproto-sandbox/sandbox.sh create --pds 1 --users-per-pds 1 --app hylo
tools/atproto-sandbox/sandbox.sh up --build
tools/atproto-sandbox/sandbox.sh seed          # reference account on pds1
tools/atproto-sandbox/sandbox.sh smoke
```

For an existing sandbox created without Hylo, run `sandbox.sh apply --app hylo`,
then `up --build`, then restart DNS and the gateway:
`(cd tools/atproto-sandbox/.aiab && docker compose restart dns gateway)`.

In `apps/backend/.env` (generate the two keys with `yarn atproto keygen`, and
use them only for the sandbox):

```sh
ATPROTO_ENABLED=true
ATPROTO_SANDBOX=true
ATPROTO_PLC_URL=https://plc.atmosbox.test
ATPROTO_PDS_URL=https://pds.hylo.atmosbox.test
ATPROTO_HANDLE_DOMAIN=hylo.atmosbox.test
ATPROTO_ALLOWED_EMAIL_DOMAINS=hylo.com,terran.io
ATPROTO_PLC_ROTATION_KEY_HEX=...
ATPROTO_KEY_ENCRYPTION_SECRET=...
```

Run `yarn migrate` in `apps/backend` if you haven't since pulling this branch.

## Each session

```sh
tools/atproto-sandbox/sandbox.sh up            # if Docker was restarted
tools/atproto-sandbox/sandbox.sh access start  # host → sandbox relay (stops when Docker/the machine restarts)
tools/atproto-sandbox/hylo/bridge.sh up        # sandbox → host bridge
yarn backend:dev                               # Hylo backend on :3001
```

Then, from `apps/backend`:

```sh
W=../../tools/atproto-sandbox/with-sandbox.sh
$W yarn atproto status tom@hylo.com      # eligible? which handle? existing DID?
$W yarn atproto provision tom@hylo.com   # mint a did:plc on the sandbox PLC
$W yarn atproto rename tom@hylo.com tom-renamed
$W yarn atproto verify tom@hylo.com      # compare our DB with the PLC
$W yarn atproto list
$W yarn atproto tombstone tom@hylo.com --yes   # permanent for that DID
```

And check everything the way other AT Protocol services see it:

```sh
tools/atproto-sandbox/hylo/verify.sh            # every active handle in your dev DB
tools/atproto-sandbox/hylo/verify.sh tom.hylo.atmosbox.test
```

`verify.sh` runs inside the sandbox and checks Hylo's server endpoints, the
official `@atproto/identity` resolver (handle → DID → same handle), the DID
document's PDS, and that the reference PDS (`pds1`) resolves each handle too.

If `yarn atproto` fails with `ECONNREFUSED 127.0.0.1:443`, the relay has
stopped. Run `sandbox.sh access start` and retry. A half-finished provision
stays `pending` and is safely resubmitted.

## Poking at it

```sh
docker ps --filter name=atproto-sandbox        # AiaB's own `ps` needs a newer Docker Compose than v2.17
tools/atproto-sandbox/curl.sh https://tom.hylo.atmosbox.test/.well-known/atproto-did
tools/atproto-sandbox/curl.sh https://pds.hylo.atmosbox.test/xrpc/com.atproto.server.describeServer
tools/atproto-sandbox/curl.sh https://plc.atmosbox.test/<did>
tools/atproto-sandbox/curl.sh https://plc.atmosbox.test/<did>/log/audit
tools/atproto-sandbox/curl.sh "https://pds1.atmosbox.test/xrpc/com.atproto.identity.resolveHandle?handle=tom.hylo.atmosbox.test"
```

`curl.sh` runs curl in a container on the sandbox network, with sandbox DNS and
the sandbox CA. To use a browser instead, follow `sandbox.sh access hosts` in
AiaB's [connectivity docs](https://tangled.org/kandake.africa/atmosphereinabox).
That needs `/etc/hosts` edits and trusting `.aiab/state/ca/root.crt`, which is
a manual opt-in.

## Housekeeping

- Stop: `hylo/bridge.sh down`, `sandbox.sh access stop`, `sandbox.sh down` (keeps data)
- Reset: `sandbox.sh destroy --accept-destructive`. The PLC then forgets every
  DID, so also run `delete from atproto_identities;` in your dev database.
- `.aiab/state/` holds generated credentials and the sandbox CA private key.
  Keep it private.

## Client scripts

`client/` holds Node scripts that run inside the sandbox network via
`client/run.sh <script>`. Its dependencies are installed on the host, because
the network has no internet access.

- `spike.mjs` (Phase 0): mints a `did:plc` and runs it through create → resolve →
  rename → tombstone directly against the PLC.
- `verify-hylo.mjs`: what `hylo/verify.sh` runs.

`@atproto/identity` uses an SSRF-protected fetch that refuses private
addresses, so these scripts pass plain `fetch`, which still verifies TLS.
Hylo must only do that behind its sandbox-only setting.
