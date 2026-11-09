# 24 — Integrations, API & embeds

This module covers how Hylo talks to other systems and the platform-level tools around it:

- the OAuth 2.0 / OpenID Connect provider and the partner API;
- server-to-server API clients;
- Zapier webhooks;
- Slack and Murmurations;
- iframes and the public, embeddable routes;
- calendar feeds;
- data export and import;
- analytics and cookie consent;
- platform admin ("Management") tools: site banners, commons listing requests, email-enabled testers, Stripe analytics, kue;
- feature flags;
- outbound URL fetching (`safeFetch`);
- the browser sandbox/demo and demo-group seeding.

Infrastructure (env vars, servers, queues) is in [01-architecture.md](01-architecture.md). The GraphQL surface is in [03-graphql-api.md](03-graphql-api.md). Paid-content admin tools are in [23-paid-content-stripe.md](23-paid-content-stripe.md).

---

## 1. OAuth 2.0 / OpenID Connect provider

### 1.1 Overview
Hylo is an OIDC identity provider. It uses the `oidc-provider` library, mounted at **`/noo/oauth`**, with issuer `<PROTOCOL>://<DOMAIN>`. It serves three kinds of client:

- **Third-party partner apps** using the Authorization Code flow with PKCE. They log a user in "with Hylo" and call the GraphQL API as that user.
- **Server-to-server partners** using Client Credentials. They get a JWT and a restricted GraphQL API.
- **The first-party mobile app** (`hylo-mobile`). It gets tokens minted directly by login endpoints and refreshes them through the standard token endpoint.

Partner clients are created **manually by Hylo staff** (no self-service registration UI). The public docs say to email hello@hylo.com.

### 1.2 Configuration (`api/services/OpenIDConnect.js`)
| Setting | Value |
|---|---|
| Scopes | `openid`, `offline_access`, `address`, `email`, `phone`, `profile`, `api:read`, `api:write` |
| Claims per scope | `openid`→`sub`; `address`→`address`; `email`→`email`, `email_verified`; `phone`→`phone_number`; `profile`→`name`, `picture`, `updated_at`, `website` |
| `findAccount` | `User.find(id)`; `accountId = user id`. `sub` = Hylo user id. |
| `conformIdTokenClaims` | false (claims are included in the ID token) |
| Features | `clientCredentials` on, `introspection` on, `resourceIndicators` on, `devInteractions` off |
| Resource indicators | Default resource `<PROTOCOL>://<DOMAIN>`. Resource server scope = `api:read`, plus `api:write` if the client's `role` includes `super`. Access token format **JWT**, `RS256`, TTL **2 h**, audience = resource. |
| PKCE | Required unless the client metadata has `noPKCE: true` |
| CORS | `clientBasedCORS` → always true |
| Cookies | Signed with `COOKIE_SECRET`; domain `.hylo.com` (or `localhost` in dev); long cookie `sameSite: none`, short cookie `lax`; httpOnly |
| Keys | `OIDC_KEYS`: comma-separated base64 PEM RSA private keys, converted to JWKs |
| `proxy` | true |
| Extra client metadata | `email`, `invite_subject`, `invite_message`, `name`, `role` (`'super'` = privileged), `noPKCE` |
| Storage | `KnexAdapter` → table `oidc_payloads` (`id`, `type`, `payload` jsonb, expiry). The daily cron runs `OIDCAdapter.cleanupExpired()`. |

Token lifetimes:

| Artefact | TTL |
|---|---|
| AccessToken | resource server TTL (2 h), else 1 h |
| AuthorizationCode | 10 min |
| ClientCredentials | resource TTL (2 h), else 10 min |
| DeviceCode / BackchannelAuthenticationRequest | 10 min |
| Grant | 14 days |
| IdToken | 1 h |
| Interaction | 1 h |
| RefreshToken | 180 days. Public web clients with rotation keep the remaining TTL. |
| Session | 14 days |

Endpoints (all under `/noo/oauth`):

| Path | Purpose |
|---|---|
| `/.well-known/openid-configuration` | Discovery. Also reachable at the root `/.well-known/openid-configuration`, which redirects to `/noo/oauth/...`. |
| `/auth` | Authorization |
| `/token` | Token: `authorization_code`, `refresh_token`, `client_credentials` |
| `/me` | UserInfo |
| `/jwks` | JWKS |
| `/token/introspection` | Introspection |
| `/token/revocation` | Revocation |
| `/session/end` | End session |
| `/reg` | Registration (route defined; dynamic registration is not enabled) |
| `/request`, `/device`, `/device/auth`, `/backchannel` | Route names configured; the corresponding features are off |

### 1.3 Interaction flow (login + consent)
`oidc-provider` sends interactions to `/noo/oidc/interaction/:uid`. A Sails hook (`api/hooks/oidcRoutes.js`) handles them:

1. **`GET /noo/oidc/interaction/:uid`**
   - Prompt `login` → redirect to web `/oauth/login/<uid>?name=<client name>`.
   - Otherwise → `/oauth/consent/<uid>?name=<client name>`, plus `&missingScopes=<scope>` repeated for each missing OIDC scope.
2. **`POST /noo/oidc/:uid/login`** (body `email`, `password`)
   - Requires prompt `login`, else 403 `{error:'Invalid request, please start over'}`.
   - Uses the existing Hylo session user if present; otherwise `authenticateWithRateLimit(req, email, password)` (login rate limiter, see 04).
   - Completes the interaction with `{login:{accountId}}`.
   - Returns `{redirectTo}`. The URL is rewritten to `<PROTOCOL>://<DOMAIN>`, forced to https in production, and `?name=<client>` is appended.
   - Errors → 403 `{error: message}`.
