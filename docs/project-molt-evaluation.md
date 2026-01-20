# Project Molt Technical Evaluation

## Executive Summary
- The existing Hylo mobile apps share a backend and component library with the web client, yet the native shells still carry eight years of accumulated routing, storage, and release complexity. Converging on a web-first client fits the current engineering staff (three people) and turns most product work into standard web deploys instead of multi-store release trains.
- WKWebView (iOS 14+) and Android System WebView (Chrome 110+) are now fast, cache-aware, and support the same modern APIs Vite targets in `apps/web`. The heaviest parts of Hylo web (deck.gl map, tiptap editor, sockets) already run in browsers today. No blockers surfaced that would require new native UI.
- The shell must stay intentionally tiny: a splash screen, a single WebView scene, and four OS integrations (push, deep link routing, media/file pickers, and share sheet). Everything else should be implemented in the mobile web bundle so fixes ship instantly.
- The risk profile is manageable: App Store review is the biggest unknown, followed by session/cookie drift between the URQL-native flows and the WebView cookie store (see `docs/mobile-auth-cookie-workflow.md`). Each risk has concrete mitigations listed below.

## 1. Performance & Caching in WebViews

### 1.1 Current mobile web app baseline
- `apps/web` already ships a Vite-built, code-split bundle with hashed asset filenames, so WKWebView/WebView will request long-lived static assets exactly once per version.
- The app depends on websocket/socket.io, URQL SSE, deck.gl, and Mapbox. All of these libraries are compatible with modern WebViews as long as hardware acceleration is kept on (default on both platforms).
- The biggest perceived cost is first render (JS parse + login). Measure with Lighthouse Mobile or Chrome remote debugging on a mid-tier Android (Pixel 5) to ensure LCP < 4s on real hardware.

### 1.2 WebView-specific considerations
- Enable `limitsNavigationsToAppBoundDomains` (iOS 16+) and an allowlist on Android custom WebViewClient to keep all navigation inside `hylo.com`/`local.hylo.com`. External links can open Custom Tabs/SFSafariViewController.
- Turn on caching knobs: `setDomStorageEnabled(true)`, `setDatabaseEnabled(true)`, `setCacheMode(LOAD_DEFAULT)` on Android; `WKWebsiteDataStore.default()` with `configuration.limitsNavigationsToAppBoundDomains` on iOS.
- Use WebView-provided storage; do not inject your own cookie jar beyond what Hylo already sets for WebView loads. Continue to hydrate cookies through `HyloWebView` (see docs) until the login flow moves entirely into the web layer.
- Preload the initial URL in the background (Android `WebViewAssetLoader`, iOS `WKWebView` hidden instance) during splash to mask first-render latency.

### 1.3 Recommended caching & offline strategies
- **Service worker**: add a minimal `registerServiceWorker` hook in `apps/web/src/index.js` that precaches the shell (HTML, CSS, JS entry) and image sprites. WKWebView honors service workers starting iOS 11.3; Android WebView supports them when the embedded Chrome version ≥ 100.
- **Asset fingerprinting**: already solved by Vite hashed filenames. Configure CDN (or the native shell caching proxy) to serve with `cache-control: public,max-age=31536000,immutable`.
- **API caching**: rely on URQL graphcache + HTTP caching headers; avoid service worker API caches so that GraphQL auth remains consistent.
- **Offline-first scope**: limit to short-term caching (e.g., keep last 10 posts plus attachments) to avoid coupling to Hylo Local. Later, the same native shell can host a future offline bundle by switching the WebView URL or toggling a feature flag.

## 2. Minimal Native Shell Requirements

### 2.1 App shell architecture
- **Entry**: native splash → auth bootstrap (fetch stored session cookie/token) → load single WebView at `https://mobile.hylo.com` (staging/prod env via remote config).
- **Bridge**: bidirectional messaging via `window.ReactNativeWebView.postMessage` (RN) or equivalent minimal binding to expose four capabilities: notifications, picker intents, share sheet, and environment info (app version, build channel).
- **Settings screen**: static React Native (or Swift/Kotlin) screen reachable from the system settings icon offering account logout, push toggle, legal docs, diagnostics upload. This gives the shell “native functionality” for App Store review.

