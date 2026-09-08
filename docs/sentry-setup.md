# Sentry setup (web + mobile + backend)

Hylo reports errors to a **single Sentry project** (the same project the React Native app has always used). Web uses `@sentry/react`, mobile uses `@sentry/react-native`, and the API / worker / cron processes use `@sentry/node`. Events are tagged so you can filter by surface and correlate client failures with server exceptions.

## What gets reported

| Surface | SDK | When reporting is on |
|--------|-----|----------------------|
| **Web** (browser or WebView) | `@sentry/react` via `apps/web/src/client/errorReporter.js` | Only when `VITE_SENTRY_DSN` is set at **build time** |
| **Mobile** (native) | `@sentry/react-native` via `apps/mobile/config/index.js` | Release/staging builds (`NODE_ENV=production`); local dev only if `SENTRY_DEV_DSN_URL` is set |
| **Backend** (API, worker, cron) | `@sentry/node` via `apps/backend/lib/sentry.js` | When `SENTRY_DSN` is set at **runtime** and `NODE_ENV !== 'test'` |

Web integration points (same plumbing as the old Rollbar client):

- React `ErrorBoundary`
- Redux `errorReporterMiddleware` (action errors; optional per-action breadcrumbs in debug mode)
- Socket subscribe failures (`SocketListener`, `SocketSubscriber`)
- User context after `FETCH_FOR_CURRENT_USER` (`AuthLayoutRouter.store.js`)

Backend integration points:

- Uncaught exceptions / unhandled rejections (early init in `app.js`, `worker.js`, `cron.js`, `lib/skiff.js`)
- Express/Sails error middleware (`config/http.js`) and production 500 responses (`api/responses/error.js`)
- Explicit captures (sessions, notifications, OneSignal, websockets, worker jobs, cron)
- GraphQL Yoga unexpected errors: client still sees `Unexpected error.`; Sentry gets the **original** exception (`api/graphql/index.js`)

All surfaces report **errors only** (`tracesSampleRate: 0`). No performance tracing unless we change that deliberately.

If `VITE_SENTRY_DSN` is missing on a web build, the reporter stays disabled and errors fall back to `console.error` (no Sentry traffic). If `SENTRY_DSN` is missing on the backend, reporting is a no-op stub.
## WebView ↔ native correlation

On each app launch, mobile generates a `nativeSessionId` (`apps/mobile/src/util/nativeSessionId.js`):

- Tagged on the **native** Sentry scope
- Injected into the WebView as `window.HyloNativeSessionId` before page JS runs (`HyloWebView`)

The web reporter also tags:

- `mobileWebView`: `true` when `window.HyloMobileV2` is set
- `mobileAppVersion`: from `window.HyloMobileAppVersion` when present
- `nativeSessionId`: when injected

In Sentry, search or filter on `nativeSessionId` to see native and WebView errors from one device session. Filter `mobileWebView:true` for errors that originated inside the mobile WebView.

## Extra diagnostics (staging / review)

### Web: `VITE_SENTRY_DEBUG=true`

When set at build time:

- Redux middleware records a **breadcrumb for every dispatched action** (not just errors)
- Sentry `maxBreadcrumbs` increases from 50 → 200

Use on staging and review apps; leave unset or `false` on production web unless you are doing a short, intentional debug window.

### Mobile: `AUTH_DEBUG=true`

Set in `apps/mobile/.env` (or Bitrise env) **before** building. Not a Sentry env var, but it feeds Sentry on staging builds:

- Auth-related console output that survives release builds (see `apps/mobile/src/util/authDebug.js`)
- Sentry breadcrumbs and occasional auth events
- `webviewDebuggingEnabled` on `HyloWebView` (Safari Web Inspector / Chrome remote debug on physical devices)

Do **not** enable `AUTH_DEBUG` on production store builds.

---

## Environment variables by deployment

