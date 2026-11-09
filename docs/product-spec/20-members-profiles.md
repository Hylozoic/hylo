# 20 — Members & profiles

> Member directory, member profile pages, profile hover card / profile card dialog, skills (has / learning / group-suggested), affiliations, user connections, role badges as shown on people, blank-name handling, and how removed / deactivated / deleted users render.
>
> Related modules: profile **editing** form → [05-user-settings.md](05-user-settings.md); roles, responsibilities, blocking and flagging → [12-roles-permissions-moderation.md](12-roles-permissions-moderation.md); invites (the "Invite" button) → [10-joining-invitations.md](10-joining-invitations.md); direct messages → [18-direct-messages.md](18-direct-messages.md); track-space / funding-round-space specific member pills → [21-tracks.md](21-tracks.md), [22-funding-rounds.md](22-funding-rounds.md); spaces → [15-views-streams-spaces.md](15-views-streams-spaces.md); post/comment cards used in profile tabs → [13-posts-comments.md](13-posts-comments.md); global search (skill click target) → [07-search.md](07-search.md).

---

## 1. Overview

- Every group (and every **space**, which is a child group — see module 15) has a **Member Directory**: a searchable, sortable, filterable list of its active members, shown as a card grid or a compact list, with an optional force-directed **Skill map**.
- Every person has a **profile page** reachable globally (`/members/:id`) or in a group context (`/groups/:slug/members/:id`). It shows banner, avatar, name, location, contact/social action buttons, tagline, bio, roles in the current group, skills, skills being learned, Hylo groups, other affiliations, upcoming events, projects, and an activity feed (Overview / Posts / Comments / Reactions).
- Anywhere a person's avatar appears (feeds, comments, chat, active-member strips) hovering (desktop) or long-pressing (touch) opens a **Profile hover card**. In direct-message screens, clicking an avatar opens the **Profile card dialog** (modal version).
- Profiles may be opted into **public** (`isProfilePublic`), making a reduced profile visible to logged-out visitors at the same URLs.

Users: all logged-in members (browse, message); stewards with the *Remove Members* responsibility (remove from group); stewards with *Administration* / *Add Members* (see join-question answers; invite); track / funding-round stewards (completion & capability pills).

---

## 2. Concepts & data

### 2.1 User (`users` table, GraphQL `Person` / `Me`)

Fields relevant to profiles (DB column → GraphQL field):

| Column | GraphQL | Type | Notes |
|---|---|---|---|
| `id` | `id` | bigint / ID | |
| `name` | `name` | text | Required for active users; validated "not only whitespace" (`Validators.validateUser.name` → error `"Name must not be blank."` style: `Name ${reasons}.`). Trimmed on save. GraphQL getter returns `''` instead of `null`. |
| `avatar_url` | `avatarUrl` | text | |
| `banner_url` | `bannerUrl` | text | Default banner when null: `/default-user-banner.svg` (profile page, profile card). |
| `bio` | `bio` | text (Markdown) | Rendered with `TextHelpers.markdown` on the profile page. Labelled "About Me" in the editor (module 05). |
| `tagline` | `tagline` | text | Short one-liner. |
| `location` | `location` | text | Free text (as typed / geocoded full text). |
| `location_id` | `locationObject` | FK → `locations` | Geocoded location (center, bbox, city, country, …). |
| `contact_email` | `contactEmail` | text | Shown only to logged-in viewers. |
| `contact_phone` | `contactPhone` | text | Shown only to logged-in viewers. |
| `twitter_name` | `twitterName` | text | Leading `@` stripped; whitespace-only → null. Link built as `https://twitter.com/<name>`. |
| `facebook_url` | `facebookUrl` | text | `https://` prepended if no protocol. |
| `linkedin_url` | `linkedinUrl` | text | `https://` prepended if no protocol. |
| `url` | `url` | text | Personal website; `https://` prepended if no protocol. |
| `is_profile_public` | `isProfilePublic` | bool | Opt-in public profile (set in 05). |
| `last_active_at` | `lastActiveAt` | timestamp | Drives the green "currently active" dot. |
| `active` | — | bool | `false` = deactivated or deleted user. |
| `settings` | — | jsonb | Not profile-visible. |

Computed `Person` fields:

| Field | Rule |
|---|---|
| `canMessage` | `User.canMessage(viewer, target)`: false when not logged in, target is the viewer, target inactive, blocked either way; true if target is an **active member of a group the viewer is an active member of** (group active) **or** target is in the viewer's `user_connections`. |
| `messageThreadId` | ID of the existing DM thread between viewer and person, else null (null for anonymous). |
| `membershipsTotal`, `moderatedGroupMembershipsTotal` | Counts. `moderatedGroupMemberships` = memberships where the user holds the system role named `Administrator` or `Coordinator`. |
| `enrolledAt` | Only when loaded through a track/space membership pivot: membership `created_at`. Also exposed on group `members` results (join date). |
| `completedAt` | Only through track membership pivot: `group_memberships.settings.completedAt`. |
| `hasRegistered` | Has a linked account. |

