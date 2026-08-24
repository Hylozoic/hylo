# Sandbox Mode — Design Proposal

**Status:** In progress (Phase 0)
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
| **B. Hand-written per-operation handlers** | **Rejected as destination.** ~250 distinct GraphQL operations exist in `apps/web/src`. Any missed operation returns undefined and breaks a screen; drifts on every schema change. Acceptable for the Phase 0 spike only. |
| **C. Execute the real schema in-browser** | **Chosen.** See below. |

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
| D1 | Option C — schema-driven in-browser mock engine |
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
| `apps/web/src/util/graphql.js` — `queryHyloAPI` fetches `/noo/graphql` directly | Blocked by guard; route to mock engine if a sandbox screen needs it |
| `apps/web/src/util/offerings.js:42` — direct `/noo/graphql` fetch | Tier 3 (Stripe), blocked |
| `apps/web/src/client/websockets.js` — **auto-connects at module import** and starts a 30s heartbeat | Stubbed, see §5.4 |
| `apps/web/src/client/filestack.js` — third-party upload widget | See §5.5 |
| `apps/web/src/util/cookieConsent.js` — `/noo/cookie-consent` | Hidden in sandbox (D7) |
| Group export, Stripe admin endpoints | Tier 3, blocked |
| `apps/web/src/hooks/useNewAppVersion.js` — fetches `/` | Harmless, allowlist |

### 5.2 Mock engine

```
sandbox/
  index.js            — bootstrap, mode detection, dynamic import of the engine
  transport.js        — sandboxTransport, replaces fetchJSON
  engine.js           — schema load + addMocksToSchema + MockStore
  guard.js            — window.fetch safety net
  resolvers/          — hand-written resolvers for Tier 1/2 semantics
  seed/
    index.js          — loadSandboxSeed(locale)
    constants.js      — placeholders, slugs
    helpers.js        — ids, timestamp materialization
    README.md         — editing guide
    en/               — scaffolded demo content (edit copy here)
      index.js        — assembles full seed
      people.js       — Me + members
      groups.js       — groups, spaces, views, memberships
      posts.js        — stream, chat, funding submissions
      comments.js     — comments, reactions, proposals
      tracks.js
      fundingRounds.js
      messageThreads.js
```

The schema must be copied into the web build (or imported from the backend workspace) at build
time, with a CI assertion that the copy matches `apps/backend/api/graphql/schema.graphql` so it
cannot drift.

### 5.3 Routing

`/sandbox` prefix via react-router's `basename`. **Audit completed — see §10 for full findings.**
Viable, with three call sites requiring fixes.

**Important correction:** `createBrowserHistory({ basename })` does **nothing**. history 5.3.0
removed basename support (verified: zero occurrences of `basename` in the installed package).
The basename must be supplied to `redux-first-history` and to the router instead:

```js
// apps/web/src/store/index.js
const isSandbox = typeof window !== 'undefined' && window.location.pathname.startsWith('/sandbox')
export const sandboxBasename = isSandbox ? '/sandbox' : undefined

const { createReduxHistory, routerMiddleware, routerReducer } = createReduxHistoryContext({
  history: createBrowserHistory(),
  basename: sandboxBasename
})
```

```jsx
// apps/web/src/router/index.js
<Router history={history} basename={sandboxBasename}>
```

`redux-first-history` documents `basename` explicitly as a "history v5 fix". It threads it into
the router middleware (prepending on `push`/`replace`) and forwards it from `HistoryRouter` to
react-router's `Router`.

Every `Link` and `navigate()` call is then prefixed automatically — `/sandbox/groups/demo/all`,
`/sandbox/my/posts` — with no changes to `packages/navigation`.

Exiting the sandbox is a link to `/login`, which is outside the basename.

#### The one sharp edge

The two navigation mechanisms in use handle basename **differently**:

| Mechanism | Basename handling | Safe if given an already-prefixed path? |
|---|---|---|
| `dispatch(push(url))` — redux-first-history | `appendBasename()` with a `startsWith` guard | **Yes** — idempotent |
| `navigate(url)` / `<Navigate to>` — react-router | `joinPaths([basename, pathname])`, unconditional | **No** — double-prefixes |

So any code that reads `window.location.pathname` (which *includes* `/sandbox`) and feeds it
back into `navigate()` produces `/sandbox/sandbox/...`. The same code passed to `push()` is fine
by accident. This asymmetry is the source of every break found in §10.

