# 18 — Direct messages

> Group chat rooms are a different system — see [17-chat-rooms.md](17-chat-rooms.md). Generic comment/reaction/attachment mechanics: [13-posts-comments.md](13-posts-comments.md). Notification pipeline, email templates, push: [19-notifications-email-push.md](19-notifications-email-push.md). Global nav "Messages" entry & badge: [06-app-shell-navigation.md](06-app-shell-navigation.md). Blocking: [12-roles-permissions-moderation.md](12-roles-permissions-moderation.md) / [05-user-settings.md](05-user-settings.md).

---

## 1. Overview

Direct messages (DMs) are private conversations ("message threads") between 2–20 people. They are not tied to any group. Users reach them from the **Messages** icon in the global nav (badge = number of unseen threads), from a member profile / hover card ("Message"), from the chat room member panel ("Message Member"), and from emails/push notifications.

Key facts:
- **Storage reuses posts and comments**: a thread is a `posts` row with `type = 'thread'`; each message is a `comments` row on that post; participants are `posts_users` rows (`following = true`, `active = true`).
- One thread per **exact participant set**: starting a "new" message to the same set of people reopens the existing thread.
- Real‑time via per‑user socket rooms (`users/<id>`): `newThread`, `messageAdded`, `messageUpdated`, `userTyping`.
- Unread per thread is time‑based (`posts_users.last_read_at`); global badge counts unseen threads.
- Per‑thread **mute** (Inbox / Muted tabs). No "leave thread", no delete thread, no delete message.
- Notifications: push per message (if not muted / not already read), email digest every 10 minutes, **reply by email** supported.
- Who can be messaged: people who share a group with you (or are connected, are public, or are the system user Axolotl), excluding blocked users.

---

## 2. Concepts & data

| Entity | Table / fields | Notes |
|---|---|---|
| MessageThread | `posts`: `id`, `type='thread'`, `user_id` (creator), `visibility` default, `created_at`, `updated_at` (bumped on each message via `Post.updateFromNewComment`), `num_comments`, `num_commenters`, `active` | No title/body/groups. |
| Participant | `posts_users`: `post_id`, `user_id`, `following` (true), `active` (true), `last_read_at` (timestamp), `muted_at` (timestamp, null = not muted), `clickthrough`, `saved_at`… | Created by `post.addFollowers(participantIds)`. |
| Message | `comments`: `id`, `post_id` (thread), `user_id`, `text` (HTML), `created_at`, `edited_at`, `active`, `recent`, `comment_id` (unused for DMs), `created_from` (`null` / `'email'`) | |
| Attachment | `media` with `subject comment`, `type` `image`/`file`, `url`, `position` | |
| Reaction | `reactions` `entity_type='comment'` | |
| Draft | generic drafts, `type:'message'`, `messageThreadId` | Server‑side, debounce 800 ms. |
| UserConnection | `user_connections` (`user_id`, `other_user_id`, `type 'message'`) | Created/updated for the sender ↔ each existing participant on every message; feeds "recent contacts" and the who‑can‑message filter. |
| User settings | `settings.dm_notifications` (`none` / `email` / `push` / `both`), `settings.last_viewed_messages_at` | |

Client constants: `NEW_THREAD_ID = 'new'`; `MAX_MESSAGE_THREAD_PARTICIPANTS = 20` (counts the current user, excludes Axolotl; **client‑only**, server does not enforce); grouping `MAX_MINS_TO_BATCH = 5`; thread list page size 20; preview length 60 chars; typing broadcast every 3000 ms (`STARTED_TYPING_INTERVAL`), typing expiry 5000 ms; mark‑read debounce 2000 ms; scroll checks throttled 500 ms; load‑older trigger when `scrollTop ≤ 150`; thread search debounce 300 ms; people search: fetch throttled 1000 ms, local filter debounce 200 ms.

---

## 3. Routes / entry points

| URL | Screen |
|---|---|
| `/messages` | Inbox. Desktop: auto‑redirects (replace) to the most recent thread in the Inbox tab; if none, to `/messages/new`. Phone: inbox shown in the nav drawer, centre empty. |
| `/messages/new` | Compose with recipient picker (`NEW_THREAD_ID`). Query params: `participants=<id,id>` pre‑selects people (then removed from URL); `prompt=<text>` pre‑fills the composer (then removed). |
| `/messages/:messageThreadId` | Thread. |
| `/messages/create/...` | Treated as no thread. |

