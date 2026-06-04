# Playwright E2E — tracking, email flows, and viewports

This document tracks how we plan to grow end-to-end (E2E) coverage for `apps/web`, how email-dependent flows can be tested, and how we cover **desktop web** vs **mobile web** (real mobile user-agent + viewport).

**Status:** early — current E2E is a minimal smoke test plus an optional screenshot utility. Most routes are not yet covered.

---

## 1. How E2E works in this repo today

- **Frontend:** Playwright starts the Vite dev server via `playwright.config.js` (`webServer: yarn dev`). Isolated runs default to **`http://localhost:3330`** (`E2E_WEB_PORT`) so your normal dev server can stay on `:3000`.
- **Backend:** The web app’s `package.json` sets `"proxy": "localhost:3001"`. The browser’s network calls to the app’s origin are proxied to the Sails API — so **E2E is not mocked** unless we add Playwright `page.route()` / MSW or change proxying.
- **Auth setup:** `e2e/auth.setup.js` logs in as the seeded user **`e2e.user@hylo.test`** / **`e2e-password-123`** (from `apps/backend/scripts/seed-e2e-baseline.js`) and saves `e2e/.auth/session.json`. Extra profiles: `auth.session-mutate.setup.js`, `auth.track-viewer.setup.js` (see §4.5).
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
| Paid content: public offering deep link (`/groups/:slug/offerings/:id`) | done | done | Batch **P5** — `unauthenticated.routes.spec.js` |
| `/signup/*` deeper steps (verify email, etc.) | — | — | Needs §2 hooks when we E2E those |
| `/reset-password` submit + email | — | — | Needs §2 hooks |

### 4.2 Authenticated (major groups from `AuthLayoutRouter`)

High-level tracker only; **§4.4** breaks this into small batches. Update this table when a batch (or part of it) lands.

| Flow / route area | Desktop | Mobile | Notes |
|-------------------|---------|--------|-------|
| Batch A — shell & redirects | done | done | `authenticated.shell.spec.js` |
| Batch B — `/all` context | done | done | `authenticated.all-context.spec.js` |
| Batch C — `/public` context (logged in) | done | done | `authenticated.public-context.spec.js` |
| Batch D — group workspace | done | done | `authenticated.group-workspace.spec.js` |
| Batch E — post detail & deep links | done | done | `authenticated.post-detail.spec.js` |
| Batch F — members & profiles | done | done | `authenticated.members-profiles.spec.js` |
| Batch G — messages | done | done | `authenticated.messages.spec.js` |
| Batch H — “My”, settings, search, themes | done | done | `authenticated.my-account.spec.js` §4.4 |
| Batch I — group settings & moderation | done | done | `authenticated.group-settings-moderation.spec.js` §4.4 |
| Batch J — create/edit modal routes | done | done | `authenticated.create-edit-modals.spec.js` §4.4 |
| Batch K — welcome wizard | done | done | `authenticated.welcome-management.spec.js` §4.4 |
| Batch L — create group & happy-path join | done | done | `authenticated.create-group-join.spec.js` §4.4 |
| Batch M — group welcome modal | done | done | `authenticated.group-welcome-modal.spec.js` §4.4 |
| Paid content / Stripe (batches **P1–P8**) | done | done | See **§4.5** |

### 4.5 Paid content & Stripe (batches P1–P8)

These batches cover **Hylo UI + GraphQL** around Connect offerings, paywalls, and post-checkout shells. They **do not** complete real Stripe Checkout or card charges; isolated E2E uses seeded products and (where needed) backend test hooks (`STRIPE_WEBHOOK_BYPASS_SIGNATURE`, synthetic `acct_e2e_*` account status in `StripeService`). Batches **P1–P8** are implemented as of 2026-05-09.

**Seed source:** `apps/backend/scripts/seed-e2e-baseline.js` — Stripe account row, `e2e-public-group` + offerings, **`e2e-paywall-group`** (paywall on, published offering, **`e2e.user` plain membership** without Coordinator so stream paywall applies), **`e2e.track-viewer@hylo.test`** (public group only, no Coordinator — track paywall visible), access-controlled **E2E Paid Track** + track-scoped offering, etc.

**Stable selectors:** Paywall offering cards expose `data-testid="paywall-offering-card"` and `data-offering-id` (`PaywallOfferingsSection.jsx`) for specs that must resolve offering IDs.

