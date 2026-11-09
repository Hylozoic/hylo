# 06 — App shell & navigation

> Module owner scope: overall authenticated layout, global navigation rail (and the alternative top tab bar), the context menu (group / My Home / Commons menus), card-menu ("one-column") layout, create entry points, ViewHeader, site banners, cookie consent, guided tours, full routing table, URL-driven overlays, 404, responsive / mobile-web behaviour, document titles, keyboard behaviour, and shell-level socket/bootstrap lifecycle.
>
> Menu *content* customisation (GroupView types, add/hide/reorder semantics, spaces, collections) is specified in [15-views-streams-spaces.md](15-views-streams-spaces.md). Notifications content is in [19-notifications-email-push.md](19-notifications-email-push.md); messages in [18-direct-messages.md](18-direct-messages.md); auth screens in [04-accounts-auth-onboarding.md](04-accounts-auth-onboarding.md); visual tokens in [08-design-system-i18n.md](08-design-system-i18n.md).

---

## 1. Overview

The web app is a single-page app with three top-level layouts chosen by auth state:

| Auth state | Layout | Purpose |
|---|---|---|
| Unknown (session check in flight) | Full-screen spinner **or** `BootstrapShell` skeleton | Avoid flashing the wrong layout |
| Authenticated (or sandbox demo mode) | `AuthLayoutRouter` (the "shell") — plus `/oauth/*` | The whole product |
| Anonymous | Public routes (`/public/*`, `/post/:id`, `/members/:id`, `/groups/:slug/*` public detail, join links) or `NonAuthLayoutRouter` (login/signup/etc.) | Marketing-free public browsing + auth |

The authenticated shell is a horizontal flex of up to four columns:

```
┌────────┬──────────────────────┬───────────────────────────────────┬──────────────┐
│ Global │ Context menu         │ Center column (ViewHeader +       │ Detail column│
│ nav    │ (group / My Home /   │ routed view; post dialog and      │ (map/group   │
│ rail   │  Commons menu)       │ create modal overlay this column) │ detail only) │
│ ~80px  │ 300–600px (resizable)│ flex-1                            │ absolute     │
└────────┴──────────────────────┴───────────────────────────────────┴──────────────┘
```

Alternatives:
- **Top tab bar** ("Topbar") replaces the rail when the user sets `settings.globalNavStyle = 'tabs'` (desktop/tablet only; forced off below 640px).
- **Card menu** ("one-column") replaces the sidebar context menu with a full-width card grid (`ContextMenuGrid`) in the center column, chosen by user preference `settings.groupNavStyle` or group setting `settings.layout`.
- **Phones / narrow windows** (< 640px or phone UA): rail + context menu become a full-width slide-in drawer.

## 2. Concepts & data

### 2.1 Contexts
`context` is derived from the URL (first match wins, in this order):

| Pattern | context |
|---|---|
| `post/:postId/comments?/:commentId?/*` (POST_DETAIL_MATCH, root-level) | (none → default `all`) |
| `groups/:joinGroupSlug/join/:accessCode`, `invite/:accessCode`, `view/:accessCode` | `groups` |
| `groups/:groupSlug/spaces/:spaceSlug/*` | `groups` (+ `spaceSlug`) |
| `groups/:groupSlug/:view/*`, `groups/:groupSlug/*` | `groups` |
| `all/:view/*`, `all/*`, `all` | `all` |
| `public/:view/*`, `public/*`, `public` | `public` |
| `welcome/*` | `welcome` |
| `my/*`, `my` | `my` |
| anything else | `all` |

Constants (`packages/navigation`): `ALL_GROUPS_CONTEXT_SLUG='all'`, `MY_CONTEXT_SLUG='my'`, `PUBLIC_CONTEXT_SLUG='public'`, `SEARCH_CONTEXT_SLUG='search'`, `MESSAGES_CONTEXT_SLUG='messages'`. `my` and `all` together form the user-facing **My Home** context (`isMyHomeContext`). `/public` is **The Commons**.

### 2.2 User settings that drive the shell (stored in `users.settings` JSON, updated via `updateMe`/`updateUserSettings`)

| Setting | Values | Default | Effect |
|---|---|---|---|
| `globalNavStyle` | `'sidebar'` \| `'tabs'` | `sidebar` (anything ≠ `'tabs'`) | Rail vs top tab bar. Tabs ignored when viewport ≤ 639px. |
| `stackGroups` | boolean | `false` | When true, child groups (non-space subgroups) fold into their parent's nav tile as a stack; when turned on, Me is refetched with `includeChildGroups: true`. |
| `groupNavStyle` | `'group-default'` \| `'two-column'` \| `'one-column'` | `group-default` | Overrides group layout. `one-column` also makes My/All/Public use the card menu. |
| `colorScheme` | `auto` \| `light` \| `dark` | `auto` | See module 08. |
| `theme` | theme name | see 08 | See module 08. |
| `locale` | `en-US`, `en-GB`, `es`, `de`, `fr`, `hi`, `pt` (normalised full) | browser/localStorage | See module 08. |
| `toursSeen` | string[] of tour ids | `[]` | Tours never auto-offer again once in the list. |
| `signupInProgress` | boolean | — | Forces redirect to `/welcome`. |

Group setting `groups.settings.layout` (`'one-column'` or other) — the steward's default menu style (set in Group Settings → Appearance & Layout, module 11). Resolution (`resolveGroupLayout`): user `one-column`/`two-column` wins; else group `one-column` → one-column; else two-column. Card menu for My/All/Public only when user explicitly chose `one-column` (`isCardMenuPreference`).

### 2.3 Membership fields used by nav
`group_memberships.nav_order` (int, nullable) — pin position in global nav; `null` = unpinned. `newPostCount` — unread badge. `lastViewedAt` (stored as `settings.lastReadAt`) — first-visit detection and "last viewed group".

### 2.4 Global nav items (`getMyGlobalNavItems`)
- All top-level (non-space) group memberships, with `navItemType: 'group'`.
- Plus **only pinned** space memberships (`navOrder != null`), `navItemType: 'space'`, carrying `parentSlug` and `parentGroup {id,name,slug,avatarUrl}`.
- Spaces whose parent is not a membership still nest under the parent (parent-only rows) but these parent-only rows are excluded from the nav list.
- `childGroups`: the parent's non-space child groups (sorted by name) — only shown when `stackGroups` is on.
- Parent `newPostCount` = own count, or 1 if any nested space membership has unread (nav only shows a dot).
- **Sort**: `navOrder` ascending (null = ∞), then `name.localeCompare`.

## 3. Routes / entry points — full routing table

Router: React Router v6 with `redux-first-history` (`HistoryRouter`). In sandbox/demo mode a `basename` is applied (see §11).

### 3.1 Pre-router special paths (`router/Root.jsx`, matched on `window.location.pathname` before routing)

| Path | Renders |
|---|---|
| `/hyloApp/editor` | `HyloEditorMobile` (editor embedded in the native mobile app WebView; see module 25) |
| `/hyloApp/videoPlayer?url=…` | Full-window video player (`PostCard/Feature`) for the native app |
| anything else | the App (`RootFallback` while lazy-loading: full-height `bg-midground` div) |

### 3.2 RootRouter (session gate)

1. On mount: `checkLogin` (GraphQL `me`) — the **only** session check. Electron: registers `window.electron.onNavigateTo(url)` → strips origin and navigates (used when clicking desktop notifications).
2. While auth session unknown:
   - Mobile WebView (`window.HyloMobileV2`) or a *neutral path* → `<Loading type='fullscreen'/>`.
   - Otherwise → `BootstrapShell` (nav-rail + header + route-shaped skeleton).
   - Neutral paths: `/`, `/login`, `/reset-password`, `/notifications`, `/signup*`, `/public`, `/public/*`, `/post/*`, `/oauth/*`, `/h/use-invitation`, `/h/invitation`, any path containing `/join/`, starting `/invite/` or `/view/`, and any single-segment path not in {`groups`,`all`,`my`,`members`,`post`,`public`,`oauth`,`h`}.
3. Authorized (or sandbox): `/oauth/*` → `OAuthLayoutRouter`; `*` → `AuthLayoutRouter`.
4. Not authorized inside the v2 mobile WebView → fullscreen spinner (native owns auth; up to 3 `VERIFY_AUTH` re-auth attempts tracked in localStorage `hyloMobileReauthAttempts` / `hyloMobileRecovering`, then `LOGOUT` message to native). See module 25.
5. Not authorized (browser):

| Path | Renders |
|---|---|
| `/` | redirect → `/login` |
| `/public/*` | `PublicLayoutRouter` (§3.5) |
| `/oauth/*` | `OAuthLayoutRouter` (`login/:uid`, `consent/:uid/*`; module 24) |
| `/post/:postId/*` | `PublicPostDetail` |
| `/all/topics/:topicName/post/:postId`, `/all/members/:personId/post/:postId`, `/all/:view/post/:postId`, `/all/post/:postId`, `/public/topics/:topicName/post/:postId`, `/public/:view/post/:postId`, `/public/post/:postId`, `/my/:view/post/:postId`, `/members/:personId/post/:postId`, `/groups/:groupSlug/custom/:customViewId/post/:postId`, `/groups/:groupSlug/members/:personId/post/:postId`, `/groups/:groupSlug/topics/:topicName/post/:postId`, `/groups/:groupSlug/:view/post/:postId`, `/groups/:groupSlug/chat/:topicName/post/:postId`, `/groups/:groupSlug/post/:postId` | redirect (replace) → `/post/:postId` |
| `/members/:personId/*`, `/all/members/:personId/*` | `PublicMemberProfile` |
| `/groups/:groupSlug/join/:accessCode/*`, `/invite/:accessCode/*`, `/view/:accessCode/*` | `JoinGroup` (module 10) |
| `/groups/:groupSlug/offerings/:offeringId` | `OfferingDetails` (module 23) |
| `/groups/:groupSlug/*` | `PublicGroupDetail` |
| `*` | `NonAuthLayoutRouter` (§3.4) |

Note: the `/public/*` route precedes the `/public/.../post/:id` redirects, so in practice anonymous `/public/post/:id` is handled by `PublicLayoutRouter` (its catch-all → `/public/all`), not by the redirect. (Quirk.)

### 3.3 AuthLayoutRouter (authenticated)

