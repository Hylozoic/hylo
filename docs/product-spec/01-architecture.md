# 01 — Architecture

> Foundation module. Describes how Hylo is put together at runtime: processes, data stores, external services, authentication infrastructure, real-time delivery, background jobs and scheduled tasks, file storage, configuration and deployment. Feature behaviour lives in the feature modules (04–25); the data schema is in [02-data-model.md](02-data-model.md); the API surface is in [03-graphql-api.md](03-graphql-api.md).

---

## 1. Overview

Hylo is a classic three-tier web application plus native clients:

```
                ┌────────────────────────┐        ┌───────────────────────┐
 Browser ──────►│ Web server (Express)    │──/noo─►│ API server (Sails 1 /  │──► Postgres (+PostGIS)
  (React SPA)   │ apps/web/src/server     │ proxy  │ Express + GraphQL Yoga)│──► Redis (sessions, pub/sub,
                │ serves dist/ + marketing│        │ apps/backend/app.js    │        queue, rate limits)
                └────────────────────────┘        └──────────┬────────────┘──► S3 (uploads, .ics feeds)
 Browser ── socket.io (sails.io.js) ─────────────────────────┘
 Mobile app (Expo) ── GraphQL (Bearer token) + WebView of web app
 Desktop (Electron) ── wraps the web app
                                                   ┌───────────────────────┐
                                                   │ Worker (Kue consumer)  │◄── Redis queue "q"
                                                   │ apps/backend/worker.js │──► SendWithUs, OneSignal,
                                                   └───────────────────────┘     Mapbox, Murmurations, Slack,
                                                   ┌───────────────────────┐     Zapier hooks, Stripe
                                                   │ Cron (Heroku Scheduler)│
                                                   │ apps/backend/cron.js   │
                                                   └───────────────────────┘
```

| Component | Code | Runtime | Purpose |
|---|---|---|---|
| Web frontend | `apps/web` | Vite-built SPA served by a small Express server (`apps/web/src/server/index.js`, Heroku `web: node dist/server/index.js` / root `Procfile` `web: node apps/web/src/server/index.js`) | React 18 app, Redux + redux-orm store, Tailwind (legacy SCSS modules). No React SSR — `index.html` shell with optional Open Graph tag injection for public posts. |
| API server | `apps/backend` (`app.js`) | Sails.js 1.x lifted on Node 24; Heroku `web: npm start` (`node --optimize_for_size --gc_interval=100 app.js`) | GraphQL endpoint `/noo/graphql` (GraphQL Yoga 5), REST controllers under `/noo/*`, OAuth2/OIDC provider under `/noo/oauth`, socket.io server. |
| Worker | `apps/backend/worker.js` | Heroku `worker: npm run worker` | Consumes Kue jobs from Redis (concurrency 10). |
| Cron | `apps/backend/cron.js` | Heroku Scheduler running `node cron.js --interval=<every10minutes|hourly|daily>` | Periodic tasks (digests, counters, cleanup, phase transitions). |
| Mobile | `apps/mobile-leap` | Expo / React Native | Native shell; logs in via token endpoints, renders most screens via WebView of the web app; urql GraphQL client from `packages/urql`. See [25-mobile-desktop.md](25-mobile-desktop.md). |
| Desktop | `apps/desktop` | Electron | Wraps the web app. See [25-mobile-desktop.md](25-mobile-desktop.md). |
| Shared packages | `packages/*` | Built (Babel) before apps (`yarn build-packages`) | See §14. |

Language/tooling: JavaScript (ES modules via `@babel/register` on the backend), Yarn 4 workspaces (`packageManager: yarn@4.9.2`), Node `^24`. Backend version `7.1.10`, web `7.1.10`.

---

## 2. API server process (apps/backend)

### 2.1 Boot sequence
1. `app.js` loads `.env` (`dotenv`, `override: false`), `@babel/register`, then Sentry (`lib/sentry`, process tag `web`).
2. **Clustering**: if `HEROKU_AVAILABLE_PARALLELISM` or `WEB_CONCURRENCY` > 1 (and not test), the primary forks that many workers with `node:cluster`; each runs Sails. Workers that die are logged, not restarted.
3. `sails.lift()` with `.sailsrc` + `rc('sails')`. Sails hooks: ORM is **not** Waterline — models are Bookshelf (see 02). `config/bootstrap.js` sets globals (`format`, `Promise` = Bluebird, `_` = lodash), runs `models.init()` (registers every Bookshelf model and service as a global, e.g. `User`, `Post`, `Queue`, `Email`), optional `memwatch` (`DEBUG_MEMORY`) and SQL logging (`DEBUG_SQL`).
4. `config/globals.js`: `sails` global yes; Sails' lodash/async/models globals off.

### 2.2 HTTP middleware order (`config/http.js`)
`cookieParser → session → passportInit → passportSession → compress → requestLogger → $custom → router → www → favicon → sentry(errorHandler)`.

`trustProxy` = `PROTOCOL === 'https'`. Static asset cache: one year (`config/env/production.js`).

`$custom` (`config/customMiddleware.js`), in order:
1. `app.enable('trust proxy')`.
2. `/noo/oauth` → `oidc.callback()` (oidc-provider Koa app mounted before body parsers).
3. `/noo/stripe/webhook` → `bodyParser.raw({type:'application/json'})` (raw body needed for signature verification).
4. `bodyParser.urlencoded({extended:true})`, `bodyParser.json()` for everything else.
5. Kue UI: `/noo/admin/kue` guarded by `isAdmin` policy; `/noo/admin/kue/api` = `kue.app` JSON API; `/noo/admin/kue` = `kue-ui` (static assets under `/noo/admin/kue/assets/` bypass the admin check for GET/HEAD).
6. `/noo/graphql` → `cors({ origin: graphqlCorsOrigin, methods: 'GET, POST, PUT, DELETE, OPTIONS, HEAD', credentials: true })` → `accessTokenAuth` policy (legacy `access_token`) → `checkClientCredentials` policy (Bearer) → Yoga handler.

### 2.3 CORS
- **GraphQL** (`/noo/graphql`): credentialed CORS with a strict allowlist (no reflection). Requests with no `Origin` header are allowed. Allowed origins (`config/corsAllowedOrigins.js`): `https://www.hylo.com`, `https://hylo.com`, `https://api.hylo.com`, `https://staging.hylo.com`, `https://node1.hylo.com`, `https://review.hylo.com`, `https://api-staging.hylo.com`, `https://api-review.hylo.com`, and `http(s)://localhost:{9000,3000,3001,4321}`, plus comma-separated `CORS_ALLOWED_ORIGINS`.
- **Other Sails routes** (`config/cors.js`): `allRoutes: true`, same origin list, `allowCredentials: false`, methods `GET, POST, PUT, DELETE, OPTIONS, HEAD`.
- **OIDC** (`/noo/oauth`): oidc-provider `clientBasedCORS` returns `true` → any origin.
- **Socket.io**: `sockets.onlyAllowOrigins` = the trusted origin list (production config).
- CSRF protection is **disabled** (Sails `csrf` not configured).

### 2.4 Response compression (`lib/responseCompression.js`)
Custom middleware (Heroku's router does not compress; Sails' built-in is gzip+prod only):
- Threshold 1024 bytes; compresses only when `Content-Type` matches `/json|text\/|javascript|xml|svg/`.
- Parses `Accept-Encoding` q-values; picks **brotli** (quality 6) when `br` is accepted at least as strongly as gzip (a `*` counts for either), otherwise gzip (`compression` package). Adds `Vary: Accept-Encoding`. Skips HEAD and already-encoded responses.

### 2.5 Error responses
Sails response helpers in `api/responses/`: `ok`, `badRequest` (400), `forbidden` (403), `notFound` (404), `serverError` (500), `error`. `sessionAuth` policy fails with **401 `Unauthorized`** (plain text). GraphQL errors are described in 03 §2.6.

