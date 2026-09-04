# Sandbox Mode — Design Proposal

**Status:** In progress (Phase 0 complete; demo polish underway)
**Scope:** `apps/web` (inherited by `apps/mobile` and `apps/mobile-leap` via WebView)
**Related:** `docs/bootstrap-persist-redux-proposal.md`, `docs/sentry-setup.md`

---

## 1. Goal

Offer a logged-out visitor a working, explorable version of Hylo at `/sandbox` — a handful of
groups with credible existing content that they can read, navigate, and interact with. Nothing
they do is ever written to the database.

The demo must use **the same components, routes, reducers, and store as the real app**, so that
ordinary product work keeps the sandbox current automatically. No forked route tree, no
`isSandbox` prop threaded through the component layer.

---

## 2. The structural finding that shapes everything

Every GraphQL request in `apps/web` passes through a single choke point.

`graphqlMiddleware` converts an action's `graphql: { query, variables }` into
`payload: { api: { path: '/noo/graphql', ... } }`, and `apiMiddleware` is the only thing that
turns that into a network call:

```js
// apps/web/src/store/middleware/apiMiddleware.js
export default function apiMiddleware (req) {
  return store => next => action => {
    const { payload, meta } = action
    if (!payload || !payload.api) return next(action)
    const { path, params, method } = payload.api
    let promise = fetchJSON(path, params, { method, cookie, host: getHost() })
    // ...
  }
}
```

**Consequence:** sandbox mode is a *transport* concern, not a component concern. Swap what
`fetchJSON` talks to and the whole app — components, actions, redux-orm, `queryResults`
pagination, optimistic updates — runs completely unmodified.

The auth gate falls out of this for free. `RootRouter` derives everything from the `authSession`
slice, which is populated solely from the response to `checkLogin()`:

```js
// apps/web/src/store/reducers/authSession.js
if (action.type === CHECK_LOGIN) {
  if (action.error) return anonymousSession()
  const me = action?.payload?.data?.me
  if (!me) return anonymousSession()
  return authenticatedSession(me)
}
```

If the sandbox transport answers `checkLogin` with a synthetic `me`, `getAuthorized` becomes
true and `AuthLayoutRouter` renders the real authenticated app. **Zero changes to auth code.**

---

## 3. Options considered

### 3.1 Where to intercept

| Option | Verdict |
|---|---|
| **Transport swap in `apiMiddleware`** | **Chosen.** Single choke point, already has the printed query + variables, no service worker, trivially testable. |
| `window.fetch` override / MSW service worker | Rejected as the *primary* mechanism (service worker registration in prod, scope complexity). **Retained as a secondary safety net** — see §5.1. |
| Per-component flag | Rejected. Violates the "same code" requirement and would touch hundreds of files. |

### 3.2 What answers the requests

| Option | Verdict |
|---|---|
| **A. Preload redux-orm, no interception** | **Rejected.** The app refetches on navigation and `queryResults` is rebuilt from responses. Unintercepted fetches would hit the real server and wipe seeded lists. Non-viable standalone. |
| **B. Hand-written per-operation handlers** | **Current implementation** (Phase 0). Acceptable while the demo is polished; still the destination is Option C. |
| **C. Execute the real schema in-browser** | **Chosen destination.** See below. |

**Option C** loads `apps/backend/api/graphql/schema.graphql` (163KB SDL, 199 types, already a
single static file) into `graphql-js`'s `execute()` via `@graphql-tools/mock`'s
`addMocksToSchema` over a seeded `MockStore`.

Why it wins here:

- `graphql` is already a dependency (`graphql-tag`, `graphql/language/printer` are used in `apps/web/src/util/graphql.js`)
- Every query resolves shape-correct automatically; unknown/new fields never crash
- Hand-written resolvers needed only for the ~30 operations that must behave *for real*
- Doubles as a deterministic fixture backend for Playwright — a significant secondary payoff

Cost: bundle size. Must be a dynamic `import()` in its own Vite chunk so normal users never
download it. Estimate on the order of ~100KB gzipped; **to be measured, not assumed**.

### 3.3 Rejected alternative: server-side sandbox

