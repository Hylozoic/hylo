# Modern Mobile Auth for Hylo — Options & Recommendations

> Companion to `docs/mobile-auth-cookie-workflow.md`. That doc describes how auth
> works **today**. This doc proposes how it could work in a **modern** React Native
> app, and what would have to change on the server and in the WebView bridge.

## 1. Where we are today (one-paragraph recap)

Auth is **server-session + cookie** based (Sails/Express session stored in Redis,
60‑day rolling cookie). The React Native code owns the login/logout UI, but the
real source of truth is the server session. The session **cookie** is captured as a
side‑effect of `Set-Cookie` headers on GraphQL/REST responses, mirrored into
`AsyncStorage`, and then pushed into the WebView cookie jar (`@react-native-cookies/cookies`
+ `sharedCookiesEnabled` + an explicit `Cookie` header on the initial WebView load).
Native GraphQL works because React Native's `fetch` keeps its own OS cookie jar;
the WebView works because we manually keep its jar in sync.

The pain comes from having **two client-side stores of the same secret** (the OS
cookie jar for native + AsyncStorage/WebView jar for web) that can drift apart, plus
a cookie format parser full of Sails/Heroku special-casing. Symptoms: AsyncStorage
loss → WebView "Session Required" while native is still logged in; stale cookies from
multi-device login cycles; SSE subscription responses that never refresh the cookie;
race conditions where the WebView loads before a fresh cookie is written.

**Root cause:** the cookie is treated as derived, mutable, side-effect state that is
copied between stores, instead of there being a single authoritative credential.

## 2. What a modern RN app looks like in 2026

The industry-standard pattern for native apps is **OAuth 2.0 / OpenID Connect with
PKCE** (RFC 8252, "OAuth 2.0 for Native Apps"):

- **Credential = tokens, not cookies.** A short-lived **access token** (JWT, minutes
  to ~1h) is sent as `Authorization: Bearer …`. A long-lived **refresh token** is used
  to silently mint new access tokens. Tokens are the single source of truth.
- **Secure storage**, not AsyncStorage. Refresh tokens live in the iOS Keychain /
  Android Keystore (`react-native-keychain` or `expo-secure-store`), optionally gated
  by biometrics. AsyncStorage is unencrypted and is the wrong place for a credential.
- **System browser for the authorization step** (ASWebAuthenticationSession on iOS,
  Chrome Custom Tabs on Android) via `react-native-app-auth` or `expo-auth-session`.
  This is the RFC 8252 recommendation and also gives you **SSO with the WebView for
  free**, because the IdP sets its own session cookie in a shared browser context.
- **Refresh-token rotation** + revocation on logout.

Common library stack:

| Concern | Library |
|---|---|
| OAuth/OIDC native flow | `react-native-app-auth` (bare RN) or `expo-auth-session` (Expo) |
| Secure token storage | `react-native-keychain` / `expo-secure-store` |
| WebView | `react-native-webview` (you use a wrapper today) |
| WebView cookie jar | `@react-native-cookies/cookies` (already in use) |
| In-app browser (if not using app-auth) | `react-native-inappbrowser-reborn` |

**Managed alternatives** (Auth0, Clerk, Cognito, Firebase Auth, Supabase Auth) exist
and are great for greenfield apps, but Hylo **already operates its own OIDC provider**
(`oidc-provider` at `/noo/oauth/*`, see `apps/backend/api/services/OpenIDConnect.js`).
Adopting a third-party IdP would mean migrating every existing user and every existing
API partner. **Recommendation: be your own IdP** — you already are one.

## 3. The crux: syncing auth between native and the WebView

There are three viable patterns. All of them make one credential authoritative and
*derive* the other on demand, instead of copying a cookie between two stores.

### Pattern 1 — Token is authoritative; mint the web session on demand ("bridge")

Native holds OIDC tokens. Just before showing the WebView (or on a 401 inside it), the
app exchanges its access token for a **fresh server session cookie** via a small
backend endpoint, e.g. `POST /noo/session/from-token` (Bearer access token in →
`Set-Cookie` out). The WebView then loads normally.

