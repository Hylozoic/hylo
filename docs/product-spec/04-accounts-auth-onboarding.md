# 04 — Accounts, authentication & onboarding

## 1. Overview

This module covers everything a person does *before* they are a fully set‑up, logged‑in Hylo user, and the mechanics that keep them logged in:

- The **non‑authenticated layout** (`NonAuthLayoutRouter`): Login, Signup (email → 6‑digit code → platform agreements → name/password), Password reset, and the token‑authenticated **Manage Notifications / unsubscribe** page.
- **Third‑party login**: Google (web popup), Apple and Google/Facebook/LinkedIn token flows (used by mobile), all handled by `SessionController`.
- **JWT magic links** (password reset, email verification link, "finish registration" emails), legacy token links.
- **Sessions**: Redis‑backed cookie sessions, logout, clearing other sessions, rate limiting, mobile token→cookie exchange.
- **Signup state machine** on the client and the routing it drives (`RootRouter`, `SignupRouter`, `AuthLayoutRouter`).
- **Welcome wizard** (`/welcome/*`): upload photo → add location → explore.
- **Return‑to path** (redirect after login), and how invitation links behave for logged‑out users (join mechanics themselves: [10-joining-invitations.md](10-joining-invitations.md)).
- **Platform agreements** acceptance during signup, the **cookie consent** panel, account **deactivation/reactivation at login**.
- The visual design of the auth pages (particle background, logo, locale switcher).

Who uses it: every visitor/new user; existing users when they sign in, reset passwords or follow unsubscribe links from emails. The native mobile app uses the same backend endpoints but its own native screens ([25-mobile-desktop.md](25-mobile-desktop.md)).

User settings once logged in (including email change, password change, deactivate/delete) are in [05-user-settings.md](05-user-settings.md).

---

## 2. Concepts & data

### 2.1 Entities involved

| Entity / table | Relevant fields | Notes |
|---|---|---|
| `users` | `id`, `email`, `name`, `active` (bool), `email_validated` (bool), `avatar_url`, `settings` (jsonb), `last_login_at`, `created_at`, `updated_at` | Full model in [02-data-model.md](02-data-model.md). |
| `users.settings.signup_in_progress` | bool | `true` on creation (`User.create` default); set to `false` when the welcome wizard's location step is submitted. Drives redirect to `/welcome`. Exposed in GraphQL as `settings.signupInProgress`. |
| `users.settings.dm_notifications`, `comment_notifications` | `'both'` default on create | See 05. |
| `linked_account` | `user_id`, `provider_key` (`password`, `google`, `apple`, `facebook`, `linkedin`, …), `provider_user_id` | For `provider_key='password'` the `provider_user_id` column stores the **bcrypt hash** (cost 10) of the password. For social providers it stores the provider's user id. |
| `user_verification_codes` | `email` (lowercased), `code` (6‑digit string), `created_at` | Only the newest row per email exists (older rows are deleted on each `create`). |
| `user_external_data` | `user_id`, `type` (provider), `data` (provider `_json` incl. access/refresh token) | Written after social login (`UserExternalData.store`). |
| Session (Redis) | key `sess:<userId>:<uuid>` (or `sess:anon:<uuid>`), contains `userId`, `userEmail`, plus OAuth popup context `returnDomain`, `authContext` | See §5.6. |
| `cookie_consents` (via `CookieConsent` model) | `consent_id` (uuid), `settings` `{analytics, support}`, `version`, `ip_address`, `user_agent`, `user_id` | §5.10. |

### 2.2 Derived facts exposed to the client

The `Me` GraphQL type supplies:

- `emailValidated` — `users.email_validated`.
- `hasRegistered` — `true` iff the user has **at least one** `linked_account` row (password or any social provider). A user who verified email but never set a password has `hasRegistered=false`.
- `settings.signupInProgress`.

### 2.3 Client "signup state" machine

The web client keeps an `authSession` redux slice (`apps/web/src/store/reducers/authSession.js`):

```
{ status: 'unknown' | 'anonymous' | 'authenticated',
  userId, emailValidated, hasRegistered, signupInProgress, checkedAt }
```

Initial status is `unknown`. It is set from the `me` returned by `CHECK_LOGIN` (the `me` query), `LOGIN` (login mutation), `Signup/VERIFY_EMAIL`, `Signup/REGISTER`; `LOGOUT` → `anonymous`. `UserSettings/UPDATE_USER_SETTINGS` (server‑confirmed, not optimistic) mirrors `signupInProgress`, `emailValidated`, `hasRegistered` from the `updateMe` response. A social `loginWithService` LOGIN action carries no GraphQL body and leaves the slice unchanged; the following `checkLogin()` establishes it. Any errored auth action → `anonymous`.

`SignupState` (derived, `store/selectors/getSignupState.js`):

| State | Condition |
|---|---|
| `None` | status ≠ authenticated |
| `EmailValidation` | authenticated, `emailValidated` falsy |
| `Registration` | authenticated, email validated, `hasRegistered` falsy |
| `Complete` | authenticated, validated, registered |

Further selectors: `getAuthorized` = state is `Complete`; `getSignupInProgress` = authorized && `signupInProgress`; `getSignupComplete` = authorized && !`signupInProgress`.

### 2.4 Return‑to path

`returnToPath` redux slice + `localStorage['returnToPath']` (JSON string or `null`). Set by `SET_RETURN_TO_PATH`, cleared on `LOGOUT` and when the user arrives at the stored destination. Survives reloads (initial state read from localStorage).

### 2.5 Analytics event names (Mixpanel)

From `@hylo/shared` `AnalyticsEvents`: `Email Verification Sent` (SIGNUP_EMAIL_VERIFICATION_SENT), `Email Verified`, `Email Verification Failed` (prop `reason`: `invalid-code` | `invalid-link` | `other`), `Signup Agreements Accepted`, `Registered`, `Signup Complete`, `Welcome Wizard Step Viewed` (prop `step`: `upload-photo` | `add-location` | `explore`), `Welcome Wizard Step Skipped` (prop `step`), `Invite Link Opened` (props `groupId`, `method`: `token`|`code`, `signedIn`), `Login Wall Hit`. Backend: `Analytics.trackSignup(userId, req)` on user creation via OAuth and on `register`; `Login from mobile app` (props `iosVersion`/`androidVersion`) when headers `ios-version`/`android-version` present on login.

---

## 3. Routes / entry points

### 3.1 Top‑level routing (`RootRouter`)

On mount `RootRouter` dispatches `checkLogin()` exactly once (`query CheckLogin { me { id avatarUrl email emailValidated hasRegistered name settings {...} } }`).

While `authSession.status === 'unknown'`:
- if path is "neutral" (`/`, `/login`, `/reset-password`, `/notifications`, `/signup*`, `/public*`, `/post/*`, `/oauth/*`, `/h/use-invitation`, `/h/invitation`, any path containing `/join/`, `/invite/*`, `/view/*`, or any single‑segment path whose segment is not one of `groups all my members post public oauth h`) → fullscreen spinner;
- otherwise → `BootstrapShell` (skeleton of logged‑in nav + feed).
- Inside the v2 mobile WebView (`window.HyloMobileV2`) always the spinner.