Vite only exposes variables prefixed with `VITE_`. Web Sentry settings must exist on Heroku (or your build host) **before** `yarn build` — changing them requires a **redeploy/rebuild**, not just a dyno restart.

Mobile reads `react-native-config` at **build time** for `.env` / Bitrise secrets.

### Shared value

| Variable | Where | Value |
|----------|--------|--------|
| DSN (client) | Web: `VITE_SENTRY_DSN` · Mobile: `SENTRY_DSN_URL` | Browser / native client key from the shared Sentry project (Settings → Client Keys) |
| DSN (server) | Backend: `SENTRY_DSN` | **Server** key from the same project — not the browser `VITE_SENTRY_DSN`. Set on API, worker, and cron dynos (runtime; restart is enough, no rebuild). |

Optional for local mobile-only experiments: `SENTRY_DEV_DSN_URL` (separate dev project — see `apps/mobile/README.md`).

---

### Staging

**Web** (e.g. `staging.hylo.com` Heroku app):

| Variable | Value |
|----------|--------|
| `VITE_SENTRY_DSN` | Shared project DSN |
| `VITE_SENTRY_ENV` | `staging` |
| `VITE_SENTRY_DEBUG` | `true` |

**Backend** (staging API / worker / cron Heroku apps):

| Variable | Value |
|----------|--------|
| `SENTRY_DSN` | Shared project **server** DSN |
| `SENTRY_ENV` | `staging` |

**Mobile** (Bitrise staging workflow — production JS bundle, staging API):

| Variable | Value |
|----------|--------|
| `SENTRY_DSN_URL` | Shared project DSN (usually already on workflow) |
| `API_HOST` | Staging API (drives Sentry `environment: staging` in code) |
| `AUTH_DEBUG` | `true` recommended while debugging auth/WebView issues |

Sentry **environment tag** on mobile for these builds: `staging` (derived from `API_HOST` containing `staging`).

---

### Review apps

Review apps use the **same web configuration as staging**, except the Sentry environment name is different so you can filter PR-specific Heroku URLs in the Sentry UI.

**Web** (Heroku review app / PR frontend):

| Variable | Value |
|----------|--------|
| `VITE_SENTRY_DSN` | Shared project DSN |
| `VITE_SENTRY_ENV` | `reviewApp` |
| `VITE_SENTRY_DEBUG` | `true` |

Defaults for new review apps are declared in `apps/web/app.json` (`VITE_SENTRY_ENV`, `VITE_SENTRY_DEBUG`). You still must set `VITE_SENTRY_DSN` on the review app (or pipeline) — it is optional in `app.json` and is not auto-filled.

**Backend** (if the review app includes an API dyno):

| Variable | Value |
|----------|--------|
| `SENTRY_DSN` | Shared project **server** DSN |
| `SENTRY_ENV` | `reviewApp` |

**Mobile** when a Bitrise workflow points at a review-app URL (e.g. `HYLO_WEB_BASE_URL=https://….herokuapp.com/`):

Same as staging mobile: `SENTRY_DSN_URL`, staging API, optional `AUTH_DEBUG=true`. Native events remain `environment: staging` when the app talks to the staging API.

Typical workflow: deploy review web with DSN + debug flags → install staging Bitrise build that loads that URL → correlate via `nativeSessionId` and `mobileWebView`.

---

### Production

**Web** (www / production Heroku):

| Variable | Value |
|----------|--------|
| `VITE_SENTRY_DSN` | Shared project DSN (add when enabling web Sentry in prod) |
| `VITE_SENTRY_ENV` | `production` |
| `VITE_SENTRY_DEBUG` | **Unset** or `false` |

**Backend** (production API / worker / cron):

| Variable | Value |
|----------|--------|
| `SENTRY_DSN` | Shared project **server** DSN |
| `SENTRY_ENV` | `production` |

**Mobile** (store / production Bitrise):

