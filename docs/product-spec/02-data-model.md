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

### 6.1 People & accounts

#### `users`

A person's account and profile. `email` unique (case-insensitive lookups). `active=false` for deactivated accounts and for email-verification stubs that have not finished registering (no `name`). `email_validated` set on verification/OAuth. `new_notification_count` counter (reset by `notifications(resetCount:true)`). `last_active_at` touched by GraphQL requests (throttled, skipped for OAuth clients). `calendar_token` names the RSVP `.ics` file. `is_profile_public` = profile visible to logged-out visitors. `first_name`/`last_name`/`twitter_name`/`intention`/`extra_info`/`work` are legacy. Passwords are stored in `linked_account` (provider `password`).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  | `serial` |
| `email` | varchar(255) |  |  |
| `name` | varchar(255) | null |  |
| `avatar_url` | varchar(255) | null |  |
| `first_name` | varchar(255) | null |  |
| `last_name` | varchar(255) | null |  |
| `last_login_at` | timestamptz | null |  |
| `active` | boolean | null |  |
| `email_validated` | boolean | null |  |
| `created_at` | timestamptz | null |  |
| `date_deactivated` | timestamptz | null |  |
| `bio` | text | null |  |
| `banner_url` | varchar(255) | null |  |
| `twitter_name` | varchar(255) | null |  |
| `linkedin_url` | varchar(255) | null |  |
| `facebook_url` | varchar(255) | null |  |
| `work` | text | null |  |
| `intention` | text | null |  |
| `extra_info` | text | null |  |
| `new_notification_count` | integer | null | `0` |
| `updated_at` | timestamptz | null |  |
| `settings` | jsonb | null | `'{}'::jsonb` |
| `location` | varchar(255) | null |  |
| `url` | varchar(255) | null |  |
| `tagline` | varchar(255) | null |  |
| `location_id` | bigint | null |  |
| `contact_email` | varchar(255) | null |  |
| `contact_phone` | varchar(255) | null |  |
| `last_active_at` | timestamptz | null |  |
| `calendar_token` | varchar(255) | null |  |
| `is_profile_public` | boolean | null | `false` |

- Keys: `PRIMARY KEY(id)`; `UNIQUE(email)`
- FKs: `location_id→locations.id ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED`

#### `linked_account`

Login identities per user. `provider_key`: `password` (`provider_user_id` = bcrypt hash), `google`, `apple`, `facebook`, `linkedin`, `token` (legacy API access token in `provider_user_id`). Unique per (provider_key, provider_user_id) by application logic.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  | `serial` |
| `user_id` | bigint | null |  |
| `provider_user_id` | varchar(255) | null |  |
| `provider_key` | varchar(255) | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `user_id→users.id DEFERRABLE INITIALLY DEFERRED`

#### `user_verification_codes`

Short-lived 6-digit email verification codes for signup and email change (`email`, `code`). Validity window enforced in code (see 04).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `email` | varchar(255) |  |  |
| `code` | varchar(6) |  |  |
| `created_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`

#### `user_external_data`

Raw provider profile/token JSON stored at social login (`type` = provider).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  |  |
| `user_id` | bigint | null |  |
| `type` | varchar(255) | null |  |
| `data` | jsonb | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `user_id→users.id DEFERRABLE INITIALLY DEFERRED`

#### `skills`

Global skill vocabulary (`name`, matched case-insensitively).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `name` | varchar(255) | null |  |

- Keys: `UNIQUE(name)`; `PRIMARY KEY(id)`

#### `skills_users`

User ↔ skill; `type` 0 = has skill, 1 = wants to learn.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `skill_id` | bigint | null |  |
| `user_id` | bigint | null |  |
| `type` | integer | null | `0` |

- Keys: `PRIMARY KEY(id)`; `UNIQUE(skill_id, user_id, type)`
- FKs: `skill_id→skills.id DEFERRABLE INITIALLY DEFERRED`; `user_id→users.id DEFERRABLE INITIALLY DEFERRED`

#### `user_affiliations`

Profile affiliations: `role` (e.g. 'Founder'), `preposition` ('of'/'at'/...), `org_name`, `url`; `is_active` soft delete.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `user_id` | bigint |  |  |
| `role` | varchar(255) | null |  |
| `preposition` | varchar(255) | null |  |
| `org_name` | varchar(255) | null |  |
| `url` | varchar(255) | null |  |
| `is_active` | boolean | null | `true` |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `user_id→users.id`

#### `blocked_users`

`user_id` blocked `blocked_user_id`. Blocking hides content and messaging both ways.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `user_id` | bigint | null |  |
| `blocked_user_id` | bigint | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `blocked_user_id→users.id`; `user_id→users.id`

#### `user_connections`

Lets two users see/message each other without sharing a group (`type`='message', created when messaging group stewards).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `user_id` | bigint | null |  |
| `other_user_id` | bigint | null |  |
| `type` | varchar(255) | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `other_user_id→users.id DEFERRABLE INITIALLY DEFERRED`; `user_id→users.id DEFERRABLE INITIALLY DEFERRED`

#### `devices`

Legacy mobile device registry (OneSignal `player_id`, `token`, `platform`, `version`, `badge_no`, `tester`). No longer written (`registerDevice` deprecated).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  |  |
| `user_id` | bigint | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `badge_no` | integer | null | `0` |
| `token` | varchar(255) | null |  |
| `enabled` | boolean | null | `true` |
| `platform` | varchar(255) | null |  |
| `version` | varchar(255) | null |  |
| `player_id` | varchar(255) | null |  |
| `tester` | boolean | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `user_id→users.id DEFERRABLE INITIALLY DEFERRED`

#### `email_enabled_testers`

Users who receive notification emails/pushes even when global sending is disabled (managed by admins).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `user_id` | bigint |  |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`; `UNIQUE(user_id)`
- FKs: `user_id→users.id ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED`

#### `cookie_consents`

Cookie-consent records (`consent_id` from browser, optional `user_id`, `settings` JSON, `version`, `ip_address`, `user_agent`).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `consent_id` | uuid |  |  |
| `user_id` | bigint | null |  |
| `settings` | jsonb | null | `'{}'::jsonb` |
| `version` | text | null |  |
| `created_at` | timestamptz | null | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamptz | null | `CURRENT_TIMESTAMP` |
| `ip_address` | text | null |  |
| `user_agent` | text | null |  |

- Keys: `UNIQUE(consent_id)`; `PRIMARY KEY(id)`
- FKs: `user_id→users.id`

#### `user_scopes`

Materialised access scopes per user (see §5). Unique (`user_id`,`scope`). `expires_at` NULL = never.

| Column | Type | Null | Default |
|---|---|---|---|
| `user_id` | bigint |  |  |
| `scope` | varchar(255) |  |  |
| `expires_at` | timestamptz | null |  |
| `source_kind` | varchar(255) |  |  |
| `source_id` | bigint |  |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(user_id, scope)`
- FKs: `user_id→users.id`

#### `site_banners`

Platform-wide announcement banners created by Hylo admins: `title`, `text`, `type`, optional `action_text`/`action_url`; live when `published_at` set and `unpublished_at` null; `show_to_new_users=false` hides from users created after `published_at`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `title` | text | null |  |
| `text` | text | null |  |
| `type` | text | null | `'info'::text` |
| `action_text` | text | null |  |
| `action_url` | text | null |  |
| `created_by_id` | bigint | null |  |
| `published_at` | timestamptz | null |  |
| `unpublished_at` | timestamptz | null |  |
| `show_to_new_users` | boolean |  | `false` |
| `created_at` | timestamptz | null | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamptz | null | `CURRENT_TIMESTAMP` |

