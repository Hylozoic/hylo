# 13 — Posts & comments

> Module owner scope: the post model and every post type; creating, editing, deleting posts; drafts; the post editor; post cards in every view mode; post detail; comments; reactions; mentions & topics; attachments; link previews; saving; pinning; announcements; flagging hooks; followers; read/unread; sharing; HTML rendering.
>
> Deep type-specific behaviour (RSVPs, voting, project members, completion of requests/offers) lives in [14-events-proposals-projects.md](14-events-proposals-projects.md). Track actions → [21-tracks.md](21-tracks.md). Funding-round submissions → [22-funding-rounds.md](22-funding-rounds.md). Chat posts as chat messages → [17-chat-rooms.md](17-chat-rooms.md). Direct messages (posts of type `thread`) → [18-direct-messages.md](18-direct-messages.md). Notification delivery → [19-notifications-email-push.md](19-notifications-email-push.md). Flagging / moderation → [12-roles-permissions-moderation.md](12-roles-permissions-moderation.md). Streams, view modes, filters, pinned posts in views → [15-views-streams-spaces.md](15-views-streams-spaces.md).

---

## 1. Overview

A **post** is the unit of content in Hylo. Every post has a `type`, a creator, optional title and rich-text body ("details"), optional attachments (images, files), optional link preview, up to 3 topics, optional location, optional start/end times, and is posted into one or more **groups/spaces** (cross-posting). Posts may be **public**, in which case they also appear in The Commons (`/public`) to anyone, including logged-out visitors.

Members interact with posts by **commenting** (with one level of threaded replies), **reacting** with any emoji, **saving** (bookmarking), **following** (automatic on interaction), and — for some types — RSVPing, voting, joining, completing.

Stewards (Administration responsibility) can mark posts as **announcements** (extra notification), create **silent** posts (API only), and users with Manage Content can **pin** posts to a view (max 3), **remove** posts from a group, and delete any comment.

The same `posts` table also stores **direct-message threads** (`type = 'thread'`) and their messages are stored as `comments` — see module 18. This module only covers non-thread posts unless stated.

---

## 2. Concepts & data

### 2.1 Post types

Backend enum `Post.Type` (`apps/backend/api/models/Post.js`):

| Value | Creatable via `createPost` | Editable via `updatePost` | Where used / notes |
|---|---|---|---|
| `discussion` | yes | yes | General conversation. Default type in editor. Typed view `discussions`. |
| `request` | yes | yes | "What can people help you with?" Fulfillable. Typed view `requests-and-offers`. |
| `offer` | yes | yes | "What do you have for others?" Fulfillable. Typed view `requests-and-offers`. |
| `resource` | yes | yes | Fulfillable. Typed view `resources`. |
| `project` | yes | yes | Has members, donation link, PM link, budget. Fulfillable. Typed view `projects`. |
| `event` | yes | yes | Requires start+end; RSVPs, invitees, meeting link. Typed view `events`. |
| `proposal` | yes | yes | Options, voting, quorum, statuses. Fulfillable when `completed` or `casual`. Typed view `proposals`. |
| `chat` | yes | yes | Chat-room message (no title). Module 17. Counts toward chat unread badge. |
| `action` | yes | yes | Track action (module 21). Has completion action. No notifications on create. |
| `submission` | yes | yes | Funding-round submission (module 22). Always private (`isPublic` forced false by web). No new-post notifications. |
| `thread` | no (created by `findOrCreateThread`) | no ("This post can't be modified") | Direct-message thread (module 18). |
| `welcome` | no | no | Legacy group welcome post. |
| `chat_activity` | no (system) | no | **Notice type** (`Post.NOTICE_TYPES = ['chat_activity']`): system-generated hourly "chat activity" bucket shown in streams; carries `notice_data` JSON (`recentPostIds` etc.). Skipped by activities, Slack, Zapier, new-post counts. Rendered by `ChatActivityCard`. |

Legacy: `intention` (only referenced by the email-form creator and `fixTypedPosts`), `project` children `is_project_request`.

`validatePostData` allow-list for create/update: `action, chat, request, offer, discussion, project, event, resource, proposal, submission` → otherwise `GraphQLError('not a valid type')`.

#### Web presentation of types (`apps/web/src/store/models/Post.js` `POST_TYPES`)

Order matters (it is the order in the type dropdown): `action, chat, discussion, event, offer, request, resource, project, proposal`. `submission` is **not** in this map.

| type | label | description | primaryColor (RGBA) | backgroundColor | shown on map |
|---|---|---|---|---|---|
| action | Action | Actions that members can take | 0,163,227 | rgba(0,163,227,.2) | no |
| chat | Chat | Quick topic-based chats | 0,163,227 | rgba(0,163,227,.2) | no |
| discussion | Discussion | Talk about what's important with others | 0,163,227 | rgba(0,163,227,.2) | yes |
| event | Event | Invite people to your event | 254,72,80 | rgba(254,72,80,.2) | yes |
| offer | Offer | What do you have for others? | 0,199,157 | rgba(0,199,157,.2) | yes |
| request | Request | What can people help you with? | 102,75,165 | rgba(102,75,165,.2) | yes |
| resource | Resource | Let people know about available resources | 255,212,3 | rgba(255,212,3,.2) | yes |
| project | Project | Create a project that people can help with | 252,128,0 | rgba(252,128,0,.2) | yes |
| proposal | Proposal | Suggest a proposal for others to vote on | 0,163,227 | rgba(0,163,227,.2) | yes |

(The primaryColor/backgroundColor are used by the map module 16. In Tailwind UI, type colors use theme tokens `discussions`, `events`, `requests`, `offers`, `resources`, `proposals`, `projects` — see module 08.)

Icon mapping `getPostTypeIcon(type)` (custom icon font, `components/Icon`):

| type | Icon name |
|---|---|
| chat | `Messages` |
| offer | `Offer` |
| request | `Heart` |
| resource | `Resource` |
| project | `Project` |
| proposal | `Proposal` |
| event | `Calendar` |
| discussion | `Chat` |
| other / `post` | `Post` |

In the **CreateMenu** the icon is `Heart` for request and the capitalised type name otherwise (`Discussion`, `Event`, `Offer`, `Resource`, `Project`, `Proposal`).

In `PostTypePills` (accepted-types pickers, used by custom views / spaces) Lucide icons are used: discussion `MessageSquareText`, event `Calendar`, request `Heart`, offer `Gift`, requests-and-offers `ArrowLeftRight`, resource `BookOpen`, proposal `Vote`, project `FolderKanban`; selected pill style `border-<token> bg-<token>/15 text-<token>`; unselected `border-dashed border-foreground/30 text-foreground/70`.

Post types shown with a location row by default in the editor: `POST_TYPES_SHOW_LOCATION_BY_DEFAULT = ['request','offer','resource','project','event']`.

#### Type ↔ view mapping (`packages/shared/src/viewHelpers.js`)

```
POST_TYPE_TO_TYPED_VIEW = {
  discussion: 'discussions', event: 'events', offer: 'requests-and-offers',
  request: 'requests-and-offers', resource: 'resources', proposal: 'proposals', project: 'projects'
}
CHAT_VISIBLE_POST_TYPES = ['chat','discussion','request','offer','project','proposal','event','resource']
PINNABLE_VIEW_TYPES = ['all','discussions','events','requests-and-offers','resources','proposals','projects','chat','custom','collection']
MAX_PINNED_POSTS_PER_VIEW = 3
```

- `postCountsTowardChatUnread(type)` → only `chat`.
- A group's `accepted_post_types` (jsonb array or null) restricts only the **restricted set** = keys of `POST_TYPE_TO_TYPED_VIEW`. `null` = all; `[]` = none of the restricted set; `chat`, `action`, `submission` are always allowed. The alias `'requests-and-offers'` stored in the array accepts both `request` and `offer`.

### 2.2 `posts` table — fields used by this module

| Column | GraphQL field | Notes |
|---|---|---|
| `id` | `id` | |
| `type` | `type` | see 2.1 |
| `name` | `title` | Max 80 chars enforced by web editor (`MAX_TITLE_LENGTH = 80`, input `maxLength`); no server limit. |
| `description` | `details` | Rich-text HTML; always passed through `RichText.processHTML` on read (§9). |
| `user_id` | `creator` | |
| `created_at`, `updated_at` | `createdAt`, `updatedAt` | `updated_at` is bumped by every new comment (`updateFromNewComment`) — drives unread. |
| `edited_at` | `editedAt` | Set on update only if title or details changed. Shows "edited" timestamp. |
| `active`, `deactivated_at` | — | Soft delete. All queries filter `active = true`. |
| `is_public` | `isPublic` | Forced false at save time unless at least one target group has `allow_in_public = true`. |
| `announcement` | `announcement` | Boolean. Only produces announcement notifications if creator has Administration in that group. |
| `link_preview_id` | `linkPreview` | FK to `link_previews`. |
| `link_preview_featured` | `linkPreviewFeatured` | Show playable video full-width above body. |
| `location`, `location_id` | `location`, `locationObject` | `locationObject` is `false`/null for chat. |
| `start_time`, `end_time`, `timezone` | `startTime`, `endTime`, `timezone` | Client sends epoch ms; stored as timestamps. |
| `fulfilled_at` | `fulfilledAt` | "Completed" state for offer/request/resource/project/proposal. |
| `num_comments` | `commentsTotal` | Count of active **top-level and child** comments (`Comment.where({post_id, active:true})`). |
| `num_commenters` | `commentersTotal` | Distinct active commenters. |
| `num_people_reacts` | `peopleReactedTotal` | Distinct people with ≥1 reaction. |
| `reactions_summary` | `reactionsSummary` | JSON `{ "<emoji>": count }`. |
| `tag_names` | (used by `topics`) | Denormalised sorted lowercase topic names. |
| `flagged_groups` | `flaggedGroups` | Array of group ids (may repeat — one entry per flag). |
| `budget`, `donations_link`, `project_management_link`, `accept_contributions` | same | Project / submission. |
| `meeting_link` | `meetingLink` | Event. |
| `proposal_status`, `proposal_outcome`, `voting_method`, `quorum`, `anonymous_voting` | `proposalStatus`, `proposalOutcome`, `votingMethod`, `quorum`, `isAnonymousVote` | Module 14. |
| `completion_action`, `completion_action_settings`, `num_people_completed` | same | Actions (module 21). |
| `notice_data` | `noticeData` | `chat_activity` notices. |
| `parent_post_id` | — | Legacy project child requests (`updateChildren`). |
| `created_from` | — | e.g. `'email_form'`. |

Defaults on create (`Post.newPostAttrs`): `active=true, num_comments=0, num_commenters=0, num_people_reacts=0`, timestamps now.

Proposal status on create/update (`setupPostAttrs`): no `startTime` → `casual`; start in past → `voting`; else `discussion`; end in past → `completed`. (Module 14.)

### 2.3 Related tables

