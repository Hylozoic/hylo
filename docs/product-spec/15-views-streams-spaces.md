# 15 — Views, streams & spaces

> Module owner: views/streams/spaces. Cross-links: app shell, global nav, context-menu chrome and routing table → [06-app-shell-navigation.md](06-app-shell-navigation.md); post cards, post editor, pinning UI on cards → [13-posts-comments.md](13-posts-comments.md); event RSVP / calendar subscription details → [14-events-proposals-projects.md](14-events-proposals-projects.md); chat rooms → [17-chat-rooms.md](17-chat-rooms.md); tracks → [21-tracks.md](21-tracks.md); funding rounds → [22-funding-rounds.md](22-funding-rounds.md); paywalls/offerings → [23-paid-content-stripe.md](23-paid-content-stripe.md); map → [16-map.md](16-map.md); joining/invites → [10-joining-invitations.md](10-joining-invitations.md); unread / digests → [19-notifications-email-push.md](19-notifications-email-push.md).

---

## 1. Overview

Everything a member sees inside a group (or a space, or one of the aggregate contexts My Home / All My Groups / Public) is a **view**. A group's menu is an ordered list of views stored as rows of `group_views`. Most content views are **post streams** rendered by one component (`ViewContent`) that supports five **view modes** (cards, list, small grid, large grid, calendar), sorting, a post-type filter, an "active only" toggle, a "include child groups/spaces" toggle, and search.

A **space** is a lightweight child container of a group (a row in `groups` with `type = 'space'` and `parent_id` = parent group). A space has its own members, its own posts, its own menu of views, and inherits roles from its parent group. Chat rooms, tracks and funding rounds are all implemented as spaces.

Stewards (holders of the `Administration` responsibility) customize the menu: add / delete / reorder views, choose the home view (`order = 0`), add/hide/archive/delete spaces, and curate collections. Holders of `Manage Content` may curate posts in collections and space ids in space-collections.

Key principles (enforced in code):

1. **Views are binary**: a view is either in the menu (`order` is an integer) or deleted. Only `type = 'space'` rows may have `order = null` (the space then lives in **More Spaces**).
2. **Home view = `order = 0`**. `groups.home_route` caches its route suffix so the client can redirect without loading all views.
3. **All views inside a group/space are visible to all its members.** Role-gating is per-space (`groups.required_roles`), never per-view.
4. Menu changes are pushed to clients with a `groupUpdated` socket event (`notifyGroupUpdated`).

---

## 2. Concepts & data

### 2.1 `group_views` table (`GroupView` model)

| Column | Type | Notes |
|---|---|---|
| `id` | bigserial PK | Route param `customViewId` / `viewId` names this id. |
| `group_id` | bigint FK groups, CASCADE | Owner group or space. |
| `name` | varchar null | Display override. May be an i18n key (`view-*` / `widget-*`) → translated at render (`translateViewName`). |
| `type` | varchar NOT NULL | See 2.2. |
| `order` | int null | 0 = home, 1..n menu position. `null` only for `type='space'` (More Spaces). |
| `icon` | varchar null | Lucide icon name (or legacy Hylo icon-font name). |
| `page_content` | text | HTML for `welcome`/`page`; plain text for `text` (Heading). |
| `link` | text | URL for `link`; server prefixes `https://` if scheme missing (`TextHelpers.sanitizeURL`). |
| `post_id` | FK posts CASCADE | `post` view target. |
| `user_id` | FK users CASCADE | `member` view target (GraphQL arg `userId`, resolver arg `viewUserId`). |
| `linked_group_id` | FK groups CASCADE | `space` / `group` view target. |
| `topics` | jsonb NOT NULL default `[]` | Array of topic **names** (custom views). Stored with `JSON.stringify` (node-pg would otherwise write `{}`). |
| `settings` | jsonb null | Per-type settings (2.3). |
| `created_at`, `updated_at` | timestamptz | |

Index: `(group_id, "order")`.

Denormalized counters on `groups` maintained by `GroupView.syncMenuViewCount` / `syncMoreSpacesCount`:
- `groups.menu_view_count` — number of rows with non-null `order` (lets the parent menu decide "single-view space → link straight to the view" without loading nested views).
- `groups.more_spaces_count` — active child spaces (`type='space'`, `active=true`, includes draft/archived status) that have **no** on-menu `type='space'` row in this group. Drives the More Spaces footer badge.

### 2.2 View types (`GroupView.Type`)

| `type` | Name rule | Route suffix (`groupViewPath`) | Rendered by | Notes |
|---|---|---|---|---|
| `all` | default label "All Activity" (`view-all`) | `/all` | `ViewContent view=all` | Main stream. Settings: `showChatActivity` (default true). |
| `chat` | "Chat" | `/chat` | `ChatRoom` ([17](17-chat-rooms.md)) | |
| `discussions` | "Discussions" | `/discussions` | `ViewContent` | |
| `events` | "Events" | `/events` | `ViewContent` | |
| `requests-and-offers` | "Requests & Offers" | `/requests-and-offers` | `ViewContent` | |
| `resources` | "Resources" | `/resources` | `ViewContent` | |
| `proposals` | "Proposals" | `/proposals` | `ViewContent` | |
| `projects` | "Projects" | `/projects` | `ViewContent` | |
| `map` | "Map" | `/map` | `MapExplorer` ([16](16-map.md)) | |
| `members` | "Active Members" (`view-members`) | `/members` | `Members` ([20](20-members-profiles.md)) | Menu row shows `CurrentlyActiveMembers` avatar strip. |
| `welcome` | "Welcome" | `/welcome` | `GroupWelcomePage` ([09](09-groups.md)) | `page_content` HTML. |
| `page` | **required** name | `/page/:id` | `GroupPageView` | Custom rich page (HTML in `page_content`). |
| `custom` | **required** name | `/custom/:id` | `ViewContent view=custom` | "Custom Post Stream". |
| `collection` | **required** name | `/collection/:id` | `ViewContent view=collection` | Ordered posts via `collections_posts.view_id`. |
| `space-collection` | **required** name | `/space-collection/:id` | `SpaceCollection` | Ordered space ids in `settings.spaceIds`. |
| `track-actions` | track's `actionDescriptorPlural` or "Actions" | `/track-actions` | `TrackActionsView` ([21](21-tracks.md)) | Not deletable. Spaces only. |
| `funding-round-submissions` | round's `submissionDescriptorPlural` or "Submissions" | `/funding-round-submissions` | `FundingRoundSubmissionsView` ([22](22-funding-rounds.md)) | Not deletable. Spaces only. |
| `link` | **required** name | none (external anchor) | — | Non-navigable. Opens `link` in new tab. |
| `post` | post title | `/post/:postId` | `PostDetail` | Icon = post-type icon. |
| `member` | user name | `/members/:userId` | `MemberProfile` | Avatar shown. |
| `group` | linked group name | — (links to `/groups/:slug`) | — | Link to related group (parent/child/peer). |
| `space` | name override, else linked space name | — (space entry URL) | `SpaceContent` | Menu entry for a child space. Non-navigable as a "view". |
| `text` | "Heading" (`view-text`) — label shows `page_content` (fallback `name`) | — | — | Non-clickable uppercase section heading. |
| `separator` | "Separator" | — | — | Horizontal rule. |

Synthetic (not stored): `manage-round` ("Manage Round", Lucide `Settings`, `order = MAX_SAFE_INTEGER`) — always appended to a funding-round space's menu for admins.

Removed types (must not exist): `about`, `moderation`, `related-groups` (now About-page tabs), `all-topics`, `tracks`, `funding-rounds` (became `space-collection`).

`NON_NAVIGABLE_TYPES = ['link','text','separator','space']` — cannot be home (`setHomeView` rejects "This view cannot be set as the home view"); reorder only rewrites `home_route` when the new first row is navigable.

### 2.3 `settings` jsonb by type

| Type | Keys |
|---|---|
| `all` | `showChatActivity: boolean` (absent ⇒ true); optional `defaultViewMode` |
| typed views | optional `defaultViewMode` (no UI sets it today) |
| `custom` | `postTypes: string[]`, `activePostsOnly: boolean` (UI always writes `false`), `defaultSort` (UI always writes `'created'`), `defaultViewMode` (`cards`/`list`/`bigGrid`/`grid`/`calendar`; `map` legacy → redirect), `searchText?: string` |
| `space-collection` | `spaceIds: string[]` (ordered); migrated rows may also carry `migratedFrom: 'tracks'|'funding-rounds'` |

### 2.4 Defaults per built-in view (`COMMON_VIEWS`, `packages/presenters/src/GroupViewPresenter.js`)

