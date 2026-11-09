# 11 — Group Settings

> Module owner file. Related: [09-groups.md](09-groups.md) (group creation, about page, welcome page, related-group concepts), [10-joining-invitations.md](10-joining-invitations.md) (join flows, invitations, invite links in depth), [12-roles-permissions-moderation.md](12-roles-permissions-moderation.md) (roles/responsibilities model, permission matrix, moderation), [15-views-streams-spaces.md](15-views-streams-spaces.md) (group menu, welcome view, spaces), [23-paid-content-stripe.md](23-paid-content-stripe.md) (Paid Content tab), [24-integrations-api-embeds.md](24-integrations-api-embeds.md) (data export, Murmurations), [06-app-shell-navigation.md](06-app-shell-navigation.md) (context menu / settings overlay).


## 1. Overview

Group Settings is the steward-only configuration area of a top-level group. It is a set of **tabs** ("sections") rendered inside the main content column of the group, with a **settings navigation panel** replacing the group's context menu (left sidebar). Every tab is its own URL under `/groups/:groupSlug/settings/…`.

Who uses it:

- Members holding the **Administration** responsibility (typically the built-in *Administrator* role) see every tab.
- Members holding only **Add Members** (e.g. *Host* role, or everyone when the invite policy is "Everyone in the Group") see only **Invitations** and **Join Requests**.
- Everyone else is redirected to the group home.