| Table / model | Purpose | Key columns |
|---|---|---|
| `groups_posts` (`PostMembership`) | Cross-posting: one row per group/space. | `post_id`, `group_id` |
| `posts_users` (`PostUser`) | Per-user state on a post. | `following`, `active`, `last_read_at`, `saved_at`, `muted_at`, `clickthrough`, `completed_at`, `completion_response`, `project_role_id`, `tokens_allocated_to` |
| `posts_tags` (`PostTag`) | Topics on a post. | `post_id`, `tag_id`, `selected` (legacy) |
| `tags` (`Tag`) | Topics (lowercase names). | `name` |
| `groups_tags` (`GroupTag`) | Topic used in a group. | `group_id`, `tag_id`, `user_id`, `is_default`, `visibility` (0 hidden,1 visible,2 pinned), `num_followers` |
| `tag_follows` (`TagFollow`) | User follows topic in a group. | `user_id`, `group_id`, `tag_id`, `last_read_post_id`, `new_post_count`, `settings` |
| `comments` (`Comment`) | Comments and DM messages. | `post_id`, `comment_id` (parent), `user_id`, `text`, `active`, `recent`, `created_from`, `edited_at`, `deactivated_by_id`, `deactivated_at` |
| `comments_tags` (`CommentTag`) | Legacy. | |
| `reactions` (`Reaction`) | Emoji reactions on posts and comments. | `entity_type` (`post`/`comment`), `entity_id`, `user_id`, `emoji_base`, `emoji_full`, `emoji_label` (shortcode e.g. `:+1:`), `date_reacted` |
| `media` (`Media`) | Attachments. | `post_id` or `comment_id`, `type` (`image`, `file`, `video`, `gdoc`), `url`, `thumbnail_url`, `width`, `height`, `name`, `position` |
| `link_previews` (`LinkPreview`) | Cached OG scrape per URL (unique `url`). | `url`, `title`, `description`, `image_url`, `image_width`, `image_height`, `status`, `done` |
| `drafts` (`Draft`) | Server-side drafts. | `user_id`, `type` (`post`/`comment`/`message`), `data` (jsonb), `post_id`, `group_id`, `topic_id`, `message_thread_id`, `post_type`, `is_edit`, `navigate_to` |
| `collections_posts` (`CollectionPost`) | Post ordering in `collection` / `track-actions` views. | `view_id`, `post_id`, `order`, `user_id` |
| `group_view_pins` (`GroupViewPin`) | Pinned posts per view. | `view_id`, `post_id`, `pinned_at` |
| `thanks` (`Thank`) | Legacy "thank" on comments; no UI. | |
| `posts_about_users` | Legacy `relatedUsers`. | |

`PostUser` attribute update whitelist: `project_role_id, following, active, clickthrough, saved_at, muted_at`.

---

## 3. Routes / entry points

### 3.1 Create / edit / duplicate (web)

The post create/edit overlay is **one modal** (`CreatePostModal`) mounted once by `AuthLayoutRouter` over whatever page is showing. It opens when:

| Trigger | URL form | Notes |
|---|---|---|
| Create | `<any path>?create=post[&newPostType=<type>][&lat=..&lng=..][&eventDate=..][&viewId=..][&fromPostId=..][&closePath=..]` | `createPostModalUrl(location, extra)` adds/replaces `create=post` on the current location. |
| Legacy create | `<path>/create` or `<path>/create/post` (but **not** `/members/create`) | Immediately `replace`-navigated to `<path>?create=post` (other params kept). |
| Edit | `<...>/post/:postId/edit` | `editPostUrl(id, routeParams)` = `postUrl(id, {...opts, action:'edit'})`. |
| Duplicate | `<base>?create=post&fromPostId=:id` | `duplicatePostUrl`. Opens the editor pre-filled from the source post: title `Copy of <title truncated to 72 chars>`, event invitations dropped, all other content kept; saving creates a new post. |

Query params read by the editor:

- `newPostType` — initial type. Ignored (falls back to the first allowed type) if not allowed in the current view/group; `action`, `chat`, `submission` are always honoured.
- `lat`, `lng` — map "new post at this location" (module 16); prefill `location = "<lat>, <lng>"`; on save, a coordinate string is converted to a Location row (`ensureLocationIdIfCoordinate`).
- `eventDate` — calendar day click (module 14/15); for `event`, prefills default start/end times for that date (`DateTimeHelpers.defaultEventTimesForDate`).
- `viewId` — post is also inserted into that view's `collections_posts` (collection / track-actions / funding-round-submissions views).
- `fromPostId` — duplicate source.
- `closePath` — where to go when the modal closes.

Closing the modal navigates (`replace`) to `closePath` or, when editing, to the current URL minus `/post/:id/...` and minus `create`; compose-only params `create, newPostType, eventDate, sourceDraftId, closePath, fromPostId` are always stripped (`stripComposeModalQueryParams`).

The modal draft id is `modal:<pathname>:create` or `modal:<pathname>:edit:<postId>` (client-side only).

Other editor mounts (same `PostEditor` component, not the modal): the inline chat composer edit (module 17), track action / funding round submission screens (modules 21/22) which pass `customTopicName`, `markAsReadTopicName`.

### 3.2 Post detail (web)

`postUrl(id, opts)` = `baseUrl(opts) + /post/:id` (+ `/<action>`). `baseUrl` resolves to the context the user is in, so a post opens **as an overlay on top of the current stream/view**:

| Pattern | Example |
|---|---|
| `/groups/:groupSlug/post/:postId` | standalone in group |
| `/groups/:groupSlug/<view>/post/:postId` | over a group view (`stream`, `discussions`, `events`, `map`, `custom/:id`, …) |
| `/groups/:parentSlug/spaces/:spaceSlug/.../post/:postId` | inside a space |
| `/all/post/:postId`, `/all/<view>/post/:postId` | All My Groups |
| `/public/post/:postId`, `/public/<view>/post/:postId` | The Commons (logged-out allowed for public posts) |
| `/my/<view>/post/:postId` | My Home (posts, interactions, mentions, saved) |
| `/post/:postId` | context `''` — bare post URL |
| `/groups/:slug/topics/:topicName/post/:postId` | topic page |
| `.../post/:postId?commentId=:id` or `.../post/:postId/comments/:commentId` | deep link to a comment (scrolls & highlights it) |

Views `post`, `about`, `moderation` are dropped from the base (`postUrl` uses `/groups/:slug/post/:id` instead) because those routes swallow the extra segment.

`primaryPostUrl(post)`: chats go to the group's chat view (`.../chat?postId=:id`, or `.../chat/post/:id?commentId=` when a comment is targeted); other posts open within the group home view if it mounts a post dialog, else the standalone URL.

Server-side links (emails/push) use `Frontend.Route.post(post, group)`; `groupForFrontendRouteForUser` picks a group the recipient belongs to, else `/public/...` form.

### 3.3 Other entry points

- **CreateMenu** — the "+" create menu in the app shell (module 06) and the map context menu (module 16, passes `coordinates`).
- **Post cards** in every stream/view (module 15) — clicking opens detail.
- **Notifications** (module 19), **search results** (module 07), **member profile** recent activity (module 20).
- **Backend REST** (`apps/backend/config/routes.js`):
  - `POST /noo/post/:postId/update-last-read` → mark post read for current user.
  - `POST /noo/post/:postId/subscribe` / `unsubscribe` → join/leave the socket room `post/<id>` (live comments, typing).
  - `POST /noo/post/:postId/typing` → typing indicator broadcast.
  - `GET|POST /noo/hook/postForm` → create post from email digest form (types `offer`, `request`, `resource`, `intention`; title prefixed `"I'd like to share"`, `"I'm looking for"`, `"I'd like to share"`, `"I'd like to create"`; dedup: same title by same user within 5 minutes redirects to the existing post; `created_from='email_form'`; topic = the type).
  - `POST /noo/hook/comment` → reply-by-email creates a comment (`created_from='email'`, text cleaned by `Comment.cleanEmailText`, markdown→HTML).
  - `GET|POST /noo/hook/batchCommentForm` → digest batch comment form.

---

## 4. UX specification

### 4.1 CreateMenu ("What would you like to create?")

- Heading (bold, `text-foreground/80`): **"What would you like to create?"**; when opened from the map with coordinates: **"New post at this location: "**.
- Vertical list (gap 8px) of rows, one per post type in `POST_TYPES` order **excluding** `action`, `chat`, `submission` → `discussion, event, offer, request, resource, project, proposal`, further filtered by the current group's `acceptedPostTypes` (normalised; `null` = all; `requests-and-offers` alias expands to both).
- Each row: rounded-lg, 2px border `foreground/20` (hover `foreground/50`), padding 4px 8px, icon (see §2.1) + label `t(type)` ("Discussion", "Event", "Offer", "Request", "Resource", "Project", "Proposal"); on hover the row scales 105% and a small pill **"Create"** fades in at the right (`bg-selected/30`).
- Final row: **"Group"** with `Groups` icon → `?create=group` (module 09).
- Each link = `createPostModalUrl(location, { newPostType, lat?, lng? })`; clicking also closes the mobile nav drawer.

### 4.2 Create/edit modal shell

- Full-viewport overlay, `z-index: 70` (above map drawer and map post column), scrollable vertically, never horizontally.
- Backdrop: `hsl(var(--primary) / 0.7)` with 2px blur; clicking it = close attempt.
- Content wrapper: centered, width 100%, `max-width: 800px`, padding 20px (8px under 600px width).
- Close "×" (`Ex` icon) at top-right (top 24px, right 24px).
- Animation: enter — background fades in 200ms; wrapper slides in from the right (`right: -100% → 0`, 250ms) and fades (400ms). Exit — fades out and moves up 100px (200ms).
- **Close with unsaved changes** (editor reports dirty): shows `UnsavedDraftLeaveDialog` (z 1300, black/50 overlay with blur, white card max-w-md):
  - Title: **"Save draft before closing?"**
  - Body: **"You have unsaved changes to this post. Save a draft to continue later, or discard them."**
  - Buttons stacked full-width: **"Continue editing"** (outline; closes dialog), **"Discard"** (red; resets editor to initial state, deletes the server draft, closes), **"Save"** (primary `bg-selected`, autofocused; closes — the draft is already auto-saved on the server).
- Android hardware back / app back handler: closes the confirm dialog if open, else performs a close attempt.

### 4.3 Post editor layout (top → bottom)

Container: `rounded-lg bg-background p-3 shadow-2xl border-2 border-foreground/30`, vertical flex gap 16px; a soft 20px gradient shadow sits above the top edge. `data-testid='post-editor'`. Every field row is a rounded `bg-input` strip with a small grey label on the left (`text-xs text-foreground/50`) and a 2px border that turns `border-focus` when focused.

First open shows a floating invitation **"Want a quick tour of the post editor?"** (tour `POST_EDITOR_TOUR_ID`, steps anchored by `data-tour` attributes):

| Step anchor | Title | Description |
|---|---|---|
| `post-type` | Post types | Discussions start conversations, requests and offers exchange help, proposals collect votes, and events gather people. |
| `post-to` | Post to one or more groups | A post can reach several groups at once. Groups that don't accept this post type are not listed. |
| `post-body` | Topics | Type # in the body to tag up to three topics, so your post is easier to find. |
| (announcement) | Announcement | Marks the post as important and sends a notification to every member. |
| `post-public` | Public posts | Make a post visible beyond your groups — anyone can see it and it can appear in The Commons. |

