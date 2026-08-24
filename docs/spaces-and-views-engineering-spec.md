# Spaces & Views — Engineering Spec

_Product spec: [Google Doc](https://docs.google.com/document/d/1Oct_l40Jj64dYl5DZcX13lIKDcNvStiKopVAMuWeGwg/edit)_

> **How to read this document.** Sections 1–13 describe the system **as it is actually built**. Where the code and an earlier version of this spec disagreed, the code won and this document was updated to match. Section 5 (Data Migration) is kept in full as the record of a migration that has already shipped. Section 14 is the single place where status, in-flight work, and remaining cleanup are tracked.
>
> Last reconciled against the `spaces-and-views` branch.

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Database](#2-database)
3. [Backend Models](#3-backend-models)
4. [GraphQL Schema](#4-graphql-schema)
5. [Data Migration (shipped)](#5-data-migration-shipped)
6. [Routing](#6-routing)
7. [Frontend Components](#7-frontend-components)
8. [Notifications & Unread Tracking](#8-notifications--unread-tracking)
9. [Search](#9-search)
10. [Group & Space Creation](#10-group--space-creation)
11. [More Spaces](#11-more-spaces)
12. [Steward Onboarding Prompt](#12-steward-onboarding-prompt)
13. [Out of Scope / Future Work](#13-out-of-scope--future-work)
14. [Status & Remaining Work](#14-status--remaining-work)

---

## 1. Core Concepts

| Concept | Definition |
|---------|------------|
| **Group** | Unchanged top-level concept. Top-level groups have `parent_id = null`. Spaces have `parent_id` pointing to their parent group. |
| **Space** | A container for content inside a group. Every group has one implicit **Main Space** (views whose `group_id` = the group's own id). Additional spaces are child groups with `type = 'space'`. Spaces link to their parent via the `parent_id` column on `groups` — **not** via `group_relationships`. |
| **Main Space** | Not a separate DB row in `groups`. The `group_views` rows where `group_id = group.id` are the group's Main Space views. |
| **View** | A filter on the content of a group or space. A named entry in the menu that opens a specific UI. Defined by a row in `group_views`. `order = 0` is the home view. |
| **Views are binary** | A view is **in the menu (`order` is an integer) or deleted**. There is no off-menu or archived state for views. `order = null` is reserved exclusively for `type = 'space'` rows, which is how a space lives in More Spaces instead of the menu. Enforced by `GroupView.SOFT_REMOVE_TYPES = ['space']` and by the `20260817140000_drop_off_menu_views` migration, which deleted every non-space row with `order IS NULL`. |
| **View Mode** | A UI variant for displaying posts in a view (cards, list, grid, bigGrid, calendar, map). Each view type has a default; a view can override it via `group_views.settings.defaultViewMode`. The user's last-used mode is stored on `users.settings.streamViewMode` (global, not per view). |
| **More Spaces** | Replaces the old All Views / Tracks / Funding Rounds pages. A card grid of **spaces only** that are not in the menu: track spaces, funding round spaces (including drafts), other spaces, and archived spaces. Route `/groups/:slug/more-spaces`. See §11. |
| **About page** | Absorbs what used to be separate `about`, `moderation`, and `related-groups` views, plus Members and notification settings, as tabs at `/about/:tab`. Those three view types no longer exist. See §7.11. |
| **Menu layout** | A group's menu renders either as a **two-column** sidebar (`ContextMenu`) or a **one-column** card grid (`ContextMenuGrid`). Group sets a default via `groups.settings.layout`; the user can override globally via `users.settings.groupNavStyle`. See §7.4. |

---

## 2. Database

Shipped in `20260702190000_spaces_and_views_schema.js` unless noted otherwise.

### 2.1 `groups` table — new columns

```sql
ALTER TABLE groups
  ADD COLUMN parent_id bigint REFERENCES groups(id) ON DELETE CASCADE,
  ADD COLUMN accepted_post_types jsonb,
  ADD COLUMN required_roles jsonb,
  ADD COLUMN icon varchar,
  ADD COLUMN track_id bigint REFERENCES tracks(id) ON DELETE SET NULL,
  ADD COLUMN funding_round_id bigint REFERENCES funding_rounds(id) ON DELETE SET NULL;

CREATE INDEX idx_groups_parent_id ON groups(parent_id);
CREATE INDEX idx_groups_parent_id_type ON groups(parent_id, type);
CREATE INDEX idx_groups_track_id ON groups(track_id);
CREATE INDEX idx_groups_funding_round_id ON groups(funding_round_id);
```

All new FKs are declared `DEFERRABLE INITIALLY DEFERRED`, matching the convention used by every other FK in this codebase, so multi-step operations inside one transaction (the data migration, bulk reorders) aren't blocked by mid-transaction FK checks.

| Column | Purpose |
|--------|---------|
| `parent_id` | Null for top-level groups. Set to parent group id for all spaces. Cascade-deletes spaces when parent is deleted. Also the basis for role inheritance — see `Group.roleScopeId`. |
| `accepted_post_types` | JSON array of accepted post type strings. `null` = all types accepted. `[]` = accepts none. Migration left this `null` for all existing groups; stewards narrow later. |
| `required_roles` | JSON array of `group_roles` ids. If set, the space is only visible/joinable by members holding one of those roles in the parent group. |
| `icon` | Lucide icon name for menu and card display. Used by both groups and spaces. |
| `track_id` | If set, this group is a Track/Course space. References `tracks`. |
| `funding_round_id` | If set, this group is a Funding Round space. References `funding_rounds`. |

`type` column already existed on `groups`; `'space'` is a valid value.

`home_route` stays — used for a fast redirect to the home view without loading `group_views`. Populated by `GroupView.computeHomeRoutePath()` (which delegates to `homeRoutePathForView()` in `@hylo/navigation`).

**Other `groups` columns added alongside this work:**

| Column | Migration | Purpose |
|--------|-----------|---------|
| `num_open_join_requests` | `20260813120000_add_num_open_join_requests.js` | Cached pending join request count. Drives the Join Requests menu entry and its badge (§7.5). Maintained atomically by `Group.adjustOpenJoinRequestCount()` from `JoinRequest` create/accept/decline/cancel, and broadcast over sockets by `Group.broadcastOpenJoinRequestCount()`. |
| `settings.layout` | none (jsonb key) | `'two-column'` (default for new groups) or `'one-column'`. See §7.4. |
| `settings.showPostNoticesInChat` | none (jsonb key) | Whether the chat view shows inline notices for non-chat posts. Defaults to `true` when unset. Affects chat UI only, **not** unread counting (§8). |

**`posts` columns added alongside this work:**

| Column | Migration | Purpose |
|--------|-----------|---------|
| `notice_data` | `20260813130000_add_notice_data_to_posts.js` (+ backfill `20260813140000`) | jsonb payload for synthetic `chat_activity` notice posts — one per group/space per UTC hour — that surface chat activity as cards in All Activity. Written by `api/models/post/upsertChatActivityNotice.js`. Indexed on `notice_data->>'bucketKey'`. |

---

### 2.2 `tracks` table

A track is now a space. Track-specific fields stay on the `tracks` table; everything displayable moved to the space group. Tracks get a special view type `track-actions` that lists the track's action posts.

**Shipped:**

```sql
-- FK pointing to the space created for this track
ALTER TABLE tracks ADD COLUMN group_id bigint REFERENCES groups(id) ON DELETE SET NULL;
CREATE INDEX idx_tracks_group_id ON tracks(group_id);
```

**Shipped:** `20260820120000_drop_track_round_display_columns.js`:

```sql
ALTER TABLE tracks
  DROP COLUMN name,
  DROP COLUMN description,
  DROP COLUMN banner_url,
  DROP COLUMN welcome_message;
```

**What moved to the space group (`groups` table):**
- `name` → `groups.name`
- `description` → `groups.description`
- `banner_url` → `groups.banner_url`
- `welcome_message` → the space's `welcome` view `page_content`
- `access_controlled` → `groups.paywall` on the space (shipped, `20260728120000_paid_spaces_from_tracks.js`)

**Columns intentionally kept on `tracks`:** `deactivated_at` and `access_controlled` are **not** dropped by the cleanup migration, unlike an earlier version of this spec. `deactivated_at` is still read by `Track.enroll` and draft/archived state logic; `access_controlled` is zeroed by the paid-spaces migration but the column remains. `groups_tracks` rows were cleared but the table is not dropped either. See §14 cleanup.

**Remaining track-specific columns:** `group_id` (→ space), `completion_message`, `published_at`, `completion_role_id`, `action_descriptor`, `action_descriptor_plural`, `num_actions`, `num_people_enrolled`, `num_people_completed`, `settings`.

---

### 2.3 `funding_rounds` table

A funding round is now a space. `funding_rounds.group_id` was **repointed from the parent group to the round's space** during migration. Rounds get a special view type `funding-round-submissions`.

**Shipped:** `20260820120000_drop_track_round_display_columns.js`:

```sql
ALTER TABLE funding_rounds
  DROP COLUMN title,
  DROP COLUMN banner_url,
  DROP COLUMN description;
```

**What moved to the space group:**
- `title` → `groups.name`
- `banner_url` → `groups.banner_url` (the column is `banner_url`, not `banner`)
- `description` → `groups.description`

`deactivated_at` is **kept** — still used by `FundingRound.find` and phase transitions.

**Remaining round-specific columns:** `group_id` (→ space), `criteria`, `phase`, `voting_method`, `token_type`, `total_tokens`, `min_token_allocation`, `max_token_allocation`, `require_budget`, `allow_self_voting`, `hide_final_results_from_participants`, `published_at`, the phase date columns (`submissions_open_at`, `submissions_close_at`, `voting_opens_at`, `voting_closes_at`), `submitter_roles`, `voter_roles`, `submission_descriptor(_plural)`, `num_submissions`, `num_participants`, `deactivated_at`.

---

### 2.4 Roles & Responsibilities

**Space management is gated by the existing `Administration` responsibility.**

A `Manage Spaces` system responsibility was added in `20260702190100_add_manage_spaces_responsibility.js` and then **removed** in `20260810170000_remove_manage_spaces_responsibility.js`, which folded it back into `Administration`: any role holding `Manage Spaces` was granted `Administration`, the `Administration` description was updated to mention managing the menu and spaces, and the responsibility row was deleted. Creating, editing, archiving, and deleting spaces, and editing the menu, all check `Administration` (surfaced in the web app as `canAdminister`).

Responsibilities are looked up by **`title` AND `type = 'system'`** — never by hardcoded id — because ids differ across databases and group-custom responsibilities can reuse the same title.

**Role inheritance in spaces:**

Spaces **inherit roles from the parent group at lookup time**. They do not store their own `groups_roles` or `group_memberships_group_roles` rows. Effective permissions in a space = space membership ∩ parent-group role responsibilities, resolved through `Group.roleScopeId(groupOrId)`, which returns `parent_id || id`. Roles are not customizable per space.

Admin-only chat rooms migrated to spaces got `required_roles = [<coordinator role id>]`.

---

### 2.5 `group_views` table

```sql
CREATE TABLE group_views (
  id               bigserial PRIMARY KEY,
  group_id         bigint NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name             varchar,
  type             varchar NOT NULL,
  "order"          int,
  icon             varchar,
  page_content     text,
  link             text,
  post_id          bigint REFERENCES posts(id) ON DELETE CASCADE,
  user_id          bigint REFERENCES users(id) ON DELETE CASCADE,
  linked_group_id  bigint REFERENCES groups(id) ON DELETE CASCADE,
  topics           jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings         jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_views_group_order ON group_views(group_id, "order");
```

**`order` semantics:**
- `0` = home view (first to open when clicking the group/space)
- `1`, `2`, … = ascending menu position
- `null` = **only valid for `type = 'space'`** — the space lives in More Spaces instead of the menu. Any other type with `order = null` is a bug; the `20260817140000_drop_off_menu_views` migration deleted all such rows.

`GroupView.findForGroup()` filters `whereNotNull('order')`, so off-menu space rows never appear in the ordered menu list.

**`topics` column:** jsonb array of topic name strings e.g. `["permaculture", "water"]`. Used by `type = 'custom'` views for topic filtering. Migrated from the `custom_view_topics` join table (tag names looked up by id at migration time).

**View types** — the full set, from `GroupView.Type`:

| `type` | `name` | `icon` | `topics` | `settings` | `link` | `page_content` | `post_id` | `user_id` | `linked_group_id` |
|--------|--------|--------|---------|-----------|--------|--------------|---------|---------|--------------|
| `all` | null | optional | — | `{defaultViewMode}` | — | — | — | — | — |
| `chat` | null | optional | — | — | — | — | — | — | — |
| `discussions` | null | optional | — | `{defaultViewMode}` | — | — | — | — | — |
| `events` | null | optional | — | `{defaultViewMode}` | — | — | — | — | — |
| `requests-and-offers` | null | optional | — | `{defaultViewMode}` | — | — | — | — | — |
| `resources` | null | optional | — | `{defaultViewMode}` | — | — | — | — | — |
| `proposals` | null | optional | — | `{defaultViewMode}` | — | — | — | — | — |
| `projects` | null | optional | — | `{defaultViewMode}` | — | — | — | — | — |
| `map` | null | optional | — | — | — | — | — | — | — |
| `members` | null | optional | — | — | — | — | — | — | — |
| `track-actions` | null | optional | — | — | — | — | — | — | — |
| `funding-round-submissions` | null | optional | — | — | — | — | — | — | — |
| `welcome` | null | optional | — | — | — | ✓ | — | — | — |
| `custom` | **required** | optional | optional | `{postTypes, activePostsOnly, defaultSort, defaultViewMode, searchText}` | — | — | — | — | — |
| `collection` | **required** | optional | — | — | — | — | — | — | — |
| `space-collection` | **required** | optional | — | `{spaceIds: [...]}` | — | — | — | — | — |
| `link` | **required** | optional | — | — | ✓ | — | — | — | — |
| `post` | optional | optional | — | — | — | — | ✓ | — | — |
| `member` | optional | optional | — | — | — | — | — | ✓ | — |
| `space` | optional override | optional override | — | — | — | — | — | — | ✓ |
| `group` | optional | optional | — | — | — | — | — | — | ✓ |
| `text` | **required** | optional | — | — | — | — | — | — | — |
| `separator` | — | — | — | — | — | — | — | — | — |

**`space-collection`** is a steward-curated, ordered list of spaces, stored as `settings.spaceIds` (an array of space group ids, order-significant). It replaces the old `tracks` and `funding-rounds` widget views: the data migration converts each of those widgets into a `space-collection` view carrying `migratedFrom`, then backfills `spaceIds` with that group's track or round spaces once the spaces exist. Unlike `collection` (which holds posts via `collections_posts`), a space-collection stores its membership inline in `settings`. Route: `/space-collection/:viewId`.

**Types that no longer exist:** `about`, `moderation`, `related-groups`. These are tabs on the About page (§7.11); the `20260817140000_drop_off_menu_views` migration deleted every row of those types. `all-topics` was never migrated.

`GroupView.NON_NAVIGABLE_TYPES = ['link', 'text', 'separator', 'space']` — these don't resolve to their own route.

**`type = 'space'` entries — how space menu entries work:**

Every child space has a `group_views` row in the **parent group** with `type = 'space'` and `linked_group_id = space.id`. This gives spaces a position in the single ordered list that drives the menu, interleaved with regular views.

- `name` and `icon` on the row are display overrides. If null, the menu uses `linked_group.name` and `linked_group.icon` / `avatar_url`.
- **Removing from menu:** `setGroupViewHidden` sets `order = null`, which moves the space to More Spaces. The row is kept.
- **Deletion:** when a space group is deleted, the row cascade-deletes via the `linked_group_id` FK.
- **No `group_views_users` rows** are created for `type = 'space'` entries — a space's unread dot comes from its `group_memberships.new_post_count`, same as a group.
- `type = 'group'` (distinct from `type = 'space'`) points at other groups that are not spaces.

All views within a group or space are visible to all members of it. Role-gating happens at the space level via `groups.required_roles`, not per-view.

---

### 2.6 `group_views_users` table

```sql
CREATE TABLE group_views_users (
  id                bigserial PRIMARY KEY,
  view_id           bigint NOT NULL REFERENCES group_views(id) ON DELETE CASCADE,
  user_id           bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_post_count    int NOT NULL DEFAULT 0,
  last_read_post_id bigint REFERENCES posts(id) ON DELETE SET NULL,
  settings          jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(view_id, user_id)
);

CREATE INDEX idx_gvu_view_id ON group_views_users(view_id);
CREATE INDEX idx_gvu_user_id ON group_views_users(user_id);
```

Rows are created lazily by `GroupViewUser.findOrCreate(viewId, userId)` — on join, on first unread increment, and by the migration backfill.

`settings` is jsonb with the same shape as `group_memberships.settings`. It is **written** by the `updateViewSettings` mutation but nothing currently reads it for notification decisions — see §8.

---

### 2.7 `collections_posts.view_id` — collection and track-action ordering

Rather than creating a new `collection_posts` table, the existing `collections_posts` table was extended with a nullable `view_id`:

```sql
ALTER TABLE collections_posts
  ADD COLUMN view_id bigint REFERENCES group_views(id) ON DELETE CASCADE;
ALTER TABLE collections_posts ALTER COLUMN collection_id DROP NOT NULL;

CREATE INDEX idx_collections_posts_view_id ON collections_posts(view_id);
CREATE UNIQUE INDEX idx_collections_posts_view_post
  ON collections_posts(view_id, post_id) WHERE view_id IS NOT NULL;
```

Used for two view types:
- `type = 'collection'` — steward-curated post lists (replaces `posts_collections`)
- `type = 'track-actions'` — ordered action posts in a Track space (replaces `tracks_posts` ordering)

Two models sit on this one table: `CollectionPost` (new, `view_id`-based) and `CollectionsPost` (legacy, `collection_id`-based). Retiring `collection_id` is §14 cleanup.

---

### 2.8 Tables whose data has been migrated (not yet dropped)

Data has moved; **all of these tables still exist in the database.** Dropping them is §14 cleanup.

| Table | What replaces it | Drop shipped? |
|-------|-----------------|---------------|
| `context_widgets` | `group_views` | No — code still reads/writes it |
| `custom_views` | `group_views.settings` + `group_views.topics` | No |
| `custom_view_topics` | Topic names as jsonb in `group_views.topics` | No |
| `collections` | `collections_posts.view_id` → `group_views` | No |
| `funding_rounds_posts` | `groups_posts` on the funding round space | No — in `in-progress/` |
| `funding_rounds_users` | `group_memberships`; `tokens_remaining` → `settings.tokensRemaining` | No — in `in-progress/` |
| `tracks_posts` | `collections_posts` with `view_id` = the `track-actions` view | No — in `in-progress/` |
| `tracks_users` | `group_memberships`; `enrolled_at` → `settings.enrolledAt`, `completed_at` → `settings.completedAt` | No — in `in-progress/` |
| `groups_tracks` | `tracks.group_id` (1:1 — each track has one space) | No — rows cleared, table remains |

---

### 2.9 Tables kept as-is

| Table | Notes |
|-------|-------|
| `tag_follows` | Kept for chat notification preferences only — unread is not tracked here |
| `tags` / `group_tags` | Unchanged — topics remain for filtering/search |
| `group_relationships` | Unchanged — peer/affiliation relationships between groups. Spaces do **not** use this. |
| `widgets` / `group_widgets` | Unchanged — legacy explore/landing page |

### 2.10 `group_view_pins` — per-view pinned posts

```sql
CREATE TABLE group_view_pins (
  id         bigserial PRIMARY KEY,
  view_id    bigint NOT NULL REFERENCES group_views(id) ON DELETE CASCADE,
  post_id    bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  pinned_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (view_id, post_id)
);
```

Replaces `groups_posts.pinned_at` (dropped). Max **3 pins per view**. The post must have a `groups_posts` row for the view's own group (no pinning child-space posts onto a parent view). Mutation: `pinPost(postId, viewId)` (toggles). Display: `GroupView.pinnedPosts` (separate query). Stream/grid/list show full cards at the top (omitted from the rest of the feed). Chat and calendar use a chips row; calendar events also stay in their natural calendar positions. Pinnable types: `all`, typed post views, `chat`, `custom`, `collection`.

---

## 3. Backend Models

### 3.1 `GroupView`

`apps/backend/api/models/GroupView.js`

Associations:
```javascript
group()           → belongsTo(Group, 'group_id')
linkedGroup()     → belongsTo(Group, 'linked_group_id')
viewPost()        → belongsTo(Post, 'post_id')
viewUser()        → belongsTo(User, 'user_id')
collectionPosts() → hasMany(CollectionPost, 'view_id').orderBy('order', 'asc')
pins()            → hasMany(GroupViewPin, 'view_id').orderBy('pinned_at', 'desc')
viewsUsers()      → hasMany(GroupViewUser, 'view_id')
```

`topics` is a plain jsonb array of strings on the model, not a relationship.

Constants:
- `GroupView.Type` — the enum of all view type strings (§2.5)
- `GroupView.SOFT_REMOVE_TYPES = ['space']` — the only types allowed off-menu
- `GroupView.NON_NAVIGABLE_TYPES = ['link', 'text', 'separator', 'space']`

Static methods:
- `findForGroup(groupId, options)` — ordered menu views only; filters `whereNotNull('order')`, orders by `order` ascending
- `findHomeView(groupId)` — view with `order = 0`
- `appendToMenu(attrs, { transacting })` — inserts at `max(order) + 1`
- `createOffMenu(attrs, { transacting })` — inserts with `order = null`; only used for space rows destined for More Spaces
- `computeHomeRoutePath(view, group)` — delegates to `homeRoutePathForView(view)` from `@hylo/navigation`; result is stored on `groups.home_route`
- `reorder({ id, addToEnd, orderInFrontOfViewId, trx })` — repositions within the flat list (no nesting)
- `setHomeView({ id, groupId, trx })` — moves the target to index 0, reflows everything else, and rewrites `groups.home_route`
- `applyOrder(newOrderedIds, { groupId, trx })` — single `UPDATE … CASE id` that persists `order` = array index for the whole list

Note that bigint primary keys come back from node-postgres as strings, so reorder/home-view logic normalises ids to `Number` before comparing.

---

### 3.2 `GroupViewUser`

`apps/backend/api/models/GroupViewUser.js`

```javascript
view() → belongsTo(GroupView, 'view_id')
user() → belongsTo(User, 'user_id')
```

Statics:
- `findOrCreate(viewId, userId)`
- `markRead(viewId, userId)` — zeroes `new_post_count`, advances `last_read_post_id` to the newest post in the view's group
- `markAuthorRead(viewId, userId, postId)` — so authors never see their own post as unread
- `incrementNewPostCount(viewId, userIds)` — bulk `+1`, creating missing rows first
- `decrementNewPostCount(viewId, { beforePostId })` — used on post delete; only decrements rows that hadn't read past the post
- `sendDigests()` — the **hourly chat digest email**, run from `cron.js`. See §8.

---

### 3.3 `CollectionPost`

`apps/backend/api/models/CollectionPost.js`, on the `collections_posts` table via `view_id`.

```javascript
view() → belongsTo(GroupView, 'view_id')
post() → belongsTo(Post, 'post_id')
```

Statics: `create(attrs)`, `find(viewId, postId)`. Used for both `collection` views and `track-actions` ordering.

The legacy `CollectionsPost.js` model still sits on the same table keyed by `collection_id` — see §14 cleanup.

---

### 3.4 `Group` model

`apps/backend/api/models/Group.js`

Associations:
```javascript
groupViews()   → hasMany(GroupView, 'group_id').orderBy('order')
spaces()       → hasMany(Group, 'parent_id').query(q => q.where('type', 'space'))
parentGroup()  → belongsTo(Group, 'parent_id')
track()        → belongsTo(Track, 'track_id')
fundingRound() → belongsTo(FundingRound, 'funding_round_id')
```

`spaces()` includes archived spaces — filter on `active` where needed.

Statics and instance methods:
- `Group.setupSpaceViews(spaceId, acceptedPostTypes, viewTypes, { transacting })` — seeds `group_views` rows for a new group or space from an explicit list of view types. Idempotent.
- `Group.destroySpace(id, { transacting })` — full space teardown, including clearing legacy `groups_tracks` rows.
- `Group.roleScopeId(groupOrId)` — returns `parent_id || id`; the single point through which spaces inherit parent-group roles.
- `Group.adjustOpenJoinRequestCount(groupId, delta, transacting)` / `Group.broadcastOpenJoinRequestCount(groupId)` — maintain and push `num_open_join_requests`.
- `group.openJoinRequestCount()` — reads the cached column.

**Still present, pending cleanup:**
- `group.setupContextWidgets(trx)` — **still called from `Group.create()`**, alongside `Group.setupSpaceViews()` when the creator passed `view_types`. New groups therefore get both ContextWidget rows and GroupView rows. There is no `setupGroupViews()`; an earlier version of this spec named a method that was never written.
- `doesMenuUpdate()` is gone. Menu-change notification is now `notifyGroupUpdated(context, group, groupId)` in `api/graphql/mutations/notifyGroupUpdated.js`, which pushes a `groupUpdated` socket event to the group room.

---

### 3.5 Models to remove (not yet removed)

These are still present and still wired into GraphQL:

| Model | Replaced by | Notes |
|-------|-------------|-------|
| `ContextWidget.js` | `GroupView` | Still read/written; `highlightNumber()` already returns `0` since unread lives on GroupViews |
| `CustomView.js` | `group_views.settings` + `topics` | Model + GraphQL type/query remain |
| `CustomViewTopic.js` | `group_views.topics` | Only referenced from `CustomView.js` |
| `Collection.js` | `collections_posts.view_id` | Still used by `mutations/collection.js` and `ContentAccess` |
| `CollectionsPost.js` | `CollectionPost` | Same table, legacy `collection_id` key |

`PostCollection.js`, `FundingRoundUser.js`, and `TrackUser.js` are already gone — enrollment and participation now live on `group_memberships` of the track/round space.

---

### 3.6 `Track` model

`apps/backend/api/models/Track.js`

- `group()` → `belongsTo(Group, 'group_id')` — the track's space
- `space()` → inverse lookup via `Group.track_id`
- `enrolledUsers()` → `group_memberships` on the track space (replaces the old `users()` on `tracks_users`)
- `actionPosts()` / `addPost()` / `removePost()` → `CollectionPost` rows on the space's `track-actions` view (replaces `tracks_posts`)
- `enroll()` / `leave()` → space membership; `enrolledAt` / `completedAt` in `group_memberships.settings`. `leave()` only drops the space membership — `num_people_enrolled` and `completedAt` are settled by `Group.removeMembers` so that any departure path, including leaving the parent group, keeps the count honest (§3.9)
- `canAccess()` — still consults `access_controlled`; the paid-spaces migration zeroed the flag and set `groups.paywall` on the space instead, but the track code path has not been retired

`name`, `description`, `banner_url`, and `welcome_message` are **still columns on `tracks`** and still read in places such as `Track.duplicate` and `Track.create`. Display values should come from `track.group.*`. Dropping the columns is §14 cleanup.

---

### 3.7 `FundingRound` model

`apps/backend/api/models/FundingRound.js`

- `funding_rounds.group_id` now references the **space**, not the parent group. Code that needs the parent uses `space.parent_id`.
- `group()` → `belongsTo(Group, 'group_id')` — the round's space
- `users()` → `group_memberships` on the round space (replaces `funding_rounds_users`); `tokensRemaining` in `group_memberships.settings`
- `submissions()` → `groups_posts` on the space filtered to submission posts (replaces `funding_rounds_posts`)
- `join()` / `leave()` → space membership; as with tracks, `leave()` defers `num_participants` and `tokensRemaining` to `Group.removeMembers` (§3.9)
- `criteria`, phase dates, voting config, `submitter_roles`, `voter_roles`, and `deactivated_at` remain on the round

`title`, `banner_url`, and `description` are still columns; display values should come from `round.group.*`.

---

### 3.8 Queries that should exclude spaces

Because spaces are rows in `groups`, every query that lists groups will include them unless filtered. `me.memberships` and `Group.selectIdsForMember` stay inclusive — they power nav nesting, PostEditor, unread, and post visibility.

| Query / Context | Status |
|-----------------|--------|
| Group digest cron | **Done** — `lib/group/digest2/index.js` filters `type <> 'space'` |
| Group search by parent | **Done, inverted intentionally** — `services/Search.js` deliberately *includes* spaces via `parent_id` when `parentSlugs` is given, so a group search covers its spaces |
| Moderation search | **Done** — includes spaces via `parent_id` so space reports appear in the parent queue |
| `groupFilter` visibility | **Done, deliberately permissive** — join managers can see spaces of groups they manage |
| Global nav groups list | **Done in the frontend** — `getMyGroupsWithChildren` nests spaces under their parent; `me.memberships` still returns spaces |
| Related Groups view | **Done** — `childGroups` / `parentGroups` / `peerGroups` use `Group.excludeSpaces`; selectors also drop `isSpaceGroup` |
| Group explore / group-type search results | **Done** — `Search.forGroups` excludes spaces by default; skipped when `parentSlugs` is set or `groupType === 'space'` |
| "My Groups" | **Done in the frontend** — same selector as global nav. Do **not** filter `selectIdsForMember` (visibility) |
| Group invitations | **Done in the frontend** — My Invites splits group vs space invites/requests. Dedicated space-invite forms are still §7.14 |
| Profile memberships | **Done** — `Person.memberships` (not `Me.memberships`) uses `Group.excludeSpaces`; profile presenter also filters |
| Cross-group post "To" field | **Done in the frontend** — `PostEditor` nests spaces under their parent group |

---

### 3.9 Leaving a group or space — `Group.removeMembers`

There is no space-specific leave mutation. All teardown lives in `Group.removeMembers`, which is the single choke point every departure passes through: the `leaveGroup` mutation, moderator removal via `GroupService.removeMember`, `Track.leave` / `FundingRound.leave`, `Group.deactivate`, and the parent-group cascade inside `removeMembers` itself.

In order:

1. `settleParticipation(userIds)` — runs **first**, while the memberships are still active. For a track space it decrements `tracks.num_people_enrolled` and drops `completedAt` from each membership's settings; for a funding round space, `funding_rounds.num_participants` and `tokensRemaining`. Only currently active memberships count, so a repeated removal is a no-op. It must run before deactivation both for that count and because `updateMembers` rewrites settings.
2. `updateMembers(..., { active: false, nav_order: null })` — deactivates, unpins, and resets the join flow (`showJoinForm`, `joinQuestionsAnsweredAt`, `agreementsAcceptedAt`).
3. Deletes the departing users' `group_views_users` rows for this group's views. Required, not housekeeping: unread increments skip inactive members, so a leftover `new_post_count` freezes rather than drains, and `groupHasUnreadBadgeSignals` matches child-space view rows on `user_id` alone. A stale row would keep the **parent** group's badge lit forever, since `markGroupAsRead` requires membership and only walks the target group's own views.
4. Revokes roles and resets agreements — **only** when `roleScopeId === this.id`, so leaving a child space never strips parent-group roles (§3.4).
5. For non-space groups, cascades into child spaces by calling `space.removeMembers()`, which repeats all of the above per space.

Putting steps 1 and 3 here rather than in a mutation is what makes the cascade correct: leaving a parent group settles the track counters of every child track space it drops you from, and no caller can forget to do it.

---

## 4. GraphQL Schema

Schema: `apps/backend/api/graphql/schema.graphql`. Resolvers: `makeSchema.js` / `makeModels.js`. View and space mutations live in `mutations/group_views.js` and `mutations/spaces.js`.

### 4.1 Types

```graphql
type GroupView {
  id: ID
  group: Group
  name: String
  type: String
  order: Int
  icon: String
  pageContent: String
  link: String
  topics: [String]
  settings: JSON
  collectionPosts: [Post]
  linkedGroup: Group
  viewPost: Post
  viewUser: Person
  newPostCount: Int      # for the current user
  lastReadPostId: ID     # for the current user
}

type GroupViewUser {
  id: ID
  view: GroupView
  user: Person
  newPostCount: Int
  lastReadPostId: ID
  settings: JSON
}

type CollectionPost {
  id: ID
  view: GroupView
  post: Post
  order: Int
  createdAt: Date
}
```

`settings` fields are `JSON`, not stringified. `GroupView` exposes the current user's `newPostCount` / `lastReadPostId` directly so the menu doesn't need to query `GroupViewUser` separately. There is also a `GroupViewQuerySet` for paginated access.

### 4.2 `Group` type additions

```graphql
groupViews(id: ID, menuOnly: Boolean): GroupViewQuerySet  # menuOnly omits order-null (off-menu) views
spaces: [Group]               # all child spaces (including archived)
parentGroup: Group
parentId: ID
acceptedPostTypes: [String]
icon: String
homeRoute: String
openJoinRequestCount: Int     # reads groups.num_open_join_requests
track: Track
fundingRound: FundingRound
```

### 4.3 Legacy types (removed)

`ContextWidget`, `CustomView`, `Collection`, and `CollectionsPost` GraphQL types, plus `Group.contextWidgets` / `chatRooms` / `homeWidget` / `customViews`, were deleted. See §14.3.

### 4.4 Mutations

```graphql
# Views
createGroupView(groupId: ID!, type: String!, name: String, icon: String, settings: JSON,
                link: String, pageContent: String, topics: [String],
                orderInFrontOfViewId: ID, addToEnd: Boolean,
                linkedGroupId: ID, postId: ID, userId: ID,
                hidden: Boolean): GroupView            # hidden only valid for type = space
updateGroupView(id: ID!, name: String, icon: String, settings: JSON, link: String,
                pageContent: String, topics: [String],
                orderInFrontOfViewId: ID, addToEnd: Boolean): GroupView
deleteGroupView(id: ID!): GenericResult
reorderGroupView(id: ID!, orderInFrontOfViewId: ID, addToEnd: Boolean): GenericResult
setGroupViewHidden(id: ID!, hidden: Boolean!): GroupView   # order = null ⇄ in menu; spaces only
setHomeView(viewId: ID!, groupId: ID!): GenericResult

# Spaces
# createSpace also: (1) seeds the space's own group_views rows from viewTypes
#                   (2) creates a type='space' group_views row in the parent group
#                       (off-menu when addToMenu is false)
createSpace(parentGroupId: ID!, name: String!, slug: String, acceptedPostTypes: [String],
            visibility: Int, accessibility: Int, icon: String, description: String,
            requiredRoles: [Int], purpose: String, location: String, locationId: ID,
            viewTypes: [String], bannerUrl: String, avatarUrl: String,
            paywall: Boolean, addToMenu: Boolean): Group
updateSpace(id: ID!, name: String, slug: String, acceptedPostTypes: [String],
            visibility: Int, accessibility: Int, icon: String, description: String,
            requiredRoles: [Int], location: String, locationId: ID, purpose: String,
            bannerUrl: String, avatarUrl: String, paywall: Boolean): Group
archiveSpace(id: ID!): Group        # soft-deactivate; removes the parent menu entry
deleteSpace(id: ID!): GenericResult

# Space membership
joinSpace(spaceId: ID!): Membership
# Leaving is the generic leaveGroup(id: ID!): ID — spaces need no dedicated mutation,
# because all space-specific teardown lives in Group.removeMembers (see §3.9)

# Unread
markViewAsRead(viewId: ID!): GroupView
markGroupAsRead(groupId: ID!): Group                       # zeroes membership + every view
updateGroupViewUser(viewId: ID!, lastReadPostId: ID): GroupView   # chat scroll position
updateViewSettings(viewId: ID!, settings: JSON!): GroupViewUser   # written, never read — see §8

# Collection / track action management
addPostToView(viewId: ID!, postId: ID!, order: Int): CollectionPost
removePostFromView(viewId: ID!, postId: ID!): GenericResult
reorderViewPost(viewId: ID!, postId: ID!, order: Int!): GenericResult
```

### 4.5 Legacy mutations still in the schema

Pending cleanup (§14):
- `createContextWidget`, `updateContextWidget`, `deleteContextWidget`, `reorderContextWidget`, `removeWidgetFromMenu`, `setHomeWidget`
- `createCollection`, `addPostToCollection`, `removePostFromCollection`, `reorderPostInCollection`

---

## 5. Data Migration (shipped)

**This migration has run.** The steps below are kept in full as the record of what was done and how existing data was mapped; they are no longer instructions. Where a step describes something that was later reversed (notably off-menu views), §2 and §11 are authoritative.

**Shipped migrations, in order:**

| Migration | What it did |
|-----------|-------------|
| `20260702190000_spaces_and_views_schema.js` | Additive DDL only: new `groups` columns, `tracks.group_id`, `group_views`, `group_views_users`, `collections_posts.view_id` (§2) |
| `20260702190100_add_manage_spaces_responsibility.js` | Added the `Manage Spaces` system responsibility (later reversed) |
| `20260703000000_migrate_context_widgets_to_group_views.js` | The main data migration — Steps 2 through 11 below |
| `20260716160000_drop_groups_welcome_page.js` | Dropped the welcome page columns from `groups` after content moved onto `welcome` views |
| `20260723120000_recalculate_chat_new_post_counts.js` | Recomputed chat unread counts against the new per-view model |
| `20260723140000_ensure_more_views_system_views.js` | **Now a no-op stub.** Originally seeded off-menu `related-groups` / `moderation` / `welcome` rows |
| `20260723160000_ensure_common_off_menu_views.js` | **Now a no-op stub.** Originally seeded off-menu common view types |
| `20260728120000_paid_spaces_from_tracks.js` | `track.access_controlled` → space `groups.paywall`; reminted Stripe `access_grants.trackIds` → `groupIds`; reminted `content_access`; ensured space membership for existing purchasers |
| `20260806120000_backfill_group_member_counts.js` | Backfilled member counts (now includes spaces) |
| `20260810170000_remove_manage_spaces_responsibility.js` | Folded `Manage Spaces` into `Administration` and deleted it (§2.4) |
| `20260813120000_add_num_open_join_requests.js` | Added the cached join request count |
| `20260813130000_add_notice_data_to_posts.js` + `20260813140000_backfill_chat_activity_notices.js` | Chat activity notice posts (§8) |
| `20260817140000_drop_off_menu_views.js` | **Reversed the off-menu view model.** Deleted every `group_views` row with `order IS NULL` except `type = 'space'`, plus all `about` / `moderation` / `related-groups` rows. Irreversible by design. |

The two `20260723` "ensure off-menu views" migrations were reduced to no-ops rather than deleted, so that databases which already recorded those filenames (staging) don't attempt to run different code under the same name, and so production never inserts rows that `20260817140000` would immediately delete.

**Shipped:** `20260819130000_drop_legacy_track_round_join_tables.js` drops `tracks_posts`, `tracks_users`, `funding_rounds_posts`, `funding_rounds_users`. `20260820120000_drop_track_round_display_columns.js` drops the display columns that moved to the space group (`down` restores them from the space group). See §14.3.

---

### Step 1 — Add new columns and create tables

Run all DDL from Section 2. Do not drop old tables yet

### Step 1b — Migration defaults

Apply these defaults during migration for all existing groups and spaces:

1. **`accepted_post_types`:** leave `null` on all groups and spaces (all post types accepted). Do **not** restrict to only the post types that happen to have menu views. Stewards can narrow later in settings.
2. **Chat post notices:** set `groups.settings.showPostNoticesInChat = true` on all groups during migration. Chat views already support inline notices when other post types are created in the group/space (e.g. "Aaron posted a Discussion"). This helps groups that relied on `#general` as a catch-all feed. Can become a per-group/space setting later; ship enabled by default and gather feedback.
3. **Skip menu views that move to More Spaces:** do **not** migrate `all-topics`, or moderation widgets into `group_views` menu rows. moderation queue, and off-menu track/round spaces are surfaced via **More Spaces** instead. All Topics goes away
   _(Superseded: the moderation queue is now a tab on the About page, not a More Spaces entry — see §7.11. More Spaces holds spaces only.)_
4. **Track / funding round drafts:** unpublished or deactivated track/round spaces appear in More Spaces (not in the main menu).

### Step 2 — Migrate Main Space views (ContextWidgets with `order IS NOT NULL`)

**Skip all ContextWidgets where `order IS NULL`** — not in menu, do not become GroupViews.

For each remaining ContextWidget ordered by `order` ASC:

**System view widgets** (`widget.view` is set):

| `view` value | `group_views.type` |
|---|---|
| `stream` | `all` |
| `map` | `map` |
| `events` | `events` |
| `discussions` | `discussions` |
| `proposals` | `proposals` |
| `resources` | `resources` |
| `requests-and-offers` | `requests-and-offers` |
| `projects` | `projects` |
| `members` | `members` |
| `about` | `about` |
| `welcome` | `welcome` |
| `related-groups` | `related-groups` |
| `all-topics` | _skip — removed_ |
| `setup` | _skip_ |
| `tracks` | `space-collection` (`settings.migratedFrom = 'tracks'`) |
| `funding-rounds` | `space-collection` (`settings.migratedFrom = 'funding-rounds'`) |

`space-collection` rows are created with `spaceIds: []` and backfilled by `backfillSpaceCollections()` once the track/round spaces exist in Steps 6 and 7. That backfill is idempotent — it skips rows whose `spaceIds` is already non-empty.

_(Superseded: the `about` and `related-groups` rows created by this step were later deleted by `20260817140000_drop_off_menu_views.js`. Those view types no longer exist — they are About page tabs. See §7.11.)_

**Container widgets** (`type = 'container'`):
- Create `group_views` row with `type = 'text'`, `name = widget.title`.
- Container's child widgets become flat views positioned right after the text header in order.

**Home view determination:**
- The ContextWidget that is the home (its parent_id is the `home` type widget) → `order = 0`.
- All other views get `order = 1, 2, 3…` based on their current order.

### Step 4 — Migrate custom_view ContextWidgets (`custom_view_id IS NOT NULL`, `order IS NOT NULL`)

Get the linked `CustomView` row:

**If `custom_view.type = 'stream'` (or null):**
- Create `group_views` row: `type = 'custom'`, `name = custom_view.name`, `icon = custom_view.icon`.
- `settings = { postTypes: custom_view.post_types, activePostsOnly: custom_view.active_posts_only, defaultSort: custom_view.default_sort, defaultViewMode: custom_view.default_view_mode, searchText: custom_view.search_text }`.
- `topics`: look up tag names by id from `custom_view_topics` → `tags` → store as `["topic1", "topic2"]`.

**If `custom_view.type = 'externalLink'`:**
- Create `group_views` row: `type = 'link'`, `name = custom_view.name`, `icon = custom_view.icon`, `link = custom_view.external_link`.

**If `custom_view.type = 'collection'`:**
- Create `group_views` row: `type = 'collection'`, `name = custom_view.name`, `icon = custom_view.icon`.
- Migrate: for each `posts_collections` row for `custom_view.collection_id`, create a `collection_posts` row (`view_id = new_view.id`, `post_id`, `order`).

After all custom_views migrated: drop `custom_views`, `custom_view_topics`, `collections`, `posts_collections`.

### Step 5 — Migrate individual post/group/user widgets (`order IS NOT NULL`)

| ContextWidget field | `group_views.type` | FK column |
|---|---|---|
| `view_post_id` | `post` | `post_id` |
| `view_group_id` | `group` | `linked_group_id` |
| `view_user_id` | `member` | `user_id` |
| `view_track_id` | _handled in Step 6_ | — |
| `view_funding_round_id` | _handled in Step 7_ | — |

### Step 6 — Migrate Tracks to Track Spaces

For each Track, for each group it belongs to (via `groups_tracks`):

1. Create a new `groups` row:
   - `name = track.name`, `slug = parentSlug + '-' + slugify(track.name)` (ensure uniqueness)
   - `type = 'space'`, `parent_id = group.id`, `track_id = track.id`
   - `visibility = 2` (Protected), `accessibility = 1` (Open)
   - `description = track.description`, `banner_url = track.banner_url`
   - If `track.deactivated_at` is set: set `groups.active = false` (archives the space)
2. Set `tracks.group_id = new_space.id`

2. Create `group_views` rows for the new space:
   - `type = 'track-actions'`, `order = 0` _(non-deletable action list)_
   - `type = 'chat'`, `order = 1`
   - `type = 'members'`, `order = 2` _(renders enrolled_at / completed_at from group_memberships.settings per member)_
   - `type = 'welcome'`, `order = 3`, `page_content = tracks.welcome_message` _(home view — renders track banner + metadata above steward's page_content. `welcome_message` field on Track is moved over to the welcome page_content — stewards can write new content here after migration)_

3. **Migrate action ordering via `collection_posts`:** for each row in `tracks_posts` for this track (ordered by `sort_order`), create a `collection_posts` row: `view_id = track-actions-view.id`, `post_id`, `order = tracks_posts.sort_order`.

4. Add a `group_views` row in the **parent group's** menu: `type = 'space'`, `linked_group_id = new_space.id`, `order = widget.order` (if a ContextWidget with `view_track_id` existed, use its order, adjusted for the new group views to stay in the same order; otherwise it should be archived with groups.active = false).

5. **Migrate members via `tracks_users`:** for each `tracks_users` row:
   - Create `group_memberships`: `group_id = new_space.id`, `user_id`, default settings from parent group membership.
   - Set `group_memberships.settings.enrolledAt = tracks_users.enrolled_at`.
   - Set `group_memberships.settings.completedAt = tracks_users.completed_at` (if present).
   - Create `group_views_users` rows for each view in the space.

6. Drop `tracks_posts` and `tracks_users` after all tracks migrated.

7. **Paywall migration:** if `track.access_controlled = true`, set `group.paywall = true` on the new track space and preserve the existing Stripe product/price configuration (carry it forward to the space group's paywall config). Full paywall migration details deferred to Phase 4

**If the Track was the parent group's home view:** demote — set the next-ordered view to `order = 0`. Log group id for steward prompt.

### Step 7 — Migrate Funding Rounds to Funding Round Spaces

For each FundingRound (currently `funding_rounds.group_id` = parent group):

1. Create a new `groups` row:
   - `name = round.title` (or `name` — confirm column), `slug = parentSlug + '-' + slugify(round.title)` (ensure uniqueness)
   - `type = 'space'`, `parent_id = funding_round.group_id` (current parent), `funding_round_id = round.id`
   - `visibility = 2`, `accessibility = 1`
   - `description = round.description`, `banner_url = round.banner`
   - If `round.deactivated_at` is set: set `groups.active = false` (archives the space)

2. Create `group_views` rows for the new space:
   - `type = 'funding-round-submissions'`, `order = 0` _(non-deletable)_
   - `type = 'chat'`, `order = 2`
   - `type = 'members'`, `order = 3` _(renders submit/vote role badges per member from round's submitter_roles / voter_roles)_
   - `type = 'welcome'`, `order = 4`, `page_content = null` _(home — renders space description + round banner + criteria + phase/date info below the steward's page_content. Stewards can write their own page_content after migration)_

3. Update `funding_rounds.group_id = new_space.id`.

4. **Migrate posts via `funding_rounds_posts`:** for each row in `funding_rounds_posts`, create a `groups_posts` row: `group_id = new_space.id`, `post_id`. Drop `funding_rounds_posts` after.

5. **Migrate participants via `funding_rounds_users`:** for each row:
   - Create `group_memberships`: `group_id = new_space.id`, `user_id`.
   - Set `group_memberships.settings.tokensRemaining = funding_rounds_users.tokens_remaining`.
   - Create `group_views_users` rows for each view in the space.
   - Drop `funding_rounds_users` after all migrated.

6. Add a `group_views` row in the parent group's menu: `type = 'space'`, `linked_group_id = new_space.id`, `order = (ContextWidget with view_funding_round_id).order`, adjusted for the new group views to stay in the same order; otherwise it should be archived with groups.active = false.

**If the Funding Round was the parent group's home view:** same demotion logic as Step 6.

### Step 8 — Migrate non #general Chat Rooms to Chat Spaces

For each ContextWidget with `view_chat_id IS NOT NULL` and `order IS NOT NULL` that is not `#general` and not the home view of the parent group:

1. Get the linked `Tag` (chat topic). Note if `widget.visibility = 'admin'`.

2. Create a new `groups` row:
   - `name = tag.name`, `slug = parentSlug + '-' + tag.name` (ensure uniqueness)
   - `type = 'space'`, `parent_id = widget.group_id`
   - `accepted_post_types = ['chat']`
   - `visibility = 2` (Protected), `accessibility = 1` (Open)
   - If widget had `visibility = 'admin'`: set `required_roles = [1]` (Coordinator common role)

3. Create `group_views` row: `type = 'chat'`, `order = 0`.

4. Add a `group_views` row in the parent group's menu: `type = 'space'`, `linked_group_id = new_space.id`, `order = widget.order` adjusted for the new group views to stay in the same order.

5. **Migrate members** from `tag_follows` (`tag_id = tag.id, group_id = parent_group_id`, settings.notifications set to some value, otherwise ignore this tag_follows and dont migrate it):
   - Create `group_memberships`: `group_id = new_space.id`, `user_id`, copy settings from parent membership but set `postNotifications` from `tag_follow.settings`.
   - Create `group_views_users`: `view_id = chat_view.id`, `user_id`, `new_post_count` and `last_read_post_id` from tag_follow.

6. **Migrate posts:** chat posts in `groups_posts` for parent group that have this tag → reassociate with new space in `groups_posts`; remove parent group association.

### Step 8b — Backfill `group_views_users` for all existing members

Steps 6-8 above already create `group_views_users` rows for the members of newly-created Track/Round/Chat spaces. But **every other existing `group_views` row** created in Steps 2 and 4 (i.e. the Main Space views of every pre-existing top-level group) has no corresponding `group_views_users` rows yet — those are only ever created "when a user joins a space" (section 2.6) going forward, which doesn't help existing members of existing groups. Without this step, per-view unread counts (section 8) would be broken/empty for every current member of every current group until some other action happens to create the row.

For every `group_views` row (from Steps 2 and 4 — i.e. Main Space views), for every active `group_membership` in that view's `group_id`:
- Create a `group_views_users` row if one doesn't already exist for `(view_id, user_id)`.
- `new_post_count = 0`
- `last_read_post_id` = the most recent post id in that group at migration time — treats all pre-existing content as already read so existing members don't suddenly see unread badges for old posts after migration.

Idempotent — skip rows that already exist (enforced by the `(view_id, user_id)` unique constraint).

### Step 9 — Handle `#general` or other home chat rooms specifically

- Remove `#general` from all posts: delete rows from `posts_tags` where `tag_id = #general.id`.
- For groups where `#general` was the home: set `chat` view as the new home (`order = 0`). Log for steward prompt.
- For groups where a different #tag was the home view. Set 'chat' as the new home view (order = 0). Log for steward prompt.

### Step 10 — Update `groups.home_route`

For each group and space: `home_route = GroupView.computeHomeRoutePath(homeView, group)`.

- Top-level groups: `/all`, `/map`, etc. (existing path patterns)
- Spaces: `/groups/:parentSlug/spaces/:localSpaceSlug/[whatever the home view is]`

### Step 11 — Post-migration verification

- Every group/space has a `group_views` row with `order = 0`.
- Every space has `parent_id IS NOT NULL`.
- Every space has exactly one `type = 'space'` row in its parent group's `group_views` (the menu entry).
- Every track space has `track_id IS NOT NULL`.
- Every funding round space has `funding_round_id IS NOT NULL`.
- No top-level group has `type = 'space'`.
- `tracks_posts`, `tracks_users`, `funding_rounds_posts`, `funding_rounds_users` are empty (all rows migrated).
- Every active `group_membership` has a `group_views_users` row for every `group_views` row in that membership's `group_id` (see Step 8b).

---

## 6. Routing

Group routes are registered in `apps/web/src/routes/AuthLayoutRouter/AuthLayoutRouter.js`. Space routes are registered in `apps/web/src/routes/SpaceContent/SpaceContent.js`, mounted at `groups/:groupSlug/spaces/:spaceSlug/*`.

### 6.1 Group routes

| Route | Component |
|-------|-----------|
| `/groups/:groupSlug` | Catch-all: two-column → redirect to `homeRoute` (fallback `/all`); one-column → `ContextMenuGrid` |
| `/groups/:groupSlug/all` | `ViewContent` (view=all) |
| `/groups/:groupSlug/discussions` | `ViewContent` (view=discussions) |
| `/groups/:groupSlug/events` | `ViewContent` (view=events) |
| `/groups/:groupSlug/resources` | `ViewContent` (view=resources) |
| `/groups/:groupSlug/projects` | `ViewContent` (view=projects) |
| `/groups/:groupSlug/proposals` | `ViewContent` (view=proposals) |
| `/groups/:groupSlug/requests-and-offers` | `ViewContent` (view=requests-and-offers) |
| `/groups/:groupSlug/custom/:customViewId` | `ViewContent` (view=custom) |
| `/groups/:groupSlug/collection/:customViewId` | `ViewContent` (view=collection) |
| `/groups/:groupSlug/space-collection/:viewId` | `SpaceCollection` — curated space list |
| `/groups/:groupSlug/map` | `MapExplorer` |
| `/groups/:groupSlug/chat` | `ChatRoom` |
| `/groups/:groupSlug/welcome` | `GroupWelcomePage` |
| `/groups/:groupSlug/members` | `Members` |
| `/groups/:groupSlug/members/:personId` | `MemberProfile` |
| `/groups/:groupSlug/about/*` | `GroupAboutPage` — tabbed; see §7.11 |
| `/groups/:groupSlug/requests` | `MembershipRequestsTab` — standalone join request queue |
| `/groups/:groupSlug/more-spaces` | Two-column → `MoreSpacesPage`; one-column → `ContextMenuGrid`. See §11 |
| `/groups/:groupSlug/settings/*` | `GroupSettings` |
| `/groups/:groupSlug/spaces/:spaceSlug/*` | `SpaceContent` |
| `/groups/:groupSlug/topics/:topicName` | `ViewContent` topic stream |
| `/groups/:groupSlug/topics` | `AllTopics` |
| `/groups/:groupSlug/explore` | `LandingPage` (legacy) |
| `/groups/:groupSlug/offerings/:offeringId` | `OfferingDetails` |
| `/groups/:groupSlug/payment/{success,cancel,failure}` | Paywall return URLs |

There is **no** `/more-views` route — the page is `/more-spaces`.

### 6.2 Space routes

Space slugs in URLs are the **local** portion (e.g. `general`, not `my-community-general`).

Base: `/groups/:parentSlug/spaces/:spaceSlug`

**For space members:**

| Route (relative to base) | Component |
|-------|-----------|
| _(index)_ | One-column or multi-view → `ContextMenuGrid` (space menu); otherwise redirect to the space's `homeRoute` |
| `welcome` | `GroupWelcomePage` |
| `all` | `ViewContent` (view=all) |
| `discussions`, `events`, `resources`, `projects`, `proposals`, `requests-and-offers` | `ViewContent` |
| `custom/:customViewId`, `collection/:customViewId` | `ViewContent` |
| `map` | `MapExplorer` |
| `chat` | `ChatRoom` |
| `members`, `members/:personId` | `Members`, `MemberProfile` |
| `track-actions` | `TrackActionsView` |
| `funding-round-submissions` | `FundingRoundSubmissionsView` |
| `manage-round` | `ManageRoundView` — steward-only round management |
| `about/*` | `GroupAboutPage` (space variant; Settings tab opens `SpaceSettingsModal` inline) |
| `requests` | `MembershipRequestsTab` |
| `post/:postId/…` | `PostDetail` |
| `moderation/*` | Redirect → `about/moderation` |
| `*` | Same as index |

**For non-members:** only `about/*`, `requests` (stewards only), and a catch-all `*` → `SpaceJoinPage` (§7.9).

`track-actions`, `funding-round-submissions`, and `manage-round` exist **only** under space routes — there are no parent-group equivalents.

There is no dedicated `/settings` route for a space; space settings open as a modal (`SpaceSettingsModal`) from the menu gear or the About page Settings tab.

### 6.3 Redirects

| From | To |
|------|-----|
| `/groups/:slug/stream/*` | `/groups/:slug/all/*` (preserves trailing path via `RedirectStreamToAll`) |
| `/groups/:slug/groups/*` | `about/related-groups` |
| `/groups/:slug/moderation/*` | `about/moderation` |
| `/groups/:parentSlug/spaces/:spaceSlug/moderation/*` | `about/moderation` |
| `/groups/:slug/all-views/*` | `/groups/:slug/more-spaces` |
| `/groups/:slug/tracks/*` | `/groups/:slug/more-spaces` |
| `/groups/:slug/funding-rounds/*` | `/groups/:slug/more-spaces` |
| `/groups/:slug/all-topics/*` | `/groups/:slug/more-spaces` |
| `/groups/:spaceSlug/…` (a space accessed as a top-level slug) | `/groups/:parentSlug/spaces/:localSlug/…` |
| Unknown group sub-path | Group catch-all → `homeRoute` (two-column) or `ContextMenuGrid` (one-column) |

`/all/stream` and `/public/stream` are still real routes — the `stream` name is retained for the All and Public contexts.

### 6.4 Space Slug Strategy

`groups.slug` remains globally unique for all groups including spaces.

**Stored slug for spaces:** `{parentSlug}-{localName}` e.g. parent = `my-community`, space named "General" → stored slug = `my-community-general`.

**Routing:** `/groups/my-community/spaces/general` — the URL uses only the local portion. The backend derives the stored slug as `parentSlug + '-' + spaceSlug`.

**Collision handling:** if `my-community-general` already exists as a top-level group, append a number: `my-community-general-2`, `-3`, etc. Show this to the steward during space creation so they can adjust the name.

**Promoting a space to a group:** The stored slug stays `my-community-general`. It now appears as `/groups/my-community-general` — a valid globally-unique group slug.

**Editing slugs after creation:** spaces accept a `slug` argument on `updateSpace`. Top-level groups have **no** editable slug field in Group Settings today. New slugs must remain unique across all of Hylo.

---

### 6.5 Slug resolution helper

Shipped in `packages/navigation/src/index.js`. Note it takes the parent **slug** and the space's **full stored slug**, and only strips a prefix that actually matches:

```javascript
/** Local space slug portion from a stored space slug (parentSlug-localName). */
export function localSpaceSlug (parentSlug, spaceFullSlug) {
  if (!parentSlug || !spaceFullSlug) return spaceFullSlug || ''
  const prefix = `${parentSlug}-`
  return spaceFullSlug.startsWith(prefix) ? spaceFullSlug.slice(prefix.length) : spaceFullSlug
}
```

The reverse direction (`parentSlug + '-' + localSlug`) is resolved on the backend when looking a space up from a nested route.

### 6.6 `packages/navigation` helpers

Shipped in `packages/navigation/src/index.js`:

| Helper | Returns |
|--------|---------|
| `localSpaceSlug(parentSlug, spaceFullSlug)` | Strips the `{parentSlug}-` prefix |
| `spaceUrl(parentSlug, localSlug, viewPath?)` | `/groups/:parentSlug/spaces/:localSlug[/viewPath]` |
| `spaceGroupViewUrl(parentSlug, spaceGroup, view)` | URL for a specific view inside a space |
| `spaceHomeUrl(parentSlug, spaceGroup)` | Space home, using the space's `homeRoute` |
| `groupViewPath(view)` | Path suffix for a view (`/all`, `/custom/:id`, …) |
| `homeRoutePathForView(view)` | The value stored in `groups.home_route`; used by `GroupView.computeHomeRoutePath` |
| `viewUrl(view, opts)` / `baseUrl(opts)` | General builders; both accept `spaceSlug` |
| `groupUrl(slug, view?, defaultUrl?)` | `/groups/:slug[/view]` |
| `trackUrl`, `fundingRoundUrl` | Space-based track / round URLs |

There is **no** `groupViewUrl()` in the package, contrary to an earlier version of this spec. The web app has its own `groupViewUrl(groupSlug, view)` and `menuViewUrl(parentSlug, view, spaceGroup)` in `apps/web/src/routes/AuthLayoutRouter/components/ContextMenu/groupViewMenuUrl.js`, and the backend has a local `groupViewUrl` helper in `api/services/Frontend.js`.

`widgetUrl()`, `homeRoutePathForWidget()`, and `findHomeWidget()` are still exported and still used by the mobile app and by `ContextMenuOld`. `groupHomeUrl()` still routes through `widgetUrl` + `findHomeWidget`. Removing these depends on the mobile migration (§14).

---

## 7. Frontend Components

### 7.1 `Stream` → `ViewContent`

`apps/web/src/routes/Stream/` was renamed to `apps/web/src/routes/ViewContent/`.

`ViewContent.js` takes a `view` prop (from the route) and renders the appropriate post-stream UI, using per-type defaults from `COMMON_VIEWS` in `packages/presenters/src/GroupViewPresenter.js`:

| View | Default view mode | Post types |
|------|-------------------|-----------|
| `all` | cards | all |
| `discussions` | list | discussion |
| `events` | calendar | event |
| `resources` | grid | resource |
| `requests-and-offers` | bigGrid | request, offer (active only by default) |
| `proposals` | cards | proposal |
| `projects` | bigGrid | project |
| `custom` | from `settings.defaultViewMode` | from `settings.postTypes` + `topics` |
| `collection` | — | ordered `collectionPosts` |

A view's own `settings.defaultViewMode` overrides the `COMMON_VIEWS` default; the user's `users.settings.streamViewMode` is the final fallback.

`ViewContent` also serves the My context views (`posts`, `drafts`, `interactions`, `announcements`, `mentions`, `saved-posts`) and topic streams.

**Not rendered by `ViewContent`** — these have their own components mounted directly by the router: `chat` → `ChatRoom`, `map` → `MapExplorer`, `members` → `Members`, `welcome` → `GroupWelcomePage`, `track-actions` → `TrackActionsView`, `funding-round-submissions` → `FundingRoundSubmissionsView`, `about` → `GroupAboutPage`.

`link`, `text`, `separator`, and `space` are not routes at all (`GroupView.NON_NAVIGABLE_TYPES`).

### 7.2 Track and Funding Round spaces

`TrackHome.jsx` and `FundingRoundHome.jsx` and their tabbed interfaces are **removed**. A track or round is a space, and its former tabs are now views under the space's routes.

**Track space:**
- `welcome` view — home. Renders `page_content`, seeded from the old `welcome_message`. No enrollment CTA inside the space; that lives on the join interstitial (§7.9). _The track metadata block (num actions, enrolled, completed) is not yet rendered here — see §14._
- `track-actions` view — the ordered action list, backed by `collections_posts.view_id`. Stewards add and reorder actions from this view. Component: `TrackActionsView`.
- `chat` view — supports inline post notices for other post types when `showPostNoticesInChat` is on.
- `members` view — shows track completion date (`group_memberships.settings.completedAt`) via `Member.js`'s `trackCompletedAt` prop, visible to admins and Moderator/Host roles. _`enrolledAt` is fetched and shown as a generic "Joined" date rather than a track-specific enrollment date._
- `TrackPaywallOfferingsSection` is gone — paywalling is handled by the general space paywall, set via the "Paid" access option (§7.10) and surfaced on the join interstitial (§7.9).

**Funding round space:**
- `welcome` view — home. Renders `page_content` plus `FundingRoundAboutInfo` (banner, phase status, timeline dates, voting method). No join CTA inside the space.
- `funding-round-submissions` view — the submissions list. Component: `FundingRoundSubmissionsView`.
- `members` view — shows submit/vote role badges per member, derived from `funding_round.submitter_roles` / `voter_roles` cross-referenced with the member's group roles.
- `chat` view.
- Round management (phase dates, publish, voting config) is at `manage-round`, surfaced as a synthetic `ManageRoundView` menu entry for stewards rather than a `group_views` row. Editable round fields also appear in `SpaceSettingsModal`.

### 7.3 ContextMenu — two-column sidebar

`apps/web/src/routes/AuthLayoutRouter/components/ContextMenu/ContextMenu.jsx`

**Data loaded:** `group.groupViews(menuOnly: true)` via `fetchGroupViews` / `useGroupViews` — ordered menu views only. Space menus load that space's views in a second `fetchGroupViews` call. Off-menu spaces load lazily via `fetchGroupSpaces` when More Spaces or edit mode opens.

**Menu structure:**
```
[Group Name]                     ← GroupMenuHeader
  All Activity                   ← type=all, order=0
  Chat                     [3]   ← type=chat, numbered badge
  Events                    ●    ← type=events, dot
  ─────────────────              ← type=separator
  Resources
  Working Group             ●    ← type=space → drills into the space menu
  #announcements                 ← type=space, single view → links straight to that view
  Funding Round 2026
  ─────────────────
  Active Members  (•••)          ← type=members, renders CurrentlyActiveMembers avatars

  ─────────────────              ← footer, when applicable
  Join Requests            [2]   ← when pending requests exist and user can add members
  More Spaces              [4]   ← count of off-menu spaces
  Edit Menu                      ← admins only
```

**Space rows do not expand or collapse.** There is no chevron accordion. Instead:
- **Single-view space** (member) → the row links directly to that one view.
- **Multi-view space** (member) → the row links to the space index, and the sidebar performs a **takeover**: it swaps the group header and view list for the space's own header and views (`showingSpaceMenu`). Back navigation returns to the group menu.
- On `/more-spaces` in two-column, `?space=<localSlug>` selects a space in the sidebar without leaving the page.

`GroupViewMenuItem` is an inline component within `ContextMenu.jsx`, not a separate file. It branches on `view.type`: `separator` → rule, `text` → non-clickable label, `space` → space row, `members` → `CurrentlyActiveMembers` avatar strip plus link, `link` → external anchor, everything else → `MenuLink`.

**Unread indicators** (`apps/web/src/util/viewUnreadBadges.js`):
- **Chat views:** orange badge **with a number**.
- **Typed common views** (discussions, events, resources, projects, proposals, requests-and-offers): orange **dot**, no number.
- **Spaces:** orange dot, from the space's `group_memberships.new_post_count`, or when the space has pending join requests.
- **All Activity, custom, collection, and other views:** no badge.
- **Join Requests:** count badge.
- The **More Spaces** footer badge is a count of off-menu spaces, not unread posts.

**Space visibility filtering:** `apps/web/src/util/spaceVisibility.js` decides which space rows a viewer sees — `shouldShowSpaceInMenu` / `filterSpaceViewsForMenuVisibility` / `filterMoreSpacesSections`. Managers see everything; paywalled spaces require a granting published offering; role-gated spaces require the role; hidden/closed spaces require membership.

### 7.4 Menu layout — one-column vs two-column

A group's menu renders in one of two shapes. This was not in the original design and has no migration; both settings are jsonb keys.

| Setting | Where | Values |
|---------|-------|--------|
| `groups.settings.layout` | Group Settings → Appearance & Layout | `'two-column'` (default for new groups) or `'one-column'` |
| `users.settings.groupNavStyle` | User Settings → Appearance, and the GlobalNav profile dropdown | `'group-default'` (default), `'two-column'`, `'one-column'` |

Resolution, in `apps/web/src/util/navigationLayout.js`:

```javascript
export function resolveGroupLayout (userNavStyle, groupLayout) {
  if (userNavStyle === NAV_STYLE_ONE_COLUMN || userNavStyle === NAV_STYLE_TWO_COLUMN) {
    return userNavStyle
  }
  return groupLayout === NAV_STYLE_ONE_COLUMN ? NAV_STYLE_ONE_COLUMN : NAV_STYLE_TWO_COLUMN
}
```

An explicit user preference always wins; otherwise the group's setting decides.

**Two-column:** the `ContextMenu` sidebar described in §7.3, with view content in the center column.

**One-column (card menu):** `ContextMenuGrid.jsx` replaces the sidebar entirely with a full-width card-grid dashboard. `ContextMenu` returns `null` for one-column groups except on `/settings`, where it renders only `GroupSettingsMenu`. `ContextMenuGrid` renders at three levels:
- **Root** — the group's banner plus a card grid of its views and spaces (`GroupViewCard`), including synthetic `MoreSpacesCard` and `JoinRequestsCard`.
- **More Spaces level** — `/more-spaces` with a sticky back header and `MoreSpacesGrid`.
- **Space level** — a space's own views, with the group header ducked and a `SpaceBannerHeader` above.

If the user explicitly chose one-column, the My / All / Public contexts also get a card grid instead of a sidebar.

Card components: `GroupViewCard` (in-menu views), `SpaceViewCard` (off-menu spaces), `AddCard`. Edit mode uses `SortableViewsGrid` and `EditingBottomBar`.

### 7.5 Menu footer

Shown at the bottom of the sidebar (and as synthetic cards in the one-column grid):

- **Join Requests** — when `canAddMembers` and `openJoinRequestCount > 0`, with a count badge. Links directly to `/groups/:slug/requests` (or the space equivalent), which renders `MembershipRequestsTab` as a standalone page. This replaced the old path of navigating into Group Settings. `GroupSettingsMenu` still offers the old `settings/requests` route in parallel — see §14.
- **More Spaces** — links to `/groups/:slug/more-spaces` with a badge counting off-menu spaces (§11).
- **Edit Menu** — admins only. On two-column desktop it navigates to `/more-spaces?edit=true` rather than editing in place; in the drawer and in space menus it toggles `?edit=true` on the current URL.

### 7.6 Edit mode

Query param is **`?edit=true`** (not `edit=yes`), and requires `canAdminister`.

| Surface | Behavior |
|---------|----------|
| Two-column sidebar | View list is replaced by `GroupViewEditList` — drag to reorder, hide spaces, delete views |
| One-column grid | `SortableViewsGrid` with an inline More Spaces section and an `EditingBottomBar` "Done Editing" |
| More Spaces page | Edit chrome for off-menu spaces; hover to add a space back to the menu |

Per-row actions: a settings gear opening `GroupViewSettingsModal` (fields vary by view type), set-as-home, and delete. Adding is via `AddViewOrSpaceMenu`, which opens `AddGroupViewDialog` (view types), `AddCustomViewDialog`, `AddWelcomeViewDialog`, `AddCollectionDialog`, or `AddSpaceDialog`.

**Removing things from the menu:**
- **Spaces** — `setGroupViewHidden({ hidden: true })` sets `order = null` and the space moves to More Spaces. Reversible.
- **All other views** — hard-deleted via `deleteGroupView`. There is no hide state for them (§1).

**View types a steward can add** (`AddGroupViewDialog`):
- _Common views_ (singletons — hidden once already in the menu): `all`, `chat`, `members`, `map`, `welcome`, `discussions`, `events`, `requests-and-offers`, `resources`, `proposals`, `projects`
- _Custom views_ (always available): `custom`, `collection`, `link`, `post`, `member`, `group`, `text`, `separator`

`post`, `member`, and `group` require an entity picker.

### 7.7 Welcome page editing

`GroupSettings/WelcomePageTab` is **removed**. Welcome content lives on the `welcome` view's `page_content`.

Editing paths:
1. Menu edit mode → gear next to the Welcome row → `GroupViewSettingsModal` with the content editor.
2. Group Settings → Group Details → "Edit Welcome Page Content" link → `/groups/:slug/welcome`.

Whether new members see the welcome page on first visit is `group.settings.showWelcomePage`. The old `groups.welcome_page` columns were dropped by `20260716160000_drop_groups_welcome_page.js`.

### 7.8 Group Settings — post types and chat notices

**Accepted post types:** `GroupSettings/GroupSettingsTab/GroupSettingsTab.js` has an "Accepted Post Types" section using `PostTypePills`. Options: discussion, event, resource, project, proposal, requests-and-offers (one pill covering both). Writes `groups.accepted_post_types`. `null` = all types; `[]` = none.

**Show post notices in chat:** `groups.settings.showPostNoticesInChat` is **not** in GroupSettingsTab. It is a toggle inside `GroupViewSettingsModal` shown only when editing a **chat** view, and saves through `updateGroupSettings`. `ChatRoom.js` reads it with a default of `true`. It affects only which post types appear in the chat stream — **not** unread counting (§8).

**URL slug:** there is no editable slug field in Group Settings. Space slugs can be changed via `updateSpace`.

**Removed tabs:** `WelcomePageTab`, `CustomViewsTab`, and `TracksTab` no longer exist. `TopicsSettingsTab` still exists on disk but is commented out of the tab list.

Current Group Settings tabs: Group Details, Agreements (hidden for spaces), Responsibilities, Roles & Badges, Privacy & Access, Invite, Join Requests, Related Groups, Import, Export Data, Appearance & Layout, Paid Content, Delete.

### 7.9 Space join interstitial

`apps/web/src/routes/SpaceJoinPage/SpaceJoinPage.jsx` — rendered by `SpaceContent` as the catch-all for non-members, so a non-member never sees space content.

Shows: banner/icon, name, member count, purpose, description, a description of the access model, and the appropriate CTA — join (open), request to join (restricted), a role-gated notice, a hidden/invite-only notice, or the paywall offerings via `PaywallOfferingsSection`.

Track and funding round metadata (action count, enrolled count, phase status, submission/voting windows) is **not yet shown** here — see §14.

### 7.10 Space management UI

Gated by the **`Administration`** responsibility on the parent group (`canAdminister`). `Manage Spaces` no longer exists (§2.4). Parent stewards can manage a space's settings from the parent menu without being space members.

**Roles in spaces:**
- Spaces inherit parent-group roles at lookup time via `Group.roleScopeId`. No role rows are stored on the space; per-space custom role sets are not supported.
- Joining a space does not grant roles; it unlocks the member's **existing parent-group roles** inside that space.
- Role editing stays in the parent group role editor.
- Parent stewards are **not** auto-added to every space. Membership is explicit (join, invite, or creation). The creator becomes a space member.

**Creating a space** — `AddSpaceDialog.jsx`. The first choice is the space **kind**, which is immutable after creation:

| Kind | Default views seeded |
|------|----------------------|
| `custom` | `all`, `chat`, `members`, plus a typed view per selected post-type pill |
| `chat` | `chat` |
| `track` | `track-actions`, `chat`, `members`, `welcome` |
| `funding-round` | `funding-round-submissions`, `chat`, `members`, `welcome` |

Choosing `track` or `funding-round` runs `createSpace` followed by `createTrack` / `createFundingRound`.

**Form fields** (create and edit share most of these):
1. Space kind (create only)
2. Banner upload
3. Icon (suggestions plus picker)
4. Name
5. Purpose
6. Description
7. Location (optional — intended to place the space on the parent map)
8. Accepted post types (`PostTypePills`)
9. Included views (`IncludedViewsEditor`, create only; afterwards edited in the menu)
10. Access (below)
11. Funding round fields, when the space is a round
12. Track fields — completion message, completion badge/role, unit term singular/plural, published toggle — edit only

**Access** — one selector that sets `visibility`, `accessibility`, and `paywall` together (`spaceFormConstants.js`):

| Option | Visibility | Accessibility | Notes |
|--------|-----------|---------------|-------|
| **Open** | Public | Open | Anyone in the group can see and join |
| **Request to Join** | Public | Restricted | Visible, but join requires approval |
| **Invite Only** | Hidden | Closed | Stewards invite directly |
| **Role Gated** | Hidden | Closed | Also sets `required_roles`; shows a role picker |
| **Paid** | Protected | Restricted | Sets `paywall = true`. Gated on the parent group having Stripe configured, unless the space is already paid |

Note this differs from an earlier version of this spec, which had every option as Protected.

**Editing a space** — `SpaceSettingsModal.jsx`, opened from the menu gear in edit mode or from the About page Settings tab. It has **no archive or delete button**. Deleting a space is a separate trash action with a confirmation, available in `GroupViewEditList`, `ContextMenuGrid`, `MoreSpacesPage`, and `GroupViewSettingsModal`. There is **no invite section** in the space forms; inviting uses the shared `InviteMembersPopover` from the menu.

### 7.11 About page

`apps/web/src/routes/GroupAboutPage/GroupAboutPage.jsx` + `apps/web/src/components/GroupAboutView/GroupAboutView.jsx`

A banner plus a horizontal tab rail at `/groups/:slug/about/:tab` (and the same under a space). This page absorbed three former view types and two former destinations:

| Tab | Content | Notes |
|-----|---------|-------|
| `about` | Banner + `AboutPanel` | Default tab |
| `moderation` | `<Moderation />` | Was the `moderation` view; `/moderation/*` redirects here |
| `notifications` | Notification settings | Members only |
| `members` | Full `<Members />` inline | |
| `related-groups` | `<Groups />` | Groups only, and only when relationships exist; `/groups/*` redirects here |
| `settings` | Groups: navigates to `/settings`. Spaces: opens `SpaceSettingsModal` inline | |

Leave Group / Leave Space also lives here, using the generic `leaveGroup` mutation — spaces need no dedicated one (§3.9).

### 7.12 Map view — spaces on the map

The map shows posts with locations from the current group/space, related groups in the drawer, and spaces that have a `location` set — with distinct styling so spaces are distinguishable from child groups. Clicking a space navigates to it.

### 7.13 Post creation

`apps/web/src/components/PostEditor/PostEditor.js`

- **"To" field:** top-level groups the user belongs to, each with its child spaces indented beneath it. Both levels are filtered by whether the destination accepts the currently selected post type (`groupAcceptsPostType`: `null` accepts all, `[]` accepts none). Switching post type drops any destination that doesn't accept the new type.
- **Post type dropdown:** the intersection of the current view's allowed types (`useAllowedPostTypesForView`) and the current group's `acceptedPostTypes`.
- **Chat posts:** no destination selector — created from the chat composer in the current chat view; the group/space is implicit.
- **Non-chat posts:** a `groups_posts` row per selected group or space.

`createPost` rejects when any destination group's `accepted_post_types` does not include the post type (`{group name} does not accept {type} posts`). `null` accepts all types; `[]` accepts none of the steward-configured types (discussion, event, resource, project, proposal, request, offer). Chat, action, and submission posts are not restricted by this setting, so chat spaces and track / funding-round spaces with `[]` still accept those special types. Existing posts remain editable if a steward later narrows the list.

### 7.14 Space invites

Spaces are groups, so the generic invite plumbing applies. There is no dedicated space invite section in the space forms. My Invites splits group vs space invitations and join requests (§3.8). Dedicated space-invite forms are still outstanding (§14).

### 7.15 Chat presence and active members

`apps/web/src/components/CurrentlyActiveMembers/` — `CurrentlyActiveMembers.jsx` (avatars, count pill, invite) and `CurrentlyActivePills.jsx` (overlapping avatar strip, 15-minute recency window).

Used on the ContextMenu members row, `GroupViewCard` for the members view in one-column, the Members page header, and the chat members panel.

Two data sources:
- **Recently active** — GraphQL `members(sortBy: "last_active_at")` with `lastActiveAt`.
- **Live presence** — an in-memory, non-persisted socket roster: `api/services/RoomPresence.js` with `subscribe`/`unsubscribe` via `POST /noo/group/:groupId/subscribe`, broadcasting `roomPresence`, `memberPresent`, and `memberAway`. Consumed by `SocketListener` and `RoomPresence.store.js`. Drives the green dots and typing pulse in chat.

---

## 8. Notifications & Unread Tracking

Shared post-type ↔ view-type mapping lives in `packages/shared/src/viewHelpers.js` so the backend counter and the frontend badge logic can't drift.

### Per-view unread counting

`incrementNewPostCount(post)` is queued from `createPost.js`. For each group or space the post belongs to, for all active members except the author, it increments:

| Post type | Surfaces incremented |
|-----------|------------------|
| Any non-notice type | `group_memberships.new_post_count` (the group/space dot) |
| `chat` | the `chat` view |
| `discussion` | `discussions` |
| `event` | `events` |
| `request` or `offer` | `requests-and-offers` |
| `resource` | `resources` |
| `proposal` | `proposals` |
| `project` | `projects` |

**`showPostNoticesInChat` does not affect unread counting.** Only chat posts ever increment the chat view:

```javascript
export function postCountsTowardChatUnread (postType) {
  return postType === 'chat'
}
```

A typed post can appear in the chat stream as a notice (`postAppearsInChat`) while badging only its own typed view. This is a deliberate change from an earlier version of this spec, which had notices increment chat unread too.

Never incremented (`NO_BADGE_VIEW_TYPES`): `all`, `custom`, `collection`, `welcome`, `map`, `members`, `link`, `text`, `space`, `track-actions`, `funding-round-submissions`, `group`, `member`.

Synthetic notice posts (`Post.NOTICE_TYPES`, including `chat_activity`) are skipped entirely.

**On delete:** `deletePost.js` mirrors the same logic via `GroupViewUser.decrementNewPostCount`, only decrementing rows whose reader hadn't already read past the deleted post.

**Author handling:** `GroupViewUser.markAuthorRead` advances the author's own `last_read_post_id` so they never see their own post as unread.

### Resetting unread

- **Open group/space** → clears `group_memberships.new_post_count`. Does **not** clear per-view badges.
- **Open a typed view** → `markViewAsRead(viewId)` zeroes the count and advances `last_read_post_id`.
- **Chat** → `updateGroupViewUser(viewId, lastReadPostId)` as the user scrolls or jumps to latest. Entering chat does not blanket-clear.
- **Mark as Read** (GlobalNav) → `markGroupAsRead(groupId)` zeroes the membership count and every view in the group.
- All Activity does not cascade-clear other views.

### Indicators

- **Chat:** orange badge **with a number**.
- **Typed common views:** orange **dot**, no number.
- **All Activity, custom, collection, and other views:** no badge.
- **Space** (in the parent menu): orange dot from the space's own `group_memberships.new_post_count` — same mechanism as a group.
- **Group** (global nav): orange dot, no number.

Duplication between the chat number and a typed-view dot when notices are on is intentional.

### Chat activity notices in All Activity

Chat messages are aggregated into synthetic `chat_activity` posts — one per group/space per UTC hour — so chat shows up as cards in All Activity without flooding it. Written by `api/models/post/upsertChatActivityNotice.js`, queued from `createPost` for chat posts, stored in `posts.notice_data`:

```javascript
const noticeData = {
  bucketKey,
  groupId: Number(groupId),
  bucketStart: bucketStart.toISOString(),
  recentPostIds: chatModels.slice(0, RECENT_POST_IDS_LIMIT).map(p => Number(p.id)),
  postCount: chats.length
}
```

Exposed as `Post.noticeData`. Rendered as a "Recently in \<group\>" card with a hover "View activity" link. This was previously listed as out of scope.

### Notification settings precedence — **not implemented**

The intended precedence was per-view settings → space membership settings → parent membership settings. In practice:

- `group_views_users.settings` is **written** by `updateViewSettings` but **never read**. No frontend calls that mutation.
- All notification gating uses `group_memberships.settings` — specifically `postNotifications` (`all` / `important` / `none`) and `sendEmail`. When the activity is in a space, it's the space's membership settings that apply.
- Topic follows still use `TagFollow.settings.notifications`.

Per-view notification overrides is out of scope

### Chat digest email

`GroupViewUser.sendDigests()` runs **hourly** from `cron.js`. It finds chat `group_views_users` rows with `new_post_count > 0` updated since a Redis-stored watermark (capped to a 24-hour catch-up), respects the recipient's `group_memberships.settings` (`sendEmail`, and `postNotifications` — `important` narrows to mentions and announcements, `none` skips), and sends via `Email.sendChatDigest` with links built by `Frontend.Route.post`.

Comment and message digests remain on `Comment.sendDigests()`, every 10 minutes.

### Group digest emails

Implemented in `apps/backend/lib/group/digest2/`. Currently **in flight** — see §14.

- **Space posts roll up into the parent group digest.** `util.js` provides `scopeGroupIds(group, spaces)` and `wherePostedInGroups()` so digest queries span the parent plus its active child spaces.
- **Spaces have no digest of their own.** `sendAllDigests` excludes `groups.type = 'space'`.
- **Attribution:** `formatData.js` prefers a child space over the parent when labeling a post, matching how All Activity cards attribute content, and sets `space_id` / `space_name`. The email renders an inline `in {{space}}` label per post card (`space_label` macro in `html.liquid`, plus `macro_post_card.snippet.liquid`) rather than grouping posts under space section headers.
- **Personalization:** `personalizeData.js` drops posts and chats from spaces the recipient isn't an active member of.
- **Active Conversations:** `chat_rooms` (each group and space chat room, with counts and deep links) replaces the old `topics_with_chats`, which was built on `#topic` chat rooms.
- **Chat read state:** unread chat is computed per source group/space from that room's `GroupViewUser.last_read_post_id`, not from a single parent-group marker.

---

## 9. Search

### Frontend

The per-view search box filters posts within the current view. No change was needed.

### Backend

**Group search includes child spaces.** `api/services/Search.js` handles this when `parentSlugs` is given — it unions relationship-based child groups with `parent_id`-based spaces:

```javascript
if (opts.parentSlugs) {
  // Child groups via group_relationships, plus spaces via groups.parent_id
  // (spaces are not modeled as relationship children — see Group.spaces / spec §3.4)
  qb.where(q2 => {
    q2.whereIn('groups.id', function () { /* group_relationships */ })
    q2.orWhere(q3 => {
      q3.where('groups.type', 'space')
      q3.whereIn('groups.parent_id', function () {
        this.select('id').from('groups').whereIn('slug', opts.parentSlugs)
      })
    })
  })
}
```

Moderation search does the same via `forModerationActions.js`, so reports from spaces surface in the parent group's queue.

**Explore / public group search excludes spaces.** `Search.forGroups` applies `Group.excludeSpaces` unless `parentSlugs` is set or `groupType === 'space'`. See §3.8.

---

## 10. Group & Space Creation

### New group creation

The existing flow continues; the creator picks an "Included Views" list in `routes/CreateGroup.jsx`, which is passed through as `view_types`.

`Group.create()` currently calls **both**:
1. `group.setupContextWidgets(trx)` — legacy, still running
2. `Group.setupSpaceViews(group.id, accepted_post_types, data.view_types, { transacting: trx })` — when `view_types` was supplied

New groups therefore get both ContextWidget rows and GroupView rows. Removing the ContextWidget call is §14 cleanup. There is no template system and no `setupGroupViews()`; templates remain future work (§13).

New groups default to `settings.layout = 'two-column'`.

### New space creation

- Requires the **`Administration`** responsibility on the parent group.
- Triggered from menu edit mode via `AddSpaceDialog`.
- `createSpace` creates the `groups` row with `type = 'space'` and `parent_id`, seeds the space's own views through `Group.setupSpaceViews()` from the `viewTypes` argument, and adds a `type = 'space'` row to the parent's menu — off-menu (`order = null`) when `addToMenu: false`.
- The creator is added as a space member; their parent-group roles apply immediately.
- `num_open_join_requests` is initialized to `0`.

### Track / Funding Round space creation

`AddSpaceDialog` runs `createSpace` and then `createTrack` or `createFundingRound`, linking the new record to the space.

Seeded views per §7.10:
- Track: `track-actions`, `chat`, `members`, `welcome`
- Funding round: `funding-round-submissions`, `chat`, `members`, `welcome`

---

## 11. More Spaces

Route: `/groups/:groupSlug/more-spaces` (Edit Menu: same route with `?edit=true`)

Components: `MoreSpacesPage.jsx` in two-column; `ContextMenuGrid` at its More Spaces level in one-column.

**This page holds spaces only.** It was originally designed as "More Views and Spaces" with a Views section for soft-removed views, but views are now binary (§1) — `20260817140000_drop_off_menu_views.js` deleted every off-menu view row, and `GroupView.SOFT_REMOVE_TYPES` allows only `space`. There is no `/more-views` route.

Sections, from `apps/web/src/store/selectors/getMoreSpacesSections.js`:

| Section | Content |
|---------|---------|
| **Tracks** | Off-menu track spaces; drafts flagged via `isDraft` (`!space.track.publishedAt`) |
| **Funding Rounds** | Off-menu funding round spaces, including drafts |
| **Other Spaces** | Everything else off-menu, with archived spaces (`active === false`) merged in and sorted by name |

"Off-menu" means the space has no `type = 'space'` `group_views` row in the parent with a non-null `order` (`getMenuSpaceIds`). Results are further filtered for the viewer by `filterMoreSpacesSections` in `util/spaceVisibility.js`.

Moderation, related groups, and All Topics are **not** here — moderation and related groups are About page tabs (§7.11), and All Topics was dropped.

**Removing from the menu vs deleting:**
- **Spaces** — `setGroupViewHidden({ hidden: true })` sets `order = null`; the space appears here and can be added back (hover **+** in edit mode).
- **All other views** — hard-deleted; there is nowhere for them to go.
- **Deleting a space** — a separate trash action with confirmation, available here and in the edit list/grid.

**Navigation:** clicking a space here drills into the space. In two-column, `?space=<localSlug>` selects the space in the sidebar without leaving the page; in one-column the grid descends to the space level.

---

## 12. Steward Onboarding Prompt

**Not built.** Design intent only — there is no `sawSpacesOnboarding` flag and no modal in the codebase.

After migration, the first time a group steward logs in, show a modal:

**Content:**
1. Short summary of changes
2. Link to blog post / changelog
3. Buttons:
   - **"Edit my group menu"** → opens the menu with `?edit=true`
   - **"Review post types"** → links to Group Settings → Group Details
4. "Got it, I'll do this later" dismiss

**Trigger:** a flag in `group_memberships.settings` (e.g. `sawSpacesOnboarding: true`) set on dismiss.

**Groups needing extra attention** (logged during migration):
- Groups where the home view changed because a track or funding round was the old home
- Groups where `#general` was the main home chat

These get a slightly more detailed prompt describing the specific change.

---

## 13. Out of Scope / Future Work

- Per-space custom role definitions (spaces inherit parent group roles at lookup time; role editing stays on the parent)
- Renaming the word "space" in the UI (e.g. "circles")
- View type aliases (e.g. Events → Calendar, Chat → Watercooler) — ship with consistent names; revisit if demand is high
- Archiving views (hide without deleting) — views are in the menu or deleted; only spaces have an off-menu state
- Group and space templates UI (hardcoded defaults today)
- Per-view notification settings — `group_views_users.settings` exists and is written but never read (§8)
- Digest emails grouping space posts under space section headers (inline `in {{space}}` labels ship instead)
- Kanban view mode
- Promote a Space to a Group (architecture supports it; no UI)
- Analytics per space
- Category system for posts
- Project posts → Project Spaces migration
- Tool Lending Library space type
- Editable Pages (Welcome page extensions)

**No longer out of scope — shipped:** chat activity cards in the All Activity stream (§8), moderation queue scoped per space (space moderation actions surface in the parent's queue, and in the space too).

---

## 14. Status & Remaining Work

The old Phase 1–7 framing has been retired — the phases interleaved in practice and most of them are done. What follows is the single source of truth for status.

### 14.1 Shipped

**Database & migration**
- `groups`: `parent_id`, `accepted_post_types`, `required_roles`, `icon`, `track_id`, `funding_round_id`, `num_open_join_requests`
- `tracks.group_id`; `funding_rounds.group_id` repointed to the space
- `group_views`, `group_views_users` tables; `collections_posts.view_id`
- `posts.notice_data` for chat activity notices
- Full ContextWidget → GroupView data migration, including tracks / funding rounds / non-`#general` chat rooms → spaces, `group_views_users` backfill, and `home_route` rewrite
- `Manage Spaces` responsibility added, then folded into `Administration` and removed
- Paid spaces: `track.access_controlled` → `groups.paywall`, Stripe `access_grants.trackIds` → `groupIds`, `content_access` reminted, space memberships ensured for existing purchasers
- Off-menu views dropped; views are now binary

**Backend**
- `GroupView`, `GroupViewUser`, `CollectionPost` models with reorder / home-view / unread logic
- `Group.spaces()`, `parentGroup()`, `groupViews()`, `track()`, `fundingRound()`, `setupSpaceViews()`, `destroySpace()`
- Space role inheritance via `Group.roleScopeId` (`parent_id || id`) — no per-space role rows
- `doesMenuUpdate` replaced by `notifyGroupUpdated` socket push
- Full GraphQL surface for views and spaces (§4.4), including `setGroupViewHidden`, `markGroupAsRead`, `updateGroupViewUser`
- Per-view unread increment on create and decrement on delete, via shared `viewHelpers`
- Hourly chat digest (`GroupViewUser.sendDigests`)
- Chat activity notice posts (`upsertChatActivityNotice`)
- `num_open_join_requests` maintenance and socket broadcast
- Group and moderation search include child spaces via `parent_id`
- Explore / public `Search.forGroups` excludes spaces by default (`Group.excludeSpaces`); `Person.memberships` and related-group relations do the same (§3.8)
- Track and funding round logic moved onto space membership and `collections_posts`

**Web**
- `Stream` → `ViewContent`; all group and space routes
- `ContextMenu` rebuilt on `groupViews`: space drill-in, numbered chat badges, typed-view dots, footer (Join Requests, More Spaces, Edit Menu)
- One-column `ContextMenuGrid` card menu, with group and user layout preferences
- Edit mode (`?edit=true`): drag reorder, per-view settings modal, add view / add space dialogs
- `More Spaces` page (`/more-spaces`)
- Redesigned About page with tabs absorbing moderation, members, related groups, notification settings, and settings
- Join Requests as a standalone `/requests` route opened directly from the menu
- `AddSpaceDialog` / `SpaceSettingsModal` with space kinds, access presets, post-type pills, included views
- `SpaceJoinPage` interstitial covering open / request / role-gated / paid / invite-only
- `TrackActionsView`, `FundingRoundSubmissionsView`, `ManageRoundView`, `FundingRoundAboutInfo`
- Post editor "To" field with indented child spaces, filtered by accepted post types
- Welcome page from the `welcome` view; `WelcomePageTab`, `CustomViewsTab`, `TracksTab` removed
- `CurrentlyActiveMembers` presence strip plus socket `RoomPresence`
- Space visibility helpers (`util/spaceVisibility.js`), `SpaceGroupContext` / `useEffectiveGroupSlug`
- My Invites splits group vs space invitations and join requests; profile "Hylo Groups" excludes spaces (§3.8)

### 14.2 In flight (uncommitted on `spaces-and-views`)

- **Group digest space support** — `lib/group/digest2/*`, `Post.presentForEmail`, `Digest_Email_i18n/html.liquid` and the new `macro_post_card.snippet.liquid`: space posts roll into the parent digest, spaces get no digest of their own, inline `in {{space}}` labels, `chat_rooms` replacing `topics_with_chats`, per-room chat read state, and membership filtering for space content (§8)
- **`cron.js`** — weekly digest fired on day-of-month instead of weekday; fixed to `weekday === 3`
- **`space-collection` view type** — new curated space list (`settings.spaceIds`) replacing the old `tracks` / `funding-rounds` widget views, with `SpaceCollection` route, `SpaceSelector` component, `AddSpaceCollectionDialog`, `util/spaceCollection.js`, and migration backfill (§2.5)
- **`migrations/scripts/rollbackSpecificMigration.js`** — `yarn rollback:specific <filename>` rolls back one recorded migration without touching later ones
- **Legacy table drops (parked)** — `migrations/in-progress/`: `20260819130000` (join tables), `20260819140000` (ContextWidget / CustomView / Collection / `groups_tracks` + indexes), `20260820120000` (track/round display columns; reversible from the space group), `20260820130000` (`networks` / `networks_users`). Knex does not run this folder. Create still dual-writes `tracks.name` / `funding_rounds.title` so production NOT NULL columns stay valid.
- **Legacy route redirects** — `/all-views`, `/tracks`, `/funding-rounds`, `/all-topics` now redirect to `/more-spaces` (§6.3)
- **Leave teardown consolidated into `Group.removeMembers`** — deletes departing members' `group_views_users` rows and settles track / funding round counters and membership settings, so the parent-group cascade and moderator removal get the same treatment as an explicit leave; `Track.leave` / `FundingRound.leave` no longer adjust their own counts, and the redundant `leaveSpace` mutation is gone (§3.9)
- **Exclude spaces from group-list queries** — `Search.forGroups` / `Person.memberships` / related-group relations use `Group.excludeSpaces`; My Invites splits group vs space lists (§3.8)

### 14.3 Remaining work

Two findings changed the cleanup order that this section previously assumed:

1. **The original `20260713120000_spaces_cleanup.js` was not safe to ship as one migration.** It dropped `tracks.name` / `description` / `banner_url` / `welcome_message` and `funding_rounds.title` / `banner_url` / `description` while live reads still used those columns (notification copy, all six `lib/i18n/*.js` files, Stripe checkout metadata, search autocomplete, weekly digest SQL). Display reads had to move onto the space group *before* those columns could drop.
2. **Mobile needed no ContextWidget migration, only deletion.** `AuthRootNavigator` mounts only `PrimaryWebView`; every native screen that read `customViews` / `contextWidgets` was unreachable. That unblocked CustomView removal entirely — there was no step-2 mobile port.

**Cleanup order (landed, each phase left the tree green)**

1. Safe deletions: dead mobile native tree, orphaned web files (`NavLink`, `TopicNavigation`, `TopicsSettingsTab`, Tracks/FundingRounds pages, Stream shim), dead redux, stale widget/nav i18n. Join Requests remains both a settings tab and the standalone `/requests` page.
2. Stop fetching `contextWidgets` / `chatRooms` in production queries.
3. Remove the legacy menu stack (`ContextMenuOld`, provider, `useGatherItems`, WidgetIconResolver, ormReducer widget branches).
4. Repoint TagFollow chat-room check and Group welcome sync off `ContextWidget`; `Group.create()` calls `setupSpaceViews` only.
5. Delete the ContextWidget backend/package surface. (`GroupWidget` / `group_widgets` is a separate explore-page system and stays.)
6. Display reads live on the space group (`track.space.name` / `fundingRound.group.name`). Writes still dual-write the old columns so production NOT NULL `tracks.name` / `funding_rounds.title` stay valid until the parked drop. Clients still see convenience `name`/`title` from presenters.
7. Remove CustomView and legacy Collection (`CollectionsPost` / `collection_id`). Keep `CollectionPost` (keyed by `view_id`) and the `customViewId` **route param** (it names a `group_views.id`).
8. Park drop migrations in `migrations/in-progress/` (join tables, leftover views tables + indexes, display columns, networks). Move them back after production soak.
9. Perf: DataLoader batching for unread + pins, `groupViews(menuOnly:)`, bulk-upsert `incrementNewPostCount`, `openJoinRequestCount` off `groups.num_open_join_requests`; frontend trims `linkedGroup`, lazy-loads `fetchGroupSpaces`, per-component view selectors, narrower `groupUpdated` handler.

**Gated follow-up**

- Keep `tracks.deactivated_at`, `tracks.access_controlled`, and `funding_rounds.deactivated_at` — those are still live.

**Open decisions (not acted on)**

- `group_memberships.new_post_count` is a second unread counter still written alongside `group_views_users.new_post_count`. Decide whether membership badges still need it before dropping the column.

**Product remaining**

| Item | Notes |
|------|-------|
| Archive / unarchive space UI | `archiveSpace` exists on the backend; the web app only *displays* archived spaces in More Spaces |
| Draft funding rounds and tracks | Or maybe any space can be a draft? |
| Space invitations | No dedicated invite section in space forms; My Invites now splits group vs space invites (§7.14) |
| Track welcome metadata | The `welcome` view doesn't render num actions / enrolled / completed for track spaces (§7.2) |
| `enrolledAt` in track member directory | Shown as a generic "Joined" date, not track enrollment (§7.2) |
| Track / round metadata on `SpaceJoinPage` | No action count, enrolled count, or phase dates on the interstitial (§7.9) |
| Steward onboarding prompt | Not started (§12) |
| Remove `#general` | Delete `posts_tags` rows for the `#general` tag. Specified in Step 9 of §5 but never executed |
| Retire track-scoped Stripe path | `access_grants.trackIds` is still read for pre-migration rows. Once confident all rows are reminted to `groupIds`, drop the `trackIds` branches and `stripe_products.track_id` |
