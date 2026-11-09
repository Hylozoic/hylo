# 10 — Joining groups & invitations

## 1. Overview

This module specifies how a person becomes (and stops being) a member of a Hylo **group**: the two privacy axes (*visibility* — who can see a group; *accessibility* — who can join it), every join path (Join button, request to join with join questions, agreements, prerequisites), steward approval of join requests, email invitations, reusable invite/view links, the invite policy ("who can add new members"), group‑to‑group invitations (parent/child/peer), what happens server‑side when a membership is created, the first‑visit welcome flow, and leaving.

Who uses it:
- **Prospective members** (logged out, logged in non‑members) — see a group's About page and join / request / follow an invite.
- **Members** — leave; when the invite policy is "everyone", invite others.
- **Stewards** with the `Add Members` responsibility — send email invites, manage pending invites, approve/decline join requests. Stewards with `Administration` — create/edit/delete invite links, assign roles via invites/links, set the invite policy, process group‑to‑group invites.

Related modules: group creation/About page/related groups UX → [09-groups.md](09-groups.md); settings tabs (Privacy, Invitations, Requests, Agreements, Related groups) → [11-group-settings.md](11-group-settings.md); roles & responsibilities → [12-roles-permissions-moderation.md](12-roles-permissions-moderation.md); spaces (sub‑groups with their own membership) → [15-views-streams-spaces.md](15-views-streams-spaces.md); notification pipeline / email templates → [19-notifications-email-push.md](19-notifications-email-push.md); paywalled joining → [23-paid-content-stripe.md](23-paid-content-stripe.md); "Invites & Requests" tab UI → [05-user-settings.md](05-user-settings.md); signup with invitation return path → [04-accounts-auth-onboarding.md](04-accounts-auth-onboarding.md).

---

## 2. Concepts & data

### 2.1 Visibility (`groups.visibility`, integer)

| Value | Name (code) | UI title in Create Group | UI description (Create Group) | Legacy description string (About page tooltip / Privacy box) | Icon |
|---|---|---|---|---|---|
| `0` | `Hidden` | "Members only" | "Invisible to everyone except its own members and admins of related groups — the only way in is an invitation." | "Only members of this group or direct child groups can see it" | `Hidden` |
| `1` | `Protected` | "Visible to related groups" | "Members of this group's parent, child, and related groups can find it and see its join page. Everyone else can't see that it exists. New members will need an invite link to see the group." | web: "Only members of this group or direct parent or child groups can see this group"; `@hylo/presenters` (mobile): "Members of parent groups can see this group" | `Shield` |
| `2` | `Public` | "Anyone can find and see" | "This group will be exposed to search engines." | "Anyone can find and see this group" | `Public` |

Default when not supplied to `createGroup`: **`1` (Protected)**. Web Create Group form default is also Protected.

### 2.2 Accessibility (`groups.accessibility`, integer)

| Value | Name (code) | UI title in Create Group | UI description (Create Group) | Legacy description string | Icon |
|---|---|---|---|---|---|
| `0` | `Closed` | "By invitation only" | "Nobody can request to join. Members arrive only when a steward invites them directly or shares an invite link." | "This group is invitation only" | `Lock` |
| `1` | `Restricted` | "By request, with approval" | "People must request to join your group, and be approved by stewards. You can ask applicants questions before they join." | "People can apply to join this group and must be approved" | `Hand` |
| `2` | `Open` | "Anyone can join instantly" | "Anybody who can see the group becomes a member the moment they ask — no review, no waiting." | "Anyone who can see this group can join it" | `Enter-Door` |

Default when not supplied: **`1` (Restricted)**. Web form default: Restricted.

The legacy strings are rendered as `"{Name} - {description}"` (e.g. "Restricted - People can apply to join this group and must be approved") where `Name` is the enum key passed through `t()`.

### 2.3 Who can *see* a group (server rule `groupFilter`)

A group row is returned to a viewer only if `groups.active = true` and:

- **Logged‑out viewer:** `visibility = 2` (Public) only.
- **Logged‑in viewer:** any of
  1. groups the viewer is an active member of;
  2. **parent** groups (parent‑child relationship, active) of those groups — *regardless of the parent's visibility* (so a hidden parent is visible to members of its children);
  3. **child** groups of those groups that are not Hidden; plus *all* children (incl. Hidden) of groups where the viewer has `Administration`;
  4. **peer** groups of those groups that are not Hidden; plus all peers (incl. Hidden) of groups the viewer administers;
  5. spaces (`type='space'`) whose `parent_id` is a group where the viewer has `Administration` or `Add Members` (including Hidden spaces);
  6. non‑Hidden spaces whose parent the viewer is a member of;
  7. every Public group.
- **Invitation bypass:** the `group(slug|id, accessCode, invitationToken)` query skips the filter when `checkInvitation` for the supplied code/token is valid *and* names this group (or this group is the parent of the invited space) — this is how invite and view links reveal Protected/Hidden groups. Fetched groups must still be `active`.
- **Retained paid access:** a former member who still holds a valid paid scope can load the group even if Hidden/Protected (see 23).

Derived matrix (what a non‑member sees, no invitation):

| Visibility \ viewer | Logged out | Logged in, unrelated | Member of a parent group | Member of a child group | Member of a peer group | Admin of a parent / peer |
|---|---|---|---|---|---|---|
| Public | About page | About page | About page | About page | About page | About page |
| Protected | Not found (redirect to login for auth routes) | Not found | About page | About page | About page | About page |
| Hidden | Not found | Not found | Not found | **About page** (parents are always visible to child members) | Not found | About page |

> Note: the create‑group copy for Hidden ("Invisible to everyone except its own members and admins of related groups") matches rows 1/3/4/6; the server additionally reveals hidden parents to child‑group members.

What a non‑member sees **on** the About page is the same regardless of visibility: banner, avatar, name, privacy icons, member count, location (subject to location precision), purpose/description/website/video, privacy settings box, agreements, join section. Stewards list is only shown on a group's *own* About (`isAboutCurrentGroup`) or for farm groups (see 09). The member directory is hidden from non‑members unless `settings.public_member_directory` is true (see 20).

### 2.4 Membership (`group_memberships`)

| Column | Notes |
|---|---|
| `id`, `group_id`, `user_id` | unique per (group,user); rows are never deleted on leave — set `active=false` |
| `active` | boolean; `false` = left/removed |
| `created_at`, `updated_at` | |
| `nav_order` | pin position in global nav; reset to `null` on leave |
| `new_post_count` | badge |
| `group_invite_link_id` | invite link used to join, if any |
| `project_role_id`, `following` | legacy |
| `settings` (jsonb) | see below |

`settings` keys relevant here:

| Key | Set on join | Meaning |
|---|---|---|
| `showJoinForm` | `true` (creator: `false`) | Whether the welcome modal must still be completed. Set to `false` when the member clicks "Jump in!". |
| `agreementsAcceptedAt` | `null` (creator: now) | ISO time agreements last accepted |
| `joinQuestionsAnsweredAt` | now if answers supplied with join; else `null` (creator: now) | |
| `postNotifications` | `'all'` | `none` / `important` / `all` |
| `digestFrequency` | group `settings.default_digest_frequency` if `'weekly'`, else `'daily'` | `daily` / `weekly` / `never` |
| `sendEmail` | `true` | |
| `sendPushNotifications` | `true` | |
| `lastReadAt` | `null` (creator: now) | first‑visit detection (`Membership.lastViewedAt`) |
| `leftSpace` | spaces only | `true` after leaving a space (opts out of auto‑add) |
| `completedAt`, `tokensRemaining` | track / funding‑round spaces | cleared on leave |