3. **`POST /noo/oidc/:uid/confirm`**
   - Requires prompt `consent`, else 500 `{error:'Invalid Request'}`.
   - Creates or loads a Grant and adds **all** missing OIDC scopes, claims and resource scopes. There is no partial approval.
   - Returns `{redirectTo}`.
4. **`POST /noo/oidc/:uid/abort`** → `{error:'access_denied', error_description:'End-User aborted interaction'}` → `{redirectTo}` back to the client.

### 1.4 Web UI (`routes/OAuth`, rendered for both logged-in and logged-out visitors at `/oauth/*`)
Layout (`OAuthLayoutRouter`):

- Hylo logo (alt "Hylo logo").
- Locale dropdown "Locale: <code> <name>".
- Centred card, max-width 320px.
- Below the card:
  - login route: "Use your Hylo account to access {{name}}."
  - consent route: "Make sure you trust {{name}} with your information."

  `{{name}}` comes from the `?name=` query param, falling back to "this application".
- Footer links "Terms of Service" (`https://hylo.com/terms/`) and "Privacy Policy" (`https://hylo.com/privacy`).

**Login (`/oauth/login/:uid`)**

- If already logged in, the screen shows "Already logged in, redirecting..." and auto-posts the login.
- Otherwise:
  - Title "Sign in to Hylo".
  - Email and password fields.
  - "Forgot password?" link.
  - "Sign in" button.
  - Google button. It does social login, then continues the interaction.
- Posts to `/noo/oidc/<uid>/login`, then sets `window.location` to `redirectTo`.

**Consent (`/oauth/consent/:uid`)**

- Title: "{{appName}} wants access to your Hylo account".
- `openid` and `offline_access` are removed from the displayed scope list.
- If nothing new is requested: "{{appName}} is asking you to confirm previously given authorization".
- Otherwise "This will allow {{appName}} to:" with one bullet per scope:
  - `profile` → "Access your profile, including your name and image."
  - `address` → "Access to your physical address."
  - `email` → "Access to your email address."
  - `phone` → "Access to your phone number."
  - any other scope → the raw scope name.
- "Claims:" list (missing claims), shown when present.
- Per-resource headings listing the resource scopes (e.g. `api:read`).
- If `offline_access` was requested: "{{appName}} is asking to have offline access to Hylo".
- Buttons: "Cancel" (outline → abort) and "Allow" (secondary → confirm).
- A failure is only logged to the console: "Something weird happened during consent process".

### 1.5 Using tokens against the API
`checkClientCredentials` runs on `/noo/graphql` and inspects `Authorization: Bearer <token>`:

| Token kind | Detection | Rule | Effect |
|---|---|---|---|
| **JWT** (client credentials) | `decodeHyloJWT` succeeds | The client must exist with `role === 'super'`, else `403 {error:'Unauthorized'}` | `req.api_client = {id, name, scope, super:true}`. No user session. |
| **Opaque access token** (authorization code, or mobile-minted) | Not a JWT; looked up as `AccessToken` in `oidc_payloads` | Must be unexpired and its client must exist, else 401 / 403 | `req.api_client = {id, name, scope}` and **`req.session.userId = accountId`**. The token user wins over any cookie user. The cookie session is not persisted (`keepOutOfCookieSession`). |
| none | | | Normal cookie session |

Scopes are **not enforced** after authentication (`TODO` in the code). An authorization-code token gives the **full authenticated GraphQL API** as that user, regardless of `api:read` / `api:write`. That matches the docs' claim of "full API access".

The legacy header `x-access-token` / param `access_token` is handled by `AccessTokenAuth.checkAndSetAuthenticated`: a lookup in `linked_account` with `provider_key='token'`, which logs the user in for that request. It is marked "remove once all our URLs use JWTs". Tokens are generated as 24 random bytes in hex.

### 1.6 Server-to-server (super client) API
When `req.api_client` is set and there is no user, the GraphQL schema exposes **only**:

- **Queries**
  - `group(id|slug)` — any group, no visibility filter.
  - `groups(...)`.
  - `person(id|email)` — lookup by email is allowed.
- **Mutations**
  - `addMember(userId, groupId, assignAdministrator)`.
  - `createGroup(asUserId, data)` — creates the group as the given user, including farm `extensions`.
  - `updateGroup(asUserId, id, changes)`.
- **Subscriptions** — present, but self-guard on auth.

**REST `POST /noo/user`** (`UserController.create`) requires `req.api_client.super`, else `403 {error:'Unauthorized'}`. Params: `name`, `email`, `groupId?`, `isAdministrator?` / `isCoordinator?` (truthy assigns the Administrator role).

- **Existing user, group given, not a member**: creates an invitation. The inviter is the first steward. Subject and message come from the client's `invite_subject` / `invite_message`, falling back to localised defaults (`clientInviteSubjectDefault(groupName)`, `clientInviteMessageDefault({userName, groupName})`). Returns `{message:"User already exists, invite sent to group <name>"}`.
- **Existing user, already a member**: `{message:'User already exists, and is already a member of this group'}`.
- **Existing user, no group**: `{message:'User already exists'}`.
- **New user**: `User.create({name, email (lower-cased), email_validated:false, active:false, group, assignAdministrator?})`. Queues `Email.sendFinishRegistration` {`api_client` name, `group_name`, `group_avatar_url`, `group_url`, `verify_url` (verify-email link with a user JWT)}. Returns `{id, name, email}`.
- **Errors**: 422 `{error}`.

