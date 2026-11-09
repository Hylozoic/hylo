# 25 — Mobile & desktop apps

> Module owner scope: the native mobile app (`apps/mobile-leap`, Expo / React Native) and the desktop app (`apps/desktop`, Electron): their structure, navigation, native screens, the native ⇄ web bridge, push, deep links, auth, version checks, and every place they differ from the web app. Feature behaviour that is shared with web is described in the feature modules and only cross‑linked here.

---

## 1. Overview

Hylo ships two "native" clients, and **both are thin shells around the web app** (`apps/web`):

| Client | Package | Tech | What is native | What is web |
|---|---|---|---|---|
| Mobile (iOS + Android) | `apps/mobile-leap` | Expo SDK 56, React Native 0.85, React 19.2, React Navigation 7 native‑stack, NativeWind 4 / Tailwind 3, urql, zustand | Logged‑out screens (Login, Forgot password, 5‑step Signup), invite/magic‑link handling, no‑internet screen, error screen, forced‑update alert, push notifications, token auth, Apple/Google sign‑in, deep links, Android hardware back, status‑bar/safe‑area theming | **Everything after login**: one full‑screen `react-native-webview` (`PrimaryWebView`) loading the production web app (`https://www.hylo.com/...`) |
| Desktop (macOS, Windows, Linux) | `apps/desktop` | Electron 39 + Electron Forge 7 | Window, title‑bar overlay with Back / Forward / Reload, OS notifications, dock badge count, `hylo://` protocol registration, external links → system browser | **Everything** — loads `https://hylo.com/login` in a `BrowserWindow` |

Consequences for a re‑implementation:

- There is **no native implementation of streams, posts, chat, messages, map, groups, settings, notifications list, search, tracks or funding rounds** in either shell. A user on mobile/desktop sees the web UI, using the web app's own responsive/mobile layout (see [06-app-shell-navigation.md](06-app-shell-navigation.md) for the compact/drawer layout, edge‑swipe nav drawer, mobile back chevron, etc.).
- Re‑implementing the mobile app = re‑implementing (a) the logged‑out native screens below, (b) the token‑auth + token→cookie bridge, (c) the WebView host with the message protocol in §6, (d) push/deep links. The web app must implement the "in‑WebView" behaviours in §7.
- The mobile app replaced an older bare React Native app (`apps/mobile`, removed from the repo; it had ~40 native screens with drawer + bottom tabs). It keeps the **same store listings / identifiers** (`com.hylo.HyloA`, `com.hylo.hyloandroid`). The web app still contains compatibility code for that "legacy WebView" (`isLegacyWebView()`), see §7.6.

Who uses it: any Hylo member on a phone/tablet (App Store / Google Play "Hylo") or desktop (beta Electron build).

---

## 2. Concepts & configuration

### 2.1 Mobile app identity (from `apps/mobile-leap/app.config.ts`)

| Setting | Value |
|---|---|
| Display name | `Hylo` |
| Expo slug | `hylo-mobile-leap` |
| URL scheme | `hyloapp` |
| Marketing version | `7.0.5` (`version`) |
| iOS bundle id | `com.hylo.HyloA` (App Store id `1002185140`, URL `https://apps.apple.com/us/app/hylo/id1002185140`) |
| Android package | `com.hylo.hyloandroid` (Play URL `https://play.google.com/store/apps/details?id=com.hylo.hyloandroid`) |
| Build number | iOS `buildNumber` / Android `versionCode` = `BITRISE_BUILD_NUMBER` or `BUILD_NUMBER` env (Bitrise CI); EAS production profile uses `autoIncrement` with `appVersionSource: remote` |
| Orientation | `portrait` only |
| `userInterfaceStyle` | `automatic` (follows OS light/dark for native chrome) |
| New Architecture | enabled (`newArchEnabled: true`) |
| iOS `supportsTablet` | `true` (iPad runs the same portrait UI; web content uses its tablet/compact layout) |
| App icon | `assets/icon.png` — dark grey plate with white merkaba (Hylo logo) |
| Android adaptive icon | foreground `assets/icon.png`, background `#333333` |
| Splash | `assets/merkaba_white.png`, `resizeMode: contain`, background `#0DC39F` (Hylo green) |
| Android compile/target SDK | 36 (build tools 36.0.0); `usesCleartextTraffic: true` |
| `ITSAppUsesNonExemptEncryption` | `false` (skips export‑compliance prompt) |
| iOS background modes | `remote-notification` (only when OneSignal is configured) |
| iOS entitlements | Associated domains `applinks:www.hylo.com`, `applinks:staging.hylo.com`, `applinks:hylo.com`; `aps-environment` = `development`/`production` (`ONESIGNAL_APN_MODE`); app group `group.com.hylo.HyloA.onesignal` |
| Android intent filter | `VIEW`, `autoVerify: true`, `https://www.hylo.com/*` and `https://staging.hylo.com/*`, categories `BROWSABLE`, `DEFAULT` (note: bare `hylo.com` is **not** in the Android filter, though it is in iOS associated domains) |
| Android permissions | `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, `CAMERA` (plus those added by plugins, e.g. notifications) |

Config plugins (in order): Intercom (only if `INTERCOM_APP_ID` + both API keys set), `onesignal-expo-plugin` (only if `ONESIGNAL_APP_ID`; adds the iOS Notification Service Extension), `expo-asset`, `expo-apple-authentication`, `expo-image-picker` (permission strings below), `expo-location`, `expo-build-properties` (extra iOS pods for Google sign‑in: AppAuth, GTMAppAuth, GTMSessionFetcher, GoogleUtilities, RecaptchaInterop with modular headers), `@react-native-google-signin/google-signin` (iOS URL scheme `com.googleusercontent.apps.<id>` derived from `IOS_GOOGLE_CLIENT_ID`), optional `expo-dev-client` (only when `USE_EXPO_DEV_CLIENT=true`), optional Sentry (when `SENTRY_ORG`/`SENTRY_PROJECT` set), and finally the local plugin `plugins/withReassertEntitlements` (re‑adds entitlements the OneSignal plugin drops).

### 2.2 Runtime configuration (`extra`, read via `expo-constants` in `src/config/index.ts`)

| Key | Default | Purpose |
|---|---|---|
| `API_HOST` | `http://localhost:3001` | Backend origin for REST + GraphQL (`${API_HOST}/noo/graphql`) |
| `HYLO_WEB_BASE_URL` | `http://localhost:3000` | Origin the WebView loads |
| `SESSION_COOKIE_KEY` | `hylo_session_cookie` | AsyncStorage key for the persisted session cookie string |
| `AUTH_DEBUG` | `false` | Verbose `[auth]` console logging (tokens masked as `abcdef…(len=N)`) |
| `IOS_GOOGLE_CLIENT_ID`, `WEB_GOOGLE_CLIENT_ID` | `''` | Google Sign‑In |
| `ONESIGNAL_APP_ID` | `''` | Push; empty disables all push code |
| `SENTRY_DSN_URL`, `SENTRY_DEV_DSN_URL` | `''` | Crash reporting; empty disables |
| `INTERCOM_APP_ID`, `INTERCOM_IOS_API_KEY`, `INTERCOM_ANDROID_API_KEY` | `''` | Support chat SDK (user identification only — no in‑app UI entry point in native code) |
| `MIXPANEL_TOKEN` | `''` | Analytics |
| `MAPBOX_TOKEN` | `''` | Geocoding for the signup location step |
| `eas.projectId` | env `EAS_PROJECT_ID` | EAS |

EAS build profiles (`eas.json`):

| Profile | Distribution | API_HOST / HYLO_WEB_BASE_URL | APN mode |
|---|---|---|---|
| `development` | internal, dev client, iOS simulator | (env / localhost) | development |
| `preview` | internal | `https://staging.hylo.com` | production |
| `staging` | extends `preview` | staging | production |
| `production` | store, `autoIncrement` | `https://www.hylo.com` | production |

Production CI is Bitrise: `scripts/bitrise-make-env.sh` → `configure.sh` → `bitrise-build.sh <ios|android>` (prebuild + `patch-ios-hylo-signing.sh` / `patch-android-hylo-signing.sh` + pods). `ios/` and `android/` folders are generated by `expo prebuild` and git‑ignored.

Sentry: release `hyloleap@<version>[+<build>]`; environment `local` (dev) / `staging` (API host contains "staging") / `production`; `reactNativeTracingIntegration({ traceFetch: true })`. A per‑launch `nativeSessionId` (`<base36 timestamp>-<8 random base36 chars>`) is set as Sentry tag `nativeSessionId` and injected into the web page (§6.1).

### 2.3 Permissions prompts (exact strings)

| Permission | Platform text | When requested |
|---|---|---|
| Photo library | iOS: "Allow Hylo to access your photos for profile pictures." | Signup step 2 → "Choose from library" |
| Camera | iOS: "Allow Hylo to use your camera for profile pictures." | Signup step 2 → "Take photo" |
| Location (when in use) | iOS: "Allow Hylo to use your location to find nearby content." | Signup step 3 mounts the location search (requests foreground permission immediately); also the WebView has `geolocationEnabled`, so web features using `navigator.geolocation` (map "locate me", location pickers) trigger the OS prompt via the WebView |
| Notifications | OS default text | Immediately after the first successful authenticated load (`useBindPlatformUser`): `OneSignal.Notifications.canRequestPermission()` → `requestPermission(true)` (iOS shows system prompt; Android 13+ shows POST_NOTIFICATIONS prompt) |

If any media/camera permission is denied, the picker silently does nothing. Denied location → proximity defaults to `0,0`.

### 2.4 Local persistence on device

| Store | Key | Content |
|---|---|---|
| Secure store (iOS Keychain / Android Keystore via `expo-secure-store`) | `hylo.tokens` | JSON `{access_token, refresh_token, token_type, expires_in, expires_at}`; `expires_at = now + (expires_in or 3600) * 1000` |
| AsyncStorage | `hylo_session_cookie` (configurable) | Serialized session cookie(s) `name=value; name2=value2` for the WebView |
| AsyncStorage | `hylo-i18n-lng` | Chosen locale, full form (e.g. `es-ES`) |
| AsyncStorage | `hylo-native-theme`, `hylo-native-color-scheme` | Last theme name/scheme reported by the web app (for native background colours) |
| AsyncStorage | `urql-app-cache`, `urql-app-metadata` | urql graphcache offline persistence (`@urql/storage-rn`) |
| WebView cookie jar | — | Mirror of the session cookie for `HYLO_WEB_BASE_URL` (WKWebView store on iOS) |
| WebView `localStorage` (web origin) | `hyloMobileReauthAttempts`, `hyloMobileRecovering` | Web‑side re‑auth bookkeeping (§6.4) |