| View | Default view mode | Post types (`types`) | Default sort | Other |
|---|---|---|---|---|
| `all` | `cards` | (stream types; see 5.2) | `created` | Chat-activity notices included unless disabled |
| `proposals` | `cards` | `['proposal']` | `created` | |
| `discussions` | `list` | `['discussion']` | `updated` | |
| `events` | `calendar` | `['event']` | `start_time` (forced) | timeframe default `future` |
| `projects` | `bigGrid` | `['project']` | `created` | |
| `requests-and-offers` | `bigGrid` | `['request','offer']` | `created` | `defaultActivePostsOnly: true` |
| `resources` | `grid` | `['resource']` | `created` | |
| `track-actions` | — | `['action']` | — | |
| `funding-round-submissions` | — | `['submission']` | — | |

Other entries carry only names/icons: `funding-rounds` ("Funding Rounds", BadgeDollarSign), `groups`, `map`, `members` ("Active Members"), `moderation`, `topics` ("All Topics"), `tracks`, `welcome` (HeartHandshake), `page` (FileText).

### 2.5 Icons (`iconForView`)

Resolution order: (1) `view.icon` — treated as Lucide when in the Lucide allow-list or the type is `custom|collection|space-collection|space|link|logout|page`, else legacy Hylo icon-font name; (2) for `space`: the linked space's `icon` unless the space has a custom (non-default) avatar, in which case the avatar image is shown instead (`avatarForView`); (3) `post`: the post type's icon; (4) type default Lucide icon:

| type | Lucide default |
|---|---|
| all | Activity |
| chat | MessageCircleMore |
| collection | Layers |
| space-collection | Boxes |
| funding-round-submissions | ClipboardList |
| manage-round | Settings |
| link | ExternalLink |
| map | Map |
| member | User |
| members | Users |
| page | FileText |
| projects | Layers |
| proposals | Vote |
| resources | PackageOpen |
| requests-and-offers | Heart |
| text | Type |
| separator | Minus |
| welcome | HeartHandshake |

Else Hylo icon-font: discussions → `Message`, events → `Calendar`, `track-actions` → `Shapes`, `custom` → `Filter`, `group` → `Groups`. `member` and `group` views show the user's / group's avatar.

Default icons chosen in add dialogs: custom `ListFilter`, collection `Layers`, space-collection `Boxes`, page `FileText`, link `Globe`.

### 2.6 `group_views_users` (`GroupViewUser`)

Per (view, user): `new_post_count`, `last_read_post_id`, `settings` (written by `updateViewSettings`, never read). Unique `(view_id, user_id)`. Created lazily (`findOrCreate`), on space join (`Group.ensureSpaceViewUsers` — chat views start "read to latest" via `markRead`). Unread semantics: see §5.8 and [19](19-notifications-email-push.md).

### 2.7 `collections_posts` (`CollectionPost`)

`id, view_id (NOT NULL, FK group_views CASCADE), post_id, user_id (who added), order int, created_at`. Unique `(view_id, post_id)`. Used by `collection` and `track-actions` views.

### 2.8 `group_view_pins` (`GroupViewPin`)

`id, view_id, post_id, pinned_at`, unique `(view_id, post_id)`. Max **3** pins per view (`MAX_PINNED_POSTS_PER_VIEW`). Pinnable view types: `all, discussions, events, requests-and-offers, resources, proposals, projects, chat, custom, collection`. Post must be in `groups_posts` for the view's own group. Mutation `pinPost(postId, viewId)` toggles (UI on post cards → [13](13-posts-comments.md)).

### 2.9 Spaces (`groups` rows with `type = 'space'`)

Columns relevant to spaces (added by the spaces migration; see [02](02-data-model.md)):

| Column | Meaning |
|---|---|
| `type` | `'space'` |
| `parent_id` | Parent group id (CASCADE). Spaces of spaces are not allowed (convert checks). |
| `slug` | Globally unique **stored** slug `{parentSlug}-{localSlug}`; URL uses only the local part. |
| `accepted_post_types` | jsonb array; `null` = all; `[]` = none of the steward-configurable types (chat/action/submission always allowed). |
| `required_roles` | jsonb array of **parent-group** `group_roles` ids; non-empty ⇒ role-gated. |
| `icon` | Lucide icon name. |
| `track_id` / `funding_round_id` | Set for track / funding-round spaces. |
| `status` | `draft`, `published`, `archived`; funding-round spaces additionally `submissions`, `discussion`, `voting`, `completed`. `PUBLISHED_STATUSES = [published, submissions, discussion, voting, completed]`. |
| `active` | `false` = deleted (soft). |
| `paywall` | Paid space (requires an offering granting `groupIds` ⊇ space). |
| `visibility` | 0 Hidden, 1 Protected, 2 Public. |
| `accessibility` | 0 Closed, 1 Restricted, 2 Open. |
| `purpose`, `description`, `banner_url`, `avatar_url`, `location`, `location_id`, `geo_shape` | Display / map. |
| `settings.auto_add_members` | Auto-add all current and future parent members. |
| `settings.showWelcomePage` | Land new members on `/welcome`. |
| `settings.chat_converted_to_post_id`, `chat_conversion_status`, `chat_conversion_post_id` | Chat-room → discussion conversion bookkeeping. |
| `num_members`, `num_open_join_requests` | Initialized to 0 on create. |
| `access_code`, `calendar_token` | Generated on create; a system `GroupInviteLink` is created. |
| `home_route`, `menu_view_count`, `more_spaces_count` | Caches. |

**Roles:** spaces never store roles. `Group.roleScopeId(g) = parent_id || id`; responsibilities in a space = the user's parent-group roles, effective only while they are a member of the space. `createSpace` does **not** call `setupSystemRoles`.

**Parent menu entry:** every space has one `group_views` row in its parent with `type='space'`, `linked_group_id=space.id`, `name` kept in sync with the space name (`syncSpaceMenuViewName`). `order=null` ⇒ the space is listed in More Spaces.

**Space kinds** (chosen at creation, immutable): `custom`, `chat`, `track`, `funding-round` (see §4.9).

### 2.10 Static (non-DB) context views

My Home and Public menus are hard-coded lists (`MY_CONTEXT_VIEWS`, `PUBLIC_CONTEXT_VIEWS` in `GroupViewPresenter.js`) shaped like group views. Labels are `view-*` i18n keys.

**Public context (The Commons)**

| order | type | label (en) | route |
|---|---|---|---|
| 1 | all | "Public Activity" (`view-public-all`) | `/public/all` |
| 2 | groups | "Group Explorer" | `/public/groups` |
| 3 | map | "Public Map" | `/public/map` |
| 4 | events | "Public Events" | `/public/events` |

**My Home context** (header "My Home"; shown on `/all/*` and `/my/*`)

| order | type | label | route |
|---|---|---|---|
| 1 | all | "All My Groups Activity" | `/all/all` |
| 2 | map | "All My Groups Map" | `/all/map` |
| 3 | events | "All My Groups Events" | `/all/events` |
| 4 | text | heading "My Content" | — |
| 5 | posts | "My Posts" | `/my/posts` |
| 6 | drafts | "My Drafts" | `/my/drafts` |
| 7 | interactions | "My Interactions" | `/my/interactions` |
| 8 | mentions | "Mentions" | `/my/mentions` |
| 9 | saved-posts | "Saved Posts" | `/my/saved-posts` |
| 10 | tracks | "Tracks" | `/my/tracks` |
| 11 | funding-rounds | "Funding Rounds" | `/my/funding-rounds` |
| 12 | text | heading "My Account" (`view-myself`) | — |
| 13–24 | link/settings | My Profile, Edit Profile, My Groups, My Invites, My Transactions, Notifications, Appearance, Language/Locale, Blocked Users, Saved Searches, Account, Logout | see [05](05-user-settings.md) |

`/my/announcements` is routed but not in the menu. The My Home button in the global nav lands on `/all/all` (`myHomeLandingUrl`).

---

## 3. Routes / entry points

(Full routing table lives in [06](06-app-shell-navigation.md); this lists the routes this module renders.)

### 3.1 Group routes (`/groups/:groupSlug/...`, members only — non-members get `GroupDetail`)