### 1.7 First-party mobile client
- The migration `20260604120000_seed_native_oidc_client` seeds client `hylo-mobile`:
  - `client_name` "Hylo Mobile"; `application_type` native; `grant_types: ['refresh_token']`;
  - no redirect URIs; `token_endpoint_auth_method: none`;
  - `scope: 'openid offline_access email profile api:read api:write'`.
- `OIDCTokens.mintTokensForUser(user)`:
  - Creates a Grant with scope `openid offline_access email profile`.
  - Mints an opaque AccessToken (1 h) and a RefreshToken (180 d).
  - Returns `{access_token, refresh_token, token_type:'Bearer', expires_in}`.
- Used by `POST /noo/login/native` and the social native endpoints (see [04-accounts-auth-onboarding.md](04-accounts-auth-onboarding.md) and [25-mobile-desktop.md](25-mobile-desktop.md)).
- Refresh uses `/noo/oauth/token` with `grant_type=refresh_token`; revoke uses `/noo/oauth/token/revocation`.

### 1.8 Hylo JWTs (non-OIDC)
`lib/HyloJWT.js` signs and decodes Hylo's own JWTs. They are used for:

- email verification and finish-registration links;
- notification-settings links (`GET /noo/user/notification-settings?token=`);
- `/noo/login/jwt`.

`checkClientCredentials` tries `decodeHyloJWT` first, so OIDC client-credentials JWTs must verify against the same keys. Details are in 01 and 04.

---

## 2. Zapier

### 2.1 Overview
Hylo has a **private Zapier app** (invite link in the GitBook guide), maintained outside this repo.

- Polling triggers ("Fetch Groups / Members / Posts") and **actions** ("Create Post", "Invite to Group", "Find a Person", …) call the normal GraphQL API with the user's OAuth token.
- Four **instant triggers** use REST-hook subscriptions stored in Hylo.

### 2.2 Data
| Table | Column | Notes |
|---|---|---|
| `zapier_triggers` | `id` | |
| | `user_id` | Subscriber |
| | `target_url` | Zapier hook URL |
| | `type` | Trigger type |
| | `params` (jsonb) | e.g. `{types: ['event','offer']}` for `new_post` |
| | `is_active` (bool) | |
| | timestamps | |
| `zapier_triggers_groups` | `zapier_trigger_id`, `group_id` | Groups the trigger watches |

GraphQL type `ZapierTrigger { id, groupId, targetUrl, type, params, … }`.

### 2.3 API
- **`createZapierTrigger(groupIds: [ID], targetUrl: String, type: String, params: JSON): ZapierTrigger`**
  - `targetUrl` must pass `assertPublicUrl` (http/https, not a private IP literal). Otherwise the error is the assert message, e.g. "Refusing to fetch a private address: …".
  - The trigger is linked only to the groups among `groupIds` that the caller has a membership row in. If none match: "You don't have access to any of these groups". Membership activity is not checked.
  - Runs in a transaction.
- **`deleteZapierTrigger(id): Boolean`** deletes the trigger and its group links. **Quirk:** the code queries `where({ id, userId })`; the column is `user_id`, so this likely errors or matches nothing. It always returns `true` when no exception is thrown.

### 2.4 Instant triggers and payloads
Each trigger fires as a background job. The server POSTs JSON (`Content-Type: application/json`) via `safeFetch` to every active trigger of that type linked to the relevant group(s). Responses are ignored; there is no retry, signature or auth header.

| `type` | Fired from | Payload |
|---|---|---|
| `new_member` | `Group.afterAddMembers` (new and reactivated members) | **Array**, one object per member: `{id, avatarUrl, bio, contactEmail, contactPhone, facebookUrl, linkedinUrl, location, name, profileUrl, tagline, twitterName, url, reactivated, group:{id,name,url}}` |
| `member_leaves` | `User.afterLeaveGroup` (leave or removal) | `{id, name, group:{id,name,url}, removedByModerator}` |
| `member_updated` | `User.afterUpdate`, once per group the user belongs to | `{id, profileUrl, ...changes}` (the raw changed fields) |
| `new_post` | `Post.zapierTriggers` job after post creation (skips notice-type posts) | `{id, announcement, createdAt, creator:{name,url}, details, endTime, isPublic, location, startTime, timezone, title, type, url, groups:[{id,name,url,postUrl}], topics:[{name}]}`. Filtered by `params.types` if non-empty. |

---

## 3. Other outbound integrations

### 3.1 `safeFetch` (SSRF-safe fetch, `lib/safeFetch.js`)
Used for every user-supplied URL: Zapier hooks, link previews (see [13-posts-comments.md](13-posts-comments.md)) and remote uploads.

- Only `http:` and `https:` are allowed.
- IP literals are rejected if they fall in any blocked range:
  - IPv4: `0/8`, `10/8`, `100.64/10`, `127/8`, `169.254/16`, `172.16/12`, `192.0.0/24`, `192.0.2/24`, `192.168/16`, `198.18/15`, `198.51.100/24`, `203.0.113/24`, `224/4`, `240/4`;
  - IPv6: `::`, `::1`, `64:ff9b::/96`, `fc00::/7`, `fe80::/10`, `ff00::/8`.
- Hostnames are checked at connect time by a custom DNS `lookup` (error code `EPRIVATEADDRESS`).
- Redirects are followed manually (max 5), each one re-validated.
- Errors: "Invalid URL: …", "Only http and https URLs can be fetched: …", "Refusing to fetch a private address: …".