**Roles at join:** a joining member gets **no assigned role** — they implicitly hold the group's hidden **All Members** role (via the `group_member_effective_roles` view). Exceptions: the creator gets **Administrator**; an email invitation with `group_role_id` assigns that role; an invite link with `granted_roles` assigns those roles (see §5). Role assignment rows live in `group_memberships_group_roles` (`MemberGroupRole`).

### 2.5 Join requests (`join_requests`)

| Column | Notes |
|---|---|
| `id`, `group_id`, `user_id`, `created_at`, `updated_at` | |
| `status` | `0` Pending, `1` Accepted, `2` Rejected, `3` Canceled |
| `processed_by_id` | steward who accepted/declined |

Answers: `group_join_questions_answers` (`GroupJoinQuestionAnswer`: `group_id`, `join_request_id`, `question_id`, `user_id`, `answer`). Questions: `questions` (`id`, `text`, shared/deduplicated by exact text) linked via `group_join_questions` (`group_id`, `question_id`). Cached counter `groups.num_open_join_requests` (pending count).

### 2.6 Join questions & agreements (settings)

- `groups.settings.ask_join_questions` (`askJoinQuestions`) — when true *and* the group has ≥1 join question, questions are required at join/request time.
- `groups.settings.show_suggested_skills` — show the group's suggested skills during join.
- Agreements: `agreements` (`id`, `title`, `description`) via `groups_agreements` (`group_id`, `agreement_id`, `order`, `active`). Per‑user acceptance: `users_groups_agreements` (`user_id`, `group_id`, `agreement_id`, `accepted` bool). `groups.settings.agreements_last_updated_at` is bumped whenever the set of agreement ids changes; members whose `agreementsAcceptedAt` is older must re‑accept. **Spaces inherit the parent group's agreements** and acceptance is recorded against the parent.

### 2.7 Prerequisite groups