| Path | Component |
|---|---|
| `all/*` | `ViewContent view=all` |
| `stream/*` | redirect → `all/*` (`RedirectStreamToAll`, keeps trailing path) |
| `discussions/*`, `events/*`, `resources/*`, `projects/*`, `proposals/*`, `requests-and-offers/*` | `ViewContent` |
| `custom/:customViewId/*` | `ViewContent view=custom` |
| `collection/:customViewId/*` | `ViewContent view=collection` |
| `space-collection/:viewId/*` | `SpaceCollection` |
| `page/:viewId/*` | `GroupPageView` |
| `topics/:topicName/*` | `ViewContent` (topic stream) |
| `topics` | `AllTopics` |
| `map/*` | `MapExplorer` ([16](16-map.md)) |
| `spaces/:spaceSlug/*` | `SpaceContent` |
| `more-spaces` | two-column `MoreSpacesPage`; one-column `ContextMenuGrid` (More Spaces level) |
| `explore/*` | redirect → `homeRoute` (fallback `/all`) |
| `all-views/*`, `tracks/*`, `funding-rounds/*`, `all-topics/*` | redirect → `more-spaces` |
| `*` | welcome redirect if applicable, else one-column `ContextMenuGrid`, else redirect → `homeRoute` (fallback `/all`) |

Every stream route nests `post/:postId` → `PostDialog` (post opens as overlay above the stream).

### 3.2 Space routes (`/groups/:parentSlug/spaces/:localSlug/...`)

Resolution: the local slug is matched against the parent's `type='space'` menu rows (`linkedGroup.slug`) then against `parentGroup.spaces` (off-menu). If unresolved, the client fetches `fetchGroupSpaces(parent.id)`; while unresolved, shows Loading.

**Non-member** of the space: only `requests` (if viewer has `Add Members` on the space), `settings/requests` → `requests`, `settings/*` → space base, `*` → `SpaceJoinPage`.

**Member**:

| Path | Component |
|---|---|
| index / `*` | if (one-column layout or drawer viewport) **and** (space has >1 on-menu view or `?edit=true`): `ContextMenuGrid` for the space; else redirect to `spaceBase + homeRoute` (query string preserved) |
| `welcome/*` | `GroupWelcomePage` |
| `page/:viewId/*` | `GroupPageView` |
| `map/*` | `MapExplorer` |
| `all/*`, typed views, `custom/:id/*`, `collection/:id/*` | `ViewContent` |
| `space-collection/:viewId/*` | `SpaceCollection` |
| `members/*`, `members/:personId/*` | Members / MemberProfile |
| `requests` | `MembershipRequestsTab` |
| `settings/requests` | → `requests`; `settings/*` → base (no space settings page; settings are a modal) |
| `chat/*` | `ChatRoom` |
| `track-actions/*`, `funding-round-submissions/*`, `manage-round/*` | track / round views |
| `moderation/*` | → `about/moderation` |
| `about/*` | `GroupAboutPage` (space variant) |
| `post/:postId/...` | `PostDetail` |

Welcome landing: if `shouldLandOnWelcome(space, membership)` (welcome view exists, `settings.showWelcomePage` true, membership has no `lastViewedAt`) and the URL does not open a post (`/post/:id` or `?postId=`), redirect to `welcome`. `lastViewedAt` is set on the first non-welcome visit.

Home route fallback (`spaceHomeRoutePath`): order-0 view path → `space.homeRoute` → `/track-actions` (track) → `/funding-round-submissions` (round) → `/all`.

### 3.3 All / Public / My routes

| Path | Component |
|---|---|
| `/all/all/*` | `ViewContent context=all view=all` |
| `/all/projects/*`, `/all/proposals/*`, `/all/events/*` | `ViewContent context=all` |
| `/all/map/*` | `MapExplorer context=all` |
| `/all/topics/:topicName`, `/all/topics` | topic stream / AllTopics |
| `/all` | card-menu users: `ContextMenuGrid context=all`; else → `/all/all` |
| `/all/stream/*` | → `/all/all/*` |
| `/public/all/*`, `/public/projects/*`, `/public/proposals/*`, `/public/events/*` | `ViewContent context=public` |
| `/public/map/*` | `MapExplorer context=public` |
| `/public/groups/*` | `GroupExplorer` ([09](09-groups.md)) |
| `/public/topics/:topicName` | topic stream (public) |
| `/public`, `/public/*` | grid or → `/public/all` |
| `/my/posts|drafts|interactions|announcements|mentions|saved-posts/*` | `ViewContent context=my` |
| `/my/tracks/*`, `/my/funding-rounds/*` | `MySpaceCollection kind=track|funding-round` |
| `/my` | grid or → `/my/posts` |

### 3.4 Query-string state

| Param | Meaning | Default (removed from URL when equal) |
|---|---|---|
| `s` | sort | `all` sentinel → removed |
| `t` | post-type filter | `all` |
| `v` | view mode | `cards` |
| `c` | include child posts `yes`/`no` | `yes` |
| `search` | search text | — |
| `activeOnly` | `true`/`false` | `false` |
| `timeframe` | `future` / `past` (events list) | `future` |
| `rsvpFilter` | `yes+interested` / `no` | all |
| `calendarMode` | `day`/`week`/`month` | `month` |
| `calendarDate` | ISO date | today |
| `edit` | `true` = menu edit mode (admins) | — |
| `create=post` (+`newPostType`, `eventDate`) | opens post editor modal | — |
| `space` | (two-column More Spaces) select a space in the sidebar | — |

---

## 4. UX specification

### 4.1 Stream page layout (`ViewContent`)

- **Document title**: `{name} | {group name} |  | Hylo` (literal formatting from code: `` `${name} | ${group ? group.name + ' | ' : context} | Hylo` ``).
- **View header** (shared `ViewHeader`, [06](06-app-shell-navigation.md)): icon + title + `info` + search enabled. Title = view display name; `#topicName` for topic streams; My views use "Mentions", "Announcements", "Interactions", "Posts", "Drafts", "Saved Posts".
- **Header info line**:
  - custom stream: "Displaying: " + "Only active" (if set) + a post-type label chip and `{type}s` for each post type (or "None" if empty) + "filtered by topics:" + `#topic` list.
  - collection: "Curated Post Collection".
  - topic stream: "Filtered by topic #{{topicName}}".
- **Sticky control bar** (top, z-30, gradient from theme background): left = **New** button (`PostPrompt`) shown when the user has ≥1 membership and context ≠ `my`; right-justified = `StreamViewControls`.
  - New button: rounded, 2px `selected` border, `SquarePen` icon + "New" (label hidden on phones). Tooltip/aria-label is the per-type prompt: "Hi {{firstName}}, click here to create an event|offer|project|proposal|request|resource|a post" (type chosen only when exactly one post type is available). Links to `?create=post&newPostType=<first available type>[&eventDate=YYYY-MM-DD]`.
- **Content column**: centered column (`STREAM_MAIN_COLUMN_CLASS`), except calendar mode which is full-width with padding.
- **Paywall**: when the group/space has `paywall` and `canAccess === false` (not My/Public), the control bar is hidden and `PaywallOfferingsSection` is rendered instead of posts ([23](23-paid-content-stripe.md)).
- **Stream tour**: first visit offers an invitation "Want a quick tour of these stream controls?" with steps: "View modes" — "Cards, list, grids, or a calendar — the same posts in different shapes."; "Hide completed posts" — "Filters out requests and offers that are already fulfilled."; "Posts from spaces" — "Shows or hides posts from spaces and child groups you belong to."; "Your choices stick" — "Sort, view mode, and post type filters carry over to every stream on your account."

### 4.2 Stream controls (`StreamViewControls`), in visual order (right-aligned row, wraps on ≥sm)

1. **Sort / timeframe dropdown** (pill with sort glyph + label + chevron; on phones label only, max 88px):
   - Events view in non-calendar mode → timeframe: "Upcoming Events" (`future`) / "Past Events" (`past`).
   - Calendar mode → no sort control.
   - Collection → "Manual" (`order`), "Latest activity" (`updated`), "Post Date" (`created`), "Popular" (`reactions`).
   - Otherwise → "Latest activity", "Post Date", "Popular".
2. **Post-type filter dropdown**: shown when the view allows more than one type (or no restriction). Options "All Posts", "Discussions", "Events", "Offers", "Projects", "Proposals", "Requests", "Resources" — restricted to the view's types plus "All Posts".
3. **RSVP filter** (events view only): "All Events", "Going/Interested" (`yes+interested`), "Not Going" (`no`).
4. **View-mode segmented group** (desktop) / dropdown (phones): "Card", "List", "Large Grid" (`bigGrid`, lucide Grid2x2), "Small Grid" (`grid`, Grid3x3), "Calendar" (hidden on the Discussions view). Active button = filled `selected` green with white icon.
5. **Toggle group**:
   - Active-only (check-circle glyph). Tooltip: "Hide complete posts, show only active ones" / "Show both active and completed posts".
   - Child posts (tree glyph) — hidden in My / All / Public contexts. Tooltip: "Hide posts from child groups and spaces you are a member of" / "Show posts from child groups and spaces you are a member of".
