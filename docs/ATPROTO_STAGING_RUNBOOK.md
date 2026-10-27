# Runbook: AT Protocol identities on staging

How to turn on Hylo's experimental AT Protocol identities (a DID and a `*.staging.hylo.com`
handle for test accounts) on Heroku staging, check they work, and keep them contained when
staging is refreshed. Background and design: [ATPROTO_PDS_PLAN.md](ATPROTO_PDS_PLAN.md).

**Time:** about 2 hours the first time, most of it DNS and certificates.
**Access needed:** Heroku (staging API app, and creating a new app), Cloudflare (`hylo.com`
zone: DNS and SSL/TLS settings), Docker on your machine.

## What you're setting up

```
                         Cloudflare (hylo.com zone)
alice.staging.hylo.com ─┐
pds.staging.hylo.com  ──┼─ *.staging.hylo.com ──▶ staging API app (existing)
                        │                          serves /.well-known/atproto-did and /xrpc/*
api-staging.hylo.com ───┘  (unchanged)                       │ creates/updates DIDs
                                                             ▼
plc-staging.hylo.com ────────────────────────▶ hylo-plc-staging (new app + its own Postgres)
                                               Bluesky's PLC server, staging's private directory
```

- **Nothing new runs inside the staging API app.** It already has Node, Postgres and Redis. The
  only new service is the PLC directory, as a separate one-dyno app.
- **Staging never touches the public network.** Staging's DIDs exist only in
  `hylo-plc-staging`, so the real Bluesky app won't recognise staging handles. That's
  intended. What staging does prove: handle resolution over real DNS and HTTPS, the DID
  documents, the Account settings UI, the Management page, and the refresh procedure.
- **The feature is off unless `ATPROTO_ENABLED=true`.** Deploying the code alone changes nothing
  for users.

## Before you start

Fill these in and keep them in your shell for the steps below:

```bash
export API_APP=<staging API Heroku app, the one serving api-staging.hylo.com>
export PLC_APP=hylo-plc-staging
```

Then decide on the wildcard certificate (step 3). It's the one decision here with a cost:

- **Cloudflare's free certificate doesn't cover `*.staging.hylo.com`.** It covers only
  `hylo.com` and one level of subdomain (`*.hylo.com`).
- **Heroku's automatic certificates don't do wildcards either.**
- **Recommended: Cloudflare Advanced Certificate Manager.** It's a paid add-on for the zone
  (check current pricing; it was about $10/month). It issues and renews an edge certificate for
  `*.staging.hylo.com` with nothing to maintain.
- **Not recommended: a Let's Encrypt wildcard uploaded to Heroku**, with Cloudflare set to DNS
  only. It's free, but someone has to renew and re-upload it every 90 days, and handles stop
  resolving the day they forget.

## Steps

### 1. Deploy the code with the feature off

Merge `atproto-pds-experiment` into `dev` and deploy staging as usual. The migrate buildpack
runs two migrations, which create and then scope the `atproto_identities` table. Leave every
`ATPROTO_*` variable unset.

Check: staging works as before, and the table exists but is empty:

```bash
heroku pg:psql --app $API_APP -c 'select count(*) from atproto_identities'
```

### 2. Create the staging PLC directory

Follow [tools/atproto-plc-heroku/README.md](../tools/atproto-plc-heroku/README.md). In short:

```bash
heroku apps:create $PLC_APP --stack container
heroku addons:create heroku-postgresql:essential-0 --app $PLC_APP
tools/atproto-plc-heroku/deploy.sh $PLC_APP              # build only
tools/atproto-plc-heroku/simulate.sh registry.heroku.com/$PLC_APP/web   # must end with ✅
tools/atproto-plc-heroku/deploy.sh $PLC_APP --push
heroku domains:add plc-staging.hylo.com --app $PLC_APP   # prints a DNS target
```

- **Domain:** use `plc-staging.hylo.com`, a sibling of `api-staging.hylo.com`. Don't use
  `plc.staging.hylo.com`. That name would sit inside the handle wildcard, so it would compete
  with it for routing.