### 2.6 Logging & monitoring
- `requestLogger` logs `METHOD url` (magenta) at info. `SAILS_LOG_LEVEL` controls verbosity.
- **Sentry** (`lib/sentry.js`, `@sentry/node` 10): enabled when `SENTRY_DSN` set and `NODE_ENV !== 'test'`. Environment = `SENTRY_ENV || NODE_ENV`. Error reporting only (no tracing, `Http` integration removed). `sendDefaultPii: true`, initial tag `surface: backend`, process tag `web` / `worker` / `cron`. `sentry.error(err, req|callback, extra)` API (Rollbar-compatible shape). User context set from session (`id`, `email`) on login. GraphQL masked errors are reported with tags `graphql: 'true'`, `graphqlOperation`, extras `graphqlPath`, `currentUserId`, `operationName`.
- Web: `VITE_SENTRY_DSN`, `VITE_SENTRY_ENV`, `VITE_SENTRY_DEBUG`.
- `DEBUG_GRAPHQL` logs every GraphQL query + variables; `AUTH_DEBUG` logs identity resolution (`[auth] ...`) for every GraphQL request; `GRAPHQL_YOGA_LOG_LEVEL` (default `info`).

---

## 3. Data stores

### 3.1 PostgreSQL
- Accessed through **Knex 0.21 + Bookshelf 1.2** (`knexfile.js`, `knex-postgis`). Connection from `DATABASE_URL`; pool min 5 / max 30, idle timeout 60 s, `propagateCreateError: false`. Production uses SSL with `rejectUnauthorized: false`.
- Extensions: PostGIS (geometry columns for locations/bounding boxes), full-text search (`tsvector`).
- Migrations: `apps/backend/migrations/*.js` (Knex, table `knex_migrations`), `yarn migrate` runs `migrations/scripts/updateMigrationsTable.js` then `knex migrate:latest`. Heroku runs migrations in the build via the `heroku-buildpack-migrate` buildpack. Full schema dump: `apps/backend/migrations/schema.sql` (`yarn dump`). Details in 02.
- `on_update_timestamp()` PL/pgSQL trigger helper (knexfile `createUpdateTrigger`) sets `updated_at = now()` on some tables.
- Seeds: `seeds/dummy`, `seeds/farm-dev`, `seeds/farm-demo` (knex environments `dummy`, `farmdev`, `farmdemo`).

### 3.2 Redis (`REDIS_URL`)
One Redis serves several roles:

| Role | Key / channel pattern | Code |
|---|---|---|
| HTTP sessions (connect-redis) | `sess:<userId or 'anon'>:<uuid>`; TTL 60 days | `config/session.js` |
| socket.io adapter (multi-process broadcast) | socket.io-redis keys | `config/sockets.js` (`@sailshq/socket.io-redis`) |
| Socket emits from non-Sails processes (worker) | via `socket.io-emitter` | `api/services/Websockets.js` |
| GraphQL subscription pub/sub | channels like `updates:<userId>` (see §6.2) | `api/services/RedisPubSub.js` (`@graphql-yoga/redis-event-target`, two ioredis clients `pubsub-publish`/`pubsub-subscribe`) |
| Job queue (Kue) | prefix `KUE_NAMESPACE` (default `q`) | `config/kue.js`, `api/services/Queue.js` |
| Rate-limit counters | `ratelimit:<action>:<ip|email>:<value>` | `lib/rateLimit.js` |

`RedisClient.create(key)` keeps a per-key pool of ioredis clients (`maxRetriesPerRequest: 3`, reconnect on `READONLY` errors).

### 3.3 Object storage (Amazon S3)
- Bucket `AWS_S3_BUCKET`, public URL base `AWS_S3_CONTENT_URL`, credentials `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, region `AWS_REGION`. Optional `UPLOADER_HOST` rewrites the host of returned URLs (CDN). All objects are written `ACL: public-read`.
- Key layout for uploads: `<UPLOADER_PATH_PREFIX>/user/<userId|'system'>/<uploadType>/<id|'new'>/<basename>` (prefix e.g. `evo-uploads`).
- Calendar feeds: `<UPLOADER_PATH_PREFIX>/group/<groupId>/calendar-<group.calendar_token>.ics` and `<UPLOADER_PATH_PREFIX>/user/<userId>/calendar-<user.calendar_token>.ics` (Content-Type `text/calendar`).
- Media deletion (`Media.deleteMediaByUrl` job → `deleteS3Objects`) only deletes URLs containing `/evo-uploads/`.

### 3.4 Full-text search index
A Postgres **materialized view** `search_index` (`api/services/FullTextSearch.js`) with columns `row_key` (`post-<id>`, `user-<id>`, `comment-<id>`, `group-<id>`), `post_id`, `user_id`, `comment_id`, `group_id`, `sort_ts`, `document` (weighted `tsvector`, language `english`). Posts: title weight B, description C, author name D; excludes inactive posts/users and types `welcome`, `chat_activity`. Unique index on `row_key` permits `REFRESH MATERIALIZED VIEW CONCURRENTLY` (falls back to non-concurrent refresh). Refreshed by cron every 10 minutes, so search results lag writes by up to ~10 min. Statement timeout `SEARCH_STATEMENT_TIMEOUT_MS` (default 20000 ms); recency half-life 14 days used in ranking. Search semantics: [07-search.md](07-search.md).

---

## 4. Web frontend serving (apps/web)

### 4.1 Build
- Vite (`vite.config.js`): React plugin, SVGR, GraphQL loader, `vite-plugin-html` (entry `src/index.jsx`, template `index.html`), `.js` files in `src/` are compiled as JSX. Output `dist/`; hashed filenames `assets/[name].[hash].js` etc. (hash is its own dot segment).
- Dev server port `PORT || 3000`; proxies `/noo` to `VITE_API_HOST || http://localhost:3001`. Allowed dev hosts `.local`, `.ts.net`, `.trycloudflare.com`.
- Heroku: `heroku-postbuild` → `yarn install && yarn build`; root `heroku-postbuild.sh` builds per workspace (`YARN2_WORKSPACE_PATH`): web → `yarn workspace web build`; backend → builds `@hylo/shared`, `@hylo/navigation`, `@hylo/presenters`; then optionally `yarn workspaces focus <ws> --production` when `YARN2_SKIP_PRUNING=true`.