6. **Search** toggle ("Search posts"): reveals a full-width input (placeholder "Search posts", autofocus). Enter commits the search to `?search=` and closes the input. A committed search shows a chip `"term" ×`; clicking it clears the search.

Persistence: changing post type, sort, view mode or child toggle **also writes user settings** (`streamPostType`, `streamSortBy`, `streamViewMode`, `streamChildPosts`) — these become defaults for every stream for that user. Active-only, timeframe, RSVP, search and calendar state are URL-only.

### 4.3 Effective parameters (resolution rules)

Let `systemView = COMMON_VIEWS[view]`, `cfg` = custom/collection config from the GroupView.

- **View mode** = `?v` → `cfg.defaultViewMode` → `systemView.defaultViewMode` → `user.settings.streamViewMode` → `cards`. A value of `map` renders as `cards` (and a custom view whose `defaultViewMode='map'` with no `?v` redirects to the group/space `/map`).
  - Note: a GroupView's own `settings.defaultViewMode` on a built-in view type is **not** consulted by `ViewContent` (only custom/collection configs are) — see quirks.
- **Sort** = `?s` → `cfg.defaultSort` → (`order` for collections) → `systemView.defaultSortBy` → `user.settings.streamSortBy` → `created`. `order` outside a collection becomes `updated`. Events view or calendar mode forces `start_time`.
- **Post type filter (`filter`)** = `?t` → user `streamPostType` (only when "inheriting": not `all`, not custom/collection) → none; ignored if not within the view's allowed types.
- **Allowed types (`types`)** = custom stream `cfg.postTypes`; else `systemView.postTypes`; else none.
- **Active only** = `?activeOnly=true`, else custom stream `cfg.activePostsOnly`, else (inheriting views only) `systemView.defaultActivePostsOnly || user.settings.activePostsOnly`. Requests & Offers therefore default to active-only.
- **Child posts** = `?c` → `user.settings.streamChildPosts` → `yes`.
- **Search** = `?search` → custom stream `cfg.searchText`.
- **Topics** = topic route's topic id, or custom stream `cfg.topics` (names).
- **Timeframe** (events) = `?timeframe` → `future`.

### 4.4 Fetching & pagination

- Group context → `group(slug){ viewPosts(...) }` when child posts included, else `group.posts(...)`; also passes `updateLastViewed: true`. All/Public/My → root `posts(context: ...)`.
- **Page size**: 20 (desktop), 10 (mobile user agents, `isMobile.any`); calendar mode loads 60 per page and auto-pages until `hasMore` is false.
- Infinite scroll: `ScrollListener` on `#stream-outer-container` loads the next page (`offset = posts.length`) at bottom.
- All Activity with no type filter, not calendar, and `showChatActivity` on → `filter: 'all+notices'` and no `types` (includes synthetic `chat_activity` posts rendered by `ChatActivityCard`: "Recently in <group>" summary card).
- Events view (list mode): `afterTime = now` for `future` (ascending), `beforeTime = now` for `past` (descending). Results dropped and refetched whenever params change.
- Calendar mode: `afterTime` = start of the locale week containing the 1st of the month; `beforeTime` = end of the week containing the month's last day + 1 day; `order: asc`; if no type constraint, `filter: 'event'`. Day/week navigation within the same month does not refetch.
- My views: mentions → `mentionsOf:[me]`; announcements → `announcementsOnly`; interactions → `interactedWithBy:[me]`; posts → `createdBy:[me]`; saved-posts → `savedBy:[me]`, `sortBy:'saved'`, `filter:'chat'` (all types incl. chat). Drafts render `MyDrafts` instead of a stream ([13](13-posts-comments.md)).
- First-page error: retried once automatically; then shows "Couldn't load posts" with "Try Again".
- Loading: skeleton cards (`StreamSkeleton`; 2 placeholders when appending).
- Typed views (discussions/events/…): on open, if that view's `newPostCount > 0`, `markViewAsRead(viewId)` once per view id.
- Returning from the create modal in calendar mode triggers a refetch.

### 4.5 View modes — layout

| Mode | Component | Layout |
|---|---|---|
| `cards` | `PostCard` | Single column of full cards (on ≤425px: 5px side margin, 10px bottom gap). |
| `list` | `PostListRow` | Single column of compact rows inside a bordered (2px, 10% fg) rounded card container. |
| `grid` (Small Grid) | `PostGridItem` | Masonry: 2 columns, 3 columns at ≥426px; 8px gaps, padding 8px. |
| `bigGrid` (Large Grid) | `PostBigGridItem` | Masonry: 2 columns; 8px gaps. |
| `calendar` | `Calendar` | Month / week / day calendar ([14](14-events-proposals-projects.md)); month cells show up to 3 events then "+N more..."; "Create event on {{date}}" button per day; "Go to Today" / "Go to This Week" / "Go to This Month". Below month view: calendar subscription button (group: `eventCalendarUrl`; no group on Events: "Subscribe to all the Hylo events you have RSVPed to"). |

Masonry algorithm: CSS grid; measure natural heights, then 1px auto-rows with each item spanning `height + gap` rows (preserves left-to-right DOM order).

Child posts: a post whose groups do not include the current group (or any post in My/All/Public) renders with its group chip(s) (`childPost`), and `childPostFromSpace` when any of its groups is a space.

### 4.6 Pinned posts in streams

Up to 3 pins per view. In cards/list/grid modes the pinned posts appear at the top of the feed (in pin order) and are removed from their natural position. In calendar mode pinned posts show as a chips row (`PinnedPostChips`) and events remain at their natural dates. In a collection sorted by `order` pins are not lifted.

### 4.7 Empty states

- Default: icon `CircleDashed`, heading "Nothing here yet"; Events list: "No upcoming events" / "No past events" ("No {{timeFrame}} events").
- With action button "Create something" when the user can post (opens create modal pre-selecting `newPostType` if the view has exactly one type or a type filter is active).
- Missing custom/collection view (deleted id) also shows the empty state.
- `NoPosts` default message (if none passed): "Nothing to see here".

### 4.8 Collections (manual post lists)

- Created via **Add View → Collection → Next** dialog titled "Collection": fields Name (≥2 chars), Icon (default `Layers`), Posts (`PostSelector`, draggable list, "{n} posts in this collection"). Buttons: "Back"/"Cancel", "Set as Home View" (edit only, not when already home; confirm "Set this view as the home view for the group?"), "Add View"/"Save" ("Creating..."/"Saving...").
- Create: `createGroupView(type:'collection')`, then `addPostToView` for each post (appended, order = max+1).
- Edit: diff vs. initial — `removePostFromView` for removed, `addPostToView(order: index)` for added, then if order changed `reorderViewPost` for every post index.
- In the stream: default sort "Manual" (`order` asc). Admins and `Manage Content` holders get a hover-revealed drag handle (`GripVertical`, top-left of each card, always visible on touch) when: sort = order, not calendar, no search, no type filter, >1 post. Drag (mouse after 5px; touch after 180ms hold, 8px tolerance; keyboard supported) calls `reorderViewPost(order = new index)`. List/cards modes restrict drag to vertical axis; grids use rect sorting.
- Collections ignore the user's inherited type/active filters.

### 4.9 Custom views ("Custom Post Stream")

Dialog title "Custom Post Stream". Fields:
- Name (required, ≥2 chars), Icon (`LucideIconPicker`, default `ListFilter`),
- Post types pills (`CUSTOM_STREAM_POST_TYPE_PILLS`: Discussions, Events, Resources, Projects, Proposals, Requests, Offers — at least one required; default all seven selected),
- Topics (`TopicSelector` scoped to the group) → stored as names,
- "Search term" (placeholder "Filter posts by search term (optional)"),
- "Default View Mode" radio: Card, List, Large Grid, Small Grid, Calendar (Map option exists in code but commented out: "temporarily hidden while the Map view mode is in progress").
Saved settings: `{postTypes, activePostsOnly:false, defaultSort:'created', defaultViewMode, searchText}`. There is **no UI** for `activePostsOnly` or `defaultSort` (values from migrated legacy custom views are preserved on edit).

### 4.10 Pages (`page` views)

"Add Page" dialog (full-height, max 750px): Name (required), Icon (default `FileText`), rich editor (HyloEditor, `welcomePage` type with extended menu: text, images, video). Rendered by `GroupPageView` at max-width 750px; empty → "This page has no content yet". Header search enabled. Pages cannot host a post overlay (post links from a page-home group use `/post/:id`).