### 5.4 Sockets (D5)

`apps/web/src/client/websockets.js` already has a no-op stub branch for non-browser
environments:

```js
const noop = () => {}
socket = { get: noop, post: noop, on: noop, off: noop }
```

Sandbox reuses it by extending the `isClient` condition. Verified safe: `SocketListener` and
`SocketSubscriber` only call `.on` / `.off` / `.post`. `SocketSubscriber`'s error path fires
from a callback that a no-op never invokes, so nothing reports an error. This also prevents the
live socket connection and 30-second heartbeat that would otherwise start at module import.

Live-feeling fake socket events (a bot posting after 20s) are explicitly **out of scope** but
would be cheap later, since `SocketListener.store.js` already feeds redux-orm.

### 5.5 File uploads

Uploads are two-stage today:

1. Filestack picker (third-party widget) uploads to the Filestack CDN, returns `{ url, filename, mimetype }`
2. `uploadAttachment` POSTs `/noo/upload` with that URL — this already goes through `payload.api`, so it is **already interceptable**

**Proposed approach:** replace `filestackPicker` in sandbox with a local implementation that
opens a plain `<input type="file">` and returns `URL.createObjectURL(file)` as the `url`. Stage 2
is then intercepted and echoes the same blob URL back.

Why this works cleanly here: the only Filestack CDN URL rewrite in the codebase is a single line
in `transformFile` (`apps/web/src/client/filestack.js:75`), which sandbox skips. No other
component depends on Filestack URL transforms, so blob URLs are safe everywhere else.

Caveats:
- Blob URLs are per-document. They survive SPA navigation but not reload — acceptable given D3.
- Should `URL.revokeObjectURL` on cleanup to avoid leaking memory over a long session.

**Fallback if this proves fiddly:** disable uploads in sandbox with a Tier 3 affordance. The
blob approach should be attempted first — it is a genuinely good demo moment (upload your own
avatar) for modest effort.

### 5.6 Timestamps (D10)

Seed fixtures store **relative offsets**, not absolute dates:

```js
{ createdAtOffset: -3600 }  // one hour before page load
```

The seed loader materialises absolute ISO timestamps from `Date.now()` at boot, so the demo
never looks stale.

### 5.7 Analytics and error reporting (D9)

- **Mixpanel** — `mixpanelMiddleware` sits in the middleware chain and Mixpanel initialises in
  `RootRouter`. Must be suppressed in sandbox or it pollutes the funnel.
- **Intercom** — initialises in `AuthLayoutRouter`. Suppress.
- **Sentry** — tag sandbox sessions rather than dropping them. We want to know when the demo
  breaks.

---

## 6. Action tiers (D6)

The expensive part is not shape, it is *semantics*. The mock schema gives correct response
shapes for free; it does not make a new post appear in the right group stream, topic feed, and
search results, then keep answering `posts(sortBy:, filter:, offset:)` correctly on refetch.
Reimplementing that filtering, sorting, and pagination in the mock resolvers is the bulk of the
work.

Working in our favour: 45 files already use `optimistic: true` and `ormReducer` has 103
`_PENDING` cases, so a large share of interactions already feel instant without server round-trip
semantics.

**Tier 1 — fully interactive, real relational side-effects in the mock store**
Create post, comment, reply, react/emoji, edit own post/comment, delete own post/comment,
navigate all group/stream/chat views, edit profile.

**Tier 2 — succeeds optimistically, not deeply modelled**
Join/leave group, follow topic, save post, RSVP to event, mark read, mute thread, direct
messages, settings toggles.

**Tier 3 — no real implementation, but needs a deliberate UX treatment**

Rather than 18 ad-hoc decisions, four reusable patterns. Each Tier 3 item is assigned one.

| Pattern | Behaviour | When to use |
|---|---|---|
| **A — Hide** | Not rendered at all | The control makes no sense for a visitor and showing it adds confusion |
| **B — Disabled + tooltip** | Rendered, inert, "Not available in the demo" | The control's *presence* demonstrates the product; hiding it would undersell Hylo |
| **C — Fake success** | Behaves normally, local-only effect, no network | The interaction itself is the thing worth demoing |
| **D — Signup prompt** | Opens "Create an account to do this" | High-intent actions — the conversion opportunity |