Field visibility matrix (✓ shown; — hidden):

| Row | discussion | request / offer / resource | project | event | proposal | chat (edit) | action | submission |
|---|---|---|---|---|---|---|---|---|
| Header: type selector | ✓ | ✓ | ✓ | ✓ | ✓ | "Editing Chat" | "Add/Edit {{actionDescriptor}}" | "Add/Edit {{submissionDescriptor}}" (default "Submission") |
| Submission criteria box | — | — | — | — | — | — | — | ✓ if funding round has non-empty criteria |
| To (destinations) | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Title | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| Details (rich text) + link preview + image & file managers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Project Members | — | — | ✓ | — | — | — | — | — |
| Public toggle | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Proposal template / options / voting method / quorum / anonymous vote | — | — | — | — | ✓ | — | — | — |
| Timeframe ("Voting window" for proposals) + Timezone | — | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Completion action section | — | — | — | — | — | — | ✓ | — |
| Location ("Venue" for events) | via 📍 button | ✓ default | ✓ default | ✓ default | via 📍 button | — | via 📍 | via 📍 |
| Join link (meeting link) | — | — | — | ✓ | — | — | — | — |
| Invite People | — | — | — | ✓ | — | — | — | — |
| Accept Contributions | — | — | ✓ only with `PROJECT_CONTRIBUTIONS` feature flag | — | — | — | — | — |
| Donation Link, Project Management | — | — | ✓ | — | — | — | — | — |
| Budget Total | — | — | ✓ | — | — | — | — | ✓ if round `requireBudget` |
| Actions bar | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (no 📍) | ✓ | ✓ |

Rows in detail:

1. **Type selector** (`PostTypeSelect`): shadcn Select, `h-8 border-2 w-fit`; options `t(type)` for every `POST_TYPES` key except `action` and `chat`, i.e. Discussion, Event, Offer, Request, Resource, Project, Proposal; filtered by **allowed types** (only when creating): the current view's types (e.g. a `requests-and-offers` view → request+offer; `useAllowedPostTypesForView`) intersected with the current group's `acceptedPostTypes` (`action`/`chat`/`submission` always pass). The current type stays selectable even if not allowed. Hidden when composing inside a funding round. Default type = `newPostType` if allowed, else the first allowed in dropdown order, else `discussion`.
   - **Switching type** keeps title/body/etc. (the in-progress payload is carried over), rewrites `newPostType` in the URL (replace), removes destinations that don't accept the new type, refocuses title. If the server already has a saved draft for the target type **and** carried content exists, a dialog asks: title **"Load saved {{type}} draft?"**, body **"You already have a saved draft for this post type. Keep what you are currently writing, or replace it with the saved draft."**, buttons **"Keep what I am writing"** (outline) / **"Load saved draft"** (red). Per-type in-session drafts are remembered while the editor is open.
2. **To** field (`ToField`, §4.4).
3. **Title**: label "Title"; plain `<input>` `maxLength=80`; `data-testid='post-editor-title'`; Alt/Option+Enter saves. When length ≥ 80 a yellow (`#FFB949`, black text) banner appears: **"Title limited to 80 characters"** (`Title limited to {{maxTitleLength}} characters`). Autofocused 100ms after open (chat edits focus the body end instead).
4. **Details**: `HyloEditor` with toolbar (§4.5), placeholder **"Add a description"**, min one line, grows; Alt/Option+Enter saves. Below it inside the same box: editor link preview card (§4.9), then image manager and file manager (shown only once there is at least one attachment or an upload in progress; each headed by a dashed top border and label **"Images"** / **"Files"**, with a dashed "+" tile (100×100) / **"+ Add File"** tile (100×30) to add more).
5. **Project Members** (project): `MemberSelector` scoped to the selected groups. Creator is always added to `memberIds` on save.
6. **Public toggle** (`PublicToggle`): styled switch (`--selected` when on) + text:
   - off: **"Make Public - Currently this post will only be visible within groups you select."**
   - on, and some selected group `allowInPublic`: **"Public Post - This post will be publicly visible and shareable. This post will be visible in The Commons."**
   - on otherwise: **"Public Post - This post will be publicly visible and shareable."**
   - Default on when composing in the `public` context.
7. **Proposal rows** (summary; full behaviour in module 14): "Proposal template" select (only while there are 0 options) with templates Yes/No, Poll Single Vote, Multiple Choice, Advice, Consent, Consensus, Gradient of Agreement; "Proposal options*" list (emoji select from a fixed list + "Describe option" text + ✕), **"Add an option to vote on..."**, warning **"When options are changed, existing votes will be discarded"** (editing), **"Proposals require at least one option"**; "Voting method": **"Single vote per person"** (`single`) / **"Multiple votes allowed"** (`multi-unrestricted`); "Quorum" slider 0–100% with info tooltip (`quorumExplainer`: "Quorum is the percentage of members who need to participate in the decision for it to be considered valid"); anonymous-vote toggle.
8. **Timeframe** (types other than discussion/action/submission/chat): label "Timeframe" (proposal: "Voting window"); two date-time pickers (minute granularity, placeholder **"Select Start"** / **"Select End"**) separated by "to". Touch devices use native OS pickers stacked in a 2-column grid; desktop uses the custom picker honouring the user's 12/24h cycle. Changing start sets end = start + previous duration (default 1h) unless the user had explicitly removed the end. For non-events a small round ✕ inside each picker removes start (also clears end) or end ("Remove start time" / "Remove end time"). Proposals ask first (dialog titles **"Remove the voting window?"** / **"Remove the voting end time?"**, bodies per §4.3 copy table, buttons "Cancel" / "Remove" red). Inline error when end ≤ start: red banner **"End Time must be after Start Time"**. **Timezone** row: `TimezoneSelect` (default browser zone); changing zone keeps wall-clock times.
9. **Completion action section** (action): dashed box, question **"How can people complete this {{actionDescriptor}}?"**, select of `button` ("Mark complete / Done button"), `comment` ("Leave a Comment"), `reaction` ("Emoji Reaction"), `selectMultiple` ("Multiple Choice - Select Multiple"), `selectOne` ("Multiple Choice - Select One"), `text` ("Respond to a question or prompt"), `uploadFile` ("Upload attachment"); textarea **"Completion Instructions for Members"** auto-filled with `postCompletionActions.<value>.instructions` when the action changes; for select actions a list of "Option N" text inputs + **"Add an option"**. Module 21.
10. **Location** row: label "Location" (event: "Venue"); `LocationInput` (Mapbox geocoder, saves Location rows); placeholder: proposal **"Is there a relevant location for this proposal?"**, event **"Where is the event taking place?"**, others **"Where is your {{type}} located?"**.
11. **Join link** (event): text input, placeholder **"Add a video call link (Zoom, Meet, Jitsi, etc.)"**; label turns red if not a valid URL. Pasting/typing a Zoom/Meet/Jitsi/Teams URL into the body auto-fills it if empty (`isMeetingUrl`).
12. **Invite People** (event): `MemberSelector` scoped to selected groups.
13. **Accept Contributions** (project, feature flag `PROJECT_CONTRIBUTIONS`): switch if the user has a Stripe account, otherwise text "To accept financial contributions for this project, you have to connect a Stripe account. Go to Settings to set it up. (Remember to save your changes before leaving this form)". Server field documented "NOT USED RIGHT NOW".
14. **Donation Link** / **Project Management** (project): text inputs, placeholders **"Add a donation link (must be valid URL)"**, **"Add a project management link (must be valid URL)"**; labels red when invalid. Saved through `sanitizeURL` (adds `https://` if missing; invalid → null).
15. **Budget Total** (project; submission when round requires budget): free text.
16. **Save error** banner (red, `role=alert`, `data-testid='post-editor-save-error'`): see §4.3.2.
17. **Actions bar** (§4.6).

#### 4.3.1 Validation (client; submit button disabled until valid)

Messages are joined with `<br />` and shown as the submit button's hover tooltip:

| Condition | Message |
|---|---|
| event: missing start or end, or start ≥ end | **Valid start and end time required** |
| event: meeting link present and not a URL | **Video call link must be a valid URL** |
| project: donation or PM link present and invalid | **Donations and project management links must be valid URLs** |
| proposal: 0 options | **At least one proposal option required** |
| chat: no text and no attachment | **Chat must have text or an attachment** |
| non-chat: empty title or > 80 chars | **Title is required** |
| no destination group | **At least one group required** |

Server-side validation (`validatePostData`, `createPost`, `setupPostAttrs`): see §5.1.

#### 4.3.2 Save

- Submit: the send-arrow button, Alt+Enter (Windows/Linux) / Option+Enter (Mac) in title or body. Helper label left of the button (italic, `text-xs text-foreground/50`): create **"Alt-Enter to post"** / **"Option-Enter to post"**; edit **"Alt-Enter to save"** / **"Option-Enter to save"** (Mac detected via `navigator.platform`).
- Guarded against double submit. While pending the button is disabled (label text "Posting..." when used).
- Editing a proposal: browser `confirm("Changing proposal options will reset the votes. Are you sure you want to continue?")` before every save (even if options unchanged).
- If the announcement toggle is on → opens `SendAnnouncementModal` first (§4.7); "Send It" performs the save.
- Payload built: title, details (`editor.getHTML()`; for chat, empty HTML is sent as `''`), `topicNames` (≤3), `groupIds`, `isPublic` (forced false for submission), `imageUrls` & `fileUrls` (ordered), `linkPreviewId`, `linkPreviewFeatured`, `skipLinkPreview` (create only), location/locationId, `startTime`/`endTime` as epoch ms, timezone, `meetingLink` (trimmed, sanitised), `memberIds`, `eventInviteeIds`, `proposalOptions`, `votingMethod`, `quorum`, `isAnonymousVote`, `completionAction(+Settings)`, `donationsLink`, `projectManagementLink`, `budget`, `acceptContributions`, `announcement` (from `sendAnnouncement`, create only), `fundingRoundId`, `trackId`, `viewId`, `markAsReadTopicName`, `localId` (`post_N`, for optimistic insert), `type` (an edited chat always stays `chat`).
- Creates are **optimistic**: a pending post (creator = me, createdAt now, attachments) is inserted into streams and replaced by the server post matching `localId`.
- Success: server draft deleted, dirty cleared, `afterSave(returnedPost)` (modal closes). Failure: editor keeps content, drafts resume, red error banner shows:
  - `POST_TYPE_NOT_ACCEPTED` (extensions `{code, postType, destinations}`): **"{{destinations}} does not accept {{postType}} posts"** (one) / **"{{destinations}} do not accept {{postType}} posts"** (many); destinations formatted with `Intl.ListFormat` in the UI language; spaces labelled `Parent / Space`.
  - otherwise the server message, or **"There was an error, please try again."**
  - The banner clears when the type or destinations change.

### 4.4 To field (destinations / cross-posting)

- Row label "To"; chips for each selected destination with avatar + name; typing filters options; dropdown `bg-midground rounded-lg p-2 shadow-md`.
- **Options** (`toOptions`): the user's memberships (groups and **joined** spaces; archived groups and paywalled groups without access are excluded), plus the current group, plus — when inside a space — its parent group.
  - Order: the current top-level group first (if it accepts the type), followed by its joined child spaces sorted by name; then every other top-level group alphabetically, each followed by its joined spaces.
  - Spaces display as **"Parent Name / Space Name"** using the parent's avatar and the space's icon.
  - Groups/spaces that don't accept the current post type are omitted (a parent that refuses is omitted but its accepting spaces are still listed).