Pre-render gates, in order:
1. While `fetchForCurrentUser` (+ `fetchPost` if URL contains `/post/<digits>`) is in flight → `BootstrapShell` with `data-testid='loading-screen'`, title "Hylo" (sandbox: "Hylo Demo").
2. `returnToPath` set and not in `/welcome` context and signup not in progress → navigate to it (cleared once reached).
3. `signupInProgress` and not in `/welcome` → `/welcome`.
4. Group path with a `/group/` or `/post/` detail segment on a map or `groups/group` path, user not a member of the group, and URL has a post id → redirect to `/all/post/:postId`.
5. `currentGroupSlug` present, group not found, not loading, and no `accessCode`/`token` query → **`NotFound`** (404).
6. Legacy nested post URLs (`nestedPostRedirectPath`): `/groups/:slug[/spaces/:s]/<view>/post/:id[...]` where `<view>` cannot host a post overlay (page, welcome, about, …) → `/groups/:slug[/spaces/:s]/post/:id[...]` keeping search+hash. Overlay-capable home roots: `/all`, `/stream`, `/discussions`, `/events`, `/resources`, `/projects`, `/proposals`, `/requests-and-offers`, `/map`, `/chat`, `/track-actions`, `/funding-round-submissions`, plus `/custom/:id`, `/collection/:id`, `/topics/:name`, `/members/:id`.
7. A **space** opened as `/groups/:spaceSlug/...` (type=`space` with `parentId`, path lacks `/spaces/`) → redirect to `/groups/:parentSlug/spaces/:localSlug/<rest>`; `/settings/requests*` → `/requests`; other `/settings*` → space root; empty rest → `/welcome` if welcome should show, else space `homeRoute` (default `/all`). Local slug = stored slug minus `parentSlug-` prefix.
8. First visit to a (non-space) group (membership has no `lastViewedAt`) where welcome should be shown, not opening a post → `/groups/:slug/welcome` (+search). `lastViewedAt` is recorded only after the welcome decision, so post deep links don't consume the welcome.

Overlay `Routes` (rendered before the layout):
| Path | Effect |
|---|---|
| `public/members`, `public/settings` | → `/public` |
| `all/members`, `all/settings` | → `/all` |
| `notifications` | → `/my/notifications` |
| `groups/:groupSlug/*` | mounts `GroupWelcomeModal` (agreements / join questions modal; module 10) |

**Nav container routes** (left column, only when not in a group, or the group is loaded and the user is a member):
| Path | Renders |
|---|---|
| `public/*`, `my/*`, `all/*` | `ContextMenu` (omitted for card-menu users) |
| `groups/:joinGroupSlug/join/:accessCode` | nothing |
| `groups/:groupSlug/*` | `ContextMenu` (two-column groups) |
| `groups/:groupSlug/settings/*` | `ContextMenu` → settings menu only (one-column groups) |
| `messages/:messageThreadId/*`, `messages` | `ThreadList` — **phone devices only** (on desktop the thread list lives inside the center `MessagesLayout`) |

**Center column routes:**

| Path | Renders |
|---|---|
| `members/:personId/*`, `all/members/:personId/*` | `MemberProfile` (module 20) |
| `all/all/*` | Stream, context all, view all |
| `all/stream/*` | → `/all/all/<rest>` |
| `public/all/*` | Stream, public |
| `public/stream/*` | → `/public/all/<rest>` |
| `all/projects/*`, `public/projects/*` | Projects view |
| `all/proposals/*`, `public/proposals/*` | Proposals view |
| `all/events/*`, `public/events/*` | Events view |
| `all/map/*`, `public/map/*` | `MapExplorer` (module 16) |
| `public/groups/*` | `GroupExplorer` (module 09) |
| `all/topics/:topicName`, `public/topics/:topicName` | Topic stream |
| `all/topics` | `AllTopics` |
| `public/post/:postId/edit/*` | public stream (edit modal on top) |
| `all` | card-menu user: `ContextMenuGrid context=all`; else → `/all/all` |
| `all/*` | `ViewContent context='my'` (fallback) |
| `public` | card-menu user: `ContextMenuGrid context=public`; else → `/public/all` |
| `public/*` | → `/public/all` |
| `groups/:groupSlug/offerings/:offeringId` | `OfferingDetails` |
| `create-group/*` | `CreateGroup` full-page flow (nav hidden on phones) |
| `groups/:joinGroupSlug/join/:accessCode`, `invite/:accessCode`, `view/:accessCode`, `h/use-invitation`, `h/invitation` | `JoinGroup` |
| `groups/:groupSlug/*` | group sub-router (below) |
| `my/posts/*` | My Posts stream |
| `my/drafts/*` | My Drafts (local-only stream) |
| `my/interactions/*`, `my/announcements/*`, `my/mentions/*`, `my/saved-posts/*` | respective My streams |
| `my/tracks/*` | `MySpaceCollection kind=track` |
| `my/funding-rounds/*` | `MySpaceCollection kind=funding-round` |
| `my/transactions` | `MyTransactions` (module 23) |
| `my/*` | `UserSettings` (tabs: `edit-profile`, `groups`, `invitations`, `locale`, `appearance`, `notifications`, `account`, `saved-searches`, `blocked-users`, `payment` [feature flag `PROJECT_CONTRIBUTIONS`]; module 05) |
| `my` | card-menu user: `ContextMenuGrid context=my`; else → `/my/posts` |
| `management/*` | `Management` (superadmin: `staging/email-testers`, `paid-content/stripe-analytics`, `site/banners`, `site/commons-requests`; empty → `staging/email-testers`) |
| `welcome/*` | `WelcomeWizardRouter` (`upload-photo`, `add-location`, `explore`; empty → `/welcome/upload-photo`) |
| `messages/:messageThreadId/*`, `messages` | `MessagesLayout` (module 18) |
| `post/:postId/*` | `PostDetail` (standalone, full center column) |
| `settings/*` | `UserSettings` (legacy path kept for mobile) |
| `search/*` | `Search` (module 07) |
| `themes` | `Themes` (theme preview page; module 08) |
| `notifications` | empty (prevents the catch-all overriding the redirect) |
| `*` | → `lastViewedGroupPath` (replace) — the 404 fallback for auth users |

`lastViewedGroupPath`: membership with the most recent `lastViewedAt` → `/groups/:slug` (space memberships → `spaceHomeUrl(parent, space)`); no memberships → `/all`.

**Group sub-router** (`/groups/:groupSlug/…`):
- While the group is loading (and URL is not a post URL and has no invite params) → `RouteBootstrapSkeleton`.
- Not a member (and not inside a space path): if the group grants *retained access* (paid content) and path ≠ `/about` → `/groups/:slug/about`; else → `GroupDetail` (join/request page; module 10).
- Member:

| Sub-path | Renders |
|---|---|
| `spaces/:spaceSlug/*` | `SpaceContent` (space sub-router, below) |
| `about/*` | `GroupAboutPage` |
| `welcome/*` | `GroupWelcomePage` |
| `page/:viewId/*` | `GroupPageView` |
| `map/*` | `MapExplorer` |
| `all/*`, `discussions/*`, `events/*`, `resources/*`, `projects/*`, `proposals/*`, `requests-and-offers/*` | `ViewContent` with that view |
| `stream/*` | → `/groups/:slug/all/<rest>` |
| `explore/*` | → group home route |
| `custom/:customViewId/*`, `collection/:customViewId/*` | custom view / collection stream |
| `space-collection/:viewId/*` | `SpaceCollection` |
| `groups/*` | → `/groups/:slug/about/related-groups` |
| `members/create/*`, `members/*` | `Members` |
| `members/:personId/*` | `MemberProfile` |
| `topics/:topicName/*` | topic stream; `topics` → `AllTopics` |
| `chat/*` | `ChatRoom` |
| `payment/success` | `PaymentSuccess`; `payment/cancel`, `payment/failure` → `PaymentFailure` |
| `settings/*` | `GroupSettings` (tabs `''`/`details`, `agreements`, `responsibilities`, `roles`, `privacy`, `invite`, `requests`, `relationships`, `import`, `export`, `appearance`, `paid-content/*`, `delete`; module 11) |
| `requests` | `MembershipRequestsTab` |
| `more-spaces` | one-column: `ContextMenuGrid` (More Spaces level); two-column: `MoreSpacesPage` |
| `post/:postId/comments?/:commentId?/*` | `PostDetail` |
| `moderation/*` | → `/groups/:slug/about/moderation` |
| `all-views/*`, `tracks/*`, `funding-rounds/*`, `all-topics/*` | → `/groups/:slug/more-spaces` (legacy) |
| `*` (incl. bare `/groups/:slug`) | first visit pending welcome decision → skeleton; should land on welcome → `/welcome`; one-column → `ContextMenuGrid` (group home dashboard); else → `/groups/:slug<homeRoute>` (default `/all`) |

Paywall: if member but `group.paywall && canAccess === false`, any path not containing the home route, `/all`, `/stream`, or `/offerings/` → home route (and closes the phone nav).

**Space sub-router** (`/groups/:parent/spaces/:local/…`, `SpaceContent`):
- Non-member: `requests` (if Add Members) → `MembershipRequestsTab`; `settings/requests` → `requests`; `settings/*` → space root; anything else → `SpaceJoinPage`.
- Member: `index` → if (one-column or drawer layout) and space has >1 visible views (or `?edit=true`) → `ContextMenuGrid` (space menu); else → space home route. Then `welcome/*`, `page/:viewId/*`, `map/*`, `all/*`, `discussions/*`, `events/*`, `resources/*`, `projects/*`, `proposals/*`, `requests-and-offers/*`, `custom/:id/*`, `collection/:id/*`, `space-collection/:viewId/*`, `members/:personId/*`, `members/*`, `requests`, `settings/requests` → `requests`, `settings/*` → space root, `chat/*`, `track-actions/*` (module 21), `funding-round-submissions/*`, `manage-round/*` (module 22), `moderation/*` → `about/moderation`, `about/*`, post detail, `*` → index behaviour.
- Space home route (`spaceHomeRoutePath`): view with `order 0` → its path; else `homeRoute`; else track → `/track-actions`; funding round → `/funding-round-submissions`; else `/all`.
- First space entry with welcome → `/welcome` (unless opening a post).

**Detail column routes** (right-side panel; only map & group-detail patterns):
| Path | Renders |
|---|---|
| `/all/groups/post/:postId…`, `/all/map/post/:postId…`, `/public/groups/post/…`, `/public/map/post/…`, `/groups/:slug/map/post/…`, `/members/:personId/post/…` | `PostDetail` |
| `/all/map/group/:detailGroupSlug`, `/public/map/group/…`, `/public/groups/group/…`, `/groups/:slug/custom/:id/group/…`, `/groups/:slug/groups/group/…`, `/groups/:slug/map/group/…`, `/groups/:slug/group/…` | `GroupDetail` |

