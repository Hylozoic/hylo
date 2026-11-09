# 02 — Data model

> Foundation module. Every persistent entity in Hylo's PostgreSQL database: purpose, columns, relationships, enums, JSON settings blobs, counters and invariants. Derived from `apps/backend/migrations/schema.sql` (pg_dump of the schema after all migrations, last regenerated October 2026; the only later migration, `20261015150000_fix_post_and_member_home_routes`, is data-only) cross-checked against the Bookshelf models in `apps/backend/api/models/`. Infrastructure is in [01-architecture.md](01-architecture.md); the GraphQL projection of these entities is in [03-graphql-api.md](03-graphql-api.md).

---

## 1. Conventions

- **Engine**: PostgreSQL with PostGIS (`geometry` columns, SRID 4326). Accessed via Knex/Bookshelf. Table names are plural snake_case (exceptions: `linked_account`). The GraphQL layer camel-cases column names (`created_at` → `createdAt`).
- **Primary keys**: integer/bigint `id` from sequences (many sequences keep legacy names, e.g. `community_seq` for `groups`, `post_seq`, `comment_seq`). Join tables also have surrogate `id`s except `groups_posts.post_id`-keyed rows and `posts_about_users`.
- **Timestamps**: `created_at`, `updated_at` (`timestamptz`, nullable in most tables; Bookshelf `hasTimestamps` fills them). A few newer tables default to `CURRENT_TIMESTAMP`.
- **Foreign keys**: most are `DEFERRABLE INITIALLY DEFERRED` (constraints checked at commit). `ON DELETE CASCADE` / `SET NULL` noted per table.
- **Soft delete patterns** (no global convention; per table):
  - `active boolean` (default `true`): `users`, `groups`, `posts`, `comments`, `group_memberships`, `group_memberships_group_roles`, `groups_roles`, `group_relationships`, `groups_agreements`, `posts_users`, `group_extensions`, `zapier_triggers.is_active`, `saved_searches.is_active`, `user_affiliations.is_active`.
  - `deactivated_at` / `deactivated_by_id` / `deactivated_reason`: `posts`, `comments`, `tracks.deactivated_at`, `funding_rounds.deactivated_at`.
  - `deleted_at` / `deleted_by_id`: `group_invite_links`.
  - `expired_at` / `expired_by_id`: `group_invites`.
  - `status` columns: `join_requests`, `group_relationship_invites`, `moderation_actions`, `content_access`, `groups.status` (draft/archived).
  - Users: deactivation sets `active=false` + `date_deactivated`; deletion anonymises/removes the row via the `delete_user` procedure (not in the dump) — see 05.
- **Counters / denormalised fields** are maintained by application code, jobs or cron (marked "counter" below). They may drift; cron recomputes `groups.num_members` every 10 minutes.
- **JSONB settings blobs** exist on `users`, `groups`, `group_memberships`, `group_relationships`, `group_views`, `group_views_users`, `tag_follows`, `tracks`, `posts.completion_action_settings`, `cookie_consents`. Key casing differs by table (see §4). The API returns them camel-cased.
- **Scopes materialisation**: Postgres triggers keep `user_scopes` in sync with `content_access` and `group_memberships_group_roles` (§5).

---

## 2. Entity-relationship overview

