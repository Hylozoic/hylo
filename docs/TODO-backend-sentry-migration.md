# TODO: Replace backend Rollbar with Sentry (`@sentry/node`)

**Status:** Implementation complete — enable `SENTRY_DSN` / `SENTRY_ENV` on Heroku (staging → review → production), verify events, then unset `ROLLBAR_SERVER_TOKEN` if still present.

**Goal:** Migrate `apps/backend` error reporting from Rollbar to Sentry so API / worker / cron failures live in the same Sentry project as web (`@sentry/react`) and mobile (`@sentry/react-native`).

**Related:** [docs/sentry-setup.md](./sentry-setup.md) (web + mobile + backend).

---

## Decisions (locked)

- Same shared Sentry project + tags (`surface:backend`, `process:web|worker|cron`)
- Separate server env: `SENTRY_DSN` / `SENTRY_ENV` (not `VITE_SENTRY_DSN`)
- Environments: `production` / `staging` / `reviewApp`
- Errors only (`tracesSampleRate: 0`)
- Hard cutover (no Rollbar dual-run)
- PII: `sendDefaultPii` + user `id` / `name` / `email` via `setUser`

---

## Done

1. Package + facade (`@sentry/node`, `lib/sentry.js`, early init)
2. HTTP / Sails wiring + `UserSession` user context
3. All former `rollbar.error` call sites → Sentry
4. GraphQL Yoga: capture original unexpected errors; keep client masking
5. Config / docs: `.env.example`, README, `docs/sentry-setup.md`; removed `lib/rollbar.js` and `rollbar` dependency

---

## Remaining (ops / verify)

- [ ] Set `SENTRY_DSN` + `SENTRY_ENV` on Heroku (staging → review → production), including worker/cron dynos
- [ ] Staging: HTTP test error → Sentry with user + request
- [ ] Staging: GraphQL resolver throw → client `Unexpected error.`; Sentry has original stack
- [ ] Staging: worker / cron failure → correct `process` tag
- [ ] Confirm `NODE_ENV=test` / missing DSN → no network calls
- [ ] Unset `ROLLBAR_SERVER_TOKEN` on Heroku after verified
- [ ] Run `yarn install` in the monorepo so `yarn.lock` drops `rollbar` if still present

---

## Out of scope / later

- Performance tracing / APM (`tracesSampleRate` > 0)
- Uploading backend source maps
- Migrating `sails.log` / Winston into Sentry Logs product
- Changing Yoga to expose `originalError` to clients in production (not recommended)
