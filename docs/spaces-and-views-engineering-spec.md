# Spaces & Views — Engineering Spec

_Product spec: [Google Doc](https://docs.google.com/document/d/1Oct_l40Jj64dYl5DZcX13lIKDcNvStiKopVAMuWeGwg/edit)_

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Database Changes](#2-database-changes)
3. [Backend Model Changes](#3-backend-model-changes)
4. [GraphQL Schema Changes](#4-graphql-schema-changes)
5. [Data Migration](#5-data-migration)
6. [Routing](#6-routing)
7. [Frontend Component Changes](#7-frontend-component-changes)
8. [Notifications & Unread Tracking](#8-notifications--unread-tracking)
9. [Search](#9-search)
10. [Group & Space Creation](#10-group--space-creation)
11. [More Views & Spaces](#11-more-views)
12. [Steward Onboarding Prompt](#12-steward-onboarding-prompt)
13. [Out of Scope / Future Work](#13-out-of-scope--future-work)
14. [Phased Rollout](#14-phased-rollout)

---

## 1. Core Concepts

| Concept | Definition |
|---------|------------|
| **Group** | Unchanged top-level concept. Top-level groups have `parent_id = null`. Spaces have `parent_id` pointing to their parent group. |
| **Space** | A container for content inside a group. Every group has one implicit **Main Space** (views whose `group_id` = the group's own id). Additional spaces are child groups with `type = 'space'`. But instead of using the group_relationships table to link spaces to their parent group, we will use a new `parent_id` column on the `groups` table. |
| **Main Space** | Not a separate DB row in groups. The `group_views` rows where `group_id = group.id` are the group's Main Space views. |
| **View** | A filter on the content of the group. A named entry in the group menu that opens a specific UI. Defined by a row in `group_views`. `order = 0` is the home view. Views are either in the menu or deleted — **there is no archive state for views**, only for spaces. |
| **View Mode** | A UI variant for displaying posts in a view (Stream, Grid, Map, Calendar). Different views have different default view modes as stored in `group_views.settings.defaultViewMode`. The last used view mode for each user is also stored in `group_views_users.settings.lastViewMode`. |
| **More Spaces** | Replaces the old All Views / Tracks / Funding Rounds pages. A list (not grid) of spaces and utilities not shown in the main menu: track spaces, funding round spaces (including drafts), related groups, moderation, and archived spaces — organized by section. |
---

## 2. Database Changes

### 2.1 `groups` table — new columns

```sql
ALTER TABLE groups
  ADD COLUMN parent_id bigint REFERENCES groups(id) ON DELETE CASCADE,
  ADD COLUMN accepted_post_types jsonb,
  ADD COLUMN required_roles jsonb,
  ADD COLUMN track_id bigint REFERENCES tracks(id) ON DELETE SET NULL,
  ADD COLUMN funding_round_id bigint REFERENCES funding_rounds(id) ON DELETE SET NULL;

CREATE INDEX idx_groups_parent_id ON groups(parent_id);
CREATE INDEX idx_groups_parent_id_type ON groups(parent_id, type);
CREATE INDEX idx_groups_track_id ON groups(track_id);
CREATE INDEX idx_groups_funding_round_id ON groups(funding_round_id);
```

| Column | Purpose |
|--------|---------|
| `parent_id` | Null for top-level groups. Set to parent group id for all spaces. Cascade-deletes spaces when parent is deleted. |
| `accepted_post_types` | JSON array of accepted post type strings. `null` = all types accepted. `[]` = archive-only space. **Migration:** leave `null` (all types) for all existing groups; stewards narrow later. |
| `required_roles` | JSON array of group_roles IDs. If set, space is only visible to members with one of those roles in its parent group.
| `track_id` | If set, this group is a Track/Course space. References the `tracks` table. |
| `funding_round_id` | If set, this group is a Funding Round space. References the `funding_rounds` table. |

`type` column already exists on `groups`. Add `'space'` as a new valid value.

`home_route` column stays — still used for fast redirect to home view without loading group_views. Format updated during migration to match new URL patterns (e.g. `/groups/:parentSlug/spaces/:spaceSlug` for space home views).

---

### 2.2 `tracks` table — columns removed and added

Tracks are now spaces with some special fields that are still on the tracks table. They also have a special view type `track-actions` that is used to display the actions of the track.

```sql
-- Add new FK pointing to the space created for this track
ALTER TABLE tracks ADD COLUMN group_id bigint REFERENCES groups(id) ON DELETE SET NULL;
CREATE INDEX idx_tracks_group_id ON tracks(group_id);

-- Remove columns migrated to the space group
ALTER TABLE tracks
  DROP COLUMN name,
  DROP COLUMN description,
  DROP COLUMN banner_url,
  DROP COLUMN welcome_message,
  DROP COLUMN deactivated_at,
  DROP COLUMN access_controlled;

-- Drop the many-to-many join table (replaced by tracks.group_id)
DROP TABLE groups_tracks;
```

**Remaining `tracks` columns after migration:**
`id`, `group_id` (→ space), `completion_message`, `published_at`, `completion_role_id`, `completion_role_type`, `num_actions`, `num_people_enrolled`, `num_people_completed`, `created_at`, `updated_at`

**What moves to the space group (`groups` table):**
- `name` → `groups.name`
- `description` → `groups.description`
- `banner_url` → `groups.banner_url` (confirmed)
- `deactivated_at` → archive the space (`groups.deactivated_at`) if set
- `access_controlled` → set space to paid (see Phase 4 Paid Spaces)

---

### 2.3 `funding_rounds` table — columns removed, `group_id` updated

Funding rounds are now spaces with some special fields that are still on the funding_rounds table. They also have a special view type `funding-round-submissions` that is used to display the submissions of the funding round.

```sql
-- Remove columns migrated to the space group
ALTER TABLE funding_rounds
  DROP COLUMN title,
  DROP COLUMN banner,
  DROP COLUMN description,
  DROP COLUMN deactivated_at;

-- group_id now points to the space (updated during migration, not via DDL)
-- After migration: funding_rounds.group_id → space group
```

**What moves to the space group:**
- `title` (or `name`) → `groups.name`
- `banner` → `groups.banner_url`
- `description` → `groups.description`
- `deactivated_at` → archive the space if set

**Remaining `funding_rounds` columns:** `id`, `group_id` (→ space), all phase date columns (`submissions_open_at`, `submissions_close_at`, `voting_opens_at`, `voting_closes_at`), `submitter_roles`, `voter_roles`, `tokens_per_voter`, and any other round-specific fields.

---

### 2.4 Roles & Responsibilities

**New system responsibility:** `Manage Spaces` — assignable to any role via group role editor. Controls who can create child spaces in a group (not limited to Coordinators). Coordinator includes it by default.

Responsibilities are looked up by **`name` AND `type = 'system'`** — never by hardcoded id — because ids may differ across databases and group-custom responsibilities can reuse the same name.

**Migration:**

For each existing group:
1. Add the `Manage Spaces` responsibility to coordinator role for the group
2. Migrate admin-only chat room spaces: set `required_roles = [<coordinator role id for that group>]`
3. Spaces **inherit roles from the parent group at lookup time** — they do **not** store their own `groups_roles` or `group_memberships_group_roles` rows. Effective permissions in a space = space membership ∩ parent role responsibilities. Roles are not customizable per space.

---

### 2.5 `group_views` table — new table

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
  topics           jsonb,
  settings         jsonb,
  created_at       timestamp NOT NULL DEFAULT now(),
  updated_at       timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_views_group_order ON group_views(group_id, "order");
```

**`order` semantics:**
- `0` = home view (first to open when clicking the group/space)
- `1`, `2`, … = ascending menu position
- No null order — views either exist in the menu or don't exist at all

**`topics` column:** jsonb array of topic name strings e.g. `["permaculture", "water"]`. Used by `type = 'custom'` views for topic filtering. Migrated from `custom_view_topics` join table (looked up tag names by id at migration time).

**Column usage by type:**

| `type` | `name` | `icon` | `topics` | `settings` | `link` | `page_content` | `post_id` | `user_id` | `linked_group_id` |
|--------|--------|--------|---------|-----------|--------|--------------|---------|---------|--------------|
| `all` | null | optional | — | `{defaultViewMode}` | — | — | — | — | — |
| `chat` | null | optional | — | — | — | — | — | — | — |
| `discussions` | null | optional | — | `{defaultViewMode}` | — | — | — | — | — |
| `events` | null | optional | — | `{defaultViewMode}` | — | — | — | — | — |
| `requests-and-offers` | null | optional | — | — | — | — | — | — | — |
| `resources` | null | optional | — | `{defaultViewMode}` | — | — | — | — | — |
| `proposals` | null | optional | — | — | — | — | — | — | — |
| `projects` | null | optional | — | — | — | — | — | — | — |
| `track-actions` | null | optional | — | — | — | — | — | — | — |
| `funding-round-submissions` | null | optional | — | — | — | — | — | — | — |
| `members` | null | optional | — | — | — | — | — | — | — |
| `about` | null | optional | — | — | — | — | — | — | — |
| `related-groups` | null | optional | — | — | — | — | — | — | — |
| `map` | null | optional | — | — | — | — | — | — | — |
| `welcome` | null | optional | — | — | — | ✓ | — | — | — |
| `custom` | **required** | optional | optional | `{postTypes, activePostsOnly, defaultSort, defaultViewMode, searchText}` | — | — | — | — | — |
| `collection` | **required** | optional | — | — | — | — | — | — | — |
| `link` | **required** | optional | — | — | ✓ | — | — | — | — |
| `post` | optional | optional | — | — | — | — | ✓ | — | — |
| `member` | optional | optional | — | — | — | — | — | ✓ | — |
| `space` | — | — | — | — | — | — | — | — | ✓ |
| `group` | optional | optional | — | — | — | — | — | — | ✓ |
| `text` | **required** | optional | — | — | — | optional | — | — | — |
| `separator` | — | — | — | — | — | — | — | — | — |

**`type = 'space'` entries — how space menu entries work:**

Every child space that appears in the parent group's menu has a `group_views` row in the **parent group** with `type = 'space'` and `linked_group_id = space.id`. This gives spaces an `order` position in the single ordered list that drives the ContextMenu, interleaved with regular views.

- `name` and `icon` on the row are display overrides. If null, the ContextMenu uses `linked_group.name` and `linked_group.avatar_url`.
- **Archiving:** when a space is archived (`linked_group.deactivated_at IS NOT NULL`), the row is destroyed
- **Deletion:** when a space group is deleted, the `group_views` row cascade-deletes via the `linked_group_id` FK (`ON DELETE CASCADE`).
- **No `group_views_users` rows** are created for `type = 'space'` entries — unread state for a space is aggregated from the space's own views.
- `type = 'group'` (distinct from `type = 'space'`) is for pointing to other groups that are not spaces

All views within a given group or space are visible to all members of that group/space. Role-gating happens at the space level via `groups.required_roles`, not per-view.

**`settings` for `custom` type:**
```json
{
  "postTypes": ["discussion", "event"],
  "activePostsOnly": false,
  "defaultSort": "recent",
  "defaultViewMode": "stream",
  "searchText": ""
}
```

---

### 2.6 `group_views_users` table — new table

```sql
CREATE TABLE group_views_users (
  id                bigserial PRIMARY KEY,
  view_id           bigint NOT NULL REFERENCES group_views(id) ON DELETE CASCADE,
  user_id           bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_post_count    int NOT NULL DEFAULT 0,
  last_read_post_id bigint REFERENCES posts(id) ON DELETE SET NULL,
  settings          jsonb,
  created_at        timestamp NOT NULL DEFAULT now(),
  updated_at        timestamp NOT NULL DEFAULT now(),
  UNIQUE(view_id, user_id)
);

CREATE INDEX idx_gvu_view_id ON group_views_users(view_id);
CREATE INDEX idx_gvu_user_id ON group_views_users(user_id);
```

`settings`: jsonb, same shape as `group_memberships.settings`. Null = inherit from space membership settings.

Created when a user joins a space — one row per view in that space.

---

### 2.7 `collection_posts` table — replaces `posts_collections`, also used for track action ordering

```sql
CREATE TABLE collection_posts (
  id         bigserial PRIMARY KEY,
  view_id    bigint NOT NULL REFERENCES group_views(id) ON DELETE CASCADE,
  post_id    bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  "order"    int NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(view_id, post_id)
);

CREATE INDEX idx_collection_posts_view_id ON collection_posts(view_id);
```

Used for two view types:
- `type = 'collection'` — steward-curated post lists (replaces `posts_collections`)
- `type = 'track-actions'` — ordered action posts in a Track space (replaces `tracks_posts` ordering)

---

### 2.8 Tables eliminated — data migrated

| Table | What replaces it |
|-------|-----------------|
| `custom_views` | Data migrated into `group_views.settings` + `group_views.topics` |
| `custom_view_topics` | Topic names stored as jsonb in `group_views.topics` |
| `collections` | Data migrated — `collection_posts` now references `group_views` directly |
| `posts_collections` | Replaced by `collection_posts` |
| `funding_rounds_posts` | Posts migrated to `groups_posts` referencing the new funding round space group |
| `funding_rounds_users` | Users migrated to `group_memberships`; `tokens_remaining` → `group_memberships.settings.tokensRemaining` |
| `tracks_posts` | Action post ordering now tracked via `collection_posts` (view_id = the `track-actions` view) |
| `tracks_users` | Users migrated to `group_memberships`; `enrolled_at` → `settings.enrolledAt`, `completed_at` → `settings.completedAt` |
| `groups_tracks` | Replaced by `tracks.group_id` (1:1 relationship — each track has one space) |

---

### 2.9 Tables kept unchanged (notable)

| Table | Notes |
|-------|-------|
| `context_widgets` | Table kept as read-only recovery reference. All code removed. |
| `tag_follows` | Kept for chat notification preferences only — unread is not tracked here |
| `tags` / `group_tags` | Unchanged — topics remain for filtering/search |
| `group_relationships` | Unchanged — peer/affiliation relationships between groups |
| `widgets` / `group_widgets` | Unchanged — legacy explore/landing page |
| `tracks` | `name`, `description`, `banner_url`, `welcome_message`, `deactivated_at`, `access_controlled` removed; `group_id` added (→ space) |
| `funding_rounds` | `title`, `banner`, `description`, `deactivated_at` removed; `group_id` updated to point to the space |

---

## 3. Backend Model Changes

### 3.1 New model: `GroupView`

New file: `apps/backend/api/models/GroupView.js`

Associations:
```javascript
group()           → belongsTo(Group, 'group_id')
linkedGroup()     → belongsTo(Group, 'linked_group_id')
viewPost()        → belongsTo(Post, 'post_id')
viewUser()        → belongsTo(User, 'user_id')
collectionPosts() → hasMany(CollectionPost, 'view_id').orderBy('order')
viewsUsers()      → hasMany(GroupViewUser, 'view_id')
```

`topics` is a plain jsonb array of strings on the model, not a relationship.

Static methods:
- `GroupView.findForGroup(groupId, options)` — all views for a group, ordered by `order` ascending
- `GroupView.findHomeView(groupId)` — view with `order = 0`
- `GroupView.computeHomeRoutePath(view, group)` — returns URL string for `groups.home_route`
- `GroupView.reorder({ id, addToEnd, orderInFrontOfViewId, trx })` — updates order values (no nesting)
- `GroupView.setHomeView({ id, groupId, trx })` — sets target to `order = 0`, shifts others up or down by 1 as necessary

---

### 3.2 New model: `GroupViewUser`

New file: `apps/backend/api/models/GroupViewUser.js`

```javascript
view() → belongsTo(GroupView, 'view_id')
user() → belongsTo(User, 'user_id')
```

Static: `GroupViewUser.findOrCreate(viewId, userId)`, `GroupViewUser.markRead(viewId, userId)`, `GroupViewUser.incrementNewPostCount(viewId, userIds)`.

---

### 3.3 New model: `CollectionPost`

New file: `apps/backend/api/models/CollectionPost.js`

```javascript
view() → belongsTo(GroupView, 'view_id')
post() → belongsTo(Post, 'post_id')
```

Replaces `PostCollection`. Used for both collection views and track-actions ordering.

---

### 3.4 Changes to `Group` model

`apps/backend/api/models/Group.js`

Add associations:
```javascript
groupViews()   → hasMany(GroupView, 'group_id')
spaces()       → hasMany(Group, 'parent_id').query(q => q.where('type', 'space'))
parentGroup()  → belongsTo(Group, 'parent_id')
track()        → belongsTo(Track, 'track_id')
fundingRound() → belongsTo(FundingRound, 'funding_round_id')
```

Replace `setupContextWidgets(trx)` → `setupGroupViews(groupId, template, trx)` — seeds `group_views` rows from template config.

Add `setupSpaceViews(spaceId, acceptedPostTypes, trx)` — seeds views for a newly created space.

~~Remove `doesMenuUpdate()` entirely — no more auto-promotion of views.~~

Remove all calls to `setupContextWidgets()` from `Group.create()`.

---

### 3.5 Remove models

After migration and code cleanup:
- Remove `CustomView.js`, `CustomViewTopic.js` — table dropped, data in `group_views`
- Remove `Collection.js`, `PostCollection.js` — table dropped, data in `collection_posts`
- Remove `FundingRoundUser.js` — table dropped, data in `group_memberships`
- Remove `TrackUser.js` (if it exists as a model) — table dropped, data in `group_memberships`
- Remove ContextWidget models and related code

---

### 3.6 Changes to `Track` model

`apps/backend/api/models/Track.js`

- Remove `users()` relationship (table gone; use `group_memberships` via the track space)
- Remove `posts()` relationship (table gone; use `collection_posts` via the track-actions view)
- Remove `group()` / `groups()` relationship (table `groups_tracks` gone; replaced by `group()` via `group_id` FK)
- Add `group()` → `belongsTo(Group, 'group_id')` (the track's space)
- Remove fields: `name`, `description`, `banner_url`, `welcome_message`, `deactivated_at`, `access_controlled`
- Keep fields: `group_id`, `completion_message`, `published_at`, `completion_role_id`, `completion_role_type`, `num_actions`, `num_people_enrolled`, `num_people_completed`
- Track name/description/banner are accessed via `track.group.name` etc.

---

### 3.7 Changes to `FundingRound` model

`apps/backend/api/models/FundingRound.js`

- `group_id` now references the **space** group (not the parent group). Update all queries that used this to find the parent group — use `space.parent_id` instead.
- Remove `users()` relationship (table gone; use `group_memberships` via the round space)
- Remove `posts()` relationship (table gone; use `groups_posts` via the round space)
- Remove fields: `title`, `banner`, `description`, `deactivated_at`
- Round name/banner/description accessed via `round.group.name` etc.
- Add `group()` → `belongsTo(Group, 'group_id')` (the round's space)

---

### 3.8 Queries that must exclude spaces

Add `WHERE type != 'space'` or `WHERE parent_id IS NULL` wherever group lists are returned and spaces should not appear:

| Query / Context | Change |
|-----------------|--------|
| Global nav groups list | Exclude spaces |
| Related Groups view | Exclude spaces |
| Group search / explore | Exclude spaces |
| "My Groups" | Exclude spaces (spaces appear in the parent group's menu) |
| Group invitations | Exclude spaces, but add a separate section of Space Invitations |
| Cross-group post "To" field | Spaces included as sub-items of each group |
| `Group.memberships()` on user profile | Exclude spaces from primary list |

> **Task during implementation:** audit every call to `Group.find`, `fetchGroups`, `groupSlug` lookups in `apps/backend/api`.

---

## 4. GraphQL Schema Changes

### 4.1 New types

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
  settings: String
  collectionPosts: [Post]
  linkedGroup: Group
  viewPost: Post
  viewUser: Person
}

type GroupViewUser {
  id: ID
  view: GroupView
  user: Person
  newPostCount: Int
  lastReadPostId: ID
  settings: String
}
```

### 4.2 Changes to `Group` type

Add:
```graphql
groupViews: [GroupView]       # ordered list; type='space' entries include linkedGroup with its groupViews
spaces: [Group]               # all child spaces (including archived); used by More Spaces and admin UIs
parentGroup: Group
acceptedPostTypes: [String]
requiredRoles: [Int]
track: Track
fundingRound: FundingRound
```

Remove (Phase 6, after ContextWidget code removal):
```graphql
# contextWidgets, chatRooms, homeWidget
```

### 4.3 Remove types (Phase 6)

Remove `CustomView`, `Collection`, `GroupWidget` (from GraphQL schema and all resolvers).

### 4.4 New mutations

```graphql
# Views
createGroupView(groupId: ID!, type: String!, name: String, icon: String, settings: String, link: String, pageContent: String, topics: [String], orderInFrontOfViewId: ID, addToEnd: Boolean, linkedGroupId: ID, postId: ID, userId: ID): GroupView
updateGroupView(id: ID!, name: String, icon: String, settings: String, link: String, pageContent: String, topics: [String], orderInFrontOfViewId: ID, addToEnd: Boolean): GroupView
deleteGroupView(id: ID!): GenericResult
reorderGroupView(id: ID!, orderInFrontOfViewId: ID, addToEnd: Boolean): GenericResult
setHomeView(viewId: ID!, groupId: ID!): GenericResult

# Spaces
# createSpace also: (1) creates the space's default group_views rows (welcome at order=0, etc.)
#                   (2) creates a type='space' group_views row in the parent group (linked_group_id=new_space.id) at end of parent's menu order
createSpace(parentGroupId: ID!, name: String!, slug: String, acceptedPostTypes: [String], visibility: Int, accessibility: Int, icon: String, description: String, requiredRoles: [Int]): Group
updateSpace(id: ID!, name: String, slug: String, acceptedPostTypes: [String], visibility: Int, accessibility: Int, icon: String, description: String, requiredRoles: [Int], location: String, locationId: ID): Group
archiveSpace(id: ID!): Group
deleteSpace(id: ID!): GenericResult

# Space membership
joinSpace(spaceId: ID!): GroupMembership
leaveSpace(spaceId: ID!): GenericResult

# Unread
markViewAsRead(viewId: ID!): GroupViewUser
updateViewSettings(viewId: ID!, settings: String!): GroupViewUser

# Collection / Track action management
addPostToView(viewId: ID!, postId: ID!, order: Int): CollectionPost
removePostFromView(viewId: ID!, postId: ID!): GenericResult
reorderViewPost(viewId: ID!, postId: ID!, order: Int!): GenericResult
```

### 4.5 Remove mutations (Phase 6)

- `createContextWidget`, `updateContextWidget`, `deleteContextWidget`, `reorderContextWidget`, `removeWidgetFromMenu`, `setHomeWidget`
- `createCustomView`, `updateCustomView`, `deleteCustomView`
- `createCollection`, `updateCollection`, `deleteCollection`, `addPostToCollection` (old), `removePostFromCollection` (old)

---

## 5. Data Migration

One-time migration script. Must be idempotent. All steps run in a transaction.

### Step 1 — Add new columns and create tables

Run all DDL from Section 2. Do not drop old tables yet

### Step 1b — Migration defaults

Apply these defaults during migration for all existing groups and spaces:

1. **`accepted_post_types`:** leave `null` on all groups and spaces (all post types accepted). Do **not** restrict to only the post types that happen to have menu views. Stewards can narrow later in settings.
2. **Chat post notices:** set `groups.settings.showPostNoticesInChat = true` on all groups during migration. Chat views already support inline notices when other post types are created in the group/space (e.g. "Aaron posted a Discussion"). This helps groups that relied on `#general` as a catch-all feed. Can become a per-group/space setting later; ship enabled by default and gather feedback.
3. **Skip menu views that move to More Spaces:** do **not** migrate `all-topics`, or moderation widgets into `group_views` menu rows. moderation queue, and off-menu track/round spaces are surfaced via **More Spaces** instead. All Topics goes away
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

### 6.1 Keep current main group view routes

| Route | Component | Notes |
|-------|-----------|-------|
| `/groups/:groupSlug` | Redirects to `home_route` | Unchanged |
| `/groups/:groupSlug/all` | `GroupView` (type=all) | **New** |
| `/groups/:groupSlug/stream` | redirects to `/groups/:groupSlug/all` | Stream renamed to GroupView |
| `/groups/:groupSlug/map` | `GroupView` (type=map) | Unchanged |
| `/groups/:groupSlug/events` | `GroupView` (type=events) | Unchanged |
| `/groups/:groupSlug/members` | `GroupView` (type=members) | Unchanged |
| `/groups/:groupSlug/about` | `GroupView` (type=about) | Unchanged |
| `/groups/:groupSlug/custom/:viewId` | `GroupView` (type=custom) | Unchanged (viewId now = group_views.id) |
| `/groups/:groupSlug/collection/:viewId` | `GroupView` (type=collection) | **New** |
| `/groups/:groupSlug/discussions` | `GroupView` (type=discussions) |Unchanged |
| `/groups/:groupSlug/resources` | `GroupView` (type=resources) | Unchanged |
| `/groups/:groupSlug/requests-and-offers` | `GroupView` (type=requests-and-offers) | Unchanged |
| `/groups/:groupSlug/proposals` | `GroupView` (type=proposals) | Unchanged |
| `/groups/:groupSlug/welcome` | `GroupView` (type=welcome) | **New** |
| `/groups/:groupSlug/groups` | `GroupView` (type=related-groups) | Unchanged |
| `/groups/:groupSlug/all-views` | Redirect → `/groups/:groupSlug/more-views` | Backward-compat |
| `/groups/:groupSlug/more-views` | `MoreViewsPage` | Replaces All Views, Tracks, Funding Rounds, Archive |
| `/groups/:groupSlug/tracks` | Redirect → `/groups/:groupSlug/more-views` | Tracks now in More Spaces |
| `/groups/:groupSlug/funding-rounds` | Redirect → `/groups/:groupSlug/more-views` | Rounds now in More Spaces |

### 6.2 New space routes

Space slugs in URLs are the **local** portion (e.g., `general` not `my-community-general`).

| Route | Component |
|-------|-----------|
| `/groups/:parentSlug/spaces/:spaceSlug` | Redirect to space `home_route` |
| `/groups/:parentSlug/spaces/:spaceSlug/welcome` | `GroupView` (type=welcome) |
| `/groups/:parentSlug/spaces/:spaceSlug/all` | `GroupView` (type=all) |
| `/groups/:parentSlug/spaces/:spaceSlug/chat` | `GroupView` → renders `ChatRoom` |
| `/groups/:parentSlug/spaces/:spaceSlug/events` | `GroupView` (type=events) |
| `/groups/:parentSlug/spaces/:spaceSlug/members` | `GroupView` (type=members) |
| `/groups/:parentSlug/spaces/:spaceSlug/about` | `GroupView` (type=about) |
| `/groups/:parentSlug/spaces/:spaceSlug/custom/:viewId` | `GroupView` (type=custom) |
| `/groups/:parentSlug/spaces/:spaceSlug/collection/:viewId` | `GroupView` (type=collection) |
| `/groups/:parentSlug/spaces/:spaceSlug/track-actions` | `GroupView` (type=track-actions) |
| `/groups/:parentSlug/spaces/:spaceSlug/funding-round-submissions` | `GroupView` (type=funding-round-submissions) |
| `/groups/:parentSlug/spaces/:spaceSlug/settings` | `SpaceSettings` |
| _(all other view types follow same pattern)_ | |

### 6.3 Space Slug Strategy

`groups.slug` remains globally unique for all groups including spaces.

**Stored slug for spaces:** `{parentSlug}-{localName}` e.g. parent = `my-community`, space named "General" → stored slug = `my-community-general`.

**Routing:** `/groups/my-community/spaces/general` — the URL uses only the local portion. The backend derives the stored slug as `parentSlug + '-' + spaceSlug`.

**Collision handling:** if `my-community-general` already exists as a top-level group, append a number: `my-community-general-2`, `-3`, etc. Show this to the steward during space creation so they can adjust the name.

**Promoting a space to a group:** The stored slug stays `my-community-general`. It now appears as `/groups/my-community-general` — a valid globally-unique group slug.

**Editing slugs after creation:** Groups and spaces can change their URL slug after creation via Group Settings (top-level groups) or the space edit form (spaces). Slug changes update `groups.slug` (and for spaces, the stored `{parentSlug}-{localSlug}` form). New slugs must remain unique across all of hylo

---

### 6.4 Slug resolution helper

```javascript
// stored slug = parentSlug + '-' + localSlug
function resolveSpaceSlug(parentSlug, localSlug) {
  return `${parentSlug}-${localSlug}`
}
function localSpaceSlug(parentGroup, space) {
  return space.slug.replace(parentGroup.slug + '-', '')
}
```

### 6.5 `packages/navigation` updates

- Add `groupViewUrl(group, view)` — returns the correct URL for a view (main group or space context).
- Add `spaceUrl(parentGroup, space)` — returns `/groups/:parentSlug/spaces/:localSlug`.
- Add `localSpaceSlug(parentGroup, space)` — strips parent slug prefix.
- Keep all old `widgetUrl()` etc. until Phase 6 cleanup.

---

## 7. Frontend Component Changes

### 7.1 `Stream` → `ViewContent`

**Rename (done):** `apps/web/src/routes/Stream/` → `apps/web/src/routes/ViewContent/` (shim left at `routes/Stream` for Calendar SCSS / legacy imports)

`ViewContent.js` receives a `view` prop (from route or `group_view.type`) and renders:

```
viewType='all'                       → existing Stream UI (or defaultViewMode of the group_view.settings if it exists)
viewType='chat'                      → renders ChatRoom component (not merged, just rendered from here)
viewType='events'                    → existing calendar UI in Stream (defaultViewMode = 'calendar')
viewType='map'                       → MapExplorer
viewType='members'                   → Members UI
viewType='about'                     → About page
viewType='custom'                    → Stream with settings.postTypes/topics filters
viewType='discussions'               → existing discussions UI in Stream (defaultViewMode = 'list')
viewType='resources'                 → existing resources UI in Stream (defaultViewMode = 'grid')
viewType='requests-and-offers'       → existing requests and offers UI in Stream (defaultViewMode = 'bigGrid')
viewType='proposals'                 → existing proposals UI in Stream (defaultViewMode = 'cards')
viewType='projects'                  → existing projects UI in Stream (defaultViewMode = 'bigGrid')
viewType='collection'                → Collection post list (from collection_posts)
viewType='welcome'                   → Welcome view — renders special track/round section if space has track_id/funding_round_id, then page_content
viewType='groups'            → Related groups list
viewType='track-actions'             → Track action list (replaces tabbed TrackHome.jsx). Stewards add/reorder actions here when viewing as steward.
viewType='funding-round-submissions' → Submissions list (replaces tabbed FundingRoundHome.jsx)
viewType='link'                      → Not a route; ContextMenu opens in new tab
viewType='text'                      → Not a route; menu header only
viewType='separator'                 → Not a route; menu divider only
viewType='post'                      → Single post view
viewType='member'                    → Member profile view
viewType='group'                     → Navigate to the group
```

### 7.2 TrackHome and FundingRoundHome — remove tabs

**`TrackHome.jsx`:** Currently has tabbed interface. After this change:
- Tab UI removed entirely.
- Welcome view (`order = 0`, home): renders the track banner and track metadata (num_actions, num_people enrolled/completed), and the steward's editable `page_content` above it. **No enrollment CTA** — that belongs on the space join interstitial, not inside the space. The `welcome_message` field is removed from the `Track` model and populates the welcome page page_content initially; stewards rewrite their content in `page_content` after migration.
- Action list → `track-actions` view (`order = 1`). Posts ordered by `collection_posts`. Non-deletable. **Stewards add and reorder actions from this view** (when viewing as steward), not from group settings.
- Chat → `chat` view. Supports **post notices** for other post types in the space when `showPostNoticesInChat` is enabled (default on after migration).
- Members → `members` view. This directory shows **enrolled date and completed date** for each member, read from `group_memberships.settings.enrolledAt` and `group_memberships.settings.completedAt`. The existing completion badge logic is preserved.
- Navigation between views via the space's ContextMenu.
- `TrackPaywallOfferingsSection` removed — paywall handled by general space paywall

**`FundingRoundHome.jsx`:** Currently has About/People/Submissions/Manage/Chat tabs. After:
- About tab → `welcome` view (`order = 0`, home). Renders welcome page_content, and also round banner, phase status, timeline dates, voting method... below. **No join CTA** inside the space.
- Submissions → `funding-round-submissions` view (`order = 1`). Non-deletable.
- People tab → `members` view. This directory shows each member's **role in the round** — whether they can submit and/or vote, derived from `funding_round.submitter_roles` and `funding_round.voter_roles` cross-referenced with the member's group roles.
- Chat tab → `chat` view.
- The existing `AboutTab`, `SubmissionsTab`, `ManageTab` sub-components are repurposed as renderers within their respective `GroupView` types.
- **Track / funding round management** (phase dates, publish, enrollment settings, etc.) → **Space settings modal**, not a separate Manage tab or group settings page.

**Space join interstitial (new):** When a non-member navigates to any space, they see an interstitial page (not the full space content) showing:
- Space name, icon, description, member count
- For **track spaces**: num_actions, num_people enrolled, published/draft status
- For **funding round spaces**: phase status, submission open/close dates, voting dates — especially "opens on [date]" if not yet launched
- Join / Request to Join button (or paywall CTA if the space is paywalled)

### 7.3 ContextMenu redesign

`apps/web/src/routes/AuthLayoutRouter/components/ContextMenu/ContextMenu.jsx`

**Data loaded:** `group.groupViews` — a single ordered list that includes both regular views and `type = 'space'` entries. For each `type = 'space'` entry, load `linkedGroup.groupViews` (the space's own views, for rendering the expanded sub-menu).

**Example Menu structure:**
```
[Group Name]
  All Activity      [●]          ← type=all, order=0
  Chat              [●]          ← type=chat
  Events                         ← type=events
  ─────────────────              ← type=separator
  Resources
  Working Group ▶               ← type=space, linked_group_id=X, expand chevron
    ↳ Chat          [●]          ← space's own group_views
    ↳ Members
  Funding Round 2026 ▶           ← type=space, linked_group_id=Y
    ↳ (collapsed)
  ─────────────────
  Members
  About

  ─────────────────              ← always-visible bottom section (when applicable)
  Join Requests       [●]          ← spaces only: shown when pending join requests exist
  More Views & Spaces             ← link to /more-views (tracks, rounds, moderation, drafts, archived spaces)
```

**Not in the menu:** Moderation, All Topics, Tracks list, Funding Rounds list — all live under **More Spaces**.

**New `GroupViewMenuItem` component:**
- Props: `view`, `isActive`, `spaceExpanded`, `onToggleSpace`
- Renders based on `view.type`:
  - `text` → non-clickable section label
  - `separator` → `<hr>`
  - `space` → space row using `view.linkedGroup.name` (or `view.name` override), expand chevron, unread dot aggregated from space's views
  - `link` → `<a target="_blank">` with external icon
  - All others → `<Link to={groupViewUrl(group, view)}>` with unread dot if `newPostCount > 0`

**Collapsed/expanded space state:** local component state. Clicking a space navigates to its home view AND expands it. Currently active space auto-expands on load.

**Unread indicators:** orange dot only, no count. View level, space level, group header level all use dots.

**Edit mode** (`?edit=yes`, admin only):
- Simple drag-and-drop vertical list (no nested containers).
- Per-row: settings gear which opens settings modal with different settings per view type. Custom view enables editing name, icon, settings for example. Also set as home and delete buttons.
- Clicking settings icon next to a `welcome` type view → opens welcome page editor (replaces `WelcomePageTab`).
- "Add View" → picker of available view types.
- "Add Space" → space creation form.

### 7.4 ContextMenu — always-visible bottom section

**For spaces:** when there are pending join requests, show a **Join Requests** menu item with unread indicator → space join request queue.

**For all other views and spaces:** **More Views & Spaces** link → `/groups/:slug/more-views` (or space equivalent). Shown when there is anything to display there (off-menu spaces, track/round drafts, moderation, archived spaces). Replaces separate Tracks / Funding Rounds

### 7.5 Welcome page editing

The `WelcomePageTab` at `apps/web/src/routes/GroupSettings/WelcomePageTab/WelcomePageTab.js` is **removed**.

Instead:
1. Steward puts ContextMenu in edit mode (`?edit=yes`).
2. Clicks the settings icon next to the `Welcome` view row.
3. A settings modal/drawer opens containing:
   - Markdown editor for `page_content`
   - Toggle for `group.settings.show_welcome_page` (whether to show welcome page to new members on first visit)
4. Save calls `updateGroupView(id, pageContent: "...")` + `updateGroupSettings(settings: {...})`.

### 7.6 Group Settings tab — accepted post types

In `apps/web/src/routes/GroupSettings/GroupSettingsTab/GroupSettingsTab.js`:

Add a **Post Types** section with pill toggles:
- Discussion
- Event
- Request & Offer _(one pill for both)_
- Resource
- Proposal
- Project

Toggle off = removes from `accepted_post_types`. Calls `updateGroup` mutation.

Add a **Chat** section with toggle:
- **Show post notices in chat** (`groups.settings.showPostNoticesInChat`) — when enabled, the chat view shows inline notices when other post types are created in the group/space. **Default: on** (set during migration for all groups). Per-group/space setting going forward.

Add **URL slug** field — editable after creation for top-level groups.

Show a warning: turning off a post type hides those views from the menu but does not delete existing posts.

### 7.7 Map view — spaces on the map

The **Map** view (`type = map`) shows:

- Posts with locations from the current group/space
- **Related groups** (peer/affiliation relationships) in the map drawer
- **Spaces** that have a `location` set — in the same drawer as groups, with **distinct styling** so spaces are visually distinguishable from child groups

Clicking a space marker or drawer entry navigates to that space.

### 7.8 Remove settings tabs

- **Custom Views tab** → remove. Custom views managed from ContextMenu edit mode.
- **Welcome Page tab** → remove. Welcome view edited from ContextMenu edit mode.
- **Tracks tab** → remove. Track settings accessible from Track space settings
- **Funding Rounds tab** (if separate) → remove. Same.

### 7.9 Post creation changes

In the post creation modal:

- **"To" field:** flat list — groups the user is in, with indented spaces per group that accept the selected post type (same layout as current groups + chat rooms list).
- **Chat posts:** no space selector — created from chat box in the current chat view. Group/space is implicitly the current one.
- **Non-chat posts:** gets added view groups_posts to each group or space selected in the flat To field list

### 7.10 Space management UI

Accessible from ContextMenu edit mode ("Add Space" button). Requires **Manage Spaces** responsibility in the parent group (assignable to any role — not limited to Coordinators). To edit, use the gear icon next to the space name when the menu is in edit mode.

**Roles in spaces:**
- Spaces **inherit roles from the parent group at lookup time**. No `groups_roles` or role-assignment rows are stored on the space. Per-space custom role sets are **not** supported.
- Joining a space does not change roles; it unlocks the member’s **existing parent-group roles** inside that space.
- Role editing remains only in the parent group role editor.
- Space settings (create/update/archive/delete) are gated by **Manage Spaces** or **Administration on the parent** — parent stewards do not need to be space members to manage settings from the parent menu.
- **Parent group stewards are not automatically added** to every space — membership is explicit (join, invite, or creation). The space creator is added as a space member; their parent roles apply immediately.

**Create/edit Space form:**
1. Name + slug (auto-generated)
2. Icon (Lucide picker)
3. Description
4. Location (optional — shows space on parent map when set)
5. Accepted post types (pill toggles)
6. Initial views (checkboxes for common view types) is displayed during creation, afterwards edited directly in the menu.
7. **Access** — single selector setting both `groups.visibility` and `groups.accessibility`:
   - **Open to all** — anyone in the group can see and join _(protected, open)_
   - **Restricted** — anyone in the group can see it, but must request to join _(protected, restricted)_
   - **Role-gated** — only members with a specific role can see and join _(protected, open; sets `required_roles`)_. Shows role picker when selected.
   - **Paid** — anyone can see it, but must pay to join _(protected, restricted; sets `group.paywall = true`)_. Only shown if the parent group has paid content enabled.
   - **Hidden / Invite only** — stewards must invite members directly _(hidden, closed)_

When editing a space there is an archive and delete button in the edit form.

There is also a tab or section to invite members to the space, via invite link or email, like other groups.

### 7.11 Space invites

Space invitations surface in **My Invites** (the existing invites UI in the My context). No new UI needed — invite system works for spaces since they are groups. Ensure invite flows handle `parent_id IS NOT NULL` correctly.

---

## 8. Notifications & Unread Tracking

### Per-view unread counting

When a post is created in a group/space, increment unread for matching surfaces for all members except the author:

| Post type | Surfaces incremented |
|-----------|------------------|
| Any (except none for membership) | `group_memberships.new_post_count` (group/space orange dot) |
| `chat` | `chat` view (always); also typed views N/A |
| `discussion` | `discussions` + `chat` (when post notices on) |
| `event` | `events` + `chat` (when notices on) |
| `request` or `offer` | `requests-and-offers` + `chat` (when notices on) |
| `resource` | `resources` + `chat` (when notices on) |
| `proposal` | `proposals` + `chat` (when notices on) |
| `project` | `projects` + `chat` (when notices on) |

**Do not** increment `all`, `custom`, or other non-badge views.

When `settings.showPostNoticesInChat === false`, chat only increments for `type === chat`.

### Resetting unread

- **Open group/space** → clear `group_memberships.new_post_count` (`updateLastViewed` / `FETCH_FOR_GROUP`). Does **not** clear per-view badges.
- **Open typed view** (Events, Proposals, …) → `markViewAsRead(viewId)` → `new_post_count = 0`, advance `last_read_post_id`.
- **Chat** → `updateGroupViewUser` while scrolling / jump-to-latest (numbered recount). Do not blindly `markViewAsRead` on chat enter.
- **Mark as Read** (GlobalNav right-click) → `markGroupAsRead(groupId)` zeros membership + every view in the group.
- All Activity does not cascade-clear other views.

### Indicators

- **Chat:** orange badge **with number** if `newPostCount > 0`.
- **Typed common views:** orange **dot** (no number) if `newPostCount > 0`.
- **All Activity / custom / other views:** no badge.
- **Space** (in parent menu): orange dot from **space membership** `newPostCount` (same as groups).
- **Group** (global nav): orange dot if membership `newPostCount > 0`. No number.

Duplication between chat number and typed-view dots when post notices are on is intentional.

### Notification settings precedence

1. `group_views_users.settings` (per view — most specific)
2. `group_memberships.settings` for the space
3. `group_memberships.settings` for the parent group (fallback)

### Digest emails

Posts from spaces the user has joined are included in the parent group digest. Spaces do not have their own digest email. Email template may need a space name section header. Design/template task.

---

## 9. Search

### Frontend

Per-view search box (inherited from Stream) filters posts within the current view. No UI change needed.

### Backend update

Group-level search must now include child spaces. Update `searchQuery` to include:
```sql
posts.id IN (
  SELECT post_id FROM groups_posts
  WHERE group_id = :groupId
     OR group_id IN (
       SELECT id FROM groups WHERE parent_id = :groupId AND type = 'space'
     )
)
```

Also filter spaces from group search results when searching for groups.

---

## 10. Group & Space Creation

### New group creation

1. Existing flow continues.
2. **Add step:** template selection. Template pre-configures `accepted_post_types` and initial views.
3. Replace `Group.setupContextWidgets()` with `Group.setupGroupViews(groupId, template, trx)`.

**Default views for all new groups (unless template overrides):**
- `all` (All Activity), order=0 (home)
- `chat`, order=1
- `map`, order=2
- `members`, order=3
- `about`, order=4
- Type-specific views for each enabled post type in order after chat, before map

### New space creation

- Requires **Manage Spaces** responsibility in the parent group (assignable to any role).
- Via ContextMenu edit mode "Add Space" button.
- `createSpace` mutation → creates `groups` row with `type = 'space'`, `parent_id`, then calls `Group.setupSpaceViews()`.
- Creator is added as a **space member** . Their parent-group roles apply inside the space.
- Automatically adds a `type = 'space'` `group_views` row in the parent group's menu.

### Track/Funding Round space creation (after Phase 4)

Creating a new Track or Funding Round automatically creates its space:
- Both seed: `welcome` (order=0, home), specialized view (order=1, non-deletable), `chat` (order=2), `members` (order=3).
- Track space: uses `track_id` on groups; welcome view's `page_content` defaults to `track.welcome_message`.
- Funding Round space: uses `funding_round_id`; welcome view's `page_content` defaults to round description.

---

## 11. More Views and Spaces

Route: `/groups/:groupSlug/more-views` (Edit Menu: same route with `?edit=true`)

Center-column **card grid** (same chrome as ContextMenuGrid) of items not in the ordered menu:

| Section | Content |
|---------|---------|
| **Views** | Soft-removable GroupViews with `order = null` (common stream views, welcome, about, related-groups, moderation, …). Related Groups card is hidden when the group has no relationships. |
| **Tracks** | Off-menu track spaces (published and draft). |
| **Funding Rounds** | Off-menu funding round spaces (published and draft). |
| **Other Spaces** | Other off-menu spaces, including archived (`active = false`). |

**Related groups** are only listed via the Related Groups view (not as a More Views section).

**Soft remove vs delete:** Common views and spaces use **X** in edit mode to set `order = null` (appear here). Custom / collection / link / text / separator / post / member / group views are hard-deleted. Spaces can be fully deleted from edit mode with a trash action + warning.

**Navigation:** In-menu space click expands nested views under the row. Clicking a space here drills into the space menu (Back returns to the group).

**Edit mode** (`?edit=true`): help text, Add View / Add Space, Welcome toggles, hover **+** to add to menu, Done Editing.

---

## 12. Steward Onboarding Prompt

After migration, the first time a group steward logs in, show a modal:

**Content:**
1. Short summary of changes
2. Link to blog post / changelog
3. Buttons:
   - **"Edit my group menu"** → opens ContextMenu with `?edit=yes`
   - **"Review post types"** → links to Group Settings general tab
4. "Got it, I'll do this later" dismiss

**Trigger:** A flag in `group_memberships.settings` (e.g., `sawSpacesOnboarding: true`) set on dismiss.

**Groups needing extra attention** (logged during migration):
- Groups where home view changed because a track/funding round was the old home
- Groups where `#general` was the main home chat

These get a slightly more detailed prompt describing the specific change.

---

## 13. Out of Scope / Future Work

- Per-space custom role definitions (spaces inherit parent group roles at lookup time; role editing stays on the parent)
- Renaming the word "space" in the UI (e.g. "circles") — not for initial rollout
- View type aliases (e.g. Events → Calendar, Chat → Watercooler) — ship with consistent names; revisit if demand is high
- Archiving views (hide without deleting) — views are in menu or deleted; only spaces archive
- Group and space templates UI (Phase 1 uses hardcoded defaults)
- Chat activity cards in All Activity stream
- Pinned posts per view
- Kanban view mode
- Promote a Space to a Group (architecture supports it; no UI)
- Analytics per space
- Moderation queue scoped per space
- Category system for posts
- Project posts → Project Spaces migration
- Tool Lending Library space type
- Editable Pages (Welcome page extensions)
- Use the separate notification settings per view

---

## 14. Phased Rollout

Legend: ✅ done · 🟡 partly done · `-` not done

### Phase 1 — Database & Backend

✅ Add `parent_id`, `accepted_post_types`, `required_roles`, `track_id`, `funding_round_id` to `groups` (also shipped: `groups.icon`)
✅ add `group_id` to `tracks`
✅ Create `group_views`, `group_views_users` tables (collection ordering uses `collections_posts.view_id`, not a renamed `collection_posts` table)
✅ Create `GroupView`, `GroupViewUser`, `CollectionPost` models
✅ Update `Group`, `Track`, `FundingRound` models (space associations / membership path; display-column drops still pending — see Phase 7)
✅ GraphQL: add new types, queries, all mutations in Section 4 (plus extras: `setGroupViewHidden`, `markGroupAsRead`, `updateGroupViewUser`, `reorderViewPost`)
✅ Keep all ContextWidget code active in parallel during transition
✅ Data migration: ContextWidgets → `group_views`; tracks / funding rounds / non-`#general` chats → spaces; `group_views_users` backfill; home routes
✅ Manage Spaces responsibility (replaces separate Manage Tracks / Rounds for space creation)

### Phase 2 — Navigation UI (web)

✅ Rename `Stream` → `ViewContent`; update `AuthLayoutRouter` routes (my/public/all/topics + group/space; group/space `/stream` redirects to `/all`)
🟡 Redesign `ContextMenu`: `GroupViewMenuItem`, space expand/collapse, unread dots, bottom section (Join Requests + More Views & Spaces) — **still to do:** Join Requests is still under Group Settings menu, not the ContextMenu footer;
✅ Add edit mode (`?edit=true`), view settings in edit mode
✅ Remove `WelcomePageTab`, `CustomViewsTab`, `TracksTab` from Group Settings
🟡 Add accepted post type pill toggles and chat post-notices toggle to GroupSettingsTab — **still to do:** post-type pills are in GroupSettingsTab; `showPostNoticesInChat` toggle lives on chat view settings (`GroupViewSettingsModal`), not GroupSettingsTab
✅ `MoreViewsPage` (“More Views and Spaces”) — card grid with Views / Tracks / Funding Rounds / Other Spaces sections (spec §11; soft-hide via `order = null`)
🟡 Navigation package: `groupViewUrl()`, `spaceUrl()`, `localSpaceSlug()` — **still to do:** no `groupViewUrl()` helper by that name; shipped as `spaceUrl()`, `localSpaceSlug()`, `groupViewPath()`, `spaceGroupViewUrl()` (+ web `menuViewUrl`)
- Redirect old routes (`/all-views`, `/tracks`, `/funding-rounds`) → `/more-views`
✅ Welcome page loads from welcome type view. Still store whether to show welcome page to new members on first visit in `group.settings.showWelcomePage`

### Phase 3 — Space Management

✅ "Add Space" / edit space UI in ContextMenu edit mode (`AddSpaceDialog`, gear → `SpaceSettingsModal`)
✅ Space creation form + mutations wired up (`createSpace` / `updateSpace` / `setupSpaceViews` + parent menu `type=space` row)
🟡 Space membership join/leave UI (preview for non-members) — **still to do:** `SpaceJoinPage` interstitial + `joinSpace` done (open / request / role-gated / paid); `leaveSpace` exists on backend but is not wired in the web UI
- Archive/unarchive space UI (`archiveSpace` exists on backend; web only shows archived spaces in More Views — no archive/unarchive actions)
✅ Space Settings modal
🟡 Space invites in My Invites — **still to do:** spaces are groups so generic invite plumbing can apply; no dedicated space invite tab/section in space settings yet, and My Invites has not been verified/updated for a separate Space Invitations section

### Phase 4 — Paid / Paywalled Spaces

Generalizes the existing track paywall to work for any space. A group with paid content enabled can set any space to "Paid" access. Supports **both one-time payments and subscriptions** (not one-time only).

**Backend:**
🟡 Existing Stripe offerings/products currently linked to `tracks.id` → change to link to `groups.id` (the space group) — **still to do:** dual `groupIds` / `trackIds` path still present; full cutover blocked on shipping `migrations/in-progress/20260714120000_paid_spaces_from_tracks.js`
- "Add Track for an offering" flow → "Add Space for an offering"
🟡 Offerings support one-time and subscription billing intervals (same as existing paid content infrastructure, generalized to spaces) — **still to do:** billing intervals already exist for paid content; generalization to arbitrary spaces incomplete until Stripe association cutover ships
🟡 `track.access_controlled` migration → set `group.paywall = true` on track spaces; migrate existing Stripe product association to the space group id — **still to do:** script exists under `migrations/in-progress/` but is not shipped; `Track` / enroll still check `access_controlled`
🟡 Paywall scope/access check switches from checking track access to checking space membership — **still to do:** space `paywall` flag + join interstitial work; track enroll path not fully retired

**Space join interstitial — paid CTA:**
✅ When a non-member views a paywalled space, the interstitial shows the available offerings (`SpaceJoinPage` + `PaywallOfferingsSection`)
🟡 Purchasing an offering creates a `group_memberships` row with paid status — **still to do:** works for paywalled groups generally; confirm end-to-end for space-group Stripe product ids after cutover migration

**Frontend:**
✅ Remove `TrackPaywallOfferingsSection` from `TrackHome.jsx` (`TrackHome` removed entirely)
✅ Create generalized space join interstitial (`SpaceJoinPage`) that handles: open join, restricted request, role-gated notice, paid offering, hidden/invite notice
✅ "Paid" option in space creation/edit form gated by parent group's paid content setting

**Migration within this phase:**
🟡 For each track where `access_controlled = true`: set the track space's `group.paywall = true`, reassign the Stripe product from `tracks.id` to the new space `groups.id` — **still to do:** in-progress migration not applied

### Phase 5 — Tracks & Funding Rounds as Spaces

✅ Remove tabs from `TrackHome.jsx`, `FundingRoundHome.jsx` (components removed; views live under space routes)
✅ `GroupView` / `ViewContent` rendering for `track-actions` and `funding-round-submissions` types
🟡 `welcome` view for track/funding round spaces renders special section + page_content — **still to do:** funding round welcome/about info (`FundingRoundAboutInfo`) shipped; track-specific welcome metadata section (num actions / enrolled / etc.) still incomplete
✅ Track/Funding Round creation flow auto-creates a space (via `AddSpaceDialog`: `createSpace` then `createTrack` / `createFundingRound`)
✅ `collections_posts` for track action ordering (`TrackActionsView` + view `collectionPosts`)
🟡 Track member directory shows `enrolledAt` / `completedAt` from `group_memberships.settings` — **still to do:** `completedAt` shown; `enrolledAt` not shown in Members directory UI
✅ Funding round member directory shows submit/vote role badges

### Phase 6 — Post Creation & Content Aggregation

✅ Space selector in post creation modal (groups + indented child spaces in To field)
🟡 `accepted_post_types` enforcement — **still to do:** frontend filters types/spaces in `PostEditor` / menu; backend `createPost` does not yet reject disallowed types
✅ `groups_posts` associations for space posts (spaces are groups; posts associate normally)
- Main Space "All Activity" aggregates from child spaces user is in (`viewPosts` / `childPostInclusion` still use `group_relationships` child groups, not `groups.parent_id` spaces). Flag posts from child spaces as from Child Space instead of Child Group.
- Backend search includes child spaces (and exclude spaces from group search results)
- Audit / exclude spaces from group list queries (global nav, related groups, explore, My Groups, invitations, profile memberships) — §3.8

### Phase 7 — Notifications, Cleanup & Mobile

✅ `group_views_users` unread increment on post creation (typed views + chat; also decrement on delete)
✅ Per-view unread dots in ContextMenu (numbered chat; dots for typed views)
✅ `markViewAsRead` on typed view navigation
✅ `markGroupAsRead` from GlobalNav
- Steward onboarding prompt
🟡 Remove all ContextWidget code (model, GraphQL, frontend) — **still to do:** new menu is default (`useGroupViews`); legacy `ContextMenuOld`, contextWidgets store/actions, GraphQL, and `Group.setupContextWidgets()` (still called from `Group.create`) remain
✅ Get rid of Group `doesMenuUpdate` method
🟡 Drop `tracks_posts`, `tracks_users`, `funding_rounds_posts`, `funding_rounds_users`, `groups_tracks` — **still to do:** data migrated; table/column drops live in `migrations/in-progress/20260713120000_spaces_cleanup.js` (not shipped); `groups_tracks` rows cleared but table drop not shipped
- Drop `custom_views`, `custom_view_topics`, `collections`
- Remove `collections_posts.collection_id` column
- Remove `#general` tag from all posts
✅ Remove `group.welcome_page` / welcome page content columns (migrated onto welcome views)
- Replace `Group.setupContextWidgets()` on create with `Group.setupGroupViews(groupId, template, trx)` (today: still seeds ContextWidgets; optional `view_types` → `setupSpaceViews`)
- Mobile app navigation (separate ticket)

---

### Already shipped (major items not listed above)

These landed during implementation and should be treated as part of the current system of record:

| Change | Notes |
|--------|-------|
| Route `/more-views` + soft-hide model | Spec §11; menu footer + Edit Menu open More Views and Spaces. Common views/spaces set `order = null` instead of hard-delete. |
| `ContextMenuGrid` one-column home | Simple groups use a card-grid home dashboard instead of the vertical ContextMenu. |
| Space role inheritance | Effective permissions = space membership ∩ parent role responsibilities via `COALESCE(parent_id, id)` / `Group.roleScopeId`. No per-space role rows. |
| `groups.icon` | Lucide/icon string on spaces (and groups) for menu display. |
| Chat unread recalculation migration | `20260723120000_recalculate_chat_new_post_counts.js` |
| Off-menu / system view ensure migrations | `20260723140000_*`, `20260723160000_*` — ensure common off-menu views exist for More Views. |
| Digests via `GroupViewUser` | Space posts included through view-user digest path; parent-group digest template space headers still future work (§8). |
| `ManageRoundView` synthetic menu item | Steward manage entry for funding rounds outside normal `group_views` rows. |
| `SpaceGroupContext` / `useEffectiveGroupSlug` | Web routing helper for resolving space vs parent slug in nested space routes. |
| Space visibility helpers | `util/spaceVisibility.js` + paywall arg on create/update space. |
| In-progress (unshipped) migrations | `migrations/in-progress/20260713120000_spaces_cleanup.js`, `migrations/in-progress/20260714120000_paid_spaces_from_tracks.js` |
