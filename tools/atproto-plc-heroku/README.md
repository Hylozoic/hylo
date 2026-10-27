# Staging PLC directory on Heroku

Staging gets its own private PLC directory: Bluesky's PLC server
([did-method-plc](https://github.com/did-method-plc/did-method-plc)) running as a separate
Heroku app with its own Postgres. Staging's DIDs live only there, never in the public
`plc.directory`, and are wiped whenever staging is reset. See
[docs/ATPROTO_PDS_PLAN.md](../../docs/ATPROTO_PDS_PLAN.md) for why.

## What we found (tested locally, 2026-10-27)

- **One web dyno is the whole service.** The server's `dist/bin.js` reads `DATABASE_URL` and
  `PORT`, which Heroku sets, runs its migrations on boot, and runs its sequencer in-process.
  No worker dyno, Redis or extra add-ons.
- **Heroku Postgres SSL needs `PGSSLMODE=no-verify`.** Heroku requires SSL, but its
  certificates don't verify against a public CA. With `sslmode=require` or `prefer` the server
  fails with `DEPTH_ZERO_SELF_SIGNED_CERT`; without SSL Postgres rejects it. We can't add
  `?sslmode=` to `DATABASE_URL` because Heroku owns it, but the server's `pg` client reads
  `PGSSLMODE`. The Dockerfile sets it. Hylo's backend already does the same
  (`rejectUnauthorized: false` in `apps/backend/knexfile.js`).
- **Deploy it as a container, not with the Node buildpack.** The server lives in a pnpm
  monorepo, so the buildpack would mean keeping a fork of Bluesky's repo shaped for Heroku. As a
  container we build Bluesky's own Dockerfile at a pinned commit and add a few lines on top.
- **Resetting works.** After the database is reset and the dyno restarts, the server re-creates
  its tables and old DIDs return 404.
- **Upstream is moving quickly** (commits this week rename its database class), so we pin a
  commit in `deploy.sh` and bump it on purpose.

`simulate.sh` reproduces all of this: an SSL-only Postgres with a self-signed certificate,
config only via `DATABASE_URL` and `PORT`, a full DID lifecycle (create, resolve, rename,
forged update rejected, tombstone), then a reset.

**Not yet verified:** building the image from upstream source (`deploy.sh`). Testing so far
used the sandbox's PLC image, a community build of the same server, started the same way the
Dockerfile starts it. Run `deploy.sh` without `--push` and then `simulate.sh` on the result
before the first deploy.

## Deploying

Needs Docker and the Heroku CLI. Hylo's apps are unaffected; this is a separate app.

```bash
# 1. Create the app (container stack) and its database
heroku apps:create hylo-plc-staging --stack container
heroku addons:create heroku-postgresql:essential-0 --app hylo-plc-staging

# 2. Build from Bluesky's source and check the image the way Heroku will run it
tools/atproto-plc-heroku/deploy.sh hylo-plc-staging
tools/atproto-plc-heroku/simulate.sh registry.heroku.com/hylo-plc-staging/web

# 3. Push and release
tools/atproto-plc-heroku/deploy.sh hylo-plc-staging --push

# 4. Give it its own domain, then add a proxied Cloudflare CNAME to the DNS target it prints
heroku domains:add plc-staging.hylo.com --app hylo-plc-staging
```

Then point staging's backend at it: `ATPROTO_PLC_URL=https://plc-staging.hylo.com`. The full
staging setup, including DNS and certificates, is in
[docs/ATPROTO_STAGING_RUNBOOK.md](../../docs/ATPROTO_STAGING_RUNBOOK.md).

The image is built for `linux/amd64` (Heroku's architecture), so on Apple Silicon the build runs
under emulation and takes a few minutes.

## Staging refresh

When staging's database is re-cloned from production, wipe the PLC too, so staging's old DIDs
go with the old staging data:

```bash
heroku pg:reset DATABASE_URL --app hylo-plc-staging --confirm hylo-plc-staging
heroku ps:restart --app hylo-plc-staging
```

The full procedure (including `purge-foreign` and `backfill` on the backend) is in the plan doc.

## Troubleshooting

- **`Database not ready after 30 retries`** almost always means SSL, not a database outage: the
  server retries any connection error and hides the cause. Check `PGSSLMODE=no-verify` is set
  (`heroku run env --app hylo-plc-staging`).
- **Logs:** `heroku logs --tail --app hylo-plc-staging`. `LOG_ENABLED=true` is set in the image.
- Leave `ADMIN_SECRET` unset. It only enables an admin takedown route, which staging doesn't need.