```
users ─┬─< group_memberships >── groups ──< groups_posts >── posts ──< comments
       │        │ (settings,           │  │ parent_id (spaces)     │   │ comment_id (threaded replies)
       │        │  new_post_count)     │  ├─< group_relationships (parent/child, peer) >─ groups
       │        │                      │  ├─< groups_roles ──< group_roles_responsibilities >── responsibilities
       ├─< group_memberships_group_roles (user × group × role)
       │                               │  ├─< group_views ──< group_views_users >── users
       │                               │  │        ├─< collections_posts >── posts
       │                               │  │        └─< group_view_pins >── posts
       │                               │  ├─< groups_tags >── tags ──< tag_follows >── users
       │                               │  ├─< groups_agreements >── agreements ──< users_groups_agreements
       │                               │  ├─< group_join_questions >── questions
       │                               │  ├─< join_requests ──< group_join_questions_answers
       │                               │  ├─< group_invites (email invitations) / group_invite_links
       │                               │  ├─< tracks (actions = posts via group_views 'track-actions')
       │                               │  ├─< funding_rounds (submissions = posts)
       │                               │  ├─< stripe_products ──< content_access >── users
       │                               │  └── stripe_accounts, locations, group_extensions
       ├─< posts_users (follow, last read, saved, completion, tokens)
       ├─< reactions (entity_type post|comment)
       ├─< activities ──< notifications ──(push_notifications)
       ├─< event_invitations (RSVPs) ── posts(type=event)
       ├─< proposal_votes ── proposal_options ── posts(type=proposal)
       ├─< skills_users >── skills ; user_affiliations ; linked_account ; blocked_users
       ├─< saved_searches ; drafts ; user_scopes ; user_connections ; site_banners_users
       └─< oidc_payloads (accountId in payload)
Direct messages: posts(type='thread') + posts_users(participants) + comments(messages)
```

Key modelling facts:
- **Spaces are groups**: a space is a `groups` row with `type = 'space'` and `parent_id` = its parent group. Spaces have their own memberships, views, roles (no All Members role), paywall. Parent/child *groups* (networks) use `group_relationships` instead of `parent_id`.
- **Direct-message threads are posts** of type `thread`; participants are `posts_users` rows; messages are `comments`. GraphQL exposes them as `MessageThread` / `Message`.
- **Chat messages are posts** of type `chat` tagged with the room's topic; chat rooms are `group_views` of type `chat` (legacy: topics in `groups_tags`).
- **Track actions are posts** of type `action`, attached to a track's `track-actions` view through `collections_posts`.
- **Funding-round submissions are posts** of type `submission` in the funding round's space.
- **Topics** = `tags`; per-group topic settings = `groups_tags`; follows = `tag_follows`. `posts.tag_names` caches tag names on the post.

---

## 3. Enumerations (stored values)