| Batch | Theme | Spec file(s) | Session / projects |
|-------|--------|----------------|---------------------|
| **P1** | Group **Paid Content** admin tabs (account, offerings, content-access) | `e2e/authenticated.paid-content-admin.spec.js` | Primary `session.json` → `chromium`, `mobile-chrome` |
| **P2** | **Paywall discovery** while logged in: group shell + **OfferingDetails** (`Buy Now`); seeded offering name | `e2e/authenticated.paywall-discovery.spec.js` (`Batch P2`) | Primary session |
| **P2** (logged out) | Paywall **Sign up to Purchase → /login**; cookie banner dismiss helper | `e2e/unauthenticated.routes.spec.js` (`Batch P2`) | `chromium-unauth`, `mobile-unauth` |
| **P3** | **Track paywall** (access-controlled track, **Purchase Access**) | `e2e/authenticated.track-paywall.spec.js` | `e2e/.auth/track-viewer-session.json` via **`setup-track-viewer`** → `chromium-track-paywall`, `mobile-track-paywall` |
| **P4** | **My Transactions** empty state + group **`payment/success`**, **`payment/cancel`**, **`payment/failure`** (failure uses same shell as cancel) | `e2e/authenticated.paid-content-pages.spec.js` | Primary session |
| **P5** | **Unauthenticated** deep link **`/groups/e2e-paywall-group/offerings/:id`** (`Sign up to Purchase`) | `e2e/unauthenticated.routes.spec.js` (`Batch P5`) | `chromium-unauth`, `mobile-unauth` |
| **P6** | **Group stream** paywall when member **lacks paid access** (`/groups/…/stream`) | `e2e/authenticated.paywall-discovery.spec.js` (`Batch P6`) | Primary session |
| **P7** | **OfferingDetails** in auth shell: **`/groups/e2e-public-group/offerings/:id`** (`Buy Now`, seeded **E2E Membership Monthly**) | `e2e/authenticated.offering-details.spec.js` | Primary session |
| **P8** | **OfferingDetails** unknown id → **error shell**; **My Transactions** filter UX (**Active** → empty filtered copy vs baseline) | `e2e/authenticated.paid-content-p8.spec.js` | Primary session |

**Run (examples):**

```bash
cd apps/web && yarn test:e2e --grep "Batch P1"
cd apps/web && yarn test:e2e --grep "Batch P3"   # uses `chromium-track-paywall` / `mobile-track-paywall`
cd apps/web && yarn test:e2e --grep "Batch P6"
cd apps/web && yarn test:e2e --grep "Batch P7"
cd apps/web && yarn test:e2e --grep "Batch P8"
cd apps/web && yarn test:e2e:unauth --grep "Batch P2|Batch P5"
```

**Batch P8 notes:** Unknown offering id → **`Error`** heading + **Offering not found** message. Transactions test uses **`#filter-status`** → **Active** (Radix); expects **No transactions found** + filter hint copy.