- **Cloudflare:** add a proxied CNAME `plc-staging` → the DNS target. The free certificate
  covers this name. Set up the origin certificate the same way `api-staging.hylo.com` is
  set up today (see step 3 for how to check).

Check:

```bash
curl https://plc-staging.hylo.com/_health          # {"version":...}
```

### 3. Point `*.staging.hylo.com` at the staging API app

```bash
heroku domains:add '*.staging.hylo.com' --app $API_APP   # prints a DNS target
heroku certs --app $API_APP                               # note how api-staging's cert is done
```

In Cloudflare:

1. **DNS:** add a proxied CNAME named `*.staging` → the DNS target. Explicit records like
   `staging.hylo.com` keep working, because specific names win over the wildcard.
2. **Edge certificate:** with Advanced Certificate Manager, order a certificate covering
   `*.staging.hylo.com`.
3. **Origin certificate (Cloudflare → Heroku):** look at **SSL/TLS → Overview**.
   - **Full:** nothing more to do.
   - **Full (strict):** Heroku must present a certificate valid for `alice.staging.hylo.com`.
     Heroku can't issue one, so create a free **Cloudflare Origin CA** certificate. Make it
     cover `*.staging.hylo.com` and `api-staging.hylo.com`, then upload it with
     `heroku certs:add`.

     Check first: Heroku may not let an app keep its automatic certificate alongside an uploaded
     one. If `heroku certs` shows ACM on `$API_APP`, the uploaded certificate replaces it for
     `api-staging.hylo.com` too, which is why it should cover both names.
4. **Security:** make sure bot protection or challenges (Bot Fight Mode, WAF rules) don't
   apply to `*.staging.hylo.com`. Other AT Protocol services fetch these URLs with no browser.
   A challenge page means a handle that doesn't resolve.

Check: the feature is still off, so expect Hylo's own 404. A Cloudflare error page or Heroku's
"no such app" page means the setup isn't right yet. After step 5 the same URL returns
`{"version":...}`.

```bash
curl -i https://anything.staging.hylo.com/xrpc/_health
```

### 4. Generate staging-only keys

On your own machine, from `apps/backend`:

```bash
yarn atproto keygen
```

- **What it prints:** `ATPROTO_PLC_ROTATION_KEY_HEX`, `ATPROTO_KEY_ENCRYPTION_SECRET`, and the
  rotation key's public DID.
- **Where to keep them:** put the two secrets straight into Heroku (next step) and the password
  manager, nowhere else. Note the public DID in the password manager entry.
- **Never reuse production's keys on staging, and never copy staging's to production.** The
  rotation key controls every DID it created. The encryption secret protects every user's
  signing key.

### 5. Turn it on for test accounts only

Staging's database is a copy of production, so it contains real @hylo.com and @terran.io
users. `ATPROTO_ALLOWED_EMAILS` restricts identities to the test accounts you list. Those
accounts need a verified email on staging.

```bash
heroku config:set --app $API_APP \
  ATPROTO_ENABLED=true \
  ATPROTO_PLC_URL=https://plc-staging.hylo.com \
  ATPROTO_PDS_URL=https://pds.staging.hylo.com \
  ATPROTO_HANDLE_DOMAIN=staging.hylo.com \
  ATPROTO_ALLOWED_EMAIL_DOMAINS=hylo.com,terran.io \
  ATPROTO_ALLOWED_EMAILS=you@hylo.com,tester@terran.io \
  ATPROTO_PLC_ROTATION_KEY_HEX=<from keygen> \
  ATPROTO_KEY_ENCRYPTION_SECRET=<from keygen>
```

**Never set `ATPROTO_SANDBOX` or `ATPROTO_PRODUCTION_PLC_APPROVED` on staging.**

To see the Management page, your user ID must be in `HYLO_ADMINS`.

### 6. Clear out anything copied from production

The first time, production has no identities to copy. Do this anyway, because it's the same
step every refresh needs:

```bash
heroku run --app $API_APP -- yarn atproto purge-foreign        # dry run: lists what it would delete
heroku run --app $API_APP -- yarn atproto purge-foreign --yes
```

### 7. Create test identities

Either:
- **In the app:** sign in as an allowlisted account, then go to **Settings → Account → AT
  Protocol identity → Create my AT Protocol identity**.
- **For everyone on the allowlist at once:**

  ```bash
  heroku run --app $API_APP -- yarn atproto backfill            # dry run
  heroku run --app $API_APP -- yarn atproto backfill --yes
  ```

A non-allowlisted @hylo.com account should see no AT Protocol section at all. Check this with
one account.

### 8. Verify

For a handle, e.g. `you.staging.hylo.com`:

```bash
curl https://you.staging.hylo.com/.well-known/atproto-did      # did:plc:...
curl "https://pds.staging.hylo.com/xrpc/com.atproto.identity.resolveHandle?handle=you.staging.hylo.com"
curl https://plc-staging.hylo.com/<did>                         # alsoKnownAs at://you.staging.hylo.com,
                                                               # service → https://pds.staging.hylo.com
heroku run --app $API_APP -- yarn atproto verify you@hylo.com  # our records match the directory
```

Then open **Management → AT Protocol → Identities**:
- **Instance card:** shows `plc-staging.hylo.com`, not "production".
- **Foreign identities:** 0.
- **Verify sample:** reports no problems.

Also try a rename (`yarn atproto rename you@hylo.com new-name`). The old handle should stop
resolving straight away.

## Refreshing staging from production

Do this every time staging's database is re-cloned, **in this order**, before testers use it:

1. **Remove production's identity rows from the clone:**
   `heroku run --app $API_APP -- yarn atproto purge-foreign --yes`
2. **Wipe the staging PLC directory**, so staging's old DIDs go with the old staging data:

   ```bash
   heroku pg:reset DATABASE_URL --app $PLC_APP --confirm $PLC_APP
   heroku ps:restart --app $PLC_APP
   ```

3. **Recreate the test identities:** `heroku run --app $API_APP -- yarn atproto backfill --yes`

Skipping step 2 leaves orphaned DIDs in the staging directory. They're harmless, because nothing
outside staging reads that directory. But they would make `yarn atproto verify` and the metrics
misleading, and old handles would collide with re-created ones.

Steps 1 and 3 only touch this instance's rows. Rows copied from production have a different
`plc_url` and are never served, even before they're purged.

## Turning it off

- **Stop everything:** `heroku config:set ATPROTO_ENABLED=false --app $API_APP`. Handles stop
  resolving, and the Account settings section disappears.
- **Remove it entirely:** also delete `$PLC_APP`, then the `*.staging` and `plc-staging` DNS
  records.

Nothing exists outside Hylo's own apps and DNS, so there's nothing external to clean up.

## Rules that always apply on staging

- No `plc.directory`. `ATPROTO_PLC_URL` must be the staging directory.
- No production keys, and no `ATPROTO_PRODUCTION_PLC_APPROVED`.
- Never ask relays to crawl staging (`requestCrawl`), even once posting exists.
- Keep `ATPROTO_ALLOWED_EMAILS` set while staging holds a copy of real users.

## Troubleshooting

- **Handle doesn't resolve, but the user has an identity:**
  - Check that `curl -i https://<handle>/.well-known/atproto-did` reaches Heroku.
  - A Cloudflare challenge page means a bot or WAF rule; see step 3.
  - A 404 from Heroku means the wildcard domain isn't on `$API_APP`.
- **Cloudflare 526 (invalid SSL certificate):** the zone is Full (strict) and Heroku has no
  certificate for the name. See step 3's origin certificate.
- **Identity stuck as "Being set up":**
  - The directory call failed, so check `heroku logs --app $API_APP` and the PLC app's health.
  - `yarn atproto backfill --yes` retries pending identities.
  - They show on the Management page after 10 minutes.
- **PLC app says `Database not ready after 30 retries`:** almost always SSL, not an outage; see
  the PLC README.