- Keys: `PRIMARY KEY(id)`
- FKs: `created_by_id→users.id`

#### `site_banners_users`

Per-user dismissals of site banners (`dismissed_at`).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `site_banner_id` | integer | null |  |
| `user_id` | bigint | null |  |
| `dismissed_at` | timestamptz | null | `CURRENT_TIMESTAMP` |

- Keys: `PRIMARY KEY(id)`; `UNIQUE(site_banner_id, user_id)`
- FKs: `site_banner_id→site_banners.id ON DELETE CASCADE`; `user_id→users.id ON DELETE CASCADE`

#### `drafts`

Auto-saved unsent content per user and context. `type` post|comment|message; `data` = JSON-encoded editor state; context columns `post_id`, `group_id`, `topic_id`, `message_thread_id`, `post_type`, `is_edit`; `navigate_to` = route to resume. One draft per context.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  |  |
| `user_id` | bigint |  |  |
| `type` | varchar(20) |  |  |
| `data` | jsonb |  | `'{}'::jsonb` |
| `post_id` | bigint | null |  |
| `group_id` | bigint | null |  |
| `topic_id` | bigint | null |  |
| `message_thread_id` | bigint | null |  |
| `is_edit` | boolean | null | `false` |
| `navigate_to` | text | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `post_type` | varchar(20) | null |  |

- Keys: `PRIMARY KEY(id)`; `UNIQUE INDEX(user_id, post_id) WHERE ((type)::text = 'comment'::text)`; `UNIQUE INDEX(user_id, post_id) WHERE (((type)::text = 'post'::text) AND (is_edit = true))`; `UNIQUE INDEX(user_id, message_thread_id) WHERE ((type)::text = 'message'::text)`; `UNIQUE INDEX(user_id, group_id, COALESCE(topic_id, ('-1'::integer)::bigint), COALESCE(post_type, 'discussion'::character varying)) WHERE (((type)::text = 'post'::text) AND (is_edit = false) AND (post_id IS NULL))`
- FKs: `group_id→groups.id`; `message_thread_id→posts.id`; `post_id→posts.id`; `topic_id→tags.id`; `user_id→users.id`

#### `saved_searches`

Map saved searches: `name`, `context` (all/public/groups), `group_id`, `search_text`, `post_types` (array), `bounding_box` (geometry), `last_post_id` (high-water mark for saved-search digests), `is_active`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `user_id` | bigint |  |  |
| `name` | varchar(255) | null |  |
| `context` | varchar(255) |  |  |
| `group_id` | bigint | null |  |
| `is_active` | boolean | null | `true` |
| `search_text` | varchar(255) | null |  |
| `post_types` | varchar(255)[] | null |  |
| `bounding_box` | geometry(Polygon,4326) | null |  |
| `last_post_id` | bigint | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `last_post_id→posts.id`; `user_id→users.id`

#### `saved_search_topics`

Topics filter of a saved search.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `tag_id` | bigint |  |  |
| `saved_search_id` | bigint |  |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `saved_search_id→saved_searches.id`; `tag_id→tags.id`

#### `oidc_payloads`

oidc-provider persistence (see 01 §5.5): (`id`,`type`) unique; `payload` JSON; `grant_id`, `user_code`, `uid`, `expires_at`, `consumed_at`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | varchar(255) |  |  |
| `type` | varchar(255) |  |  |
| `payload` | jsonb | null |  |
| `grant_id` | varchar(255) | null |  |
| `user_code` | varchar(255) | null |  |
| `uid` | varchar(255) | null |  |
| `expires_at` | timestamptz | null |  |
| `consumed_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id, type)`

### 6.2 Groups, membership & governance

#### `groups`

Groups, networks, farms and spaces. `slug` unique (spaces: `<parentSlug>-<slug>`). `parent_id` set only for spaces. `access_code` legacy single join code (superseded by `group_invite_links`, column retained). Counters: `num_members` (cron), `num_open_join_requests`, `menu_view_count`, `more_spaces_count`. `home_route` = path of the order-0 view. `paywall` = paid access required. `stripe_*` = Stripe Connect status; `stripe_sales_paused*` = admin kill switch. `accepted_post_types` (JSON array) and `required_roles` (JSON array of role ids) apply to spaces. `icon` = space icon. `track_id` / `funding_round_id` link a space to its track / funding round. `type_descriptor(_plural)` and `steward_descriptor(_plural)` customise wording (e.g. 'Community', 'Moderator'). `allow_in_public` = listed in the Commons (admin-approved). `geo_shape` = polygon outline. `welcome_page` = HTML for the welcome page. `about_video_uri`, `website_url`, `purpose`. `slack_*` legacy Slack integration.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  |  |
| `active` | boolean | null | `true` |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `name` | varchar(255) |  |  |
| `slug` | varchar(255) |  |  |
| `description` | text | null |  |
| `location` | varchar(255) | null |  |
| `location_id` | bigint | null |  |
| `avatar_url` | varchar(255) | null |  |
| `banner_url` | varchar(255) | null |  |
| `visibility` | integer | null | `1` |
| `accessibility` | integer | null | `1` |
| `created_by_id` | bigint | null |  |
| `access_code` | varchar(255) | null |  |
| `lift_admin_invite_limits` | boolean |  | `false` |
| `settings` | jsonb | null |  |
| `num_members` | integer | null |  |
| `num_open_join_requests` | integer |  | `0` |
| `slack_hook_url` | text | null |  |
| `slack_team` | text | null |  |
| `slack_configure_url` | text | null |  |
| `type` | text | null |  |
| `geo_shape` | geometry(Polygon,4326) | null |  |
| `type_descriptor` | varchar(255) | null | `NULL::character varying` |
| `type_descriptor_plural` | varchar(255) | null | `NULL::character varying` |
| `steward_descriptor` | varchar(255) | null | `NULL::character varying` |
| `steward_descriptor_plural` | varchar(255) | null | `NULL::character varying` |
| `about_video_uri` | varchar(255) | null |  |
| `allow_in_public` | boolean | null | `false` |
| `purpose` | text | null |  |
| `welcome_page` | text | null |  |
| `website_url` | text | null |  |
| `calendar_token` | varchar(255) | null |  |
| `home_route` | varchar(255) | null |  |
| `menu_view_count` | integer |  | `0` |
| `more_spaces_count` | integer |  | `0` |
| `stripe_account_id` | bigint | null |  |
| `stripe_charges_enabled` | boolean | null | `false` |
| `stripe_payouts_enabled` | boolean | null | `false` |
| `stripe_details_submitted` | boolean | null | `false` |
| `paywall` | boolean | null | `false` |
| `stripe_sales_paused` | boolean |  | `false` |
| `stripe_sales_paused_at` | timestamptz | null |  |
| `stripe_sales_paused_reason` | text | null |  |
| `parent_id` | bigint | null |  |
| `accepted_post_types` | jsonb | null |  |
| `required_roles` | jsonb | null |  |
| `icon` | varchar(255) | null |  |
| `track_id` | bigint | null |  |
| `funding_round_id` | bigint | null |  |
| `status` | varchar(255) |  | `'published'::character varying` |

- Keys: `UNIQUE(access_code)`; `PRIMARY KEY(id)`; `UNIQUE(slug)`
- FKs: `created_by_id→users.id DEFERRABLE INITIALLY DEFERRED`; `funding_round_id→funding_rounds.id ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED`; `location_id→locations.id ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED`; `parent_id→groups.id ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED`; `stripe_account_id→stripe_accounts.id`; `track_id→tracks.id ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED`

