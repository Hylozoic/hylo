# 17 — Chat rooms

> Module owner file. Generic post model, post editor, comments ("replies"), reactions, link previews, attachments, flagging and saving are specified in [13-posts-comments.md](13-posts-comments.md). Notification delivery (in‑app / push / email pipeline) is in [19-notifications-email-push.md](19-notifications-email-push.md). The shell (global nav, context menu, view header, unread badges in the menu) is in [06-app-shell-navigation.md](06-app-shell-navigation.md). Spaces and the group menu (`group_views`) are in [15-views-streams-spaces.md](15-views-streams-spaces.md). Direct messages are a different system — see [18-direct-messages.md](18-direct-messages.md).

---

## 1. Overview

A **chat room** is a real‑time, chronological message stream attached to a **group or space**. Every group/space can have **at most one** chat room, materialised as a `group_views` row with `type = 'chat'` ("the chat view"). It appears in the group menu as **Chat** with a numbered orange unread badge.

Key facts (current code, post "Spaces & Views" migration):

- **Chat messages are ordinary `posts` rows with `type = 'chat'`**, attached to exactly one group/space through `groups_posts`. There is no separate "message" table for chat.
- **Chat rooms are no longer topics.** Historically (before the spaces migration) each `#topic` could have a chat room and `#general` was the default. That model is gone: `context_widgets` were dropped, `#general` was stripped from all posts, non‑`#general` topic chat rooms were migrated into **chat spaces** (a space whose `accepted_post_types = ['chat']` and whose only view is a chat view). Topics still exist for tagging/filtering (module 13/15), and `tag_follows` remains only for topic notification preferences (unread is **not** tracked there).
- **Threads** = replies. Replying to a chat message opens the message in the post dialog with its comment box focused; replies are comments on the chat post (module 13). The chat row shows a "N replies" pill.
- **Reactions**, **attachments** (images, files), **link previews** (including featured playable video), **mentions** (`@person`) and **topics** (`#topic`) work in chat exactly as in posts.
- **Non‑chat posts appear inline as "notices"** ("Aaron posted a new Discussion") when the group setting `showPostNoticesInChat` is on (default **on**).
- **Unread** is tracked per user per chat view (`group_views_users.last_read_post_id`, `new_post_count`). The menu shows an orange number; inside the room a dashed **"New posts"** divider marks the first unread message.
- **Presence**: a member pill (member count + green "someone online" dot), a strip of up to 5 currently‑active avatars (green dot = online, animated dots = typing), and a slide‑in member panel.
- **Typing indicator**: "Name is typing..." / "Multiple people are typing..." above the composer.
- **Email**: no per‑message email; an **hourly chat digest** email per room. Push/in‑app per membership `postNotifications` setting.
- **Chat activity cards**: chat messages are rolled up into one synthetic `chat_activity` post per group/space per UTC hour, shown in All Activity (module 15) — never in the chat stream itself.
- **Convert chat room to discussion**: Admins can turn a chat‑only space into one discussion post in the parent group (each message becomes a comment).

Users: any member of a group/space (read + write). Stewards with the **Manage Content** responsibility can remove others' messages and pin/unpin; **Administration** can convert chat spaces and create "silent" posts.

---

## 2. Concepts & data

### 2.1 Entities

| Entity / table | Role in chat |
|---|---|
| `group_views` (`GroupView`) | One row with `type = 'chat'` per group/space = the chat room. Has `group_id`, `order` (menu position; `0` = home view), `name` (optional label; default rendered "Chat"). Created by `Group.setupSpaceViews` for new groups (default included views: `all`, `chat`, `members`) and for typed spaces (custom spaces `chat` included by default; `chat` space type → only `chat`; track → `track-actions, chat, members, welcome`; funding round → `funding-round-submissions, chat, members, welcome`). Chat is a *singleton* common view — the "add view" picker hides it once present. |
| `group_views_users` (`GroupViewUser`) | Per user per view: `view_id`, `user_id`, `last_read_post_id` (FK → posts), `new_post_count` (int, default 0), `settings` jsonb (chat uses `settings.lastChatDigestPostId`), `created_at`, `updated_at`. Unique `(view_id, user_id)`. Rows are created on demand (`findOrCreate`, upsert on increment). |
| `group_view_pins` (`GroupViewPin`) | Pinned posts per view (`view_id`, `post_id`, `pinned_at`), unique pair, **max 3 per view** (`MAX_PINNED_POSTS_PER_VIEW = 3`). Chat displays pins as chips. |
| `posts` (`Post`) | A chat message: `type = 'chat'`, `description` (HTML body, exposed as `details`), `name` (title, empty for chat), `user_id`, `created_at`, `edited_at`, `timezone`, `link_preview_id`, `link_preview_featured`, `active`, `num_comments`, `num_people_reacts`, `reactions_summary`. Chat posts have **no location** (`Post.location()` returns false for chat). |
| `groups_posts` | Attaches the chat post to its single group/space. |
| `media` | `type = 'image'` or `'file'` attachments of the chat post (`position` ordered). |
| `comments` | Replies to a chat message (module 13). |
| `reactions` | Emoji reactions on the chat post (`entity_type = 'post'`). |
| `posts.notice_data` | jsonb on synthetic `chat_activity` posts: `{ bucketKey, groupId, bucketStart, recentPostIds (≤5), postCount }`. |
| `groups.settings.showPostNoticesInChat` | Boolean, default **true** when unset. Only affects which post types are *shown* in the chat stream. |
| `group_memberships.settings` | `postNotifications` (`all` / `important` / `none`), `sendEmail`, `sendPushNotifications` — gate chat notifications & digests. `group_memberships.new_post_count` holds the group/space menu badge. |

### 2.2 Post types visible in chat

`CHAT_VISIBLE_POST_TYPES = ['chat','discussion','request','offer','project','proposal','event','resource']` (`packages/shared/src/viewHelpers.js`).

- `postAppearsInChat(type, showPostNoticesInChat=true)`: notices on → any of the above; off → `chat` only.
- `chat_activity`, `action`, `submission`, `welcome`, etc. never render in the chat list (`ItemContent` returns `null` for `chat_activity`).
- Only `chat` posts count toward the chat unread badge (`postCountsTowardChatUnread(type) === (type === 'chat')`). Typed posts badge their own typed view, even when shown as notices in chat.

### 2.3 Chat post client shape (GraphQL fields fetched — `chatRoomPostFieldsFragment`)

`id, clickthrough, commentersTotal, commentsTotal, createdAt, details, editedAt, endTime, flaggedGroups, moderationActions{id groupId status text anonymous reporter{id name} agreements{id title} platformAgreements{id text}}, linkPreviewFeatured, savedAt, startTime, timezone, title, type, attachments{type url thumbnailUrl position id}, commenters(first:3){id name avatarUrl}, creator{id name avatarUrl}, linkPreview{description id imageUrl title url}, postReactions{emojiFull id user{id name}}`.