### 4.11 Space collections

- `SpaceCollection` page: header icon `Boxes`, title = view name (plus "Editing" pill in edit mode). Card grid of `SpaceViewCard`s for `settings.spaceIds` filtered by the viewer's space visibility (deleted ids dropped). Empty: "No spaces in this collection". Clicking a card opens the space (`spaceEntryUrl`); the (i) button opens the space About.
- Admins in `?edit=true`: "Add spaces" card opens a picker (`SpaceSelector`) + "Done"; an Add Space dialog (`AddSpaceDialog`, `addToMenu=false`) can create a new space which is appended; "Remove from collection" per card; bottom bar "Drag to reorder" / "Done Editing". Reorder (Admins and `Manage Content`) persists via `updateGroupView(settings.spaceIds)`; hidden ids keep their slots (`reorderVisibleSpaceIds`).
- Dialog "Space Collection" (create/edit): Name (≥2), Icon (default `Boxes`), Spaces list ("{n} spaces in this collection"), Set as Home View, Add View/Save.
- `Manage Content` holders may update only `settings.spaceIds` of a space-collection (server enforces that no other field is passed).

### 4.12 `MySpaceCollection` (`/my/tracks`, `/my/funding-rounds`)

Title "My Tracks" / "My Funding Rounds" (icon Shapes / BadgeDollarSign). Card grid (max 980px) of the user's active track/round space memberships sorted by name. Empty: "You are not a member of any tracks" / "You are not a member of any funding rounds".

### 4.13 Topic streams & All Topics

- Topic stream: `/groups/:slug/topics/:topicName` (or `/all/topics/:t`, `/public/topics/:t`) → `ViewContent` with `topics=[topicId]`, title `#topicName`, info "Filtered by topic #{{topicName}}". Fetches `fetchGroupTopic` / `fetchTopic` first; stream waits for the topic.
- Clicking a `#hashtag` in content runs a search (`/search?t=%23name&groupSlug=…`) rather than opening the topic stream ([07](07-search.md)).
- `AllTopics` (full-page modal): title "{{groupName}} Topics" (or "All Topics"), subtitle "{{n}} Total Topics", search box "Search topics", sort dropdown Name / Popular (`num_followers`) / Recent (`updated_at`), list of `#topic` with "N posts • N subscribers • Subscribe/Unsubscribe"; topics with `visibility = 0` hidden unless subscribed. Page size 20 then 10 on scroll.
- Topic follow (`subscribe(groupId, topicId, isSubscribing)`; `TagFollow`) now only matters for chat notification preferences ([17](17-chat-rooms.md)). `createTopic(topicName, groupId, isDefault, isSubscribing)` requires active membership and a valid tag name (`Tag.validate`).
- Dead code: `TopicFeedHeader` and `CreateTopic` components are not mounted anywhere.

### 4.14 Spaces — UX

**Menu entry** (details of rendering in [06](06-app-shell-navigation.md)): a member's single-view space row links directly to that view; a multi-view space opens the space and the sidebar swaps to the space's own menu (header, views, "Space Settings" gear for admins, member count pill / "+ Join", Invite, About). Space rows are hidden by `shouldShowSpaceInMenu`:
- draft/archived → only managers (Administration on parent);
- managers see all;
- paywalled → only if a **published** offering grants the space's id;
- role-gated → only if the viewer holds one of the required parent roles;
- Hidden visibility or Closed accessibility → only members;
- else visible.

**Join interstitial (`SpaceJoinPage`)**: centered card (max 840px): banner (172px) or the space's repeated-icon texture, 56px icon tile, name, member-count pill; purpose; description (HTML); "Access" box with icon and sentence from `spaceAccessDescription`:
- paywall: "A paid membership is required to join this space"
- role gated: "Only {{roleNames}} may join this space"
- open: "Anyone in {{groupName}} can access this space"
- restricted: "Members of {{groupName}} must request to join and be approved"
- else: "You must be invited to join this space"

CTA (first match):
1. Retained-access (left but still has paid access) → `RetainedAccessPanel` with Rejoin ([23](23-paid-content-stripe.md)).
2. Can join directly (parent admin; or not paywalled and (role-gated with role, or Open)) or via invite link (`?accessCode` / `?token`, not paywalled, role satisfied) → "Join Space" ("Joining..."). With an invite link and eligibility, join is attempted automatically on load.
3. Paywall → "Pay to Join Space" + offerings.
4. Role-gated with invite link → "This invitation link requires you to have the {{roleNames}} role to join this space".
5. Role-gated → "You do not have a role needed to join this space".
6. Restricted → pending: box "Request to join pending" / "You will be sent an email and notified on your device when the request is approved."; else "Request to Join Space" ("Requesting...") → `createJoinRequest(spaceId, [])` (no questions).
7. Else → "This space is invite only. You need an invitation to join."
Errors show above the CTA ("Something went wrong. Please try again." fallback).

**Space About modal** (`SpaceAboutModal`): dialog max 720px, the same `GroupAboutView` as group About with `isSpace`; at the bottom of the space About page, members get **SpaceGlobalNavPinButton**: "Pin space to global navigation" / "Unpin space from global navigation" (Pin/PinOff icon) → `pinGroup`/`unpinGroup(spaceId)` (membership `nav_order` non-null = pinned). See [06](06-app-shell-navigation.md) for how pinned spaces appear in the global nav.

**Create space (`AddSpaceDialog`)** — title "Create a new space in the main menu" (or "Create a new space in More Spaces" when `addToMenu=false`). Offers a tour invitation "Creating a space? Take a quick tour of the big decisions." (and "Setting up a track? Take a quick tour." / "Setting up a funding round? Take a quick tour.").
1. Kind tiles: "Custom Space" (Layers), "Chat Space" (MessageCircleMore), "Track" (Shapes), "Funding Round" (BadgeDollarSign). Switching resets defaults:

| Kind | Default accepted post types | Default views (in order) | Default icon | Welcome on |
|---|---|---|---|---|
| custom | discussion, event, resource, project, proposal, request, offer | all, chat, members, then one typed view per fully-selected pill (discussions, events, resources, projects, proposals, requests-and-offers) | Circle | no |
| chat | `[]` | chat | MessageCircleMore | no |
| track | `[]` | track-actions, chat, members, welcome | Shapes | yes |
| funding-round | `[]` | funding-round-submissions, chat, members, welcome | BadgeDollarSign | yes |

2. Banner upload ("Set space banner"), 3. icon row (suggestions: Circle, MessageSquareMore, Shapes, BadgeDollarSign, Layers, Building2, MapPin, Users, Sparkles, Heart, Landmark, Trees, Globe + full picker), 4. Name ("Space name") + **Handle** field (`@` prefix, placeholder "your-space-name", info "Your space's unique address on Hylo. It appears in your space's URL.", auto-derived from name until edited; validation "Please enter a URL slug", "URLs must have between 2 and 40 characters, and can only have lower case letters, numbers, and dashes.", "This URL already exists. Try another." (debounced 300ms existence check of `{parentSlug}-{local}`); preview `hylo.com/groups/{parent}/spaces/{slug}` middle-ellipsized `hylo.com/…/spaces/slug`), 5. Purpose ("What is this space for?"), 6. Description ("Description (optional)"), 7. Access selector (below), 8. Home picker (custom kind): "Choose your space's home" / "Set the default view members see when they enter your space. You can change this later by editing the space menu." — segmented "Activity Stream" ("A sorted feed of all your space's posts") vs "Chat" ("A real-time chat room for quick conversations, coordination and casual interactions."); button "Edit Full Menu" (or "Edit Space Menu" for preset kinds) opens "Menu Items" (`IncludedViewsEditor`: "These are the menu your members use. The one at the top is your space's home.", drag rows, remove (not home, not track-actions/funding-round-submissions), "Add View" opens the Add View dialog in staging mode). 9. Track fields / Funding-round fields ([21](21-tracks.md), [22](22-funding-rounds.md)). 10. "Additional settings" pills: Location (`LocationWithBoundary`, location + optional boundary polygon), Post types ("Accepted post types"), Welcome (toggle "Show this welcome page to new members when they first land in the space." + editor), Auto-add members (toggle "Add everyone currently in this group, and anyone who joins later. People who leave this space will not be added again.").
Buttons: "Cancel" (if anything entered → dialog "Save draft before closing?" / "You have unsaved information for this space. Save a draft to continue later, or discard it." with "Continue Editing", "Save as Draft", "Discard Space"), "Save as Draft", "Create and Publish".
After create: creates track/round if needed, inserts staged manual views at their positions (walking the order backwards with `orderInFrontOfViewId`), writes welcome content/setting, refetches, then navigates to the space home (two-column) or space menu grid (one-column) with `?edit=true`.

