# 19 — Notifications, email & push

## 1. Overview

Hylo tells people about things that happen to them or in their groups through four delivery channels:

| Channel | What it is | Where it shows up |
|---|---|---|
| **In‑app** | A row in the bell ("Activity") popover, plus an unread badge on the bell | Web global nav (and TopNav), Electron desktop (also as OS notifications), mobile app (which renders the web app — see [25-mobile-desktop.md](25-mobile-desktop.md)) |
| **Instant email** | One SendWithUs template email per event (new post, mention, join request, …) | Recipient's inbox; many are reply‑able ("reply by email" → comment) |
| **Digest email** | Batched emails: group daily/weekly digest, hourly chat‑room digest, 10‑minute comment digest, 10‑minute direct‑message digest, saved‑search digest | Recipient's inbox |
| **Push** | OneSignal push to every device logged in as the user (Expo / React Native app) | Phone lock screen; tap deep‑links into the app |

Everything starts with an **Activity**: a row recording "*actor* did *something* that *reader* may care about, for these *reasons*". Each Activity fans out into zero to three **Notification** rows, one per medium (in‑app, push, email) that the reader's settings permit. A background job sends unsent Notification rows. Comments on followed posts, chat messages and direct messages are mostly delivered by **digests** rather than instant email.

Users control delivery with (a) per‑group membership settings (`sendEmail`, `sendPushNotifications`, `postNotifications`, `digestFrequency`), (b) account‑level settings (`dm_notifications`, `comment_notifications`, `unified_email_digest`), and (c) per‑thread mute for DMs. The settings UI is specified in [05-user-settings.md](05-user-settings.md); this module specifies what each setting *does* to delivery. Queue/worker/provider infrastructure is in [01-architecture.md](01-architecture.md).

Global kill switches (environment variables, see §2.7): email and push are only actually sent when `EMAIL_NOTIFICATIONS_ENABLED=true` / `PUSH_NOTIFICATIONS_ENABLED=true`, or when the reader is a "tester".

---

## 2. Concepts & data

### 2.1 `activities` table (model `Activity`)

| Column | Type | Meaning |
|---|---|---|
| `id` | bigint PK | |
| `reader_id` | → users | Who should be told |
| `actor_id` | → users, nullable | Who did it (null for system events such as funding‑round phase transitions/reminders) |
| `post_id` | → posts, nullable | Related post (event, project, submission…) |
| `comment_id` | → comments, nullable | Related comment |
| `parent_comment_id` | → comments, nullable | For replies (set by comment activities) |
| `contribution_id` | → contributions, nullable | Legacy "added as contributor" |
| `project_contribution_id` | → project_contributions, nullable | Stripe donation to a project |
| `group_id` | → groups, nullable | Group the activity is "in" |
| `other_group_id` | → groups, nullable | Second group (group‑to‑group relationships; parent group of a space for join requests / invitations) |
| `track_id` | → tracks, nullable | |
| `funding_round_id` | → funding_rounds, nullable | |
| `meta` | jsonb | `{ reasons: string[], phase?: string, reminderType?: string }` |
| `unread` | boolean, default true | Read state shown in the popover. Indexed `(reader_id, unread)` |
| `created_at`, `updated_at` | timestamps | |

**Reasons.** `meta.reasons` is an array because several activities for the same reader produced in one batch are merged into one row (see §5.1). A reason string is either a bare label (`mention`) or a label with a suffix:

- `newPost: <groupId>` and `announcement: <groupId>` (suffix = group id, note the colon + space).
- `fundingRoundPhaseTransition:<phase>` (no space).
- `groupChildGroupInviteAccepted:<context>:<memberType>`, `groupParentGroupJoinRequestAccepted:<context>:<memberType>`, `groupPeerGroupInviteAccepted:peer:moderator` where `<context>` ∈ `parent|child|peer` (which side of the relationship the reader is on) and `<memberType>` ∈ `moderator|member` (steward or not).
- Legacy (no longer produced): `chat: <topic>`, `tag: <topic>`.

Matching is always by **prefix** (`/^label/`).

**Priority reason / `action`.** When an activity has several reasons, the single "action" used to choose text, URL and email/push template is the first label in this fixed priority list that matches any reason by prefix (`Notification.priorityReason`):

```
donation to, donation from, announcement, eventInvitation, mention, commentMention,
newComment, newContribution, chat, tag, newPost, follow, followAdd, unfollow,
postFulfilled, postUnfulfilled, joinRequest, approvedJoinRequest, groupInvitation,
groupChildGroupInviteAccepted, groupChildGroupInvite,
groupParentGroupJoinRequestAccepted, groupParentGroupJoinRequest,
groupPeerGroupInviteAccepted, groupPeerGroupInvite, memberJoinedGroup,
trackCompleted, trackEnrollment,
fundingRoundNewSubmission, fundingRoundPhaseTransition, fundingRoundReminder
```

No match → `''` (empty action). `voteReset` is **not** in this list (see §8).

Note the order puts `…Accepted` before the un‑suffixed label, because `groupChildGroupInvite` is a prefix of `groupChildGroupInviteAccepted`.

The GraphQL field `Activity.action` is this priority reason.

### 2.2 `notifications` table (model `Notification`)

| Column | Meaning |
|---|---|
| `id` | PK |
| `activity_id` | → activities |
| `user_id` | Reader (copied from activity) |
| `medium` | integer enum `MEDIUM`: `0` = InApp, `1` = Push, `2` = Email |
| `created_at`, `updated_at` | |
| `sent_at` | Set when processed (also set for media that turned out to have nothing to send) |
| `failed_at` | Set when sending threw; retried after 1 hour |
| `processing_started_at` | Claim marker for concurrent workers; stale after 30 minutes |

The in‑app list is the set of `medium = 0` notifications for the user. Notifications older than **1 month** are deleted by the daily cron (`Notification.removeOldNotifications`), so the in‑app history is at most ~30 days. Activities are not purged.

`Notification.TYPE` constants (used by settings checks): `mention, chat, TagFollow, newPost, comment, contribution, followAdd, follow, unfollow, postFulfilled, postUnfulfilled, welcome, joinRequest, approvedJoinRequest, groupInvitation, groupChildGroupInvite, groupChildGroupInviteAccepted, groupParentGroupJoinRequest, groupParentGroupJoinRequestAccepted, groupPeerGroupInvite, groupPeerGroupInviteAccepted, message, announcement, 'donation to', 'donation from', trackCompleted, trackEnrollment, fundingRoundNewSubmission, fundingRoundPhaseTransition, fundingRoundReminder`. Only `message` and `comment` are used for user‑level setting checks.

### 2.3 `push_notifications` table (model `PushNotification`)

One row per push actually attempted (audit log).

| Column | Meaning |
|---|---|
| `user_id` | Recipient |
| `alert` | Text, truncated to **255** chars before saving |
| `path` | App path (pathname + query string) to open on tap |
| `badge_no` | iOS badge number = `users.new_notification_count + unseenThreadCount` at time of send |
| `queued_at`, `sent_at` | Timestamps |
| `disabled` | true if push was suppressed by env flags (row still written) |
| `platform`, `device_id` | Legacy; `getPlatform()` defaults to `ios_macos`. The `devices` table / `Device` model is **deprecated** (comment: "no longer used, remove after 2025‑08‑26"); targeting is by OneSignal external id = Hylo user id. |

### 2.4 User fields & settings relevant to notifications

| Field | Where | Values / default | Effect |
|---|---|---|---|
| `users.new_notification_count` | column | int, default 0 | Count of in‑app notifications delivered since the user last opened the bell. Incremented by 1 per in‑app notification sent; reset to 0 by `notifications(resetCount: true)`. Shown as the bell badge and included in the iOS push badge. |
| `settings.dm_notifications` | users.settings jsonb | `none` \| `email` \| `push` \| `both`; new users `both` | Direct‑message push (instant) and DM email digest |
| `settings.comment_notifications` | users.settings | same; new users `both` | Comment push (instant, for `newComment`/`commentMention`) and comment email digest |
| `settings.unified_email_digest` | users.settings | boolean, default absent/false | Combine all per‑group daily digests into one email, and all weekly into one |
| `settings.digest_frequency`, `settings.post_notifications` | users.settings | legacy | Only written by the token‑based Manage Notifications page; **not read by any delivery code** (see §8) |
| `settings.last_viewed_messages_at` | users.settings | ISO time | Used to compute `unseenThreadCount` |
| `settings.locale` | users.settings | e.g. `en`, `es-ES` | Locale for email templates and push text |

### 2.5 Group membership settings (`group_memberships.settings` jsonb, camelCase keys)

| Key | Values | Default on join | Effect on delivery |
|---|---|---|---|
| `sendEmail` | boolean | `true` | If false for every membership relevant to an activity → no instant email. Also required (`= true`) to receive the group digest and the chat digest. |
| `sendPushNotifications` | boolean | `true` | If false for every relevant membership → no push |
| `postNotifications` | `none` \| `important` \| `all` | `all` | Gates *new post* and *chat* activities on **all** media incl. in‑app (see §5.2). `important` = announcements and mentions only. Also gates the hourly chat digest. |
| `digestFrequency` | `daily` \| `weekly` \| `never` | group's `settings.default_digest_frequency` if `weekly`, else `daily` | Which group digest (if any) the member receives |