| Item | Pattern | Notes |
|---|---|---|
| Stripe checkout / paid offerings | **B** | Three sites assign `window.location.href = checkoutData.url` (`OfferingDetails.jsx:142`, `PaywallOfferingsSection.jsx:128`, `PaidContentTab.js:148`). Must be inert — paywalls are a selling point, so show them |
| Invite by email / resend / reinvite all | **D** | Strong signup intent |
| Copy public group / invite link | **leave as-is** | Decided (D12): not worth special-casing. Whatever it currently copies is acceptable |
| Social login / OAuth | **A** | No login in sandbox (D4) |
| Group data export | **A** | Hits `/noo/export/group` |
| Delete / deactivate account | **A** | Meaningless for a visitor |
| Zapier triggers, integrations | **B** | Presence demonstrates capability |
| Group calendar subscribe | **B** | Opens Google Calendar / `webcal:` externally |
| Link previews on pasted URLs | **C** | `findOrCreateLinkPreviewByUrl` hits the network. Serve one canned preview, or degrade silently to a plain link |
| Location autocomplete | **C** | Mapbox geocoding. Serve a small canned list of places |
| Map tiles | **leave live** | Decided (D13). Seed geo data on demo groups/posts so the map has content. Accepts the per-load Mapbox cost |
| Create group | **C** | Local-only; no real slug reservation |
| File uploads | **C** | Blob URL approach, §5.5 |
| Notification / email settings toggles | **C** | Toggles imply emails that will never send |
| Flag / report content | **C** | Fake success; moderation queue is not modelled |
| Direct messages | **C** | Already Tier 2, local only |
| `tel:` / `mailto:` on member profiles | **leave live** | Harmless, and works correctly |
| Cookie consent | **A** | Per D7 |

The pattern assignments matter more than the individual rows — new Tier 3 items should be
slotted into A/B/C/D rather than handled ad hoc. **Pattern D is the one to be deliberate about:**
every place we choose D over B is a conversion surface, and choosing it too often makes the demo
feel like a paywall.

---

## 7. Internationalisation (D11)

Six locales exist: `de`, `en`, `es`, `fr`, `hi`, `pt` (`apps/web/public/locales/*.json`).

Two distinct concerns, often conflated:

**Sandbox chrome** — the demo banner, reset control, signup CTA, Tier 3 "not available in the
demo" messaging. These are ordinary UI strings and follow the existing repo convention: added to
all six locale files at the time they are written.

**Demo content** — the group names, post bodies, comment threads, member bios in the seed data.

Options for demo content:

| Option | Notes |
|---|---|
| **A. English-only seed, no structure for translation** | Cheapest now, expensive to retrofit. Locks in a monolingual demo. |
| **B. Locale-keyed seed files with `en` fallback** | **Recommended.** `seed/en.js`, `seed/es.js`, …; loader takes the active locale and falls back to `en` per-record. Author `en` only for now. |
| **C. Route seed strings through i18next as translation keys** | Bloats the locale JSON files with prose, and demo content is not really UI copy. Poor fit. |
| **D. Machine-translate at build time** | Viable later as a bootstrap for B, but demo content is marketing-grade copy and deserves human review. |

**Recommendation: Option B.** The only thing that must be decided now is *not to hardcode
content strings inline in a single seed file*. Structuring the seed loader to take a locale from
the outset costs almost nothing and makes the later translation job a content task rather than a
refactor.

---

## 8. Open questions

**Resolved:**

| Topic | Decision |
|---|---|
| Demo content authorship | Seed lives in `apps/web/src/sandbox/seed/en/*.js` — editable files with placeholder conventions (`%` names, `*` copy). Engineering scaffolds structure; product/marketing replaces placeholders. See `apps/web/src/sandbox/seed/README.md`. |
| Conversion moment | **D14** — soft prompt after 3 user-created posts: "Sign up to keep going". No migration of sandbox state into a real account. |
| Mobile entry point | **D15** — "Try the demo" on native login/signup screens opens PrimaryWebView at `/sandbox`. |
| SEO | **D16** — `noindex` on all `/sandbox` routes. |
| Basename audit | §10 |
| Bundle budget | Lazy chunk only; no hard size cap |
| Tier 3 UX | §6 (patterns A–D) |
| Mapbox | D13 — live tiles, seeded geo |
| Share links | D12 — leave as-is |