A parent‑child `group_relationships` row has `settings.isPrerequisite` (bool). When true, a person must be an **active member of the parent** before joining the child. Exposed as `Group.prerequisiteGroups(onlyNotMember)` and `Group.numPrerequisitesLeft` (count of prerequisite parents the viewer is not a member of — includes ones the viewer can't see).

### 2.8 Email invitations (`group_invites`, model `Invitation`)

| Column | Notes |
|---|---|
| `id` | |
| `token` | UUID v4; used in the email link |
| `email` | lower‑cased on create |
| `group_id`, `invited_by_id` | |
| `group_role_id` | role to assign on use (nullable) |
| `tag_id` | legacy topic invites (sending them throws "need to re-implement tag invitations") |
| `subject`, `message` | message stored as Markdown→HTML |
| `sent_count`, `last_sent_at` | incremented on every send |
| `used_by_id`, `used_at` | set when used (or when any user with that email joins) |
| `expired_by_id`, `expired_at` | set on expire |
| `created_at` | |

*Pending* = `used_by_id IS NULL AND expired_by_id IS NULL`.

### 2.9 Invitation send allowance (`invitation_sends`)

Rows `(user_id, group_id, recipients, created_at)`. Limits (`InvitationSend.LIMITS`):

| Limit | Value |
|---|---|
| `perSend` | 10 addresses per submission |
| `perInviterPerDay` | 100 addresses per inviter per rolling 24h (across all groups) |
| `perGroupPerDay` | 200 addresses per group per rolling 24h |

Remaining = `max(0, min(100 − sentByInviter24h, 200 − sentToGroup24h))`. Exempt: users with `Administration` in a group whose `groups.lift_admin_invite_limits = true` (a DB‑only flag, no UI). Every *syntactically valid* address counts, even duplicates/existing members. Enforced under Postgres advisory locks (group then user). Exposed as `Group.myInviteAllowance` (null when the viewer can't invite or is exempt).

### 2.10 Invite links (`group_invite_links`, model `GroupInviteLink`)

| Column | Notes |
|---|---|
| `id`, `group_id` | |
| `access_code` | exactly 10 chars `[A-Za-z0-9]`; unique case‑insensitively across links and legacy `groups.access_code` |
| `name` | optional label (trimmed; blank→null) |
| `grant_access` | bool; only meaningful for Restricted top‑level groups |
| `granted_roles` | jsonb array of `groups_roles.id` assigned on join |
| `num_joined_users` | counter |
| `created_by_id`, `created_at` | |
| `deleted_at`, `deleted_by_id` | soft delete |

**Effective grant** (`GroupInviteLink.grantsAccess(link, group)`): `true` for every space, every Open group and every Closed group; for a Restricted top‑level group it is the stored `grant_access`. A link that does not grant access is a **view link**.

Every group/space gets one **system link** at creation (code = `groups.access_code`, `grant_access=true`). Legacy: `groups.access_code` alone is still accepted as a code if no link row matches (always treated as granting).

URLs: granting link → `/invite/{code}`; view link → `/view/{code}`; legacy `/groups/{slug}/join/{code}`.

### 2.11 Invite policy (who can add new members)

Values `'everyone' | 'stewards'` (`GroupRole.InvitePolicy`). Not a column: **`everyone`** = the `Add Members` responsibility is linked to the group's hidden All Members role (`group_roles_responsibilities`), so every member holds Add Members; **`stewards`** = only roles that already include Add Members (system roles Administrator and Host, plus custom roles). Top‑level groups only (spaces → `null`). Default for new groups: `'stewards'` (`DEFAULT_NEW_GROUP_INVITE_POLICY`). Readable as `Group.invitePolicy` only by Administrators.

### 2.12 Group‑to‑group invites (`group_relationship_invites`)

| Column | Notes |
|---|---|
| `id`, `from_group_id`, `to_group_id` | |
| `type` | `0` ParentToChild (from=parent invites to=child), `1` ChildToParent (from=child asks to join to=parent), `2` PeerToPeer |
| `status` | `0` Pending, `1` Accepted, `2` Rejected, `3` Canceled |
| `created_by_id`, `processed_by_id`, `processed_at`, `canceled_by_id`, `canceled_at` | |
| `message` (peer: becomes relationship description), `subject` | |

Answers to `group_to_group_join_questions` stored in `group_to_group_join_request_question_answers` (`join_request_id` = invite id, `question_id`, `answer`). Resulting relationship: `group_relationships` (`parent_group_id`, `child_group_id`, `relationship_type` 0=parent‑child / 1=peer, `active`, `description`, `settings.isPrerequisite`). Full relationship UX → 09.

---

## 3. Routes / entry points

| Path | Component | Notes |
|---|---|---|
| `/groups/:slug/about` (also `/groups/:slug` for non‑members via public/detail routing) | `GroupDetail` | About + Join section. Query params `accessCode`, `token` carry invitations. Hash `#agreements` scrolls to agreements. |
| `/groups/:slug/about?accessCode=X` / `?token=T` | `GroupDetail` | pre‑approved join |
| `…/group/:detailGroupSlug` (any context) | `GroupDetail` as side panel/modal (not full page) | close "×" removes the segment |
| `/invite/:accessCode` | `JoinGroup` | granting links (also any code) |
| `/view/:accessCode` | `JoinGroup` | view links (same handler; grant decided by server) |
| `/groups/:groupSlug/join/:accessCode` | `JoinGroup` | legacy invite path (still produced as `invitePath` fallback) |
| `/h/use-invitation?token=T&email=E` | `JoinGroup` | email invitation link (steward invites) |
| `/h/invitation?token=T` | `JoinGroup` | reserved for "limited access" member invitations (see §9) |
| `/groups/:slug/welcome` | `GroupWelcomePage` | first‑visit landing when enabled |
| any `/groups/:slug/*` | `GroupWelcomeModal` overlay | welcome / agreements / questions modal |
| `/groups/:slug/settings/invite` | Invite settings tab (11) | same content as Invite dialog |
| `/groups/:slug/settings/requests` (`/requests` redirect) | Join requests tab (11) | |
| `/my/invites-requests` | user settings tab (05) | "My invites" list |
| Invite People dialog | `InviteMembersDialog` | `UserPlus` button in group menu header, context menu, Members page, currently‑active members |

All of `/h/use-invitation`, `/h/invitation`, `*/join/*`, `/invite/*`, `/view/*` are treated as "join paths" by `RootRouter` and work for logged‑out users (NonAuthLayoutRouter mounts `JoinGroup` too).

---

## 4. UX specification

### 4.1 JoinGroup (link resolver; no UI except a spinner)

Shows `<Loading />` while it runs, then `Navigate replace`:

1. Read `token` (query) and `accessCode` (route). If both empty → error path.
2. `checkInvitation({ invitationToken, accessCode })`. If `!valid` or no `groupSlug` → error path.
3. Track analytics `INVITE_LINK_OPENED` `{ groupId, method: 'token'|'code', signedIn }`.
4. If the invite is for a **space**, the user is signed in, and already a member of the parent group: call `joinSpace(groupId, accessCode, token)` (errors swallowed) and redirect to `/groups/{parent}/spaces/{localSlug}?accessCode=…|token=…`.
5. Destination slug = parent group slug if it's a space invite and the user is not a parent member; otherwise the invited group's slug.
6. Signed in → redirect to `/groups/{dest}/about?accessCode=X` (or `?token=T`; accessCode wins if both).
7. Not signed in → store return path `/groups/{dest}/about?…` (`setReturnToPath`) and redirect to `/signup`, passing `state.email` = invitation email (from check result, else `email` query param) so the signup form is prefilled.

Error path:
- Signed in: toast error (id `invalid-invite`) **"Sorry, your invitation to this group is expired, has already been used, or is invalid. Please contact a group Host for another one."**; if the route had a group slug (`/groups/:slug/join/…`) and the user can see that group → redirect to its About with `state.invalidInvite=true` (GroupDetail re‑shows the same toast); otherwise redirect to the user's base URL.
- Signed out: redirect to `/signup?error=invite-expired`.

> The join itself is **never automatic** for top‑level groups: invitations only reveal the About page and pre‑approve the Join button.

### 4.2 Group About page as join page (`GroupDetail`)

Layout and non‑join sections are specified in 09 §About. Join‑relevant behaviour:

**Invitation checking.** If URL has `accessCode` or `token`, call `checkInvitation` once:
- `email` → stored for mismatch check (token invites only).
- `groupRole` → shows role banner.
- For `accessCode`: `grantAccess = result.grantAccess !== false` (view link → false).
- If the invite is for a space whose parent is this page's group: remember `linkedSpaceName/Slug/Id`.
- Group details are fetched with `accessCode`/`invitationToken` (bypasses visibility).
- While a token invite is being checked for a logged‑in user → `<Loading />`.

**Email mismatch screen** (token invite, logged in, invite email ≠ user email, case‑insensitive): centered column, min‑height 400px: `AlertTriangle` icon 64px warning colour; H2 **"This invitation is not for your account"**; text **"This invitation was sent to {{email}}. You are currently logged in as {{userEmail}}."**; small text **"Please log in with the correct account or request a new invitation."** Group details are hidden.

**Bottom section selection** (only when not viewing the current group's own About from inside it, and no retained‑access panel):
- `group.paywall` → `JoinSection` (→ Paywall offerings, see 23).
- Not logged in → a full‑width button‑like link to `/login?returnToUrl={pathname}` (opens in new tab when embedded in an iframe): **"Signup or Login to connect with"** + bold group name.
- Already a member → **"You are a member of "** + link to group home.
- Otherwise → `JoinSection`.

When `isAboutCurrentGroup` and the viewer is a member: a dashed card with an outline button **"Leave Group"** (or **"Leave Space"**) in accent colour; plus a "Notification Settings" card (bell icon) with the membership notification controls (spaces: segmented picker Mute / Important / All with descriptions "You won't hear about new posts in this space." / "Only announcements and posts that mention you." / "Every new post in this space.").

### 4.3 JoinSection

Container: full‑width (max 750px when full page), column. Order of content:

1. **Role banner** (when invitation has a `groupRole`): rounded‑xl box `bg-selected/10`, border `selected/30`, centered: role emoji (xl) + **"When you join, you will receive the {{roleName}} role"**.
2. **Linked space notice** (space invite routed to parent): same styling: **"You will also be added to space {{name}} on joining"**.
3. Then the first matching case:

| Condition | Rendering |
|---|---|
| `group.prerequisiteGroups.length > 0` (prereqs the user isn't in, that the user can see) | Dashed box `bg-midground`, heading (centered, muted): if 1 prereq: "{group.name} **is only accessible to members of** {prereq.name}"; else **"{{group.name}} is only accessible to members of the following groups:"**. For each prereq a card: 83px‑tall banner link (gradient to black/70) with 50px avatar, white bold name, visibility & accessibility icons with tooltips, location; below: **"To join"** {group} **"visit"** [pill link prereq] **"and become a member"**. No join button. |
| `numPrerequisitesLeft > 0` (prereqs exist but hidden) | Plain text **"This group has prerequisite groups you cannot see, you cannot join this group at this time"** |
| Open | `JoinQuestionsAndButtons` with label **"Join {{group.name}}"** → `joinGroup` |
| Restricted/Closed with a granting link or any email token | `JoinQuestionsAndButtons` **"Join {{group.name}}"** (pre‑approved) |
| Restricted/Closed with a pending request (from `me.joinRequests` status 0) | Dashed box border `selected`: H3 **"Request to join pending"** + **"You will be sent an email and notified on your device when the request is approved."** |
| Restricted (no link) | `JoinQuestionsAndButtons` **"Request Membership in {{group.name}}"** → `createJoinRequest` |
| Closed (no link) | Dashed box: **"This group is invite only. You require a join or invite link in order to join."** |

**JoinQuestionsAndButtons**: dashed rounded‑xl box. Barriers = agreements (any) and/or required questions (`askJoinQuestions` && ≥1 question). Expandable content = barriers or suggested skills (`group.suggestedSkills.length > 0`).
- Initially collapsed if there is expandable content; first button click expands (no mutation).
- Expanded shows `JoinBarriers` (with "join" intro copy) and `SuggestedSkills` (add/remove skills to own profile).
- Button (secondary variant, 2px `selected` border, full width, bold, rounded‑xl) is disabled while expanded and barriers unmet; tooltip on hover gives the reason: **"You must answer all questions and accept all agreements to join"** / **"You must answer all the questions to join"** / **"You must accept all agreements to join"**.
- On click when satisfied: call handler with question answers (`[{questionId, answer}]`).

**JoinBarriers**:
- Agreements block: H3 **"Agreements"**, intro **"Please review and accept the following agreements to join:"** (non‑join variant: "Please review and accept the following agreements:"). Each agreement in a `bg-input` rounded‑xl card: bold title, description (plain text, small, 70% opacity), checkbox **"I agree to the above"**. If more than 3 agreements, an extra row checkbox **"I agree to all of the above"** toggling all.
- Questions: label **"Please answer the following to join:"** (non‑join: "Please answer the following:"); per question a `bg-input` card with H3 question text and textarea placeholder **"Type your answer here..."**. All answers must be non‑blank after trim.

**After Join** (`joinGroupHandler`): calls `joinGroup(groupId, answers, accessCode, token, acceptAgreements=true)`. Then: in mobile WebView → post message `JOINED_GROUP {groupSlug}`; if a linked space → `joinSpace` (errors ignored) then navigate to the space; else navigate to `groupUrl(slug)` (the group home; first visit may redirect to `/welcome`, §4.6). Analytics `GROUP_INVITATION_ACCEPTED {groupId, method:'email'|'link'}` when a code/token was used. The membership is inserted optimistically.

**After Request**: `createJoinRequest(groupId, answers)`; on success the pending box replaces the button (the request appears in `me.joinRequests`).

### 4.4 Welcome modal (`GroupWelcomeModal`)

Mounted on every `/groups/:groupSlug/*` route. Shown when the current user's membership has `settings.showJoinForm === true` **or** agreements changed (group has ≥1 agreement and either `agreementsAcceptedAt < settings.agreementsLastUpdatedAt`, or never accepted and not all agreements are marked accepted in `membership.agreements`). On show it fetches `GroupWelcomeQuery` (settings, agreements, join questions, suggested skills, the user's membership with agreements and answers).

Visual: fixed full‑screen overlay `bg-darkening/50` + backdrop blur, z‑index 1000, scrollable; card `bg-midground`, max‑width 750px, rounded‑xl, padding 16px; enters with a 400ms fade ("welcome-modal" transition). Header: banner image (group banner or default) with fade gradient, 50px square avatar, H2 **"Welcome to {{group.name}}!"**, and "(1/2)" / "(2/2)" when both pages exist.

Pages:
- **Page 1 (agreements)** — exists only when agreements changed/unaccepted. Shows **"Our Purpose"** + purpose text (if any); dashed box **"Our Agreements"**; if previously accepted: **"The agreements have changed since you last accepted them. Please review and accept them again."**; ordered list of agreements (title H3, Markdown description), each with a pill checkbox **"I agree to the above"** (pill turns `bg-selected` when checked; pre‑checked if already accepted); if >3 agreements, **"I agree to all of the above"**. Primary button disabled until all checked.
- **Page 2 (questions/skills)** — exists when join questions are still required (`askJoinQuestions`, no `joinQuestionsAnsweredAt`, no saved answers) or suggested skills should be shown (`showSuggestedSkills`, has skills, no answers yet). Shows purpose; `SuggestedSkills`; heading **"Please answer the following questions to enter"** and question textareas (prefilled with saved answers). Primary button disabled until all answered (skills optional).
- If neither page has content, page 2 renders with just the purpose (the modal still shows when `showJoinForm` is true — e.g. right after a pre‑approved join).

Buttons: **"Previous"** (page 2 when page 1 exists); primary (secondary variant, full width) **"Next"** (page 1 with page 2 after) or **"Jump in!"**; on page 1 an outline **"Decline"** → `window.confirm("Are you sure you want to decline the agreements and leave this group?")` → `leaveGroup` → navigate `/`.

"Jump in!" calls `updateMembership(groupId, { settings: { joinQuestionsAnsweredAt: now, showJoinForm: false }, acceptAgreements: true, questionAnswers })` (answers omitted if previously answered). Analytics `GROUP_WELCOME_COMPLETED {groupId, hadAgreements, hadJoinQuestions}` only when it was the first welcome (`showJoinForm` was true).

### 4.5 Welcome page landing

On entering a top‑level group the user is a member of with no `lastViewedAt` (first visit), if the group has a `welcome` view and `settings.showWelcomePage !== false`, the app redirects to `/groups/{slug}/welcome` (unless the URL opens a specific post). The visit isn't recorded until they leave the welcome page, so the next entry lands there again. Spaces do the same inside nested routes. Page content → 09 §Welcome page.

### 4.6 Invite People dialog / Invite tab

Trigger: `UserPlus` icon button (tooltip **"Invite Members"**) visible only to users with `Add Members` in the group (hover‑reveal on pointer devices unless `alwaysVisible`). Opens a dialog (max 750px, max‑height 90vh scroll) titled **"Invite People"** with a 32px tinted rounded icon tile (People icon). The same body is the settings route `…/settings/invite` (header title "Invite People"). Inside the dialog, pending invites are limited to the ones the viewer sent (`onlyMine`) and "Resend All" is hidden.

Sections, top to bottom (each a dashed rounded card):

1. **Public Group Link** — only for non‑space Public groups. Helper text by accessibility: Open **"To see the group and join"**, Closed **"To see the group profile. They will not be able to join the group."**, Restricted **"To see the group and request to join."** Copy box shows `{origin}/groups/{slug}` (right‑aligned ellipsis), chip **"Copy"** → **"Copied!"** for 3s; tooltip **"Click to Copy"**.
2. **View Links** — only for non‑space **Restricted** groups that are **not Public**. Explainer **"Let someone see the group and request to join."** Lists non‑granting links; Administrators see **"Create View Link"** (tooltip "These links allow for viewing the group, but still require a request to join.").
3. **Invite Links** — hidden for top‑level Open+Public groups. Explainer:
   - space: Hidden "This space is hidden. Anyone with a link can see it and join."; Restricted "Anyone with a link can join this space without requesting."; Closed "Anyone with a link can see this space and join."; else "Anyone with a link can join this space."
   - Open group: Hidden "This group is hidden. Anyone with an invite link can see it and join."; Protected "Anyone invited can see the group and join."; else "Anyone with this link can see the group and join."
   - Closed: "Grant access to the group."; Restricted: "Grant access to the group without a request."
   Administrators see **"Create invite link"** (+ icon).
   Each link row: optional meta line (name in medium weight; **"Grants Role(s):"** + role pills `emoji name`), copy box with a leading icon — `KeyRound` for granting links (tooltip: space "This link will grant access to the space"; Restricted "This link will grant access to the group without requesting to join"; else "This link will grant access to the group") or `Eye` for view links (tooltip "Gives access to view the group, but people still have to request to join.") — URL `{origin}/invite/{code}` or `/view/{code}`, Copy chip; Administrators get a `⋮` menu (**"Edit"**, **"Delete"** in red; delete confirms **"Delete this invite link? It will stop working."**). Under the row: **"{{count}} joined"** when >0.
   Link editor (create/edit): input placeholder **"Name (optional)"**; for granting links and Administrators: chosen role chips with "×" and a select **"Add a role this link grants"** listing active roles; buttons **"Save"** (green) / **"Cancel"**. New links get a client‑generated random 10‑char alphanumeric code.
4. **Invite people on Hylo** — role‑gated space warning (accent box): **"Only members with one of the required roles will actually be able to join the space."** + link **"Go to group roles"**. Helper: group **"Search people you can see on Hylo."** / space **"Search members of {{name}} who aren't already in this space."**. People selector (placeholder **"Search people..."** / **"Search members of {{name}}..."**), shows recent contacts by default, paginated "load more"; excludes people with pending invites (matched by id, email or name). For role‑gated spaces, people sorted "Has role" first then "No role".
5. **Send Invites via email** — helper group: **"An invitation link will be sent to each email address. They will still be shown any required questions or agreements you may have set to join this group."**; space: **"An invitation link will be sent to each email address to join this space. If they are not yet a member of {{name}} they will be asked to join that first."** Then **"Enter up to {{max}} email addresses at a time, separated by commas or new lines"** (max 10), auto‑growing textarea placeholder **"example@domain.com, secondexample@domain2.us, etc@example.com"**. Administrators: **"Assign a role to invitees (optional):"** select with **"No special role"** + active roles (role‑gated spaces: only required roles). When an allowance applies: **"Invites left today: {{remaining}}"**. Button **"Send Invite"** (green) disabled when no emails and no people selected, while sending, or allowance 0.
   - Parsing: split on commas/newlines, trim, `Name <addr>` → `addr`.
   - Client check: distinct emails + selected people > 10 → **"You can invite up to {{max}} people at a time"**.
   - Result: invalid addresses are put back in the textarea and **"{{numBad}} invalid email address/es found (see above))."**; success **"Sent 1 invite"** / **"Sent {{numGood}} invites"**; server `invite-limit` → **"You don't have enough invites left today for all of these addresses."**; other errors **"Something went wrong. Please try again."**. Analytics "Group Invitations Sent" `{numGood, numSubmitted}`.
   - Sandbox mode: toast **"Create an account to invite people"** with action **"Sign up"**.
6. **Pending Invites** (if any) — header + **"Resend All"** (settings page only; confirm **"Are you sure you want to resend all Pending Invitations"**). Rows: name + muted email (or email), muted `humanDate(lastSentAt)` + " · **Invited by {{name}}**"; actions **"Expire"** and **"Resend"** (becomes **"Sent"** after resend). Footer **"{{from}}-{{to}} of {{total}}"** + **"Load more"** (page size from store constant).

### 4.7 Join requests management (steward side)

UI lives in the Requests settings tab (11). Behaviour: list via `joinRequests(groupId, status)` (requires Add Members); Accept → `acceptJoinRequest`, Decline → `declineJoinRequest`. Count badge from `Group.openJoinRequestCount`, updated in real time via socket event `openJoinRequestCountUpdated {groupId, openJoinRequestCount}` pushed to the group room, the parent's room (spaces), and each user with Add Members.

### 4.8 Leaving a group

Entry points: About page "Leave Group"/"Leave Space" (dialog: title same as button, text **"Are you sure you want to leave {{group_name}}? You will no longer have access to this group's content."** / "…this space's content.", buttons **"Cancel"** / destructive **"Leave Group"**); welcome modal "Decline"; user settings "Groups" tab (05); mobile. After leaving from About: navigate to `/` (space: back to the space URL, which shows SpaceJoinPage).

---

## 5. Business rules & side effects

### 5.1 `joinGroup(groupId, questionAnswers, accessCode, invitationToken, acceptAgreements)`

1. Load user and group (errors "User id X not found" / "Group id X not found").
2. If `accessCode` or `token`: `InvitationService.check`. Invitation *approves* if valid and either (code given and link grants access) or (token given and the invitation is for this group or for a space of this group).
3. `inviteIsForThisGroup` = approves && `check.groupSlug === group.slug`; `inviteIsForChildSpace` = approves && `check.parentGroupSlug === group.slug`.
4. If group is not Open and neither → **"You do not have permission to do that"**.
5. Prerequisites: for every prerequisite parent the user is not an active member of → **"You must be a member of group {name} first"**.
6. `user.joinGroup(group, { questionAnswers, fromInvitation })` (§5.3).
7. If joined via a granting code for this group and wasn't previously a member (active or inactive row) → `GroupInviteLink.recordJoin` (assign link roles, store `group_invite_link_id`, increment `num_joined_users`).
8. If `acceptAgreements` → `membership.completeJoinBarriers()`: record acceptance of all agreements (only if the group has agreements; sets `agreementsAcceptedAt`, upserts `users_groups_agreements.accepted=true`) and set `joinQuestionsAnsweredAt` if missing. `showJoinForm` stays `true` so the welcome modal still appears.
9. If it was a space invite → `joinSpace(user, spaceId, code, token)`. Else if a token invite for this group → `invitation.use(userId)` (assigns `group_role_id`, marks used).
10. Return membership.

Note: `paywall` is not checked here (TODO in code); paywalled groups are joined via checkout webhooks (23).

### 5.2 `createJoinRequest(groupId, questionAnswers)`

- If a Pending request by this user for the group exists → return it (no new answers saved).
- Else create (status 0) — previous processed requests are kept — then save each answer (`GroupJoinQuestionAnswer` with `join_request_id`).
- `afterCreate`: increment `num_open_join_requests` (+ socket broadcast); notify (Activity reason `joinRequest`, `other_group_id` = parent for spaces) **every user holding `Add Members`** on the group (or on the parent for spaces), excluding the requester → in‑app notification, push **"{actor} asked to join {group}"** (space: "…asked to join {space} in {parent}") linking to the group's join‑request settings, and email (SendWithUs template `tem_Dkvtfv9HGgYgjqD4KCXPPdy6`, clickthrough `?ctt=join_request_email&check_join_requests=1`).
- No validation that the group is Restricted, that the user isn't already a member, or that required answers are present (UI enforces). The schema accepts `invitationToken` but the resolver ignores it.

### 5.3 Membership creation (`User.joinGroup` → `Group.addMembers`)

For each user:
- If a membership row exists (active or not): update it — `active=true`, settings merged with the join defaults and a **join‑flow reset**: `joinQuestionsAnsweredAt=null`, `showJoinForm=true`, and (because `active` changes) `agreementsAcceptedAt=null`, `lastReadAt=null`; spaces also `leftSpace=false`. Caller‑supplied settings win.
- Else insert with settings: `agreementsAcceptedAt` / `joinQuestionsAnsweredAt` = now and `showJoinForm=false` **only for the group creator**; otherwise null/true; plus `postNotifications:'all'`, `digestFrequency` (group default), `sendEmail:true`, `sendPushNotifications:true`, `lastReadAt`.
- Follow the group's **default topics** (`groups_tags.is_default = true`) → `tag_follows` (= auto‑join default chat rooms).
- If `assignAdministrator` → Administrator role (top‑level groups only).
- `num_members += new + reactivated`.
- `markInvitationsUsed`: every invitation to this group whose email matches the user's (case‑insensitive) is marked used (`used_by_id`, `used_at`) — even expired ones.
- Join question answers passed in are saved (without `join_request_id`).
- Background job `Group.afterAddMembers`:
  - Auto‑add the new/reactivated members to every space of the group with `settings.auto_add_members` (skipping people who left that space; space memberships copy the parent membership's notification settings, `showJoinForm:false`, barriers pre‑completed, `lastReadAt` now; per‑view unread rows created, chat views marked read).
  - Publish GraphQL subscription `groupMembershipUpdate` (`action: 'joined' | 'rejoined'`) to members and the new member.
  - Zapier triggers of type `new_member` for the group: POST array of member objects (`id, avatarUrl, bio, contactEmail, contactPhone, facebookUrl, linkedinUrl, location, name, profileUrl, tagline, twitterName, url, reactivated, group{id,name,url}`).
  - Mixpanel `GROUP_NEW_MEMBER`.
- **No notification is sent at join time.** The "new member" notification fires when the member first finishes the welcome flow: `updateMembership` with `settings.showJoinForm=false` while it was previously true queues `Group.afterFinishedJoining` → Activity `memberJoinedGroup` to each `group.moderators()` (members holding responsibility id 3 — see quirks) → push **"New member has joined {group}: {name}"** and email (`tem_rvbqYrfMK8VQkqCPJXBRd6KR`, includes latest join‑question answers). Skipped for auto‑add spaces.

### 5.4 Accept / decline / cancel join requests

- `acceptJoinRequest(joinRequestId)` — requires `Add Members` on the request's group. `user.joinGroup(group)` then `completeJoinBarriers()` (agreements accepted + questions marked answered, since the requester did it when applying); status → 1, `processed_by_id`; Activity `approvedJoinRequest` to the requester (push **"{approver} approved your request to join {group}"**, email `tem_JjPbSJqj4wbJqSydqw49VrfT` with approver name/avatar/profile and group link); decrement open count if it was pending. Note: accepting a non‑pending request re‑joins the user.
- `declineJoinRequest` — requires Add Members; status → 2; decrement if was pending. **No notification to the requester.**
- `cancelJoinRequest` — only the requester; status → 3; decrement.

### 5.5 Email invitations

`createInvitation(groupId, { emails, userIds, groupRoleId, assignAdministrator })`:
1. Requires `Add Members` (**"You don't have permission to create an invitation for this group"**). Setting `groupRoleId` or `assignAdministrator` additionally requires `Administration` (**"You don't have permission to invite people with a role"**). Role id must be an assignable (active system/custom, not All Members) role.
2. Role‑gated spaces: each `userIds` target must hold a required role on the parent, else **"{name} does not have the required role to join this space"**.
3. Subject (inviter's locale): **"Join me in {group} on Hylo!"**; message: "Hi!\n\nI'm inviting you to join {group} on Hylo.\n\n{group} is using Hylo for our online community: this is our dedicated space for communication & collaboration." (rendered Markdown, autolinking off). Custom subject/message from the client is not supported.
4. Recipient list = emails + account emails of `userIds`. Allowance enforced on the count of valid addresses (>10 → **"You can invite up to 10 people at a time"**; over daily allowance → `invite-limit`).
5. Per address: invalid → `{ email, error: 'not a valid email address' }`; else create Invitation (lowercased email, uuid token, role; `assignAdministrator` maps to the Administrator role id) and queue `Invitation.createAndSend`. If the address belongs to an existing user (other than the sender) → Activity `groupInvitation` (in‑app + push **"{actor} has invited you to join them in {group}"** / "…in space {space} in {parent}"; no email for this reason since the invitation email itself is sent).
6. **No de‑duplication**: inviting an existing member or someone already invited creates another invitation.
7. Returns `{ invitations: [{ id, email, createdAt, lastSentAt, error }] }`.

`Invitation.send()`: increments `sent_count`, sets `last_sent_at`, sends SendWithUs invitation email with `subject, message, inviter_avatar_url, inviter_name, inviter_email, locale, group_name, group_avatar_url, group_url, invite_link = {base}/h/use-invitation?token={token}&email={urlencoded email}, tracking_pixel_url`.

Automatic reminders (cron `Invitation.resendAllReady`): pending invitations with `sent_count=1` and last sent > 4 days ago, or `sent_count=2` and > 9 days ago, are resent (max 3 sends total).

`resendInvitation(invitationId)` — allowed for the invitee (email match) or Add Members holders; resends (no allowance check). `reinviteAll(groupId)` — Add Members; queues a resend of every pending invitation of the group. `expireInvitation(invitationId)` — invitee or Add Members; sets `expired_by_id/at`.

Using a token (`useInvitation` mutation / `InvitationService.use`): not found → "not found"; expired → "expired"; else `invitation.use`: existing active membership is returned, else `joinGroup(fromInvitation)`; assign `group_role_id` (duplicates ignored); mark used if not already. **The token is not bound to the email** server‑side; the web enforces the match on the About page (§4.2). A used token fails `checkInvitation` (`used_by_id IS NULL` required) but `useInvitation` still succeeds for a used token (returns membership).

### 5.6 Invite links

- Create (`createGroupInviteLink(groupId, {accessCode, name, grantAccess, grantedRoleIds})`) — requires `Administration`. Errors: **"Open groups do not have invite links to create"** (top‑level Open **Public** group); **"Invite link code must be 10 letters or digits"**; **"That invite link code is already in use"**; **"Only a link that grants access can assign roles"**; **"Invite link roles must be active roles in this group"**. `grant_access` forced `true` unless the group is a top‑level Restricted group.
- Update (`updateGroupInviteLink(id, {name, grantAccess, grantedRoleIds})`) — Administration; **"Open groups cannot edit their invite link"** for Open+Public; same grant/role rules. Code can't change.
- Delete (`deleteGroupInviteLink(id)`) — Administration; soft delete; **"Open groups cannot delete their invite link"** for Open+Public. Missing/deleted link → **"Invite link not found"**.
- Use (`useInvitation(accessCode)`): link not found → fall back to `groups.access_code` → else "Invalid access code"; view link → **"This link does not grant access to join"**; active member → return membership; else `addMembers` (no join form defaults beyond addMembers) + `recordJoin`. (Web uses `joinGroup` with `accessCode` instead.)
- `recordJoin`: assigns each still‑active granted role on the role scope (parent for spaces) if not already held; sets membership `group_invite_link_id`; `num_joined_users + 1`.
- `invitePath` (deprecated field): first granting link → `/invite/{code}` (or `/view/{code}` if none grants), else legacy `/groups/{slug}/join/{access_code}`; only for Add Members holders. `inviteLinks` likewise.
- The documented `regenerateAccessCode` mutation no longer exists; "resetting" a link = delete + create.

### 5.7 Invite policy

`updateGroupSettings(id, { invitePolicy })` (Administration) → `GroupRole.setInvitePolicy` under an advisory lock: `everyone` inserts (All Members role, Add Members) into `group_roles_responsibilities`; `stewards` deletes it. Errors: "Unknown invite policy", "Only top-level groups have an invite policy". Set on `createGroup` from `data.invitePolicy` (default `stewards` for non‑space groups). Web tracks analytics via `trackInvitePolicySet(mode, 'create'|…)`.

Consequence of `everyone`: every member holds `Add Members` and can therefore send email invites (within the allowance), use and copy invite links, see pending invites, **and accept/decline join requests** (same responsibility). The InvitePolicySelect description for non‑Open groups ("A steward approves each person before they join.") describes the planned "limited access" behaviour, not current server behaviour (see §9).

### 5.8 Leaving (`leaveGroup(id)`) and removal (`removeMember(personId, groupId)`)

`leaveGroup`: `user.leaveGroup(group)` → `group.removeMembers([userId])`:
1. Settle participation (track/funding‑round spaces): clear `completedAt`/`tokensRemaining`, decrement enrollment/participant counters, zero the leaver's token allocations.
2. Membership `active=false`, `nav_order=null`; spaces left directly get `settings.leftSpace=true`.
3. Delete the user's per‑view unread rows for this group's views.
4. If leaving the role‑scope group (top‑level): revoke all role assignments (also enforced by a `saving` hook) and set all `users_groups_agreements.accepted=false` for this group.
5. Top‑level: cascade — deactivate the user's memberships in all child **spaces** (without `leftSpace`, so they'd be auto‑added again on rejoin).
6. `num_members −1` (floored at 0).
7. Background `User.afterLeaveGroup`: Zapier `member_leaves` POST `{ id, name, group{id,name,url}, removedByModerator }`.
- `leaveGroup` returns the group id; no notification is sent. Join requests and invitations are untouched; tag follows remain.

`removeMember` requires `Remove Members` ("You don't have the right responsibilities for this group"); same as leave with `removedByModerator=true`, and publishes `groupMembershipUpdate {action:'left'}` to the group and the removed user.

Rejoining later reactivates the same row with the join‑flow reset (welcome modal and agreements again; `lastReadAt` null → welcome page again).

`rejoinGroup(groupId)` — paywalled groups only, for a former member with a still‑valid paid scope (see 23): restores prior notification settings, `showJoinForm:false`.

### 5.9 Group‑to‑group invitations & requests

Mutations (`from` group must be administered by the caller — `Administration`; errors "Group not found", "Invalid group relationship type", "Groups are already related"):

| Mutation | Type | Meaning |
|---|---|---|
| `inviteGroupToJoinParent(parentId, childId)` | ParentToChild (0) | parent invites a group to become its child |
| `requestToAddGroupToParent(parentId, childId, questionAnswers)` | ChildToParent (1) | child asks to join a parent (answers to the parent's group‑to‑group join questions) |
| `invitePeerRelationship(fromGroupId, toGroupId, description)` | PeerToPeer (2) | peer connection ("Cannot create peer relationship between the same group"; "Target group not found") |

- If the caller also administers the target group → relationship created/reactivated immediately (`addChild`/`addParent`, or a peer row with `description`), returns `{ success, groupRelationship }`.
- Otherwise a `GroupRelationshipInvite` (Pending) is created, answers stored, and Activity sent to every `toGroup.moderators()` with reason `groupChildGroupInvite` / `groupParentGroupJoinRequest` / `groupPeerGroupInvite` (copy: "{actor} invited your group {child} to join their group {parent}" / "{actor} is requesting to add their group {child} as a member of your group {parent}" / "{actor} invited your group {to} to form a peer relationship with {from}"). Returns `{ success, groupRelationshipInvite }`.
- `acceptGroupRelationshipInvite(id)` / `rejectGroupRelationshipInvite(id)` — Administration on `to` group. Accept creates/reactivates the relationship (peer description = invite message) and queues accept notifications: parent‑child → all **members** of both groups (only stewards for a hidden group on the "inviting" side), peer → stewards of both; reason suffixes `:{parent|child|peer}:{moderator|member}` (e.g. "The group {child} just joined your group {parent}!", "Your group {child} has joined {parent}. You can now join {parent}!"). Publishes `groupRelationshipUpdate {action:'invite_accepted'}`. Reject: status 2, no notification.
- `cancelGroupRelationshipInvite(id)` — Administration on `from` group; status 3.
- `deleteGroupRelationship(parentId, childId)` — Administration on either side; sets `active=false`; publishes `relationship_removed`. `updatePeerRelationship` / `deletePeerRelationship` — Administration on either side.
- `createGroup` with `parentIds`: for each parent (skipping spaces), if the creator administers it **or the parent is Open and the creator is a member** → attach directly; else a ChildToParent request is created automatically.

Joining a child or parent group as a person is independent of relationships — except **prerequisites** (§2.7) and visibility (§2.3). Members of a child group see its parent's About page and can join if the parent's accessibility allows.

---

## 6. Permissions

| Action | Requirement |
|---|---|
| See group / About page | §2.3 (or valid invitation for that group) |
| Join Open group | logged in, can call mutation (visibility not re‑checked server‑side), prerequisites met |
| Join Restricted/Closed group | valid granting invite link, or valid email token for this group/its space |
| Request to join | logged in (any group; server doesn't check accessibility) |
| Cancel own request | requester |
| See/accept/decline join requests | `Add Members` on group (spaces: on group or parent) |
| Send email invites, see pending invites, copy links, resend/expire any pending invite, reinvite all | `Add Members` |
| Invite with a role | `Administration` |
| Create/edit/delete invite links, assign link roles | `Administration` |
| See/change invite policy | `Administration` |
| Expire/resend an invitation addressed to me | invitee (email match) |
| Remove a member | `Remove Members` |
| Group‑to‑group invites | `Administration` on from‑group; accept/reject: on to‑group; cancel: on from‑group |
| Delete a group | `Administration` |

`Add Members` is held by Administrator and Host system roles, custom roles with it, and everyone when the invite policy is `everyone`. Spaces inherit responsibilities from the parent (parent membership required).

---

## 7. API

Queries:
- `checkInvitation(invitationToken, accessCode): CheckInvitationResult { valid, groupId, groupSlug, groupName, isSpace, parentGroupSlug, parentGroupName, email, groupRole{id,name,emoji}, grantAccess, groupRoles[] }` (public and authenticated). For tokens `grantAccess` is always true; `email` only for tokens.
- `group(id|slug, accessCode, invitationToken, updateLastViewed)`; fields: `accessibility, visibility, settings{askJoinQuestions, showSuggestedSkills, showWelcomePage, agreementsLastUpdatedAt, publicMemberDirectory, …}, agreements, joinQuestions{id, questionId, text}, suggestedSkills, prerequisiteGroups(onlyNotMember), numPrerequisitesLeft, invitePath, inviteLinks, invitePolicy, myInviteAllowance, pendingInvitations(first, offset, onlyMine), openJoinRequestCount, memberships(userId), groupRelationshipInvitesFrom/To, groupToGroupJoinQuestions, currentUserMembershipActive, hasValidScope`.
- `joinRequests(groupId, status)` — Add Members.
- `me { joinRequests(status), groupInvitesPending, memberships{ settings{showJoinForm, agreementsAcceptedAt, joinQuestionsAnsweredAt, …}, agreements{id, accepted}, joinQuestionAnswers, lastViewedAt } }`.
- `groupExists(slug)`.

Mutations: `joinGroup`, `rejoinGroup`, `leaveGroup(id): ID`, `createJoinRequest(groupId, questionAnswers, invitationToken) → { request }`, `acceptJoinRequest(joinRequestId)`, `declineJoinRequest(joinRequestId)`, `cancelJoinRequest(joinRequestId) → { success }`, `createInvitation(groupId, data: InviteInput{emails, userIds, assignAdministrator, groupRoleId}) → { invitations }`, `expireInvitation(invitationId)`, `resendInvitation(invitationId)`, `reinviteAll(groupId)`, `useInvitation(invitationToken, accessCode) → { membership, error }` (errors are returned in `error`, not thrown), `createGroupInviteLink(groupId, data: GroupInviteLinkInput)`, `updateGroupInviteLink(id, data)`, `deleteGroupInviteLink(id)`, `updateMembership(groupId, data{ settings, acceptAgreements, questionAnswers, navOrder, newPostCount })`, `removeMember(personId, groupId)`, `updateGroupSettings(id, changes{ invitePolicy, joinQuestions, agreements, settings{askJoinQuestions,…}, prerequisiteGroupIds, groupToGroupJoinQuestions })`, `inviteGroupToJoinParent`, `requestToAddGroupToParent`, `invitePeerRelationship`, `acceptGroupRelationshipInvite`, `rejectGroupRelationshipInvite`, `cancelGroupRelationshipInvite`, `deleteGroupRelationship`, `updatePeerRelationship`, `deletePeerRelationship`, `joinSpace(spaceId, accessCode, invitationToken)`, API‑key only `addMember(userId, groupId, assignAdministrator)`.

Subscriptions / socket events: `groupMembershipUpdate` (joined/rejoined/left), `groupRelationshipUpdate`, socket `openJoinRequestCountUpdated`.

### 7.1 "My Invites" data (UI in 05)

`me.groupInvitesPending` — invitations whose `email` equals the user's email (exact string match), not used, not expired, newest first. Each: `id, email, createdAt, lastSentAt, token, creator, group`. Accepting uses the token (`useInvitation` or navigate to `/h/use-invitation?token=`); declining = `expireInvitation(id)` (allowed because the email matches). `me.joinRequests(status: 0)` lists the user's pending requests (cancel via `cancelJoinRequest`).

---

## 8. Edge cases & known quirks

- **Moderators vs stewards ids:** `Group.moderators()` filters responsibility **id 3** and `stewards()` ids **[1,3,4]**. With the seed order (1 Administration, 2 Add Members, 3 Remove Members, 4 Manage Content) "moderators" = holders of *Remove Members* (Administrator, Moderator roles), although the code comments say Manage Content. These receive `memberJoinedGroup` and group‑to‑group invite notifications; Hosts (Add Members only) do not.
- `inviteGroupToGroup` checks for an existing pending invite without `await`, so duplicate pending group‑to‑group invites can be created.
- `createJoinRequest` ignores `invitationToken`; it doesn't check accessibility or existing membership.
- Declining a join request sends no notification; the requester sees nothing until they look again (the About page then offers "Request Membership" again since only pending requests block it).
- Inviting an email creates a new invitation each time; no duplicate/member check. Every valid address counts against the allowance.
- `markInvitationsUsed` marks every invitation for that email in the group as used when the user joins by any route.
- `me.groupInvitesPending` matches email exactly (case‑sensitive) while invitations are stored lower‑case — mixed‑case account emails see no pending invites.
- Joining via `useInvitation(accessCode)` bypasses prerequisites and doesn't set `showJoinForm` defaults beyond `addMembers` (still shows welcome modal since new rows default `showJoinForm: true`).
- `joinGroup` does not re‑check visibility; any logged‑in user who knows an Open group's id can join it even if Hidden.
- The welcome modal re‑appears for an existing member only when agreements changed; it cannot be dismissed without accepting (or declining = leaving).
- After a pre‑approved join from the About page, the modal still shows (purpose + "Jump in!") because `showJoinForm` stays true by design.
- Expire/Resend buttons in Pending Invites have no confirmation; "Sent" state is local.
- The About page "Leave" button is only shown when viewing the group's own About (`/groups/:slug/about`), not in the detail side panel.
- Re‑joining resets agreements acceptance and join‑question timestamp, so the full welcome flow repeats.
- Invite link codes are case‑insensitive on lookup.
- `regenerateAccessCode` (mentioned in internal docs) is gone.

## 9. Docs vs. code

- *docs/INVITATION_LINKS_ARCHITECTURE.md* §1–2 describe auto‑join on clicking a link and `regenerateAccessCode`, `isModerator`, `role` column. **Code:** links redirect to the About page (no auto‑join, except space invites for existing parent members), roles come from `group_role_id`/`granted_roles`, no regenerate mutation.
- Public steward guide describes invite links as "reset‑able join links"; current UI instead has multiple named links per group with create/edit/delete, view‑only links for Restricted non‑public groups, and no links section for Open+Public groups.
- Public docs describe visibility "Protected – visible to members of parent groups"; code reveals Protected groups to members of parent, child **and peer** groups.
- Public docs say Moderators/Coordinators approve requests; code: any holder of `Add Members` (Administrator, Host, custom roles, or everyone under the `everyone` invite policy).
- **Member invitations with "limited access"** (feature flag `MEMBER_INVITES`, `FEATURE_FLAG_MEMBER_INVITES`, on by default only in development/test/staging): backend flag constant, `/h/invitation` route, `Frontend.Route.invitation`, `createJoinRequest(invitationToken)` arg, the InvitePolicySelect copy "A steward approves each person before they join." and schema comments ("A member's invitation only pre‑approves joining an Open group") are present, but no resolver consults the flag and `inviteAccessFor` only returns `'full'`. Treat as not yet shipped: members with the everyone policy get full Add Members.

## 10. Source references

- `apps/backend/api/models/{Group,GroupMembership,JoinRequest,Invitation,InvitationSend,GroupInviteLink,GroupRole,GroupRelationship,GroupRelationshipInvite,User,Notification,PushNotification}.js`
- `apps/backend/api/services/{InvitationService,GroupService,Frontend,Email}.js`
- `apps/backend/api/graphql/mutations/{group,invitation,join_request,membership,spaces,index}.js`, `graphql/{makeSchema,makeModels,filters}.js`, `graphql/schema.graphql`
- `apps/backend/lib/featureFlags.js`, `apps/backend/lib/i18n/en.js`
- `apps/web/src/routes/{JoinGroup,GroupDetail(+JoinSection),GroupWelcomeModal,GroupWelcomePage,SpaceJoinPage}/*`, `routes/GroupSettings/InviteSettingsTab/*`, `components/{InviteMembersDialog,InvitePolicySelect}`, `util/{shouldLandOnWelcome,inviteAccess}.js`, `routes/AuthLayoutRouter/AuthLayoutRouter.js`, `routes/RootRouter/RootRouter.js`
- `packages/presenters/src/GroupPresenter.js` (`getShouldWelcome`)
- `docs/INVITATION_LINKS_ARCHITECTURE.md`
- E2E: `apps/web/e2e/{authenticated.create-group-join,authenticated.invitation-links-about,unauthenticated.invitation-links-about,authenticated.invite-policy,authenticated.group-welcome-modal,authenticated.welcome-management}.spec.js`
