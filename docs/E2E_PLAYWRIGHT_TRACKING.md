# Playwright E2E — tracking, email flows, and viewports

This document tracks how we plan to grow end-to-end (E2E) coverage for `apps/web`, how email-dependent flows can be tested, and how we cover **desktop web** vs **mobile web** (real mobile user-agent + viewport).

**Status:** early — current E2E is a minimal smoke test plus an optional screenshot utility. Most routes are not yet covered.

---

## 1. How E2E works in this repo today

- **Frontend:** Playwright starts the Vite dev server via `playwright.config.js` (`webServer: yarn dev`). Isolated runs default to **`http://localhost:3330`** (`E2E_WEB_PORT`) so your normal dev server can stay on `:3000`.
- **Backend:** The web app’s `package.json` sets `"proxy": "localhost:3001"`. The browser’s network calls to the app’s origin are proxied to the Sails API — so **E2E is not mocked** unless we add Playwright `page.route()` / MSW or change proxying.
- **Auth setup:** `e2e/auth.setup.js` logs in with real credentials from `E2E_TEST_USERNAME` and `E2E_TEST_PASSWORD` in `apps/web/.env` and saves `e2e/.auth/session.json`.
- **Projects:** `chromium` / `mobile-chrome` (authenticated session), `chromium-unauth` / `mobile-unauth` (`e2e/unauthenticated.routes.spec.js` only, no session). Run all with `yarn test:e2e`, mobile authed with `yarn test:e2e:mobile`, unauthenticated matrix with `yarn test:e2e:unauth`.
- **Isolated mode (default):** all Playwright scripts now go through isolated orchestration (`run-isolated-e2e.js`) so E2E does not hit your regular `:3001` dev backend.
- **Seed source:** isolated runs default to `E2E_SEED_PROFILE=e2e`, which runs `apps/backend/scripts/seed-e2e-baseline.js` (single `pg` connection, minimal rows — not legacy Knex dummy/farm seeds).

**Implication:** full flows need a running backend (local or CI-hosted) and realistic test data. That is the right tradeoff for “true” E2E; faster, narrower tests can stay at the Jest/RTL layer with mocks.

---

## 2. Email-based flows (reset password, sign-up codes, magic links)

These flows are hard in E2E because the “source of truth” is an out-of-band email.

### Chosen approach: backend test-only hooks (no extra mail service)

We standardize on **non-production-only** APIs that E2E can call after triggering an email-backed step, for example:

- Return the latest verification/reset **token or magic link** for a designated test user, or
- Accept a fixed **E2E-only** reset code when a shared secret header/env matches.

**Requirements:**

- Gate with **environment** (never enable in production) and preferably **network** (localhost / internal CI only).
- Use **dedicated test accounts** and secrets (`E2E_SECRET`, etc.) stored in CI.

**Alternatives (not our default):** SMTP sink (Mailpit/MailHog), or third-party test inboxes — useful if we later want full mail pipeline coverage without backend hooks.

---

## 3. Desktop vs mobile web in Playwright

**Do not** rely on shrinking the desktop viewport alone: `ismobilejs` (and `util/mobile.js` / `isMobileDevice()`) keys off **user agent** and related signals, not width.

The **`mobile-chrome`** project uses Playwright’s `devices['Pixel 5']` preset (viewport, touch, **mobile Chrome user agent**). That makes `isMobile.any`, `isMobile.android.phone`, and `isMobileDevice()` behave like real mobile web — not like desktop resized.

Auth still runs once in `setup` (desktop); both test projects reuse `./e2e/.auth/session.json`.

---

## 4. Route & flow coverage checklist

Use this table to track **intent** first; link PRs that add or extend specs. Prioritize **auth**, **join**, **post**, **group home**, **settings**, and **moderation** paths that change often.

For **authenticated** work, use the thematic batches in **§4.4** — implement one batch at a time, run Playwright, then adjust before moving on.

Legend: **—** not started · **WIP** · **done** · **N/A**

### 4.1 Unauthenticated / public

Covered by `e2e/unauthenticated.routes.spec.js` on **`chromium-unauth`** and **`mobile-unauth`** (not the authed projects). Requires a running API (isolated runs: port from `E2E_BACKEND_PORT` or auto-scan **3101–3199**; proxied via Vite as `/noo`).