| Enum | Column(s) | Values |
|---|---|---|
| Group visibility | `groups.visibility` | `0` HIDDEN (only members), `1` PROTECTED (members + members of related groups), `2` PUBLIC. Default `1`. |
| Group accessibility | `groups.accessibility` | `0` CLOSED (invitation only), `1` RESTRICTED (request to join), `2` OPEN. Default `1`. |
| Group type | `groups.type` | `null` (regular group), `'farm'`, `'space'`. |
| Group status | `groups.status` | `draft`, `published` (default), `submissions`, `discussion`, `voting`, `completed`, `archived`. "Published statuses" = `published, submissions, discussion, voting, completed`. Funding-round spaces mirror the round phase. |
| Group relationship type | `group_relationships.relationship_type` | `0` PARENT_CHILD, `1` PEER_TO_PEER. `role` column unused. |
| Group relationship invite type | `group_relationship_invites.type` | `0` ParentToChild (parent invites child), `1` ChildToParent (child requests to join parent), `2` PeerToPeer. |
| Invite / join request status | `group_relationship_invites.status`, `join_requests.status` | `0` Pending, `1` Accepted, `2` Rejected, `3` Canceled. |
| Group role type | `groups_roles.type` | `system` (Administrator / Moderator / Host), `custom` (default), `all_members` (one implicit role per top-level group; nobody is assigned it). |
| System roles | `groups_roles.name` | `Administrator` (legacy name `Coordinator`; emoji 🪄; responsibilities Administration, Add Members, Remove Members, Manage Content), `Moderator` (⚖️; Manage Content, Remove Members), `Host` (👋; Add Members), `All Members` (type all_members). |
| Responsibilities | `responsibilities.title` (system rows have `group_id NULL`) | `Administration`, `Add Members`, `Remove Members`, `Manage Content`; custom per-group responsibilities have `group_id` set. "Important": Administration, Remove Members, Manage Content. |
| Invite policy (derived) | — | `everyone` (Add Members linked to All Members role), `stewards` (default for new groups). Behind feature flag `MEMBER_INVITES`. |
| Post type | `posts.type` | `discussion`, `request`, `offer`, `resource`, `project`, `event`, `proposal`, `action`, `submission`, `chat`, `chat_activity` (system "notice" post summarising hourly chat), `thread` (DM thread), `welcome` (legacy welcome post). `null` legacy rows are treated as discussion. Legacy `intention` appears in email form. |
| Post visibility | `posts.visibility` | `0` DEFAULT, `1` PUBLIC_READABLE (legacy; public-ness is `posts.is_public`). |
| Proposal status | `posts.proposal_status` | `discussion`, `voting`, `completed`, `casual`. |
| Proposal outcome | `posts.proposal_outcome` | `cancelled`, `quorum-not-met`, `incomplete`, `in-progress`, `successful`, `tie`. |
| Proposal voting method | `posts.voting_method` | `single`, `multi-unrestricted`. |
| Proposal anonymous voting | `posts.anonymous_voting` | text, e.g. `''`/`null` (not anonymous), `'true'`, `'after'`-style values set by the editor (see 14). |
| Post `created_from` | `posts.created_from`, `comments.created_from` | e.g. `email_form`, `email`, `zapier`, `api`, `import`, null (app). |
| Event RSVP | `event_invitations.response` | `yes`, `no`, `interested` (UI "Maybe"). `null` = invited, no response. "Going" = yes or interested. |
| Media type | `media.type` | `image`, `video`, `file` (default), `gdoc`. |
| Reaction entity | `reactions.entity_type` | `post`, `comment`. |
| Flag category | `flagged_items.category` | `inappropriate`, `offensive`, `abusive`, `illegal`, `safety`, `spam`, `other` (reason required unless `other`… code: reason required when category ≠ `other`). |
| Flagged object type | `flagged_items.object_type` | `post`, `comment`, `member`. |
| Moderation action status | `moderation_actions.status` | `active`, `cleared`. |
| Skill type | `skills_users.type` | `0` HAS, `1` LEARNING. |
| User connection type | `user_connections.type` | `message`. |
| Group topic visibility | `groups_tags.visibility` | `0` hidden, `1` visible, `2` pinned. |
| Group view type | `group_views.type` | `all`, `chat`, `collection`, `custom`, `discussions`, `events`, `funding-round-submissions`, `group`, `link`, `map`, `member`, `members`, `page`, `post`, `projects`, `proposals`, `requests-and-offers`, `resources`, `separator`, `space`, `space-collection`, `text`, `track-actions`, `welcome`. Non-navigable: `link`, `text`, `separator`, `space`. Only `space` views may have `order = NULL` (off-menu, "More Spaces"). |
| Activity reason (in `activities.meta.reasons`) | — | `mention`, `chat`, `comment`, `contribution`, `followAdd`, `follow`, `unfollow`, `announcement`, `approvedJoinRequest`, `joinRequest`, `groupInvitation`, `memberJoinedGroup`, `groupChildGroupInvite`, `groupChildGroupInviteAccepted`, `groupParentGroupJoinRequest`, `groupParentGroupJoinRequestAccepted`, `groupPeerGroupInvite`, `groupPeerGroupInviteAccepted`, `trackCompleted`, `trackEnrollment`, `postFulfilled`, `postUnfulfilled`, `fundingRoundNewSubmission`, `fundingRoundPhaseTransition`, `fundingRoundReminder`; also `tag`, `newPost`, `newComment`, `commentMention`, `eventInvitation`, `donation to/from` (reason strings may carry suffixes like `tag: <name>`). See 19. |
| Notification medium | `notifications.medium` | `0` InApp, `1` Push, `2` Email. |
| Content access type | `content_access.access_type` | `stripe_purchase`, `admin_grant`. |
| Content access status | `content_access.status` | `active`, `expired`, `revoked`, `refunded`. |
| User scope source | `user_scopes.source_kind` | `grant` (from content_access), `role` (from role assignment). |
| User scope string | `user_scopes.scope` | `group:<groupId>`, `track:<trackId>` (legacy), `group_role:<groupId>:<roleId>`, plus arbitrary strings from `groups_roles.scopes`. |
| Offering renewal policy | `stripe_products.renewal_policy` | `automatic`, `manual`. |
| Offering duration | `stripe_products.duration` | `day` (non-production testing only), `month`, `season`, `annual`, `lifetime`, `null` (one-time, no expiry). |
| Offering publish status | `stripe_products.publish_status` | `unpublished`, `unlisted`, `published`, `archived`. |
| Funding round phase | derived from dates/`groups.status` | `draft`, `published`, `submissions`, `discussion`, `voting`, `completed`. |
| Saved search context | `saved_searches.context` | `all`, `public`, `groups` (with `group_id`). |
| Draft type | `drafts.type` | `post` (new or `is_edit`), `comment`, `message`. |
| Digest frequency | membership `settings.digestFrequency`, user `settings.digest_frequency` | `daily`, `weekly`, `never`. |
| Post notifications | membership `settings.postNotifications`, user `settings.post_notifications`, `tag_follows.settings.notifications` | `none`, `important`, `all`. |
| DM / comment notifications | user `settings.dm_notifications`, `comment_notifications` | `email`, `push`, `both`, `none`. |
| Location display precision | `groups.settings.location_display_precision` | `precise`, `near`, `region`. |
| Site banner type | `site_banners.type` | free text used as style (e.g. `info`, `warning`). |