#### `group_memberships`

Membership of a user in a group or space. Unique (group_id,user_id) by logic; `active=false` = left/removed (row kept; rejoin reactivates). `new_post_count` unread counter (badge). `nav_order` = position in the user's global nav. `group_invite_link_id` = link used to join. `project_role_id` legacy.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  |  |
| `group_id` | bigint |  |  |
| `user_id` | bigint |  |  |
| `active` | boolean | null | `true` |
| `settings` | jsonb | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `new_post_count` | integer | null | `0` |
| `project_role_id` | bigint | null |  |
| `nav_order` | integer | null |  |
| `group_invite_link_id` | bigint | null |  |

- Keys: `UNIQUE(group_id, user_id)`; `PRIMARY KEY(id)`
- FKs: `group_id→groups.id DEFERRABLE INITIALLY DEFERRED`; `project_role_id→project_roles.id DEFERRABLE INITIALLY DEFERRED`; `user_id→users.id`; `group_invite_link_id→group_invite_links.id ON DELETE SET NULL`

#### `groups_roles`

Roles (badges) of a group: system, custom, all_members. `emoji`, `color`, `description`, `active`. `scopes` JSON array of scope strings granted to holders. Partial unique index: one `all_members` role per group.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `group_id` | bigint | null |  |
| `name` | varchar(255) | null |  |
| `emoji` | varchar(255) | null |  |
| `color` | varchar(255) | null |  |
| `active` | boolean | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `description` | varchar(255) | null |  |
| `scopes` | jsonb | null |  |
| `type` | varchar(255) |  | `'custom'::character varying` |

- Keys: `PRIMARY KEY(id)`; `UNIQUE INDEX(group_id) WHERE ((type)::text = 'all_members'::text)`
- FKs: `group_id→groups.id DEFERRABLE INITIALLY DEFERRED`

#### `responsibilities`

Permissions. System rows (`group_id` NULL): Administration, Add Members, Remove Members, Manage Content. Custom rows belong to a group. `type` 'system'/'custom'.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `title` | text |  |  |
| `description` | text | null |  |
| `type` | text | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `group_id` | bigint | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `group_id→groups.id`

#### `group_roles_responsibilities`

Role ↔ responsibility.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `group_role_id` | bigint | null |  |
| `responsibility_id` | bigint | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `group_role_id→groups_roles.id`; `responsibility_id→responsibilities.id`

#### `group_memberships_group_roles`

Assignment of a role to a member in a group (`active`). Triggers sync `user_scopes`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `group_id` | bigint |  |  |
| `user_id` | bigint |  |  |
| `group_role_id` | bigint |  |  |
| `active` | boolean | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `group_id→groups.id DEFERRABLE INITIALLY DEFERRED`; `group_role_id→groups_roles.id DEFERRABLE INITIALLY DEFERRED`; `user_id→users.id DEFERRABLE INITIALLY DEFERRED`

#### `group_relationships`

Parent/child (`relationship_type` 0) or peer (1) links between groups; `description` for peer links; `settings.isPrerequisite`; `active`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  |  |
| `parent_group_id` | bigint |  |  |
| `child_group_id` | bigint |  |  |
| `active` | boolean | null | `true` |
| `role` | integer | null |  |
| `settings` | jsonb | null | `'{}'::jsonb` |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `relationship_type` | integer |  | `0` |
| `description` | text | null |  |

- Keys: `UNIQUE(parent_group_id, child_group_id)`; `PRIMARY KEY(id)`
- FKs: `child_group_id→groups.id DEFERRABLE INITIALLY DEFERRED`; `parent_group_id→groups.id DEFERRABLE INITIALLY DEFERRED`

#### `group_relationship_invites`

Invitations/requests to create group relationships (`type`, `status`, `from_group_id`, `to_group_id`, `created_by_id`, `processed_by_id`/`processed_at`, `canceled_by_id`/`canceled_at`, `sent_count`, `last_sent_at`, `subject`, `message`).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `from_group_id` | bigint |  |  |
| `to_group_id` | bigint |  |  |
| `type` | integer |  |  |
| `created_by_id` | bigint |  |  |
| `created_at` | timestamptz | null |  |
| `status` | integer | null | `0` |
| `processed_by_id` | bigint | null |  |
| `processed_at` | timestamptz | null |  |
| `canceled_by_id` | bigint | null |  |
| `canceled_at` | timestamptz | null |  |
| `sent_count` | integer | null |  |
| `last_sent_at` | timestamptz | null |  |
| `subject` | text | null |  |
| `message` | text | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `canceled_by_id→users.id`; `created_by_id→users.id`; `from_group_id→groups.id`; `processed_by_id→users.id`; `to_group_id→groups.id`

#### `group_to_group_join_questions`

Questions a group asks other groups requesting to join it.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `group_id` | bigint |  |  |
| `question_id` | bigint |  |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `group_id→groups.id`; `question_id→questions.id`

#### `group_to_group_join_request_question_answers`

Answers to those questions per relationship invite (`join_request_id` = invite id).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `question_id` | bigint |  |  |
| `join_request_id` | bigint |  |  |
| `answer` | text | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `join_request_id→group_relationship_invites.id`; `question_id→questions.id`

#### `questions`

Question text shared by join-question tables.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `text` | text | null |  |
| `created_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`

#### `group_join_questions`

Questions asked to people requesting to join a group.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `group_id` | bigint |  |  |
| `question_id` | bigint |  |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `group_id→groups.id`; `question_id→questions.id`

#### `group_join_questions_answers`

Answers from a person (`user_id`, `group_id`, optionally `join_request_id`).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `question_id` | bigint |  |  |
| `join_request_id` | bigint | null |  |
| `answer` | text | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `group_id` | bigint | null |  |
| `user_id` | bigint | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `group_id→groups.id DEFERRABLE INITIALLY DEFERRED`; `user_id→users.id DEFERRABLE INITIALLY DEFERRED`; `join_request_id→join_requests.id`; `question_id→questions.id`

#### `join_requests`

A person's request to join a restricted group (`status` 0..3, `processed_by_id`).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `user_id` | bigint | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `status` | integer | null |  |
| `group_id` | bigint |  |  |
| `processed_by_id` | bigint | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `group_id→groups.id DEFERRABLE INITIALLY DEFERRED`; `processed_by_id→users.id`; `user_id→users.id DEFERRABLE INITIALLY DEFERRED`

#### `group_invites`

Email/user invitations to a group (`token` unique per invite, `email`, `invited_by_id`, `group_role_id` role to assign, `subject`, `message`, `sent_count`, `last_sent_at`, `used_by_id`/`used_at`, `expired_by_id`/`expired_at`; `tag_id` legacy topic invites). Reminders at 4 and 9 days (cron).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  | `serial` |
| `created_at` | timestamptz |  |  |
| `invited_by_id` | bigint |  |  |
| `used_by_id` | bigint | null |  |
| `token` | text |  |  |
| `used_at` | timestamptz | null |  |
| `email` | text |  |  |
| `tag_id` | bigint | null |  |
| `last_sent_at` | timestamptz | null |  |
| `sent_count` | integer | null | `0` |
| `subject` | varchar(255) | null |  |
| `message` | text | null |  |
| `expired_by_id` | bigint | null |  |
| `expired_at` | timestamptz | null |  |
| `group_id` | bigint |  |  |
| `group_role_id` | bigint | null |  |

