# TODO: Replace backend Rollbar with Sentry (`@sentry/node`)

**Status:** Not started  
**Goal:** Migrate `apps/backend` error reporting from Rollbar to Sentry so API / worker / cron failures live in the same Sentry project as web (`@sentry/react`) and mobile (`@sentry/react-native`).

**Related:** [docs/sentry-setup.md](./sentry-setup.md) (current web + mobile setup). Backend today has **no** Sentry SDK — only Rollbar + `sails.log` / `console.*`.

---

## Why

- Web Sentry often shows GraphQL action failures as opaque `Unexpected error.` (Yoga error masking). The real exception is currently only on server logs (`sails.log.error` in Yoga `maskError`).
- One error product across web / mobile / API makes correlation (user, time, release) practical.
- Web already dropped Rollbar; backend is the remaining Rollbar dependency.

---

## Decisions to make before coding

- [ ] **Project:** Same shared Sentry project as web/mobile, or a dedicated “backend” project? Prefer **same project** + tags (`surface:backend`, `process:web|worker|cron`) unless quota / noise is a concern.
- [ ] **DSN:** Create or reuse a **server** DSN / key (not the browser `VITE_SENTRY_DSN`). Store as e.g. `SENTRY_DSN` or `SENTRY_SERVER_DSN` (runtime env — unlike web, no Vite prefix needed).
- [ ] **Environment tags:** Align with web: `production` / `staging` / `reviewApp` (from `NODE_ENV` / Heroku app / explicit `SENTRY_ENV`).
- [ ] **Tracing:** Start **errors only** (`tracesSampleRate: 0`), matching current web policy. Revisit later.
- [ ] **PII:** Decide `sendDefaultPii` and what user fields to set (`id`, `email`, `username`) — today Rollbar gets `req.rollbar_person` from `UserSession`.
- [ ] **Parallel run?** Optional short period with both Rollbar + Sentry, or hard cutover. Prefer hard cutover on staging first.

---

## Current Rollbar surface area (inventory)

| Location | Role |
|----------|------|
| `apps/backend/lib/rollbar.js` | Init / no-op stub when token missing or `NODE_ENV=test` |
| `apps/backend/app.js` | Early `rollbar.init` (uncaught / unhandled) |
| `apps/backend/lib/skiff.js` | `require('./rollbar')` to force init |
| `apps/backend/config/http.js` | Express `errorHandler()` middleware (`order` ends with `rollbar`) |
| `apps/backend/api/responses/error.js` | `rollbar.error(data, req)` on production 500s |
| `apps/backend/api/services/UserSession.js` | Sets `req.rollbar_person` |
| `apps/backend/api/controllers/SessionController.js` | `rollbar.error(error, req)` |
| `apps/backend/api/controllers/MobileAppController.js` | Forwards RN errors to Rollbar |
| `apps/backend/api/models/Notification.js` | Notification send failures |
| `apps/backend/api/services/OneSignal.js` | Push failures |
| `apps/backend/api/services/Websockets.js` | Socket emit failures |
| `apps/backend/worker.js` | Job failures |
| `apps/backend/cron.js` | Cron failures |
| `apps/backend/package.json` | `"rollbar": "^2.0"` |
| `apps/backend/.env.example`, `apps/backend/README.md` | `ROLLBAR_SERVER_TOKEN` docs |

GraphQL Yoga already logs masked unexpected errors via `maskAndLogGraphqlError` in `apps/backend/api/graphql/index.js` — **not** sent to Rollbar today. Sentry migration should capture those explicitly.

---

## Implementation steps

### 1. Package + thin facade

- [ ] Add `@sentry/node` to `apps/backend` (pin to a major compatible with Node version used in production; aim near web’s `@sentry/react` major if practical).
- [ ] Add `apps/backend/lib/sentry.js` (or `instrument.js`) that mirrors `lib/rollbar.js` behavior:
  - Init when `SENTRY_DSN` (or chosen name) is set and `NODE_ENV !== 'test'`
  - Export `disabled` flag + `error(err, req?, extra?)` / `captureException` helpers so call sites stay small
  - No-op stub when disabled (same pattern as Rollbar stub)
