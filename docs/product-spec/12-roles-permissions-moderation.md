# 12 — Roles, Permissions & Moderation

> Module owner file. Related: [11-group-settings.md](11-group-settings.md) (Roles & Badges / Responsibilities settings UI), [20-members-profiles.md](20-members-profiles.md) (role badges on profiles), [13-posts-comments.md](13-posts-comments.md) (post menus), [10-joining-invitations.md](10-joining-invitations.md) (agreements on join), [05-user-settings.md](05-user-settings.md) (blocked users list).


## 1. Overview

Hylo's authorization inside a group is **responsibility-based**. A *responsibility* is a named power (e.g. `Administration`). A *role* (`groups_roles`) bundles responsibilities and doubles as a visible **badge** (emoji + name). Members hold roles; a member's permissions in a group are the union of the responsibilities of every role they hold there. Every top-level group gets three built-in **common (system) roles** — Administrator 🪄, Moderator ⚖️, Host 👋 — plus a hidden implicit **All Members** role that every active member holds. Stewards may create **custom roles/badges** and **custom responsibilities** (labels only).

Spaces (sub-groups, `type='space'` or any group with `parent_id`) have no roles of their own: role assignments and responsibilities resolve against the parent ("role scope", `COALESCE(parent_id, id)`).

Separately, Hylo **platform admins** (user ids in env `HYLO_ADMINS`) have site-wide powers.

Moderation is agreement-based: any member may **flag** a post against one or more group agreements and/or platform agreements; this creates a `ModerationAction`, blurs the post for the group, notifies moderators, and appears in the group's **Moderation** queue, where a holder of *Manage Content* (or the reporter) can **clear** it. Stewards can also **remove** posts and members. Any user can **block** another user.

Settings UI for roles/responsibilities is specified in [11-group-settings.md](11-group-settings.md) §7–8; this module specifies the model and rules.

## 2. Roles

### 2.1 Data (`groups_roles`)

| Column | Notes |
|---|---|
| `id` | |
| `group_id` | top-level group only |
| `name` | text |
| `emoji` | text (single emoji); `''` for All Members |
| `description` | text |
| `color` | text, accepted by API, **unused by UI** |
| `type` | `'system'` \| `'custom'` (default) \| `'all_members'` |
| `active` | bool; custom roles can be deactivated |
| `scopes` | jsonb array of scope strings (content-access grants, see [23-paid-content-stripe.md](23-paid-content-stripe.md)); not allowed on All Members |
| `created_at`, `updated_at` | |

Assignments: `group_memberships_group_roles` (`user_id`, `group_id`, `group_role_id`, `active`). Role→responsibility links: `group_roles_responsibilities` (`id`, `group_role_id`, `responsibility_id`).