Client‑only fields on optimistic items: `localId` (`post_<n>` from lodash `uniqueId`, resets each page load), `pending: true`.

### 2.4 Constants (web)

| Constant | Value | Meaning |
|---|---|---|
| `MAX_MINS_TO_BATCH` | 5 | Max minutes between consecutive messages to merge under one author header |
| `INITIAL_POSTS_TO_LOAD` | 25 desktop / 17 on any mobile UA (`ismobilejs`) | Page size for the initial past and future windows and for jump/reconcile |
| Scroll pagination page | 10 | `first` when loading older/newer on scroll |
| `DEFAULT_CHAT_WIDTH` | 750 px | Default clamp width of the message column |
| `MIN_CHAT_WIDTH` | 480 px | Minimum draggable width |
| `CHAT_GUTTER` | 20 px | List's sm+ horizontal gutter |
| `CHAT_RAIL_SLACK` | 40 px | Extra pane width needed before the width rail appears |
| `CHAT_RAIL_WIDTH` | 30 px | Width of the drag rail |
| `CHAT_WIDTH_KEY` | `hyloChatStreamWidth` | localStorage key for chosen width |
| `MAX_COLLAPSED_DETAILS_HEIGHT` | 200 px | Long messages clipped to this height |
| `COLLAPSE_SLACK` | 40 px | Only collapse if natural height > 240 px |
| `JUMP_VISIBLE_BELOW_FOLD_PX` | 400 | Jump‑to‑latest button shows when bottom is > 400 px away |
| `MAX_TYPING_PAUSE` | 5000 ms | Typing entry expires after 5 s without a new event |
| Typing broadcast throttle | 3000 ms | Composer sends "typing" at most every 3 s |
| Draft autosave debounce | 1500 ms | Server draft save debounce |
| `DEFAULT_ACTIVE_MAX` | 5 | Avatars in the chat active strip |
| `RECENTLY_ACTIVE_MS` | 15 min | `lastActiveAt` window that counts as "recently active" (green dot) |
| Members panel search debounce | 300 ms | |
| Members panel infinite scroll | load next page when < 120 px from bottom | |

---

## 3. Routes / entry points

| URL | Renders |
|---|---|
| `/groups/:groupSlug/chat` | Group chat room (`ChatRoom context='groups'`) |
| `/groups/:groupSlug/chat/*` | Same component; trailing segments are ignored except `post/:postId` (legacy `/chat/:topicName` links from older emails resolve here) |
| `/groups/:groupSlug/chat/post/:postId` | Chat room with the post open in `PostDialog` (modal over the chat). Used by "Reply" and by links to comments (`?commentId=`) |
| `/groups/:parentSlug/spaces/:spaceSlug/chat` (+ `/post/:postId`) | Space chat room (`SpaceContent` mounts the same `ChatRoom`) |
| `…/chat?postId=<id>` | Opens the room centred on (and highlighting) message `<id>`; the param is then stripped from the URL |
| `…/chat?search=<term>` | Filters the room to messages matching `<term>` (title/body/creator name, case‑insensitive substring) |

Entry points: the **Chat** item in the group/space menu (module 06), group home when the chat view is the home view (`order = 0` → `groups.home_route = '/chat'`; groups whose home was `#general` were migrated to a chat home), single‑view chat spaces (the menu row links straight to the chat), notifications and digest emails (deep links), search results for chat posts, and "Reply" on a chat message.

URL helpers (`packages/navigation`): `chatUrl(_, {context, groupSlug, spaceSlug})` → `viewUrl('chat', …)`. `primaryPostUrl(post)` for `type='chat'` → `<groupBase>/chat?postId=<id>`; with `commentId` → `<groupBase>/chat/post/<id>?commentId=<cid>`. Non‑chat posts in a group whose home is chat → `<groupBase>/chat/post/<id>` (modal over chat). `pathnameOpensPost()` treats `?postId=` on a chat path as "opens a post" (so the first‑visit welcome redirect is skipped).

Page title (`<title>`): `Chat | <Group name> | Hylo` (`t('Chat')`). View header: title `t('Chat')`, icon lucide `MessageSquareMore` (16 px), no back button, no actions, **search enabled** (writes `?search=`).

---

## 4. UX specification

### 4.1 Layout (desktop, ≥ sm = 640 px)

The chat occupies the centre column (shell in module 06). Vertically, top to bottom:

```
┌────────────────────────────── chat pane (#chats, relative, overflow hidden, px-1) ───────────────┐
│ [top wash gradient h-14]                                                                         │
│ [pinned chips row, top 6px, left 12px, right 240px]        [active avatars ×≤5] [👥 128 ●]       │
│                                                                                                   │
│   ── Today ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   (day divider)                                 │
│   (avatar) Name  3:41 PM (edited 3:45 PM)                                                        │
│            message text …                                                                        │
│            message text (batched, same author < 5 min)                                           │
│            [😀 2] [👍 1]  [💬 3 replies]                                                          │
│   New posts ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   (accent‑coloured divider)                    │
│   ▌(avatar) Aaron posted a new ⚑ Discussion          (notice card)                               │
│   ▌Title of discussion                                                                           │
│   ▌2 replies · Tue, Nov 10 …                      Open ›                                          │
│                                                     ↓ (jump button, bottom 10 / right 50)  ⋮ rail │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
  Name is typing...                                   (only when someone types; text-xs, 50% fg)
 ┌─ composer ──────────────────────────────────────────────────────────────────────────────────┐
 │ [+]  Chat with <Group name>                                                   [Aa] [➤]      │
 └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Root: flex column, full height, `overflow-hidden`, items centred.
- **Top wash**: absolutely positioned 56 px (`h-14`) gradient from `theme-background` at 10 % opacity (50 % in dark) to transparent; messages scroll under it; pointer‑events none.
- **Message list** (virtualised; implementation used `@virtuoso.dev/message-list`): full width/height, horizontal padding 12 px (`px-3`) below sm and 20 px (`px-5`) at sm+. Each row is clamped to `max-width: var(--chat-stream-width, 750px)` and left‑aligned (the stream does not centre).
- **Composer container**: full width, padding 12 px sides / 12 px bottom (20 px at sm+), 0 top; background gradient from transparent to a slight darkening (5 % light, 25 % dark).
- Last message has a bottom margin of 12 px (20 px at sm+) so it does not touch the composer.
- Loading skeleton: until the initial scroll target is known (or group/chat view still loading) the list area shows the "chat" variant of the stream skeleton (`StreamSkeleton columnVariant='chat'`) bottom‑aligned, min height 40 vh.

### 4.2 Resizable stream width ("width rail")

- The message column clamps at `effectiveWidth = min(savedWidth, paneWidth − 20 − 30 − 4)`. Saved width is read from localStorage `hyloChatStreamWidth` (min 480; default 750).
- The **rail** (role `separator`, `aria-orientation=vertical`, `aria-label` = "Adjust chat width") is shown only when `availableWidth ≥ min(savedWidth, 750) + 40`. It is absolutely positioned at `left = 4 + 20 + effectiveWidth`, width 30 px, full height.
- Visual: two small triangles (8 px wide, 6 px tall; one pointing down at the top, one pointing up at the bottom) at 30 % foreground, always visible; on hover/drag a dashed 2 px vertical centre line (40 % foreground, inset 9 px top/bottom) and a rounded 20 %-opacity background wash appear; triangles darken to 60 %. Cursor `grab` / `grabbing`.
- Dragging (pointer capture) sets width = `clamp(startWidth + dx, 480, availableWidth)`; on release the rounded width is saved to localStorage. Per‑browser preference, not synced.

### 4.3 Message row (`ChatPost`)

Container: rounded 8 px, 2 px transparent border, relative, `cursor-pointer`, text selectable. States: hovered → card background + large shadow; long‑pressed (touch) → muted background; highlighted (deep‑linked `?postId`) → accent at 30 % opacity. When showing a header, top margin 8 px.

**Author header** (shown when `showHeader`, see §5.3):
- Avatar (medium, ~32–36 px) absolutely at left 0, top 2 px; clicking the avatar or name navigates to the member profile (`personUrl(creator.id, group.slug)`).
- Name (bold) + optional pin glyph (lucide `Pin` 14 px, gold `hsl(45 65% 45%)` / dark `hsl(45 65% 62%)`) when the message is pinned in this view.
- Time: 12 px at 50 % foreground, Luxon `toFormat('t')` in the viewer's locale (e.g. `3:41 PM`); if edited, ` (edited 3:45 PM)` with `t('edited')`.
- Content left indent: 42 px (`ml-[42px]`) for body, previews, attachments, reactions.

**Body**: rendered HTML (`HyloHTML`), first/last child margins zeroed, `break-words`, max width `chat-stream-width − 50px`. Only rendered if the HTML has visible text (an empty TipTap `<p></p>` is ignored).
- **Collapse long messages**: measured height > 240 px → clipped to 200 px with a 40 px fade (CSS mask) and a "See More" / "See Less" text button (12 px, semibold, focus colour, underline on hover). New/edited messages stay clipped until measured to avoid flashing full height.
- **Flagged** (post flagged in this group): body is blurred, non‑interactive and unselectable; a `FlagBadge` sits at the end of the text line (or beside image tiles when there are images) linking to the moderation page; the reveal flow is only in the post viewer.

**Link preview**: if `linkPreviewFeatured` and URL is a playable video → embedded player (rounded, max width as body). Otherwise a link preview card (title, description, image, url) indented 42 px.

**Attachments**: image tiles (`CardImageAttachments forChatPost`; clicking a tile opens a lightbox) then file attachment list; blurred when flagged.

**Footer row** (when any reactions or replies): reaction pills (`EmojiRow`, pills 26 px tall, rounded‑full, 12 px text) and, if `commentsTotal > 0`, a replies pill: 22 px tall, rounded‑full, 5 % foreground background with 10 % border, `MessageCircle` 12 px icon + "`N reply`" / "`N replies`" (12 px semibold, 70 % fg). Clicking opens the post (Reply).

**Hover action bar** (desktop hover, or long‑press on touch; hidden while editing): absolutely top‑right (right 4 px, top 0), rounded, background `background` (dark: `darkening`), scales in. Buttons 24 px tall, rounded, card background, shadow, 2 px border appearing on hover, scale 110 % on hover; tooltip on hover (except Reply). In order (each only if applicable):

| Button | Icon | Shown when | Action / tooltip |
|---|---|---|---|
| Reply | `MessageCircle` + text "Reply" | always | Opens the post (`viewPostDetails(post, {focusComment: true})`) |
| Edit | `Pencil` | viewer is the author | Desktop: inline edit. Touch devices: navigates to the full post editor route (`editPostUrl`). Tooltip "Edit post" |
| Save / Unsave | `Bookmark` / `BookmarkCheck` | always | Toggles saved post. Tooltip "Save post"/"Unsave post" |
| Pin / Unpin | `Pin` / `PinOff` | viewer has **Manage Content** in the group and a pinnable view is current | Toggles pin (`pinPost`). If 3 posts are already pinned and this isn't one: shown disabled at 40 % with tooltip "You can only pin 3 posts" |
| Flag | `Flag` | viewer is not the author | Opens flag dialog (module 12) |
| Delete | `Trash2` (red) | viewer is the author | `window.confirm("Are you sure you want to delete this post? You cannot undo this.")` → delete |
| Remove From Group | `Trash2` (red) | not author and viewer has **Manage Content** | `confirm("Are you sure you want to remove this post? You cannot undo this.")` → remove from group |
| Emoji | picker trigger | always | Emoji picker; selecting toggles a reaction; the row stays "hovered" while the picker is open |

Note: tooltips for Reply/Edit/Flag/Delete are hard‑coded English (`'Edit post'`, `'Flag post'`, …) and not translated.

**Click behaviour**: clicking anywhere on the row (header, body, attachment whitespace, reactions, replies pill) opens the post with comment focus — except when text is selected, when clicking a link that opens in a new tab, an image tile, the emoji icon, or while editing. A long press on touch sets "long‑pressed" (shows action bar) and the next tap clears it instead of opening. Long‑press on an avatar opens the profile hover card instead.

**Inline edit (desktop)**: replaces body with a rich editor (formatting menu shown, placeholder "Edit Post", max height 200 px scrolling) with a ✓ (selected colour, `data-testid=Save`) and ✗ (destructive colour, `data-testid=Cancel`) at top‑right. **Enter saves**, **Escape cancels silently**; clicking ✗ asks `confirm("Do you want to discard your edit?")`. Saving an empty editor does nothing (editor stays open). Save sends `updatePost` with the new `details` and the post's groups. Editing has **no time limit**.

### 4.4 Notice card (non‑chat post in chat, `ChatPostNotice`)

- `w-fit`, max width 520 px at sm+, rounded 8 px, padding `12px 20px 10px 12px`, no border except a 2 px **left rule in the post type's primary colour** (`POST_TYPES[type].primaryColor`, discussion colour as fallback). Background neutral `darkening` 5 % (20 % in dark mode); highlighted → accent 30 %. Fulfilled posts at 60 % opacity. Hover scales 105 %. Vertical margin 8 px.
- Row 1: small avatar + bold 12 px text at 70 % fg from `"{{author}} posted a new {{postType}}"`, where the post‑type part (icon + translated type word) is coloured with the type colour (split around a sentinel so word order is locale‑safe).
- Row 2 (if title): bold title, truncated; with a green `CircleCheckBig` if fulfilled.
- Row 3: `N reply`/`N replies` and/or the event time range (`formatUserDatePair` in viewer's zone), joined by ` · `; right‑aligned "Open ›" (semibold, selected colour) fades in on hover.
- Click / Enter / Space → opens the post.

### 4.5 Dividers

- **Day divider**: full‑width row, 12 px vertical margin: label (12 px, 40 % foreground) then a dashed 1 px rule (10 % foreground) filling the rest with 16 px gap. Label: `Today`, `Yesterday` (hard‑coded English, *not translated*), otherwise localized medium date (`formatLocalizedDate(date, {style:'medium'})`, e.g. "Nov 6, 2026").
- Shown before a message when its local day differs from the previous message's day. For the **first loaded row**, shown only if there are no older messages to load (`hasMorePast !== true`) — avoids the list jumping when older pages prepend.
- **"New posts" divider**: same shape; label `t('New posts')` in accent colour, 12 px semibold; dashed rule in accent at 30 %. Rendered above the first message whose predecessor is the *last read* message at room entry (`latestOldPostId`), **only if that message isn't by the viewer**. The marker does not move as you read; it resets each time the room is (re)entered.

### 4.6 Empty / loading states

- While loading: chat skeleton.
- Empty room (fetched, zero posts): centred column max 500 px: image `/home-chat-welcome.png` and `<h1>` "It's quiet in here, start the conversation."
- Older page loading: small spinner at top (30 px band). Newer page loading: spinner at bottom plus a pulsing 32 px circle with three dots above the jump button position.

### 4.7 Jump to latest

- A 32 px circular button (background colour, 2 px border at 15 % fg, `ChevronDown` icon 50 % fg → full on hover) absolutely at bottom 10 px, right 50 px of the list. Visible only when the bottom of the list is more than 400 px below the viewport. If the chat view's `newPostCount > 0`, a small accent badge with the count sits above it (white text, 12 px, min 24×24, rounded). Tooltip "Jump to latest post" (250 ms delay; untranslated).
- Click → `loadToLatest()` (hard reset to the newest window, see §5.2) then scroll to last item, and marks the room read up to the newest message.

### 4.8 Pinned chips

Pinned posts of the chat view (`GroupView.pinnedPosts`, ≤3) render as chips: 29 px tall, rounded 6 px, 1 px gold border (`hsl(45 45% 60%)` / dark `hsl(45 45% 34%)`), card background, small shadow, max width 300 px (sm+). Content: gold pin glyph (14 px, stroke 2.5) + bold 12 px title (post title, else body text truncated to 64 chars, else "Post"). Click → opens post (`post/:id` relative route). Moderators (Manage Content) on hover‑capable devices see an inline "Unpin" (10 px bold, `PinOff` icon) that widens in on hover/focus (max 72 px); never shown on touch.

Position: absolute, z‑30; sm+: top 6 px, left 12 px, right 240 px, single horizontally scrolling row (no scrollbar). Phones: top 44 px, left 64 px, right 8 px, a right‑aligned column under the presence cluster.

### 4.9 Presence cluster & member panel (`ChatMembersPanel`)

**Cluster** (absolute top 8 px, right 8 px, z‑30, gap 8 px):
1. **Active avatars** (`CurrentlyActivePills`, max 5): 30 px circles, 2 px background‑coloured border, overlapping by 8 px, leftmost = most recent activity (highest z‑index; a typer is raised above all). Badge: if typing → small rounded box with three 5 px dots animating (`animate-typing-dot`, 160 ms stagger) at bottom‑right; else if present (on live roster or `lastActiveAt` < 15 min) → 10 px green dot with background border. Tooltip = name, or "`Name is typing...`". Hover scales 110 %. Click → member directory with `?highlightMember=<id>`.
   - Ordering: seeded from `members(sortBy: last_active_at, first: 5)`; then live promotions move a person to the front (others shift, list truncated to 5): someone starts typing, a new message arrives (its creator), someone joins the live roster. Someone leaving the live roster is removed. The strip resets when switching groups.
2. **Member pill**: button 28 px tall, rounded 6 px, card at 90 % with backdrop blur, 1 px border at 20 % fg (40 % on hover), 12 px semibold: `Users` icon, `group.memberCount`, and a 7 px green dot when **anyone other than the viewer** is on the live roster. `aria-label` "Members". Click opens the panel.

**Panel**: covers only the chat pane. Overlay `black/35` fades in (200 ms); panel slides from the right (300 ms ease‑out), width 300 px (max 85 %), background, 2 px left border, large shadow. Contents:
- Header: "Members" (14 px bold) and a close ✕ (28 px, `aria-label` "Close").
- Search box (placeholder "Search members", search icon), focused automatically on desktop only; 300 ms debounce; list is `members` of the group sorted by name, paginated (infinite scroll).
- Rows: small avatar with a 9 px green dot if recently active; name (bold 14 px) and tagline or location (12 px, 50 % fg); a 28 px DM button (`MessageCircle`) — hidden until row hover on hover devices, always visible on touch — tooltip/aria "Message Member" → navigates to `messagePersonUrl(person)` (new DM with that person, module 18). Row click / Enter / Space → member directory with `highlightMember`.
- Empty: "No results for this search".
- Close: ✕, overlay click, or Escape.

### 4.10 Typing strip

`PeopleTyping` between list and composer, full width, padding `4px 12px` (20 px at sm+), 12 px, 50 % foreground; renders nothing when no one is typing (so it does not reserve space). Text: one person → "`<Name> is typing...`"; two or more → "Multiple people are typing...". Only typers whose event `groupId` equals the current group/space are counted.

### 4.11 Composer (`ChatEditor`)

Container: rounded 12 px, 5 % foreground background, 1 px border at 10 % (20 % when focused), padding 6 px, max height 300 px (scrolls). One row:

1. **"+" attachment button** (24 px `Plus` icon, 50 % fg, `aria-label` "Add attachment") → popover (opens upward, 192 px wide) with "Upload image" (`ImagePlus`) and "Attach file" (`Paperclip`); both allow multiple selection. An item is disabled while that kind of attachment is already present/uploading (further adds go through the attachment manager's own "+" tile).
2. **Rich text editor** (TipTap‑equivalent): placeholder `"Chat with {{groupName}}"`. Supports bold/italic/etc., headings (1–3), lists, code, links (auto‑link, default https), images pasted as HTML are stripped, `@mentions` (people in this group, max 7 suggestions), `#topics` (max `MAX_POST_TOPICS` on the post), video embeds. Read‑only and replaced by a spinner while an attachment is uploading.
3. **Formatting toggle** (`CaseSensitive` "Aa" icon, `aria-label` "Toggle formatting toolbar", pressed state = 15 % fg background) — shows/hides the formatting menu bar above the text (hidden by default).
4. **Send** (`Send` icon 20 px, rounded 8 px, `aria-label` "Post"): enabled → filled with the selected colour, white icon; disabled → outlined, muted, `cursor-not-allowed`, `title` lists validation errors.