---

## 9. Phasing

**Phase 0 — spike (2–3 days).** Validates the riskiest assumption cheaply.
`/sandbox` route, mode flag, transport swap in `apiMiddleware`, seed-backed hand-written
handlers (Option B), no schema execution. Success = `AuthLayoutRouter` renders the real app
shell against fake data with **no component changes**. **Done** — visit `/sandbox` with the
web dev server running.

**Phase 1 — mock engine.** Schema load, `addMocksToSchema` + `MockStore`, wire `loadSandboxSeed()`
(resolvers read from `apps/web/src/sandbox/seed/`), Tier 1 resolvers with list/filter/pagination
semantics.

**Phase 2 — hardening.** `window.fetch` guard, socket stub, Mixpanel suppression, Sentry
tagging, cookie consent hidden, basename routing (§10 fixes), upload blob handling, Tier 2
resolvers, conversion banner (D14), `noindex` (D16).

**Phase 3 — product polish.** Demo banner + reset + CTA styling, Tier 3 UX, replace seed
placeholders with real copy, mobile entry point (D15).

**Phase 4 — payoff.** Point the existing Playwright suite at sandbox mode for fast,
deterministic, DB-free E2E runs.

---

## 12. Implementation TODOs

Check these off as they land. Phase 0 is the current target: prove the real `AuthLayoutRouter`
renders against fake data with no component-level sandbox flags.

### Phase 0 — spike (transport + basename + seed handlers)

- [x] Detect sandbox from `/sandbox` pathname (`isSandboxMode`)
- [x] Wire `basename: '/sandbox'` via `redux-first-history` + `HistoryRouter` (not `createBrowserHistory`)
- [x] Swap `apiMiddleware` `fetchJSON` → sandbox transport (dynamic import, main bundle stays clean)
- [x] Hand-written GraphQL handlers over existing seed (CheckLogin, Me, groups, posts, threads, mutations)
- [x] Configurable response delay (~150–250ms, 0 in tests)
- [x] Stub sockets in sandbox
- [x] Skip Mixpanel init/track; skip Intercom boot
- [x] Tag Sentry with `sandbox: true`
- [x] Skip cookie consent
- [x] `noindex` on `/sandbox`
- [x] Basename fixes: GroupDetail, ContextMenuOld, CreateTopic
- [x] Basename hardening: PostHeader, SkillsSection, SkillsToLearnSection (`from` + `navigate`)

### Phase 1 — schema-driven mock engine

- [ ] Copy/import `schema.graphql` into the web sandbox chunk; CI assert it matches backend
- [ ] `addMocksToSchema` + `MockStore` over `loadSandboxSeed()`
- [ ] Hand-written resolvers for Tier 1 list/filter/pagination + create/edit/delete post/comment/react
- [ ] Unknown fields resolve via mocks (no crash)

### Phase 2 — hardening

- [ ] `window.fetch` guard for `/noo/*` escape hatches
- [ ] Upload blob picker (or disable with Tier 3 UX)
- [ ] Conversion CTA after 3 user-created posts (D14)
- [ ] Remaining Tier 2 mutation semantics (join, RSVP, save, mute, DMs, settings)

### Phase 3 — product polish

- [ ] Demo banner + reset + signup CTA (i18n chrome strings in all 6 locales)
- [ ] Tier 3 UX patterns A–D on listed surfaces
- [ ] Replace seed placeholders with real copy
- [ ] Mobile “Try the demo” entry (D15)

### Phase 4 — payoff

- [ ] Playwright can run against `/sandbox` without a live API/DB

---

## 10. Appendix — basename audit findings

Audit of every construct in `apps/web/src` that could bypass react-router's `basename`.
**Verdict: `/sandbox` via basename is viable. Three call sites need fixing.**

### 10.1 Mechanism corrections

- history 5.3.0 has **no** basename support — `createBrowserHistory({ basename })` silently does
  nothing. Wire it through `createReduxHistoryContext` and `<HistoryRouter>` instead (§5.3).
- `push()` and `navigate()` differ: `push()` guards with `startsWith`, `navigate()` does not.

### 10.2 Confirmed breaks — must fix