DB view `group_member_effective_roles(user_id, group_id, group_role_id)` = active rows of `group_memberships_group_roles` ∪ (every active `group_memberships` row × that group's active `all_members` role). All permission lookups use this view.

Unique partial index: one `all_members` role per group.

### 2.2 Common (system) roles

Created per group by `GroupRole.setupSystemRoles(groupId)` at group creation (idempotent; no-op for spaces); responsibilities linked by title (type `system`).

| Name (legacy name) | Emoji | Description (exact) | Responsibilities |
|---|---|---|---|
| **Administrator** (Coordinator) | 🪄 | "Administrators are empowered to do all group management and configuration." | Administration, Add Members, Remove Members, Manage Content |
| **Moderator** | ⚖️ | "Moderators are expected to actively engage in discussion, encourage participation, and take corrective action if a member violates group agreements." | Manage Content, Remove Members |
| **Host** | 👋 | "Hosts are responsible for cultivating a good atmosphere by welcoming and orienting new members, embodying the group culture and agreements, and helping members connect with relevant content and people." | Add Members |

- Display order everywhere: Administrator, Moderator, Host (`sortSystemGroupRoles`; legacy "Coordinator" maps to Administrator).
- System roles cannot have responsibilities added/removed ("Common roles cannot have their responsibilities edited"). Their name/description/emoji are *technically* editable via `updateGroupRole` (only All Members is blocked server-side), but the UI renders them read-only.
- Group creator is assigned Administrator (`GroupMembership.assignAdministratorRole`; `addMembers(..., {assignAdministrator:true})`).
- Older groups may still carry the old description text for Administrator if it was customised (the rename migration only rewrote the two known old texts).

### 2.3 All Members role

`{name:'All Members', emoji:'', description:'Everyone in the group holds this role.', type:'all_members'}` — one per top-level group, created by `ensureAllMembersRole`. Never assigned explicitly; excluded from `group.groupRoles` in GraphQL; cannot be edited, assigned, used as an invite-link/invitation/track/content requirement, or given scopes (error "The All Members role cannot be edited, assigned or used as a requirement"). Its only use today is the **invite policy**: linking *Add Members* to it (`everyone`) lets every member invite; unlinking (`stewards`, default for new groups) restricts invitation to roles that have Add Members. `GroupRole.getInvitePolicy/setInvitePolicy` (advisory-locked per group; spaces have none). Exposed as `group.invitePolicy` (Administration only) and set via `updateGroupSettings({invitePolicy})`.

### 2.4 Custom roles & badges

- Create: `addGroupRole(groupId, name, emoji, description, color)` → `type 'custom'`, `active true`. Requires Administration; `name` and `emoji` required server-side; UI also requires name ≥ 3 chars.
- Update: `updateGroupRole(groupRoleId, groupId, name?, emoji?, description?, color?, active?)`; empty values keep the old value (cannot clear a description).
- Deactivate/reactivate via `active`. A deactivated role: hidden from pickers and from members' badges (`User.groupRoles` filters `groups_roles.active = true`), its member list hidden in settings; assignments are kept. **Quirk:** server permission checks (`Responsibility.fetchForUserAndGroupAsStrings`) do not filter on `active`, so responsibilities on a deactivated custom role still grant power on the backend while the web UI (which derives permissions from `me.groupRoles`) treats them as gone.
- No delete for saved roles.
- A custom role with no responsibilities is purely a **badge**.
- Custom roles may get any platform responsibility (including Administration) and any of the group's custom responsibilities.

### 2.5 Assigning roles

- `addRoleToMember(personId, roleId, groupId)` — Administration; role must belong to the group and not be All Members. Inserts `group_memberships_group_roles` (`active true`). No duplicate check (UI filters out existing holders).
- `removeRoleFromMember(roleId, personId, groupId)` — Administration **or the person themself** (self-removal of any role, including Administrator, is allowed).
- Other ways roles are granted: email invitation with a role (`createInvitation(groupRoleId)`, Administration required), invite links with `grantedRoleIds` (assigned on join), track completion roles ([21-tracks.md](21-tracks.md)), paid offerings granting `groupRoleIds` ([23-paid-content-stripe.md](23-paid-content-stripe.md)).
- Leaving or being removed from the role-scope group revokes all role assignments (`GroupMembership.revokeAllGroupRoles`).
- No notifications are sent when roles change.

### 2.6 Badge display

Role badges (emoji + name) appear on member cards, profiles, hover cards and post author lines; system roles first then custom (`groupRolesForPicker` ordering). See [20-members-profiles.md](20-members-profiles.md). `group.stewardDescriptor` / `stewardDescriptorPlural` (default "Moderator(s)") customise the generic steward wording.

## 3. Responsibilities

### 3.1 Data (`responsibilities`)

`id`, `title`, `description`, `type` (`'system'` platform | `'group'` custom), `group_id` (NULL for system), timestamps.

### 3.2 Platform (system) responsibilities — current set

| id* | Title | Current description | Grants |
|---|---|---|---|
| 1 | **Administration** | "Allows for editing group settings, managing the menu and spaces, exporting data, and deleting the group." | see matrix §5 |
| 2 | **Add Members** | "Invite and add new people, and accept or reject join requests." | invitations, invite-link visibility, join requests |
| 3 | **Remove Members** | "The ability to remove a member from the group." | `removeMember` |
| 4 | **Manage Content** | "Adjust group topics, custom views and manage content that contradicts the agreements of the group." | remove posts/comments, clear flags, pin posts, curate collections |

*ids from the original seed migration; code mostly matches by title (`Responsibility.systemId`), but `Group.moderators()` and `Group.stewards()` match by **numeric id** (see §5.3).

History (affects data, not behaviour): `Manage Tracks` and `Manage Rounds` existed, were merged into `Manage Spaces` (2026-07), which was folded into **Administration** (2026-08) and deleted. `packages/hooks` also defines `RESP_INVITE_MEMBERS = 'Invite Members'` which does not exist on the backend (dead).

Ordering in lists: system first in the order Administration, Add Members, Remove Members, Manage Content; then custom by title.

### 3.3 Custom responsibilities

Created per group (`addGroupResponsibility`; title must not equal a system title case-insensitively: "A built-in responsibility already has this title"). Purely descriptive — no code checks them. Attach to custom roles with `addResponsibilityToRole` (allowed: system responsibilities and this group's own; duplicate add is a no-op) and detach with `removeResponsibilityFromRole(roleResponsibilityId)`.

## 4. How permissions are computed

- **Backend**: `GroupMembership.hasResponsibility(userId, groupOrId, title)`:
  1. Fetch titles via `Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)` — joins `group_member_effective_roles` for the **role-scope group** (parent for spaces) → `group_roles_responsibilities` → `responsibilities.title`.
  2. False if title missing.
  3. True if the user has an active membership in the group itself; for a space, true if they have an active membership in the parent.
  Resolvers for roles/responsibilities call `fetchForUserAndGroupAsStrings` directly (no membership check). Mutations throw GraphQL errors such as "You don't have the right responsibilities for this group".
- **Web client**: `getResponsibilitiesForGroup(state, {groupId})` = responsibilities of `me.groupRoles` whose `groupId` equals the role-scope id; `hasResponsibilityForGroup(state, {responsibility, groupId})`. `me.groupRoles` comes from the effective-roles view (includes All Members, excludes inactive roles).
- **"Is admin / steward"**: In UI terms a *steward* is anyone holding **Administration** (settings access); the gear icon/Settings entries show for Administration or Add Members. Server helper lists: `Group.stewards()` = members holding responsibility ids 1, 3 or 4 (Administration, Remove Members, Manage Content) via direct assignments; `Group.moderators()` = members holding id **3** (Remove Members — the code comment says "manage_content", a known mismatch). These lists drive who receives moderation DMs, join/relationship notifications and the "stewards" shown on the About page. `Responsibility.IMPORTANT_RESPONSIBILITIES` = Administration, Remove Members, Manage Content.
- **Platform admin**: `Admin.isSuperAdmin(userId)` ⇔ id in `HYLO_ADMINS`; `Admin.isTestAdmin` adds `HYLO_TESTER_IDS`. Admin requests bypass most visibility filters (`makeModels(userId, isAdmin)`), `me.isAdmin` is true, and the "Management" menu item appears ([11-group-settings.md](11-group-settings.md) §18).

## 5. Permissions matrix

### 5.1 Group-scoped (backend enforcement)

| Action | Required | Enforced in |
|---|---|---|
| Update group settings / details / privacy / agreements / invite policy (`updateGroupSettings`, API `updateGroup`) | Administration | `mutations/group.js updateGroup` |
| Delete group | Administration | `deleteGroup` |
| Create/update/deactivate roles; assign/unassign roles (except self-unassign) | Administration | `mutations/role.js` |
| Create/update/delete custom responsibilities; edit role responsibilities | Administration | `mutations/responsibilities.js` |
| Invite links create/update/delete | Administration | `createGroupInviteLink` etc. |
| See `inviteLinks`, `invitePath`, `pendingInvitations`, `myInviteAllowance` | Add Members | `makeModels` getters |
| Send invitations / resend / expire / reinvite all | Add Members (assigning a role: + Administration) | `mutations/invitation.js` |
| List / accept / decline join requests | Add Members | `joinRequests` query, `join_request.js` |
| Remove a member (`removeMember`) | Remove Members | `mutations/group.js` |
| Remove a post from the group (`removePost`) | Manage Content | `mutations/index.js` |
| Delete someone else's comment | Manage Content in any of the post's groups | `canDeleteComment` |
| Clear a moderation action (flag) | Manage Content in the action's group, or be the reporter | `clearModerationAction` |
| Pin a post to a view | Manage Content | `pinPost` |
| Add/remove/reorder posts in a collection view | Administration or Manage Content | `group_views.js requireAdminOrManageContent` |
| Create/edit/delete views, menu, spaces; convert group to space | Administration | `group_views.js`, `spaces.js` |
| Delete/edit group topics (`deleteGroupTopic`) | Manage Content; `updateGroupTopic` needs Administration | |
| Suggested skills add/remove | Administration | |
| Tracks edit, funding rounds manage | Administration | `track.js`, `fundingRound.js` |
| Stripe / offerings / content access grants | Administration | `stripe.js`, `contentAccess.js` |
| Group relationships (invite, accept, reject, cancel, delete, peer) | Administration in the relevant group(s) | `mutations/group.js` |
| Request commons listing | Administration | `publicListingRequest.js` |
| Export members (REST) | Administration | `ExportController` |
| See exact obfuscated location / `publicListingRequest` / `chatSpacesBlockingConversion` | Administration | `makeModels` |
| Flag a post (`createModerationAction`) | Post visible to the user | |
| Block/unblock a user | any signed-in user | |
| Review commons requests; site banners; email testers | Platform admin | |

### 5.2 UI gating (web)

| UI | Shown when |
|---|---|
| Group Settings entry (gear) & tabs | Administration (all) / Add Members (Invitations, Join Requests) |
| "Join Requests" menu item + badge | Add Members and `openJoinRequestCount > 0` (see [15-views-streams-spaces.md](15-views-streams-spaces.md)) |
| "Moderation" menu item + badge | stewards when `openModerationActionCount > 0` |
| Post menu "Edit", "Delete" | creator only |
| Post menu "Flag" | anyone except the creator |
| Post menu "Remove From Group" | not creator & Manage Content (confirm "Are you sure you want to remove this post? You cannot undo this.") |
| Post menu "Pin to View"/"Unpin from View" | Manage Content and a pinnable current view (max 3 pins; tooltips "You can only pin 3 posts", "You cannot pin a post from a space/child group to this view") |
| "Remove from Collection" | Administration or Manage Content |
| Member card ⋮ "Remove member from group"; profile menu same | Remove Members (not self, not Axolotl) |
| Moderation item "Clear" | Manage Content in action group, or reporter; status not cleared |
| Reporter identity on anonymous flags | visible to Manage Content holders |
| Invite tab admin controls (links, role select) | Administration |

### 5.3 Who gets notified

| Event | Recipients |
|---|---|
| Join request created | everyone with Add Members (effective roles, so includes All Members if policy = everyone) in the group or, for spaces, the parent |
| Group relationship invite created | `toGroup.moderators()` (Remove Members holders) |
| Flag (moderation action) | `moderators()` of every group the post is in, via Axolotl DM |
| Commons request | `NEW_GROUP_EMAIL` + all `HYLO_ADMINS` |

## 6. Agreements (as used by moderation)

- Group agreements: `agreements(id, title, description)` linked by `groups_agreements(group_id, agreement_id, order)`; per-user acceptance in `users_groups_agreements(user_id, group_id, agreement_id, accepted)` and membership `settings.agreementsAcceptedAt`. Editing UI and re-acceptance: [11-group-settings.md](11-group-settings.md) §6; join flow: [10-joining-invitations.md](10-joining-invitations.md). On leaving/removal, the member's `users_groups_agreements.accepted` are reset to false.
- **Platform agreements** (`platform_agreements(id, text, type)`; public query `platformAgreements`), seeded:
  - type `public` ("Not permitted in Public Spaces"): Inappropriate Content; Trolling; Sexual Content; Violence; Spam, Advertising or Promotion.
  - type `anywhere` ("Not permitted anywhere on the platform"): Violence, Abuse, & Self-Harm; Privacy or Consent Violation; Illegal Activity; Platform Manipulation; Civic Integrity; Deceptive Identity (anonymous or clear parody permitted).
  - External link "View platform agreements" → `https://www.hylo.com/agreements/#hylo-platform-agreements`.

## 7. Flagging content

### 7.1 Entry points

- Post card / post detail header ⋮ → "Flag" (Flag icon), hidden for the post's creator. In a group context opens **FlagGroupContent**; outside any group (e.g. public/My Home without group) opens the legacy **FlagContent**.
- Chat posts (`ChatPost`) and funding-round submission cards also use FlagGroupContent.
- Comments and members have no flag action in the current web UI (legacy `flagInappropriateContent` remains for API/mobile; see §7.4).

### 7.2 FlagGroupContent modal (current)

Full-screen overlay (`bg-darkening/50`, blur, z 1100); card max-width 750px, max-height 90vh, p-6. Escape or backdrop click closes.

- Header: "Explanation for Flagging" + ✕.
- Muted text (`flaggingExplainer`): "Reporting a post will blur it for all group members. Members will be able to see the report and its details. Moderators can clear reports or take other actions if necessary."
- Accent text (`flagsNeedACategory`): "All reports need to be linked to at least one agreement (group or platform), and you must provide an explanation for why you are flagging this post."
- Textarea (min 4 rows / 120px), placeholder "What was wrong?".
- If the group (or, inside a space, the **parent** group) has agreements: `h3` "Not permitted in {{groupName}}", link chip "View group agreements" (→ `<group>/about#agreements`, new tab), and a **MultiSelect** of agreement titles (toggle chips).
- `h3` "Violations of platform agreements", link chip "View platform agreements"; `h5` "Not permitted in Public Spaces" + MultiSelect of `public` agreements; `h5` "Not permitted anywhere on the platform" + MultiSelect of `anywhere` agreements.
- Footer: checkbox "Anonymous (moderators will see your name)"; secondary button "Submit" — disabled until ≥1 agreement (group or platform) selected **and** explanation non-empty; tooltip "Select an agreement and add an explanation for why you are flagging this post".
- Submit → `createModerationAction({text, postId, groupId, agreements:[ids], platformAgreements:[ids], anonymous})`; modal closes immediately (no toast). The post's local `flaggedGroups` is updated so it becomes blurred.

### 7.3 Server: `createModerationAction`

- Requires `postId`, `text`; post must be visible to the reporter ("You don't have permission to see this post"); at least one agreement or platform agreement ("No agreements or platform agreements provided; you need to report against at least one of these").
- Inserts `moderation_actions{post_id, reporter_id, group_id, text, anonymous, status:'active'}`, links `moderation_actions_agreements` and `moderation_actions_platform_agreements`, and appends `group_id` to `posts.flagged_groups` (int array; duplicates allowed — one entry per active flag).
- Jobs:
  - `ModerationAction.sendToModerators`: for **each group the post is in**, sends one Axolotl DM to that group's `moderators()`: in the flag's own group "`<reporter> flagged a post in <group>`\nMessage: …\nBroken agreements: …\n<post link>"; in other groups "`<reporter or 'Anonymous reporter'> flagged a post in another group: <group>`" listing only platform agreements. Intended escalation to `HYLO_ADMINS` for public posts with platform agreements is dead code (checks `moderationAction.relationships` instead of `relations`).
  - `sendEmailsForModerationAction(type:'created')`: emails (only if `EMAIL_NOTIFICATIONS_ENABLED=true` or user is a tester) the reporter — subject "You flagged a post", body "You flagged post "<summary>" in group <group> as violating a group agreement." + link — and the post author — "Your post was flagged" / "Your post "<summary>" in group <group> was flagged as violating a group agreement." Note the author is told regardless of anonymity, without the reporter's name.

### 7.4 Legacy FlagContent / `flagInappropriateContent`

Modal "Explanation for Flagging" with a select ("Select a reason"; options Inappropriate Content `inappropriate`, Spam `spam`, Offensive `offensive`, Abusive `abusive`, Illegal `illegal`, Other `other`; error "Please select a reason"), textarea whose placeholder becomes "Why was this {{type}} '{{selectedCategory}}'{{required}}?" (" (explanation required)" for Other), "Cancel"/"Submit". Mutation `flagInappropriateContent({category, reason, linkData:{id, slug, type:'post'|'comment'|'member'}})` → `flagged_items` row → `FlaggedItem.notifyModerators`: Axolotl DM to `moderators()` of groups shared between reporter and content ("<name> flagged a <type> in <group|Public> for being <category>\nMessage: …\n<link>"), and to `HYLO_ADMINS` when category is `illegal` or the post is public. Schema comment lists categories `'inappropriate','offensive','abusive','illegal','safety','spam','other'`. Creates no moderation action and no blur.

### 7.5 How a flagged post looks

`isFlagged` = current group id ∈ `post.flaggedGroups`.
- **Post card / detail body** blurred and inert under a `FlagCover` bar: red disc with white flag, bold line "This post may not align with group or platform agreements." (`clickthroughExplainer`), muted line listing reasons (agreement titles · platform agreement texts · reporter notes from active actions in this group; fallback "See why this post was flagged"), and a "View post" button. Revealing is per-render (re-mount restores the cover; nothing persisted — `posts_users.clickthrough`/`recordClickthrough` exists server-side but the current UI does not call it).
- **FlagBadge** in the post header: 28px red disc with white filled flag, links to the group's (or space's) `/moderation`; aria-label "See why this post was flagged"; HTML tooltip: one line per active action `{{name}} says: "{{text}}"` (name "Anonymous" when anonymous; text truncated to 120 chars + "…"), then "This may break the following agreements:" and up to 3 agreements, then "... and {{count}} more".
- Chat-mode cards show an accent Flag icon linking to moderation with tooltip "See why this post was flagged".
- Grid/list/big-grid item renderers also blur flagged posts.

## 8. Moderation queue

### 8.1 Routes

- Group About page → **Moderation** tab (ShieldCheck icon), path `/groups/:slug/about/moderation` style handled by `GroupAboutPage` (path ending `/moderation`), and the direct route `/groups/:slug/moderation` (FlagBadge target); spaces: `<space url>/moderation`. Tab visible to everyone who can see the About page (no permission gate). Header title "Moderation" with ShieldCheck icon, search enabled (no-op). Page `<title>`: "Moderation | <group> | Hylo".
- Group menu shows a "Moderation" item with a badge of `openModerationActionCount` (count of `status='active'` actions in the group) for stewards while > 0 (see [15-views-streams-spaces.md](15-views-streams-spaces.md)).

### 8.2 Data & query

`moderationActions(slug, sortBy:'created', first:20, offset)` → newest first (`id desc`), paginated by infinite scroll. Includes the group's actions; for a non-space group also actions in its active child spaces the viewer belongs to, or all child spaces if the viewer has Manage Content in the group. Both `active` and `cleared` actions are listed (it is a log). **No membership/permission check** on this query beyond the slug. Fields: `id status text anonymous groupId group{…} createdAt post{…} reporter{id name avatarUrl} agreements{id title description} platformAgreements{id text type}`.

Empty state: `NoPosts` component. Loading spinner while fetching. Post detail opens as a dialog at `moderation/post/:postId`.

### 8.3 ModerationListItem card

Card `rounded-xl p-4 bg-card/40 border-2 shadow-md`, hover lift.
- Header row: reporter avatar + name (links `/user/<id>`) — or "Anonymous" when `anonymous` and viewer lacks Manage Content; "reported this on" + date `MMM d, yyyy`; when the action came from a child space and is viewed from the parent: a link with the space icon and "In {{name}}" → that space's moderation page. Right: status pill — "Status: Active" (accent) / "Status: Cleared by Steward" (focus colour).
- "Complaint" (centred muted heading) + the explanation text.
- "Reported content" + the post rendered as a `PostListRow` (bordered, shadowed).
- "Group Agreements broken" + read-only MultiSelect of agreements + "View group agreements" link (**quirk**: URL built as `/groups/<slug>/group/<slug>`, a broken link).
- "Platform Agreements broken" + MultiSelect + "View platform agreements".
- Footer (Manage Content in the action's group, or the reporter; status ≠ cleared): outline button "Clear" with small text "This will remove the report from the moderation queue, and remove the flag from the post."

### 8.4 Outcomes

| Outcome | How | Effects |
|---|---|---|
| **Clear flag** | "Clear" → `clearModerationAction(postId, groupId, moderationActionId)` | status → `cleared`; removes **one** occurrence of `groupId` from `posts.flagged_groups` (post un-blurs when none remain); emails (type `cleared`): actor gets "Moderator cleared your flag" / "The post "<summary>" in group <group> that you flagged was cleared of a group agreement violation."; author gets "Moderator cleared a flag from your post" / "Your post "<summary>" in group <group> was cleared of a group agreement violation." (Quirk: the "reporter" email goes to whoever cleared, not the original reporter.) No DM. |
| **Remove post from group** | post ⋮ "Remove From Group" (Manage Content) | `post.removeFromGroup(group)`; moderation actions stay as-is (still "Active") |
| **Delete post** | author only | — |
| **Remove member** | §10 | — |
| **Close/reopen post** | (requests/offers/proposals) emails "Your post was closed"/"reopened" — see [14-events-proposals-projects.md](14-events-proposals-projects.md) |

There is no "confirm/uphold" action (a `handleConfirmModerationAction` prop exists but is unused), no community agree/disagree voting on flags, and no automatic escalation.

## 9. Platform-level moderation

- Platform admins (`HYLO_ADMINS`) receive Axolotl DMs for legacy flags marked illegal or on public posts, and commons-request DMs; they can see all groups/posts through the admin filter bypass, review commons requests, and manage site banners (`/management`).
- The "Commons": groups only post publicly after admin approval (`allow_in_public`) — [11-group-settings.md](11-group-settings.md) §9.2.
- No admin UI exists for platform-wide moderation queues, banning users, or deleting content; platform agreements are seeded data with no editor.

## 10. Removing members

- UI: Members directory card ⋮ (EllipsisVertical) → "Remove member from group" (Trash2, red), or member profile menu → same label (hidden for self and Axolotl). Opens a dialog: title "Remove member"; body "You are about to permanently remove **[avatar] Name** from the group. Are you sure?"; buttons "Remove" / "Cancel". From the profile, success navigates back.
- Gate: Remove Members (UI and server). Mutation `removeMember(personId, groupId)` → `GroupService.removeMember` → `user.leaveGroup(group, removedByModerator=true)`.
- Effects (`Group.removeMembers`): settles participation (e.g. funding-round/track state), membership `active=false`, `nav_order=null`; deletes the user's per-view unread rows; if this is the role-scope group, **revokes all role assignments** and resets agreement acceptances; deactivates memberships in all child spaces; decrements `num_members`; publishes `groupMembershipUpdate {action:'left'}` to the group and the removed user; job `User.afterLeaveGroup` fires Zapier `member_leaves` triggers with `removedByModerator: true`.
- There is **no ban**: a removed person can rejoin through any normal path (open join, request, invite link). No notification/email is sent to the removed member.
- Self-leave uses the same path with `removedByModerator=false` ([10-joining-invitations.md](10-joining-invitations.md)).

## 11. Blocking users

- Entry: member profile ⋮ → "Block this Member" (X icon; hidden for self and the Axolotl bot). Confirm (`blockConfirmMessage`): "Are you sure you want to block this member? \n You will no longer see this member's activity \n and they won't see yours. \n\n You can unblock this member at any time. Go to Settings > Blocked Users." Then navigates back. Unblock from **My Home → Blocked Users** (`/my/blocked-users`, see [05-user-settings.md](05-user-settings.md)).
- `blockUser(blockedUserId)` → `blocked_users(user_id, blocked_user_id)`; errors: "cannot block Hylo the Axolotl", "blocked_user_id cannot equal user_id". `unblockUser` → "user is not blocked" if absent.
- Effects are **bidirectional** (`BlockedUser.blockedFor(userId)` = users I blocked ∪ users who blocked me) and applied in query filters: posts by those users are excluded from streams/search (`filters.js`), people lists/member directories, comments, message threads/DM candidates, notifications, and connections. Blocking does not affect group membership, roles, or moderation.
- `me.blockedUsers` lists blocked people.

## 12. API

Queries: `responsibilities(groupId, groupRoleId)`, `group{ groupRoles{items{id name emoji description type active color responsibilities{items{id title}}}} invitePolicy stewards moderators openModerationActionCount }`, `group{ members(groupRoleId|groupRoleIds) }` (role member lists, paged), `person{ groupRoles(groupId|slug){items{…responsibilities}} }`, `me{ isAdmin groupRoles blockedUsers }`, `moderationActions(slug, sortBy, first, offset)`, `platformAgreements`.

Mutations: `addGroupRole`, `updateGroupRole`, `addRoleToMember`, `removeRoleFromMember`, `addGroupResponsibility`, `updateGroupResponsibility`, `deleteGroupResponsibility`, `addResponsibilityToRole`, `removeResponsibilityFromRole`, `createModerationAction(data: {postId, groupId, text, anonymous, agreements:[ID], platformAgreements:[ID]})`, `clearModerationAction(postId, groupId, moderationActionId)`, `recordClickthrough(postId)` (unused by web), `flagInappropriateContent(data: InappropriateContentInput)`, `removePost(postId, groupId|slug)`, `removeMember(personId, groupId)`, `blockUser(blockedUserId)`, `unblockUser(blockedUserId)`, API-only `addMember(userId, groupId, assignAdministrator)`.

## 13. Edge cases & known quirks

- Deactivated custom roles still grant responsibilities server-side (§2.4).
- `Group.moderators()` = Remove Members holders (id 3), not Manage Content as commented; `stewards()` uses ids 1/3/4; both ignore the All Members role.
- Self-removal of any role is allowed (an Administrator can demote themself; nothing prevents a group from losing its last Administrator).
- `moderationActions` query has no access check.
- Moderation "View group agreements" link is malformed; `clearModerationAction` emails the clearer as "reporter"; `sendToModerators` admin escalation is dead code; anonymous flags still show the name to Manage Content holders (as the checkbox label says).
- `posts.flagged_groups` can contain duplicates; clearing removes one at a time.
- Removing a post from a group does not clear its moderation actions.
- Responsibility ids are not stable across environments; code that uses ids (`moderators()`, `stewards()`) assumes seed order.
- `color` on roles is stored but never shown.
- Agreement acceptance resets on removal; rejoining requires accepting again.

## 14. Docs vs. code

| Docs | Code |
|---|---|
| Steward guide & `docs/consolidate-common-roles.md`: default roles "Coordinator, Moderator, Host"; Coordinator has Manage Tracks and Manage Rounds | Role is **Administrator** (legacy Coordinator); only 4 platform responsibilities; tracks/rounds folded into Administration. |
| Guide: Moderator "can … mark requests and offers as fulfilled on behalf of members" | No such Manage Content check found for completion (author-only in post menu). |
| Guide: "Other members can agree or disagree with the flag" | No agree/disagree feature exists. |
| Guide: "All moderation actions are logged" | Only flags and their clearing are logged (`moderation_actions`); post removal / member removal are not logged. |
| Guide: Manage Content covers "curating Post and Space Collections, pinning posts" | Matches; collections also allowed for Administration. |
| Guide: Add Members covers "managing Invite Links and View Links" | Link create/edit/delete requires **Administration**; Add Members can only view/copy. |
| Guide: "Hylo's platform stewards … flag it for the Hylo team" | No dedicated report-to-Hylo path in the current flag form; platform-agreement flags are DM'd only to group moderators (admin escalation broken). |
| Removing-members guide: ⋮ → "Remove" | Menu label "Remove member from group", dialog button "Remove". |

## 15. Source references

- Backend models: `apps/backend/api/models/{GroupRole,Responsibility,GroupRoleResponsibility,MemberGroupRole,GroupMembership,Group,ModerationAction,FlaggedItem,flaggedItem/notifyUtils,BlockedUser,Agreement,GroupAgreement,UserGroupAgreement,PlatformAgreement,Post,PostUser,User}.js`
- Mutations: `apps/backend/api/graphql/mutations/{role,responsibilities,moderation_actions,group,comment,post,user,index}.js`; `api/services/{GroupService,Admin}.js`; `api/services/Search/forModerationActions.js`; `api/graphql/makeModels.js`, `makeSchema.js`, `schema.graphql`; `lib/i18n/en.js`
- Migrations: `20231130142117_responsibilties.js`, `20240721173557_moderation_actions.js`, `20240730232457_add-more-platform-agreements.js`, `20260625180000_consolidate_common_roles_into_group_roles.js`, `20260702190100_add_manage_spaces_responsibility.js`, `20260810170000_remove_manage_spaces_responsibility.js`, `20260912120000_rename_coordinator_role_to_administrator.js`, `20260927120000_all_members_role.js`
- Web: `apps/web/src/routes/GroupSettings/{RolesSettingsTab,ResponsibilitiesTab}`, `routes/Moderation/Moderation.jsx`, `components/{FlagGroupContent,FlagContent,FlagBadge,ModerationListItem,Member,InvitePolicySelect}`, `components/PostCard/{PostCard.jsx,PostHeader/PostHeader.js}`, `routes/MemberProfile/MemberProfile.js`, `components/GroupAboutView/GroupAboutView.jsx`, `store/selectors/getResponsibilitiesForGroup.js`; `packages/hooks/groupRoleHelpers.js`
- Docs: `docs/consolidate-common-roles.md`; gitbook `guides__hylo-steward-guide.md`, `guides__hylo-steward-guide__removing-members.md`, `guides__list-of-admin-privileges-for-group-stewards.md`
