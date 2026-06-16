# Phase 1 Implementation Plan — Native Token Auth + Session Bridge

> Companion to `docs/modern-mobile-auth-options.md` (§4, Pattern 1) and
> `docs/mobile-auth-cookie-workflow.md`. Concrete, file-by-file build plan for **Phase 1**.
> Code below is **sketch** to be reviewed/refined before implementation.

## 0. Goal & scope

Make the **native side token-first** and **derive the WebView session from the token**,
while keeping the existing cookie-session login (web) fully working and unaffected.

Locked decisions (from review):
- **Native email/password form stays** — same look/UX as today. No system browser, no
  `react-native-app-auth`, no custom URL scheme. Login posts credentials to a first-party
  JSON endpoint that returns tokens.
- **Web and mobile use different login mechanisms** that must not conflict: web keeps the
  GraphQL `login` mutation + session cookie; mobile-native uses a Bearer token. The
  mobile→WebView handoff must be seamless (no login flash).
- **Social (Google/Apple)** keep their native SDKs; the verify endpoints return tokens.

**Out of scope (later phases):** browser-based OIDC / `prompt=none` SSO (Pattern 2);
retiring server sessions (Pattern 3); upstream social federation in the provider.

## 1. Target state

```
Login (email/pw)     ──► POST /noo/login/native {email,password} ─────────────┐
Login (Google/Apple) ──► native SDK ──► /noo/login/*-token/oauth (verify) ─────┤  mintTokensForUser()
                                                                               ▼
                                                                  Keychain {access, refresh}
                                                                               │
   native GraphQL  ◄── Authorization: Bearer <access> (urql authExchange) ─────┤
   token refresh   ──► POST /noo/oauth/token  grant_type=refresh_token ────────┤ (standard provider endpoint)
   WebView         ◄── POST /noo/session/from-token ──► Set-Cookie ────────────┘
   logout          ──► POST /noo/oauth/token/revocation
```

Single source of truth = **refresh token in the Keychain**. Access tokens and the WebView
session cookie are both *derived* and disposable. Token **issuance** is bespoke
(first-party, no browser); token **refresh/revocation** use the standard provider
endpoints because the minted tokens are real `oidc-provider` tokens.

## 2. Web vs mobile isolation & handoff (decision #3)

- **No credential conflict:** web → session cookie; mobile-native → Bearer token; WebView →
  a session cookie *derived from the token*. The backend accepts both a session
  (`req.session.userId`) and a Bearer token (`checkClientCredentials` sets
  `req.session.userId`), so the two never collide.
- **Shared `AuthContext` split:** `packages/contexts/AuthContext.js` keeps its public shape
  and the shared `checkAuth`/`meCheckAuthQuery`/`isAuthorized` logic. The *login mechanism*
  is injected per app: web passes a session/mutation adapter, mobile passes a token
  adapter. (Implementation: an `authAdapter` prop on `AuthProvider`, or `*.native.js`
  resolution.)
- **Seamless handoff:** immediately before mounting `HyloWebView`, mobile calls
  `/noo/session/from-token` to mint a fresh cookie from the current access token, injects
  it with `CookieManager`, then loads. The web app in the WebView sees a valid session on
  first request → no login redirect/flash. The existing web→native `LOGOUT` postMessage
  remains the reverse channel.

---

## 3. Backend changes (do first — curl-testable, no device)

### 3.0 Spike first (de-risks the one uncertain piece)

Before building, write a throwaway script (`apps/backend/scripts/spike-mint-tokens.js`)
that calls the §3.2 helper for a test user and asserts:
1. the access token authenticates a GraphQL `me` query (via `checkClientCredentials`),
2. `POST /noo/oauth/token` with `grant_type=refresh_token` returns a new access token,
3. `POST /noo/oauth/token/revocation` revokes it.

This validates the `oidc-provider@7.11.3` token-construction API end-to-end. Everything
else depends on it, so it goes first.

### 3.1 Migration/seed: native OIDC client

Clients live in `oidc_payloads` (`type='Client'`) via `KnexAdapter`. Add idempotent
migration `apps/backend/migrations/<ts>_seed_native_oidc_client.js`:

```js
exports.up = async (knex) => {
  const id = 'hylo-mobile'
  const payload = {
    client_id: id,
    client_name: 'Hylo Mobile',
    application_type: 'native',
    grant_types: ['refresh_token'],          // initial issuance is bespoke; refresh is standard
    response_types: [],
    redirect_uris: [],                        // no browser flow
    token_endpoint_auth_method: 'none',       // public client
    scope: 'openid offline_access email profile api:read api:write'
  }
  await knex('oidc_payloads')
    .insert({ id, type: 'Client', payload })
    .onConflict(['id', 'type']).merge()
}
exports.down = (knex) =>
  knex('oidc_payloads').where({ id: 'hylo-mobile', type: 'Client' }).delete()
```