- Default selection: the current group/space (when creating), unless the current space isn't joined. Once the user touches the To field the route group is never re-injected.
- Topic & mention autocomplete is scoped to selected group ids (fallback: current group; none → all accessible).

### 4.5 Rich-text editor (HyloEditor, TipTap)

Extensions: StarterKit (paragraph, headings 1–3, bold, italic, strike, code, code block, blockquote, bullet/ordered lists, hard break, horizontal rule, history), Placeholder, Image (`allowBase64`, class `w-full h-auto`), Link (autolink, default protocol `https`, `openOnClick:false`, non-inclusive, `target` stripped), **mention** (`@`), **topic** (`#`), Highlight (`<mark>`), Video embed node.

- **Toolbar** (`showMenu`): Bold, Italic, Strikethrough, Code, Link (popover "Add link"/"Edit link" with fields "Link text", "URL", buttons Cancel / Remove link / Add|Save), Emoji insert (inserts into the last focused of title/body), Bullet list, Ordered list, Blockquote, Code block, Undo, Redo, Clear formatting. Extended menu (welcome pages etc., not posts): H1–H3, inline image upload, video embed (prompt "Video URL"; only YouTube/Vimeo — alerts "Sorry, your video must be hosted on YouTube or Vimeo.").
- **Paste**: in post editors `<img>` tags are stripped from pasted HTML.
- **Links**: every link recognised (typed, pasted, autolinked) calls `onAddLink(url)` → debounced (500ms) link-preview fetch for the **first** link only (subsequent links ignored while a preview exists). When the caret is in a link, a bubble menu offers **"Add Preview"** (ScanEye icon) to force-replace the preview with that link.
- **Mentions** (`@`): suggestion popup (tippy, bottom-start) lists up to 7 people via `people(autocomplete, groupIds, first:7, offset)`, with "load more" paging; spaces allowed in the query; closes on Escape or when the query has >1 space and no results. Inserted node HTML:
  `<span class="mention" data-type="mention" data-id="<userId>" data-label="<Name>">Name</span>` (rendered text = label).
- **Topics** (`#`): popup lists up to 7 topics via `topics(autocomplete, groupIds, first:7)`; if the query is >2 chars it is offered first as a new topic; duplicates removed. Inserted HTML:
  `<span class="topic" data-type="topic" data-id="<name>" data-label="#<name>">#name</span>`. Selecting a topic also adds it to the post's topic list (max `MAX_POST_TOPICS = 3`; further topics are inserted in text but not attached).
- **Video embed node**: `<video data-type="embed" src="https://www.youtube.com/embed/…">`; only https YouTube / youtube-nocookie / player.vimeo.com sources allowed.
- Clicking empty space around the editor focuses the end. On touch devices scrolling blurs the editor (hides keyboard).

### 4.6 Actions bar

Left (each a 24px Lucide icon in a 32px box; hover / active colour `#0DC39F`):

| Icon | Action |
|---|---|
| `ImagePlus` | Upload images (Filestack picker, multiple up to 10). Highlighted & disabled once images exist (add more via the "+" tile). `data-testid='add-image-icon'`. |
| `Paperclip` | Upload files (multiple up to 10). Same highlight rule. `add-file-icon`. |
| `MapPin` | "Add Location" — reveals the location row. Hidden for chat or when already shown. |
| `Megaphone` | "Send Announcement" toggle — only when `canMakeAnnouncement`: type not action/submission/chat **and** the user has Administration in **every** selected group. `announcement-icon`. |

Right: helper text + send button (`SendHorizontal` 18px; `text-highlight` when enabled, muted when disabled; `data-testid='post-editor-submit'`; disabled tooltip lists validation errors).

### 4.7 SendAnnouncementModal

Opened on submit when the megaphone is active. Heading **"MAKE AN ANNOUNCEMENT"**. Body:
- 1 group, admin of all: **"This marks the post as important and notifies everyone who hasn't turned off post notifications."**
- >1 group, admin of all: **"This marks the post as important and notifies everyone in the {{groupCount}} selected groups who hasn't turned off post notifications."**
- not admin of all (only reachable from older flows): the same plural sentence + **"This will only be sent as an Announcement to the groups where you are a Moderator. For other groups it will be shared as a regular Post."**
Buttons: **"Go Back"** (primary; closes) and **"Send It"** (secondary; saves).

### 4.8 Attachments

- Upload provider: **Filestack** picker (web). Sources — images: local file, URL, webcam, Instagram, Facebook, image search, Google Drive, Dropbox; files: local, URL, Google Drive, Dropbox. Accepted MIME: images `image/*`; files `video/*, audio/*, application/*, text/*`. **Max 10 files per pick, max 50 MB (52,428,800 bytes) each.** Filenames have spaces replaced by `-`.
- After pick, the client calls the backend upload (`uploadAttachment(type='post', id=postId|'new')`); the backend re-downloads by Filestack handle (SVGs converted to PNG via Filestack), validates permission (`post`: id `new` always allowed; existing post: only its author, or anyone for `action` posts — used for completion uploads), and stores on S3 at `…/user/<userId>/post/<id>/<name>_<ts>_<rand>.<ext>`.
- **Image processing**: post and comment images are auto-rotated by EXIF and resized to **max width 1200px** (no enlargement; SVG untouched). `Media` rows for images get `width`/`height` measured. Video media (legacy) get thumbnails (YouTube `hqdefault.jpg`, Vimeo oEmbed).
- Image order is drag-reorderable (dnd-kit, horizontal); `position` = index. Removing: ✕ badge on each thumbnail / file row.
- File preview row in editor: `Document` icon, decoded filename (last URL path segment), ✕.
- On update, image and file lists **replace** the existing media of that type when provided.
- Remote image URLs (not on Hylo storage) passed via API are attached in the background (`rehostAndAttachImages`).

### 4.9 Link previews

