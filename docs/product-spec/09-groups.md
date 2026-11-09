# 09 — Groups: creation & structure

## 1. Overview

A **group** is Hylo's community container: it has members, a configurable menu of views (stream, chat, map, members, typed post views, custom views…), posts, chat rooms, roles/responsibilities, agreements, privacy settings, and relationships to other groups. Groups can be nested (parent/child), connected peer‑to‑peer, and contain **spaces** (sub‑groups stored as `groups` rows with `type='space'` and `parent_id`; see 15).

This module covers: group types, the Create Group flow and everything created server‑side, the group About page (member view with tabs, and the non‑member/public "group detail" view), the Welcome page and welcome email, group cards, related groups and the network map, the Group Explorer, farm groups, and group deletion (briefly).

Out of scope here (cross‑links): privacy semantics, joining, invitations, welcome modal → [10-joining-invitations.md](10-joining-invitations.md); every settings tab → [11-group-settings.md](11-group-settings.md); roles → [12-roles-permissions-moderation.md](12-roles-permissions-moderation.md); views/menu/spaces → [15-views-streams-spaces.md](15-views-streams-spaces.md); map → [16-map.md](16-map.md); commons listing request review → 11/24; paywall → [23-paid-content-stripe.md](23-paid-content-stripe.md); members directory → [20-members-profiles.md](20-members-profiles.md).

---

## 2. Concepts & data

### 2.1 `groups` table (fields relevant to this module)

| Column | Type / values | Default on create | Notes |
|---|---|---|---|
| `id` | bigint | | |
| `name` | string | required | trimmed; server error **"Name cannot be blank"** on update; web max length 60 |
| `slug` | string | required | regex `^[0-9a-z-]{2,40}$`; unique; web calls it **"Handle"** |
| `type` | `null` (normal group), `'farm'`, `'space'` | `null` | `typeDescriptor` getter: `type_descriptor` or `startCase(type)` or `"Group"`; plural via `pluralize` or `"Groups"` |
| `parent_id` | bigint | null | only spaces |
| `purpose` | text | | trimmed; web max 500 chars |
| `description` | text (HTML from editor / legacy Markdown) | | trimmed on update |
| `about_video_uri` | string | | rendered as embed on About |
| `website_url` | string | | |
| `avatar_url` | string | `/default-group-avatar.svg` | web sends `DEFAULT_AVATAR` when none chosen |
| `banner_url` | string | `/default-group-banner.svg` | |
| `icon` | string | | Lucide/Hylo icon name for spaces without avatar |
| `location` | string | | free text; if given without `location_id` → background Mapbox geocode sets `location_id` |
| `location_id` | fk `locations` | | |
| `geo_shape` | PostGIS geometry (GeoJSON in/out) | | group boundary (drawn in Create form) |
| `visibility` | 0 Hidden / 1 Protected / 2 Public | 1 | see 10 §2.1 |
| `accessibility` | 0 Closed / 1 Restricted / 2 Open | 1 | see 10 §2.2 |
| `access_code` | 10‑char alphanumeric | generated (unique across links & groups) | also the system invite link's code |
| `allow_in_public` | bool | `NODE_ENV === 'development'` (i.e. **false in production**) | "in the commons": posts can go to public feeds; group appears in Group Explorer |
| `accepted_post_types` | jsonb array | from form | null = all types |
| `home_route` | string | computed (see §5.1) | e.g. `/all`, `/chat`, `/map` |
| `menu_view_count`, `more_spaces_count` | int | | caches |
| `settings` | jsonb | see below | |
| `steward_descriptor`, `steward_descriptor_plural` | string | null → getters return "Steward"/"Stewards" | `moderatorDescriptor*` are deprecated aliases |
| `type_descriptor`, `type_descriptor_plural` | string | | |
| `calendar_token` | uuid | generated | event ICS feed (`eventCalendarUrl`) |
| `created_by_id`, `created_at`, `updated_at` | | | |
| `active` | bool | true | false = deleted |
| `status` | `draft`/`published`/… | | spaces/tracks/funding rounds (15/21/22) |
| `num_members` | int | 1 after creator added | maintained on join/leave; recomputed every 10 min by cron (`updateAllMemberCounts`, counts active memberships of active users) |
| `num_open_join_requests` | int | 0 | |
| `paywall`, `stripe_*` | | | 23 |
| `lift_admin_invite_limits` | bool | false | DB only (10 §2.9) |
| `slack_hook_url` etc. | | | legacy, unused |

Default `settings` set by `Group.create` (any client‑supplied `settings` is **overwritten**):

```json
{ "allow_group_invites": false, "agreements_last_updated_at": null,
  "public_member_directory": false, "homeView": "<data.home_view || 'CHAT'>", "layout": "two-column" }
```

Other settings keys (set later via settings): `ask_join_questions`, `ask_group_to_group_join_questions`, `default_digest_frequency` (`daily`|`weekly`), `hide_extension_data`, `location_display_precision` (`precise`|`near`|`region`), `publish_murmurations_profile`, `show_suggested_skills`, `show_welcome_page`, `show_post_notices_in_chat`, `auto_add_members` (spaces), `public_listing_request` (commons request), `chat_converted_to_post_id`. GraphQL exposes them camelCased in `GroupSettings`.

Location display precision (getter behaviour for non‑Administrators): `precise` → full `location` & location object; `near` → `location` shown as "City, Region, Country" built from the location object and the map point jittered randomly (±~0.03°) on each load; `region` → display string only, `locationObject` null (not on map). Labels: "Display exact location" / "Display only nearest city and show nearby location on the map" / "Display only nearest city and dont show on the map".

### 2.2 Group types & presets