Below the row: link preview editor (with "featured" toggle for videos and a close ✕ that sets `skipLinkPreview`), then image and file attachment managers (thumbnails / file chips with remove).

**Keyboard**:

| Key | Effect |
|---|---|
| **Enter** | New paragraph (does **not** send) |
| **Shift+Enter** | Line break |
| **Alt/Option+Enter** | Send |
| Mention/topic popup keys | Arrow/Enter select suggestion |

No hint text about Alt‑Enter is shown in the chat composer (unlike the post editor and comment form).

**Validation** (send disabled until valid): must have visible text **or** at least one attachment (`"Chat must have text or an attachment"`); must have a group (`"At least one group required"`); not while uploading.

**Send flow**: build a pending post (see §5.1), append it optimistically to the list, reset the composer (clear text, link preview, attachments, draft; re‑focus at end on desktop), stop typing indicator, then call `createPost`. The next message can be composed and sent while the previous request is in flight. On success the pending row is swapped for the server row (matched by `localId`). **On failure the optimistic row remains** with no error UI in chat (the general post‑save error handling applies — module 13).

**Auto‑focus**: desktop (non‑mobile UA) focuses the composer at the end on load and when switching rooms (150 ms after mount). Mobile does not auto‑focus.

**Drafts**: persisted **server‑side** via the generic drafts system (`useDraft({type:'post', groupId, postType:'chat', navigateTo: <current path+search>, debounceMs:1500})`; module 13). Scoped per group/space (key `chat:<groupId>`), so switching rooms does not leak text. Empty content deletes the server draft. Draft restores text, link preview and topics on return.