### 3.2 Slack (legacy)
- Groups may have `slack_hook_url` (GraphQL input field `slackHookUrl`).
- After a non-silent post is created, the `Post.notifySlack` job calls `Group.notifySlack` for each group with a hook. It posts `{text}` to the hook:
  - Normal post: `"<profileUrl|Name> posted <postUrl|summary> in <groupUrl|Group>"`.
  - Welcome post: `"<profile|Name> joined <group|Group>"`.
- Disabled when the env var `DISABLE_SLACK_INTEGRATION` is set.
- No current web UI sets the hook (API only).

### 3.3 Murmurations
- `GET /noo/group/:groupSlug/murmurations` returns the group's Murmurations profile JSON (`group.toMurmurationsObject()`) when `group.hasMurmurationsProfile()`, else 403.
- The job `Group.publishToMurmurations` publishes profiles to the Murmurations index. It is used for farm and other public groups; details are in [09-groups.md](09-groups.md).

### 3.4 Group extensions (farm data)
- Tables:
  - `extensions(id, type, …, created_at)`. `Extension.find(idOrType)` accepts an id or a type string.
  - `group_extensions(group_id, extension_id, data jsonb, active, created_at)`.
- GraphQL:
  - `groupExtension(id)` and `groupExtensions(extensionIds, groupIds)` queries.
  - `Group.groupExtensions`.
  - Group input `extensions` (e.g. a `farm_onboarding` / farm schema blob), as shown in the API docs' createGroup example.
- `groups(farmQuery: JSON)` filters farm groups, excluding those with `settings.hideExtensionData`.
- Used by farm widgets; see [09-groups.md](09-groups.md).

---

## 4. Embeds, iframes & public routes

### 4.1 Public (no-login) routes (`RootRouter`, unauthenticated branch)
| Route | Shows |
|---|---|
| `/public/*` → `PublicLayoutRouter` | `/public/map/*` (MapExplorer, with post/group detail drawers 420px wide); `/public/groups/*` (Group Explorer); `/public/all`, `/public/projects`, `/public/proposals`, `/public/events`, `/public/topics`, `/public/topics/:topicName`, `/public/post/:postId/edit/*`; `/public/stream` → `/public/all`; anything else → `/public/all` |
| `/post/:postId/*` | `PublicPostDetail` (public posts). Many legacy context URLs (`/all/post/:id`, `/groups/:slug/:view/post/:id`, …) redirect to `/post/:id`. |
| `/members/:personId/*`, `/all/members/:personId/*` | `PublicMemberProfile` (only for users with `is_profile_public`, see 20) |
| `/groups/:slug/join/:accessCode/*`, `/invite/:accessCode/*`, `/view/:accessCode/*` | `JoinGroup` (see 10) |
| `/groups/:slug/offerings/:offeringId` | Offering page (see 23) |
| `/groups/:slug/*` | `PublicGroupDetail`: about/join for public groups |
| `/oauth/*` | OAuth screens (also when logged in) |
| `/sandbox/*` | Demo (§8) |
| `/` | → `/login` |

### 4.2 iframe-relevant behaviour
- **No `X-Frame-Options` or `frame-ancestors` restriction** is set in the repo, so any page can be framed. (Hosting-layer headers may differ; see 01.)
- **Iframe detection** (`window.self !== window.top`):
  - The cookie-consent banner is skipped (§6.2).
  - Before login actions, Safari calls `document.requestStorageAccess()` (`checkForStorageAccess` in the NonAuth layout) so the third-party session cookie can be set.
- **Query params honoured:**

  | Param | Values | Effect |
  |---|---|---|
  | `layoutFlags` | comma list; only `hideNav` is whitelisted | Sets `hideNavLayout` (persists until reload). The map explorer, map drawer and chat room then render without the nav chrome. |
  | Map `group` | slug(s) | e.g. `/public/map?group=<slug>` filters the map to those groups |
  | Map `hideDrawer=true` | | Starts with the drawer hidden |
  | Map `center=<lat>,<lng>`, `zoom=<n>`, `style=<baseStyle>` | | Initial viewport and base layer |
  | Map `search`, `sortBy`, `hide`, `topics`, `c` (child-post inclusion), `t` | | Map filters (see 16) |
  | Offering success `spaceSlug` | | See 23 |
- The legacy `?layout=` param is **not** read anywhere in the web code.

### 4.3 Mobile WebView
`util/webView.js` detects `window.ReactNativeWebView`. `isLegacyWebView` means the WebView without `window.HyloMobileV2`.

- Messages are posted to native as `{type, data}`. Types (`WebViewMessageTypes`): `JOINED_GROUP`, `LEFT_GROUP`, `GROUP_DELETED`, `LOGOUT`, `VERIFY_AUTH`, `AUTH_SUCCESS`, `SESSION_READY`, `NAVIGATION`, …
- Cookie consent is skipped in WebViews.
- See [25-mobile-desktop.md](25-mobile-desktop.md).

### 4.4 Calendar feeds
iCal (`.ics`) feeds are generated as **static files** uploaded to storage:

- group: `<UPLOADER_PATH_PREFIX>/group/<id>/calendar-<calendar_token>.ics`, exposed as `Group.eventCalendarUrl`;
- user RSVP calendar: `User.createRsvpCalendarSubscription`, using a per-user `calendar_token`.