---

## 4. JSON settings blobs

### 4.1 `users.settings` (stored **snake_case**, default `{}`)
| Key | Meaning |
|---|---|
| `already_seen_tour` | Legacy first-login tour seen. |
| `tours_seen` | Array of completed/dismissed guided tour ids. |
| `color_scheme` | `auto` / `light` / `dark`. |
| `theme` | Palette name (`default`, `forest`, `ocean`, …). |
| `comment_notifications` | `email` / `push` / `both` / `none` (default `both`). |
| `dm_notifications` | `email` / `push` / `both` / `none` (default `both`). |
| `post_notifications` | `none` / `important` / `all` (default `important`). |
| `digest_frequency` | `daily` / `weekly` / `never` (default `daily`; legacy global value, per-membership overrides). |
| `last_viewed_messages_at` | ISO timestamp of last DM-list view (unread badge). |
| `locale` | `en`, `es`, `fr`, `de`, `hi`, `pt`. |
| `map_base_layer` | Last map base layer. |
| `global_nav_style` | `sidebar` / `tabs`. |
| `group_nav_style` | `group-default` / `two-column` / `one-column`. |
| `rsvp_calendar_sub` | Boolean; publish RSVP `.ics` feed (requires `users.calendar_token`). |
| `signup_in_progress` | Boolean; still in welcome wizard. |
| `stack_groups` | Boolean; nest subgroups under parents in global nav. |
| `independent_space_menu` | Boolean; spaces replace the context menu. |
| `stream_child_posts` | Include child-group posts in streams (string). |
| `stream_view_mode` | `cards` / `list` / `grid` / `bigGrid`. |
| `stream_sort_by` | `updated` / `created` / `reactions`. |
| `stream_post_type` | Last post-type filter. |
| `unified_email_digest` | Boolean; combine group digests into one daily/weekly email. |

### 4.2 `groups.settings` (mostly **snake_case**)
Defaults at creation: `{ allow_group_invites: false, agreements_last_updated_at: null, public_member_directory: false, homeView: 'CHAT'|..., layout: 'two-column' }`; `home_route` set to `/chat/general` (CHAT), `/map` (MAP) or `/all`.

| Key | Meaning |
|---|---|
| `agreements_last_updated_at` | When agreements last changed (members must re-accept). |
| `allow_group_invites` | Legacy; unused. |
| `ask_join_questions` | Require join questions for person join requests. |
| `ask_group_to_group_join_questions` | Require questions for group→group join requests. |
| `default_digest_frequency` | `daily` / `weekly`; copied to new memberships. |
| `hide_extension_data` | Hide farm extension data. |
| `layout` | `two-column` / `one-column`. |
| `homeView` | Initial home view chosen at creation (camelCase). |
| `location_display_precision` | `precise` / `near` / `region`. |
| `public_member_directory` | Non-members can see members. |
| `publish_murmurations_profile` | Publish to Murmurations index. |
| `show_suggested_skills` | Show suggested skills at join. |
| `show_welcome_page` | Show welcome page on join. |
| `show_post_notices_in_chat` | Chat shows inline notices for new non-chat posts. |
| `auto_add_members` | Space-only: auto-add parent members. |
| `public_listing_request` | `{ status: 'pending'|'approved'|'denied', requested_at, message, requested_by_id, … }` — request to be listed in the Commons. |
| `chat_conversion_status`, `chat_conversion_post_id`, `chat_converted_to_post_id` | Chat-space→discussion conversion bookkeeping. |