Disposable seeded accounts on a real backend, wiped nightly. 100% fidelity forever, near-zero
maintenance, no frontend architecture changes.

**Not chosen** because it violates the "never saved to the database" requirement, needs backend
tenancy + cleanup work, and carries real risk of demo content leaking into public feeds or
search. Recorded here so the trade-off is explicit rather than assumed away.

---

## 4. Decisions taken

| # | Decision |
|---|---|
| D1 | Option C — schema-driven in-browser mock engine (destination; Phase 0 uses hand-written handlers) |
| D2 | Interception at the `apiMiddleware` transport, plus a `window.fetch` guard as safety net |
| D3 | **No persistence.** Reload = fresh sandbox. |
| D4 | **No login/logout.** Those mutations are out of scope. |
| D5 | **No socket updates.** Sockets are stubbed out entirely. |
| D6 | Tier 1 + Tier 2 actions in scope; Tier 3 deferred but needs UX handling now |
| D7 | Cookie consent hidden/skipped in sandbox |
| D8 | Routing via `/sandbox` path prefix |
| D9 | Mixpanel suppressed; Sentry tagged (not dropped) |
| D10 | Timestamps regenerated at page load from relative offsets |
| D11 | Seed data structured for per-locale content from day one; only `en` authored initially |
| D12 | Share/copy-link buttons left as-is — not special-cased for sandbox |
| D13 | Mapbox stays live; seed geo data so the map has content |
| D14 | Conversion CTA: after 3 user-created posts, prompt "Sign up to keep going" (no state migration) |
| D15 | Mobile: "Try the demo" entry in `NonAuthRootNavigator` → WebView at `/sandbox` |
| D16 | `/sandbox` gets `noindex` (robots meta +/or header) |

### D3 is a large simplification

Dropping persistence removes IndexedDB work, removes schema-drift-on-persisted-data problems,
and sidesteps the ORM rehydration issues that motivated removing redux-persist (see
`docs/bootstrap-persist-redux-proposal.md`). The "start over" control becomes
`window.location.reload()`.

---

## 5. Architecture

### 5.1 Transport + safety net

Primary: `apiMiddleware` calls `sandboxTransport(path, params)` instead of `fetchJSON` when
sandbox mode is active. The transport routes `/noo/graphql` to the mock engine and handles the
small number of other `payload.api` paths (`/noo/upload`, `/noo/session`).

Secondary: during sandbox bootstrap, wrap `window.fetch` to hard-block any non-allowlisted
request to `/noo/*` — throw loudly in dev, silent no-op in prod. **This guard is what actually
delivers the "never touches the database" guarantee**, because these paths bypass Redux entirely:

| Escape hatch | Handling |
|---|---|
| `apps/web/src/util/graphql.js` — `queryHyloAPI` fetches `/noo/graphql` directly | Guard routes to `sandboxTransport` |
| `apps/web/src/util/offerings.js` — direct `/noo/graphql` fetch | Sandbox early-exit + Pattern B; guard as backstop |
| `apps/web/src/client/websockets.js` — **auto-connects at module import** and starts a 30s heartbeat | Stubbed, see §5.4 |
| `apps/web/src/client/filestack.js` — third-party upload widget | Local blob picker in sandbox (§5.5) |
| `apps/web/src/util/cookieConsent.js` — `/noo/cookie-consent` | Hidden in sandbox (D7) |
| Group export, Stripe admin endpoints | Tier 3, blocked by guard |
| `apps/web/src/hooks/useNewAppVersion.js` — fetches `/` | Harmless, allowlist |

**Implemented:** `apps/web/src/sandbox/guard.js` installed from `index.jsx` before React mounts.
`/noo/graphql` and `/noo/upload` are answered by `sandboxTransport`; other `/noo/*` paths return
403 JSON. Non-`/noo` requests (Mapbox, Sentry, CDN avatars) pass through.

### 5.2 Mock engine