> Validate the exact stored Client payload shape against `oidc-provider@7` + `KnexAdapter`
> (snake_case keys) and against how existing API-partner clients are stored.

### 3.2 Token-minting helper

New `apps/backend/api/services/OIDCTokens.js` — the single token-issuance core used by
**both** the native-form endpoint and the social endpoints:

```js
import oidc from './OpenIDConnect'

export async function mintTokensForUser (user, { clientId = 'hylo-mobile' } = {}) {
  const client = await oidc.Client.find(clientId)
  if (!client) throw new Error('OIDC client not found: ' + clientId)

  const resource = process.env.PROTOCOL + '://' + process.env.DOMAIN
  const scope = 'openid offline_access email profile api:read api:write'

  const grant = new oidc.Grant({ accountId: String(user.id), clientId })
  grant.addOIDCScope('openid offline_access email profile')
  grant.addResourceScope(resource, 'api:read api:write')
  const grantId = await grant.save()

  const at = new oidc.AccessToken({ accountId: String(user.id), client, grantId, scope, resource })
  const access_token = await at.save()

  const rt = new oidc.RefreshToken({ accountId: String(user.id), client, grantId, scope })
  const refresh_token = await rt.save()

  return { access_token, refresh_token, token_type: 'Bearer', expires_in: 3600 }
}
```

> ⚠️ This is the spike target (§3.0). Confirm constructor fields / JWT-format wiring for
> v7.11. If brittle, the fallback is `provider.registerGrantType('password', …)` to issue
> through the provider's own `/token` machinery.

### 3.3 First-party native login endpoint

Add `nativeLogin` to `apps/backend/api/controllers/SessionController.js`:

```js
nativeLogin: async function (req, res) {
  try {
    const email = req.param('email') ? req.param('email').toLowerCase() : null
    const password = req.param('password')
    const user = await User.authenticate(email, password)   // existing, same as cookie login
    const tokens = await mintTokensForUser(user)
    return res.ok(tokens)
  } catch (err) {
    return res.status(422).send(err.message)
  }
}
```

Import the helper at the top: `import { mintTokensForUser } from '../services/OIDCTokens'`.

### 3.4 Bridge endpoint `POST /noo/session/from-token`

Also in `SessionController.js`. Validates the Bearer access token the same way
`checkClientCredentials.js` does, then creates a server session so the response carries a
`Set-Cookie` for the WebView:

```js
fromToken: async function (req, res) {
  try {
    const match = (req.headers.authorization || '').match(/^Bearer (.+)$/i)
    if (!match) return res.status(401).json({ error: 'Missing bearer token' })

    const accessToken = await (new OIDCAdapter('AccessToken')).find(match[1])
    const valid = accessToken && new Date(accessToken.exp * 1000) > Date.now()
    if (!valid) return res.status(401).json({ error: 'Invalid token' })

    const user = await User.find(accessToken.accountId)
    if (!user) return res.status(401).json({ error: 'Unknown user' })

    await UserSession.login(req, user, 'token')   // emits Set-Cookie
    return res.ok({ success: true })
  } catch (err) {
    return res.status(401).json({ error: err.message })
  }
}
```

Add `import OIDCAdapter from '../services/oidc/KnexAdapter'` at the top.

### 3.5 Social endpoints return tokens

`finishGoogleTokenOAuth` / `finishAppleOAuth` (and the `finishOAuth` `authCallback`) end in
a session via `upsertUser` today. Add a token-returning branch gated by an opt-in header so
the web flow is untouched:

```js
// after upsertUser(...) resolves to `user`
if (req.get('X-Hylo-Token-Auth') === '1') {
  const tokens = await mintTokensForUser(user)
  return res.ok(tokens)
}
return res.ok(user)   // existing behavior for web
```

### 3.6 Routes

`apps/backend/config/routes.js` (near the other `/noo/login`/`/noo/session` lines):

```js
'POST   /noo/login/native':                             'SessionController.nativeLogin',
'POST   /noo/session/from-token':                       'SessionController.fromToken',
```

### 3.7 Logout / revocation

Provider already routes `/noo/oauth/token/revocation` and `/noo/oauth/session/end`. No
backend change needed beyond allowing the `hylo-mobile` client to revoke.

### 3.8 Backend test checklist (curl, no device)

1. `curl -i -X POST http://localhost:3000/noo/login/native -d 'email=…&password=…'` →
   `{access_token, refresh_token}`.
2. `curl -i -X POST http://localhost:3000/noo/session/from-token -H 'Authorization: Bearer <at>'`
   → `200` + `Set-Cookie`; reuse cookie on a GraphQL `me` query → authenticated.