Defaults are applied by `User.joinGroup`, `Group.addMembers` and the `rejoinGroup` mutation. The bulk mutation `updateAllMemberships` can set `sendEmail`, `sendPushNotifications`, `postNotifications`, `digestFrequency` on every membership at once.

Group‑level: `groups.settings.default_digest_frequency` (`daily`|`weekly`) — default for new members.

### 2.6 Per‑thread / per‑post state (`posts_users`)

| Column | Effect |
|---|---|
| `following` / `active` | The user is a *follower* of the post → receives `newComment` activities and comment digests. Post authors, commenters and people mentioned are added as followers automatically (module 13). |
| `last_read_at` | Comments/messages older than this are excluded from digests; DM push is skipped if the message is older than last read. |
| `muted_at` | Muted DM thread (or post): no DM push and no digest for that post. |

### 2.7 Environment flags

| Variable | Effect |
|---|---|
| `EMAIL_NOTIFICATIONS_ENABLED` | `'true'` → instant emails, comment/DM digests, group digests and chat digests are sent to everyone. Otherwise only to testers. |
| `PUSH_NOTIFICATIONS_ENABLED` | `'true'` → push sent to everyone. Otherwise only to testers **and** only when `PUSH_NOTIFICATIONS_TESTING_ENABLED='true'`. |
| `PUSH_NOTIFICATIONS_TESTING_ENABLED` | See above. |
| `HYLO_TESTER_IDS` | Comma‑separated user ids treated as testers. Testers are also any user with a row in `email_enabled_testers`. |
| `NODE_ENV=test` or `DISABLE_EMAIL_SENDING=1` | No email is ever sent (logged instead). |
| `SENDWITHUS_KEY` | Email provider API key. |
| `EMAIL_SENDER` | Default From address; default From name `The Team at Hylo`. |
| `INBOUND_EMAIL_DOMAIN`, `INBOUND_EMAIL_SALT` | Reply‑by‑email address encoding. |
| `SENDGRID_INBOUND_PARSE_PUBLIC_KEY` | Verifies inbound email webhook signature (fails open if unset). |
| `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY` | Push provider credentials. |

Demo addresses (`lib/demo/addresses`, sandbox/demo users) never receive email.

---

## 3. Routes / entry points

| Entry point | Description |
|---|---|
| Bell icon in the **global nav** rail (tooltip **Activity**, `data-tour='activity'`) | Opens the notifications popover (§4.1). Second item in the rail after My Home. |
| Bell icon in **TopNav** (tabs nav style) | Same popover; **no badge** is rendered in this variant. |
| Bell icon in group header (`GroupNotificationsPopover`) | Opens *this group's* notification settings (not the list). Copy: aria‑label **Notification Settings**, heading **Notification Settings for {{name}}**. Spaces show only the post‑notification setting (`postsOnly`). See [05-user-settings.md](05-user-settings.md). |
| `/my/notifications` | Notification **settings** tab of user settings (module 05). There is no full‑page notifications list on web. |
| `/notifications?token=…&name=…&u=…&expand=account&ctt=…` | Logged‑out **Manage Notifications** page reached from every email's settings/unsubscribe link (§4.4). Rendered by the non‑auth router. |
| `/my/invitations` | Target of `groupInvitation` notifications. |
| Email links | Post, comment, group, profile, join‑request, relationship, track and funding‑round URLs (§5.4). |
| Reply‑to address `reply-<token>@<INBOUND_EMAIL_DOMAIN>` | Inbound email → comment (§5.8). |
| REST `GET /noo/user/notification-settings?token=` / `POST /noo/user/update-notification-settings` | Token‑authenticated settings for the Manage Notifications page. |
| REST `POST /noo/hook/comment` | SendGrid Inbound Parse webhook. |
| Push tap | Opens `https://www.hylo.com<path>` inside the mobile app (§5.7). |
| Electron OS notification click | Focuses window and navigates to `urlForNotification(notification)`. |

---

## 4. UX specification

### 4.1 Notifications popover (web, Electron, mobile WebView)

Component: `NotificationsDropdown` (lazy‑loaded; a plain Bell icon is shown as the Suspense fallback).

**Trigger.** Global‑nav tile with the `Notifications` badged icon on a dark tile. When `me.newNotificationCount > 0` the tile gets an accent border (`border-3 border-accent`) and a small badge showing **`-`** (a dot‑like dash, scaled 70%) at its top‑left. The count itself is never shown on the bell (unlike Messages, which shows `unseenThreadCount` as a number).

**Popover.** Radix popover, `side='right'`, `align='start'`, offset 8px. Desktop: fixed width **300px**, list height `calc(100dvh - 100px)` with its own scroll. Compact/mobile layout: full available width/height, no rounding, no offset.

**Header row** (left→right):
- **Recent** tab (default) — accent text, underlined (2px accent bottom border) when active.
- **Unread** tab — client‑side filter of the already loaded list to `activity.unread === true`.
- **Mark all as read** — right‑aligned link; calls `markAllActivitiesRead` (optimistic: every loaded activity becomes read immediately).

**List rows** (`NotificationItem`, `<li>`):
- Layout: horizontal flex; left = round avatar (medium `RoundImage`, 12px left padding); right = column with title, body and timestamp; bottom border; vertical padding 12px; text‑sm.
- Avatar: `actor.avatarUrl`, except `memberJoinedGroup` and the three funding‑round actions which use `group.avatarUrl` (see §8 — the list query does not request `group.avatarUrl`, so these show the default avatar).
- Title: `titleForNotification` (HTML, bold when unread; values HTML‑escaped before interpolation).
- Body: `bodyForNotification` (HTML).
- Timestamp: `TextHelpers.humanDate(createdAt)` ("2 hours ago" style), text‑xs at 50% muted.
- Read rows: muted text, `bg-darkening/10`, 80% opacity, 100% on hover. Unread rows: `bg-white/10`, full opacity, foreground text, bold title.
- Click: if unread → `markActivityRead(activity.id)` (optimistic). Then navigate to `urlForNotification(notification)`; Cmd/Ctrl‑click opens a new tab. The popover closes. On mobile devices the nav menu is also closed.

**Loading / empty.**
- While the first page loads and nothing is cached: `LoadingItems` skeleton.
- Empty list: `NoItems` with **No notifications** (Recent) or **No unread notifications** (Unread).
- Infinite scroll: a `ScrollListener` at the bottom of `#notifications-scroll-list` fetches the next page (`first: 20, offset: <loaded count>`) while `hasMore` is true; a loading skeleton is appended while pending.

