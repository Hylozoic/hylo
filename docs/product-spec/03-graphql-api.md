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