Relations exposed on `Person`: `affiliations` (active only), `comments` (excludes DM thread comments; excludes comments on posts by people the subject has blocked; ordered by `created_at`, `order` arg default desc), `eventsAttending` (events with `end_time > now` where the person RSVP'd `yes`), `memberships` (active memberships in active groups, **excluding spaces**), `groupRoles(groupId|slug)` (effective roles incl. implicit All-Members role; see 12), `groupJoinQuestionAnswers(groupId|slug)`, `posts` (excludes DM threads; standard post filters; see 13), `projects` (project posts where the person has a `project_role_id` in `posts_users` and is active), `reactions` (ordered by `date_reacted`), `skills`, `skillsToLearn`.

### 2.2 Skills

- Table `skills (id, name)`; `name` unique (case-sensitive DB uniqueness; lookups by name are case-insensitive: `lower(name) = lower(?)`).
- Join table `skills_users (skill_id, user_id, type)` where `type` = `0` (`Skill.Type.HAS`, "Skills & Interests") or `1` (`Skill.Type.LEARNING`, "What I'm Learning").
- Join table `groups_suggested_skills (group_id, skill_id)` — a group's "Relevant skills & interests".
- Group setting `settings.showSuggestedSkills` (bool) — "Ask new members whether they have these skills and interests?".
- Validation on create (any add mutation): trimmed; blank → `Skill cannot be blank`; length > 39 → `Skill must be less than 40 characters`. Client input has `maxLength=30`.
- Creating an existing name reuses the existing skill (duplicate-key caught, then `Skill.find(name)`). Re-adding a skill a user already has is a silent no-op.

### 2.3 Affiliations (`user_affiliations`)

| Column | GraphQL | Notes |
|---|---|---|
| `id` | `id` | |
| `user_id` | `user` | |
| `role` | `role` | e.g. "Steward" |
| `preposition` | `preposition` | connector word ("of", "at", "for"…) |
| `org_name` | `orgName` | |
| `url` | `url` | optional; `https://` prepended if missing; must pass `validator.isURL` else `Please enter a valid URL.` |
| `is_active` | `isActive` | soft delete flag (default true) |
| `created_at` / `updated_at` | | |

Rendered as a single line: **role** · preposition · **orgName** (orgName is a link opening in a new tab when `url` set). Creation/deletion UI lives in module 05 ("Groups & affiliations" tab).

### 2.4 User connections (`user_connections`)

`(id, user_id, other_user_id, type, created_at, updated_at)`. Only `type = 'message'` exists: created/updated (`createOrUpdate`) when a user messages another. Used for (a) person visibility (`personFilter`) — you can see people you're connected to even with no shared group; (b) `canMessage`; (c) `Me.connections` query for DM recipient suggestions (module 18). `user_id === other_user_id` is rejected.

### 2.5 Roles shown on people

A person's roles in the context group are their effective `groupRoles` filtered to `groupId == (group.parentId || group.id)` (spaces inherit their parent's roles) and excluding the implicit "All Members" role. Each role has `name`, `emoji`, `active`, `responsibilities`. The role model itself is in module 12.

### 2.6 Recently-active window

`RECENTLY_ACTIVE_MS = 15 minutes`. A person is "currently active" iff `now − lastActiveAt < 15 min`. Shown as a green dot (`bg-green-500` with a ring in the card background colour) on avatars in the directory and in "currently active" strips.

---

## 3. Routes / entry points

| URL | Renders | Notes |
|---|---|---|
| `/groups/:slug/members` | Members directory (`context='groups'`) | Query params: `q` (search), `s` (sort: `name`\|`location`\|`join`\|`last_active_at`; default `name`; unknown → `name`), `r` (group role id filter), `tc` (`completed`\|`not` — track spaces), `fr` (`submit`\|`notSubmit`\|`vote`\|`notVote` — funding round spaces), `highlightMember` (person id). |
| `/groups/:slug/members/create` | Same Members directory | Legacy URL kept; no separate "create member" screen exists. E2E asserts it renders `#members-page`. |
| `/groups/:slug/spaces/:spaceSlug/members` | Members directory for the space | Space roles come from the parent group. |
| `/groups/:slug/about/members` (and space equivalent) | "Members" tab of the About page | Uses the same directory; header title `Members` instead of `Member Directory`. |
| `/members/:personId` | Profile, global context | Logged out: `PublicMemberProfile` (see §4.6). |
| `/all/members/:personId` | Profile, global context | |
| `/groups/:slug/members/:personId` | Profile in group context (roles shown for that group; remove-member available) | |
| `/groups/:slug/spaces/:spaceSlug/members/:personId` | Profile in space context | |
| `/members/:personId/post/:postId` etc. | Profile with post dialog overlay | Nested `post/:postId` route renders `PostDialog` over the profile. |
| `/public/members`, `/all/members` | Redirect → `/public`, `/all` | There is no directory for aggregate contexts. |
| `/my/edit-profile` (module 05) | Profile editor | "Edit Profile" entry points link here via `currentUserSettingsUrl()`. |

Entry points: group menu "Members" view (icon `Users`), currently-active strip (click face → directory with `?highlightMember=<id>`; click count pill → directory), any avatar/name link → profile, hover card "View Profile", skill-map person nodes, search results.

`personUrl(id, groupSlug)` = `/groups/<slug>/members/<id>` when a slug is given, else `/members/<id>`. `messagePersonUrl(person)` opens the existing thread (`/messages/<messageThreadId>`) or a new-message composer addressed to the person (module 18).

---

## 4. UX specification

### 4.1 Members directory (`#members-page`)

**Page frame:** centered column `max-width: 940px`, bottom padding 7rem. Browser title: `<Member Directory|Members> | <Group name> | Hylo`.

**View header** (shared header bar, module 06): title `Member Directory` (or `Members` on `/about/members`), icon `Users`, search enabled; header action **Invite** (rounded-full pill button, label `Invite`) shown when `inviteAccessFor(group, hasAddMembers)` is truthy — opens `InviteMembersDialog` (module 10). For a space, the dialog also receives the parent group.

**Loading:** while group not yet loaded → route skeleton (`MembersBootstrapSkeleton`). While members are loading → 7 skeleton rows (44px pulsing circle + two bars at 38% / 62% width).

**Controls row** (flex-wrap, gap 8px), top to bottom of the controls block (vertical gap 8px, padding 16px top/bottom):

1. *(when open)* **Skill map** panel (§4.3), above everything.
2. Row: 
   - **Search**: text input with a leading search icon, placeholder **"Search name, skill, location, keyword"**, 2px border `foreground/20`, radius 8px, flex-1, min-width 220px (≥sm). Typing updates local state immediately and the `q` URL param after a **300 ms debounce**. On phones (`< sm`) the input is hidden behind a 40×40 square **search icon button** (`aria-label "Search"`); tapping it reveals a full-width input and focuses it; blurring an empty input collapses it again.
   - **Sort dropdown** (aligned right): toggle text `Sort by <strong>{label}</strong>` + down arrow. Items (labels): `Name`, `Distance` (key `location`), `Join Date` (key `join`), `Last Active` (key `last_active_at`). Selecting sets `s` (removed from URL when `name`).
   - **Layout toggle**: segmented two-button group (`aria-label "Layout"`): grid icon (`Cards`) and list icon (`List`). Active button has `bg-selected`. Default: `list` on phone devices, `card` otherwise (component prop `defaultDisplayMode` can override). Not persisted.
   - **Skill map toggle** (`data-testid=skill-map-toggle`, `aria-pressed`): waypoints icon + label `Skill map` (label hidden on phones). Starts **off**; the graph data is fetched only when first opened.