---

## 3. Mobile navigation tree

React Navigation 7, all native‑stack navigators, `headerShown: false` unless stated. Root container uses the custom linking config (§5) and a global `navigationRef`.

```
NavigationContainer (linking = customLinking, navigationInChildEnabled)
└─ Root (native stack)
   ├─ AuthRoot            [only when isAuthorized]      → AuthNavigator
   │   └─ Main            PrimaryWebViewScreen (full-screen WebView of the web app)
   ├─ NonAuthRoot         [only when !isAuthorized]     → NonAuthNavigator
   │   ├─ Login           LoginScreen            (animation: none)
   │   ├─ ForgotPassword  ForgotPasswordScreen   (header: ModalHeader, title "Reset Your Password")
   │   └─ Signup          SignupNavigator        (animation: none)
   │       ├─ "Signup Intro"           SignupIntroScreen          (no header)
   │       ├─ SignupEmailValidation    title "Verify Email"
   │       ├─ SignupRegistration       title "STEP 1/3"
   │       ├─ SignupUploadAvatar       title "STEP 2/3"
   │       └─ SignupSetLocation        title "STEP 3/3"
   ├─ LoginByTokenHandler  LoginByTokenHandlerScreen (animation: none) — always mounted
   └─ (group, presentation: 'modal', header: ModalHeader)
       ├─ JoinGroup        JoinGroupScreen   (title "Joining Group..." — hard‑coded English)
       └─ Unknown          UnknownScreen     [__DEV__ builds only]
```

There are **no tabs, no drawers and no other native screens.** The tab bar, group rail, context menu, drawer, etc. users see after login are all web UI.

### 3.1 Auth‑state switching

Auth state comes from the shared `AuthProvider` (`packages/contexts/AuthContext.js`) which runs `meCheckAuthQuery` with `requestPolicy: 'network-only'`:

- `isAuthenticated` = `me` is non‑null.
- `isAuthorized` = authenticated **and** `me.emailValidated` **and** `me.hasRegistered` **and** not `me.settings.signupInProgress`.

`RootNavigator`:
1. While the very first auth fetch is in flight → centred `ActivityIndicator` on the theme background colour (no navigation container yet). Later background refetches do **not** re‑show this (guarded by `hasCompletedInitialAuthFetch`) so the WebView is never unmounted by a refetch.
2. Renders exactly one of `AuthRoot` / `NonAuthRoot` (React Navigation swaps stacks automatically when `isAuthorized` changes, with default animation).
3. `NonAuthNavigator` watches `isAuthenticated`: as soon as a user is authenticated but not yet authorized (mid‑signup), it navigates to `Signup`, where `useSignupWorkflow` jumps to the right step (§4.3).

### 3.2 App start sequence

1. Native splash (green `#0DC39F` + white merkaba).
2. `App`: `GestureHandlerRootView` (bg = theme background) → `SafeAreaProvider` → Sentry `ErrorBoundary` → `AppProviders`. Status bar `style='auto'`.
3. `AppProviders` waits for: urql client creation (loads tokens from secure store), locale hydration (`hylo-i18n-lng`), theme hydration. Meanwhile shows centred `ActivityIndicator` + muted text **"Starting…"** (hard‑coded English).
4. OneSignal is initialised once the urql client exists (§8).
5. `<AuthProvider authAdapter={mobileAuthAdapter}>` → `<VersionCheck/>` (§9) + `<RootNavigator/>`.

### 3.3 Error boundary

Any uncaught render error → full screen, theme background, centred:
- Text (xl, medium): **"Oops. Something Went Wrong"** (`Oops Something Went Wrong`)
- Native `Button`: **"Restart Hylo"** → clears all AsyncStorage **except** the session cookie key, then `reloadAppAsync('ErrorBoundary restart')`. Error is reported to Sentry.

---

## 4. Native screens (UX specification)

Colour tokens: native screens use the NativeWind token set ported from the old app (`src/style/global.css`; same HSL values as web light theme — `--selected: 145 50% 62%` ≈ `#33D089` "Hylo green", `--destructive: 0 84.2% 60.2%`, `--border: 240 5.9% 90%`, `--muted-foreground: 240 3.8% 46.1%`, `--radius: 0.5rem`; a `.dark` variant exists but the auth screens hard‑code `bg-white`). Auth screens therefore always render **light** (white background, green accents) regardless of OS dark mode. Fonts: system font. Icons: Entypo (`@expo/vector-icons`) and a custom `hylo-evo-icons.ttf` glyph (Google "G", code point 59673).

### 4.0 Shared auth widgets (`components/auth/AuthScreenParts.tsx`)

| Widget | Look | Behaviour |
|---|---|---|
| `AuthBanner` | Full‑width strip pinned to the top (absolute, z‑10), padding‑top = safe‑area top + 8 px, 16 px horizontal / 8 px vertical padding, centred white text. Background `selected` green (status) or `destructive` red (error) | Displays one message; error banner wins over status banner |
| `AuthInput` | Optional label (sm, foreground 80 %, 4 px below) above a row: rounded‑md 1 px border (`border` grey; **green** when `valid`), 12 px horizontal padding, min height 44 px, text base. Trailing green `check` icon (20 px, `#33D089`) when valid and no accessory; or the given right accessory | `autoCapitalize: none`, `autoCorrect: false`; wrapper has 16 px horizontal margin, 16 px bottom margin |
| `AuthPrimaryButton` | Full‑pill (`rounded-full`), 16 px side margin, 12 px vertical padding, white text lg. Background green; grey (`muted-foreground` 70 %) when disabled/loading | Disabled when `disabled \|\| loading` |
| `FormattedError` | Centred red pill (`bg-destructive`, rounded‑full, 16×8 padding), small white centred text | Message mapped through `errorMessages()` (§4.6) then `t()` |
| `SignupFlowLayout` | Whole screen green (`bg-selected`); 20 px padded header block: title (xl bold white) + optional subtitle (sm, white 80 %); content area flex‑1 with 20 px side padding; optional footer bar (`bg-white/20`, 12 px padding, row) | Keyboard‑avoiding (iOS `padding`, offset = header height) |
| `SignupFlowButton` | Pill, 24×10 padding. `continue`: white bg, green semibold label, pushed right (`ml-auto`). `back`: white 40 % bg, white label. 50 % opacity when disabled | |
| `LocaleSelector` | White rounded‑md bordered chip, 12×8 padding, xs text: `🌐 Language: 🇺🇸 English` (or compact `🌐 🇺🇸`). Tap toggles a dropdown (absolute, 40 px below, min‑width 200, white, bordered) listing the 7 UI locales `flag + translated name`; selected row green with white text | Selecting changes i18n language, persists to `hylo-i18n-lng`, and if a user is loaded also saves `settings.locale` via `updateUserSettings` |

UI locales (`@hylo/shared` `UI_LOCALES`): `en-US` 🇺🇸 "English", `en-GB` 🇬🇧 "English (UK)", `es-ES` 🇪🇸 "Spanish", `de-DE` 🇩🇪 "German", `fr-FR` 🇫🇷 "French", `hi-IN` 🇮🇳 "Hindi", `pt-BR` 🇵🇹 "Portuguese" (note: pt‑BR is shown with the Portugal flag). Default before anything is stored: `en-US`. The device OS language is **not** auto‑detected.

### 4.1 Login (`screens/Login/LoginScreen.tsx`, route `NonAuthRoot/Login`)

Layout (white background, keyboard‑avoiding, vertically centred scroll content, bottom padding = safe‑area bottom):
1. `LocaleSelector` (full form), left‑aligned, 16 px side padding, top margin safe‑area + 8.
2. Logo `merkaba-green-on-white.png` 80×80, top margin `max(0, (windowHeight − 580) × 0.4)`, 10 px bottom margin.
3. Title (2xl bold, green): **"Log in to Hylo"**.
4. `AuthInput` label **"Email address"** (email keyboard, return key "next" → focuses password). Green check appears when `validator.isEmail` passes.
5. Row: "Password" (sm) on the left, **"Forgot your password?"** (sm, green link) on the right → `ForgotPassword`.
6. Password `AuthInput` (no label, secure, return key "go" submits) with eye toggle (Entypo `eye` / `eye-with-line`, 20 px, `#888`).
7. `FormattedError` (action "Login").
8. `AuthPrimaryButton` **"Log In"** — disabled until the email is valid (password may be empty; server then answers "no password provided" → "Please enter your password").
9. `SocialAuth` block (§4.4).
10. Footer row: "Don't have an account?" + bold green **"Sign up now"** → `Signup`.

Behaviour:
- On submit: status banner **"LOGGING IN..."**; `useAuth().login({email,password})` → `mobileAuthAdapter.login` → `POST /noo/login/native` (§10.1) → tokens saved → `checkAuth()`; when `isAuthorized` flips the root swaps to the WebView. On failure the banner is cleared and the server's text (e.g. `Incorrect email or password`) is shown via `FormattedError`.
- Route params `bannerMessage` / `bannerError` (e.g. from Forgot password or a bad magic link) are shown as banners each time the screen gains focus; typing in the email clears all errors/banners.
- Test IDs: `login-screen`, `login-email-input`, `login-password-input`, `login-submit-button` (used by Maestro flows `.maestro/login-*.yaml`).

### 4.2 Forgot password (`ForgotPassword`)

Header: `ModalHeader` — bordered bottom, background `background`, 16 px sides, padding‑top 56 px: left **"Back"** (primary colour) → goBack; centred semibold title **"Reset Your Password"**; 48 px spacer right.

Body (white): paragraph `forgotPasswordDescription` = "Enter your email address below and we'll send you an email message with a link for resetting your password."; `FormattedError` (action "Reset Password"); email `AuthInput` **"Email address"** (hidden while an error is showing — the input reappears only after leaving the screen); `AuthPrimaryButton` **"Send"** (disabled until valid / while submitting).