| `type` | How created | Differences |
|---|---|---|
| `null` (default) | Create Group form | standard About body |
| `'farm'` | API only (e.g. farm onboarding partner via `createGroup` with `type:'farm'` and `groupExtensions:[{type:'farm-onboarding', data}]`); no web UI to choose it | About uses `FarmGroupDetailBody` widgets; Explorer farm filters; data in `group_extensions` |
| `'space'` | `createSpace` (15) | lives under a parent, inherits roles/agreements; About via `GroupAboutView isSpace` |

There are no other templates/presets; the "presets" in the Create form are the home‑view choice and the menu items editor.

Extensions: `extensions(id, type)` (only `'farm-onboarding'`), `group_extensions(group_id, extension_id, data jsonb, active)`. Unknown type → **"Invalid extension type {type}"**.

### 2.3 Relationships

`group_relationships(id, parent_group_id, child_group_id, relationship_type 0=parent‑child | 1=peer, active, description, settings{isPrerequisite}, role (unused), created_at, updated_at)`. Peer rows are stored once with arbitrary parent/child orientation and read in both directions. `childGroups`/`parentGroups`/`peerGroups` exclude spaces and inactive groups and are ordered by name. `allChildGroups()` walks the whole parent‑child tree (recursive CTE) for stream aggregation (a group's stream includes posts from descendant groups and spaces the viewer is a member of). Invites: `group_relationship_invites` (10 §2.12). Group‑to‑group join questions: `group_to_group_join_questions(group_id, question_id)`.

---

## 3. Routes / entry points

| Path | Who | Component |
|---|---|---|
| `?create=group` (or legacy `?createGroup=true`) on any authenticated URL; optional `&name=…&slug=…` prefill | logged in | `CreateGroupModal` (overlay, page underneath stays) |
| `/create-group` | logged in | `CreateGroup` full page (header "Create a new group", back button) |
| Create menu "+" → group (see 06) | | opens the modal |
| `/groups/:slug/about`, `/about/{moderation,members,related-groups,notifications,settings,round-details}` | members | `GroupAboutPage` (tabbed `GroupAboutView`) |
| `/groups/:slug/*` (any path) when not a member | logged‑in non‑member | `GroupDetail` replaces all group routes (unless the viewer has retained paid access → redirect to `/about`) |
| `/groups/:slug/*` logged out | public | `PublicGroupDetail` → `GroupDetail` inside a public header frame (or redirect to `/login?returnToUrl=` if not Public and no invitation params) |
| `…/group/:detailGroupSlug` under `/all/map`, `/public/map`, `/public/groups`, `/groups/:slug/{map,groups,custom/:id}`, `/groups/:slug` | logged in | `GroupDetail` as a side panel (with close ×) |
| `/groups/:slug/groups` | members | redirect → `/groups/:slug/about/related-groups` |
| `/groups/:slug/moderation` | | redirect → `/about/moderation` |
| `/groups/:slug/welcome` | members | `GroupWelcomePage` |
| Space "About" | members | `SpaceAboutModal` (dialog with `GroupAboutView isSpace`) |
| `/public/groups` (auth) and `/public/groups` (public layout, index of `/public`) | anyone | `GroupExplorer` |
| `/noo/group/:slug/murmurations` | API | Murmurations profile JSON (Public groups with `publish_murmurations_profile`) |

---

## 4. UX specification

### 4.1 Create Group

#### 4.1.1 Containers

- **Modal** (`CreateGroupModal`): non‑modal Radix dialog, width `calc(100vw-2rem)` max 620px, max‑height `calc(100vh-5rem)`, rounded‑2xl, no padding; header bar 48px high, bottom border, `Users` icon (selected colour) + title **"Create a group"**; close × top‑right. Body scrolls (padding 24px sides, 20px top, 24px bottom); footer fixed (padding 20px×14px, top border). Clicks/focus inside Filestack upload overlays and nested dialogs (`[data-hylo-nested-dialog]`) don't close it. Escape or ×/outside → `requestClose` (confirm if data entered). Closing removes `create`, `createGroup`, `name`, `slug` query params (replace).
- **Page** (`/create-group`): centered column max‑width `screen-sm`, padding 16px/40px, footer `mt-8 mb-10`; no Cancel button.
- Discard confirmation (modal only): dialog **"Discard this group?"** / **"You have entered information for this group. If you discard it, that information will be lost."** buttons **"Continue Editing"** / **"Discard Group"**. Shown when any field differs from defaults (name, customised slug, purpose, images, home view ≠ Stream, visibility ≠ Protected, accessibility ≠ Restricted, invite policy ≠ stewards, location/boundary, parent groups changed from the prefill, any agreement/question row, post types changed, welcome enabled/edited, menu items changed).

#### 4.1.2 Form layout (top → bottom)

1. **Banner + avatar picker** (margin‑bottom 48px):
   - Banner drop zone: full width, 150px tall, rounded‑xl, 2px dashed border (`foreground/30`), shows `ImagePlus` icon + **"Add a banner"** (50% opacity → 100% on hover); after upload shows the image as cover background, border removed. Upload type `groupBanner`.
   - Avatar: 72×72 rounded‑xl tile overlapping the banner's bottom‑left (left 16px, bottom −36px) inside a 4px `bg-background` frame; empty state dashed border with `ImagePlus` + **"Avatar"** (10px text); uploaded → image with 4px border. Upload type `groupAvatar`.
2. **Name / Handle row** — grid: one column on mobile; `1.35fr 1fr` from `sm`.
   - **Name**: label "Name", autofocus input placeholder **"Name your group"**, maxLength 60. After blur, empty → **"Please enter a group name"** (error colour, xs).
   - **Handle**: label "Handle" + info button tooltip **"Your group's unique address on Hylo. It appears in your group URL and lets people mention the group in posts."** Input styled as one field with a muted `@` prefix, placeholder **"your-group-name"**, maxLength 40; clicking selects its text. Below: error text or muted helper `hylo.com/groups/{slug or …}` (truncated).
   - Slug auto‑derivation (until the user edits the handle): `name.toLowerCase()`, replace any char not `[a-z0-9 -]` with space, trim, collapse runs of whitespace/hyphens to one `-`, cut to 40, strip leading/trailing `-` (e.g. "Bay & Delta  Watershed!" → `bay-delta-watershed`). Non‑ASCII letters are dropped.
   - Validation: empty slug with a name → **"Please enter a URL slug"**; regex fail → **"URLs must have between 2 and 40 characters, and can only have lower case letters, numbers, and dashes."**; availability checked by `groupExists(slug)` 300ms after typing stops (only for regex‑valid slugs; only the answer for the current slug is trusted) → taken: **"This URL already exists. Try another."** (field border turns error colour). `groupExists` with an invalid slug errors **"Slug is invalid"**.
3. **Purpose**: label "Purpose" with live counter `{n} / 500` right‑aligned; 2‑row textarea placeholder **"What is this group for?"**, maxLength 500.
4. **"Who can see this group?"** — `SettingSelectRow`: 36px circular tinted icon + bold 15px title of the current choice with a chevron (opens a 280px popover listing the options with icon, title, description); the description renders under the title. Options (Globe/Shield/EyeOff) and copy in 10 §2.1. Default **Protected**.
5. **"Who can join this group?"** — same control; options DoorOpen/Lock/Users (10 §2.2). Default **Restricted**.
6. **"Who can add new members?"** — `InvitePolicySelect`: **"Everyone in the Group"** (Users icon; description Open: "Every member can invite people, and the people they invite join right away."; otherwise "Every member can invite people. A steward approves each person before they join.") / **"Stewards with the Add Members responsibility"** (ShieldCheck; "Only roles that include Add Members can invite people: Administrators, Hosts and any custom role you give it."). Default stewards.
7. **"Choose your group's home"** — subtitle **"Set the default view members see when they enter your group. You can change this later by editing the group menu."**; right‑aligned outline button **"Edit Full Menu"** (Settings icon). Default control: `HomeViewPicker` with three options:

   | value | view type | icon | title | description |
   |---|---|---|---|---|
   | `STREAM` (default) | `all` | Activity | Activity Stream | "A sorted feed of all your group's posts" |
   | `CHAT` | `chat` | MessageCircleMore | Chat | "A real-time chat room for quick conversations, coordination and casual interactions." |
   | `MAP` | `map` | Map | Map | "See where your people, projects, events and more are located" |

   "Edit Full Menu" swaps the picker for an `AdvancedSection` **"Menu Items"** containing `IncludedViewsEditor` (label **"These are the menu your members use. The one at the top is your group's home."**): an orderable list of standard views (All/Activity, Chat, one per selected post‑type pill, Map, Members, optional Welcome) that can be removed, plus "add view" for custom/link/text/collection/etc. views (15). The top row becomes home; if it isn't one of the three, the picker shows a custom‑home state (`CUSTOM`).
8. **Commons box** (only when visibility = Public): rounded‑xl `foreground/5` panel: heading **"Optional: Add my group into the commons"**, two paragraphs `commonsExplainerText1` ("The Commons are the public stream of content, public group directory and the public map of Hylo.") and `commonsExplainerText2` ("To avoid spam and misaligned content, groups must apply for permission to post to public areas. Once approved, your group stewards become responsible for all public content shared that are associated with your group/s"); switch **"Ask the Hylo team to add this group to the commons"** (default off).
9. **"Additional settings"** (top border, 24px above): a wrap row of **AdvancedPills** (rounded‑full, 2px border; open = `selected` border/bg/text; closed pill shows a tooltip "DEFAULT" + summary). Clicking toggles a revealed `AdvancedSection` card (rounded‑xl, `foreground/5`, header icon + label + × hide) appended below and scrolled into view:

   | Pill | Icon | Default summary | Editor |
   |---|---|---|---|
   | Location | MapPin | "No location" | `LocationWithBoundary`: location search (placeholder **"Where is this group based?"**, saves location to DB) + optional map boundary drawing (GeoJSON) |
   | Post types | LayoutGrid | "Discussions, events, requests, offers" | `PostTypePills` label **"Accepted post types"**: Discussions, Events, Resources, Projects, Proposals, Requests & Offers (all on by default; request+offer one pill) |
   | Welcome | HeartHandshake | "No welcome page" | switch **"Show this welcome page to new members when they first land in the group."** (default on) + rich editor (`type='welcomePage'`, min‑height 120px). Opening adds a `welcome` view to the menu; hiding removes it (draft kept). |
   | Parent groups | Network | "No parent groups" | hidden when the user has no eligible groups. Help **"You may add parent groups if you are an Administrator of the group you wish to add, or if the group you wish to add has the Open access setting which allows any group to join it"**; selected groups as pills (20px avatar, name, ×); **"Add a parent group"** dashed pill reveals a search field (placeholder **"Search groups to add"**). Eligible = my non‑space memberships where the group is Open or I hold Administration, sorted by name. Opening Create Group from inside an eligible group pre‑selects it and pre‑opens this pill. |
   | Agreements | ScrollText | "No agreements" | rows: title input (**"Agreement title"**, bold) stacked on a 2‑row textarea (**"Describe what members are agreeing to"**), × remove; dashed **"Add an agreement"** |
   | Join questions | HelpCircle | "No questions" | help **"People requesting to join your group must answer these questions. You and other stewards will be able to see their answers before approving."**; inputs placeholder **"What would you like to ask people who want to join?"**; **"Add a question"** |

10. **Footer**: error text (left, flex‑1) **"There was an error, please try again."**; modal only: outline **"Cancel"**; primary `highVisibility` button **"Create Group"** with `ArrowRight`, disabled unless name non‑blank, slug present, slug valid, and not known taken (and while submitting).

#### 4.1.3 Submit sequence (client)

1. `createGroup(data)` with: `accessibility, avatarUrl (or DEFAULT_AVATAR), bannerUrl, homeView ('STREAM' if custom home), name (trimmed), slug, location (fullText), locationId, geoShape, parentIds, purpose (trimmed), acceptedPostTypes, viewTypes, visibility, invitePolicy`. `viewTypes` = the Menu Items order if the editor was opened, else the derived default `['all','chat', <post-type views in pill order>, 'map','members', ('welcome')]` with the home type moved to the front. With all defaults: `all, chat, discussions, events, resources, projects, proposals, requests-and-offers, map, members`.
2. Analytics `GROUP_CREATED` (via action meta) and invite‑policy‑set event (`'create'`).
3. If manual (non‑standard) views were added: fetch the seeded views and create each manual view in position (`createGroupView` with `orderInFrontOfViewId`/`addToEnd`).
4. `updateGroupSettings` with agreements (non‑blank titles, with `order`), join questions (non‑blank), and `settings.showWelcomePage` when Welcome was enabled (createGroup itself ignores agreements/questions). Note this does **not** set `askJoinQuestions`, so questions entered here are stored but not required until a steward enables "ask join questions" in settings (see quirks).
5. If Welcome content was written: find the `welcome` view and `updateGroupView(pageContent)`.
6. If Public + commons switch on + `!allowInPublic`: `requestPublicListing(groupId)` (best effort; errors ignored).
7. Close the modal and navigate to `/groups/{slug}` → resolves to the group's `home_route` (a creator never sees the welcome redirect because `lastReadAt` is set at creation).

### 4.2 Member About page (`GroupAboutPage` → `GroupAboutView`)

Header (view header): title **"About"**, `Info` icon, no search.

**Banner** (non‑space 210px tall, space 190px): cover image = banner (default banner when none) with gradient `rgba(0,0,0,.15) → rgba(0,0,0,.78)`; spaces without a banner use a patterned glyph texture of the space icon. Content row (max‑width 808px, padding 24px, bottom 20px): group avatar 72×72 radius 18px with 2px white/30 border and shadow (spaces: 66×66 radius 17px frosted tile with avatar or icon); name H1 24px (27px ≥sm) bold white, truncated, text shadow; meta line 13px: **"{{count}} Members"** · `MapPin` location (groups) or · parent group name (spaces).

**Tab rail** (sticky, `context-menu-background`, header shadow; horizontally scrollable; when overflowing a right‑edge **"More ›"** button scrolls 240px). Tabs (pill buttons, 13px semibold, icon 16px; active = `selected/20` bg + `selected/50` 2px border):

| Tab id | Label | Icon | Shown when | Content |
|---|---|---|---|---|
| `about` | About | Info | always | AboutPanel |
| `round-details` | Round Details | BadgeDollarSign | funding‑round spaces | `FundingRoundAboutInfo` (22) |
| `moderation` | Moderation | ShieldCheck | always | `Moderation` (12) |
| `notifications` | Notification Settings | Bell | viewer is a member | card **"Notification Settings for {{name}}"** with compact membership notification settings (spaces: posts only) |
| `members` | Members | Users | always | `Members` (card mode; list mode in dialogs) (20) |
| `related-groups` | Related Groups | Network | non‑space with ≥1 parent/child/peer | `Groups` (§4.6) |
| `settings` | Settings | Settings | groups: Administration; spaces: Administration on space or parent | groups → navigate to `/groups/:slug/settings`; spaces → inline Space Settings |

Tab changes update the URL (`about/<tab>`), preserving the query string.

**AboutPanel** (column of cards, max‑width 760px, gap 16px; card = `bg-card`, 1px border `foreground/10`, rounded‑xl, padding 20×16, 16px bold title + optional right action):
1. **Purpose** — plain text (14px, relaxed, 80%).
2. **Description** (if description or website) — description rendered as HTML (`HyloHTML`, mentions/topics clickable); **WEBSITE** micro‑label (10.5px, uppercase, tracking‑widest) and a segmented control: link (Link2 icon + URL, focus colour) | open‑in‑new‑tab button (**"Open in a new tab"**) | copy button (**"Copy link"** → check + "Copied" 1.6s).
3. **Stewards** (if any; title = `stewardDescriptorPlural` or "Stewards") — action ghost button **"All members"** (switches to Members tab). Steward chips: rounded‑full bordered, 1.5/3.5 padding, small round avatar, name (14px semibold) and descriptor (`stewardDescriptor` or "Steward", 11px muted); link to the person's profile in the group (parent group for spaces). Stewards = members holding Administration, Remove Members or Manage Content (server `stewards()`), subject to public‑member‑directory guard for non‑members.
4. **Privacy settings** — group: two rows (icon + `t(visibilityDescription)`, icon + `t(accessibilityDescription)`); space: one row with `spaceAccessDescription` ("A paid membership is required to join this space" / "Only {{roleNames}} may join this space" / "Anyone in {{groupName}} can access this space" / "Members of {{groupName}} must request to join and be approved" / "You must be invited to join this space").
5. **Agreements** (if any) — action ghost button **"Copy link"** → **"Link copied"** (copies `{origin}/groups/{slug}/about#agreements`); numbered rows: 24px round `selected/20` badge with the number, bold title, description (plain text).
6. **Leave** (members) — dashed box with (spaces) the global‑nav pin button and an outline accent button `LogOut` **"Leave {{name}}"** / **"Leave Space"** → confirm dialog title same, body **"Are you sure you want to leave {{group_name}}?"** (space: "…? You will no longer have access to this space's content."), buttons **"Cancel"** / destructive **"Leave Group"**/**"Leave Space"** → leave (10 §5.8) and navigate to `/` (space → parent group).

> The About video (`aboutVideoUri`) is **not** rendered on the member About page; only on the non‑member detail page (§4.3).

**SpaceAboutModal**: Radix dialog max‑width 720px, max‑height 85vh, no padding, sr‑only title "About"; loads space details if missing; renders `GroupAboutView isSpace inDialog` (closing before any navigation).

### 4.3 Non‑member / public group detail (`GroupDetail`)

Used for non‑members (full page, max‑width 750px, `my-4`), logged‑out visitors (inside `PublicPageHeader` frame, `bg-midground` rounded column), and as a side panel ("group/:detailGroupSlug", not full page; a close × at top). `<title>` "{name} | Hylo", meta description = description truncated to 144 chars. View header **"About {{name}}"** (Info icon, search on).

Layout:
1. **Banner block** (`py-8`, cover image + 50% darkening overlay, shadow‑xl, rounded‑xl when full page): centered 96×96 rounded‑xl avatar with shadow; name (white, bold, 24px, centered); for spaces viewed as their own About by an Administrator a secondary **"Space Settings"** button; a row (white/70, 14px) with the visibility icon and accessibility icon (each with a hover tooltip "{Name} - {description}") and **"{{count}} Members"**; below, location text.
2. Body (padding 16px), in dashed rounded‑xl cards (2px dashed `foreground/20`, padding 16px, mb 16px):
   - Normal/space groups: **About video** embed (YouTube/Vimeo etc. converted to an embed URL in an iframe; otherwise ReactPlayer), then a card with **Purpose**, **Description** (Markdown rendered), **Website** (link, new tab) — each with an xl bold H3. If viewing the current group's own detail as an Administrator and both purpose and description are empty: card **"Your group doesn't have a purpose or description"** / **"Add a purpose, description, location, and more in your group settings"** / link **"Add a group description"** → settings.
   - Farm groups: `FarmGroupDetailBody` (§4.8).
   - **Stewards** card (only when it's the current group's own About or a farm): H3 `stewardDescriptorPlural` or "Stewards"; rows with medium avatar + name linking to profile, and role emoji badges (`BadgeEmoji` expanded, tooltips list responsibilities).
   - **Privacy settings** card: two rows icon + "{Name} - {description}" (legacy strings).
   - Funding round info (funding‑round spaces).
   - **Agreements** card (`id="agreements"`, scrolled into view when URL hash is `#agreements`): H2 **"Agreements"** + **"Copy Link"** button (→ **"Copied!"** 2.5s); each agreement "**{n}) {title}**" + Markdown description.
   - Notification settings card (members only), Leave button (own About only), retained‑access panel (23), and the **Join section** (10 §4.3).

### 4.4 Welcome page (`/groups/:slug/welcome`)

Header **"Welcome"** with `HeartHandshake` icon. Content column max‑width 750px, padding 16px, page‑HTML typography. Body = the HTML `pageContent` of the group's `welcome` view (rich editor content incl. images/video/iframes; links handled by ClickCatcher). If empty (no visible text or media): H1 **"Welcome to {{group.name}}!"**. Funding‑round spaces append round info; track spaces show a centered large secondary **"Begin"** button → space home (track actions). Analytics `GROUP_WELCOME_PAGE_VIEWED`. Loading spinner until views loaded.

The welcome view is created when Welcome is enabled in Create Group, or when a steward sets `settings.showWelcomePage = true` (server appends a `welcome` view to the menu if missing, or re‑adds it to the end of the menu if it was off‑menu). Editing content happens in the menu editor (`?edit=true` on the group context menu, 15). First‑visit redirect rules → 10 §4.5.

**Group‑created email** (to creator, SendWithUs template `tem_7dHq84ct6mJS847pTVJK6b4P`, creator's locale): data `first_name` (first word of name), `group_name`, `add_purpose_url` = group settings URL, `edit_welcome_page_url` = `{group url}?edit=true`, `stewardship_support_url` = `https://hylozoic.gitbook.io/hylo/about/community-stewardship-support-program-csaas`, `community_call_url` = `https://www.hylo.com/participate/`. Sent for every new group and space.

### 4.5 Group card (`GroupCard`)

Used by related groups lists, map drawer, user's groups list, Group Explorer.
- Whole card is a link: members (`memberStatus === 'member'`) → group home; others → group detail panel (`…/group/:slug` under current route).
- Visual: rounded‑lg, padding 16px, `bg-darkening/80`, shadow‑xl, hover scale 1.02; the group banner is an absolute full‑bleed background at 60% opacity (80% on hover).
- Left: 50px square rounded avatar (shadow); white bold name; **"{{count}} Members"** (xs, white/80) when >0; for peers a frosted chip **"Peer Relationship:"** + description truncated to 50 chars + "...".
- Right: visibility icon and accessibility icon (hover tooltips "**{Name}** - {description}"); `DollarSign` icon when paywalled (tooltip "**Paywall** - This group requires payment to join"); status: member → dark chip `UserRoundCheck` **"Member"**; requested → chip **"Membership Requested"**; otherwise a light bordered pseudo‑button `CirclePlus` **"Join"** (clicking anywhere opens the detail; no direct join).

### 4.6 Related groups (`/about/related-groups`, `Groups`)

Fetches the group's parent, child and peer groups (+ `peerGroupRelationships` with descriptions). Header "Groups" with Network icon. Column max‑width 750px.
- No relationships: dashed card **"Your group is not connected to any other groups yet."** (the tab itself is hidden in About when there are none).
- When total relationships > 1: **network map** card (§4.7).
- Sections (dashed cards, centered xl bold heading, then a vertical list of GroupCards):
  - Parents: **"{{group.name}} is a part of 1 Group"** / **"{{group.name}} is a part of {{parentGroups.length}} Groups"**.
  - Children: **"1 Group is a part of {{group.name}}"** / **"{{childGroups.length}} groups are a part of {{group.name}}"**.
  - Peers: **"{{group.name}} is connected to 1 peer group"** / **"{{group.name}} is connected to {{peerGroups.length}} peer groups"**.
- Each card has memberStatus computed from my memberships and pending join requests.
- Visibility: only related groups visible to the viewer appear (server `groupFilter`; hidden children/peers only for Administrators).

Managing relationships (invite parent/child/peer, accept/reject, prerequisite flags, group‑to‑group join questions) is in Settings → Related Groups (11); server rules in 10 §5.9.

### 4.7 Network map (`GroupNetworkMap`)

D3 force‑directed SVG in a card with `/network-map-bg.png` background, rounded‑xl, shadow‑2xl; min‑height 300px (<5 nodes), 400px (5–14), 500px (≥15).
- Nodes: current group + parents + children + peers (one generation only). Each node is a 40px circular‑clipped avatar (default avatar fallback) and a centered name label below (word‑wrapped); both link to `groupUrl(slug)`; nodes are draggable.
- Links: parent→current (`type:'parent'`, accent colour, solid, 2px, arrow marker), current→child (focus colour, solid, 2px, arrow), current↔peer (peer colour, dashed 5,5, 3px, small dot marker); opacity 0.7 (peer 0.8); invisible 12px hit lines show a tooltip **"Peer Relationship:"** + description on hover for peers with descriptions.
- Forces: link, charge −600, collide radius 52, center, x/y towards width/4,height/4 (strength 0.5/0.7). Zoom handler attached but disabled.
- Legend bottom‑left (140×80 rounded rect, 90% opacity): "Parent Group", "Child Group", "Peer Group" with line samples.

### 4.8 Farm groups (`FarmGroupDetailBody`)

Replaces the default About body for `type='farm'` in `GroupDetail`. Farm data = the `farm-onboarding` extension's `data`, or `{}` when `settings.hideExtensionData` is true. Widgets, in order (each with title; hidden when no items):

| Widget | Title | Visible | Content |
|---|---|---|---|
| `farm_at_a_glance` | "At A Glance" | always | capitalised `at_a_glance` items; website link (**"Website for {{group.name}}"**) and social link (**"Social media link for {{group.name}}"**) |
| `mission` | — | always | about video (`aboutVideoUri`) + farm `bio` or description (Markdown) |
| `farm_details` | "Farm Details" | always | pills: "Area: {range}" (from `area`, unit pref metric/imperial, shown as range), "Livestock: {range}" (`animals_total`), "Climate Zone: {label}", "Hardiness Zone: {x}", operation types (`types` → FARM_TYPES labels); sections **Products** (`products_animals`, `product_detail`, `products_value_added`), **Certifications** (`certifications_current_detail`), **Management Techniques** (`management_plans_current_detail`); collapsed with show more when >1 section or >6 items |
| `opportunities_to_collaborate` | "Opportunities to Collaborate" | always | from `interest`/opportunities |
| `relevant_requests_offers` | "Nearby Relevant Offers and Requests" | logged in | public posts |
| `relevant_project_activity` | "Recently Active Projects" | logged in | |
| `relevant_events` | "Nearby Relevant Events" | logged in | |
| `farm_map` | "Farm Surrounds & Posts" | always | map of farm area & posts |
| `farm_open_to_public` | "Location & Hours" | always | opening hours ("Open"), **"Public Offerings"** list |

Farm data keys read by the web (external, evolving schema): `animals_detail, animals_total, area, area_community, area_total_hectares, average_annual_rainfall, average_annual_temperature, bio, certifications_current, certifications_future(_detail), climate_zone, conditions_detail, county, email, equity_practices, farm_leadership_experience, hardiness_zone, indigenous_territory, interest, land_other(_detail), land_type_detail, location_address_line, location_administrative_area, location_country_code, location_locality, location_postal_code, mailing_address, management_plans_current(_detail), management_plans_future(_detail), motivations, name, organization, organization_id, phone, preferred, product_categories, product_detail, products_animals, products_categories, products_value_added, schema_version, social, types, units, website` plus `at_a_glance, mission, open_to_public, opening_hours, public_offerings, location_privacy`. Option lists (labels) live in `apps/web/src/util/constants.js` (`FARM_TYPES`, `PRODUCT_CATEGORIES`, `MANAGEMENT_PLANS`, `FARM_CERTIFICATIONS`, `CLIMATE_ZONES`, `ANIMAL_LIST`, `FARM_PRODUCT_LIST`).

Stewards card is always shown for farms on the detail page.

### 4.9 Group Explorer (`/public/groups`)

Header title **"Group Explorer"** (search on); `<title>` "Group Explorer | Hylo", meta "Find the others on Hylo". Column max‑width `screen-md`, padding 32px top/bottom.

1. **Featured Groups** (only when env `VITE_FEATURED_GROUP_IDS` lists ids; order preserved; only groups with `allowInPublic`): panel (rounded‑lg, inset shadow, `bg-background`) heading **"Featured Groups"** (14px bold) with an Info icon linking to the "building-hylo" group detail (tooltip **"To recommend a group to be featured, join building Hylo"**); horizontal snap‑scrolling row with edge fade gradients; cards 250×350 rounded‑lg (hover scale 1.05): banner at 70% opacity + bottom gradient, 100px square avatar, white xl bold name (+ `DollarSign` with tooltip "This group requires payment to join"), "{memberCount} Members", 3‑line description, outline button **"View"** → group detail.
2. **Search bar** (dashed bottom border): text input placeholder **"Search groups by keyword"** (debounced 500ms; terms of 1 char are ignored); farm view only: **"Filters"** toggle button; sort dropdown **"Sort by: "** + **Group Name** (default) / **Member Count** / **Nearest** (only when the user has a location; distance from the user's location centre, within 10,000 km).
   - Farm filters (when `viewFilter='farm'`, not used by the main explorer route): dropdowns "Farm Type: ", "Operation: ", "Management Techniques: " (each with "All").
3. **Results**: vertical list of `GroupCard`s (gap 16px), infinite scroll (page size 20, loads 350px before bottom), spinner while loading, **"No results for this search"** empty state, **"No more results"** at the end.

Server query (`groups(allowedInPublic: true, search, sortBy, nearCoord, first, offset)`): groups visible to the viewer (logged out: Public only) **and** `allow_in_public = true`, spaces excluded; search = term match on name, description, location; sort `name` asc, `size` desc (count of all membership rows), or nearest.

### 4.10 Group deletion (user perspective)

Settings → Delete (11): button **"Delete Group"**, text "If you delete this group, it will no longer be visible to you or any of the members. All posts will also be deleted.", confirm "Are you sure you want to delete the group {{name}}?". Requires `Administration`. Server `deleteGroup(id)` → `Group.deactivate`: `active=false` then remove **all** members (memberships deactivated, roles revoked, agreements reset, child‑space memberships cascade). Posts are not physically deleted; the group disappears from every query (`active=true` filters). Spaces have separate soft delete / archive / hard destroy (15).

---

## 5. Business rules & side effects

### 5.1 `createGroup(data, asUserId?)` server sequence

1. `slug` required → **"Missing required field: slug"**; existing slug (any group, active or not) → **"A group with that URL slug already exists"**. (Slug format is not validated here — only by `groupExists` and the client.)
2. Accepted input fields: `about_video_uri, accessibility, access_code, avatar_url, banner_url, description, location_id, location, name, purpose, settings (ignored, see below), slug, accepted_post_types, steward_descriptor(_plural), type, type_descriptor(_plural), visibility`; `name`/`purpose` trimmed. Defaults: accessibility 1, visibility 1, avatar/banner defaults. `geo_shape` converted from GeoJSON. `allow_in_public` = dev only. Settings = defaults (§2.1). `access_code` = given or generated; `calendar_token` uuid; `home_route` = `/chat/general` (homeView CHAT, the server default), `/map` (MAP), or `/all`.
3. In one transaction:
   - Save group.
   - `GroupRole.setupSystemRoles`: system roles **Administrator** (🪄, Administration + Add Members + Remove Members + Manage Content), **Moderator** (⚖️, Manage Content + Remove Members), **Host** (👋, Add Members), plus the hidden **All Members** role.
   - System invite link (code = access_code, grants access, `created_by_id` = creator).
   - Invite policy: `data.invitePolicy` or default `stewards` (non‑spaces).
   - Group extensions (farm data).
   - `setupSpaceViews(groupId, acceptedPostTypes, viewTypes)`: if `viewTypes` given, one `group_views` row per type in order (order 0..n); else `all, chat, members` + one view per accepted post type (`discussion→discussions, event→events, resource→resources, project→projects, proposal→proposals, request/offer→requests-and-offers`). **Overwrites `home_route`** with the first view's path (`/{type}`, or `/custom/{id}` etc.) and sets `menu_view_count`.
   - Add the creator as member (`assignAdministrator: true`, `lastReadAt: now`; creator's settings: `showJoinForm:false`, agreements/questions marked done) → Administrator role; follows default topics (none exist yet).
   - For each `parentIds` entry (active, not a space): if the creator is a member and the parent is Open, or the creator has Administration on the parent → attach as child directly; else create a ChildToParent `GroupRelationshipInvite` (notifies parent's moderators). Non‑member + Open parent → also a request.
4. After commit: geocode if `location` without `location_id`; non‑spaces → `notifyAboutCreate` email to `NEW_GROUP_EMAIL` (from "Hylobot" `dev+bot@hylo.com`, subject **"New Hylo Group Created: {name}"**, body: Group / Name / URL / Creator Email / Creator Name / Creator URL); group‑created email to creator (§4.4). Afterwards `afterAddMembers` job (Zapier/mixpanel/subscription) for the creator.

No default topics, chat rooms or starter posts are created (`createStarterPosts` is dead code). The `chat` view is the group's general chat (17).

### 5.2 Updating (summary; details in 11)

`updateGroupSettings(id, changes)` requires Administration: whitelisted attrs (`about_video_uri, accepted_post_types, active, access_code, accessibility, avatar_url, banner_url, description, geo_shape, icon, location, location_id, name, purpose, settings, steward_descriptor(_plural), type_descriptor(_plural), visibility, website_url, stripe_*, paywall`); settings are deep‑merged (except `public_listing_request`); agreements replace the list (agreements matched/reused by identical title+description; `agreements_last_updated_at` bumped if the set of ids changed; updater auto‑accepts); join questions & group‑to‑group questions replace lists; `prerequisite_group_ids`; extensions; `show_welcome_page` view handling; location geocode; spaces becoming auto‑add; Murmurations publish when Public & enabled. Publishes `groupUpdate` subscription.

### 5.3 Murmurations

When `visibility = Public` and `settings.publish_murmurations_profile`, each update POSTs `{ profile_url }` to `MURMURATIONS_INDEX_API_URL`. Profile (`/noo/group/:slug/murmurations`): `linked_schemas ['organizations_schema-v1.0.0'], unique_id 'hylo-group-{id}', name, primary_url (website or group URL), mission (purpose), description, image (avatar), header_image (banner), full_address (location), country_iso_3166, geolocation {lat, lon}, relationships` (public parents `schema.org/memberOf`, public children `schema.org/member`).

### 5.4 Message stewards

`messageGroupStewards(groupId)` (any user who can see the group): creates a `user_connections` row to each steward and finds/creates a DM thread with all stewards; returns thread id (18). Returns null if no stewards.

---

## 6. Permissions

| Action | Requirement |
|---|---|
| Create a group | any logged‑in user (no limit) |
| Attach a parent at creation | Administration on parent, or parent Open and creator is a member (else request) |
| View group / About | visibility rules (10 §2.3) |
| Member About tabs | member; Settings tab: Administration |
| Edit settings, delete group | Administration |
| See hidden children/peers in related lists | Administration on this group |
| Group Explorer | anyone (logged‑out: Public + in commons) |
| `addMember` mutation, `createGroup(asUserId)` | specific API clients only (24) |

---

## 7. API

- `createGroup(data: GroupInput, asUserId: ID): Group` — client selects `id allowInPublic homeRoute name purpose slug avatarUrl parentGroups groupRoles{…responsibilities} memberships{…settings}`.
- `groupExists(slug: String): { exists }` (errors "Slug is invalid").
- `group(id|slug, updateLastViewed, accessCode, invitationToken): Group` — see Group type fields (schema) incl. `stewards, moderators, parentGroups, childGroups, peerGroups, peerGroupRelationships{id description parentGroup childGroup}, prerequisiteGroups, groupExtensions{type data}, agreements, joinQuestions, suggestedSkills, aboutVideoUri, websiteUrl, locationObject, typeDescriptor, stewardDescriptor(Plural), memberCount, postCount, eventCalendarUrl, homeRoute, groupViews`.
- `groups(allowedInPublic, autocomplete, boundingBox, context ('all'|'public'), farmQuery, first, groupIds, groupType, nearCoord, offset, order, parentSlugs, search, sortBy ('name'|'size'|'nearest'), visibility): GroupQuerySet` (`visibility` arg honoured only as equality; `filter` unused).
- `updateGroupSettings(id, changes: GroupInput)`, `deleteGroup(id): GenericResult`, `messageGroupStewards(groupId): ID`, `requestPublicListing(groupId)` (11/24), relationship mutations (10 §5.9), `createSpace` (15).
- Subscriptions: `groupUpdate`, `groupRelationshipUpdate`, `groupMembershipUpdate`.

---

## 8. Edge cases & known quirks

- **Join questions entered in Create Group are not enforced**: they are saved, but `askJoinQuestions` stays false (the form never sets it), so they're neither shown at request time nor in the welcome modal until a steward enables "ask join questions" in settings.
- Server default `homeView` is `CHAT` (`home_route = /chat/general`), but `setupSpaceViews` immediately overwrites `home_route` from the first seeded view, so `/chat/general` survives only if no views are seeded (never in practice).
- `settings` passed to `createGroup` are discarded (defaults always applied).
- `allow_in_public` defaults false in production: new Public groups are not in the Explorer or Commons until a Hylo admin approves a commons request.
- `createGroup` doesn't validate slug format server‑side; only uniqueness.
- Group Explorer never sets `memberStatus`, so every card shows "Join" and links to the detail panel even for groups the viewer is in. The `visibility: [3]` argument it passes is dropped by the client action.
- Sort by Member Count counts all membership rows (incl. inactive) via a CTE; sorted descending.
- `FarmGroupDetailBody` reads the group from the current route (`useEnsureCurrentGroup`), not the `group` prop, so a farm opened as a side panel from another group's route may show that route's group data.
- The member About page omits the about video; the non‑member detail page shows it.
- Network map only shows one generation; zoom is disabled.
- Peer relationships created by the invitee's acceptance store the invite's message as the description; direct creation stores `description` passed in.
- Deleting a group doesn't delete relationships, posts or invite links; they're just unreachable.
- `Group.moderators()`/`stewards()` use hard‑coded responsibility ids (see 10 §8).

## 9. Docs vs. code

- Public "Create a Hylo Group" says to use the (+) button and "Start a Group" at the bottom; code opens a single‑page Create Group modal (`?create=group`) with banner/avatar, name/handle, purpose, visibility, join and invite policy, home view, commons request and "Additional settings" pills. No multi‑step wizard.
- Public "Related Groups" says "The Groups tab in your Group Menu… takes you to a network map"; in code `/groups/:slug/groups` redirects to About → **Related Groups** tab, and the map appears only when there are ≥2 relationships. Peer groups (dashed green links) are not mentioned in docs.
- Docs say only parent/child relationships exist; code also supports peer‑to‑peer relationships with descriptions.
- `docs/INVITATION_LINKS_ARCHITECTURE.md` references `regenerateAccessCode`, which no longer exists.

## 10. Source references

- Backend: `apps/backend/api/models/{Group,GroupRelationship,GroupRelationshipInvite,GroupRole,GroupView,GroupInviteLink,GroupExtension}.js`, `api/graphql/mutations/group.js`, `api/graphql/{makeSchema,makeModels,filters}.js`, `api/graphql/schema.graphql`, `api/services/Search.js`, `api/services/Search/util.js` (`filterAndSortGroups`), `lib/i18n/en.js`, `migrations/20220110135403_add-farm-onboarding-extension.js`.
- Web: `apps/web/src/routes/CreateGroup/*`, `routes/GroupAboutPage`, `components/GroupAboutView`, `routes/GroupDetail/GroupDetail.js`, `routes/PublicLayoutRouter/PublicGroupDetail.jsx`, `routes/GroupWelcomePage`, `routes/SpaceAboutModal`, `routes/Groups/Groups.jsx`, `components/{GroupCard,GroupNetworkMap,FarmGroupDetailBody,GroupAboutVideoEmbed,AdvancedSettings,SettingSelectRow,InvitePolicySelect,Widget}`, `routes/GroupExplorer/*`, `hooks/useEnsureSearchedGroups`, `store/models/{Group,GroupView}.js`, `store/selectors/farmExtensionSelectors.js`, `util/networkMap.js`, `routes/AuthLayoutRouter/AuthLayoutRouter.js`.
- Shared: `packages/presenters/src/GroupPresenter.js`, `packages/navigation/src/index.js` (`groupUrl`, `groupViewPath`, `homeRoutePathForView`).
- E2E: `apps/web/e2e/{create-group-modal,create-group-boundary,authenticated.create-group-join,commons-requests,map-group-cards,group-header-name}.spec.js`.
