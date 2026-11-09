# 21 — Tracks & actions

> Learning journeys ("Tracks") made of ordered **action** posts that members complete, with completion tracking, a completion message and an optional completion role/badge.
>
> Related: spaces, space lifecycle (draft / published / archived), More Spaces, space menus and the Add Space dialog → [15-views-streams-spaces.md](15-views-streams-spaces.md); action post type, post editor, post cards → [13-posts-comments.md](13-posts-comments.md); roles/badges → [12-roles-permissions-moderation.md](12-roles-permissions-moderation.md); paywalled (paid) track spaces, offerings, scopes → [23-paid-content-stripe.md](23-paid-content-stripe.md); notifications pipeline → [19-notifications-email-push.md](19-notifications-email-push.md); member directory completion pills → [20-members-profiles.md](20-members-profiles.md); joining spaces → [10-joining-invitations.md](10-joining-invitations.md).

---

## 1. Overview

A **Track** is a guided sequence of steps. In the current architecture **every track is a space** (a child `Group` with `type = 'space'`) whose `track_id` points to a `tracks` row (1:1; `tracks.group_id` points back). The space supplies the track's name, description, banner, purpose, welcome page, access/visibility and lifecycle; the `tracks` row supplies track-specific settings and counters.

- Stewards create a track by choosing **Track** as the space type in the *Add Space* dialog.
- Steps are posts of type `action`, ordered in the space's `track-actions` view (a `GroupView` whose ordered `collections_posts` are the actions).
- **Enrollment = being an active member of the track space.** Joining the space enrolls you; leaving un-enrolls you.
- A member completes each action via its **completion action** (button, comment, reaction, choice, text, file upload). When all actions are complete, the track is complete for that member: a celebration dialog shows the completion message and any earned role, the role is granted in the parent group, and stewards are notified.

Users: stewards with *Administration* (create/edit/order actions, see all responses); members (enroll, complete).

---

## 2. Concepts & data

### 2.1 `tracks` table

| Column | GraphQL (`Track`) | Type / default | Notes |
|---|---|---|---|
| `id` | `id` | serial | |
| `group_id` | `space` | FK → groups (SET NULL, deferrable) | The track space. |
| `action_descriptor` | `actionDescriptor` | string | Singular unit term; UI default **"Action"** (max 40 chars in UI). |
| `action_descriptor_plural` | `actionDescriptorPlural` | string | UI default **"Actions"**. Used as the track-actions view title. |
| `completion_message` | `completionMessage` | text (HTML) | Sanitised via `RichText.processHTML` on read. |
| `completion_role_id` | `completionRole` | FK → groups_roles | Role awarded on completion (in the **parent** group). Cannot be the implicit All Members role → error `The All Members role cannot be edited, assigned or used as a requirement`. Invalid id → `Invalid role id`. |
| `access_controlled` | `accessControlled` | bool, default false | Legacy paywall flag; migrated to `groups.paywall` on the space (module 23). |
| `num_actions` | `numActions` | int, default 0 | Incremented in `Track.addPost`, decremented when an action is deactivated. |
| `num_people_enrolled` | `numPeopleEnrolled` | int, default 0 | Incremented only by `Track.enroll` (see quirks); decremented when members leave the space. |
| `num_people_completed` | `numPeopleCompleted` | int, default 0 | Incremented on track completion. |
| `deactivated_at` | `deactivatedAt` | timestamp | |
| `settings` | — | jsonb `{}` | unused |
| `created_at`, `updated_at` | | | |

Legacy columns from the original (2025) table — `name`, `description`, `banner_url`, `actions_name`, `welcome_message`, `completion_badge_name`, `completion_badge_emoji` — are no longer read; name/description/banner/welcome now come from the space group. `published_at` was dropped (lifecycle moved to `groups.status`). Legacy join tables `groups_tracks`, `tracks_posts`, `tracks_users` were dropped.