3. **Filter pill row** (shown if there is ≥1 filterable role, or the track/funding-round pills apply). Pills are rounded-full, 2px border, text-xs medium, with an optional count bubble (min 18px wide, 10px bold tabular numbers). Active pill: `bg-selected border-selected`. Order:
   1. `All members` (count = `group.memberCount`); active when no `r`/`tc`/`fr`; clicking clears all three.
   2. Track spaces, visible to those allowed (see §6): `Completed Track` (count `track.numPeopleCompleted`), `Not Completed Track` (count `memberCount − numPeopleCompleted`, min 0). Click toggles `tc=completed` / `tc=not`.
   3. Funding-round spaces: `Can Submit`, `Cannot Submit`, `Can Vote`, `Cannot Vote` with counts fetched via an aliased query (`members(first:1, fundingRoundCapability: …) { total }`). Click toggles `fr`.
   4. One pill per **role**: label `<emoji> <name>`; count = role's `membersTotal`. Roles shown: from the group (or for a space, the **parent** group), `active !== false`, `membersTotal !== 0` (undefined counts still shown), ordered system roles first (`sortSystemGroupRoles`) then custom roles (`sortCustomGroupRoles`). In a **space**, counts are re-fetched per role scoped to the space (aliased `r<id>: members(first:1, groupRoleIds:["<id>"]) { total }`) and roles with 0 space members are hidden. Clicking toggles `r=<roleId>` (single role at a time).
   5. A trailing `More ({{count}})` pill: the row is **clamped to one line**; overflowing pills are hidden and `More (n)` reveals all (no collapse back). If everything fits on one row the More pill is hidden.
4. **"Show answers to join questions"** switch (only for viewers with *Administration* or *Add Members* responsibility): green `#0DC39F` when on, grey `#8B96A4` when off. When on, each member card shows their join-question answers.

**Results area:**

- *Card layout*: masonry grid, `grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))`, gap 12px.
- *List layout*: one rounded (12px) `bg-card` panel, rows separated by 1px `foreground/10` borders.
- Empty result: centered `No results for this search` (text-sm, 60% foreground), 48px vertical padding.
- Footer when unfiltered and unsearched: `Showing {{count}} of {{total}} members` (count = min(loaded, memberCount)).
- **Infinite scroll**: page size **20**; next page requested when the center column scrolls to bottom (`offset = loaded count`), stops when `hasMore` false.
- Changing slug/sort/search/filters scrolls the center column to top and refetches from offset 0.
- **Highlight**: `?highlightMember=<id>` → the API also returns that person (query `person(id)`), prepended to the first page if not already present; that card is highlighted (card: 2px `selected` ring + `bg-selected/5`; row: `bg-selected/10` + 2px left border `selected`).

#### 4.1.1 Member card (card layout)

Whole card clickable → profile in group context. `rounded-xl`, `bg-card`, 1px border `foreground/20` (hover `foreground/60`, lifts 1px). `data-testid=member-card`.