- Keys: `PRIMARY KEY(id)`; `UNIQUE(token)`
- FKs: `tag_id→tags.id DEFERRABLE INITIALLY DEFERRED`; `expired_by_id→users.id`; `invited_by_id→users.id DEFERRABLE INITIALLY DEFERRED`; `used_by_id→users.id DEFERRABLE INITIALLY DEFERRED`; `group_id→groups.id DEFERRABLE INITIALLY DEFERRED`; `group_role_id→groups_roles.id`

#### `group_invite_links`

Reusable invite links: `access_code`, `name`, `grant_access` (bypasses accessibility), `granted_roles` (role ids assigned on join), `num_joined_users` counter, soft delete `deleted_at`. Each group has a system link created with the group.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  |  |
| `group_id` | bigint |  |  |
| `access_code` | varchar(255) |  |  |
| `name` | varchar(255) | null |  |
| `grant_access` | boolean |  | `true` |
| `granted_roles` | jsonb |  | `'[]'::jsonb` |
| `num_joined_users` | integer |  | `0` |
| `created_by_id` | bigint | null |  |
| `created_at` | timestamptz |  | `CURRENT_TIMESTAMP` |
| `deleted_at` | timestamptz | null |  |
| `deleted_by_id` | bigint | null |  |

- Keys: `PRIMARY KEY(id)`; `UNIQUE INDEX(lower((access_code)::text))`
- FKs: `group_id→groups.id ON DELETE CASCADE`; `created_by_id→users.id ON DELETE SET NULL`; `deleted_by_id→users.id ON DELETE SET NULL`

#### `invitation_sends`

Ledger of invitation sends (`recipients` count) for the daily invitation allowance.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  |  |
| `user_id` | bigint |  |  |
| `group_id` | bigint |  |  |
| `recipients` | integer |  |  |
| `created_at` | timestamptz |  | `CURRENT_TIMESTAMP` |

- Keys: `PRIMARY KEY(id)`
- FKs: `group_id→groups.id ON DELETE CASCADE`; `user_id→users.id ON DELETE CASCADE`

#### `agreements`

Group agreement texts (`title`, `description`).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `title` | text | null |  |
| `description` | text | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`

#### `groups_agreements`

Group ↔ agreement with `order` and `active`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `group_id` | bigint |  |  |
| `agreement_id` | bigint |  |  |
| `active` | boolean | null | `true` |
| `order` | integer | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `agreement_id→agreements.id DEFERRABLE INITIALLY DEFERRED`; `group_id→groups.id DEFERRABLE INITIALLY DEFERRED`

#### `users_groups_agreements`

A member's acceptance (`accepted`) of a group agreement.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `group_id` | bigint |  |  |
| `agreement_id` | bigint |  |  |
| `user_id` | bigint |  |  |
| `accepted` | boolean | null | `true` |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `agreement_id→agreements.id DEFERRABLE INITIALLY DEFERRED`; `group_id→groups.id DEFERRABLE INITIALLY DEFERRED`; `user_id→users.id DEFERRABLE INITIALLY DEFERRED`

#### `platform_agreements`

Hylo platform agreements (`text`, `type`) cited in moderation actions.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `text` | text | null |  |
| `type` | text | null |  |

- Keys: `PRIMARY KEY(id)`

#### `groups_suggested_skills`

Skills a group suggests to new members.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `group_id` | bigint |  |  |
| `skill_id` | bigint |  |  |
| `created_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `group_id→groups.id`; `skill_id→skills.id`

#### `extensions`

Extension types (e.g. farm data schema), `type`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `type` | text | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`

#### `group_extensions`

Per-group extension data (`data` JSON, `active`), e.g. farm details.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `group_id` | bigint |  |  |
| `extension_id` | bigint |  |  |
| `data` | jsonb | null |  |
| `active` | boolean | null | `true` |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `extension_id→extensions.id DEFERRABLE INITIALLY DEFERRED`; `group_id→groups.id`

#### `locations`

Geocoded places: `center` (point), `bbox`, `geometry`, `full_text`, address parts (`address_number`, `address_street`, `city`, `locality`, `region`, `neighborhood`, `postcode`, `country`, `country_code`), `accuracy`, `wikidata`. Shared by users, groups, posts.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `center` | geometry(Point,4326) | null |  |
| `bbox` | geometry(Polygon,4326) | null |  |
| `geometry` | geometry(Polygon,4326) | null |  |
| `full_text` | varchar(255) | null |  |
| `address_number` | varchar(255) | null |  |
| `address_street` | varchar(255) | null |  |
| `city` | varchar(255) | null |  |
| `locality` | varchar(255) | null |  |
| `region` | varchar(255) | null |  |
| `neighborhood` | varchar(255) | null |  |
| `postcode` | varchar(255) | null |  |
| `country_code` | varchar(255) | null |  |
| `accuracy` | varchar(255) | null |  |
| `wikidata` | varchar(255) | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `country` | varchar(255) | null |  |

- Keys: `PRIMARY KEY(id)`

#### `zapier_triggers`

Zapier REST hook subscriptions: `user_id`, `type` (`new_post`, `new_member`, `member_leaves`, `member_updated`), `target_url`, `params`, `is_active`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `user_id` | bigint | null |  |
| `is_active` | boolean | null | `true` |
| `type` | varchar(255) |  |  |
| `target_url` | varchar(255) |  |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `params` | jsonb | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `user_id→users.id DEFERRABLE INITIALLY DEFERRED`

#### `zapier_triggers_groups`

Groups a Zapier trigger listens to.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `zapier_trigger_id` | bigint | null |  |
| `group_id` | bigint | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `group_id→groups.id DEFERRABLE INITIALLY DEFERRED`; `zapier_trigger_id→zapier_triggers.id DEFERRABLE INITIALLY DEFERRED`

### 6.3 Views, spaces & menus

#### `group_views`

Menu entries / views of a group or space (see 15). `order` (NULL only for off-menu spaces), `type`, `name`, `icon`, `page_content` (page/text views), `link` (link views), `post_id` (post view), `user_id` (member view), `linked_group_id` (space/group views), `topics` (JSON array of topic names for chat/custom), `settings`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  |  |
| `group_id` | bigint |  |  |
| `name` | varchar(255) | null |  |
| `type` | varchar(255) |  |  |
| `order` | integer | null |  |
| `icon` | varchar(255) | null |  |
| `page_content` | text | null |  |
| `link` | text | null |  |
| `post_id` | bigint | null |  |
| `user_id` | bigint | null |  |
| `linked_group_id` | bigint | null |  |
| `topics` | jsonb |  | `'[]'::jsonb` |
| `settings` | jsonb | null |  |
| `created_at` | timestamptz |  | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamptz |  | `CURRENT_TIMESTAMP` |

- Keys: `PRIMARY KEY(id)`
- FKs: `group_id→groups.id ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED`; `linked_group_id→groups.id ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED`; `post_id→posts.id ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED`; `user_id→users.id ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED`

#### `group_views_users`

Per-user state for a view: `new_post_count` (unread badge), `last_read_post_id`, `settings`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  |  |
| `view_id` | bigint |  |  |
| `user_id` | bigint |  |  |
| `new_post_count` | integer |  | `0` |
| `last_read_post_id` | bigint | null |  |
| `settings` | jsonb | null |  |
| `created_at` | timestamptz |  | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamptz |  | `CURRENT_TIMESTAMP` |

- Keys: `PRIMARY KEY(id)`; `UNIQUE(view_id, user_id)`
- FKs: `last_read_post_id→posts.id ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED`; `user_id→users.id ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED`; `view_id→group_views.id ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED`

#### `collections_posts`

Ordered posts in a `collection` or `track-actions` view (`view_id`, `post_id`, `order`, `user_id` adder).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `post_id` | bigint |  |  |
| `user_id` | bigint |  |  |
| `order` | integer | null | `0` |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `view_id` | bigint |  |  |

- Keys: `PRIMARY KEY(id)`; `UNIQUE INDEX(view_id, post_id) WHERE (view_id IS NOT NULL)`
- FKs: `post_id→posts.id DEFERRABLE INITIALLY DEFERRED`; `user_id→users.id DEFERRABLE INITIALLY DEFERRED`; `view_id→group_views.id ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED`

#### `group_view_pins`

Posts pinned to a view (max 3 per view, enforced in code), newest first by `pinned_at`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  |  |
| `view_id` | bigint |  |  |
| `post_id` | bigint |  |  |
| `pinned_at` | timestamptz |  | `now()` |

- Keys: `PRIMARY KEY(id)`; `UNIQUE(view_id, post_id)`
- FKs: `post_id→posts.id ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED`; `view_id→group_views.id ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED`

#### `groups_tags`

Group ↔ topic: `visibility` (0 hidden, 1 visible, 2 pinned), `is_default` (default topic for new members), `num_followers` counter, `description`, `user_id` creator.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `tag_id` | bigint | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `user_id` | bigint | null |  |
| `description` | text | null |  |
| `is_default` | boolean | null | `false` |
| `num_followers` | integer | null | `0` |
| `visibility` | integer | null | `1` |
| `group_id` | bigint |  |  |

- Keys: `PRIMARY KEY(id)`; `UNIQUE(group_id, tag_id)`
- FKs: `user_id→users.id DEFERRABLE INITIALLY DEFERRED`; `tag_id→tags.id DEFERRABLE INITIALLY DEFERRED`; `group_id→groups.id DEFERRABLE INITIALLY DEFERRED`

#### `tags`

Topics (`name`, unique; lower-case by convention).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  |  |
| `name` | varchar(255) |  |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`; `UNIQUE(name)`