| Flow / route area | Desktop (`chromium-unauth`) | Mobile (`mobile-unauth`) | Notes / spec file |
|-------------------|----------------------------|--------------------------|-------------------|
| `/` → `/login` | done | done | `unauthenticated.routes.spec.js` |
| `/login`, `/signup`, `/reset-password` | done | done | |
| `/notifications?token=&name=` | done | done | |
| `/public`, `/public/map`, `/public/groups` | done | done | |
| `/oauth/login/:uid`, `/oauth/consent/:uid` | done | done | |
| `/post/:id`, post URL redirects | done | done | |
| Join + public group + unknown route | done | done | |
| `/signup/*` deeper steps (verify email, etc.) | — | — | Needs §2 hooks when we E2E those |
| `/reset-password` submit + email | — | — | Needs §2 hooks |

### 4.2 Authenticated (major groups from `AuthLayoutRouter`)

High-level tracker only; **§4.4** breaks this into small batches. Update this table when a batch (or part of it) lands.

| Flow / route area | Desktop | Mobile | Notes |
|-------------------|---------|--------|-------|
| Batch A — shell & redirects | done | done | `authenticated.shell.spec.js` |
| Batches B–C — `/all` + `/public` contexts | — | — | §4.4 |
| Batch D — group workspace | — | — | §4.4 |
| Batch E — post detail & deep links | — | — | §4.4 |
| Batch F — members & profiles | — | — | §4.4 |
| Batch G — messages | — | — | §4.4 |
| Batch H — “My”, settings, search, themes | — | — | §4.4 |
| Batch I — group settings & moderation | — | — | §4.4 |
| Batch J — create/edit modal routes | — | — | §4.4 |
| Batch K — welcome wizard & management | — | — | §4.4 |
| Batch L — create group & happy-path join | — | — | §4.4 |
| Batch M — group welcome modal | — | — | §4.4 |

### 4.3 Email-dependent flows (tie to §2)

| Flow | Desktop | Mobile | Notes |
|------|---------|--------|-------|
| Sign-up verification | — | — | Backend E2E hooks |
| Password reset | — | — | Backend E2E hooks |
| Invite / magic link (if any) | — | — | Backend E2E hooks |

### 4.4 Authenticated route coverage — thematic batches

Work through these in order; each batch should be a **small PR** (or a few specs) with a green Playwright run before the next.

**Baseline already in repo (not repeated below):** `e2e/smoke.spec.js` (minimal). **`e2e/unauthenticated.routes.spec.js`** covers logged-out shell: `/` → `/login`, `/login`, `/signup`, `/reset-password`, `/notifications?token=…` (when JWT env is set), `/public` (+ map/groups), OAuth shells, post URL redirects, join/invite error paths, unknown → `/login`.

**Suggested sequence:** **A → B → C → D** (core navigation), then **E → F**, **G → H**, **I → J**, **K → L**, **M** last.