- ✅ Single source of truth (the token). Cookie is always freshly derived, never stale.
- ✅ Survives AsyncStorage loss — refresh token in Keychain regenerates everything.
- ✅ Minimal change to the web app (it still speaks cookies/sessions).
- ⚠️ One new backend endpoint; one extra call before WebView load (cheap, cacheable for
  the cookie's lifetime).

### Pattern 2 — Shared IdP session (true SSO)

If login happens in the system browser against `/noo/oauth/auth`, the OIDC provider
sets its session cookie on `.hylo.com`. The web app inside the WebView can then do a
**silent** authorization (`prompt=none`) and get authenticated without the user doing
anything, because the browser/WebView already has the IdP session.

- ✅ Cleanest conceptually; standard OIDC SSO.
- ⚠️ Requires the web app to become an OIDC client too (SPA + PKCE + silent renew).
  Bigger web-side change. iOS WKWebView cookie isolation can make `prompt=none` flaky
  unless cookies are pre-seeded.

### Pattern 3 — Token everywhere; WebView uses Bearer too

Eliminate server sessions entirely. Native passes the access token to the web app via
`postMessage`; the web app attaches `Authorization: Bearer` to its GraphQL calls
(the backend GraphQL endpoint already accepts OIDC Bearer tokens via
`checkClientCredentials`). Token lives in WebView memory only.

- ✅ No cookies at all; conceptually uniform.
- ⚠️ Largest blast radius — the web app is the same codebase used in real browsers,
  which still need cookie sessions, so it must support both. Token-in-WebView raises
  XSS exposure. Highest risk.

**For Hylo, Pattern 1 is the sweet spot:** it modernizes the *native* side fully
(tokens, Keychain, refresh, secure flow) while keeping the *web* side on the
battle-tested session model and reducing the WebView to a deterministic, derived
session. Pattern 2 is the long-term ideal once the web app is also an OIDC client.

## 4. Recommended option (detailed): Native OIDC tokens + session bridge

### 4.1 Server changes

Most of this is **configuration + one controller**, because the OIDC provider exists.

1. **Register a first-party public client** for the mobile app in the OIDC provider:
   `application_type: native`, PKCE required, a custom redirect scheme
   (`com.hylo.app://oauth`), `grant_types: [authorization_code, refresh_token]`,
   `scope: openid offline_access email profile api:read api:write`.
2. **Pick the native login UX** (see 4.3). If you keep a native email/password form
   instead of the browser flow, add a **first-party direct token endpoint** that
   validates via the existing `User.authenticate` and returns OIDC-compatible
   access/refresh tokens (a thin wrapper around the provider, restricted to the
   first-party client). If you adopt the browser flow, you need nothing extra here.
3. **Add the session bridge** (Pattern 1): `POST /noo/session/from-token`. It runs the
   existing Bearer/OIDC auth (you already have `checkClientCredentials` +
   `accessTokenAuth`), then calls `UserSession.login(req, user, 'token')` and returns
   `200` with `Set-Cookie`. This is ~20 lines reusing `UserSession`.
4. **Social login**: keep the native Google/Apple SDKs, but instead of
   `/noo/login/google-token/oauth` creating a *session*, have it (or a sibling
   endpoint) federate the verified social identity and return **Hylo tokens**.
5. **Logout**: support OIDC token **revocation** (`/noo/oauth/token/revocation`,
   already routed) and OIDC `end_session` in addition to `session.destroy()`.

No change needed to the GraphQL resolver auth model: `req.session.userId` can be set
either by a cookie session *or* by Bearer middleware, both of which already exist.

### 4.2 Mobile changes

- Replace cookie capture (`setSessionCookie` side-effects in `makeUrqlClient.js` and
  `fetchJSON.js`) with a **token store** in Keychain and an URQL `authExchange` that
  attaches `Authorization: Bearer` and transparently refreshes on 401.
- Login screen calls the OIDC flow (or first-party token endpoint) instead of the
  GraphQL `login` mutation. `AuthContext` keeps the same public shape
  (`login/logout/checkAuth`, `isAuthorized`) so the rest of the app is unchanged.
- Before mounting `HyloWebView`, call the bridge endpoint, set the returned cookie into
  the WebView jar via `CookieManager`, then load. The header-injection +
  `ensureWebViewCookies` dance in `session.js` collapses into one deterministic step.
- Delete the Sails/Heroku cookie parser entirely (`parseCookies`, `serializeCookie`,
  `invalidPair`) — it exists only to reverse-engineer `Set-Cookie`.
- Fix the SSE subscription gap as a side benefit: subscriptions just send the Bearer
  token; there's no cookie to keep fresh.

### 4.3 Native login UX choice (important tradeoff)

- **System-browser authorization (recommended, most secure + SSO):** `react-native-app-auth`
  opens ASWebAuthenticationSession / Custom Tabs to `/noo/oauth/auth`. Users may see a
  brief browser sheet. Gives Pattern-2 SSO with the WebView essentially for free.
- **Native form + first-party token endpoint (best UX, acceptable for first-party):**
  keep your current email/password UI; exchange credentials at a first-party token
  endpoint. Avoid the deprecated ROPC grant by making this a dedicated first-party
  route guarded to your own client. You lose browser-based SSO (use Pattern 1 bridge).

### 4.4 Logout

`logout()` → revoke refresh token + OIDC `end_session` → clear Keychain →
`CookieManager.clearAll()` → existing service cleanup (OneSignal, Intercom, Mixpanel) →
`postMessage(LOGOUT)` to the WebView (keep the existing web→native LOGOUT bridge in
`RootRouter`/`PrimaryWebView`).

## 5. Alternative option: incremental hardening of the cookie model

If a token migration is too big right now, you can de-risk the current model without
adopting OAuth:

1. Move the cookie from AsyncStorage into **`react-native-keychain`**.
2. Add a **session probe** endpoint (`GET /noo/session` → 200/401 + refreshed cookie)
   and call it before mounting the WebView, so you never load with a stale cookie.
3. Make the WebView jar the single web-side store (drop header injection; rely on
   `CookieManager.set` + `sharedCookiesEnabled`) and have the **web app post back its
   auth status** (`AUTHED` / `UNAUTHED`) so native reacts to 401s instead of guessing
   from a 2s timeout.
4. Fix the **SSE cookie gap** so subscription responses also refresh the cookie.
5. Throttle `setSessionCookie` writes (only write when the value actually changes).

This is lower effort and lower risk, but it does **not** remove the dual-store class of
bugs — it just narrows the windows. It's a good stepping stone *toward* §4, not a
destination.

## 6. Cross-cutting issues to plan for

- **WKWebView vs Android cookie stores differ.** iOS `sharedCookiesEnabled` shares the
  native HTTPCookieStorage; Android's WebView jar is fully separate. Whatever pattern
  you choose, set cookies via `WKHTTPCookieStore`/`CookieManager` **before** first load.
- **`SameSite=None; Secure`** is required for the `.hylo.com` cross-subdomain cookie;
  this is already configured but matters if you keep any cookie path.
- **Token security in a WebView (Pattern 3 only):** tokens in JS are XSS-exposed; prefer
  Pattern 1/2 which keep tokens out of the web runtime.
- **API partners / OIDC clients are unaffected** by §4 — they keep using the same
  provider. This is a strong argument for staying your own IdP.
- **Migration / rollout:** ship token auth behind a flag; keep cookie login working in
  parallel; the bridge endpoint lets both coexist during transition. Force-logout is
  not required because the server session model is preserved underneath.
- **Refresh-token rotation & reuse detection** should be enabled (the provider TODO note
  in `OpenIDConnect.js` mentions switching to rotation).

## 6b. Local development & testing

Good news: **the OIDC provider already runs in local dev**, so Pattern 1 is testable on
your machine without any third-party service.

- **It's mounted and configured.** `oidc.callback()` is mounted at `/noo/oauth` in
  `apps/backend/config/customMiddleware.js`, exposing `/noo/oauth/auth`, `/token`,
  `/jwks`, `/me`, `/token/revocation`, `/session/end`. `.env.example` ships working
  local secrets (`OIDC_KEYS` base64 RSA key, `COOKIE_SECRET`), so signing/JWKS work
  out of the box.
- **Issuer & proxy.** The issuer is `http://localhost:3000` (`PROTOCOL + DOMAIN`). The
  web Vite dev server (`apps/web/vite.config.js`) proxies `/noo` → `http://localhost:3001`,
  so OIDC endpoints resolve consistently through `:3000`. The authorize step renders
  your own web login UI (`/oauth/login/:uid`, `/oauth/consent/:uid`).
- **The bridge endpoint** (`POST /noo/session/from-token`) is a plain Sails route
  reusing `UserSession.login` — testable with curl/Postman against `:3001`, no device
  needed.

Three gotchas when testing from a device/emulator:

1. **Issuer reachability.** Issuer is hardcoded to `localhost:3000`. iOS Simulator
   reaches `localhost` directly. On **Android**, `yarn android` sets up `adb reverse`,
   which forwards the device's `localhost:3000/3001` to the host — so `localhost` works
   there too (ensure the reverse includes ports 3000/3001, not just Metro's 8081; note
   `adb reverse` covers emulators + USB devices, not Wi‑Fi-only debugging). Because the
   issuer is `localhost`, this keeps dev on `http` and matches the `iss` claim that
   `react-native-app-auth` validates. A **tunnel (ngrok/cloudflared)** or LAN IP is only
   needed for off-bridge real devices or when you need HTTPS (e.g. Sign in with Apple).
2. **Register a native client.** `clients: []` in `OpenIDConnect.js` with a `KnexAdapter`
   means clients live in the DB (`oidc` table). Seed a one-time
   `application_type: native`, PKCE-required client with redirect `com.hylo.app://oauth`.
3. **PKCE is on by default** unless a client sets `noPKCE` — which is exactly what a
   native public client wants; no change required.

## 6c. Google / Apple social login (must keep working)

Today both social paths terminate in a **server session** (see
`apps/backend/api/controllers/SessionController.js`):

- **Apple:** native `@invertase/react-native-apple-authentication` → `identityToken` +
  `nonce` → `POST /noo/login/apple/oauth` → `finishAppleOAuth` verifies via
  `appleSigninAuth.verifyIdToken` → `upsertUser(req, 'apple', …)` → session.
- **Google:** native `@react-native-google-signin` → access token →
  `POST /noo/login/google-token/oauth?access_token=…` → `finishGoogleTokenOAuth` →
  passport `google-token` strategy → `upsertUser` → session.

Under Pattern 1 these stay almost the same; only the **output** changes from a cookie
session to **Hylo OIDC tokens**:

- **Keep the native Google/Apple SDKs as-is.** Do *not* reroute social through the
  system-browser OIDC flow. (Apple App Store rules require the native "Sign in with
  Apple" button when other social logins are offered, and the native Google picker is
  better UX.)
- **Keep the existing verify-and-upsert endpoints**; they already verify the provider
  credential and resolve/create the Hylo user. Change them to mint an `oidc-provider`
  server-side `Grant` + access/refresh tokens for the first-party mobile client (a
  token-exchange-style step, RFC 8693 in spirit) and return them.
- Native stores those tokens in the Keychain, **identical to the email/password path**,
  and the WebView session is derived via the bridge. All three login methods converge on
  "produce Hylo tokens," so everything downstream is uniform.

Local-testing caveat (independent of our design): social testing is gated by the
**providers** — `GOOGLE_CLIENT_ID` is a placeholder in `.env.example` (needs a real
client ID), and Sign in with Apple needs Apple Developer config and generally a real
signed build/device. Email/password via the OIDC flow + bridge is the easy end-to-end
local validation.

## 7. Suggested phasing

1. **Phase 0 (quick wins, no model change):** Keychain for the cookie + SSE cookie fix +
   throttled writes + web→native auth-status `postMessage`. (≈ §5 items 1, 3, 4, 5.)
2. **Phase 1 (native goes token-first):** register first-party OIDC client, add the
   session-bridge endpoint, switch native GraphQL to Bearer + Keychain, derive the
   WebView cookie from the token. (≈ §4, Pattern 1.) **This is the recommended target.**
3. **Phase 2 (optional, true SSO):** make the web app an OIDC client and adopt
   `prompt=none` silent auth in the WebView. (Pattern 2.) Eventually retire server
   sessions if/when the web app no longer needs them.

## 8. Bottom line

- You don't need a new auth vendor — you need to **use the OIDC provider you already
  run** as your mobile app's IdP.
- Make a **token** the single source of truth on the native side, store it in the
  **Keychain**, and **derive** the WebView's session from that token on demand (the
  bridge endpoint) rather than copying a cookie between stores.
- Server work is mostly **configuration + one small bridge controller**; the GraphQL
  auth model and all existing API partners are unaffected.
- If you can't do the full migration now, the §5 hardening (Keychain + session probe +
  SSE fix + web auth-status postMessage) removes most of the day-to-day pain and is
  directly on the path to the token model.