### 4.12 Mobile web / small screens

- Below 640 px: chat pane uses `overflow: clip` (no horizontal panning); list gutter 12 px; message rows get 15 px left padding.
- Pinned chips stack right‑aligned beneath the presence cluster.
- No auto‑focus; long‑press shows the action bar; Edit opens the full post editor route (with explicit Save/Cancel; "Option-Enter to save"/"Alt-Enter to save" hint per e2e); Unpin chip control hidden on touch; DM buttons always visible in the member panel.
- The width rail never appears (pane too narrow).
- Initial page size 17.
- Inside the legacy mobile WebView / `hideNavLayout` the root gets a `withoutNav` class (no bottom padding). The native Expo app (`apps/mobile-leap`) contains no chat screens; see module 25.

---

## 5. Business rules & side effects

### 5.1 Creating a chat message

Client payload (`createPost`): `type: 'chat'`, `details` (HTML; empty string if only an empty paragraph), `title: ''`, `groups: [currentGroup]` (the room's group/space; no group selector), `isPublic: context === 'public'` (always false in practice), `linkPreview`, `linkPreviewFeatured`, `skipLinkPreview`, `imageUrls`, `fileUrls`, `topicNames: []` (topics typed inline are parsed server‑side), `timezone` (viewer's zone), `acceptContributions: false`, `localId`.

Server (`Post.create` → `afterCreatingPost`), inside a transaction:
1. `assertGroupsAcceptPostType` — chat is **never** restricted by `accepted_post_types` (chat/action/submission are exempt), so any group or space accepts chat.
2. Attach to `groups_posts`; add creator and mentioned users as post followers; create `media` rows (images then files, by position); tags from body; attach existing link preview or queue `generateLinkPreview` (2 s delay) unless `skip_link_preview`.
3. `notifyAndMarkAuthorRead`:
   - Pushes socket `newPost` to `groups/<groupId>` with the payload (§7.3), `localId` echoed. If the group is a space, the same event also goes to the **parent's** room (so parent menus can badge). Skipped for silent posts.
   - Marks the author read: `GroupViewUser.markAuthorRead(chatViewId, authorId, postId)` → `last_read_post_id = postId`, `new_post_count = 0`; `GroupMembership.syncBadgeCounts`.
   - Bumps `group_tags.updated_at` for the post's topics.
4. Background jobs (skipped when `silent`): `incrementNewPostCountForCreatedPost` (§5.4), `createActivities` (§5.6), Slack, Zapier triggers; and `upsertChatActivityNotice` (§5.7).
5. Remote image URLs are re‑hosted asynchronously.

Silent posts (`silent: true`) are only allowed for stewards with **Administration** in every destination group and cannot be announcements (not exposed in the chat composer).

### 5.2 Loading, ordering & pagination

- **Ordering**: strictly by post `id` ascending in the UI (`sortBy: 'id'`), deduplicated by id. (Equivalent to creation order.)
- Query: `group(slug).posts(filter:'chat', sortBy:'id', order, cursor, first, search, types?)`, `childPostInclusion: 'no'` — a parent's chat **does not** include its spaces' messages. With notices off, `types: ['chat']`; otherwise `filter:'chat'` → types `chat + discussion, request, offer, project, proposal, event, resource`.
- **Cursor semantics** (backend): `order:'asc'` → `posts.id > cursor`; otherwise `posts.id < cursor`; sorted by the sort column in `order`.
- **Initial window** (on entering a room with no cached data), centred on `startId = ?postId || lastReadPostId`:
  - *Past*: `order:'desc', cursor: startId+1, first: N` (includes the start post). Without a lastRead: no cursor → newest N.
  - *Future*: `order:'asc', cursor: startId, first: N`. Without a lastRead: cursor `Number.MAX_SAFE_INTEGER` (returns nothing).
  - N = 25 desktop / 17 mobile. Window is never sized by `newPostCount`.
- **Initial scroll target** (`computeChatInitialScrollIndex`): index of the start post (so one already‑read message sits above the "New posts" line); if the start id is beyond the last loaded id → last item; if not present → the item just before the first newer one; no lastRead → index 0 (oldest of the newest page). Aligned `start-no-overflow`. Does **not** jump to the newest message.
- **Cached re‑entry**: if Redux already holds rows for this room, they render immediately at the lastRead index and a catch‑up fetch loads newer posts after the newest cached id (`cursor: newestId, first: N`).
- **Scroll pagination** (debounced 200 ms, ignored while a page is loading): near top (`listOffset > −100`) and more past exists → `fetch(order desc, cursor: oldestLoadedId, first: 10)` then prepend, keeping the previous top message pinned in place. Near bottom (`bottomOffset < 50`), more future exists, **and the composer is not focused** → `fetch(order asc, cursor: newestLoadedId, first: 10)` and append.
- `hasMore` from the server (or an empty page) stops further paging in that direction.
- **Jump to latest** (`loadToLatest`): drop cached pages; fetch past with cursor `MAX_SAFE_INTEGER + 1` (newest N) and future with cursor `MAX_SAFE_INTEGER` (empty); replace the list scrolled to the end; mark read up to the newest persisted message.
- **`?postId` deep link**: if the post is in the list, scroll to it; else reset and load N after (`asc`, cursor = id) and N before (`desc`, cursor = id+1). The target is highlighted (accent wash). The query param is then removed (so the same notification can be clicked again).
- **Room switch safety**: a monotonically increasing "epoch" is bumped on every room entry; any in‑flight fetch whose epoch is stale is discarded.
- **Reconnect / foreground**: when the tab becomes visible after being hidden, the client refetches the group's views (fresh unread counts) and fetches posts newer than the newest loaded id (`first: N`). Socket subscriptions re‑post `subscribe` on every `connect`/`reconnect` and on `visibilitychange → visible`. A heartbeat (`GET /noo/heartbeat` every 30 s, 10 s timeout, reconnect after 2 consecutive failures or when disconnected; also on browser `online`) keeps the socket alive. There is no offline send queue: sends while offline fail.