```
sandbox/
  isSandbox.js        — mode detection from /sandbox path
  SandboxBanner.jsx   — demo chrome (reset, signup, locale)
  transport.js        — sandboxTransport, replaces fetchJSON
  guard.js            — window.fetch safety net
  handlers.js         — hand-written GraphQL handlers (Phase 0)
  parseGraphql.js
  seed/
    index.js          — loadSandboxSeed(locale)
    constants.js      — placeholders, slugs
    helpers.js        — ids, timestamp materialization
    README.md         — editing guide
    en/               — demo content
      index.js        — assembles full seed
      people.js       — Me + members
      groups.js       — groups, spaces, views, memberships
      posts.js        — stream, chat, funding submissions
      comments.js     — comments, reactions, proposals
      tracks.js
      fundingRounds.js
      messageThreads.js
      notifications.js
```

Phase 1 still needs: copy/import `schema.graphql` into the web sandbox chunk, CI assert it matches
backend, `addMocksToSchema` + `MockStore`, hand-written resolvers for Tier 1 semantics.

### 5.3 Routing

`/sandbox` prefix via react-router's `basename`. **Audit completed — see §10 for full findings.**
Viable, with three call sites requiring fixes (done in Phase 0).

**Important correction:** `createBrowserHistory({ basename })` does **nothing**. history 5.3.0
removed basename support. The basename must be supplied to `redux-first-history` and to the
router instead (see `apps/web/src/store/index.js` + `apps/web/src/router/index.js`).

Exiting the sandbox is a link to `/signup` or `/login`, which is outside the basename.

#### The one sharp edge

The two navigation mechanisms in use handle basename **differently**:

| Mechanism | Basename handling | Safe if given an already-prefixed path? |
|---|---|---|
| `dispatch(push(url))` — redux-first-history | `appendBasename()` with a `startsWith` guard | **Yes** — idempotent |
| `navigate(url)` / `<Navigate to>` — react-router | `joinPaths([basename, pathname])`, unconditional | **No** — double-prefixes |

So any code that reads `window.location.pathname` (which *includes* `/sandbox`) and feeds it
back into `navigate()` produces `/sandbox/sandbox/...`. Use `useLocation().pathname` instead.

### 5.4 Sockets (D5)

Sandbox reuses the existing no-op stub branch in `websockets.js` by extending the `isClient`
condition. Live-feeling fake socket events remain out of scope.

### 5.5 File uploads

**Implemented (Pattern C):** `filestackPicker` in sandbox opens a plain `<input type="file">`
and returns `URL.createObjectURL(file)`. Stage 2 `/noo/upload` is intercepted by the transport
and echoes the blob URL. `transformFile` skips Filestack CDN rewrite when there is no handle.

Caveats:
- Blob URLs are per-document. They survive SPA navigation but not reload — acceptable given D3.

### 5.6 Timestamps (D10)

Seed fixtures store **relative offsets**, not absolute dates. The seed loader materialises
absolute ISO timestamps from `Date.now()` at boot.

### 5.7 Analytics and error reporting (D9)

- **Mixpanel** — suppressed in sandbox
- **Intercom** — suppressed in sandbox
- **Sentry** — tagged `sandbox: true`

---

## 6. Action tiers (D6)

**Tier 1 — fully interactive, real relational side-effects in the mock store**
Create post, comment, reply, react/emoji, edit own post/comment, delete own post/comment,
navigate all group/stream/chat views, edit profile, **local search**.

**Tier 2 — succeeds optimistically, not deeply modelled**
Join/leave group, follow topic, save post, RSVP to event, mark read, mute thread, direct
messages, settings toggles.

**Tier 3 — no real implementation, but needs a deliberate UX treatment**

| Pattern | Behaviour | When to use |
|---|---|---|
| **A — Hide** | Not rendered at all | The control makes no sense for a visitor and showing it adds confusion |
| **B — Disabled + tooltip** | Rendered, inert, "Not available in the demo" | The control's *presence* demonstrates the product; hiding it would undersell Hylo |
| **C — Fake success** | Behaves normally, local-only effect, no network | The interaction itself is the thing worth demoing |
| **D — Signup prompt** | Opens "Create an account to do this" | High-intent actions — the conversion opportunity |

