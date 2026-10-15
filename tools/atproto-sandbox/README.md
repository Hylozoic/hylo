# AT Protocol sandbox

Local, private AT Protocol network for the Hylo PDS experiment, built on
[Atmosphere in a Box](https://tangled.org/kandake.africa/atmosphereinabox) (AiaB).
Nothing here touches the public `plc.directory`.

`sandbox.sh` clones AiaB into `.aiab/` (gitignored) at the commit pinned in the
script, then forwards arguments to its CLI. AiaB's images use `:latest` tags, so
bump `AIAB_COMMIT` deliberately and recreate the sandbox when you do.

## Requirements

- Deno 2.8+ and Docker (Docker Desktop on macOS works, though AiaB only
  officially verifies Fedora)
- `172.30.249.0/24` must not overlap your VPN or other Docker networks

## Bring it up

```sh
tools/atproto-sandbox/sandbox.sh create --pds 1 --users-per-pds 1   # once
tools/atproto-sandbox/sandbox.sh up --build
tools/atproto-sandbox/sandbox.sh seed
tools/atproto-sandbox/sandbox.sh smoke
```

This runs CoreDNS, a Caddy TLS gateway, a PLC directory (`plc.atmosbox.test`)
and one reference PDS (`pds1.atmosbox.test`) as separate containers on an
internal Docker network. Stop with `sandbox.sh down` (keeps data); reset with
`sandbox.sh destroy --accept-destructive`.

`.aiab/state/` contains generated credentials and the sandbox CA private key.
Keep it private.

## Talking to the sandbox

The network is internal: no host ports, no internet. Clients run in a container
on `atproto-sandbox_atmosinabox`, using DNS `172.30.249.3` and trusting the
public CA via `NODE_EXTRA_CA_CERTS=/ca/root.crt`. See `spike/run.sh`.

## Poking at it

```sh
# What's running (AiaB's own `ps` needs a newer Docker Compose than v2.17)
docker ps --filter name=atproto-sandbox

# Seeded reference account: credentials and DID live in .aiab/state/ (private)
tools/atproto-sandbox/sandbox.sh access

# Resolve a DID document from the local PLC, and a handle via the reference PDS
tools/atproto-sandbox/curl.sh https://plc.atmosbox.test/<did>
tools/atproto-sandbox/curl.sh "https://pds1.atmosbox.test/xrpc/com.atproto.identity.resolveHandle?handle=user1.pds1.atmosbox.test"
tools/atproto-sandbox/curl.sh https://plc.atmosbox.test/<did>/log/audit
```

To use a browser instead, follow `sandbox.sh access hosts` / `access start` in
AiaB's [connectivity docs](https://tangled.org/kandake.africa/atmosphereinabox).
This means editing `/etc/hosts` and trusting `.aiab/state/ca/root.crt` in your
keychain, which is a manual opt-in.

## Running Hylo's backend against the sandbox

The sandbox network is private, so host processes reach it through AiaB's
loopback relay plus a dev-only Node preload (`host-env.cjs`). The preload maps
`*.atmosbox.test` to `127.0.0.1` and trusts the sandbox CA. Nothing is changed
in `/etc/hosts` or your keychain.

```sh
tools/atproto-sandbox/sandbox.sh access start     # relay on 127.0.0.1:443 (once per sandbox start)
```

In `apps/backend/.env` (generate keys with `yarn atproto keygen`):

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

With the backend running (`yarn backend:dev`), the public endpoints answer
for any handle you've provisioned. Until Phase 4 puts Hylo inside the sandbox,
fake the handle's hostname with a Host header:

```sh
curl -H 'Host: tom.hylo.atmosbox.test' http://localhost:3001/.well-known/atproto-did
curl 'http://localhost:3001/xrpc/com.atproto.identity.resolveHandle?handle=tom.hylo.atmosbox.test'
curl http://localhost:3001/xrpc/com.atproto.server.describeServer
```

If you destroy and recreate the sandbox, its PLC forgets every DID. Clear the
local rows with `delete from atproto_identities;` in your dev database.

## Spike

`spike/` mints a `did:plc` the way Hylo will (server rotation key, per-user
signing key) and runs it through create → resolve → handle update → tombstone:

```sh
tools/atproto-sandbox/spike/run.sh
```

Note: `@atproto/identity` uses an SSRF-protected fetch that refuses private
addresses. In the sandbox we pass plain `fetch` instead; Hylo must only do that
behind a sandbox-only setting.