The column is **visible** only when `hasDetail`: path matches `/(group|post)/[a-zA-Z0-9-]+/` AND (path contains `map/` or `groups/group`). Otherwise it is rendered with the hidden class (opacity 0, `right:-1000px`, no pointer events).

### 3.4 NonAuthLayoutRouter (anonymous auth pages)
Full-viewport (`Div100vh`) page with animated particles background (react-tsparticles), header row (absolute top, `px-4`): left logo (`/hylo-logo-light-horizontal.svg` in dark scheme, `/hylo-logo-dark-horizontal.svg` otherwise, `h-10`, links to `/`), right `LocaleDropdown` showing "Locale: {locale} {flag}".

| Path | Renders | Below-form card |
|---|---|---|
| `login` | Login | "Not a member of Hylo?" + outline button "Sign Up" → `/signup` |
| `signup/*` | SignupRouter (`/signup`, `/signup/verify-email`, `/signup/agreements`, `/signup/finish`) | "Already have an account?" + "Sign in" (hidden on `/signup/agreements`) |
| `reset-password` | PasswordReset | "Sign up" or "Sign in" buttons |
| `notifications` | ManageNotifications (unsubscribe via token) | — |
| join paths (`groups/:groupSlug/join/:accessCode`, `invite/:accessCode`, `view/:accessCode`, `h/use-invitation`, `h/invitation`) | JoinGroup | — |
| `*` | → `/login`, with `state.from = location` (becomes `returnToPath`) | — |