#### `tag_follows`

A user following a topic in a group: `new_post_count` unread counter, `last_read_post_id`, `settings.notifications`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `tag_id` | bigint | null |  |
| `user_id` | bigint | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `new_post_count` | integer | null | `0` |
| `group_id` | bigint |  |  |
| `last_read_post_id` | bigint | null |  |
| `settings` | jsonb | null | `'{}'::jsonb` |

- Keys: `PRIMARY KEY(id)`; `UNIQUE(group_id, tag_id, user_id)`
- FKs: `tag_id→tags.id DEFERRABLE INITIALLY DEFERRED`; `user_id→users.id DEFERRABLE INITIALLY DEFERRED`; `group_id→groups.id DEFERRABLE INITIALLY DEFERRED`; `last_read_post_id→posts.id`

### 6.4 Content

#### `posts`

All content items (see §3 Post type). `name` = title, `description` = HTML body. Counters: `num_comments`, `num_people_reacts`, `num_commenters`, `num_people_completed`. `reactions_summary` JSON. `is_public` = visible in the Commons/to anyone. `announcement`. `fulfilled_at` (request/offer/project completed). Events: `start_time`, `end_time`, `timezone`, `location`, `location_id`, `meeting_link`, `ical_sequence`. Projects: `donations_link`, `project_management_link`, `accept_contributions`, `is_project_request`. Proposals: `quorum`, `proposal_status`, `proposal_outcome`, `voting_method`, `proposal_vote_limit`, `proposal_strict`, `anonymous_voting`. Actions: `completion_action`, `completion_action_settings`. Submissions: `budget`. `link_preview_id`, `link_preview_featured`. `edited_at` set on edits. `flagged_groups` array of group ids where flagged. `tag_names` cached topic names. `notice_data` for `chat_activity`. `deactivated_*` soft delete (`active=false`). `starts_at`/`ends_at`/`parent_post_id`/`visibility` legacy.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  | `serial` |
| `name` | text | null |  |
| `description` | text | null |  |
| `type` | varchar(255) | null |  |
| `created_at` | timestamptz | null |  |
| `user_id` | bigint | null |  |
| `num_people_reacts` | integer | null |  |
| `num_comments` | integer | null |  |
| `active` | boolean | null |  |
| `deactivated_by_id` | bigint | null |  |
| `deactivated_at` | timestamptz | null |  |
| `deactivated_reason` | varchar(255) | null |  |
| `fulfilled_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `visibility` | integer | null | `0` |
| `starts_at` | timestamptz | null |  |
| `ends_at` | timestamptz | null |  |
| `location` | varchar(255) | null |  |
| `created_from` | varchar(255) | null |  |
| `parent_post_id` | bigint | null |  |
| `link_preview_id` | bigint | null |  |
| `is_project_request` | boolean | null | `false` |
| `announcement` | boolean | null | `false` |
| `start_time` | timestamptz | null |  |
| `end_time` | timestamptz | null |  |
| `accept_contributions` | boolean | null | `false` |
| `location_id` | bigint | null |  |
| `is_public` | boolean | null | `false` |
| `donations_link` | varchar(255) | null |  |
| `project_management_link` | varchar(255) | null |  |
| `meeting_link` | varchar(255) | null |  |
| `link_preview_featured` | boolean | null | `false` |
| `reactions_summary` | jsonb | null |  |
| `timezone` | varchar(255) | null |  |
| `quorum` | bigint | null |  |
| `proposal_status` | text | null |  |
| `proposal_outcome` | text | null |  |
| `voting_method` | text | null |  |
| `proposal_vote_limit` | integer | null |  |
| `proposal_strict` | boolean | null | `false` |
| `anonymous_voting` | text | null |  |
| `edited_at` | timestamptz | null |  |
| `flagged_groups` | bigint[] | null |  |
| `completion_action` | varchar(255) | null |  |
| `completion_action_settings` | jsonb | null | `'{}'::jsonb` |
| `num_people_completed` | integer | null | `0` |
| `num_commenters` | integer | null | `0` |
| `budget` | varchar(255) | null |  |
| `ical_sequence` | integer | null |  |
| `tag_names` | text[] |  | `'{}'::text[]` |
| `notice_data` | jsonb | null |  |

- Keys: `PRIMARY KEY(id)`; `UNIQUE INDEX(((notice_data ->> 'bucketKey'::text))) WHERE ((notice_data ->> 'bucketKey'::text) IS NOT NULL)`
- FKs: `user_id→users.id DEFERRABLE INITIALLY DEFERRED`; `deactivated_by_id→users.id DEFERRABLE INITIALLY DEFERRED`; `link_preview_id→link_previews.id DEFERRABLE INITIALLY DEFERRED`; `parent_post_id→posts.id DEFERRABLE INITIALLY DEFERRED`; `location_id→locations.id ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED`

#### `groups_posts`

Post ↔ group (cross-posting). A post in a space is also linked to the space.

| Column | Type | Null | Default |
|---|---|---|---|
| `post_id` | bigint |  |  |
| `id` | integer |  |  |
| `group_id` | bigint |  |  |

- Keys: `UNIQUE(group_id, post_id)`; `PRIMARY KEY(id)`
- FKs: `post_id→posts.id DEFERRABLE INITIALLY DEFERRED`; `group_id→groups.id DEFERRABLE INITIALLY DEFERRED`

#### `posts_tags`

Post ↔ topic; `selected` legacy flag.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `post_id` | bigint | null |  |
| `tag_id` | bigint | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `selected` | boolean | null |  |

- Keys: `PRIMARY KEY(id)`; `UNIQUE(post_id, tag_id)`
- FKs: `post_id→posts.id DEFERRABLE INITIALLY DEFERRED`; `tag_id→tags.id DEFERRABLE INITIALLY DEFERRED`

#### `posts_users`

Per-user relation to a post: `following` (receives comment notifications), `last_read_at`, `saved_at` (saved posts), `completed_at` + `completion_response` (action completion), `clickthrough` (viewed past moderation warning), `tokens_allocated_to` (funding-round token allocation), `muted_at` (muted DM thread), `project_role_id`, `active`. For threads, participants.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `user_id` | bigint | null |  |
| `post_id` | bigint | null |  |
| `last_read_at` | timestamptz | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `project_role_id` | bigint | null |  |
| `following` | boolean | null | `true` |
| `active` | boolean | null | `true` |
| `clickthrough` | boolean | null |  |
| `completed_at` | timestamptz | null |  |
| `completion_response` | jsonb | null | `'[]'::jsonb` |
| `saved_at` | timestamptz | null |  |
| `tokens_allocated_to` | integer | null | `0` |
| `muted_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`; `UNIQUE(post_id, user_id)`
- FKs: `post_id→posts.id DEFERRABLE INITIALLY DEFERRED`; `project_role_id→project_roles.id DEFERRABLE INITIALLY DEFERRED`; `user_id→users.id DEFERRABLE INITIALLY DEFERRED`

#### `posts_about_users`

Legacy: posts about users (unused).

| Column | Type | Null | Default |
|---|---|---|---|
| `post_id` | bigint | null |  |
| `user_id` | bigint | null |  |
- FKs: `post_id→posts.id DEFERRABLE INITIALLY DEFERRED`; `user_id→users.id DEFERRABLE INITIALLY DEFERRED`

#### `comments`

Comments on posts and messages in DM threads. `text` HTML, `comment_id` parent (one level of replies), `recent` legacy, `edited_at`, soft delete `active`/`deactivated_*`, `created_from` (e.g. `email`).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  | `serial` |
| `user_id` | bigint | null |  |
| `post_id` | bigint | null |  |
| `created_at` | timestamptz | null |  |
| `text` | text | null |  |
| `active` | boolean | null |  |
| `deactivated_reason` | varchar(255) | null |  |
| `deactivated_by_id` | bigint | null |  |
| `deactivated_at` | timestamptz | null |  |
| `recent` | boolean | null |  |
| `created_from` | varchar(255) | null |  |
| `comment_id` | bigint | null |  |
| `edited_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `comment_id→comments.id DEFERRABLE INITIALLY DEFERRED`; `deactivated_by_id→users.id DEFERRABLE INITIALLY DEFERRED`; `post_id→posts.id DEFERRABLE INITIALLY DEFERRED`; `user_id→users.id DEFERRABLE INITIALLY DEFERRED`