**Access options** (`ACCESS_OPTIONS`):

| Value | Label | Description | visibility | accessibility | extra |
|---|---|---|---|---|---|
| open | "Open" | "Anyone who can see this space can join it" | Public(2) | Open(2) | |
| request | "Request to Join" | "Must be approved by a group host" | Public | Restricted(1) | |
| invite | "Invite Only" | "Only people who are invited can join" | Hidden(0) | Closed(0) | |
| role | "Role Gated" | "Only members with the selected roles can join" | Hidden | Closed | role picker "Search roles/badges" → `requiredRoles` |
| paid | "Paid" | "Anyone can see it, but must pay to join" | Protected(1) | Restricted | `paywall=true`; disabled with tooltip "Paid access requires a connected Stripe account. Finish setup in this group's Paid Content settings." unless parent has Stripe account with charges+payouts enabled and details submitted |

Reverse mapping (editing): paywall → paid; any required roles → role; else exact visibility/accessibility match; else `invite`.

**Edit space (`SpaceSettingsModal`)** — title "Space Settings" / "Track Space Settings" / "Funding Round Space Settings". Same fields as create minus kind and menu editor; adds "Remove Banner"; for paid access shows "Offerings that include this space" list (warning "If there are no offerings that allow access to this space, members won't be able to join.") with "Create Offering" / "Grant Access" links into Paid Content settings. Footer: "Advanced" menu with "Convert chat room to discussion post" (chat-only spaces) and "Convert to Child Group" (confirm "Are you sure you want to convert {{name}} to a child group? It will no longer be a space. If it is in the menu it will become a child group item; otherwise it will only appear under Related Groups."); buttons Cancel / "Save Draft" / "Publish" (funding rounds in a lifecycle status: single "Save"). Opened from menu gear (edit mode), the space header gear, or the About page Settings tab.

**Convert chat room to discussion** (`ConvertChatSpaceModal`): title "Convert chat room to discussion post"; text "Each chat message becomes a comment on one discussion post, and this chat room is removed. No one is notified."; "The discussion will be posted in {{name}}"; dry-run preview "{{messageCount}} chat posts will be converted to comments on the discussion, with {{attachmentCount}} attachments and {{reactionCount}} reactions." (+ "{{replyCount}} comments on the chats will remain as replies to the comments."); "Discussion title" (defaults to room name); "This cannot be undone here, and no notifications are sent."; "Type {{name}} to confirm" — must equal room name exactly; Cancel / "Convert" ("Converting…"). Success toasts "Chat room converted to a discussion" or (queued) "This chat room is large, so the discussion is being created in the background." with action "View discussion"; error "Could not convert this chat room".

### 4.15 Menu edit mode (customization)

Entry: "Edit Menu" footer item (admins). Two-column desktop navigates to `/more-spaces?edit=true`; drawer and space menus toggle `?edit=true` in place. One-column grid shows "Edit Menu" / "Done Editing". First time: tour "First time editing the menu? Take a quick tour."

**Two-column edit list (`GroupViewEditList`)** — rows for each on-menu view, filtered by accepted post types (typed views whose types the group no longer accepts are hidden — `isMenuViewVisible`):
- Drag handle (GripVertical); vertical-only dnd (mouse 5px, touch 180ms/8px, keyboard).
- Row label + "Home" pill on row 0 (tooltip "When people return to this group, this is what they see first.").
- Separator rows render a rule; text rows render uppercase small text.
- Hover actions (always visible on touch): gear "Settings" (types with settings: all, chat, link, text, custom, collection, space-collection, welcome, page, space), trash "Delete" (confirm "Are you sure you want to delete {{name}}?") unless home or track-actions/funding-round-submissions.
- Space rows: "More actions" (…) menu → Settings, "Add to Collection" (submenu of space-collections not containing it), "Move to More Spaces" (confirm "Are you sure you want to remove {{name}} from the menu?" → `setGroupViewHidden(hidden:true)`), "Archive" (confirm "Are you sure you want to archive {{name}}?" → `archiveSpace`), "Delete Space" (confirm "Are you sure you want to delete {{name}}? It will be hidden from the menu and More Spaces." → `deleteSpace`); pencil "Edit space menu" → opens the space entry URL with `?edit=true`.
- Footer control "Add to Menu" → `AddViewOrSpaceMenu`: "Add View" — "Show your group's content - activity streams, curated lists, links and other ways to surface what should be seen." / "Add Space" — "A distinct space with its own members and content - chats, working groups, cohorts, resource libraries, teams". Newly added rows flash briefly (`useFlashAddedItems`), except spaces.

**Reorder rules** (`useViewReorder`): dropping at index 0 → `setHomeView`; at last index → `reorderGroupView(addToEnd)`; else `reorderGroupView(orderInFrontOfViewId = next row)`. A drop that would put a non-home-capable type (link/text/separator/space) at index 0 is rejected locally (rollback). Optimistic update; on error rollback + refetch.

**One-column edit** (`SortableViewsGrid`, `ContextMenuGrid`): the same actions on cards ("Settings", "Move to More Spaces", "Edit space menu", "Archive", "Delete"), inline More Spaces section, `AddCard`, sticky `EditingBottomBar` with "Done Editing".

**Add View dialog** (`AddGroupViewDialog`, title "Add View"): two sections:
- "Common Views" (singletons; hidden if already present or if the group's accepted post types exclude the view's types): all ("All activity in this group"), chat ("Group chat room"), members ("People currently in this group"), map ("Map of members and posts"), welcome ("Welcome new members"), discussions ("Discussion posts"), events ("Events calendar"), requests-and-offers ("Requests and offers"), resources ("Resource posts"), proposals ("Proposal posts"), projects ("Project posts").
- "Custom Views" (repeatable): custom ("Filter content how you want"), collection ("Curated set of posts"), space-collection ("Curated set of spaces"), link ("Link to external website"), post ("Link to a specific post"), member ("Link to a specific member"), group ("Link to a related group"), page ("Custom page with text, images and video"), text ("Section label"), separator ("Visual divider").
Rows toggle-select (checkbox). Inline fields: text → textarea "Text to display in the menu" (required); link → Icon (default Globe), "Title", "URL" (both required; URL sanitized to https); post → `PostSelector` (select = create immediately); member → people search "Search for a member" (group members, 20); group → related groups picker (parents/children/peers; "No related groups available" / "Type group name..."). custom/collection/space-collection/welcome/page → "Next" opens sub-dialog. Buttons Cancel / "Add View" ("Creating..."). New views are appended to the end (`addToEnd`). The dialog stays in edit mode after creation.

**Welcome view dialog** ("Welcome Page"): toggle "Show this welcome page to new members when they first land in the group." (writes `group.settings.showWelcomePage`) + editor.

**View settings modal** (`GroupViewSettingsModal`) by type:
- welcome: toggle + editor; page: Name, Icon, editor (title "Edit Page");
- chat: toggle "Show post notices in chat when other post types are created in this group." (writes `group.settings.showPostNoticesInChat`, default true);
- all: toggle "Show chat activity in All Activity" (writes view `settings.showChatActivity`);
- link: Icon, Title, URL; text: textarea (title "Edit Text View"; clears legacy `name`);
- custom: custom form; collection / space-collection: their dialogs; space: `SpaceSettingsModal`;
- other types: name only.
Footer: Cancel, "Set as Home View" (when allowed), Save ("Saving...").

**More Spaces page** (`MoreSpacesPage`, two-column) — header "More Spaces" (+ "Editing"). Max-width 980px card grid sections in order: (untitled) other spaces, "Tracks", "Funding Rounds", "Drafts", "Archived". Empty: "No more spaces". Visibility filtering as for the menu. Cards (`SpaceViewCard`) show banner/icon, name, member count or "+ Join", (i) About, "Draft"/"Archived" badges; in edit mode: "Add to Menu" (not for draft/archived), "Add to Collection", "Settings", "Archive", "Delete Space". Edit mode adds an "Add to More Spaces" card (creates an off-menu space). Includes search.

---

## 5. Business rules & side effects

### 5.1 View CRUD (`mutations/group_views.js`)