Footer card always: "Terms of Service" (https://hylo.com/terms/) + "Privacy Policy" (https://hylo.com/privacy). Cards: `bg-midground rounded-md max-w-[320px] p-4 mt-4`. `?returnToUrl=` query also sets returnToPath. If already authenticated (signup in progress) → `/signup`.

### 3.5 PublicLayoutRouter (`/public/*`, anonymous)
Header (`PublicPageHeader`, h-16, `bg-white/10 shadow-md`): merkaba logo (`/assets/navy-merkaba.svg` light / `/assets/white-merkaba.svg` dark, `h-8`), right: link "Sign in" → `/login`, accent button "Join Hylo" → `/signup`. Title "Public | Hylo".

| Path | Renders |
|---|---|
| index | → `groups` |
| `map/*` | MapExplorer; nested post/group detail in a 420px absolute right panel |
| `groups/*` | GroupExplorer (+ group detail panel 420px) |
| `all/*`, `projects/*`, `proposals/*`, `events/*`, `topics/:topicName`, `post/:postId/edit/*` | streams in a center column (`p-0 sm:p-2`) |
| `stream/*` | → `/public/all/<rest>` |
| `topics` | AllTopics |
| `*` | → `/public/all` |

### 3.6 Query-parameter-driven overlays (work on any authenticated route)
| Param / path | Overlay |
|---|---|
| `?create=post` (+ optional `newPostType`, `lat`, `lng`, `eventDate`, `sourceDraftId`, `closePath`, `fromPostId`) | `CreatePostModal` |
| path ending `/post/:id/edit` | `CreatePostModal` in edit mode |
| legacy path suffix `/create` or `/create/post` (but not `/members/create`) | rewritten (replace) to same path without suffix + `?create=post` |
| `?create=group` or `?createGroup=true` (+ `name`, `slug`) | `CreateGroupModal` |
| `?edit=true` on group/space paths (stewards) | Menu edit mode |
| `?space=<localSlug>` on `/more-spaces` | Selects a space in the sidebar on More Spaces |
| `?postId=<id>` on chat | highlights (doesn't open) a chat message |
| `?commentId=` on post URLs | scroll to comment |
| `?layoutFlags=hideNav` | hides all nav chrome until reload (`LayoutFlagsContext`; only `hideNav` whitelisted) |
| `?tourTest=true|false` | QA: every tour acts unseen (stored in localStorage `hylo-tour-test`) |
| `?accessCode=` / `?token=` on group URLs | bypasses 404 and loading gate (invites to hidden groups) |

URL builders (`@hylo/navigation`): `createModalUrl(location,type,extra)` keeps current path and adds `?create=<type>`; `closePath` overrides where closing returns.

## 4. UX specification

### 4.1 Boot sequence & loading states
1. **HTML boot loader** (`index.html`, outside `#root`): full-screen `#hylo-boot-loader` (z-index 2000), background `linear-gradient(152deg, #F4F3F1 0%, #EDECE8 55%, #E4E3DE 100%)` (dark: `#3A3A3A → #2E2E2E → #232323`); page background `#EDECE8` / dark `#2E2E2E`. An 84px-wide SVG Hylo mark (six rings at hexagon nodes, connected by lines, then the word "HYLO") assembles ring by ring with eased timing (cues Spark 0s, Chain 0.672s, Web 1.184s, Name 2.112s), then "breathes". Ink `#090B0A` (dark `#FFFFFF`). A 5px progress bar along the bottom edge advances at milestones `modules` (module graph loaded), `react` (React mounted); `HyloBootLoader.ready()` when the session is known → fades out (0.7s) after a **minimum show of 2.4s**. Skipped entirely when `navigator.webdriver` (automation). `role="status" aria-label="Loading"`.
2. **Session unknown**: fullscreen spinner on neutral paths; `BootstrapShell` elsewhere.
3. **User bootstrap** (`fetchForCurrentUser`, plus `fetchPost` in parallel if the URL has a post id): `BootstrapShell`. After success, `fetchThreads` is scheduled via `requestIdleCallback` (timeout 4s; fallback `setTimeout` 2.5s).
4. **Group loading**: `RouteBootstrapSkeleton` in the center column, shaped by route (stream 750px column, post detail 960px, map, settings, members, about, welcome, events, moderation, chat).
5. **Menu preloading**: 4.5s after bootstrap, for users with 1–60 memberships (including spaces), menu data (`groupViews`) for groups not yet loaded is prefetched in batches of 10 group ids (`fetchGroupsMenuData`); failed batches are retried on a later trigger.

`BootstrapShell` visual: `bg-midground` full height; left `NavColumnSkeleton` (hidden below `sm`): rail 66px (`sm:` 80px) with six 40px round skeletons; context panel 300px with a 190px header skeleton (40px avatar + two bars) and eight rows (32px square + bar of 58–88% width); then `ViewHeaderSkeleton` and route skeleton.

### 4.2 Overall layout (desktop ≥ 640px, sidebar nav, two-column menu)
- Root: `html, body` height `100dvh`, `overflow: hidden`. Outer shell `flex items-stretch bg-midground h-full` (row; column when top tabs).
- **Nav container** (`AuthLayoutRouterNavContainer`): `flex-row h-full flex-shrink-0 overflow-hidden`, `sm:relative sm:z-50 sm:w-auto sm:max-w-420` → holds GlobalNav rail + ContextMenu.
- **Center container** (`#center-column-container`): `flex-col h-full flex-1 min-w-0 relative`. Contains `CreatePostModal` and the scroll column `#center-column` (`bg-midground flex-col h-full flex-1 overflow-y-auto overflow-x-hidden`; z-60 when nav hidden; no padding on map). Center column scroll resets to top whenever context, groupSlug, spaceSlug or view changes.
- **Detail column** (`#detail-column`, `DetailColumn bg-midground shadow-lg`): `position:absolute; top:0; right:0; z-index:60; height:100dvh; width:49%` (`$detail-column-width`); `box-shadow: -12px 0 28px rgba(0,0,0,.25), 0 4px 56px 0 var(--black)`; `padding-bottom:50px; overflow-y:auto`; transition 0.2s (delay 0.1s). Hidden: opacity 0, `right:-1000px`, pointer-events none. Responsive widths: ≤1050px → 60%; ≤700px → `calc(100% - 80px)`, top 56px; ≤600px → z-index 110; ≤500px → 100% width, full height, top 0, and center/main overflow hidden while open. In map view, max-width 700px.
- **Toaster** (sonner): desktop bottom-left offset `left: 80px` (clears the rail); compact devices top-center. Styled with background/foreground/border tokens, `shadow-lg`; icons CircleCheck/Info/TriangleAlert/OctagonX/LoaderCircle.
- **New version toast**: every 10 min (prod only) the app fetches `/?_=<ts>` and compares the main bundle hash (`/assets/index-<hash>.js`); on change shows a persistent toast "A new version of Hylo is available" with action "Refresh" (reload). (Hard-coded English, not translated.)
- **Stale chunk recovery**: on `vite:preloadError` reloads once (sessionStorage `vite-reload-attempted`).
- **Intercom** booted (launcher hidden; `hideDefaultLauncher`) with user id/name/email/`intercomHash`; disabled in tests & sandbox. Opened from Help → "Feedback & Support".
- **Mixpanel**: initialised if token configured (not test/sandbox); identifies user and sets `$name/$email/$location`; sets group membership ids and current group profile (`$name`, `$location`, `type`). Note: not gated by cookie consent (see §8).
- A `<script id='greencheck' type='application/json'>` with user id/name/tagline/avatar is injected into `<head>` for logged-in users.

### 4.3 GlobalNav rail (sidebar mode)
Container: `globalNavContainer flex-col bg-card relative h-full z-[50] items-center`; inset shadow `inset -15px 0 15px -10px hsl(var(--darkening)/0.4)`. Background layers: full gradient `from-theme-background/75 to-theme-highlight` (dark: `/90` → `/100`), plus a 16px right-edge gradient. Scroll area: `pt-4 px-3`, vertical scroll, **scrollbar hidden**. Rail width = 56px tile + 2×12px padding = **80px** (66px on phones per skeleton/settings offsets).

**Tile anatomy (`GlobalNavItem`)**: 56×56 (`w-14 h-14`, min-h 40), `rounded-lg`, margin-bottom 16px, `opacity-85` → 100 on hover, `scale-90` → `scale-100` on hover (250ms ease-in-out), drop shadow. Group tiles: avatar as cover background on `bg-primary`; system tiles (`darkTile`): `bg-[hsl(0 0% 17%)] text-white` in both schemes. States:
- Selected: `border-3 border-selected`, opacity 100, `scale-110`.
- Has unread: `border-3 border-accent`, scale 100 (hover 105), plus a `Badge` at top-left (−12px,−12px); `'-'` badge renders at 70% scale (a dot-like badge). Numeric badges for Messages (`unseenThreadCount`).
- Default avatar (`/default-group-avatar.svg`): `bg-darkening` + 80% gradient `linear-gradient(to bottom right, hsl(var(--focus)), hsl(var(--selected)))` + white `text-2xl` initials (first letters of first two words of the name).
- **Stack** (group with `childGroups`, only when `stackGroups`): no tile bg/shadow; parent + up to 2 children as 32px `rounded-md` squares offset 8px diagonally (frame `32+(n-1)*8`), deeper layers with stronger shadow (`0 {1+i}px {4+i*2}px rgba(0,0,0,min(.5,.3+.07i))`). Click opens a **submenu popover** (side right, max-w 260/300px, transparent, scrolls within available height) listing parent then children as 56px tiles + name pills (`bg-popover shadow-md px-3 py-1.5 text-sm font-semibold`, truncate); hover scales tile to 100% and pill to 110%. Clicking navigates to `/groups/:slug`. Opening a submenu hides the rail labels; scrolling the rail closes it (after 300ms settle). Tooltip label for stacks shows a `+N` count pill.
- **Pinned space**: shows the parent group's avatar full-frame with a 24×24 corner badge (−6px bottom-right; `rounded-md bg-[hsl(0 0% 17%)] border-2 border-background`) containing the space avatar, its Lucide icon (14px), or the `Shapes` glyph. Clicking goes to `spaceEntryUrl` (`/groups/:parent/spaces/:local`). While a pinned space is open, only the space tile is selected (its parent group tile is not).
- Selection rule: My Home tile selected in `my`/`all` contexts; group tile selected when `baseUrl({context, groupSlug}) === /groups/:slug` or a stacked child is the active group.

**Hover labels (tooltips)**: Labels appear to the right of each tile (`font-semibold`). Pointer-entering the rail (mouse only) for 200ms turns on "cascade" mode: every visible tile's label appears staggered (`300ms + index*100ms`), rendered at `opacity-80`; the directly hovered tile's label is `opacity-100 scale-110`. A dark scrim (fixed, 400px wide, max 600px, `linear-gradient(to right, rgba(0,0,0,.7) 20%, transparent)`, backdrop-blur, masked fade on the right 130–150px) slides in behind the labels (300ms). Labels hidden for tiles below 85% of viewport height. Touch: tap on rail shows labels immediately; they clear 3s after touch end (deferred while momentum-scrolling). Safety: after 10s of cascade, if pointer not over rail, labels clear. Opening the phone drawer suppresses hover for 400ms. Clicking anywhere in rail clears labels. Context-menu scrolling clears labels.

**Order of items (top → bottom)**:
1. **My Home** — current user's avatar tile; label "My Home"; → `/all/all` (`myHomeLandingUrl`). `data-tour='my-home'`.
2. **Activity** (notifications) — dark tile with bell icon (`BadgedIcon name='Notifications'`), label "Activity"; badge `'-'` when `newNotificationCount > 0`. Opens notifications popover (§4.6).
3. **Messages** — dark tile, `MessagesSquare` icon, label "Messages", → `/messages`, numeric badge `unseenThreadCount`.
4. **The Commons** — dark tile, `Globe` icon, label "The Commons", → `/public`. Hidden in sandbox mode.
5. **Pinned groups and pinned spaces** (sortable section).
6. Divider (only if ≥1 pinned): full-width 4px rounded bar `bg-background/50` (dark `bg-foreground/20`), `mb-4`.
7. **Unpinned groups**, alphabetical.
Items 1–4 always fully visible; groups fade in together after first paint.

Bottom fixed area (`flex-col gap-2 pb-2`, z-50):
- Overflow fade (20px blurred gradient) above when the list overflows.
- **Hidden-badges indicator**: when badged groups are scrolled below the fold, a 40px round `bg-accent` button 48px above the create button with a white `ChevronDown` and a white count bubble (`text-accent`); title "{{count}} groups with new posts below". Click scrolls smoothly to the next badged group below the fold (centered), cycling to the first.
- **Create** button (`GlobalCreateMenu`): 56×32 `rounded-lg` `bg-[hsl(0 0% 17%)]` white `PlusCircle` 28px, `aria-label` "Create", `data-tour='create'`. Opens a popover (side right/align end; compact: top/center), `w-[210px] p-1.5 rounded-xl`, four rows (`text-sm font-semibold`, 28px coloured icon tile `rounded-lg`):

  | Row | Tile colour | Icon | Action |
  |---|---|---|---|
  | "Create a group" | `hsl(200 55% 45%)` | Plus | `?create=group` on current URL |
  | "Create a post" | `hsl(155 51% 34%)` | Edit | `?create=post` on current URL |
  | "New DM" | `hsl(280 40% 42%)` | Mail | `/messages/new` |
  | "Explore Groups" | `hsl(0 0% 22%)` | Globe | `/public/groups` |
  Choosing closes popover and phone drawer.
- Utility row (gap 6px) of two 32×32 `rounded-lg bg-black/30 text-white/80` squares (hover `bg-black/50 text-white`):
  - **Settings** (gear) → user settings dropdown (§4.4). `data-testid='global-nav-settings-trigger'`.
  - **Help** (`HelpCircle`, `data-tour='help'`) → dropdown (side right): sub-menu "Take a tour (N)" (N = tours available on this surface) with label "Tours for this view" and every tour from the catalog (unavailable ones disabled); separator; "Feedback & Support" (opens Intercom; if support cookies are refused, opens modal "Support Chat Disabled" / "To use the support chat you need to enable support cookies in your cookie preferences" / "Click below to edit your cookie preferences" with submit "Edit Cookie Preferences" → opens cookie panel); "User Guide" → https://hylozoic.gitbook.io/hylo/guides/hylo-user-guide; "Terms & Privacy" → http://hylo.com/terms/; "Download App" (only on mobile browsers, not WebView; opens App Store `https://apps.apple.com/us/app/hylo/id1002185140` or Google Play `https://play.google.com/store/apps/details?id=com.hylo.hyloandroid`); "Contribute to Hylo" → https://opencollective.com/hylo.

**Right-click / long-press menu** on group tiles (Radix context menu; native browser menu suppressed on mobile):
- Pinned: "Mark as Read" (`markGroupAsRead`), "Unpin".
- Unpinned: "Mark as Read", "Pin to top".

**Reordering pinned items** (dnd-kit, vertical): mouse drag after 8px movement; touch after 500ms hold (10px tolerance); keyboard sensor supported (space to pick up, arrows, space to drop). Dragged item at 50% opacity. On drop at a new index → `updateMembership(groupId, {navOrder: newIndex})` (optimistic). A touch long-press that moves ≤10px and doesn't drag opens the context menu at the press point instead. Only pinned items are sortable.

**Pin semantics (server, `updateMembership`)**:
- Pin (`navOrder: 0`, membership currently null): all the user's other pinned memberships `nav_order += 1`; this one becomes 0 (top).
- Reorder from `cur` to `new`: if moving down, memberships with `cur < nav_order ≤ new` decrement; if up, `new ≤ nav_order < cur` increment.
- Unpin (`null`): only this row set null (no compaction of others — gaps can remain).
- `GroupMembership.pinGroupToNav` (used after a Stripe purchase grants access) appends at `max+1`. `unpinGroupFromAllNavs` (group converted to a space) nulls and compacts for every user.
- Leaving a group sets `nav_order = null`.
- Spaces: pinned/unpinned only from the space About page button "Pin space to global navigation" / "Unpin space from global navigation" (`data-testid='space-global-nav-pin'`, Pin/PinOff icon, outline button).

### 4.4 User settings dropdown (gear)
`DropdownMenuContent` side right/align start (Topbar: bottom/end), `z-[200] bg-card`, min-width 260px (sm: 200px); compact devices use 12px vertical padding & base text. Items:
1. `LogOut` "Logout {email}" (+ `v{mobileAppVersion}` on the right in the mobile app). `data-testid='global-nav-logout'`. Logs out then replaces URL with `/login`.
2. separator
3. `User` "View Profile" → `/members/:me`
4. `Edit` "Edit Profile" → `/my/edit-profile`
5. `Users` "My Groups" → `/my/groups`
6. `Mail` "My Invites" → `/my/invitations`
7. `Bell` "Notifications" → `/my/notifications`
8. `Palette` "Appearance" ▸ (submenus; on compact devices these expand inline with a rotating chevron):
   - "Color Mode": radio "System" (`auto`), "Light", "Dark"
   - "Color Theme": radio list of `availableThemes` (capitalised, translated)
   - "Global Navigation" (hidden ≤639px): "Sidebar" / "Topbar"
   - "Group Nav Stacking": "Flat" / "Stacked"
   - "Group Menu Style": "Group Default" / "Side Menu" (`two-column`) / "Card Menu" (`one-column`)
9. `Languages` "Language" ▸ radio: 🇺🇸 "English" (en-US), 🇬🇧 "English (UK)", 🇪🇸 "Spanish", 🇩🇪 "German", 🇫🇷 "French", 🇮🇳 "Hindi", 🇵🇹 "Portuguese". Changing calls `i18n.changeLanguage`, stores in localStorage, and saves `settings.locale`.
10. `UserX` "Blocked Users" → `/my/blocked-users`
11. `Search` "Saved Searches" → `/my/saved-searches`
12. `Shield` "Account Settings" → `/my/account`
13. Superadmin only (`currentUser.isAdmin`): separator + `Wrench` "Management" → `/management` (label not translated).
Every change persists immediately via `updateUserSettings`.

### 4.5 Top tab bar ("Topbar" mode)
Enabled when `globalNavStyle='tabs'` and viewport > 639px. Shell becomes column; rail is not rendered; the ContextMenu still renders in the nav container below the bar.
- Bar: `h-11` (44px), full width, `bg-card` + same theme gradient, `border-b border-foreground/15`, shadow `0 1px 3px hsl(var(--darkening)/.15)`.
- Order: My Home tab (avatar), Notifications (26px `bg-primary` framed bell), tab strip (Messages, The Commons, then groups/pinned spaces in nav order), overflow button, action buttons (Create `PlusCircle` → popover with the legacy `CreateMenu` list; Settings gear → same settings dropdown opening bottom/end; Help → popover with "User Guide", "Terms & Privacy", "Contribute to Hylo" links only).
- Tab: `px-3 gap-1.5`, right border `foreground/10`, hover `bg-foreground/10`; 26px avatar (`rounded-sm`) or framed icon; label `text-xs font-medium` white (80% when inactive) — bar is visually dark in both schemes. Active: inner pill `bg-selected/70 rounded-lg`. Unread: 10px accent dot at avatar top-right. Tooltip with name below.
- Stacks (stackGroups on): 22px avatars offset 3px; click opens popover (w-56) listing parent (20px avatar) and indented children (18px).
- **Responsive fitting** (like browser tabs): Mode 1 named tabs when `(fixed+groups) × 80px ≤ width` (named tabs 80–200px, content-sized, truncating); Mode 2 icon-only (38px per tab, min 34/max 50, stacks 44/70); Mode 3 overflow: as many 38px icons as fit after reserving a 52px overflow button showing `Layers` icon + count (+accent dot if any hidden tab unread). Overflow popover (w-64, max-h-80, scroll) lists hidden tabs with 20px avatars, name, unread dot and a hover "Pin to top" pin button.

### 4.6 Notifications popover (shell entry; content in module 19)
Popover side right; desktop 300px wide, list height `calc(100dvh - 100px)`; compact devices: fills available width/height, square corners. Header row: tabs "Recent" / "Unread" (active underlined `border-b-2 border-accent`, `text-accent`), right "Mark all as read". Items: 40px round image, title (bold if unread) & body as HTML (user strings escaped), relative date (`TextHelpers.humanDate`). Unread rows `bg-white/10 text-foreground`, read rows `bg-darkening/10 opacity-80`. Click marks read and navigates (Cmd/Ctrl-click opens new tab), closes popover and phone drawer. Page size 20, infinite scroll. Empty: "No notifications" / "No unread notifications" with `/assets/hey-axolotl.png`; loading: `/assets/thinking-axolotl.png` + 3 pulsing grey dots. When the browser tab becomes visible again, `checkForNewNotifications` runs.

### 4.7 Context menu (two-column / "Side Menu")
Panel: `ContextMenu bg-background bg-gradient-to-b from-context-menu-background to-theme-background/10 (dark /40)`, `h-full flex-col`, width `var(--context-menu-width, 300px)` on `sm+` (phones: flex-1 full width), inset shadow `inset -15px 0 15px -10px hsl(var(--darkening)/.3)`, vertical scroll (settings path: hidden). Scroll resets to top when group or space changes. Scrolling emits `contextMenuScroll` (clears rail labels). In edit mode it scrolls to the bottom.

**Resizer** (desktop, non-phone): invisible 6px fixed strip at the menu's right seam (menu height only), `role=separator aria-orientation=vertical aria-label="Adjust menu width"`, cursor grab/grabbing; hover/drag shows a `theme-background/0.2` wash and a 2px dashed centre line (`foreground/40`). Drag width clamped **300–600px**; persisted in localStorage `hyloContextMenuWidth`; applied via CSS var `--context-menu-width` on `<html>` before paint.

**Headers by context**:
- **Group** (`GroupMenuHeader`, height min 190px, `justify-end p-2`): banner painted by the menu wrapper — `bg-darkening` at 80% + group banner (`DEFAULT_BANNER` fallback) at 50% opacity, extending 32px below the header and fading (`linear-gradient(to bottom, transparent, var(--menu-plane))`) into the "plane" colour (`color-mix(in srgb, hsl(var(--background)), hsl(var(--darkening)) 18%)`, dark 45%). Top-left: group notification-settings bell popover (`data-tour='group-notifications'`; module 19). Top-right (Administration only): `Settings` 24px white icon → `/groups/:slug/settings` (`aria-label` "Group Settings"). Bottom row: 52×52 `rounded-lg` avatar (default avatar → gradient + initials `text-xl`), name `h1 text-xl/5 font-bold text-white` (wraps; extra lines grow upward), pills row (`text-xs`, each `rounded-full bg-darkening/30 backdrop-blur-sm border-white/20 px-2 py-0.5 text-white`): `Users` + memberCount → `/groups/:slug/members` (aria "{{count}} Members"); "Invite" (opens `InviteMembersDialog`; module 10); `Info` "About" → `/groups/:slug/about`. Header text colour toggles to foreground/background by sampling banner brightness (>128 → dark text) — but name and pills are always white. `data-testid='group-header'`.
  - **Compact** (a space menu has taken over): height 48px (56px on hover), avatar 28px, controls/pills fade out (300ms), name `text-base line-clamp-1`, a white `ChevronLeft` at left; the whole header is a "Back" button (aria "Back") returning to the previous page if it was a page of this parent group, else the group root (keeps `?edit=true`).
- **The Commons**: 190px header, `/the-commons.jpg` at 80% over `bg-darkening`, title "The Commons" (white bold lg).
- **My Home** (`my` and `all`): 190px header with user banner (`/default-user-banner.svg` fallback) at 80%, title "My Home", subtitle "{name} ({email})" white/90 `text-sm` truncate.

In group context the menu body is an **inset card**: `mx-2 mb-2 rounded-xl bg-background` (+ context-menu gradient) `shadow-md` sitting on the plane colour.

**Menu rows** (`GroupViewMenuItem`), list `p-1.5 mb-6`:
- Base row: `flex items-center gap-2 text-base font-medium p-1 pl-2 rounded-md border-2 border-transparent`, `opacity-85` → 100, `hover:scale-102`, `active:scale-[0.985] translate-y-[0.5px]` (50ms). Icon (`GroupViewIcon`: Lucide or Hylo icon font) + truncated label (+ tooltip when truncated).
- Hover: border = view colour at 20% alpha; a background texture (`MenuRowBackground`) fades in at 50%. Selected (pathname equals or is under the row URL, desktop only): opacity 100, bold, border full view colour, texture at 100%, label white in dark mode (with text-shadow).
- `MenuRowBackground`: tinted gradient in the view's hue (light `hsl(h 48% 93%)→hsl(h 42% 86%)`; dark `hsl(h 34% 26%)→hsl(h 36% 19%)`) with a repeating lattice of 13px view-icon glyphs (pitch 20px, odd rows offset half, rotated −8°, 12% opacity) and a left scrim. Spaces with an uploaded banner show the photo with a dark horizontal gradient instead.
- View colours: discussions `#40A1DD`, events `#FE4850`, requests-and-offers `#0DC39F`, resources `#FFD403`, projects `#FC8000`, proposals/decisions `#664BA5`; post views use their post's type colour; everything else slate grey `#67768A`.
- Unread: chat views show a numeric accent badge (20px circle, right 6px); other typed views an 8px orange-500 dot.
- `separator` → `hr border-t-2 border-foreground/10 mt-5 mb-2`. `text` → heading `text-xs text-foreground/40 uppercase tracking-wide px-2 mt-5 mb-1.5`.
- `members` view → row hosts `CurrentlyActiveMembers` (avatar row of active members, links to members page; module 20).
- `link` view with http(s) URL → opens in new tab, trailing `ExternalLink` icon.
- `logout` (My menu) → button row with `LogOut` icon (+ app version in mobile app).
- **Space rows**: whole row clickable; label link; faint `Info` (i) link to space About (members only); right-side cluster: chat unread count badge or orange dot (dot also for pending join requests when Add Members), member-count pill (`Users` + count) or, for non-members, an uppercase "+ JOIN" pill (tapping opens the space join page). Click: single-view member spaces go straight to their home view; multi-view spaces go to the space index (drill in; on phones the drawer stays open). Active space row reveals its banner. If the active space has off-menu spaces, a nested "More Spaces" row with count appears beneath.
- Funding-round spaces: stewards get a synthetic last row "Manage Round" (`Settings` icon).

**Space takeover**: when inside a member multi-view space (or editing, or More Spaces `?space=`), the group header goes compact and a 142px `SpaceMenuHeader` appears (banner photo with `rgba(0,0,0,.25)→.6` gradient, or the icon texture): top-left space notification bell, top-right `Settings` (stewards; opens Space Settings modal, aria "Space Settings"), 52px avatar/icon tile (frosted glass if no avatar), name `text-xl/6 font-bold`, pills: members count → space members, "Invite", "About". Then the space's own menu list. "Loading views…" while fetching.

**Footer** (bottom of card, `mt-auto`):
- Sticky steward alerts (`sticky bottom-0 bg-background/95 backdrop-blur-sm`), hidden while editing: "Moderation" (`ShieldCheck`, count badge = `openModerationActionCount`, Manage Content responsibility) → `…/about/moderation`; "Join Requests" (`UserPlus`, count = `openJoinRequestCount`, Add Members) → `…/requests`. Each in its own `border-t` block.
- "More Spaces" (`CircleEllipsis`, count pill = `moreSpacesCount`) when count > 0 → `/groups/:slug/more-spaces` (+`space`, `edit` params); hidden while editing a space menu.
- "Edit Menu" / "Done Editing" (`Pencil`; Administration only; `data-tour='edit-menu'`). Desktop group: Edit → `/groups/:slug/more-spaces?edit=true`; Done → `/groups/:slug`. Phone drawer or space menu: toggles `?edit=true` on current URL and keeps the drawer open.

**Edit mode (shell side)** — `?edit=true` and Administration: the list is replaced by `GroupViewEditList` (rows with `GripVertical` drag handles, dashed hover border, per-row settings/hide/delete actions revealed on hover for pointer devices, always visible on touch; mouse drag after 5px, touch after 180ms hold; vertical axis only) and a dashed "Add to Menu" button (`data-tour='add-to-menu'`) opening a menu (upwards) with "Add View" — "Show your group's content - activity streams, curated lists, links and other ways to surface what should be seen." and "Add Space" — "A distinct space with its own members and content - chats, working groups, cohorts, resource libraries, teams" (spaces cannot nest: not offered inside a space). The first item in the menu is the group's home view. Full semantics in module 15.

**Group Settings menu** (on `/groups/:slug/settings*`): overlays the menu panel (`z-[1050]`; on phone devices fixed at `left-[66px] sm:left-[80px]`, 260/300px wide): header `ChevronLeft` + "Group Settings" (`text-lg font-bold`); back/outside-click returns to the location before settings (confirming "You have unsaved changes, are you sure you want to leave?" if dirty). Items (filtered by responsibility): "Group Details", "Agreements", "Responsibilities", "Roles & Badges", "Privacy & Access", "Invitations" (Add Members, not spaces), "Join Requests" (Add Members), "Related Groups", "Export Data", "Appearance & Layout", "Paid Content", "Delete". Active item border `secondary`. Module 11 owns content.

**My Home menu** (static, `my` & `all` contexts) — order and URLs:
| # | Type | Label (en) | URL |
|---|---|---|---|
|1| all | All My Groups Activity | `/all/all` |
|2| map | All My Groups Map | `/all/map` |
|3| events | All My Groups Events | `/all/events` |
|4| heading | My Content | — |
|5| posts | My Posts | `/my/posts` |
|6| drafts | My Drafts | `/my/drafts` |
|7| interactions | My Interactions | `/my/interactions` |
|8| mentions | Mentions | `/my/mentions` |
|9| saved-posts | Saved Posts | `/my/saved-posts` |
|10| tracks | Tracks | `/my/tracks` |
|11| funding-rounds | Funding Rounds | `/my/funding-rounds` |
|12| heading | My Account | — |
|13| link | My Profile | `/members/:me` |
|14| edit-profile | Edit Profile | `/my/edit-profile` |
|15| groups | My Groups | `/my/groups` |
|16| invitations | My Invites | `/my/invitations` |
|17| transactions | My Transactions | `/my/transactions` |
|18| notifications | Notifications | `/my/notifications` |
|19| appearance | Appearance | `/my/appearance` |
|20| locale | Language/Locale | `/my/locale` |
|21| blocked-users | Blocked Users | `/my/blocked-users` |
|22| saved-searches | Saved Searches | `/my/saved-searches` |
|23| account | Account | `/my/account` |
|24| logout | Logout | (action) |
Icons: Posticon, FilePenLine, Support, Email, Bookmark, Shapes, BadgeDollarSign, User, Edit, Users, Mail, CreditCard, Bell, Palette, Languages, UserX, Search, Shield, LogOut. Note `/my/announcements` is routed but not in the menu.

**The Commons menu** (static): "Public Activity" `/public/all`; "Group Explorer" `/public/groups`; "Public Map" `/public/map`; "Public Events" `/public/events`.

The legacy `/my` and `/all` default landing: `/my` → `/my/posts`; `/all` → `/all/all`; `/public` → `/public/all`; but the My Home tile itself goes to `/all/all`.

### 4.8 Card menu (one-column, `ContextMenuGrid`)
Used for: group home (`/groups/:slug` when one-column), `/groups/:slug/more-spaces` (one-column), space index (one-column or drawer with >1 views), and `/my`, `/all`, `/public` for card-menu users. Sidebar context menu is not rendered (except settings). On phones the nav container is hidden on non-home views (`hidden sm:flex`).
- Container `w-full h-full overflow-y-auto`, id `context-menu-grid`.
- **Banner** (root levels): 220px; banner image at 70% over `bg-darkening/50`. Groups: top bar (max-w 1000px centred, px-3): left bell popover; right Settings (stewards) and `Search` icon → `/search?groupSlug=<slug>&from=<current>`. Centre: 64px `rounded-xl` avatar with `border-2 border-white/30` (default: gradient + initials), name `text-2xl font-bold text-white`, pills (members / Invite / About) with `bg-white/15 border-white/25`. My Home: user banner/avatar, name "My Home", subtitle "{name} ({email})". Commons: `/the-commons.jpg`, no avatar, "The Commons". Element id `context-menu-grid-banner` (ViewHeader hides itself while this banner is visible).
- **Space level**: compact centred group header (back) + `SpaceBannerHeader` 172px (centred 56px icon tile, name, pills; bell left, settings right).
- **More Spaces level**: sticky back bar (looks like ViewHeader: chevron, `CircleEllipsis`, "More Spaces"), sections: (unlabelled other spaces), "Tracks", "Funding Rounds", "Drafts", "Archived"; empty "Nothing here yet"; skeleton while loading.
- Grid: content `max-w-[1000px] mx-auto px-4 pt-10 pb-6`; views partitioned into sections — `text` views become `h2 text-base font-semibold text-foreground/70` headings, `separator` → `hr`; other views flow in `flex flex-wrap gap-3` of cards.
- **Card** (`CARD_CLASS`): 168×156px on sm+, below sm `calc(50% - 0.375rem)` wide at aspect 14/13 (two per row); `rounded-2xl border`, lift `-translate-y-0.5` on hover, press `scale-[0.99]`; surface `linear-gradient(150deg, color-mix(col 30%, #16171a), color-mix(col 17%, #0d0e10))` dark / `(col 24% #fff → col 11% #f3f1ea)` light; repeated icon wallpaper tinted to view colour; bottom fade; centred 56px (44px <sm) solid icon tile (`rounded-[15px]`, colour = view colour, ink white or dark mix for light colours); title `text-sm font-bold line-clamp-2` below. Hover ring `inset 0 0 0 1px {col}8C` and bigger shadow. Extra cards: steward alerts "Moderation"/"Join Requests" with count badge; "More Spaces".
- Below grid (stewards): outlined "Edit Menu" button; editing shows a sortable card grid, an "Add" card (same view/space chooser), the More Spaces section in edit mode, and a bottom bar with "Done Editing" (`X`).
- Opening a card: logout → logs out; space → space index; otherwise the view URL.

### 4.9 ViewHeader
Sticky top bar inside the center column on every view except `/messages*` and `/management*`. `header.ViewHeader flex items-center z-40 p-2 sticky top-0 w-full bg-context-menu-background border-b border-foreground/[0.08] shadow-header` (dark: transparent border, `shadow-header-dark`). Views set its content through `setHeaderDetails({ title, icon, info, search, centered, backButton, backTo, mobileBackButton, headerActions, spaceBreadcrumb })` (defaults: no back, empty title, no search, not centered, spaceBreadcrumb true).
Layout left→right:
1. **Chevron-left button** (`data-testid='view-header-nav-toggle'`, 24px, `p-2`): visible only on compact layouts / < sm, or on desktop when `backButton`. Action = `performMobileNavBack` (§4.11).
2. Context icon (phones/<sm, two-column only): 32px rounded avatar of group / user, or Globe for public.
3. Space breadcrumb (two-column, inside a space): space icon, bold space name (max 25% and hidden on phones when a view title follows), `Info` button → space About, ">" separator. Single-view spaces show "Space" or "Space: Members/About" and suppress the view title.
4. View icon tile: 32px `rounded-[9px] border-2`, colours from the view hue: light `bg hsl(h 48% 90%)`, border `hsl(h 40% 70%)`, icon `hsl(h 45% 35%)`; dark `hsl(h 40% 26%)`/`hsl(h 40% 42%)`/`hsl(h 60% 82%)`; 18px icon.
5. One-column breadcrumbs: group avatar 24px + group name (name hidden on phones) › space icon + name + (i) › view icon tile. Card-menu contexts: Globe/user avatar + "The Commons"/"My Home" › icon tile.
6. Title `h2 font-bold truncate` (string, element, or `{mobile, desktop}` pair switching at sm). Optional `InfoButton` tooltip.
7. `headerActions` slot.
8. **Search** (when `search: true`): input `placeholder="Search"` with search icon; desktop collapsed width 90px → 250px on focus (compact: 0 → 200px, opened via a 36px icon button); dropdown of options: "Search in {{groupName}}" (when in a group) and "Search across all your groups". ↑/↓ cycle, Enter selects (default first), Escape closes; outside click closes. Navigates to `/search?t=<q>[&groupSlug=][&from=<current path+search>]` (see module 07).
Hidden when on card-menu levels or while the card-menu banner is in view (IntersectionObserver).

### 4.10 URL-based overlays: post dialog, create modals
- **Post dialog**: Stream-like views (`ViewContent`, `ChatRoom`, `MemberProfile`) nest `post/:postId` → `PostDialog`, portalled into `#center-column-container` (so it covers only the center column, nav stays usable). Non-modal Radix dialog (no body pointer lock): backdrop `bg-darkening/50` (dark /90) + `backdrop-blur-sm`, z-100; content centred, `w-[calc(100%-16px)] max-w-[750px] max-h-[calc(100%-16px)] min-w-[300px] p-3 rounded-md bg-background`, fade + slide-in-from-bottom (300ms). Dismiss (backdrop click, Escape, hardware back) → if the post URL was pushed over its parent page, `history.back()`; otherwise replace with the URL minus `/post/:id…` (keeping search & hash). Dismissal is blocked while text is selected in the post or when a Filestack picker is the target. Rail/menus still receive wheel scroll while it's open.
- **Standalone post** (`/post/:id`, `/groups/:slug/post/:id`): `PostDetail` fills the center column; title "{post title or first 20 chars of details} | Hylo".
- **Map detail**: post/group detail opens in the right detail column (§4.2).
- **CreatePostModal**: absolute over the center column (z-70, above map drawer & detail column), backdrop `hsl(var(--primary)/0.7)` + 2px blur; wrapper max-w 800px, padding 20px (8px ≤600px), vertically centred, scrollable; enters sliding from the right (250ms) and fading (400ms); exits upward 100px (200ms). Close `X` (`Icon Ex`) top-right 24px. Closing when dirty opens "Save draft before closing?" — "You have unsaved changes to this post. Save a draft to continue later, or discard them." (continue / discard / save draft). Close navigates (replace) to `closePath` or current URL stripped of compose params (`create`, `newPostType`, `eventDate`, `sourceDraftId`, `closePath`, `fromPostId`); edit mode strips `/post/:id/edit`. Draft id key `modal:<pathname>:create|edit:<postId>`.
- **CreateGroupModal**: non-modal dialog, `w-[calc(100vw-2rem)] max-w-[620px] max-h-[calc(100vh-5rem)] rounded-2xl`; header 48px with `Users` icon (selected colour) and "Create a group"; body scrolls; footer bordered. Close removes `create`, `createGroup`, `name`, `slug` params (replace). Module 09.
- Legacy `CreateMenu` (Topbar + map "create here"): heading "What would you like to create?" (or "New post at this location:"), rows per accepted post type (discussion, request [Heart icon], offer, resource, project, event, proposal — excluding action/chat/submission and filtered by the group's `acceptedPostTypes`) + "Group"; hover reveals a "Create" chip.

### 4.11 Back behaviour (header chevron & Android hardware back)
`performMobileNavBack` priority:
1. Drawer layout on `/groups/:slug/settings/<tab>` → `/settings`; on settings root → group root (and open the drawer for two-column groups).
2. Single-view space without explicit back: secondary pages (`members`, `about`, `welcome`, `requests`, `settings`, `moderation`) → space home; home → one-column: group root; else open the nav drawer.
3. One-column group: space view → space menu (if multi-view) / More Spaces (if came from there) / group root; group view → group root; More Spaces → group root.
4. Card-menu context: any view → `/{context}`.
5. Drawer layout, no explicit back, not one-column → toggle the nav drawer.
6. `backTo` → navigate there. 7. `centered` → previous location or `/`. 8. History has a previous entry → `history.back()`. Else not handled (native app may exit).
Hardware back (mobile app only): close nav drawer → close side drawer → registered overlay handlers (post dialog, create modal…) → close any open Radix dialog via synthetic Escape → the above; if nothing handled, tells native it can exit.

### 4.12 Responsive & mobile web
Breakpoints: Tailwind defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536); "phone viewport" = `max-width: 639px`. Device classes via `ismobilejs`: `isPhoneDevice` (iPhone/iPod/Android phone/7-inch), `isTabletDevice` (incl. iPadOS desktop UA with touch), `isCompactLayoutDevice` = phone or tablet (adds `compact-layout` class on `<html>` → larger compact typography, `h-[100dvh]`), `isDrawerNavLayout` = phone device or width < 640.

Drawer layout:
- Nav container becomes `fixed left-0 top-0 z-[101] h-dvh w-full`, translated `-100%` when closed; backdrop `fixed inset-0 z-[100] bg-black/50` (opacity follows open state). Open/close animate `transform 0.3s cubic-bezier(0.2,0.9,0.3,1)`.
- Open via ViewHeader chevron; close by backdrop tap, menu link click (most links call `toggleNavMenu(false)`; space drill-in and Edit Menu keep it open), or gestures.
- **Swipe gestures**: open = horizontal swipe right starting within 70px of the left edge (ignored if held ≥300ms first [text selection], over text inputs, with an active selection, inside a horizontally-scrolled container, or while a post dialog is open); close = swipe left anywhere while open. Direction locks after 10px; vertical movement aborts. The nav follows the finger; release snaps open if velocity > 0.3px/ms in the opening direction, else if > 40% revealed.
- Within the drawer the rail + context menu sit side by side; menu rows don't show selected state (stale on reopen).
- Card-menu views: nav hidden on phones except on menu levels; the space/group dashboard is the menu.
- Phone group settings: master-detail in the center column; sidebar hidden.
- Messages on phones: thread list rendered in the nav container.
- Create-group full-page route hides nav on phones.
- Pull-to-refresh (mobile app WebView only, not chat/messages): pull 120px and hold 400ms → reload; indicator: fixed top-centre 44px circle with arrow-down → check → spinner (primary colour).
- Viewport meta disables user scaling (`maximum-scale=1, user-scalable=0`).

### 4.13 Site banners (announcements)
Superadmin-authored announcements (Management → Site → Banners). On shell mount (and on leaving `/management`) fetch `siteBanners`. If any (and not on `/welcome*`): full-screen scrim `fixed inset-0 z-[90] bg-darkening/50 backdrop-blur-sm` with a centred deck (max-w md, sm: lg). Top card interactive; up to 2 more peek behind (6px/12px lower, 97%/94% scale, 70%/40% opacity). Card: `rounded-xl border shadow-2xl max-h-[85vh]` coloured by type — `info` `bg-card`, `warning` `bg-accent`, `alert` `bg-destructive text-destructive-foreground`. Header: Hylo horizontal logo (light logo for warning/alert or dark scheme) h-5/sm:h-6; right "+{{count}} more" and X ("Dismiss"). Body (scrolls): optional title `text-xl sm:text-2xl bold`, date (`DD` format, e.g. "Nov 8, 2026"), HTML text (links underlined, internal links handled in-app). Footer: ghost "Dismiss" and, if both set, primary-ish action button (`bg-selected`) with `actionText` → dismiss then navigate internally or open external URL in new tab.
Server rules: visible = published, not unpublished, not dismissed by user, newest `published_at` first; banners with `show_to_new_users=false` are hidden from accounts created after publication. Dismiss inserts `(banner,user)` into `site_banners_users` idempotently. `type` ∈ `info|warning|alert` (invalid → info). `actionUrl` normalised (bare hosts get `https://`; only http(s) or root-relative allowed: errors "Action Button URL is not valid", "Action Button URL must be a web address"); `actionText` and `actionUrl` must be set together ("Action Button Text and Action Button URL must be set together"). Mutations superadmin-only ("Unauthorized: Admin access required").

### 4.14 Cookie consent
Cookie `hylo_cookie_consent` (JSON: `id` uuid, `analytics`, `support`, `isLinkedToUser`, `userId`, `lastUpdated`), `path=/; max-age=31536000; SameSite=Lax`. Skipped in sandbox, iframes, and mobile WebViews. On load: valid cookie → done; else, if logged in and the user record has `cookieConsentPreferences` → write cookie from DB; else show the **preferences panel**. Panel: phones bottom full-width sheet (border-top 2px); sm+ fixed bottom-right 24px, 350px, `rounded-lg border-2`, `z-[1000]`. Copy: title "Cookie Preferences"; "We use essential cookies to help understand whether you are logged in and to understand your preferences and where you are in Hylo."; two switches (default on) "Analytics (Mixpanel)" and "Support (Intercom)" (parentheticals hidden on phones), each with an (i) toggling explanations: "We use a service called Mixpanel to understand how people like you use Hylo. Your identity is anonymized but your behavior is recorded so that we can make improvements to Hylo based on how people are using it." / "When people on Hylo need help or want to report a bug, they are interacting with a service called Intercom. Intercom stores cookies in your browser to keep track of conversations with us, the development team."; buttons "Reject Non-Essential" and "Save and Continue" (inverted colours). Saving POSTs `/noo/cookie-consent` `{consent_id, settings:{analytics,support}, version:'1.0', user_agent, user_id?}`. On login, an anonymous cookie is linked to the user (`CookieConsentLinker`) and re-synced. Panel re-openable from the support-disabled modal.

### 4.15 Guided tours (driver.js)
- Tours anchor to `data-tour` attributes; steps whose anchor is missing, off-canvas horizontally, or covered by another element are skipped; with no steps nothing runs. Popover styled with tokens (card bg, `rounded 0.75rem`, title 1rem bold, description 0.875rem 80%, buttons `bg-selected`), overlay opacity 0.6, stage padding 6, radius 10, progress shown when >1 step, each anchor scrolled into centre.
- **Auto offer** (mode `invite`): after the boot loader is gone, no other tour/invitation active, no blocking selector present, and ≥1 anchor visible, wait 2s then show **TourInvitation**: bottom-centre floating pill (z 1,000,000; `bg-card border-2 border-selected/40 shadow-xl rounded-full`, phones `rounded-2xl` stacked), lightbulb in a 40px `bg-selected/20` circle rises in, then the pill expands (800ms) with message + "Show me" (`bg-selected` bold) / "No thanks". Accept → run tour; decline → mark seen; ignored for 15s → closes and increments a per-device offer counter (localStorage `hylo-tour-offers:<id>`), max 2 offers. Route change fades it out without counting. Not offered to automation (`navigator.webdriver`) or during signup.
- Completing or closing a tour adds its id to `settings.toursSeen`.
- Catalog (Help → Take a tour): "Getting around Hylo" (`global-chrome`), "Set up your group" (`group-creator`), "Explore a group" (`group-welcome`), "Edit the menu" (`menu-edit`), "Create a post" (`post-editor`), "The stream" (`stream-controls`), "The map" (`map`), "Group settings" (`group-settings`), "Create a space" (`space-create`), "Set up a track" (`track-setup`), "Set up a funding round" (`funding-round-setup`).
- Shell-owned auto tours:
  - `global-chrome` — invite "New to Hylo? Let us show you around."; steps: (sandbox only) "Hylo Demo"/"You're exploring a demo. Changes aren't saved."; My Home — "Your personal corner of Hylo: activity from all your groups, your posts, and your profile."; Activity — "Notifications from your groups land here."; Messages — "Direct message anyone who shares a group with you."; The Commons — "Explore public groups, posts, events, and the map."; Create — "Start a post, a group, or a direct message from anywhere."; Help — "Find the user guide here, or take this tour again any time."
  - `group-creator` (Administration and memberCount = 1) — invite "Your group is ready — want a quick tour?"; steps "Welcome to your new group" / "Its menu, members, and settings all live in this panel."; "Invite people" / "Share an invite link or send email invites — a group starts with its people."; "Edit Menu" / "Add views and spaces and drag to reorder them. The top item is what members see first."; "Group Settings" / "Privacy, agreements, join questions, and member roles are managed here."; "Start the first post" / "Welcome new members with a discussion, or announce what this group is for."
  - `group-welcome` (others) — invite "New here? Take a quick tour of this group."; held while the group welcome modal is open; steps "The group menu" / "Each item is a view of this group. Spaces are sub-groups with their own members and content."; "Join the conversation" / "Share a discussion, request, offer, or event with the group."; "Notification Settings" / "Choose how this group reaches you: push, email, and digest frequency."; "About this group" / "The group's purpose, agreements, and member directory live here."
  - `menu-edit` (in edit mode) — invite "First time editing the menu? Take a quick tour."; "Reorder by dragging" / "Drop items in the gaps between rows. The top item is the home view — what members see first."; "Add to Menu" / "Views show this group's content. Spaces are distinct places with their own members, content, and menu."; "More Spaces" / "Spaces removed from the menu land here — they are not deleted. Tracks and funding rounds live here too."
  - `group-settings` — invite "First time in group settings? Take a quick tour."; "Group Settings" / "Everything about how this group works is managed from these sections."; "Two separate dials" / "Who can see the group and who can join it are set independently — check both."; "Roles carry powers" / "Responsibilities are the powers, roles bundle them, and members hold roles."; "Three ways to invite" / "A public link, a join link that skips approval, and email invites that can pre-assign a role."
  - Group tours only in two-column layout (the card grid has no anchors). Other tours (stream, map, post editor, space create, track, funding round) are described in their modules.

### 4.16 404 / Not found
- Group slug not found / not accessible (auth) → `NotFound`: centred (padding-top 10%), `h3` "Oops, there's nothing to see here.", link "Go back" (→ `/`), puzzled axolotl image (`/assets/puzzled-axolotl.jpg`, 50% width), small footer "404 Not Found".
- Any other unknown authenticated URL → silent redirect to last viewed group (or `/all`).
- Unknown anonymous URL → `/login` (remembering the intended path).
- Unknown `/public/*` → `/public/all`.

### 4.17 Document title rules
Default `Hylo` (sandbox `Hylo Demo` with `noindex, nofollow`); meta description "Prosocial Coordination for a Thriving Planet". In a group: "{Group name} | Hylo". Pages override: streams "{view name} | {group name | context} | Hylo"; drafts "Drafts | Hylo"; chat "Chat | {group} | Hylo"; map "Map | {group | 'Public' | ' All My Groups'} | Hylo"; post "{title or 20-char excerpt} | Hylo"; member "{name} | Hylo"; messages "Messages | Hylo"; edit profile "Edit Your Profile | Hylo"; moderation "Moderation | …"; public layout "Public | Hylo"; login "Sign in to Hylo"; reset "Reset your Hylo password"; manage notifications "Manage Notifications | Hylo". Server-side, `/post/:id` HTML gets OG/meta tags injected (`server/postMetaTags.js`; module 24).

### 4.18 Keyboard
No global keyboard shortcuts exist. Keyboard behaviours: ViewHeader search (↑/↓/Enter/Escape), Escape closes Radix dialogs/menus/popovers, dnd-kit keyboard sorting of pinned rail items and menu rows (Space/Enter pick up/drop, arrows move), card-menu cards activate with Enter/Space, ModalDialog closes on Escape, image carousel arrows (module 13).

## 5. Business rules & side effects
- **Bootstrap fetches**: `MeQuery` (memberships with `navOrder`, `newPostCount`, `lastViewedAt`, child groups if stacking), `fetchForGroup(slug)` on every group change, `fetchGroupViews(groupId)` on every group navigation (two-column menu) and on first visit, space views when inside a space.
- **First visit**: `setMembershipLastViewedAt` (local ORM) after the welcome decision; persisted elsewhere via `updateMembership(lastViewedAt)`.
- **Unread badges**: group tile shows `'-'` when membership `newPostCount > 0` (or any nested space unread). "Mark as Read" → `markGroupAsRead(groupId)` (clears views' unread and membership badge).
- **Visibility change** → `checkForNewNotifications`.
- **Socket lifecycle**: a single sails.io socket (socket.io) to `VITE_SOCKET_HOST` (dev from another host → same origin). Auto-connects on load (mobile v2 WebView: deferred until checkLogin succeeds). Heartbeat `GET /noo/heartbeat` every 30s (10s timeout; 2 consecutive failures or disconnected → force reconnect); also on `online` and when tab becomes visible. `SocketListener` subscribes the user room (`POST /noo/user/subscribe`) on mount and every connect/reconnect, unsubscribes on unmount; handles `commentAdded`, `groupUpdated` (refetch views unless self-made), `messageAdded` (bump unread unless that thread is open), `messageUpdated`, `newNotification`, `openJoinRequestCountUpdated`, `newPost` (space posts also pushed to parent room for badging), `newThread`, `userTyping`, `roomPresence`/`memberPresent`/`memberAway`. `SocketSubscriber type='group' id=<slug>` joins the current group's room (`/noo/group/:slug/subscribe`), re-posting on connect and tab visibility. Disabled in sandbox.
- **Return-to path**: anonymous deep links store `returnToPath`; after login the shell redirects there once.
- **Retained access / paywall** redirects as in §3.3.
- Electron: notification clicks call `window.electron.onNavigateTo(url)` → SPA navigation.

## 6. Permissions
| Element | Who |
|---|---|
| Group Settings gear (menu header / grid banner) | Administration responsibility |
| Edit Menu, space settings, Manage Round row | Administration |
| Join Requests alert / settings item | Add Members |
| Moderation alert | Manage Content |
| Settings menu items | per §4.7 |
| Management menu item & routes, site banner mutations | Superadmin (`isAdmin` / `Admin.isSuperAdmin`) |
| Group sub-routes | Members only; non-members get `GroupDetail` (join page) or About (retained access) |
| Space sub-routes | Space members; others get `SpaceJoinPage` |
| Pin/unpin | Own memberships only |

## 7. API
| Operation | Shape |
|---|---|
| `query { me { … memberships { id navOrder newPostCount lastViewedAt group { … } } } }` | bootstrap (`fetchForCurrentUser`, `checkLogin`) |
| `mutation updateMembership(groupId: ID, data: { navOrder: Int })` → `{ id navOrder group { id } }` | pin (0), unpin (null), reorder (index) |
| `mutation markGroupAsRead(groupId: ID!)` → `{ id }` | |
| `query siteBanners` → `[{ id title text type actionText actionUrl createdAt }]` | active banners for viewer |
| `mutation dismissSiteBanner(id)` | |
| `allSiteBanners`, `createSiteBanner(data)`, `updateSiteBanner(id,data)`, `publishSiteBanner(id)`, `unpublishSiteBanner(id)`, `deleteSiteBanner(id)` | superadmin |
| `mutation updateMe(changes: { settings: { globalNavStyle, stackGroups, groupNavStyle, colorScheme, theme, locale, toursSeen } })` | via `updateUserSettings` |
| `fetchGroupViews`, `fetchGroupsMenuData(groupIds[≤10])`, `fetchGroupSpaces` | menu data (module 15) |
| REST `POST /noo/cookie-consent`, `GET /noo/heartbeat`, `POST /noo/user/subscribe|unsubscribe`, `POST /noo/group/:slug/subscribe|unsubscribe` | |

## 8. Edge cases & known quirks
- **Drawer component is effectively dead**: `components/Drawer` (old group-switcher drawer with "Public Stream", "Public Groups", "Public Map", "All My Groups", "Start a Group") only opens when `isDrawerOpen` is toggled, but nothing toggles it open (only the hardware-back handler closes it). `MessagesDropdown` and `Sidebar` components are likewise unused.
- `GroupWelcomeModal` route marked "DEPRECATED" in comments but still always mounted.
- **Analytics consent not enforced**: Mixpanel initialises and identifies regardless of the `analytics` choice; only the support (Intercom) choice is checked (when opening support chat).
- Unpinning doesn't compact `nav_order` (gaps), reorder uses list index which may not equal stored values when gaps exist; backend tolerates this.
- `/my` and `/all` both show the same "My Home" menu; My Home tile lands on `/all/all` while `/my` redirects to `/my/posts`.
- `all/*` fallback renders `ViewContent context='my'`.
- `hasDetail` uses a regex + `map/`/`groups/group` substring test (comment calls it hacky); detail column only ever shows for map and group-detail URLs.
- New-version toast copy is not translated; "Management" label not translated; "Post Dialog" sr-only title not translated.
- Notifications popover and rail hover suppression rely on window CustomEvents (`navHoverSuppress`, `navSubmenuToggle`, `navSubmenuClose`, `navScroll`, `contextMenuScroll`).
- Topbar Help menu lacks "Take a tour", "Feedback & Support" and "Download App"; Topbar create uses the older post-type list instead of the four-action menu.
- In the anonymous router the `/public/*` route shadows the `/public/.../post/:id` → `/post/:id` redirects.
- Group header computes text colour from banner brightness via a canvas (requires CORS); the name/pills are hard-coded white anyway.

## 9. Docs vs. code
| Docs say | Code does |
|---|---|
| Rail top element is the member avatar which opens personal settings / "My content (formerly My Home)" | Avatar tile is labelled **"My Home"** and navigates to `/all/all`; settings are in a separate gear menu at the bottom; My Home menu groups "All My Groups …", "My Content", "My Account". |
| Groups listed alphabetically | Pinned groups/spaces first (by `nav_order`), then unpinned alphabetical. |
| Create (+) lets you create each post type or a group | Rail + menu has 4 actions: Create a group / Create a post / New DM / Explore Groups (post type is chosen in the editor). The per-type list survives only in Topbar mode and the map. |
| Help: "Feedback & Support, Feature Guides, Terms & Privacy, app download, Donate" | Help menu adds "Take a tour (N)"; donation link labelled "Contribute to Hylo"; app download only on mobile browsers. |
| Messages "red dot" for unread | Numeric badge (`unseenThreadCount`) with accent border. |
| Pinning: right-click to pin, drag to reorder | Matches; additionally "Mark as Read" in the menu, spaces can be pinned from the space About page, touch uses 500ms long-press. |
| Search: magnifying glass "in the upper right of the screen" | Search lives in each view's ViewHeader (when the view enables it) and on the card-menu banner; there is no global top-right search button. |

## 10. Source references
- `apps/web/src/router/Root.jsx`, `router/index.js`, `index.jsx`, `apps/web/index.html`
- `apps/web/src/routes/RootRouter/RootRouter.js`
- `apps/web/src/routes/AuthLayoutRouter/AuthLayoutRouter.js`, `.module.scss`, `.store.js`
- `.../components/GlobalNav/{GlobalNav.jsx,GlobalNavItem.jsx,PinnedSpaceBadge.jsx,NotificationsDropdown/*}`
- `.../components/TopNav/TopNav.jsx`, `.../components/Drawer/Drawer.js`
- `.../components/ContextMenu/{ContextMenu.jsx,ContextMenuGrid.jsx,ContextMenuResizer.jsx,GroupSettingsMenu.jsx,MenuLink/MenuLink.jsx,MenuRowBackground.jsx,viewCardTheme.js,groupViewMenuUrl.js,GroupViewEditList.jsx,AddViewOrSpaceMenu.jsx,MoreSpacesPage.jsx}`
- `apps/web/src/components/{GroupMenuHeader,ViewHeader,SiteBanners,CookiePreferencesPanel,CookieConsentLinker,CreateMenu,CreatePostModal,PostDialog,NotFound,Skeleton,SpaceGlobalNavPinButton.jsx,SocketListener,SocketSubscriber}`
- `apps/web/src/routes/{NonAuthLayoutRouter,PublicLayoutRouter,SpaceContent,CreateGroup/CreateGroupModal.jsx,UserSettings,GroupSettings,Management,WelcomeWizardRouter}`
- `apps/web/src/{hooks/useMobileNavBack.js,hooks/useMobileHardwareBack.js,hooks/useIsPhoneViewport.js,hooks/useNewAppVersion.js,util/mobile.js,util/mobileNavBack.js,util/navigationLayout.js,util/cookieConsent.js,util/postDetailCloseNavigation.js,contexts/*,tours/*,client/websockets.js}`
- `apps/web/src/store/selectors/{getMyGroups.js,getLastViewedGroup.js}`, `store/actions/{pinGroup.js,markGroupAsRead.js,siteBanners.js}`
- `packages/navigation/src/index.js`, `packages/presenters/src/{GroupViewPresenter.js,colors.js}`
- `apps/backend/api/graphql/mutations/{membership.js,siteBanners.js}`, `api/models/{GroupMembership.js,SiteBanner.js}`
- E2E: `apps/web/e2e/{authenticated.shell.spec.js,pin-space-global-nav.spec.js,menu-edit-drag.spec.js,space-menu-header.spec.js,unauthenticated.routes.spec.js}`