- [ ] Init **as early as possible** in process entrypoints (`app.js`, `worker.js`, `cron.js`, and whatever `skiff` lifts) so uncaught / unhandled rejections are captured. Prefer a single shared module required first.

### 2. HTTP / Express / Sails wiring

- [ ] Replace `config/http.js` Rollbar middleware with Sentry’s request error handling:
  - Either `Sentry.setupExpressErrorHandler` on the underlying Express app (via `customMiddleware` / Sails hooks), **or**
  - Keep end-of-pipeline middleware that calls `Sentry.captureException` for unhandled errors
- [ ] In `api/responses/error.js`, replace `rollbar.error(data, req)` with Sentry capture for production 500s; attach request context (method, URL, user id).
- [ ] Replace `req.rollbar_person` in `UserSession` with `Sentry.setUser({ id, username, email })` (clear user on logout if applicable).

### 3. Replace all `rollbar.error` call sites

For each site below: `Sentry.captureException(err, { extra: … })` (or facade `error(...)`), preserving useful context:

- [ ] `SessionController.js`
- [ ] `MobileAppController.js` (keep RN payload in `extra`)
- [ ] `Notification.js`
- [ ] `OneSignal.js`
- [ ] `Websockets.js`
- [ ] `worker.js` (job name / queue data in `extra`)
- [ ] `cron.js` (ensure process still exits / lowers after report; Rollbar used a callback — use `Sentry.flush()` before exit)

### 4. GraphQL Yoga (important)

- [ ] In `maskAndLogGraphqlError` (`api/graphql/index.js`), when masking an unexpected error, also **`Sentry.captureException(original)`** with tags/extra:
  - `graphql: true`
  - path / operation name if available
  - `currentUserId` from context when present
- [ ] Keep Yoga **client masking** (`Unexpected error.`) — do **not** leak internals to browsers.
- [ ] Keep `sails.log.error` (or drop once Sentry is verified — optional).

### 5. Config, deploy, docs

- [ ] Add env var to `.env.example` and `README.md`; remove / deprecate `ROLLBAR_SERVER_TOKEN`.
- [ ] Set DSN + environment on Heroku (staging → review → production) and worker/cron dynos if they use separate config.
- [ ] Tag releases if/when backend source maps or release health are desired (optional follow-up).
- [ ] Update [docs/sentry-setup.md](./sentry-setup.md): add a **Backend** section; note Rollbar removal; document filters (`surface:backend`, `process:worker`, etc.).
- [ ] Remove `rollbar` from `package.json` after cutover verified.

### 6. Verification

- [ ] Staging: throw a test error from an HTTP route → appears in Sentry with user + request.
- [ ] Staging: force a GraphQL resolver throw → client still sees `Unexpected error.`; Sentry has the **original** message/stack.
- [ ] Staging: fail a worker job and a cron path → events appear with correct `process` tag.
- [ ] Confirm `NODE_ENV=test` / missing DSN → no network calls (stub).
- [ ] Production cutover: enable DSN, monitor for noise, then remove Rollbar token and package.

---

## Out of scope / later

- Performance tracing / APM (`tracesSampleRate` > 0)
- Uploading backend source maps
- Migrating `sails.log` / Winston into Sentry Logs product
- Changing Yoga to expose `originalError` to clients in production (not recommended)

---

## Success criteria

1. No `rollbar` dependency or `ROLLBAR_SERVER_TOKEN` in normal deploys.
2. Backend unexpected GraphQL errors appear in Sentry with the **unmasked** original error.
3. Web action-error events (`action error for FETCH_*`) can be correlated in time/user with backend Sentry events for the same incident.
4. [docs/sentry-setup.md](./sentry-setup.md) documents web + mobile + backend.