3. `curl -X POST http://localhost:3000/noo/oauth/token -d 'grant_type=refresh_token&client_id=hylo-mobile&refresh_token=<rt>'`
   → new access token.
4. Social: hit `finishGoogleTokenOAuth` with `X-Hylo-Token-Auth: 1` → token JSON.

---

## 4. Mobile changes (after backend verified)

### 4.1 Dependencies

`apps/mobile/package.json`: add `react-native-keychain` and `@urql/exchange-auth`.
**No** `react-native-app-auth`, **no** native URL-scheme changes. (`@react-native-cookies/cookies`
and `react-native-config` already present.)

### 4.2 Secure token store

New `apps/mobile/src/util/tokenStore.js` (replaces the AsyncStorage cookie as the native
credential):

```js
import * as Keychain from 'react-native-keychain'
const SERVICE = 'hylo.tokens'

export async function saveTokens (tokens) {
  await Keychain.setGenericPassword('tokens', JSON.stringify(tokens), { service: SERVICE })
}
export async function getTokens () {
  const creds = await Keychain.getGenericPassword({ service: SERVICE })
  return creds ? JSON.parse(creds.password) : null
}
export async function clearTokens () {
  await Keychain.resetGenericPassword({ service: SERVICE })
}
```

### 4.3 Auth API helpers

New `apps/mobile/src/util/authApi.js` — plain `fetch` to the new endpoints (no app-auth):

```js
import apiHost from 'util/apiHost'

export async function nativeLogin (email, password) {
  const res = await fetch(`${apiHost}/noo/login/native`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password })
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()                       // { access_token, refresh_token, ... }
}

export async function refreshTokens (refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token', client_id: 'hylo-mobile', refresh_token: refreshToken
  })
  const res = await fetch(`${apiHost}/noo/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  })
  if (!res.ok) throw new Error('refresh failed')
  return res.json()
}