Once known:

- **Authorized** (`SignupState.Complete`) or sandbox mode: `/oauth/*` → `OAuthLayoutRouter`; everything else → `AuthLayoutRouter`.
- **Not authorized** (includes "authenticated but mid‑signup"):

| Path | Element |
|---|---|
| `/` | redirect → `/login` |
| `/public/*` | `PublicLayoutRouter` |
| `/oauth/*` | `OAuthLayoutRouter` (24) |
| `/post/:postId/*` | `PublicPostDetail` |
| Many legacy post paths (`/all/.../post/:id`, `/groups/:slug/.../post/:id`, `/my/:view/post/:id`, `/members/:id/post/:id`, `/public/.../post/:id`) | redirect → `/post/:postId` |
| `/members/:personId/*`, `/all/members/:personId/*` | `PublicMemberProfile` (20) |
| `/groups/:groupSlug/join/:accessCode/*`, `/invite/:accessCode/*`, `/view/:accessCode/*` | `JoinGroup` |
| `/groups/:groupSlug/offerings/:offeringId` | `OfferingDetails` (23) |
| `/groups/:groupSlug/*` | `PublicGroupDetail` |
| `*` | `NonAuthLayoutRouter` |

### 3.2 `NonAuthLayoutRouter` routes

| Path | Component | Title (`<title>`) |
|---|---|---|
| `/login` | `Login` | "Sign in to Hylo" |
| `/signup` | `Signup` (via `SignupRouter`) | "Sign up for Hylo" |
| `/signup/verify-email` | `VerifyEmail` | (layout title "Hylo") |
| `/signup/agreements` | `Agreements` | "Hylo" |
| `/signup/finish` | `FinishRegistration` | "Hylo" |
| `/reset-password` | `PasswordReset` | "Reset your Hylo password" |
| `/notifications` | `ManageNotifications` | "Manage Notifications \| Hylo" |
| `/groups/:groupSlug/join/:accessCode`, `/invite/:accessCode`, `/view/:accessCode`, `/h/use-invitation`, `/h/invitation` | `JoinGroup` | — |
| anything else | `<Navigate to='/login' state={{ from: location }} replace />` | — |

The layout's own `<Helmet>` sets title `Hylo` and meta description `Prosocial Coordination for a Thriving Planet`.

Query‑string params understood: `returnToUrl` (any non‑auth page), `error` (`/login`, `/signup`), `email` and `token` (`/signup/verify-email`), `token`, `name`, `u`, `expand` (`/notifications`).

### 3.3 Logged‑in routes in this module

| Path | Element |
|---|---|
| `/welcome` | redirect → `/welcome/upload-photo` |
| `/welcome/upload-photo` | `UploadPhoto` (STEP 1/3) |
| `/welcome/add-location` | `AddLocation` (STEP 2/3) |
| `/welcome/explore` | `WelcomeExplore` (final card) |
| `/notifications` (when logged in) | redirect → `/my/notifications` |

### 3.4 Backend HTTP endpoints (`apps/backend/config/routes.js`)

| Method & path | Handler | Policy |
|---|---|---|
| `POST /noo/login` | `SessionController.create` | public |
| `POST /noo/login/native` | `SessionController.nativeLogin` | public |
| `POST /noo/session/from-token` | `SessionController.fromToken` | public (Bearer) |
| `GET/POST /noo/login/token` | `SessionController.createWithToken` (legacy, no longer logs in) | public |
| `GET/POST /noo/login/jwt` | `SessionController.createWithJWT` | `checkJWT` |
| `POST /noo/login/apple/oauth` | `finishAppleOAuth` | public |
| `GET /noo/login/google` / `GET /noo/login/google/oauth` | start/finish Google OAuth (popup) | public |
| `GET /noo/login/facebook`, `/facebook/oauth` | Facebook (legacy; no passport facebook strategy is registered in `config/passport.js` — effectively dead) | public |
| `GET /noo/login/linkedin`, `/linkedin/oauth` | LinkedIn (routes reference `finishLinkedinOAuth`/`finishLinkedinTokenOAuth` but the controller exports `finishLinkedinOauth`/`finishLinkedinTokenOauth` — case mismatch, likely broken) | public |
| `GET/POST /noo/login/{facebook,google,linkedin}-token/oauth` | token strategies used by mobile | public |
| `GET /noo/logout` | `destroy` — destroys session then `302 /` | public |
| `DELETE /noo/session` | `destroySession` — destroys session, `200 {}` (used by web logout) | public |
| `GET /noo/user/notification-settings` | token‑auth read (ManageNotifications) | public (JWT in `token`) |
| `POST /noo/user/update-notification-settings` | token‑auth write | public (JWT in `token`) |
| `POST /noo/user` | server‑to‑server user creation (API clients, see 24) | `checkClientCredentials`, requires `api_client.super` |
| `POST /noo/cookie-consent` | `CookieConsentController.upsert` | public |
| `GET /.well-known/openid-configuration` | → OIDC (24) | |

---

## 4. UX specification

### 4.1 Shared auth‑page chrome (NonAuthLayoutRouter)

Layout, top to bottom, all centered in a full‑viewport (`Div100vh`) column with 8px padding:

1. **Particle background** — a fixed, full‑screen `react-tsparticles` canvas inside a wrapper `particlesBackgroundWrapper`: `position:absolute; top:0; left:0; z-index:-1000; 100vw × 100vh; min-height:750px; opacity:.5; background: linear-gradient(137.79deg, rgba(255,255,255,0) 0%, rgba(135,225,208,0.173177) 35.31%, rgba(13,195,159,0.35) 99.7%)`. Particle options (`particlesjsConfig.js`):
   - `particles.number.value = 32`, density enabled, `value_area 800`.
   - color `#0dc39f`; shape `circle`, stroke width 0.
   - opacity `0.5`, random, no animation.
   - size `4.008530152163807`, random, no animation.
   - `line_linked`: enabled, distance `150`, color `#0dc39f`, opacity `0.4`, width `1`.
   - move: enabled, speed `1`, direction `none`, random, not straight, `out_mode: 'out'`, no bounce, attract enabled (`rotateX 600`, `rotateY 1200`).
   - interactivity: detect on canvas; hover (repulse) **disabled**; click (push) **disabled**; resize true. `retina_detect: true`.
2. **Top bar** (absolute, top, full width, `px-4`, flex space‑between):
   - Left: Hylo horizontal logo (`h-10`), links to `/`. Uses `/hylo-logo-light-horizontal.svg` when the effective color scheme is dark, else `/hylo-logo-dark-horizontal.svg`. Alt "Hylo logo".
   - Right: locale dropdown whose toggle text is `Locale: {locale} {flagEmoji}` (e.g. "Locale: en 🇺🇸"); locale from localStorage. Same options as the in‑app language menu (08).
3. **Main card** (route content) — every form is a `bg-midground shadow-md rounded-md` card, `w-full max-w-[320px]` (agreements: 320px / 640px on md+).
4. **Below‑card helper box** (per route), each a `bg-midground rounded-md max-w-[320px] p-4 mt-4` box:
   - `/signup*` except `/signup/agreements`: row "Already have an account?" + outline button **Sign in** (whole box links to `/login`).
   - `/reset-password`: centered outline buttons **Sign up** (→ `/signup`) "or" **Sign in** (→ `/login`).
   - `/login`: row "Not a member of Hylo?" + outline button **Sign Up** (→ `/signup`).