Helpers (`@hylo/navigation`): `messagesUrl()` → `/messages`; `newMessageUrl()` → `/messages/new`; `messageThreadUrl(id)` → `/messages/<id>`; `messagePersonUrl(person)` → new message with that person as participant. Backend `Frontend.Route.thread(post)` builds email/push links.

Entry points: global nav Messages item (badge `unseenThreadCount`) / Messages dropdown; profile & hover card message buttons; chat members panel DM button; "Message stewards" (`messageGroupStewards(groupId)` mutation creates/opens a thread with the group's stewards); emails and push notifications; route `AuthLayoutRouter` mounts `ThreadList` in the phone nav drawer for `messages` routes.

Page title: `Messages | Hylo`. View header (non‑phone): title `t('Messages')`, icon `Messages`, no search.

---

## 4. UX specification

### 4.1 Desktop / tablet layout (`MessagesLayout`)

Centre column split horizontally:

```
┌ inbox (resizable, default 300px) ┐┊┌ conversation ───────────────────────────────────┐
│ [X]  Messages               [✎]  │┊│ [Name pill] [Name pill] [2 others ▾]       [🔕] │ ← thread header
│ [🔍 Search messages...        ]  │┊│                                                  │
│ [Inbox] [Muted]                  │┊│   (avatar) Name                    2h ago        │
│ ┌──────────────────────────────┐ │┊│            message…                              │
│ │(av) Alice, Bob and 1 other 2h│ │┊│            message…                              │
│ │     Last message preview…  (3)│ │┊│                                                  │
│ └──────────────────────────────┘ │┊│  Name is typing...                               │
│  …                               │┊│ [+] Write something...                      [➤]  │
└──────────────────────────────────┘┊└──────────────────────────────────────────────────┘
```

- **Inbox width**: default 300 px, clamp 240–520 px, dragged via a zero‑width separator (14 px hit area centred on the seam, `aria-label` "Adjust inbox width"; dashed line + wash on hover/drag); saved in localStorage `hylo-messages-threadlist-width`.
- **Message stream width**: like chat — clamp default 750 px, min 400 px, rail 14 px wide at the clamp edge (`aria-label` "Adjust message width"), shown when pane width ≥ min(saved, 750) + 40 + rail; saved in localStorage `hylo-dm-stream-width`. The typing line and message column share the width (`--dm-stream-width`).
- When no thread id: right side shows a loading spinner (until the redirect).

### 4.2 Thread list (`ThreadList`)

Background: background colour with a vertical gradient (context‑menu background → 10 % theme background; 40 % in dark), inner right shadow. Click on empty area focuses search.

1. **Title row** (padding 12 px): close ✕ button (32 px, rounded 8 px, 20 % darkening; `aria-label`/title "Close") → returns to the location the user had before entering Messages (captured once; `/` if none or it was a messages URL; on phones also reopens the nav drawer). Heading "Messages" (18 px bold, truncates). **New message** button (32 px, selected‑colour background, white `SquarePen` icon, `aria-label` "New Message") → `/messages/new`.
2. **Search** input (placeholder "Search messages...", search icon, 20 % darkening background, 2 px focus border). Debounced 300 ms; server‑side search (§5.6).
3. **Tabs**: "Inbox" and "Muted" pills (12 px semibold; active = selected background).
4. **List** (infinite scroll; loads 20 more at bottom). Sorted by thread `updatedAt` descending (latest activity first).

**Thread row** (`ThreadListItem`): rounded 8 px, margin 0 8px; hover = selected colour at 50 %; active thread = selected background (xs+). Contents:
- Avatars block 62×62: 1 other → large round image (90 %); 2 → two medium avatars offset in a 60 px darkening circle; 3–4 → four tiles (small/medium) in the circle; >4 → three avatars plus a "+N" circle (N = count − 4). With no other participants: your own avatar.
- Names: other participants (excluding you), formatted with max 2 names: "Alice", "Alice and Bob", "Alice, Bob and 1 other", "Alice, Bob and N others"; "You" if none. Bold, 80 % fg (100 % when unread/active/hover); truncated with full‑text tooltip.
- Timestamp: latest message `createdAt` via `TextHelpers.humanDate(date, true)` (short relative, e.g. "2h", "3d"), 12 px 70 % fg, right.
- Preview: latest message text converted to plain text, truncated to 60 chars, 2‑line clamp, 14 px; 40 % opacity normally, 100 % on hover/active; **bold & full opacity when unread**.
- Right column: unread **badge** with `unreadCount` (expanded `Badge`); on hover/focus within: "Mark as read"/"Mark as unread" button (`MailOpen`/`Mail`, 28 px) and the Mute/Unmute button (`BellOff`/`Bell`).

Empty states (dashed rounded box, icon + text): Inbox: `CircleOff` + "No active messages"; Muted tab: "No muted conversations"; search with no hits: `SearchX` + "No messages found". Loading: bottom spinner.

### 4.3 Thread header (`Header`)

Sticky strip above the stream (padding 8px 16px, background, hairline bottom border, header shadow). Contents: one pill per other participant (bold, 12/14 px, padding 6/8 px, 20 % darkening, hover selected 50 % + scale 105 %); clicking a pill opens that person's profile card dialog. Pills are measured to fit one line; overflow collapses into a pill "`N others` ▼" (or "1 other"); clicking expands all (wrapping) with a "Show Less ▲" pill (hard‑coded English). If you are the only participant: a "You" pill. Right: Mute/Unmute button (hidden for `/messages/new`).

### 4.4 Messages stream (`MessageSection`)

Scrollable column (`#message-list`), padding 12 px, messages bottom‑aligned (short threads sit at the bottom, like chat), top padding 20 px.

- Initial load: spinner. Loading older: spinner overlay at top.
- **Ordering**: by message id ascending (oldest at top).
- **Pagination**: GraphQL `messageThread.messages`, pages of **80** newest‑first (first page with the thread; older pages with `cursor` = oldest loaded id) when scrolled within 150 px of the top and `hasMore`. Scroll position is preserved when older messages are prepended.
- **Grouping**: a message shows avatar + name + time ("header") if it's the first, or its author differs from the current header message's author, or it is > 5 minutes after the **header message** of the group (not the previous message).
- **Auto‑scroll**: on mount scroll to bottom. New message from you → scroll to bottom. New message from someone else while you're at the bottom (within 100 px) → scroll; when scrolled up → a floating "New Messages" pill button (primary colour, white text, rounded‑full, sticky 80 px from bottom; hard‑coded English) that scrolls down when clicked.
- **Mark read**: whenever the list is at the very bottom (or after scrolling to bottom, or new messages while at bottom) → debounced 2 s `POST /noo/post/:id/update-last-read`; if the tab is hidden, deferred until visible.

**Message row** (`Message`): rounded 8 px, 2 px transparent border; header rows get 8 px top margin; hover → card background + shadow.
- Avatar column (opens profile card on click) — only on header rows.
- Header: name (bold, truncates, underline on hover, opens profile card) and right‑aligned time `TextHelpers.humanDate(createdAt)` (12 px 50 % fg) + "(edited <humanDate>)" when edited. Non‑header edited messages show the "(edited …)" note right‑aligned above the text.
- Body: image tiles (linked, open lightbox) then file list, then text rendered as Markdown→HTML. Pending (optimistic) messages show "sending..." as text and timestamp.
- Reactions row (`EmojiRow` pills 26 px) when any.
- Hover action bar (top‑right; always visible on touch/no‑hover devices; hidden for pending/editing): Edit (pencil; own messages only, `aria-label` "Edit") and emoji picker (react to message).
- **Inline edit**: rich editor with border; **Enter saves**, **Escape cancels**; ✓ (`aria-label` "Save") saves, ✗ ("Cancel") asks `confirm("Do you want to discard your edit?")`. Empty edit ignored. Saves via `updateComment(id, html)`. No time limit. There is **no delete** for DMs.

### 4.5 Typing line

`PeopleTyping postId=<threadId>` under the stream, left padding 64 px, 12 px text: "`<Name> is typing...`" / "Multiple people are typing...".

### 4.6 Composer (`MessageForm`)

Styled like the chat composer: rounded 12 px, 5 % fg background, 1 px border at 10 % (20 % when focused), padding 6px 6px 6px 12px. Row (items bottom‑aligned):
- "+" attachment popover ("Upload image", "Attach file"; multiple allowed).
- Auto‑growing textarea (1–8 rows), **plain text with Markdown** (no rich editor, no mention autocomplete). Placeholder "Write something...".
- Send button (`aria-label` "Send"): filled selected colour when sendable; while sending/uploading replaced by a spinner (+ "Sending..." when sending; `role=status`).
- Attachment managers (thumbnails/files) below.

Keys: **Enter sends**, **Shift+Enter** newline (`onEnterNoShift`). Every keydown triggers the throttled typing broadcast (3 s). On send: stop typing, submit `{text, attachments}`, clear text and attachments, refocus.

Validation: needs non‑blank text or ≥1 attachment; disabled while sending/uploading; on new threads disabled until at least one recipient (`disabled={!messageThreadId && participants.length === 0}`, effectively only when no thread id).

Muted thread: above the composer a notice box (max 750 px, 15 % border, darkening 20 %): "This conversation is muted. Sending a message will not unmute it or turn notifications back on."

Drafts: per thread, saved to the server (`{text}` JSON, debounce 800 ms), restored on return if composer empty; cleared on send or when the composer is emptied. New (unsaved) threads have no draft. Text also kept in Redux per thread id while navigating.

### 4.7 New message (`PeopleSelector`)

Shown in place of the header on `/messages/new`; dropdown opens immediately with input auto‑focused.
- Selected people as removable chips (`MatchingPeopleListItem`: avatar + name + ✕). Backspace‑style removal via `removeParticipant(undefined)` removes the last.
- Input (min 150 px, max 320 px sm+; 20 % darkening, focus border). Placeholder: "Send a new message to..." (none selected) / "+ Add someone..." / "Group limit reached" (disabled at 20 participants incl. you) with helper text "Group messages are limited to 20 people".
- Typing filters: characters other than letters (A–Z, case‑insensitive), space, apostrophe and hyphen are **stripped** from the input. Server search `fetchPeople({autocomplete, groupIds: all my groups})` throttled 1 s; local name substring filter debounced 200 ms.
- Default list (empty search): recent contacts (`fetchRecentContacts`, from `UserConnection`) merged with all known people in the store, sorted by name, excluding you and already‑selected people.
- Dropdown: portal, fixed under the input, 320 px wide (phones: full viewport width minus 16 px), max height 400 px scroll, card background, shadow. Rows (~56 px): avatar, name, first group name; highlighted row = selected background. Arrow Up/Down move, Enter selects, click selects, mouse over highlights; infinite load sentinel when more. Clicking outside closes it; typing or focusing reopens.
- Selecting keeps focus in the input. Focusing the message composer closes the dropdown.
- Send: `findOrCreateThread(participantIds)` → existing thread with exactly these participants (+ you) is reused, otherwise created; then `createMessage` and navigate to `/messages/<id>`.

### 4.8 Phone layout (`MessagesMobile`, `isPhoneDevice()`)

- `/messages`: the inbox (ThreadList) lives in the nav drawer beside the global nav (drawer auto‑opens); the centre renders nothing; no auto‑redirect to a thread.
- Opening a thread/new message closes the drawer and shows the conversation full‑screen with its own header (back chevron returns to the inbox drawer), recipients, mute button; same stream, typing line and composer; focus uses `preventScroll` and the Visual Viewport API keeps the composer above the keyboard. The people dropdown spans the viewport.
- Tablets use the desktop split layout.

---

## 5. Business rules & side effects

### 5.1 Who can message whom

- `validateThreadData(userId, participantIds)`: non‑empty list required ("participantIds can't be empty"); every participant must pass `personFilter(userId)`: **not blocked** (either direction, `BlockedUser.blockedFor`) **and** (shares a group membership **or** has a `UserConnection` with you **or** is Axolotl **or** has a public profile). Otherwise: "Cannot message a participant who doesn't share a group".
- Axolotl (system user) can message anyone (no validation).
- Client limits the picker to people in the user's groups and caps at 20 participants; server has **no** size cap.
- `createMessage` refuses if, after excluding you and anyone you've blocked/who blocked you, no participant remains: "cannot send a message to this thread". Messages from blocked users are hidden (`messageFilter`), and blocked users are hidden from the participant list.
- You must be a participant (thread is only visible through `PostUser.followedPostIds(userId)`); mute/unmute require an active following participant ("Message thread not found", "You are not a participant in this thread").
- Leaving a group does not remove you from threads.

### 5.2 Creating threads and messages

- `findOrCreateThread`: dedupe ids; look up a `thread` post whose set of active followers equals exactly {you} ∪ participants (`havingExactFollowers`); else create post `type='thread'`, `user_id = you`, then `addFollowers` for everyone.
- `createMessage({messageThreadId, text, attachments})`: validates comment data, creates `comments` row (`text` = Markdown rendered to HTML on the client), media rows (`attachmentType`, position), sets sender's `last_read_at = now`, creates/updates `UserConnection` sender↔each other participant (`type 'message'`), adds any mentioned users as followers (rare in DMs), pushes sockets (§5.4), queues `Comment.notifyAboutMessage`, queues `Post.updateFromNewComment` (sets `num_comments`, `num_commenters`, `updated_at = now`, marks read for the commenter), publishes GraphQL subscription updates to each non‑muted other participant (`updates:<userId>` with `{messageThread}` for the first message, else `{message}`), and deletes the sender's server draft for that thread.
- Optimistic UI: a temp message (`id = messageThread<threadId>_<n>`) with "sending..." is replaced when the server returns.
- A thread with zero messages is effectively invisible to others (unseen count requires `num_comments > 0`; first message emits `newThread`).

### 5.3 Unread, read, badges

- Per thread per user: `unreadCount` = number of messages created after `posts_users.last_read_at` (0 if `last_read_at > posts.updated_at`); `lastReadAt` exposed too.
- **Global badge** `Me.unseenThreadCount` = count of threads (type thread, `num_comments > 0`, not muted, following/active) updated after `settings.last_viewed_messages_at` whose `last_read_at` is null or older than `updated_at`. Shown on the global nav Messages item / top nav (number). Push badge = `new_notification_count + unseenThreadCount`.
- Mark read: `POST /noo/post/:postId/update-last-read` (REST, `PostController.updateLastRead`) → `last_read_at = now`; client decrements `unseenThreadCount` by 1 (floored at 0) and zeroes the thread's `unreadCount`.
- Mark unread (`markThreadUnread`): sets `last_read_at` to 1 ms before the latest message; client sets `unreadCount=1` and increments the global badge if it was 0. Mark read from the list row uses the same REST call.
- Socket `messageAdded` for a thread that is not the one currently open: thread `unreadCount += 1`, `updatedAt = now` (moves to top), and global badge +1 unless muted. For the open thread: only `updatedAt`.
- There are **no read receipts** visible to others.

### 5.4 Real‑time

Each logged‑in client subscribes to its user room (`POST /noo/user/subscribe` → room `users/<id>`; re‑posted on every connect/reconnect). An open thread also subscribes to `posts/<threadId>` (for typing).

| Event | To | Payload |
|---|---|---|
| `newThread` | each other participant's user room (first message only) | `{id, createdAt, updatedAt, participants[{id,name,avatarUrl}], messages:[message], isMuted}` → client creates the thread with `unreadCount 1` |
| `messageAdded` | each other participant's user room | `{id, createdAt, creator (user id), messageThread (thread id), parentComment, text (HTML), attachments[{id,type,url,position}], isMuted}` |
| `messageUpdated` | other participants (on edit, and on reaction changes) | `{id, createdAt, editedAt, creator, messageThread, text}` (+ `commentReactions[{id, emojiFull, user{id,name}}]` for reaction updates) |
| `userTyping` | `posts/<threadId>` excluding sender | `{userId, userName, isTyping, postId}` |

Typing: client `POST /noo/post/:id/typing {isTyping}` (also publishes Redis `peopleTyping:messageThreadId:<id>` for the GraphQL `peopleTyping` subscription used by mobile).

GraphQL subscriptions (`makeSubscriptions`, used by mobile/urql): `updates` (per‑user stream of `Message` / `MessageThread`), `peopleTyping(messageThreadId)`.

Reconnect: thread list and open thread refetch when the app/tab returns (`useRefreshOnReturn`), and when navigating to the already‑open thread (e.g. tapping its notification).

### 5.5 Mute

- `muteMessageThread(id)` / `unmuteMessageThread(id)` set/clear `posts_users.muted_at`. UI confirmation: "Mute this conversation? You will no longer receive notifications from this thread." / "Unmute this conversation? You will start receiving notifications again."
- After muting: navigate (replace) to the most recent unmuted thread, or `/messages/new` if none; thread moves to the **Muted** tab; global badge −1 if it was unread. After unmuting: switch to Inbox tab and stay on the thread.
- Muted threads: excluded from Inbox list, unseen count, push, email digest, and subscription publishes; socket events still arrive (flagged `isMuted`) but do not bump the global badge. Sending a message does not unmute.

### 5.6 Search

`me.messageThreads(search)`: case‑insensitive substring match on **other** active participants' names **or** any active message text in the thread (ILIKE `%term%`, `%`, `_`, `\` escaped). Applies within the current tab (muted filter).

### 5.7 Notifications

- **Push** (`Comment.notifyAboutMessage`, queued): to each other participant unless muted, `dm_notifications` ∈ {`push`,`both`} (and push enabled in env or tester), and the message is newer than their `last_read_at`. Alert: "`<Name>: <text as plain text, truncated 140>`" or "`<Name> sent an image`" when it has media. Opens `/messages/<id>`.
- **Email digest** (`Comment.sendDigests`, every 10 min, Redis watermark, fallback 10 min): for each thread updated since last run, each follower (not muted) with `dm_notifications` ∈ {`email`,`both`} gets an email listing messages newer than their `last_read_at` not authored by them. Data: `count`, `date`, `participant_names` ("A" or "A, B & C"), `participant_avatars` (first), `other_names`, `thread_url` (+ `ctt=message_digest_email&cti=<userId>`), `email_settings_url`, `messages[{id,text,image,name,avatar_url,timestamp}]`; **reply‑to** = per‑user per‑thread reply address.
- No in‑app notification feed entries for DMs (the badge is the signal); Electron desktop shows badges via the global count.

### 5.8 Reply by email

- Reply address: `reply-<encrypt(INBOUND_EMAIL_SALT + postId + "|" + userId)>@<INBOUND_EMAIL_DOMAIN>`.
- Inbound webhook `POST /noo/hook/comment` (SendGrid Inbound Parse, multipart): verifies ECDSA signature headers `x-twilio-email-event-webhook-signature` / `-timestamp` against `SENDGRID_INBOUND_PARSE_PUBLIC_KEY` (fails **open** with a warning if the key is unset; 403 "Invalid signature" otherwise); 422 for bad address / Content‑Type / missing post or user; autoresponders ignored (headers `auto-submitted`, `x-autoreply`, `x-autorespond` not "no", or subject containing "out of office", "auto-reply", "automated response").
- Body cleanup (`Comment.cleanEmailText`): cut at first quoted line (`>`), a line that is only the sender's name (and a preceding `--`), dashed dividers, "On … at … @ … wrote:", or "via Hylo". For threads the text is stored **without** Markdown conversion (plain text); creates the message via `createComment` with `created_from='email'` — same sockets/push/updated_at as a normal message, but **bypasses** `createMessage` checks (blocked users, draft deletion, subscription publishes).

---

## 6. Permissions

| Action | Rule |
|---|---|
| See a thread / its messages | Active following participant. |
| Start a thread | Recipients must pass `personFilter` (shared group / connection / public profile / Axolotl; not blocked). |
| Send | Participant; at least one non‑blocked other participant. |
| Edit message | Author only (`canUpdateComment`). |
| Delete message / thread, remove participant, add participant to an existing thread, rename thread | **Not supported.** (Adding someone = new message to the new set → different thread.) |
| Mute / mark read/unread | Own participation only. |

---

## 7. API

GraphQL queries:
- `me { unseenThreadCount messageThreads(first: 20, offset, muted: Boolean, search: String, order: "desc", sortBy: "updatedAt") { hasMore total items { id unreadCount lastReadAt createdAt updatedAt isMuted participants { id name avatarUrl } messages(first: $firstMessages, order: "desc") { items { … } } } } }` (`MessageThreadsQuery`, `fetchThreads(20, offset, {muted, search})`).
- `messageThread(id) { id unreadCount lastReadAt createdAt updatedAt isMuted participantsTotal participants { id name avatarUrl } messages(first: 80, cursor, order: "desc") { hasMore items { id text createdAt editedAt creator { id name avatarUrl } attachments { id type url position } commentReactions { id emojiFull user { id name } } } } }` (`MessageThreadQuery` / `MessageThreadMessagesQuery` with `cursor`).
- `people(autocomplete, groupIds, first, offset)` and `me.connections` (recent contacts) for the picker.

Mutations: `findOrCreateThread(data: {participantIds})` → `MessageThread`; `createMessage(data: {messageThreadId, text, attachments: [{url, attachmentType}]})` → `Message`; `updateComment(id, data: {text})`; `reactOn(entityId, data:{entityType:"comment", emojiFull})` / `deleteReaction`; `markThreadRead(messageThreadId)` (exists; web uses REST), `markThreadUnread(messageThreadId)`; `muteMessageThread(messageThreadId)` / `unmuteMessageThread` → `{success}`; `messageGroupStewards(groupId)` → thread id; `peopleTyping` subscription.

REST: `POST /noo/post/:id/update-last-read`, `POST /noo/post/:id/{subscribe,unsubscribe,typing}`, `POST /noo/user/{subscribe,unsubscribe}`, `POST /noo/hook/comment` (inbound email).

---

## 8. Edge cases & known quirks

- Enter **sends** in DMs but **does not** send in group chat (Alt/Option+Enter there).
- DM composer is a plain textarea (Markdown), whereas edit uses the rich editor; edited content is HTML and is re‑run through Markdown on display.
- The 20‑person limit is client‑only.
- Recipient search strips digits, accented and non‑Latin letters (`/[^a-z '-]+/gi`), so names like "José" or "李" cannot be typed fully.
- "Show Less", "New Messages", "sending...", "You", "1 other"/"N others" and the "and" in name lists are hard‑coded English.
- Thread uniqueness is by exact participant set; a group thread and a 1:1 thread with the same person are separate.
- Email replies bypass block checks.
- `isActiveThread` compares the URL id with the socket's `messageThread` id; a mismatch in type (string vs number) can cause an unread bump on the open thread until mark‑read runs.
- No offline queue; failed sends leave the optimistic "sending..." row until refresh.
- Inbound signature check fails open when the public key isn't configured.
- `CloseMessages` component and `MessageSection`'s `lastSeenAtTimes` are dead code.

---

## 9. Docs vs. code

| Public docs ("Direct Messaging") | Code |
|---|---|
| "Click on the Chat bubble in the upper right corner … to see your recent messages … Open Messages link." | Messages is an item in the **left global nav** (user guide also says this) / top nav tabs; it opens the full Messages page with the inbox. |
| "Click on the New Message icon…", "message one person or create a group chat with multiple people". | Matches; group DMs capped at 20 people in the picker. |
| Placeholder "Write something…". | Matches (`Write something...`). |
| "To exit, click the gray X at the top right." | The close ✕ is at the **top left** of the inbox column and returns to where you were. |
| "Direct message an individual from their profile … message icon below their banner image." | Matches (profile and hover card message buttons; also chat members panel). |
| Docs don't mention mute, search, read/unread toggles, reply‑by‑email, or the shared‑group requirement. | See §5. |

---

## 10. Source references

- Web: `apps/web/src/routes/Messages/{MessagesLayout.js, Messages.js, MessagesMobile.js, Messages.store.js, messageThreadLimits.js, MuteThreadButton.js, MutedThreadNotice.js, ThreadList/*, Header/Header.js, MessageSection/MessageSection.js, Message/Message.js, MessageForm/MessageForm.js, PeopleSelector/**}`, `store/models/MessageThread.js`, `store/reducers/ormReducer/index.js` (DM cases), `components/SocketListener/*`, `components/SocketSubscriber/SocketSubscriber.js`, `components/PeopleTyping/*`, `client/websockets.js`, `util/textInput.js`, `util/constants.js`.
- Backend: `api/models/post/findOrCreateThread.js`, `api/models/comment/{createComment,notifications}.js`, `api/models/{Comment,Post,PostUser,User}.js`, `api/graphql/mutations/{comment,messageThread,index}.js`, `api/graphql/{makeModels,filters,messageThreadSearch}.js`, `api/controllers/{CommentController,PostController}.js`, `api/services/{Email,Websockets}.js`, `lib/inboundEmailSignature.js`, `config/{routes,policies}.js`.
- Tests: `apps/web/e2e/authenticated.messages.spec.js`, `apps/web/src/routes/Messages/**/*.test.js`.