**Fetching & badge reset.**
- On mount of the nav (page load) the first page is fetched with `resetCount: false` (badge kept).
- Every time the popover **opens** (and no fetch is pending) the first page is re‑fetched with `resetCount: true`: the server zeroes `new_notification_count`, and the client sets `me.newNotificationCount = 0` (and Electron's dock badge to 0).
- Order: server `order: 'desc'` by notification id; client sorts by numeric id descending.

**Real‑time arrival.** The server emits socket event `newNotification` to the user's room (`userRoom(userId)`) whenever an in‑app notification is sent, with payload:

```json
{
  "id": "<notification id>",
  "activity": {
    "id": "...", "created_at": "...", "unread": true, "meta": { "reasons": [...] },
    "action": "<priority reason>",
    "actor": { "id", "name", "avatarUrl" },
    "comment": { "id", "text" },
    "group": { "id", "name", "slug" },
    "otherGroup": { "id", "name", "slug" },
    "post": { "id", "title", "details", "type", "topics": [{ "id", "name" }] },
    "track": { "id", "space": { "name": "<track display name>" } } | null,
    "fundingRound": { "id", "group": { "name": "<round display name>" } } | null
  }
}
```

The web `SocketListener` stores it as a Notification model (so it appears at the top of the list) and increments `me.newNotificationCount` by 1. In Electron it also sets the dock/taskbar badge to the new count and shows an OS notification (§4.5). The same event is also published on Redis channel `updates:<userId>` for the GraphQL `updates`/`allUpdates` subscriptions (used by the mobile app).

**Catch‑up.** When the tab becomes visible again (`visibilitychange` → visible), the app runs `CheckForNewNotifications` (`me { newNotificationCount unseenThreadCount }`) to refresh both badges.

There is no document‑title unread count: the tab title is always `Hylo` (or `Hylo Demo` in sandbox).

### 4.2 In‑app notification copy (title / body / link)

Strings are i18n keys (English shown; translated into all six locales). `{{postSummary}}` = post title, or if empty the post details converted from HTML to text (links' hrefs dropped) and truncated to **76** chars. `{{text}}` for comments = comment HTML→text truncated to 76 chars. `<strong>` tags are rendered.

| action | Title | Body | Link (`urlForNotification`) |
|---|---|---|---|
| `newPost` | `New post in <strong>{{name}}</strong>` (group name) | `<strong>{{name}}</strong> wrote: "{{text}}"` (text = postSummary) | Post URL in the activity group (space‑aware) |
| `announcement` | `New announcement in <strong>{{groupName}}</strong>` | same as newPost | Post URL |
| `mention` | `<strong>{{name}}</strong> mentioned you` | same as newPost | Post URL |
| `chat` | `New chat in <strong>{{name}}</strong>` (group name). Legacy `chat: <topic>` reason → `New chat in {{groupName}} <strong>#{{name}}</strong>` | same as newPost | Post URL (chat posts route into the chat view with `postId`) |
| `tag` (legacy) | `New post in {{groupName}} <strong>{{name}}</strong>` with `#topic` | same as newPost | Post URL |
| `newComment` | `New comment on "<strong>{{postSummary}}</strong>" in {{groupName}}` | `<strong>{{name}}</strong> wrote: "{{text}}"` (comment) | Post URL with `commentId` |
| `commentMention` | `<strong>{{name}}</strong> mentioned you in a comment on <strong>{{postSummary}}</strong>` | same as newComment | Post URL with `commentId` |
| `eventInvitation` | `<strong>{{name}}</strong> invited you to an event` | `<strong>{{name}}</strong> invited you to: "{{postSummary}}"` | Post URL |
| `joinRequest` | `New Join Request` | `<strong>{{name}}</strong> asked to join {{groupName}}`; for a space: `<strong>{{name}}</strong> asked to join {{spaceName}} in {{groupName}}` | Group: `/groups/<slug>/settings/requests`; space: `/groups/<parent>/spaces/<local>/requests` |
| `approvedJoinRequest` | `Join Request Approved` | `<strong>{{name}}</strong> approved your request to join {{groupName}}` | `/groups/<slug>` |
| `groupInvitation` | `New Invitation` | `<strong>{{name}}</strong> has invited you to join them in {{groupName}}`; space: `… to join them in space {{spaceName}} in {{groupName}}` | `/my/invitations` |
| `memberJoinedGroup` | `New Member joined <strong>{{groupName}}</strong>` | `<strong>{{name}}</strong> joined your group. Time to welcome them in!` | Member profile in group: `/groups/<slug>/members/<actorId>` |
| `groupChildGroupInvite` | `Your group has been invited` | `<strong>{{groupName}}</strong> has invited <strong>{{name}}</strong> to join it` (group = parent, name = child) | `/groups/<parentSlug>/settings/relationships` (see §8) |
| `groupChildGroupInviteAccepted` | `New Group Joined` | `<strong>{{groupName}}</strong> has joined <strong>{{otherGroupName}}</strong>` | `/groups/<otherGroupSlug>` |
| `groupParentGroupJoinRequest` | `Group Requesting to Join` | `<strong>{{groupName}}</strong> has requested to join <strong>{{otherGroupName}}</strong>` | `/groups/<parentSlug>/settings/relationships` |
| `groupParentGroupJoinRequestAccepted` | `New Group Joined` | same as childGroupInviteAccepted | `/groups/<groupSlug>` |
| `groupPeerGroupInvite` | `Your group has been invited to form a peer relationship` | `<strong>{{groupName}}</strong> has invited <strong>{{otherGroupName}}</strong> to form a peer relationship` | `/groups/<otherGroupSlug>/settings/relationships` |
| `groupPeerGroupInviteAccepted` | `Peer Groups Connected` | `<strong>{{groupName}}</strong> has connected with <strong>{{otherGroupName}}</strong> as peer groups` | `/groups/<groupSlug>` |
| `donation to` | `<strong>You</strong> contributed to a project` | `<strong>{{name}}</strong> contributed {{amount}} to "{{postSummary}}"` with name `You`, amount = `contributionAmount/100` | none (no case → undefined) |
| `donation from` | `<strong>{{name}}</strong> contributed to your project` | `<strong>{{name}}</strong> contributed {{amount}} to "{{postSummary}}""` (sic, doubled quote in key) | none |
| `trackCompleted` | `Track <strong>{{trackName}}</strong> Completed` | `<strong>{{name}}</strong> completed the track` | Track URL (`trackUrl(track.id, { groupSlug, space })`) |
| `trackEnrollment` | `New Enrollment in Track <strong>{{trackName}}</strong>` | `<strong>{{name}}</strong> enrolled in the track` | Track URL |
| `fundingRoundNewSubmission` | `New Submission to Funding Round <strong>{{fundingRoundName}}</strong>` | `<strong>{{name}}</strong> submitted "{{postSummary}}"` | Funding round URL, tab `funding-round-submissions` |
| `fundingRoundPhaseTransition` | `Funding Round <strong>{{fundingRoundName}}</strong>` | by `meta.phase`: submissions → `Submissions are now open`; discussion → `Submissions have closed and discussions are open`; voting → `Voting is now open`; completed → `Voting has closed and the round has ended` | Funding round URL (default tab) |
| `fundingRoundReminder` | `Funding Round <strong>{{fundingRoundName}}</strong> reminder` | by `meta.reminderType`: `Submissions close in 1 day` / `Submissions close in 3 days` / `Voting closes in 1 day` / `Voting closes in 3 days` | Funding round URL, tab `funding-round-submissions` |
| `postFulfilled` | `<strong>{{name}}</strong> closed your post` | `"<strong>{{postSummary}}</strong>"` | Post URL |
| `postUnfulfilled` | `<strong>{{name}}</strong> reopened your post` | same | Post URL |
| `newContribution`, `follow`, `followAdd`, `unfollow`, `voteReset`, `''` | (null — empty row) | (null) | (none) |

`{{name}}` = actor name. `{{fundingRoundName}}` = the funding‑round space's name. `{{trackName}}` = the track's display name (track space name).

Post URL construction (`groupPostUrlOpts` + `primaryPostUrl`): if the activity group is a space (has `parentGroup.slug` and `type === 'space'` or `parentId`), the URL is nested `/groups/<parentSlug>/spaces/<localSpaceSlug>/…/post/<id>`; otherwise `/groups/<slug>/…/post/<id>` using the group's `homeRoute`. If the activity has no group, the first of `post.groups` is used.

### 4.3 Notification settings UI

Specified in [05-user-settings.md](05-user-settings.md) (tab `/my/notifications`, plus the per‑group bell popover). Effects of each control:

| Control (copy) | Stored as | Delivery effect |
|---|---|---|
| Global → **Messages** (Email / Push toggles) | `users.settings.dm_notifications` (`none/email/push/both`) | Push for each new DM (§5.6) and the DM email digest (§5.5.4) |
| Global → **Comments on followed posts** | `users.settings.comment_notifications` | Push for `newComment` / `commentMention`; comment email digest (§5.5.3) |
| **Unified email digest** switch | `users.settings.unified_email_digest` | One combined daily and one combined weekly digest instead of one per group (§5.5.1) |
| **Receive group notifications by** (Email / Push) | membership `sendEmail` / `sendPushNotifications` | Gates instant email / push for all group‑scoped activities; `sendEmail` also gates group digest and chat digest |
| **Receive new post notifications for**: **No Posts** / **Important Posts (Announcements & Mentions)** / **Every Post** | membership `postNotifications` = `none` / `important` / `all` | Gates newPost/chat activities on all media incl. in‑app; gates chat digest |
| **Receive an email digest summarizing group activity**: Daily / Weekly / Never | membership `digestFrequency` | Which group digest is sent |
| "Default group notifications" row | Bulk `updateAllMemberships` across all memberships (confirm dialog) | Same as above for every group |

### 4.4 Manage Notifications page (logged‑out, from email links)

Route `/notifications` (non‑auth layout). Reads `token` and `name` from the query string. Helmet title **Manage Notifications | Hylo**.

Layout:
- H1 **Hi {{userName}}**; paragraph **You can change your Hylo notification settings here**.
- While loading: **Loading...**
- Form (each a label + select):
  1. **Send me a digest of new posts** — Daily / Weekly / Never → `digestFrequency`.
  2. **Send notifications for each new post in your group?** — **No Posts** / **Announcements & Mentions only** / **Every Post** → `postNotifications`.
  3. **Send notifications about comments on posts you are following via** — **None** / **Email** / **Mobile App** / **Email & Mobile App** (`none/email/push/both`) → `commentNotifications`.
  4. **Send notifications for direct messages via** — same options → `dmNotifications`.
  5. **Send notifications for announcements and topic posts for all my groups via** — **Existing per Group Settings** (`keep`, default) + the four options → `allGroupNotifications`.
  - Checkbox **Unsubscribe from all** — when checked, all selects are disabled and display `never`/`none`.
  - Button **Save Settings** (green). No success message is shown.
- Load: `GET /noo/user/notification-settings?token=` returns `{ digestFrequency (users.settings.digest_frequency || 'daily'), dmNotifications (|| 'both'), commentNotifications (|| 'both'), postNotifications (|| 'important'), sendEmail (any membership has sendEmail), sendPushNotifications (any membership has push), hasDevice: false }`.
- Save: `POST /noo/user/update-notification-settings` with `{ token, unsubscribeAll, digestFrequency, dmNotifications, commentNotifications, postNotifications, allGroupNotifications }`. Server:
  - `unsubscribeAll` → user settings `digest_frequency: 'never', dm_notifications: 'none', comment_notifications: 'none', post_notifications: 'none'`; else snake‑cases and saves the four provided values into `users.settings`.
  - Membership bulk update (all of the user's memberships, active or not): `sendEmail=false` if unsubscribeAll or `allGroupNotifications ∈ {none, push}`; `sendEmail=true` if `∈ {email, both}`. `sendPushNotifications=false` if unsubscribeAll or `∈ {none, email}`; `true` if `∈ {push, both}`. `keep` → memberships unchanged.
- Token: a Hylo JWT with `sub = user id`, `action: 'notification_settings'`, expiry **30 days** from email send. Invalid/expired/wrong action → HTTP 403 `{ error: 'Unauthorized' }`.

### 4.5 Desktop (Electron)

- `window.electron.setBadgeCount(n)` → `app.setBadgeCount(n)`: set to new count on every `newNotification` socket event; set to 0 when the popover reset fetch completes.
- `window.electron.showNotification(notification)` → native `Notification` with title/body from the same presenter functions (translated with the desktop i18n instance, HTML tags stripped). Clicking restores/shows/focuses the main window and sends `navigate-to` with `urlForNotification`. On error, falls back to `{ title: notification.title, body: notification.body }` (both undefined in practice).
- macOS: notification permission requested on startup.

### 4.6 Mobile app push UX

- On login the app requests notification permission (if it can) and calls `OneSignal.login(currentUser.id)` so the OneSignal *external id* = Hylo user id. On logout `OneSignal.logout()`.
- Foreground pushes are **suppressed** (`foregroundWillDisplay` → `preventDefault`) — users only see pushes while the app is backgrounded.
- When the app returns to foreground, all delivered notifications are cleared from the tray (`OneSignal.Notifications.clearAll()`).
- Tap: reads `additionalData.path`; opens `https://www.hylo.com<path>` via the app's linking store (falls back to `launchURL`). Older app versions use `app_url = hyloapp:/<path>`.
- iOS badge set to `badge_no` (`ios_badgeType: 'SetTo'`).
- More detail in [25-mobile-desktop.md](25-mobile-desktop.md).

---
## 5. Business rules & side effects

### 5.1 Pipeline: activity → notifications → delivery

1. **Producer** code (post creation, comment creation, join request, …) builds a list of plain activity descriptors `{ reader_id, actor_id, post_id?, comment_id?, group_id?, other_group_id?, track_id?, funding_round_id?, project_contribution_id?, reason, meta? }` and calls `Activity.saveForReasons(list, trx)`.
2. **Merge by reader** (`mergeByReader`): descriptors with the same `reader_id` become one activity; their `reason`s are concatenated into `meta.reasons` (in input order); for `actor_id`, `group_id`, `other_group_id` the *last* non‑null value wins; other fields come from the first descriptor. Extra `meta` keys (`phase`, `reminderType`) are preserved.
3. For each merged activity, `Activity.createWithNotifications` inserts the activity and then `createNotifications`: loads relations, computes the list of media (`generateNotificationMedia`, §5.2) and inserts one `notifications` row per medium (`sent_at = null`).
4. After all are saved, a `Notification.sendUnsent` job is queued (Kue, default delay **2 s**).
5. **`sendUnsent`** atomically claims up to **200** rows (`FOR UPDATE SKIP LOCKED`) where `sent_at IS NULL`, `created_at > now() − 6 hours`, not failed in the last hour, and not claimed in the last 30 minutes; sets `processing_started_at`. Loads them with all relations and processes them **sequentially**. If 200 were claimed, re‑enqueues itself with a 1 s delay. Notifications older than 6 hours that were never sent are abandoned.
6. **`Notification.send`** per row:
   - If `shouldBeBlocked()` (the reader has blocked — or been blocked by — the post author, the comment author or the actor; `BlockedUser.blockedFor` is bidirectional, see [12-roles-permissions-moderation.md](12-roles-permissions-moderation.md)) **or** `isForGroupsReaderLeft()` (post/comment activity and the reader has since left every group of the post) → the notification row is **deleted** and nothing is sent.
   - Medium Push → `sendPush()` if push is enabled globally or the reader is a tester.
   - Medium Email → `sendEmail()` if email is enabled globally or reader is a tester.
   - Medium InApp → `users.new_notification_count += 1`, then socket broadcast `newNotification` and Redis publish `updates:<userId>` (§4.1).
   - Then `sent_at = now`, `processing_started_at = null`. (Push/email rows are marked sent even if the env flag skipped them, or the action had no template.)
   - Any exception: logged to Sentry, `failed_at = now` (retried in ≥1 h if still within the 6 h window).

### 5.2 Choosing media (`Activity.generateNotificationMedia`)

Let `reason = meta.reasons[0]` and *relevant memberships* = the reader's active memberships in the activity's groups (`Activity.groupIds`): post's groups if `post_id`; else comment's post's groups if `comment_id`; else `[group_id, other_group_id]` (or `[group_id]`).

1. `groupInvitation` (first reason) → always `[InApp, Push]` (invitee is usually not a member yet; the invitation email itself is sent by the invitation system, see [10-joining-invitations.md](10-joining-invitations.md)).
2. If the reader has **no** relevant membership **and** is a *former* member of one of the groups (inactive membership, no active one) → **no notifications at all**.
3. `emailable` = relevant memberships with `sendEmail` true; `pushable` = relevant memberships with `sendPushNotifications` true.
4. If any reason starts with `chat` → `emailable = false` (chats are emailed only via the hourly chat digest).
5. If any reason starts with `chat` or `newPost` → compute the *strongest* `postNotifications` among relevant memberships (`all` > `important` > `none`). `sendNotification` = `all`, or `important` **and** some reason starts with `announcement` or `mention`. Otherwise `sendNotification = true`.
6. Media: Email if `emailable` non‑empty and `sendNotification`; Push if `pushable` non‑empty and `sendNotification`; InApp if `sendNotification`.

Consequences:
- In‑app notifications are only suppressed by `postNotifications` (for new posts/chats) — `sendEmail`/`sendPushNotifications` never affect in‑app.
- A reader with **no** relevant membership who was never a member (e.g. a donor to a public project, a follower of a public post, a mentioned non‑member) gets InApp only (no email/push), except `groupInvitation`.
- Mentions inside a new post are merged with that reader's `newPost` reason, so a member with `postNotifications = none` receives **nothing** for being mentioned in a new post (see §8).

### 5.3 Catalogue of activity reasons

Columns: **Trigger** (code path), **Readers**, **Media** (subject to §5.2), **Email** (template + subject + sender), **Push text** (English; all have `de/es/fr/hi/pt` versions in `apps/backend/lib/i18n/*.js`) and **Push path**. Push text is cut at 255 chars.

#### 5.3.1 Post‑related

| Reason | Trigger | Readers | Email | Push text → path |
|---|---|---|---|---|
| `newPost: <gid>` | Post created (not silent) — queued job `Post.createActivities`. Not for notice types (`chat_activity`), `action`, `submission`, or `chat` posts (chat uses `chat`). | Every active member of every group the post is in, except the author and former members. One descriptor per (reader, group) so a reader in two destination groups gets two `newPost:` reasons merged. | **Post_Notification** (`tem_cPYpXw7d9pCdm6M8QmtPvPGG`). Subject: `New post in {{group_name}}: {{post_title}}` (or `New post in {{group_name}} #{{topic}}: {{title}}` for chat‑type posts with a topic). Body: post card with status text `posted a <type>` / `posted an event` / `posted in #topic` / `announced`; "Reply to this email to comment on the post, or" + button **Reply in the Group** (post URL); link **Turn off notifications for this post** (`unfollow_url`). From: `<author name> (via Hylo)`, from/reply‑to = post reply address. `group_name` = group name, or `Parent > Space` for spaces. | `{{person}} posted "{{postName}}" in {{groupName}}` + ` #{{firstTag}}` if the post has topics → post path |
| `announcement: <gid>` | Same job; added in addition to `newPost:` when `post.announcement` is true **and** the author has the `Administration` responsibility in that group. | Same members | Same template with `data.announcement = true` (card status `announced`). Tracking pixel event `Announcement`. | `{{person}} sent an announcement "{{postName}}" to {{groupName}}` → post path |
| `mention` | (a) new post: each `@mention` in the post details (`RichText.getUserMentions`); (b) post edited: newly mentioned users who were not already followers (`updateFollowers` in `post/util.js`), who are also added as followers. | Mentioned users (minus author, minus former members) | **Post_Mention_Notification** (`tem_77d99tkvmTBJt7rD83DD4XRP`). Subject `{{group_name}}: {{post_user_name}} mentioned you in "{{post_title}}"`. Card status `mentioned you`; "Reply to this email to comment on the post, or" + **Reply in the Group**. From `<author> (via Hylo)`, reply‑to post reply address. | `{{person}} mentioned you in post "{{postName}}" in {{groupName}}` → post path |
| `chat` | Post of type `chat` created (chat room message, see [17-chat-rooms.md](17-chat-rooms.md)). | Every active member of the chat's group(s) except author/former members (no group suffix on reason). | **Never instant email** (forced off). Covered by hourly chat digest (§5.5.2). | `{{person}} chatted "{{postName}}" in {{groupName}}` (the `#topic` suffix code path is unused because `firstTag` is not passed) → chat view `?postId=` |
| `eventInvitation` | (a) Event created with invitees — included in `Post.createActivities` from `event_invitations` rows that exist when the job runs; (b) `invitePeopleToEvent` mutation (always, for every id passed, even if already invited). | Invitees (minus inviter for (a)) | **Event_Invite_Notification** (`tem_8pt9FjFkxRGQ7XYhRRW3BBrK`). Subject `{{group_name}}: {{post_user_name}} invited you to "{{post_title}}"`. From `<inviter> (via Hylo)`, reply‑to post reply address. Group = first group of the post. | `{{actorName}} invited you to "{{postName}}"` → post path in first group |
| `voteReset` | Proposal options changed when options already existed (`updateProposalOptions`) — all votes are deleted. | Everyone who had voted (author not excluded) | none | Intended `{{person}} changed the options for proposal: "{{postName}}" in {{groupName}}. This has reset the votes` — but unreachable (see §8). In‑app row renders empty. |
| `postFulfilled` / `postUnfulfilled` | A moderator (not the author) marks a request/offer/resource/project complete or reopens it (`fulfillPost`/`unfulfillPost` mutations). | Post author | **Moderation_Action** (`tem_BXYk4Hxt74R9jH3pkdGfqbJM`) with `subject` = `Your post was closed` / `Your post was reopened`, `body` = `{{actor}} closed your post "{{post}}" in group {{group}}. \n` (or `reopened`) + post URL, `post_url`. | `{{actor}} closed your post "{{postName}}"` / `{{actor}} reopened your post "{{postName}}"` → post path |
| `donation to` | Stripe payment to a project (`processStripeToken` → `createStripePaymentNotifications`). | The contributor | Donation "to" template `tem_MyJccrgp83dCcb9jtP6pRfG3` (source not in repo); data `project_title, project_url, contribution_amount (dollars), contributor_name/avatar/profile_url`. From `<project title> (via Hylo)`. | `You contributed ${{amount}} to "{{postName}}"` → project post (no group) |
| `donation from` | Same | Project creator | `tem_vc664DPVTSTY6JSmpcjt8xTb`, same data | `{{actor}} contributed ${{amount}} to "{{postName}}"` |
| `newContribution` | `Contribution.create` when a post is fulfilled with `contributorIds` — **no caller passes contributorIds** (dead). | Contributor | none | `You have been added as a contributor to the request "{{summary}}"` |
| `fundingRoundNewSubmission` | Submission post created in a funding round (not silent) → `FundingRound.notifyStewardsOfSubmission`. | Members with `Administration` in the round's group, except the submitter | **Funding_Round_Submission** (`tem_dMt4Dwm493JvYdXGWBpTxxR7`). Subject `New submission to {{funding_round_title}}: {{post_title}}`. From group sender name. | `{{actor}} submitted "{{summary}}" to "{{roundTitle}}"` → funding round space home |

#### 5.3.2 Comment‑related (no instant email — see comment digest §5.5.3)

| Reason | Trigger | Readers | Push text → path |
|---|---|---|---|
| `newComment` | Comment created on a non‑DM post (`createComment` → `comment.createActivities`, synchronous after commit). Followers include anyone newly mentioned and the commenter (added before activities are computed). | All followers of the post except the commenter | `{{person}}: "{{blurb}}" (in "{{postName}}")`; if the comment has media: `{{person}} sent an image`. Blurb = comment HTML→text truncated to 140. Only if user `comment_notifications ∈ {push, both}`. → post path `?commentId=<id>` |
| `commentMention` | Same, for users `@mentioned` in the comment text | Mentioned users (self not excluded — §8) | `{{person}} mentioned you: "{{blurb}}" (in "{{postName}}")`; same comment‑setting check |

Both carry `group_id` = the comment's group and `parent_comment_id`.

#### 5.3.3 Membership & invitations

| Reason | Trigger | Readers | Email | Push text → path |
|---|---|---|---|---|
| `joinRequest` | `JoinRequest.create` (restricted group / space). `other_group_id` = parent group for spaces. | Everyone with the `Add Members` responsibility in the group (for spaces: computed via `Responsibility.fetchForGroup`, which includes parent‑group holders), except the requester | **Join_Request_Notification** (`tem_Dkvtfv9HGgYgjqD4KCXPPdy6`). Subject `{{requester_name}} asked to join {{group_name}}` (group_name = `Space in Parent` for spaces). Body: "{{requester}} wants to join {{group}}!", one card per join question with the latest answer, button **Respond to their Request** (`settings_url` = join requests page). Clickthrough adds `check_join_requests=1`. From group sender name. | `{{actor}} asked to join {{groupName}}` / `… asked to join {{group}} in {{parent}}` → group `settings/requests` (space: `/spaces/<local>/requests`) |
| `approvedJoinRequest` | `JoinRequest.accept` (moderator approves). | Requester | **Join_Request_Approval_Notification** (`tem_JjPbSJqj4wbJqSydqw49VrfT`). Subject `Your request to join {{group_name}} has been approved`. `group_url` = group home route. | `{{actor}} approved your request to join {{groupName}}` → `/groups/<slug>` |
| `groupInvitation` | `InvitationService.create` (invite by email) when the email belongs to an existing Hylo user other than the inviter. `other_group_id` = parent for space invites. | That user | none from this pipeline (the invitation email `tem_GTwXKBfkTpTHRfHpmJWbYr9d` is sent separately — module 10) | `{{actor}} has invited you to join them in {{groupName}}` / `… in space {{group}} in {{parent}}` → `/my/invitations` |
| `memberJoinedGroup` | First time a member finishes the join flow (`updateMembership` with `showJoinForm: false` and no prior join) → `Group.afterFinishedJoining`. Skipped for spaces with `auto_add_members`. | `group.moderators()` = members holding responsibility id **3** (`Remove Members` in the seed order) | **Member_Joined_Group** (`tem_rvbqYrfMK8VQkqCPJXBRd6KR`). Subject `A new member has joined {{group_name}}: {{member_name}}`. Body "Your group is growing!", member/group pills, join Q&A cards, button **Welcome {{member_name}} to the group** (group URL). From `<member name> (via Hylo)`. | `New member has joined {{group}}: {{actor}}` → member profile in group |

#### 5.3.4 Group relationships (module 09/11)

Reason is chosen by invite `type`: `ParentToChild (0)` → `groupChildGroupInvite`; `ChildToParent (1)` → `groupParentGroupJoinRequest`; `PeerToPeer (2)` → `groupPeerGroupInvite`. Activities carry `group_id = fromGroup`, `other_group_id = toGroup`.

| Reason | Readers | Email (template, subject) | Push text → path |
|---|---|---|---|
| `groupChildGroupInvite` | `toGroup.moderators()` (resp. id 3) | **Group_Child_Group_Invite_Notification** `tem_7tcVCp6WrxFSRRt9qxfmMm9K`: `{{child_group_name}} has been invited to join {{parent_group_name}}`; From `<actor> from <parent> (via Hylo)` | `{{actor}} invited your group {{child}} to join their group {{parent}}` → child `settings/relationships#invites` |
| `groupParentGroupJoinRequest` | `toGroup` (parent) moderators | **Group_Parent_Group_Request_to_Join_Notification** `tem_PVd9yJtHHBVK4jhm3fpdVBMV`: `{{child_group_name}} is requesting to join {{parent_group_name}}` | `{{actor}} is requesting to add their group {{child}} as a member of your group {{parent}}` → parent `settings/relationships#join_requests` |
| `groupPeerGroupInvite` | `toGroup` moderators | **Group_Peer_Group_Invite_Notification** `tem_8SjfcXpkCgdCVxrBXd9KD8YY`: `{{child_group_name}} has been invited to connect to {{parent_group_name}}` (child = toGroup, parent = fromGroup; `description` = invite message) | `{{actor}} invited your group {{to}} to form a peer relationship with {{from}}` → toGroup `settings/relationships#invites` |
| `groupChildGroupInviteAccepted:<ctx>:<type>` | On accept (`createAcceptNotifications` job): all members of both groups — except a hidden group contributes only its stewards (`stewards()` = resp ids 1,3,4) when it is the joining child. `<type>` = `moderator` if a steward of their side. | **Group_Child_Group_Invite_Accepted_Notification** `tem_VYrh6YFTB3X6yq66Rm6qMtgD`: if `memberOf == 'child'` → `Your group {{child}} has joined {{parent}}`, else `{{child}} has joined your group {{parent}}`. From `The Team at Hylo`. | parent/moderator: `{{actor}} accepted your invite of their group {{child}} to join your group {{parent}}`; parent/member: `The group {{child}} just joined your group {{parent}}!`; child/moderator: `{{actor}} accepted your invite of your group {{child}} to join their group {{parent}}`; child/member: `Your group {{child}} has joined {{parent}}. You can now join {{parent}}!` |
| `groupParentGroupJoinRequestAccepted:<ctx>:<type>` | Same rules | **…Request_to_Join_Accepted_Notification** `tem_mm6hdXBxRc9dckCp6C386rGG`, same subjects | parent/moderator: `{{actor}} accepted a request to add {{child}} to your group {{parent}}`; parent/member: `The group {{child}} just joined your group {{parent}}!`; child/moderator: `Your group {{child}} has been accepted as a member of {{parent}} by {{actor}}`; child/member: `Your group {{child}} has joined {{parent}}.` |
| `groupPeerGroupInviteAccepted:peer:moderator` | Stewards of both groups only | **Group_Peer_Group_Invite_Accepted_Notification** `tem_W7Vm9KqfKHBvTDJvJYDkHHK4`: `Your group {{child_group_name}} has been connected to {{parent_group_name}}`. From `The Team at Hylo`. | `{{actor}} accepted the peer relationship between {{from}} and {{to}}` → `/groups/<toGroup>` |

Accepted pushes route to the *other* group (`parent` readers → child group; `child` readers → parent group).

#### 5.3.5 Tracks & funding rounds (modules 21, 22)

| Reason | Trigger | Readers | Email | Push text |
|---|---|---|---|---|
| `trackEnrollment` | `enrollInTrack` creates a new enrollment | Members with `Administration` in the track's parent group (`group_id` = parent) | **Track_Enrollment** `tem_tFrcKvJvTRVYMbDYSrTHwVfV`: `New enrollment in track {{track_name}}`; From `<enrollee> (via Hylo)` | `Track enrollment: "{{trackName}}" was enrolled in by {{actor}}` → `/tracks/<id>` |
| `trackCompleted` | `Post.checkCompletedTrack` after the last action of a track is completed by an enrolled member (once) | Same | **Track_Completed** `tem_G69qyjJ6xVHxMJMqcwp98dfF`: `Track {{track_name}} completed by {{completer_name}}`; From `The Team at Hylo` (localized) | `Track completed: "{{trackName}}" was completed by {{actor}}` |
| `fundingRoundPhaseTransition:<phase>` | Every‑10‑min cron `FundingRound.checkPhaseTransitions` moves a round to `submissions` / `discussion` / `voting` / `completed` and queues `sendPhaseTransitionNotifications`. `meta.phase` set; no actor. | All round participants (`round.users()`) | **Funding_Round_Phase_Transition** `tem_RpRYTwYhTpRmy3Y6tcrCGMwB`: subject `{{funding_round_title}}: {{transition_text}}`; transition_text: `Submissions are now open` / `Submissions are now closed` / `Voting is now open` / `Voting is now closed`; button: submissions → `Add your submission` (if the reader can submit; else `View the Round`), discussion → `Discuss the submissions`, voting → `Vote in the round` (if can vote; else `View the Round`), completed → `View the results`. | `{{title}}: Submissions are now open` / `…Submissions have closed and discussions are open` / `…Voting is now open` / `…Voting has closed and the round has ended` → round space |
| `fundingRoundReminder` | Daily cron `FundingRound.sendReminderNotifications` for rounds (active, published group) whose `submissions_close_at` / `voting_closes_at` falls on the calendar day 3 days or 1 day from now. Dedup: skipped if a reminder of the same `reminderType` for the round exists in the last 2 days (3‑day) / 12 hours (1‑day). `meta.reminderType` ∈ `submissionsClosing3Days`, `submissionsClosing1Day`, `votingClosing3Days`, `votingClosing1Day`. | Participants; filtered to those who can submit (if submitter roles set) / vote (if voter roles set); 1‑day submission reminder further limited to participants who have **not** submitted. | Same template as phase transition; `transition_text` = reminder text (`Submissions close in 1 day`, …), button for `submissions` or `voting` phase, `action_url` = submissions view | `{{title}}: Submissions close in 3 days` etc. |

### 5.4 Instant email: common rules

- Provider: **SendWithUs** (`api.send`) with per‑template IDs; templates are Liquid/Jinja with `{% trans %}` blocks, sources in `scripts/i18n/i18n-templates/<Name>_i18n/` (see `docs/SENDWITHUS_I18N_WORKFLOW.md`). Each send passes `locale` (normalized to full form e.g. `en-US`, `es-ES`) so SendWithUs picks the translated version.
- Default options: From `{ address: EMAIL_SENDER, name: 'The Team at Hylo' }`, headers `Precedence: bulk`, `X-Auto-Response-Suppress: All`. Digests use template version `Spaces`.
- **Recipient** = `users.email`. There is **no verified‑email check** and **no throttling/rate limiting** for notification emails (beyond batching). Demo addresses are skipped.
- **Locale** = reader's `settings.locale`, falling back to the actor's locale.
- **Sender display names** (`senderNameViaHylo`): `<name> (via Hylo)` with the suffix localized (`emailSenderViaHyloSuffix`); not double‑applied. `senderNameForGroup` uses `Parent > Space` for spaces.
- **Reply address**: post‑related emails (new post, announcement, mention, event invitation, comment and DM digests, every post in digests) set `reply_to` (and for some `address`) to `reply-<enc>@<INBOUND_EMAIL_DOMAIN>` where `<enc> = PlayCrypto.encrypt(INBOUND_EMAIL_SALT + postId + '|' + userId)`.
- **Clickthrough tracking**: every link gets `?ctt=<email_type>&cti=<readerId>&ctcn=<context name>` (types: `post_email`, `announcement_email`, `post_mention_email`, `join_request_email`, `approved_join_request_email`, `member_joined_group_email`, `event_invitation_email`, `group_child_group_invite_email`, `group_child_group_invite_accepted_email`, `group_parent_group_join_request_email`, `group_parent_group_join_request_accepted_email`, `group_peer_group_invite_email`, `group_peer_group_invite_accepted_email`, `donation_to_email`, `donation_from_email`, `track_completed_email`, `track_enrollment_email`, `funding_round_new_submission_email`, `funding_round_phase_transition_email`, `funding_round_reminder_email`, `post_moderated_fulfillment_email`, `digest_email`, `comment_digest_email`, `message_digest_email`, `chat_digest_email`). The web client does not read these params.
- **Tracking pixel**: `Analytics.pixelUrl(<event>, { userId })` in post, announcement, mention, event invitation, submission and digest emails.
- **Settings / unsubscribe link**: every notification email carries `email_settings_url` = `Frontend.Route.notificationsSettings(clickthroughParams, reader)` → `<site>/notifications?ctt=…&cti=…&ctcn=…&expand=account&token=<30‑day JWT>&name=<url‑encoded name>&u=<userId>` (§4.4). Rendered by the shared footer snippet.
- **Post data** (`post.presentForEmail`): `id, announcement, comments: [], day, month (event start), details (links qualified with group slug), end_time/start_time (oneline only), link_preview {title, description, url, image_url}, location, image_url (first image; full for instant email, thumbnail for digests), topic_name (chat only), type, space_id, space_name, title (summary), unfollow_url (post URL + action=unfollow), user {id, name, avatar_url, profile_url}, url, when (formatted start–end in post timezone)`.
- **Group used for links** (`groupForNotificationForUser`): the activity's `group_id` if the reader is a member of it; otherwise the first post group the reader belongs to; otherwise null → `/public/post/<id>`. Instant post emails throw (→ `failed_at`) if no member group is found (except mention emails, which tolerate null).

### 5.5 Digest emails

#### 5.5.1 Group digest (daily / weekly)

- **Schedule**: hourly cron (`cron.js`, time zone `America/Los_Angeles`). At hour **12** (noon Pacific) every day: daily group digests + daily saved‑search digests. If that day is **Wednesday** (Luxon weekday 3): also weekly digests + weekly saved‑search digests.
- **Window**: `[today 12:00 PT − 1 day, today 12:00 PT]` (daily) or `− 7 days` (weekly).
- **Groups**: every active group that is not a space (`type` null or ≠ `space`). Each group's digest **includes its active child spaces**. Concurrency 2 groups at a time.
- **Recipients** (`getRecipients`): active members with membership `digestFrequency = <type>` **and** `sendEmail = true` (if email is globally disabled: only testers).
- **Content** (`getPostsAndComments` + `formatData`):
  - New posts created in the window, active, in the group or its spaces, type not `welcome`/notice, **not fulfilled**, and `end_time` null or in the future. Grouped into `discussions, events, offers, projects, proposals, requests, resources, chats` and each sorted by id desc (newest first).
  - `chat_rooms`: chat posts aggregated per source room (group chat or each space chat) → `{ name, num_new_chats, url (chat view), space_id, source_group_id }`; parent group room first, then spaces alphabetically.
  - `upcoming` ("Coming up in the next 2 days / week"): posts of type event/offer/project/proposal/resource/request with `start_time` between now and end of day +2 days (daily) / +7 days (weekly), unfulfilled, ordered by start time.
  - `ending` ("Ending in the next 2 days / week"): request/offer/resource/proposal with `end_time` in that range and already started, ordered by end time.
  - `posts_with_new_comments`: posts that received comments in the window, with the comments (`{id, text, user}`) and `comment_count`; sorted by post id desc.
  - `funding_rounds`: per active round in the group/spaces, count of submissions created in the window → `{ id, title, submission_count, url }` (not rendered by the template — §8).
  - Each post in a space carries `space_id`/`space_name`.
  - If nothing at all → no digest for the group.
- **Personalization** (per recipient):
  - Remove posts/comment summaries by users the recipient blocked (or who blocked them).
  - Remove the recipient's own posts from the new‑post lists (but keep their posts in comments/upcoming/ending); remove the recipient's own comments.
  - Remove items from spaces the recipient is not an active member of (unless the same post is also in the parent group).
  - Remove posts whose comment list became empty.
  - Chats: drop chat posts the recipient has already read (`post id <= group_views_users.last_read_post_id` for that room's chat view).
  - **Daily only**: drop "N new comments" rows for posts that are already listed as new posts.
  - If nothing remains → not sent.
  - Each post gets `url` + clickthrough, `reply_url` (reply address), and clickthrough params appended to links inside `details` that point at the Hylo domain.
- **Subject** (localized backend string): daily `Your {{group}} Daily Digest`, weekly `Your {{group}} Weekly Digest`; unified: `Your Hylo Daily Digest` / `Your Hylo Weekly Digest`. Template subject falls back to `How can your group help you today?` if `no_new_activity` (never set by code).
- **Sender**: `<Group> Daily Digest (via Hylo)` / `<Group> Weekly Digest`; unified: `Hylo Daily Digest` / `Hylo Weekly Digest`; reply‑to `DoNotReply@hylo.com`. Template `tem_t7rmGfJKvqXrvmrVWJjjWkg4` (**Digest_Email**), version `Spaces`.
- **Template layout** (`Digest_Email_i18n`):
  1. Intro: `Here's what's happened in the last {{day|week}} in` + group pill (avatar, name, link) — unified: `… in your Hylo groups`.
  2. If more than 2 non‑empty sections among Discussions/Events/Offers/Requests/Resources/Projects/Proposals/Upcoming/Ending: `Jump to` anchor links (`Discussions, Events, Offers, Requests, Resources, Projects, Proposals, Upcoming Reminders, Ending Soon`).
  3. **Active Conversations**: one line per chat room `N new chats in <room>` / `1 new chat in <room>`, then one line per post `N new comments in <post title>` (+ `in <space>` / location label).
  4. Sections `New Discussions`, `New Events`, `New Offers`, `New Requests`, `New Resources`, `New Projects`, `New Proposals` — each a list of post cards (post_card macro, with space label).
  5. `Coming up in the next 2 days|week`: icon, start time, linked title, location label.
  6. `Ending in the next 2 days|week`: icon, end time, linked title.
  7. Footer (settings link).
- **Unified digest** (`users.settings.unified_email_digest === true`): the recipient is removed from each group's normal send; all their groups' datasets for that frequency are merged: each post/comment appears once (keyed by list+id), `posted_in` group ids unioned; when a post appears both via a space and the parent, the parent copy's URL is preferred; comments merged without duplicates; lists re‑sorted by id desc, upcoming/ending by time. Each item gets `groups_label` (sorted, comma‑separated `Group` or `Parent / Space` names among the user's memberships) and comment rows/chat rooms a `location_label`.
- Other template data: `recipient {avatar_url, name}`, `group_url`, `email_settings_url`, `tracking_pixel_url` (event `Digest`), legacy `post_creation_action_url`, `reply_action_url`, `form_token` (unused).

#### 5.5.2 Chat‑room digest (hourly)

- Runs every hour (`GroupViewUser.sendDigests`). Watermark in Redis `ChatRoom.digests.lastSentAt`, capped to at most 24 h ago.
- Candidates: `group_views_users` rows for chat views with `new_post_count > 0` and `updated_at > lastSentAt`.
- Per (user, room): skip unless email enabled (or tester), membership in the room's group is active with `sendEmail = true` and `postNotifications ∈ {all, important}`.
- Posts: chat posts in that group created in the last 24 h with id > max(`last_read_post_id`, `settings.lastChatDigestPostId`). Skip if none, or all by the recipient. With `important`, keep only posts that mention the recipient or are announcements.
- Email: template **New_Chats_in_Chat_Room_Digest** `tem_XjjSPdy6ykMpwq4JGpchmFk6`, version `Spaces`. Subject `New chats in {{group_name}}` (room display name = group name or `Parent > Space`). Body: `N new chats in` + room pill, card with each chat (author avatar & name, content HTML, images), button **Join the conversation or change your notifications** → chat view. Sender `<room name> (via Hylo)`, reply‑to `DoNotReply@hylo.com` (not reply‑able).
- After sending, `settings.lastChatDigestPostId` is advanced to the max post id included.

#### 5.5.3 Comment digest (every 10 minutes)

- `Comment.sendDigests`, watermark Redis key `Comment.sendDigests.lastSentAt` (fallback: 10 minutes ago). Looks at active posts with `updated_at > watermark` and their comments created after the watermark.
- For each **follower** of such a post: skip if `muted_at`; take comments newer than the follower's `last_read_at` and not by the follower; none → skip.
- Non‑DM posts: requires user `comment_notifications ∈ {email, both}` and email enabled (or tester). Template **New_Comments_Digest** `tem_Kyq6CbvMmbdjcf7KvpJJFpmX`; subject `{{subject_prefix}} "{{post_title}}"` where `subject_prefix` = `You were mentioned in` if any included comment mentions the reader, else `New comments on` (English literals). Body: `N new comments on <post title> on <date>`, card with post creator avatar + title and each comment (avatar, name, time `h:mm AM`, text, image thumbnail linking to full), "Reply to this email to comment or" + button **Join the conversation on Hylo** (link to first comment). Sender: route group (`Parent > Space (via Hylo)`) or `The Team at Hylo`; reply‑to post reply address.
- Not filtered for blocked users or group membership (relies on follower set).

#### 5.5.4 Direct‑message digest (every 10 minutes)

- Same job, for posts of type `thread` (DM threads, [18-direct-messages.md](18-direct-messages.md)): requires `dm_notifications ∈ {email, both}`. Template **New_Messages_Digest** `tem_y8HpjwxFSxC9jRqwfVpPxY8d`; subject `New messages from {{participant_names}}` (names joined `A, B & C`). Body `N new direct messages`, card with first sender's avatar, participant names, each message, "Reply to this email to respond or" + **Join the conversation on Hylo** → `/messages/<threadId>`. Reply‑to = reply address (reply becomes a DM message). No From name override (default `The Team at Hylo`).

#### 5.5.5 Saved‑search digest

- Same noon schedule. For each active saved search with `context = 'groups'` (see [16-map.md](16-map.md) / module 05): new posts since `last_post_id`, grouped by pluralized type; sent only if there are new posts of types request/offer/event/discussion/project/resource **and** the user's membership `digestFrequency` in that group equals the run type. Template `tem_yfgPbhVHbRHYpy6Dc3hgKjcX` (**Digest_for_Saved_Searches**), subject `New saved search results in {{search name}}`, sender `<group name> Saved Search (via Hylo)` (or `All My Groups` / `Public`). `last_post_id` is updated only if the send result has `success` truthy.

### 5.6 Push notifications

- **Provider**: OneSignal REST (`@onesignal/node-onesignal`). Payload: `app_id`, `include_aliases: { external_id: [<userId>] }`, `target_channel: 'push'`, `contents: { en: <alert> }` (always the `en` key, even when the text is localized), `data: { path }`, `app_url: 'hyloapp:/' + path`, and if badge > 0 `ios_badgeType: 'SetTo'`, `ios_badgeCount`. No title. Errors are logged to Sentry and swallowed.
- **Per‑device registration**: none server‑side; the app binds the device to the user with `OneSignal.login(userId)`. All devices logged in as the user receive the push.
- **Path** = pathname + query string of the frontend URL (query kept so `commentId`/`postId` deep links work).
- **Badge** = `new_notification_count` (at time of send, before this notification's in‑app increment if processed later) + `unseenThreadCount` (DM threads with unread messages since `last_viewed_messages_at`).
- **Gating**: (1) medium chosen by §5.2 (group `sendPushNotifications`), (2) comment pushes additionally require `comment_notifications ∈ {push, both}`, (3) env flags (§2.7) checked twice — in `Notification.send` and in `PushNotification.send` (the latter writes the row with `disabled = true`).
- **Direct messages** bypass the activity pipeline: after a DM is created, job `Comment.notifyAboutMessage` sends a push to every thread follower except the sender, unless the thread is muted, `dm_notifications ∉ {push, both}`, or the follower's `last_read_at` is after the message. Text (English only): `{{name}}: {{text truncated 140}}` or `{{name}} sent an image`; path `/messages/<threadId>`. DMs create **no** in‑app notification.
- Push text locale: reader's locale (fallback actor's).

### 5.7 Real‑time

- In‑app delivery broadcasts `newNotification` on the socket user room and publishes to Redis `updates:<userId>` (GraphQL subscription `updates` / `allUpdates`, union member `Notification`). See [01-architecture.md](01-architecture.md).
- `users.new_notification_count` is the server‑side source of truth for the badge; it is incremented per in‑app notification even if the client is offline.

### 5.8 Reply by email (inbound)

- Provider webhook: SendGrid Inbound Parse → `POST /noo/hook/comment` (multipart/form‑data, ≤1 file of ≤10 MB). The raw body is verified with ECDSA (`x-twilio-email-event-webhook-signature` over `timestamp + body`) using `SENDGRID_INBOUND_PARSE_PUBLIC_KEY`; if the key is unset the check passes (fails open). Bad signature → 403.
- `to` address decoded → `{ postId, userId }`; undecodable → 422 `Invalid reply address: …`.
- Auto‑responders ignored (200, no comment) if header `auto-submitted`, `x-autoreply` or `x-autorespond` is present and not `no`, or the subject contains `out of office`, `auto-reply` or `automated response`.
- Post or user not found → 422.
- Body = `text` || `stripped-text` || `html` || `stripped-html`, cleaned by `Comment.cleanEmailText`: CRLF normalized; truncated at the first line that starts with `>`, a line equal to a prefix of the user's name (signature; also removes a preceding `--`), a line of 8+ dashes, a line of only dashes/em‑dashes/spaces, or a "dashed line" marker; Markdown is used except for DM threads.
- Comment created via the normal `createComment` with `created_from: 'email'` (so it triggers activities, digests, DM pushes like any other comment). Analytics event `Post: Comment: Add by Email`.
- No membership/permission check beyond the encrypted token.
- Legacy: `postCreationAddress` (`create-…@`), `/noo/hook/postForm`, `/noo/hook/batchCommentForm` (form token in digests) still exist but the digest template no longer exposes them ("TODO: fix").

### 5.9 Other emails (catalogue, owned by other modules)

| Email | Template id | Owner module |
|---|---|---|
| Password reset | `tem_phRPHm3y6RHvRFww6Vc3VBVB` | 04 |
| Email verification code (`Hylo confirmation code {{code}}`) | `tem_h99yGHv9MXTpMrPSDVTjQFyB` | 04 |
| Email change requested | `tem_gfCWyJRpp6Q996d6ykVgJKCW` | 05 |
| Finish registration (API‑created users) | `tem_fqGSrDrSK6WpjTBFXSfY79k4` | 04/24 |
| Welcome to Hylo (2 min after signup completes) | `tem_jkdjbcSVK9cmGvwXbtX9PQbJ` | 04 |
| Group created | `tem_7dHq84ct6mJS847pTVJK6b4P` | 09 |
| Group invitation (email invite) | `tem_GTwXKBfkTpTHRfHpmJWbYr9d` | 10 |
| Event RSVP / update / cancel | `tem_93YXdBV6bg4WmD8w3krpGP7H` / `tem_77XY6QJTVYKKFhDtkVgW3W93` / `tem_YCTQy4pJywkRDw6pfhShDg9H` | 14 |
| Moderation actions (flagged / cleared, to reporter & reportee) | `tem_BXYk4Hxt74R9jH3pkdGfqbJM` | 12 |
| Members export / account export | `tem_qRkBwBC4MVwqww87gDgRdHSG` | 11/24 |
| Paid content: purchase confirmation, access granted, renewal reminder, renewed, payment failed, refund, cancelled (+admin), access expired, track access purchased | `tem_9gQQRW8XgygjQpGGxQKYGdMS`, `tem_jfBqFPmhPP9jjfgSPB87YpDV`, `tem_DrD9kmkKTkTCxTM7PhpW4jKf`, `tem_gvBCMVVxrCbt8S9cK98kYP9Q`, `tem_YCXQrSjjqj8VqJWjhqHw66mF`, `tem_qKY6tQFyBcyBXry9wm8yvbxJ`, `tem_XfXjrYGdvDrPK4Sjprq7FtbS`, `tem_9ySxcvxKGKBXFQHJm4vS8cDC`, `tem_HVKwWYTMDbhWvvd3TGxtMkMG`, `tem_T63TXtFjmyqhyrw8yfp6YwH8` | 23 |
| Raw/plain email (`{subject, body}`), Stripe alerts, new connected account, commons listing decisions | `tem_jFYJ3bxMyfbbtbwgDGS4JGfK` | 11/23 |
| Tag invitation (dead) | `tem_dwY7bkbHhxrb4vdc8mhjTBgQ` | — |

### 5.10 Scheduled jobs summary

| Cadence | Job |
|---|---|
| On demand (queue) | `Notification.sendUnsent` (after every `saveForReasons`; self‑re‑enqueues when a batch is full) |
| Every 10 min | `Comment.sendDigests` (comments + DMs); `FundingRound.checkPhaseTransitions` (→ phase notifications) |
| Hourly | `GroupViewUser.sendDigests` (chat digest) |
| Daily at 12:00 PT | Group daily digests; saved‑search daily |
| Wednesdays at 12:00 PT | Group weekly digests; saved‑search weekly |
| Daily cron | Delete notifications older than 1 month; funding round reminders; subscription renewal/expiry emails |

---

## 6. Permissions

- `notifications` query, `markActivityRead`, `markAllActivitiesRead` require a logged‑in user and only ever touch that user's rows (`markActivityRead` silently no‑ops if the activity's `reader_id` differs).
- `Activity(id)` root query returns an activity by id (generic resolver; visibility as per module 03).
- Who receives what is listed per reason in §5.3; group‑scoped notifications require the reader to be (or have been, see §5.2) a member. Steward‑only notifications rely on responsibilities: `Add Members` (join requests), responsibility id 3 / `Remove Members` (member joined, relationship invites), `Administration` (announcements must be authored by an Administration holder; track and funding‑round steward notifications), stewards = ids 1,3,4 (relationship acceptance on hidden/peer groups).
- Blocking: notifications whose actor / post author / comment author is blocked either way are discarded at send time; digests filter blocked users' posts and comments. The in‑app list query does **not** filter (the blocked rows were already deleted when sent).
- Manage Notifications page: authorization is solely the 30‑day JWT with `action: 'notification_settings'`.
- Reply by email: authorization is solely the encrypted reply address.

---

## 7. API

### 7.1 GraphQL

```graphql
type Query {
  notifications(first: Int, offset: Int, order: String = "desc", resetCount: Boolean): NotificationQuerySet
  activity(id: ID): Activity
  me: Me  # me.newNotificationCount: Int, me.unseenThreadCount: Int, me.settings { commentNotifications dmNotifications unifiedEmailDigest … }
}
type NotificationQuerySet { total: Int, hasMore: Boolean, items: [Notification] }
type Notification { id: ID, activity: Activity, createdAt: Date }
type Activity {
  id: ID, action: String, actor: Person, comment: Comment, contributionAmount: Int,
  meta: ActivityMeta, fundingRound: FundingRound, group: Group, otherGroup: Group,
  post: Post, track: Track, unread: Boolean
}
type ActivityMeta { phase: String, reasons: [String], reminderType: String }
type Mutation {
  markActivityRead(id: ID): Activity          # sets activities.unread = false
  markAllActivitiesRead: GenericResult         # all of the reader's activities → unread = false
  updateMembership(groupId, data: { settings: { sendEmail, sendPushNotifications, postNotifications, digestFrequency } })  # module 05/10
  updateAllMemberships(data: { settings: {...} })
  updateMe(changes: { settings: { commentNotifications, dmNotifications, unifiedEmailDigest } })
}
type Subscription { updates: Update  allUpdates: SubscriptionUpdate }  # Notification is a union member
```

- `notifications` returns only `medium = 0` (in‑app) notifications for the current user ordered by notification id; `resetCount: true` sets `users.new_notification_count = 0` after fetching. Default page size used by clients: 20.
- Web query fields (exact): `id, createdAt, activity { id, actor { id name avatarUrl }, comment { id text }, post { id title details groups { id slug } type topics { id name } }, group { id name slug homeRoute type parentId parentGroup { id slug } }, otherGroup { id name slug }, track { id space { name } }, fundingRound { id group { name } }, meta { reasons phase reminderType }, action, unread, contributionAmount }`.
- `Post.silent` create flag (stewards only) skips `createActivities`, the funding‑round submission notification, Slack and Zapier (module 13).

### 7.2 REST

| Method & path | Purpose |
|---|---|
| `GET /noo/user/notification-settings?token=` | Load settings for the Manage Notifications page |
| `POST /noo/user/update-notification-settings` | Save them |
| `POST /noo/hook/comment` | Inbound email reply webhook |
| `GET|POST /noo/hook/postForm`, `/noo/hook/batchCommentForm` | Legacy email forms |

### 7.3 Socket events

| Event | Room | Payload |
|---|---|---|
| `newNotification` | `userRoom(userId)` | §4.1 |

---