5. **Footer box** (always): centered links "Terms of Service" (`https://hylo.com/terms/`, new tab) "+" "Privacy Policy" (`https://hylo.com/privacy`, new tab).

Error box style (shared `formatError`): red (`$color-amaranth`) text, 10%‑alpha amaranth background, 1px amaranth border, 4px radius, padding 9px 16px, margin‑bottom 20px.

Text inputs (`TextInput`) on auth pages: card background, 2px `foreground/20` border, rounded, 16px internal padding, label rendered *inside* the field (`internalLabel`), a clear (×) button except where `noClearButton`.

Primary buttons: variant `highVisibility`; when enabled background `bg-selected` (Hylo green), when disabled grey (`bg-gray-400 cursor-not-allowed` or `bg-foreground/10 text-foreground/80`).

**Google button** (`GoogleButton`): full‑width 40px tall, background `rgba(62,130,247,1)` (hover 0.8 alpha), white text "Continue with Google", left white 24px circle with the Google "G" (`assets/btn_google_light_normal_ios.svg`), scales to 105% on hover.

#### Mount behaviour

On mount and whenever the return path changes:
1. `returnToPath` = `location.state.from.pathname + search` if present (set by the catch‑all redirect), else the `returnToUrl` query param.
2. If it exists and is not `/`: replace current history entry (clears state) and dispatch `setReturnToPath(returnToPath)`.
3. If `authSession` is authenticated (i.e. logged in but not finished signup) → `navigate('/signup', {replace:true})` — `SignupRouter` then forwards to the right step.

### 4.2 Error message mapping (`formatError`)

Server/client error keys are translated:

| Key received | Displayed |
|---|---|
| `Incorrect email or password` | "Incorrect email or password. If you signed up with Google, log in with Google instead. [Reset your password]" (link → `/reset-password`) |
| `no user` | "{{action}} was canceled or no user data was found." (`action` = `Login` or `Signup`) |
| `no email`, `no email provided`, `invalid-email` | "Please enter a valid email address" |
| `duplicate-email` | "Account already exists" |
| `linked-account-in-use` | "This account is already connected to a different Hylo user. Log out and sign in with it instead." |
| `no password provided` | "Please enter your password" |
| `email not found` | "Email address not found" |
| `invalid-code` | "Invalid code, please try again" |
| `invalid-link` | "Link expired, please start over" |
| `Too many attempts. Please wait a few minutes and try again.` | same text |
| `invite-expired` | "Sorry, your invitation to this group is expired, has already been used, or is invalid. Please contact a group Host for another one." |
| `invalid_request` (oidc-provider) | "Request expired, please start over" |
| anything else | the raw string (if the string is JSON, its `.error` field) |

### 4.3 Login (`/login`)

Card contents:
- H1 "Sign in to Hylo" (2xl bold, centered).
- Error box (initially from `?error=` query param).
- Email field (internal label "Email", `type=email`, autofocus).
- Password field (internal label "Password", `type=password`; Enter submits).
- Centered link "Forgot password?" (→ `/reset-password`, focus color).
- Button **Sign in** — disabled until both fields non‑empty.
- Below (inside card, `px-4 pb-4`): **Continue with Google** button.