#### `comments_tags`

Comment ↔ topic.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `comment_id` | bigint | null |  |
| `tag_id` | bigint | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`; `UNIQUE(comment_id, tag_id)`
- FKs: `comment_id→comments.id DEFERRABLE INITIALLY DEFERRED`; `tag_id→tags.id DEFERRABLE INITIALLY DEFERRED`

#### `media`

Attachments for posts/comments (and legacy user/group images): `type`, `url`, `thumbnail_url`, `name`, `width`, `height`, `position` (order).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  | `serial` |
| `type` | varchar(255) | null |  |
| `url` | text | null |  |
| `thumbnail_url` | varchar(255) | null |  |
| `created_at` | timestamptz | null |  |
| `post_id` | bigint | null |  |
| `name` | text | null |  |
| `width` | integer | null |  |
| `height` | integer | null |  |
| `comment_id` | bigint | null |  |
| `position` | integer | null | `0` |

- Keys: `PRIMARY KEY(id)`
- FKs: `post_id→posts.id DEFERRABLE INITIALLY DEFERRED`; `comment_id→comments.id DEFERRABLE INITIALLY DEFERRED`

#### `link_previews`

URL previews: `url` unique, `done` when fetched, `title`, `description`, `image_url`, `image_width`, `image_height`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `url` | text | null |  |
| `done` | boolean | null | `false` |
| `title` | text | null |  |
| `description` | text | null |  |
| `image_url` | text | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `image_width` | integer | null |  |
| `image_height` | integer | null |  |

- Keys: `PRIMARY KEY(id)`; `UNIQUE(url)`

#### `reactions`

Emoji reactions: `entity_type` post|comment, `entity_id`, `emoji_full` (e.g. ':thumbsup:' or unicode), `emoji_base`, `emoji_label`, `date_reacted`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  | `serial` |
| `user_id` | bigint | null |  |
| `entity_id` | bigint | null |  |
| `date_reacted` | timestamptz | null |  |
| `emoji_base` | text | null |  |
| `emoji_full` | text | null |  |
| `emoji_label` | text | null |  |
| `entity_type` | text | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `user_id→users.id DEFERRABLE INITIALLY DEFERRED`

#### `thanks`

Legacy 'thanks' on comments.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  | `serial` |
| `comment_id` | bigint |  |  |
| `date_thanked` | timestamptz |  |  |
| `user_id` | bigint |  |  |
| `thanked_by_id` | bigint |  |  |

- Keys: `PRIMARY KEY(id)`; `UNIQUE(comment_id, user_id, thanked_by_id)`
- FKs: `comment_id→comments.id DEFERRABLE INITIALLY DEFERRED`; `thanked_by_id→users.id DEFERRABLE INITIALLY DEFERRED`; `user_id→users.id DEFERRABLE INITIALLY DEFERRED`

#### `event_invitations`

Event invitations and RSVPs (`user_id`, `inviter_id`, `event_id`, `response`, `ical_sequence`). Self-RSVP creates a row with `inviter_id` null.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `user_id` | bigint | null |  |
| `inviter_id` | bigint | null |  |
| `event_id` | bigint | null |  |
| `response` | varchar(255) | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `ical_sequence` | integer | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `event_id→posts.id`; `inviter_id→users.id`; `user_id→users.id`

#### `event_responses`

Legacy RSVP table (superseded by event_invitations).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `user_id` | bigint | null |  |
| `post_id` | bigint | null |  |
| `response` | varchar(255) | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`; `UNIQUE(user_id, post_id)`
- FKs: `post_id→posts.id DEFERRABLE INITIALLY DEFERRED`; `user_id→users.id DEFERRABLE INITIALLY DEFERRED`

#### `proposal_options`

Options of a proposal: `text`, `emoji`, `color`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `post_id` | bigint |  |  |
| `emoji` | text | null |  |
| `color` | text | null |  |
| `text` | text |  |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `post_id→posts.id DEFERRABLE INITIALLY DEFERRED`

#### `proposal_votes`

A vote by `user_id` for `option_id` on `post_id`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `post_id` | bigint |  |  |
| `option_id` | bigint |  |  |
| `user_id` | bigint |  |  |
| `created_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`; `UNIQUE(option_id, user_id)`
- FKs: `option_id→proposal_options.id DEFERRABLE INITIALLY DEFERRED`; `post_id→posts.id DEFERRABLE INITIALLY DEFERRED`; `user_id→users.id DEFERRABLE INITIALLY DEFERRED`

#### `project_roles`

Legacy project roles.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  |  |
| `name` | varchar(255) | null |  |
| `post_id` | bigint | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `post_id→posts.id DEFERRABLE INITIALLY DEFERRED`

#### `contributions`

