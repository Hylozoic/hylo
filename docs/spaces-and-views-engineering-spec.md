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
11. [Archive](#11-archive)
12. [Steward Onboarding Prompt](#12-steward-onboarding-prompt)
13. [Out of Scope / Future Work](#13-out-of-scope--future-work)
14. [Phased Rollout](#14-phased-rollout)

---

## 1. Core Concepts

| Concept | Definition |
|---------|------------|
| **Space** | A container for content inside a group. Every group has one implicit **Main Space** (views whose `group_id` = the group's own id). Additional spaces are child groups with `type = 'space'`. |
| **Main Space** | Not a separate DB row. The `group_views` rows where `group_id = group.id` are the group's Main Space views. |
| **View** | A named entry in the group menu that opens a specific UI. Defined by a row in `group_views`. `order = 0` is the home view. Views are either in the menu or don't exist — there is no hidden/archived state for views, only for spaces. |
| **View Mode** | A UI variant for displaying posts in a view (Stream, Grid, Map, Calendar). Stored as user preference or in `group_views.settings.defaultViewMode`. |
| **Group** | Unchanged top-level concept. Top-level groups have `parent_id = null`. Spaces have `parent_id` pointing to their parent group. |

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
| `accepted_post_types` | JSON array of accepted post type strings. `null` = all types accepted. `[]` = archive-only space. |
| `required_roles` | JSON array of role IDs (from `common_roles` for Phase 1). If set, space only visible to members with one of those roles in the parent group. |
| `track_id` | If set, this group is a Track/Course space. References the `tracks` table. |
| `funding_round_id` | If set, this group is a Funding Round space. References the `funding_rounds` table. |

`type` column already exists on `groups`. Add `'space'` as a new valid value.

`home_route` column stays — still used for fast redirect to home view without loading group_views. Format updated during migration to match new URL patterns (e.g. `/groups/:parentSlug/spaces/:spaceSlug` for space home views).

---

### 2.2 `tracks` table — columns removed and added

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
- `banner_url` → `groups.banner_url` (or `avatar_url` — confirm which field)
- `deactivated_at` → archive the space (`groups.deactivated_at`) if set
- `access_controlled` → set space to paid (see Phase 4 Paid Spaces)

---

### 2.3 `funding_rounds` table — columns removed, `group_id` updated

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

### 2.4 Roles consolidation — eliminate `common_roles`

System roles (Coordinator, Moderator, Host) are stamped out as `groups_roles` rows for each group, collapsing two parallel role tables into one.

**DDL changes:**

```sql
-- Add type column to groups_roles to distinguish system vs custom roles
ALTER TABLE groups_roles ADD COLUMN type varchar NOT NULL DEFAULT 'custom';

-- Drop the now-redundant tables (after migration)
DROP TABLE group_memberships_common_roles;
DROP TABLE common_roles_responsibilities;
DROP TABLE common_roles;
```

**Group setup — new system role rows per group:**

When a group is created (and during migration for existing groups), insert one row in `groups_roles` for each system role, linked to their responsibilities via `group_roles_responsibilities`:

```js
const SYSTEM_ROLES = [
  { name: 'Coordinator', responsibilities: ['Administration', 'Add Members', 'Remove Members', 'Manage Content', 'Manage Tracks', 'Manage Rounds'] },
  { name: 'Moderator',   responsibilities: ['Manage Content', 'Remove Members'] },
  { name: 'Host',        responsibilities: ['Add Members'] }
]
```

Responsibilities are looked up by **`name` AND `type = 'system'`** — never by hardcoded id — because ids may differ across databases and group-custom responsibilities can reuse the same name.

**Migration:**

For each existing group:
1. Create 3 `groups_roles` rows (`type = 'system'`, one per system role)
2. For each new row, link its responsibilities via `group_roles_responsibilities` (looked up by name + type='system')
3. For each `group_memberships_common_roles` row: insert an equivalent `group_memberships_group_roles` row using the newly created per-group system role id
4. Migrate admin-only chat room spaces: set `required_roles = [<coordinator role id for that group>]`

**After consolidation:**

- `required_roles` on spaces stores `groups_roles.id` values exclusively
- All permission checks use a single query path (no more UNION across `common_roles_responsibilities` and `group_roles_responsibilities`)
- System roles are identified by `groups_roles.type = 'system'` — stewards cannot edit them in the UI (but the architecture allows it in future)
- Cross-group queries: `groups_roles WHERE type = 'system' AND name = 'Coordinator'` joined to `group_memberships_group_roles`

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
| `requests-offers` | null | optional | — | — | — | — | — | — | — |
| `resources` | null | optional | — | `{defaultViewMode}` | — | — | — | — | — |
| `governance` | null | optional | — | — | — | — | — | — | — |
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
| `group` | optional | optional | — | — | — | — | — | — | ✓ |
| `text` | **required** | optional | — | — | — | optional | — | — | — |
| `separator` | — | — | — | — | — | — | — | — | — |

No `visibility` column — all views in a space are visible to all members of that space. Role-gating happens at the space level via `groups.required_roles`.

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
| `common_roles` | System roles stamped out per group into `groups_roles`. No longer needed as a separate table. |
| `common_roles_responsibilities` | System role→responsibility links moved to `group_roles_responsibilities` for the new per-group system role rows |
| `group_memberships_common_roles` | Rows migrated to `group_memberships_group_roles` using new per-group system role ids |

---

### 2.9 Tables kept unchanged (notable)

| Table | Notes |
|-------|-------|
| `context_widgets` | Table kept as read-only recovery reference. All code removed. |
| `tag_follows` | Kept — may be useful for future features unrelated to chat rooms |
| `tags` / `group_tags` | Unchanged — topics remain for filtering/search |
| `group_relationships` | Unchanged — peer/affiliation relationships between groups |
| `widgets` / `group_widgets` | Unchanged — legacy explore/landing page |
| `groups_roles` | Add `type varchar NOT NULL DEFAULT 'custom'` column. System roles get `type = 'system'`. |
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
- `GroupView.setHomeView({ id, groupId, trx })` — sets target to `order = 0`, shifts others up by 1

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

Remove `doesMenuUpdate()` entirely — no more auto-promotion of views.

Remove all calls to `setupContextWidgets()` from `Group.create()`.

---

### 3.5 Remove models

After migration and code cleanup:
- Remove `CustomView.js`, `CustomViewTopic.js` — table dropped, data in `group_views`
- Remove `Collection.js`, `PostCollection.js` — table dropped, data in `collection_posts`
- Remove `FundingRoundUser.js` — table dropped, data in `group_memberships`
- Remove `TrackUser.js` (if it exists as a model) — table dropped, data in `group_memberships`

---

### 3.6 Roles model changes

**`GroupRole` model** (`apps/backend/api/models/GroupRole.js`):
- Add `type` field (`'system' | 'custom'`)
- Add `setupSystemRoles(groupId, { transacting })` class method — creates the 3 system role rows and their responsibility links for a group (used on group creation and during migration). Looks up responsibility ids by `name AND type = 'system'` — never by hardcoded id.

**`Responsibility` model** (`apps/backend/api/models/Responsibility.js`):
- `fetchForUserAndGroupAsStrings` — remove the UNION branch for `common_roles_responsibilities`; query `group_roles_responsibilities` only
- `fetchSystemResponsiblititesForUser` — same, remove UNION branch
- `fetchForGroup` — same
- `fetchAll` — remove `commonRoleId` branch
- Remove `Common` static (hardcoded ids) — replace any remaining usages with name lookups

**`CommonRole` model** — **deleted**

**`MemberCommonRole` model** — **deleted**

---

### 3.7 Changes to `Track` model

`apps/backend/api/models/Track.js`

- Remove `users()` relationship (table gone; use `group_memberships` via the track space)
- Remove `posts()` relationship (table gone; use `collection_posts` via the track-actions view)
- Remove `group()` / `groups()` relationship (table `groups_tracks` gone; replaced by `group()` via `group_id` FK)
- Add `group()` → `belongsTo(Group, 'group_id')` (the track's space)
- Remove fields: `name`, `description`, `banner_url`, `welcome_message`, `deactivated_at`, `access_controlled`
- Keep fields: `group_id`, `completion_message`, `published_at`, `completion_role_id`, `completion_role_type`, `num_actions`, `num_people_enrolled`, `num_people_completed`
- Track name/description/banner are accessed via `track.group.name` etc.

---

### 3.8 Changes to `FundingRound` model

`apps/backend/api/models/FundingRound.js`

- `group_id` now references the **space** group (not the parent group). Update all queries that used this to find the parent group — use `space.parent_id` instead.
- Remove `users()` relationship (table gone; use `group_memberships` via the round space)
- Remove `posts()` relationship (table gone; use `groups_posts` via the round space)
- Remove fields: `title`, `banner`, `description`, `deactivated_at`
- Round name/banner/description accessed via `round.group.name` etc.
- Add `group()` → `belongsTo(Group, 'group_id')` (the round's space)

---

### 3.9 Queries that must exclude spaces

Add `WHERE type != 'space'` or `WHERE parent_id IS NULL` wherever group lists are returned and spaces should not appear:

| Query / Context | Change |
|-----------------|--------|
| Global nav groups list | Exclude spaces |
| Related Groups view | Exclude spaces |
| Group search / explore | Exclude spaces |
| "My Groups" | Exclude spaces (spaces appear in the parent group's menu) |
| Group invitations | Exclude spaces |
| Cross-group post "To" field | Exclude spaces (spaces chosen via separate selector) |
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
groupViews: [GroupView]
spaces: [Group]
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
createSpace(parentGroupId: ID!, name: String!, slug: String, acceptedPostTypes: [String], visibility: Int, accessibility: Int, icon: String, description: String, requiredRoles: [Int]): Group
updateSpace(id: ID!, name: String, slug: String, acceptedPostTypes: [String], visibility: Int, accessibility: Int, icon: String, description: String, requiredRoles: [Int]): Group
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

Run all DDL from Section 2. Do not drop old tables yet (`common_roles`, `common_roles_responsibilities`, `group_memberships_common_roles` dropped in this step after migration; others in Phase 7 cleanup).

### Step 1b — Consolidate roles (stamp system roles per group)

For every existing group:
1. Look up system responsibility ids: `SELECT id, name FROM responsibilities WHERE type = 'system' AND name IN ('Administration', 'Add Members', 'Remove Members', 'Manage Content', 'Manage Tracks', 'Manage Rounds')`
2. For each system role definition (Coordinator, Moderator, Host — hardcoded name/default responsibility set):
   - Insert a row into `groups_roles` with `group_id = group.id`, `name = roleName`, `type = 'system'`
   - Insert rows into `group_roles_responsibilities` linking the new role to its responsibilities (by name-matched id from step 1)
3. For each row in `group_memberships_common_roles` for this group:
   - Find the matching new `groups_roles` row by `group_id + name` (e.g., `common_role_id = 1` → Coordinator)
   - Insert an equivalent row in `group_memberships_group_roles` with the new `group_role_id`
4. Drop `group_memberships_common_roles`, `common_roles_responsibilities`, `common_roles`

### Step 2 — Set `accepted_post_types` on existing groups

For each group, check which post-type-specific ContextWidgets have `order IS NULL` (not in menu). Post types whose widget has no order → excluded. `accepted_post_types = null` for groups where all post type widgets had an order.

ContextWidget `view` → post type mapping:
- `events` → `event`
- `discussions` → `discussion`
- `proposals` → `proposal`
- `resources` → `resource`
- `requests-and-offers` → `request`, `offer`
- `projects` → `project`

### Step 3 — Migrate Main Space views (ContextWidgets with `order IS NOT NULL`)

**Skip all ContextWidgets where `order IS NULL`** — not in menu, do not become GroupViews.

For each remaining ContextWidget ordered by `order` ASC:

**System view widgets** (`widget.view` is set):

| `view` value | `group_views.type` |
|---|---|
| `stream` | `all` |
| `map` | `map` |
| `events` | `events` |
| `discussions` | `discussions` |
| `proposals` | `governance` |
| `resources` | `resources` |
| `requests-and-offers` | `requests-offers` |
| `projects` | `projects` |
| `members` | `members` |
| `about` | `about` |
| `welcome` | `welcome` |
| `related-groups` | `related-groups` |
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
   - If `track.deactivated_at` is set: set `groups.deactivated_at = track.deactivated_at` (archives the space)
2. Set `tracks.group_id = new_space.id`

2. Create `group_views` rows for the new space:
   - `type = 'welcome'`, `order = 0`, `page_content = null` _(home view — renders track banner + metadata above steward's page_content. `welcome_message` field on Track is removed — stewards can write their own content here after migration)_
   - `type = 'track-actions'`, `order = 1` _(non-deletable action list)_
   - `type = 'chat'`, `order = 2`
   - `type = 'members'`, `order = 3` _(renders enrolled_at / completed_at from group_memberships.settings per member)_

3. **Migrate action ordering via `collection_posts`:** for each row in `tracks_posts` for this track (ordered by `sort_order`), create a `collection_posts` row: `view_id = track-actions-view.id`, `post_id`, `order = tracks_posts.sort_order`.

4. Add a `group_views` row in the **parent group's** menu: `type = 'group'`, `linked_group_id = new_space.id`, `order = widget.order` (if a ContextWidget with `view_track_id` existed, use its order; otherwise add to end).

5. **Migrate members via `tracks_users`:** for each `tracks_users` row:
   - Create `group_memberships`: `group_id = new_space.id`, `user_id`, default settings from parent group membership.
   - Set `group_memberships.settings.enrolledAt = tracks_users.enrolled_at`.
   - Set `group_memberships.settings.completedAt = tracks_users.completed_at` (if present).
   - Create `group_views_users` rows for each view in the space.

6. Drop `tracks_posts` and `tracks_users` after all tracks migrated.

7. **Paywall migration:** if `track.access_controlled = true`, set `group.paywall = true` on the new track space and preserve the existing Stripe product/price configuration (carry it forward to the space group's paywall config). Full paywall migration details deferred to Phase 4 (see Open Question Q4).

**If the Track was the parent group's home view:** demote — set the next-ordered view to `order = 0`. Log group id for steward prompt.

### Step 7 — Migrate Funding Rounds to Funding Round Spaces

For each FundingRound (currently `funding_rounds.group_id` = parent group):

1. Create a new `groups` row:
   - `name = round.title` (or `name` — confirm column), `slug = parentSlug + '-' + slugify(round.title)` (ensure uniqueness)
   - `type = 'space'`, `parent_id = funding_round.group_id` (current parent), `funding_round_id = round.id`
   - `visibility = 2`, `accessibility = 1`
   - `description = round.description`, `banner_url = round.banner`
   - If `round.deactivated_at` is set: `groups.deactivated_at = round.deactivated_at`

2. Create `group_views` rows for the new space:
   - `type = 'welcome'`, `order = 0`, `page_content = null` _(home — renders round banner + phase/date info above steward's page_content. Stewards can write their own page_content after migration)_
   - `type = 'funding-round-submissions'`, `order = 1` _(non-deletable)_
   - `type = 'chat'`, `order = 2`
   - `type = 'members'`, `order = 3` _(renders submit/vote role badges per member from round's submitter_roles / voter_roles)_

3. Update `funding_rounds.group_id = new_space.id`.

4. **Migrate posts via `funding_rounds_posts`:** for each row in `funding_rounds_posts`, create a `groups_posts` row: `group_id = new_space.id`, `post_id`. Drop `funding_rounds_posts` after.

5. **Migrate participants via `funding_rounds_users`:** for each row:
   - Create `group_memberships`: `group_id = new_space.id`, `user_id`.
   - Set `group_memberships.settings.tokensRemaining = funding_rounds_users.tokens_remaining`.
   - Create `group_views_users` rows for each view in the space.
   - Drop `funding_rounds_users` after all migrated.

6. Add a `group_views` row in the parent group's menu: `type = 'group'`, `linked_group_id = new_space.id`, `order = (ContextWidget with view_funding_round_id).order` or add to end.

**If the Funding Round was the parent group's home view:** same demotion logic as Step 6.

### Step 8 — Migrate Chat Rooms to Chat Spaces

For each ContextWidget with `view_chat_id IS NOT NULL` and `order IS NOT NULL`:

1. Get the linked `Tag` (chat topic). Note if `widget.visibility = 'admin'`.

2. Create a new `groups` row:
   - `name = tag.name`, `slug = parentSlug + '-' + tag.name` (ensure uniqueness)
   - `type = 'space'`, `parent_id = widget.group_id`
   - `accepted_post_types = ['chat']`
   - `visibility = 2` (Protected), `accessibility = 1` (Open)
   - If widget had `visibility = 'admin'`: set `required_roles = [1]` (Coordinator common role)

3. Create `group_views` row: `type = 'chat'`, `order = 0`.

4. Add a `group_views` row in the parent group's menu: `type = 'group'`, `linked_group_id = new_space.id`, `order = widget.order`.

5. **Migrate members** from `tag_follows` (`tag_id = tag.id, group_id = parent_group_id`):
   - Create `group_memberships`: `group_id = new_space.id`, `user_id`, copy settings from parent membership but set `postNotifications` from `tag_follow.settings`.
   - Create `group_views_users`: `view_id = chat_view.id`, `user_id`, `new_post_count` and `last_read_post_id` from tag_follow.

6. **Migrate posts:** chat posts in `groups_posts` for parent group that have this tag → reassociate with new space in `groups_posts`; remove parent group association.

### Step 9 — Handle `#general` specifically

- Remove `#general` from all posts: delete rows from `posts_tags` where `tag_id = #general.id`.
- For groups where `#general` was the home: set `all` view (or next appropriate view) as the new home (`order = 0`). Log for steward prompt.

### Step 10 — Update `groups.home_route`

For each group and space: `home_route = GroupView.computeHomeRoutePath(homeView, group)`.

- Top-level groups: `/stream`, `/map`, etc. (existing path patterns)
- Spaces: `/groups/:parentSlug/spaces/:localSpaceSlug`

### Step 11 — Post-migration verification

- Every group/space has a `group_views` row with `order = 0`.
- Every space has `parent_id IS NOT NULL`.
- Every track space has `track_id IS NOT NULL`.
- Every funding round space has `funding_round_id IS NOT NULL`.
- No top-level group has `type = 'space'`.
- `tracks_posts`, `tracks_users`, `funding_rounds_posts`, `funding_rounds_users` are empty (all rows migrated).

---

## 6. Routing

### 6.1 Keep current main group view routes

| Route | Component | Notes |
|-------|-----------|-------|
| `/groups/:groupSlug` | Redirects to `home_route` | Unchanged |
| `/groups/:groupSlug/stream` | `GroupView` (type=all) | Stream renamed to GroupView |
| `/groups/:groupSlug/map` | `GroupView` (type=map) | Unchanged |
| `/groups/:groupSlug/events` | `GroupView` (type=events) | Unchanged |
| `/groups/:groupSlug/members` | `GroupView` (type=members) | Unchanged |
| `/groups/:groupSlug/about` | `GroupView` (type=about) | Unchanged |
| `/groups/:groupSlug/custom/:viewId` | `GroupView` (type=custom) | Unchanged (viewId now = group_views.id) |
| `/groups/:groupSlug/collection/:viewId` | `GroupView` (type=collection) | **New** |
| `/groups/:groupSlug/discussions` | `GroupView` (type=discussions) | **New** |
| `/groups/:groupSlug/resources` | `GroupView` (type=resources) | **New** |
| `/groups/:groupSlug/requests-offers` | `GroupView` (type=requests-offers) | **New** |
| `/groups/:groupSlug/governance` | `GroupView` (type=governance) | **New** |
| `/groups/:groupSlug/welcome` | `GroupView` (type=welcome) | **New** |
| `/groups/:groupSlug/related-groups` | `GroupView` (type=related-groups) | **New** |
| `/groups/:groupSlug/all-views` | Redirect → `/groups/:groupSlug/archive` | Backward-compat |
| `/groups/:groupSlug/archive` | `Archive` | Renamed from all-views |
| `/groups/:groupSlug/tracks` | Redirect → `/groups/:groupSlug/archive` | Tracks now in Archive |
| `/groups/:groupSlug/funding-rounds` | Redirect → `/groups/:groupSlug/archive` | Rounds now in Archive |

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

### 7.1 `Stream` → `GroupView`

**Rename:** `apps/web/src/routes/Stream/` → `apps/web/src/routes/GroupView/`

`GroupView.js` receives a `viewType` prop (from route or `group_view.type`) and renders:

```
viewType='all'                       → existing Stream UI
viewType='chat'                      → renders ChatRoom component (not merged, just rendered from here)
viewType='events'                    → Events UI
viewType='map'                       → MapExplorer
viewType='members'                   → Members UI
viewType='about'                     → About page
viewType='custom'                    → Stream with settings.postTypes/topics filters
viewType='discussions'               → Discussions UI
viewType='resources'                 → Resources grid UI
viewType='requests-offers'           → Requests & Offers UI
viewType='governance'                → Governance/Proposals UI
viewType='projects'                  → Projects directory
viewType='collection'                → Collection post list (from collection_posts)
viewType='welcome'                   → Welcome view — renders special track/round section if space has track_id/funding_round_id, then page_content
viewType='related-groups'            → Related groups list
viewType='track-actions'             → Track action list (replaces tabbed TrackHome.jsx)
viewType='funding-round-submissions' → Submissions list (replaces tabbed FundingRoundHome.jsx)
viewType='link'                      → Not a route; ContextMenu opens in new tab
viewType='text'                      → Not a route; menu header only
viewType='separator'                 → Not a route; menu divider only
viewType='post'                      → Single post view
viewType='member'                    → Member profile view
viewType='group'                     → Child group/space view
```

### 7.2 TrackHome and FundingRoundHome — remove tabs

**`TrackHome.jsx`:** Currently has tabbed interface. After this change:
- Tab UI removed entirely.
- Welcome view (`order = 0`, home): renders the track banner and track metadata (num_actions, num_people enrolled/completed), then the steward's editable `page_content` below. **No enrollment CTA** — that belongs on the space join interstitial, not inside the space. The `welcome_message` field is removed from the `Track` model; stewards rewrite their content in `page_content` after migration.
- Action list → `track-actions` view (`order = 1`). Posts ordered by `collection_posts`. Non-deletable.
- Chat → `chat` view.
- Members → `members` view. This directory shows **enrolled date and completed date** for each member, read from `group_memberships.settings.enrolledAt` and `group_memberships.settings.completedAt`. The existing completion badge logic is preserved.
- Navigation between views via the space's ContextMenu.
- `TrackPaywallOfferingsSection` removed — paywall handled by general space paywall (see Open Question Q4 on paywall migration).

**`FundingRoundHome.jsx`:** Currently has About/People/Submissions/Manage/Chat tabs. After:
- About tab → `welcome` view (`order = 0`, home). Renders round banner, phase status, timeline dates, then steward's `page_content` below. **No join CTA** inside the space.
- Submissions + Manage tab → `funding-round-submissions` view (`order = 1`). Non-deletable.
- People tab → `members` view. This directory shows each member's **role in the round** — whether they can submit and/or vote, derived from `funding_round.submitter_roles` and `funding_round.voter_roles` cross-referenced with the member's group roles.
- Chat tab → `chat` view.
- The existing `AboutTab`, `SubmissionsTab`, `ManageTab` sub-components are repurposed as renderers within their respective `GroupView` types.

**Space join interstitial (new):** When a non-member navigates to any space, they see an interstitial page (not the full space content) showing:
- Space name, icon, description, member count
- For **track spaces**: num_actions, num_people enrolled, published/draft status
- For **funding round spaces**: phase status, submission open/close dates, voting dates — especially "opens on [date]" if not yet launched
- Join / Request to Join button (or paywall CTA if the space is paywalled)

### 7.3 ContextMenu redesign

`apps/web/src/routes/AuthLayoutRouter/components/ContextMenu/ContextMenu.jsx`

**Data loaded:** `group.groupViews` (main space views) + `group.spaces` with each space's `groupViews`.

**Menu structure:**
```
[Group Name]
  All Activity      [●]          ← type=all, order=0
  Chat              [●]          ← type=chat
  Events                         ← type=events
  ─────────────────              ← type=separator
  Resources
  Working Group ▶               ← type=group (space), expand chevron
    ↳ Chat          [●]
    ↳ Members
  Funding Round 2026 ▶
    ↳ (collapsed)
  ─────────────────
  Members
  About

  ─────────────────              ← always-visible bottom section
  ⚑ Moderation                  ← visible to ALL members when flaggedItemsCount > 0
  ⚙ Group Settings              ← visible only to admins
```

**New `GroupViewMenuItem` component:**
- Props: `view`, `isActive`, `spaceExpanded`, `onToggleSpace`
- Renders based on `view.type`:
  - `text` → non-clickable section label
  - `separator` → `<hr>`
  - `group` → space row with expand chevron + unread dot
  - `link` → `<a target="_blank">` with external icon
  - All others → `<Link to={groupViewUrl(group, view)}>` with unread dot if `newPostCount > 0`

**Collapsed/expanded space state:** local component state. Clicking a space navigates to its home view AND expands it. Currently active space auto-expands on load.

**Unread indicators:** orange dot only, no count. View level, space level, group header level all use dots.

**Edit mode** (`?edit=yes`, admin only):
- Simple drag-and-drop vertical list (no nested containers).
- Per-row: edit name/icon, set as home, delete.
- "Add View" → picker of available view types.
- "Add Space" → space creation form.
- Clicking settings icon next to a `welcome` type view → opens welcome page editor (replaces `WelcomePageTab`).

### 7.4 ContextMenu — always-visible bottom section

**For all group members** (when applicable):
- **Moderation** link → `/groups/:slug/moderation` — shown when `group.flaggedItemsCount > 0`

**For admins only** (`RESP_ADMINISTRATION` or `RESP_MANAGE_CONTENT`):
- **Group Settings** link → `/groups/:slug/settings`

These are not `group_views` rows — rendered directly by ContextMenu.

### 7.5 Welcome page editing

The `WelcomePageTab` at `apps/web/src/routes/GroupSettings/WelcomePageTab/WelcomePageTab.js` is **removed**.

Instead:
1. Steward puts ContextMenu in edit mode (`?edit=yes`).
2. Clicks the settings icon next to the `Welcome` view row.
3. A settings modal/drawer opens containing:
   - Markdown editor for `page_content`
   - Toggle for `group.settings.show_welcome_page` (whether to show welcome page to new members on first visit)
4. Save calls `updateGroupView(id, pageContent: "...")` + `updateGroupSettings(settings: {...})`.

For Track and Funding Round spaces, the welcome view settings modal shows only the `page_content` editor (the special track/round data above it comes from the model, not the page_content field).

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

Show a warning: turning off a post type hides those views from the menu but does not delete existing posts.

### 7.7 Remove settings tabs

- **Custom Views tab** → remove. Custom views managed from ContextMenu edit mode.
- **Welcome Page tab** → remove. Welcome view edited from ContextMenu edit mode.
- **Tracks tab** → remove. Track settings accessible from Track space ContextMenu or Archive.
- **Funding Rounds tab** (if separate) → remove. Same.

### 7.8 Post creation changes

In the post creation modal:

- **"To" field:** flat list — groups the user is in, with indented spaces per group that accept the selected post type (same layout as current groups + chat rooms list).
- **Chat posts:** no space selector — created from chat box in the current chat view. Space is implicit.
- **Non-chat posts:** space optional. If omitted, post goes to main space.
- **Space list filter:** only spaces where `accepted_post_types` includes the selected type (or null).
- **`groups_posts`:** when a space is selected, associate the post with the space group in `groups_posts`.

### 7.9 Space management UI

Accessible from ContextMenu edit mode ("Add Space" button). Only users with `RESP_ADMINISTRATION` in the parent group can access.

**Create Space form:**
1. Name + slug (auto-generated, editable)
2. Icon (Lucide picker)
3. Description
4. Accepted post types (pill toggles)
5. Initial views (checkboxes for common view types)
6. **Access** — single selector setting both `groups.visibility` and `groups.accessibility`:
   - **Open to all** — anyone in the group can see and join _(protected, open)_
   - **Restricted** — anyone in the group can see it, but must request to join _(protected, restricted)_
   - **Role-gated** — only members with a specific role can see and join _(protected, open; sets `required_roles`)_. Shows role picker when selected.
   - **Paid** — anyone can see it, but must pay to join _(protected, restricted; sets `group.paywall = true`)_. Only shown if the parent group has paid content enabled.
   - **Hidden / Invite only** — stewards must invite members directly _(hidden, closed)_

### 7.10 Space invites

Space invitations surface in **My Invites** (the existing invites UI in the My context). No new UI needed — invite system works for spaces since they are groups. Ensure invite flows handle `parent_id IS NOT NULL` correctly.

---

## 8. Notifications & Unread Tracking

### Per-view unread counting

When a post is created in a space, increment `group_views_users.new_post_count` for matching views for all members:

| Post type | Views incremented |
|-----------|------------------|
| Any | `all` (All Activity) |
| `chat` | `chat` |
| `discussion` | `discussions` |
| `event` | `events` |
| `request` or `offer` | `requests-offers` |
| `resource` | `resources` |
| `proposal` | `governance` |
| Any | `custom` views whose `settings.postTypes` includes the type |

### Resetting unread

- User navigates to a view → call `markViewAsRead(viewId)` → `new_post_count = 0`, update `last_read_post_id`.
- **All Activity does not cascade-clear other views.** Each view manages its own count independently. Full per-post read tracking is a future feature.

### Indicators

- **View level:** orange dot if `newPostCount > 0`. No number.
- **Space level:** orange dot if any view in the space has unread. No number.
- **Group level (global nav):** orange dot if any main-space view or space has unread. No number.

### Notification settings precedence

1. `group_views_users.settings` (per view — most specific)
2. `group_memberships.settings` for the space
3. `group_memberships.settings` for the parent group (fallback)

### Digest emails

Posts from spaces the user has joined are included in the parent group digest. Email template may need a space name section header. Design/template task.

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

**Default views for all new groups:**
- `all` (All Activity), order=0 (home)
- `chat`, order=1
- `map`, order=2
- `members`, order=3
- `about`, order=4
- Type-specific views for each enabled post type in order after

### New space creation

- Administration responsibility required (Phase 1).
- Via ContextMenu edit mode "Add Space" button.
- `createSpace` mutation → creates `groups` row with `type = 'space'`, `parent_id`, then calls `Group.setupSpaceViews()`.
- Automatically adds a `type = 'group'` `group_views` row in the parent group's menu.

### Track/Funding Round space creation (after Phase 4)

Creating a new Track or Funding Round automatically creates its space:
- Both seed: `welcome` (order=0, home), specialized view (order=1, non-deletable), `chat` (order=2), `members` (order=3).
- Track space: uses `track_id` on groups; welcome view's `page_content` defaults to `track.welcome_message`.
- Funding Round space: uses `funding_round_id`; welcome view's `page_content` defaults to round description.

---

## 11. Archive

Route: `/groups/:groupSlug/archive` (redirects from `/all-views`, `/tracks`, `/funding-rounds`)

**Content:** Spaces not in the main menu, organized into sections:
- **Track Spaces** — all track spaces (published and draft)
- **Funding Round Spaces** — all funding round spaces
- **Other Spaces** — archived spaces (`deactivated_at` set)
- Settings links for Track and Funding Round management (replaces old settings tabs)

**No views appear here.** Views are either in the menu or deleted.

**Access:** Link in ContextMenu bottom section for all members (or at least admins — TBD). Admins see all spaces; members see only spaces they're allowed to see per `required_roles` / visibility.

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

- Space-level custom roles / moderators
- "Anyone can create a space" — needs Manage Spaces responsibility
- Group and space templates UI (Phase 1 uses hardcoded defaults)
- Post notices in Chat ("Aaron posted a Discussion")
- Chat activity cards in All Activity stream
- Pinned posts per view
- Kanban view mode
- View renaming / aliases
- Mobile-specific navigation design (separate ticket)
- Promote a Space to a Group (architecture supports it; no UI)
- Analytics per space
- Moderation queue scoped per space
- Category system for posts
- Spaces with locations on map
- Project posts → Project Spaces migration
- Tool Lending Library space type
- Editable Pages (Welcome page extensions)
- Separate notification settings per view

---

## 14. Phased Rollout

### Phase 1 — Database & Backend

- Add `parent_id`, `accepted_post_types`, `required_roles`, `track_id`, `funding_round_id` to `groups`
- Add `type` column to `groups_roles`; add `group_id` to `tracks`
- Create `group_views`, `group_views_users`, `collection_posts` tables
- Create `GroupView`, `GroupViewUser`, `CollectionPost` models
- Update `Group`, `GroupRole`, `Responsibility`, `Track`, `FundingRound` models
- Delete `CommonRole`, `MemberCommonRole` models
- GraphQL: add new types, queries, all mutations in Section 4
- Run data migration on staging, verify, then production (includes roles consolidation)
- Keep all ContextWidget code active in parallel during transition

### Phase 2 — Navigation UI (web)

- Rename `Stream` → `GroupView`; update `AuthLayoutRouter` routes
- Redesign `ContextMenu`: `GroupViewMenuItem`, space expand/collapse, unread dots, bottom section (Moderation + Settings)
- Add `?edit=yes` mode, welcome view settings in edit mode
- Remove `WelcomePageTab`, `CustomViewsTab`, `TracksTab` from Group Settings
- Add accepted post type pill toggles to GroupSettingsTab
- `Archive` page
- Navigation package: `groupViewUrl()`, `spaceUrl()`, `localSpaceSlug()`

### Phase 3 — Space Management

- "Add Space" / edit space UI in ContextMenu edit mode
- Space creation form + mutations wired up
- Space membership join/leave UI (preview for non-members)
- Archive/unarchive space UI
- Space Settings page
- Space invites in My Invites

### Phase 4 — Paid / Paywalled Spaces

Generalizes the existing track paywall to work for any space. A group with paid content enabled can set any space to "Paid" access.

**Backend:**
- Existing Stripe offerings/products currently linked to `tracks.id` → change to link to `groups.id` (the space group)
- "Add Track for an offering" flow → "Add Space for an offering"
- `track.access_controlled` migration → set `group.paywall = true` on track spaces; migrate existing Stripe product association to the space group id
- Paywall scope/access check switches from checking track access to checking space membership

**Space join interstitial — paid CTA:**
- When a non-member views a paywalled space, the interstitial shows the available offerings (same as the current `TrackPaywallOfferingsSection` content, now generalized)
- Purchasing an offering creates a `group_memberships` row with paid status

**Frontend:**
- Remove `TrackPaywallOfferingsSection` from `TrackHome.jsx`
- Create generalized `SpaceJoinInterstitial` component that handles: open join, restricted request, role-gated notice, paid offering, hidden/invite notice
- "Paid" option in space creation form gated by parent group's paid content setting

**Migration within this phase:**
- For each track where `access_controlled = true`: set the track space's `group.paywall = true`, reassign the Stripe product from `tracks.id` to the new space `groups.id`

### Phase 5 — Tracks & Funding Rounds as Spaces

- Remove tabs from `TrackHome.jsx`, `FundingRoundHome.jsx`
- `GroupView` rendering for `track-actions` and `funding-round-submissions` types
- `welcome` view for track/funding round spaces renders special section + page_content
- Track/Funding Round creation flow auto-creates a space
- `collection_posts` for track action ordering
- Track member directory shows `enrolledAt` / `completedAt` from `group_memberships.settings`
- Funding round member directory shows submit/vote role badges

### Phase 6 — Post Creation & Content Aggregation

- Space selector in post creation modal
- `accepted_post_types` enforcement
- `groups_posts` associations for space posts
- Main Space "All Activity" aggregates from child spaces user is in
- Backend search includes child spaces

### Phase 7 — Notifications, Cleanup & Mobile

- `group_views_users` unread increment on post creation
- Per-view unread dots in ContextMenu
- `markViewAsRead` on view navigation
- Steward onboarding prompt
- Remove all ContextWidget code (model, GraphQL, frontend)
- Drop `tracks_posts`, `tracks_users`, `funding_rounds_posts`, `funding_rounds_users`, `groups_tracks` (already empty after Phase 1 migration)
- Drop `custom_views`, `custom_view_topics`, `collections`, `posts_collections` (already empty after Phase 1 migration)
- Note: `common_roles`, `common_roles_responsibilities`, `group_memberships_common_roles` are already dropped in Step 1b of the Phase 1 migration
- Mobile app navigation (separate ticket)