Submit → GraphQL `sendPasswordReset(email) { success }`. If `success` is false: error "There was a problem with your request. Please check your email and try again." On success → navigate to `Login` with green banner "A link to reset your password has been sent to you at {{email}}". The emailed link is a JWT magic link handled by §4.7.

### 4.3 Signup flow

Mirrors the web signup ([04-accounts-auth-onboarding.md](04-accounts-auth-onboarding.md)) but as native screens. **Differences from web:** no separate welcome‑wizard/agreements screens natively (those appear later inside the WebView if applicable); step titles "STEP 1/3 … 3/3"; avatar upload via native picker/camera; location via native Mapbox search.

**Step routing (`useSignupWorkflow`, runs on focus of Signup Intro):** if `me.settings.signupInProgress`:
- not `emailValidated` → `SignupEmailValidation`
- else not `hasRegistered` → `SignupRegistration`
- else no avatar or avatar is a Gravatar default (`https://www.gravatar.com/avatar/…`) → `SignupUploadAvatar`
- else → `SignupSetLocation`

Otherwise, if the route has `step=verify-email` and `email` → `SignupEmailValidation`.

Stack headers for steps: background `#33D089`, white bold title, no shadow, white tint, back label **"Back"** (native back chevron).

#### 4.3.1 Signup Intro (`"Signup Intro"`)
- White screen; compact `LocaleSelector` floating top‑left (safe top + 8, 12 px left).
- Hero `ImageBackground` (`signin_background.png`, cover), height = 25 % of window height + (iOS 20 / Android 60) + safe top; content bottom‑aligned, 20 px bottom padding: white merkaba 97×97, **"Welcome to Hylo"** (2xl bold white, 16 px top), "Stay connected, organized, and engaged with your group." (base, white 90 %, centred, 20 % side padding).
- Body (24 px padding): "Enter your email below to get started!" (foreground 80 %); bordered email `TextInput` (no label); `FormattedError` (action "Signup"); `AuthPrimaryButton` **"Continue"** (shows **"Saving..."** while sending; disabled until valid email); `SocialAuth forSignup`; row "Already have an account?" + bold green **"Log in now"** (replaces with Login); 32 px gap then centred small text "Your data is safe with Hylo. By clicking the "Sign Up" button above you are agreeing to these terms:" and bold green link **"Terms of Service + Privacy Policy"** → `https://www.hylo.com/terms` (opens externally — it is a static page, §5.3).
- Status banner **"SIGNING UP..."** while submitting.
- Submit → GraphQL `sendEmailVerification(email)`. On `success` → Mixpanel `SIGNUP_EMAIL_VERIFICATION_SENT` → `openURL('/signup/verify-email?email=…')`. If not success → error "An account may already exist for this email address, Login or try resetting your password".
- Route params `email`, `error`, `bannerError` pre‑fill (e.g. `error=invite-expired` from §4.8 shows "Sorry, your invitation to this group is expired, has already been used, or invalid. Please contact a group moderator for another one.").

#### 4.3.2 Verify Email (`SignupEmailValidation`, header "Verify Email")
- `SignupFlowLayout` title **"Check your email"**, subtitle "We've sent a 6 digit code to: {email}".
- 6‑cell code field (`react-native-confirmation-code-field`): each cell 44×48, rounded, 1 px border (white when focused, white 40 % otherwise), xl white centred digit, 10 px gaps, number pad, iOS `oneTimeCode` autofill. Blurs automatically when filled.
- Auto‑submits when 6 digits are entered (and immediately on focus if a `token` route param is present — from an emailed verify link).
- **"Resend code"** (white text) → `sendEmailVerification` again.
- Mutation `verifyEmail(email, code, token) { me {…} error }`. Errors: `invalid-link` → replace with Signup Intro with banner "Link expired, please start over"; other `error` strings (e.g. `invalid-code` → "Invalid code, please try again") shown in `FormattedError`; thrown errors → "Expired or invalid code". Success → Mixpanel `SIGNUP_EMAIL_VERIFIED` → `SignupRegistration`.
- If no `email` param → replace with `Signup`.

#### 4.3.3 STEP 1/3 — Registration
- Title **"Let's do this!"**, subtitle = current user email.
- Fields (label sm white 80 %, input rounded‑lg, white 90 % bg, 1 px white 30 % border, 12 px padding): **"Your Full Name"**, **"Password (at least 9 characters)"** (secure), **"Confirm Password"** (secure).
- Footer `SignupFlowButton` **"Continue"** ("Saving..." while loading), disabled until name non‑empty.
- Client validation: password length < 9 → "Password must be at least 9 characters"; mismatch → "Passwords must match". Then mutation `register(name, password) { me { id name email } }` → Mixpanel `SIGNUP_REGISTERED` → step 2.

#### 4.3.4 STEP 2/3 — Upload a Photo
- Title **"Upload a Photo"**. Centred 138×138 circle (white 40 %): either the chosen/current avatar (cover) or an Entypo `camera` icon (48 px, white 60 %). While uploading, a spinner overlays (black 30 %).
- Tap → native `Alert` "Choose photo" with buttons **"Choose from library"**, **"Take photo"** (front camera), **"Cancel"** (these strings are hard‑coded English, not translated).
- Picked image (quality 0.9, single image, copied to cache) is shown immediately, then uploaded (§10.4, `type=userAvatar`, `id=<userId>`). Upload failure → Alert "Upload failed" + message.
- Footer **"Continue"** (disabled while uploading) → `updateUserSettings({ changes: { avatarUrl } })` → step 3. Avatar may be left unchanged (Continue saves whatever is current).

#### 4.3.5 STEP 3/3 — Add your location
- Title **"Add your location"**, subtitle "Add your location to see more relevant content and find people and projects near you."
- Row: bold white "Selected:" (hard‑coded) and, when a location is set, an Entypo `cross` to clear it. Below: the selected full text or "(None selected)" (hard‑coded).
- When none selected: `LocationSelector` card (white 80 %, rounded‑2xl, 8 px padding) containing a white rounded input with placeholder **"Search for your location"** (green text, placeholder `#33D08999`), spinner while loading, and a scrollable (max 280 px) list of result rows (top border green 20 %, 12 px padding, green base text).
  - Requests foreground location on mount to bias results (`proximity=lng,lat`, else `0,0`).
  - Debounce 300 ms; Mapbox geocoding `https://api.tiles.mapbox.com/geocoding/v5/mapbox.places/<term>.json?access_token=…&autocomplete=true&proximity=…`. If the term parses as a coordinate, reverse‑geocodes it and prepends a raw coordinate row.
  - First row for a free‑text term: `Use "<term>" (without mapping)` → selects `{ id: null, fullText: term }`.
  - Geocoded rows → `findOrCreateLocation` (shared hook) → location object `{id, fullText}`.
- Footer: **"< Back"** (back variant) and **"Finish"** → `updateUserSettings({ location, locationId, settings: { signupInProgress: false, locale: <current UI locale> } })` → Mixpanel `SIGNUP_COMPLETE` (respects analytics consent). `isAuthorized` becomes true on the next auth refetch, and the root swaps to the WebView, which lands on `/app` → web default route (new users then see web onboarding/welcome flows, see module 04).

### 4.4 Social sign‑in (`components/SocialAuth.tsx`)
Block: small muted text **"Or connect with:"**, then:
- **iOS only:** native `AppleAuthenticationButton` (type SIGN_IN or SIGN_UP, style BLACK, corner radius 8, 260×44, 10 px below). Requests `FULL_NAME` + `EMAIL`; posts `{user, identityToken, email, fullName}` to `POST /noo/login/apple/oauth` with header `X-Hylo-Token-Auth: 1` → token pair saved. User cancel (`ERR_REQUEST_CANCELED`) is silent. Failure → error banner "Could not sign in with your Apple account". Apple sign‑in is **not offered on Android**.
- **Both platforms:** Google button — red `#dd4b39` rounded rectangle, min‑width 65 %, min height 40, white "G" glyph (16 px) + bold white **"Sign in with Google"** / **"Sign up with Google"**. Uses native Google Sign‑In (`hasPlayServices` on Android), then `POST /noo/login/google-token/oauth?access_token=<google access token>` with `X-Hylo-Token-Auth: 1`. Failure → "Could not sign in with your Google account".
- In Expo Go (not shipped) Google is replaced by a note.
- After either: banner cleared, `checkAuth()`. New social users are created with `email_validated: true` and still go through registration/avatar/location steps if `signupInProgress`.

Web offers the same providers through popup OAuth ([04-accounts-auth-onboarding.md](04-accounts-auth-onboarding.md)); mobile never uses the web login page.

### 4.5 No Internet Connection
Shown instead of the WebView when the device is offline **before the current user has ever loaded in this session**, or when the WebView reports a load error while offline. Full‑screen safe‑area, theme `bg-background`, centred column with 32 px side padding:
- **"No Internet Connection"** (xl semibold)
- "Hylo requires an internet connection to work. Please check your connection and try again." (muted, 32 px below)
- Pill `Button` **"Retry"** (green bg, min‑width 50 %).
Automatically retries when NetInfo reports connected + reachable. (`isInternetReachable === null` is treated as reachable.)

### 4.6 Error message mapping (`util/errorMessages.ts`)
Server error strings (or JSON `{error}`) are mapped to user copy (English, then passed to `t()`):

| Code | Message |
|---|---|
| `no user` | "`<action>` was canceled or no user data was found." |
| `no email`, `no email provided`, `invalid-email` | "Please enter a valid email address" |
| `duplicate-email` | "Account already exists" |
| `no password provided` | "Please enter your password" |
| `email not found` | "Email address not found" |
| `Incorrect email or password` | "Incorrect email or password. If you signed up with Google or Apple, log in that way instead, or reset your password." |
| `invalid-code` | "Invalid code, please try again" |
| `invalid-link` | "Link expired, please start over" |
| `Too many attempts. Please wait a few minutes and try again.` | (same) |
| `invite-expired` | "Sorry, your invitation to this group is expired, has already been used, or invalid. Please contact a group moderator for another one." |
| anything else | the raw string |