Legacy request contributions.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  | `serial` |
| `post_id` | bigint |  |  |
| `user_id` | bigint |  |  |
| `contributed_at` | timestamptz |  |  |

- Keys: `PRIMARY KEY(id)`; `UNIQUE(post_id, user_id)`
- FKs: `post_id→posts.id DEFERRABLE INITIALLY DEFERRED`; `user_id→users.id DEFERRABLE INITIALLY DEFERRED`

#### `project_contributions`

Legacy project financial contributions.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `user_id` | bigint | null |  |
| `post_id` | bigint | null |  |
| `amount` | integer | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `post_id→posts.id DEFERRABLE INITIALLY DEFERRED`; `user_id→users.id DEFERRABLE INITIALLY DEFERRED`

#### `flagged_items`

Content flags: `user_id` reporter, `category`, `reason`, `link`, `object_id`, `object_type`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `user_id` | bigint | null |  |
| `category` | varchar(255) | null |  |
| `reason` | text | null |  |
| `link` | varchar(255) | null |  |
| `object_id` | bigint | null |  |
| `object_type` | varchar(255) | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `user_id→users.id DEFERRABLE INITIALLY DEFERRED`

#### `moderation_actions`

Moderation reports on posts (`reporter_id`, `post_id`, `group_id`, `text`, `anonymous`, `status` active|cleared).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `text` | text | null |  |
| `reporter_id` | bigint |  |  |
| `post_id` | bigint |  |  |
| `status` | text | null |  |
| `anonymous` | text | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `group_id` | bigint | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `group_id→groups.id ON DELETE CASCADE`; `post_id→posts.id`; `reporter_id→users.id`

#### `moderation_actions_agreements`

Group agreements cited by a moderation action.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `moderation_action_id` | bigint |  |  |
| `agreement_id` | bigint |  |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `agreement_id→agreements.id DEFERRABLE INITIALLY DEFERRED`; `moderation_action_id→moderation_actions.id DEFERRABLE INITIALLY DEFERRED`

#### `moderation_actions_platform_agreements`

Platform agreements cited by a moderation action.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `moderation_action_id` | integer | null |  |
| `platform_agreement_id` | integer | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `moderation_action_id→moderation_actions.id`; `platform_agreement_id→platform_agreements.id`

#### `user_post_relevance`