**Auth setup notes:** `e2e/helpers/waitForLoginEmailVisible.js` (`gotoLoginAndWaitForEmail`) chains `waitPastRootSessionLoading`, optional `load`, **`#email`** visibility (not the sign-in heading — avoids i18n / lazy-route paint races). **No second in-helper `goto`:** stacked waits used to exceed the setup project timeout (Playwright killed the test mid–`#email`). Defaults target **cold Vite** (~**180s** goto + form, tighter loader gate so one attempt stays under **720s** project timeout); flakes rely on Playwright **`setup` project `retries`**. Optional env: `E2E_AUTH_GOTO_TIMEOUT_MS`, `E2E_AUTH_LOGIN_FORM_TIMEOUT_MS`.

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
| **B** | Global context **`/all`** | `/all/stream`, `/all/map`, `/all/topics`, `/all/topics/:topicName`; `/all/projects`, `/all/proposals`, `/all/events`; `/all/members/:personId/*`; redirects `/all/members`, `/all/settings` → `/all` (redirects in Batch A) — **spec:** `e2e/authenticated.all-context.spec.js` |
| **C** | Global context **`/public`** (logged in) | `/public/stream`, `/public/map`, `/public/groups`; `/public/topics/:topicName`; `/public/projects`, `/public/proposals`, `/public/events`; bare `/public/topics` → `/public/stream` (no topics index route); redirects `/public/members`, `/public/settings` in Batch A — **spec:** `e2e/authenticated.public-context.spec.js` |
| **D** | Group workspace `/groups/:slug/*` | `about`, `stream`, `map`, `discussions`, `events`, `resources`, `projects`, `proposals`, `requests-and-offers`, `explore`, nested `groups`, `topics` / `topics/:topicName`, `all-views`; `tracks`, `funding-rounds`; `chat/:topicName`; `settings` stub; private group stream; unknown segment redirect; `custom` / detail IDs deferred (Batch J). Moderation is Batch I only (`/groups/:slug/moderation`, not `/all` / `/public` / `/my`) — **spec:** `e2e/authenticated.group-workspace.spec.js` |
| **E** | Post detail & dual-column | `/post/:postId/*`; `/groups/:slug/post/:id`; `/all/map/post/:id`, `/public/map/post/:id`, `/groups/:slug/map/post/:id` (detail column); `/members/:id/post/:id` — **spec:** `e2e/authenticated.post-detail.spec.js` |
| **F** | Members & profiles | `/members/:personId/*`; `/groups/:slug/members/:personId`; `/groups/:slug/members/create`; members list in Batch D — **spec:** `e2e/authenticated.members-profiles.spec.js` |
| **G** | Messages | `/messages` (thread list; optional redirect to first thread); `/messages/new` (`messageThreadId` `new`) — **spec:** `e2e/authenticated.messages.spec.js` |
| **H** | “My” & account | `/my`, `/my/posts`, `/my/interactions`, `/my/announcements`, `/my/mentions`, `/my/saved-posts`, `/my/tracks`; `/my/*` → `UserSettings` (key subpaths); `/themes`; `/search/*` — **spec:** `e2e/authenticated.my-account.spec.js` |
| **I** | Group settings & moderation | `/groups/:slug/settings/*` (default tab + `privacy`); `/groups/:slug/moderation/*` — **spec:** `e2e/authenticated.group-settings-moderation.spec.js` |
| **J** | Create / edit (modal routes) | Sample matrix only — one URL per pattern per context (`groups` / `all` / `public` / `my`): `…/create/*`, `…/post/:postId/create/*`, `…/post/:postId/edit/*`, track create/edit, custom-view post edit, etc. (not every permutation) — **spec:** `e2e/authenticated.create-edit-modals.spec.js` |
| **K** | Welcome wizard | `/welcome/*` (`WelcomeWizardRouter`) — **spec:** `e2e/authenticated.welcome-management.spec.js` |
| **L** | Create group & happy-path join | `/create-group` shell; `/h/use-invitation?token=…` and `/groups/:slug/join/:accessCode` (host + join groups + `group_invites` in `seed-e2e-baseline.js`) — **spec:** `e2e/authenticated.create-group-join.spec.js` |
| **M** | Group welcome overlay | `GroupWelcomeModal` when membership `showJoinForm` — seeded `e2e-welcome-overlay` — **spec:** `e2e/authenticated.group-welcome-modal.spec.js` |

**Source of truth for paths:** `apps/web/src/routes/AuthLayoutRouter/AuthLayoutRouter.js` (and `RootRouter.js` for logged-out vs logged-in split).

---

## 5. Production WebView flags (`isLegacyWebView`, `HyloMobileV2`)

The React Native app injects globals (`ReactNativeWebView`, optionally `HyloMobileV2`) so the web bundle can hide chrome and talk to native code. **We are not simulating WebViews in Playwright** for the route matrix above.

**Why not delete those branches in web code right now:** `isLegacyWebView()` and `window.HyloMobileV2` still guard behavior for **released app versions**. Removing or collapsing them can break older WebViews or require coordinated **mobile** releases. Cleaning that up is a separate deprecation effort — not part of this E2E doc.

---

## 6. CI/CD