Autofill workaround: every 100ms the component reads the DOM `#email`/`#password` values into state if state is empty (Chrome autofill doesn't fire change events).

Submit (`handleLogin`):
1. `checkForStorageAccess` — if running inside an iframe and `document.requestStorageAccess` exists, request it first (Safari); on denial log "Denied access to browser storage".
2. `mutation login(email, password) { me {...} error }`.
3. If `error` → show it; if no `me` → "Sorry, that Email and Password combination didn't work."
4. On success the `authSession` becomes authenticated; `RootRouter` re‑renders: Complete → `AuthLayoutRouter`; otherwise the NonAuth layout effect sends to `/signup` → signup step.

Google (`handleLoginWithService('google')`):
1. Storage access check as above (denial → "Denied access to browser storage").
2. Open popup `window.open('/noo/login/google?returnDomain=<origin>&authContext=login', 'googleAuth', 'width=420, height=480, left=<centered>, top=<centered>, titlebar=no, toolbar=no, menubar=no')`.
3. Wait for `window.popupDone({context, error, provider})` or a `postMessage` with `data.type === 'third party auth'`; ignore if `context !== 'login'`; close popup; reject on `error`.
4. Then `checkLogin()`. If `me` absent: "Sign-in with {{service}} completed but your session could not be established. Please try again or use email/password."

### 4.4 Signup step 1 — email (`/signup`)

Card:
- H1 "Welcome to Hylo"; subtitle "Enter your email to get started:".
- Error box (from `?error=` or server).
- Field internal label "Your email address" (`type=text`, autocomplete off, autofocus). Prefilled from `location.state.email` (set by invitation redirect, §5.9). Typing clears the error.
- Button **Create account** — enabled only when `validateEmail(email)` passes; Enter also submits. If invalid on submit: "Invalid email address".
- **Continue with Google** below (same popup flow; on success just dispatches `checkLogin()`).

Submit → storage access check → `mutation sendEmailVerification(email) { success error }`. On `success` navigate (replace) to `/signup/verify-email?email=<urlencoded>`. Mixpanel `Email Verification Sent`.

### 4.5 Signup step 2 — verify email (`/signup/verify-email`)

- If neither `me.email` nor `?email=` is available → redirect `/signup`.
- If `?token=` present → auto‑submit on mount (magic link from the verification email).
- Card: top‑left link "← back" (→ `/signup`); H1 "Check your email"; transient notice (accent color) "Email verification re-sent" for 10s after resend; paragraph "We've sent a 6 digit code to {{email}}. The code will expire shortly, so please enter it here soon."; error box; **6‑box code input** (`react-verification-input`, length 6, autofocus; each box 40×48px, rounded, 1px `foreground/20` border, 2xl centered text; selected box border `selected`; filled box `bg-selected/20`, inactive `bg-background/60`; 8px gaps); underlined link "Resend code" (re‑calls `sendEmailVerification`).
- Typing the 6th character auto‑submits. While submitting, the card is replaced by a loading spinner.
- Submit: `mutation verifyEmail(email, code, token) { me {...} error }`.
  - error → shown; Mixpanel `Email Verification Failed {reason}`.
  - success → Mixpanel `Email Verified`, `navigate('/signup/agreements', {replace:true})`.
  - network exception → redirect `/signup?error=<message>`.

### 4.6 Signup step 3 — platform agreements (`/signup/agreements`)

Card `w-[320px] md:w-[640px] max-h-[70vh] mt-20`, flex column; upper part scrolls, footer fixed.
- Top‑right × icon (`Ex`) → `window.confirm("We're almost done, are you sure you want to cancel?")` → on OK: `logout()` then navigate `/signup`.
- H1 "Hylo Platform Agreements"; subtitle "Please review and accept our community agreements to continue".
- Paragraph `agreementChunk1` (copy below) with inline links: "Code of Conduct & Cultural Norms" → `https://www.hylo.com/agreements/#code-of-conduct`; "Terms of Use" → `https://www.hylo.com/terms/`; "Hylo Platform Agreements" → `https://www.hylo.com/agreements/#hylo-platform-agreements` (all new tab, focus color, underline on hover).
- Six bullet paragraphs (`agreementChunk2`–`7`), each prefixed with a focus‑colored "•", font‑medium.
- Link "View detailed agreements" → `https://www.hylo.com/agreements/#hylo-platform-agreements`.
- Footer (top border): checkbox `#accept-agreements` with label "I accept the agreements"; button **Continue** (disabled until checked).
- Continue → Mixpanel `Signup Agreements Accepted` → navigate `/signup/finish`.

Copy:
- agreementChunk1: "You are warmly invited to be a part of this community! Our invitation to you is to come to the platform and its communities as a contributor and co-creator. We know you have a unique role to play in making this place more enjoyable and more useful for everyone. We ask all Hylo participants to commit to upholding our {{codeOfConductLink}} and {{termsOfUseLink}} by consenting to the {{fullAgreementsLink}}. We are so happy you are with us on this journey. Welcome to Hylo!"
- 2: "I pledge to behave on Hylo in ways that contribute to an open, welcoming, and healthy community, and to support other members in feeling respected and appreciated."
- 3: "I will respect differing viewpoints and experiences, and work to find common ground and shared values with other Hylo members."
- 4: "I commit to learning from every interaction. I will listen to feedback, adapt, and embrace responsibility for mistakes as opportunities for growth."
- 5: "I pledge to share my voice, ideas, and skills in service to my group(s) on Hylo, recognizing that working together leads to better outcomes."
- 6: "If I see an opportunity to improve something on the Hylo platform or within my group, I will take action to make it better."
- 7: "I commit to upholding the {{codeOfConductLink}}, and {{termsOfUseLink}}, and I agree to participate in accountability processes when necessary."

**Acceptance is client‑side only**: nothing is persisted on the server (no mutation). A user can reach `/signup/finish` directly (SignupRouter allows `/signup/finish` in `Registration` state). Group‑level agreements are separate ([10](10-joining-invitations.md), [12](12-roles-permissions-moderation.md)).

### 4.7 Signup step 4 — finish registration (`/signup/finish`)

Card with top‑right × (same cancel‑confirm as agreements).
- H1 "One more step!"
- "{{email}} was successfully added to your profile."
- "Please enter a name and password to secure your account."
- Error box.
- Field "Name" (autofocus; prefilled with `me.name`, e.g. from a Google profile or API‑created stub).
- Field "Password (at least 9 characters)" (`type=password`).
- Field "Confirm Password" (Enter submits).
- Button **Jump in to Hylo!** — enabled iff trimmed name length > 1 **and** `Validators.validateUser.name` passes **and** password length > 8 **and** confirmation length > 8.
- Submit: if password ≠ confirmation → "Passwords don't match". Else `mutation register(name: trimmedName, password) { me {...} error }`. Error shown raw (e.g. "Password must be at least 9 characters." or "Email not validated"). On success Mixpanel `Registered`; `authSession` becomes `Complete` and `RootRouter` swaps to `AuthLayoutRouter`, which (because `signupInProgress` is true) redirects to `/welcome`.

### 4.8 `SignupRouter` redirect rules

Evaluated on every change of signup state or pathname (shows a spinner while deciding):

| Signup state | Behaviour |
|---|---|
| `None` | any `/signup/*` other than `/signup/verify-email` → `/signup` |
| `EmailValidation` | → `/signup/verify-email` |
| `Registration` | stay if on `/signup/agreements` or `/signup/finish`; otherwise → `/signup/agreements` |
| `Complete` | → `/` (should not happen; layout already switched) |

Consequence: a verified‑but‑unregistered user who logs in later (e.g. returns days after verifying), or whose session persists, is always resumed at agreements.

### 4.9 Password reset (`/reset-password`)

Card:
- H1 "Reset your password".
- "Enter your email address and we'll send you an email that lets you reset your password."
- Success (selected/green): "If your email address matched an account in our system, we sent you an email. Please check your inbox."
- Error (error color): "There was a problem with your request. Please check your email and try again."
- Field "Your email address" (no clear button, focused after 100ms; Enter submits).
- Button **Send reset email** — active only if `validator.isEmail(email)`.
- Any keystroke clears success/error.

Submit: `mutation sendPasswordReset(email) { success }`. Shows success whenever the request didn't error (the server always returns success for unknown emails, to avoid enumeration). Note: the rate‑limit response `{success:false, error}` is *not* treated as an error by the UI (it only checks the redux `error` flag), so the success message still shows.

Email: template "password reset" with `login_url = <origin>/noo/login/jwt?u=<userId>&token=<JWT>&n=<urlencoded <origin>/my/account>`. Clicking it: `checkJWT` validates the JWT (§5.5), logs the user in (`UserSession.login(..., 'jwt')`) and redirects to `/my/account`, where the user sets a new password ([05](05-user-settings.md) Account tab — no "current password" needed). Invalid/expired JWT on GET → `302 /login?error=invalid-link` → "Link expired, please start over".

### 4.10 Manage Notifications (`/notifications`, logged out)

Reached from the "notification settings"/unsubscribe link in Hylo emails: `<origin>/notifications?<clickthrough params>&expand=account&token=<JWT>&name=<urlencoded name>&u=<userId>`. JWT: `sub=userId`, `action='notification_settings'`, `exp` = now + 30 days. If the user *is* logged in, `/notifications` redirects to `/my/notifications`.

Card (`.form` + 30px padding):
- H1 "Hi {{userName}}" (from `name` param).
- "You can change your Hylo notification settings here"
- While settings empty: "Loading..."
- Five labelled selects (Radix Select, inline width):

| Label | Values (label → stored) | Initial |
|---|---|---|
| "Send me a digest of new posts" | Daily→`daily`, Weekly→`weekly`, Never→`never` | server `digestFrequency` |
| "Send notifications for each new post in your group?" | No Posts→`none`, Announcements & Mentions only→`important`, Every Post→`all` | `postNotifications` |
| "Send notifications about comments on posts you are following via" | None→`none`, Email→`email`, Mobile App→`push`, Email & Mobile App→`both` | `commentNotifications` |
| "Send notifications for direct messages via" | same four | `dmNotifications` |
| "Send notifications for announcements and topic posts for all my groups via" | Existing per Group Settings→`keep`, then the four | `keep` |

- Checkbox "Unsubscribe from all" — when checked, all selects are disabled and display `never`/`none`.
- Button **Save Settings** (green). No success feedback is rendered.

API: `GET /noo/user/notification-settings?token=` returns `{digestFrequency (default 'daily'), dmNotifications (default 'both'), commentNotifications (default 'both'), postNotifications (default 'important'), sendEmail, sendPushNotifications, hasDevice:false}` (`sendEmail`/`sendPushNotifications` = any membership has that setting). `POST /noo/user/update-notification-settings` with `{token, unsubscribeAll, digestFrequency, dmNotifications, commentNotifications, postNotifications, allGroupNotifications}`:
- `unsubscribeAll` → user settings `digest_frequency='never'`, `dm_notifications='none'`, `comment_notifications='none'`, `post_notifications='none'`; else those four keys from the body (snake‑cased) merged into `users.settings`.
- Membership settings (all of the user's `group_memberships`, jsonb merge): `sendEmail=false` if unsubscribeAll or all=`none`/`push`; `true` if `email`/`both`. `sendPushNotifications=false` if unsubscribeAll or `none`/`email`; `true` if `push`/`both`. `keep` → untouched.
- Errors: invalid token or wrong `action` → `403 {error:'Unauthorized'}` (UI shows nothing).

Note `User.find(sub)` with the active filter: deactivated users get 403.

### 4.11 Welcome wizard (`/welcome/*`)

Shown to users with `settings.signupInProgress === true`. `AuthLayoutRouter` redirects every non‑`/welcome` path to `/welcome` while `getSignupInProgress` is true. The wizard is a fixed full‑screen overlay (`z-index:100`, `inset 0`, padding 16px, scrolls vertically, never horizontally) over a `bg-darkening/30` backdrop; the card wrapper is `max-width:360px`, vertically centered by auto margins (so short screens can scroll to the button). CSS transition class `welcome-wizard` (enter 400ms, exit 300ms).

Card: `bg-card shadow-md rounded-lg`, padding 32px, min‑height 480px; step counter top‑right in xs muted text.

**Footer** (`WelcomeWizardModalFooter`): left **Back** button (2px border, rounded) unless `showPrevious=false`; right continue button with step‑specific text. Continue is *always* clickable; `continueReady` only changes styling (filled `bg-selected` when ready, else outline). Actions fire on `pointerdown` (with a lock to ignore the subsequent click) to avoid Android dropping the tap after a focused input blurs.

**Step 1 — Upload photo** (`/welcome/upload-photo`, "STEP 1/3"):
- Centered 160px dashed (3px, `primary/50`) circle containing a 140px round avatar preview (current `avatarUrl`, default gravatar) — clicking it opens the upload picker (`UploadAttachmentButton type='userAvatar'`). Bottom‑right badge 36px circle (`bg-selected/50`, 2px card border) with `ImageUp` icon, or spinning `Loader2` while uploading. `data-testid='upload-photo-button'`.
- Title "Upload a profile image"; text "Almost done setting up your profile! Click the above profile icon to upload a custom profile image. Your profile image will be visible when you post or comment in groups."
- No Back button. Continue "Next: Where are you from?" (ready style once a new avatar uploaded and upload not pending).
- Continue: if no new avatar → Mixpanel `Welcome Wizard Step Skipped {step:'upload-photo'}`. Dispatch `updateMe(edits)` (possibly empty) and push `/welcome/add-location`.

**Step 2 — Add location** (`/welcome/add-location`, "STEP 2/3"):
- 100px `MapPin` icon (muted, stroke 1.25).
- `LocationInput` (Mapbox geocoder autocomplete; `saveLocationToDB`), placeholder "Where do you call home?", autofocus, underline style; prefilled with existing `location`. Enter submits.
- Text "Add your location to see more relevant content, and find people and projects around you."
- Back → `/welcome/upload-photo`. Continue "Next: Welcome to Hylo!".
- Continue: if location blank → `Welcome Wizard Step Skipped {step:'add-location'}`. If the text is a raw coordinate, `ensureLocationIdIfCoordinate` geocodes it to obtain a `locationId`. Then `updateMe({ location, locationId, settings: { signupInProgress: false } })`; **after the server confirms**: Mixpanel `Signup Complete`, then push `returnToPath` if set, otherwise `/welcome/explore`.
- Server side: setting `signup_in_progress=false` enqueues `User.sendWelcomeEmail` with a **2‑minute delay** (§5.8).

**Step 3 — Explore** (`/welcome/explore`, no step counter):
- Title "Welcome to Hylo!"; text "We're glad you're here, {{firstName}}. To get started, explore public groups and posts, or create your own group!" (first word of name).
- Four stacked link cards (`bg-background shadow-lg rounded-lg p-4`, lift −4px and stronger shadow on hover; 80×80 rounded image left):
  1. Image `/signup-globe.png`, "View the public map" / "Find out what's happening around you, and groups you can join" → `/public/map?hideDrawer=true` (hover glow `rgba(79,118,193,0.7)`).
  2. `/signup-stream.png`, "Public stream" / "View and participate in public discussions, projects, events & more" → `/public/all` (glow `rgba(22,178,190,0.7)`).
  3. `/signup-group.png`, "Create a group" / "Gather your collaborators & people who share your interests" → create‑group modal over `/public` (`createGroupModalUrl({pathname:'/public'})`) (glow `rgba(129,174,101,0.7)`).
  4. The user's avatar with a red→yellow gradient overlay (`rgba(235,87,87,0.7)`→`rgba(238,194,40,0.7)`, 70% opacity), "Complete your profile" / "Share about who you are, your skills & interests" → `/my/edit-profile` (glow `rgba(238,136,56,0.7)`).
- Since `signupInProgress` is false by now, the user can also navigate anywhere.

### 4.12 Logout

Entry points (UI in [06](06-app-shell-navigation.md)): global‑nav avatar dropdown item "Logout {email}" (`data-testid='global-nav-logout'`), the My Home menu item "Logout" (`view-my-logout`, LogOut icon, last item), the My Home card grid, and the cancel × on agreements/finish steps; deactivate/delete also log out.

Web flow (`logoutFromMobileWebView(dispatch, logout(), replace('/login'))`):
1. `DELETE /noo/session` → server destroys the session (`req.session.destroy()`), clears Sentry user, `200 {}`.
2. Reducers: `authSession` → anonymous; whole redux store wiped except the new `authSession` (`resetStore` on LOGOUT); `returnToPath` cleared (state and localStorage).
3. Navigate (replace) to `/login`.

In the v2 mobile WebView: set `window.__hyloMobileUserLogout = true`, post `LOGOUT` message to native, dispatch logout; `RootRouter` shows a fullscreen spinner while the flag is set (native handles its login screen).

The GraphQL `logout` mutation also exists (destroys session, `{success:true}`) but the web uses the REST endpoint.

### 4.13 Cookie consent panel (global, all pages)

`CookiePreferencesPanel` is mounted at the app root (`router/index.js`), so it also appears on login/signup pages.

Shown when: not sandbox, not in an iframe, not in a mobile WebView, **and** no valid `hylo_cookie_consent` browser cookie exists **and** (logged out, or logged in without `me.cookieConsentPreferences` in the DB). If a logged‑in user has a DB record, the cookie is rebuilt from it silently.

Layout: fixed, `z-index:1000`; on phones a full‑width bottom sheet with a 2px top border; on ≥640px a 350px card 24px from bottom‑right, 2px border, rounded.
- H2 "Cookie Preferences" (sm bold); text "We use essential cookies to help understand whether you are logged in and to understand your preferences and where you are in Hylo."
- Two columns, each: Switch + label + info (ⓘ) button:
  - "Analytics" + " (Mixpanel)" (suffix hidden on phones) — default **on**.
  - "Support" + " (Intercom)" — default **on**.
- ⓘ toggles explanatory text under both columns: "We use a service called Mixpanel to understand how people like you use Hylo. Your identity is anonymized but your behavior is recorded so that we can make improvements to Hylo based on how people are using it." / "When people on Hylo need help or want to report a bug, they are interacting with a service called Intercom. Intercom stores cookies in your browser to keep track of conversations with us, the development team."
- Buttons: **Reject Non-Essential** (sets both false) and **Save and Continue** (inverted colors: `bg-foreground text-background`).

On save: browser cookie `hylo_cookie_consent=<urlencoded JSON {id (uuid v4), analytics, support, isLinkedToUser, userId, lastUpdated (ISO)}>; path=/; max-age=31536000; SameSite=Lax`, then `POST /noo/cookie-consent` with `{consent_id, settings:{analytics, support}, version:'1.0', user_agent, user_id?}`. After login, `CookieConsentLinker` (inside the auth layout) re‑saves an unlinked cookie with `isLinkedToUser:true, userId` and syncs it. The panel can be re‑opened from Account settings ([05](05-user-settings.md)) and from the support‑chat prompt ("Edit Cookie Preferences"). How the consent gates Mixpanel/Intercom: see [01-architecture.md](01-architecture.md).

---

## 5. Business rules & side effects

### 5.1 `sendEmailVerification(email)` (public mutation)

1. Normalize: trim + lowercase; must pass `validator.isEmail`, else `{success:false, error:'Invalid email address'}`.
2. Rate limit `sendEmailVerification`: per IP 50/hour, per email 5/hour; **every request counts**. Limited → `{success:false, error: RATE_LIMITED_ERROR}`.
3. Find user by `lower(email)` (active or not). If none: `User.create({ email, active: false })` → a stub user with defaults (gravatar avatar `https://www.gravatar.com/avatar/<md5(email)>?d=mm&s=140`, `settings {signup_in_progress:true, dm_notifications:'both', comment_notifications:'both'}`, no name).
   - Note: an *existing, registered* user's email also gets a code; verifying it logs them in (acts as passwordless login).
4. `UserVerificationCode.create(email)`: random 6‑digit code (`crypto.randomInt(0,1000000)` zero‑padded), deletes previous codes for the email, inserts new row; JWT `token = generateHyloJWT(email, {code})` (RS256, `iss`=`aud`=`<PROTOCOL>://<DOMAIN>`, `sub`=email, `exp` 4h).
5. Queue email `Email.sendEmailVerification` (template `tem_h99yGHv9MXTpMrPSDVTjQFyB`, `version:'with link'`, data `{code, verify_url}`), `verify_url = <origin>/signup/verify-email?email=<enc>&token=<jwt>`. In development the code and link are logged to the console.
6. Returns `{success:true}`.

### 5.2 `verifyEmail(email, code, token)` (public mutation)

1. If `token`: decode JWT (verify RS256 signature + issuer in `[primary, HYLO_JWT_EXTRA_ISSUERS…, (dev) localhost:3000/3330]`); email = `sub`, code = `code` claim.
2. Missing email/code → error.
3. Rate limit `verifyCode` (only **failed** attempts count): IP 50/hour, email 10/hour → `{error: RATE_LIMITED_ERROR}`.
4. `UserVerificationCode.verify`: in a transaction find row `{email, code}`; valid iff `now - created_at < 4h`; the row is **deleted whether or not expired** (single use).
5. Invalid → record attempt, `{error: token ? 'invalid-link' : 'invalid-code'}`. Any thrown error (bad JWT etc.) → same keys.
6. Valid → `users.email_validated = true`; regenerate session (new id `<userId>:<uuid>`), `session.userId = user.id`. Note: does **not** call `UserSession.login` (no `last_login_at`, no activation). Returns `{ me }`.

### 5.3 `register(name, password)` (mutation; requires the session from verifyEmail)

1. `User.find(currentUserId, {}, false)` (includes inactive); none → "Not authorized".
2. `!email_validated` → "Email not validated".
3. `Validators.validateUser.name(name)` → errors "Name must be a string." / "Name must not consist solely of whitespace."
4. `Validators.validateUser.password(password)` → "Password must be a string" / "Password must not consist solely of whitespace, must be at least 9 characters." (joined reasons, sentence‑terminated).
5. Transaction: save `name.trim()`, `active=true`; `UserSession.login(req, user, 'password')`; create `linked_account {provider_key:'password', provider_user_id: bcrypt(password,10)}`; `Analytics.trackSignup`.
6. Returns `{ me }`; errors returned as `{error: message}` (e.g. a second `register` call would try to create a second password linked account).

### 5.4 `login(email, password)` / `POST /noo/login`

`User.authenticate(email, password)`:
- missing email → "no email provided"; missing password → "no password provided".
- user lookup by `lower(email)` **without** active filter; no user, no `password` linked account, or bcrypt mismatch → `INVALID_LOGIN_ERROR = 'Incorrect email or password'` (same message for every failure to prevent account enumeration).
- Rate limit `login` (failed attempts only): IP 50 / 15 min, email 10 / 15 min → `'Too many attempts. Please wait a few minutes and try again.'`.

`UserSession.login(req, user, providerKey)`:
1. Unless `providerKey === 'token'`: regenerate the session (session fixation protection); carries over non‑auth keys (`returnDomain`, `authContext`); new id prefixed with user id.
2. `session.userId`, `session.userEmail`; Sentry user.
3. For `admin`/`token` stop here.
4. Mobile headers → Analytics `Login from mobile app`.
5. Save `last_login_at = now`; **if the user has a valid name, set `active = true`** → *logging in reactivates a deactivated account* (§5.7). Stubs without a name stay inactive.

GraphQL `login` returns `{ me }` or `{ error }`; REST `POST /noo/login` returns `200 {}` or `422 <message>`.

### 5.5 JWT / magic links

- Generation: `generateHyloJWT(sub, data)` — RS256 with the first key in `OIDC_KEYS` (base64 PEM), `iss`=`aud`=`<PROTOCOL>://<DOMAIN>`, default `exp` 4 hours. `user.generateJWT(data)` uses `sub=user.id`.
- Passport `jwt` strategy (`checkJWT` policy for `/noo/login/jwt`): token from `Authorization: Bearer` or `?token=`; issuer/audience checked; `maxAge 4h` (so even the 30‑day notification token cannot be used for login); user looked up without active filter.
- `createWithJWT`: `n` (next URL) accepted only if it resolves to the frontend origin (`safeNextUrl`); default `<origin>/my/account`.
  - Valid & GET → session login (`'jwt'`) then `302 next`.
  - Valid & POST with header `X-Hylo-Token-Auth: 1` → returns OAuth token pair (mobile).
  - Valid & POST → `{success:true}`.
  - Invalid: GET → `302 /login?error=invalid-link`; POST → `403 info`. No session and no valid `n` → `422 'Invalid link, please try again'`.
- Legacy `/noo/login/token` (pre‑March‑2025 non‑expiring tokens): never logs in; GET redirects to safe `n` or `/login`; POST → `422 'Link expired'`.
- "Finish registration" email (server‑to‑server `POST /noo/user` for API clients): template `tem_fqGSrDrSK6WpjTBFXSfY79k4` with `verify_url = /signup/verify-email?email=..&token=<user.generateJWT()>`. **Quirk:** that JWT has `sub=userId` and no `code` claim, so `verifyEmail` will fail with `invalid-link` (the `sub` is not an email). The user can still sign up normally with the same email (code flow), which matches the existing stub.

### 5.6 Sessions

- Store: Redis via `@sailshq/connect-redis`, key prefix `sess:`, TTL 60 days.
- Cookie: name `COOKIE_NAME` env, domain `COOKIE_DOMAIN`, `maxAge` 60 days, `secure` and `SameSite=None` on https (so Hylo stays logged in inside third‑party iframes), `Lax` on http.
- Session id: `<userId or 'anon'>:<uuidv4>`; `User.clearSessionsFor({userId, sessionId})` scans `sess:<userId>:*` and deletes all except the current one. Triggered on password change (`LinkedAccount.updatePassword`), deactivation and deletion.
- GraphQL context `currentUserId = req.session.userId`; anonymous requests get only public queries and the public mutations `login, logout, sendEmailVerification, sendPasswordReset, register, verifyEmail, createStripeCheckoutSession`.
- Requests authenticated by an API bearer token never write the cookie session (`keepOutOfCookieSession`).
- Mobile: `POST /noo/login/native` (email/password → token pair, also sets `active=true`, `last_login_at`), `POST /noo/session/from-token` (Bearer access token → regenerated cookie session, used before loading the WebView). Web `RootRouter` in the v2 WebView: on failed `checkLogin`, posts `VERIFY_AUTH` up to 3 times (counter in `localStorage.hyloMobileReauthAttempts`), re‑runs `checkLogin` on native `SESSION_READY`, posts `AUTH_SUCCESS` on success and `LOGOUT` after 3 failures. Details: [25-mobile-desktop.md](25-mobile-desktop.md), `docs/mobile-auth-cookie-workflow.md`.

### 5.7 Social login (`finishOAuth`, Apple)

- Google popup: `GET /noo/login/google?returnDomain&authContext` stores both in the session, then passport Google OAuth2 (scope `email profile`). Callback `/noo/login/google/oauth`:
  - error / no profile → `'no user'`; profile without email → `'no email'`.
  - If already logged in (web): `upsertLinkedAccount` — if a `linked_account` with this provider id exists for another user → `'linked-account-in-use'`; same user → update; none → create linked account.
  - Otherwise `upsertUser`: find user by provider id **or** `lower(email)` (prefer the provider‑id match if both). Existing → fill missing name from profile, `UserSession.login(req, user, provider)`, create linked account if missing. New → `User.create({email, name?, account:{type, profile}, email_validated:true})` (+ `trackSignup`) then login. New OAuth users therefore skip email verification, and since they have a linked account `hasRegistered=true` — they skip agreements and finish‑registration entirely and go straight to the welcome wizard.
  - `UserExternalData.store(userId, provider, profile._json)`.
  - Response: HTML `popupDone` view that calls `opener.popupDone({type:'third party auth', provider, context, error})` or `opener.postMessage(message, returnDomain)`. If `Accept: application/json` → `200 {}`/500.
- Token strategies (`*-token/oauth`) with header `X-Hylo-Token-Auth: 1` → never attach to an existing session; `upsertUser(..., {tokenAuth:true})` records login without a cookie and returns a token pair.
- Apple (`POST /noo/login/apple/oauth`, body `{nonce, user, identityToken, fullName}`): verifies the identity token (audience `APPLE_CLIENT_ID` default `com.hylo.HyloA`, nonce sha256); `sub` must equal `user`, else `401 'Invalid Apple identity token'`. Email used only if `email_verified`. Name from `fullName` given+family (only on first authorization). Web callers get the user JSON; token‑auth callers get tokens. The web app has no Apple button (mobile only).
- `LinkedAccount.create` for social types copies social attributes (e.g. `facebook_url`, `linkedin_url`) and a non‑gravatar avatar to the user when `updateUser` is set, and fills a missing name.

### 5.8 Emails sent by this module

| Trigger | Template | Data |
|---|---|---|
| `sendEmailVerification` | `tem_h99yGHv9MXTpMrPSDVTjQFyB` (email verification, "with link") | `code`, `verify_url` |
| `sendPasswordReset` | `tem_phRPHm3y6RHvRFww6Vc3VBVB` | `login_url` (JWT magic link) |
| API `POST /noo/user` | `tem_fqGSrDrSK6WpjTBFXSfY79k4` (finish registration) | `api_client`, `group_name`, `group_avatar_url`, `group_url`, `verify_url` |
| Welcome wizard complete (`signup_in_progress` → false) | `tem_jkdjbcSVK9cmGvwXbtX9PQbJ` (welcome), sent 2 minutes later | `member_name`, `group_name`/`group_url` of the user's first membership (null if none) |

All via the transactional email provider (see [19](19-notifications-email-push.md)); locale from the user's setting where known.

### 5.9 Return‑to path & invitations while logged out

- Any unknown deep link while logged out (e.g. `/groups/foo/stream` is handled by PublicGroupDetail, but `/my/posts`, `/messages`, `/all`…) hits the NonAuth catch‑all → `/login` with `state.from` → stored as `returnToPath`.
- `?returnToUrl=` on any NonAuth page also sets it (used by OAuth/OIDC login and the public pages' "sign in to …" walls).
- After login, `AuthLayoutRouter`: if not in signup and not in `/welcome`, and `returnToPath` is set → if the current location equals it (path + query) clear it; otherwise `<Navigate to={returnToPath} replace>`.
- During signup the path is preserved; the welcome wizard's location step pushes `returnToPath` instead of `/welcome/explore` (the explore card is then skipped).
- Invitation links (`/groups/:slug/join/:accessCode`, `/invite/:accessCode`, `/view/:accessCode`, `/h/use-invitation?token=&email=`, `/h/invitation?token=`) for a not‑signed‑up visitor: `JoinGroup` calls `checkInvitation`; if valid, stores `returnToPath = /groups/<slug>/about?accessCode=…` (or `?token=…`; for a space invite where the user isn't a parent member, the parent group's about page) and redirects to `/signup`, passing the invite email (from the server or `?email=`) as `location.state.email` so the email field is prefilled. Invalid → `/signup?error=invite-expired`. Already logged in → redirect straight to the about page. Joining itself: [10-joining-invitations.md](10-joining-invitations.md).

### 5.10 Cookie consent backend (`POST /noo/cookie-consent`)

Unauthenticated. Validates: `settings` required, object, only keys `analytics`, `support` kept, each must be boolean (`400 'Settings.<key> must be a boolean value'`), at least one present; `consent_id` if present must be a UUID; `version`, `ip_address`, `user_agent` strings. Upserts via `CookieConsentService` (ip defaults to `req.ip`, UA to header). If `user_id` given and the analytics flag changed vs. the user's latest record, sets Mixpanel people property `analytics_opt_in`. Returns `{success:true, consentId}`; errors `500 {error}`.

### 5.11 Deactivated / deleted accounts at login

- Deactivated (`active=false`, name set): password login, Google login, JWT link, native login all succeed and set `active=true` → account reactivated silently.
- Email‑verification stubs (`active=false`, no name) are never activated by login; they become active only via `register` (or OAuth that supplies a name).
- Deleted accounts: email is overwritten with `<uuid>@hylo.com` and linked accounts deleted, so the old email can sign up again as a brand‑new user.
- `reactivateMe` mutation exists but is broken (see Edge cases).

---

## 6. Permissions

| Action | Who |
|---|---|
| `sendEmailVerification`, `verifyEmail`, `login`, `logout`, `sendPasswordReset` | anyone (public mutations) |
| `register` | the session user from `verifyEmail` whose email is validated |
| `/noo/login/jwt` | holder of a valid ≤4h JWT |
| Manage Notifications endpoints | holder of a JWT with `action:'notification_settings'` for an **active** user |
| `POST /noo/user` | super API clients only (403 otherwise) |
| Welcome wizard | any logged‑in user (forced while `signupInProgress`) |

---

## 7. API

GraphQL (`apps/backend/api/graphql/schema.graphql`):

```graphql
mutation sendEmailVerification(email: String!): GenericResult      # { success, error }
mutation verifyEmail(email: String!, code: String, token: String): UserResult  # { me, error }
mutation register(name: String!, password: String!): UserResult
mutation login(email: String, password: String): UserResult
mutation logout: GenericResult
mutation sendPasswordReset(email: String!): GenericResult
mutation updateMe(changes: MeInput): Me              # used by the welcome wizard
mutation reactivateMe: GenericResult                 # broken, see §8
query me: Me    # id, email, emailValidated, hasRegistered, name, avatarUrl, settings{signupInProgress,...}, cookieConsentPreferences
query checkInvitation(invitationToken, accessCode)   # module 10
```

Fields requested by the web on `me` during auth: `id avatarUrl email emailValidated hasRegistered name settings { alreadySeenTour toursSeen colorScheme dmNotifications commentNotifications unifiedEmailDigest globalNavStyle groupNavStyle rsvpCalendarSub signupInProgress stackGroups streamChildPosts streamViewMode streamSortBy streamPostType theme locale }`.

REST: see §3.4. Rate‑limit constants (`lib/rateLimit.js`, Redis keys `ratelimit:<action>:<ip|email>:<value>`, fixed window from first attempt, fails open if Redis is down):

| Action | per IP | per email | counts |
|---|---|---|---|
| `login` | 50 / 15 min | 10 / 15 min | failures |
| `verifyCode` | 50 / 60 min | 10 / 60 min | failures |
| `sendPasswordReset` | 50 / 60 min | 5 / 60 min | every request |
| `sendEmailVerification` | 50 / 60 min | 5 / 60 min | every request (shared with email‑change requests, see 05) |

---

## 8. Edge cases & known quirks

- **Agreements are not recorded server‑side**; `/signup/finish` can be reached without ticking the box.
- **`reactivateMe` resolver bug**: declared as `(root, context) => reactivateUser({ userId: context.currentUserId })` — the second argument is GraphQL *args*, so `userId` is undefined and the mutation fails. Reactivation works only via logging in.
- `verifyEmail` for an existing registered user's email logs them in without a password (email possession = authentication). It also does not run `UserSession.login` (no activation/last‑login update).
- Verification codes are deleted on the first attempt even when the 4h window expired, and requesting a new code invalidates the old one.
- The "finish registration" API email's link always fails (`sub` is a user id, no `code`) — see §5.5.
- LinkedIn routes have a method‑name case mismatch; Facebook has no registered strategy. Only Google (web) and Apple/Google token (mobile) are live.
- `PasswordReset` shows the success message even when rate‑limited.
- On the Login page an `error` query param (e.g. `?error=invalid-link`) is displayed via `formatError`.
- `ManageNotifications` gives no visual confirmation after Save and no error for an expired/invalid token (the selects render with defaults/undefined).
- `updateNotificationSettings` builds raw SQL by string concatenation with the numeric user id (safe only because the id comes from the DB).
- In the NonAuth layout effect, an authenticated‑but‑incomplete user is sent to `/signup` on mount only (effect deps don't include `isAuthenticated`).
- Welcome wizard Continue is clickable even without a photo/location ("skip"); Step 1 continue sends an empty `updateMe({})` when nothing changed.
- `register` called twice would attempt to create a second password `linked_account`.
- The deprecated `GroupWelcomeModal` route is still mounted for every `/groups/:slug/*` (module 09).

## 9. Docs vs. code

- Docs ("Joining Hylo"): "You can sign up or log in to an existing account using an email address and password." Code: signup is email → 6‑digit code (or emailed link) → platform agreements → name + password; Google sign‑in is also offered on web, Apple on mobile.
- Docs (Account page): "This action is reversible, just log back in to activate your account." — matches code (login reactivates), though the dedicated `reactivateMe` mutation is broken.
- Docs mention signing up "to create your own community" at `hylo.com/signup` — code's final welcome step offers Create a group, public map, public stream, complete profile.

## 10. Source references

- `apps/web/src/routes/RootRouter/RootRouter.js`
- `apps/web/src/routes/NonAuthLayoutRouter/{NonAuthLayoutRouter.js, NonAuthLayoutRouter.module.scss, particlesjsConfig.js, util.js}`
- `apps/web/src/routes/NonAuthLayoutRouter/Login/Login.js`, `PasswordReset/PasswordReset.js`, `ManageNotifications/ManageNotifications.js`
- `apps/web/src/routes/NonAuthLayoutRouter/Signup/{SignupRouter.js, Signup.js, Signup.store.js, VerifyEmail/, Agreements/, FinishRegistration/}`
- `apps/web/src/routes/WelcomeWizardRouter/**`
- `apps/web/src/routes/JoinGroup/JoinGroup.js`
- `apps/web/src/routes/AuthLayoutRouter/AuthLayoutRouter.js` (returnToPath & welcome redirects)
- `apps/web/src/store/reducers/{authSession.js, returnToPath.js, resetStore.js}`, `store/selectors/{getSignupState.js, getAuthSession.js}`, `store/actions/{login.js, loginWithService.js, logout.js, checkLogin.js, sendPasswordReset.js, fetchNotificationSettings.js, updateNotificationSettings.js}`
- `apps/web/src/util/{returnToPath.js, webView.js, cookieConsent.js}`, `contexts/CookieConsentContext.js`, `components/{CookiePreferencesPanel, CookieConsentLinker, GoogleButton}`
- `apps/backend/config/{routes.js, policies.js, passport.js, session.js}`
- `apps/backend/api/controllers/{SessionController.js, UserController.js, CookieConsentController.js}`, `api/policies/{checkJWT.js, sessionAuth.js}`
- `apps/backend/api/graphql/mutations/user.js`, `api/graphql/makeSchema.js`
- `apps/backend/api/services/{UserSession.js, Frontend.js, Email.js}`, `api/models/{User.js, UserVerificationCode.js, LinkedAccount.js}`
- `apps/backend/lib/{rateLimit.js, HyloJWT.js}`, `apps/backend/views/popupDone.ejs`
- `packages/shared/src/{Validators.js, constants.js}`
- `apps/web/public/locales/en.json`