Precomputed user↔post relevance (`similarity`); experimental/unused by the UI.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  | `serial` |
| `user_id` | bigint | null |  |
| `post_id` | bigint | null |  |
| `similarity` | real | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`; `UNIQUE(user_id, post_id)`
- FKs: `post_id→posts.id DEFERRABLE INITIALLY DEFERRED`; `user_id→users.id DEFERRABLE INITIALLY DEFERRED`

### 6.5 Notifications & activity

#### `activities`

An event relevant to a reader: `actor_id`, `reader_id`, optional `post_id`, `comment_id`, `parent_comment_id`, `group_id`, `other_group_id`, `track_id`, `funding_round_id`, `contribution_id`, `project_contribution_id`; `meta.reasons` (array); `unread`. In-app notification list = activities via notifications with medium InApp.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `actor_id` | bigint | null |  |
| `reader_id` | bigint | null |  |
| `post_id` | bigint | null |  |
| `comment_id` | bigint | null |  |
| `unread` | boolean | null | `true` |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `meta` | jsonb | null | `'{}'::jsonb` |
| `parent_comment_id` | bigint | null |  |
| `contribution_id` | bigint | null |  |
| `project_contribution_id` | bigint | null |  |
| `group_id` | bigint | null |  |
| `other_group_id` | bigint | null |  |
| `track_id` | bigint | null |  |
| `funding_round_id` | bigint | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `contribution_id→contributions.id DEFERRABLE INITIALLY DEFERRED`; `funding_round_id→funding_rounds.id`; `group_id→groups.id DEFERRABLE INITIALLY DEFERRED`; `other_group_id→groups.id`; `parent_comment_id→comments.id DEFERRABLE INITIALLY DEFERRED`; `project_contribution_id→project_contributions.id DEFERRABLE INITIALLY DEFERRED`; `track_id→tracks.id`; `actor_id→users.id DEFERRABLE INITIALLY DEFERRED`; `comment_id→comments.id DEFERRABLE INITIALLY DEFERRED`; `post_id→posts.id DEFERRABLE INITIALLY DEFERRED`; `reader_id→users.id DEFERRABLE INITIALLY DEFERRED`

#### `notifications`

Delivery of an activity on a medium (`medium` 0/1/2), `user_id`, `sent_at`, `failed_at`, `processing_started_at` (claim lock). Rows older than 1 month deleted daily.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `activity_id` | bigint | null |  |
| `sent_at` | timestamptz | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `failed_at` | timestamptz | null |  |
| `medium` | integer | null |  |
| `user_id` | bigint | null |  |
| `processing_started_at` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `activity_id→activities.id DEFERRABLE INITIALLY DEFERRED`; `user_id→users.id`

#### `push_notifications`

Outgoing push messages: `alert`, `path`, `badge_no`, `platform`, `queued_at`, `sent_at`, `disabled`, `device_id` (legacy), `user_id`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `queued_at` | timestamptz | null |  |
| `sent_at` | timestamptz | null |  |
| `alert` | varchar(255) | null | `''::character varying` |
| `badge_no` | integer | null | `0` |
| `platform` | varchar(255) | null |  |
| `path` | varchar(255) | null |  |
| `disabled` | boolean | null |  |
| `device_id` | bigint | null |  |
| `user_id` | bigint | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `device_id→devices.id DEFERRABLE INITIALLY DEFERRED`; `user_id→users.id ON DELETE CASCADE`

### 6.6 Tracks & funding rounds

#### `tracks`

Learning tracks (see 21): `action_descriptor(_plural)` (e.g. 'Action'), `completion_message`, `completion_role_id` (role awarded on completion), `settings`, counters `num_actions`, `num_people_enrolled`, `num_people_completed`, `access_controlled` (paid), `group_id` (owning group), `deactivated_at`. Enrollment = membership in the track's space.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `action_descriptor_plural` | varchar(255) | null |  |
| `completion_message` | text | null |  |
| `deactivated_at` | timestamptz | null |  |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `settings` | jsonb | null | `'{}'::jsonb` |
| `num_actions` | integer | null | `0` |
| `num_people_enrolled` | integer | null | `0` |
| `num_people_completed` | integer | null | `0` |
| `completion_role_id` | bigint | null |  |
| `action_descriptor` | varchar(255) | null |  |
| `access_controlled` | boolean | null | `false` |
| `group_id` | bigint | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `group_id→groups.id ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED`

#### `funding_rounds`

Participatory funding rounds (see 22): `group_id` (space), `criteria`, `require_budget`, `voting_method`, `token_type`, `total_tokens`, `min_token_allocation`, `max_token_allocation`, phase dates (`submissions_open_at`, `submissions_close_at`, `voting_opens_at`, `voting_closes_at`), `submission_descriptor(_plural)`, `submitter_roles`/`voter_roles` (role id arrays), counters `num_submissions`, `num_participants`, flags `hide_final_results_from_participants`, `allow_self_voting`, `allow_late_joiners`, `show_realtime_votes`, `show_realtime_submissions`, `deactivated_at`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `group_id` | bigint |  |  |
| `criteria` | text | null |  |
| `require_budget` | boolean | null | `false` |
| `voting_method` | varchar(255) |  |  |
| `token_type` | varchar(255) | null |  |
| `total_tokens` | integer | null |  |
| `min_token_allocation` | integer | null |  |
| `max_token_allocation` | integer | null |  |
| `submissions_open_at` | timestamptz | null |  |
| `submissions_close_at` | timestamptz | null |  |
| `voting_opens_at` | timestamptz | null |  |
| `voting_closes_at` | timestamptz | null |  |
| `submission_descriptor` | varchar(255) | null |  |
| `submission_descriptor_plural` | varchar(255) | null |  |
| `num_submissions` | integer | null | `0` |
| `num_participants` | integer | null | `0` |
| `created_at` | timestamptz | null |  |
| `updated_at` | timestamptz | null |  |
| `submitter_roles` | jsonb | null | `'[]'::jsonb` |
| `voter_roles` | jsonb | null | `'[]'::jsonb` |
| `deactivated_at` | timestamptz | null |  |
| `hide_final_results_from_participants` | boolean | null | `false` |
| `allow_self_voting` | boolean | null | `false` |
| `allow_late_joiners` | boolean | null | `false` |

- Keys: `PRIMARY KEY(id)`
- FKs: `group_id→groups.id DEFERRABLE INITIALLY DEFERRED`

### 6.7 Payments (Stripe Connect)

#### `stripe_accounts`

Connected Stripe accounts (`stripe_account_external_id` = acct_…, legacy `refresh_token`). Referenced by `groups.stripe_account_id`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  |  |
| `stripe_account_external_id` | varchar(255) | null |  |
| `refresh_token` | varchar(255) | null |  |

- Keys: `PRIMARY KEY(id)`

#### `stripe_products`

Offerings sold by a group: Stripe product/price ids, `name`, `description`, `price_in_cents`, `currency`, `access_grants` JSON, `renewal_policy`, `duration`, `publish_status`, `track_id` (legacy), `metadata` (e.g. sliding scale).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  |  |
| `group_id` | bigint |  |  |
| `stripe_product_id` | varchar(255) |  |  |
| `stripe_price_id` | varchar(255) |  |  |
| `name` | varchar(255) |  |  |
| `description` | text | null |  |
| `price_in_cents` | integer |  |  |
| `currency` | varchar(3) |  | `'usd'::character varying` |
| `track_id` | integer | null |  |
| `access_grants` | jsonb | null | `'{}'::jsonb` |
| `renewal_policy` | varchar(20) | null | `'manual'::character varying` |
| `duration` | varchar(20) | null |  |
| `publish_status` | varchar(20) | null | `'unpublished'::character varying` |
| `created_at` | timestamptz |  | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamptz |  | `CURRENT_TIMESTAMP` |
| `metadata` | jsonb |  | `'{}'::jsonb` |

- Keys: `PRIMARY KEY(id)`
- FKs: `group_id→groups.id ON DELETE CASCADE`; `track_id→tracks.id`

#### `content_access`

Access granted to a user: by purchase or admin grant. `granted_by_group_id` (seller group), `group_id` (target group/space), `product_id`, `track_id` (legacy), `group_role_id`, `access_type`, `status`, `expires_at`, Stripe ids (`stripe_session_id`, `stripe_subscription_id`, `stripe_customer_id`), `granted_by_id`, `metadata`. Triggers maintain `user_scopes`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  |  |
| `user_id` | bigint |  |  |
| `granted_by_group_id` | bigint |  |  |
| `group_id` | bigint | null |  |
| `product_id` | bigint | null |  |
| `track_id` | integer | null |  |
| `access_type` | varchar(50) |  |  |
| `stripe_session_id` | varchar(255) | null |  |
| `status` | varchar(50) |  | `'active'::character varying` |
| `granted_by_id` | bigint | null |  |
| `expires_at` | timestamptz | null |  |
| `metadata` | jsonb | null | `'{}'::jsonb` |
| `created_at` | timestamptz |  | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamptz |  | `CURRENT_TIMESTAMP` |
| `stripe_subscription_id` | varchar(255) | null |  |
| `group_role_id` | integer | null |  |
| `stripe_customer_id` | varchar(255) | null |  |

- Keys: `PRIMARY KEY(id)`
- FKs: `granted_by_group_id→groups.id`; `granted_by_id→users.id`; `group_id→groups.id`; `group_role_id→groups_roles.id`; `product_id→stripe_products.id`; `track_id→tracks.id`; `user_id→users.id`

#### `subscription_change_events`

Audit/state of membership subscription changes (`mode`, `status`, `from_product_id`, `to_product_id`, `correlation_id`, `pending_effective_at`, `applied_at`, `error_message`, `payload`).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  |  |
| `user_id` | bigint |  |  |
| `group_id` | bigint |  |  |
| `correlation_id` | varchar(64) |  |  |
| `from_product_id` | bigint | null |  |
| `to_product_id` | bigint | null |  |
| `mode` | varchar(64) |  |  |
| `stripe_subscription_id` | varchar(255) | null |  |
| `stripe_customer_id` | varchar(255) | null |  |
| `status` | varchar(32) |  | `'pending'::character varying` |
| `payload` | jsonb |  | `'{}'::jsonb` |
| `pending_effective_at` | timestamptz | null |  |
| `applied_at` | timestamptz | null |  |
| `error_message` | text | null |  |
| `created_at` | timestamptz |  | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamptz |  | `CURRENT_TIMESTAMP` |

- Keys: `UNIQUE(correlation_id)`; `PRIMARY KEY(id)`
- FKs: `from_product_id→stripe_products.id ON DELETE SET NULL`; `group_id→groups.id ON DELETE CASCADE`; `to_product_id→stripe_products.id ON DELETE SET NULL`; `user_id→users.id ON DELETE CASCADE`

#### `stripe_logs`

Consolidated Stripe log: disputes, refunds and alerts (`log_type`, `alert_type`, `threshold_triggered`, `charge_id`, `amount`, `currency`, `reason`, `status`, `metadata`).

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint |  |  |
| `stripe_account_id` | bigint | null |  |
| `group_id` | bigint | null |  |
| `content_access_id` | bigint | null |  |
| `log_type` | varchar(32) |  |  |
| `external_id` | varchar(255) | null |  |
| `alert_type` | varchar(64) | null |  |
| `threshold_triggered` | text | null |  |
| `charge_id` | varchar(255) | null |  |
| `amount` | integer | null |  |
| `currency` | varchar(3) | null |  |
| `reason` | varchar(255) | null |  |
| `status` | varchar(64) | null |  |
| `metadata` | jsonb |  | `'{}'::jsonb` |
| `created_at` | timestamptz |  | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamptz |  | `CURRENT_TIMESTAMP` |

- Keys: `UNIQUE(log_type, external_id)`; `PRIMARY KEY(id)`
- FKs: `content_access_id→content_access.id ON DELETE SET NULL`; `group_id→groups.id ON DELETE SET NULL`; `stripe_account_id→stripe_accounts.id ON DELETE SET NULL`

#### `stripe_webhook_processed_events`

Idempotency ledger of processed Stripe webhook event ids.

| Column | Type | Null | Default |
|---|---|---|---|
| `stripe_event_id` | varchar(255) |  |  |
| `created_at` | timestamptz |  | `CURRENT_TIMESTAMP` |

- Keys: `PRIMARY KEY(stripe_event_id)`

### 6.8 System

#### `knex_migrations`

Applied migrations.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer |  |  |
| `name` | varchar(255) | null |  |
| `batch` | integer | null |  |
| `migration_time` | timestamptz | null |  |

- Keys: `PRIMARY KEY(id)`

#### `knex_migrations_lock`

Migration lock.

| Column | Type | Null | Default |
|---|---|---|---|
| `is_locked` | integer | null |  |