export async function revokeToken (token) {
  const body = new URLSearchParams({ token, client_id: 'hylo-mobile' })
  await fetch(`${apiHost}/noo/oauth/token/revocation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  }).catch(() => {})
}
```

### 4.4 AuthContext login/logout (shared-package split)

`packages/contexts/AuthContext.js` keeps its shape; inject the login mechanism so web and
mobile don't conflict. Mobile adapter wiring:

```js
// mobile passes this adapter into <AuthProvider authAdapter={mobileTokenAdapter}>
const mobileTokenAdapter = {
  async login ({ email, password }) {
    const tokens = await nativeLogin(email, password)
    await saveTokens(tokens)
  },
  async logout () {
    const t = await getTokens()
    if (t?.refresh_token) await revokeToken(t.refresh_token)
    await clearTokens()
  }
}
// AuthContext.login = async (creds) => { await authAdapter.login(creds); await checkAuth() }
// AuthContext.logout = async () => { await authAdapter.logout(); await executeLogout(); await checkAuth() }
```

Web passes an adapter wrapping the existing `loginMutation`/`logoutMutation`, so its
behavior is unchanged. The login **screen** (`apps/mobile/src/screens/Login/Login.js`)
keeps calling `useAuth().login({ email, password })` — identical UX.

### 4.5 URQL Bearer + refresh-on-401

Replace the `setSessionCookie` `fetch` side-effect in `packages/urql/makeUrqlClient.js`
(lines 58–69) with `@urql/exchange-auth`:

```js
import { authExchange } from '@urql/exchange-auth'
import { getTokens, saveTokens } from 'util/tokenStore'
import { refreshTokens } from 'util/authApi'

const auth = authExchange(async (utils) => {
  let tokens = await getTokens()
  return {
    addAuthToOperation (op) {
      return tokens?.access_token
        ? utils.appendHeaders(op, { Authorization: `Bearer ${tokens.access_token}` })
        : op
    },
    didAuthError: (err) => err.response?.status === 401,
    async refreshAuth () {
      const refreshed = await refreshTokens(tokens.refresh_token)
      tokens = { ...tokens, ...refreshed }
      await saveTokens(tokens)
    }
  }
})
// exchanges: [devtoolsExchange, cache, auth, fetchExchange, subscriptionExchange]
```

Remove the custom cookie-capturing `fetch`.

### 4.6 fetchJSON

`apps/mobile/src/util/fetchJSON.js`: drop `setSessionCookie(response)` (line 28); attach
`Authorization: Bearer` from `getTokens()`.

### 4.7 Social handlers

`apps/mobile/src/components/SocialAuth/*`: add header `X-Hylo-Token-Auth: 1` to the
`/noo/login/*-token/oauth` and `/noo/login/apple/oauth` calls; on success `saveTokens(...)`
then `checkAuth()`. Native Google/Apple SDK code unchanged.

### 4.8 WebView session derivation (seamless handoff)

`apps/mobile/src/components/HyloWebView/HyloWebView.js` + `apps/mobile/src/util/session.js`:
- Before load, `POST /noo/session/from-token` with the Bearer token, capture `Set-Cookie`,
  and `CookieManager.set(...)` it (replace `ensureWebViewCookies`).
- Keep `source.headers.cookie` for one release as belt-and-suspenders, then remove.
- Once stable, delete `parseCookies`/`serializeCookie`/`invalidPair` and the
  `hylo_session_cookie` AsyncStorage key.

### 4.9 Logout cleanup

`apps/mobile/src/hooks/useLogout.js`: replace `clearSessionCookie()` with `clearTokens()` +
`CookieManager.clearAll()` + best-effort `revokeToken()`. Keep OneSignal/Intercom/Mixpanel/
Google cleanup and the web→native `LOGOUT` postMessage path.

### 4.10 Config / env

`apps/mobile/.env`: nothing new strictly required (endpoints derive from `API_HOST`). The
backend `DOMAIN` must equal the host the device hits (Android: `http://localhost:3000` via
`adb reverse`).

---

## 5. Coexistence & rollout

- Gate the mobile path behind `FEATURE_FLAG_TOKEN_AUTH`. With it off, the app behaves
  exactly as today.
- All backend additions are additive (new endpoints + token minting); the existing cookie
  login, GraphQL session model, web app, and API-partner OIDC clients are untouched.
- Rollout: internal builds with the flag on → dogfood → staged enable → later cleanup that
  removes the cookie-capture code once token auth is default.

## 6. Testing plan

**Backend:** §3.0 spike, then §3.8 curl checklist.

**Mobile (Android via `yarn android` + `adb reverse`, `DOMAIN=localhost:3000`):**
1. Email/password on the **existing native form** → tokens in Keychain → `me`
   authenticated → WebView loads authenticated with no login flash.
2. Kill app / clear AsyncStorage → relaunch → silent refresh from Keychain → still logged
   in, WebView still authenticated (proves the desync class is gone).
3. Force-expire the access token → next GraphQL call refreshes transparently.
4. Logout → tokens cleared + revoked, WebView cookie cleared, web→native LOGOUT works.
5. Google (emulator + real client ID) → tokens → authenticated.
6. Apple → real device + https + Apple Developer config (expected local limitation).

**Regression:** web login + the WebView in a real browser unaffected; mobile with flag off
unchanged.

## 7. File change checklist

**Backend**
- `apps/backend/scripts/spike-mint-tokens.js` (spike, throwaway)
- `apps/backend/migrations/<ts>_seed_native_oidc_client.js` (new)
- `apps/backend/api/services/OIDCTokens.js` (new)
- `apps/backend/api/controllers/SessionController.js` (+`nativeLogin`, `fromToken`, social branch, imports)
- `apps/backend/config/routes.js` (+`/noo/login/native`, +`/noo/session/from-token`)

**Mobile / shared**
- `apps/mobile/package.json` (+`react-native-keychain`, `@urql/exchange-auth`)
- `apps/mobile/src/util/tokenStore.js` (new)
- `apps/mobile/src/util/authApi.js` (new)
- `packages/contexts/AuthContext.js` (injected `authAdapter`; web + mobile adapters)
- `packages/urql/makeUrqlClient.js` (authExchange, remove cookie capture)
- `apps/mobile/src/util/fetchJSON.js` (Bearer, remove cookie capture)
- `apps/mobile/src/components/SocialAuth/*` (token-auth header + saveTokens)
- `apps/mobile/src/components/HyloWebView/HyloWebView.js` + `src/util/session.js` (bridge-derived cookie)
- `apps/mobile/src/hooks/useLogout.js` (clearTokens + revoke)

## 8. Open questions / risks

1. **`oidc-provider@7` token construction (§3.2/§3.0):** the highest-risk piece; the spike
   resolves it before anything else is built.
2. **ROPC-style first-party login.** `POST /noo/login/native` accepts the password
   directly. Acceptable because it's first-party (your own UI), but it must be tightly
   scoped to the `hylo-mobile` client and rate-limited; reuse the same throttling as the
   existing `/noo/login`.
3. **`AuthContext` shared with web** — finalize the adapter-injection split so web keeps
   `loginMutation` and mobile uses the token adapter with zero behavioral change for web.
4. **iOS WKWebView cookie acceptance** for the bridge-derived cookie (`SameSite=None`
   needs https off-localhost) — verify on a tunnel build.
5. **Refresh-token rotation/reuse detection** (provider TODO) — enable now or Phase 2?

## 9. Deferred alternative (not Phase 1)

Browser-based authorization-code + PKCE via `react-native-app-auth` (system browser),
which would give Pattern-2 SSO with the WebView for free. Rejected for Phase 1 because it
changes the email/password UX away from the native form. Revisit in Phase 2 alongside
making the web app an OIDC client.