- All view mutations require `Administration` on the view's group (for a space's own views: Administration resolved through `roleScopeId`, i.e. parent roles) — except: `updateGroupView` by a `Manage Content` holder is allowed **only** when the view is `space-collection` and the only field passed is `settings.spaceIds` (stored as strings, other settings preserved).
- `createGroupView`: `hidden=true` only for `type='space'` ("Only spaces can be added off-menu"). Not hidden → `appendToMenu` (order = max+1 or 0 if empty) then optional `reorder(orderInFrontOfViewId)`. Updates `menu_view_count`/`more_spaces_count`. No server-side validation of required names or singleton uniqueness (enforced only in UI).
- `updateGroupView`: patches provided fields; optional reorder.
- `deleteGroupView`: rejects home ("Cannot delete the home view — set another view as home first") and `track-actions`/`funding-round-submissions` ("This view cannot be deleted"); destroys, re-numbers remaining 0..n-1, syncs counts.
- `reorderGroupView`: insert-before semantics over the flat list (ignoring order-null rows); rewrites `home_route` when the new first row is navigable.
- `setHomeView`: view must belong to `groupId` and be navigable; moves to index 0 and writes `home_route = homeRoutePathForView(view)` (e.g. `/all`, `/custom/123`, `/page/7`, `/post/9`, `/members/5`, `/welcome`).
- `setGroupViewHidden`: only `type='space'`; cannot hide home; hide = order null + renumber; show = order max+1.
- Every mutation calls `notifyGroupUpdated` → socket `groupUpdated` to the group room; clients refetch views.

### 5.2 Post query semantics (`filterAndSortPosts`)

- Stream types: `discussion, request, offer, project, proposal, event, resource`. `filter` ∈ `all`/empty (stream types), `all+notices` (+ `Post.NOTICE_TYPES` e.g. `chat_activity`), `chat` (stream types + chat), a specific type (narrows `types` if given), `all+welcome` (stream types). Unknown type → error `unknown post type`.
- Sort columns: `created`→`created_at`, `updated`→`updated_at`, `reactions`→`num_people_reacts`, `start_time`, `order`→`collections_posts.order` (requires forCollection, asc), `saved`→`posts_users.saved_at`, `id`, `votes` (legacy). Default order desc (asc for `order`).
- `activePostsOnly`: `fulfilled_at IS NULL AND (end_time IS NULL OR end_time >= today)`.
- `afterTime`: `end_time >= afterTime`; `beforeTime`: `start_time < beforeTime` (ongoing events match both).
- `search`: case-insensitive substring on post title, description, or creator name.
- `topics`: ids or names via `posts_tags`.
- `boundingBox`: `locations.center && ST_MakeEnvelope(...)` ([16](16-map.md)).
- `forCollection` / `collectionToFilterOut`: by `collections_posts.view_id`.
- `rsvpResponse`: joins current user's `event_invitations` (`yes+interested` = yes or interested).
- `viewPosts(userId)`: posts in the group, plus posts in child groups (`group_relationships`) and child **spaces** (`parent_id`) where the user is an active member; child posts by the Axolotl system user are excluded except notice posts. Posts of inactive users excluded.
- Root `posts(context)`: `all`/`my` → only groups the user is a member of; `public` → `is_public = true`. Multi-group streams hide Axolotl posts except notices. Top-level posts only (no `parent_post_id`).

### 5.3 Collections

`addPostToView` (Administration or Manage Content): idempotent; appends at max+1 unless `order` given. `removePostFromView`: "Not a valid post for this view" if absent. `reorderViewPost(order)`: shifts rows between old and new positions (+1/−1) then sets the post's order, in a transaction.

### 5.4 Space lifecycle (`mutations/spaces.js`)

