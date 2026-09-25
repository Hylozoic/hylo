# Plan: Fast cold boot via redux-remember (bootstrap-first persistence)

Persist a **narrow bootstrap slice** of Redux state with [redux-remember](https://github.com/zewish/redux-remember) so the app shell (auth gate, nav, current group, context menu) paints instantly on cold boot, then **always revalidate** from the network (stale-while-revalidate). Mobile v2 renders the web app inside WebViews, so this directly cuts mobile app cold-start time — that's the primary motivation; web gets the same benefit for free.

**Status (July 2026):** plan — branch `1452-redux-persist-redux`. Supersedes the earlier redux-persist proposal; background carried over below.

---

## 1. Background

### What happened with redux-persist (v1 attempt)

| Date | Commit / PR | What |
|------|-------------|------|
| 2026-03-31 | `dba34a199` | Added redux-persist persisting the **whole `orm` slice** (initially `queryResults` too), `PersistGate`, `createMigrate` deploy wipes |
| ~2026-04 | PR #1337 (`3cbcba27e`) | Stopped persisting `queryResults` — list-ordering keys caused churn and staleness |
| 2026-04-22 | PR #1343 (`8ce82b8ec`) | Removed redux-persist entirely |

Scar tissue still in the codebase documents the failure mode:

- `ChatRoom.js` (~line 620): rehydrated posts collided with pending messages on `localId` (lodash `uniqueId` resets each page load)
- `Stream.js` / `ViewContent.js`: stream loading blocked forever on a topic refetch because the Topic row **already existed** in the rehydrated ORM

**Lesson:** persisting the entire ORM turns every "does this row exist?" check into a potential staleness/identity bug. This plan persists a much narrower, purpose-built surface.

### What has been built since (works in our favor)

- **`authSession` slice** (`apps/web/src/store/reducers/authSession.js`): `{ status: unknown | anonymous | authenticated, userId, emailValidated, hasRegistered, signupInProgress, checkedAt }`. All routing (`getAuthorized`, `getSignupState`) derives from it — never from ORM `Me` presence. (Its own comment notes it was designed to be persistable, but this plan deliberately keeps it session-local — see §3.2.)
- **`RootRouter`** always runs `checkLogin()` on mount, renders `Loading`/`BootstrapShell` while `status === unknown`, and handles the mobile v2 re-auth handshake (`VERIFY_AUTH` → native re-mints cookie → `SESSION_READY` → re-run `checkLogin`).
- **`fetchForGroup` is already stale-while-revalidate**: dispatched unconditionally on slug change; ORM presence (`getGroupForSlug`) only decides whether a skeleton shows. This is the pattern all rehydrated data must follow.

### Why mobile benefits most

Mobile v2 screens are `HyloWebView` instances loading the deployed web app (`window.HyloMobileV2`), with a native token→session-cookie bridge. Every app cold start reloads the web app: fullscreen spinner until `checkLogin` resolves, then `BootstrapShell` until `fetchForCurrentUser` + `fetchForGroup` land. `localStorage` works and persists inside the WebViews (the vendored react-native-webview sets `domStorageEnabled = true` unconditionally on Android; iOS WKWebView persists by default) — the web app already relies on it (`hyloMobileReauthAttempts`). So redux-remember's plain `localStorage` driver works unchanged on mobile.

---

## 2. Why redux-remember

Upstream `redux-persist` is unmaintained (last release v6.0.0, 2019 — see rt2zz/redux-persist#1420). redux-remember is the actively maintained lightweight alternative, tested against Redux 5 / RTK 2.

**API surface** (all of it):

- `rememberReducer(rootReducer)` — wraps the root reducer; handles `@@REMEMBER_REHYDRATED` by merging loaded slices into state
- `rememberEnhancer(driver, rememberedKeys, options)` — store enhancer that loads on boot and persists on change
  - `driver`: anything with `getItem(key)` / `setItem(key, value)` — `window.localStorage` directly, or a thin custom wrapper
  - `rememberedKeys`: **top-level slice names** to persist (selective by design)
  - `options`: `prefix` (default `'@@remember-'`), `serialize`/`unserialize` (default JSON), `migrate` (transform persisted state on rehydrate — our versioning/wipe hook), `persistThrottle` (default 100ms) / `persistDebounce`, `persistWholeStore`, `errorHandler`, `initActionType` (delay rehydration until a given action)
- Action types `'@@REMEMBER_REHYDRATED'` (payload: rehydrated root state) and `'@@REMEMBER_PERSISTED'` — plain actions our own reducers can listen to

**Pros for Hylo:**

- Tiny, comprehensible; no `PersistGate`, no `_persist` metadata living inside our state (the redux-persist removal had to unwind exactly that from `resetStore`)
- Selective top-level keys match a dedicated-bootstrap-slice design exactly
- `migrate` gives us deploy/schema wipes without extra machinery
- Custom driver is a 10-line wrapper — the cleanest place for the multi-tab compare-and-swap guard (§6)
- Works with our legacy `createStore` setup (`rememberReducer` accepts any root reducer, enhancer composes with `applyMiddleware`)

**Cons / gaps we own:**

- No built-in cross-tab sync (redux-persist didn't have it either) — §6
- No transforms/nested-persist: whatever is in a remembered slice gets persisted wholesale, so the bootstrap slice must **only** contain JSON-safe, persistence-worthy data. That constraint is a feature — it forces the narrow contract
- Rehydration is a dispatched action, not a render gate — we add a one-line `rehydrated` flag ourselves (§4.3)
- Companion migration tool (`redux-remigrate`) is TypeScript-first; we use the plain `migrate` option with a manual `_version` field instead

---

## 3. Phase 1 — Persist bootstrap data only

### 3.1 Goal

Cold boot paints a real, personalized shell (nav with membership list and badges, current group menu with context widgets, header) from disk in the first frame, while the exact same network bootstrap runs unchanged behind it. No fetch is ever skipped because data exists.

### 3.2 What gets persisted

One top-level key:

| Key | Contents | Written by |
|-----|----------|------------|
| `bootstrap` | New slice: the **raw GraphQL payloads** of the last successful bootstrap responses, plus `at` timestamps | New reducer listening to existing action types |

#### Why `authSession` is deliberately NOT persisted

The v1 root cause was that auth was *inferred from cached data*: `getAuthorized` derived from the ORM `Me` row, persisting `orm` meant `Me` was always present, so the app believed it was logged in while the session cookie was missing or stale. The `authSession` refactor fixed this by making auth a **recorded fact of a live server response**.

Persisting `authSession` would recreate the same bug at the new location: `getAuthorized` reads `authSession.status` directly and `RootRouter` routes on it, so a rehydrated `status: 'authenticated'` (or rehydrated `emailValidated`/`hasRegistered`/`signupInProgress` facts steering the signup router) would authorize routing before `checkLogin` ever ran — against a possibly-dead cookie. Mitigating that with "rehydrated status only picks the skeleton" is policy every current and future consumer of the slice would have to remember. Not persisting it makes the failure **structurally impossible**:

> **Invariant: `authSession` is session-local. It is only ever written by live server responses (`CHECK_LOGIN`, `LOGIN`, `VERIFY_EMAIL`, `REGISTER`, `LOGOUT`) and always boots as `unknown`.**

We lose nothing by this. The only thing persisting `authSession` bought — choosing the right shell during the `checkLogin` window — is provided equally well by **"the persisted `bootstrap` slice is non-empty"**: it implies the last session ended authenticated (it's cleared on `LOGOUT`), so paint the auth-shaped shell optimistically; if the live `checkLogin` comes back anonymous, swap to login. Routing itself never moves off `authSession.status === unknown` handling.

Proposed `bootstrap` slice shape:

```javascript
{
  _version: 1,
  checkLogin: { data, at },            // last CHECK_LOGIN payload
  currentUser: { data, at },           // last FETCH_FOR_CURRENT_USER (MeQuery) payload
  groupsBySlug: {                      // last FETCH_FOR_GROUP payload per slug, LRU-capped (e.g. 5)
    'my-group': { data, at }
  }
}
```

**Why raw payloads instead of a hand-picked field subset:** on rehydrate we replay them through the exact same ORM ingestion path the network responses use (`extractModel` → `ModelExtractor`), so every existing selector (`getMe`, `getMyMemberships`, `getGroupForSlug`, context-widget reads) works unchanged, and the persisted shape automatically tracks query changes — no parallel "shell schema" to maintain. Size is modest: `MeQuery` + a few `fetchForGroup` responses are tens of KB, far below localStorage quotas.

Explicitly **not** persisted: `orm`, `queryResults`, `pending`, `router`, posts/comments/messages, anything carrying client-generated `localId`s. (All lessons from v1.)

### 3.3 Wiring (touch points)

1. **`store/reducers/bootstrap.js`** (new): reducer capturing `CHECK_LOGIN`, `FETCH_FOR_CURRENT_USER`, `FETCH_FOR_GROUP` success payloads with timestamps; cleared on `LOGOUT`. Register in `store/reducers/index.js`.

2. **`store/index.js`**: wrap and enhance —

```javascript
import { rememberReducer, rememberEnhancer } from 'redux-remember'
import { compose } from 'redux'

const rememberedKeys = ['bootstrap'] // authSession is session-local by design — see §3.2

const store = createStore(
  rememberReducer(createRootReducer(routerReducer)),
  getEmptyState(),
  compose(
    createMiddleware(routerMiddleware),
    rememberEnhancer(bootstrapStorageDriver, rememberedKeys, {
      prefix: '@@hylo-remember-',
      persistThrottle: 2000,
      migrate: migrateBootstrapState // manual _version checks; return {} slices to wipe
    })
  )
)
```

   (`bootstrapStorageDriver` starts as `window.localStorage`; §6 wraps it.)

3. **Rehydration flag + ORM replay**: a small reducer sets `rehydrated: true` on `'@@REMEMBER_REHYDRATED'`. A boot step then replays persisted payloads into the ORM — synthetic actions carrying the stored payload with the same `extractModel` meta, or invoking the extractor directly. After replay, hydrated `Me`/`Group` rows exist before the first fetch returns. **The replay must use its own action type** (e.g. `BOOTSTRAP_REPLAY`), never the original `CHECK_LOGIN`/`LOGIN` types — so the `authSession` reducer (and mixpanel/pending middleware) never sees replayed data as a live server response.

4. **Paint gating**:
   - The app's first render waits for the `rehydrated` flag (localStorage rehydrate is near-synchronous; this only avoids a one-frame empty flash — our PersistGate equivalent, ~5 lines in `router/index.js` or `RootRouter`)
   - `RootRouter`: while live `checkLogin` is in flight (`authSession.status === 'unknown'`, exactly as today), a **non-empty rehydrated `bootstrap` slice** selects the auth-shaped shell (real nav from hydrated ORM instead of `BootstrapShell`); an empty one keeps today's behavior. Routing authorization still flips only on the live `checkLogin` result
   - `AuthLayoutRouter`: `currentUserLoading` / `currentGroupLoading` skeletons are skipped when hydrated rows exist — mirroring the pattern `fetchForGroup` already uses (`getGroupForSlug` presence controls the skeleton, never the fetch)

5. **Logout**: `resetStore` already returns `getEmptyState()` on `LOGOUT`; redux-remember then persists the empty `bootstrap` slice, which **is** the purge — no extra API. Confirm the cleared slice actually hits storage before a mobile WebView is torn down (throttle window; see §6 invariants). No `_persist`-style key needs preserving in `KEYS_PRESERVED_ON_RESET` — redux-remember keeps no metadata in state.

6. **Versioning / deploy wipes**: `_version` inside the `bootstrap` slice + the `migrate` option. Bumping the version and returning empty slices from `migrate` reproduces redux-persist's `createMigrate` wipe pattern from v1.

### 3.4 Freshness rules (unchanged fetches — the contract)

Persistence changes **what paints**, never **what fetches**:

| Trigger | Action (all pre-existing — verify none regress) |
|---------|------------------------------------------------|
| Cold start | `checkLogin` (RootRouter), then `fetchForCurrentUser` (+ `fetchPost` race) and `fetchForGroup(slug)` (AuthLayoutRouter) run exactly as today |
| Group slug change | `fetchForGroup` unconditional (already true) |
| Focus / visibility | `checkForNewNotifications` on `visibilitychange`; extend to soft-revalidate `me` + active group after rehydrate-heavy sessions |
| Sockets | `SocketListener` keeps patching counters / refetching on `groupUpdated` |
| Mobile `SESSION_READY` | re-run `checkLogin` (already wired) |
| Join / leave group | force `MeQuery` + nav refetch |

Code-review bans (unchanged from the redux-persist era, now enforceable):

- "if `me` exists, skip `checkLogin`" — routing stays on `authSession.status`
- adding `authSession` (or any auth-status fact) to `rememberedKeys` — see the §3.2 invariant; auth is only ever established by a live server response
- replaying persisted payloads through original action types that auth or analytics reducers listen to — replay uses `BOOTSTRAP_REPLAY`
- "if memberships/group/topic row exists, skip the fetch" — presence gates skeletons only
- purging persisted state on mobile re-auth **transients** — only a real `LOGOUT` purges (the `anonymousSession()` transitions during the `VERIFY_AUTH` handshake must not)

### 3.5 Mobile v2 specifics

- Rehydrated shell + spinner-free boot: the fullscreen spinner window shrinks to just the live `checkLogin` round-trip, and `BootstrapShell` is replaced by real content for returning users
- The re-auth handshake is unaffected: `authSession` always boots as `unknown` (nothing auth-related is persisted), so the `VERIFY_AUTH` → `SESSION_READY` flow runs exactly as today — only against a painted shell instead of a spinner
- Several same-origin WebViews run concurrently (`PrimaryWebView`, `ChatRoomWebView`, settings, map…) — the multi-tab guard in §6 is mandatory, not optional, on mobile
- Native logout must reach every WebView: the native `LOGOUT` path already reloads/tears down WebViews; verify storage is cleared by whichever context processes `LOGOUT` first

### 3.6 Verification plan

- **Metrics**: existing `performance.mark`s (`hylo-auth-bootstrap`, `hylo-fetch-for-group`) plus a new first-shell-paint mark; compare cold boot before/after on web and in the mobile WebView (staging review app is already whitelisted in `HyloWebView`)
- **Playwright**: cold-boot spec — load authenticated, reload, assert nav/context menu visible before `MeQuery` resolves (block the request); logout spec — assert storage keys cleared; stale-group spec — change group server-side, reload, assert refreshed data replaces hydrated data
- **Manual mobile QA**: cold start, background/foreground, re-auth handshake (kill session cookie), logout across two mounted WebViews
- **Failure injection**: corrupt the stored JSON → `errorHandler` logs, app boots from empty state (redux-remember falls back to reducer defaults)

---

## 4. Phase 2 — Caching more of the ORM: pros and cons

Once Phase 1 proves the replay/SWR pattern, extending persistence is a per-dataset decision. The general trade-offs, then candidates:

### Whole-`orm` persistence (what v1 did)

**Pros**
- Everything paints instantly — streams, chats, profiles, previously visited groups
- No per-dataset code; one whitelist entry

**Cons (why v1 was removed)**
- Every ORM-presence check in ~hundreds of components becomes a staleness/identity hazard (`localId` collisions, topic-blocking bugs — both actually happened)
- Feed/list **ordering** lives in `queryResults`, which cannot be safely persisted (PR #1337) — so rehydrated posts mostly can't render as lists anyway; the payoff is smaller than it looks
- Size and write cost: the ORM grows unboundedly within a session; JSON-stringifying it on every (throttled) change is main-thread jank, and localStorage quota (~5MB) becomes reachable
- Schema churn: any ORM model change needs a migration/wipe, coupling deploys to cache versions
- Multi-tab clobbering amplitude: the bigger the blob, the worse a stale tab's overwrite

**Verdict:** don't repeat it. If "persist everything" ever becomes a goal, that's an argument for moving data fetching to a cache with per-query freshness built in (urql/TanStack offline exchange), not for serializing redux-orm.

### Selective candidates (in rough order of value)

| Dataset | Pro | Con / risk | Verdict |
|---------|-----|------------|---------|
| **Menu data for other groups** (`fetchGroupsMenuData` payloads) | Group switching paints instantly; today this is a 4.5s-delayed batch fill capped at 40 memberships | More payloads in the bootstrap slice (bounded by membership count); staleness handled by the existing batch refresh | **Good Phase 1.5** — same replay mechanism, just another action captured |
| **Last-viewed chat/stream posts** | Biggest perceived win for daily users (mobile opens straight into chat) | Needs `queryResults`-style ordering to render → the known-bad slice; `localId` hygiene; posts are the highest-churn data (edits, reactions, deletions while offline) | **Defer**; if wanted, persist a purpose-built "last N post IDs + rendered fields" snapshot per room, never ORM rows |
| **Message threads inbox** (`fetchThreads`) | Inbox paints instantly | Already deferred to idle, so it doesn't block boot; unread counts go stale fast | Low priority |
| **Topics / common views** | Cheap, small, low-churn | The Stream/ViewContent topic-guard bug class — must keep presence checks out of fetch logic | Fine, low value |
| **Notifications** | Badge continuity | Server correction arrives quickly anyway via `checkForNewNotifications` | Skip |
| **`queryResults`** | (ordering for any persisted lists) | Proven churn/staleness source; migration burden | **Never** (PR #1337) |

### Decision framework for any future addition

Persist a dataset only if **all** hold:

1. It renders during the boot window (before its fetch would resolve)
2. It can be replayed through the normal ingestion path (no bespoke merge logic)
3. Its staleness is either harmless to show or corrected by an existing revalidation trigger
4. It contains no client-generated identifiers or list-ordering state
5. Its size is bounded (cap or LRU)

---

## 5. Query restructuring: making more data cacheable

The replay-payload design caches whole query responses, so **what a query bundles together determines what can be cached and for how long**. Today's bootstrap queries bundle data with very different change cadences, which caps how useful the cache can be. Restructuring fixes that — and most of it is client-only query-text change, no backend work.

### 5.1 The problem in the current queries

- **`MeQuery` mixes cadences**: stable identity/profile/settings and the memberships list ride alongside volatile counters — `newNotificationCount`, `unseenThreadCount`, and per-membership `newPostCount`. One counter tick makes the whole ~everything payload look changed: more disk writes, staler-feeling cache, bigger multi-tab clobber surface.
- **`fetchForGroup` is monolithic**: the shell (name, avatar, settings, `homeRoute`, context widgets) is bundled with heavy, rarely-needed fields (`agreements`, `stewards` with full roles/responsibilities, `geoShape`, `locationObject`) and with widget counters (`highlightNumber`, `secondaryNumber`). The payload is too big to persist for many groups, and too volatile to stay "fresh".
- **`fetchForGroup` has a server side effect**: `updateLastViewed: true` marks the group visited. A cached/replayed response silently stops performing that write — cacheable reads and server writes shouldn't share a query.
- **Field shapes differ per call site**: the `group` selection inside `MeQuery.memberships`, `fetchGroupsMenuData`, and `fetchForGroup` are three hand-maintained, divergent subsets. The same Group lands in the ORM with different completeness depending on which query ran — which is exactly what makes "row exists" an unreliable signal.
- **List ordering lives in `queryResults`**: stream/chat responses are offset windows accumulated client-side under param-keyed entries, so no single response is a self-contained, replayable unit. This is the structural reason Phase 2 defers post caching.

### 5.2 Client-only restructurings (no backend changes)

1. **Split by change cadence.** Pull counters out of `MeQuery` and `fetchForGroup` into a tiny `meCounts`-style query (notification/thread counts, membership `newPostCount`, widget highlight numbers) fetched at boot and corrected by sockets/polling — and **never persisted**. The remaining shell payloads become low-churn: they persist rarely, rehydrate without lying, and barely contend across tabs. This is only a different field selection over the existing schema.
2. **Split `fetchForGroup` into shell vs detail.** `groupShell` (identity, settings, `homeRoute`, context widgets minus counters) vs `groupDetail` (agreements, stewards, geo fields) fetched when settings/about views need it. The shell becomes small enough to persist for **every membership group**, not an LRU-5 — group switching then always paints from disk.
3. **Shared fragments as cache units.** Define e.g. `GroupShellFragment` and `MembershipFragment` used by `MeQuery`, `fetchGroupsMenuData`, and `groupShell`, so the same shape lands in the ORM identically regardless of which query delivered it. Replayed payloads and live payloads then can't disagree about completeness.

### 5.3 Backend-assisted restructurings (bigger wins, more work)

4. **Single bootstrap query.** Cold boot is currently a waterfall: `checkLogin` → (authorized) → `AuthLayoutRouter` mounts → `fetchForCurrentUser` ∥ `fetchForGroup`. A `bootstrap(groupSlug:)` query returning auth facts + me shell + memberships summary + current group shell collapses two network legs into one **and** gives the cache a single unit with a single revalidation key. (This was "Option B" in the original design doc; replay-caching makes it more valuable.)
5. **Move the visit side effect to a mutation.** Replace `updateLastViewed: true` with an explicit `recordGroupVisit` mutation dispatched on navigation, so the group read is pure and safely cacheable/replayable.
6. **`updatedAt` stamps on cacheable entities.** `Group`, `Me`, and the context-widget set returning `updatedAt` (as `cookieConsentPreferences` already does) enables: cheap freshness decisions on rehydrate, conditional revalidation (`groupShell(slug, ifModifiedSince:)` returning null when unchanged — near-zero-byte responses for warm boots), and a principled revision marker for the multi-tab CAS guard (§6).
7. **Self-contained view snapshots (unlocks Phase 2 posts).** The reason last-viewed chat/stream caching is deferred is that ordering lives in `queryResults`. A per-view snapshot query — e.g. `chatRoom(id:) { lastReadPostId, recentPosts(last: 30) { ... } }` — returns a bounded, ordered, self-describing unit keyed by the logical view. That payload *is* replayable: persist it per last-visited room and the chat paints instantly on mobile cold boot without touching `queryResults`. This is the single highest-leverage schema change for extending the cache beyond the shell.

### 5.4 Costs and sequencing

Cadence/shell splits add one or two extra requests per boot (mitigable by batching over one HTTP request) and each split adds an invalidation key to own. The suggested order matches effort-to-payoff: do (1)–(3) alongside Phase 1 since they shrink and stabilize exactly the payloads Phase 1 persists; take (4)–(6) as a backend follow-up; treat (7) as the gate for any Phase 2 post caching.

---

## 6. Multi-tab / multi-WebView safety

`localStorage` is last-writer-wins and every tab/WebView has its own Redux store. On mobile v2, multiple same-origin WebViews concurrently mounted is the **normal** case. Without a guard, an idle context can persist stale state over a fresher blob.

redux-remember has no built-in answer, but its `Driver` interface (`getItem`/`setItem`) makes the guard clean:

1. **Compare-and-swap driver wrapper** (do in Phase 1): before `setItem`, read the current blob and skip the write if disk carries a newer revision (the `bootstrap` slice's `at` timestamps — e.g. `max(currentUser.at, ...groupsBySlug[*].at)` — are the monotonic markers). ~20 lines, unit-testable in isolation
2. **`storage` event listener** (fast follow): when another context updates our keys with a newer revision, dispatch a controlled merge (re-dispatch `@@REMEMBER_REHYDRATED`-shaped ingest) so idle tabs converge instead of staying stale. Verify the event fires between WebViews on both platforms; fall back to focus-time re-reads if not
3. **Blast-radius limits** (free with this design): small slices + `persistThrottle: 2000` + no per-socket-tick counters in the persisted payloads

Invariants:

- Never assume "this context's Redux is the source of truth for disk"
- Logout in one context empties storage; other contexts observe (storage event or native `LOGOUT` message) and reset instead of continuing logged-in
- A woken background context revalidates from network, but disk must not regress from its stale write

---

## 7. Sequence summary

1. `bootstrap` reducer capturing raw payloads + `LOGOUT` clear
2. `rememberReducer`/`rememberEnhancer` wiring with CAS driver wrapper, `migrate` versioning, throttle
3. Rehydration flag + ORM replay step
4. Paint gating in `RootRouter` / `AuthLayoutRouter` (skeletons skip when hydrated; fetches untouched)
5. Playwright + mobile verification (§3.6)
6. Query cadence/shell splits and shared fragments (§5.2) — alongside or immediately after Phase 1, since they shrink and stabilize the persisted payloads
7. Fast follows: `storage`-event convergence; capture `fetchGroupsMenuData` payloads (Phase 1.5)
8. Backend follow-ups: single bootstrap query, `recordGroupVisit` mutation, `updatedAt` stamps (§5.3)
9. Phase 2 datasets only via the decision framework in §4 — post caching gated on view-snapshot queries (§5.3.7)

---

## References

- [redux-remember](https://github.com/zewish/redux-remember) — [API reference](https://redux-remember.js.org/api/) (`rememberEnhancer` options incl. `migrate`, `persistThrottle`, `errorHandler`; action types `@@REMEMBER_REHYDRATED` / `@@REMEMBER_PERSISTED`)
- redux-persist maintenance status: [rt2zz/redux-persist#1420](https://github.com/rt2zz/redux-persist/issues/1420), [reduxjs/redux-toolkit#4125](https://github.com/reduxjs/redux-toolkit/discussions/4125)
- Prior Hylo integration: `dba34a199` (add), `3cbcba27e` / PR #1337 (drop queryResults), `8ce82b8ec` / PR #1343 (remove)
- Current architecture: `store/reducers/authSession.js`, `store/selectors/getSignupState.js`, `routes/RootRouter/RootRouter.js`, `routes/AuthLayoutRouter/AuthLayoutRouter.js`, `apps/mobile/src/components/HyloWebView/HyloWebView.js`