### 4.2 Production web server (`src/server/index.js`, Express, port `PORT || 9001`)
Middleware order:
1. Security headers on every response: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(self), geolocation=(self)`. No CSP and no X-Frame-Options (framing is intentionally allowed for embeds).
2. `cookie-parser`, `compression` (gzip).
3. **API proxy** (`apiProxy.js`): any path starting `/noo` is piped to `VITE_API_HOST + originalUrl` with `Host` rewritten to the API hostname, redirects not followed. HTTP only — websocket upgrades are not proxied (sockets connect to `VITE_SOCKET_HOST` directly).
4. **Logged-in redirect** (`redirectToApp.js`): for `GET /` only:
   - If header `x-hylo-mobile` present and no session cookie (`HYLO_COOKIE_NAME`) → redirect `/login`.
   - If the session cookie is present, calls `POST <VITE_API_HOST>/noo/graphql` with `query CheckLogin { me { id } }` forwarding the cookie; if `me.id` → redirect `/app?rd=1`; otherwise falls through to the marketing page.
5. **Marketing-site proxy** (`proxy.js`): paths in `staticPages` — `''` (i.e. `/`), `/about`, `/stories`, `/features`, `/pricing`, `/stewardship-support`, `/get-involved`, `/blog`, `/who-is-hylo-for`, `/why-choose-hylo`, `/agreements`, `/terms`, `/privacy`, `/murmurations.json`, `/funding.json`, `/regional-resilience` — plus any path under `/_astro`, `/v5`, `/blog/*`, are fetched from `PROXY_HOST` (an Astro static site). Path transform: strip trailing slash; extensionless paths get `/index.html`; `/apple-app-site-association` → `.json`. Responses (2xx only) are gzipped and kept in an in-memory LRU of 50 entries; served with `Content-Encoding: gzip`. `DISABLE_PROXY` → 503. Upstream non-2xx → 500 with message.
6. `express.static(dist)` with cache headers: `index.html` → `Cache-Control: no-cache`; filenames matching `/\.[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/` → `public, max-age=31536000, immutable`; others default.
7. **SPA fallback** (`appMiddleware.js`): every other GET returns `dist/index.html` (`Cache-Control: no-cache`) with an empty `<div id="root">`. If the path matches `/post/(\d+)(/|$)` it fetches `post(id)` anonymously from the API (only public posts resolve) and injects `<title>`, `description`, `og:type=article`, `og:site_name=Hylo`, `og:title`, `og:description`, `og:url`, `twitter:title`, `twitter:description`, and either `og:image` + `twitter:card=summary_large_image` + `twitter:image` (first `image` attachment by `position`) or `twitter:card=summary`. Description = post details as plain text truncated to 144 chars; title falls back to description then `Hylo`. Failures are ignored.

### 4.3 Client runtime config (`src/config/index.js`)
Build-time `import.meta.env` values: `VITE_FILESTACK_API_KEY`, `VITE_LOG_LEVEL`, `VITE_SOCKET_HOST`, `VITE_HOST`, `VITE_SLACK_APP_CLIENT_ID`, `VITE_AWS_S3_BUCKET`, `VITE_AWS_S3_HOST`, `VITE_GOOGLE_BROWSER_KEY`, `VITE_GOOGLE_CLIENT_ID`, `VITE_SEGMENT_KEY`, `VITE_INTERCOM_APP_ID`, `VITE_MIXPANEL_TOKEN`, `VITE_MAPBOX_TOKEN`; `window.__appConfig` exposes the config. Feature flags from `VITE_FEATURE_FLAG_*` (see §11).

### 4.4 Client data layer (summary; details in 06/08)
- Web: Redux store with custom middlewares (`apiMiddleware`, `graphqlMiddleware` → `POST /noo/graphql` with cookies, `optimisticMiddleware`, `pendingMiddleware`, `mixpanelMiddleware`, `errorReporterMiddleware`, `userBlockingMiddleware`, `socketReconnectMiddleware`) and redux-orm models.
- Real-time on web: socket.io v2 + `sails.io.js` client to `VITE_SOCKET_HOST` (§6.1).
- Mobile: urql (`packages/urql/makeUrqlClient.js`) with graphcache, `authExchange` attaching `Authorization: Bearer <access_token>` and refreshing when within 60 s of expiry; falls back to cookie session when no token.

---

## 5. Authentication, sessions & tokens

Detailed user flows are in [04-accounts-auth-onboarding.md](04-accounts-auth-onboarding.md); this section covers mechanisms.

### 5.1 Cookie session (primary for web)
- express-session via Sails, store **Redis** (`@sailshq/connect-redis`, prefix `sess:`, TTL 60 days).
- Cookie name `COOKIE_NAME` (prod `hylo.sid2`, review `hylo.review.sid2`), signed with `COOKIE_SECRET`, `domain = COOKIE_DOMAIN` (prod `.hylo.com`), `maxAge` 60 days, `secure` and `SameSite=None` when `PROTOCOL=https`, else `SameSite=Lax`.
- Session id generator: `<req.userId || 'anon'>:<uuidv4>` — prefixing by user id lets `User.clearSessionsFor` delete all of a user's sessions with `SCAN MATCH sess:<userId>:*` (keeps the current one). Triggered on password change / linked-account change (job `User.clearSessionsFor`).
- Session fields: `userId`, `userEmail`, plus transient `returnDomain`, `authContext` (OAuth popup), and oidc data.
- `UserSession.login(req, user, providerKey)`: regenerates the session (anti-fixation; carries over non-auth fields) unless `providerKey === 'token'`; sets `userId`/`userEmail`; sets Sentry user; for providers other than `admin`/`token`: tracks `Login from mobile app` (Segment) when `ios-version`/`android-version` headers are present; updates `last_login_at`; sets `active = true` **only if the user has a valid name** (email-verification stubs stay inactive).
- Logout: `GET /noo/logout` (destroys session, redirects `/`), `DELETE /noo/session` (JSON), or the `logout` GraphQL mutation.

### 5.2 Password login & rate limiting
`POST /noo/login` (cookie) and `POST /noo/login/native` (token pair) both call `authenticateWithRateLimit` → `User.authenticate(email, password)` (bcrypt). Rate limits (`lib/rateLimit.js`, fixed windows in Redis, fail-open if Redis is down; per-IP limits are generous for shared IPs):

| Action | Counted | Per IP | Per email |
|---|---|---|---|
| `login` | failed attempts only | 50 / 15 min | 10 / 15 min |
| `verifyCode` | failed verification-code guesses | 50 / 60 min | 10 / 60 min |
| `sendPasswordReset` | every request | 50 / 60 min | 5 / 60 min |
| `sendEmailVerification` | every request | 50 / 60 min | 5 / 60 min |

Error message (clients match exactly): `Too many attempts. Please wait a few minutes and try again.`

### 5.3 Social login (Passport, `config/passport.js`)
- **Google** OAuth2 (`passport-google-oauth`, `GOOGLE_CLIENT_ID/SECRET`, callback `<PROTOCOL>://<DOMAIN>/noo/login/google/oauth`, scope `email profile`) and **Google token** (`passport-google-token`, mobile).
- **LinkedIn** OAuth2 (`LINKEDIN_API_KEY/SECRET`, scope `r_emailaddress r_basicprofile`) and LinkedIn token. (Legacy; see quirks.)
- **Apple**: `POST /noo/login/apple/oauth` verifies the identity token with `apple-signin-auth` (audience `APPLE_CLIENT_ID || 'com.hylo.HyloA'`, nonce SHA-256). Email is taken from the signed token only when `email_verified`.
- **Facebook**: routes exist but no Facebook Passport strategy is registered (dead).
- **Admin Google login** (`ADMIN_GOOGLE_CLIENT_ID/SECRET`, callback `/noo/admin/login/oauth`) accepts only emails ending `hylo.com`.
- Web popup flow: start route stores `returnDomain`, `authContext` in session; finish route renders view `popupDone` with `error`, `provider`, `context` (`login` default), `returnDomain` (default `<PROTOCOL>://<DOMAIN>`) which posts back to the opener. With `Accept: application/json`, returns JSON instead.
- User resolution (`findUser`): match by linked account (`provider_key`, `provider_user_id`) or case-insensitive email; linked-account match wins. New users are created with `email_validated: true`. If logged in already (web), the provider is attached to the current account (`upsertLinkedAccount`) — refused with error `linked-account-in-use` if that provider identity belongs to another user.
- Mobile **token auth**: requests with header `X-Hylo-Token-Auth: 1` never create a cookie session; they receive a token pair (§5.5).

### 5.4 JWTs (`lib/HyloJWT.js`)
- RS256, signed with the **first** key in `OIDC_KEYS` (comma-separated base64 PEM RSA private keys). Claims: `iss` = `aud` = `<PROTOCOL>://<DOMAIN>`, `sub` = user id, `exp` = now + 4 h (default) plus arbitrary extra claims (e.g. `action: 'notification_settings'`).
- Verification accepts issuers: primary, `HYLO_JWT_EXTRA_ISSUERS` (comma list), and in development `http://localhost:3000`, `http://localhost:3330`. Audience not checked.
- Uses: email verification and password-reset magic links (`GET|POST /noo/login/jwt?token=...&n=<next>` via the `checkJWT` policy → passport-jwt, `maxAge 4h`, token from `Authorization: Bearer` or `?token=`), unsubscribe/notification-settings links (`/noo/user/notification-settings?token=`), and JWT access tokens for `super` API clients.
- `checkJWT` failure: GET → redirect `/login?error=invalid-link`; POST → 403 with info.
- `createWithJWT` success: GET → redirect to `n` if same-origin as the frontend, else the password settings page; POST → `{success:true}`; with `X-Hylo-Token-Auth: 1` → token pair.
- Legacy `GET /noo/login/token` links (non-expiring tokens, pre-March 2025) no longer log in; GET redirects to safe `n` or `/login`; POST → 422 `Link expired`.
- Legacy per-user **access token** (`accessTokenAuth` policy): `access_token` body/query param or `x-access-token` header matched against `linked_account` rows with `provider_key = 'token'`; logs the user in for that request only (session not persisted).

### 5.5 OAuth 2.0 / OpenID Connect provider (`api/services/OpenIDConnect.js`)
Hylo is itself an OIDC provider (node `oidc-provider` 7), issuer `<PROTOCOL>://<DOMAIN>`, mounted at `/noo/oauth` (`GET /.well-known/openid-configuration` is routed there).
- Persistence: table `oidc_payloads` via `api/services/oidc/KnexAdapter.js` (types: Session, AccessToken, AuthorizationCode, RefreshToken, DeviceCode, ClientCredentials, Client, InitialAccessToken, RegistrationAccessToken, Interaction, ReplayDetection, PushedAuthorizationRequest, Grant). Clients are rows of type `Client` (no static clients). Expired rows deleted by daily cron (`OIDCAdapter.cleanupExpired`).
- Scopes: `openid offline_access address email phone profile api:read api:write`. Claims: `openid→sub`, `address→address`, `email→email,email_verified`, `phone→phone_number`, `profile→name,picture,updated_at,website`. `conformIdTokenClaims: false`.
- Extra client metadata: `email`, `invite_subject`, `invite_message`, `name`, `role` (`'super'` grants write/admin API powers), `noPKCE`.
- Features: client credentials grant, introspection, resource indicators (default resource `<PROTOCOL>://<DOMAIN>`; resource-server tokens are **JWT** RS256, TTL 2 h, scope `api:read` + `api:write` for super clients); dev interactions disabled; PKCE required unless client `noPKCE`.
- Routes (under `/noo/oauth`): `/auth`, `/token`, `/token/introspection`, `/token/revocation`, `/me` (userinfo), `/jwks`, `/session/end`, `/reg`, `/request`, `/device`, `/device/auth`, `/backchannel`.
- TTLs: AccessToken 1 h (resource-server tokens their own TTL), AuthorizationCode 10 min, ClientCredentials 10 min (or RS TTL), DeviceCode 10 min, Grant 14 d, IdToken 1 h, Interaction 1 h, RefreshToken 180 d (rotated SPA tokens keep remaining TTL), Session 14 d.
- Cookies: keys `[COOKIE_SECRET]`, path `/`, domain `localhost` in development else `.hylo.com`, signed, httpOnly; long cookies `SameSite=None`, short `SameSite=Lax`.
- Interaction routes (`api/hooks/oidcRoutes.js`): `GET /noo/oidc/interaction/:uid` → redirects to the web pages `/oauth/login/:uid?name=<client>` or `/oauth/consent/:uid?name=<client>[&missingScopes=...]`; `POST /noo/oidc/:uid/login` (uses existing session or email+password with rate limiting) → `{redirectTo}`; `POST /noo/oidc/:uid/confirm` (grants missing scopes/claims) → `{redirectTo}`; `POST /noo/oidc/:uid/abort` → `access_denied`. Redirect URLs are rewritten to `<PROTOCOL>://<DOMAIN>`.
- **First-party native client** `hylo-mobile` (`api/services/OIDCTokens.js`): `mintTokensForUser(user)` creates a Grant with scope `openid offline_access email profile`, an **opaque** AccessToken (1 h) and RefreshToken (180 d); returns `{ access_token, refresh_token, token_type: 'Bearer', expires_in }`. Refresh/revoke use the standard `/noo/oauth/token` and `/noo/oauth/token/revocation`. `POST /noo/session/from-token` (Bearer access token) creates a fresh cookie session for the mobile WebView.

### 5.6 Bearer token on GraphQL (`api/policies/checkClientCredentials.js`)
For `Authorization: Bearer <token>`:
1. The request's cookie session is detached (`keepOutOfCookieSession` — never saved/Set-Cookie).
2. Try to verify as a Hylo JWT (client-credentials resource token). Client looked up; if missing or `role !== 'super'` → **403 `{error:'Unauthorized'}`**. Sets `req.api_client = {id, name, scope, super:true}` (no user).
3. Otherwise look up as an opaque AccessToken in `oidc_payloads`; if unexpired and the client exists → `req.api_client = {id, name, scope}` and `req.session.userId = accountId` (acts as that user; token wins over any cookie). Unknown client → 403; invalid/expired → **401 `{error:'Unauthorized'}`**.
No Bearer header → continue with cookie session.

### 5.7 Identity tiers in GraphQL
`makeSchema` builds a resolver set per identity (cached LRU of 16 schemas keyed `userId|isAdmin|apiClientId`, disabled in test or `GRAPHQL_CACHE_SCHEMA=0`; DataLoader caches cleared per request):
- **Logged-in user** (`session.userId`): full Query/Mutation/Subscription set.
- **API client without user** (`req.api_client`, super JWT): `group`, `groups`, `person` queries; `addMember`, `createGroup(asUserId)`, `updateGroup(asUserId)` mutations.
- **Anonymous**: public queries (`checkInvitation`, `group` (public or with valid invitation), `groups` (public), `platformAgreements`, `person`, `post`/`posts` (public only), `publicStripeOffering(s)`), public mutations (`login`, `logout`, `sendEmailVerification`, `sendPasswordReset`, `register`, `verifyEmail`, `createStripeCheckoutSession`).
- **Hylo admin**: `Admin.isSignedIn(req)` ⇔ `session.userId` is listed in env `HYLO_ADMINS` (comma-separated ids). Never derived from email. Admins bypass some visibility filters and may use GraphiQL in production. `HYLO_TESTER_IDS` lists "test admins"/testers.

### 5.8 Admin console
`/noo/admin/*` routes guarded by `isAdmin` (Hylo admin session). `GET /noo/admin/login` / `/oauth` (Google admin strategy), `/noo/admin/logout`, `raw-metrics`, `stripe-analytics`, `POST stripe-sales-pause`, `GET login-as/:userId` (impersonate), Kue UI. See 03 §7 and [24-integrations-api-embeds.md](24-integrations-api-embeds.md).

---

## 6. Real-time delivery

Two parallel mechanisms exist.

### 6.1 Sails socket.io (used by web)
- Server: `sails-hook-sockets` (socket.io 2), Redis adapter, `pingInterval` 10 s, `pingTimeout` 15 s. Client: `sails.io.js` connecting to `VITE_SOCKET_HOST` (in dev on non-localhost hosts, to the page origin which proxies `/socket.io`). Socket requests carry the session cookie; virtual HTTP requests over the socket reach normal routes.
- Rooms: `users/<userId>`, `posts/<postId>`, `groups/<groupId>`.
- Subscribe/unsubscribe routes (socket-only, `isSocket` + `sessionAuth`):
  - `POST /noo/user/subscribe` / `unsubscribe` — personal room.
  - `POST /noo/group/:groupId/subscribe` / `unsubscribe` (+ `checkAndSetMembership`: member with paid access, or admin).
  - `POST /noo/post/:postId/subscribe` / `unsubscribe` (+ `checkAndSetPost`: post visible to user).
  - `POST /noo/group/:groupId/typing` `{isTyping}` → `userTyping` `{userId, userName, isTyping, groupId}` to the group room and its parent's room.
  - `POST /noo/post/:postId/typing` `{isTyping}` → `userTyping` `{userId, userName, isTyping, postId}` to the post room; also publishes GraphQL `peopleTyping:messageThreadId:<postId>`.
- Server→client event names (whitelist in `Websockets.pushToSockets`): `commentAdded`, `groupUpdated`, `messageAdded`, `messageUpdated`, `userTyping`, `newThread`, `newNotification`, `newPost`, `openJoinRequestCountUpdated`, `memberPresent`, `memberAway`; plus `roomPresence` sent directly to a socket.
- **Presence** (`api/services/RoomPresence.js`): in-memory, per-process, reference-counted map room → user → socket ids. On group subscribe the subscriber receives `roomPresence {groupId, members:[{id,name,avatarUrl}]}`; if the user was newly present, the room gets `memberPresent {groupId, member}` (excluding the sender socket). On unsubscribe/disconnect when the user's last socket leaves: `memberAway {groupId, userId}`. Not shared between processes (documented limitation).
- Worker processes emit through `socket.io-emitter` on Redis (cannot exclude a socket).

Emitters (non-exhaustive, see feature modules): new comment → `commentAdded` to post room; DM → `messageAdded`/`newThread`/`messageUpdated` to participants' user rooms; new post → `newPost` to group rooms; `Notification` delivery → `newNotification` to user room; group update → `groupUpdated`; join request count → `openJoinRequestCountUpdated` to group rooms and steward user rooms.

### 6.2 GraphQL subscriptions (used by mobile / urql; available to all)
- Served by GraphQL Yoga on `/noo/graphql` over **Server-Sent Events** (Yoga's default transport; no graphql-ws server). Pub/sub through Redis (§3.2), so any process can publish.
- Channels: `comments:postId:<id>`, `comments:commentId:<id>`, `peopleTyping:messageThreadId:<id>` / `:postId:<id>` / `:commentId:<id>`, `updates:<userId>`, `groupUpdates:<userId>`, `groupMembershipUpdates:<userId>`, `groupRelationshipUpdates:<userId>`, `postUpdates:<userId>`.
- Events whose creator is the subscriber are filtered out unless the request has a `subscriptions-debug` header. Field list in 03 §5.

---

## 7. Background jobs (Kue)

### 7.1 Mechanics
- Library: Kue 0.11 on Redis (prefix `KUE_NAMESPACE || 'q'`).
- Enqueue: `Queue.classMethod(className, methodName, data, delay = 2000)` creates job type `classMethod` with `{className, methodName, ...data}`, **delay 2 s by default** (some 0 or 1 s, welcome email 2 min), `attempts(3)`, exponential backoff starting 20 s.
- Worker (`worker.js`): optional startup delay `DELAY_START` seconds; processes `classMethod` jobs with concurrency 10 by calling `global[className][methodName](data)`; errors are logged and sent to Sentry, job marked failed. Graceful shutdown waits 5 s. Uncaught exceptions shut down the queue and exit(1).
- Old completed jobs (>3 days, first 20 000) removed by daily cron.
- Admin UI at `/noo/admin/kue`.

### 7.2 Job catalogue
| Job (`Class.method`) | Enqueued by | What it does |
|---|---|---|
| `Notification.sendUnsent` | after `Activity` creation (and self re-enqueue, delay 1 s) | Claims a bounded batch of unsent notifications and sends each (email / push / in-app socket), re-enqueuing if the batch was full; failures get `failed_at`. See 19. |
| `Post.createActivities` | `createPost` (unless silent) | Creates Activity rows (mentions, new post in followed topic, announcements…) → notifications. |
| `Post.incrementNewPostCountForCreatedPost` (delay 0) / `Post.decrementNewPostCountForDeletedPost` (delay 0) | create / delete post | Adjust per-membership / per-view unread counters. |
| `Post.notifySlack` | createPost | Posts to the group's `slack_hook_url` if configured. |
| `Post.zapierTriggers` | createPost | Fires Zapier `new_post` hooks for the post's groups. |
| `Post.generateLinkPreview` | createPost when a URL is present but no `linkPreviewId` (API/Zapier/email) | Creates/attaches a LinkPreview. |
| `Post.rehostAndAttachImages` | create/update post with remote `imageUrls` | Downloads remote images (safeFetch), stores on S3, attaches as media; idempotent by position. |
| `Post.upsertChatActivityNotice` (delay 0 on create) | chat post create/delete | Rebuilds the hourly `chat_activity` notice post per group and emits `newPost`. |
| `Post.processEventCreated` / `processEventUpdated` / `processEventDeleted` | event create/update/delete | Invitations, RSVP emails, calendar regeneration. |
| `Post.sendUserRsvp` | `respondToEvent` | Sends RSVP confirmation/update/cancel email with `.ics` attachment. |
| `Post.publishPostUpdates` (delay 0) | post changes | Publishes `postUpdates:<userId>` to followers + creator (`lib/postSubscriptionPublisher.js`). |
| `Post.checkCompletedTrack` | completing an action post | Marks track completion, notifications/email. |
| `Post.updateFromNewComment` | `createComment` | Updates post `num_comments`, `updated_at`, followers, last-read. |
| `Comment.notifyAboutMessage` | DM comment | Notifications for direct-message recipients. |
| `Contribution.createActivities` | project contribution | Activities for contributions (legacy feature). |
| `Group.afterAddMembers` | adding members | Default topic follows, welcome posts, Zapier `new_member`, notifications. |
| `Group.afterFinishedJoining` | join flow completed (agreements/questions) | Post-join notifications (`memberJoinedGroup`) etc. |
| `Group.geocodeLocation` | group create/update with a `location` string but no `location_id` | Mapbox forward geocode (`mapbox.places-permanent`) → `Location` row. |
| `Group.publishToMurmurations` | group update when published to Murmurations | POST `{profile_url}` to `MURMURATIONS_INDEX_API_URL`. |
| `Group.notifyAboutCreate` | group create | Notifies (non-space) creation, e.g. to parent stewards / `NEW_GROUP_EMAIL`. |
| `Group.sendGroupCreatedEmail` | group create | Email to creator. |
| `Group.addEligibleMembersToSpace` | `createSpace`/`updateSpace` with `autoAddMembers` | Adds parent members (except those who left) to a space, copying notification settings. |
| `Group.convertChatSpaceMessages` | `convertChatSpaceToDiscussion` (large rooms) | Copies chat messages onto the discussion post as comments. |
| `Group.createEventCalendarSubscription` | event changes | Regenerates group `.ics` on S3. |
| `Group.notifyAboutPublicListingRequest`, `Group.messageAdminsAboutPublicListingRequest`, `Group.sendPublicListingDecision` | public-listing request / review | Admin notifications and requester email. |
| `User.createRsvpCalendarSubscription` | RSVP changes, settings | Regenerates the user's RSVP `.ics` (events responded yes/interested, if `settings.rsvp_calendar_sub`). |
| `User.afterUpdate` | profile update | Zapier `member_updated` hooks. |
| `User.afterLeaveGroup` | leave/removal | Zapier `member_leaves`, cleanup. |
| `User.clearSessionsFor` | password/linked-account change | Deletes other Redis sessions of the user. |
| `User.sendWelcomeEmail` (delay 2 min) | registration | Welcome email. |
| `Media.deleteMediaByUrl` | user deletion | Delete S3 objects. |
| `LinkPreview.populate` (delay 0) | new LinkPreview | Fetches URL (safeFetch, UA `Twitterbot/1.0`, 3 s timeout, 5 MB) and stores title/description/image (first image or favicon); public Hylo post URLs resolved internally; on failure stores a fallback title. |
| `Invitation.createAndSend` / `Invitation.reinviteAll` | invitations | Create and email invitations. |
| `GroupRelationshipInvite.createAcceptNotifications` | relationship invite accepted | Notifications. |
| `FlaggedItem.notifyModerators` | `flagInappropriateContent` | Notify moderators. |
| `ModerationAction.sendEmailsForModerationAction` / `sendToModerators` | moderation action | Emails reporter/reportee and moderators. |
| `FundingRound.sendPhaseTransitionNotifications`, `FundingRound.notifyStewardsOfSubmission` | phase changes, new submission | Notifications/emails. |
| `ExportService.exportMembers` / `exportUserAccount` | `/noo/export/*` | Builds CSV/ZIP, emails link/attachment. |
| `Email.<template>` | many | Sends a SendWithUs template (e.g. `sendPasswordReset`, `sendEmailVerification`, `sendFinishRegistration`, Stripe purchase/renewal emails). |

### 7.3 Scheduled tasks (`cron.js`)
Times are evaluated in **America/Los_Angeles**. Each invocation runs its tasks in parallel and exits.

| Interval | Tasks |
|---|---|
| `every10minutes` | `FullTextSearch.refreshView()` (refresh `search_index`); `Comment.sendDigests()` (batched comment / DM email digests); `Group.updateAllMemberCounts()` (recompute `groups.num_members` = active memberships of active users); `Post.updateProposalStatuses()` (proposal `proposal_status` → `voting` while now ∈ [start,end], → `completed` after end; skips `casual`/`completed` and posts without both times); `FundingRound.checkPhaseTransitions()` (auto-advance phases by date, notify). |
| `hourly` | Always: `GroupViewUser.sendDigests()` (chat-room email digests per chat view; membership `postNotifications` all / important / none; skipped when email disabled and user not tester). At **12:00 PT**: group digests `daily` + saved-search digests `daily`; and on **Wednesday** (Luxon weekday 3) also `weekly` group and saved-search digests. At **13:00 PT**: `Invitation.resendAllReady()` (automatic reminders: 2nd send when `sent_count=1` and last sent > 4 days ago, 3rd when `sent_count=2` and > 9 days; not used/expired). |
| `daily` | `Queue.removeOldJobs('complete', 20000)`; `Notification.removeOldNotifications()` (delete notifications older than 1 month); `FundingRound.sendReminderNotifications()` (3 days and 1 day before deadlines); `ContentAccess.sendRenewalReminders()` (subscriptions renewing in 7 days); `ContentAccess.sendExpiredAccessNotifications()`; `OIDCAdapter.cleanupExpired()`. |

Manual script: `yarn digest:daily --group=<ids> [--dry-run]` sends a 24-hour group digest for specific groups.

---

## 8. Email

- Provider: **SendWithUs** (`sendwithus` SDK, `SENDWITHUS_KEY`); templates are managed in SendWithUs (template ids hard-coded in `api/services/Email.js`) with locale variants (`locale` normalized to full form, e.g. `en-US`). Template translation workflow: `docs/SENDWITHUS_I18N_WORKFLOW.md`, sources in `apps/backend/scripts/i18n/`.
- Defaults: sender `EMAIL_SENDER`, name `The Team at Hylo`; headers `Precedence: bulk`, `X-Auto-Response-Suppress: All`. Invitations use sender name "<inviter> via Hylo" (`senderNameViaHylo`, localized) with `reply_to` = inviter email.
- Kill switches: never sends when `NODE_ENV=test` or `DISABLE_EMAIL_SENDING=1`; demo addresses (`lib/demo/addresses`) are skipped. Notification emails additionally require `EMAIL_NOTIFICATIONS_ENABLED=true` **or** the recipient is a tester (`HYLO_TESTER_IDS` or row in `email_enabled_testers`). Transactional emails (reset, verification) are not gated by that flag.
- Platform alerts: `sendStripeAlertEmail` → `NEW_GROUP_EMAIL`; `sendNewStripeConnectedAccountAdminNotification` → `PAYMENTS_NOTIFICATION_EMAIL` (sender "Hylo Platform Alerts" `dev+bot@hylo.com`, generic raw template).
- Template map (method → purpose): `sendRawEmail` (generic subject/body), `sendPasswordReset`, `sendEmailVerification`, `sendEmailChangeRequested`, `sendFinishRegistration` (API-created users), `sendModerationAction`, `sendInvitation`, `sendPostNotification`, `sendPostMentionNotification`, `sendJoinRequestNotification`, `sendApprovedJoinRequestNotification`, `sendMemberJoinedGroupNotification`, `sendDonationToEmail`/`sendDonationFromEmail` (legacy), `sendEventInvitationEmail`, `sendEventRsvpEmail`, `sendEventRsvpUpdateEmail`, `sendEventRsvpCancelEmail`, `sendGroupChildGroupInvite(Accepted)Notification`, `sendGroupParentGroupJoinRequest(Accepted)Notification`, `sendGroupPeerGroupInvite(Accepted)Notification`, `sendExportMembersList`, `sendExportUserAccount`, `sendTrackCompletedEmail`, `sendTrackEnrollmentEmail`, `sendWelcomeEmail`, `sendGroupCreatedEmail`, `sendFundingRoundNewSubmissionEmail`, `sendFundingRoundPhaseTransitionEmail`, `sendFundingRoundReminderEmail` (same template as phase transition), paid content (`sendPurchaseConfirmation`, `sendAccessGranted`, `sendSubscriptionRenewalReminder`, `sendSubscriptionRenewed`, `sendPaymentFailed`, `sendRefundProcessed`, `sendSubscriptionCancelled`, `sendSubscriptionCancelledAdminNotification`, `sendAccessExpired`, `sendTrackAccessPurchased`), digests (`sendMessageDigest`, `sendCommentDigest`, `sendChatDigest`; group digests in `lib/group/digest2`). `sendTagInvitation` is unused.
- **Inbound email (reply-by-email)**: notification emails carry `Reply-To: reply-<token>@<INBOUND_EMAIL_DOMAIN>` where token = `PlayCrypto.encrypt(INBOUND_EMAIL_SALT + postId + '|' + userId)` (AES, `PLAY_APP_SECRET`). Post creation addresses `create-<token>@...` (groupId|userId|type). The inbound provider (SendGrid Inbound Parse) POSTs to `/noo/hook/comment`; signature verified with `SENDGRID_INBOUND_PARSE_PUBLIC_KEY` (`lib/inboundEmailSignature.js`). Digest emails include forms posting to `/noo/hook/batchCommentForm` and `/noo/hook/postForm` with a `token` = `Email.formToken(groupId, userId)`.
- Email open tracking: Segment pixel URL (`Analytics.pixelUrl`).

## 9. Push notifications
- Provider **OneSignal** (`@onesignal/node-onesignal`, `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`). Users are targeted by alias `external_id = <user id>` (the app logs into OneSignal with the Hylo user id), `target_channel: 'push'`.
- Payload: `contents.en = alert`; when `path` given: `data.path = path` and `app_url = 'hyloapp:/' + path`; iOS badge `SetTo` `badge_no`.
- Each push is a row in `push_notifications` (`alert`, `path`, `badge_no`, `sent_at`, `disabled`, `platform`). Sending is disabled unless `PUSH_NOTIFICATIONS_ENABLED=true`, or `PUSH_NOTIFICATIONS_TESTING_ENABLED=true` and the user is a tester. Device registration mutation `registerDevice` is deprecated/no-op. Text builders localized via `lib/i18n/*`.

## 10. Other external services

| Service | Env | Use |
|---|---|---|
| Mapbox | `MAPBOX_TOKEN` (backend), `VITE_MAPBOX_TOKEN` (web) | Geocoding (`Group.geocodeLocation`), map tiles/search on web (16). |
| Filestack | `VITE_FILESTACK_API_KEY` | Web file picker (sources: local, url, webcam, instagram, facebook, imagesearch, googledrive, dropbox). Picked file URL is sent to `/noo/upload` which re-hosts it on S3 (Filestack transforms stripped; SVG fetched as PNG). |
| Unsplash / Pexels | `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY` | Stock image search for banners/covers (server-side proxy). |
| Stripe (Connect) | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_BYPASS_SIGNATURE`, `STRIPE_API_KEY` (legacy), `VITE_STRIPE_CLIENT_ID` | Paid content (23). Webhook `POST /noo/stripe/webhook`. |
| Segment | `SEGMENT_KEY`, `DISABLE_SEGMENT=1`, `VITE_SEGMENT_KEY` | Server analytics events (`Analytics.track`), signup tracking, email pixel. |
| Mixpanel | `MIXPANEL_TOKEN`, `VITE_MIXPANEL_TOKEN` | Server: `mixpanel.people.set(userId)` on each authenticated GraphQL schema build, group profiles; client: `mixpanelMiddleware` tracks Redux actions with `meta.analytics`. Disabled (no-op) without token or in test. |
| Intercom | `INTERCOM_KEY`, `VITE_INTERCOM_APP_ID` | Support chat widget (web). |
| Sentry | `SENTRY_DSN`, `SENTRY_ENV`, `VITE_SENTRY_*` | Error reporting. |
| Slack | `SLACK_APP_CLIENT_ID/SECRET`, `VITE_SLACK_APP_CLIENT_ID`, `DISABLE_SLACK_INTEGRATION` | Legacy per-group incoming webhook (`groups.slack_hook_url`) notifications. |
| Murmurations | `MURMURATIONS_INDEX_API_URL` | Group profile publishing; profile JSON served at `GET /noo/group/:groupSlug/murmurations`. |
| Zapier | — | REST hooks managed by `createZapierTrigger`/`deleteZapierTrigger`; triggers `new_post`, `new_member`, `member_leaves`, `member_updated` (24). |
| Google Maps/Places | `VITE_GOOGLE_BROWSER_KEY` | Legacy client key. |
| Virtuoso | `VITE_VIRTUOSO_KEY` | License key for `@virtuoso.dev/message-list` (chat list). |

**Outbound fetch safety** (`lib/safeFetch.js`): every user-supplied URL (link previews, remote uploads, webhooks) is fetched with node-fetch through agents whose DNS lookup refuses private/reserved ranges (IPv4: 0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.0.0/24, 192.0.2/24, 192.168/16, 198.18/15, 198.51.100/24, 203.0.113/24, 224/4, 240/4; IPv6: ::, ::1, 64:ff9b::/96, fc00::/7, fe80::/10, ff00::/8), only `http(s)`, max 5 redirects each re-checked.

---

## 11. File uploads & image processing
- Endpoint `POST /noo/upload` (`sessionAuth`). Accepts `application/json` `{type, id, url, filename}` (remote URL, the normal web path after Filestack) or `multipart/form-data` (fields `type`, `id`, `url` then one file; limits 1 file, **10 MB**).
- `type` must be one of: `userAvatar`, `userBanner`, `groupAvatar`, `groupBanner`, `post`, `postCompletion`, `comment`, `importPosts`, `welcomePage`, `fundingRoundDescription`, `fundingRoundCriteria`. `id` required (`'new'` allowed for posts).
- Permission: `user*` types → `id` must equal the session user; `group*` types → Administration responsibility in the group; `post*` → `id === 'new'`, or the post author, or the post is an `action` post. Other types unchecked.
- File type sniffed from the first chunk (`file-type`), zip mis-detection falls back to filename mime.
- Resizing with **sharp** (EXIF auto-rotate, `withoutEnlargement`): userAvatar 200×200, userBanner 1600×600, groupAvatar 160×160, groupBanner 1600×600, post/comment width 1200, welcomePage/fundingRound* width 1600. SVGs and non-images pass through unchanged.
- Group avatars additionally produce a 42×42 circular PNG with a 1 px black border, named `<name>-forMap.png` (map markers).
- Key naming: sanitized basename, extension from detected type; avatars/banners overwrite in place; other types get `_<timestamp>_<random6>` suffix.
- `importPosts` streams a CSV into the post importer (`lib/uploader/postImporter.js`) and returns `{type,id,mimetype:'text/csv'}` before posts are created.
- Response: `{ type, id, url, attachmentType }` where `attachmentType` = `image` / `video` / `file` derived from mimetype. Errors: validation → 422 `{error}`; unsupported image → 422 `{error:'Unsupported image format'}`; else 500.

---

## 12. Internationalisation (backend)
- Supported locales: `en`, `es`, `fr`, `de`, `hi`, `pt` (Sails i18n `config/i18n.js`, default `en`; `config/locales/*.json`), plus string tables in `lib/i18n/{en,es,fr,de,hi,pt}.js` used for push texts, invite messages, notification text; `getLocaleStrings(locale)` falls back to English.
- The user's locale is stored on the user (`settings.locale`) and passed to SendWithUs as full locale (`normalizeLocaleToFull`). Front-end translations: `apps/web/public/locales/*.json` (see [08-design-system-i18n.md](08-design-system-i18n.md)).

## 13. Feature flags & environment gating
- **Backend** (`lib/featureFlags.js`): `isFeatureEnabled(name)` reads `FEATURE_FLAG_<NAME>` (`on`/`true` / `off`/`false`); when unset, flags in `ON_OUTSIDE_PRODUCTION` are on for environments `development`, `test`, `staging` (environment = `SENTRY_ENV || NODE_ENV`), else off. Only flag: `MEMBER_INVITES` (members sending invitations: `everyone`/`roles` invite policies and "limited" invite access).
- **Web** (`src/config/featureFlags.js`): `featureFlag(key)` = `VITE_FEATURE_FLAG_<KEY>` (`on` / `testing` / `off`) || `process.env.FEATURE_FLAG_<KEY>` || `'on'` for `MEMBER_INVITES` outside production (environment = `VITE_SENTRY_ENV || MODE`). `Me.hasFeature(key)`: `on` → true; `testing` → only testers (`HYLO_TESTER_IDS`); else false. Flags: `MEMBER_INVITES`, `PROJECT_CONTRIBUTIONS` (project contributions/payment settings tab, effectively off).
- Other gates: `EMAIL_NOTIFICATIONS_ENABLED`, `PUSH_NOTIFICATIONS_ENABLED`, `PUSH_NOTIFICATIONS_TESTING_ENABLED`, `DISABLE_EMAIL_SENDING`, `DISABLE_SEGMENT`, `DISABLE_SLACK_INTEGRATION`, `DISABLE_PROXY` (web), testers via `HYLO_TESTER_IDS` + `email_enabled_testers` table (admin-managed via `addEmailEnabledTester`).
- Mobile version gate: `GET /noo/mobile/check-should-update` compares against `MINIMUM_SUPPORTED_MOBILE_VERSION` and returns store URLs `IOS_APP_STORE_URL` / `ANDROID_APP_STORE_URL`.

## 14. Shared packages (`packages/*`)

| Package | Responsibility |
|---|---|
| `@hylo/shared` | Framework-agnostic helpers used by web, mobile and backend: `TextHelpers` (HTML↔text, truncation, sanitizing, mention/topic markup), `Validators` (user name, email, password, slug rules), `LocationHelpers` (Mapbox → location conversion, display precision), `LocaleHelpers`, `DateTimeHelpers` (event time formatting), `OfferingHelpers` (Stripe offering durations/prices), `viewHelpers`, `constants`, types. |
| `@hylo/navigation` | URL builders/parsers for web routes (group, post, member, topic, context URLs), shared so backend emails and mobile deep links produce the same paths. |
| `@hylo/presenters` | View-model presenters: `PostPresenter`, `GroupPresenter`, `GroupViewPresenter`, `PersonPresenter`, `NotificationPresenter`, `EventInvitationPresenter`, `TrackPresenter`, `colors`. |
| `@hylo/graphql` | Shared GraphQL documents: 27 queries (`meQuery`, `postQuery`, `groupDetailsQueryMaker`, `notificationsQuery`, …), 43 mutations, fragments. Used by mobile (urql). |
| `@hylo/urql` | urql client factory (`makeUrqlClient`), graphcache keys/resolvers/updates/optimistic handlers, directives, token auth exchange. |
| `@hylo/hooks` | React hooks over urql: `useCurrentUser`, `useCurrentGroup`, `useGroup`, `useHasResponsibility`, `useRolesForGroup`, `useTrack(s)`, `useFundingRound(s)`, `usePeopleTyping`, `useUnifiedSubscription` (allUpdates), `useStaticContexts`, etc. |
| `@hylo/contexts` | `AuthContext` (shared auth state provider). |

## 15. Environment variables

Backend (`apps/backend`):

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development` / `test` / `production`. |
| `PROTOCOL`, `DOMAIN` | Public scheme and host of the **web** app (e.g. `https`, `www.hylo.com`); used for all absolute URLs, OIDC issuer, JWT iss/aud, OAuth callbacks. |
| `FRONTEND_URL` | Frontend base for some links (Stripe return URLs, etc.). |
| `DATABASE_URL`, `PGSSLMODE` | Postgres connection. |
| `REDIS_URL`, `KUE_NAMESPACE` | Redis; Kue key prefix. |
| `COOKIE_NAME`, `COOKIE_DOMAIN`, `COOKIE_SECRET` | Session cookie. |
| `JWT_SECRET` | Legacy (declared in app.json; JWTs now use `OIDC_KEYS`). |
| `OIDC_KEYS` | Comma-separated base64 RSA private keys (first signs JWTs; all published in JWKS). |
| `HYLO_JWT_EXTRA_ISSUERS` | Extra accepted JWT issuers. |
| `HYLO_ADMINS`, `HYLO_TESTER_IDS` | Admin and tester user ids. |
| `CORS_ALLOWED_ORIGINS` | Extra trusted origins. |
| `GOOGLE_CLIENT_ID/SECRET`, `ADMIN_GOOGLE_CLIENT_ID/SECRET`, `LINKEDIN_API_KEY/SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_CLIENT_TOKEN`, `APPLE_CLIENT_ID` | Social login. |
| `SENDWITHUS_KEY`, `EMAIL_SENDER`, `EMAIL_NOTIFICATIONS_ENABLED`, `DISABLE_EMAIL_SENDING`, `NEW_GROUP_EMAIL`, `PAYMENTS_NOTIFICATION_EMAIL` | Email. |
| `INBOUND_EMAIL_DOMAIN`, `INBOUND_EMAIL_SALT`, `PLAY_APP_SECRET`, `SENDGRID_INBOUND_PARSE_PUBLIC_KEY` | Reply-by-email addresses and verification. |
| `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, `PUSH_NOTIFICATIONS_ENABLED`, `PUSH_NOTIFICATIONS_TESTING_ENABLED` | Push. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_S3_CONTENT_URL`, `UPLOADER_HOST`, `UPLOADER_PATH_PREFIX` | Storage. |
| `MAPBOX_TOKEN`, `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`, `MURMURATIONS_INDEX_API_URL`, `INTERCOM_KEY`, `SEGMENT_KEY`, `DISABLE_SEGMENT`, `MIXPANEL_TOKEN`, `SLACK_APP_CLIENT_ID/SECRET`, `DISABLE_SLACK_INTEGRATION` | Integrations. |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_BYPASS_SIGNATURE`, `STRIPE_API_KEY` | Payments. |
| `IOS_APP_STORE_URL`, `ANDROID_APP_STORE_URL`, `MINIMUM_SUPPORTED_MOBILE_VERSION` | Mobile update prompts. |
| `SENTRY_DSN`, `SENTRY_ENV` | Errors. |
| `FEATURE_FLAG_<NAME>` | Feature flags. |
| `WEB_CONCURRENCY`, `HEROKU_AVAILABLE_PARALLELISM`, `DELAY_START` | Process tuning. |
| `SEARCH_STATEMENT_TIMEOUT_MS`, `GRAPHQL_CACHE_SCHEMA`, `CHAT_CONVERSION_BATCH_SIZE`, `CHAT_CONVERSION_QUEUE_THRESHOLD` | Tuning (search timeout; schema cache; chat→discussion conversion batches / inline-vs-queued threshold). |
| `DEBUG_GRAPHQL`, `DEBUG_SQL`, `DEBUG_MEMORY`, `AUTH_DEBUG`, `DEBUG_RSVP_CAL_TEST`, `GRAPHQL_YOGA_LOG_LEVEL`, `SAILS_LOG_LEVEL`, `PRETTY_JSON`, `DEBUG` | Diagnostics. |
| `APP_BASE`, `NODE_MODULES_CACHE`, `YARN2_WORKSPACE_PATH`, `YARN2_SKIP_PRUNING` | Heroku monorepo build. |

Web (`apps/web`): `VITE_API_HOST` (API origin for proxy and server-side calls), `VITE_SOCKET_HOST`, `VITE_HOST`, `PROXY_HOST` (marketing site), `DISABLE_PROXY`, `HYLO_COOKIE_NAME` (session cookie name to detect logged-in visitors), `PORT`, `VITE_FILESTACK_API_KEY`, `VITE_MAPBOX_TOKEN`, `VITE_MIXPANEL_TOKEN`, `VITE_INTERCOM_APP_ID`, `VITE_SEGMENT_KEY`, `VITE_GOOGLE_BROWSER_KEY`, `VITE_GOOGLE_CLIENT_ID`, `VITE_SLACK_APP_CLIENT_ID`, `VITE_STRIPE_CLIENT_ID`, `VITE_AWS_S3_BUCKET`, `VITE_AWS_S3_HOST`, `VITE_SENTRY_DSN`, `VITE_SENTRY_ENV`, `VITE_SENTRY_DEBUG`, `VITE_LOG_LEVEL`, `VITE_FEATURE_FLAG_*`, `VITE_FEATURED_GROUP_IDS`, `VITE_VIRTUOSO_KEY`, `VITE_DEBUG_CHECK_LOGIN`, `VITE_E2E_ISOLATED`, `E2E_*` (isolated Playwright runner).

## 16. Deployment topology
- Heroku, stack `heroku-24`. Backend app (`apps/backend/app.json`): addons `redisgreen` (Redis), `scheduler` (cron), `heroku-postgresql:standard-0`; buildpacks: monorepo (`APP_BASE=apps/backend`), graphicsmagick, `heroku/nodejs`, `Hylozoic/heroku-buildpack-migrate` (runs migrations on deploy). Dynos: `web` (app.js) and `worker` (worker.js). Review apps: 1 basic web + 1 basic worker, `heroku-postgresql:basic`.
- Web app: separate Heroku app (`apps/web/app.json`), Node buildpack, `web: node dist/server/index.js`. Also a `Dockerfile` exists in `apps/web`.
- Public hosts: `www.hylo.com` (web), `api.hylo.com` (API; `/noo` is also reachable via the web proxy), `staging.hylo.com` / `api-staging.hylo.com`, `review.hylo.com` / `api-review.hylo.com`, `node1.hylo.com`.
- Maintenance page: `hylo-maintenance.html` at repo root.
- Local dev: `yarn backend:dev` (foreman: `web` with nodemon on port 3001 + inspector 3002, `worker` with `DELAY_START=5`; `dev-stripe` adds `stripe listen --forward-to localhost:3001/noo/stripe/webhook`), `yarn web:dev` (Vite on 3000). Devcontainer/docker-compose in `apps/backend/.devcontainer` and `migrations/docker-compose.yml`.

## 17. Edge cases & known quirks
- `config/routes.js` maps `GET /noo/login/linkedin/oauth` to `SessionController.finishLinkedinOAuth` and the token route to `finishLinkedinTokenOAuth`, but the controller defines `finishLinkedinOauth` / `finishLinkedinTokenOauth` (lower-case "auth") — these routes have no matching action. Facebook routes exist without a registered Passport strategy. LinkedIn/Facebook login are effectively dead.
- `UserController.unsubscribeFromUpdates` leaves room type `group` with the user id (should be `user`), so `POST /noo/user/unsubscribe` leaves `groups/<userId>` instead of the user room.
- Presence is per-process memory; with multiple web dynos/cluster workers presence rosters diverge.
- Search index lags writes by up to 10 minutes (materialized view refresh).
- Web proxy for `/noo` does not support websockets; production sockets must use `VITE_SOCKET_HOST`.
- `OneSignal` service has an inverted check (`!process.env.NODE_ENV === 'development'`) so missing credentials never throw.
- `numOfWorkers` cluster workers that exit are not re-forked.

## 18. Docs vs. code
- Public docs describe Hylo as a single hosted service; code shows web and API are separate Heroku apps with a `/noo` proxy and a separate marketing site (Astro, `PROXY_HOST`). Code wins.
- `app.json` still declares `JWT_SECRET`; JWTs are actually signed with `OIDC_KEYS` (RS256).
- Comments in `RoomPresence.js` claim a "single-process deployment" while `app.js` supports clustering via `WEB_CONCURRENCY`.

## 19. Source references
`Procfile`, `heroku-postbuild.sh`, `apps/backend/{app.js,worker.js,cron.js,knexfile.js,app.json,Procfile*,.env.example}`, `apps/backend/config/*`, `apps/backend/api/policies/*`, `apps/backend/api/services/{UserSession,AccessTokenAuth,OpenIDConnect,OIDCTokens,Admin,Queue,Email,OneSignal,Analytics,FullTextSearch,RedisClient,RedisPubSub,Websockets,RoomPresence}.js`, `apps/backend/api/services/oidc/KnexAdapter.js`, `apps/backend/api/hooks/oidcRoutes.js`, `apps/backend/api/controllers/*`, `apps/backend/api/graphql/{index,makeSchema,makeSubscriptions}.js`, `apps/backend/lib/{HyloJWT,rateLimit,responseCompression,featureFlags,mixpanel,sentry,skiff,safeFetch,postSubscriptionPublisher,groupSubscriptionPublisher}.js`, `apps/backend/lib/uploader/*`, `apps/backend/lib/i18n/*`, `apps/web/src/server/*`, `apps/web/src/config/*`, `apps/web/vite.config.js`, `apps/web/app.json`, `apps/web/src/client/{websockets,filestack}.js`, `packages/*`.