### 5.3 Grouping consecutive messages

A message shows the author header (avatar, name, time) if **any** of:
- it is the first row in the list (and once shown, a row keeps its header even after older rows are prepended);
- it is the first unread (the "New posts" divider precedes it);
- a day divider precedes it;
- more than **5 minutes** since the previous message (difference in minutes; missing previous → treated as 1000);
- previous message's author differs;
- previous message has **any replies** (`commentersTotal > 0`);
- previous item is not a `chat` post (i.e., a notice).

Otherwise it renders as a continuation (body only, indented 42 px, no extra top margin).

### 5.4 Unread tracking & badges

- **Increment** (background job after create, non‑silent, `chat` type only): for each group of the post, every **active** member except the author gets `group_views_users.new_post_count += 1` on that group's chat view (row upserted; `updated_at` bumped). Then `GroupMembership.syncBadgeCounts(group, members)` recomputes `group_memberships.new_post_count` = sum of on‑menu chat view counts + 1 per on‑menu typed view with unread (`membershipBadgeCountFromViews`).
- **Live client bump**: on socket `newPost` from someone else (not `chat_activity`), the client increments the cached chat view `newPostCount` in the group's menu (and in any parent menu that embeds the space) and recomputes the membership badge.
- **Mark read while reading**: whenever the rendered window changes (debounced 200 ms), the client takes the bottom‑most persisted message on screen; if its id > the locally committed lastRead, it calls `updateGroupViewUser(viewId, lastReadPostId)`. Suppressed for 400 ms after landing so opening the room does not instantly mark everything read. The server sets `last_read_post_id` (only if the post exists — guards against races) and **recomputes** `new_post_count = count(chat posts in group with id > lastRead and not deactivated)`, then syncs membership badges.
- If last‑read already equals the latest loaded message but the badge is stale, one recount call is made per room+latest‑post.
- Entering the room does **not** blanket‑clear the badge. "Mark as Read" on the group (module 06) calls `markGroupAsRead`, which zeroes every view and sets each view's `last_read_post_id` to the group's max post id.
- **Delete**: `decrementNewPostCount(chatViewId, {beforePostId})` decrements rows with count > 0 whose `last_read_post_id` is null or < the deleted post.
- Menu indicator: chat view = orange badge **with number**; group/space menu row and global nav = dot (module 06).
- No per‑message read receipts exist; nobody can see who has read a message.

### 5.5 Editing, deleting, removing

| Action | Who | Effect |
|---|---|---|
| Edit | Author only (`updatePost`) | Replaces `details`; sets `edited_at`; header shows "(edited h:mm)". No time limit. Updated row propagates to the list from the store. (Other viewers see edits on refetch; there is no chat‑specific edit socket event.) |
| Delete | Author only (`deletePost`) | `Post.deactivate` (soft delete, `active=false`); removed from the list immediately; unread decremented. |
| Remove From Group | Others with **Manage Content** (`removePost(id, groupSlug)`) | Removes the post from that group (module 12); removed from list. |
| Flag | Non‑authors | Flag dialog; optimistic `flaggedGroups += groupId` → content blurs. |
| Pin/Unpin | **Manage Content** | `pinPost(postId, viewId)` toggles a `group_view_pins` row; max 3 per view; post must belong to the view's own group. |

### 5.6 Notifications

- `Post.createActivities` for a chat post: activity `reason: 'chat'` for **every member** of the post's group(s) (plus `'mention'` for mentioned users), excluding the author and former members.
- `Activity.generateNotificationMedia` for chat: **never email** (emails come through the hourly digest). Push (if membership `sendPushNotifications`) and in‑app are sent when the reader's best `postNotifications` across relevant memberships is `all`, or `important` and the activity is a mention or announcement. `none` → nothing (mentions still produce their own `mention` reason activity; how mention notifications are delivered is module 19).
- Per‑room notification preference = the group/space membership's `postNotifications` (`all` / `important` / `none`) — there is **no per‑chat‑view setting** (`group_views_users.settings` written by `updateViewSettings` is never read). Topic follow notifications (`tag_follows.settings.notifications`) are unrelated to chat rooms now.
- There is no "follow/unfollow chat room" action: membership in the group/space is the subscription. To leave a chat space, leave the space (module 10).

### 5.7 Chat activity notices (All Activity)

After each non‑silent chat post, a job upserts one synthetic post of `type = 'chat_activity'` per group per **UTC hour** (bucketKey `<groupId>:<YYYY-MM-DDTHH>`), authored by the system user (Axolotl, `User.AXOLOTL_ID`), with `notice_data = {bucketKey, groupId, bucketStart, recentPostIds: up to 5 newest chat ids, postCount}`. It is emitted on the group socket as `newPost` and shown only in All Activity when "Show chat activity" is on (module 15). It never increments unread and never appears in the chat list.

### 5.8 Hourly chat digest email

