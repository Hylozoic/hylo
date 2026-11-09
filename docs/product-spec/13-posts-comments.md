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

