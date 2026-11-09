# 03 — GraphQL API & HTTP endpoints

> Foundation module. Conventions and the complete surface of Hylo's API: every GraphQL Query, Mutation and Subscription (generated from `apps/backend/api/graphql/schema.graphql` and checked against the resolver map in `apps/backend/api/graphql/makeSchema.js`), the object/input types, and the REST endpoints outside GraphQL (`apps/backend/config/routes.js`, controllers, OIDC hooks). Behaviour of individual operations is specified in the feature modules; infrastructure (auth, sessions, sockets) in [01-architecture.md](01-architecture.md); storage in [02-data-model.md](02-data-model.md).

---

## 1. Overview

- Single GraphQL endpoint: **`/noo/graphql`** on the API host (also reachable through the web server's `/noo` proxy). Served by GraphQL Yoga 5; accepts `GET` and `POST` (`application/json` `{query, variables, operationName}`); subscriptions over **Server-Sent Events** (`Accept: text/event-stream`).
- Schema is SDL-first (`schema.graphql`, ~4.7k lines). Resolvers are generated from Bookshelf models through `lib/graphql-bookshelf-bridge` + `api/graphql/makeModels.js` (attribute maps, relations, per-type filters), plus hand-written root resolvers in `makeSchema.js`, mutations in `api/graphql/mutations/*`, queries in `api/graphql/queries/*`.
- Scalars: `Date` (ISO-8601 string), `JSON` (arbitrary JSON).
- GraphiQL: enabled in non-production; in production only for Hylo admins.

## 2. Conventions

### 2.1 Authentication & identity tiers
Resolved per request (01 §5.6–5.7):
1. Cookie session (`COOKIE_NAME`) → `currentUserId`.
2. `Authorization: Bearer <token>`: opaque OIDC access token → acts as that user (cookie ignored and not refreshed); JWT from a `role: 'super'` client-credentials client → API client without user. Invalid → HTTP 401/403 JSON `{error:'Unauthorized'}` before GraphQL runs.
3. Legacy `access_token` param / `x-access-token` header (linked_account `token`).

Root resolver sets per tier:

| Tier | Queries | Mutations |
|---|---|---|
| Anonymous | `checkInvitation`, `group` (public, or any active group when `accessCode`/`invitationToken` matches that group or its parent), `groups` (forced `visibility: 2`), `platformAgreements`, `person`, `post` / `posts` (forced `isPublic`), `publicStripeOfferings`, `publicStripeOffering` | `login`, `logout`, `sendEmailVerification`, `sendPasswordReset`, `register`, `verifyEmail`, `createStripeCheckoutSession` |
| API client (no user) | `group`, `groups`, `person` | `addMember`, `createGroup(asUserId)`, `updateGroup(asUserId)` |
| Logged-in user | all others below (plus public mutations) | all except API-only ones |

Calling an operation not in the tier's resolver map returns `null` for that field (no resolver) rather than an auth error. Type-level filters (`api/graphql/filters.js`: `groupFilter`, `postFilter`, `commentFilter`, `personFilter`, `membershipFilter`, …) further restrict what any tier sees — e.g. non-members only see public/protected groups related to their groups; a former paying member can load a hidden/protected paywalled group they left while their scope is valid.

Side effects of every authenticated GraphQL request: `users.last_active_at` updated at most once per 5 minutes per session (skipped for OAuth clients); Mixpanel `people.set(userId)` when the schema is (re)built.

Subscriptions (`Subscription` type) are available on all tiers but resolve to nothing without a user.

### 2.2 Pagination & lists
- List queries return a **QuerySet**: `{ total: Int, hasMore: Boolean, items: [T] }`.
- Arguments: `first` (page size), `offset` (skip), `order` (`asc`/`desc`, strings are case-insensitive in practice), `sortBy` (per query), optional `cursor` (`posts`: id-based; cannot be combined with a non-`id` `sortBy` → error `Specifying both cursor and sortBy is not supported.`).
- `total` comes from a window count (`__total`) unless skipped for heavy queries, in which case `total = offset + items.length + (hasMore ? 1 : 0)`; `hasMore = offset + first < total`.
- Defaults: `search.first` 20; `moderationActions.first` 20; `skills` autocomplete 1000; `topics` 20; other lists require `first` from the client (web typically 10–20, members 20, notifications 20).
- Relation fields on types accept the same args (e.g. `Group.posts(first, offset, sortBy, filter, ...)`, `Post.comments(first, cursor, order)`).

### 2.3 Naming & mapping
- Fields are camelCase projections of snake_case columns; some renamed: `Post.title` ← `name`, `Post.details` ← `description`, `Person`/`Me` both ← `users`, `MessageThread` ← `posts` (type `thread`), `Message` ← `comments` in a thread, `Topic` ← `tags`, `GroupTopic` ← `groups_tags`, `TopicFollow` ← `tag_follows`, `Membership` ← `group_memberships`, `Attachment` ← `media`, `StripeOffering` ← `stripe_products`.
- JSON `settings` blobs are exposed through typed settings objects (`GroupSettings`, `MembershipSettings`, `UserSettings`, …) with camelCase keys.
- IDs are `ID` (stringified integers).

### 2.4 Mutation results
- Many mutations return `GenericResult { success: Boolean, error: String }`; others return the mutated object.
- Validation and permission failures throw `GraphQLError` with a human-readable message (common: `You do not have permission to do that`, `Slug is invalid`, `Unauthorized: Admin access required`, rate-limit text `Too many attempts. Please wait a few minutes and try again.`, invite limit code `invite-limit`).

### 2.5 Error format
Standard GraphQL response, HTTP 200: `{ "data": {...|null}, "errors": [{ "message", "locations", "path", "extensions"? }] }`. Errors thrown as `GraphQLError` pass through verbatim. Any other exception is **masked** as `"Unexpected error."` and logged + reported to Sentry with the operation name, path and user id (01 §2.6). Auth middleware failures (Bearer) are HTTP 401/403 JSON, not GraphQL errors.

### 2.6 Caching & performance
- Schema instance cached per identity (`userId|isAdmin|apiClientId`, LRU 16); DataLoaders cleared per request (`initDataLoaders`: e.g. `tagFollow`, `tagByName` loaders used by `GroupTopic.isSubscribed`, `Post.topics`).
- Responses gzip/brotli compressed (01 §2.4).
- Zapier compatibility: `imageUrls` variables arriving as nested arrays (`[[url]]`) are flattened before validation.

### 2.7 Client usage
- Web: Redux `graphqlMiddleware` posts to `/noo/graphql` with cookies; queries defined inline in `apps/web/src/**` and `.graphql` files.
- Mobile: urql with documents in `packages/graphql`; Bearer tokens; unified `allUpdates` subscription.
- External: OIDC clients (24).

---

## 3. Subscriptions

Transport: SSE on `/noo/graphql`. Payloads are published to Redis channels (01 §6.2). Events originated by the subscriber are suppressed (`withDontSendToCreator`) unless request header `subscriptions-debug` is present.

| Field | Args | Returns | Channel(s) | Notes |
|---|---|---|---|---|
| `comments` | `postId: ID`, `parentCommentId: ID` | `Comment` | `comments:commentId:<parentCommentId>` if given, else `comments:postId:<postId>` | Requires the post (or parent comment's post) to be visible to the user, else `You do not have permission to do that`. Published by `createComment`/`updateComment`/message creation. |
| `peopleTyping` | `messageThreadId`, `postId`, `commentId` | `Person` | `peopleTyping:messageThreadId:<id>` / `:postId:` / `:commentId:` | Visibility check as above. Published by `peopleTyping` mutation and socket typing route. |
| `updates` | — | `Update` = `Message \| MessageThread \| Notification` | `updates:<userId>` | New DM message / new thread / new notification. |
| `groupUpdates` | — | `Group` | `groupUpdates:<userId>` | Group changes for members. |
| `groupMembershipUpdates` | — | `GroupMembershipUpdate {group, member, action: 'joined'|'left'}` | `groupMembershipUpdates:<userId>` | |
| `groupRelationshipUpdates` | — | `GroupRelationshipUpdate {parentGroup, childGroup, action, relationship}` | `groupRelationshipUpdates:<userId>` | `action` ∈ `relationship_created`, `relationship_removed`, `invite_sent`, `invite_accepted`, `invite_rejected`, `invite_cancelled`. |
| `postUpdates` | — | `Post` | `postUpdates:<userId>` | Partial post payloads by change context: `comment` (commentsTotal, comments), `reaction` (peopleReactedTotal, reactionsSummary, postReactions), `vote` (proposalStatus, proposalOutcome, proposalOptions, proposalVotes), `completion` (fulfilledAt, completedAt), `edit` (title, details, type, location, startTime, endTime). Sent to followers + creator. |
| `allUpdates` | — | `SubscriptionUpdate` = `Notification \| Group \| GroupMembershipUpdate \| GroupRelationshipUpdate \| Post \| Comment \| Person` | merges the five per-user channels | One SSE connection (Android connection limit). Empty stream when anonymous. |

---

## 4. Root operations

Format: **`name`**`(args)` → `ReturnType` — description from the schema _[implementation notes]_. Argument comments follow under "Args". Operations are grouped by domain; see the linked feature module for behaviour:
accounts → 04/05/20; groups → 09/10/11; roles & moderation → 12; views/topics → 15/17; posts → 13/14; messages & notifications → 18/19; tracks/funding → 21/22; paid content → 23; integrations → 24.

### 4.1 Query fields


#### Query — Accounts, session & profile

- **`connections`**`(first: Int, offset: Int, autocomplete: String, excludeGroupId: ID, requireName: Boolean)` → `PersonConnectionQuerySet` — Query for PersonConnections
  - Args: `first`: Number of PersonConnections to load; `offset`: Start loading at this offset; `autocomplete`: Return connections whose names match this string; `excludeGroupId`: Exclude people who are already members of this group; `requireName`: When true, omit connections whose name is blank or missing
- **`draft`**`(type: String, postId: ID, groupId: ID, topicId: ID, messageThreadId: ID, postType: String, isEdit: Boolean)` → `Draft` — Get a single draft by context (pass the relevant context IDs for the type)
- **`me`**`()` → `Me` — Get the currently logged in user
- **`myDrafts`**`()` → `[Draft]` — Get all drafts for the currently logged in user
- **`people`**`(autocomplete: String, boundingBox: [PointInput], filter: String, first: Int, groupIds: [ID], excludeGroupId: ID, requireName: Boolean, offset: Int, order: String, sortBy: String, search: String)` → `PersonQuerySet` — Query for people
  - Args: `autocomplete`: Only return People whose name starts with the autocomplete string; `boundingBox`: Only return People who have a location set that is in this geographic bounding box; `filter`: NOT USED; `first`: Number of People to return; `groupIds`: Only return members of these groups by group ID; `excludeGroupId`: Exclude active members of this group; `requireName`: When true, omit people with a blank or missing name; `offset`: For pagination return people after this offset; `order`: Number of People to return; `sortBy`: Options are: 'name', 'location', 'join' (join date), 'last_active_at'; `search`: Return People where the search term matches the name, bio or skills on their profile
- **`person`**`(id: ID, email: String)` → `Person` — Find a Person by ID or by email _[**Public/API** allowed (public profile rules apply).]_
- **`platformAgreements`**`()` → `[PlatformAgreement]` — Query for all platform agreements _[**Public.**]_
- **`skills`**`(autocomplete: String, first: Int, offset: Int)` → `SkillQuerySet` — Query for Skills
  - Args: `autocomplete`: Return skills that start with the autocomplete string; `first`: Number of skills to return; `offset`: For pagination, return results after this offset

#### Query — Groups, spaces & relationships

- **`group`**`(id: ID, slug: String, updateLastViewed: Boolean, accessCode: String, invitationToken: String)` → `Group` — Read a group by id or by slug _[**Public** for public groups or with matching `accessCode`/`invitationToken`; **API client** by id/slug.]_
  - Args: `updateLastViewed`: Set to true to mark all notifications as read for this group by the current logged in user; `accessCode`: Access code from invitation link - allows viewing the about page for restricted/hidden groups; `invitationToken`: Invitation token from email invite - allows viewing the about page for restricted/hidden groups
- **`groupExists`**`(slug: String)` → `GroupExistsOutput` — Check whether a Group exists by URL slug
- **`groupExtension`**`(id: ID)` → `GroupExtension` — Query for group extension data by ID
- **`groupExtensions`**`(extensionIds: [ID], groupIds: [ID])` → `GroupExtensionQuerySet` — Query for group extensions
  - Args: `extensionIds`: Only return extension data with one of these IDs; `groupIds`: Only return extension data for these groups by group ID
- **`groups`**`(allowedInPublic: Boolean, autocomplete: String, boundingBox: [PointInput], context: String, farmType: Find, productCategories: Find, certOrManagementPlan: Find, farmQuery: JSON, filter: String, first: Int, groupIds: [ID], groupType: String, nearCoord: PointInput, offset: Int, order: String, parentSlugs: [String], search: String, sortBy: String, visibility: Int)` → `GroupQuerySet` — Query for groups _[**Public** forces `visibility=2`; **API client** allowed.]_
  - Args: `allowedInPublic`: Whether to only return groups that are allowed to be shown in public; `autocomplete`: Search for groups who's name starts with the autcomplete string; `boundingBox`: Find only groups in this geographic bounding box; `context`: If 'all' return only groups that the current logged in user is a member of. If 'public' return only groups with visibility = Public.; `filter`: XXX: NOT USED; `first`: Int of groups to return; `groupIds`: Only find these groups, by ID; `groupType`: Only return groups of this type. Only valid option right now is 'farm'; `nearCoord`: Use along with sortBy: 'nearest' to return groups sorted by closeness to this coordinate; `offset`: For pagination, return groups after this offset; `order`: Determines sort order, either 'ASC' or 'DESC'; `parentSlugs`: Return only groups that are children of any of these parent groups by slug; `search`: Find groups where search text is in the name, description or location; `sortBy`: 'name', 'size', or 'nearest'; `visibility`: Filter groups by visibility: 0: hidden (only groups logged in user is a member of), 1: Protected, includes groups that are related to groups logged in user is a member of, 2: Public groups only
- **`publicListingRequests`**`(status: String)` → `[Group]` — Groups that have asked to be added to the commons, filtered by request status: pending, approved or denied. Omit status for all (admin only) _[Hylo admin only.]_

#### Query — Membership, joining & invitations

- **`checkInvitation`**`(invitationToken: String, accessCode: String)` → `CheckInvitationResult` — Check if a group invitation is still valid _[**Public.**]_
- **`joinRequests`**`(groupId: ID, status: Int)` → `JoinRequestQuerySet` — Query for JoinRequests representing a user requesting to join a group _[Requires Add Members in `groupId`.]_
  - Args: `groupId`: Only return JoinRequests for this group by ID; `status`: Only return JoinRequests with this status: 0 = Pending, 1 = Accepted, 2 = Rejected, 3 = Canceled

#### Query — Roles, responsibilities & moderation

- **`moderationActions`**`(first: Int, offset: Int, sortBy: String, slug: String)` → `ModerationActionQuerySet` — Fetch moderation actions
  - Args: `first`: Number of moderation actions to load; `offset`: Start loading moderation actions after this offset; `sortBy`: Determines sort order; `slug`: Group or space URL slug. A space returns only its own actions. A group also includes child-space actions the viewer is a member of, or all child spaces if they have the Manage Content responsibility.
- **`responsibilities`**`(groupId: ID, groupRoleId: ID)` → `[Responsibility]` — Query for responsibilities
  - Args: `groupId`: responsibilties for a group id; `groupRoleId`: responsibilties for a groupRole id

#### Query — Views, menus & topics

- **`groupTopic`**`(groupSlug: String, topicName: String)` → `GroupTopic` — Find a GroupTopic by Group's URL slug and Topic name
- **`groupTopics`**`(autocomplete: String, first: Int, groupId: ID, groupIds: [ID], isDefault: Boolean, offset: Int, order: String, sortBy: String, subscribed: Boolean, visibility: [Int])` → `GroupTopicQuerySet` — Query for GroupTopics (relationship between a Group and a Topic)
  - Args: `autocomplete`: Return only topics whose name starts with the autocomplete string; `first`: Int of GroupTopics to return; `groupId`: filter by group id XXX: DEPRECATED use groupIds instead; `groupIds`: filter by group ids; `isDefault`: If true only return topics that are set to be a default topic in a group that the current logged in user is a member of; `offset`: For pagination, start loading GroupTopics after this offset; `order`: Determines sort order, either 'ASC' or 'DESC'; `sortBy`: Sort by 'name' or 'id'; `subscribed`: If true only return group topics that the current logged in user is subscribed to (following); `visibility`: Only return topics that are set to this visibility in a group that the current logged in user is a member of: 0 = hidden in the group, 1 = visible, 2 = pinned
- **`topic`**`(id: ID, name: String)` → `Topic` — Find a Topic by ID or by name (text)
- **`topicFollow`**`(groupId: ID, topicName: String)` → `TopicFollow` — Find one of your TopicFollows by group ID and topic name.
- **`topics`**`(autocomplete: String, first: Int, groupIds: [ID], groupSlug: String, isDefault: Boolean, offset: Int, sortBy: String, visibility: [Int])` → `TopicQuerySet` — Query for Topics
  - Args: `autocomplete`: Return only topics whose name starts with the autocomplete string; `first`: Number of topics to return; `groupIds`: Only return topics used in these groups by group ID; `groupSlug`: Only return topics used in this Group by URL slug; `isDefault`: If true only return topics that are set to be a default topic in a group that the current logged in user is a member of; `offset`: For pagination, only return Topics after this offset; `sortBy`: Sort by 'name' or 'num_followers'; `visibility`: Only return topics that are set to this visibility in a group that the current logged in user is a member of: 0 = hidden in the group, 1 = visible, 2 = pinned

#### Query — Posts, comments & reactions

- **`comment`**`(id: ID)` → `Comment` — Find an Comment by ID
- **`post`**`(id: ID)` → `Post` — Query for a Post by ID _[**Public** only public posts.]_
- **`posts`**`(activePostsOnly: Boolean, afterTime: Date, announcementsOnly: Boolean, beforeTime: Date, boundingBox: [PointInput], collectionToFilterOut: ID, context: String, createdBy: [ID], cursor: ID, filter: String, first: Int, forCollection: ID, groupSlugs: [String], isFulfilled: Boolean, interactedWithBy: [ID], mentionsOf: [ID], offset: Int, order: String, savedBy: [ID], search: String, sortBy: String, topic: ID, topics: [ID], types: [String], rsvpResponse: String)` → `PostQuerySet` — Query for a set of Posts _[**Public** forces `isPublic`.]_
  - Args: `activePostsOnly`: Only return posts that have not be fulfilled/completed and that are not past their end time; `afterTime`: Only return posts that end after this time; `announcementsOnly`: Only return announcements; `beforeTime`: Only return posts that end before this time; `boundingBox`: Only return posts within this geographic bounding box; `collectionToFilterOut`: Only return posts that are not in this collection; `context`: If 'all' only return posts from groups the current logged in user is a member of. If 'public' only return pubic posts; `createdBy`: Return posts from these users; `cursor`: Load posts before or after this ID, depending on sort order; `filter`: Only return posts of this type: 'discussion', 'event', 'offer', 'project', 'proposal', 'request' or 'resource'; `first`: Number of posts to return; `forCollection`: Only return posts that are in this collection; `groupSlugs`: Only return posts from this set of groups by group URL slug; `isFulfilled`: true = Only return posts that have been marked fulfilled/complete, false = only return posts not marked fulfilled/complete; `interactedWithBy`: Return posts that these users have reacted to or commented on; `mentionsOf`: Return posts that mention these users; `offset`: For pagination return posts after this offset; `order`: Determines sort order, either 'ASC' or 'DESC'; `savedBy`: Return posts that these users have saved; `search`: Return posts whose name or description match the search term; `sortBy`: One of 'created' (created datetime), 'updated' (last updated datetime), 'reactions' (number of reactions), 'start_time', 'saved' (saved datetime); `topic`: Return only posts that have this topic by ID; `topics`: Return only posts that have any of these topics by topic ID; `types`: Return only posts that are one of these types: 'discussion', 'event', 'offer', 'project', 'proposal', 'request' and/or 'resource'; `rsvpResponse`: Only return events that the current user has RSVPed to with this response (yes, no, interested)
- **`search`**`(first: Int, groupIds: [ID], offset: Int, term: String, type: String)` → `SearchResultQuerySet` — Full text search for posts, people and comments _[Default `first` 20; full-text over `search_index` (07).]_
  - Args: `first`: Number of results to return; `groupIds`: Search only in these group ids; `offset`: For pagination, return results after this offset; `term`: Search term; `type`: Only search for content of a specific type: 'post', 'person', 'comment', or 'group'

#### Query — Messages, notifications & real-time

- **`activity`**`(id: ID)` → `Activity` — Find an Activity by ID
- **`allSiteBanners`**`()` → `[SiteBanner]` — All site banners, past and present (admin only) _[Hylo admins only.]_
- **`emailEnabledTesters`**`()` → `[EmailEnabledTester]` — Query for email-enabled testers (admin only) _[Test admins (`HYLO_TESTER_IDS` or `HYLO_ADMINS`).]_
- **`messageThread`**`(id: ID)` → `MessageThread` — Query for a MessageThread by ID _[Returns null for non-numeric id.]_
- **`notifications`**`(first: Int, offset: Int, order: String, resetCount: Boolean)` → `NotificationQuerySet` — Query notifications for the currently logged in user _[`order` default `desc`; `resetCount` zeroes `users.new_notification_count`.]_
  - Args: `first`: Number of notifications to load; `offset`: Start loading notifications after this offset; `order`: Determines sort order, either 'ASC' or 'DESC'; `resetCount`: Reset the count of new notifications on all devices for currently logged in user
- **`savedSearches`**`(userId: ID)` → `SavedSearchQuerySet` — Query for SavedSearches by user ID
- **`siteBanners`**`()` → `[SiteBanner]` — Active, undismissed site banners for the current user

#### Query — Tracks & funding rounds

- **`fundingRound`**`(id: ID)` → `FundingRound` — Query for a FundingRound by ID
- **`track`**`(id: ID)` → `Track`

#### Query — Paid content & Stripe

- **`checkContentAccess`**`(userId: ID!, grantedByGroupId: ID!, groupId: ID, productId: ID, trackId: ID, groupRoleId: ID)` → `ContentAccessCheckResult` — Check if a user has access to content
- **`contentAccess`**`(groupIds: [ID], search: String, accessType: String, status: String, offeringId: ID, trackId: ID, groupId: ID, groupRoleId: ID, first: Int, offset: Int, order: String, sortBy: String)` → `ContentAccessQuerySet` — Query for content access records _[Requires Administration in every `groupIds` group.]_
  - Args: `groupIds`: Filter by one or more group IDs (groups that granted the access); `search`: Search by user name; `accessType`: Filter by access type: 'stripe_purchase' or 'admin_grant'; `status`: Filter by status: 'active', 'expired', or 'revoked'; `offeringId`: Filter by offering ID; `trackId`: Filter by track ID (legacy); `groupId`: Filter by target group/space ID (content_access.group_id); `groupRoleId`: Filter by group role ID; `first`: Number of records to return; `offset`: For pagination, start loading after this offset; `order`: Determines sort order, either 'ASC' or 'DESC'; `sortBy`: Sort by 'created_at', 'expires_at', 'user_name'
- **`membershipChangeEligibleOfferings`**`(groupId: ID!)` → `MembershipChangeEligibleOfferingsResult` — Published recurring offerings that grant group access (for subscription change UI). Excludes test-only day duration.
- **`membershipChangeInvoicePreview`**`(groupId: ID!, fromOfferingId: ID!, toOfferingId: ID!)` → `MembershipChangeInvoicePreview` — Stripe upcoming invoice preview for immediate-proration membership changes. For non-immediate modes, returns mode/reason with null pricing fields.
- **`membershipChangePreview`**`(groupId: ID!, fromOfferingId: ID!, toOfferingId: ID!, isPastDue: Boolean, isSlidingScaleQuantityOnly: Boolean)` → `MembershipChangePreview` — Rule outcome for changing between two offerings (does not call Stripe). Optional flags for Stripe-backed state.
- **`myTransactions`**`(first: Int, offset: Int, status: String, accessType: String, offeringId: ID, paymentType: String)` → `UserTransactionQuerySet` — Query the current user's transactions/purchases
  - Args: `first`: Number of transactions to return; `offset`: For pagination, start loading after this offset; `status`: Filter by status: 'active', 'expired', 'revoked', 'refunded'; `accessType`: Filter by access type: 'group', 'track', 'role'; `offeringId`: Filter by offering/product ID; `paymentType`: Filter by payment type: 'subscription', 'one_time'
- **`offeringSubscribers`**`(offeringId: ID!, groupId: ID!, page: Int, pageSize: Int, lapsedOnly: Boolean)` → `OfferingSubscribersQuerySet` — Get paginated list of subscribers for an offering
  - Args: `offeringId`: The offering (StripeProduct) ID; `groupId`: The group ID (for permission checks); `page`: Page number (1-indexed, default 1); `pageSize`: Number of results per page (default 50, max 100); `lapsedOnly`: If true, only return lapsed subscribers
- **`offeringSubscriptionStats`**`(offeringId: ID!, groupId: ID!)` → `OfferingSubscriptionStats` — Get subscription stats for an offering (active count, lapsed count, revenue)
- **`publicStripeOffering`**`(offeringId: ID!)` → `StripeOffering` — Get a single offering by ID (public, no auth required, includes unlisted) _[**Public.**]_
- **`publicStripeOfferings`**`(groupId: ID!)` → `StripeOfferingsResult` — List published offerings for a group (public, no auth required) _[**Public.**]_
- **`stripeAccountStatus`**`(groupId: ID!, accountId: String!)` → `StripeAccountStatusResult` — Get the status of a connected Stripe account
- **`stripeOfferings`**`(groupId: ID!, accountId: String!)` → `StripeOfferingsResult` — List all offerings for a connected Stripe account

### 4.2 Mutation fields


#### Mutation — Accounts, session & profile

- **`addSkill`**`(name: String, type: Int)` → `Skill` — Add a skill to your profile
  - Args: `type`: 0 = Has this skill already, 1 = a skill I want to learn
- **`addSkillToLearn`**`(name: String)` → `Skill` — Add a skill you want to learn to your profile
- **`blockUser`**`(blockedUserId: ID)` → `GenericResult` — For logged in user to block a user, meaning they will no longer see the user's posts and that user can no longer see theirs or message them.
- **`cancelEmailChange`**`()` → `GenericResult` — Cancel a pending change of your login email. The verification code and link sent to the new address stop working
- **`createAffiliation`**`(data: AffiliationInput)` → `Affiliation` — For logged in user to add an Affiliation to their profile
- **`deactivateMe`**`(id: ID)` → `GenericResult` — Used by current logged in user to deactivate their account _[Uses current session id to keep this session.]_
- **`deleteAffiliation`**`(id: ID)` → `ID` — Delete an Affiliation from your profile
- **`deleteDraft`**`(id: ID!)` → `GenericResult` — Delete a draft by ID
- **`deleteMe`**`()` → `GenericResult` — Used by current logged in user to delete their account permanently _[Permanent deletion.]_
- **`login`**`(email: String, password: String)` → `SignupResult` — Login to Hylo on current device using email and password. TODO: add more info about errors, sessions, etc. _[**Public.** Email+password; sets cookie session. Rate limited (01 §5.2).]_
- **`logout`**`()` → `GenericResult` — Logout from Hylo on the current device _[**Public.**]_
- **`reactivateMe`**`(id: ID)` → `GenericResult` — For a deactivated user to reactivate their account. _[Quirk: resolver signature is `(root, context)` so `currentUserId` is read from args and is undefined.]_
- **`register`**`(name: String!, password: String!)` → `SignupResult` — Create a new user account _[**Public.** Completes signup for the verified email in session (name + password).]_
- **`registerDevice`**`(playerId: String, platform: String, version: String)` → `GenericResult` — DEPRECATED: register a new mobile device to the current logged in user account _[Deprecated no-op.]_
- **`removeSkill`**`(id: ID, name: String)` → `GenericResult` — Remove a skill from your user profile
- **`removeSkillToLearn`**`(id: ID, name: String)` → `GenericResult` — Remove a skill you want to learn from your user profile
- **`saveDraft`**`(type: String!, data: String!, postId: ID, groupId: ID, topicId: ID, messageThreadId: ID, postType: String, isEdit: Boolean, navigateTo: String)` → `Draft` — Save (upsert) a draft for the currently logged in user
- **`sendEmailVerification`**`(email: String!)` → `GenericResult` — When a new person signs up, send them an email to verify their email address so they can finish registering _[**Public.** Rate limited.]_
- **`sendPasswordReset`**`(email: String!)` → `GenericResult` — Send a password reset email _[**Public.** Rate limited; always reports success.]_
- **`unblockUser`**`(blockedUserId: ID)` → `GenericResult` — Unblock a user
- **`unlinkAccount`**`(provider: String)` → `GenericResult` — Unlink profile from previously linked social platform. Provider can be 'facebook', 'twitter', or 'linkedin'
- **`updateMe`**`(changes: MeInput)` → `Me` — Update your settings or profile information _[Changing `email` starts a verified email change (code sent to new address).]_
- **`verifyEmail`**`(code: String, email: String!, token: String)` → `SignupResult` — Verify your email address, manually by code or automatically by URL token _[**Public.** Code or token; rate limited (verifyCode).]_
  - Args: `code`: The shortcode sent via email; `email`: Your email address; `token`: For verifying by clicking on a URL, the unique verification token
- **`verifyEmailChange`**`(code: String, token: String)` → `SignupResult` — Verify the new login email requested via updateMe, using the code or the link's token sent to that address
  - Args: `code`: The 6 digit code sent to the new address; `token`: For verifying by clicking on a URL, the token from the link

#### Mutation — Groups, spaces & relationships

- **`acceptGroupRelationshipInvite`**`(groupRelationshipInviteId: ID)` → `AcceptGroupRelationshipInviteResult` — For a steward to accept an invitation to one of their groups to be related to another group (either as a parent or a child)
- **`addSuggestedSkillToGroup`**`(groupId: ID, name: String)` → `Skill` — Add a suggested skill to a Group. Only a group steward can do this.
- **`allowGroupInvites`**`(groupId: ID, data: Boolean)` → `Group` — NOT USED RIGHT NOW. Toggle whether a Group allows non-hosts to invite new people to the Group. Only a group steward can call this.
- **`archiveSpace`**`(id: ID!)` → `Group` — Archive a Space (status=archived; removes its menu entry from the parent). Stays in More Spaces → Archived.
- **`cancelGroupRelationshipInvite`**`(groupRelationshipInviteId: ID)` → `GenericResult` — For a steward of a group that has invited a group to be in relationship with it, to cancel that invitation.
- **`convertChatSpaceToDiscussion`**`(spaceId: ID!, title: String, dryRun: Boolean)` → `ConvertChatSpaceToDiscussionResult` — Turn a chat-only space into one discussion post. Chat messages become comments. The room is removed. No notifications are sent.
  - Args: `dryRun`: When true, return counts and write nothing
- **`convertGroupToSpace`**`(id: ID!, parentGroupId: ID!)` → `Group` — Convert a child Group into a Space of its single parent
- **`convertSpaceToChildGroup`**`(id: ID!)` → `Group` — Convert a regular Space into a child Group of its parent
- **`createGroup`**`(data: GroupInput, asUserId: ID)` → `Group` — Create a new Group _[User; or **API client** with `asUserId`.]_
  - Args: `asUserId`: Create the group as a specific user. Only supported by particular API keys.
- **`createSpace`**`(parentGroupId: ID!, name: String!, slug: String, acceptedPostTypes: [String], visibility: Int, accessibility: Int, icon: String, description: String, requiredRoles: [Int], purpose: String, location: String, locationId: ID, geoShape: String, viewTypes: [String], bannerUrl: String, avatarUrl: String, paywall: Boolean, addToMenu: Boolean, status: GroupStatus, autoAddMembers: Boolean)` → `Group` — Create a new Space (a child Group) within a parent Group
  - Args: `geoShape`: GeoJSON geometry (e.g. a Polygon) outlining the space's region; `paywall`: When true, space is Paid access (forces protected + restricted); `addToMenu`: When false, parent menu space view is created off-menu (More Views). Default true.; `status`: draft or published. Drafts are always created off-menu.; `autoAddMembers`: When true, current parent-group members are added in the background (except people who previously left)
- **`deleteGroup`**`(id: ID)` → `GenericResult` — Delete a group that you are a steward of
- **`deleteGroupRelationship`**`(parentId: ID, childId: ID, relationshipType: Int)` → `GenericResult` — Remove the relationship between two groups if you are a steward of one of them _[`relationshipType` arg is ignored by the resolver.]_
- **`deletePeerRelationship`**`(relationshipId: ID)` → `GenericResult` — Remove a peer-to-peer relationship between two groups by relationship ID. Only a group steward can call this.
- **`deleteSpace`**`(id: ID!)` → `GenericResult` — Soft-delete a Space (active=false). Hidden from menus and More Spaces.
- **`inviteGroupToJoinParent`**`(parentId: ID, childId: ID)` → `CreatedGroupRelationshipInvite` — Invite a group to join one of your groups as a child of it. Only a group steward can call this.
- **`invitePeerRelationship`**`(fromGroupId: ID, toGroupId: ID, description: String)` → `CreatedGroupRelationshipInvite` — Invite a group to form a peer-to-peer relationship. Only a group steward can call this.
- **`joinSpace`**`(spaceId: ID!, accessCode: String, invitationToken: String)` → `Membership` — Join a Space (creates a group membership + per-view unread rows). accessCode or invitationToken pre-approves Closed and Restricted spaces, but not role-gated ones; a member's invitation never does.
- **`messageGroupStewards`**`(groupId: ID)` → `ID` — Send a message to all the stewards of a Group
- **`rejectGroupRelationshipInvite`**`(groupRelationshipInviteId: ID)` → `GenericResult` — Reject a Group's invite or request to connect to one of your groups. Only a group steward can call this.
- **`removeSuggestedSkillFromGroup`**`(groupId: ID, id: ID, name: String)` → `GenericResult` — Remove a suggested skill from a Group by skill ID or name/text
- **`requestPublicListing`**`(groupId: ID!, message: String)` → `Group` — Ask the Hylo team to add a public group to the commons (allowInPublic). Group administrators only
- **`requestToAddGroupToParent`**`(childId: ID, questionAnswers: [QuestionAnswerInput], parentId: ID)` → `CreatedGroupRelationshipInvite` — Request to add one one of the groups you moderate to another group as a child group. Only a group steward can call this.
  - Args: `questionAnswers`: Answers to any required questions to connect to the group
- **`reviewPublicListingRequest`**`(groupId: ID!, approved: Boolean!, message: String)` → `Group` — Approve or deny a group's pending request to be added to the commons; the requester is emailed either way (admin only) _[Hylo admin only.]_
- **`updateGroup`**`(id: ID, changes: GroupInput, asUserId: ID)` → `Group` — Update a Group's settings. Only can be called via API key. _[**API client only**, `asUserId`.]_
  - Args: `asUserId`: Update group as a particular User (with permission)
- **`updateGroupSettings`**`(id: ID, changes: GroupInput)` → `Group` — Update a Group's settings. Only a group steward can call this.
- **`updatePeerRelationship`**`(relationshipId: ID, description: String)` → `GroupRelationship` — Update the description of a peer-to-peer relationship. Only a group steward can call this.
- **`updateSpace`**`(id: ID!, name: String, slug: String, acceptedPostTypes: [String], visibility: Int, accessibility: Int, icon: String, description: String, requiredRoles: [Int], location: String, locationId: ID, geoShape: String, purpose: String, bannerUrl: String, avatarUrl: String, paywall: Boolean, status: GroupStatus, autoAddMembers: Boolean)` → `Group` — Update a Space's settings
  - Args: `geoShape`: GeoJSON geometry (e.g. a Polygon) outlining the space's region. Null clears it.; `paywall`: When true, space is Paid access (forces protected + restricted); `status`: draft or published. Setting draft removes the space from the parent menu.; `autoAddMembers`: When turned on, adds parent-group members who have not previously left this space

#### Mutation — Membership, joining & invitations

- **`acceptJoinRequest`**`(joinRequestId: ID)` → `JoinRequest` — For a steward to accept a request from a Person to join a Group
- **`addMember`**`(groupId: ID, userId: ID, assignAdministrator: Boolean)` → `GenericResult` — Add a person to a group. Only a steward of the group can do this. _[**API client only** (super OIDC client).]_
- **`cancelJoinRequest`**`(joinRequestId: ID)` → `GenericResult` — For a Person who has requested to join another group to cancel that request.
- **`createGroupInviteLink`**`(groupId: ID!, data: GroupInviteLinkInput!)` → `GroupInviteLink` — Create an invite link. Only someone with the Administration responsibility can call this.
- **`createInvitation`**`(groupId: ID, data: InviteInput)` → `CreatedInvitations` — Invite email addresses and/or existing people to join a Group. With 'limited' invite access: email addresses only, up to 10 at a time and within the daily allowance (fails with 'invite-limit' otherwise)
- **`createJoinRequest`**`(groupId: ID, questionAnswers: [QuestionAnswerInput], invitationToken: String)` → `CreatedRequest` — Ask to join a Group. invitationToken: a member's invitation to this group, so stewards see who invited the person (otherwise a pending member invitation to the person's email address is used)
- **`declineJoinRequest`**`(joinRequestId: ID)` → `JoinRequest` — For group host to decline someone's request to join their Group
- **`deleteGroupInviteLink`**`(id: ID!)` → `GenericResult` — Soft-delete an invite link. Only someone with the Administration responsibility can call this.
- **`expireInvitation`**`(invitationId: ID)` → `GenericResult` — Set an invitation to join a group as expired. Allowed for the invitee, anyone who can add members, and the sender of an invitation sent with 'limited' access
- **`joinGroup`**`(groupId: ID, questionAnswers: [QuestionAnswerInput], accessCode: String, invitationToken: String, acceptAgreements: Boolean)` → `Membership` — Join a group. Will fail if the person does not have permission to join this group. For Restricted groups, provide accessCode or invitationToken for pre-approved join. A member's invitation only pre-approves joining an Open group. Set acceptAgreements to true if user has accepted agreements during join flow.
- **`leaveGroup`**`(id: ID)` → `ID` — Leave a group
- **`reinviteAll`**`(groupId: ID)` → `GenericResult` — Reinvite all pending invitations to the current group. Only a group Host can call this.
- **`rejoinGroup`**`(groupId: ID!)` → `Membership` — Reactivate a prior membership using still-valid purchased/granted access
- **`removeMember`**`(personId: ID, groupId: ID)` → `Group` — Remove a Person from a Group. Only a group Moderator can call this.
- **`resendInvitation`**`(invitationId: ID)` → `GenericResult` — Resend an invitation to the invited email address
- **`updateAllMemberships`**`(data: MembershipInput)` → `GenericResult` — Update settings for all your group memberships at once
- **`updateGroupInviteLink`**`(id: ID!, data: GroupInviteLinkUpdateInput!)` → `GroupInviteLink` — Change an invite link's name, access, and roles. Only someone with the Administration responsibility can call this.
- **`updateMembership`**`(groupId: ID, slug: String, data: MembershipInput)` → `Membership` — Update settings related to your relationship to a particular group by Group ID or slug
- **`useInvitation`**`(accessCode: String, invitationToken: String)` → `InvitationUseResult` — Accept an invitation to a Group
  - Args: `accessCode`: The invite code for the Group; `invitationToken`: Your unique invitation token

#### Mutation — Roles, responsibilities & moderation

- **`addGroupResponsibility`**`(description: String, title: String, groupId: ID)` → `Responsibility` — For a steward to add a group responsibility to a group
  - Args: `description`: The description of the responsibility; `title`: The name of the responsibility
- **`addGroupRole`**`(color: String, description: String, emoji: String, groupId: ID, name: String)` → `GroupRole` — For a steward to add a badge/role to a group
- **`addResponsibilityToRole`**`(responsibilityId: ID, roleId: ID, groupId: ID)` → `Responsibility` — Add responsibility to a role
- **`addRoleToMember`**`(roleId: ID, groupId: ID, personId: ID)` → `GroupRole` — For a steward to add a badge/role to a group to a member of a group
- **`clearModerationAction`**`(postId: ID, groupId: ID, moderationActionId: ID)` → `GenericResult` — Clear a moderation action; only a 'content manager' or initial reporter can do this.
- **`createModerationAction`**`(data: ModerationActionInput)` → `ModerationAction` — Create a new moderation action
- **`deleteGroupResponsibility`**`(responsibilityId: ID, groupId: ID, groupRoleId: ID)` → `GenericResult` — Delete a group responsibility from a group
- **`flagInappropriateContent`**`(data: InappropriateContentInput)` → `GenericResult` — Flag a post as innapropriate
- **`recordClickthrough`**`(postId: ID)` → `GenericResult` — Record a click through on a moderated post
- **`removeResponsibilityFromRole`**`(roleResponsibilityId: ID, groupId: ID)` → `GenericResult` — Remove a group responsibility from a group
- **`removeRoleFromMember`**`(roleId: ID, groupId: ID, personId: ID)` → `GenericResult` — Remove a badge/role from a member of a group, inititated by that member or by a group Steward
- **`updateGroupResponsibility`**`(responsibilityId: ID, description: String, title: String, groupId: ID)` → `Responsibility` — Update a group responsibility
  - Args: `description`: The description of the responsibility; `title`: The name of the responsibility; `groupId`: groupId
- **`updateGroupRole`**`(groupRoleId: ID, color: String, description: String, emoji: String, groupId: ID, name: String, active: Boolean)` → `GroupRole` — Update a badge/role from a group and all associated roles

#### Mutation — Views, menus & topics

- **`addPostToView`**`(viewId: ID!, postId: ID!, order: Int)` → `CollectionPost` — Add a Post to a 'collection' or 'track-actions' type View
- **`createGroupView`**`(groupId: ID!, type: String!, name: String, icon: String, settings: JSON, link: String, pageContent: String, topics: [String], orderInFrontOfViewId: ID, addToEnd: Boolean, linkedGroupId: ID, postId: ID, userId: ID, hidden: Boolean)` → `GroupView` — ---- Spaces & Views (see docs/spaces-and-views-engineering-spec.md section 4) ---- Create a new View in a Group's or Space's navigation menu
  - Args: `hidden`: When true, create off-menu (order = null). Only valid for type = space (More Spaces).
- **`createTopic`**`(topicName: String, groupId: ID, isDefault: Boolean, isSubscribing: Boolean)` → `Topic` — Create a new topic within a Group
- **`deleteGroupTopic`**`(id: ID)` → `GenericResult` — Hide a topic within a group (it will still appear on posts in the group)
- **`deleteGroupView`**`(id: ID!)` → `GenericResult` — Delete a View
- **`markGroupAsRead`**`(groupId: ID!)` → `Group` — Mark all views + the group membership badge as read
- **`markViewAsRead`**`(viewId: ID!)` → `GroupView` — Mark a View as read for the current logged in user
- **`pinPost`**`(postId: ID, viewId: ID)` → `GenericResult` — Pin a post to a View. Only a group moderator can call this. Toggles if already pinned. Max 3 per view. _[Toggle; max 3 per view; Manage Content required.]_
- **`removePostFromView`**`(viewId: ID!, postId: ID!)` → `GenericResult` — Remove a Post from a View
- **`reorderGroupView`**`(id: ID!, orderInFrontOfViewId: ID, addToEnd: Boolean)` → `GenericResult` — Reorder a View within its Group's or Space's menu
- **`reorderViewPost`**`(viewId: ID!, postId: ID!, order: Int!)` → `GenericResult` — Reorder a Post within a View
- **`setGroupViewHidden`**`(id: ID!, hidden: Boolean!)` → `GroupView` — Hide (order = null) or show a Space in the parent menu. Only valid for type = space.
- **`setHomeView`**`(viewId: ID!, groupId: ID!)` → `GenericResult` — Set a View as the home view for its Group or Space
- **`subscribe`**`(groupId: ID, topicId: ID, isSubscribing: Boolean)` → `GenericResult` — Subscribe or unsubscribe to a Topic in a Group
- **`updateGroupTopic`**`(id: ID, data: GroupTopicInput)` → `GenericResult` — Update settings related a Topic in a Group. Only a group steward can call this.
- **`updateGroupTopicFollow`**`(id: ID, data: TopicFollowInput)` → `GenericResult` — Update settings related to a Person following a Topic in a Group. DEPRECATED, use updateTopicFollow instead
- **`updateGroupView`**`(id: ID!, name: String, icon: String, settings: JSON, link: String, pageContent: String, topics: [String], orderInFrontOfViewId: ID, addToEnd: Boolean)` → `GroupView` — Update a View
- **`updateGroupViewUser`**`(viewId: ID!, lastReadPostId: ID)` → `GroupView` — Update the current logged in user's last-read position for a chat GroupView, recalculating newPostCount
- **`updateTopicFollow`**`(id: ID, data: TopicFollowInput)` → `TopicFollow` — Update settings related to a Person following a Topic in a Group
- **`updateViewSettings`**`(viewId: ID!, settings: JSON!)` → `GroupViewUser` — Update the current logged in user's settings for a View

#### Mutation — Posts, comments & reactions

- **`addPeopleToProjectRole`**`(peopleIds: [ID], projectRoleId: ID)` → `GenericResult` — NOT USED RIGHGT NOW. Add one or more people to a Project as a Project member.
- **`completePost`**`(postId: ID, completionResponse: JSON)` → `Post` — Mark a post as completed
- **`createComment`**`(data: CommentInput)` → `Comment` — Add a comment to a Post
- **`createPost`**`(data: PostInput)` → `Post` — Create a new Post
- **`createProject`**`(data: PostInput)` → `Post` — Create a new 'project' type Post NOT USED RIGHT NOW, use createPost instead
- **`createProjectRole`**`(projectId: ID, roleName: String)` → `GenericResult` — NOT USED RIGHT NOW
- **`deleteComment`**`(id: ID)` → `GenericResult` — Delete a comment
- **`deletePost`**`(id: ID)` → `GenericResult` — Delete a post you created
- **`deleteProjectRole`**`(id: ID)` → `GenericResult` — Remove a person as a member from a project Post
- **`deleteReaction`**`(entityId: ID, data: ReactionInput)` → `Post` — Delete a reaction you created
- **`findOrCreateLinkPreviewByUrl`**`(data: LinkPreviewInput)` → `LinkPreview` — Look for a link preview of a URL, or if not found create one
- **`findOrCreateLocation`**`(data: LocationInput)` → `Location` — Look for a geocoded location object or if not found create one from the location data
- **`fulfillPost`**`(postId: ID)` → `GenericResult` — Mark one of your posts as fulfilled or completed
- **`joinProject`**`(id: ID)` → `GenericResult` — Join a project Post as a member
- **`leaveProject`**`(id: ID)` → `GenericResult` — Remove yourself as a member of a project Post
- **`processStripeToken`**`(postId: ID, token: String, amount: Int)` → `GenericResult` — NOT USED RIGHT NOW
- **`reactOn`**`(entityId: ID, data: ReactionInput)` → `Post` — react to a post or comment
- **`removePost`**`(postId: ID, slug: String, groupId: ID)` → `GenericResult` — Remove a Post from a group, by groupId or group slug
- **`savePost`**`(postId: ID)` → `Post` — Save a post to your saved posts list
- **`unfulfillPost`**`(postId: ID)` → `GenericResult` — Mark a post as unfulfilled/uncompleted
- **`unsavePost`**`(postId: ID)` → `Post` — Remove a post from your saved posts list
- **`updateComment`**`(id: ID, data: CommentInput)` → `Comment` — Edit a comment
- **`updatePost`**`(id: ID, data: PostInput)` → `Post` — Update a post you created
- **`vote`**`(postId: ID, isUpvote: Boolean)` → `Post` — Upvote a post, or remove upvote. DEPRECATED, use reactOn instead _[**Declared but has no resolver** — calling it errors/returns null.]_

#### Mutation — Events & proposals

- **`addProposalVote`**`(postId: ID, optionId: ID)` → `GenericResult` — Add a rvote to a proposal
- **`invitePeopleToEvent`**`(eventId: ID, inviteeIds: [ID])` → `Post` — Invite one or more people to an event Post
- **`removeProposalVote`**`(postId: ID, optionId: ID)` → `GenericResult` — Remove a vote from a proposal
- **`respondToEvent`**`(id: ID, response: String)` → `GenericResult` — Change your response to an event Post
  - Args: `id`: The ID of the event Post; `response`: 'yes', 'maybe' or 'no'
- **`setProposalOptions`**`(postId: ID, options: [ProposalOptionInput])` → `[ProposalOption]` — set options for a proposal
- **`swapProposalVote`**`(postId: ID, addOptionId: ID, removeOptionId: ID)` → `GenericResult` — Swap votes on a proposal
- **`updateProposalOptions`**`(postId: ID, options: [ProposalOptionInput])` → `[ProposalOption]` — update options for a proposal
- **`updateProposalOutcome`**`(postId: ID, proposalOutcome: String)` → `GenericResult` — update the outcome of a proposal

#### Mutation — Messages, notifications & real-time

- **`addEmailEnabledTester`**`(userId: ID!)` → `EmailEnabledTester` — Add a user to the email-enabled testers list (admin only) _[Hylo admin only.]_
- **`createMessage`**`(data: MessageInput)` → `Message` — Send a direct message
- **`createSavedSearch`**`(data: SavedSearchInput)` → `SavedSearch` — Create a new Saved Search for the map
- **`createSiteBanner`**`(data: SiteBannerInput)` → `SiteBanner` — Create a new site banner (admin only) _[Hylo admin only.]_
- **`deleteSavedSearch`**`(id: ID)` → `ID` — Delete a SavedSearch you created
- **`deleteSiteBanner`**`(id: ID!)` → `Boolean` — Permanently delete a site banner (admin only) _[Hylo admin only.]_
- **`dismissSiteBanner`**`(id: ID!)` → `Boolean` — Dismiss a site banner for the current user
- **`findOrCreateThread`**`(data: MessageThreadInput)` → `MessageThread` — Look for an existing direct message thread between participants, or if not yet there, create it
- **`markActivityRead`**`(id: ID)` → `Activity` — Mark a notification as read
- **`markAllActivitiesRead`**`()` → `GenericResult` — Mark all notifications as read
- **`markThreadRead`**`(messageThreadId: ID)` → `MessageThread` — Marks a MessageThread as read
- **`markThreadUnread`**`(messageThreadId: ID)` → `MessageThread` — Marks a MessageThread as unread
- **`muteMessageThread`**`(messageThreadId: ID)` → `GenericResult` — Mute a direct message thread for the logged in user
- **`peopleTyping`**`(messageThreadId: ID, postId: ID, commentId: ID)` → `GenericResult` — Called when typing in front end, matches with peopleTyping subscription
- **`publishSiteBanner`**`(id: ID!)` → `SiteBanner` — Publish a site banner so eligible users see it (admin only) _[Hylo admin only.]_
- **`removeEmailEnabledTester`**`(userId: ID!)` → `Boolean` — Remove a user from the email-enabled testers list (admin only) _[Hylo admin only.]_
- **`unmuteMessageThread`**`(messageThreadId: ID)` → `GenericResult` — Unmute a direct message thread for the logged in user
- **`unpublishSiteBanner`**`(id: ID!)` → `SiteBanner` — Take down a published site banner (admin only) _[Hylo admin only.]_
- **`updateSiteBanner`**`(id: ID!, data: SiteBannerInput)` → `SiteBanner` — Update a site banner's text, type, or action button, at any point in its lifecycle (admin only) _[Hylo admin only.]_

#### Mutation — Tracks & funding rounds

- **`allocateTokensToSubmission`**`(postId: ID, tokens: Int)` → `Post` — Allocate tokens from the current user to a submission post
- **`createFundingRound`**`(data: FundingRoundInput)` → `FundingRound` — Create a new funding round
- **`createTrack`**`(data: TrackInput)` → `Track` — Create a new track
- **`deleteFundingRound`**`(id: ID)` → `GenericResult` — Delete a funding round
- **`doPhaseTransition`**`(id: ID)` → `FundingRound` — Perform a phase transition for a funding round
- **`duplicateTrack`**`(trackId: ID)` → `Track` — Duplicate a track
- **`enrollInTrack`**`(trackId: ID)` → `Track` — Enroll in a track
- **`joinFundingRound`**`(id: ID)` → `FundingRound` — Join a funding round
- **`leaveFundingRound`**`(id: ID)` → `FundingRound` — Leave a funding round
- **`leaveTrack`**`(trackId: ID)` → `Track` — Leave a track
- **`updateFundingRound`**`(id: ID, data: FundingRoundInput)` → `FundingRound` — Update a funding round
- **`updateTrack`**`(trackId: ID, data: TrackInput)` → `Track` — Update a track

#### Mutation — Paid content & Stripe

- **`checkStripeStatus`**`(groupId: ID!)` → `StripeStatusCheckResult` — Check Stripe account status and update database values
- **`createStripeAccountLink`**`(groupId: ID!, accountId: String!, returnUrl: String!, refreshUrl: String!)` → `StripeAccountLinkResult` — Create an Account Link for onboarding
- **`createStripeCheckoutSession`**`(groupId: ID!, offeringId: ID!, quantity: Int, adjustableQuantity: AdjustableQuantityInput, successUrl: String!, cancelUrl: String!, metadata: JSON)` → `StripeCheckoutSessionResult` — Create a checkout session for purchasing a product _[**Public** (guest checkout allowed).]_
- **`createStripeConnectedAccount`**`(groupId: ID!, email: String!, businessName: String!, country: String)` → `StripeConnectedAccountResult` — Stripe Connect mutations Create a Stripe Connected Account for a group _[Resolver also reads `existingAccountId`, which the schema does not declare (always undefined).]_
- **`createStripeOffering`**`(input: StripeOfferingInput!)` → `StripeOfferingResult` — Create an offering on the connected account
- **`fulfillStripeCheckoutSession`**`(sessionId: ID!, offeringId: ID)` → `StripeFulfillCheckoutResult` — Grant access from a completed Checkout session (success-page fallback)
- **`grantContentAccess`**`(userId: ID, grantedByGroupId: ID!, groupId: ID, productId: ID, groupRoleId: ID, expiresAt: Date, reason: String, grantToAllMembers: Boolean)` → `ContentAccessResult` — Grant content access to a user, or to all current members of the granting group (admin only) groupId may be the parent group or a child space (spaces are groups). No trackId — use groupId for spaces.
  - Args: `userId`: Target user. Required unless grantToAllMembers is true.; `grantToAllMembers`: When true, grant to every current member of grantedByGroupId (userId is ignored)
- **`membershipChangeCommit`**`(groupId: ID!, fromOfferingId: ID!, toOfferingId: ID!, newQuantity: Int)` → `MembershipChangeCommitResult` — Apply a membership subscription change (Stripe Connect). Call membershipChangePreview first; unsupported modes error until implemented.
  - Args: `newQuantity`: Sliding-scale quantity-only change: same offering, new unit count (next-cycle behavior in Stripe rules)
- **`recordStripePurchase`**`(userId: ID!, grantedByGroupId: ID!, groupId: ID, productId: ID, trackId: ID, groupRoleId: ID, sessionId: String!, stripeSubscriptionId: String, amountPaid: Int, currency: String, expiresAt: Date, metadata: JSON)` → `ContentAccessResult` — Record a Stripe purchase (internal use)
- **`refundContentAccess`**`(accessId: ID!, reason: String)` → `ContentAccess` — Refund content access (admin only) - revokes access and issues Stripe refund
- **`registerStripeAccount`**`(authorizationCode: String)` → `GenericResult` — NOT USED RIGHT NOW
- **`revokeContentAccess`**`(accessId: ID!, reason: String)` → `ContentAccess` — Revoke content access (admin only)
- **`updateStripeAccount`**`(accountId: String)` → `GenericResult` — NOT USED RIGHT NOW
- **`updateStripeOffering`**`(offeringId: ID!, name: String, description: String, priceInCents: Int, currency: String, accessGrants: JSON, renewalPolicy: String, duration: String, publishStatus: PublishStatus)` → `StripeOfferingUpdateResult` — Update an existing Stripe offering

#### Mutation — Integrations

- **`createZapierTrigger`**`(groupIds: [ID], targetUrl: String, type: String, params: JSON)` → `ZapierTrigger` — Add a new Zapier trigger (called by Zapier)
- **`deleteZapierTrigger`**`(id: ID)` → `Boolean` — Delete a Zapier trigger (called by Zapier)

---

## 5. Types reference

All object (`type`) and input (`input`) types, with field comments from the schema. Key domain types: `Group`, `Me`, `Person`, `Membership`, `Post`, `Comment`, `MessageThread`, `Message`, `GroupView`, `GroupRole`, `Responsibility`, `Topic`/`GroupTopic`/`TopicFollow`, `Notification`/`Activity`, `Track`, `FundingRound`, `StripeOffering`, `ContentAccess`. Enums: `LocationDisplayPrecision` (`precise`, `near`, `region`), `PublishStatus` (`unpublished`, `unlisted`, `published`, `archived`), `FundingRoundPhase` (`draft`, `published`, `submissions`, `discussion`, `voting`, `completed`), `GroupStatus` (FundingRoundPhase values + `archived`). Unions: `FeedItemContent = Post | Interstitial` (only Post implemented), `SearchResultContent = Person | Post | Comment | Group`, `Update`, `SubscriptionUpdate`.

#### type `GroupMembershipUpdate`

Group membership update payload for subscriptions

- `group`: `Group`
- `member`: `Person`
- `action`: `String` — Action type: 'joined', 'left'

#### type `GroupRelationshipUpdate`

Group relationship update payload for subscriptions

- `parentGroup`: `Group`
- `childGroup`: `Group`
- `action`: `String` — Action type: 'relationship_created', 'relationship_removed', 'invite_sent', 'invite_accepted', 'invite_rejected', 'invite_cancelled'
- `relationship`: `GroupRelationship`

#### type `ActivityMeta`

The meta data associated with an Activity

- `phase`: `String` — The phase of the funding round that this activity is related to
- `reasons`: `[String]` — The reasons for this activity, options are: 'mention' = // you are mentioned in a post or comment 'comment' = someone makes a comment on a post you follow 'contribution' = someone add you as a contributor to a #request 'followAdd' = you are added as a follower 'follow' = someone follows your post 'unfollow' = someone leaves your post 'announcement' = an announcement was posted 'approvedJoinRequest' = your request to join a group was approved 'joinRequest' = there is a reques to join one of your groups 'groupInvitation' = an existing Hylo user was invited to join a group or space 'groupChildGroupInvite' = someone invited a group to join one of your groups 'groupChildGroupInviteAccepted' = a child group accepted the invite to join one of your groups 'groupParentGroupJoinRequest' = someone requested to join one of your groups to a new parent group 'groupParentGroupJoinRequestAccepted' = a parent group accepted one of your groups into it 'groupPeerGroupInvite' = a peer group requested to connect to your group 'groupPeerGroupInviteAccepted' = a peer group accepted an invite to connect to one of your groups 'memberJoinedGroup' = someone joined a group 'trackCompleted' = someone completed a track 'trackEnrollment' = someone enrolled in a track 'fundingRoundNewSubmission' = someone submitted a new submission to a funding round 'fundingRoundPhaseTransition' = a phase transition in a funding round 'fundingRoundReminder' = a reminder of a funding round deadline
- `reminderType`: `String` — The type of reminder for this activity if it is a reminder (for funding rounds)

#### type `Activity`

An activity that someone may want to be notified about

- `id`: `ID`
- `action`: `String` — The primary reason this activity occurred: 'mention' = // you are mentioned in a post or comment 'comment' = someone makes a comment on a post you follow 'contribution' = someone add you as a contributor to a #request 'followAdd' = you are added as a follower 'follow' = someone follows your post 'unfollow' = someone leaves your post 'announcement' = an announcement was posted 'approvedJoinRequest' = your request to join a group was approved 'joinRequest' = there is a reques to join one of your groups 'groupInvitation' = an existing Hylo user was invited to join a group or space 'groupChildGroupInvite' = someone invited a group to join one of your groups 'groupChildGroupInviteAccepted' = a child group accepted the invite to join one of your groups 'groupParentGroupJoinRequest' = someone requested to join one of your groups to a new parent group 'groupParentGroupJoinRequestAccepted' = a parent group accepted one of your groups into it 'groupPeerGroupInvite' = a peer group requested to connect to your group 'groupPeerGroupInviteAccepted' = a peer group accepted an invite to connect to one of your groups 'memberJoinedGroup' = someone joined a group 'trackCompleted' = someone completed a track 'trackEnrollment' = someone enrolled in a track
- `actor`: `Person` — The Person who carried out this Activity
- `comment`: `Comment` — If this activity is related to a comment then this is the Comment
- `contributionAmount`: `Int` — NOT USED RIGHT NOW
- `meta`: `ActivityMeta` — Additional metadata about the Activity
- `fundingRound`: `FundingRound` — If this activity involved a funding round then this is the FundingRound
- `group`: `Group` — The Group related to the activity
- `otherGroup`: `Group` — The other Group related to this activity for ones involving multiple groups
- `post`: `Post` — If this activity involved a post then this is the Post
- `track`: `Track` — If this activity involved a track then this is the Track
- `unread`: `Boolean` — Whether the Notification associated with this Activity has been read by the "reader" of this activity

#### type `Affiliation`

An Affiliation with an organization that someone has added to their profile

- `id`: `ID`
- `createdAt`: `Date`
- `isActive`: `Boolean`
- `orgName`: `String` — The name of the organization the person is affiliated with
- `preposition`: `String` — Connector word between role and org. e.g. Steward 'of' Terran Collective, or Laywer 'for' Hylo
- `role`: `String` — The role this person has in the organization
- `updatedAt`: `Date`
- `user`: `Person`
- `url`: `String` — URL of the affiliated organization

#### type `Agreement`

An agreement used by a Group

- `id`: `Int`
- `createdAt`: `Date`
- `description`: `String` — The content of the agreement
- `order`: `Int` — The order of the agreement within a group
- `title`: `String` — The title/header of the agreement
- `updatedAt`: `Date`

#### type `Attachment`

A post attachment, either an image, video or file

- `id`: `ID`
- `createdAt`: `Date`
- `position`: `Int` — To order how attachments appear in the post
- `thumbnailUrl`: `String` — URL to the thumbnail image
- `type`: `String` — 'image', 'file' or 'video'
- `url`: `String` — URL of the attachment file

#### type `CheckInvitationResult`

Return type for the checkInvitation query

- `valid`: `Boolean` — Whether the invitation is still valid or not
- `groupId`: `ID` — The invited group or space id (used to auto-join a space)
- `groupSlug`: `String` — The slug of the group for redirect purposes
- `groupName`: `String` — The name of the invited group or space
- `isSpace`: `Boolean` — True when the invitation is for a space rather than a top-level group
- `parentGroupSlug`: `String` — Parent group slug when the invitation is for a space
- `parentGroupName`: `String` — Parent group name when the invitation is for a space
- `email`: `String` — The email address from the invitation (for token-based invites)
- `groupRole`: `GroupRole` — The group role that will be assigned when this invitation is used
- `grantAccess`: `Boolean` — True when an invite link lets the person join regardless of accessibility
- `groupRoles`: `[GroupRole]` — Roles an invite link assigns when someone joins through it

#### type `Comment`

A comment on a post

- `id`: `ID`
- `attachments(type: String)`: `[Attachment]` — Any Attachments on the comment
- `attachmentsTotal`: `Int` — Number of attachments
- `childComments(cursor: ID, first: Int, order: String)`: `CommentQuerySet` — Child comments
- `createdAt`: `Date`
- `createdFrom`: `String` — 'email' if this comment was created via an email, otherwise null
- `creator`: `Person` — The Person who wrote the comment
- `editedAt`: `Date` — When the text was last edited
- `parentComment`: `Comment` — For threaded comments what's the parent of this one
- `post`: `Post` — The Post this comment is on
- `text`: `String` — The content of the comment
- `commentReactionsTotal`: `Int` — Not used
- `commentReactions`: `[Reaction]` — All reactions on a comment
- `myReactions`: `[Reaction]` — The reactions of the logged-in user to this

#### type `CookieConsent`

Cookie consent preferences for a user

- `id`: `ID`
- `consentId`: `ID` — The unique consent identifier
- `userId`: `ID` — The user this consent belongs to (null for anonymous users)
- `settings`: `JSON` — The consent settings
- `version`: `String` — Version of the consent structure
- `updatedAt`: `Date` — When this consent was last updated
- `user`: `Person` — The user this consent belongs to

#### type `EventInvitation`

An invitation to an Event

- `id`: `ID`
- `person`: `Person` — Who was invited
- `response`: `String` — 'yes', 'no' or 'interested'

#### type `Extension`

A type of data extension that can be added to a group for special group types like farms

- `id`: `ID`
- `type`: `String` — Only option right now is 'farm-onboarding' for Groups of type 'farm'

#### type `FeedItem`

NOT USED RIGHT NOW

- `type`: `String`
- `content`: `FeedItemContent`

#### type `Group`

A Hylo Group

- `id`: `ID`
- `canAccess`: `Boolean` — Whether the current user has access to this group (via scope system or free access)
- `hasValidScope`: `Boolean` — Whether the current user has a currently valid user scope for this group or space
- `currentUserMembershipActive`: `Boolean` — Current user's membership state; null when the user has never joined
- `aboutVideoUri`: `String` — URL for a video to display at the top of the about text
- `accessibility`: `Int` — Either 0 = Closed (invite only), 1 = Restricted (Anyone can request to join), 2 = Open (anyone can join if they can find/see the group)
- `acceptedPostTypes`: `[String]` — Spaces & Views: post types that can be posted into this Group/Space, e.g. ['discussion', 'event']. Null = all types accepted
- `active`: `Boolean` — Whether this group/space is active. False means deleted (hidden from menus and More Spaces)
- `status`: `GroupStatus` — Space lifecycle: draft, published, archived; funding-round spaces also use submissions, discussion, voting, completed
- `allowInPublic`: `Boolean` — Whether this group's posts can be shown in public feeds
- `publicListingRequest`: `PublicListingRequest` — The group's latest request to be added to the commons (allowInPublic). Only visible to group administrators and Hylo admins
- `avatarUrl`: `String` — URL to the image of the avatar of the group
- `icon`: `String` — Lucide or Hylo icon name for groups/spaces without a custom avatar
- `bannerUrl`: `String` — URL to the image of the banner for the group
- `createdAt`: `Date` — When the group was created
- `description`: `String` — Group description text
- `eventCalendarUrl`: `String` — gets the event calendar subscription URL
- `geoShape`: `JSON` — A geoJSON object outlining a geographic shape describing the border/boundaries of the group in the world
- `homeRoute`: `String` — Cached path for group home redirect (e.g. /stream, /map, /chat/general). Used so we can redirect without loading context widgets.
- `menuViewCount`: `Int` — Cached count of on-menu views (order is not null). Stored on groups.menu_view_count so a parent menu can tell single-view vs multi-view spaces without a nested query.
- `moreSpacesCount`: `Int` — Cached count of child spaces not on the group menu. Stored on groups.more_spaces_count so the menu can show More Spaces and its badge without loading the spaces list.
- `invitePath`: `String` — DEPRECATED: sThe default invite link for this group, for anyone who can add members
- `inviteLinks`: `[GroupInviteLink]` — Active invite links, for anyone who can add members
- `invitePolicy`: `String` — Who can invite new people: 'everyone' or 'stewards'. Null for spaces, and for anyone without the Administration responsibility
- `location`: `String` — A string describing the physical location of this group in the world
- `locationObject`: `Location` — The fully geocoded location object
- `memberCount`: `Int` — Number of members in this group
- `myInviteAllowance`: `Int` — How many more people the current user can invite to this group today. Null when they cannot invite, or when their limit is lifted
- `openJoinRequestCount`: `Int` — Cached count of pending join requests. Visible only to members who can add members; 0 otherwise
- `openModerationActionCount`: `Int` — Count of active (unresolved) moderation actions in this group
- `moderatorDescriptor`: `String` — Word used to describe an admin/moderator of this group. Defaults to "Moderator". TODO: remove once mobile app switches to stewardDescriptor
- `moderatorDescriptorPlural`: `String` — Plural word used to describe admins/moderators of this group. Defaults to "Moderators". TODO: remove once mobile app switches to stewardDescriptor
- `name`: `String` — Group name
- `numPrerequisitesLeft`: `Int` — For the current logged in user how many prerequisite groups must they join before they can join this one
- `parentId`: `ID` — Spaces & Views: parent Group id when this Group is a Space; null for top-level groups
- `chatConverted`: `Boolean` — True when this chat space was converted into a discussion post
- `chatSpacesBlockingConversion`: `[BlockingSpace]` — Chat rooms that must be converted before this group can become a space. Empty unless the viewer administers the group.
- `paywall`: `Boolean` — Whether this group requires purchased membership (paywall enabled)
- `postCount`: `Int` — Total number of posts in this group
- `purpose`: `String` — The purpose statement for the group
- `requiredRoles`: `[Int]` — Spaces & Views: group role ids required to view/post in this Space. Null/empty = no role restriction
- `settings`: `GroupSettings` — Group settings
- `slug`: `String` — Unique URL slug
- `stewardDescriptor`: `String` — Word used to describe any steward of this group. Defaults to "Steward"
- `stewardDescriptorPlural`: `String` — Plural word used to describe stewards of this group. Defaults to "Stewards"
- `stripeAccountId`: `String` — Stripe Connected Account ID for accepting payments
- `stripeDashboardUrl`: `String` — Direct link to the Stripe Dashboard for this group's connected account
- `stripeChargesEnabled`: `Boolean` — Whether the Stripe account can accept charges
- `stripePayoutsEnabled`: `Boolean` — Whether the Stripe account can receive payouts
- `stripeDetailsSubmitted`: `Boolean` — Whether all required Stripe details have been submitted
- `type`: `String` — Either 'farm', 'space' (a child Group belonging to another Group via parentGroup), or null
- `typeDescriptor`: `String` — Word used to describe this type of group. Defaults to Group, or if type is set then defaults to the type (e.g. Farm)
- `typeDescriptorPlural`: `String` — Word used to describe this type of groups. Defaults to Groups, or if type is set then defaults to the type (e.g. Farms)
- `websiteUrl`: `String` — The primary website for the group
- `visibility`: `Int` — Either 0 = Hidden (only visible to members), 1 = Protected (visible to members of related groups), 2 = Public (anyone can find/see this group)
- `activeMembers(autocomplete: String, boundingBox: [PointInput], first: Int, offset: Int, order: String, search: String, sortBy: String)`: `PersonQuerySet` — NOT USED RIGHT NOW. Use `members` query instead
- `agreements`: `AgreementQuerySet` — The agreements required to participate in this Group
- `childGroups(autocomplete: String, boundingBox: [PointInput], first: Int, offset: Int, order: String, sortBy: String, search: String)`: `GroupQuerySet` — Child groups of this group
- `groupViews(id: ID, menuOnly: Boolean)`: `GroupViewQuerySet` — Spaces & Views: this Group's/Space's own views. `menuOnly` omits off-menu (`order` is null) space entries; `type = 'space'` items include `linkedGroup`.
- `spaces`: `GroupQuerySet` — Spaces & Views: all child Spaces of this Group (including archived ones)
- `parentGroup`: `Group` — Spaces & Views: the parent Group this Space belongs to, if this Group is a Space
- `track`: `Track` — Spaces & Views: the Track this Space represents, if any
- `fundingRound`: `FundingRound` — Spaces & Views: the FundingRound this Space represents, if any
- `groupExtensions`: `GroupExtensionQuerySet` — The GroupExtension data for this group if it is a special group type like 'farm'
- `groupRelationshipInvitesFrom`: `GroupRelationshipInviteQuerySet` — Requests to join another group from this group
- `groupRelationshipInvitesTo`: `GroupRelationshipInviteQuerySet` — Invitations to join another group sent to this group
- `groupToGroupJoinQuestions`: `GroupToGroupJoinQuestionQuerySet` — Questions that a group requesting to join this group must answer
- `groupRoles(first: Int, offset: Int, order: String, sortBy: String)`: `GroupRoleQuerySet` — Special roles or badges attached to this group (never the implicit Member role)
- `groupTopics(autocomplete: String, first: Int, isDefault: Boolean, offset: Int, order: String, sortBy: String, subscribed: Boolean, visibility: [Int])`: `GroupTopicQuerySet` — Topics that have been used in this group
- `joinQuestions`: `GroupJoinQuestionQuerySet` — Questions that must be answered when someone requests to join this group
- `members(autocomplete: String, boundingBox: [PointInput], excludeGroupId: ID, groupRoleId: ID, groupRoleIds: [ID], trackCompleted: Boolean, fundingRoundCapability: String, first: Int, offset: Int, order: String, search: String, sortBy: String)`: `PersonQuerySet` — Group members
- `memberships(userId: ID)`: `MembershipQuerySet` — Group memberships (returns the membership objects instead of the Person objects of the members)
- `moderators(cursor: ID, first: Int, order: String)`: `PersonQuerySet` — This returns any member that has the manage_content responsibility
- `stewards(cursor: ID, first: Int, order: String)`: `PersonQuerySet` — The group stewards - members who have common roles
- `parentGroups(autocomplete: String, boundingBox: [PointInput], first: Int, offset: Int, order: String, sortBy: String, search: String)`: `GroupQuerySet` — Parent Groups of this Group
- `peerGroups(autocomplete: String, boundingBox: [PointInput], first: Int, offset: Int, order: String, sortBy: String, search: String)`: `GroupQuerySet` — Peer Groups of this Group (peer-to-peer relationships)
- `peerGroupRelationships(first: Int, offset: Int, order: String, description: String)`: `GroupRelationshipQuerySet` — Peer Group Relationships with descriptions for this Group
- `pendingInvitations(first: Int, offset: Int, onlyMine: Boolean)`: `InvitationQuerySet` — Pending invitations to people to join this group. onlyMine limits them to the ones the current user sent
- `prerequisiteGroups(onlyNotMember: Boolean)`: `GroupQuerySet` — Groups that must be joined before someone can join this group
- `posts(activePostsOnly: Boolean, afterTime: Date, beforeTime: Date, boundingBox: [PointInput], collectionToFilterOut: ID, cursor: ID, filter: String, first: Int, forCollection: ID, groupSlugs: [String], isAnnouncement: Boolean, isFulfilled: Boolean, offset: Int, order: String, savedBy: [ID], search: String, sortBy: String, topic: ID, topics: [ID], types: [String], rsvpResponse: String)`: `PostQuerySet`
- `responsibilities`: `[Responsibility]` — All responsibilities available to the group
- `skills(autocomplete: String, first: Int, offset: Int)`: `SkillQuerySet` — All skills of members in this group
- `suggestedSkills`: `SkillQuerySet` — Skills suggested to new users joining this group to see if they want to add to their profile
- `tracks(autocomplete: String, enrolled: Boolean, first: Int, offset: Int, order: String, published: Boolean, sortBy: String)`: `TrackQuerySet`
- `fundingRounds(first: Int, published: Boolean, offset: Int, order: String, search: String, sortBy: String)`: `FundingRoundQuerySet` — Funding rounds in this group
- `viewPosts(activePostsOnly: Boolean, afterTime: Date, beforeTime: Date, boundingBox: [PointInput], collectionToFilterOut: ID, cursor: ID, filter: String, first: Int, forCollection: ID, groupSlugs: [String], isFulfilled: Boolean, offset: Int, order: String, savedBy: [ID], search: String, sortBy: String, topic: ID, topics: [ID], types: [String], rsvpResponse: String)`: `PostQuerySet` — Posts to display in this group's stream. Includes posts from child groups and child spaces that the logged in user is a member of
- `contentAccess(search: String, accessType: String, status: String, offeringId: ID, trackId: ID, groupId: ID, groupRoleId: ID, first: Int, offset: Int, order: String, sortBy: String)`: `ContentAccessQuerySet` — Content access records for this group (purchased or granted)

#### type `GroupView`

A View within a Group's or Space's navigation menu (see docs/spaces-and-views-engineering-spec.md section 2.5)

- `id`: `ID`
- `group`: `Group` — The Group or Space this view belongs to
- `name`: `String` — Display name override (used by 'custom', 'page', 'space' and 'group' type views)
- `type`: `String` — The type of view, e.g. 'chat', 'welcome', 'custom', 'space', 'collection', 'link', etc.
- `order`: `Int` — Position in the group's single ordered menu list. 0 = home view
- `icon`: `String` — Icon override for this view
- `pageContent`: `String` — HTML content, used by 'page', 'welcome', 'text' and 'link' type views
- `link`: `String` — URL, used by 'link' type views
- `topics`: `[String]` — Topic names used to filter posts, for 'custom' type views
- `settings`: `JSON` — Type-specific settings, e.g. {postTypes, activePostsOnly, defaultSort, defaultViewMode, searchText} for 'custom' views
- `collectionPosts`: `[Post]` — Posts in this view, for 'collection' and 'track-actions' type views
- `pinnedPostIds`: `[ID]` — Post ids pinned to this view (max 3). Cheap to load with the menu.
- `pinnedPosts`: `[Post]` — Posts pinned to this view, newest pin first. Separate from the stream query.
- `linkedGroup`: `Group` — The Space (or Group) this view links to, for 'space' and 'group' type views
- `viewPost`: `Post` — The Post this view points at, for 'post' type views
- `viewUser`: `Person` — The Person this view points at, for 'member' type views
- `newPostCount`: `Int` — Number of new/unread posts in this view for the current logged in user
- `lastReadPostId`: `ID` — The last post id the current logged in user has read in this view

#### type `GroupViewUser`

Per-user unread state / settings for a GroupView (see docs/spaces-and-views-engineering-spec.md section 2.6)

- `id`: `ID`
- `view`: `GroupView` — The View this pertains to
- `user`: `Person` — The Person this pertains to
- `newPostCount`: `Int` — Number of new/unread posts in this view for this user
- `lastReadPostId`: `ID` — The last post id this user has read in this view
- `settings`: `JSON` — Per-user, per-view settings. Null = inherit from the user's space membership settings

#### type `CollectionPost`

A Post within a 'collection' or 'track-actions' type GroupView (see docs/spaces-and-views-engineering-spec.md section 2.7)

- `id`: `ID`
- `view`: `GroupView` — The View this post belongs to
- `post`: `Post` — The Post
- `order`: `Int` — The order of the post within the view when manually sorted
- `createdAt`: `Date` — When this was created

#### type `GroupExistsOutput`

Results of groupExists query

- `exists`: `Boolean`

#### type `GroupExtension`

Extension data for a special group type e.g. farm

- `id`: `ID`
- `active`: `Boolean`
- `data`: `JSON` — The extension data
- `type`: `String` — The group type of this data

#### type `GroupJoinQuestion`

A question that must be answered when requesting to join a group

- `id`: `Int`
- `questionId`: `Int`
- `text`: `String` — Content of the question

#### type `GroupJoinQuestionAnswer`

An answer to a required question when joining a group

- `id`: `Int`
- `answer`: `String` — The answer text
- `group`: `Group` — The group
- `question`: `Question` — The question's id questionId: ID The question
- `user`: `Person` — The person answering

#### type `GroupSettings`

Group settings

- `agreementsLastUpdatedAt`: `Date` — The last date/time that the group agreements were updated
- `allowGroupInvites`: `Boolean` — Whether this group allows any member to invite people (not currently used)
- `askGroupToGroupJoinQuestions`: `Boolean` — Whether to require questions being answered when a group requests to join this group
- `askJoinQuestions`: `Boolean` — Whether to require questions being answered when a person requests to join this group
- `defaultDigestFrequency`: `String` — Default digest frequency for new members (daily or weekly). Used to set group_membership.settings.digestFrequency when a user joins.
- `hideExtensionData`: `Boolean` — Whether to display group extension data on the profile for special group types like farms
- `layout`: `String` — Layout mode for the group: 'two-column' (sidebar + content) or 'one-column' (dashboard cards)
- `locationDisplayPrecision`: `LocationDisplayPrecision` — How precisely to display group locations on the map and the group profile, to enable obfuscating the location
- `publicMemberDirectory`: `Boolean` — Whether to display the members of the group to non-members
- `publishMurmurationsProfile`: `Boolean` — Whether to publish this group to the Murmurations Directory via API
- `showSuggestedSkills`: `Boolean` — Whether to display suggested skills to new members when they join this group
- `showWelcomePage`: `Boolean` — Whether to display the custom Welcome Page when a member joins the group
- `showPostNoticesInChat`: `Boolean` — Whether the chat view shows inline notices when other post types are created
- `autoAddMembers`: `Boolean` — Space-only: add current parent-group members (except people who previously left) and anyone who joins the group later

#### type `GroupRelationship`

A relationship between two Groups

- `id`: `ID`
- `childGroup`: `Group`
- `createdAt`: `Date`
- `description`: `String` — Description of what this relationship represents (e.g., "Alliance", "Partnership", etc.)
- `parentGroup`: `Group`
- `relationshipType`: `Int` — 0 = parent-child relationship, 1 = peer-to-peer relationship
- `role`: `Int` — NOT CURRENTLY USED
- `settings`: `GroupRelationshipSettings`
- `updatedAt`: `Date`

#### type `GroupRelationshipSettings`

- `isPrerequisite`: `Boolean` — Whether the parent group in this relationship must be joined before someone can join the child group

#### type `GroupRelationshipInvite`

An invitation or request from a group to connect to another group, either as a parent or a child

- `id`: `ID`
- `createdAt`: `Date`
- `createdBy`: `Person` — The Person that initiated the invite or request
- `fromGroup`: `Group` — The group doing the inviting or requesting to join
- `questionAnswers`: `[GroupJoinQuestionAnswer]` — When a group is trying to join one that has questions, here are the answers to those questions
- `status`: `Int` — 0 = Pending, 1 = Accepted, 2 = Rejected, 3 = Canceled
- `toGroup`: `Group` — The group being invited or asked to join
- `type`: `Int` — 0 = ParentToChild, 1 = ChildToParent
- `updatedAt`: `Date`

#### type `GroupRole`

Group role

- `active`: `Boolean` — Whether this role is active
- `canAccess`: `Boolean` — Whether the current user has access to this role (via scope system)
- `createdAt`: `Date` — When this role was created
- `description`: `String` — The description of the role
- `emoji`: `String` — The emoji of the role
- `id`: `ID` — The id of the role
- `group`: `Group` — The group that this role belongs to
- `groupId`: `ID` — The id of the group that this role belongs to
- `membersTotal`: `Int` — The number of active group members holding this role
- `name`: `String` — The name of the role
- `type`: `String` — system, custom or member (the implicit role every member of a group holds)
- `updatedAt`: `Date` — When this role was last updated
- `responsibilities`: `ResponsibilityQuerySet` — The responsibilities that are part of this role
- `responsibilitiesTotal`: `Int` — The total number of responsibilities that are part of this role

#### type `GroupToGroupJoinQuestion`

A question required to be answered when a group requests to join this group

- `id`: `Int`
- `questionId`: `Int`
- `text`: `String` — The content of the question

#### type `GroupTopic`

Data related to a Topic within a specific Group

- `id`: `ID`
- `createdAt`: `Date`
- `followersTotal(groupSlug: String)`: `Int` — Total number of people following this topic in this group
- `group`: `Group`
- `isDefault`: `Boolean` — Is this a 'default' topic in this group, meaning all new members are auto subscribed to it and it appears
- `isSubscribed`: `Boolean` — Whether the current logged in user is subscribed to this topic in this group
- `lastReadPostId`: `ID` — Obsolete — unread is on GroupViewUser. Always null.
- `newPostCount`: `Int` — Obsolete — unread is on GroupViewUser. Always 0.
- `postsTotal(groupSlug: String)`: `Int` — Total number of posts using this topic in this group
- `topic`: `Topic`
- `updatedAt`: `Date`
- `visibility`: `Int` — 0: This topic has been hidden by an admin in this group, 1: Visible in this group, 2: this topic has been pinned by an admin of this group. (pinned topics appear at the top of every member's subscribed topics list if they are subscribed to this topic)

#### type `Interstitial`

NOT USED RIGHT NOW

- `text`: `String`

#### type `Invitation`

An invitation to join a group

- `id`: `Int`
- `createdAt`: `Date`
- `creator`: `Person` — Who created this invitation
- `email`: `String` — The email address being invited
- `name`: `String` — Name of the Hylo user this invitation was sent to, if they have an account
- `userId`: `ID` — Hylo user id for this invitation, if the email matches an existing account
- `error`: `String` — Why an invitation could not be created for this address
- `group`: `Group` — Which group they are being invited to
- `lastSentAt`: `Date` — When this invitation was last sent out via email
- `token`: `String` — The login token for the person receiving the invitation to accept it even if they are not logged into Hylo

#### type `GroupInviteLink`

A reusable link that lets someone see a group, and join it when grantAccess is true

- `accessCode`: `String`
- `createdAt`: `Date`
- `creator`: `Person`
- `grantAccess`: `Boolean` — Whether joining through this link skips the group's accessibility rules
- `grantedRoles`: `[GroupRole]` — Roles assigned when someone joins through this link
- `id`: `ID`
- `name`: `String` — Optional label shown next to the link
- `numJoinedUsers`: `Int` — How many people have joined through this link
- `url`: `String` — Path of the link, such as /invite/abc or /view/abc when it does not grant access

#### type `JoinRequest`

A request from a person to join a group

- `id`: `Int`
- `createdAt`: `Date`
- `group`: `Group` — Which group is being requested to join
- `questionAnswers`: `[GroupJoinQuestionAnswer]` — Answers to questions required by Restricted groups
- `status`: `Int` — 0 = Pending, 1 = Accepted, 2 = Rejected, 3 = Canceled
- `updatedAt`: `Date`
- `user`: `Person` — The person who is requesting to join

#### type `LinkPreview`

A generated preview of a link in a Post

- `id`: `ID`
- `description`: `String` — The page description pulled from the URL
- `imageHeight`: `String` — Height of the preview image pulled from the URL
- `imageWidth`: `String` — Width of the preview image pulled from the URL
- `imageUrl`: `String` — Height of the preview image pulled from the URL
- `status`: `String` — NOT USED?
- `title`: `String` — The page title pulled from the URL
- `url`: `String` — The link URL

#### type `Location`

A Geocoded location by Mapbox

- `id`: `ID`
- `accuracy`: `String` — Not used right now. Can be 'rooftop', 'parcel', 'point', 'interpolated', 'intersection', or 'street'
- `addressNumber`: `String` — Street number like 123
- `addressStreet`: `String` — Street name e.g. Baker Rd
- `bbox`: `[Point]` — Geographic bounding box
- `center`: `Point` — Geographic center point
- `city`: `String` — City name
- `countryCode`: `String` — Short country code e.g. us
- `country`: `String` — Full country name (not used right now)
- `createdAt`: `Date`
- `fullText`: `String` — String describing the full address
- `geometry`: `[Point]` — A set of points describing the spatial geometry of the returned feature
- `locality`: `String` — Sub-city features in countries where this additional admin layer is used in addressing, or where such features are commonly referred to in local parlance. e.g. city districts in Brazil and Chile and arrondissements in France.
- `neighborhood`: `String` — Colloquial neighborhood name
- `region`: `String` — Top-level sub-national administrative features, such as states in the United States or provinces in Canada or China.
- `postcode`: `String` — Postal codes used in country-specific national addressing systems.
- `updatedAt`: `Date`
- `wikidata`: `String` — Optional. The Wikidata identifier for the returned feature.

#### type `Me`

The currently logged-in person.

- `id`: `ID`
- `active`: `Boolean` — Is logged in user active
- `avatarUrl`: `String` — The URL of logged in user's avatar image
- `bannerUrl`: `String` — The URL of logged in user's banner image on their profile
- `bio`: `String` — Personal bio of the logged in user
- `blockedUsersTotal`: `Int` — Number of Users the logged in user has blocked
- `contactEmail`: `String` — Email address made visible on the logged in user's profile to people who can see them
- `contactPhone`: `String` — Phone number made visible on the logged in user's profile to people who can see them
- `createdAt`: `Date` — When the logged in user was created
- `groupsTotal`: `Int` — The number of Groups the logged in user is a member of
- `email`: `String` — The email used to log in (not publicly shared in the app)
- `emailValidated`: `Boolean` — Whether the logged in user has validated their email address or not
- `facebookUrl`: `String` — The URL to the logged in user Facebook profile
- `hasDevice`: `Boolean` — DEPRECATED: Whether the logged in user is using the Hylo app on any mobile devices
- `hasRegistered`: `Boolean`
- `hasStripeAccount`: `Boolean` — NOT CURRENTLY USED
- `intercomHash`: `String` — IGNORE
- `isAdmin`: `Boolean` — IGNORE
- `isProfilePublic`: `Boolean` — Whether this user's profile is publicly viewable without logging in
- `linkedinUrl`: `String` — URL of the logged in user's LinkedIn Profile
- `location`: `String` — String representing the logged in user's physical location
- `locationObject`: `Location` — Object with the geocoded details of the logged in user's physical location
- `membershipsTotal`: `Int` — Number of total group memberships
- `messageThreadsTotal`: `Int` — The number of MessageThreads the logged in user is a part of
- `name`: `String` — The logged in user's full name
- `newNotificationCount`: `Int` — The number of unread notifications the logged in user has
- `pendingEmail`: `String` — A new login email the user has asked for but not yet verified. Until it is verified, email is still the one in use
- `postsTotal`: `Int` — The number of Posts the logged in user has created
- `rsvpCalendarUrl`: `String` — RSVP calendar URL for subscriptions
- `settings`: `UserSettings` — The logged in user's settings
- `tagline`: `String` — Short tagline
- `twitterName`: `String` — Twitter handle
- `unseenThreadCount`: `Int` — The number of message threads with unread content
- `updatedAt`: `Date` — When this record was last updated
- `url`: `String` — A website URL the logged in user has added to their profile
- `affiliations`: `AffiliationQuerySet` — Organizational affiliations that are not Hylo Groups
- `blockedUsers`: `[Person]` — Set of Users the logged in user has blocked
- `groups(cursor: ID, first: Int, offset: Int, order: String, sortBy: String)`: `[Group]` — Groups I am a member of
- `groupRoles(groupId: ID, slug: String)`: `GroupRoleQuerySet`
- `membershipCommonRoles(groupId: ID)`: `MembershipCommonRoleQuerySet` — Deprecated: removed with common roles consolidation; kept for older mobile clients
- `groupInvitesPending`: `InvitationQuerySet` — Set of pending invites to Groups
- `joinRequests(status: Int)`: `JoinRequestQuerySet` — The set of pending requests to join groups
- `memberships(cursor: ID, first: Int, order: String)`: `[Membership]` — Group memberships
- `messageThreads(first: Int, offset: Int, order: String, sortBy: String, search: String, muted: Boolean)`: `MessageThreadQuerySet` — The set of MessageThreads
- `posts(cursor: ID, first: Int, order: String)`: `[Post]` — The set of Posts the logged in user has created
- `skills(cursor: ID, first: Int)`: `SkillQuerySet` — The set of Skills the logged in user has added to their profile
- `skillsToLearn(cursor: ID, first: Int)`: `SkillQuerySet` — The set of Skills the logged in user want to learn
- `topicFollows(cursor: ID, first: Int)`: `TopicFollowQuerySet` — The topics/chat rooms I subscribe to
- `tracksEnrolledIn(autocomplete: String, first: Int, offset: Int, order: String, sortBy: String)`: `TrackQuerySet` — The tracks I am enrolled in
- `cookieConsentPreferences`: `CookieConsent` — Cookie consent preferences for the current user

#### type `Membership`

A user's group membership

- `id`: `ID`
- `agreements`: `MembershipAgreementQuerySet` — The agreements this user has agreed to (or not) for this group
- `createdAt`: `Date`
- `expiresAt`: `Date` — When this membership expires (mirrored from content_access table)
- `groupId`: `ID`
- `group`: `Group`
- `hasModeratorRole`: `Boolean` — Deprecated: use membershipGroupRoles; kept for older mobile clients
- `joinQuestionAnswers`: `GroupJoinQuestionAnswerQuerySet` — Answers to the join questions for this group
- `lastViewedAt`: `String` — The last time the current logged in user viewed this group (if they are a member of it)
- `membershipGroupRoles`: `MembershipGroupRoleQuerySet` — The group roles this member has in this group - join table data
- `navOrder`: `Int` — The order of this group membership in the global nav drawer - having a value means it is pinned to the top in order, null means it is not pinned
- `newPostCount`: `Int` — Number of new posts in this group since the current logged in user viewed it (if they are a member of it)
- `person`: `Person`
- `settings`: `MembershipSettings`
- `topicFollows`: `TopicFollowQuerySet`

#### type `MembershipAgreement`

A relationship between a user and a group agreement

- `id`: `Int` — The agreement id
- `accepted`: `Boolean` — Whether a user has accepted this agreement or not

#### type `MembershipGroupRole`

A user's assignment of a group role in a group

- `id`: `ID`
- `createdAt`: `Date`
- `expiresAt`: `Date` — When this role membership expires (mirrored from content_access table)
- `group`: `Group`
- `groupId`: `ID`
- `groupRoleId`: `ID`
- `groupRole`: `GroupRole`
- `roleId`: `ID` — same as groupRoleId (for backwards compatibility)
- `updatedAt`: `Date`
- `user`: `Person`
- `userId`: `ID`

#### type `MembershipCommonRole`

Deprecated stub types kept for older mobile/web clients until app releases catch up

- `id`: `ID`
- `commonRoleId`: `ID`
- `groupId`: `ID`
- `userId`: `ID`

#### type `MembershipSettings`

Settings for a user's group membership

- `agreementsAcceptedAt`: `Date` — When the member last accepted the agreements of the group
- `completedAt`: `Date` — Track space: when the member completed the linked track
- `digestFrequency`: `String` — How often this person wants to receive the email digest about new posts and comments in this group: daily, weekly, or never
- `joinQuestionsAnsweredAt`: `Date` — When the member filled out the join questions
- `postNotifications`: `String` — How this person wants to receive notifications for post in this group: none, important, or all
- `sendEmail`: `Boolean` — Whether the user wants to get email notifications from this group
- `showJoinForm`: `Boolean` — Whether this user has yet seen the form that appears when first joining a new group
- `sendPushNotifications`: `Boolean` — Whether the user wants to get mobile app push notifications from this group

#### type `Message`

A direct message sent in a specific thread

- `id`: `ID`
- `attachments(type: String)`: `[Attachment]`
- `attachmentsTotal`: `Int`
- `createdAt`: `Date`
- `editedAt`: `Date` — When this message was last edited
- `creator`: `Person` — The person sending the message
- `messageThread`: `MessageThread` — The message thread this message is a part of
- `text`: `String` — The content of the Message
- `commentReactions`: `[Reaction]` — All reactions on a message
- `commentReactionsTotal`: `Int` — Number of total reactions on a message

#### type `MessageThread`

A direct message thread between 2 or more Persons

- `id`: `ID`
- `createdAt`: `Date`
- `lastReadAt`: `String` — When logged in user last read this thread
- `participantsTotal`: `Int` — Total number of people in the thread
- `unreadCount`: `Int` — Number of unread messages since logged in user last looked at this thread
- `isMuted`: `Boolean` — Whether the logged in user has muted this thread
- `updatedAt`: `Date`
- `messages(first: Int, cursor: ID, order: String)`: `MessageQuerySet` — The set of messages in the thread
- `participants(first: Int, cursor: ID, order: String)`: `[Person]` — The set of people in the thread

#### type `ModerationAction`

- `id`: `ID`
- `agreements`: `[Agreement]` — The agreements that are linked to the moderation action
- `agreementsTotal`: `Int` — junk value, do not use
- `anonymous`: `Boolean` — Whether the reporter can be seen by all group members or not
- `group`: `Group` — The group where the action was taken
- `groupId`: `ID` — The groupId where the action was taken
- `platformAgreements`: `[PlatformAgreement]` — Platform agreements that are linked to the moderation action
- `platformAgreementsTotal`: `Int` — junk value, do not use
- `post`: `Post` — The post that was moderated
- `postId`: `ID` — Just the id of the post
- `reporter`: `Person` — The person who took the action
- `status`: `String` — The status of moderation action
- `text`: `String` — Description of what the moderation action is about
- `createdAt`: `Date`
- `updatedAt`: `Date`

#### type `Notification`

A notification of an activity for a person

- `id`: `ID`
- `activity`: `Activity` — The activity being notified about
- `createdAt`: `Date`

#### type `Person`

A user of Hylo

- `id`: `ID`
- `canMessage`: `Boolean` — Whether the current user may start a direct message with this person (never true for themself)
- `avatarUrl`: `String` — The URL of this person's avatar image
- `bannerUrl`: `String` — The URL of this person's banner image on their profile
- `bio`: `String` — Personal bio
- `completedAt`: `Date` — When loading through a track this is when they completed the track
- `contactEmail`: `String` — Email address made visible on this person's profile
- `contactPhone`: `String` — Phone number made visible on this person's profile
- `enrolledAt`: `Date` — When loading through a track: membership created_at (join space = enroll)
- `facebookUrl`: `String` — The URL to this person's Facebook profile
- `hasRegistered`: `Boolean` — False for new users who have not completed the registration process
- `isProfilePublic`: `Boolean` — Whether this person's profile is publicly viewable without logging in
- `lastActiveAt`: `String` — When this person last viewed Hylo
- `linkedinUrl`: `String` — URL of this person's LinkedIn Profile
- `location`: `String` — String representing this person's physical location
- `locationObject`: `Location` — Object with the geocoded details of this person's physical location
- `membershipsTotal`: `Int` — Number of total group memberships
- `messageThreadId`: `ID` — The id of the message thread this person has with the currently logged in user (if any)
- `moderatedGroupMembershipsTotal`: `Int` — Number of groups this person moderates
- `name`: `String` — This person's name
- `tagline`: `String` — Short tagline
- `twitterName`: `String` — This person's twitter handle
- `url`: `String` — A website URL this person has added to their profile
- `affiliations`: `AffiliationQuerySet` — Organizational affiliations that are not Hylo Groups
- `comments(first: Int, offset: Int, order: String)`: `CommentQuerySet` — Comments this person has made (that are visible to the logged in user)
- `eventsAttending`: `PostQuerySet` — The events this person is attending (that are visible to logged in user)
- `memberships(cursor: ID, first: Int, order: String)`: `[Membership]` — The set of Group Memberships this person has (that are visible to logged in user)
- `groupRoles(groupId: ID, slug: String)`: `GroupRoleQuerySet` — All the member roles for a user
- `membershipCommonRoles(groupId: ID)`: `MembershipCommonRoleQuerySet` — Deprecated: kept for older mobile clients
- `groupJoinQuestionAnswers(groupId: ID, slug: String)`: `GroupJoinQuestionAnswerQuerySet` — Answers to join questions for the current group context (when queried through a group's members)
- `moderatedGroupMemberships(first: Int, cursor: ID, order: String)`: `[Membership]` — The set of Memberships to groups this person moderates (that are visible to logged in user
- `posts(activePostsOnly: Boolean, afterTime: Date, announcementsOnly: Boolean, beforeTime: Date, boundingBox: [PointInput], collectionToFilterOut: ID, context: String, createdBy: [ID], cursor: ID, filter: String, first: Int, forCollection: ID, groupSlugs: [String], isFulfilled: Boolean, interactedWithBy: [ID], mentionsOf: [ID], offset: Int, order: String, savedBy: [ID], search: String, sortBy: String, topic: ID, topics: [ID], types: [String], rsvpResponse: String)`: `PostQuerySet` — The set of Posts this person has created (that are visible to logged in user)
- `projects`: `PostQuerySet` — Project posts that this person is a member of
- `reactions(first: Int, offset: Int, order: String)`: `ReactionQuerySet` — This person's reactions
- `skills(first: Int, cursor: ID)`: `SkillQuerySet` — The set of Skills this person has added to their profile
- `skillsToLearn(first: Int, cursor: ID)`: `SkillQuerySet` — The set of Skills this person want to learn

#### type `PersonConnection`

Only type of connection tracked right now is who has sent a message to who. Also this can only be used to find connections for the current logged in user

- `id`: `ID`
- `createdAt`: `Date`
- `person`: `Person` — Who the current user is connected to
- `type`: `String` — Only option right now is 'message'
- `updatedAt`: `Date`

#### type `PlatformAgreement`

- `id`: `Int`
- `description`: `String`
- `text`: `String` — The text of the agreement
- `type`: `String` — type; either 'public' or 'anywhere'

#### type `Post`

- `id`: `ID`
- `acceptContributions`: `Boolean` — NOT USED RIGHT NOW. Whether this post can accept financial contributions
- `anonymousVoting`: `Boolean` — whether voting is anonymous for this proposal (Only used by proposal type posts)
- `announcement`: `Boolean` — Was this post marked an announcement by a group moderator?
- `attachmentsTotal`: `Int` — Number of attachments on this post
- `budget`: `String` — Budget for project or submission posts
- `commentersTotal`: `Int` — Number of people who have commented on this post
- `commentsTotal`: `Int` — Total number of comments on this post
- `completedAt`: `Date` — The date and time this post was completed by the current user
- `completionAction`: `String` — The action that people can take to complete this post. 'button', 'comment', 'reaction', 'selectMultiple', 'selectOne', 'text', 'uploadFile'
- `completionActionSettings`: `JSON` — The options associated with the completion action. e.g. for 'selectMultiple', this is an array of options
- `completionResponse`: `JSON` — The response the current user gave when completing this post
- `completionResponses`: `PostUserQuerySet` — All the responses from all users who have completed this post - only available to moderators
- `clickthrough`: `Boolean` — If this post has been flagged, this tracks whether the currentuser has clicked through the flag-screen
- `createdAt`: `Date`
- `details`: `String` — The body of the post
- `editedAt`: `Date` — When the text was last edited
- `donationsLink`: `String` — Link to a donation page, only used for projects only right now
- `endTime`: `Date` — When this post "ends". Used for events, resources, projects, requests and offers right now
- `flaggedGroups`: `[ID]` — List of group ids for groups that have flagged this post
- `followersTotal`: `Int` — Number of people following this post (when someone comments on or reacts to a post they follow it)
- `fulfilledAt`: `Date` — When the posr creator marked it as "fulfilled" or "complete"
- `fundingRound`: `FundingRound` — The funding round this post is associated with
- `groupsTotal`: `Int` — Number of groups this has been posted to
- `isAnonymousVote`: `Boolean` — Whether who votes on this proposal is visible or not
- `isPublic`: `Boolean` — Whether this post is publicly visible (outside of the groups it is posted to)
- `isStrictProposal`: `Boolean` — A strict proposal cannot be edited in all the ways a casual proposal can be
- `linkPreviewFeatured`: `Boolean` — Whether LinkPreview appears full size above post or smaller below
- `localId`: `String` — Temporary id passed in from the client to identify the post when it is created, and passed back to the client, for optimistically creating posts
- `location`: `String` — Full location string
- `locationObject`: `Location` — Object with geocoded location deatils
- `meetingLink`: `String` — Video call link for online or hybrid events (Zoom, Meet, Jitsi, etc.)
- `myEventResponse`: `String` — Logged in user's attendance response to an event post: 'yes', 'maybe' or 'no'
- `myReactions`: `[Reaction]` — The reactions of the logged-in user to this
- `numPeopleCompleted`: `Int` — The total number of people who have completed this post in a track
- `peopleReactedTotal`: `Int` — Number of people that have one or more reactions to a post
- `postReactionsTotal`: `Int` — Number of total reactions on the post
- `postMembershipsTotal`: `Int` — Number of total "members" of the post. Used for Projects only right now
- `proposalOutcome`: `String` — A proposal's outcome: 'cancelled', 'quorum-not-met', 'in-progress', 'successful', 'tie'
- `proposalStatus`: `String` — The status of a proposal post: 'discussion', 'voting', 'completed'
- `projectManagementLink`: `String` — Link to a project management tool or service. Only used for Projects right now
- `votingMethod`: `String` — The type of proposal: 'single', 'multiple-unrestricted', 'majority', 'consensus'
- `quorum`: `Int` — Percentage of all group members that must vote for a proposal to complete
- `reactionsTotal`: `Int` — Number of total reactions on the post
- `reactionsSummary`: `JSON` — Summary of reactions on the post
- `savedAt`: `Date` — When the current user saved this post
- `startTime`: `Date` — When this post "starts". Used for events, resources, projects, requests and offers right now
- `timezone`: `String` — The timezone of the post
- `title`: `String` — The title text for the post
- `tokensAllocated`: `Int` — Number of tokens allocated to this post by the current user (for funding round submissions)
- `totalTokensAllocated`: `Int` — Total number of tokens allocated to this post by all users (for funding round submissions)
- `topicsTotal`: `Int` — Number of topics added to the post
- `totalContributions`: `Int` — NOT USED RIGHT NOW
- `type`: `String` — Post type: 'discussion', 'event', 'offer', 'project', 'proposal', 'request', 'resource', or notice types such as 'chat_activity'
- `updatedAt`: `Date`
- `noticeData`: `JSON` — JSON payload for system-generated notice posts (chat activity buckets, etc.)
- `noticePosts`: `[Post]` — Live chat posts previewed on a chat_activity notice, newest first
- `attachments(type: String)`: `[Attachment]` — The attachments (images, videos or files) added to the post
- `comments(first: Int, cursor: ID, order: String)`: `CommentQuerySet` — The comments on this post
- `commenters(first: Int)`: `[Person]` — All the people who have commented on this post
- `creator`: `Person` — The person who created this post
- `eventInvitations(first: Int, cursor: ID, order: String)`: `EventInvitationQuerySet` — Invitations to event posts
- `followers(first: Int, cursor: ID, order: String)`: `[Person]` — People following this post (from commenting or voting on it)
- `groups(first: Int, cursor: ID, order: String)`: `[Group]` — The groups this post has been posted to
- `linkPreview`: `LinkPreview` — The link preview of the first link in the post that is shown as a card on the post
- `moderationActions`: `[ModerationAction]` — Any moderation actions that are linked to this post
- `moderationActionsTotal`: `Int`
- `members(first: Int, cursor: ID, order: String)`: `PersonQuerySet` — The members of a project type Post
- `postMemberships`: `[PostMembership]` — The post's "memberships" in the groups it has been posted in
- `postReactions`: `[Reaction]` — reactions to this post
- `proposalOptions`: `ProposalOptionQuerySet` — For proposal posts, load all the different options that people can vote on.
- `proposalVotes`: `ProposalVoteQuerySet` — Load all votes for a proposal post. Note: not a queryset; to avoid paginating votes
- `topics`: `[Topic]` — The topics that have been added to this post

#### type `PostMembership`

The relationship between a Post and a Group

- `id`: `ID`
- `group`: `Group` — The group this post was posted in

#### type `PostUser`

Relationship of a user to a post, indicating "following the post". Created when a user comments on or reacts to a post

- `id`: `ID`
- `completedAt`: `Date` — The date and time this post was completed by the user
- `completionResponse`: `JSON` — The response the user gave when completing this post
- `post`: `Post`
- `user`: `Person`

#### type `Point`

A geographic point by latitude + longitude

- `lat`: `String`
- `lng`: `String`

#### type `ProposalOption`

- `id`: `ID`
- `postId`: `ID`
- `text`: `String` — Required: The text of the proposal option
- `emoji`: `String` — Optional: The emoji for the proposal option
- `color`: `String` — Optional: The color for the proposal option

#### type `ProposalVote`

- `id`: `ID`
- `userId`: `ID` — The person who voted
- `postId`: `ID` — The post that the vote is for
- `optionId`: `ID` — The option that the person voted for
- `createdAt`: `Date` — timestamp of when the vote was created
- `user`: `Person` — The person who voted

#### type `Question`

A question asked when someone is trying to join a group

- `id`: `Int`
- `text`: `String` — The question content

#### type `Reaction`

Emoji reactions to posts and comments

- `createdAt`: `Date` — when the reaction happened
- `emojiBase`: `String` — Just the basic emoji, no modifiers. UTF-16 (JS default) encoding for an emojis code-points (like '\uD83D\uDE00')
- `emojiFull`: `String` — The full emoji, with any modifiers (eg: for skin). UTF-16 (JS default) encoding for an emojis code-points (like '\uD83D\uDE00')
- `emojiLabel`: `String` — The EN locale string for an emoji, like :thumbs_up:
- `entityId`: `ID` — id for the entity associated with the reactions
- `entityType`: `String` — What type of entity a reaction is associated with. Currently only 'post' or 'comment'
- `id`: `ID` — id for the reaction
- `userId`: `ID` — id for the user who reacted
- `post`: `Post` — The post associated with a reaction
- `user`: `Person` — The user associated with a reaction

#### type `Responsibility`

Responsibilities are either group-level platform powers (such as removing content or inviting new members) or non-platform group-specific responsibilities (such as handles budget, consent team, etc)

- `id`: `ID`
- `responsibilityId`: `ID` — If the responsibility is mapped to a group_role
- `description`: `String` — Description of this responsibility
- `title`: `String` — The name of the responsibility
- `type`: `String` — The type of responsibility: 'system' or 'group'

#### type `SavedSearch`

A saved set of search/filter parameters for the map that can be reloaded later by a user

- `id`: `ID`
- `boundingBox`: `[Float]` — The geographic bounding box in the formar of [lng, lat, lng, lat...]
- `createdAt`: `Date`
- `context`: `String` — 'groups' for a Group specific search, 'all' to search for posts in all logged in user's groups, or 'public' to search all public posts
- `group`: `Group` — The group to search (optional)
- `isActive`: `Boolean` — Whether the saved search is active or not
- `name`: `String` — The name of the saves search
- `newPosts`: `[Post]` — New posts since the last time the search was checked for new posts to send in the email digest
- `postTypes`: `[String]` — Only include posts that match these post types
- `searchText`: `String` — Only include posts that match this search text in title or description
- `topics`: `[SavedSearchTopic]` — Only include posts that match one of these topics

#### type `SavedSearchTopic`

A topic associated with a Saved Search

- `id`: `ID`
- `name`: `String` — Topic title

#### type `SearchResult`

Search result item which can be a Person, a Post, a Comment or a Group

- `id`: `ID`
- `content`: `SearchResultContent`

#### type `Skill`

A skill someone adds to their profile

- `id`: `ID`
- `name`: `String` — The text content of the skill

#### type `Topic`

A Topic object represnts a tag on a post

- `id`: `ID`
- `followersTotal(groupSlug: String)`: `Int` — The number of followers of this topic in a particular group by slug
- `name`: `String` — The topic string
- `postsTotal(groupSlug: String)`: `Int` — The number of posts using this topic in a particular group by slug
- `groupTopics(first: Int, groupSlug: String, isDefault: Boolean, offset: Int, visibility: [Int], groupId: ID)`: `GroupTopicQuerySet` — The relationships to all groups that this topic has been used in

#### type `TopicFollow`

- `id`: `ID`
- `createdAt`: `Date`
- `group`: `Group` — The group that the topic is in
- `lastReadPostId`: `ID` — Obsolete — unread is on GroupViewUser. Not updated.
- `newPostCount`: `Int` — Obsolete — unread is on GroupViewUser. Not updated.
- `settings`: `TopicFollowSettings` — The settings for the topic follow
- `topic`: `Topic` — The topic that is being followed
- `updatedAt`: `Date`
- `user`: `Person` — The user that is following the topic

#### type `TopicFollowSettings`

- `notifications`: `String` — The notifications for the topic follow: 'none', 'important', or 'all'

#### type `Track`

- `id`: `ID`
- `accessControlled`: `Boolean` — Whether this track requires purchased access (paid content)
- `canAccess`: `Boolean` — Whether the current user has access to this track (via scope system or free access)
- `actionDescriptor`: `String` — The word used in this track to describe an action
- `actionDescriptorPlural`: `String` — The word used in this track to describe multiple actions
- `completionMessage`: `String` — The message shown when a user completes this track
- `completionRole`: `GroupRole` — The role/badge that is awarded when a user completes this track
- `createdAt`: `Date` — When this track was created
- `deactivatedAt`: `Date` — When this track was deactivated
- `didComplete`: `Boolean` — Whether the current user has completed this track
- `enrolledUsers`: `PersonQuerySet` — The users enrolled in this track
- `groupsTotal`: `Int` — The total number of groups this track is a part of
- `isEnrolled`: `Boolean` — Whether the current user is enrolled in this track
- `numActions`: `Int` — The total number of actions in this track
- `numPeopleEnrolled`: `Int` — The total number of people enrolled in this track
- `numPeopleCompleted`: `Int` — The total number of people who have completed this track
- `postsTotal`: `Int` — The total number of posts in this track
- `updatedAt`: `Date` — When this track was updated
- `userSettings`: `JSON` — The settings for the current user in this track
- `usersTotal`: `Int` — The total number of users in this track
- `space`: `Group` — The Track space Group (tracks.group_id / groups.track_id)
- `users`: `PersonQuerySet` — The users related to this track

#### type `MembershipChangePreview`

Preview of subscription change rules (v1)

- `mode`: `String!`
- `reason`: `String`
- `meta`: `JSON`

#### type `MembershipChangeEligibleOfferingsResult`

- `offerings`: `[StripeOffering]`
- `success`: `Boolean`

#### type `MembershipChangeInvoicePreviewLine`

- `description`: `String`
- `amount`: `Int`
- `currency`: `String`
- `proration`: `Boolean`

#### type `MembershipChangeInvoicePreview`

- `mode`: `String!`
- `reason`: `String`
- `amountDue`: `Int`
- `currency`: `String`
- `subtotal`: `Int`
- `total`: `Int`
- `nextPaymentAttempt`: `Date`
- `lines`: `[MembershipChangeInvoicePreviewLine]`
- `hyloPrepaidCreditCents`: `Int` — Hylo linear unused-time credit (same basis as customer balance on commit); may also appear as a line

#### type `MembershipChangeCommitResult`

Result of membershipChangeCommit mutation

- `success`: `Boolean!`
- `message`: `String`
- `mode`: `String` — Resolved mode from subscriptionChangeRules (e.g. immediate_upgrade)
- `subscriptionChangeEventId`: `ID`

#### type `PendingMembershipSubscriptionChange`

Pending membership plan change (row in subscription_change_events, status pending)

- `mode`: `String!`
- `effectiveAt`: `Date`
- `toOffering`: `StripeOffering`

#### type `StripeOffering`

Stripe offering for paid content access

- `id`: `ID`
- `createdAt`: `Date`
- `updatedAt`: `Date`
- `group`: `Group` — The group this offering belongs to
- `groupId`: `ID`
- `stripeProductId`: `String` — Stripe product ID from Stripe API
- `stripePriceId`: `String` — Stripe price ID from Stripe API
- `name`: `String` — Offering name
- `description`: `String` — Offering description
- `priceInCents`: `Int` — Price in cents
- `currency`: `String` — Currency code (e.g. 'usd')
- `track`: `Track` — Optional track this offering grants access to (legacy field)
- `trackId`: `ID`
- `accessGrants`: `JSON` — JSONB object defining what access this offering grants (scopes only; API merges metadata for presentation)
- `metadata`: `JSON` — Presentation / checkout options (buyButtonText, slidingScale), not access scopes
- `tracks`: `[Track]` — Tracks this offering used to grant (deprecated; prefer groupIds for spaces). Kept for read compatibility.
- `roles`: `[GroupRole]` — Group roles this offering grants (resolved from accessGrants.groupRoleIds)
- `renewalPolicy`: `String` — Renewal policy: automatic or manual
- `duration`: `String` — Duration: month, season, annual, lifetime, or null for no expiration
- `publishStatus`: `PublishStatus` — Publish status: unpublished, unlisted, published
- `buyButtonText`: `String` — Optional custom label for the buy button (e.g. "Join now", "Subscribe"); stored in metadata.buyButtonText

#### type `ContentAccess`

- `id`: `ID`
- `createdAt`: `Date`
- `updatedAt`: `Date`
- `user`: `Person` — User who has access
- `userId`: `ID`
- `grantedByGroup`: `Group` — Group that granted the access
- `grantedByGroupId`: `ID`
- `group`: `Group` — Group access is for (optional)
- `groupId`: `ID`
- `offering`: `StripeOffering` — Stripe offering (if purchased)
- `offeringId`: `ID`
- `track`: `Track` — Track access is for (optional)
- `trackId`: `ID`
- `groupRole`: `GroupRole` — Group role access is for (optional)
- `groupRoleId`: `ID`
- `accessType`: `String` — How access was granted: stripe_purchase or admin_grant
- `stripeSessionId`: `String` — Stripe session ID (for purchases)
- `stripeSubscriptionId`: `String` — Stripe subscription ID (for recurring purchases)
- `status`: `String` — Current status: active, expired, revoked
- `grantedBy`: `Person` — User who granted access (for admin grants)
- `grantedById`: `ID`
- `expiresAt`: `Date` — When access expires (optional)
- `metadata`: `JSON` — Additional metadata
- `subscriptionCancelAtPeriodEnd`: `Boolean` — Subscription cancellation info (extracted from metadata)
- `subscriptionPeriodEnd`: `Date`
- `subscriptionCancellationScheduledAt`: `Date`
- `subscriptionCancelReason`: `String`

#### type `ContentAccessResult`

- `id`: `ID`
- `userId`: `ID`
- `grantedByGroupId`: `ID`
- `groupId`: `ID`
- `productId`: `ID`
- `trackId`: `ID`
- `groupRoleId`: `ID`
- `accessType`: `String`
- `status`: `String`
- `success`: `Boolean`
- `message`: `String`
- `grantedCount`: `Int` — Number of users granted access (useful for grantToAllMembers)

#### type `ContentAccessCheckResult`

- `hasAccess`: `Boolean`
- `accessType`: `String`
- `expiresAt`: `Date`

#### type `UserTransaction`

A user's transaction/purchase record, enriched with Stripe data

- `id`: `ID!`
- `offering`: `StripeOffering` — From our database The offering/product that was purchased
- `offeringName`: `String`
- `group`: `Group!` — The group that sold this
- `groupName`: `String`
- `track`: `Track` — Track access granted (if applicable)
- `trackName`: `String`
- `accessType`: `String!` — Type of access: 'group', 'track', 'role'
- `status`: `String!` — Our status: 'active', 'expired', 'revoked'
- `purchaseDate`: `Date!` — When the purchase was made
- `expiresAt`: `Date` — When access expires (null for lifetime)
- `paymentType`: `String!` — From Stripe API (enriched) Payment type: 'one_time' or 'subscription'
- `subscriptionStatus`: `String` — Stripe subscription status: 'active', 'canceled', 'past_due', etc (null for one-time payments)
- `currentPeriodEnd`: `Date` — When the current billing period ends / next renewal date
- `subscriptionCancelAtPeriodEnd`: `Boolean` — Subscription cancellation info (extracted from metadata)
- `subscriptionPeriodEnd`: `Date`
- `subscriptionCancellationScheduledAt`: `Date`
- `subscriptionCancelReason`: `String`
- `amountPaid`: `Int` — Amount paid in cents
- `currency`: `String` — Currency code (e.g., 'usd')
- `manageUrl`: `String` — Generated links URL to Stripe billing portal for managing this subscription
- `receiptUrl`: `String` — URL to view receipt
- `pendingMembershipSubscriptionChange`: `PendingMembershipSubscriptionChange` — When a plan change is scheduled for period end (or lifetime path), surfaced from subscription_change_events

#### type `FundingRound`

A participatory funding round

- `id`: `ID`
- `allowLateJoiners`: `Boolean` — Whether people who join during the voting phase receive tokens and can vote
- `allowSelfVoting`: `Boolean` — Whether participants can vote on their own submissions
- `canSubmit`: `Boolean` — Whether the current user can submit to this funding round
- `canVote`: `Boolean` — Whether the current user can vote in this funding round
- `createdAt`: `Date`
- `criteria`: `String` — Criteria for submitting projects/submissions
- `group`: `Group` — The Funding Round space Group (funding_rounds.group_id)
- `hideFinalResultsFromParticipants`: `Boolean` — Whether to hide final voting results from participants
- `isParticipating`: `Boolean` — Whether the current user is participating in this round
- `joinedAt`: `Date` — When the current user joined this funding round
- `maxTokenAllocation`: `Int` — Maximum tokens a voter can allocate
- `minTokenAllocation`: `Int` — Minimum tokens a voter can allocate
- `numParticipants`: `Int` — Number of participants in the round
- `numSubmissions`: `Int` — Number of submissions in the round
- `phase`: `FundingRoundPhase` — The current phase of the round (resolved from the space group's status)
- `requireBudget`: `Boolean` — Whether a budget is required for submissions
- `showRealtimeSubmissions`: `Boolean` — Whether members can see every submission during the submissions phase
- `showRealtimeVotes`: `Boolean` — Whether to show running vote totals during the voting phase
- `submissionDescriptor`: `String` — The term used to describe a submission to the round
- `submissionDescriptorPlural`: `String` — The plural term used to describe submissions to the round
- `submissions`: `PostQuerySet` — The submission posts for the round
- `submissionsTotal`: `Int` — Total number of submission
- `submissionsCloseAt`: `Date` — The date submissions close (optional)
- `submissionsOpenAt`: `Date` — The date submissions open (optional)
- `submitterRoles`: `[GroupRole]` — The roles or badges required to add a submission to the round
- `tokensDistributedAt`: `Date` — When tokens were distributed to users
- `tokensRemaining`: `Int` — The number of tokens remaining for the current user to allocate
- `totalTokens`: `Int` — Total tokens available to allocate
- `totalTokensAllocated`: `Int` — Total number of tokens allocated across all submissions in this round
- `tokenType`: `String` — Token type used for voting/allocation
- `updatedAt`: `Date`
- `users`: `PersonQuerySet` — The users that have joined this funding round
- `usersTotal`: `Int` — Total number of users joined
- `userSettings`: `JSON` — The settings for the current user in this track
- `voterRoles`: `[GroupRole]` — The roles/badges required to vote on submissions
- `votingClosesAt`: `Date` — When voting opens (optional)
- `votingOpensAt`: `Date` — When voting closes (optional)
- `votingMethod`: `String` — Voting method to be used (current options: token_allocation_constant, token_allocation_divide)
- `allocations`: `[FundingRoundAllocation]` — Token allocations for this funding round. Each entry pairs a voter (Person) with a submission (Post) and the tokens they allocated so the UI can render per-user results.

#### type `FundingRoundAllocation`

Token allocation for a submission by a user within a funding round

- `user`: `Person` — The user who allocated tokens
- `submission`: `Post` — The submission that received the tokens
- `tokensAllocated`: `Int` — Number of tokens allocated to the submission

#### type `UserSettings`

Current user's personal settings

- `alreadySeenTour`: `Boolean` — Has this person seen the tour that displays the first time someone logs in
- `toursSeen`: `[String]` — Ids of in-app guided tours this person has completed or dismissed
- `colorScheme`: `String` — Display mode preference: auto, light, or dark
- `commentNotifications`: `String` — How this person wants to receive notifications about new comments on posts they're following? email, push, both, or none
- `dmNotifications`: `String` — How this person wants to receive notifications about Direct Messages: email, push, both, or none
- `lastViewedMessagesAt`: `String` — When person wants last viewed their Direct Messages
- `locale`: `String` — Locale preferences for the user
- `mapBaseLayer`: `String` — The most recent map base later viewed by this person
- `globalNavStyle`: `String` — Global navigation position: sidebar or tabs
- `groupNavStyle`: `String` — Override for group menu layout: group-default, two-column, or one-column
- `postNotifications`: `String` — How this person wants to receive notifications for each post in their groups. none, important, or all
- `rsvpCalendarSub`: `Boolean` — Whether to enable RSVP calendar subscription
- `signupInProgress`: `Boolean` — Whether this person has finished viewing the welcome wizard after first signing up
- `stackGroups`: `Boolean` — Whether to show subgroups stacked on their parent in global nav (default false / flat)
- `independentSpaceMenu`: `Boolean` — Whether space clicks replace the ContextMenu with the space's views (default false / nested in group menu)
- `streamChildPosts`: `String` — Include child group posts in user's stream
- `streamViewMode`: `String` — The most recent stream view mode used by this person: cards, list, grid, bigGrid
- `streamSortBy`: `String` — The most recent stream sort used by this person: updated, created, reactions
- `streamPostType`: `String` — The most recent stream post type filter used by this person
- `theme`: `String` — Color scheme / palette name (e.g. default, forest, ocean)
- `unifiedEmailDigest`: `Boolean` — When true, daily group digests are combined into one daily email and weekly group digests into one weekly email

#### type `Draft`

- `id`: `ID`
- `data`: `String` — JSON-encoded payload matching the surface's draft shape
- `group`: `Group` — The group associated with this draft (for post/chat drafts)
- `groupId`: `ID`
- `isEdit`: `Boolean`
- `messageThread`: `MessageThread`
- `messageThreadId`: `ID`
- `postType`: `String`
- `navigateTo`: `String` — Client-side URL to navigate to when opening this draft
- `post`: `Post` — The post associated with this draft (for comment drafts, or post edits)
- `postId`: `ID`
- `topicId`: `ID`
- `type`: `String` — The draft type: 'post', 'comment', or 'message'
- `updatedAt`: `String`

#### type `EmailEnabledTester`

Email-enabled tester account (for staging/testing environments)

- `id`: `ID!`
- `userId`: `ID!`
- `user`: `Person`
- `createdAt`: `Date`
- `updatedAt`: `Date`

#### type `PublicListingRequest`

A group's request to be added to the commons (have allowInPublic turned on)

- `status`: `String` — pending, approved or denied
- `message`: `String` — Optional note from the requester to the Hylo team
- `requestedAt`: `Date`
- `requestedBy`: `Person`
- `reviewedAt`: `Date`
- `reviewedBy`: `Person`
- `reviewMessage`: `String` — Optional note from the reviewing admin, included in the decision email

#### type `SiteBanner`

A site-wide announcement banner published by a superadmin

- `id`: `ID!`
- `title`: `String`
- `text`: `String`
- `type`: `String`
- `actionText`: `String`
- `actionUrl`: `String`
- `showToNewUsers`: `Boolean` — When true, people who join Hylo after this banner is published will see it. Defaults to false.
- `creator`: `Person`
- `publishedAt`: `Date`
- `unpublishedAt`: `Date`
- `createdAt`: `Date`
- `updatedAt`: `Date`
- `dismissedCount`: `Int` — Number of users who have dismissed this banner (admin only)

#### input `SiteBannerInput`

- `title`: `String`
- `text`: `String`
- `type`: `String`
- `actionText`: `String`
- `actionUrl`: `String`
- `showToNewUsers`: `Boolean`

#### type `ZapierTrigger`

- `id`: `ID`
- `groupId`: `ID`
- `targetUrl`: `String` — The Zapier URL to call when this type is triggered
- `type`: `String` — When this gets triggered. Options: 'new_member' = when 1 or more members are added to a group 'member_leaves' = when a person leaves or is kicked out of a group 'member_updated' = when a member of a group updates their profile 'new_post' = when a new post is created

#### type `AcceptGroupRelationshipInviteResult`

Result of acceptGroupRelationshipInvite mutation

- `success`: `Boolean` — Whether the mutation succeeded or not
- `groupRelationship`: `GroupRelationship` — The new GroupRelationship object if it succeeded

#### type `CreatedInvitations`

The result of a createInvitation mutation

- `invitations`: `[Invitation]` — The invitations created

#### type `CreatedRequest`

Result of the createJoinRequest mutation

- `request`: `JoinRequest`

#### type `CreatedGroupRelationshipInvite`

Result of a mutation that creates a GroupRelationshipInvite

- `success`: `Boolean` — Whether the mutation succeeded or not
- `groupRelationship`: `GroupRelationship` — In the case that the invite was from and to a group that the user is a steward of then the invite automatically succeeds and a GroupRelationship is formed and returned
- `groupRelationshipInvite`: `GroupRelationshipInvite` — If the invite was to a group the user is not a steward of then return the new GroupRelationshipInvite

#### type `BlockingSpace`

A child space that blocks turning a group into a space

- `id`: `ID`
- `name`: `String`
- `slug`: `String`
- `chatOnly`: `Boolean` — True when the space only accepts chat posts

#### type `ConvertChatSpaceToDiscussionResult`

Counts, and the discussion post when the conversion was not a dry run

- `dryRun`: `Boolean`
- `queued`: `Boolean` — True when the room was large enough that comments are copied by a background job
- `messageCount`: `Int`
- `authorCount`: `Int`
- `attachmentCount`: `Int`
- `reactionCount`: `Int`
- `replyCount`: `Int`
- `firstMessageAt`: `Date`
- `lastMessageAt`: `Date`
- `post`: `Post`

#### type `GenericResult`

A generic result of a mutation

- `error`: `String` — If the mutation failed this will contain an error string
- `success`: `Boolean` — Did the mutation succeed or not

#### type `RefundResult`

Result of a refund mutation

- `success`: `Boolean` — Did the refund succeed
- `message`: `String` — Message describing the result
- `refundId`: `String` — Stripe refund ID
- `refundAmount`: `Int` — Amount refunded in cents

#### type `InvitationUseResult`

Result of a useInvitation mutation

- `error`: `String` — If the mutation failed this will contain an error string
- `membership`: `Membership` — If the mutation succeeded, the new group Membership object

#### type `SignupResult`

Result of a login or signup related mutation

- `error`: `String` — If the mutation failed this will contain an error string
- `me`: `Me` — If the mutation succeeded return the data for the current user logging in or signup up

#### type `StripeConnectedAccountResult`

Stripe Connect result types

- `id`: `ID`
- `accountId`: `String`
- `success`: `Boolean`
- `message`: `String`

#### type `StripeAccountLinkResult`

- `url`: `String`
- `expiresAt`: `Date`
- `success`: `Boolean`

#### type `StripeAccountStatusResult`

- `accountId`: `String`
- `chargesEnabled`: `Boolean`
- `payoutsEnabled`: `Boolean`
- `detailsSubmitted`: `Boolean`
- `email`: `String`
- `requirements`: `JSON`

#### type `StripeStatusCheckResult`

- `success`: `Boolean`
- `message`: `String`
- `chargesEnabled`: `Boolean`
- `payoutsEnabled`: `Boolean`
- `detailsSubmitted`: `Boolean`

#### type `StripeOfferingResult`

- `productId`: `String`
- `priceId`: `String`
- `name`: `String`
- `databaseId`: `ID`
- `success`: `Boolean`
- `message`: `String`

#### type `StripeOfferingsResult`

- `offerings`: `[StripeOffering]`
- `success`: `Boolean`

#### type `StripeOfferingUpdateResult`

- `offering`: `StripeOffering`
- `success`: `Boolean`
- `message`: `String`

#### type `StripeCheckoutSessionResult`

- `sessionId`: `String`
- `url`: `String`
- `success`: `Boolean`

#### type `StripeFulfillCheckoutResult`

- `success`: `Boolean`
- `message`: `String`

#### type `OfferingSubscriptionStats`

Stats for an offering's subscribers

- `activeCount`: `Int` — Number of currently active subscribers
- `lapsedCount`: `Int` — Number of lapsed (expired/revoked) subscribers
- `monthlyRevenueCents`: `Int` — Monthly revenue in cents (requires Stripe API call)
- `currency`: `String` — Currency of the offering
- `success`: `Boolean`
- `message`: `String`

#### type `OfferingSubscriber`

A subscriber to an offering (StripeProduct)

- `id`: `ID` — The content access record ID
- `userId`: `ID` — The user ID of the subscriber
- `userName`: `String` — The subscriber's name
- `userAvatarUrl`: `String` — The subscriber's avatar URL
- `status`: `String` — Subscription status: 'active' or 'lapsed'
- `joinedAt`: `Date` — When the user subscribed/purchased
- `expiresAt`: `Date` — When access expires (if applicable)
- `stripeSubscriptionId`: `String` — The Stripe subscription ID (if applicable)

#### input `AffiliationInput`

An Affilation with an organization added to a User profile

- `orgName`: `String` — The name of the organization the person is affiliated with
- `preposition`: `String` — Connector word between role and org. e.g. Steward 'of' Terran Collective, or Laywer 'for' Hylo
- `role`: `String` — The role this person has in the organization
- `url`: `String` — URL of the affiliated organization

#### input `AgreementInput`

A Group Agreement

- `id`: `ID`
- `description`: `String` — The text of the agreement
- `order`: `Int` — To order the display of the agreements in the group
- `title`: `String` — The title/header of the agreement

#### input `AttachmentInput`

An Attachment on a Post

- `attachmentType`: `String` — 'image', 'file' or 'video'
- `url`: `String` — URL to the attachment

#### input `CommentInput`

A Comment

- `attachments`: `[AttachmentInput]` — Image or file attachments on the comment
- `parentCommentId`: `String` — Add Comment as a thread to this parent Comment
- `postId`: `String` — Post ID
- `text`: `String` — Comment content

#### input `LinkPreviewInput`

For adding a LinkPreview to a Post

- `url`: `String` — The URL to preview

#### input `LocationInput`

- `accuracy`: `String` — Not used right now. Can be 'rooftop', 'parcel', 'point', 'interpolated', 'intersection', or 'street'
- `addressNumber`: `String` — Street number like 123
- `addressStreet`: `String` — Street name e.g. Baker Rd
- `bbox`: `[PointInput]` — Geographic bounding box
- `center`: `PointInput` — Geographic center point
- `city`: `String` — City name
- `countryCode`: `String` — Short country code e.g. us
- `country`: `String` — Full country name (not used right now)
- `createdAt`: `Date`
- `fullText`: `String` — String describing the full address
- `geometry`: `[PointInput]` — A set of points describing the spatial geometry of the returned feature
- `locality`: `String` — Sub-city features in countries where this additional admin layer is used in addressing, or where such features are commonly referred to in local parlance. e.g. city districts in Brazil and Chile and arrondissements in France.
- `neighborhood`: `String` — Colloquial neighborhood name
- `region`: `String` — Top-level sub-national administrative features, such as states in the United States or provinces in Canada or China.
- `postcode`: `String` — Postal codes used in country-specific national addressing systems.
- `updatedAt`: `Date`
- `wikidata`: `String` — Optional. The Wikidata identifier for the returned feature.

#### input `GroupInput`

- `aboutVideoUri`: `String` — URL for a video to display at the top of the about text
- `accessibility`: `Int` — Either 0 = Closed (invite only), 1 = Restricted (Anyone can request to join), 2 = Open (anyone can join if they can find/see the group)
- `acceptedPostTypes`: `[String]` — Post types this group accepts (used to seed initial GroupViews via viewTypes)
- `viewTypes`: `[String]` — Ordered list of GroupView types to seed for this group's menu (see Group.setupSpaceViews)
- `active`: `Boolean` — Whether this Group is active or not
- `agreements`: `[AgreementInput]` — The group agreements
- `avatarUrl`: `String` — URL to the image of the avatar of the group
- `bannerUrl`: `String` — URL to the image of the banner for the group
- `description`: `String` — Group description text
- `geoShape`: `String` — A geoJSON object outlining a geographic shape describing the border/boundaries of the group in the world
- `groupExtensions`: `[GroupExtensionInput]` — Extension data for special group types like farms
- `groupToGroupJoinQuestions`: `[QuestionInput]` — Questions that a group requesting to connect must answer
- `invitePath`: `String` — The current invite link for this group
- `invitePolicy`: `String` — Who can invite new people to this group: 'everyone' or 'stewards'. Changing it requires the Administration responsibility
- `joinQuestions`: `[QuestionInput]` — Questions a Person must answer when requesting to join this group
- `location`: `String` — A string describing the physical location of this group in the world
- `locationId`: `ID` — ID of the geocoded location object
- `moderatorDescriptor`: `String` — Word used to describe an admin/moderator of this group. Defaults to "Moderator". TODO: remove once mobile app switches to stewardDescriptor
- `moderatorDescriptorPlural`: `String` — Plural word used to describe admins/moderators of this group. Defaults to "Moderators". TODO: remove once mobile app switches to stewardDescriptor
- `name`: `String` — Group name
- `parentIds`: `[ID]` — IDs of parent Groups to add this Group to
- `paywall`: `Boolean` — Whether this group requires purchased membership (paywall enabled)
- `prerequisiteGroupIds`: `[ID]` — IDs of Groups that someone must join before they can join this one
- `purpose`: `String` — Purpose statement
- `settings`: `GroupSettingsInput` — Group settings
- `homeView`: `String` — The default home view for the group: CHAT (general chat), MAP (map view), or STREAM (post stream)
- `slackHookUrl`: `String` — NOT USED RIGHT NOW. For Slack integratiom
- `slackTeam`: `String` — NOT USED RIGHT NOW. For Slack integratiom
- `slackConfigureUrl`: `String` — NOT USED RIGHT NOW. For Slack integratiom
- `slug`: `String` — Unique URL slug
- `stewardDescriptor`: `String` — Word used to describe any steward of this group (someone with a Common Role). Defaults to "Steward"
- `stewardDescriptorPlural`: `String` — Word used to describe stewards of this group (people with a Common Role). Defaults to "Stewards"
- `stripeAccountId`: `String` — Stripe Connected Account ID for accepting payments
- `type`: `String` — Right now can either by 'farm' or empty
- `typeDescriptor`: `String` — Word used to describe this type of group. Defaults to Group, or if type is set then defaults to the type (e.g. Farm)
- `typeDescriptorPlural`: `String` — Word used to describe this type of groups. Defaults to Groups, or if type is set then defaults to the type (e.g. Farms)
- `websiteUrl`: `String` — The primary website for the group
- `visibility`: `Int` — Either 0 = Hidden (only visible to members), 1 = Protected (visible to members of related groups), 2 = Public (anyone can find/see this group)

#### input `GroupExtensionInput`

Extension data for special group types like farms

- `data`: `JSON`
- `type`: `String` — Extension type. Only option right now is 'farm-onboarding', for groups of type 'farm'

#### input `GroupTopicInput`

Settings for a Topic's connections to a Group

- `isDefault`: `Boolean` — true means this Topic is a default topic in the Group, meaning all new members are auomatically subscribed to it and it appears as a suggested topic when creating a post in the group.
- `visibility`: `Int` — 0 = hidden in the group, 1 = visible, 2 = pinned (will appear at the top of the subscribed topics list for People who have subscribed to it in this Group)

#### input `TopicFollowInput`

Data related to a Person following a Topic in a Group

- `lastReadPostId`: `ID` — Obsolete — unread is on GroupViewUser. Ignored by updateTopicFollow.
- `newPostCount`: `Int` — Obsolete — unread is on GroupViewUser. Ignored by updateTopicFollow.
- `settings`: `TopicFollowSettingsInput` — Settings for this TopicFollow

#### input `TopicFollowSettingsInput`

Settings for a TopicFollow

- `notifications`: `String` — How this person wants to receive notifications for post in this group: none, important, or all

#### input `GroupSettingsInput`

Group settings

- `allowGroupInvites`: `Boolean` — Whether this group allows non-hosts to invite people (not currently used)
- `askGroupToGroupJoinQuestions`: `Boolean` — Whether to require questions being answered when a group requests to join this group
- `askJoinQuestions`: `Boolean` — Whether to require questions being answered when a person requests to join this group
- `defaultDigestFrequency`: `String` — Default digest frequency for new members (daily or weekly). Used to set group_membership.settings.digestFrequency when a user joins.
- `hideExtensionData`: `Boolean` — Whether to display group extension data on the profile for special group types like farms
- `layout`: `String` — Layout mode for the group: 'two-column' (sidebar + content) or 'one-column' (dashboard cards)
- `locationDisplayPrecision`: `LocationDisplayPrecision` — How precisely to display group locations on the map and the group profile, to enable obfuscating the location
- `publicMemberDirectory`: `Boolean` — Whether to display the members of the group to non-members
- `publishMurmurationsProfile`: `Boolean` — Whether to publish this group to the Murmurations Directory via API
- `showSuggestedSkills`: `Boolean` — Whether to display suggested skills to new members when they join this group
- `showWelcomePage`: `Boolean` — Whether to display the custom Welcome Page when a member joins the group
- `showPostNoticesInChat`: `Boolean` — Whether the chat view shows inline notices when other post types are created
- `autoAddMembers`: `Boolean` — Space-only: add current parent-group members (except people who previously left) and anyone who joins the group later

#### input `StripeOfferingInput`

Input for creating Stripe offerings

- `groupId`: `ID!` — The group this offering belongs to
- `accountId`: `String!` — Stripe connected account ID
- `name`: `String!` — Offering name
- `description`: `String` — Offering description
- `priceInCents`: `Int!` — Price in cents
- `currency`: `String` — Currency code (e.g. 'usd')
- `accessGrants`: `JSON` — JSONB object defining what access this offering grants Format: { "groupIds": [7, 8], "groupRoleIds": [3, 4] } — groupIds may include space groups buyButtonText and slidingScale may be sent here for convenience; they are stored in metadata Legacy trackIds are deprecated and ignored for new grants
- `renewalPolicy`: `String` — Renewal policy: automatic or manual
- `duration`: `String` — Duration: month, season, annual, lifetime, or null for no expiration
- `publishStatus`: `PublishStatus` — Publish status: unpublished, unlisted, published, archived

#### input `AdjustableQuantityInput`

Used for sliding-scale / pay-what-you-want flows.

- `enabled`: `Boolean`
- `minimum`: `Int`
- `maximum`: `Int`

#### input `InappropriateContentInput`

Details passed along when Flagging a Post

- `category`: `String` — 'inappropriate', 'offensive', 'abusive', 'illegal', 'safety', 'spam', or 'other'
- `linkData`: `LinkDataInput` — Link to the Post
- `reason`: `String` — The custom text for why someone flagged the post

#### input `InviteInput`

- `emails`: `[String]`
- `userIds`: `[ID]` — Existing Hylo users to invite by id (their account email is used)
- `assignAdministrator`: `Boolean` — Assign Administrator system role when the invitation is used
- `groupRoleId`: `ID` — Group role ID to assign when the invitation is used

#### input `GroupInviteLinkInput`

- `accessCode`: `String!` — 10 letter or digit code shown in the form before it is saved
- `name`: `String`
- `grantAccess`: `Boolean` — When false, the link only lets people see a Restricted group
- `grantedRoleIds`: `[ID]` — Role ids assigned when someone joins through a link that grants access

#### input `GroupInviteLinkUpdateInput`

- `name`: `String`
- `grantAccess`: `Boolean` — When false, the link only lets people see a Restricted group
- `grantedRoleIds`: `[ID]` — Role ids assigned when someone joins through a link that grants access

#### input `LinkDataInput`

A link to a Post or a Person who has been Flagged

- `id`: `ID` — Person or Post ID
- `slug`: `String` — Group slug
- `type`: `String` — 'member' or 'post'

#### input `MeInput`

For updating your settings or profile

- `avatarUrl`: `String` — The URL of your avatar image
- `bannerUrl`: `String` — The URL of the banner image on your profile
- `bio`: `String` — Personal bio text
- `contactEmail`: `String` — Email address made visible on your profile
- `contactPhone`: `String` — Phone number made visible on your profile
- `email`: `String` — Account email address used to log in. Changing it sends a verification to the new address, and it only takes effect once verified (see pendingEmail)
- `facebookUrl`: `String` — The URL to your Facebook profile
- `isProfilePublic`: `Boolean` — Whether your profile is publicly viewable without logging in
- `linkedinUrl`: `String` — The URL to your LinkedIn profile
- `location`: `String` — String representing your physical location
- `locationId`: `ID` — ID of the geocoded location object representing your physical location in the world
- `name`: `String` — Full name
- `newNotificationCount`: `Int` — Number of unread notifications
- `password`: `String` — Login password
- `settings`: `UserSettingsInput` — User settings
- `tagline`: `String` — Short tagline
- `twitterName`: `String` — Twitter handle
- `url`: `String` — A website URL for your profile

#### input `MembershipInput`

Data related to membership in a Group

- `acceptAgreements`: `Boolean` — Accept or reject all current agreements of the group
- `lastViewedAt`: `Date` — update the lastViewedAt
- `navOrder`: `Int` — The order of this membership in the global nav drawer - having a value means it is pinned to the top in order, null means it is not pinned
- `newPostCount`: `Int` — Number of new Posts in the Group since you last looked at it
- `questionAnswers`: `[QuestionAnswerInput]` — Answers to the join questions for this Group
- `settings`: `MembershipSettingsInput` — Settings related to membership in a Group

#### input `MembershipSettingsInput`

Personal settings for a User's relationship to a Group

- `digestFrequency`: `String` — How often this person wants to receive the email digest about new posts and comments in this group: daily, weekly, or never
- `joinQuestionsAnsweredAt`: `Date` — When the member filled out the join questions
- `postNotifications`: `String` — How this person wants to receive notifications for post in this group: none, important, or all
- `sendEmail`: `Boolean` — Whether to receive email notifications for this Group
- `showJoinForm`: `Boolean` — Whether to show the form displayed upon first viewing a Group this Person just joined
- `sendPushNotifications`: `Boolean` — Whether to mobile push notifications for this Group

#### input `MessageInput`

Data for updating a message in a direct message thread

- `attachments`: `[AttachmentInput]`
- `createdAt`: `Date` — When this thread was created
- `messageThreadId`: `String` — The ID of the thread to update/edit
- `text`: `String` — The content of the message

#### input `MessageThreadInput`

Data for a direct MessageThread

- `participantIds`: `[String]` — The IDs of the participants in the thread

#### input `ModerationActionInput`

Data for a ModerationAction

- `agreements`: `[ID]`
- `anonymous`: `Boolean`
- `groupId`: `ID`
- `platformAgreements`: `[ID]`
- `postId`: `ID`
- `text`: `String`

#### input `PointInput`

A geographic point

- `lat`: `Float`
- `lng`: `Float`

#### input `PostInput`

A Post

- `acceptContributions`: `Boolean` — NOT USED RIGHT NOW. Whether this post can accept financial contributions
- `announcement`: `Boolean` — Was this post marked an announcement by a group moderator?
- `budget`: `String` — Budget for project or submission posts
- `completionAction`: `String` — The action that people can take to complete this post. 'button', 'comment', 'reaction', 'selectMultiple', 'selectOne', 'text', or 'uploadFile'
- `completionActionSettings`: `JSON` — The options associated with the completion action. e.g. for 'selectMultiple', this is an array of options
- `details`: `String` — The body of the post
- `donationsLink`: `String` — Link to a donation page, only used for projects only right now
- `endTime`: `Date` — When this post "ends". Used for events, resources, projects, requests and offers right now
- `eventInviteeIds`: `[ID]` — IDs of people to invite to the event
- `fileUrls`: `[String]` — URLs for file attachments
- `fundingRoundId`: `ID` — The FundingRound this post is a submission to
- `groupIds`: `[ID]` — IDs of the groups to post to
- `imageUrls`: `[String]` — URLs of images in the post. A flat list of URL strings, or a nested list such as Zapier line items (those are flattened). URLs already on Hylo storage are attached immediately; other URLs (e.g. Airtable attachments) are downloaded and stored on our S3 in the background.
- `isAnonymousVote`: `Boolean` — Whether who votes on this proposal is visible or not
- `isPublic`: `Boolean` — Whether this post is publicly visible (outside of the groups it is posted to)
- `isStrictProposal`: `Boolean` — A strict proposal cannot be edited in all the ways a casual proposal can be
- `linkPreviewId`: `String` — ID of a LinkPreview to show in the post
- `linkPreviewFeatured`: `Boolean` — Whether LinkPreview appears full size above post or smaller below
- `skipLinkPreview`: `Boolean` — When true, do not auto-generate a link preview from URLs in the post (the author removed it in the editor)
- `silent`: `Boolean` — Create the post without notifying members: no email, push, in-app notification, unread badge, live update, Slack, or outbound Zapier. Only a steward of every destination group may set this. Cannot be combined with announcement.
- `localId`: `String` — Temporary id passed in from the client to identify the post when it is created, for optimistically updating the UI
- `location`: `String` — Full location string
- `locationId`: `ID` — Id to location object with geocoded location deatils
- `meetingLink`: `String` — Video call link for online or hybrid events (Zoom, Meet, Jitsi, etc.)
- `markAsReadTopicName`: `String` — Topic name of the chat room the user is currently viewing. When set, that topic follow's last_read_post_id is always updated regardless of new_post_count.
- `memberIds`: `[ID]` — People to add as members to a project type Post
- `projectManagementLink`: `String` — Link to a project management tool or service. Only used for Projects right now
- `proposalOptions`: `[ProposalOptionInput]` — The options for this proposal
- `votingMethod`: `String` — The type of proposal: 'poll', 'survey', 'vote', or 'proposal'
- `quorum`: `Int` — Percentage of all group members that must vote for a proposal to complete
- `startTime`: `Date` — When this post "starts". Used for events, resources, projects, requests and offers right now
- `timezone`: `String` — The timezone of the post
- `title`: `String` — The title text for the post
- `topicNames`: `[String]` — Topics to add to the post
- `trackId`: `ID` — The track this post is associated with
- `viewId`: `ID` — The GroupView to add this post to (e.g. track-actions / collection / funding-round-submissions)
- `type`: `String` — Post type: 'action', 'chat', 'discussion', 'event', 'offer', 'project', 'proposal', 'request', 'resource', 'submission'

#### input `ProposalOptionInput`

- `id`: `ID`
- `text`: `String` — Required: Title of the option
- `emoji`: `String` — Optional: emoji to represent the option
- `color`: `String` — Optional: hexcode color to represent the option

#### input `QuestionInput`

A Question to be asked before joining a Group

- `id`: `Int`
- `questionId`: `Int` — The ID of the question when editing one
- `text`: `String` — Content of the question

#### input `QuestionAnswerInput`

Answer to a Question

- `answer`: `String` — Answer content
- `questionId`: `Int` — Question ID

#### input `ReactionInput`

Inputs for emoji reactions to posts and comments

- `emojiFull`: `String` — The full emoji, with any modifiers (eg: for skin). UTF-16 (JS default) encoding for an emojis code-points (like '\uD83D\uDE00')
- `entityId`: `ID` — id for the entity associated with the reactions
- `entityType`: `String` — What type of entity a reaction is associated with. Currently only 'post' or 'comment'

#### input `ResponsibilityInput`

Input for creating group responsibilities that don't have spceific power on the platform but convey information about a group member

- `name`: `String` — The name of the responsibility
- `description`: `String` — The description of the responsibility

#### input `SavedSearchInput`

A SavedSearch on the Map

- `boundingBox`: `[PointInput]` — The geographic bounding box
- `context`: `String` — 'groups' for a Group specific search, 'all' to search for posts in all logged in user's groups, or 'public' to search all public posts
- `groupSlug`: `String` — The group to search (optional)
- `name`: `String` — The name of the saves search
- `postTypes`: `[String]` — Only include posts that match these post types
- `searchText`: `String` — Only include posts that match this search text in title or description
- `topicIds`: `[ID]` — Only include posts that match one of these topics
- `userId`: `ID` — The user creating the search

#### input `TrackInput`

- `accessControlled`: `Boolean` — Whether this track requires purchased access (paid content)
- `actionDescriptor`: `String` — The word used in this track to describe an action
- `actionDescriptorPlural`: `String` — The word used in this track to describe multiple actions
- `completionMessage`: `String` — The message shown when a user completes this track
- `completionRoleId`: `ID` — The role/badge that is awarded when a user completes this track
- `groupId`: `ID` — The Track space group (tracks.group_id / groups.track_id)
- `postIds`: `[ID]` — The posts (actions) for the track

#### input `RoleSelectionInput`

- `id`: `ID!` — The ID of the group role

#### input `FundingRoundInput`

- `allowLateJoiners`: `Boolean` — Whether people who join during the voting phase receive tokens and can vote
- `allowSelfVoting`: `Boolean` — Whether participants can vote on their own submissions
- `criteria`: `String` — Criteria for submitting projects/submissions
- `groupId`: `ID` — The group that this funding round belongs to
- `hideFinalResultsFromParticipants`: `Boolean` — Whether to hide final voting results from participants
- `maxTokenAllocation`: `Int` — Maximum tokens a voter can allocate
- `minTokenAllocation`: `Int` — Minimum tokens a voter can allocate
- `requireBudget`: `Boolean` — Whether a budget is required for submissions
- `showRealtimeSubmissions`: `Boolean` — Whether members can see every submission during the submissions phase
- `showRealtimeVotes`: `Boolean` — Whether to show running vote totals during the voting phase
- `submissionDescriptor`: `String` — The term used to describe a submission to the round
- `submissionDescriptorPlural`: `String` — The plural term used to describe submissions to the round
- `submissionsCloseAt`: `Date` — The date submissions close (optional)
- `submissionsOpenAt`: `Date` — The date submissions open (optional)
- `submitterRoles`: `[RoleSelectionInput]` — The roles or badges required to add a submission to the round
- `totalTokens`: `Int` — Total tokens available to allocate
- `tokenType`: `String` — Token type used for voting/allocation
- `voterRoles`: `[RoleSelectionInput]` — The roles/badges required to vote on submissions
- `votingClosesAt`: `Date` — When voting opens (optional)
- `votingOpensAt`: `Date` — When voting closes (optional)
- `votingMethod`: `String` — Voting method to be used (current options: token_allocation_constant, token_allocation_divide)

#### input `UserSettingsInput`

- `alreadySeenTour`: `Boolean` — Has this person seen the tour that displays the first time someone logs in
- `toursSeen`: `[String]` — Ids of in-app guided tours this person has completed or dismissed
- `colorScheme`: `String` — Display mode preference: auto, light, or dark
- `commentNotifications`: `String` — How this person wants to receive notifications about new comments on posts they're following? email, push, both, or none
- `dmNotifications`: `String` — How this person wants to receive notifications about Direct Messages: email, push, both, or none
- `lastViewedMessagesAt`: `String` — When person wants last viewed their Direct Messages
- `locale`: `String` — Locale preferences for the user
- `mapBaseLayer`: `String` — The most recent map base later viewed by this person
- `globalNavStyle`: `String` — Global navigation position: sidebar or tabs
- `groupNavStyle`: `String` — Override for group menu layout: group-default, two-column, or one-column
- `rsvpCalendarSub`: `Boolean` — Whether to enable RSVP calendar subscription
- `signupInProgress`: `Boolean` — Whether this person has finished viewing the welcome wizard after first signing up
- `stackGroups`: `Boolean` — Whether to show subgroups stacked on their parent in global nav (default false / flat)
- `independentSpaceMenu`: `Boolean` — Whether space clicks replace the ContextMenu with the space's views (default false / nested in group menu)
- `streamChildPosts`: `String` — Include child group posts in user's stream
- `streamViewMode`: `String` — The most recent stream view mode used by this person: cards, list, grid, bigGrid
- `streamSortBy`: `String` — The most recent stream sort used by this person: 'created', 'reactions', or 'updated'
- `streamPostType`: `String` — The most recent stream post type filter used by this person
- `theme`: `String` — Color scheme / palette name (e.g. default, forest, ocean)
- `unifiedEmailDigest`: `Boolean` — When true, daily group digests are combined into one daily email and weekly group digests into one weekly email

#### QuerySet types

All have `total: Int`, `hasMore: Boolean`, `items: [T]`: `AffiliationQuerySet`, `AgreementQuerySet`, `CommentQuerySet`, `ContentAccessQuerySet`, `EventInvitationQuerySet`, `FundingRoundQuerySet`, `GroupQuerySet`, `GroupViewQuerySet`, `GroupExtensionQuerySet`, `GroupJoinQuestionQuerySet`, `GroupJoinQuestionAnswerQuerySet`, `GroupRelationshipQuerySet`, `GroupRelationshipInviteQuerySet`, `GroupToGroupJoinQuestionQuerySet`, `GroupRoleQuerySet`, `ResponsibilityQuerySet`, `GroupTopicQuerySet`, `InvitationQuerySet`, `JoinRequestQuerySet`, `MembershipQuerySet`, `MembershipAgreementQuerySet`, `MembershipGroupRoleQuerySet`, `MembershipCommonRoleQuerySet`, `MessageQuerySet`, `MessageThreadQuerySet`, `ModerationActionQuerySet`, `NotificationQuerySet`, `PersonQuerySet`, `PersonConnectionQuerySet`, `PostQuerySet`, `PostUserQuerySet`, `ReactionQuerySet`, `SavedSearchQuerySet`, `SearchResultQuerySet`, `SkillQuerySet`, `TopicQuerySet`, `TopicFollowQuerySet`, `TrackQuerySet`, `UserTransactionQuerySet`, `ProposalOptionQuerySet`, `ProposalVoteQuerySet`, `OfferingSubscribersQuerySet`

---

## 6. REST / HTTP endpoints (outside GraphQL)

All under the API host. Policies (`config/policies.js`) default to deny (`'*': false`); each controller action is explicitly opened. Body parsing: JSON and urlencoded (raw for the Stripe webhook).

### 6.1 Session & login (`SessionController`; policy: open unless noted)
| Method & path | Action | Request | Response |
|---|---|---|---|
| `POST /noo/login` | `create` | `email`, `password` | 200 `{}` + session cookie; 422 with error text (e.g. invalid credentials, rate-limit message). |
| `POST /noo/login/native` | `nativeLogin` | `email`, `password` | 200 token pair `{access_token, refresh_token, token_type:'Bearer', expires_in}`; reactivates self-deactivated account; 422 on error. No cookie. |
| `POST /noo/session/from-token` | `fromToken` | `Authorization: Bearer <access token>` | 200 `{success:true}` + fresh cookie session (session regenerated); 401 `{error}` when missing/invalid. |
| `GET|POST /noo/login/jwt` | `createWithJWT` (policy `checkJWT`) | `token` (query or Bearer), `n` (next URL) | GET: redirect to same-origin `n` or password settings page; POST: `{success:true}`; with `X-Hylo-Token-Auth: 1` → token pair. Invalid JWT: GET redirect `/login?error=invalid-link`, POST 403. If no session after policy: GET with `n` redirects anyway, else 422 `Invalid link, please try again`. |
| `GET|POST /noo/login/token` | `createWithToken` | `n` | Legacy links: GET redirect to safe `n` or `/login`; POST 422 `Link expired`. |
| `GET /noo/login/google` | `startGoogleOAuth` | `returnDomain`, `authContext` saved in session | Redirect to Google (scope email, profile). |
| `GET /noo/login/google/oauth` | `finishGoogleOAuth` | OAuth callback | Renders `popupDone` (posts `{error, provider, context}` to opener at `returnDomain`) or JSON if `Accept: application/json`. Error strings: `no user`, `no email`, `linked-account-in-use`. |
| `GET|POST /noo/login/google-token/oauth` | `finishGoogleTokenOAuth` | `access_token` (Google) | As above; with `X-Hylo-Token-Auth: 1` → token pair. |
| `POST /noo/login/apple/oauth` | `finishAppleOAuth` | `{nonce, user, identityToken, fullName:{givenName,familyName}}` | 200 user JSON (cookie session) or token pair (`X-Hylo-Token-Auth: 1`); 401 `Invalid Apple identity token`; 422 on other errors. |
| `GET /noo/login/facebook`, `/facebook/oauth`, `/facebook-token/oauth`; `GET /noo/login/linkedin`, `/linkedin/oauth`, `/linkedin-token/oauth` | Facebook/LinkedIn | — | Legacy; non-functional (no Facebook strategy; LinkedIn finish actions misnamed — see 01 §17). |
| `GET /noo/logout` | `destroy` | — | Destroys session, redirect `/`. |
| `DELETE /noo/session` | `destroySession` | — | `{}`. |

### 6.2 OAuth / OpenID Connect provider
- `GET /.well-known/openid-configuration` → discovery (routed to `/noo/oauth/.well-known/openid-configuration`).
- `/noo/oauth/{auth, token, token/introspection, token/revocation, me, jwks, session/end, reg, request, device, device/auth, backchannel}` — oidc-provider endpoints (01 §5.5). CORS open to any origin.
- Interaction (`api/hooks/oidcRoutes.js`): `GET /noo/oidc/interaction/:uid` (redirects to web `/oauth/login/:uid?name=` or `/oauth/consent/:uid?name=&missingScopes=`), `POST /noo/oidc/:uid/login` (`email`, `password`; or existing session) → `{redirectTo}` / 403 `{error}` (`Invalid request, please start over` when the prompt is not login), `POST /noo/oidc/:uid/confirm` → `{redirectTo}` / 500 `{error:'Invalid Request'}`, `POST /noo/oidc/:uid/abort` → `{redirectTo}` with `access_denied` / `End-User aborted interaction`.

### 6.3 Users (`UserController`)
| Method & path | Policy | Behaviour |
|---|---|---|
| `POST /noo/user` | `checkClientCredentials`; requires `req.api_client.super` else 403 | Server-to-server user creation. Params `name`, `email`, `groupId`, `isAdministrator`/`isCoordinator`. Existing user: invites to group if not a member (subject/message from client's `invite_subject`/`invite_message` or localized defaults), returns `{message}` (`User already exists, invite sent to group <name>` / `User already exists, and is already a member of this group` / `User already exists`). New user: created inactive + unverified, queued `Email.sendFinishRegistration` with verify link; returns `{id, name, email}`; 422 `{error}` on failure. See `apps/backend/APIs.md`. |
| `GET /noo/user/notification-settings?token=` | open; JWT with `action: 'notification_settings'` | Returns `{digestFrequency (default 'daily'), dmNotifications ('both'), commentNotifications ('both'), postNotifications ('important'), sendEmail, sendPushNotifications, hasDevice:false}`; 403 `{error:'Unauthorized'}` on bad token. Used by the email unsubscribe page. |
| `POST /noo/user/update-notification-settings?token=` | same | Body `unsubscribeAll` (sets digest `never`, dm/comment/post `none`, and all memberships `sendEmail=false`, `sendPushNotifications=false`) or any of `digestFrequency`, `dmNotifications`, `commentNotifications`, `postNotifications`, `allGroupNotifications` (`none`/`email`/`push`/`both` → membership `sendEmail`/`sendPushNotifications` for all groups). Returns `{message:'Notification settings updated'}`. |
| `POST /noo/user/subscribe` / `unsubscribe` | socket + session | Join/leave personal socket room (unsubscribe bug: leaves `groups/<userId>`). |

### 6.4 Real-time socket routes (socket.io virtual requests)
`POST /noo/group/:groupId/subscribe|unsubscribe|typing`, `POST /noo/post/:postId/subscribe|unsubscribe|typing` — see 01 §6.1. Non-socket requests → 400.

### 6.5 Posts & comments via HTTP
| Method & path | Policy | Behaviour |
|---|---|---|
| `POST /noo/post/:postId/update-last-read` | `sessionAuth`, `checkAndSetPost` | Marks post read for user (`posts_users.last_read_at`); `{}`. |
| `POST /noo/hook/comment` | open; SendGrid signature check | Inbound email reply (SendGrid Inbound Parse, multipart). Decodes `to` reply address → post/user; ignores auto-responders (returns 200 `{message:'Autoresponder email detected, no comment created.'}`); creates a comment with `created_from: 'email'`. Errors: 422 `Invalid reply address: <to>`, `valid token, but post not found`, `valid token, but user not found`, `{error:'Invalid Content-Type'}`; 403 `{error:'Invalid signature'}`. |
| `GET|POST /noo/hook/postForm` | `checkAndDecodeToken` (`token` = `Email.formToken`) | Creates a post from a digest email form: `type` ∈ `offer` (title prefix `I'd like to share`), `request` (`I'm looking for`), `resource` (`I'd like to share`), `intention` (`I'd like to create`); `name`, `description`; topic = type; `created_from: 'email_form'`. Duplicate with same title by same user within 5 minutes → redirect to existing post. Inactive group → redirect root with `?notification=Your post was not created. That group no longer exists.&error=1`. Success → redirect to post URL. |
| `GET|POST /noo/hook/batchCommentForm` | `checkAndDecodeToken` | Digest email batch reply form: params `post-<postId>` (markdown) create comments on each post; redirects to the group with a notification. |

### 6.6 Uploads & exports
| Method & path | Policy | Behaviour |
|---|---|---|
| `POST /noo/upload` | `sessionAuth` | See 01 §11. Response `{type, id, url, attachmentType}`. |
| `GET /noo/export/group?groupId=&datasets[]=members` | `sessionAuth`; Administration in group | Queues `ExportService.exportMembers` (CSV emailed to requester). 400 `Please specify group ID` / `Please specify datasets to export`; 403 `{error:'No access'}`; `{}` on success. |
| `POST /noo/export/user-account` | `sessionAuth` | Queues account export; `{message:"Account export started. You will receive an email when it's ready."}`. |

### 6.7 Payments
| Method & path | Policy | Behaviour |
|---|---|---|
| `POST /noo/stripe/webhook` | open; Stripe signature (`STRIPE_WEBHOOK_SECRET`; bypass when `STRIPE_WEBHOOK_BYPASS_SIGNATURE=true`) | Raw JSON body. Handles `account.updated`, `checkout.session.completed`, `product.updated`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created|updated|closed`. Idempotent via `stripe_webhook_processed_events`. Errors 400 `{error:'Missing webhook payload'|'Invalid webhook payload'|'Missing signature'|'Invalid signature'}`, 500 `{error:'Webhook secret not configured'}`. Details: 23. |
| `GET /noo/stripe/checkout/success` | open | Post-checkout landing (`session_id`): fulfils access as fallback then redirects to the frontend; 400/500 JSON on errors. |
| `GET /noo/stripe/checkout/cancel` | open | Redirects to frontend cancel URL. |
| `GET /noo/stripe/health` | open | Health check JSON. |
| `GET|POST /noo/payment/registerStripe` | `sessionAuth` | Legacy Stripe OAuth (`code`) for project contributions; redirects to payment settings `?registered=success|error`. |

### 6.8 Mobile app support (`MobileAppController`, open)
- `GET /noo/mobile/check-should-update?ios-version=|android-version=` → `{success:true}` if version ≥ `MINIMUM_SUPPORTED_MOBILE_VERSION`; otherwise `{type:'force'|'suggest', title, message, link}` (`A new version of the app is available` / `An update is available`; message `The version you are using is no longer up to date. Please go to the <App Store|Play Store> to update.`; link `IOS_APP_STORE_URL`/`ANDROID_APP_STORE_URL`). Non-semver versions force-update, except `test-suggest`.
- `GET /noo/mobile/auto-update-info` → static `{type:'force', title:'A new version of the app is available', message:'The version you are using is no longer compatible with the site. Please go to the App Store now to update', iTunesItemIdentifier:'1002185140'}`.
- `POST /noo/mobile/logerror` (`error`, `extra`) → reports to Sentry; `{success:true}`.

### 6.9 Misc
- `POST /noo/cookie-consent` (open): body `consentId` (UUID, required), `settings` (JSON object, required), `version` (string), `ipAddress`, `userAgent` (default request UA); upserts `cookie_consents` (links current user if logged in); `{success:true, consentId}`; 400 with messages `Missing settings`, `Invalid consentId format - must be a valid UUID`, `Settings must be a valid JSON object`, `Version must be a string`, …
- `GET /noo/group/:groupSlug/murmurations` (open): Murmurations profile JSON of the group if it publishes one (`settings.publish_murmurations_profile`), else 403.
- Calendar feeds are **static S3 files**, not API routes: group events `<AWS_S3_CONTENT_URL>/<prefix>/group/<id>/calendar-<token>.ics` (`Group.eventCalendarUrl`), personal RSVPs `<…>/user/<id>/calendar-<token>.ics` (`Me.rsvpCalendarUrl`). See 14.

### 6.10 Admin (`isAdmin` = user id in `HYLO_ADMINS`)
- `GET /noo/admin/login` → Google admin OAuth; `GET /noo/admin/login/oauth` → on success redirect `/noo/admin/kue` (failure → `/noo/admin/login`); `GET /noo/admin/logout` → redirect `/`.
- `GET /noo/admin/login-as/:userId` → logs in as that user (`providerKey 'admin'`), redirect `/app`.
- `GET /noo/admin/raw-metrics` → per-group event streams (users, posts, comments created in last 3 months).
- `GET /noo/admin/stripe-analytics` → dispute/refund analytics for groups with Stripe accounts (90-day and 7-day windows).
- `POST /noo/admin/stripe-sales-pause` (`groupId`, `paused`, `reason`) → sets `groups.stripe_sales_paused`, `_at`, `_reason`; 400 `groupId is required`, 404 `Group not found`.
- `/noo/admin/kue` (UI) and `/noo/admin/kue/api` (Kue JSON API).

### 6.11 Web server routes (apps/web, not API)
`/noo/*` proxy; marketing pages proxied from `PROXY_HOST`; SPA fallback with OG tags for `/post/:id` (01 §4.2). The SPA's own routes are in [06-app-shell-navigation.md](06-app-shell-navigation.md).

---

## 7. Edge cases & known quirks
- `vote(postId, isUpvote)` is declared but unresolved (deprecated; use `reactOn`).
- `reactivateMe` resolver reads `currentUserId` from the args object (bug) — the mutation cannot identify the user.
- `createStripeConnectedAccount` resolver forwards `existingAccountId` which is not in the schema.
- `deleteGroupRelationship.relationshipType`, `deactivateMe.id`, `groups.filter`, `people.filter` are accepted but ignored.
- `people.order` is documented as "Number of People to return" (copy-paste error); it is the sort order.
- `group(updateLastViewed: true)` marks the group viewed (membership `lastReadAt`, badge sync); failures are swallowed.
- `notifications(resetCount)` resets the counter after fetching.
- The `subscriptions-debug` header lets a client receive its own events (testing aid).
- Anonymous calls to authenticated-only fields return `null` silently.

## 8. Docs vs. code
- `apps/backend/APIs.md` and public developer docs describe API-key access; code requires OIDC client-credentials JWTs from clients with `role: 'super'` for any API-client access (non-super clients get 403).
- Schema comments call `updateGroupSettings` "steward only" and `removeMember` "Moderator only"; enforcement is by responsibilities (Administration / Remove Members) — see 12.
- `unlinkAccount` comment lists providers 'facebook', 'twitter', 'linkedin'; twitter is not a supported provider and Facebook/LinkedIn login are non-functional.

## 9. Source references
`apps/backend/api/graphql/{schema.graphql,index.js,makeSchema.js,makeSubscriptions.js,makeModels.js,filters.js,touchLastActiveAt.js}`, `apps/backend/api/graphql/mutations/*`, `apps/backend/api/graphql/queries/*`, `apps/backend/lib/graphql-bookshelf-bridge/*`, `apps/backend/config/{routes,policies,customMiddleware}.js`, `apps/backend/api/controllers/*`, `apps/backend/api/policies/*`, `apps/backend/api/hooks/oidcRoutes.js`, `apps/backend/APIs.md`, `packages/urql/makeUrqlClient.js`.