- **createSpace** (Administration on parent; name non-blank; `GroupRole.assertAssignableRoleIds(requiredRoles)`): slug = unique `{parentSlug}-{local}` (local = valid requested slug else `slugify(name)` — lowercase, non-alnum→`-`, trimmed, max 40, fallback `space`; suffix `-2`, `-3`… on collision). Paywall forces Protected + Restricted and clears required roles. Defaults: visibility Protected, accessibility Restricted (when not given). Status `draft`|`published` (default published); drafts always off-menu. Transaction: save group (num_members 0, num_open_join_requests 0, access_code, calendar_token, created_by), system invite link, add creator as member, `Group.setupSpaceViews` (given `viewTypes` in order, else all/chat/members + typed views from accepted types), parent `type='space'` row (append or off-menu). Then `notifyGroupUpdated(parent)`; if `autoAddMembers`, queue `Group.addEligibleMembersToSpace`.
- **updateSpace** (Administration on parent; does not require space membership): slug change validated (`Group.isSlugValid`) and made unique; paywall=true forces Protected/Restricted/no roles; status allowed: draft/published/archived (all statuses for funding-round spaces); setting draft or archived **removes** the parent menu row (destroyed, not hidden); name change syncs the menu row name; turning on auto-add queues adding members.
- **archiveSpace**: `status = archived` + delete parent menu row. Space appears in More Spaces → Archived (managers only). Archived spaces cannot be joined ("This space is archived"); auto-add skips them.
- **deleteSpace**: `active = false` + delete parent menu row (works on already-inactive). Hidden everywhere.
- **convertSpaceToChildGroup**: not for track/round spaces; clears `type`/`parent_id`; role-gated spaces become Hidden/Closed (roles cleared), others become Protected; creates parent→child relationship; sets up system roles on the new group and copies the parent's stewards (system-role holders) with matching roles (adding them as members without the join form); copies parent invite policy; on-menu space row becomes a `group` row, off-menu row is deleted; removes the id from parent space-collections.
- **convertGroupToSpace(id, parentGroupId)** (from Related Groups settings): requires Administration on both; group must be a plain group (no `type`), exactly one active parent relationship matching `parentGroupId`, no child or peer groups, no active spaces (error code `HAS_NESTED_SPACES` with the blocking list; converted chat rooms don't block), parent not a space; sets type/parent, deactivates relationship, converts parent `group` menu rows to `space` rows (or creates an off-menu one), unpins it from everyone's global nav.
- **convertChatSpaceToDiscussion(spaceId, title, dryRun)**: Administration on parent; space must accept exactly `['chat']`, not track/round, parent not a space, parent must accept discussions ("{parent} does not accept discussion posts"), no message may belong to another group. Dry run returns counts (`messageCount, authorCount, attachmentCount, reactionCount, replyCount, firstMessageAt, lastMessageAt`). Real run creates a discussion (body `<p>Converted from the chat room "NAME" on YYYY-MM-DD.</p>`, `created_from='chat-conversion'`, not public) in the parent; each chat becomes a comment (comments on chats remain as replies); space is archived + inactive + menu row removed; `settings.chat_converted_to_post_id` set. Rooms with > 2000 messages (env `CHAT_CONVERSION_QUEUE_THRESHOLD`) are finished by a background job (`Group.convertChatSpaceMessages`, batches of 200); `chat_conversion_status='pending'` blocks repeat runs. No notifications.
- **joinSpace(spaceId, accessCode?, invitationToken?)**: must be an active member of the parent ("You must be a member of the parent group to join this space"). Parent Administration bypasses all gates (incl. draft, paywall, roles). Otherwise: archived → error; draft → "This space is not published"; paywall → "This space requires purchased access to join"; role-gated → must hold a required parent role (invites do not bypass) ("You do not have the required role to join this space"); non-Open without a valid invite for this space → "This space requires a request to join". On join: membership created, invite link join recorded / invitation used, `ensureSpaceViewUsers` (chat view starts read-to-latest).
- **Leaving** a space uses generic `leaveGroup`; `Group.removeMembers` settles track/round counters, deletes view-unread rows, revokes roles only when `roleScopeId === this.id` (never for spaces), and leaving a parent cascades to its spaces. Leaving sets `settings.leftSpace` so auto-add will not re-add them.
- **Auto-add** (`addEligibleMembersToSpace`): for active, non-archived spaces with `auto_add_members`; candidates = all parent members (or the newly joined ones, via `Group.afterAddMembers`); skips existing active members and those with `leftSpace`; reactivates inactive memberships; new memberships copy the person's parent notification settings and skip the join form.

### 5.5 Unread & badges

See [19](19-notifications-email-push.md) for counting. Summary: chat view → numbered badge; typed views → dot; spaces → dot from space membership `new_post_count`; all/custom/collection/space-collection/welcome/page/map/members/link/text/space/track-actions/funding-round-submissions/group/member never badge. `updateGroupViewUser(viewId, lastReadPostId)` recomputes the view's count (chat: chat posts only; typed: its types); `markViewAsRead`, `markGroupAsRead` zero counts; all then `GroupMembership.syncBadgeCounts`. Membership badge = unread chats + 1 per on-menu typed view with unread.

### 5.6 Real-time

- `groupUpdated` socket event on any menu/space change (clients refetch `groupViews`).
- New posts are not pushed into streams live (streams refresh on navigation/refetch); chat is live ([17](17-chat-rooms.md)).
- Open join request count broadcast for the Join Requests badge.

---

## 6. Permissions

| Action | Who |
|---|---|
| See a group's views | Any member (non-members get GroupDetail / join flow) |
| See a space row in menu / More Spaces | §4.14 visibility rules |
| Enter a space's content | Space members only (others get SpaceJoinPage) |
| Create/edit/delete/reorder views, set home, hide spaces | `Administration` on the group/space (space scope via parent roles) |
| Create/update/archive/delete/convert spaces | `Administration` on the parent (no space membership needed) |
| Curate collection posts / reorder | `Administration` or `Manage Content` |
| Edit `space-collection` spaceIds | `Administration` or `Manage Content` (Manage Content: spaceIds only) |
| Pin posts to a view | `Manage Content` (max 3) |
| Join any space bypassing gates | `Administration` on parent |
| Approve space join requests | `Add Members` on the space (inherited) |
| Create topics / subscribe | Active member of the group |

---

## 7. API

Queries: `group(slug){ groupViews(id, menuOnly){items{…GroupView}} spaces{items} parentGroup homeRoute menuViewCount moreSpacesCount acceptedPostTypes posts(...) viewPosts(...) }`; root `posts(context, …)`; `GroupView{ id group name type order icon pageContent link topics settings collectionPosts pinnedPostIds pinnedPosts linkedGroup viewPost viewUser newPostCount lastReadPostId }`.

Posts args (Group.posts / viewPosts / root posts): `activePostsOnly, afterTime, beforeTime, boundingBox:[PointInput], collectionToFilterOut, cursor, filter, first, forCollection, groupSlugs, isFulfilled, offset, order, savedBy, search, sortBy, topic, topics, types, rsvpResponse`; root adds `announcementsOnly, context, createdBy, interactedWithBy, mentionsOf`; Group.posts adds `isAnnouncement`. Returns `PostQuerySet{hasMore total items}`.

Mutations (signatures in schema): `createGroupView, updateGroupView, deleteGroupView, reorderGroupView, setGroupViewHidden, setHomeView, createSpace, updateSpace, archiveSpace, deleteSpace, convertSpaceToChildGroup, convertGroupToSpace, convertChatSpaceToDiscussion → {dryRun queued messageCount authorCount attachmentCount reactionCount replyCount firstMessageAt lastMessageAt post}, joinSpace, updateGroupViewUser, markViewAsRead, markGroupAsRead, updateViewSettings, addPostToView, removePostFromView, reorderViewPost, pinPost(postId, viewId), createTopic, subscribe(groupId, topicId, isSubscribing), pinGroup/unpinGroup` (global nav, [06](06-app-shell-navigation.md)).

---

## 8. Edge cases & known quirks

- `settings.defaultViewMode` on built-in typed views is documented in the internal spec as overriding `COMMON_VIEWS`, but `ViewContent` only reads it for custom/collection views. For built-ins, `COMMON_VIEWS.defaultViewMode` always wins over the user's `streamViewMode` (so changing mode on Discussions without `?v` reverts to List next visit, while the user setting is still written).
- `?s=order` outside a collection silently becomes `updated`.
- The Calendar view-mode button is hidden only on Discussions; it is available on All Activity (then fetches events only).
- Custom view `activePostsOnly` and `defaultSort` have no UI; new views always store `false`/`created`.
- A custom view whose `defaultViewMode` is `map` (legacy) redirects to the group's `/map` (losing the custom filters).
- Server does not enforce singleton common views; duplicates can be created via the API.
- `createGroupView` does not validate that `space`/`group` rows point at valid targets; deleting a target cascades the row.
- Draft/archived spaces lose their parent menu row entirely (it is destroyed, not hidden); publishing a draft via `updateSpace(status:'published')` does **not** recreate it — the space is added back via More Spaces "Add to Menu" (`createGroupView(type:'space')`/`setGroupViewHidden`).
- Chat Space kind seeds `accepted_post_types = []` (not `['chat']`), so the "Convert chat room" option (which requires exactly `['chat']`) appears only for migrated chat rooms or spaces explicitly set to `['chat']`.
- `TYPED_BADGE_VIEW_TYPES` is a Set on web, an array in `@hylo/shared`.
- `GroupViewUser.settings` (per-view notification prefs) is written but never read.
- Hidden ids in a space-collection keep their positions when a viewer who can't see them reorders.
- Mobile UA page size 10 vs desktop 20.

## 9. Docs vs. code

- Public docs (Navigating Groups / group menu deep-dive) describe "widgets", "All Views", "Tracks"/"Funding Rounds" menu pages, a separate "Moderation" and "About" view, "All Topics", and hide/show of any menu item. **Code:** widgets were replaced by `group_views`; only spaces can be hidden (others are deleted); All Views/Tracks/Funding Rounds/All Topics redirect to More Spaces; About/Moderation/Related Groups are About-page tabs.
- Docs describe chat rooms as `#topic` rooms within a group; **code:** chat rooms are spaces (one chat view per space plus the group's own `chat` view); `#general` was removed.
- Internal engineering spec (`docs/spaces-and-views-engineering-spec.md`) conflicts with code: (a) it says `archiveSpace` soft-deactivates (`active=false`) — code sets `status='archived'` and keeps `active=true`; `deleteSpace` sets `active=false`. (b) It says non-members can reach `about/*` under a space — code routes all non-member paths to `SpaceJoinPage` (except `requests` for managers). (c) It lists More Spaces sections as Tracks / Funding Rounds / Other (archived merged) — code has Other, Tracks, Funding Rounds, Drafts, Archived. (d) It omits `page` views, `status`/drafts, `autoAddMembers`, `convertSpaceToChildGroup`, `convertGroupToSpace`, `convertChatSpaceToDiscussion`, `menu_view_count`/`more_spaces_count`. (e) Access "Open"/"Request" are Public visibility, "Paid" is Protected (matches code).
- Docs say stream view preferences are per-view; code stores them globally per user (`users.settings.stream*`).

## 10. Source references

- Backend: `apps/backend/api/models/{GroupView,GroupViewUser,GroupViewPin,CollectionPost,Group,Tag,TagFollow}.js`, `api/models/space/convertChatSpaceToDiscussion.js`, `api/graphql/mutations/{group_views,spaces,topic,post(pinPost),notifyGroupUpdated}.js`, `api/graphql/makeModels.js` (Group.viewPosts/groupViews, Post.fetchMany), `api/graphql/filters.js`, `api/services/Search/{util,forPosts}.js`, `api/graphql/schema.graphql`.
- Packages: `packages/presenters/src/GroupViewPresenter.js`, `packages/shared/src/viewHelpers.js`, `packages/navigation/src/index.js`.
- Web: `routes/ViewContent/{ViewContent.js,PostPrompt.jsx,viewStreamFilters.js}`, `components/StreamViewControls`, `components/NoPosts`, `components/MasonryGrid`, `components/CustomViewForm/*`, `components/HomeViewPicker`, `components/IncludedViewsEditor`, `components/SpaceGlobalNavPinButton.jsx`, `components/CollectionDragHandle.jsx`, `routes/{SpaceContent,SpaceJoinPage,SpaceAboutModal,SpaceCollection,MySpaceCollection,GroupPageView,AllTopics}`, `routes/AuthLayoutRouter/components/ContextMenu/{Add*Dialog,AddViewOrSpaceMenu,GroupViewSettingsModal,GroupViewEditList,useViewReorder,SpaceSettingsModal,ConvertChatSpaceModal,MoreSpacesPage,SortableViewsGrid,spaceFormConstants,SpaceSlugField}.jsx`, `store/models/{GroupView,Group}.js`, `store/selectors/getMoreSpacesSections.js`, `util/{spaceVisibility,spaceCollection,constants}.js`, `store/actions/fetchPosts.js`, `graphql/fragments/{groupViewPostsQueryFragment,postsQueryFragment}.js`, `tours/streamTour.js`.
- Tests: `apps/web/e2e/{space-*,stream-*,dashboard-cards,menu-edit-drag,verify-menu-changes,pin-space-global-nav,convert-chat-room,authenticated.group-workspace,space-collection}.spec.js`, `apps/backend/api/graphql/mutations/spaces.test.js`, `test/unit/models/GroupViewUser.test.js`, `test/unit/models/space/`.
- Internal doc: `docs/spaces-and-views-engineering-spec.md`.