| Item | Pattern | Status |
|---|---|---|
| Stripe checkout / paid offerings | **B** | Done — early exit in `offerings.js` + mutation stub; UI shows error |
| Invite by email / resend / reinvite all | **D** | Done — toast + Sign up action in InviteSettingsTab |
| Copy public group / invite link | **leave as-is** | D12 |
| Social login / OAuth | **A** | Implicit (no login in sandbox) |
| Group data export | **A** | Blocked by fetch guard |
| Delete / deactivate account | **A** | Still visible in settings — should hide or Pattern D |
| Zapier triggers, integrations | **B** | Still open |
| Group calendar subscribe | **B** | Still open (external link; low risk) |
| Link previews on pasted URLs | **C** | Soft degrade (returns null) |
| Location autocomplete | **C** | Canned Oakland location |
| Map tiles | **leave live** | D13; seed geo present |
| Create group | **C** | Partially via default mutation stub — verify UX |
| File uploads | **C** | Done — blob picker |
| Notification / email settings toggles | **C** | Default mutation stub |
| Flag / report content | **C** | Default mutation stub |
| Direct messages | **C** / Tier 2 | Seeded threads + createMessage |
| Cookie consent | **A** | Done (D7) |
| Topics browse | empty list | Acceptable for now; seed topics later if needed |
| Conversion after 3 posts (D14) | **D** | Still open |

---

## 7. Internationalisation (D11)

**Sandbox chrome** — demo banner, reset, signup CTA, locale selector, Tier 3 messaging. Added to
all six locale files when written.

**Demo content** — still English-only seed (`seed/en/`). Locale selector switches UI chrome only.
Options B (locale-keyed seed with `en` fallback) remains the plan when product wants translated
demo content.

---

## 8. Open questions

**Resolved:**

| Topic | Decision |
|---|---|
| Demo content authorship | Seed lives in `apps/web/src/sandbox/seed/en/*.js` |
| Conversion moment | **D14** — soft prompt after 3 user-created posts (not yet implemented) |
| Mobile entry point | **D15** — "Try the demo" on native login |
| SEO | **D16** — `noindex` on all `/sandbox` routes |
| Basename audit | §10 |
| Tier 3 UX | §6 (patterns A–D) |
| Mapbox | D13 |
| Share links | D12 |

**Still open for product:**

| Topic | Notes |
|---|---|
| Web login/marketing entry | Add "Try the demo" on `/login` / marketing site pointing at `/sandbox` |
| Seed localization | Ship EN-only messaging, or author `seed/es` etc. |
| Remaining Tier 3 rows | Account delete, Zapier, calendar subscribe, D14 conversion prompt |

---

## 9. Phasing

**Phase 0 — spike.** Done. `/sandbox` + transport + seed handlers + AuthLayout shell.

**Phase 1 — mock engine.** Schema load, `addMocksToSchema` + `MockStore`, Tier 1 resolvers.

**Phase 2 — hardening.** Fetch guard ✓, upload blob ✓, more Tier 2/3 UX, conversion banner (D14).

**Phase 3 — product polish.** Demo banner ✓, real seed copy ✓, locale chrome ✓, Tier 3 UX
(partial), mobile entry (D15), login-page entry.

**Phase 4 — payoff.** Playwright against `/sandbox` without live API/DB.

---

## 12. Implementation TODOs

### Phase 0 — spike (transport + basename + seed handlers)

- [x] Detect sandbox from `/sandbox` pathname (`isSandboxMode`)
- [x] Wire `basename: '/sandbox'` via `redux-first-history` + `HistoryRouter`
- [x] Swap `apiMiddleware` `fetchJSON` → sandbox transport (dynamic import)
- [x] Hand-written GraphQL handlers over seed (CheckLogin, Me, groups, posts, threads, mutations, **search**)
- [x] Configurable response delay (~150–250ms, 0 in tests)
- [x] Stub sockets in sandbox
- [x] Skip Mixpanel init/track; skip Intercom boot
- [x] Tag Sentry with `sandbox: true`
- [x] Skip cookie consent
- [x] `noindex` on `/sandbox`
- [x] Basename fixes: GroupDetail, ContextMenuOld, CreateTopic
- [x] Basename hardening: PostHeader, SkillsSection, SkillsToLearnSection
- [x] Real demo seed (Terran / East Bay Connect / Holistica) + map locations
- [x] Demo banner + reset + signup CTA + locale selector (i18n in all 6 locales)