| Batch | Theme | Routes / flows to cover (representative) |
|-------|--------|-------------------------------------------|
| **A** | Authenticated shell & redirects | Default landing (`*` → `/all` or last group); `/notifications` → `/my/notifications`; legacy `/settings/*`; `/public/*` inside auth shell → `/public/stream` — **spec:** `e2e/authenticated.shell.spec.js` |
| **B** | Global context **`/all`** | `/all/stream`, `/all/map`, `/all/topics`, `/all/topics/:topicName`; `/all/projects`, `/all/proposals`, `/all/events`; `/all/members/:personId/*`; redirects `/all/members`, `/all/settings` → `/all` |
| **C** | Global context **`/public`** (logged in) | `/public/stream`, `/public/map`, `/public/groups`; `/public/topics`, `/public/topics/:topicName`; `/public/projects`, `/public/proposals`, `/public/events`; redirects `/public/members`, `/public/settings` → `/public` |
| **D** | Group workspace `/groups/:slug/*` | `about`, `stream`, `map`, `discussions`, `events`, `resources`, `projects`, `proposals`, `requests-and-offers`, `explore`, `custom/:customViewId`, nested `groups`, `topics` / `topics/:topicName`, `all-views`; `tracks`, `tracks/:trackId`; `funding-rounds`, `funding-rounds/:fundingRoundId`; `chat/:topicName`; inner `*` → group home (`/stream` or `homeRoute`) |
| **E** | Post detail & dual-column | `/post/:postId/*`; group-scoped `POST_DETAIL_MATCH`; detail-column URLs under `/all/map/…`, `/all/groups/…`, `/public/map/…`, `/public/groups/…` (pick the combos you rely on) |
| **F** | Members & profiles | `/members/:personId/*`; group `members`, `members/:personId`, `members/create` |
| **G** | Messages | `/messages`; `/messages/:messageThreadId` |
| **H** | “My” & account | `/my`, `/my/posts`, `/my/interactions`, `/my/announcements`, `/my/mentions`, `/my/saved-posts`, `/my/tracks`; `/my/*` → `UserSettings` (key subpaths); `/themes`; `/search/*` |
| **I** | Group settings & moderation | `/groups/:slug/settings/*` (at least one tab); `/groups/:slug/moderation/*` |
| **J** | Create / edit (modal routes) | Sample matrix only — one URL per pattern per context (`groups` / `all` / `public` / `my`): `…/create/*`, `…/post/:postId/create/*`, `…/post/:postId/edit/*`, track create/edit, custom-view post edit, etc. (not every permutation) |
| **K** | Onboarding & admin | `/welcome/*` (`WelcomeWizardRouter`); `/management/*` (admin-only; gate on seeded fixture user) |
| **L** | Create group & happy-path join | `/create-group/*`; authenticated `/groups/:slug/join/:validCode` and `/h/use-invitation?token=valid` (needs seeded invite data in E2E DB) |
| **M** | Group welcome overlay | `GroupWelcomeModal` wraps `groups/:groupSlug/*` — smoke first visit to a seeded group (optional; UI-heavy) |

**Source of truth for paths:** `apps/web/src/routes/AuthLayoutRouter/AuthLayoutRouter.js` (and `RootRouter.js` for logged-out vs logged-in split).

---

## 5. Production WebView flags (`isLegacyWebView`, `HyloMobileV2`)

The React Native app injects globals (`ReactNativeWebView`, optionally `HyloMobileV2`) so the web bundle can hide chrome and talk to native code. **We are not simulating WebViews in Playwright** for the route matrix above.

**Why not delete those branches in web code right now:** `isLegacyWebView()` and `window.HyloMobileV2` still guard behavior for **released app versions**. Removing or collapsing them can break older WebViews or require coordinated **mobile** releases. Cleaning that up is a separate deprecation effort — not part of this E2E doc.

---

## 6. CI/CD (future)

When we add E2E to CI:

1. **Job order:** start database → migrate/seed → start backend (`3001`) → start web (`3000`) or rely on Playwright `webServer` only for web and add **healthcheck** for API.
2. **Secrets:** `E2E_TEST_USERNAME`, `E2E_TEST_PASSWORD`; `E2E_SECRET` (or similar) for email/token hooks.
3. **Mail:** no separate mail stack if using §2 hooks.
4. **Scope:** run **smoke + critical path** on every PR; full matrix (desktop + mobile) as budget allows.

### Isolated local command (recommended while building coverage)

From `apps/web`:

```bash
yarn test:e2e:isolated
```

Optional env vars:

- `E2E_BACKEND_PORT` — pin the API port; **if unset**, the runner scans **`E2E_BACKEND_PORT_RANGE_LO`–`E2E_BACKEND_PORT_RANGE_HI`** (default **3101–3199**) for the first free port so a stray process on 3101 does not fail the run with `EADDRINUSE`
- `E2E_WEB_PORT` (default **`3330`** — avoids clashing with `yarn dev` on `3000`)
- `E2E_DB_NAME` (default `hylo_e2e`)
- `E2E_DATABASE_URL` — **set this to match Docker Postgres** (host, port, user, password). The **last path segment is the database name** used for `dropdb` / `createdb` / `psql` / backend (they must stay in sync). Prefer a dedicated DB, e.g. `.../hylo_e2e`, not your main `hylo` dev DB. Local Docker usually has **no TLS** — isolated tooling defaults `PGSSLMODE` to `disable`; set `PGSSLMODE=require` only if your DB expects SSL.
- `E2E_ALLOW_DANGEROUS_DB=1` — only if you intentionally point E2E at a blocked name (`hylo`, `hylo_test`, `postgres`, templates).
- `E2E_SEED_PROFILE` (default `e2e`; set to `none` to skip seeding, or `development`/`dummy` only if you explicitly need those profiles)
- `E2E_KEEP_DB=1` (keep DB for debugging after run)