**GitHub Actions:** `.github/workflows/playwright.yml` runs on `push` / `pull_request` to **`dev`** (and `workflow_dispatch`). It starts **Postgres** + **Redis** services, installs the monorepo + Playwright browsers, runs **`yarn build-packages`**, then **`yarn test:e2e:isolated`** from `apps/web` (same as local isolated E2E). Uploads the **HTML report** as a workflow artifact on completion (see [Playwright CI intro](https://playwright.dev/docs/ci-intro)).

**Secrets (optional):** set repo secret **`OIDC_KEYS`** so the `/notifications` JWT E2E is not skipped (same as local `apps/backend/.env`). Other backend-only secrets are usually unnecessary for the baseline seed + login user.

When tightening or expanding CI:

1. **Job order:** already covered by `run-isolated-e2e.js` (DB → seed → API → Playwright + Vite `webServer`).
2. **Secrets:** email/token E2E hooks (§2) if you add those flows.
3. **Mail:** no separate mail stack if using §2 hooks.
4. **Scope:** run **smoke + critical path** on every PR; full matrix (desktop + mobile) as budget allows — current workflow runs the full isolated suite.

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
- **`materialized view "search_index" has not been populated`** — Fresh DBs load `search_index` **WITH NO DATA** from `schema.sql`. The `e2e` seed runs `REFRESH MATERIALIZED VIEW search_index` after inserting baseline rows. If you skip seed or use a custom profile, refresh manually: `psql "$E2E_DATABASE_URL" -c 'REFRESH MATERIALIZED VIEW search_index'`.
- **Deep link under `/groups/:slug/…` jumps to `…/stream`** — `AuthLayoutRouter` treats a missing membership `lastReadAt` as a first visit and navigates to the group home. Baseline seed sets `lastReadAt` on seeded memberships so E2E can open `/moderation`, `/settings`, etc. directly.
- **`EADDRINUSE` on the API port** — Another process is bound there; set `E2E_BACKEND_PORT` or let the runner pick a free port in its scan range.
- **Debugging DB state** — `E2E_KEEP_DB=1` skips the final `dropdb` so you can inspect data; you may still need session termination before the *next* run’s recreate step (the script does that automatically at **start** of each run).
- **Playwright setup: `#email` never appears** — RootRouter waits on `checkLogin` before the login form mounts. Setups use `waitPastRootSessionLoading` + long `domcontentloaded` timeouts; ensure the isolated API is reachable (`VITE_API_HOST` / proxy). See §4.5.
- **`page.goto('/login')` TimeoutError (e.g. 120s / 180s)** — First hit to `/login` waits on Vite cold compile; on a loaded machine or **many workers**, raise `E2E_AUTH_GOTO_TIMEOUT_MS` or run with **`E2E_PLAYWRIGHT_WORKERS=4`** so the dev server keeps up.
- **Vite `[WebServer] Proxy error … ECONNRESET` then `ECONNREFUSED` on `/noo/graphql`** — The **Sails API** (Playwright `VITE_API_HOST`, often `:3101`) **stopped** while Vite on `:3330` kept running. Earlier **Node stack traces** in the terminal are usually from that crashed API process (OOM, unhandled rejection, etc.). Check the **first** error above the proxy spam; re-run with **`E2E_KEEP_DB=1`** if you need to inspect DB. Isolated runner defaults **`NODE_OPTIONS=--max-old-space-size=4096`** for the API when you have not set `NODE_OPTIONS` yourself. If the API still dies mid-suite, try lowering **`E2E_PLAYWRIGHT_WORKERS`** or raising heap via **`NODE_OPTIONS`** in your shell before `yarn test:e2e:isolated`.

## 7. References in repo

- Playwright config: `apps/web/playwright.config.js`
- Specs: `apps/web/e2e/*.spec.js` (incl. `authenticated.shell.spec.js`, `authenticated.all-context.spec.js`, `authenticated.public-context.spec.js`, `authenticated.group-workspace.spec.js`, `authenticated.post-detail.spec.js`, `authenticated.members-profiles.spec.js`, `authenticated.messages.spec.js`, `authenticated.my-account.spec.js`, `authenticated.group-settings-moderation.spec.js`, `authenticated.create-edit-modals.spec.js`, `authenticated.welcome-management.spec.js`, `authenticated.create-group-join.spec.js`, `authenticated.group-welcome-modal.spec.js`, **`authenticated.paid-content-admin.spec.js`**, **`authenticated.paywall-discovery.spec.js`**, **`authenticated.track-paywall.spec.js`**, **`authenticated.paid-content-pages.spec.js`**, **`authenticated.offering-details.spec.js`**, **`authenticated.paid-content-p8.spec.js`**, `unauthenticated.routes.spec.js`; shared `e2e/helpers/waitPastRootSessionLoading.js`, **`e2e/helpers/waitForLoginEmailVisible.js`**, **`e2e/helpers/fetchOfferingIdForGroup.js`**, **`e2e/helpers/sessionAuth.js`** (`ensureBrowserSessionDestroyed`))
- Auth setup: `apps/web/e2e/auth.setup.js`, `e2e/auth.session-mutate.setup.js`, `e2e/auth.track-viewer.setup.js`
- Paid content seed: `apps/backend/scripts/seed-e2e-baseline.js`
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
| 2026-05-02 | Isolated web default port `3330` (`E2E_WEB_PORT`); Playwright `baseURL` / `webServer.url` follow `E2E_WEB_PORT` or `PORT` |
| 2026-05-02 | Isolated API port auto-scan when `E2E_BACKEND_PORT` unset; RootRouter fullscreen loading for single-segment unknown paths (faster `/login` redirect UX under checkLogin) |
| 2026-05-02 | Isolated runner: `pg_terminate_backend` before `dropdb`; graceful API shutdown + SIGKILL before final drop; troubleshooting section |
| 2026-05-02 | §4.4: thematic batches (A–M) for authenticated route E2E; §4.2 table aligned to batches; unauthenticated §4.1 note for isolated API port |
| 2026-05-02 | Batch A: `e2e/authenticated.shell.spec.js` (landing, /notifications, /settings/edit-profile, /public→stream, all/public members & settings stubs) |
| 2026-05-02 | Batch B: `e2e/authenticated.all-context.spec.js`; `e2e/helpers/waitPastRootSessionLoading.js` shared with Batch A |
| 2026-05-02 | Batch C: `e2e/authenticated.public-context.spec.js` (`/public/*` routes while authenticated; bare `/public/topics` redirect documented) |
| 2026-05-02 | Batch D: `e2e/authenticated.group-workspace.spec.js` (seeded `e2e-public-group` / `e2e-private-group` routes) |
| 2026-05-02 | Batch E: `e2e/authenticated.post-detail.spec.js` (global + group post, map dual-column, member/post) |
| 2026-05-03 | Batch F: `e2e/authenticated.members-profiles.spec.js` (global + group member profile, members/create) |
| 2026-05-03 | Batch G: `e2e/authenticated.messages.spec.js` (`/messages`, `/messages/new`) |
| 2026-05-03 | `e2e/auth.setup.js`: wait past RootRouter loading before login field (`waitPastRootSessionLoading`) |
| 2026-05-03 | Batch H: `e2e/authenticated.my-account.spec.js` (`/my` → `/my/posts`, stream tabs, `/my/edit-profile`, `/my/notifications`, `/search`, `/themes`) |
| 2026-05-03 | Batch I: `e2e/authenticated.group-settings-moderation.spec.js`; `seed-e2e-baseline.js` Coordinator + Administration for group settings E2E |
| 2026-05-03 | Batch J: `e2e/authenticated.create-edit-modals.spec.js` (create chooser + post edit routes for `groups` / `all` / `public` / `my`) |
| 2026-05-03 | Batch K: `e2e/authenticated.welcome-management.spec.js` (`/welcome/*`) |
| 2026-05-04 | Batch L: `e2e/authenticated.create-group-join.spec.js`; `seed-e2e-baseline.js` adds join-host user, `e2e-join-code-group` / `e2e-invite-token-group`, invite token row |
| 2026-05-04 | Batch M: `e2e/authenticated.group-welcome-modal.spec.js`; `seed-e2e-baseline.js` adds `e2e-welcome-overlay` + `showJoinForm` membership |
| 2026-05-04 | GitHub Actions: `.github/workflows/playwright.yml` (Postgres + Redis, `yarn test:e2e:isolated`, Playwright HTML report artifact); §6 CI/CD |
| 2026-05-09 | **§4.5** Paid content / Stripe batches **P1–P7** (incl. **P7** `authenticated.offering-details.spec.js`); auth hardening: `waitForLoginEmailVisible.js`; `fetchForGroup` includes `paywall` / `canAccess`; §4.1/§4.2/§7 |
| 2026-05-09 | Auth setup: setup projects **timeout 720s**; `gotoLoginAndWaitForEmail` — no inner double-`goto`, default goto/form waits **120s**, loader gate tightened so one attempt fits project wall clock; Playwright **`retries`** cover flakes |
| 2026-05-09 | E2E helpers: **`fetchOfferingIdForGroup.js`** (GraphQL offering id); paywall P2 offering test uses it + longer timeouts; **`ensureBrowserSessionDestroyed`** before post-logout `goto('/')` in `authenticated.auth-session.spec.js`; map post-detail waits **120s**; §7 |
| 2026-05-09 | **§4.5 Batch P8** — `authenticated.paid-content-p8.spec.js` (unknown offering id error shell; My Transactions filter empty state); §4.2 / §7 |
| 2026-05-09 | `gotoLoginAndWaitForEmail`: restore **180s** default goto/`#email` timeouts (120s was too tight for cold `/login` on full suite); loader gate slightly tightened to keep under 720s setup wall clock |
| 2026-05-09 | E2E seed: **`lastReadAt` tiers** so `e2e.user` public/private memberships win “last viewed” over paywall/welcome (fixes flaky Batch A `GET /` landing on `e2e-paywall-group/stream`); isolated API default **`NODE_OPTIONS=--max-old-space-size=4096`** when unset; troubleshooting for Vite **proxy ECONNREFUSED**; `fetchTrackIdByName` clearer errors on non-JSON responses |