### Phase 1 — schema-driven mock engine

- [ ] Copy/import `schema.graphql` into the web sandbox chunk; CI assert it matches backend
- [ ] `addMocksToSchema` + `MockStore` over `loadSandboxSeed()`
- [ ] Hand-written resolvers for Tier 1 list/filter/pagination + create/edit/delete post/comment/react
- [ ] Unknown fields resolve via mocks (no crash)

### Phase 2 — hardening

- [x] `window.fetch` guard for `/noo/*` escape hatches
- [x] Upload blob picker
- [x] Local search over seed people/posts/comments
- [x] Stripe checkout Pattern B
- [x] Invite Pattern D (signup toast)
- [ ] Conversion CTA after 3 user-created posts (D14)
- [ ] Remaining Tier 2 mutation semantics (join, RSVP, save, mute, settings depth)
- [ ] Hide / Pattern-D account delete & deactivate

### Phase 3 — product polish

- [x] Demo banner + reset + signup CTA + locale selector
- [x] Replace seed placeholders with real copy (EN)
- [ ] Remaining Tier 3 UX (Zapier, calendar subscribe affordances)
- [ ] "Try the demo" on web login / marketing
- [ ] Mobile “Try the demo” entry (D15)

### Phase 4 — payoff

- [ ] Playwright can run against `/sandbox` without a live API/DB

---

## 10. Appendix — basename audit findings

Audit of every construct in `apps/web/src` that could bypass react-router's `basename`.
**Verdict: `/sandbox` via basename is viable. Three call sites needing fixes are done.**

### 10.1 Mechanism corrections

- history 5.3.0 has **no** basename support — wire through `createReduxHistoryContext` and
  `<HistoryRouter>` instead (§5.3).
- `push()` and `navigate()` differ: `push()` guards with `startsWith`, `navigate()` does not.

### 10.2 Confirmed breaks — fixed

| # | Site | Problem |
|---|---|---|
| 1 | `routes/GroupDetail/GroupDetail.js` | `navigate(window.location.pathname)` → double prefix |
| 2 | `ContextMenuOld.jsx` | same |
| 3 | `components/CreateTopic/CreateTopic.js` | infinite redirect loop |

Fix: use `useLocation().pathname` (basename-stripped).

### 10.3 Safe, but only by accident — worth hardening

| # | Site | Why it survives |
|---|---|---|
| 4 | `PostHeader` → `push(closeUrl)` | `push()` `startsWith` guard |
| 5 | Skills sections `from` querystring | Verify consumer doesn't `navigate()` a prefixed path |

### 10.4 Not affected

Share links that build `${origin}/groups/…` produce real-app URLs (D12). External calendars,
`tel:`/`mailto:`, OAuth — Tier 3 or external.

### 10.5 Latent issue

`state.router.location.pathname` includes `/sandbox` while `useLocation()` strips it. Nothing
in `apps/web/src` currently reads `state.router.location`. Worth a lint rule to keep it that way.

---

## 11. Appendix — key file references

| Concern | File |
|---|---|
| Transport choke point | `apps/web/src/store/middleware/apiMiddleware.js` |
| Query → api payload | `apps/web/src/store/middleware/graphqlMiddleware.js` |
| Store + history creation | `apps/web/src/store/index.js` |
| Auth gate | `apps/web/src/routes/RootRouter/RootRouter.js` |
| Sandbox mode | `apps/web/src/sandbox/isSandbox.js` |
| Sandbox transport | `apps/web/src/sandbox/transport.js` |
| Fetch guard | `apps/web/src/sandbox/guard.js` |
| GraphQL handlers | `apps/web/src/sandbox/handlers.js` |
| Demo banner | `apps/web/src/sandbox/SandboxBanner.jsx` |
| Seed data | `apps/web/src/sandbox/seed/` |
| Uploads (sandbox blob) | `apps/web/src/client/filestack.js` |
| Schema SDL (Phase 1) | `apps/backend/api/graphql/schema.graphql` |
| Locales | `apps/web/public/locales/{de,en,es,fr,hi,pt}.json` |