The deterministic `e2e` seed profile creates a fixed login account (`e2e.user@hylo.test` / `e2e-password-123`) used by Playwright auth setup. This no longer depends on `E2E_TEST_USERNAME` / `E2E_TEST_PASSWORD`.

### Troubleshooting isolated runs

- **`/notifications` E2E skipped or notification API 403** — The manage-notifications page needs a real RS256 `notification_settings` JWT. The isolated runner loads `apps/backend/.env` and, after seeding, runs `scripts/print-e2e-notification-jwt.js` to set `E2E_NOTIFICATION_PAGE_JWT` for Playwright. Ensure **`OIDC_KEYS`** is set in backend env (same as local API). Without it, that test is skipped and malformed tokens no longer spam the server log (controller returns 403).
- **`dropdb: database "hylo_e2e" is being accessed by other users`** — Usually a leftover Sails (`node app.js`), TablePlus, or a prior interrupted run. The runner now runs `pg_terminate_backend` on that DB before `dropdb`, and waits for the isolated API process to exit (then `SIGKILL` if needed) before dropping at the end. If you still see this, disconnect GUI clients or run manually (as a superuser / owner):  
  `psql "$E2E_DATABASE_URL" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'hylo_e2e' AND pid <> pg_backend_pid();"`  
  (adjust URL / name to match your env).
- **`EADDRINUSE` on the API port** — Another process is bound there; set `E2E_BACKEND_PORT` or let the runner pick a free port in its scan range.
- **Debugging DB state** — `E2E_KEEP_DB=1` skips the final `dropdb` so you can inspect data; you may still need session termination before the *next* run’s recreate step (the script does that automatically at **start** of each run).

---

## 7. References in repo

- Playwright config: `apps/web/playwright.config.js`
- Specs: `apps/web/e2e/*.spec.js` (incl. `authenticated.shell.spec.js` for Batch A)
- Auth setup: `apps/web/e2e/auth.setup.js`
- Mobile UA helpers: `apps/web/src/util/mobile.js`, `ismobilejs` usage across routes
- Top-level routing: `apps/web/src/routes/RootRouter/RootRouter.js`
- Authenticated shell routes: `apps/web/src/routes/AuthLayoutRouter/AuthLayoutRouter.js`

---

## 8. Changelog

| Date | Change |
|------|--------|
| 2026-04-30 | Initial doc: email strategies, viewport/WebView matrix, route checklist |
| 2026-04-30 | Mobile Playwright project (`mobile-chrome`), mail strategy = backend hooks only; drop WebView from E2E scope; note on WebView flags in production |
| 2026-04-30 | Unauthenticated route suite (`unauthenticated.routes.spec.js`), projects `chromium-unauth` / `mobile-unauth`, script `yarn test:e2e:unauth` |
| 2026-04-30 | Added isolated orchestration script (`yarn test:e2e:isolated`) to provision DB + backend on dedicated port for Playwright runs |
| 2026-04-30 | Switched all Playwright scripts to isolated orchestration by default |
| 2026-04-30 | E2E baseline data via `apps/backend/scripts/seed-e2e-baseline.js` (pg); isolated runner defaults to `E2E_SEED_PROFILE=e2e` |
| 2026-05-01 | Isolated web default port `3330` (`E2E_WEB_PORT`); Playwright `baseURL` / `webServer.url` follow `E2E_WEB_PORT` or `PORT` |
| 2026-05-01 | Isolated API port auto-scan when `E2E_BACKEND_PORT` unset; RootRouter fullscreen loading for single-segment unknown paths (faster `/login` redirect UX under checkLogin) |
| 2026-05-01 | Isolated runner: `pg_terminate_backend` before `dropdb`; graceful API shutdown + SIGKILL before final drop; troubleshooting section |
| 2026-05-01 | §4.4: thematic batches (A–M) for authenticated route E2E; §4.2 table aligned to batches; unauthenticated §4.1 note for isolated API port |
| 2026-05-01 | Batch A: `e2e/authenticated.shell.spec.js` (landing, /notifications, /settings/edit-profile, /public→stream, all/public members & settings stubs) |