The behaviour, regeneration and UI are in [14-events-proposals-projects.md](14-events-proposals-projects.md).

---

## 5. Data export & import

### 5.1 Group member export
- `GET /noo/export/group?groupId=<id>&datasets[]=members`.
- Requires `Administration` in the group, else 403 `{error:'No access'}`.
- Missing params → 400: "Please specify group ID" / "Please specify datasets to export".
- Only the `members` dataset exists. Any other value throws "Unknown datasets specified: …".
- The response is immediately `200 {}`. The job `ExportService.exportMembers` builds a CSV and emails it to the requester (`sendExportMembersList`) as an attachment named `members-export-<groupName>-<YYYY-MM-DD>.csv`.
- CSV columns:
  - `id`, `name`, `joined_at`, `roles`, `contact_email`, `contact_phone`;
  - `location` ("full text (lat,lng)" to 3 decimals);
  - `avatar_url`, `tagline`, `bio`, `personal_url`, `twitter_name`, `facebook_url`, `linkedin_url`;
  - `skills`, `skills_to_learn`;
  - `affiliations` ("role preposition org (url)");
  - `groups` (other groups visible to the requester, "Name (url)");
  - `last_active_at`;
  - plus **one column per join question** (header = question text, value = that member's answer).
  - Multi-valued cells are comma-joined.
- UI: Group Settings → Import/Export (see [11-group-settings.md](11-group-settings.md)).

### 5.2 Personal account export
- `POST /noo/export/user-account` (logged in, else 401). Response: `{message:"Account export started. You will receive an email when it's ready."}`.
- The job emails `sendExportUserAccount` with a JSON attachment `user-account-export-<name>-<date>.json` containing:
  - `user`: profile fields plus `location {full_text, center, country, city, region, postcode}`;
  - `posts[]`: `{id, name, description, type, is_public, created_at, updated_at, media[], tags[]}`, active posts only;
  - `comments[]`: `{id, text, created_at, updated_at, post{id,name,type}, media[]}`;
  - `group_memberships[]`: `{group_id, group_name, group_slug, roles[], created_at, settings}`;
  - `export_date`.
- UI is in User Settings → Account (see [05-user-settings.md](05-user-settings.md)).

### 5.3 User import (developer-only)
`api/services/UserImport.js` can bulk-create users from a CSV or JSON source (url, filename or stream) with column `headers` and an optional converter, adding them to a group. It has **no route, mutation or UI** and is used only from the console or scripts.

Demo groups are seeded with the backend CLI (§8.2).

---

## 6. Analytics & cookie consent

### 6.1 Analytics
- **Mixpanel**
  - Server (`lib/mixpanel.js`): active when `MIXPANEL_TOKEN` is set and not in test; otherwise a no-op stub.
  - `mixpanel.people.set(userId)` runs on every authenticated GraphQL request.
  - Server events use `mixpanel.track(AnalyticsEvents.X, {distinct_id, …, groupId…})` from models and mutations.
- **Web**: `mixpanelMiddleware` tracks any Redux action whose `meta.analytics` is:
  - `true`: event name = action type;
  - a string: the event name;
  - an object `{eventName, …props}`.

  It skips `_PENDING` actions and errors, and skips everything when the cookie consent has `analytics === false`. Logged-in users are `identify`-ed by user id.
- **Event names** (`@hylo/shared` `AnalyticsEvents`, server and web):

  | Area | Events |
  |---|---|
  | Moderation | 'User Blocked', 'User Un-Blocked' |
  | Comments & messages | 'Comment Created', 'Reacted to Comment', 'Direct Message Sent' |
  | Events | 'Event RSVP' |
  | Groups | 'Group Created', 'Group Invitation Accepted', 'Group New Member Joined', 'Group Welcome Completed', 'Group Welcome Page Viewed', 'Public Group Viewed', 'Invite Link Opened' |
  | Posts | 'Post Created', 'Post Opened', 'Reacted to Post', 'Post Shared', 'Post Updated', 'Reaction Removed', 'Topic Created' |
  | Signup | 'Email Verification Sent', 'Email Verified', 'Email Verification Failed', 'Registered', 'Signup Complete', 'Signup Agreements Accepted', 'Login Wall Hit' |
  | Tracks | 'Track Created', 'Track Completed', 'Track Enrolled', 'Track Left', 'Track Published' |
  | Join requests | 'Join Request Approved', 'Join Request Canceled', 'Join Request Created', 'Join Request Declined' |
  | Welcome wizard | 'Welcome Wizard Step Skipped', 'Welcome Wizard Step Viewed' |
- **Segment** (`api/services/Analytics.js`, `SEGMENT_KEY`; no-op in test or with `DISABLE_SEGMENT=1`):
  - `track`.
  - `trackSignup(userId, req)` → event 'Signup success' with `platform` = Web / ios / android, from the `ios-version` / `android-version` headers.
  - `pixelUrl(emailName, props)` → email open pixel `https://api.segment.io/v1/pixel/track?data=<base64>` with event `Viewed Email: <name>`.
- **Intercom**: in-app support chat, gated by the cookie consent `support`.

### 6.2 Cookie consent
- **Cookie**: `hylo_cookie_consent` holds a JSON value `{id (uuid), analytics:bool, support:bool, isLinkedToUser:bool, lastUpdated, …}`, with `path=/`, `max-age=31536000` (1 year) and `SameSite=Lax`.
- **Skipped** (treated as consented) in sandbox mode, in iframes and in mobile WebViews.
- **Panel** (`CookiePreferencesPanel`):
  - Title "Cookie Preferences".
  - Intro: "We use essential cookies to help understand whether you are logged in and to understand your preferences and where you are in Hylo."
  - Switches (both default on):
    - "Analytics (Mixpanel)", explained: "We use a service called Mixpanel to understand how people like you use Hylo. Your identity is anonymized but your behavior is recorded so that we can make improvements to Hylo based on how people are using it."
    - "Support (Intercom)", explained: "When people on Hylo need help or want to report a bug, they are interacting with a service called Intercom. Intercom stores cookies in your browser to keep track of conversations with us, the development team."
  - Buttons "Reject Non-Essential" (both off) and "Save and Continue".
  - `CookieConsentLinker` links a stored consent to a user after login.
- **Server**:
  - `POST /noo/cookie-consent`, unauthenticated, body `{consent_id?, settings, version, ip_address, user_agent, user_id?}`.
  - Validation: `settings` is required ("Missing settings") and must be an object ("Settings must be a valid JSON object"). `consent_id`, if present, must be a UUID ("Invalid consentId format - must be a valid UUID").
  - Upserts the `CookieConsent` row (`consent_id`, `settings`, `version`, `ip_address`, `user_agent`, `user_id`) via `CookieConsentService.upsert`.

---

## 7. Platform administration ("Management")

### 7.1 Who is an admin
- `Admin.isSignedIn(req)` / `isSuperAdmin(userId)`: the user id is in the env list **`HYLO_ADMINS`** (comma-separated ids; never by email).
- `isTestAdmin`: in `HYLO_TESTER_IDS` or `HYLO_ADMINS`.
- `Me.isAdmin` drives the web avatar-menu item "Management" (Wrench icon), shown after a separator, which opens `/management`.
- Legacy admin login: `GET /noo/admin/login` (passport `admin` strategy, Google OAuth), callback `/noo/admin/login/oauth` → redirect to `/noo/admin/kue`; logout `/noo/admin/logout`.

### 7.2 Backend admin endpoints
| Endpoint | Purpose |
|---|---|
| `/noo/admin/kue` (UI), `/noo/admin/kue/api` | kue job-queue dashboard (`kue-ui`), guarded by `isAdmin` |
| `GET /noo/admin/raw-metrics` | Last 3 months of user, post and comment creation events per group: `{groupId: {id, name, created_at, avatar_url, events:[{time, user_id, name:'user'|'post'|'comment'}]}, none:{…}}`. Welcome posts and Axolotl posts are excluded. |
| `GET /noo/admin/login-as/:userId` | Impersonate a user (`UserSession.login(req, user, 'admin')`), then redirect to `/app` |
| `GET /noo/admin/stripe-analytics`, `POST /noo/admin/stripe-sales-pause` | See 23 §4.12 and §5.11 |

### 7.3 Management web UI (`/management/*`)
- Left context menu headed "Management", with sections:
  - SITE: "Banners" (`site/banners`), "Commons Requests" (`site/commons-requests`).
  - STAGING: "Email Testers" (`staging/email-testers`, the default route).
  - PAID CONTENT: "Stripe Analytics" (`paid-content/stripe-analytics`).
- Strings are English-only.

**Site banners** (site-wide announcements)

- **Data**:
  - `site_banners(id, title, text, type ∈ info|warning|alert (invalid → info), action_text, action_url, created_by_id, published_at, unpublished_at, show_to_new_users bool default false, timestamps)`.
  - `site_banners_users(site_banner_id, user_id, dismissed_at)`, unique per pair.
- **Mutations** (all superadmin only, error "Unauthorized: Admin access required"):
  - `createSiteBanner(data: SiteBannerInput)`.
  - `updateSiteBanner(id, data)`.
  - `publishSiteBanner(id)`: sets `published_at=now`, `unpublished_at=null`.
  - `unpublishSiteBanner(id)`: sets `unpublished_at=now`.
  - `deleteSiteBanner(id)`: only if never published, else "Cannot delete a banner that has already been published; take it down instead".
- **Dismissal**: `dismissSiteBanner(id)` is open to any logged-in user ("You must be logged in to dismiss a banner").
- **Validation**:
  - `actionText` and `actionUrl` must be set together ("Action Button Text and Action Button URL must be set together").
  - The URL is normalised: a bare host gets `https://`; root-relative paths are allowed; only http(s) ("Action Button URL is not valid", "Action Button URL must be a web address").
- **Queries**:
  - `siteBanners`: active for the current user — published, not unpublished, not dismissed, newest first. When `show_to_new_users` is false, users created after `published_at` don't see the banner.
  - `allSiteBanners` (admin), including `dismissedCount`.
- Rendering in the app shell: see [06-app-shell-navigation.md](06-app-shell-navigation.md).

**Commons (public listing) requests**

- The request is stored in `groups.settings.public_listing_request = {status: pending|approved|denied, message (≤2000 chars, trimmed), requested_at, requested_by_id, reviewed_at, reviewed_by_id, review_message}`. It is exposed as `Group.publicListingRequest`.
- **`requestPublicListing(groupId, message)`**:
  - The caller needs Administration ("You don't have the right responsibilities for this group").
  - The group must be public visibility ("Only public groups can be added to the commons").
  - It must not already be `allow_in_public` ("This group is already in the commons").
  - No pending request may exist ("This group already has a pending request").
  - Queues `Group.notifyAboutPublicListingRequest` (email) and `Group.messageAdminsAboutPublicListingRequest` (in-app message to admins).
- **`reviewPublicListingRequest(groupId, approved, message)`**:
  - Superadmin only. The request must be pending ("This group has no pending request").
  - Approval sets `allow_in_public=true`.
  - Queues `Group.sendPublicListingDecision` (an email to the requester including `review_message`).
- **`publicListingRequests(status?)`**: superadmin only; groups with requests, newest first. An invalid status errors.
- The steward-facing UI is in [11-group-settings.md](11-group-settings.md) (privacy tab).

**Email-enabled testers (staging)**

- `email_enabled_testers(user_id)`.
- Purpose: when `EMAIL_NOTIFICATIONS_ENABLED` / `PUSH_NOTIFICATIONS_ENABLED` are not `'true'` (e.g. on staging), only **testers** receive notification emails and pushes (`User.isTester`: `HYLO_TESTER_IDS` or this table). Chat digests apply the same rule.
- Mutations `addEmailEnabledTester(userId)` / `removeEmailEnabledTester(userId)` (test admin only); query `emailEnabledTesters`.
- UI "Email-Enabled Testers":
  - "Add User": a user search with empty state "No users found".
  - "Current Email-Enabled Testers" list with remove buttons.

---

## 8. Sandbox / demo

### 8.1 Browser sandbox (`/sandbox`)
- **Activation**: any path under `/sandbox` (`isSandboxMode()`) runs the whole web app against an **in-browser mock GraphQL engine** (`sandbox/transport.js` + `handlers.js`). It never calls the real API.
- **Transport**:
  - Every request has an artificial delay of 150–250 ms.
  - `/noo/graphql` is answered from a mutable seed (`sandbox/seed`, `loadSandboxSeed(locale)`).
  - Other `/noo/*` paths are stubbed.
  - Successful mutations emit the window event `hylo:sandbox-mutation`.
- **Seed** (`seed/en/*.js`): Me (an administrator), 44 members plus 3 starter-group members, a main group, a simple group, 3 spaces, 12 stream posts, 8 chats, 3 funding submissions, comments and reactions, proposal votes, tracks, funding rounds, message threads and notifications. Copy placeholders are noted in the seed README.
- **UI chrome**:
  - Persistent top banner (`data-testid="sandbox-banner"`): "You're exploring a demo. Changes aren't saved.", a locale flag dropdown, a "Reset demo" button (reloads the page) and a "Sign up" link (`/signup`).
  - Contextual notice modal after actions, with buttons "Keep exploring" and "Sign up to unlock the full app":

    | Action | Title | Body |
    |---|---|---|
    | post | "Nice post!" | "In the demo, your post only lives in this browser tab and disappears when you leave. Sign up to share it with a real community." |
    | comment | "Thanks for joining the conversation!" | "Demo comments aren't seen by anyone else. Sign up to reply to real people in real communities." |
    | message | "Your message stays in the demo" | "Nobody receives messages sent from the demo. Sign up to chat with real people." |
    | reaction | "Glad you liked it!" | "Reactions in the demo aren't shared with anyone. Sign up to show your appreciation for real." |
    | track | "You joined a track!" | "In the full app, tracks guide you and your community through onboarding and learning together. Sign up to save your progress." |
    | invite | "Invites are switched off in the demo" | "Sign up to create your own group and invite your people." |
    | settings | "Settings changes stay in the demo" | "Try out every admin tool you like — nothing here is saved. Sign up to create your own group and set it up for real." |

  - Timed modal after **100 s of active use** (retried 3 s after another dialog closes):
    - Title "Enjoying the demo?"
    - Body "Create a free account to keep exploring with real communities — your posts, comments, and messages will actually be saved and shared."
    - Buttons "Maybe later" / "Create free account".
- **Disabled in the demo**: Stripe checkout ("Not available in the demo") and cookie consent.
- `docs/sandbox-mode-proposal.md` describes the design and later phases. The code implements the browser-only phase.

### 8.2 Demo-group seeding (backend CLI)
Run as `yarn demo <cmd>` from `apps/backend` (`demos/cli.js`, `lib/demo/*`). Commands:

- `validate <spec.json>`
- `resolve-images <spec.json>`
- `build <spec.json> [--allow-prod] [--invite email]`
- `delete <slug> [--allow-prod]`

`build` creates a real group from a JSON spec in `demos/specs/` (e.g. `river-city.json`), with dates relative to the run morning, and optionally invites partners. Production requires `--allow-prod`.

---

## 9. Feature flags
| Flag | Where | Default | Effect |
|---|---|---|---|
| `MEMBER_INVITES` | server `lib/featureFlags.js` (`FEATURE_FLAG_MEMBER_INVITES`), web `config/featureFlags.js` (`VITE_FEATURE_FLAG_MEMBER_INVITES`) | On in development, test and staging (by `SENTRY_ENV`, else `NODE_ENV`/MODE); off in production | Member invite policies 'everyone' and 'roles' and the "Who can add new members?" controls (see 10/11) |
| `PROJECT_CONTRIBUTIONS` | web only | off | Legacy project contributions: the Payment user-settings tab, project contribution UI in the post editor and post detail (see 23) |

Web flag values: `on` (everyone), `testing` (only users in `HYLO_TESTER_IDS`), `off`. Server values: `on`/`true`, `off`/`false`, or unset (default rule).

---

## 10. Permissions summary
| Capability | Who |
|---|---|
| Register OAuth / API clients | Hylo staff only (DB / `oidc_payloads`); no UI |
| Use the authorization-code API | Any Hylo user who consents to a registered client; full user-level API |
| Client-credentials API, `POST /noo/user` | Clients with `role: 'super'` |
| Create / delete Zapier triggers | Any logged-in user, for groups they have a membership row in |
| Group member export | `Administration` |
| Account export | Self |
| Management UI, kue, raw metrics, login-as, Stripe analytics, site banners, commons review | `HYLO_ADMINS` |
| Email testers | `HYLO_ADMINS` or `HYLO_TESTER_IDS` |
| Request commons listing | `Administration` of a public group |
| Cookie consent upsert | Anyone |

## 11. Edge cases & known quirks
- OAuth scopes are not enforced on the GraphQL API after authentication. `api:read`-only tokens can still mutate.
- `clientBasedCORS` allows every origin on `/noo/oauth`.
- The consent screen cannot partially approve: Allow grants all missing scopes and claims.
- The OAuth login screen auto-continues if a Hylo session cookie exists. The user cannot choose a different account without logging out first.
- `deleteZapierTrigger` uses a camelCase column name (`userId`).
- Zapier deliveries are fire-and-forget: no retry, no HMAC, no auto-deactivation of dead hooks (`is_active` is never set false by the server).
- The `member_updated` payload spreads raw `changes`, which may include internal snake/camel keys.
- The `new_member` payload is an **array**; the other triggers send an object.
- `/noo/admin/login-as` logs the admin in as the target user with no audit trail beyond the session type `'admin'`.
- `UserImport` and the Slack hook have no UI.
- The legacy `access_token` query-param auth can leak tokens via URLs.

## 12. Docs vs. code
| Source | Claim | Code |
|---|---|---|
| GitBook API docs | `POST /noo/user` param `isModerator` | The code reads `isAdministrator` or `isCoordinator`; `isModerator` is ignored |
| GitBook API docs | Client credentials scope `api:write` vs `api:read` restricts what you can do | Only the `role: 'super'` client metadata matters. Non-super JWT clients are rejected entirely (403). |
| GitBook API docs | Authorization Code "Updating a Group … only will succeed on groups that the user is a moderator of" | Enforced by the normal `updateGroup` responsibility check (Administration) |
| GitBook API docs | Full schema link points at the `main` branch | The repo's main branch is `dev` |
| GitBook iframe guide | `?redirectToView=explore\|map` controls the iframe's initial view; `/groups/GROUP/explore` | `redirectToView` is **not read anywhere** in the web app, and there is no `explore` view route (group home routes are configurable; see 15). Only `layoutFlags=hideNav` and the map params (§4.2) affect embeds. |
| GitBook iframe guide | `https://hylo.com/group/GROUP_NAME` | The route is `/groups/:slug` |
| GitBook Zapier guide | Triggers T4–T7 | Match the `new_member`, `member_leaves`, `member_updated` and `new_post` REST hooks. T1–T3 and the actions live in the external Zapier app. |
| Task brief | `?layout=` param | Not present in the code; the mechanism is `?layoutFlags=` |

## 13. Source references
- Backend:
  - `apps/backend/api/services/{OpenIDConnect,OIDCTokens,AccessTokenAuth,Admin,Analytics,CookieConsentService,ExportService,UserImport,Slack}.js`
  - `apps/backend/api/services/oidc/KnexAdapter.js`
  - `apps/backend/api/hooks/oidcRoutes.js`
  - `apps/backend/api/policies/{checkClientCredentials,accessTokenAuth,isAdmin}.js`
  - `apps/backend/config/{customMiddleware,routes,cors}.js`
  - `apps/backend/api/controllers/{UserController,ExportController,CookieConsentController,AdminController,AdminSessionController,MurmurationsController}.js`
  - `apps/backend/api/models/{ZapierTrigger,ZapierTriggerGroup,Extension,GroupExtension,SiteBanner,EmailEnabledTester,User,Post,Group}.js`
  - `apps/backend/api/graphql/mutations/{zapier,siteBanners,emailEnabledTesters,publicListingRequest}.js`
  - `apps/backend/api/graphql/makeSchema.js` (`makeApiQueries`, `makeApiMutations`)
  - `apps/backend/lib/{safeFetch,featureFlags,mixpanel,HyloJWT}.js`, `apps/backend/lib/demo/*`, `apps/backend/demos/cli.js`, `apps/backend/cron.js`
  - Migration `20260604120000_seed_native_oidc_client.js`, `20260903150000_site_banners.js`
- Web:
  - `apps/web/src/routes/OAuth/*`
  - `apps/web/src/routes/PublicLayoutRouter/*`, `apps/web/src/routes/RootRouter/RootRouter.js`
  - `apps/web/src/contexts/LayoutFlagsContext.js`, `apps/web/src/routes/MapExplorer/MapExplorer.js`
  - `apps/web/src/util/{cookieConsent,webView}.js`, `apps/web/src/components/{CookiePreferencesPanel,CookieConsentLinker}/*`
  - `apps/web/src/store/middleware/mixpanelMiddleware.js`
  - `apps/web/src/routes/Management/*`
  - `apps/web/src/sandbox/*`
  - `apps/web/src/config/featureFlags.js`, `apps/web/src/store/models/Me.js`
- Shared: `packages/shared/src/constants.js` (`AnalyticsEvents`, `WebViewMessageTypes`)
- Docs: GitBook `guides__api-documentation.md`, `guides__zapier-integration-on-hylo.md`, `guides__creating-an-iframe.md`; `docs/sandbox-mode-proposal.md`, `docs/phase-1-token-auth-implementation-plan.md`