Spaces (`group.type === 'space'` or any group with a `parentId`) have **no** Group Settings: visiting `/groups/<space>/settings…` redirects to the space home (or to the space's `/requests` page for the requests tab). Spaces are configured through the Space Settings modal (see [15-views-streams-spaces.md](15-views-streams-spaces.md)).

## 2. Concepts & data

Settings write to the `groups` row and associated tables. Summary of what each tab persists:

| Tab | Persisted to |
|---|---|
| Group Details | `groups.name`, `avatar_url`, `banner_url`, `purpose`, `description`, `website_url`, `about_video_uri`, `location`, `location_id`, `geo_shape` (PostGIS geometry), `accepted_post_types` (jsonb array), `steward_descriptor`, `steward_descriptor_plural`, `settings.location_display_precision`, `settings.default_digest_frequency`, `settings.show_suggested_skills`, `settings.show_welcome_page`; group skills (`groups_suggested_skills`); welcome `group_views` row |
| Agreements | `agreements` + `groups_agreements` (ordered); `settings.agreements_last_updated_at` |
| Responsibilities | `responsibilities` (rows with `group_id` = this group, `type = 'group'`) |
| Roles & Badges | `groups_roles`, `group_roles_responsibilities`, `group_memberships_group_roles`; invite policy = link between the *All Members* role and *Add Members* |
| Privacy & Access | `groups.visibility`, `groups.accessibility`, `settings.ask_join_questions`, `settings.ask_group_to_group_join_questions`, `settings.hide_extension_data`, `settings.publish_murmurations_profile`, `group_join_questions`, `group_to_group_join_questions` (+ shared `questions` table), `group_relationships.settings.isPrerequisite`, `settings.public_listing_request` (commons request) |
| Invitations | `group_invite_links`, `group_invites`, `invitation_sends` |
| Join Requests | `join_requests` |
| Related Groups | `group_relationships`, `group_relationship_invites`, `group_to_group_join_request_question_answers` |
| Export Data | nothing (triggers a background export emailed to the requester) |
| Appearance & Layout | `settings.layout` (the chat notices setting `show_post_notices_in_chat` is edited from the chat view's settings modal, not here — see [17-chat-rooms.md](17-chat-rooms.md)) |
| Paid Content | Stripe columns on `groups` (`stripe_account_id`, `stripe_*_enabled`, `paywall`), `stripe_products`, `content_access` — see [23-paid-content-stripe.md](23-paid-content-stripe.md) |
| Delete | `groups.active = false` |

### 2.1 `groups.settings` JSON keys (snake_case in DB, camelCase in GraphQL)

The GraphQL `GroupSettings` type maps `settings` keys with `camelCase`. Writes go through `GroupSettingsInput`; the client strips any key not in this whitelist before sending (`GROUP_SETTINGS_INPUT_FIELDS`):

| GraphQL key | DB key | Type | Default (new group) | Edited in |
|---|---|---|---|---|
| `allowGroupInvites` | `allow_group_invites` | bool | `false` | — (legacy, "not currently used"; `allowGroupInvites` mutation still exists) |
| `askGroupToGroupJoinQuestions` | `ask_group_to_group_join_questions` | bool | unset (falsy) | Privacy |
| `askJoinQuestions` | `ask_join_questions` | bool | unset | Privacy |
| `defaultDigestFrequency` | `default_digest_frequency` | `'daily'`\|`'weekly'` | unset → UI shows Daily | Details |
| `hideExtensionData` | `hide_extension_data` | bool | unset | Privacy (only for typed groups, e.g. farms) |
| `layout` | `layout` | `'two-column'`\|`'one-column'` | `'two-column'` | Appearance |
| `locationDisplayPrecision` | `location_display_precision` | enum `precise`\|`near`\|`region` | unset → `precise` | Details |
| `publicMemberDirectory` | `public_member_directory` | bool | `false` | (no web UI in settings; read by member-directory guard) |
| `publishMurmurationsProfile` | `publish_murmurations_profile` | bool | unset | Privacy |
| `showSuggestedSkills` | `show_suggested_skills` | bool | unset | Details |
| `showWelcomePage` | `show_welcome_page` | bool | unset (treated as on, see §5.6) | Details |
| `showPostNoticesInChat` | `show_post_notices_in_chat` | bool | unset (UI treats as on) | chat view settings modal (`GroupViewSettingsModal`) |
| `autoAddMembers` | `auto_add_members` | bool | — | spaces only (Space Settings) |
| `agreementsLastUpdatedAt` (read-only) | `agreements_last_updated_at` | ISO date | `null` | set server-side when agreements change |
| — | `public_listing_request` | object | — | written only by `requestPublicListing` / `reviewPublicListingRequest` |
| — | `homeView` | `CHAT`\|`MAP`\|`STREAM` | `CHAT` | creation only |

Server merge semantics: `Group.update` deep-merges `changes.settings` into the existing settings (`merge({}, old, new)`); `public_listing_request` in incoming settings is ignored.

### 2.2 Group enums

- `visibility`: `0` Hidden, `1` Protected, `2` Public. New-group default `1` (Protected).
- `accessibility`: `0` Closed (invite only), `1` Restricted (request to join), `2` Open. New-group default `1` (Restricted).
- `type`: `null` (normal), `'farm'`, `'space'`.

## 3. Routes / entry points

All routes are children of `/groups/:groupSlug/settings` and render inside `GroupSettings` (wrapped in `FullPageModal`, a scrolling content column max-width 750px, padding `px-2 py-2` / `sm:px-8 sm:py-8`; no max width when the user's `settings.globalNavStyle === 'tabs'`).

| Path (relative to `/groups/:slug/`) | Tab (nav label) | Page header title | Visible when |
|---|---|---|---|
| `settings` (index) | **Group Details** | "Group Settings > Group Details" | Administration. On phone viewport the index renders the *phone settings menu list* instead (§4.3). |
| `settings/details` | Group Details (same component; stable URL used by phone list) | same | Administration |
| `settings/agreements` | **Agreements** | "Group Settings > Agreements" | Administration (and not a space) |
| `settings/responsibilities` | **Responsibilities** | "Group Settings > Responsibilities" | Administration |
| `settings/roles` | **Roles & Badges** | "Group Settings > Roles & Badges" | Administration |
| `settings/privacy` | **Privacy & Access** | desktop "Group Settings > Privacy", mobile "Privacy" | Administration |
| `settings/invite` | **Invitations** (desktop nav) / "Invite" (phone list) | "Invite People" (icon People) | Add Members (and not a space) |
| `settings/requests` | **Join Requests** | see §11 | Add Members |
| `settings/relationships` | **Related Groups** | see §12 | Administration |
| `settings/import` | *(no nav item; name is empty string)* | — | Administration — legacy CSV post import tab, reachable only by URL (§14) |
| `settings/export` | **Export Data** | see §15 | Administration |
| `settings/appearance` | **Appearance & Layout** | see §9 | Administration |
| `settings/paid-content/*` | **Paid Content** | see §13 | Administration |
| `settings/delete` | **Delete** | see §16 | Administration |

Entry points into settings (all navigate to `groupUrl(slug, 'settings')`):

- Gear button in the group menu header (`GroupMenuHeader`, aria-label "Group Settings").
- Settings button in the one-column dashboard layout (`ContextMenuGrid`).
- "Settings" link in the mobile drawer (`Drawer`).
- Group About view settings action (`GroupAboutView`).
- "Add a group description" link on group detail when description is empty (`GroupDetail`).
- Deep links from elsewhere: Privacy → `settings/relationships`; Invite → `settings/roles`; Stripe onboarding return/refresh URLs `settings/paid-content?onboarding=complete|refresh`; Space Settings modal → `settings/paid-content/offerings` and `settings/paid-content/content-access`; commons-decision emails → `<group settings url>/privacy`.

Access redirects (in `GroupSettings`):

1. While group not loaded → `<Loading/>`.
2. If group is a space → `<Navigate replace>` to the space home URL under its parent (`spaceHomeUrl(parentSlug, group)`). The app-level router also rewrites `/groups/<spaceSlug>/settings/requests…` → `<space url>/requests` and any other `/settings…` → space home.
3. If user has neither Administration nor Add Members → `push(groupUrl(slug))` (group home).
4. If user has Add Members but not Administration → `push('settings/invite')`.

Note: on mount, `fetchGroupSettings(slug)` runs (only when the group is already in the store; re-runs when `slug` changes).

## 4. Settings navigation

### 4.1 Desktop / tablet: settings nav panel

When the path matches `/groups/:slug/settings*`, the group's context-menu column renders `GroupSettingsMenu` instead of the normal group menu (the underlying menu stays mounted behind it). Layout:

- Full-height panel (`absolute inset-0`) with background gradient; an inner list column with a left shadow.
- Header `h3`: a **ChevronLeft** icon (click = close settings) + text "Group Settings".
- Vertical list (`data-tour='settings-nav'`) of `MenuLink`s, one per visible tab, in this order and with these labels (translated):

| # | Label | URL | Requires |
|---|---|---|---|
| 1 | Group Details | `settings` | Administration |
| 2 | Agreements | `settings/agreements` | Administration |
| 3 | Responsibilities | `settings/responsibilities` | Administration |
| 4 | Roles & Badges | `settings/roles` | Administration |
| 5 | Privacy & Access | `settings/privacy` | Administration |
| 6 | Invitations | `settings/invite` | Add Members, not space |
| 7 | Join Requests | `settings/requests` (space: `requests`) | Add Members |
| 8 | Related Groups | `settings/relationships` | Administration |
| 9 | Export Data | `settings/export` | Administration |
| 10 | Appearance & Layout | `settings/appearance` | Administration |
| 11 | Paid Content | `settings/paid-content` | Administration |
| 12 | Delete | `settings/delete` | Administration |

- Active item: border `border-secondary` (2px). "Group Details" is active only on the exact `/settings` path; other items are active on exact match or any sub-path (`…/paid-content/offerings` keeps Paid Content active). Note `settings/details` does **not** highlight Group Details (quirk).
- Item style: rounded, 2px transparent border, hover border `foreground/50`, hover card background, slight scale on hover, opacity 85% → 100%.
- Each item has `data-tour='settings-nav-<last path segment>'` (e.g. `settings-nav-privacy`).
- Clicking the transparent backdrop behind the panel, or the chevron, **closes settings**: if a tab has flagged unsaved changes (`FullPageModal.confirm` true) the browser `window.confirm("You have unsaved changes, are you sure you want to leave?")` is shown; on OK, the flag is cleared and the app navigates to the location the user was at before opening settings (`locationHistory.currentLocation`), falling back to the group home.
- On a phone *device* (`isPhoneDevice()`), the panel is `fixed` at `left: 66px` (`sm: 80px`), width 260px (`sm: 300px`); in one-column group layout it starts at `left-0`.

### 4.2 First-run tour

On first open, a guided tour (`GROUP_SETTINGS_TOUR_ID = 'group-settings'`, `autoStart`) is offered via an invitation banner at the top of the nav: "First time in group settings? Take a quick tour." Steps (popovers on the right of the nav):

1. Target `settings-nav` — title "Group Settings", text "Everything about how this group works is managed from these sections."
2. `settings-nav-privacy` — "Two separate dials": "Who can see the group and who can join it are set independently — check both."
3. `settings-nav-roles` — "Roles carry powers": "Responsibilities are the powers, roles bundle them, and members hold roles."
4. `settings-nav-invite` — "Three ways to invite": "A public link, a join link that skips approval, and email invites that can pre-assign a role."

### 4.3 Phone viewport: category list

On a phone-width viewport, `/settings` (index) renders `PhoneSettingsMenuList` instead of the Details form: header title "Group Settings" (no icon, no search), and a vertical list of full-width buttons (card background, 1px border, rounded-lg, `px-4 py-3`, label left, ChevronRight icon right). Items and order: Group Details (`details`), Agreements, Responsibilities, Roles & Badges, Privacy & Access, **Invite** (label differs from desktop "Invitations"), Join Requests, Related Groups, Export Data, Appearance & Layout, Paid Content, Delete — same visibility rules as §4.1. Tapping navigates to `settings/<path>`; mobile back navigation from `/settings/<tab>` returns to `/settings` (the list) (`util/mobileNavBack.js`).

### 4.4 Shared UI primitives

- **SettingsSection**: a card `border-2 border-dashed border-foreground/20 rounded-lg p-4 mb-8 relative`. Each logical group of settings lives in one.
- **SettingsControl**: label (`text-sm text-foreground/50`, block, mb-2) + control. Control types: `text` (default input), `textarea` (auto-growing 1–100 rows), `password`, `location` (LocationInput with geocoding, saves Location to DB), `icon-selector`. All controls: `bg-darkening/20 rounded-lg p-4 w-full`, focus outline 2px. Optional `helpText` renders a "?" bubble with hover tooltip. If no `onChange` is given the control is `readOnly`.
- **SaveButton** (used by Details and Privacy only): a sticky bar at the bottom of the tab (`sticky bottom-2`, rounded-xl, p-4, flex space-between). Hidden (opacity 0, scale 0, translated down 200px) when nothing has changed; when `changed` it animates in with a 2px dashed accent border and accent text. Left text: "Current settings up to date" (unchanged) / "Changes not saved" (changed) / the error string (if any). Right button: "Save Changes" (dark pill). Clicking calls `save` only if changed and no error.
- **Save model**: Details and Privacy keep a local `edits` copy and save all edits with one `updateGroupSettings` mutation when "Save Changes" is pressed. The mutation is **optimistic** (`meta.optimistic: true`); there is **no success toast** and no error toast for these tabs. After `fetchPending` flips false (settings fetch finished) the local edit state is reset from the store. All other tabs save per-item immediately (see each tab).
- **Unsaved-changes guard**: only the **Group Details** tab sets `FullPageModal.confirm` (`setConfirmBeforeClose(true)` on any edit, cleared on save). It is checked only when closing settings via the nav chevron/backdrop (§4.1); switching tabs inside settings does **not** prompt and silently discards unsaved edits. Privacy has no guard.

## 5. Group Details tab (`settings`, `settings/details`)

Header: title "Group Settings > Group Details", icon `Settings`.

### 5.1 Layout (top to bottom)

1. **Banner** — full-width block `h-[30vh]`, rounded-xl, shadow, background-image = banner (default `/default-group-banner.svg`). Wrapped in an upload button (`UploadAttachmentButton type='groupBanner' id=<groupId>`). Hover: scales 105% and shows a centred 100×100 dark overlay with `ImageUp` icon and text "Change group banner". On successful upload the new URL becomes `edits.bannerUrl` (not saved until "Save Changes").
2. **Avatar ("group icon")** — 100×100 rounded-xl square, centred horizontally, overlapping the bottom of the banner by 50px (`top:-50px`). Default `/default-group-avatar.svg`. Upload type `groupAvatar`. Hover overlay text "Change group icon". The banner area reserves `mb-[50px]`.
3. **Name** — borderless centred text input, `text-2xl font-bold`, transparent background; on hover/focus shows a dashed 2px border. `id='nameField'`. Server trims it and rejects blank: error "Name cannot be blank".
4. **Purpose Statement** — `textarea`, `maxLength=500`, with help tooltip (`purposeHelpText`): "Your purpose statement is a concise summary of why your group exists and what you hope to accomplish. A clear and specific purpose helps align members of your group to coordinate effectively to achieve your goals. Aim for one or two sentences." Trimmed server-side.
5. **Description** — `textarea` (`id='descriptionField'`), no limit; trimmed server-side. (Rendered as markdown/HTML on the About page, see [09-groups.md](09-groups.md).)
6. **Website URL** — text input. On every keystroke the value is passed through `TextHelpers.sanitizeURL` (prefixes a scheme when missing).
7. **About Video URL** — text input (`aboutVideoUri`, stored `about_video_uri`; shown at top of About page). Initial value trimmed.
8. **SettingsSection "Location Settings"** (h3, text-xl):
   - **Group Location** — `location` control (LocationInput autocomplete via Mapbox). Selecting sets `edits.location = fullText` and `edits.locationId = id`.
   - **Display location** — label + dropdown (`id='group-settings-location-display-precision-dropdown'`) whose toggle shows the current option and an ArrowDown icon. Options (value → label):
     - `precise` → "Display exact location" (default)
     - `near` → "Display only nearest city and show nearby location on the map"
     - `region` → "Display only nearest city and dont show on the map"
     Under it: Info icon + "Administrators will always see exact location".
     Quirk: the toggle shows the untranslated English label (no `t()`), the menu items are translated.
   - **Define your regional boundary** — text input, placeholder "Paste GeoJSON here or draw on the map below"; value is the GeoJSON geometry string.
   - **Editable map** (275px tall, rounded) — Mapbox draw map centred on the group's location (or the current user's location if the group has none). Drawing a polygon sets `geoShape` to the JSON of the **last** drawn feature's geometry (or `null` if all deleted). A toggle expands the map into a modal (`EditableMapModal`).
9. **SettingsSection "Features"**:
   - Text: "Choose which post types this group accepts. Views for turned-off types are hidden from the group menu."
   - **Post type pills** (toggle chips, no label): Discussions, Events, Resources, Projects, Proposals, Requests & Offers (one pill controls both `request` and `offer`). Stored as `accepted_post_types` jsonb array. If the group has none stored, the UI defaults to all seven types (`discussion, event, resource, project, proposal, request, offer`), meaning a save will persist the full list.
   - **Welcome page switch**: `SwitchStyled` + "Show a welcome page to new members when they first land in the group." — see §5.6. Disabled until the group's views are loaded. When on, a link-style button "Edit Welcome Page Content" (indented) opens the welcome view's settings modal (`GroupViewSettingsModal`), or `AddWelcomeViewDialog` if no welcome view exists.
10. **SettingsSection "Customize group terms"**:
    - "Word used to describe a group Steward" — text; default shown "Moderator" (translated) when empty. Stored `steward_descriptor`.
    - "Plural word used to describe group Stewards" — default "Moderators". Stored `steward_descriptor_plural`.
    Note: when the group never set these, opening and saving Details persists "Moderator"/"Moderators" (the defaults are placed into `edits`). The schema comment claims a default of "Steward"/"Stewards" (Docs vs. code).
11. **SettingsSection "Default notification settings"**: text "When a new member joins this group, their email digest frequency will be set to:" + dropdown (`id='group-settings-default-digest-frequency-dropdown'`) with "Daily" (`daily`, default) and "Weekly" (`weekly`). On join, the new membership's `settings.digestFrequency` is set from this (see [19-notifications-email-push.md](19-notifications-email-push.md)).
12. **SettingsSection "Relevant skills & interests"**: paragraph "What skills and interests are particularly relevant to this group?"; `SkillsSection` (label "Add a relevant skill or interest", placeholder "What skills and interests are most relevant to your group?") — adds/removes group suggested skills **immediately** via its own mutations (not part of Save). Pinned to the bottom of the card, a 40px bar: switch + "Ask new members whether they have these skills and interests?" with an OFF/ON indicator (`showSuggestedSkills`; part of Save).
13. **SaveButton** (§4.4).

### 5.2 Save

"Save Changes" → if `location` changed vs. stored, `ensureLocationIdIfCoordinate` converts a typed coordinate string into a Location id; then `updateGroupSettings(groupId, {...edits, locationId})`. Sent fields: `aboutVideoUri, acceptedPostTypes, avatarUrl, bannerUrl, description, geoShape, location, locationId, stewardDescriptor, stewardDescriptorPlural, name, purpose, settings (whitelisted), websiteUrl`. Unsaved flag cleared.

### 5.3 Server side (`updateGroupSettings` → `updateGroup` → `Group.update`)

- Permission: Administration in the group, else GraphQL error "You don't have the right responsibilities for this group" (missing group: "Group not found").
- Whitelisted columns: `about_video_uri, accepted_post_types, active, access_code, accessibility, avatar_url, banner_url, description, geo_shape, icon, location, location_id, name, purpose, settings, steward_descriptor, steward_descriptor_plural, type_descriptor, type_descriptor_plural, visibility, website_url, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted, paywall`. `name`, `description`, `purpose` trimmed.
- `location_id` explicitly empty → `null`. `geo_shape` non-empty → converted from GeoJSON to geometry; explicitly empty → `null`.
- Validation: name must be non-blank.
- In one transaction also handles (when present in `changes`): `invite_policy`, `agreements`, `group_to_group_join_questions`, `join_questions`, `prerequisite_group_ids`, `group_extensions`, and `settings.show_welcome_page` (see below).
- After save: if `location` changed and no `location_id` was supplied → background job `Group.geocodeLocation`. If a space just turned on `auto_add_members` → job `Group.addEligibleMembersToSpace`. If the group publishes a Murmurations profile → job `Group.publishToMurmurations`.
- Publishes a real-time `groupUpdate` to members (`publishGroupUpdate`).

### 5.4 Location privacy effects

When `locationDisplayPrecision` ≠ `precise`, non-Administrators receive `group.location` as "City, Region, Country" built from the Location object, and the group's map location is obfuscated (`near`) or hidden (`region`). Administrators always get the exact value. See [16-map.md](16-map.md).

### 5.5 Accepted post types effects

Turning a type off hides views for that type from the group menu and post-type choices; see [15-views-streams-spaces.md](15-views-streams-spaces.md) and [13-posts-comments.md](13-posts-comments.md).

### 5.6 Welcome page toggle (saved immediately)

- Displayed state = welcome view exists in the group's views **and** `settings.showWelcomePage !== false`. If the views have loaded and no welcome view exists, local edits force `showWelcomePage: false` so Save does not create one.
- Toggling ON: if no `welcome` view exists → `createGroupView({type:'welcome', addToEnd:true})`; if it exists but is off-menu (`order == null`) → `updateGroupView({addToEnd:true})`. Then, if the stored value differs, `updateGroupSettings({settings:{showWelcomePage:true}})` immediately (no Save needed).
- Toggling OFF: saves `showWelcomePage:false` immediately; the welcome view is left in the menu.
- Server: `settings.show_welcome_page === true` also ensures the welcome view exists / is appended to the menu.
- Who sees the welcome page on first landing: see [09-groups.md](09-groups.md).


## 6. Agreements tab (`settings/agreements`)

Header: "Group Settings > Agreements". Not shown for spaces (spaces inherit the parent's agreements; server also ignores `agreements` changes for spaces).

### 6.1 Layout

Container `flex-col gap-4 p-4 pb-8`, wrapped in a drag-and-drop context (dnd-kit, vertical list).

1. `h1` "Group Agreements".
2. Paragraph (`groupAgreementsDescription`): "Group agreements shape the culture of your group by helping people to understand what's normal and acceptable. Agreements are presented to members when they are joining a group, and for people who already joined but have yet to agree to a new agreement. People are not able to join a group or see content within a group if they have not agreed to all agreements."
3. Accent-coloured warning paragraph with `TriangleAlert` icon (`groupAgreementsWarning`): "When you change your agreements, every member of the group will be notified and asked to re-accept the changed agreements. So be sure you have made all the important changes needed before Saving."
4. List of **agreement cards** (dashed 2px border, rounded, p-4, mb-4). Each card:
   - Top row: left = round dark badge (20×20) with the 1-based index; right = `Trash` icon (delete) and a `Draggable` handle icon (`cursor-grab`).
   - **Agreement** — text input (the title). Placeholder is one random example chosen on each render from:
     - `Example: "I will not spread misinformation"`
     - `Example: "I will only post content relevant to this group"`
     - `Example: "I promise to be kind to other members"`
     - `Example: "I will not troll or be intentionally divisive"`
     - `Example: "I will contribute positive and generative energy to discussions"`
   - **Description** — textarea (min 3 rows), placeholder "Describe the agreement and what the group expects from its members".
5. **Add Agreement** button (full-width outlined, `h4` "Add Agreement" + Circle-Plus icon). Appends `{title:'', description:'', order:n}`.
6. **SaveButton** (§4.4).

### 6.2 Interactions & validation

- Editing a field sets `changed` and re-validates: every agreement title must be ≥ 2 characters, otherwise the SaveButton shows the error "Title needs to be at least two characters long." (repeated once per offending row, joined with " \n") and the Save button does nothing.
- Delete: `window.confirm("Are you sure you want to delete this agreement?")` → removes locally and marks changed.
- Drag a card by its handle to reorder (150ms transition; a drag overlay renders the moving card; the original is hidden while dragging). Reordering marks changed.
- Save: `updateGroupSettings(groupId, { agreements })` with the full ordered array `[{id?, title, description, order}]`. Optimistically the saver's membership gets `agreementsAcceptedAt = now` in the client store.
- When the `group` prop changes (e.g. after save / refetch) local state resets from the server copy.

### 6.3 Server behaviour (`Group.update` with `agreements`)

1. Ignored if the group is a space / has a parent.
2. Agreements with blank (trimmed) title are dropped.
3. For each remaining agreement: find an existing `agreements` row with **exactly** the same trimmed title and description (global table, shared across groups) or create one. Agreement rows are therefore immutable content-addressed records: editing text creates a new agreement id.
4. If the set of agreement ids differs from before (`xor` non-empty — reorder alone does not count) → `settings.agreements_last_updated_at = now()` and the saving user's membership `settings.agreementsAcceptedAt = now()` (so they are not asked to re-accept).
5. All `groups_agreements` rows for the group are deleted and re-inserted with `order` = 1..n in the submitted order.

### 6.4 Effect on members (re-acceptance)

There is no email/notification job; the "notified" in the warning copy is the in-app prompt. On each group load the **Group Welcome modal** (see [10-joining-invitations.md](10-joining-invitations.md)) shows the agreements page when the group has ≥1 agreement and either (a) `membership.settings.agreementsAcceptedAt < group.settings.agreementsLastUpdatedAt`, or (b) the member never accepted and not every current agreement is marked accepted in `users_groups_agreements`. Accepting calls `updateMembership({acceptAgreements:true})` → `GroupMembership.acceptAgreements` (sets `agreementsAcceptedAt`, upserts `users_groups_agreements.accepted = true` for every current group agreement; spaces record acceptance against the parent).

Agreements are also referenced when flagging content — see [12-roles-permissions-moderation.md](12-roles-permissions-moderation.md) §8.

## 7. Responsibilities tab (`settings/responsibilities`)

Header: "Group Settings > Responsibilities". Data: `responsibilities(groupId)` query → platform (`type 'system'`, `group_id NULL`) plus this group's custom ones (`type 'group'`), platform first in fixed order Administration, Add Members, Remove Members, Manage Content, then custom by title. The model is specified in [12-roles-permissions-moderation.md](12-roles-permissions-moderation.md) §3.

Layout:

1. `h2` "Platform Responsibilities".
2. Paragraph (`adminResponsibilitiesHelpText`): "Stewarding a group comes with responsibilities. These ones are built into Hylo and give access to specific functionality related to the platform. They are associated with the Common Roles that all groups start with. By distributing these tasks into separate responsibilities, we can divide the work and make sure responsible people have access to the powers they need."
3. SettingsSection listing each system responsibility as a read-only row (`bg-foreground/5 rounded-lg p-2 mb-2`): bold `h5` title + 50%-opacity description. No buttons.
4. `h2` "Custom Responsibilities" (mt-14).
5. Paragraph (`adminResponsibilitiesCustomHelpText`): "These can be used to denote group responsibilities that members hold outside of Hylo and in real life, like managing equipment, gardens, or childcare. When you add a new responsibility, you can assign that power to specific roles which members of your community can step into."
6. SettingsSection listing custom responsibilities. Each row: **Title** (text input) and **Description** (textarea), then a right-aligned button row:
   - Draft (unsaved) row: "Cancel" (CircleEx icon, accent) and "Create" (Plus icon, selected colour).
   - Saved, unchanged: "Delete" (Trash icon).
   - Saved, edited: "Save" (Unlock icon) and "Revert" (Back icon; restores the values from before the first edit).
7. "Create new responsibility" full-width button (Circle-Plus) — hidden while a draft row exists (only one draft at a time).

Behaviour:

- Create → `addGroupResponsibility(groupId, title, description)`; requires title length ≥ 3, else `window.alert("A responsibility must have a title over three characters long to be saved")`. Update → `updateGroupResponsibility`; invalid title alert: "A responsibility must have at least three characters for its title".
- Server rejects titles equal (case-insensitive, trimmed) to a platform responsibility with "A built-in responsibility already has this title" → client alert "A built-in responsibility already has this name. Please choose another."; any other error → "There was an error, please try again."
- Cancel draft: confirm "Are you sure you want to delete this responsibility?" → removed locally. Delete saved: same confirm → `deleteGroupResponsibility` (row destroyed; join rows in `group_roles_responsibilities` cascade per DB FK).
- Server update keeps old title/description when the new value is empty (`title || old`), so a description cannot be cleared to empty.
- Custom responsibilities grant **no platform permissions**; they are labels attachable to custom roles.

## 8. Roles & Badges tab (`settings/roles`)

Header: "Group Settings > Roles & Badges". Model: [12-roles-permissions-moderation.md](12-roles-permissions-moderation.md) §2. Badge display: [20-members-profiles.md](20-members-profiles.md).

### 8.1 Layout

1. **SettingsSection "Common Roles"** (`h2`) + small text (`adminRolesHelpText`): "Common roles are shared across all Hylo groups and give access to important platform responsibilities." Then one **role card** per system role, sorted Administrator, Moderator, Host.
2. **SettingsSection "Who can add new members?"** (only when `group.invitePolicy` is returned, i.e. viewer has Administration and the group is top-level). Text: "Choose who can invite people to join {{name}}. Roles that include Add Members can always invite." Then an `InvitePolicySelect` (a `SettingSelectRow`: label "Who can add new members?", shows the current option with icon/title/description; clicking opens a popover list of options):
   - `everyone` — icon Users — "Everyone in the Group" — description: if group accessibility ≠ Open: "Every member can invite people. A steward approves each person before they join."; if Open: "Every member can invite people, and the people they invite join right away."
   - `stewards` (default) — icon ShieldCheck — "Stewards with the Add Members responsibility" — "Only roles that include Add Members can invite people: Administrators, Hosts and any custom role you give it."
   Choosing saves **immediately** (`updateGroupSettings({invitePolicy: mode})`), and on success tracks analytics `trackInvitePolicySet(mode, 'settings')`. No save button, no toast.
3. **SettingsSection "Custom Roles & Badges"** (`h3`) + "Create additional roles or badges for your group". One role card per custom role (sorted by id; unsaved last). Then, unless an unsaved draft exists, a dashed tile "Create new role/badge" (h4 + Circle-Plus icon) which appends an empty draft card.

### 8.2 Role card

Card `bg-foreground/5 rounded-lg my-4 pb-2` (`data-testid="role-card-<id|draft>"`). Inactive custom roles get the `inactive` style (faded).

- Top-right action strip (custom roles only):
  - Draft: "Delete" (Trash) → confirm "Are you sure you want to delete this unsaved role/badge?".
  - Saved + edited: "Save" (Unlock) → `updateGroupRole`; "Revert" (Back).
  - Saved + unedited: "Deactivate" (CircleEx) if active / "Reactivate" (CircleArrow) if inactive → confirm "Are you sure you want to deactivate this role/badge?" / "…reactivate this role/badge?" → `updateGroupRole({active: !active})`.
- **Emoji picker** square (40×40, bordered) overlaid at the left of the name input (trigger label "Choose an emoji for this role/badge", `data-testid="role-emoji-trigger"`).
- **Name & Badge** text input (left padding 3.5rem to clear the emoji). Under it for custom roles without emoji: "Click the box to choose an emoji for this role/badge".
- **Description** textarea.
- System roles: all inputs read-only (no `onChange`), emoji picker inert.
- Draft card: a "Create Role" button (bottom right) → validation then `addGroupRole`.
- Saved active roles (and all system roles) show the **RoleList**:
  - "Responsibilities" (h4). System roles: note "Common roles cannot have their responsibilities edited" and rows without remove buttons. Custom roles: rows with an ✕ remove (→ `removeResponsibilityFromRole(roleResponsibilityId)`), plus a "+ Add Responsibility to Role" tile which opens an inline search ("Search here for responsibilities to add to this role", input placeholder "Type...", "Cancel"/"Add" buttons, keyboard-navigable list of available responsibilities not already on the role, Enter chooses, Escape closes) → `addResponsibilityToRole`.
  - "Members" (h4): scrollable list (max-height 560px) of members holding the role, each linking to their profile in this group and with an ✕ to remove the role (`removeRoleFromMember`). Paged: `ROLE_MEMBERS_PAGE_SIZE` per page, more loaded on scroll to bottom.
  - "+ Add Member to Role" tile → inline search: input "Search here for a member to add to this role" (`data-testid="add-member-input"`), "Cancel" and "Add" buttons; typing fetches member suggestions (`fetchStewardSuggestions(groupId, text)`, members of this group), already-holding members filtered out; choose → `addRoleToMember` and the person is appended locally.
- Inactive custom roles show no RoleList (members/responsibilities hidden).

### 8.3 Validation (client)

- Emoji required: "Please choose an emoji for this role/badge by clicking the box next to its name".
- Name length ≥ 3: "A role/badge name must be at least 3 characters long".
Shown via `window.alert`. Server requires `name` and `emoji` on create (else error "Invalid/undefined parameters to create group role…").

After create/update/activate the full settings are refetched. No toast messages.

## 9. Privacy & Access tab (`settings/privacy`)

Header: desktop "Group Settings > Privacy", mobile "Privacy". All sections are `SettingsSection` cards separated by `space-y-8`. One SaveButton at the bottom saves everything (visibility, accessibility, question lists, prerequisites, settings flags) in one `updateGroupSettings`. No unsaved-changes guard.

### 9.1 Visibility

`h3` "Visibility"; "Who is able to see **{name}**?" Three selectable rows (whole row clickable; radio + icon + title + description; selected row `bg-selected/20`, hover `bg-selected/5`), in order:

| Value | Icon | Title | Description |
|---|---|---|---|
| 0 | EyeOff | Hidden | "Only members of this group or direct child groups can see it" |
| 1 | Shield | Protected | "Only members of this group or direct parent or child groups can see this group" |
| 2 | Globe | Public | "Anyone can find and see this group" |

Default when unset: Protected.

### 9.2 Commons request (shown immediately when Public is *selected*, before save)

`CommonsRequestSection`: `h3` "Add my group into the commons", then:
- "The Commons are the public stream of content, public group directory and the public map of Hylo." (`commonsExplainerText1`)
- "To avoid spam and misaligned content, groups must apply for permission to post to public areas. Once approved, your group stewards become responsible for all public content shared that are associated with your group/s" (`commonsExplainerText2`)
- If `group.allowInPublic`: box "This group is already in the Commons." (`data-testid=commons-request-in-commons`).
- Else if the latest request is `pending`: box "Request sent on {{date}}" + "The Hylo team will review it and email you when they've made a decision." (`commons-request-pending`).
- Else:
  - If last request `denied`: box "Your request from {{date}} was not approved", the reviewer's message (pre-wrapped) if any, and "You can send a new request below." (`commons-request-denied`).
  - Label "Tell the Hylo team about your group (optional)", textarea (min-height 80px, maxLength 2000, placeholder "What is your group about, and what will it share in public?").
  - If the group is not yet *saved* as Public: note "You've selected Public. Save your changes first, then you can send your request." (`commons-request-save-first`).
  - Button (secondary) "Request to join the commons" (`commons-request-button`), disabled while submitting or until saved as Public. Success toast "Your request has been sent to the Hylo team" and message cleared; failure toast "Something went wrong sending your request. Please try again."
- Server (`requestPublicListing(groupId, message)`): requires Administration; group must be Public ("Only public groups can be added to the commons"), not already `allow_in_public` ("This group is already in the commons"), and no pending request ("This group already has a pending request"). Stores `settings.public_listing_request = {status:'pending', message (trimmed, ≤2000, or null), requested_at, requested_by_id}` (replacing any previous object). Queues two jobs: `Group.notifyAboutPublicListingRequest` (raw email to `NEW_GROUP_EMAIL`, subject "Commons request: <name>", from "Hylobot", body lists group, URL, requester, message, and link to `/management/site/commons-requests`) and `Group.messageAdminsAboutPublicListingRequest` (one direct message from the Axolotl bot user to all `HYLO_ADMINS`: "<requester> asked to add <group> to the commons.", message, review link). Review: §18.

### 9.3 Access

`h3` "Access"; "How can people become members of **{name}**". Rows:

| Value | Icon | Title | Description |
|---|---|---|---|
| 2 | Globe | Open | "Anyone who can see this group can join it" |
| 1 | Lock | Restricted | "People can apply to join this group and must be approved" |
| 0 | EyeOff | Closed | "This group is invitation only" |

(Rendered in object-key order of `GROUP_ACCESSIBILITY` = Closed, Restricted, Open → actual on-screen order is **Closed, Restricted, Open**.) Similarly Visibility renders Hidden, Protected, Public. Default when unset: Restricted.

### 9.4 Join Questions

`h3` "Join Questions". Row: `h4` "Require people to answer questions when requesting to join this group" + "Ask specific questions to help you evaluate join requests", with a `Switch` on the right (`settings.askJoinQuestions`). When off, the section is 50% opacity and question inputs are disabled.

**QuestionsForm**: a list of text inputs (placeholder "Add a new question") always ending with one empty input. Typing into the last empty input appends a new empty one; clearing an input (to whitespace) removes it; each non-empty input has a ghost ✕ button that clears/removes it. Saved as `joinQuestions: [{text}]` (+ existing `id`/`questionId`). Server: blank questions dropped; each text matched to/creating a global `questions` row; `group_join_questions` for the group replaced wholesale (order = submission order). Answers are shown in Join Requests (§11) and asked in the join flow ([10-joining-invitations.md](10-joining-invitations.md)).

### 9.5 Prerequisite Groups

`h3` "Prerequisite Groups"; paragraph: "When you select a prerequisite group, people must join the prerequisite group before joining this group. **{name}**. Only parent groups can be added as prerequisite groups. [Add parent groups in Related Groups settings]." (link → `settings/relationships`).

- If the group has parent groups: a warning box: "**⚠ Warning:** If you select a prerequisite group that has a visibility setting of **Hidden** or **Protected** only members of those groups will be able to join this group. Because of these settings, people who find your group will not be able to see the prerequisite group." followed by a `GroupsSelector` (multi-select chips of parent groups).
- Else an empty-state box: "{{group.name}} is not a member any groups" and "A parent group is necessary to add as a prerequisite group. You may add parent groups if you are a Host of the group you wish to add, or if the group you wish to add has the Open access setting which allows any group to join it [Related Groups settings]".
- Saved as `prerequisiteGroupIds` → server sets `group_relationships.settings.isPrerequisite` true/false on each parent relationship. Enforcement: `joinGroup` throws "You must be a member of group <name> first" for each unmet prerequisite.

### 9.6 Group Access Questions

`h3` "Group Access Questions"; row `h4` "Require groups to answer questions when requesting to join this group" + "What questions are asked when a group requests to join this group?" with Switch (`settings.askGroupToGroupJoinQuestions`), then a QuestionsForm (stored in `group_to_group_join_questions`). Used by the Related Groups "Request to Join" modal (§12).

### 9.7 Hide {Type} Data (typed groups only)

Shown only when `group.type` is set (e.g. `farm`): `h3` "Hide {{postType}} Data" (startCase type, e.g. "Hide Farm Data"); `h4` "Hide {{postType}} data for this group"; "If you don't want to display the detailed {{postType}} specific data on your group's profile"; Switch → `settings.hideExtensionData`. See [09-groups.md](09-groups.md) (farm profiles).

### 9.8 Publish Murmurations Profile

`h3` "Publish Murmurations Profile"; text (`murmurationsHeader`): "Add your group to the [Murmurations](https://murmurations.network) directory so it can be found and easily added to third-party public maps. You must first set visibility to Public." Row `h4` "Publish to Murmurations" + "Make your group discoverable in the Murmurations network" + Switch (checked only when visibility is Public **and** setting on; disabled unless visibility (selected) is Public). When on and Public: "Your group is now published to the Murmurations directory. You can find your profile [here]." linking `/noo/group/<slug>/murmurations` (new tab). Saving triggers job `Group.publishToMurmurations`. See [24-integrations-api-embeds.md](24-integrations-api-embeds.md).

### 9.9 Save

`updateGroupSettings(groupId, { accessibility, visibility, joinQuestions, groupToGroupJoinQuestions, prerequisiteGroupIds, settings })` (settings whitelisted). Visibility/accessibility changes publish `groupUpdate`. No toast.

## 10. Invitations tab (`settings/invite`)

Header: title "Invite People", icon People. Visible to Add Members holders on non-space groups. The same component is reused in an invite modal (`inModal`, then only *my* pending invites are listed and no header is set) — see [10-joining-invitations.md](10-joining-invitations.md) for invitation semantics, emails, link landing pages and acceptance.

Sections (dashed cards, top to bottom):

1. **Public Group Link** (only non-space groups with visibility Public): `h2` "Public Group Link"; explainer by accessibility — Open: "To see the group and join"; Closed: "To see the group profile. They will not be able to join the group."; Restricted: "To see the group and request to join."; a copy box showing `<origin>/groups/<slug>` (ellipsized from the left, `dir=rtl`) with a chip "Copy" (Copy icon) → "Copied!" for 3s; desktop tooltip "Click to Copy".
2. **View Links** (only when not a space, accessibility Restricted and visibility ≠ Public): `h2` "View Links", explainer "Let someone see the group and request to join."; list of non-granting links; admin-only button "+ Create View Link" (tooltip "These links allow for viewing the group, but still require a request to join.").
3. **Invite Links** (shown unless the group is Open **and** Public): `h2` "Invite Links"; explainer:
   - Space: hidden → "This space is hidden. Anyone with a link can see it and join."; Restricted → "Anyone with a link can join this space without requesting."; Closed → "Anyone with a link can see this space and join."; else "Anyone with a link can join this space."
   - Group Open: Hidden → "This group is hidden. Anyone with an invite link can see it and join."; Protected → "Anyone invited can see the group and join."; else "Anyone with this link can see the group and join."
   - Group Closed: "Grant access to the group."; Restricted: "Grant access to the group without a request."
   List of granting links; admin-only button "+ Create invite link".
   - **Link row**: optional meta line (name in medium weight; "Grants Role(s):" + role pills `emoji name`); a copy box with a leading icon — KeyRound (grants access; tooltip: space "This link will grant access to the space", Restricted group "This link will grant access to the group without requesting to join", else "This link will grant access to the group") or Eye (view only; tooltip "Gives access to view the group, but people still have to request to join.") — URL `<origin>/invite/<code>` (granting) or `<origin>/view/<code>` (view), Copy chip; admin kebab menu (aria "Invite link actions") with "Edit" and "Delete" (red; confirm "Delete this invite link? It will stop working."); below, "{{count}} joined" if `numJoinedUsers > 0`.
   - Whether a link grants access: always for spaces and for Open/Closed groups; for Restricted groups per the link's `grantAccess` flag.
   - **Link editor** (create/edit, inline bordered box): input "Name (optional)"; for granting links and admins: chips of selected roles (each with × aria "Remove {{name}}") and a select "Add a role this link grants" listing active roles not yet chosen; buttons "Save" (green) and "Cancel". New links get a random 10-char alphanumeric `accessCode` client-side. Save → `createGroupInviteLink(groupId, {accessCode, name, grantAccess, grantedRoleIds})` / `updateGroupInviteLink(id, {name, grantAccess, grantedRoleIds})`; delete → `deleteGroupInviteLink(id)` (soft delete). All three require **Administration** server-side.
4. **Invite people on Hylo**: `h2` "Invite people on Hylo"; for role-gated spaces an accent notice "Only members with one of the required roles will actually be able to join the space. [Go to group roles]" (opens `settings/roles` in new tab); helper "Search people you can see on Hylo." (space: "Search members of {{name}} who aren't already in this space."); a `PeopleSelector` (placeholder "Search people..." / "Search members of {{name}}..."). Empty search on a group lists recent contacts (page 20); typing searches inviteable people (page 15, excluding current members); infinite scroll. Already-invited people are filtered out; for role-gated spaces people are split into "Has role" first then "No role".
5. **Send Invites via email** (same card): `h2` "Send Invites via email"; helper (group) "An invitation link will be sent to each email address. They will still be shown any required questions or agreements you may have set to join this group." / (space) "An invitation link will be sent to each email address to join this space. If they are not yet a member of {{name}} they will be asked to join that first."; "Enter up to 10 email addresses at a time, separated by commas or new lines"; auto-growing textarea (placeholder "example@domain.com, secondexample@domain2.us, etc@example.com"; `Name <email>` forms accepted). Admins only: "Assign a role to invitees (optional):" select with "No special role" + active roles (`emoji name`; role-gated spaces: only required roles). If `myInviteAllowance` is a number: "Invites left today: {{remaining}}". Feedback area + green "Send Invite" button (disabled when no emails and no people selected, while sending, or allowance is 0).
   - Send: sandbox mode → toast "Create an account to invite people" with "Sign up" action. >10 recipients (unique emails + selected people) → error "You can invite up to {{max}} people at a time". Otherwise `createInvitation(groupId, {emails, userIds, groupRoleId})`. Result: invalid emails stay in the textarea and error "{{numBad}} invalid email address/es found (see above))."; success "Sent 1 invite" / "Sent {{numGood}} invites"; analytics "Group Invitations Sent". Errors: `invite-limit` → "You don't have enough invites left today for all of these addresses."; other → "Something went wrong. Please try again."
   - Limits (server, `InvitationSend.LIMITS`): 10 per send, 100 addresses per inviter per rolling 24h, 200 per group per 24h. Administrators are exempt only when `groups.lift_admin_invite_limits` is true (no UI sets it).
   - Assigning a role requires Administration ("You don't have permission to invite people with a role").
6. **Pending Invites** (only when any): `h2` "Pending Invites" + "Resend All" button (not in modal; confirm "Are you sure you want to resend all Pending Invitations" → `reinviteAll`). Rows: name + grey email (or email), then `humanDate(lastSentAt)` and " · Invited by {{name}}"; right side chips "Expire" (→ `expireInvitation`) and "Resend" (→ `resendInvitation`; becomes "Sent"). Footer: "{{from}}-{{to}} of {{total}}" and "Load more" (+20) when more.

## 11. Join Requests tab (`settings/requests`)

Header: settings context — desktop "Group Settings > Join Requests", mobile "Join Requests", icon Settings. (The same component is mounted at a space's `/requests` route and from the group-menu "Join Requests" item with UserPlus icon; outside settings it is wrapped in a 750px column.) Visible to Add Members holders.

- Data: `joinRequests(groupId, status: 0)`; store filters `status === 0` (Pending). Server requires Add Members on the group.
- **Pending list**: `h2` "People want to join your group!"; one card per request (`bg-card p-4 rounded-lg`):
  - Avatar (48px, links to profile), name, request time (localized datetime, top right), and either the requester's skills as `#skill` tags or (if none) their location.
  - For each current join question: the question text (h3) and the answer, or *Not answered* (italic, muted). Then answers to questions the group no longer asks.
  - Buttons right-aligned: "Decline" (X icon, accent outline) and "Welcome" (Check icon, selected outline).
- **Empty state**: CircleOff icon (64px), `h2` "No new join requests", "We'll notify you by email when someone wants to join **{name}**".
- Footer (always): "Responses from members who have already joined are available on their member profile" + outline button "View Members" (Users icon) → group (or space) members page.
- Accept → `acceptJoinRequest(id)`: server checks Add Members; `user.joinGroup(group)`; `completeJoinBarriers()` (marks agreements accepted and join questions answered so the welcome modal won't re-ask); status → 1 (Accepted), `processed_by_id`; activity `approvedJoinRequest` to the requester (notification/email, see [19-notifications-email-push.md](19-notifications-email-push.md)); open-request counter −1 and broadcast.
- Decline → `declineJoinRequest(id)`: status → 2 (Rejected); counter −1. No notification to the requester.
- Creation side effects (for context): `JoinRequest.afterCreate` notifies everyone holding Add Members in the group (or in the parent, for spaces) with reason `joinRequest`, and increments `groups.num_open_join_requests` (drives the menu badge).

## 12. Related Groups tab (`settings/relationships`)

Header: mobile "Group Settings > Related Groups", desktop "Related Groups". Concepts (parent/child/peer, visibility through relationships): [09-groups.md](09-groups.md). Bottom padding 200px.

### 12.1 "Add Group Relationships"

`text-2xl` heading, then three full-width outline buttons (h-12), each toggling a dropdown (max height 150px / 300px on ≥sm) listing **every group the current user is a member of** that is not this group and not already related, sorted by name. Each row shows the group name and a pill depending on whether the user has Administration in that other group:

| Button (icon) | Pill (admin of other / not) | Action |
|---|---|---|
| "Join Parent Groups" (HierarchyUpward) | "Join" / "Request" | `requestToAddGroupToParent(parentId, childId)`; if the target parent has `askGroupToGroupJoinQuestions` on and questions defined → opens the **Request to Join modal** first |
| "Add Child Groups" (HierarchyDownward) | "Add as Child" / "Invite as Child" | `inviteGroupToJoinParent(parentId=this, childId)` |
| "Add Peer Groups" (Handshake) | "Add as Peer" / "Invite as Peer" | selecting expands an inline form: label "Description: optional", textarea placeholder "Describe the purpose of this peer relationship...", "Cancel" and submit "Add Peer Group" / "Send Invite" → `invitePeerRelationship(fromGroupId, toGroupId, description)` |

Opening one picker closes the others (child/peer). Server: if the user has Administration in **both** groups the relationship is created immediately; otherwise a `GroupRelationshipInvite` (type 0 ParentToChild, 1 ChildToParent, 2 PeerToPeer; status 0 Pending) is created and the target group's moderators are notified (reasons `GroupChildGroupInvite`, `GroupParentGroupJoinRequest`, `GroupPeerGroupInvite`). Errors: "Groups are already related", "Invalid group relationship type", "Cannot create peer relationship between the same group". A pending invite for the same pair returns `success:false` with the existing invite.

**Request to Join modal**: overlay `bg-darkening/70`, card max-width 480px; close ✕; "You are requesting that **{group}** become a member of **{parent}**"; two 120×100 tiles (banner background, 50px avatar, name) with a Handshake icon between; "{{parentGroup.name}} requires groups to answer the following questions before joining"; a textarea per question (placeholder "Type your answer here..."); button "Request to Join".

### 12.2 Lists

- **Parent Groups** (`text-2xl`): "{{group.name}} is a member of {{length}} group(s)" then GroupCards; empty "{{group.name}} is not a member of any groups yet". Card kebab menu:
  - "Convert to Space of {{parentName}}" (LayoutGrid icon; only for non-typed, non-space groups with ≥1 parent) — enabled only when the group has exactly one parent, no child/peer groups, and no spaces of its own; otherwise disabled with tooltip: "This group cannot be converted to a space because it has other related groups and spaces of its own." / "…because it has other related groups. A group can only become a space if it has exactly one parent and no child or peer groups." / "Convert the chat rooms below into discussion posts first." / "…because it has spaces of its own." Confirm: "Are you sure you want to convert {{groupName}} to a space of {{parentName}}? If it has a menu item in {{parentName}} that item will become a space; otherwise it will appear in More Spaces." → `convertGroupToSpace` (see [15-views-streams-spaces.md](15-views-streams-spaces.md)).
  - "Leave Parent" (red; confirm "Are you sure you want to leave {{groupName}}") → `deleteGroupRelationship(parentId, childId)`.
  - If chat-only rooms block conversion: box "This group has chat rooms that must be converted before it can become a space." listing rooms with "Convert to discussion" links (opens `ConvertChatSpaceModal`).
- "Open Invitations to Join Other Groups" (invites from parents to us): cards with ✕ (reject) and ♥ "Join" (accept).
- "Pending requests to join other groups": cards with "Cancel Request".
- **Child Groups**: "This group is a member" (1) / "These {{childGroups.length}} groups are members of {{group.name}}"; empty "No groups are members of {{group.name}} yet". Kebab: "Remove Child" (confirm "Are you sure you want to remove {{groupName}}").
- "Requests to join {{group.name}}": cards with ✕ and ♥ "Approve"; when this group asks group questions, the card shows each question and the answer (or *Not answered*).
- "Pending invites to join {{group.name}}": "Cancel Invite".
- **Peer Groups**: "{{group.name}} has {{length}} peer group(s)"; empty: "{{group.name}} has no peer groups yet. Peer group relationships allow groups to define their relationships outside of a hierarchical structure." Kebab: "Remove Peer Relationship" (confirm "Are you sure you want to remove the peer relationship with {{groupName}}?").
- "Peer Group Invitations" + "Groups that want to form a peer relationship with {{group.name}}": ✕ / ♥ "Accept".
- "Pending Peer Group Invitations" + "Peer relationship invitations sent by {{group.name}}": "Cancel Invite".

**GroupCard**: row `p-4 bg-foreground/5 rounded-lg`, 30px square avatar, name linking to the group, a DollarSign icon with tooltip "This group requires payment to join" when `paywall`, actions on the right.

Server permissions: accept/reject require Administration in the invite's *to* group; cancel requires Administration in the *from* group; delete relationship requires Administration in either group (soft: `active=false`; publishes `relationship_removed`). Accepting queues `createAcceptNotifications` (parent/child: all members of both groups — stewards only for a hidden group's side; peer: stewards of both).

## 13. Paid Content tab (`settings/paid-content/*`)

Fully specified in [23-paid-content-stripe.md](23-paid-content-stripe.md). Shell:

- Sub-tab bar (centred pill links): "Payments Account" (`''`, default; mobile "Account"), "Paid Offerings" (`offerings`; mobile "Offerings"), "Paid Content Access" (`content-access`; mobile "Content Access"). Active pill uses `bg-selected`.
- "BETA" amber pill + italic note "We are testing paid content functionality during this beta phase. Features may change and you may encounter issues as we refine the experience."
- Heading per sub-tab: "Accept Payments for {{groupName}}" / "Setup Paid Content Offerings" / "Manage Paid Content Access", with explanatory paragraphs; on Account, until charges and payouts are enabled, an amber note about Stripe verification time.
- `?onboarding=complete` on return from Stripe triggers an automatic status check.

## 14. Import Posts by CSV (`settings/import`) — hidden/legacy

Not in any navigation; reachable by URL for Administrators. Header "Group Settings > Import Posts by CSV". Content: title "Import Posts by CSV"; bold "WARNING: This is a beta feature that at this time will not inform you of import errors, use at your own risk."; "You can select a CSV file to import posts into {{name}}. Posts will be created by you. The file must have columns with the following headers:" and the list:
- `title: text`; `description: text`; `location: text`; `type: one of discussion, request, offer, resource, event, project`; `start_date (optional): e.g. 20200730-12:23:12.000+00 (other date formats may work)`; `end_date (optional): …`; `image_urls: 1 or more image URLs separated by spaces and/or commas`; `topics: up to 3 topic names separated by spaces and/or commas e.g. “food organic”`; `is_public: true or false`.
Button "Upload CSV" (upload type `importPosts`, CSV) → the uploader streams the file into `createPostImporter(userId, groupId)` and resolves once parsed (posts are created asynchronously); client alert "Import started!".

## 15. Export Data tab (`settings/export`)

Header: desktop "Group Settings > Export Data", mobile "Export Data". Content: `h2` "Export Data"; "This function exports all member data for this group as a CSV file for import into other software."; status line; outline button "Export Members" (FileDown icon), disabled after click.

- Click → `GET /noo/export/group?groupId=<id>&datasets[]=members` (session cookie). 200 → status "You should receive an email with the member export in a few minutes"; otherwise "Oh no, something went wrong! Check your internet connection and try again" and the button re-enables.
- Server (`ExportController.groupData`): 400 if no groupId/datasets; 403 `{error:'No access'}` unless Administration; queues `ExportService.exportMembers({groupId, userId, email})`.
- CSV columns in order: `id, name, joined_at, roles, contact_email, contact_phone, location, avatar_url, tagline, bio, personal_url, twitter_name, facebook_url, linkedin_url, skills, skills_to_learn, affiliations, groups, last_active_at`, then one column per join question text (answer or `-`). Formats: dates `yyyy-MM-dd HH:mm:ss Z`; `roles` = comma-joined active group role names; `location` = `full_text (lat,lng)` 3 decimals; affiliations `role preposition org (url)`; `groups` = other groups of the member visible to the requester as `Name (url)`; `last_active_at` from membership `lastReadAt`.
- Delivered by email (`Email.sendExportMembersList`) to the requester's account email with attachment `members-export-<groupName>-<YYYY-MM-DD>.csv`.

## 16. Appearance & Layout tab (`settings/appearance`)

Header "Group Settings > Appearance & Layout" (no icon, search hidden). Content (`p-4`): "Customize how this group is displayed to members."; label "Layout"; two selectable cards (grid 1 col, 2 cols ≥md, max-width 500px):
- "Two Column" (Columns2 icon) — "Sidebar menu with content pane" → `two-column` (default).
- "One Column" (LayoutGrid icon) — "Full-width dashboard with cards" → `one-column`.
Selected card: `border-selected bg-selected/10`. SaveButton appears when the selection differs from stored; Save → `updateGroupSettings({settings:{layout}})`. Members may override per-user via `user.settings.groupNavStyle` (see [06-app-shell-navigation.md](06-app-shell-navigation.md), [05-user-settings.md](05-user-settings.md)).

## 17. Delete tab (`settings/delete`)

Header: desktop "Group Settings > Delete Group", mobile "Delete Group". Content: `h2` "Delete {{groupName}}"; "If you delete this group, it will no longer be visible to you or any of the members. All posts will also be deleted."; destructive button "⚠ Delete Group ⚠" (TriangleAlert icons both sides; 50% opacity until hover).

- Click → `window.confirm("Are you sure you want to delete the group {{name}}? This will permanently delete the group and all of its content. This cannot be undone.")` → `deleteGroup(id)` (optimistic). On success: legacy mobile WebView receives message `GROUP_DELETED {groupSlug, groupId}`; browser hard-navigates to `/all` (All My Groups).
- Server: requires Administration; `Group.deactivate` sets `groups.active = false` and removes **all members** (`removeMembers`). Posts are not hard-deleted (they become unreachable because the group is inactive) — the copy "All posts will also be deleted"/"permanently" overstates it.

## 18. Platform Management area (`/management/*`, Hylo admins)

Not part of group settings but the counterpart for commons requests. Route `/management/*` (authenticated layout; no client-side route guard — the entry "Management" appears in the global-nav user menu only when `currentUser.isAdmin`; every backend call checks `Admin.isSuperAdmin`, i.e. user id in env `HYLO_ADMINS`).

- Left menu (250/300px) with dark header "Management" and sections: **SITE** — "Banners" (`/management/site/banners`), "Commons Requests" (`/management/site/commons-requests`); **STAGING** — "Email Testers" (`/management/staging/email-testers`, default redirect); **PAID CONTENT** — "Disputes & Refunds" (`/management/paid-content/stripe-analytics`). Site banners: [06-app-shell-navigation.md](06-app-shell-navigation.md); Stripe analytics: [23-paid-content-stripe.md](23-paid-content-stripe.md); Email testers: [24-integrations-api-embeds.md](24-integrations-api-embeds.md).
- **Commons Requests** page (max-w-4xl, p-6): `h1` "Commons Requests"; "Groups asking to be added to the commons: the public stream, Group Explorer and public map. Approving or denying emails the person who asked."; status filter tabs Pending (default) / Approved / Denied / All; empty "No requests."; each request shows group, status pill (pending accent, approved selected, denied muted), "Requested {{date}} · by {{name}} · {{count}} members", the requester's message, "Reviewed {{date}} · by {{name}}" when reviewed; for pending: textarea "Message to the requester (optional), included in the email" and buttons "Approve" / "Deny". Toasts "{{name}} was added to the commons" / "{{name}} was not added to the commons" / "Something went wrong saving the decision".
- `reviewPublicListingRequest(groupId, approved, message)`: super-admin only ("Unauthorized: Admin access required"); must be pending ("This group has no pending request"); sets status approved/denied with `reviewed_at`, `reviewed_by_id`, `review_message`; approval also sets `groups.allow_in_public = true`. Queues `Group.sendPublicListingDecision` → raw email to the requester in their locale: subject "Your group {name} has been added to the commons" / "Update on your request to add {name} to the commons"; body "Good news! {name} has been added to the commons. Your group now appears in the public Group Explorer and on the public map, and members can share posts to the public stream." / "Thanks for asking to add {name} to the commons. After reviewing your request, the Hylo team has decided not to add it at this time. Your group is unchanged, and you can submit a new request from your group's Privacy & Access settings."; optional "A note from the Hylo team:" + message; link `<group settings>/privacy`; sender "The Team at Hylo".