| Variable | Value |
|----------|--------|
| `SENTRY_DSN_URL` | Shared project DSN |
| `API_HOST` | Production API (Sentry `environment: production`) |
| `AUTH_DEBUG` | **Unset** / `false` |
| `SENTRY_DEV_DSN_URL` | Not used on release builds |

---

## Quick reference

| | Staging web | Review app web | Production web |
|--|-------------|----------------|----------------|
| `VITE_SENTRY_DSN` | ✓ | ✓ | ✓ |
| `VITE_SENTRY_ENV` | `staging` | `reviewApp` | `production` |
| `VITE_SENTRY_DEBUG` | `true` | `true` | off |

| | Staging / review mobile | Production mobile |
|--|-------------------------|-------------------|
| `SENTRY_DSN_URL` | ✓ | ✓ |
| Sentry `environment` (in app) | `staging` (staging API) | `production` |
| `AUTH_DEBUG` | optional `true` | off |

| | Staging backend | Review backend | Production backend |
|--|-----------------|----------------|--------------------|
| `SENTRY_DSN` | ✓ | ✓ | ✓ |
| `SENTRY_ENV` | `staging` | `reviewApp` | `production` |
---

## Verify in the browser

After deploy, open DevTools console:

- `__hyloSentryStatus` — always set once the app bundle loads. `{ enabled: true }` means `VITE_SENTRY_DSN` was present at **build** time; `{ enabled: false }` means redeploy after setting the Heroku config var.
- `__hyloSentryTest()` — available when `enabled` is true; sends a test error.

Heroku build logs should include `Sentry: VITE_SENTRY_DSN is set` or `... is not set` during the web build.

---

## Useful Sentry filters

- `environment:staging` / `environment:reviewApp` / `environment:production` — web, mobile, and backend
- `surface:backend` — API / worker / cron events
- `process:web` / `process:worker` / `process:cron` — which backend process emitted the event
- `graphql:true` — unexpected GraphQL resolver errors (unmasked original in Sentry; client still sees `Unexpected error.`)
- `mobileWebView:true` — errors from web code running inside the app WebView
- `nativeSessionId:<id>` — full session (native + injected web tags on web events)
- User email/id — set on web after current-user fetch; backend via `UserSession` / session; native uses existing mobile user context where configured

---

## Legacy Rollbar

The web app no longer reads `ROLLBAR_CLIENT_TOKEN` or `ROLLBAR_ENV`. The backend no longer reads `ROLLBAR_SERVER_TOKEN` (removed with the `@sentry/node` migration). Those Heroku config vars can be unset after Sentry is verified on each surface. Do not add non-`VITE_` names for client Sentry settings — they will not reach the browser bundle.

---

## Source maps (optional follow-up)

Production web stack traces may be minified until release artifacts are uploaded to Sentry (e.g. `@sentry/vite-plugin` + `SENTRY_AUTH_TOKEN` in CI). Error reporting works without this; source maps only improve frame readability.

Mobile: iOS build sets `SENTRY_DISABLE_AUTO_UPLOAD=true` in `apps/mobile/ios/.xcode.env`; release/source-map upload behavior follows whatever is already configured in Bitrise/Sentry for React Native.

Backend source maps / release health tagging are optional follow-ups (errors report without them).

---

## Code references

- Web init and tags: `apps/web/src/client/errorReporter.js`
- Web Redux breadcrumbs: `apps/web/src/store/middleware/errorReporterMiddleware.js`
- Mobile init: `apps/mobile/config/index.js`, `apps/mobile/index.js`
- WebView injection: `apps/mobile/src/components/HyloWebView/HyloWebView.js`
- Auth debug → Sentry: `apps/mobile/src/util/authDebug.js`
- Backend init and facade: `apps/backend/lib/sentry.js`
- Backend GraphQL capture: `apps/backend/api/graphql/index.js` (`maskAndLogGraphqlError`)
- Review app env template: `apps/web/app.json`
- Migration notes: `docs/TODO-backend-sentry-migration.md`