### 2.2 Native capabilities checklist
| Capability | Shell responsibility | Web responsibility |
| --- | --- | --- |
| Push notifications | Register for APNs/FCM, receive payload, forward to JS bridge (for in-app display) and to OS tray when closed | Render deeplink target via router, update notification center via sockets |
| Deep links / app links | Handle URL intents, resume WebView with `window.location` updates and JS message for router state | Interpret `?screen=` etc and sync to React Router history |
| Camera/gallery/file picker | Invoke `ImagePicker`/`ACTION_GET_CONTENT` then upload via existing REST endpoints | Provide UI that calls `requestMedia` bridge and handles returned temp URIs |
| System share sheet | Accept `share` bridge calls with payload, open `UIActivityViewController`/`Intent.ACTION_SEND` | Provide share UI that decides content |
| Settings/fallback login | Provide logout, clear cookies, view version, maybe a “Reload web app” button | Surface instructions via WebView when opened |

### 2.3 Implementation notes
- Keep the RN dependency tree frozen: no navigation library, no state management beyond a single context for bridge events.
- Push integration can reuse existing backend topics; the shell only needs to pass device tokens down to the web layer via a `nativeDeviceToken` mutation once per install.
- For file uploads, prefer streaming the file from native to the backend directly (bypassing JS) and returning only the resulting asset URL to the web layer to avoid base64 memory spikes.
- Use feature flags stored in `AsyncStorage`/`SharedPreferences` (synced from the web) so that urgent toggles can persist even if the WebView fails to load.

## 3. Migration & Integration Risks

### 3.1 App Store acceptance risks
- Apple guideline 4.2 rejects “apps that are just websites.” Mitigations: native settings page, push notification controls, the ability to open share sheet/deep links without the WebView fully loading, and a written justification in App Store notes describing the shell as an access point for a responsive collaboration app.
- Keep `WKWebView` embedded (not Safari VC) and document native functionality (notification delivery, background fetch for messages) in the review metadata.
- Android Play Store generally accepts Trusted Web Activity–style shells; add an onboarding step and system share integration to highlight native value.

### 3.2 Authentication & session management
- Today, cookies are set from URQL responses and later injected into the WebView (`docs/mobile-auth-cookie-workflow.md`). During migration, ensure the login flow lives inside the WebView so that cookies are minted inside the same context and shared automatically.
- Provide a bridge method `nativeLogout()` that clears the WebView data store, AsyncStorage, and notifies the backend to avoid ghost sessions.
- Verify that WebView storage survives process death; if not, add a refresh token or magic-link fallback accessible from the native settings page.

### 3.3 Native↔web bridge versioning
- Define a JSON schema for bridge messages (`version`, `event`, `payload`) and expose it via `window.hyloNative`. Include `minNativeVersion` in the web bundle so it can block unsupported builds with a friendly screen.
- On native side, keep a table of supported message versions per event. Reject (and log to Rollbar/Sentry) unknown events so the web team gets immediate telemetry after deploying a feature that the shell cannot serve.

### 3.4 WebView UX quirks
- iOS: keyboard accessory bar and safe-area handling require injecting CSS variables (`env(safe-area-inset-*)`). Provide them via the bridge to avoid layout bugs.
- Android back button must map to `history.back()` until the root route; only exit the app on double-back from the home screen.
- Storage quotas differ (WKWebView ~1 GB, Android dynamic). Monitor `QuotaExceededError` in Rollbar and expose a “Reset web data” option in native settings to recover.

## 4. Release Speed & Long-term Trajectory
- Once the shell is published, nearly all UI/feature work happens in `apps/web`, so staging/prod deploys become standard web releases. App updates occur only when OS APIs change, reducing QA/regression scope dramatically.
- The shell naturally hosts future “Hylo Local” offline packs by swapping the WebView URL to a locally bundled `file:///` asset when offline, then switching back when connectivity resumes, without rebuilding core UI.
- Native engineers can focus on reliability (push delivery, crash-free sessions) rather than feature parity, compounding maintenance savings.

## 5. Suggested Validation Plan
1. **Week 1–2**: Build spike shell (React Native/Swift + Android) that loads `https://staging.hylo.com`, wires console logging bridge, and measures first render + navigation timings.
2. **Week 2–3**: Implement push/deeplink plumbing end to end using the existing backend endpoints; confirm notifications open the correct route in-WebView.
3. **Week 3–4**: Add camera/file pickers and run upload smoke tests for the heaviest flows (post creation with multiple photos, workspace attachments).
4. **Week 4**: Run App Store TestFlight/Internal testing with a native settings screen + release notes explaining the experiment; collect reviewer feedback early.
5. **Parallel**: Add the service worker + caching improvements to the web repo, and add telemetry to detect WebView-specific crashes (via UA sniffing or `navigator.userAgentData`).