- Editor: first link → `findOrCreateLinkPreviewByUrl(url)`; client normalises URLs (`/path` → `https://hylo.com/path`; no scheme → `http://`); polls up to 4 times (delays 0.5s, 1s, 1.5s) while the server populates. A preview without a title is treated as invalid and not shown.
- Editor preview card (full width, `mx-3 mt-2`): 64px square image (if any), title (bold, link icon, truncated), description (2 lines), domain (grey), ✕ **Remove** (sets `skipLinkPreview`, so the server won't auto-generate one). For playable video URLs (YouTube/Vimeo), hovering the image shows Expand/Shrink to toggle **featured**; when featured a blue banner reads **"Featured: This video will be full-width, displayed above the description, and playable."** New video previews default to featured.
- Display card (`LinkPreview`): an `<a target=_blank>` card: rounded-lg, border, shadow, image square (min 64px) left, then title (bold, link icon), description (2-line clamp), domain; hover scale 102%. Featured videos instead render an embedded iframe player full width above the body (`Feature`).
- Server: `link_previews.url` unique. Population fetches the URL with UA `Twitterbot/1.0`, 3s timeout, 5MB cap, parses OG via `link-preview-js`; title falls back to hostname (minus `www.`); image = first OG image or favicon. **Hylo post URLs** (`/post/:id` on hylo.com/www/staging/localhost/configured domain) are previewed from the post itself only if the post is **public** (title = summary, description = first 144 chars of text, image = first image); private posts never leak.
- If a post is created without a preview (API, Zapier, email) and not `skipLinkPreview`, the server reuses a finished preview for the first external URL in details/title or queues `generateLinkPreview` (2s delay).

### 4.10 Post cards (stream view modes)

The stream's view mode (module 15) selects one of four renderers. All cards: clicking anywhere (except links, list items, mention/topic spans, buttons) opens post detail (`viewPostDetails(post)` → `postUrl` on the current base). Cards of fulfilled posts render at 60% opacity. Pinned-in-current-view posts get a gold indicator (§4.10.5).

Derived display fields (`presentPost`): `createdTimestamp` = `humanDate(createdAt)` (relative: "now", "5m ago", "3h ago", "2d ago", "1w ago", "3 mo ago", "1y ago"); `createdTimestampShort` = same without " ago"; `exactCreatedTimestamp` = Luxon `D t ZZZZ` in the user's locale (tooltip); `editedTimestamp` = `Edited <humanDate(editedAt)>` (literal English "Edited"); attachments sorted by `position`.

#### 4.10.1 Card (default) — `PostCard`

Container: `rounded-xl p-1 mb-4 border-2 border-card/30 shadow-xl bg-card/50` (dark: `bg-card`), hover → `bg-card`, `shadow-2xl`, `scale-101`, border `foreground/50`, raised z. Highlighted (deep-linked) → `border-accent/50`. `data-testid='post-card'`.

Top → bottom:

1. **Header** (`PostHeader`, p-2):
   - Avatar (medium, 40px) linking to the creator's profile (group-scoped when in a group).
   - Creator name (bold, base size, tooltip = creator tagline). Under it, in My/All/Public contexts or for child-group posts, a grey line **"in {{groupName}}"** / **"in {{groupName}} and 1 other"** / **"in {{groupName}} and {{count}} others"** (space preferred as the named group).
   - Relative timestamp (`text-2xs`, grey; tooltip exact time).
   - **Pinned** badge when pinned in the current view: gold pill (`bg hsl(45 45% 90%)`, border `hsl(45 45% 60%)`, text `hsl(45 60% 35%)`; dark variants), pin icon + uppercase "PINNED" (label hidden on phones).
   - Type pill (not for `submission`): 28px high, rounded-md, 2px border `foreground/20`, type icon + translated type label (capitalised).
   - Announcement: "•" then megaphone icon (`Announcement`, accent colour), tooltip "Announcement".
   - Right side: flag badge (red disc) when flagged in the current group (tooltip lists reasons or "See why this post was flagged", links to the group's moderation page); **More** (⋯) dropdown in a 28×28 bordered box (§4.10.6). Hidden when `constrained`.
   - Time window chip (types `action, offer, request, resource, project, proposal` with times): `bg-selected/10 text-selected text-xs font-bold rounded-lg`, text built as:
     - start in future → **"Starts: {{from}}"**; else end in future → **"Started: {{from}}"**; nothing if fulfilled.
     - fulfilled before end → **"Completed: {{endTime}}"**; end in future → **"Ends: {{endTime}}"**; past → **"Ended: {{endTime}}"**.
     - both → `"<start> / <end>"`. Dates via `formatUserDatePair` (user locale / timezone).
   - Action posts use a different header (`ActionHeader`): **"✓ Completed"** (secondary border) + "Completed {{date}}" on the right, **"▶ Next {{actionDescriptor}}"** (accent) for the current action, or **"◌ Not Completed"**.
2. **Images** (`CardImageAttachments` in card mode): first image shown full width, `object-contain`, `max-height: 50vh`, inside a rounded-xl box whose background is the same image blurred (`blur-2xl`, scaled 110%) with a 40% black overlay (letterbox fill). Remaining images as 80px-high thumbnails (2px card border, shadow) in a horizontal row overlaid at the bottom-right (15px from bottom). In card mode clicking images opens the post, not the lightbox. Flagged → images blurred 30px.
3. **Body** — event posts use `EventBody` (date block + RSVP, module 14); others `PostBody`:
   - Flag cover (if flagged and not revealed): centered pill "This post may not align with group or platform agreements." + reasons + **"View post"** button; revealing is per-view only.
   - **Title** (`text-xl font-bold`), preceded by green ✓ (`CircleCheckBig`) when fulfilled; then italic **"Completed {{timestamp}}"** (date format `DD`).
   - Location line (pin icon, `text-xs` grey) using `LocationHelpers.generalLocationString`; a URL-looking location renders as an external link.
   - Meeting link line (video icon) **"Join online"** (external link).
   - **Details**: featured video embed (if `linkPreviewFeatured` and playable) above; then HTML truncated to **144 characters** (`truncateHTML`, sanitised) in cards (full in detail); bottom fade overlay; rendered via `ClickCatcher` + `HyloHTML` (§9).
   - Edited timestamp (small grey, tooltip exact).
   - Budget (project/submission, expanded only): **"Budget: <value>"**.
   - Link preview card (unless featured video) and file attachment rows (`CardFileAttachments`: rounded `bg-midground` link rows with `Document` icon + decoded file name, open in new tab, hover scale 105%).
   - Proposals: `PostBodyProposal` voting UI (module 14).
4. **Footer** (`PostFooter`): left — `EmojiRow` (§4.13); right — a `bg-darkening/5 rounded-lg` box with `PeopleInfo` for commenters: up to 3 small round avatars + caption:
   - 0 → **"Be the first to comment"**; 1 → "<FirstName> commented" ("You commented"); 2 → "<A> and <B> commented"; ≥3 → "<A>, <B> and N other(s) commented". Current user sorted last (first when exactly 2). First names only.
   - Logged-out: no avatars/names; link to `/login?returnToUrl=…` with **"Be the first to comment"** / **"1 person commented"** / **"{{count}} people commented"**.

**Chat mode** (`chat` prop — used when posts appear as notices inside chat rooms, module 17): above an indented card (`ml-12`) a line with large avatar, **"<Name> created a [type pill]"**, megaphone if announcement, timestamp at right, flag link. On hover a floating toolbar (top-right) offers: **Reply** (opens detail), Edit (creator), Save/Unsave, Flag (non-creator), Delete (creator, red), Remove From Group (non-creator with Manage Content, red), emoji picker. Logged-out: only Copy Link. The inner card omits the header.

#### 4.10.2 List row — `PostListRow`

Gmail-style 3-column grid `160px | 1fr | auto`, gap 12px, `bg-card rounded-md px-4 py-3`, hover scale 102% + border:
- Col 1: creator name (bold, truncate); below: type icon + lowercase type + child-group label (grey xs).
- Col 2: flag icon (if flagged), pin icon (gold), fulfilled ✓, **title** (bold, truncate) + comments pill (`text-[10px] rounded-full bg-foreground/10`) "**N comment(s)**" when >0; second line: events → event time display; others → plain-text details truncated to 150 chars (1 line clamp).
- Col 3: relative timestamp.
- Opacity 60% when flagged (not clicked through) or fulfilled. (An `unread` bold style exists but is hard-coded false.)

#### 4.10.3 Grid item — `PostGridItem`

- With an image as **first** attachment: 180px-tall tile, image as cover background, bottom gradient (`darkening` 0.9 → 0.4 → transparent), white title (2-line clamp, `text-sm bold`) with pin/✓, footer row: tiny avatar, creator name (bold), optional group label, short timestamp right. Flagged → centred red flag over blurred backdrop.
- Without image: `bg-card` tile max 180px: title, plain-text details (200 chars), footer row as above.
- Hover scale 105%.

#### 4.10.4 Big grid item — `PostBigGridItem`

- Image variant: 400px tall, cover image with stronger gradient (0.95/0.6/0.2); bottom overlay: event date badge (events), avatar+name+short time, group label, title (`text-lg`, 2 lines), RSVP box **"Can you go?"** + RSVP control (events, logged in, not past), donation link box (service logo for cash/clover/gofundme/opencollective/paypal/squareup/venmo + **"Contribute"**), `EmojiRow`.
- Text variant: max 400px card: event date + meta + title, plain-text details (400 chars, 8-line clamp), file indicator ("1 attachment" / "N attachments") when first attachment is a file, RSVP box, donation link, bottom fade, footer (emoji row etc.).
- Hover scale 102%.

#### 4.10.5 Pin indicators

Card: 1px inset gold ring (`hsl(45 60% 45% / .45)`) + "Pinned" badge; list/grid: gold `Pin` icon before the title. Pinned posts are listed first in the view (module 15).

#### 4.10.6 Post "More" menu (card header and detail header)

Items (shown only when applicable; logged-out → only Copy Link):

| Item | Icon | Shown when | Behaviour |
|---|---|---|---|
| Edit | Pencil | viewer is creator | navigate to `editPostUrl` |
| Copy Link | Link2 | always | copies `origin + postUrl(id, routeParams)` to clipboard (no toast) |
| Pin to View / Unpin from View | Pin / PinOff | in a group, a pinnable current view exists, viewer has **Manage Content** | toggles via `pinPost`. Disabled with tooltip when the post is from a child group/space ("You cannot pin a post from a child group to this view" / "…from a space to this view") or the view already has 3 pins ("You can only pin 3 posts"). |
| Save Post / Unsave Post | Bookmark / BookmarkCheck | logged in | §5.8 |
| Flag | Flag | viewer is not creator | opens `FlagGroupContent` (in a group) or `FlagContent` (module 12) |
| Duplicate | Copy | logged in | opens editor with `fromPostId` |
| Add to Collection ▸ | Library | viewer has Administration or Manage Content, not chat, group has ≥1 `collection` view | submenu of collection views; already-added ones disabled and labelled "{{name}} (already added)" |
| Remove from Collection | LibraryBig | same responsibilities, currently viewing a collection view | confirm "Remove this post from the collection?" |
| Delete (red) | Trash2 | creator | confirm **"Are you sure you want to delete this post? You cannot undo this."** → `deletePost`; navigates to the URL without `/post/:id` |
| Remove From Group (red) | Trash2 | not creator, has **Manage Content** in current group | confirm **"Are you sure you want to remove this post? You cannot undo this."** → `removePost(postId, groupSlug)` |

### 4.11 Post detail

Rendered either inside **PostDialog** (overlay on the centre column) or full-page (view `post` — e.g. `/groups/:slug/post/:id`, where the app header shows "<Type>: <title>" with the type icon and a back button, and no close ×).

**PostDialog**: non-modal Radix dialog portalled into `#center-column-container`; backdrop `bg-darkening/50` (dark `/90`) with blur, z 100; content z 101, centered, `min-width 300px`, `width calc(100% - 16px)`, **`max-width 750px`**, `max-height calc(100% - 16px)`, scrollable, `p-3 rounded-md bg-background`; fade + slide-in-from-bottom 300ms. Clicking backdrop / Escape / hardware-back closes (popping history to the previous location when possible). Not dismissed while text is selected, or when interacting with the Filestack picker. If the comment box has unsaved content, closing shows `UnsavedDraftLeaveDialog` "Save draft before closing?" / **"You have unsaved text in your comment. Save it as a draft to continue later, or discard it."**. Touch: pull down at top / pull up at bottom ≥100px (dampened ×0.45) closes with animation.

Layout (`.PostDetail`, max-width 960px, min 290/350px):

1. `PostHeader` in **expanded** mode with close × (`data-testid='post-detail-close'`). Expanded adds:
   - **Completion toggle** (`PostCompletion`) for request/offer/resource/project and proposal (when status `completed` or `casual`) if viewer is creator or has Administration/Manage Content in any of the post's groups: box with prompt **"Is this request still needed?"**, **"Is this offer still available?"**, **"Is this resource still available?"**, **"Is this project still active?"**, **"Is this proposal still open?"** + Yes/No switch (on = not fulfilled). Moderators (non-creator) see an accent box headed **"Moderator"**.
   - Proposal outcome input (creator, fulfilled proposal): placeholder "Summarize the outcome" (module 14).
2. **PostGroups** "To:" strip (`bg-darkening/10 rounded-lg mx-2`), shown if cross-posted or public (i.e. not exactly the current group): "To: GroupA, GroupB and N others ▾"; public posts list a **Public** pseudo-group first (globe icon); first 2 names linked, "and" before last; arrow expands to a full `GroupsList`.
3. A sticky copy of the header appears when scrolled past it (scroll offset 60px); sticky footer when scrolled past the activity section.
4. Body card (`bg-card rounded-lg shadow-md`): flag cover (whole card), images (`CardImageAttachments`, lightbox enabled: zoom up to 3×, counter, close on backdrop, z 150), `EventBody` (expanded; RSVP; invitees dialog) or `PostBody` expanded (full details, budget). Events with meeting link: dashed box **"Join this event online"** + **"Join online"** button. Projects: join/leave box ("Join Project" / "Leave Project", members PeopleInfo — "No project members", "is a member", "are members"), PM tool box (logo for asana/trello/airtable/clickup/confluence/teamwork/notion/wrike/zoho: "This project is being managed on <logo>" + "View tasks"; else "View project management tool"), donation box ("Support this project on <logo>" / "Support this project" + "Contribute"). Contributions widget only with feature flag. Actions: `ActionCompletionSection` (module 21). Then `PostFooter`.
5. For action posts and viewer with Administration: completions box ("No one has completed this action yet" / "has completed this action", **"View All Responses"** → `ActionCompletionResponsesDialog`).
6. **Comments** section (§4.12).
7. `PostPeopleDialog` for project members ("Project Members") / event responses ("Responses").
8. Socket subscription to room `post/<id>` while open.

Document head: `<title>` "<title or first 20 chars of text> | Hylo"; meta description (144 chars). For **public** posts OpenGraph/Twitter tags: `og:type=article`, `og:site_name=Hylo`, `og:title`, `og:description`, `og:image` (first image), `twitter:card` (`summary_large_image` if image else `summary`).

Loading: `PostDetailSkeleton`; not found / not visible: `NotFound`. A `chat_activity` notice post redirects to its chat room. Analytics event `Post Opened`. Deep link `commentId` scrolls the comment to centre (after 500ms) and highlights it (fetching earlier pages until found).

`fetchPost` loads comments only for logged-in viewers.

### 4.12 Comments

**Data shape / ordering**
- Top-level comments are fetched **10 at a time, newest-first from the server** (`comments(first:10, cursor, order:"desc")`) and **displayed oldest→newest** (newest at the bottom, next to the composer). Each top-level comment includes its latest **4** replies (`childComments(first:4, order:"desc")`).
- **"View N previous comment(s)"** link at the top (shown while `hasMore`; N = total − loaded; literal English, pluralised with "s") loads the next 10 older (cursor = oldest loaded id).
- Threading depth: **one level** — replies attach to a top-level comment (`comment_id`). Replying to a reply creates a sibling reply under the same parent, pre-filled with an @mention of the person replied to (`<p><mention>&nbsp;</p>`). Replies show the latest `INITIAL_SUBCOMMENTS_DISPLAYED = 4` (+ any added this session), with their own "View N previous comments" (10 per page) indented `ml-6`.

**Comment row** (`CommentContainer`, px-4, highlighted style when selected):
- Row 1: medium avatar + **name** (bold sm, links to profile) · relative time (grey xs, tooltip exact `D t ZZZZ`) · "(edited <relative>)" when edited.
- Hover actions (top-right, logged-in, not editing): Reply (`Replies` icon, tooltip "Reply"), Edit (Pencil, creator only), Delete (Trash red, creator; confirm **"Are you sure you want to delete this comment"**), Remove (Trash red, non-creator with Manage Content in the current group; confirm **"Are you sure you want to remove this comment?"**), emoji picker.
- Attachments: images (`CardImageAttachments`, lightbox), files (`CardFileAttachments`).
- Body: `HyloHTML` indented 40px inside `ClickCatcher`.
- Reactions row (`EmojiRow`, compact 26px pills).
- **Editing** in place: `HyloEditor` with the current HTML; Enter saves (if not empty), Escape cancels; ✓ / ✕ icons — ✕ confirms **"Do you want to discard your edit?"**. Attachments are not editable in the UI.

**Composer** (`CommentForm`, bottom of thread, `bg-input rounded-lg p-2`, focus border):
- Current user's small round avatar; `HyloEditor` (max-height 200px, scrolls; mentions/topics scoped to the post's groups); placeholder **"Add a comment..."** (reply box: "Reply to <Name>").
- Buttons: formatting-toolbar toggle (`CaseSensitive`, aria "Toggle formatting toolbar"), image upload (multiple), send (round `bg-selected`, white arrow).
- Hint below (desktop only): **"Press Alt-Enter to comment"** / **"Press Option-Enter to comment"**. Alt/Option+Enter submits.
- Empty submit (no text, no attachments) → `alert("You need to include text to post a comment")`.
- Typing emits throttled "is typing" (`STARTED_TYPING_INTERVAL`) over the socket; `PeopleTyping` shows "X is typing…" below the composer.
- Drafts: auto-saved to the server (`type:'comment'`, keyed by post) 1s after typing; restored on reopen; cleared on send; deleted when the text is emptied.
- Mobile: auto-focus within 500ms of mount is suppressed; on focus the form scrolls into view.
- Logged-out: comments are **not** fetched; the section shows "No comments yet" / "1 person commented" / "{{count}} people commented" and a **"Log in to see comments"** button (`/login?returnToUrl=…`; new tab in iframes).
- Creating is optimistic (temp id `post<id>_N`), then scrolls detail to bottom.

### 4.13 Reactions (posts and comments)

- **Any emoji** (emoji-mart picker, full Unicode set incl. skin tones; data loaded from `cdn.jsdelivr.net/npm/@emoji-mart/data`; light theme). Trigger: `SmilePlus` icon (20px).
- Selecting an emoji you already used removes it; otherwise adds. Picker closes after selection.
- `EmojiRow`: reactions aggregated by `emojiFull`, sorted by count desc.
  - If exactly 2 distinct emoji → both pills shown. Otherwise the most popular is shown as a pill and, if there are ≥3 distinct, the rest collapse into one **overflow pill** showing the next 3 emoji (2 on phones) + "…" + their summed count; clicking opens a popover with all the overflow pills.
  - Pill: emoji (1.25em) + count; selected (mine) → `bg-selected`. Tooltip (logged-in only) lists reactor names separated by `<br>`. Tap toggles my reaction.
  - Picker button sits after the pills (comments: before, `alignLeft`). Logged-out: counts only, no names, no picker, pills not clickable.
- **ReactionsDrawer** (logged-in; touch long-press on a pill or overflow pill): bottom sheet (max-h 75vh, max-w lg, rounded-t-2xl, drag handle; swipe down ≥80px closes; overlay `bg-darkening/40`). Title **"{{count}} reaction(s)"**. Tabs: **"All N"** then one per emoji (count), most popular first. List rows: avatar (fetched lazily in one aliased query, up to 100 people, cached; initial-letter fallback), name ("You" for me with sub-label **"Tap to remove"**), emoji at right. Tapping my row removes that reaction; others link to the person's profile. Closes automatically when no reactions remain.
- Desktop hover on a pill shows the names tooltip instead of the drawer.

---

## 5. Business rules & side effects

### 5.1 Create post (`createPost` mutation → `models/post/createPost.js`)

Order of operations:

1. `convertGraphqlPostData`: maps `title→name`, `details→description`, `linkPreviewId→link_preview_id`, `linkPreviewFeatured`, `skipLinkPreview`, `groupIds→group_ids`, `locationId`, `meetingLink`, `isPublic`.
2. `validatePostData`:
   - type in allow-list else **"not a valid type"**;
   - proposal with `proposalOptions: []` → **"Proposals need at a least one option"**;
   - no groups → **"no groups specified"**;
   - more than 3 `topicNames` → **"too many topics in post, maximum 3"**;
   - user must be a member of **all** groups → **"unable to post to all those groups"**.
3. Silent posts (`silent: true`, API only): cannot be announcements (**"A silent post cannot be an announcement"**); creator must have Administration in every destination (**"Only a group steward can create a silent post"**).
4. `assertGroupsAcceptPostType`: for restricted types, every destination must accept it; else `GraphQLError("<A>, <B> and <C> do(es) not accept <type> posts")` with `extensions {code:'POST_TYPE_NOT_ACCEPTED', postType, destinations}` (destinations in the order given, spaces labelled `Parent / Space`).
5. `setupPostAttrs`: `is_public` forced false unless some destination has `allow_in_public`; times converted from epoch ms; proposal status computed; `user_id` = caller.
6. In a transaction: insert post, then `afterCreatingPost`:
   - attach `groups_posts` (deduped);
   - **followers** = creator + every user mentioned in details (`posts_users.following=true, active=true`);
   - media rows: `imageUrls` (type `image`, position = index), `fileUrls` (type `file`), legacy `imageUrl`, `videoUrl`, `docs` (gdoc);
   - `trackId` → `Track.addPost` (module 21); else `viewId` → append to `collections_posts` with `order = max+1`; `fundingRoundId` + submission → `FundingRound.addPost` (module 22);
   - project → set members; event → queue `processEventCreated` (owner auto-RSVPs yes, invitees, calendar subs, RSVP email unless silent); proposal → insert options;
   - **topics**: `Tag.updateForPost` — lowercase, dedupe, sort; create missing `tags`; attach `posts_tags`; for each destination group the **editor** is a member of: ensure `groups_tags` row (bumps `updated_at`) and make the post author **follow** the topic in that group (`tag_follows`); write `posts.tag_names`;
   - link preview: §4.9;
   - `notifyAndMarkAuthorRead`: unless silent, push socket event **`newPost`** to room `group/<id>` for each destination (payload includes only that group) and also to each space's parent group room; touch `groups_tags.updated_at` for the post's tags (except action/submission); mark the author's typed view (and chat view for chat posts) read up to this post and resync the author's badge counts.
   - Background (skipped when silent): `incrementNewPostCountForCreatedPost` (per-member unread for the typed view; chat view for chat posts; then membership badge sync), `createActivities`, funding-round steward notice, `notifySlack` (groups with `slack_hook_url`), `zapierTriggers` (`new_post` triggers; optional per-trigger type filter; JSON payload id, announcement, createdAt, creator{name,url}, details, endTime, isPublic, location, startTime, timezone, title, type, url, groups[{id,name,url,postUrl}], topics[{name}]).
   - Remote image URLs → background `rehostAndAttachImages`; chat posts (not silent) → `upsertChatActivityNotice` (hourly chat-activity notice post, module 17).
7. After success: delete the matching server **post draft** (`type='post', groupId=first group, topicId (chat only), postType, isEdit=false`). Errors in cleanup are logged, never thrown.

**Activities** (`Post#createActivities`; delivery in module 19). Notice types produce none. Reasons:
- `mention` — each user @mentioned in details.
- `chat` (chat posts) — every member of each destination; delivery honours each member's chat notification setting (all/important/none).
- `newPost: <groupId>` — every member of each destination, for all types **except** `chat`, `action`, `submission`.
- `announcement: <groupId>` — additionally, when `announcement` is true **and** the creator has Administration in that group.
- `eventInvitation` — event invitees (actor = inviter).
Former members (inactive membership in all of the post's groups) are dropped; the creator never gets an activity.

### 5.2 Update post (`updatePost`)

- Same `validatePostData` (incl. membership in all destinations). **No author check on the server** (see §8).
- Only types `action, chat, discussion, event, offer, project, proposal, request, resource, submission` are editable; others → **"This post can't be modified"**; missing → **"Post not found"**.
- `edited_at` set when details or title differ from the stored values.
- Event changes (start, end, location, meeting link) recorded before save → `processEventUpdated` (re-sends RSVP updates when any changed).
- After save: update project child requests (legacy), **groups diff** (attach new / detach removed), media replace (only for kinds passed: `imageUrls` replaces all images, `fileUrls` all files), topics replaced if `topicNames` passed, **newly mentioned users** become followers and get a `mention` activity; project members (if `memberIds`), proposal options (if passed: when options already existed all votes are deleted and `voteReset` activities created for voters).
- `Post.afterRelatedMutation(id, {changeContext:'edit'})` → queued `publishPostUpdates` → GraphQL `postUpdates` subscription.
- Web does not send `announcement` or `skipLinkPreview` on update.

### 5.3 Delete / remove

- `deletePost(id)`: only the **creator** (**"You don't have permission to modify this post"**; missing → **"Post does not exist"**). Soft delete: `active=false, deactivated_at=now`; removes activities for the post; removes it from tracks; queues new-post-count decrement and chat-activity notice rebuild; events → `processEventDeleted` (cancellation RSVP emails, calendars). Returns `{success:true}`.
- `removePost(postId, groupId|slug)`: requires **Manage Content** in that group; deletes only the `groups_posts` row for that group (post remains elsewhere / for author). Errors: "Couldn't find post with id N", "You don't have permission to remove this post".
- Web: delete/remove are optimistic and close the detail view.

### 5.4 Fulfil / unfulfil ("completed", "no longer needed")

`fulfillPost` / `unfulfillPost` — allowed for the creator, or a user with Administration or Manage Content in any of the post's groups, for types `offer, request, resource, project, proposal` (proposal only when status `completed`/`casual`). Fulfil sets `fulfilled_at = now` (+ optional contributors → `Contribution` rows); unfulfil clears it and removes contributions & their activities. Moderator actions notify the author (`postFulfilled` / `postUnfulfilled` activity). Publishes `postUpdates` with context `completion`. Details in module 14.

### 5.5 Comments

`createComment(data: {postId, parentCommentId?, text, attachments?})`:
- Post must be visible to the user (`Post.isVisibleToUser`: public, or in a group of theirs, or they follow it) else **"post not found"**; blank (no text after trim, no attachments) → **"Can't create a blank comment"**. Parent id is not validated against the post.
- Insert `comments` row (`recent=true`, `created_from` e.g. `'email'`); media from `attachments[{url, attachmentType}]` with positions.
- Commenter and newly @mentioned users become **post followers**; `UserConnection` "message" rows between commenter and existing followers.
- Socket `commentAdded` to room `post/<postId>` with `{id, createdAt, creator{id,name,avatarUrl}, post, parentComment, text}`; GraphQL pubsub `comments:postId:<id>` and, for replies, `comments:commentId:<parentId>`.
- Activities: `newComment` for every follower except the actor; `commentMention` for each mentioned user (includes `parent_comment_id`). (Messages in `thread` posts take the DM path instead — module 18.)
- Queued `Post.updateFromNewComment`: mark the 2 newest comments `recent`, recount `num_comments` / `num_commenters`, set `posts.updated_at = now`, **mark the post read** for the commenter, complete an `action` post whose completion action is `comment`, publish `postUpdates` (`comment`).
- Deletes the user's comment draft for that post.

`updateComment(id, data)`: only the creator (**"You don't have permission to edit this comment"**); blank → **"Can't create a blank comment"**; sets `edited_at` if text changed; newly mentioned users followed (no mention activity); attachments replaced only if a non-empty list is passed; publishes to both comment channels.

`deleteComment(id)`: creator, or anyone with **Manage Content** in any of the post's groups. Soft delete (`active=false, recent=false, deactivated_by_id, deactivated_at`), removes its activities, decrements `num_comments`, recounts commenters. Child replies of a deleted comment remain active in the DB but are reached only via the parent (UI hides them).

### 5.6 Reactions

`reactOn(entityId, {entityType:'post'|'comment', emojiFull})` / `deleteReaction(...)`; `entityType` otherwise → error "entityType invalid: you need to say its a post or a comment".
- One reaction per (user, entity, emoji); duplicates ignored. `emoji_base = emoji_full` (skin-tone base not split); `emoji_label` = emoji-mart shortcodes.
- Post: reacting makes the user a **follower**; `reactions_summary[emoji]` incremented, `num_people_reacts` +1 if it's their first emoji on the post; deleting decrements (people count only when it was their last). An `action` post with completion action `reaction` is completed. Publishes `postUpdates` (`reaction`).
- Comment: no counters; publishes to comment subscriptions and pushes a socket reaction update.
- No notifications for reactions.
- Legacy `vote(postId, isUpvote)` = 👍 reaction.

### 5.7 Topics

- Name validation `Validators.validateTopicName` (shared) used by `createTopic`; post topic names from the editor are taken from topic nodes; server lowercases.
- Text pattern recognised for legacy tag parsing: `(?:^| |>)#([A-Za-z][\w_-]+)`.
- Max 3 topics per post (client and server).
- `createTopic(topicName, groupId, isDefault, isSubscribing=true)` — member of the group required ("That group does not exist." / "You're not a member of that group."), creates tag, `groups_tags`, and follow.
- `subscribe(groupId, topicId, isSubscribing)` follows/unfollows a topic in a group (`groups_tags.num_followers` ±1).
- Topic clicks in post HTML go to search `/search?t=%23<name>[&groupSlug=]` (§9). Topic pages / chat rooms: modules 15/17.

### 5.8 Saving posts

`savePost(postId)` → sets `posts_users.saved_at = now` (creates the row with `following=true, active=true` if absent — i.e. saving also follows); `unsavePost` → `saved_at = null` (following unchanged). Saved posts listed in My Home → Saved (`posts(savedBy)`, module 15). Optimistic in UI.

### 5.9 Following / subscription

`posts_users.following` is set automatically when a user creates, is mentioned in, comments on, reacts to, votes on, or saves a post. Followers receive `newComment` notifications. There is no explicit follow/unfollow control for posts on web (email "unfollow" link uses `Frontend.Route.unfollow`). `muted_at` exists (used for DM threads).

### 5.10 Read / unread

- `posts_users.last_read_at` per user. Marked read by `POST /noo/post/:postId/update-last-read`, and automatically when the user comments. `markAsUnread` sets it to 1ms before the latest comment (used by DM threads).
- `PostUser.whereUnread`: followed, not muted, `last_read_at` null or older than `posts.updated_at`.
- Web stream "new" indicators are per **view**, not per post: `GroupViewUser.new_post_count` / `last_read_post_id` (orange dots on typed views, numeric chat badge — module 15/17). Post cards show no unread styling.
- `unreadCountForUser` = comments created after last read (0 if read after `updated_at`).

### 5.11 Pinning

`pinPost(postId, viewId)` toggles: view type must be in `PINNABLE_VIEW_TYPES` ("Posts cannot be pinned to this view"); caller needs Manage Content in the view's group ("You don't have permission to modify this group"); post must be in that group ("Couldn't find post in this group"); max 3 ("You can pin up to 3 posts in this view"). Stored in `group_view_pins` with `pinned_at`.

### 5.12 Announcements

`announcement=true` stored on the post for anyone, but announcement activities only go to groups where the creator has Administration. Announcements are listable via `posts(announcementsOnly:true)` and show the megaphone icon.

### 5.13 Public posts / The Commons

`is_public=true` (and at least one destination with `allow_in_public`) → visible to anyone including logged-out (`posts`/`post` public queries), listed in `/public` streams/map. Logged-out viewers: see post content, reaction counts (no names), commenter count, Copy Link only; cannot see comments.

### 5.14 Real-time

| Channel | Event | Use |
|---|---|---|
| Socket room `group/<id>` | `newPost` | Insert new posts into streams; payload = `getNewPostSocketPayload` (title, details, type, times, location, attachments, creator, groups (one), linkPreview, topics, localId, empty commenters/reactions). |
| Socket room `post/<id>` | `commentAdded`, `userTyping` | Live comments and typing indicator on post detail. |
| GraphQL subscription | `comments(postId, parentCommentId)` | New/updated comments & comment reactions. |
| GraphQL subscription | `postUpdates` | Post edits, reactions, votes, completion, comment counts (used by mobile). |
| GraphQL subscription | `peopleTyping(postId)` | Typing. |

### 5.15 Drafts

`saveDraft(type, data, postId?, groupId?, topicId?, messageThreadId?, postType?, isEdit?, navigateTo?)` upserts the unique draft for a context:
- `post` + `isEdit` → keyed by `postId`; `post` new → `groupId` (if given) + `topicId` (or null) + `postType` (or null); `comment` → `postId`; `message` → `messageThreadId`.
- Refused unless it has content: post drafts need a non-empty title or body text (**"Draft must include a title or body content"**); post data must be JSON (**"Post draft data must be valid JSON"**); comment/message stored as a JSON string.
- Web post editor saves 1.5s after changes (payload: title, details, type, topics, group ids, isPublic, location(+Id), meetingLink, linkPreview(+Featured, skip), acceptContributions, completionAction(+Settings), proposalOptions, start/end ISO, timezone, donation & PM links, quorum, votingMethod, sendAnnouncement, trackId); restores on open (merging with route defaults); deletes when title and body are emptied; deleted after successful submit. Comment drafts save after 1s.
- `deleteDraft(id)` (owner only), `draft(...)` query, `navigateTo` lets a drafts list reopen the composer (module 05/06).

---

## 6. Permissions

| Action | Who |
|---|---|
| View post | Anyone if public; otherwise members of any of its groups, or a follower; posts by users you blocked (or who blocked you) are hidden. Platform admins bypass. Groups listed on a post are filtered to those visible to the viewer. |
| View comments | Logged-in viewers who can see the post (comments by blocked users hidden); anonymous only on public posts (web never fetches them for anonymous). |
| Create post | Member of every destination; type accepted by every destination. Silent: Administration in all. |
| Mark announcement (UI) | Administration in every selected group. |
| Edit post | UI: creator only. Server: any member of all destinations (§8). |
| Duplicate | Any logged-in viewer. |
| Delete post | Creator. |
| Remove post from a group | Manage Content in that group (UI hides it for the creator). |
| Pin / unpin to view | Manage Content in the view's group. |
| Add/remove from collection | Administration or Manage Content. |
| Fulfil / unfulfil | Creator, or Administration/Manage Content in any of the post's groups. |
| Comment / react | Logged-in user who can see the post (reactOn has no visibility check server-side). |
| Edit comment | Comment creator. |
| Delete comment | Comment creator, or Manage Content in any of the post's groups (UI: Manage Content in the current group). |
| Flag | Logged-in non-creator (module 12). |
| Upload post attachment | New post: anyone; existing post: creator (any user for `action` posts). |
| See all action completion responses | Administration in a group the post is in; others see only their own. |

---

## 7. API

### Queries

- `post(id)` → `Post` (public resolver for anonymous with `isPublic` filter).
- `posts(...)` / `group.posts(...)` / `viewPosts` — filters: `activePostsOnly, afterTime, beforeTime, announcementsOnly, boundingBox, collectionToFilterOut, context ('all'|'my'|'public'), createdBy, cursor, filter (type), first, forCollection, groupSlugs, interactedWithBy, isFulfilled, mentionsOf, offset, order, proposalOutcome, proposalStatus, rsvpResponse, savedBy, sortBy, search, topic, topics, types` (module 15).
- `comment(id)`; `Comment.childComments(cursor, first, order)`.
- `topics(autocomplete, groupIds, first)`, `topic(id|name)`, `topicFollow(groupId, topicName)`.
- `people(autocomplete, groupIds, first, offset)` (mention suggestions).
- `draft(type, postId, groupId, topicId, messageThreadId, postType, isEdit)`.

`Post` fields: see schema excerpt in §2.2 plus `attachments(type)`, `comments(first, cursor, order)`, `commenters(first)` (current user first, blocked excluded), `creator`, `followers`, `followersTotal`, `groups`, `linkPreview`, `moderationActions`, `members`, `postMemberships`, `postReactions`, `myReactions`, `proposalOptions`, `proposalVotes`, `topics` (ordered as `tag_names`), `savedAt`, `clickthrough`, `completedAt`, `completionResponse`, `completionResponses`, `myEventResponse`, `eventInvitations`, `localId`, `tokensAllocated`, `totalTokensAllocated`, `fundingRound`, `noticeData`, `noticePosts`. Dead/unused fields: `acceptContributions`, `totalContributions`, `isStrictProposal`, `attachmentsTotal`, `groupsTotal`, `topicsTotal`, `postReactionsTotal`, `reactionsTotal`.

`Comment` fields: `id, text, createdAt, editedAt, createdFrom, creator, post, parentComment, childComments, attachments(type), attachmentsTotal, commentReactions, myReactions, commentReactionsTotal (unused)`.

`Reaction`: `id, emojiBase, emojiFull, emojiLabel, entityId, entityType, userId, createdAt, post, user`.

`LinkPreview`: `id, url, title, description, imageUrl, imageWidth, imageHeight, status`.

### Mutations

| Mutation | Args | Returns |
|---|---|---|
| `createPost` | `data: PostInput` | `Post` |
| `updatePost` | `id, data: PostInput` | `Post` |
| `deletePost` | `id` | `GenericResult` |
| `removePost` | `postId, slug | groupId` | `GenericResult` |
| `fulfillPost` / `unfulfillPost` | `postId` | `GenericResult` |
| `completePost` | `postId, completionResponse: JSON` | `Post` (module 21) |
| `pinPost` | `postId, viewId` | `GenericResult` (toggle) |
| `savePost` / `unsavePost` | `postId` | `Post` |
| `createComment` | `data: CommentInput {postId, parentCommentId, text, attachments:[{url, attachmentType}]}` | `Comment` |
| `updateComment` | `id, data: CommentInput` | `Comment` |
| `deleteComment` | `id` | `GenericResult` |
| `reactOn` / `deleteReaction` | `entityId, data: ReactionInput {entityType, emojiFull}` | `Post` (the entity) |
| `vote` (deprecated) | `postId, isUpvote` | `Post` |
| `findOrCreateLinkPreviewByUrl` | `data: {url}` | `LinkPreview` or null while pending |
| `createTopic` | `topicName, groupId, isDefault, isSubscribing` | `Topic` |
| `subscribe` | `groupId, topicId, isSubscribing` | `GenericResult` |
| `saveDraft` / `deleteDraft` | see §5.15 | `Draft` / `GenericResult` |
| `recordClickthrough` | `postId` | `GenericResult` (module 12) |
| `flagInappropriateContent` | module 12 | |
| `peopleTyping` | `postId` | `GenericResult` |
| `addPostToView` / `removePostFromView` / `reorderViewPost` | module 15 | |
| Proposal & event mutations | module 14 | |

`PostInput` fields: `acceptContributions, announcement, budget, completionAction, completionActionSettings, details, donationsLink, endTime, eventInviteeIds, fileUrls, fundingRoundId, groupIds, imageUrls, isAnonymousVote, isPublic, isStrictProposal, linkPreviewId, linkPreviewFeatured, skipLinkPreview, silent, localId, location, locationId, meetingLink, markAsReadTopicName, memberIds, projectManagementLink, proposalOptions, votingMethod, quorum, startTime, timezone, title, topicNames, trackId, viewId, type`.

---

## 8. Edge cases & known quirks

- **`updatePost` has no server-side author/moderator check** — any user who is a member of all destination groups can edit any post via the API. The UI only offers Edit to the creator.
- `deleteComment` UI checks Manage Content in the *current route group*, server checks any of the post's groups.
- `Comment#createActivities` filters mentions with `u.id !== actorId` on plain ids, so self-mentions are not filtered (a user mentioning themselves in a comment gets a `commentMention` activity, though the delivery layer may drop it).
- Comment attachment update uses `attachment.type`, create uses `attachment.attachmentType`; passing an empty attachments list on update leaves existing attachments untouched (cannot remove all).
- Web comment composer uploads without restricting MIME type but only sends **image** attachments (`getAttachments(...'image')`); non-image files uploaded in a comment are silently dropped.
- `num_comments` counts replies too, while `post.comments` returns only top-level comments.
- `markAsReadTopicName` is accepted by `createPost` but unused.
- `CreateMenu` filters out `submission`, though `submission` is not in web `POST_TYPES`.
- The `TopicSelector` row in the editor is commented out; topics are only added through `#` in the body.
- `StrictProposalToggle` is commented out; `isStrictProposal` has no effect.
- Every edit of a proposal prompts the "reset votes" confirm, even when options didn't change; the server only resets votes if options are passed and existed.
- `ShowMore` copy ("View N previous comment(s)") is hard-coded English, as is `editedTimestamp` "Edited …" and the PostHeader outcome placeholder "Summarize the outcome".
- Copy Link builds `origin + postUrl(routeParams)` (context-relative); chat-mode cards always use `/groups/<slug>/post/<id>` (broken when no group).
- Posts are soft-deleted; restoring is not exposed.
- Reactions: `emoji_base` always equals `emoji_full`.
- `Post.isVisibleToUser` treats followers as viewers even after leaving the group.
- No post view counter exists.
- Flag cover reveal is ephemeral per mount (re-shows on reopen), separate from the persisted `clickthrough`.
- Duplicate truncates the copied title to 72 chars before prefixing "Copy of " (English, not translated).

---

## 9. HTML rendering rules

**Storage**: post `description` and comment `text` are TipTap HTML. Allowed tags on output (`TextHelpers.insaneOptions`): `a, br, em, p, s, strong, li, ol, ul, img, div, iframe, mark, span, blockquote, code, hr, pre, h1–h6` (+ `video` for raw-stored page content; markdown adds `del, table, thead, tbody, tr, th, td`). Allowed attributes: `a`/`span`: `class, target, href, data-type, data-id, data-label, data-user-id, data-entity-type, data-search`; `code`: `class`; `iframe`: `src, title, frameborder, height, width, allow, allowfullscreen`; `div`: `class`; `img`: `src, alt, title, class, width, height`. `iframe`/`video` survive only with https `www.youtube.com`, `youtube.com`, `www.youtube-nocookie.com`, `youtube-nocookie.com` or `player.vimeo.com` sources.

**Server `processHTML` on every read** (`Post#details`, `Comment#text`):
1. Autolink bare URLs (class `linkified`).
2. Remove `target` from all anchors; add class `hylo-link` to internal Hylo URLs.
3. Normalise legacy mentions (`<a data-entity-type="mention" data-user-id>`) to `<span class="mention" data-type="mention" data-id data-label>`; legacy topics (`data-entity-type="#mention"` or href-less `#text`) to `<span class="topic" …>`.
4. Add class `mention-current-user` to mentions of the requesting user.
5. Sanitise.

**Email** (`qualifyLinks`): mention/topic spans become absolute links (`/groups/<slug>/members/<id>`, `/groups/<slug>/topics/<name>`, or `/all/...`); relative links prefixed with the site URL.

**Web `HyloHTML`**: wraps HTML in an element with class `global-postContent`; converts `<video data-type="embed" src>` to a responsive 16:9 iframe (`aspect-video`, `my-4`) — dropping non-whitelisted sources; rewrites scheme-less hrefs to `https://`.

**Web `ClickCatcher`** (wraps rendered HTML):
- Click on `.mention` → navigate to `mentionPath(id, groupSlug)` = `/groups/<slug>/members/<id>` (or `/all/members/<id>` outside a group) — the member profile (module 20 covers hover cards on avatars/names).
- Click on `.topic` / `.hashtag` → `/search?t=%23<name>[&groupSlug=<slug>]`.
- Click on `<a>`: same root domain (www-insensitive) and not a static marketing page (`/blog/…` etc.) → SPA navigation; otherwise opens in a new tab (`target=_blank`).
- Other clicks bubble (cards then open the post).

Card truncation: `truncateHTML(details, 144)` (sanitised). Plain-text summaries: `presentHTMLToText` (links' hrefs ignored). `Post#summary()` = title or first 80 chars of text.

Mobile app renders the same HTML in its own `HyloHTML` (module 25).

---

## 10. Docs vs. code

| Docs say | Code does |
|---|---|
| Following a #Topic sends notifications when someone creates a post with that topic. | No `tag` activity is created on post creation; post notifications go to group members by group (`newPost`) and chat-room members. Topic follows drive topic/chat-room lists and unread only. |
| "To" box lists each chatroom in each group; sending to "#Bugs" adds the topic. | The To field lists groups and **joined spaces** ("Parent / Space"); chat rooms are not destinations. Topics come only from `#` in the body. |
| A post can be started from a chat message and "expanded" to other types. | Editing a chat keeps type `chat` ("Editing Chat"); type conversion from chat is not offered in the post editor (chat composer flows are in module 17). |
| Clicking a post opens it in a window to the right side. | Opens a centred overlay dialog (max 750px) over the centre column (map uses a side column — module 16). |
| Post shows #Topics used (click to go to topic stream). | Cards/detail do not render a topics line (the `TopicsLine` component is unused); topics appear inline in the body and link to search. |
| Mark request "no longer needed"/offer "Unavailable" by editing. | Done via the completion switch in post detail ("Is this request still needed?"), not the editor. |
| Any steward post can be an Announcement. | Megaphone shown only when the user has Administration in every selected group and type is not chat/action/submission. |
| Optimal image ratio guidance. | Images are resized to max width 1200px server-side; no ratio enforcement. |
| Embedding videos: double-click link → "Add Preview" → hover thumbnail → featured. | Matches; additionally the first video link is auto-previewed and auto-featured. |
| Project custom icons for GitHub. | PM-tool logos: asana, trello, airtable, clickup, confluence, teamwork, notion, wrike, zoho (no GitHub); donation logos: cash, clover, gofundme, opencollective, paypal, squareup, venmo. |

---

## 11. Source references

Backend: `apps/backend/api/models/Post.js`, `Comment.js`, `Reaction.js`, `PostUser.js`, `PostMembership.js`, `PostTag.js`, `Tag.js`, `TagFollow.js`, `LinkPreview.js`, `Media.js`, `media/util.js`, `Draft.js`, `CollectionPost.js`, `GroupViewPin.js`, `Thank.js`; `api/models/post/{createPost,updatePost,deletePost,setupPostAttrs,validatePostData,util,updateChildren,fulfillPost,postFulfillmentPermissions,rehostAndAttachImages,upsertChatActivityNotice}.js`; `api/models/comment/{createComment,updateComment,deleteComment,util,notifications}.js`; `api/graphql/mutations/{post,comment,draft,savePost,topic,moderation_actions,index}.js`; `api/graphql/{schema.graphql,makeModels.js,makeSchema.js,filters.js}`; `api/services/{RichText,TagManagement}.js`; `api/controllers/PostController.js`; `config/routes.js`; `lib/uploader/{index,validation,converter,types}.js`.

Shared: `packages/shared/src/{TextHelpers.js,viewHelpers.js,constants.js}`; `packages/navigation/src/index.js`.

Web: `apps/web/src/components/{CreateMenu,CreatePostModal,PostEditor (PostEditor.js, ActionsBar.jsx, PostEditor.store.js, postDraftUtils.js, postSaveErrorMessage.js, LinkPreview),PostTypeSelect,PostTypePills,PostCard (PostCard.jsx, PostHeader, PostBody, PostTitle, PostContent, PostFooter, PeopleInfo, PostGroups, PostCompletion, Feature),PostListRow,PostGridItem,PostBigGridItem,PostLabel,PostDialog,HyloEditor,HyloHTML,ClickCatcher,AttachmentManager,UploadAttachmentButton,CardImageAttachments,CardFileAttachments,LinkPreview,EmojiRow,EmojiPicker,EmojiPill,ReactionsDrawer,PublicToggle,SendAnnouncementModal,UnsavedDraftLeaveDialog,FlagBadge}`; `apps/web/src/routes/PostDetail/{PostDetail.js,Comments/*}`; `apps/web/src/store/models/Post.js`; `store/actions/{createPost,updatePost,createComment,fetchComments,fetchChildComments,reactOnEntity,fetchReactorAvatars}.js`; `store/presenters/presentPost.js`; `hooks/useDraft.js`; `client/filestack.js`; `util/{childGroupLabel,url,constants}.js`; `tours/postEditorTour.js`; `graphql/queries/{CommentsQuery,SubCommentsQuery}.js`; `apps/web/public/locales/en.json`.

Docs: gitbook `guides/hylo-user-guide-1/posts*.md`, `topics.md`, `embedding-media-in-hylo.md`.