### 4.7 LoginByTokenHandler (magic links)
Matched path `/noo/login/(jwt|token)` (e.g. password‑reset email links `https://www.hylo.com/noo/login/jwt?token=…&n=…` opened via universal link). Shows `LoadingScreen` (large spinner on theme bg) and:
1. Stores `n` (decoded) or `/` as the post‑login return path.
2. If not authorized: with `token` → `POST /noo/login/jwt` (`Authorization: Bearer <jwt>`, `X-Hylo-Token-Auth: 1`) → token pair saved → `checkAuth()`. With `t`/`loginToken` + `u`/`userId` → `POST /noo/login/token` → **always fails now** (backend returns 422 "Link expired" for non‑GET; legacy pre‑March‑2025 links no longer log in).
3. On any failure → `openURL('/login?bannerError=invalid-link')` → Login with red banner "Link expired, please start over".
4. Pops itself if possible; once authorized, opens `/`.
For password resets, the `n` target is typically the web password settings page, so the user lands inside the WebView on "set a new password".

### 4.8 JoinGroup (invite links)
Matched paths: `/groups/:groupSlug/join/:accessCode`, `/invite/:accessCode`, `/view/:accessCode`, `/h/use-invitation?token=…`. Presented modally with a `ModalHeader` titled "Joining Group..." and a spinner body.
- Authorized: `useInvitation(invitationToken, accessCode)` → refetch current user → open `/groups/<slug>` in the WebView. Failure → go back (or open `/`).
- Not authorized: `checkInvitation` query. Valid → store the original link as the return‑to path and reset to `/signup?message=Signup or login to join this group.` (note: the `message` param is not displayed by Signup Intro). Invalid → reset to `/signup?error=invite-expired` (red error pill, §4.6).
- Neither token nor code → error, go back.
After the user logs in/finishes signup, the stored link is replayed and the join completes. See [10-joining-invitations.md](10-joining-invitations.md) for server rules.

### 4.9 Unknown (dev only)
In `__DEV__` builds only, unmatched paths route to a screen reading "Unknown route" plus the JSON of route params. In production every path falls through to the WebView (§5).

---

## 5. Deep links, universal links & URL routing (mobile)

### 5.1 Entry points
| Source | Example | Delivered as |
|---|---|---|
| iOS Universal Link | `https://www.hylo.com/groups/foo/post/123` (also `hylo.com`, `staging.hylo.com`) | `Linking` URL |
| Android App Link (auto‑verified) | `https://www.hylo.com/...`, `https://staging.hylo.com/...` | `Linking` URL |
| Custom scheme | `hyloapp://www.hylo.com/...`, `hyloapp://staging.hylo.com/...`, `hyloapp://hylo.com/...`, `hyloapp://<path>` | `Linking` URL |
| Push notification tap | OneSignal `additionalData.path` → `https://www.hylo.com<path>` (falls back to `launchURL`) | stored as "initial URL" then opened |
| Links clicked inside the WebView | handled by WebView navigation policy (§6.3), not by the router |

Recognised prefixes (stripped before matching): `https://www.hylo.com`, `https://staging.hylo.com`, `hyloapp://www.hylo.com`, `hyloapp://staging.hylo.com`, `hyloapp://hylo.com`, `hyloapp://`.

### 5.2 Routing table (`navigation/linking/config.ts`)
Paths are lower‑cased and matched in order with `path-to-regexp` (case‑insensitive):

| Path pattern | Screen |
|---|---|
| `/login` | `NonAuthRoot/Login` |
| `/reset-password` | `NonAuthRoot/ForgotPassword` |
| `/signup/:step?` | `NonAuthRoot/Signup/Signup Intro` |
| `/noo/login/(jwt\|token)` | `LoginByTokenHandler` |
| `/oauth/consent/:uid`, `/oauth/login/:uid` | `NonAuthRoot/Login` (in practice pre‑empted by the OIDC gate, §5.4) |
| `/groups/:groupSlug/join/:accessCode` | `JoinGroup` |
| `/invite/:accessCode`, `/view/:accessCode`, `/h/use-invitation` | `JoinGroup` |
| `:path(.*)` (everything else) | `AuthRoot/Main` (the WebView) |

`getStateFromPath` builds the navigation state and appends query params: the original query string, the matched path params, `pathMatcher`, and (except for the magic‑link route) `originalLinkingPath=<encoded pathname+search>`. Context normalisation: `context=all` → `my`; `context` of `public`/`my` is copied into `groupSlug`. **Important:** because paths are lower‑cased, any mixed‑case path or query value inside `originalLinkingPath` is lower‑cased before reaching the WebView (search string is preserved separately via `url.search`, but `originalLinkingPath` uses the lower‑cased pathname).

**Not‑authorized gate:** if the target is under `AuthRoot` and the user is not authorized, the path is saved as `returnToOnAuthPath` and navigation is suppressed (user stays on Login/Signup). After login, `useReturnToOnAuthPath` (in `AuthNavigator`) opens it.

### 5.3 `openURL` helper (used by native code)
- OIDC URLs → system browser (§5.4).
- URLs whose origin is a known prefix (or `hyloapp://` with a known host) **and** whose path is not a static marketing page are routed in‑app. Static pages: `''` (root), `/help`, `/help/markdown`, `/about`, `/about/careers`, `/about/contact`, `/about/team`, `/evolve`, `/invite-expired`, `/subscribe`, `/styleguide`, `/team`, `/terms`, `/terms/privacy`, `/privacy`, `/newapp`. Options: `reset` (replace whole stack) / `replace`.
- Everything else → `Linking.openURL` (system browser / other app), unless it is an Expo dev‑client URL.

### 5.4 OIDC gate
When Hylo itself acts as an OAuth/OIDC provider (third‑party "Sign in with Hylo", see [24-integrations-api-embeds.md](24-integrations-api-embeds.md)), App Links may hand `https://www.hylo.com/oauth/...`, `/noo/oauth...` or `/noo/oidc...` URLs to the app. These are **never handled in‑app**: on cold start or while running, the app immediately re‑opens the same URL in the system browser and routes nothing.

### 5.5 Cold start & queued links
- `getInitialURL` never returns a URL to React Navigation directly; it stores it (`initialURL`) unless it's an Expo dev‑client URL. `useOpenInitialURL` opens it once auth has resolved (in `NonAuthNavigator` and `AuthNavigator`).
- Notification taps also set `initialURL`; the `AuthNavigator` opens it, which re‑targets `Main` with a new `originalLinkingPath` → the WebView navigates (full page load) to that path.

### 5.6 What the WebView loads
`PrimaryWebView` path = `originalLinkingPath` || `path` param || **`/app`**. `HyloWebView` URL = `HYLO_WEB_BASE_URL + path` (+ `postId=<id>` query appended if a `postId` route param exists and the URL has none). `/app` is not a web route: the web app's authenticated catch‑all redirects it to the user's last‑viewed group path (see [06-app-shell-navigation.md](06-app-shell-navigation.md)).

---

## 6. The WebView host and native ⇄ web bridge

### 6.1 `HyloWebView` configuration
| Property | Value / behaviour |
|---|---|
| Source | `{ uri, headers: { cookie: <session cookie string>, 'X-Hylo-Mobile': 'v2' } }` (header is informational; backend does not branch on it) |
| `injectedJavaScriptBeforeContentLoaded` | `window.HyloMobileAppVersion="7.0.5";window.HyloNativeSessionId="<id>";window.HyloWebView=true;window.HyloMobileV2=true;true;` followed by Sentry's script which writes `sentry-trace`/`baggage` `<meta>` tags (only for hosts `hylo.com`, its subdomains, and the configured web host) |
| `injectedJavaScript` (after load) | Adds a `<style>`: hide all scrollbars; `html, body { overflow:hidden; width:100%; margin:0; padding:0 }`; `body { width:100vw; position:fixed; left:0; right:0; max-width:100% }` — the document never scrolls; scrolling happens inside web containers |
| Flags | `geolocationEnabled`, `nestedScrollEnabled`, `hideKeyboardAccessoryView` (iOS: no ‹ › Done bar above keyboard), `scalesPageToFit={false}`, `scrollEnabled` (true for Primary), `setSupportMultipleWindows`, `sharedCookiesEnabled`, `originWhitelist` `https://*`, `http://*`, `mailto:*`, `tel:*`, `intent:*`; style `flex:1; opacity:0.99` (Android rendering workaround) |
| Native pull‑to‑refresh | **not used** — implemented by the web app (§7.3) |

### 6.2 Screen chrome around the WebView (`PrimaryWebViewScreen`)
- `SafeAreaView` with edges top/left/right; bottom padding applied manually: iOS `max(insetBottom × 0.5, 8)`, Android full `insetBottom` (so Android 3‑button/gesture bar never overlaps).
- Background = current theme background colour (§6.6), so safe areas match the web page.
- Status bar: `light-content` when the web theme is dark, else `dark-content`.
- **Loading overlay** (absolute, theme bg, large spinner) shown while any of: logging out, current user not yet loaded, session cookie being resolved, WebView page loading, session recovery in progress. The web page's own boot loader then takes over (web `index.html`), so there is no white flash.
- Current user is fetched natively (`useCurrentUser`, cache‑and‑network; paused when offline). If that query errors before any user was loaded → native logout.

### 6.3 Link / window policy inside the WebView
`onShouldStartLoadWithRequest`:
- `about:blank` → load.
- Same origin as `HYLO_WEB_BASE_URL`, or `https://hylo.com`, `https://www.hylo.com`, `https://staging.hylo.com` → load in the WebView.
- Sub‑frame (`isTopFrame=false`) `https` URLs on `youtube.com`, `youtube-nocookie.com`, `vimeo.com`, `soundcloud.com` (and subdomains) → load (inline video/audio embeds). Other iframes (e.g. Spotify embeds) are blocked.
- Everything else → cancelled and opened externally: `http(s)`, `mailto:`, `tel:` as‑is; Android `intent://host/path#Intent;…` → `https://host/path` if that looks like a web URL, else its `S.browser_fallback_url`, else ignored; `javascript:` and unknown schemes ignored.