| # | Site | Problem |
|---|---|---|
| 1 | `routes/GroupDetail/GroupDetail.js:247-250` | `navigate(removeGroupFromUrl(window.location.pathname))` → `/sandbox/sandbox/...` |
| 2 | `routes/AuthLayoutRouter/components/ContextMenu/ContextMenuOld.jsx:550-555` | `navigate(addQuerystringToPath(window.location.pathname, …))` → double prefix |
| 3 | `components/CreateTopic/CreateTopic.js:214-216` | **Worst.** Compares basename-relative `topicUrl()` against prefixed `window.location.pathname`. They can never be equal, so `<Navigate replace />` fires on every render → **infinite redirect loop** |

All three have the same one-line fix: use react-router's `useLocation().pathname` (already
basename-stripped) instead of `window.location.pathname`. This is arguably a correctness
improvement in its own right, independent of sandbox.

### 10.3 Safe, but only by accident — worth hardening

| # | Site | Why it survives |
|---|---|---|
| 4 | `components/PostCard/PostHeader/PostHeader.js:163-166` → `push(closeUrl)` at :191, :199 | `closeUrl` carries `/sandbox`, but `push()`'s `startsWith` guard prevents double-prefixing |
| 5 | `components/SkillsSection/SkillsSection.js:87`, `SkillsToLearnSection/SkillsToLearnSection.js:55` | `from` embeds a prefixed path inside a querystring, then `push('/search?…')`. Safe on the way in — **verify the consumer of `from` doesn't `navigate()` it** |

### 10.4 Not affected

- `routes/ViewContent/MyDrafts.jsx:179` — `new URL(draft.navigateTo, origin)` is parsing only; `navigateTo` is stored basename-relative, and the extracted `url.pathname` is re-prefixed correctly.
- `hooks/useMobileHardwareBack.js:45,91` — compares pathname against its own previous value; self-consistent, and gated on `window.HyloMobileV2`.
- `router/Root.jsx:13` — switches on `/hyloApp/*`, outside the sandbox tree.
- `store/middleware/apiMiddleware.js:27`, `util/graphql.js:23`, `client/websockets.js:23` — intercepted or stubbed regardless.
- OAuth and Stripe `window.location.href` redirects, `loginWithService`, `tel:`/`mailto:`, external `window.open` (app store, calendar, notifications) — Tier 3 or genuinely external.

**Absolute share links** — `InviteMembersPopover.jsx:43`, `InviteSettingsTab.js:166-168`,
`GroupAboutView.jsx:89`, `GroupDetail.js:210` build `${window.location.origin}/groups/…`. These
produce real-app URLs with no `/sandbox`. Not a *break* — but in sandbox they point at a group
that requires login. Handled as Tier 3 Pattern B (§6); see open question 4.

### 10.5 Latent issue

`state.router.location.pathname` will **include** `/sandbox` (the reducer stores the raw history
location), while `useLocation()` strips it. Verified that **nothing in `apps/web/src` reads
`state.router.location`**, so this is dormant. Worth a lint rule to keep it that way.

---

## 11. Appendix — key file references

| Concern | File |
|---|---|
| Transport choke point | `apps/web/src/store/middleware/apiMiddleware.js` |
| Query → api payload | `apps/web/src/store/middleware/graphqlMiddleware.js` |
| Middleware chain | `apps/web/src/store/middleware/index.js` |
| Store + history creation | `apps/web/src/store/index.js` |
| Auth gate | `apps/web/src/routes/RootRouter/RootRouter.js` |
| Auth state | `apps/web/src/store/reducers/authSession.js` |
| Authorized shell | `apps/web/src/routes/AuthLayoutRouter/AuthLayoutRouter.js` |
| Optimistic rollback | `apps/web/src/store/middleware/optimisticMiddleware.js` |
| ORM extraction | `apps/web/src/store/reducers/ormReducer/index.js` |
| Sockets | `apps/web/src/client/websockets.js` |
| Socket handlers | `apps/web/src/components/SocketListener/SocketListener.js` |
| Uploads (stage 1) | `apps/web/src/client/filestack.js` |
| Uploads (stage 2) | `apps/web/src/store/actions/uploadAttachment.js` |
| Direct GraphQL escape hatch | `apps/web/src/util/graphql.js` |
| Schema SDL | `apps/backend/api/graphql/schema.graphql` |
| Locales | `apps/web/public/locales/{de,en,es,fr,hi,pt}.json` |
| Sandbox seed data | `apps/web/src/sandbox/seed/` |