`GroupViewUser.sendDigests()` runs hourly (cron):
- Watermark in Redis `ChatRoom.digests.lastSentAt`; catch‑up capped to the last 24 h.
- Candidates: chat `group_views_users` with `new_post_count > 0` and `updated_at > lastSentAt`.
- Skip unless `EMAIL_NOTIFICATIONS_ENABLED=true` (or tester), active membership, `sendEmail` on, `postNotifications` ∈ {`all`, `important`}, user has an email.
- Posts: chat type, active, in that group, created within 24 h, id > max(`last_read_post_id`, `settings.lastChatDigestPostId`). Skip if empty or all authored by the recipient. `important` → only posts mentioning the recipient or announcements.
- Email data: `count`, `chat_room_name` (group name, or "Parent > Space" for spaces), `chat_room_url` (chat URL + clickthrough params `ctt=chat_digest_email&cti=<userId>&ctcn=<room name>`), `email_settings_url`, `group_avatar_url` (space falls back to parent avatar), and `posts[]` each with `id, announcement, content, creator_name, creator_avatar_url, images[{url,thumbnail_url}], mentionedMe, post_url, timestamp` (`h:mm AM/PM` in the post's timezone). Sender name "<room name> via Hylo", reply‑to `DoNotReply@hylo.com`, template version `Spaces`, recipient locale.
- After sending, `settings.lastChatDigestPostId` = max sent id. Rendering of the template is module 19.
- Group digests (daily/weekly) include an "Active Conversations" `chat_rooms` section (module 19).

### 5.9 Presence & typing (server)

- `POST /noo/group/:groupId/subscribe` (socket only; policies: `isSocket, sessionAuth, checkAndSetMembership` — must be a member with content access; `:groupId` may be id or slug): joins socket room `groups/<id>`, registers the socket in the in‑memory roster (`RoomPresence`, ref‑counted per user across tabs), replies to the subscriber with `roomPresence {groupId, members:[{id,name,avatarUrl}]}` and, if the user was not already present, broadcasts `memberPresent {groupId, member}` to others.
- `POST /noo/group/:groupId/unsubscribe`: leaves room; broadcasts `memberAway {groupId, userId}` if that user has no other sockets there.
- Socket disconnect (`afterDisconnect`): drops the socket from every room, broadcasting `memberAway` where the user is now absent. Socket ping interval 10 s / timeout 15 s → a dead connection disappears within ~25 s.
- The roster is process‑local and not persisted (restart empties it; clients rebuild by re‑subscribing).
- The web client subscribes only to the **current top‑level group** (by slug) while it's open; presence in a parent counts as presence in its spaces (`getRoomPresence` merges parent + own).
- `POST /noo/group/:groupId/typing {isTyping}` (same policies; space membership required for a space): broadcasts `userTyping {userId, userName, isTyping, groupId}` to `groups/<id>` and, for spaces, also the parent room, excluding the sender's socket.
- Client sends `isTyping: true` at most every 3 s while the composer has text, and `false` on send. Receivers drop an entry after 5 s without refresh (checked every 500 ms) or on `isTyping:false`.

### 5.10 Convert chat space to discussion

Available from **Space Settings → Advanced → "Convert chat room to discussion post"** (and from Related Groups settings) only for chat‑only spaces (`type='space'` and `acceptedPostTypes` exactly `['chat']`).

Modal (`ConvertChatSpaceModal`): title "Convert chat room to discussion post"; copy "Each chat message becomes a comment on one discussion post, and this chat room is removed. No one is notified."; "The discussion will be posted in {{name}}"; dry‑run preview "{{messageCount}} chat posts will be converted to comments on the discussion, with {{attachmentCount}} attachments and {{reactionCount}} reactions." and, if any, "{{replyCount}} comments on the chats will remain as replies to the comments."; field "Discussion title" (default = room name, required); warning "This cannot be undone here, and no notifications are sent."; confirm field "Type {{name}} to confirm" (must equal room name exactly, trimmed); buttons Cancel / Convert ("Converting…"). Success toast "Chat room converted to a discussion" (or "This chat room is large, so the discussion is being created in the background.") with action "View discussion". Errors: "Could not preview this chat room", "Could not convert this chat room".

Server rules (`convertChatSpaceToDiscussion(spaceId, title, dryRun)`):
- Caller needs **Administration** in the parent; not a track/funding‑round space; chat‑only; parent active, not itself a space, and accepts `discussion`; no chat message in the room is also attached to another group; not already converted/pending. Errors (verbatim): "Space not found", "Space has no parent group", "You don't have permission to convert this chat room", "Track and funding round spaces cannot be converted to a discussion", "Only a chat room can be converted to a discussion post", "Parent group not found", "Cannot convert a chat room whose parent is itself a space", "<Parent> does not accept discussion posts", "Some messages in this chat room also belong to another group", "This chat room has already been converted to a discussion post", "This chat room is already being converted", "Title cannot be blank", "Could not start the conversion. Please try again."
- Creates a `discussion` post in the parent (author = converter, `created_from = 'chat-conversion'`, not public, body `<p>Converted from the chat room "<name>" on YYYY-MM-DD.</p>`), inserts one comment per chat message in order (author/time preserved), re‑points media and reactions to the new comments, re‑parents existing replies under the new comments, deactivates the chat posts, recomputes comment counts/commenters/`recent` flags, adds commenters as followers, archives the space (`status=archived, active=false`), deletes its parent menu entry, records `settings.chat_converted_to_post_id`. No notifications.
- Rooms with > 2000 messages (`CHAT_CONVERSION_QUEUE_THRESHOLD`) create the post immediately and finish in a background job (`Group.convertChatSpaceMessages`), batches of 200.

---

## 6. Permissions

| Capability | Rule |
|---|---|
| View chat | Member of the group/space (space visibility/`required_roles` rules, module 15); paywalled groups require content access. Non‑members of a group are redirected to the group detail/about page. |
| Post | Any member who can view (no `accepted_post_types` restriction for chat). |
| Reply / react / save / flag | Members (flag: not own post). |
| Edit / delete own message | Author only. |
| Remove others' messages, pin/unpin | **Manage Content** responsibility (`RESP_MANAGE_CONTENT`). |
| Silent post | **Administration** in every destination group. |
| Convert chat space | **Administration** in parent group. |
| Socket subscribe / typing | Membership (+ paywall access) in the group id/slug. |
| Read badge/unread | Own rows only. |

---

## 7. API

### 7.1 GraphQL queries

- `group(slug, updateLastViewed: true) { posts(filter:"chat", sortBy:"id", order, cursor, first, offset, search, types) { hasMore total items { …chatRoomPostFields } } }`
- `group { groupViews(menuOnly:true) { id type name order newPostCount lastReadPostId pinnedPostIds … } }` (`fetchGroupViews`) — `newPostCount` / `lastReadPostId` are per current user.
- `GroupView.pinnedPosts` (`fetchViewPinnedPosts(groupId, viewId)`).
- `group.members(sortBy:"last_active_at", first:5)` with `lastActiveAt` (active strip) and `members(sortBy:"name", search, offset)` (panel).

### 7.2 GraphQL mutations

| Mutation | Args | Returns | Notes |
|---|---|---|---|
| `createPost(data)` | `type:"chat"`, `details`, `groupIds`, `imageUrls`, `fileUrls`, `linkPreviewId`, `linkPreviewFeatured`, `skipLinkPreview`, `timezone`, `localId`, … | `Post` | |
| `updatePost(id, data)` | | `Post` | author only |
| `deletePost(id)` | | `{success}` | author only |
| `removePost(postId, groupId/slug)` | | `{success}` | Manage Content |
| `updateGroupViewUser(viewId, lastReadPostId)` | | `GroupView` | chat read position; recomputes count |
| `markViewAsRead(viewId)`, `markGroupAsRead(groupId)` | | `GroupView` / `Group` | |
| `pinPost(postId, viewId)` | | toggles | max 3 |
| `reactOn` / `deleteReaction` | | | module 13 |
| `convertChatSpaceToDiscussion(spaceId, title, dryRun)` | | `{dryRun, queued, messageCount, attachmentCount, reactionCount, replyCount, post}` | |
| `updateGroupSettings(id, {settings:{showPostNoticesInChat}})` | | | toggle lives in the chat view's settings modal: "Show post notices in chat when other post types are created in this group." |
| `updateViewSettings(viewId, settings)` | | `GroupViewUser` | written but unused |

### 7.3 Socket (Sails socket.io) events

| Event | Room | Payload |
|---|---|---|
| `newPost` | `groups/<id>` (+ parent for spaces) | Post payload: `announcement, createdAt, details, editedAt, endTime, id, isPublic, linkPreviewFeatured, location, title, peopleReactedTotal, votesTotal, proposalStatus, proposalOutcome, startTime, timezone, type, updatedAt, votingMethod, attachments[{id,type,url}], commenters:[], commentsTotal:0, creator{id,name,avatarUrl}, groups:[{id,name,slug}] (only the room's group), linkPreview{id,imageUrl,title,description,url}, postReactions:[], proposalOptions, proposalVotes:[], topics[{id,name}], localId` |
| `userTyping` | `groups/<id>` (+ parent) | `{userId, userName, isTyping, groupId}` |
| `roomPresence` | subscriber socket only | `{groupId, members[{id,name,avatarUrl}]}` |
| `memberPresent` | group room | `{groupId, member{id,name,avatarUrl}}` |
| `memberAway` | group room | `{groupId, userId}` |
| `groupUpdated` | group room | `{groupId, updatedByUserId}` → client refetches views |
| `commentAdded` | `posts/<id>` | when a chat post is open in the dialog (module 13) |

Client receive rules for `newPost` in an open chat room: ignore if the payload's group ≠ current room group or `!postAppearsInChat(type, showPostNoticesInChat)`; if a row with the same id (or a pending row with the same `localId`) exists, replace it; otherwise append — auto‑scrolling smoothly only if the viewer is at the bottom (with a 350 ms follow‑up snap if within 200 px), else no scroll (no "N new messages" toast).

REST: `POST /noo/group/:groupId/{subscribe,unsubscribe,typing}`, `POST /noo/user/subscribe`, `GET /noo/heartbeat`.

---

## 8. Edge cases & known quirks

- **Enter does not send** in chat; Alt/Option+Enter does — opposite of most chat apps, and undocumented in the UI.
- "Today", "Yesterday", "Jump to latest post" and the action‑bar tooltips are hard‑coded English.
- The "New posts" divider is not shown if the first unread is the viewer's own message.
- If the composer is focused, scrolling to the bottom does not trigger loading newer pages (prevents keyboard layout shifts from paging).
- Failed sends leave the optimistic (pending) message in the list until reload.
- Edits by others do not arrive live in an open room (no socket event for post updates); reactions added by others also only appear on refetch.
- Socket‑received posts carry no `postReactions` from others' later reactions; optimistic reaction handling tolerates missing arrays.
- A parent group's chat does not show its spaces' chat messages, but the parent socket room *does* receive them (for badges); the room filters by group id.
- Presence roster is per backend process; under multiple processes presence would be incomplete (acknowledged in code).
- `localId` counters reset on reload; only rows flagged `pending` are matched by localId to avoid collisions.
- Old mobile clients could mangle `?postId=123?postId=123`; only the leading digits are used.
- The day divider for the very first loaded message is hidden while older history exists.
- `Ctrl/Cmd+Enter` has no special meaning.
- `updateViewSettings` / per‑view notification overrides are dead (written, never read).
- `ChatRoom.module.scss` contains unused legacy classes (`.newPost`, `.post-chat-box`, `.send-message-button`, …).
- Chat `?search=` filter works through the view header search, but the "New posts"/lastRead logic still applies to the filtered result.
- `TagFollow` model retains legacy chat methods referencing `new_post_count`; unread is not tracked there anymore.

---

## 9. Docs vs. code

| Public docs | Code |
|---|---|
| "#Topics Chat": the #Topics stream "behaves like a chatroom"; tag other #topics to make your chat appear in that topic stream too. | Topic chat rooms no longer exist. Each group/space has one chat view (`group_views.type='chat'`); old topic rooms were migrated into chat **spaces**. Topics are tags/filters only; a chat posted in one room never appears in another room. |
| "All groups now have a #General topic, which all members are subscribed to." | `#general` was removed from all posts (migration `20260821120000_remove_general_tag.js`); groups whose home was `#general` got the chat view as home. |
| "Edit or delete a Post or Chat you created by highlighting it and using the pencil or trashcan icon." | Matches (hover action bar). On touch devices Edit opens the full post editor instead of inline editing. |
| User guide (Group Menu): "In the member-count pill, a green dot means more people are online than fit in the strip." | True for the menu widget (`CurrentlyActiveMembers`: dot = the 6th most‑recent member is active). In the **chat** pill the dot means *anyone other than you is on the live socket roster*. |
| User guide: single‑view spaces are "often used to create additional chat rooms". | Matches (chat spaces). |

Docs say nothing about the Alt/Option+Enter send shortcut, the hourly digest, notices, pins, the width rail or conversion; code is the only source for those.

## 10. Source references

- Web: `apps/web/src/routes/ChatRoom/{ChatRoom.js, chatRoomUtils.js, ChatPost/ChatPost.js, ChatPostNotice.jsx, PinnedPostChips.jsx, ChatMembersPanel.jsx, RoomPresence.store.js, ChatRoom.module.scss}`, `components/ChatEditor/ChatEditor.js`, `components/HyloEditor/HyloEditor.js`, `components/PeopleTyping/*`, `components/CurrentlyActiveMembers/*`, `components/SocketListener/*`, `components/SocketSubscriber/SocketSubscriber.js`, `client/websockets.js`, `graphql/fragments/{chatRoomPostFieldsFragment,groupViewPostsQueryFragment}.js`, `store/actions/fetchPosts.js`, `routes/AuthLayoutRouter/AuthLayoutRouter.js`, `routes/SpaceContent/SpaceContent.js`, `routes/AuthLayoutRouter/components/ContextMenu/{ConvertChatSpaceModal.jsx,isChatOnlySpace.js,SpaceSettingsModal.jsx}`, `util/index.js` (`RECENTLY_ACTIVE_MS`).
- Shared: `packages/shared/src/viewHelpers.js`, `packages/navigation/src/index.js`.
- Backend: `api/models/{Post,GroupView,GroupViewUser,GroupViewPin,Activity}.js`, `api/models/post/{createPost,upsertChatActivityNotice,deletePost}.js`, `api/models/space/convertChatSpaceToDiscussion.js`, `api/graphql/mutations/{group_views,post,spaces}.js`, `api/services/{Websockets,RoomPresence}.js`, `api/services/Search/util.js`, `api/controllers/{GroupController,PostController}.js`, `config/{routes,policies,sockets}.js`.
- Docs: `docs/spaces-and-views-engineering-spec.md` (§2, §7.15, §8).
- Tests: `apps/web/src/routes/ChatRoom/*.test.js`, `apps/web/e2e/{chat-post-edit-touch,chat-width-rail,convert-chat-room}.spec.js`.