`onOpenWindow` (`target=_blank` / `window.open`): Hylo URL → `window.location.assign(url)` in the same WebView; anything else → external.

So on mobile, **external links always leave the app** (Safari/Chrome or the target app), and there are no in‑app browser tabs or multiple windows.

### 6.4 Message protocol
Messages are JSON strings `{ type, data }`. Web → native via `window.ReactNativeWebView.postMessage`; native → web via `webView.postMessage` (web listens on `window` `message`, capture phase). Constants in `packages/shared/src/constants.js` `WebViewMessageTypes`.

| Type | Direction | Sent when | Native/web handling |
|---|---|---|---|
| `LOGOUT` | web → native | User taps Logout in web (context menu "Logout" view or global nav user menu); or web gave up re‑auth after 3 attempts | Native shows loading overlay, unmounts WebView, `useLogout`: GraphQL `logout` mutation, revoke refresh token (`POST /noo/oauth/token/revocation`), clear secure‑store tokens, clear cookie (AsyncStorage + WebView jar), OneSignal `logout`, Intercom `logout`, Mixpanel flush+reset, Google `signOut` → root swaps to Login |
| `VERIFY_AUTH` | web → native | Web's `checkLogin` returned anonymous inside v2 WebView | Native "session recovery": `POST /noo/session/from-token` with bearer (refreshing tokens once on 401); on success re‑sync cookies and reply `SESSION_READY`; on failure clear cookie + native logout |
| `SESSION_READY` | native → web | After successful re‑mint | Web re‑runs `checkLogin` in place (no reload) |
| `AUTH_SUCCESS` | web → native | Web `checkLogin` succeeded | Native clears the recovery overlay |
| `CAN_EXIT_APP` | web → native | Android back pressed with nothing left to go back to (§7.2) | `BackHandler.exitApp()` (Android) |
| `THEME_CHANGE` | web → native | Every time web applies appearance (`applyAppearanceToDocument`) | Native stores `{themeName, colorScheme}` → updates background/status bar (§6.6) |
| `JOINED_GROUP` | web → native | Web join button in GroupDetail (`isWebView()`) | **Ignored** by v2 native (logged in dev) |
| `GROUP_DELETED`, `LEFT_GROUP` | web → native | Only for legacy WebView (`isLegacyWebView()`) | Not handled by v2 |
| `NAVIGATION` | — | Deprecated, unused | — |
| `EDITOR.*` (`BLUR`, `CLEAR_CONTENT`, `FOCUS`, `LOADED`, `ON_ADD_LINK`, `ON_ADD_TOPIC`, `ON_CHANGE`, `ON_ENTER`, `SET_PROPS`) | both | Only by the legacy embedded editor route `/hyloApp/editor` | Not used by the v2 app (dead path kept for old app versions) |

Android hardware back is delivered as a DOM event, not a postMessage: native injects `window.dispatchEvent(new CustomEvent('hylo-hardware-back'))` and consumes the key press.

### 6.5 Authentication model (token + cookie bridge)
1. Native login methods all yield an OAuth token pair from the backend's built‑in OIDC provider for public client `hylo-mobile` (scope `openid offline_access email profile`; access token **opaque**, TTL 1 h; refresh token 180 days; grant TTL 14 days per provider config). Stored in secure store.
2. Native GraphQL (urql) sends `Authorization: Bearer <access>`; refreshes proactively when within 60 s of `expires_at`, or on HTTP 401 / `UNAUTHENTICATED`. Refresh = `POST /noo/oauth/token` (`grant_type=refresh_token`, `client_id=hylo-mobile`), single‑flight shared with the WebView bridge. A 4xx refresh failure clears tokens (→ logged out); network errors keep them.
3. Before the WebView loads (and on each focus of the screen), native calls `POST /noo/session/from-token` (Bearer). Backend validates the access token, **regenerates** the session (never reuses whatever cookie the WebView had) and logs the user in → `Set-Cookie`. Native merges the cookie into AsyncStorage and writes each cookie into the WebView jar for `HYLO_WEB_BASE_URL` with `path=/`, `secure` for https, `domain=.<registrable domain>` (e.g. `.hylo.com`; omitted for localhost/IP).
4. The web app inside the WebView authenticates purely with that cookie (`credentials: same-origin`), exactly as in a browser.
5. Any `Set-Cookie` on native GraphQL responses is also persisted/synced (legacy behaviour).
6. If no cookie could be obtained and the page isn't loading, after 2 s native clears the cookie and logs out.

The web never sees tokens. Social/Apple/JWT endpoints mint tokens only when the request carries `X-Hylo-Token-Auth: 1` and then create **no** cookie session (to avoid a stray cookie leaking into the WebView jar).

### 6.6 Theme sync
Native keeps a copy of the web theme palette (background/foreground HSL) for: `default`, `stone`, `forest`, `ocean`, `desert`, `snow`, `jungle`, `blossom`, `fall` × `light`/`dark` (values mirror `apps/web/src/themes`; default light background `hsl(39 20% 88%)`, dark `hsl(39 3% 18%)`). On `THEME_CHANGE` it recomputes `backgroundColor` (used for root view, safe areas, loading screens) and status bar style, and persists the choice so the next cold start paints the right colour before the web loads. Unknown theme → `default`; unknown scheme → `light`. Theme selection UI itself is web ([08-design-system-i18n.md](08-design-system-i18n.md), [05-user-settings.md](05-user-settings.md)).

### 6.7 Locale sync
On first authenticated load (`useBindPlatformUser`): if the account has `settings.locale` it becomes the native UI locale; otherwise the native locale (chosen on Login/Signup) is saved to the account. The web app inside the WebView reads the account locale itself. Changing language later is done in web settings; native only picks it up again on the next launch/user bind.

### 6.8 App Link association files (served by the web app)
- `apps/web/public/.well-known/apple-app-site-association`: app id `L4KZBPS2F3.com.hylo.HyloA`; components in order: include `/noo/login/token`, include `/noo/login/jwt`, **exclude** `/noo/*`, **exclude** `/oauth/*` (so third‑party OIDC sign‑in completes in the browser), include `*`.
- `apps/web/public/.well-known/assetlinks.json`: `delegate_permission/common.handle_all_urls` for `com.hylo.hyloandroid` with two SHA‑256 signing fingerprints (upload key + Play signing key). Android cannot exclude paths, hence the in‑app OIDC gate (§5.4).

Effect: on a phone with the app installed, tapping almost any `https://www.hylo.com/...` link (email notifications, shared post links) opens the app at that path instead of the browser.

---

## 7. Web‑app behaviour when running inside the mobile WebView

The web app detects its host via globals injected before load:

| Helper (`apps/web/src/util/webView.js`) | Meaning |
|---|---|
| `isWebView()` | `window.ReactNativeWebView` exists (any Hylo app, old or new) |
| `window.HyloMobileV2` | current (Expo) app |
| `isLegacyWebView()` | WebView without `HyloMobileV2` (old bare‑RN app still in the field) |
| `getMobileAppVersion()` | `window.HyloMobileAppVersion` or `''` |

Behaviours (all other UI is identical to the mobile‑web/compact layout described in the feature modules):

