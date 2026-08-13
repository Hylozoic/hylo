# Sentry setup (web + mobile)

Hylo reports client errors to a **single Sentry project** (the same project the React Native app has always used). The web app sends events through `@sentry/react`; mobile uses `@sentry/react-native`. Events from the embedded WebView are tagged so you can tell them apart from standalone browser sessions and tie them to the native app launch.

## What gets reported

| Surface | SDK | When reporting is on |
|--------|-----|----------------------|
| **Web** (browser or WebView) | `@sentry/react` via `apps/web/src/client/errorReporter.js` | Only when `VITE_SENTRY_DSN` is set at **build time** |
| **Mobile** (native) | `@sentry/react-native` via `apps/mobile/config/index.js` | Release/staging builds (`NODE_ENV=production`); local dev only if `SENTRY_DEV_DSN_URL` is set |

Web integration points (same plumbing as the old Rollbar client):

- React `ErrorBoundary`
- Redux `errorReporterMiddleware` (action errors; optional per-action breadcrumbs in debug mode)
- Socket subscribe failures (`SocketListener`, `SocketSubscriber`)
- User context after `FETCH_FOR_CURRENT_USER` (`AuthLayoutRouter.store.js`)

**Production web:** errors only (`tracesSampleRate: 0`).

**Staging / review web** (`VITE_SENTRY_DEBUG=true`): same gate turns on **browser performance tracing** (pageload Web Vitals, fetch/GraphQL child spans when sampled). See [Performance tracing](#performance-tracing-web) below.

If `VITE_SENTRY_DSN` is missing on a web build, the reporter stays disabled and errors fall back to `console.error` (no Sentry traffic).

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

When `VITE_SENTRY_DEBUG` is on, web init also enables `browserTracingIntegration()` and sets `tracesSampleRate` (default **1**; override with `VITE_SENTRY_TRACES_SAMPLE_RATE` e.g. `0.2` if quota is a concern). Console: `__hyloSentryStatus.tracing` after load.

### Mobile: `AUTH_DEBUG=true`

Set in `apps/mobile/.env` (or Bitrise env) **before** building. Not a Sentry env var, but it feeds Sentry on staging builds:

- Auth-related console output that survives release builds (see `apps/mobile/src/util/authDebug.js`)
- Sentry breadcrumbs and occasional auth events
- `webviewDebuggingEnabled` on `HyloWebView` (Safari Web Inspector / Chrome remote debug on physical devices)

Do **not** enable `AUTH_DEBUG` on production store builds.

### Mobile: WebView auth handshake telemetry (automatic on staging API)

When `API_HOST` contains `staging` (typical Bitrise review/staging builds), native code emits low-volume Sentry messages tagged `[auth-handshake]` for:

- `session/from-token` success/failure
- Cookie bridge, `VERIFY_AUTH`, `SESSION_READY`, `AUTH_SUCCESS`, `LOGOUT`, `WEB_BOOT`
- `PrimaryWebView` loading overlay at 5s / 15s / 30s

Same events also fire when `AUTH_DEBUG=true`. **Prod API + App Store builds** do not emit these unless `AUTH_DEBUG` is set.

On the **web** side (WebView JS), `mobileAuthReport` fires immediately when a stall starts, then every 5s / 10s while `RootRouter` or `AuthLayoutRouter` is waiting on auth/bootstrap. Search Sentry for `WebView auth still loading` or `VERIFY_AUTH sent to native`.

---

## Performance tracing (web)

Tracing is **off** unless `VITE_SENTRY_DSN` is set **and** `VITE_SENTRY_DEBUG=true` (staging / review). Production keeps `tracesSampleRate: 0` even when DSN is set.

### What you get today (automatic)

With debug + tracing on, Sentry Performance receives:

| Signal | Source |
|--------|--------|
| Pageload transaction | `browserTracingIntegration` — TTFB, FCP, LCP, INP (as supported by SDK) |
| `/noo/graphql` fetch spans | Same integration + `tracePropagationTargets` |
| Standalone browser vs WebView | Filter `mobileWebView:true` / `nativeSessionId` on transactions (tags set at init) |

Open **Performance → Web Vitals** or **Traces**, filter `environment:staging` or `environment:reviewApp`.

### Options to go further (not all implemented)

| Approach | Effort | Best for |
|----------|--------|----------|
| **A. Automatic browser tracing** (current when debug on) | Low | Cold load, GraphQL waterfall on pageload |
| **B. Custom boot spans** | Low | Auth/bootstrap phases — `withBootSpan('checkLoginAndBootstrap', …)` in `RootRouter` / `AuthLayoutRouter` (`client/errorReporter.js`) |
| **C. React Router v6 tracing** | Medium | Per-route navigations after first paint — `reactRouterV6BrowserTracingIntegration` wired where `HistoryRouter` is created |
| **D. Manual transactions** | Medium | One “WebView boot” transaction from first script to `hasLoadedUser` — `Sentry.startInactiveSpan` + end when auth layout ready |
| **E. Session Replay** | Medium / quota | Reproduce UX stalls alongside traces — `replayIntegration()`; usually sample lower than traces |
| **F. DevTools only** | None | `performance.mark('hylo-auth-bootstrap')` in `AuthLayoutRouter` (already in dev); no Sentry quota |
| **G. Native mobile tracing** | Separate | `@sentry/react-native` `tracesSampleRate` gated on `AUTH_DEBUG` or `onStagingAPI` — correlates with WebView via `nativeSessionId` |

**Quota tips:** On review apps with few users, `VITE_SENTRY_TRACES_SAMPLE_RATE=1` is fine. For staging with real traffic, try `0.1`–`0.3`. Use Sentry’s inbound filters or `tracesSampler` in code if you need “always sample WebView, rarely sample desktop”.

**Boot work specifically:** Combine **A + B** — automatic pageload plus named spans for `checkLogin`, `fetchForCurrentUser`, and first group fetch so the Performance waterfall shows auth vs network vs render without enabling full session replay.

---

## Environment variables by deployment

Vite only exposes variables prefixed with `VITE_`. Web Sentry settings must exist on Heroku (or your build host) **before** `yarn build` — changing them requires a **redeploy/rebuild**, not just a dyno restart.

Mobile reads `react-native-config` at **build time** for `.env` / Bitrise secrets.

### Shared value

| Variable | Where | Value |
|----------|--------|--------|
| DSN | Web: `VITE_SENTRY_DSN` · Mobile: `SENTRY_DSN_URL` | Client DSN from the shared Sentry project (Settings → Client Keys). Same project as existing mobile production reporting. |

Optional for local mobile-only experiments: `SENTRY_DEV_DSN_URL` (separate dev project — see `apps/mobile/README.md`).

---

### Staging

**Web** (e.g. `staging.hylo.com` Heroku app):

| Variable | Value |
|----------|--------|
| `VITE_SENTRY_DSN` | Shared project DSN |
| `VITE_SENTRY_ENV` | `staging` |
| `VITE_SENTRY_DEBUG` | `true` |

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
| `VITE_SENTRY_TRACES_SAMPLE_RATE` | optional (default `1` when debug on) | optional | off |

| | Staging / review mobile | Production mobile |
|--|-------------------------|-------------------|
| `SENTRY_DSN_URL` | ✓ | ✓ |
| Sentry `environment` (in app) | `staging` (staging API) | `production` |
| `AUTH_DEBUG` | optional `true` | off |

---

## Verify in the browser

After deploy, open DevTools console:

- `__hyloSentryStatus` — always set once the app bundle loads. `{ enabled: true }` means `VITE_SENTRY_DSN` was present at **build** time; `{ enabled: false }` means redeploy after setting the Heroku config var.
- `__hyloSentryTest()` — available when `enabled` is true; sends a test error.

Heroku build logs should include `Sentry: VITE_SENTRY_DSN is set` or `... is not set` during the web build.

---

## Useful Sentry filters

- `environment:staging` / `environment:reviewApp` / `environment:production` — web (and native where applicable)
- `mobileWebView:true` — errors from web code running inside the app WebView
- `nativeSessionId:<id>` — full session (native + injected web tags on web events)
- User email/id — set on web after current-user fetch; native uses existing mobile user context where configured

---

## Legacy Rollbar (web)

The web app no longer reads `ROLLBAR_CLIENT_TOKEN` or `ROLLBAR_ENV`. Those Heroku config vars can be removed after Sentry is verified. Do not add non-`VITE_` names for client Sentry settings — they will not reach the browser bundle.

---

## Source maps (optional follow-up)

Production web stack traces may be minified until release artifacts are uploaded to Sentry (e.g. `@sentry/vite-plugin` + `SENTRY_AUTH_TOKEN` in CI). Error reporting works without this; source maps only improve frame readability.

Mobile: iOS build sets `SENTRY_DISABLE_AUTO_UPLOAD=true` in `apps/mobile/ios/.xcode.env`; release/source-map upload behavior follows whatever is already configured in Bitrise/Sentry for React Native.

---

## Code references

- Web init and tags: `apps/web/src/client/errorReporter.js`
- Web Redux breadcrumbs: `apps/web/src/store/middleware/errorReporterMiddleware.js`
- Mobile init: `apps/mobile/config/index.js`, `apps/mobile/index.js`
- WebView injection: `apps/mobile/src/components/HyloWebView/HyloWebView.js`
- Auth debug → Sentry: `apps/mobile/src/util/authDebug.js`
- Review app env template: `apps/web/app.json`