### 4.3 `group_memberships.settings` (**camelCase**)
| Key | Meaning |
|---|---|
| `sendEmail` | Email notifications from this group (boolean). |
| `sendPushNotifications` | Push notifications from this group. |
| `postNotifications` | `none` / `important` / `all`. |
| `digestFrequency` | `daily` / `weekly` / `never`. |
| `agreementsAcceptedAt` | When member accepted current agreements. |
| `joinQuestionsAnsweredAt` | When join questions answered. |
| `showJoinForm` | Whether the post-join form still needs showing. |
| `lastReadAt` | Last time the member viewed the group (unread badge basis). |
| `completedAt` | Track spaces: when the member completed the track. |
| `lastChatDigestPostId` | Chat digest high-water mark. |

### 4.4 Others
- `group_relationships.settings`: `{ isPrerequisite: boolean }` (parent must be joined before child).
- `tag_follows.settings`: `{ notifications: 'none'|'important'|'all' }`.
- `group_views.settings`: per-view configuration (stream filters/sort/view mode, post types, collection sort, track id, funding round id, chat options…); see [15-views-streams-spaces.md](15-views-streams-spaces.md).
- `group_views_users.settings`: per-user view preferences (view mode, sort, filters).
- `tracks.settings`: track options (see 21).
- `posts.completion_action_settings`: action completion config (`completion_action` ∈ e.g. `button`, `text`, `selectOne`, `selectMultiple`, `comment`, `reaction`, `uploadFile`; settings hold options/instructions) — see 21.
- `posts.reactions_summary`: `{ "<emoji_full>": count, ... }`.
- `posts.notice_data`: payload of `chat_activity` notice posts (message counts, participants, hour window).
- `activities.meta`: `{ reasons: [string], phase?, ... }`.
- `cookie_consents.settings`: consent categories.
- `content_access.metadata`, `stripe_products.access_grants` (`{ groupIds:[...], trackIds:[...], roleIds:[...] }`), `stripe_products.metadata`.

---

## 5. Database triggers, views and derived objects

- `compute_user_scopes_from_content_access()` — AFTER INSERT OR UPDATE (and a DELETE trigger) on `content_access`. When `status='active'`: upserts into `user_scopes` (`source_kind='grant'`, `source_id=content_access.id`): `track:<track_id>` if track set; `group_role:<COALESCE(group_id, granted_by_group_id)>:<group_role_id>` if role set; otherwise `group:<granted_by_group_id>`. On conflict `(user_id, scope)` keeps the later expiry (`NULL` = never wins). When status is not active, deletes the matching grant scope. *Quirk*: the AFTER DELETE trigger reads `NEW` (null on delete), so deleting a `content_access` row does not remove scopes.
  - Note: for space access the application writes `group_id` = space and code also maintains `group:<spaceId>` scopes (migration `20260902013000_space_content_access_group_scopes`).
- `compute_user_scopes_from_role()` — on `group_memberships_group_roles`: active assignment inserts each string of `groups_roles.scopes` (source `role`); inactive removes them. Same DELETE quirk.
- View `group_member_effective_roles(user_id, group_id, group_role_id)` = explicit active role assignments ∪ (every active member × the group's active `all_members` role).
- View `lock_monitor` — DBA diagnostic.
- Materialized view `search_index` — full-text index (see 01 §3.4); rows for posts, users, comments and groups.
- Procedure `delete_user(integer)` exists in the DB (stripped from the dump).

---

## 6. Tables

Tables are grouped by domain. Column tables are generated from the schema dump; "Null" blank = `NOT NULL`. "Keys" lists primary/unique constraints and unique indexes; "FKs" lists foreign keys.