### 7.1 Auth & boot (RootRouter)
- In v2, while `checkLogin` is unknown, or during recovery, or when unauthorized, the web shows only a **full‑screen spinner** — never the login page or the bootstrap skeleton (native owns login UI).
- Re‑auth handshake: on every `checkLogin` result — authorized → reset counters, post `AUTH_SUCCESS`, open the websocket; unauthorized → mark recovering, increment `hyloMobileReauthAttempts` (localStorage) and post `VERIFY_AUTH`; on reaching **3** attempts → reset and post `LOGOUT`. `SESSION_READY` from native re‑runs `checkLogin` without reload.
- Socket.io (sails) in v2: `autoConnect=false` and the cross‑origin `__getcookie` handshake disabled; the socket is connected only after `checkLogin` succeeds (`connectSocket()`), and the 30 s `/noo/heartbeat` starts then.
- Logout in v2 (`logoutFromMobileWebView`): set a `__hyloMobileUserLogout` guard (RootRouter renders a spinner so auth routes don't re‑render with an empty store), post `LOGOUT`, dispatch the web logout. In a browser: logout then redirect to `/login`.

### 7.2 Android hardware back (`useMobileHardwareBack`, v2 only)
On each `hylo-hardware-back` event, the first applicable action wins:
1. Nav drawer open → close it (remember "closed by back").
2. Side drawer open → close it.
3. Registered overlay handlers (most recently mounted first; e.g. create‑post modal, post dialog) → let them close.
4. Any open Radix dialog (`[role=dialog][data-state=open]`) → synthesize `Escape`.
5. If the nav was just closed by back and the current view is a primary (no back chevron) view → post `CAN_EXIT_APP` (app exits).
6. Otherwise perform the same action as the header back chevron (`useMobileNavBack` / `performMobileNavBack`); if nothing was handled → `CAN_EXIT_APP`.
iOS has no hardware back; users use the web header chevron and the web edge‑swipe drawer gesture ([06-app-shell-navigation.md](06-app-shell-navigation.md)). The native iOS back‑swipe gesture does not apply (single native screen).

### 7.3 Pull‑to‑refresh (web‑implemented, any WebView)
Enabled when `isWebView()` and the route is not a chat room (`/chat/`) or `/messages…`. Gesture: touch starts with the document and every scrollable ancestor at scrollTop 0; drag down > **120 px**; **hold ≥ 400 ms** past the threshold; release (still at top) → `window.location.reload()`. Indicator: fixed, top 16 px, horizontally centred, round `bg-background` bubble with border and shadow, 12 px padding, 20 px icon: down‑arrow (muted) while pulling → checkmark (primary colour, bubble scales 110 %, border primary) when ready → spinning circle while refreshing. Moving back above the threshold cancels.

### 7.4 Other differences
| Area | In WebView | In browser |
|---|---|---|
| Cookie‑consent banner ([24-integrations-api-embeds.md](24-integrations-api-embeds.md)) | Skipped (`shouldSkipCookieConsent` → true) | Shown |
| "Download App" item in the global‑nav help/user menu | Hidden | Shown only on mobile browsers (`isMobileDevice()`), opens App Store / Play Store |
| Logout row in context menu & global nav | Shows the native app version right‑aligned, xs muted tabular numerals: `v7.0.5` (v2 only) | No version |
| Sentry (web) | Tags `mobileWebView=true`, `mobileAppVersion`; continues the native trace from injected `sentry-trace`/`baggage` meta tags (no spans created) | `mobileWebView=false` |
| Theme changes | Also posted to native (`THEME_CHANGE`) | — |
| Join group from group detail | Posts `JOINED_GROUP` (ignored by v2) | — |
| Layout | Same responsive layout as a phone browser (compact layout, drawer nav, group welcome modal etc.). Legacy (non‑v2) WebView hides the web nav entirely (`withoutNav`) because the old app had native nav | — |
| Group deleted / left group | Legacy only: posts `GROUP_DELETED` / `LEFT_GROUP` | — |
| Document scrolling | Body fixed / overflow hidden (injected CSS); scrolling in inner containers; scrollbars hidden | Normal |

### 7.5 Mobile‑only web routes (legacy)
Handled in `apps/web/src/router/Root.jsx` before the main app:
- `/hyloApp/editor` — bare `HyloEditor` (TipTap) driven by `EDITOR.*` postMessages (`SET_PROPS` {content, readOnly, showMenu, placeholder, groupIds}, `CLEAR_CONTENT`, `FOCUS`, `BLUR`; emits `LOADED`, `ON_CHANGE` (HTML), `ON_ENTER` (HTML), `ON_ADD_TOPIC`); max 7 suggestions; mobile suggestions theme. Used by the old native post/comment editors; **unused by the v2 app**.
- `/hyloApp/videoPlayer?url=<url>` — renders only the post "Feature" (video embed) for the URL. Legacy, unused by v2.

### 7.6 Legacy‑app compatibility
Old store builds (bare RN, versions < 7) load the same web app without `HyloMobileV2`. For them the web: hides its own navigation, sends `GROUP_DELETED`/`LEFT_GROUP`, does not run the v2 re‑auth handshake, connects sockets normally. Old apps can be force‑upgraded with the version check (§9) by raising `MINIMUM_SUPPORTED_MOBILE_VERSION`. The backend also still accepts push `app_url` deep links (`hyloapp:/` + path) for old apps (§8).

---

## 8. Push notifications (mobile)

Provider: **OneSignal** (`react-native-onesignal` v5, `onesignal-expo-plugin`). Server side: see [19-notifications-email-push.md](19-notifications-email-push.md) for which events push and their text.

Client lifecycle:
1. `setupOneSignal()` once at startup (if `ONESIGNAL_APP_ID`): `OneSignal.initialize(appId)`.
2. On first bind of a logged‑in user: request permission if the OS allows asking (`canRequestPermission` → `requestPermission(true)`), then `OneSignal.login(<Hylo user id>)` — the user id is the OneSignal **external_id**. (Verbose OneSignal logging in dev.)
3. Logout → `OneSignal.logout()` (device stops receiving that user's pushes).
4. **Foreground:** `foregroundWillDisplay` handler calls `preventDefault()` → pushes are **not shown** while the app is in the foreground (the web UI's in‑app notification count updates via socket instead).
5. **Tap:** URL = `https://www.hylo.com` + `additionalData.path` (or `launchURL`); breadcrumb to Sentry; stored as initial URL → opened in the WebView (§5.5). Note the host is hard‑coded to production even on staging builds; it is only used for path extraction.
6. When the app returns to foreground (`background|inactive → active`) → `OneSignal.Notifications.clearAll()` (clears the notification tray and, on iOS, badge).

Server payload (`apps/backend/api/services/OneSignal.js`): target `include_aliases.external_id = [readerId]`, `target_channel: 'push'`, `contents: { en: <alert text> }` (English key only; the text is pre‑rendered server‑side), `data: { path }`, `app_url: 'hyloapp:/' + path` (fallback for old apps), and when a badge number is given `ios_badgeType: 'SetTo'`, `ios_badgeCount: n`.

Legacy GraphQL `registerDevice` mutation (`apps/backend/api/graphql/mutations/mobile.js`) is deprecated: always returns `{ success: true }` and does nothing. Device registration is entirely OneSignal's.

No local notifications, no notification categories/actions, no Android channels customisation in app code (OneSignal defaults).

---

## 9. App version check / forced upgrade

On every app start (not in dev builds) `VersionCheck` calls:

`GET {API_HOST}/noo/mobile/check-should-update?ios-version=7.0.5` (or `android-version=`).

Backend `MobileAppController.checkShouldUpdate`:
- Normalises `2` → `2.0.0`, `2.1` → `2.1.0`.
- Valid semver below env `MINIMUM_SUPPORTED_MOBILE_VERSION` (default `0.0.0`) → `force`; otherwise `{ success: true }`.
- Literal `test-suggest` → `suggest`; any other non‑semver → `force`.
- Result `{ type, title, message, link }`:
  - title: suggest "An update is available"; force "A new version of the app is available".
  - message: suggest "The version you are using is no longer up to date. Please go to the {App Store|Play Store} to update."; force "The version you are using is no longer supported. Please go to the {App Store|Play Store} now to update."
  - link: env `IOS_APP_STORE_URL` / `ANDROID_APP_STORE_URL`.

Client: if not `success`, shows a native `Alert` with that title/message and button **"Update Now"** (opens `link`); `suggest` adds **"Cancel"** and is dismissible; `force` is non‑cancelable — but after "Update Now" opens the store the app is still usable if the user returns (the alert is not re‑shown until next launch). Button labels are hard‑coded English. In practice only `force` is reachable for real versions (there is no "suggest" threshold).

Other endpoints in the same controller (legacy): `GET /noo/mobile/auto-update-info` (always returns a static force message with `iTunesItemIdentifier: '1002185140'`), `POST /noo/mobile/logerror` (forwards `error`/`extra` JSON to Sentry as `ReactNativeError`). Not called by v2.

The web app separately shows a "new version available" toast for web deploys (`useNewAppVersion`) — that is about the web bundle, and also appears inside the WebView ([06-app-shell-navigation.md](06-app-shell-navigation.md)).

---

## 10. API used by the native shell

### 10.1 REST
| Endpoint | Request | Response | Notes |
|---|---|---|---|
| `POST /noo/login/native` | JSON `{email, password}` | `{access_token, refresh_token, token_type:'Bearer', expires_in}` | Rate‑limited like web login; reactivates self‑deactivated accounts; errors 422 with plain‑text message |
| `POST /noo/oauth/token` | form `grant_type=refresh_token&client_id=hylo-mobile&refresh_token=…` | new token pair | Standard OIDC provider endpoint |
| `POST /noo/oauth/token/revocation` | form `token=<refresh>&client_id=hylo-mobile` | — | Errors ignored |
| `POST /noo/session/from-token` | `Authorization: Bearer <access>` | `{success:true}` + `Set-Cookie` | 401 `{error}` for missing/expired/unknown |
| `POST /noo/login/apple/oauth` | `X-Hylo-Token-Auth: 1`, JSON `{user, identityToken, email, fullName}` | token pair | Verifies Apple identity token (audience `APPLE_CLIENT_ID` or `com.hylo.HyloA`, `sub` must equal `user`); email only taken from the signed token if `email_verified`; name from `fullName` (first sign‑in only) |
| `POST /noo/login/google-token/oauth?access_token=…` | `X-Hylo-Token-Auth: 1` | token pair | Passport google‑token strategy; creates user if new (`email_validated: true`); never links to an existing session |
| `POST /noo/login/jwt` | `Authorization: Bearer <jwt>`, `X-Hylo-Token-Auth: 1` | token pair | Magic link / password reset |
| `POST /noo/login/token` | form `u`, `t` | always 422 "Link expired" | Legacy |
| `POST /noo/upload` | multipart `type`, `id` (`new` default), `file` (`{uri,name,type}`; default `upload.jpg`, `image/jpeg`) via XHR | `{url}` | Used for signup avatar (`type=userAvatar`). Network error message: "Please check your network connection and try again." |
| `GET /noo/mobile/check-should-update` | `ios-version` / `android-version` | see §9 | |
| Mapbox geocoding (third party) | see §4.3.5 | GeoJSON features | |

### 10.2 GraphQL (native, via urql at `{API_HOST}/noo/graphql`)
`meCheckAuthQuery` (auth state; network‑only), `currentUser` (via `useCurrentUser`), `login`/`logout` mutations (logout only — native login uses REST), `sendEmailVerification(email)`, `verifyEmail(email, code, token) { me error }`, `register(name, password)`, `updateUserSettings(changes)` (avatarUrl, location, locationId, settings.signupInProgress, settings.locale), `sendPasswordReset(email) { success }`, `checkInvitation(invitationToken, accessCode) { valid }`, `useInvitation` (`acceptInvitationMutation`), `findOrCreateLocation`. Schemas in [03-graphql-api.md](03-graphql-api.md). The urql graphcache is persisted to AsyncStorage; schema awareness off; no subscription exchange (real‑time is handled by the web app's socket inside the WebView).

### 10.3 Third‑party SDK identification (`useBindPlatformUser`, once per user id)
- OneSignal `login(userId)`.
- Intercom `loginUserWithUserAttributes({ userId, name, email })` (support chat UI itself is web; see [24-integrations-api-embeds.md](24-integrations-api-embeds.md)).
- Mixpanel `identify(userId)`, people `$name`, `$email`, `$location`. Native events tracked (respecting `cookieConsentPreferences.settings.analytics === false` only where the user is passed): `SIGNUP_EMAIL_VERIFICATION_SENT` {email}, `SIGNUP_EMAIL_VERIFIED` {email}, `SIGNUP_REGISTERED`, `SIGNUP_COMPLETE`. Automatic events off.

---

## 11. Offline behaviour (mobile)
- No offline content: Hylo requires connectivity. If offline at launch with no user yet loaded in this session → "No Internet Connection" screen (§4.5); auto‑recovers.
- If the user was already loaded and connectivity drops, the WebView stays as is; web requests fail with web‑level error states. A subsequent WebView load error while offline swaps to the No‑Internet screen.
- Native auth survives offline (tokens kept on transient refresh failures).
- urql cache persistence lets the native `me` query resolve from cache, but the WebView cannot render without network.
- No background sync, no offline queue, no share extension, no widgets, no app shortcuts, no in‑app purchase (Stripe flows run in the WebView — [23-paid-content-stripe.md](23-paid-content-stripe.md)).

---

## 12. Desktop app (Electron, `apps/desktop`)

Status: **beta** (`productName: Hylo`, version `1.0.0-beta.3`, Electron `^39.1.2`, Node ^24). Changelog: beta.1 (2025‑07‑31) initial — desktop notifications, deep‑linking, mac dock badges; beta.2 (2025‑08‑04) external links open in system browser, opens login page at start; beta.3 (2025‑11‑10) back/forward/refresh title‑bar buttons, `.icns` for macOS Tahoe, Electron 39.

### 12.1 What it wraps
- A single `BrowserWindow` loading `HOST + '/login'` where `HOST` = `https://hylo.com` when packaged, `http://localhost:3000` in development. Already‑logged‑in users are redirected by the web app from `/login` to their home. Auth is the **normal web cookie session** inside Electron's Chromium (no tokens, no native login UI); login/signup/OAuth are the web pages ([04-accounts-auth-onboarding.md](04-accounts-auth-onboarding.md)). Google OAuth popups are internal URLs and open as Electron child windows.
- Web features, layout and copy are exactly the desktop‑browser web app (the window is large, so the full desktop layout applies).

### 12.2 Window
| Property | Value |
|---|---|
| Size | Primary display work‑area width × height (effectively maximised, not fullscreen) |
| Shown | Hidden until `ready-to-show` |
| Title | "Hylo", then kept in sync with `document.title` |
| Background | `white` |
| Icon | macOS `assets/icon.icns`, Windows `assets/icon.ico`, Linux `assets/icon.png`; macOS dock icon set explicitly, app name "Hylo"; `CFBundleIconName: mac` with `assets/mac.icon` / `Assets.car` (macOS 26 icon) |
| macOS title bar | `titleBarStyle: 'hiddenInset'` (traffic lights inset over content), `titleBarOverlay` white with black symbols, height 36 |
| Security | `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`, preload script; Fuses: RunAsNode off, cookie encryption on, NODE_OPTIONS off, inspect args off, ASAR integrity validation on, only load app from ASAR |
| Lifecycle | Closing all windows quits on Windows/Linux; on macOS the app stays in the dock and `activate` re‑creates the window |
| Single instance | A `second-instance` handler restores/focuses the window, but `app.requestSingleInstanceLock()` is never called, so it never fires (see quirks) |

### 12.3 Injected title bar (preload, on `DOMContentLoaded`, every page)
A fixed bar at the top of the page: height **36 px**, full width, transparent background, `z-index: 2147483647`, `-webkit-app-region: drag` (drags the window), content centred, 12 px side padding. Centre group (no‑drag, 8 px gaps):
- **`<`** Back, **`>`** Forward, **`↻`** Reload — borderless transparent buttons 32 px tall, min‑width 32, 22 px semibold text. Back/Forward are disabled at 50 % opacity (default cursor) when history can't go that way (state pushed from main on `did-finish-load`, `did-navigate`, `did-navigate-in-page`).
- Page title text: 16 px semibold, black (`#000`), no wrap; updated by a MutationObserver on `<title>` and also sent to main to set the window title.
`document.body` gets `padding-top` increased by 36 px so web content starts below the bar. The bar is drawn on all platforms (on Windows/Linux it sits below the native frame). Text colour is fixed black, so it is low‑contrast on dark web themes.

### 12.4 Renderer bridge (`window.electron`)
Exposed via `contextBridge`:

| Member | Effect |
|---|---|
| `desktop: true` | Feature flag for the web app |
| `setBadgeCount(n)` | `app.setBadgeCount(n)` (macOS dock badge; Linux Unity; no‑op on Windows) |
| `showNotification(notification)` | Native OS notification (below) |
| `setTitle(title)` | Window title |
| `getLocale()` | `app.getLocale()` (not used by web) |
| `onNavigateTo(cb)` | Receives URLs from notification clicks |
| `goBack()`, `goForward()`, `onNavigationState(cb)` | History navigation |

Web usage (`apps/web`):
- On socket event `RECEIVE_NOTIFICATION` the web increments `newNotificationCount`, then `setBadgeCount(newNotificationCount)` and `showNotification(notification)` (the raw notification object incl. `activity`).
- When the notifications list is fetched with `resetCount` → `setBadgeCount(0)`.
- RootRouter registers `onNavigateTo(url)` once: strips origin and `navigate(path)` in the SPA.

### 12.5 Native notifications
Main process formats with the shared presenter (`@hylo/presenters/NotificationPresenter`: `titleForNotification`, `bodyForNotification`, `urlForNotification`) translated with i18next, HTML tags stripped (OS notifications are plain text). Clicking: restore/show/focus the window and send `navigate-to` with the notification URL (same URL mapping as the web notifications list — [19-notifications-email-push.md](19-notifications-email-push.md)). On formatting error, falls back to `{title, body}` of the raw object. Desktop notifications only arrive while the app is running and the socket is connected (no push service). macOS: `NSUserNotificationAlertStyle: alert` (persistent alerts) in Info.plist.

Desktop i18n: i18next with HTTP backend loading **web locale files** from `http://hylo.com/locales/<lng>.json` (packaged; note plain `http`) or `http://localhost:3000/locales/<lng>.json`; language = default (no explicit `lng`; i18next resolves `en-US`), fallback `en-US`, `debug: true`. The user's Hylo locale is not passed to the main process, so notification text is in English unless i18next detection picks otherwise.

### 12.6 Links & protocol
- `setWindowOpenHandler` / `new-window` / `will-navigate`: a URL is **external** unless it starts with `HOST` (`https://hylo.com`) or `hylo://`. External → `shell.openExternal` (system browser), navigation denied. Internal `target=_blank` → allowed as a new Electron window (`setWindowOpenHandler` returns allow).
  - Quirk: `HOST` is `https://hylo.com`, so links to `https://www.hylo.com/...` are treated as external and open in the browser.
- Custom protocol `hylo://` registered (`setAsDefaultProtocolClient('hylo')`; Forge `protocols`; deb `mimeType: x-scheme-handler/hylo`). **No `open-url` / argv handler exists**, so a `hylo://` link only launches/focuses the app; the path is not navigated to.
- No application menu customisation (Electron default menu), no tray icon, no auto‑update (no `update-electron-app`/Squirrel update feed), no global shortcuts, no offline handling, no spell‑check config (Electron default).

### 12.7 Packaging
Electron Forge makers: DMG + ZIP (macOS), Squirrel (Windows installer), DEB, RPM (Linux). `asar: true`. macOS signing (`osxSign`, hardened runtime, `entitlements.plist`: JIT, unsigned executable memory, dyld env vars, network client/server, user‑selected & downloads read/write, Apple events, audio input, camera, microphone, bluetooth, address book, calendars, photos library, absolute‑path temp exception `/`) and notarisation via `notarytool` when `APPLE_ID` set. Build step `scripts/copy-shared-packages.js` builds and copies `@hylo/navigation`, `@hylo/presenters` (and their deps) into `node_modules/@hylo/` with file references.

---

## 13. Feature parity matrix (vs. web)

| Feature | Web (browser) | Mobile app (v2) | Desktop app |
|---|---|---|---|
| Login / signup / forgot password UI | Web pages | **Native screens** (§4) | Web pages |
| Google sign‑in | Popup OAuth | Native Google SDK → token | Web popup |
| Apple sign‑in | Web (module 04) | **iOS native only**; not on Android | Web |
| Session | Cookie | Bearer tokens + bridged cookie | Cookie |
| Everything after login | Web | Web in WebView (compact layout) | Web (desktop layout) |
| Push / OS notifications | Browser: none (in‑app + email) | OneSignal push (background only; suppressed in foreground) | OS notifications while running (socket‑driven) |
| Badge count | Tab title count (web) | iOS badge from push payload; cleared on app foreground | Dock badge = unread notification count |
| Deep links | URLs | Universal/App Links + `hyloapp://` | `hylo://` registered but path ignored |
| External links | New tab | System browser / other app; YouTube/Vimeo/SoundCloud iframes allowed | System browser |
| Back navigation | Browser back | Android hardware back routed through web; iOS: web chevron | Title‑bar `<` `>` `↻` |
| Pull‑to‑refresh | No | Yes (web‑side, hold to confirm) — not in chat/messages | No |
| Cookie‑consent banner | Yes | No | Yes |
| "Download App" menu item | Mobile browsers only | Hidden | Hidden (not a mobile device) |
| Forced upgrade | n/a (web deploy toast) | Native alert from `/noo/mobile/check-should-update` | None |
| Language before login | Web picker | Native `LocaleSelector` (7 locales) | Web picker |
| Image upload | Web uploader | Web uploader inside WebView (uses WebView file input → OS picker/camera); native picker only for signup avatar | Web uploader |
| Location permission | Browser prompt | OS prompt (native for signup, WebView geolocation otherwise) | Chromium prompt |
| Offline | Browser error | "No Internet Connection" screen | Blank/error page |
| Orientation | Any | Portrait only | n/a |

---

## 14. Edge cases & known quirks

1. **Lower‑cased deep‑link paths**: `getRouteMatchForPath` lower‑cases the pathname before building `originalLinkingPath`; mixed‑case slugs/ids in paths are lower‑cased when opened from a link or push (search string casing is preserved).
2. **Static pages via universal link** while the app is running are routed into the WebView (React Navigation `subscribe` → `getStateFromPath` catch‑all), but the same URL opened via `openURL` (e.g. a cold‑start stored link, or the Terms link) goes to the system browser.
3. **Push tap host** is hard‑coded `https://www.hylo.com`; on staging builds this is only used to extract the path, so it still works. `app_url` is `hyloapp:/` + path (= `hyloapp://groups/...`, i.e. the first path segment becomes the URL host) — only meaningful for old apps.
4. **Foreground pushes are always suppressed** (no in‑app banner from native).
5. **Version check** runs once per cold start, never on resume; `force` alert can be bypassed by returning to the app. There is no reachable `suggest` threshold.
6. **`/noo/login/token` links** always fail now → "Link expired, please start over" banner.
7. **JoinGroup `message` param** ("Signup or login to join this group.") is passed but never displayed.
8. **Signup "Continue" on avatar step** saves the current avatar URL even if unchanged; if a user taps Continue while an upload is pending the button is disabled.
9. **Hard‑coded English** natively: "Starting…", "Joining Group...", "Selected:", "(None selected)", `Use "<term>" (without mapping)`, "Choose photo" / "Choose from library" / "Take photo" / "Cancel", "Upload failed", "Update Now" / "Cancel" and server‑provided update texts, "Unknown route", Google Expo‑Go note.
10. **Mobile locale files contain ~640 keys**, most of them leftovers from the old native app (streams, funding rounds, tracks, moderation…); only ~60 are used by v2 (listed in §16). A re‑implementation needs only those.
11. **Auth screens ignore dark mode** (hard‑coded white backgrounds).
12. **pt‑BR shown with 🇵🇹 flag**.
13. **Desktop `www` host**: links to `https://www.hylo.com` are opened externally because the internal check uses `https://hylo.com`.
14. **Desktop single‑instance** handler is dead (no lock), and `hylo://` URLs aren't routed.
15. **Desktop i18n** fetches locales over plain `http://hylo.com` and doesn't follow the user's locale.
16. **Desktop title bar** text is always black and overlays the top 36 px of every page (body padding pushed down), including on Windows/Linux where a native frame also exists.
17. **Session recovery loop guard**: web gives up after 3 consecutive anonymous `checkLogin`s and sends `LOGOUT`; counters live in WebView localStorage and reset on success.
18. **`X-Hylo-Mobile: v2`** request header is sent on the initial WebView request only (not on subsequent in‑page requests) and nothing on the backend reads it.
19. **Refresh token lifetime**: tokens are 180 days, but the OIDC Grant TTL is configured as 14 days; whether refresh keeps working past 14 days depends on oidc‑provider grant extension (unverified).
20. **Android back on a chat/primary view** exits the app only on the second press after closing the drawer (step 5 of §7.2), mimicking "press back again to exit" without a toast.
21. Signup location step requests location permission as soon as it mounts, even before the user types.

---

## 15. Docs vs. code

| Public docs / repo docs | Code (wins) |
|---|---|
| GitBook "Mobile Apps" only links the stores (`https://apps.apple.com/app/appname/id1002185140`, Play `com.hylo.hyloandroid`). | Matches ids. No feature description to conflict. |
| GitBook "Testing Instructions (Mobile)": "The mobile UI currently uses a hybrid of old and new styling"; describes native screens with pending restyling; test builds connect to staging. | v2 has no native content screens — all post‑login UI is the web app; only auth screens are native. Staging builds (`preview`/`staging` EAS profiles) do point to `https://staging.hylo.com`. |
| `docs/mobile-leap-rebuild-plan.md` says "proposal / planning doc. No implementation commitment"; plans `@react-native-cookies/cookies`, `expo-linking`, a "forced‑update screen", status/navigation bar theming. | Implemented and shipping as the only mobile app (`apps/mobile` removed). Uses `@preeternal/react-native-cookie-manager`, React Native `Linking`, an `Alert` (not a screen) for forced update; only status‑bar style + background are themed. |
| `WEBVIEW_MIGRATION_CHANGES.md` (old `apps/mobile`): swipe‑from‑left‑edge via `useSwipeGesture` (30 px edge, 50 px distance). | `useSwipeGesture.js` is dead code; replaced by an interactive drag‑to‑open/close drawer gesture in `AuthLayoutRouter` (module 06). Pull‑to‑refresh, hidden "Download App" and other items described there are still accurate. |
| Desktop CHANGELOG header says "HyloReactNative (the Hylo mobile app)". | Copy‑paste error; it is the desktop changelog. |
| Desktop CHANGELOG beta.1: "Supports … deep-linking". | Only protocol registration; deep‑link paths are not handled (§12.6). |
| Desktop README: `yarn desktop`, `yarn desktop:package`, `yarn desktop:build`. | Root `package.json` defines `desktop` and `desktop:build` only; `desktop:package` does not exist (use `yarn workspace desktop package`). |

---

## 16. Copy reference (mobile, keys actually used → English)

Translated into `de`, `es`, `fr`, `hi`, `pt` in `apps/mobile-leap/locales/*.json`.

| Key | English |
|---|---|
| `Log in to Hylo` | Log in to Hylo |
| `Email address` | Email address |
| `Password` | Password |
| `Forgot your password?` | Forgot your password? |
| `Log In` | Log In |
| `LOGGING IN` | LOGGING IN... |
| `Or connect with` | Or connect with (rendered with trailing ":") |
| `Sign in with Google` / `Sign up with Google` | Sign in with Google / Sign up with Google |
| `Could not sign in with your Apple account` | (same) |
| `Could not sign in with your Google account` | (same) |
| `Dont have an account?` | Don't have an account? |
| `Sign up now` | Sign up now |
| `Language` | Language |
| `Reset Your Password` | Reset Your Password |
| `forgotPasswordDescription` | Enter your email address below and we'll send you an email message with a link for resetting your password. |
| `Send` | Send |
| `There was a problem with your request. Please check your email and try again.` | (same) |
| `A link to reset your password has been sent to you at {{email}}` | (same) |
| `Back` | Back |
| `Welcome to Hylo` | Welcome to Hylo |
| `Stay connected, organized, and engaged with your group` | (same; rendered with trailing ".") |
| `Enter your email below to get started!` | (same) |
| `Continue` | Continue |
| `Saving-ellipsis` | Saving... |
| `SIGNING UP` | SIGNING UP... |
| `An account may already exist for this email address, Login or try resetting your password` | (same) |
| `Already have an account?` | Already have an account? |
| `Log in now` | Log in now |
| `Your data is safe with Hylo By clicking the Sign Up button above you are agreeing to these terms:` | Your data is safe with Hylo. By clicking the "Sign Up" button above you are agreeing to these terms: |
| `Terms of Service + Privacy Policy` | (same) |
| `Verify Email` | Verify Email |
| `Check your email` | Check your email |
| `Weve sent a 6 digit code to` | We've sent a 6 digit code to |
| `Resend code` | Resend code |
| `Expired or invalid code` | (same) |
| `STEP 1/3`, `STEP 2/3`, `STEP 3/3` | (same) |
| `Lets do this!` | Let's do this! |
| `Your Full Name` | Your Full Name |
| `Password (at least 9 characters)` | (same) |
| `Confirm Password` | Confirm Password |
| `Password must be at least 9 characters` | (same) |
| `Passwords must match` | Passwords must match |
| `Upload a Photo` | Upload a Photo |
| `Add your location` | Add your location |
| `Add your location to see more relevant content and find people and projects near you` | (same; trailing ".") |
| `Search for your location` | Search for your location |
| `< Back` | < Back |
| `Finish` | Finish |
| `No Internet Connection` | No Internet Connection |
| `Hylo requires an internet connection to work. Please check your connection and try again.` | (same) |
| `Retry` | Retry |
| `Oops Something Went Wrong` | Oops. Something Went Wrong |
| `Restart Hylo` | Restart Hylo |
| Locale names | English, English (UK), Spanish, German, French, Hindi, Portuguese |

---

## 17. Source references

Mobile: `apps/mobile-leap/{app.config.ts,eas.json,package.json,index.ts,metro.config.js,babel.config.js,tailwind.config.js,plugins/withReassertEntitlements.js,scripts/*}`, `src/App.tsx`, `src/i18n.ts`, `src/navigation/{RootNavigator,AuthNavigator,NonAuthNavigator,SignupNavigator}.tsx`, `src/navigation/headers/ModalHeader.tsx`, `src/navigation/linking/*`, `src/screens/*`, `src/components/*` (esp. `HyloWebView/*`, `SocialAuth.tsx`, `VersionCheck.tsx`, `ImagePicker.tsx`, `LocationSelector.tsx`, `LocaleSelector.tsx`, `auth/AuthScreenParts.tsx`), `src/hooks/*`, `src/services/{onesignal,mixpanel,mapbox,logoutServices}.ts`, `src/store/themeStore.ts`, `src/style/{themes.ts,global.css}`, `src/util/{session,tokenStore,authApi,authAdapter,upload,errorMessages,nativeSessionId}.ts`, `src/config/{index,sentry}.ts`, `locales/*.json`.
Shared: `packages/contexts/AuthContext.js`, `packages/urql/makeUrqlClient.js`, `packages/shared/src/{constants.js,LocaleHelpers.js}`, `packages/presenters/src/NotificationPresenter.js`.
Web: `apps/web/src/util/{webView.js,hardwareBackHandler.js,mobile.js,appearance.js,cookieConsent.js}`, `hooks/{useMobileHardwareBack,usePullToRefresh,useMobileNavBack,useSwipeGesture}.js`, `routes/RootRouter/RootRouter.js`, `routes/AuthLayoutRouter/AuthLayoutRouter.js`, `routes/AuthLayoutRouter/components/{GlobalNav/GlobalNav.jsx,ContextMenu/ContextMenu.jsx}`, `routes/HyloEditorMobile/*`, `router/Root.jsx`, `client/{websockets,errorReporter,continueNativeTrace}.js`, `components/SocketListener/SocketListener.store.js`, `store/reducers/ormReducer/notifications.js`, `public/.well-known/{apple-app-site-association,assetlinks.json}`.
Backend: `apps/backend/config/routes.js`, `api/controllers/{SessionController,MobileAppController}.js`, `api/services/{OIDCTokens,OpenIDConnect,OneSignal}.js`, `api/models/PushNotification.js`, `api/graphql/mutations/mobile.js`, `migrations/20260604120000_seed_native_oidc_client.js`.
Desktop: `apps/desktop/{main.js,preload.js,i18n.js,forge.config.js,entitlements.plist,package.json,README.md,CHANGELOG}`.
Docs: `docs/{mobile-leap-rebuild-plan,mobile-auth-cookie-workflow,modern-mobile-auth-options,phase-1-token-auth-implementation-plan,webview-transition-testing}.md`, `WEBVIEW_MIGRATION_CHANGES.md`, GitBook "Mobile Apps" and "Hylo Testing Instructions (Mobile)".