- **Header** (padding 12px): background = member's banner (cover) or, if none, a gradient `linear-gradient(135deg, hsl(H 42% 30%), hsl((H+45)%360 38% 22%))` where `H` = stable hash of the name (`hash = (hash*31 + charCode) % 360` over characters). A dark overlay `linear-gradient(180deg, rgba(0,0,0,.42), rgba(0,0,0,.66))` sits over it. Contents in a row:
  - 48px round avatar (shadow; 2px `selected` ring if it's you) with a 14px green active dot at bottom-right when recently active.
  - Name: white, bold, 16px, truncated; if it's you, appended ` · You` (white/70, xs).
  - Location line (map-pin icon + text, xs, white/70, truncated) if set.
  - Right: **Message** icon button (32×32, rounded-lg, translucent black, message-circle icon, `aria-label/title "Message Member"`) — hidden for yourself or when logged out; navigates to `messagePersonUrl`. Then the **⋮ menu** (only with *Remove Members* responsibility in the role group): single item `Remove member from group` (trash icon, red).
- **Body** (only rendered if any of: roles, tagline, skills, track block, funding block, join answers; padding 16px/12px top):
  - Role chips: all roles, each `BadgeEmoji` expanded with name (see §4.5). Roles without emoji render nothing.
  - Tagline: text-sm, 70% foreground, relaxed leading.
  - Skills: pills (`px-2.5 py-0.5 rounded-full text-xs bg-foreground/5 border foreground/15`), clamped to **3 rows**; trailing pill `({{count}} more...)` expands all.
  - Track block (track spaces, privileged viewers): `✓ Completed {{date}}` (selected colour, date short style) or `Not yet completed` (50% foreground).
  - Funding block (funding-round spaces): tags `Can Submit`, `Can Vote` (bg `selected/20`) or `Viewer` (bg `foreground/10`) when neither. Computed client-side: a member "can submit" if the round's `submitterRoles` list is empty or the member holds any listed role (likewise voters).
  - Join answers block: heading `Join Question Responses` (top border), each question text (xs medium 70%) then the answer (sm, 2px left border, padding-left 8px).
- **Footer**: if `enrolledAt` (membership created_at) known: top border then right-aligned `Joined {{date}}`, date in "month year" style (e.g. "Mar 2023").

#### 4.1.2 Member row (list layout)

Row padding 12px/10px, hover `foreground/5`, clickable → profile. Contents: 32px avatar with 10px active dot; name (sm bold, truncated) + ` · You` (selected colour) when self; beneath it, role chips (clamped to **1 row** with a `({{count}} more...)` text button) or, if the member has no emoji roles, the location line; right side: `Joined`-style month-year date (hidden on phones), Message button, ⋮ remove menu. Track/funding/join-answer blocks render below the row (padding 12px).

#### 4.1.3 "Square" member tile

A third variant (`square` prop) is used in one-column group home card grids (`ContextMenuGrid` style): card filled with banner-or-avatar photo under a dark gradient, centered 56px rounded-square (15px radius) avatar with active dot, name, role badges, location, and `Join Date: <short date>`. Remove ⋮ menu top-right. Clicking opens the profile.

#### 4.1.4 Remove member flow

⋮ → `Remove member from group` → confirmation dialog (max-width md): title `Remove member`; body "`You are about to permanently remove` [24px avatar] **Name** `from the group. Are you sure?`"; buttons `Remove` (destructive red) and `Cancel` (outlined). Confirm → `removeMember(personId, groupId)` mutation; optimistic: the member is removed from the list and `memberCount` decremented immediately.

### 4.2 Recently-active members strip (`CurrentlyActiveMembers`)

Used in group menus, chat headers and one-column cards (module 06 / 17). Fetches the N+1 most recently active members (`members(first: N+1, sortBy:"last_active_at", order:"desc")`); default N = 5 (chat / members preview), 8 for the sidebar menu. Renders up to N overlapping 30px faces (2px background-coloured border, `-8px` overlap, newest at left with highest z-index; hover scales 110%), each with a green dot if recently active (or present in chat presence / typing dots instead in chat). Then a count pill (users icon + `group.memberCount`, plus a 7px green dot if the (N+1)th person is also online, i.e. "more online than shown"), aria-label `Members`. On hover-capable devices an **Invite** icon slides in at the end on row hover (always visible on touch). Clicking a face → directory with `?highlightMember=<id>`; clicking the count or row → directory. Hovering a face opens the profile hover card instead of a name tooltip.

### 4.3 Skill map (`MemberSkillsGraph`, `data-testid=member-skills-graph`)

Purpose: a bipartite force-directed constellation of members and the skills they share. Independent of directory filters — always the whole membership (fetched once, up to **2000** members sorted by name with `id, name, avatarUrl, lastActiveAt, skills{id,name}`).

- Hidden entirely (returns nothing) if not loading and no member has any skill.
- **Header** (card, rounded top, bottom border): title `Skill map`; subtitle `{{memberCount}} members with {{skillCount}} skills` (counts of **nodes currently drawn**, not totals). Right: label `Skills with` + **threshold dropdown** (`data-testid=skills-threshold-button`, title `Minimum people per skill`, users icon). Options 1…8: `1 person`, `2+ people` … `8+ people` (phones show `1`, `2+`…), each item showing a count bubble = number of skills that meet that threshold.
- **Default threshold** ("smart"): the smallest threshold whose total link count (sum of holders over qualifying skills) ≤ **350**; if none, 8.
- Skills are grouped **case-insensitively** by trimmed name (display name = first seen spelling). A member counts once per skill key.
- Graph: skill nodes `s-<key>` (circle radius `7 + 3·√count`, fill = theme `--selected` at 25% opacity, 1.5px stroke same colour, 11px semibold label below) and person nodes `p-<id>` (radius constant `PERSON_RADIUS`, circular avatar sprite or muted grey circle, 1px foreground stroke at 40%, 9px name label below when ≤ 80 people are drawn and zoom ≥ 0.6). Only people linked to at least one drawn skill appear. Links: straight 1.5px lines, foreground at 15% opacity.
- Physics (d3-force): link distance 60 / strength 0.4; charge −220 (skill) / −120 (person); collide radius skill r+22, person r+12; x/y centering forces 0.06 / 0.09. World is `max(1, √(nodes/60))` × container size; nodes clamped inside. > 150 nodes: layout settles synchronously and avatars load lazily (only for spotlighted neighbours); otherwise most of the settle is pre-ticked and the last part animates.
- **Interaction**: hover a node → "spotlight": that node and its neighbours stay full opacity, everything else fades to 12%; its links go to 50% opacity, others to 4% (animated fade). Cursor pointer over nodes, grab otherwise. Drag pans; ctrl/cmd-wheel or pinch zooms (scale extent `[min(0.9, 0.9/world), 4]`); plain wheel scrolls the page unless enlarged. **Click a skill node** → fills the directory search box with the skill name and sets `q` (directory filters to people with that skill). **Click a person node** → their profile (group context).
- Controls: top-left **Enlarge map** button (maximize icon; becomes `Close` with minimize icon) → panel goes fixed full-screen (`z-index 100`, padding 12px); `Esc` closes. Bottom-right zoom `+` / `−` buttons (`Zoom in` / `Zoom out`, factor 1.4, 200 ms transition).
- Height: phones 300px; ≥ sm: < 12 nodes 300px, < 30 → 380px, < 60 → 460px, else (or while loading) 560px. Background `bg-card` with `/network-map-bg.png` cover image, rounded bottom, large shadow.
- Loading overlay: spinner + `Loading skills map`.

### 4.4 Member profile page

Header bar: title `Member Profile: <name>` (`Member Profile: Loading...` while loading), icon `Person`, search shown unless it's your own profile, back button on desktop and mobile. Back goes to the history entry the profile was opened from; on direct load it goes to the group home (group context) or the default landing.

Browser title `<name> | Hylo`; meta description `<name>: Member Profile`.

States: non-integer `personId` → inline error text `That doesn't seem to be a valid person ID.`; while fetching → spinner; person not returned (not visible to viewer) or no name → `NotFound` component.

Layout (single centered column; content max-width 720px; horizontal padding 8px on phones):

1. **Edit Profile** floating button (own profile, not public view): absolutely positioned top-right (top 8px, right 20px), 120px wide, `Edit` icon + `Edit Profile` → `/my/edit-profile`.
2. **Hero** (height 40vh, margin-top 16px): a rounded-xl box (width 96%, max 750px, centered, `bg-darkening/80`, 2xl shadow) holding the banner image (default `/default-user-banner.svg`) at 70% opacity, covered by a top-to-bottom transparent→black/90 gradient at 60%. Bottom-aligned (padding-bottom 40px) over it: the **xxlarge round avatar** (2xl shadow), the **name** (`h1`, white, 24px bold, centered, max-width 28rem), and location (location icon + text, white, sm) with `", United States"` stripped.
3. **Action buttons row** (pulled up 20px over the hero, margin-bottom 40px, centered, gap 8px): square bordered icon buttons (2px `foreground/20` border, radius 6px, padding 8px, large shadow, hover scale 105%), each shown only when the value exists:
   - `Messages` icon → **Message Member** (own profile → messages list). No copy button in its tooltip.
   - `Phone` → `tel:` link (hidden in public view).
   - `Email` → `mailto:` (hidden in public view).
   - `Facebook`, `LinkedIn`, `Twitter` (`https://twitter.com/<name>`), `Public` (website) → open externally.
   - Each has a bottom tooltip (500 ms show / hide delay, clickable) showing the value text (clickable) and a `Copy` button that changes to `Copied!`.
   - **⋮ (More) dropdown** (right-aligned) with items: `Edit Profile` (pencil; own profile only), `Block this Member` (X icon; hidden for self and for the Axolotl system user id `13986`), `Remove member from group` (red trash; requires a group context and *Remove Members* responsibility; hidden for self/Axolotl). Hidden if no items.
   - In public view the Message button and ⋮ are rendered as invisible placeholders (to keep layout).
   - Block → native `confirm(blockConfirmMessage)`: "Are you sure you want to block this member? \n You will no longer see this member's activity \n and they won't see yours. \n\n You can unblock this member at any time. Go to Settings > Blocked Users." → `blockUser` → navigate back to the previous location.
   - Remove → same confirm dialog as §4.1.4 (name in bold, no avatar) → `removeMember` → navigate back.
4. **Tagline + bio** block (if either): tagline centered 18px bold (max 28rem); bio centered (max 720px) Markdown → HTML, clamped to **6 lines** with `Read more` / `Read less` toggle (semibold, focus colour) shown only when the text actually overflows (re-measured on resize). Links inside are handled by the in-app click catcher.
5. **Section boxes**: each section is a dashed 2px border box (top border 30% foreground, sides 20%, bottom 10%), radius 8px, padding 16px, with its uppercase title (sm, 50% foreground, on a `bg-midground` chip) centered and overlapping the top border. Sections in order:
   - **`Roles in {{group}}`** — only in a group context when the person has roles there: each role as a `bg-background` rounded tile with the emoji badge and the role name (50% foreground).
   - **`Skills & Interests`** — read-only pill list (`SkillsSection editable=false`). Clicking a pill navigates to `/search?t=<skill>&from=<current path>` (module 07). Own profile with no skills: prompt `Add your skills and interests to your profile` + `Edit Profile` button.
   - **`What I'm Learning`** — read-only pills of `skillsToLearn` (only if any).
   - **`Hylo Groups`** — memberships (excluding spaces) sorted by group name (locale compare). Each is a tile: small group avatar (default group avatar if none), group name (links to group), and the person's role emoji badges in that group. Container max height 200px; if it overflows, a centered button `Show All {{n}} Groups` / `Show Less` (hard-coded English, not translated) over a fade gradient. Empty (not public view): prompt `Find groups to join and collaborate with others` + `Explore Groups` button → `/groups/explorer`.
   - **`Other Affiliations`** — affiliation chips (40px tall rounded rows: **role** preposition **org**). Own profile with none: `Add your affiliations` + `Edit Profile`.
   - **`Upcoming Events`** — events the person RSVP'd yes to that haven't ended: rows with a red date tile (`rgba(254,72,80,.5)`, month abbreviation above 28px day), title (bold), location (truncated), and up to 3 attendee avatars (`RoundImageRow`, "+N" style when more). Max height 220px with `Show more` / `Show Less`. Click → post detail.
   - **`Projects`** — project posts the person is a member of: title, `<creator name> - <relative time>`, up to 3 member avatars. Max height 220px with `Show more` / `Show Less`.
6. **Activity feed**: header row with the current tab title and a dropdown button showing the current tab id + arrow. Tabs (dropdown items):
   - `Overview` — title `{{name}}'s recent activity`: posts and comments interleaved by `createdAt` desc (post cards & comment cards).
   - `Posts` — `{{name}}'s posts`.
   - `Comments` — `{{name}}'s comments` (comment cards linking to their post).
   - `Reactions` — `{{name}}'s reactions`: post cards of posts they reacted to, ordered by reaction date desc.
   - Each list pages **20** at a time via a scroll sentinel; shows spinner while loading more; when finished and non-empty shows `No more activity to load.`. Public view shows only Posts, with heading `{{name}}'s public posts` (only when there are posts) and no dropdown.
   - Action-type posts (track actions) are excluded from profiles (see module 21).

### 4.5 Role badge chips (`BadgeEmoji`)

Expanded form: inline-flex rounded-full chip, `bg-foreground/10`, 1px border `foreground/15`, text-xs; emoji at text-sm with a drop-shadow halo (dark halo in light mode, white halo in dark mode); optional name label (`showName`). Hover: darker bg, scale 105%. Tooltip (bottom, 150 ms) shows role name and a bulleted list of its responsibilities. A role with no emoji renders nothing. Badges whose role holds responsibility id 1, 3 or 4 (Administration / Manage Content / Remove Members) are treated as "common" (styling hook). See module 12 for role creation (emoji is mandatory there).

### 4.6 Public (logged-out) profile

Logged-out visit to `/members/:id` or `/all/members/:id`: the app probes `person(id){ id isProfilePublic }`; if no person returned → redirect to `/login?returnToUrl=<path>`. Otherwise renders the public header and the profile inside a 750px rounded card with `context='public'`:

- Only the `Posts` tab (public posts only), headed `{{name}}'s public posts`.
- No phone/email buttons; Message and ⋮ placeholders invisible.
- Location/locationObject shown only because the profile is public; contact info never; `lastActiveAt`, `messageThreadId` null.
- Groups section shows public, non-space groups; the "explore groups" empty prompt is hidden.

### 4.7 Profile hover card (`ProfileHoverCard`, `data-testid=profile-hover-card`)

Attached to any avatar rendered with a `personId` (component `Avatar`) and to faces in active strips. Disabled for logged-out viewers.

- **Desktop**: opens after **500 ms** of mouse hover or keyboard focus; closes **200 ms** after the pointer leaves both trigger and card; Escape closes; clicking the avatar performs the avatar's normal action (e.g. navigate) and closes the card.
- **Touch**: long press **500 ms** (cancelled if the finger moves > 10px) opens it; the release tap is swallowed so the avatar link isn't followed and the OS callout is suppressed; a tap outside closes it and that tap's click is swallowed (700 ms window). On touch-only devices avatar links become `role=link` spans so long-press doesn't trigger link previews.
- Popover: below the avatar, aligned start, offset 6px, collision padding 16px, width 288px (max `100vw − 32px`), rounded-xl, 2xl shadow, 1px border, z-index above modals (1250). Fade+zoom-in.
- Data: `PersonHoverCard` query (`id name avatarUrl bannerUrl tagline location bio canMessage messageThreadId groupRoles{…}`) fetched only when the card opens. If the backend returns no person (not visible: blocked, no shared group…) the card closes and the trigger becomes inert for that mount.
- Content = **ProfileCard**: 112px banner (default banner; 70% opacity; gradient to black/60), large round avatar overlapping it by 40px, name (lg bold), tagline (sm, 70%), role chips for the current group context (only when the route has a group; spaces use parent; inactive custom roles hidden) as `emoji name` pills (`data-testid=profile-card-roles`), then buttons row: `Message` (only if `canMessage` and not self) and `View Profile` (→ `personUrl(id, currentGroupSlug)`). Buttons are equal-width, `bg-foreground/10`, rounded-md.

### 4.8 Profile card dialog (`ProfileCardDialog`)

Used in Messages (thread header participant avatars and message avatars). Click on the wrapped element → modal over the center column: overlay `bg-darkening/50` (dark mode `/90`) with backdrop blur; content max-width 384px, rounded-xl, centered, slide/fade animations. Close button (X in a translucent black circle) over the banner top-right. Content: same ProfileCard with `showDetails` — additionally shows **location** (pin icon) and **bio** (HTML stripped, 3-line clamp). Message button only when `canMessage` and not self (self → messages list). `View Profile` → `/members/:id` (global). Touch: pull down ≥ 100px (dampened ×0.45) to dismiss, with progressive fade/scale.

### 4.9 Suggested skills (join flows)

When a group has suggested skills, `SuggestedSkills` appears in the join section of the group detail page (after Join is clicked) and in the Group Welcome modal (when `settings.showSuggestedSkills` and the member hasn't already answered join questions): a muted box headed `{{group.name}} wants to know which skills and interests are relevant to you?` with the group's suggested skills as pills. Clicking a pill toggles it on the **user's own** skills (`addSkill(name)` / `removeSkill(id)`); selected pills are shown with the secondary colour background and white text. Group stewards manage the list in Group Settings → "Relevant skills & interests" (module 11) with the same pillbox editor (`Add a relevant skill or interest`, placeholder `What skills and interests are most relevant to your group?`) and the switch `Ask new members whether they have these skills and interests?`.

### 4.10 Skills pillbox (shared editor; used in 05 and 11)

- Existing skills as pills; editable mode adds a trailing outlined button (label `Add a Skill or Interest` / `Add a skill you want to learn`).
- Clicking it reveals a text input (max 30 chars, placeholder `What skills and interests do you have?` / `What skills do you want to learn?`) with a reset ✕. Typing (200 ms debounce) fetches suggestions `skills(first:10, autocomplete)`; suggestions exclude ones already held and appear in a keyboard-navigable dropdown. Enter adds the typed text (or chosen suggestion); Esc resets.
- Removing: hover a pill to reveal its ✕; first click turns the pill red ("removing" state), second click removes; moving the mouse away cancels.
- Clicking a pill's label searches (`/search?t=<skill>`), tooltip "Click to Search" (untranslated literal).

---

## 5. Business rules & side effects

### 5.1 Directory query (`Group.members`)

Arguments: `autocomplete, boundingBox, excludeGroupId, groupRoleId (deprecated), groupRoleIds, trackCompleted, fundingRoundCapability, first, offset, order, search, sortBy`. Rules:

- **Visibility guard**: anonymous callers always get an empty list. Logged-in non-admins get results only if the group's `settings.public_member_directory` is true **or** the viewer is an active member of that group. (Same guard on `stewards`, `moderators`, `memberships`.)
- `search` → full-text index over people: **name (weight A) + skills names (both "has" and "learning", hyphens → spaces) (C) + bio (C)**, prefix-matching (`prefixTsQuery`). Location and tagline are **not** indexed despite the placeholder.
- `autocomplete` → name prefix words (`to_tsvector('simple', name)`), ranked.
- `groupRoleIds` / `groupRoleId` → users holding any of the role ids (role ids are group-specific, so a parent role id works inside a space).
- `trackCompleted` → `group_memberships.settings.completedAt` not null / null.
- `fundingRoundCapability ∈ {submit, notSubmit, vote, notVote}` (else error `Cannot filter by fundingRoundCapability "<x>"`): based on the space's funding round `submitter_roles` / `voter_roles` JSON arrays; empty array = everyone; otherwise user holds one of those roles in the parent group (`coalesce(parent_id, id)`).
- `sortBy` ∈ `name|location|join|last_active_at` (else `Cannot sort by "<x>"`); `order` ∈ asc/desc (else `Cannot use sort order "<x>"`). Client default order: `desc` for `join` and `last_active_at`, `asc` otherwise.
  - `name`: users with null/empty/whitespace names always **last**, then `lower(trim(name))`.
  - `join`: `group_memberships.created_at`.
  - `location`, `last_active_at`: `ORDER BY <col> <order> NULLS LAST`. Note "Distance" sorts **alphabetically by location text**, not by geographic distance.
- `excludeGroupId` → exclude active members of another group (used when adding parent members to a space).

### 5.2 Person visibility (`personFilter`)

- Anonymous: only users with `is_profile_public = true`.
- Logged in: exclude anyone in a block relation with the viewer (either direction, `BlockedUser.blockedFor`); include only users who share a group with the viewer, are a `user_connection` of the viewer, are the Axolotl (id `13986`), or have a public profile.
- Admins and super API clients bypass.
- Anonymous viewers of public profiles: `contactEmail`, `contactPhone`, `lastActiveAt`, `messageThreadId` → null; `bio`, social links, url → only if public; skills/posts/memberships only for public profiles (posts further limited to public posts; memberships to public, non-space groups).

### 5.3 Mutations' side effects

| Mutation | Effect |
|---|---|
| `addSkill(name, type?)` | Create-or-find skill; attach `skills_users(type=0)`. Note: `type` arg is accepted by the schema but the resolver always adds as HAS. |
| `addSkillToLearn(name)` | attach with `type=1`. |
| `removeSkill(id or name)` / `removeSkillToLearn` | detach; error `Couldn't find skill with ID or name <x>` if not found. Returns `{ success: true }`. |
| `addSuggestedSkillToGroup(groupId, name)` | Requires *Administration*; else `You don't have permission to add skill to group`. `Invalid group` if not found. |
| `removeSuggestedSkillFromGroup(groupId, id|name)` | Requires *Administration*; else `You don't have permission to remove skill from group`. |
| `createAffiliation(data)` | Requires role, preposition, orgName (else `Invalid parameters to create affiliation`); URL validated. |
| `deleteAffiliation(id)` | Soft-delete (`is_active=false`, `updated_at`). Returns the id. |
| `blockUser(blockedUserId)` / `unblockUser` | See module 12. Unblock of a non-blocked user → `user is not blocked`. |
| `removeMember(personId, groupId)` | Requires *Remove Members* responsibility in the group (`getStewardedGroup`); `GroupService.removeMember` deactivates the membership (side effects in 10/12); publishes a real-time group-membership update (`action: 'left'`) to the group and the removed user. Returns the `Group` (`id`, `memberCount`). |
| `updateMe` (module 05) | Profile fields go through `User.validateAndSave`: whitelist `avatar_url, banner_url, bio, contact_email, contact_phone, extra_info, facebook_url, intention, is_profile_public, linkedin_url, location, location_id, name, password, settings, tagline, twitter_name, url, work, new_notification_count, calendar_token`; sanitising per §2.1; a Zapier "member updated" trigger is queued when any of `avatar_url, bio, contact_email, contact_phone, facebook_url, linkedin_url, location, location_id, name, tagline, twitter_name, url` changed. |

### 5.4 Last active

`lastActiveAt` is touched by the API on authenticated requests (`touchLastActiveAt`, throttled; module 01). It feeds the active dot, `last_active_at` sort, and the active strips.

### 5.5 Removed, deactivated and deleted users

- **Removed from a group**: membership `active=false` → disappears from that group's directory, counts, role pills; their posts remain. They can still be seen elsewhere if another shared group/connection exists.
- **Deactivated** (`users.active=false`, module 05): sessions cleared. `personFilter` does **not** filter on `users.active`, so a deactivated user with shared memberships is still visible by direct profile URL; their memberships (`group_memberships.active`) are not automatically deactivated by `deactivate()` so they may still appear in directories. `canMessage` is false (requires `users.active`). Quirk — documented as-is.
- **Deleted** (`sanelyDeleteUser`): name set to `Deleted User`, avatar/banner/bio/location/url/tagline/contact/social cleared, `active=false`, email randomised; all memberships, role assignments, skills, connections, reactions, join answers deleted; their posts renamed `Post by deleted user` with empty description and comments rewritten to `Comment by deleted user`. They therefore vanish from directories and from profile reach (no shared groups), while authored content renders under the name "Deleted User" with a default avatar.

### 5.6 Blank names

Legacy users may have null/blank names: GraphQL returns `''`; the directory sorts them last; the profile page shows `NotFound` when `person.name` is falsy (so a blank-named user's profile is unreachable in the UI); the editor refuses a blank name (`Name must not be blank`, Save disabled; module 05). Reactivation (`reactivate()`) also requires a valid name.

---

## 6. Permissions

| Action | Who |
|---|---|
| View a group's directory | Active members of the group; anyone logged in if `public_member_directory`; admins. Never anonymous. |
| View a profile | Viewer shares a group / connection with the person, or the profile is public, and no block either way. Anonymous: public profiles only. |
| See contact phone / email | Any logged-in viewer who can see the profile. |
| Message button | `canMessage` (hover card/dialog); directory and profile show Message to any logged-in non-self viewer (the thread composer then applies the stricter rule). |
| Remove member | *Remove Members* responsibility in the group (role group for spaces). Not offered for self or Axolotl. |
| Block member | Any logged-in user, not self, not Axolotl. |
| See join-question answers in directory | *Administration* or *Add Members* responsibility. |
| Invite button | `inviteAccessFor(group, hasAddMembers)` (module 10). |
| Track completion pills / completion lines | Track spaces: *Administration* in the role group, or holding a system role named `Moderator` or `Host` (by **name**, TODO in code says it should be responsibility-based). |
| Funding round capability pills | Shown to every member of a funding-round space. |
| Edit own skills / affiliations | Self only (via 05). |
| Manage group suggested skills | *Administration*. |

---

## 7. API

Queries:

- `group(slug){ memberCount groupRoles{items{id name emoji active groupId membersTotal responsibilities{…}}} members(first, offset, sortBy, order, search, groupRoleIds, trackCompleted, fundingRoundCapability){ hasMore total items{ id name avatarUrl bannerUrl location tagline lastActiveAt enrolledAt groupJoinQuestionAnswers(groupId){items{id question{id text} answer}} groupRoles(slug){…} skills{hasMore items{id name}} } } }` plus `person(id: $highlightMemberId){…same fields}` — `FetchGroupMembers`.
- `FetchGroupMembersForGraph` (first 2000, name asc), `FetchRecentlyActiveMembers` (sortBy `last_active_at` desc), `FetchRoleMemberCounts` (aliased totals), `FetchFundingRoundMemberCounts`.
- `person(id)` — `PersonQuery` (full profile: fields in §2.1 + `eventsAttending`, `messageThreadId`, `affiliations`, `groupRoles`, `memberships{id group{id name slug avatarUrl memberCount type parentId} person{id}}`, `projects`, `skills(first:100)`, `skillsToLearn(first:100)`).
- `person(id){ comments(first, offset, order) … posts(…) }` — RecentActivity (separate `postsOffset` / `commentsOffset`), `MemberPosts`, `MemberComments`, `MemberReactions{ reactions{ id userId createdAt post{…} } }`.
- `PersonHoverCard`, `CheckIsPersonPublic`.
- `skills(autocomplete, first, offset)` — **only skills held by members of the viewer's groups**, ordered `upper(name)`, prefix match `name ILIKE '<q>%'`.

Mutations: `addSkill`, `addSkillToLearn`, `removeSkill`, `removeSkillToLearn`, `addSuggestedSkillToGroup`, `removeSuggestedSkillFromGroup`, `createAffiliation`, `deleteAffiliation`, `blockUser`, `unblockUser`, `removeMember`, `updateMe` (05).

Types: `Person`, `PersonQuerySet {total hasMore items}`, `Skill {id name}`, `SkillQuerySet`, `Affiliation`, `AffiliationQuerySet`, `PersonConnection {id createdAt person type updatedAt}`.

Real-time: removal publishes a group membership update (module 01/12).

---

## 8. Edge cases & known quirks

1. **Profile tab switching breaks in non-English locales**: the dropdown stores the tab's *translated label* (`selectTab(label)`) but the active tab is looked up by *id* (`Overview`, `Posts`…). In e.g. German (`Übersicht`), choosing a tab yields no match and the page throws. The dropdown toggle also shows the raw id (English) rather than the translated label. Reproduce faithfully or fix deliberately.
2. `Show All {{n}} Groups` / `Show Less` in the groups box are hard-coded English.
3. Profile `SkillsSection` re-fetches the person's skills with `first: 20` after the profile query loaded 100 — profiles may end up showing only 20 skills.
4. "Distance" sort is alphabetical by location string.
5. Search placeholder promises location/keyword search; backend indexes only name, skills (incl. skills-to-learn) and bio.
6. `deleteAffiliation` ownership check is ineffective: `canDeleteAffiliation` is async and its Promise is always truthy, so any logged-in user can soft-delete any affiliation by id.
7. `addSkill(type: 1)` ignores `type`; use `addSkillToLearn`.
8. The `More (n)` role pill only expands; there is no collapse.
9. Message buttons in the directory/profile are shown even when `canMessage` would be false (hover card hides it).
10. Highlighted member is prepended even if they would not match current filters.
11. Directory card shows `Joined …` from `enrolledAt` (membership created_at) — present only when queried via group members.
12. Deactivated users remain visible (see §5.5).
13. Blank-named users sort last but their profile renders `NotFound`.
14. Skills graph caps at 2000 members.
15. Pill tooltip `Click to Search` is a literal (not translated).

## 9. Docs vs. code

| Docs say | Code does |
|---|---|
| Sort member directory "by name or location" | Name, Distance (= location text), Join Date, Last Active. |
| Search "by name or by skill/interest" | Name, skills (both kinds), bio. |
| Remove member: "three vertical dots in the upper right corner of their profile, then click Remove" | ⋮ on the directory card header (or profile ⋮) → `Remove member from group` → confirm dialog `Remove`. |
| Profile shows "whether they are a member or moderator" in groups | Shows the person's role emoji badges per group. |
| Recent activity includes "upvotes" | Tab is `Reactions` (emoji reactions). |
| "Click the envelope icon under their banner to message" | Messages icon button in the action row. |
| Delete a skill: "double click on the x" | Click ✕ once (pill turns red), click again to remove — matches. |
| No mention of skill map, list/card layout, role filter pills, hover cards, public profiles | Present in code. |

## 10. Source references

- `apps/web/src/routes/Members/{Members.js,Members.store.js}`
- `apps/web/src/components/Member/Member.js`, `components/MemberSkillsGraph/*`, `components/CurrentlyActiveMembers/*`, `hooks/usePillRowClamp.js`, `util/index.js` (`isRecentlyActive`)
- `apps/web/src/routes/MemberProfile/*` (incl. `RecentActivity`, `MemberPosts`, `MemberComments`, `MemberReactions`, `usePagedProfileList.js`, `profilePaging.js`)
- `apps/web/src/routes/PublicLayoutRouter/PublicMemberProfile.jsx`, `routes/RootRouter/RootRouter.js`, `routes/AuthLayoutRouter/AuthLayoutRouter.js`, `routes/SpaceContent/SpaceContent.js`, `routes/GroupAboutPage/GroupAboutPage.jsx`
- `apps/web/src/components/{ProfileCard,ProfileCardDialog,ProfileHoverCard,Avatar,BadgeEmoji,Membership,Affiliation,SkillsSection,SkillsToLearnSection,SuggestedSkills,Pillbox,Pill,SkillLabel,RoundImageRow}`
- `apps/web/src/graphql/queries/personHoverCardQuery.js`, `packages/graphql/queries/personQuery.js`, `apps/web/src/store/models/Person.js`, `store/selectors/getRolesForGroup.js`
- Backend: `apps/backend/api/models/{User,Skill,Affiliation,UserConnection}.js`, `api/graphql/makeModels.js` (Person, Group.members, guards), `api/graphql/filters.js` (`personFilter`), `api/services/Search/util.js` (`filterAndSortUsers`), `api/services/FullTextSearch.js`, `api/graphql/mutations/{index,affiliation,user,group}.js`, `api/graphql/schema.graphql`, `packages/shared/src/Validators.js`
- Tests: `apps/web/e2e/{authenticated.members-profiles,members-directory-verify,members-pill-clamp,member-skills-graph,profile-hover-card,blank-member-names,role-badge-emoji}.spec.js`