Computed GraphQL fields (for the viewer): `canAccess` (free if not access-controlled; otherwise *full-access* responsibility in the space's group or a matching `UserScope` track scope), `isEnrolled` (active space membership), `didComplete` (active membership with `settings.completedAt`), `userSettings` (the membership settings JSON), `enrolledUsers` (active space members ordered by name, with `enrolledAt` = membership `created_at` and `completedAt` = membership `settings.completedAt`). Also exposed but vestigial: `groupsTotal`, `postsTotal`, `users`, `usersTotal`.

### 2.2 Track space (Group)

`groups.type = 'space'`, `parent_id` = owning group, `track_id` = track. `groups.status` ∈ `draft | published | archived` (default `published`). Roles and responsibilities are inherited from the parent group. Default included views for a new track space: `track-actions`, `chat`, `members`, `welcome` (welcome page enabled by default); accepted post types: none (actions are created through the track-actions view); default icon `Shapes`. The space's home route resolves to `/track-actions` when no view has `order 0` (`spaceHomeRoutePath`).

### 2.3 Enrollment / completion state

Stored on the **space membership** (`group_memberships`): `created_at` = enrolled-at; `settings.completedAt` (ISO string) = completed-at. Per-action completion is stored in `posts_users` (`completed_at`, `completion_response` jsonb) for the member and the action post.

### 2.4 Action posts

`posts.type = 'action'` with:

| Column | GraphQL | Notes |
|---|---|---|
| `completion_action` | `completionAction` | One of `button`, `comment`, `reaction`, `selectMultiple`, `selectOne`, `text`, `uploadFile`. Default for new action posts: `button`. |
| `completion_action_settings` | `completionActionSettings` | `{ instructions: string, options?: string[] }` (options only for the select types). |
| `num_people_completed` | `numPeopleCompleted` | Incremented on a member's first completion. |
| — | `completedAt`, `completionResponse` | Viewer's own completion. |
| — | `completionResponses` (PostUser query set) | Each `{ id, user, completedAt, completionResponse }`; viewer sees only their own unless they are an administrator of a group the post is in. |

Completion action labels (dropdown, `postCompletionActions.<type>`) and default instructions (`postCompletionActions.<type>.instructions`, with `{{actionDescriptor}}`):

| Value | Label | Default instructions |
|---|---|---|
| `button` | Mark complete / Done button | Click the button to mark the {{actionDescriptor}} as complete. |
| `comment` | Leave a Comment | Leave a comment on this {{actionDescriptor}} to indicate you've completed it. Your comment will be visible to all members of the track. |
| `reaction` | Emoji Reaction | React to this {{actionDescriptor}} to indicate you've completed it. |
| `selectMultiple` | Multiple Choice - Select Multiple | Select one or more options to indicate you've completed the {{actionDescriptor}}. |
| `selectOne` | Multiple Choice - Select One | Select an option to indicate you've completed the {{actionDescriptor}}. |
| `text` | Respond to a question or prompt | Respond to the prompt to completed the {{actionDescriptor}}. *(sic)* |
| `uploadFile` | Upload attachment | Upload an attachment to indicate you've completed the {{actionDescriptor}}. |

Stored `completion_response` shapes: button → `[]`; comment → `[commentText]`; reaction → `[emojiFull]`; selectOne → `[option]`; selectMultiple → `[option, …]`; text → `[sanitizedHTML]`; uploadFile → `[{ id, url }, …]`.

---

## 3. Routes / entry points

| URL | Screen |
|---|---|
| `/groups/:slug/spaces/:spaceSlug` | Space index → redirects to the space home (normally `/track-actions`), or shows the space card menu on one-column/drawer layouts. First visit after joining lands on `/welcome` if the welcome page is enabled. |
| `/groups/:slug/spaces/:spaceSlug/track-actions` | **Track actions view** (`TrackActionsView`). `?edit=true` → edit mode (admins only). |
| `…/track-actions/post/:postId` | Action detail in a `PostDialog` over the list. |
| `…/spaces/:spaceSlug/members` | Space member directory with `Completed Track` / `Not Completed Track` pills (module 20). |
| `…/spaces/:spaceSlug/welcome`, `/chat`, `/about` | Standard space views (module 15). |
| `/my/tracks` | **My Tracks** — card grid of track spaces you are a member of (sorted by name); empty: `You are not a member of any tracks`. Header icon `Shapes`. |
| `/groups/:slug/tracks/*` | Legacy → redirect to `/groups/:slug/more-spaces`. |
| Non-member visiting any track-space URL | Space join interstitial (`SpaceJoinPage`, module 10/15): `Join Space`, `Pay to Join Space` (paywalled), `Request to Join Space`, invite-only or required-role messages. |

`trackUrl(trackId, {groupSlug, space, tab})` → the space home URL; without a space slug it falls back to `/groups/:slug/settings/tracks` (legacy).

Entry points: group menu / More Spaces cards for the track space, `My Tracks`, notifications (`trackEnrollment`, `trackCompleted` → track URL), post links.

---

## 4. UX specification

### 4.1 Creating a track (Add Space dialog)

In the group menu's "Add" menu → *Add Space* (module 15). Space type selector options: `Custom Space`, `Chat Space`, **`Track`** (icon `Shapes`), `Funding Round`. The type is immutable after creation. Choosing Track:

- Resets accepted post types to none, included views to `track-actions, chat, members, welcome`, icon `Shapes`; turns the welcome page on and expands the Welcome section; hides the home-view picker.
- Offers a guided tour (`Setting up a track? Take a quick tour.`).
- Shows the **Track Settings** block (`TrackSettingsFields`, below the common space fields Name / Purpose / Description / Access / banner):
  - Heading `Track Settings`.
  - **Completion Message** — rich-text editor (extended menu) with tab-style label `Completion Message`, placeholder `This message will be shown to members who complete the track`.
  - **Completion badge or role** — select: `None` + every assignable role of the parent group shown as `<emoji> <name>`.
  - Two inputs side by side (stacked on phones): `Unit term` (default `Action`) and `Unit term plural` (default `Actions`), max 40 characters each.
- Footer: `Cancel`, `Save as Draft`, `Create and Publish` (labels become `Creating...`). Closing with unsaved input asks `Save draft before closing?` (`Continue Editing` / `Save as Draft` / `Discard Space`).
- On save: `createSpace` (status `draft` or `published`; drafts are not added to the menu), then `createTrack({ groupId, actionDescriptor, actionDescriptorPlural, completionMessage, completionRoleId })`. The backend links `groups.track_id` if the space has none.

### 4.2 Editing a track

Space settings modal titled `Track Space Settings` (same fields as creation, pre-filled). Buttons: `Cancel`, `Save Draft`, `Publish` (sets `groups.status`). Saving calls `updateSpace` then `updateTrack({ trackId, actionDescriptor, actionDescriptorPlural, completionMessage, completionRoleId })`. Archiving / restoring / deleting spaces is in More Spaces (module 15); deleting a track (`deleteTrack`) archives its space and deletes the `tracks` row.

**Duplicate track** (`duplicateTrack`): clones the tracks row (counters reset to 0), clones the space as a **draft** named `<name> (copy)` with slug `<slug>-copy-<timestamp>` (truncated to 40 chars), new invite access code and system invite link, views `track-actions, members, welcome`, and clones every action post (counters reset) into the new space in the same order. (Web UI for duplicate exists only in the unused `TrackCard`.)

### 4.3 Track actions view (`TrackActionsView`)

- Container: max width 750px, centered, padding 16px, bottom padding 80px. Header title = `actionDescriptorPlural` (fallback `Actions`), icon `Shapes`, no search.
- **Admin edit toggle** (users with *Administration* in the parent group): full-width dashed-border button with pencil icon: `Edit {{actionDescriptorPlural}}` / `Done Editing` (toggles `?edit=true`).
- **Access gate**: if the track is access-controlled and `canAccess === false`, a dashed box `You need to be granted access to view the actions in this track.` and the list below is rendered at 50% opacity with pointer events disabled.
- **View mode** (members): the ordered action posts as standard post cards. Each card has an **ActionHeader** strip:
  - completed → bordered (secondary colour) chip `✓ Completed` + right-aligned small `Completed {{date}}` (date format `DD`);
  - the first not-yet-completed action (the "current" action) → accent-bordered chip `▶ Next {{actionDescriptor}}`;
  - other incomplete actions → muted chip `◌ Not Completed`.
  - Clicking a card opens the action detail.
- **Edit mode**: vertical drag-and-drop list of **ActionSummary** rows (dnd, vertical axis only, 150 ms easing). Each row: title (h1), a pill `<n> Completed` (n = `numPeopleCompleted`) that opens the **Completions dialog**, a ⋮ menu (`Copy Link` → copies absolute post URL; `Remove` → confirm `Are you sure you want to remove this action? You cannot undo this.` → deletes the post), and a grab handle on the right. Clicking the row body opens the post editor for that action. Dropping a row calls `reorderViewPost({ groupId, viewId, postId, order: newIndex })`. Below the list: button `+ Add {{actionDescriptor}}` → post editor with `newPostType=action` and `viewId`.

### 4.4 Action post editor

In the post editor for type `action` (module 13), a dashed box: `How can people complete this {{actionDescriptor}}?` + select of the seven completion actions; `Completion Instructions for Members` textarea (placeholder `Add instructions for completing this {{actionDescriptor}}`), pre-filled with the default instructions whenever the type changes. For select types: option rows `Option {{index}}` (placeholder `Add description`, ✕ to remove) and `+ Add an option`. A new action is added to the track-actions collection at the end (`max(order)+1`) and `num_actions` incremented.

### 4.5 Completing an action (action detail)

`ActionCompletionSection` inside the post detail (dashed bordered box, margin 8px):

- Not completed (or editing): heading `Complete this action`; **bold instructions**; then controls by type:
  - `button`: button `Mark as Complete`.
  - `selectOne`: radio list of options; `Submit`.
  - `selectMultiple`: checkbox list; `Submit`.
  - `text`: rich-text editor (placeholder `Write your response`, menu shown); `Submit`. Empty-looking HTML counts as no response.
  - `uploadFile`: attachment list + `Upload Attachments` (outline) + `Submit Attachments and Complete` (disabled until ≥ 1 file).
  - `comment` / `reaction`: no controls — completing happens automatically when the member comments on / reacts to the action (first comment's text or the emoji becomes the response).
  - Submit is disabled while the response is empty (except `button`). (Strings `Complete this action`, `Mark as Complete`, `Submit`, `Edit Response` are hard-coded English.)
- Completed: `You completed this {{actionDescriptor}} {{date}}.` + type-specific suffix (`You selected:` / `Your response was:` / `Your uploaded attachments:`), the stored response rendered, and an outline `✎ Edit Response` button (re-opens the controls; resubmitting overwrites the response and `completed_at` but does not re-count).
- **Track completion dialog**: when this submission completes the last outstanding action (client-side check: every action in the list is complete, or `numActions === 1`), a modal opens: party-popper icon (green), heading `Congratulations, you have completed {{trackName}}!` (track name = space name), the completion message HTML (if it has visible text), and, if a completion role exists, a dashed box `You've earned a new role!` with a pill `<emoji> <name>`. The completion role is optimistically added to the viewer's roles. The dialog also opens if the detail mounts already-completed-just-now.

**Steward view of responses**: on the action detail, users with *Administration* see a box summarising who completed it (avatars; empty `No one has completed this action yet`; phrases `has completed this action` / `have completed this action`) and a `View All Responses` button → **Completions dialog**: title `Completions: By Button | By Comment | By Reaction | By Selected Options | By Selected Option | By Text Reflection | By File Upload`; list of rows each with avatar + name, completion date, and the response (comma-joined options, HTML, emoji, or file attachments).

### 4.6 Members directory in a track space

See module 20 §4.1: `Completed Track` / `Not Completed Track` pills and per-member `✓ Completed {{date}}` / `Not yet completed` lines, visible to *Administration* holders or holders of system roles named `Moderator` or `Host`.

### 4.7 Unused UI

`components/TrackCard` (name, `$` paid icon with tooltip `This track requires payment to access`, `<n> <actionDescriptorPlural>`, `Draft` label, duplicate (confirm `Are you sure you want to duplicate this track?`) and edit icons, enrolled / completed counters with tooltips `Number of people that have enrolled in the track` / `Number of people that have completed the track`, `You completed this track` / `You are enrolled`) is not imported anywhere — the old Tracks list page was removed in favour of spaces. The `enrollInTrack` / `leaveTrack` mutations are not called by the web app (only the sandbox); enrollment happens by joining the space.

---

## 5. Business rules & side effects

1. **Enroll** (`enrollInTrack` mutation / `Track.enroll`): track must exist and not be deactivated (`Track not found`); the space must exist (`Track space not found`) and not be `draft`/`archived` (`Track is not published`); access-controlled tracks require `canAccess` (`You do not have access to this track. Please purchase access to enroll.`). Adds the user to the space (reactivating an old membership), clears any prior `completedAt`, resets membership `created_at`, increments `num_people_enrolled`, and creates `trackEnrollment` activities for every member of the **parent** group with *Administration*.
2. **Joining the space** through the normal join flow (the web path) creates the membership but does **not** increment `num_people_enrolled` nor notify stewards (quirk).
3. **Leave** (`leaveTrack` / leaving or being removed from the space, or the parent-group cascade): `Group.settleParticipation` clears `settings.completedAt` and decrements `num_people_enrolled` (floored at 0); `num_people_completed` is **not** decremented. The completion role is not revoked.
4. **Complete an action** (`completePost(postId, completionResponse)`): response JSON-parsed if a string (non-JSON → `[string]`), text responses sanitised; upsert `posts_users` with `completed_at = now` and the response; on a first completion increment the post's `num_people_completed` and queue `Post.checkCompletedTrack`. No enrollment or membership check is made at this stage.
5. **Comment / reaction auto-completion**: commenting on a `comment` action or reacting to a `reaction` action completes it for the actor if not already completed.
6. **Track completion** (`checkCompletedTrack`, async job): find the track space via the action's track-actions collection; if the user has `completed_at` on **every** current action, is an active space member and has no `completedAt` yet → set membership `settings.completedAt`, increment `num_people_completed`, grant `completion_role_id` in the parent group (`group_memberships_group_roles`; duplicates ignored), and create `trackCompleted` activities for all *Administration* holders of the parent group.
7. **Notifications**: `trackEnrollment` and `trackCompleted` produce in-app, push and email notifications for stewards. Push text: `Track enrollment: "<track>" was enrolled in by <name>` / `Track completed: "<track>" was completed by <name>`. Emails include actor name/avatar/profile URL, track name and URL (module 19).
8. **Removing an action** (post deleted/deactivated): removed from track-actions collections; `num_actions` decremented (min 0). Adding an action already in the collection is a no-op.
9. **Reordering**: `collections_posts.order` on the track-actions view.
10. **Paid tracks**: track access control now lives on the space (`groups.paywall`, visibility/accessibility); purchasing an offering that grants the space adds the member (module 23). `canAccess` still honours legacy `access_controlled` + track scopes and *full-access* responsibilities.

---

## 6. Permissions

| Action | Who |
|---|---|
| Create / update / delete / duplicate track | *Administration* in the space or its parent group (`canEdit`). `createTrack` itself performs no permission check (relies on the preceding `createSpace`). |
| Edit actions (add, reorder, remove), see Edit button | *Administration* in the parent group. |
| View all completion responses | Administrators of a group the action is posted in; others see only their own. |
| Enroll | Any user allowed to join the space (published, accessible, paid if paywalled, required roles). |
| Complete actions | Any user who can see the post (no enrollment check). Track completion is only recorded for active space members. |
| See completion pills in members directory | *Administration* or system role named Moderator/Host. |

---

## 7. API

Queries: `track(id)` (fields in §2.1), `group(slug){ track{…} groupViews{ items{ type collectionPosts … } } }`, `post(id){ completionAction completionActionSettings completedAt completionResponse numPeopleCompleted completionResponses{ items{ id user{id name avatarUrl} completedAt completionResponse } } }`, `tracks(autocomplete, first=20, offset, order, published, sortBy)` (root search).

Mutations: `createTrack(data: TrackInput): Track`, `updateTrack(trackId, data: TrackInput): Track`, `deleteTrack(trackId): Boolean`, `duplicateTrack(trackId): Track`, `enrollInTrack(trackId): Track`, `leaveTrack(trackId): Track`, `completePost(postId, completionResponse: JSON): Post`, `reorderViewPost(groupId, viewId, postId, order)` (module 15), `createPost`/`updatePost` with `completionAction`, `completionActionSettings`.

`TrackInput { accessControlled, actionDescriptor, actionDescriptorPlural, completionMessage, completionRoleId, groupId, postIds }` — `postIds` is accepted but ignored; `name`, `description`, `bannerUrl`, `welcomeMessage`, `publishedAt` are stripped if sent.

Activity reasons: `trackEnrollment`, `trackCompleted` (with `track_id`).

---

## 8. Edge cases & known quirks

1. Web enrollment (joining the space) bypasses `Track.enroll`: no enrollment counter increment and no steward notification; `numPeopleEnrolled` can drift (and leaving still decrements, floored at 0).
2. `num_people_completed` never decreases (leaving, deleting actions); "Not Completed Track" pill count is computed as `memberCount − numPeopleCompleted`.
3. Adding a new action after people completed the track does not un-complete them; removing actions does not auto-complete people who now have all remaining ones (completion is only checked when an action is completed).
4. Client decides to show the celebration dialog independently from the server job; they can disagree (e.g. non-member completing all actions sees the dialog but no completion is recorded).
5. Several strings in the completion UI are untranslated literals.
6. The default `text` instruction contains a typo ("to completed").
7. `TrackCard` and the `enrollInTrack`/`leaveTrack` client actions are dead code in web.
8. Member-directory completion visibility is role-**name** based (Moderator/Host), flagged TODO in code.

## 9. Docs vs. code

| Docs (guides/setting-up-learning-journeys-tracks-and-actions) | Code |
|---|---|
| Tracks are created/managed from a group "Tracks" settings page / tracks list with a Publish toggle, name, description, banner, welcome message stored on the track | Tracks are spaces: created via Add Space → Track; name/description/banner/welcome live on the space; publish via space status (Save Draft / Publish). `/groups/:slug/tracks` redirects to More Spaces. |
| Members "enroll" with an Enroll button | Members join the track space (`Join Space`); welcome page shown first. |
| Completion badge with custom emoji/name defined on the track | Completion grants an existing group role/badge chosen from a select (roles created in group settings, module 12). |

## 10. Source references

- Backend: `apps/backend/api/models/Track.js`, `api/models/Post.js` (`complete`, `checkCompletedTrack`, `sanitizeCompletionResponse`), `api/models/Group.js` (`trackActionsView`, `actionPosts`, `settleParticipation`), `api/graphql/mutations/{track,post}.js`, `api/graphql/makeModels.js` (Track, Post.completionResponses), `api/graphql/schema.graphql`, `api/models/GroupRole.js`, `api/models/Notification.js`, `lib/i18n/en.js`, migrations `20250320172703_tracks.js`, `20260702190000_spaces_and_views_schema.js`, `20260826120000_add_groups_status.js`, `20260728120000_paid_spaces_from_tracks.js`; test `api/graphql/mutations/track.test.js`.
- Web: `apps/web/src/routes/TrackActionsView/*`, `routes/PostDetail/{ActionCompletionSection.jsx,PostDetail.js}`, `components/ActionCompletionResponsesDialog`, `components/PostCard/PostHeader/PostHeader.js` (`ActionHeader`), `components/PostEditor/PostEditor.js` (`CompletionActionSection`), `routes/AuthLayoutRouter/components/ContextMenu/{AddSpaceDialog,SpaceSettingsModal,TrackSettingsFields}.jsx`, `routes/MySpaceCollection`, `routes/SpaceJoinPage`, `routes/SpaceContent/SpaceContent.js`, `store/actions/trackActions.js`, `components/TrackCard` (unused), `packages/navigation/src/index.js`.
- E2E: `apps/web/e2e/authenticated.track-paywall.spec.js`, `auth.track-viewer.setup.js`.
