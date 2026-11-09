# 05 — User settings

## 1. Overview

User settings are the logged‑in user's personal configuration pages, reached from **My Home** (`/my/...`) and the global‑nav avatar menu. They are rendered by one route component, `UserSettings`, which hosts a set of tabs (each tab is its own URL; there is no visible tab strip — navigation between them is the My Home context menu, see [06-app-shell-navigation.md](06-app-shell-navigation.md)).

Tabs:

| Tab | Path | Purpose |
|---|---|---|
| Edit Profile | `/my/edit-profile` | Name, avatar/banner, tagline, bio, location, website, skills, contact info, social links, affiliations, public‑profile toggle |
| Groups | `/my/groups` | List of my groups & spaces, leave group/space |
| Invites & Requests | `/my/invitations` | Pending invitations (groups/spaces), my join requests, declined requests |
| Language | `/my/locale` | UI language |
| Appearance | `/my/appearance` | Color mode, nav style, stacking, group menu style, color theme |
| Notifications | `/my/notifications` | DM / comment channels, unified digest, all‑groups defaults, per‑group & per‑space settings |
| Account | `/my/account` | Login email change (verified), password, export data, deactivate, delete, cookie preferences |
| Saved Searches | `/my/saved-searches` | Map saved searches: open, delete |
| Blocked Users | `/my/blocked-users` | Unblock users |
| Payment | `/my/payment` | Legacy Stripe Connect for project contributions — **feature‑flagged** (`PROJECT_CONTRIBUTIONS`) |

Paid content / group Stripe accounts / transactions are in [23-paid-content-stripe.md](23-paid-content-stripe.md); notification *delivery* in [19-notifications-email-push.md](19-notifications-email-push.md); the public profile page in [20-members-profiles.md](20-members-profiles.md); blocking semantics in [12-roles-permissions-moderation.md](12-roles-permissions-moderation.md); map saved‑search creation in [16-map.md](16-map.md).

---

## 2. Concepts & data

### 2.1 User fields edited here (`users` table → GraphQL `Me`)

| DB column | GraphQL (`MeInput`) | Edited in | Notes |
|---|---|---|---|
| `name` | `name` | Edit Profile | Trimmed server‑side; must be non‑blank (`Validators.validateUser.name`); UI maxLength 60 |
| `avatar_url` | `avatarUrl` | Edit Profile, Welcome wizard | Upload type `userAvatar`; default gravatar `https://www.gravatar.com/avatar/<md5>?d=mm&s=140` |
| `banner_url` | `bannerUrl` | Edit Profile | Upload type `userBanner`; client default `DEFAULT_BANNER` (`store/models/Me`) |
| `tagline` | `tagline` | Edit Profile | UI maxLength 60 |
| `bio` | `bio` | Edit Profile | Textarea, no limit in UI |
| `location`, `location_id` | `location`, `locationId` | Edit Profile | Free text + geocoded `locations` row |
| `url` | `url` | Edit Profile | `https://` prepended server‑side if no protocol |
| `contact_email`, `contact_phone` | `contactEmail`, `contactPhone` | Edit Profile | Shown on profile; not validated |
| `facebook_url`, `linkedin_url` | `facebookUrl`, `linkedinUrl` | Edit Profile | `https://` prepended if missing |
| `twitter_name` | `twitterName` | Edit Profile | Leading `@` stripped; whitespace‑only → null |
| `is_profile_public` | `isProfilePublic` | Edit Profile | Saved immediately on toggle |
| `email` | `email` | Account | Change is two‑step (pending until verified) |
| password (in `linked_account`) | `password` | Account | bcrypt; ≥ 9 chars, not whitespace‑only |
| `settings` jsonb | `settings: UserSettingsInput` | many | camelCase in GraphQL, converted to snake_case keys in DB (`convertGraphqlData`) |
| `calendar_token` | — | (Notifications/events) | Generated when `rsvpCalendarSub` turned on |

Server whitelist (`User.validateAndSave`): `avatar_url, banner_url, bio, contact_email, contact_phone, extra_info, facebook_url, intention, is_profile_public, linkedin_url, location, location_id, name, password, settings, tagline, twitter_name, url, work, new_notification_count, calendar_token`. `settings` is merged (`addSetting`) into existing settings, not replaced.

### 2.2 User `settings` keys relevant here

| GraphQL key | DB key | Values | Default |
|---|---|---|---|
| `dmNotifications` | `dm_notifications` | `none` \| `email` \| `push` \| `both` | `both` (set on create) |
| `commentNotifications` | `comment_notifications` | same | `both` |
| `unifiedEmailDigest` | `unified_email_digest` | bool | false/unset |
| `digestFrequency` (legacy user‑level; only via unsubscribe page) | `digest_frequency` | `daily` \| `weekly` \| `never` | reads as `daily` |
| `postNotifications` (legacy user‑level) | `post_notifications` | `none` \| `important` \| `all` | reads as `important` |
| `locale` | `locale` | `en-US`, `en-GB`, `es-ES`, `de-DE`, `fr-FR`, `hi-IN`, `pt-BR` | `en-US` |
| `colorScheme` | `color_scheme` | `auto` \| `light` \| `dark` | `auto` |
| `theme` | `theme` | `default`, `forest`, `ocean`, `desert`, `snow`, `jungle`, `blossom`, `fall`, `stone` | `default` |
| `globalNavStyle` | `global_nav_style` | `sidebar` \| `tabs` | `sidebar` |
| `stackGroups` | `stack_groups` | bool | false (flat) |
| `groupNavStyle` | `group_nav_style` | `group-default` \| `two-column` \| `one-column` | `group-default` |
| `rsvpCalendarSub` | `rsvp_calendar_sub` | bool | — (events module 14) |
| `signupInProgress` | `signup_in_progress` | bool | true on create (module 04) |
| — | `pending_email` | `{ email, code_hash (sha256 hex), requested_at (ISO) }` | absent |

Other settings (`alreadySeenTour`, `toursSeen`, `lastViewedMessagesAt`, `mapBaseLayer`, `streamViewMode`, `streamSortBy`, `streamPostType`, `streamChildPosts`, `independentSpaceMenu`) are written elsewhere.

### 2.3 Group membership notification settings (`group_memberships.settings` jsonb)

| Key | Values | Default on join (`User.joinGroup`) |
|---|---|---|
| `sendEmail` | bool | `true` |
| `sendPushNotifications` | bool | `true` |
| `postNotifications` | `none` \| `important` \| `all` (also controls the hourly chat digest) | `all` |
| `digestFrequency` | `daily` \| `weekly` \| `never` | group setting `default_digest_frequency` if `weekly`, else `daily` |

### 2.4 Other entities

- **Affiliation** (`user_affiliations`): `id`, `user_id`, `role`, `preposition`, `org_name`, `url`, `created_at`, `updated_at`, `is_active`.
- **BlockedUser** (`blocked_users`): `user_id`, `blocked_user_id`. Cannot block self or the Hylo Axolotl (user id `13986`).
- **SavedSearch** (`saved_searches`): `id`, `name`, `user_id`, `context` (`groups`|`all`|`public`), `group_id`, `search_text`, `post_types`, `bounding_box`, `topics`, `is_active`, `created_at`. Delete is a soft delete.
- **Invitation** / **JoinRequest**: see [10](10-joining-invitations.md). JoinRequest status: `0` Pending, `1` Accepted, `2` Rejected, `3` Canceled (`JOIN_REQUEST_STATUS`).
- **CookieConsent**: see [04](04-accounts-auth-onboarding.md) §5.10.

---

## 3. Routes / entry points

`AuthLayoutRouter`:

```
my/posts/*, my/drafts/*, my/interactions/*, my/announcements/*, my/mentions/*,
my/saved-posts/*, my/tracks/*, my/funding-rounds/*, my/transactions   -> content views (modules 13, 15, 21, 22, 23)
my/*        -> UserSettings
my          -> card‑menu users: ContextMenuGrid (context 'my'); else redirect /my/posts
settings/*  -> UserSettings   (legacy paths kept for old mobile apps, e.g. /settings/payment)
notifications -> redirect /my/notifications
```

`UserSettings` renders the tab whose `path` matches the remainder (`edit-profile`, `groups`, `invitations`, `locale`, `appearance`, `notifications`, `account`, `saved-searches`, `blocked-users`, `payment`). An unknown sub‑path renders nothing (empty content area). `currentUserSettingsUrl(view='edit-profile')` in `@hylo/navigation` builds `/my/<view>`.

Query params: `/my/notifications?group=<groupId>` (scroll to & expand a group row — used by email/notification links), `/my/account?emailChangeToken=<jwt>` (email change verification link), `/settings/payment?registered=success|error` (Stripe return).

### 3.1 Entry points in the UI

- **My Home context menu** (static `MY_CONTEXT_VIEWS`), section "Myself" (`view-myself`): My Profile (link to `/members/<id>`, User icon), Edit Profile (Edit), My Groups (Users), My Invites (Mail), My Transactions (CreditCard), Notifications (Bell), Appearance (Palette), Language/Locale (Languages), Blocked Users (UserX), Saved Searches (Search), Account (Shield), Logout (LogOut). Payment is not in the menu.
- **Global‑nav avatar dropdown**: "Logout {email}", View Profile, Edit Profile, My Groups, My Invites, Notifications, Appearance submenu (Color Mode: System/Light/Dark; Color Theme; Global Navigation: Sidebar/Topbar; Group Nav Stacking: Flat/Stacked; Group Menu Style: Group Default/Side Menu/Card Menu), Language submenu, Blocked Users, Saved Searches, Account Settings. These submenus write the same settings as the Appearance/Language tabs.
- Welcome wizard final card "Complete your profile" → `/my/edit-profile`.
- Email footers "notification settings" → `/notifications?...token` (logged out page in 04; logged‑in redirect to `/my/notifications`).

---

## 4. UX specification

### 4.0 Shared shell

- `UserSettings` dispatches `fetchUserSettings()` on mount (`me { id email pendingEmail rsvpCalendarUrl affiliations { items {id role preposition orgName url createdAt updatedAt isActive} } blockedUsers { id name } memberships { id group { id name } } }`). Memberships list for the Notifications tab is sorted by group name (`localeCompare`).
- Renders nothing while `me` is absent (e.g. during logout).
- Content is placed in `FullPageModal` (multi‑tab form): `bg-midground` scrollable column; inner container `w-full mx-auto px-2 py-2 sm:px-8 sm:py-8`, `max-w-[750px]` unless global nav style is `tabs` (then full width). In the legacy (pre‑v2) mobile WebView: `bg-background p-10` with no nav.
- Each tab sets the view header (title bar) via `useViewHeader().setHeaderDetails({title, icon, info, search})` — titles listed per tab.
- "Unsaved changes" guard: tabs call `setConfirm(message)` → `FullPageModal.confirm` state; navigation away prompts "You have unsaved changes, are you sure you want to leave?".
- Toasts use `sonner` (bottom‑left on desktop offset 80px, top‑center on compact layouts).

### 4.1 Edit Profile (`/my/edit-profile`)

Header title "Edit Your Profile"; `<title>` "Edit Your Profile | Hylo". Container `max-w-3xl mx-auto px-4 py-6`, vertical spacing 24px. Shows a spinner while `fetchUserSettings` is pending.

Local state `edits` initialised from `me` (and re‑initialised when the fetch completes): name, avatarUrl, bannerUrl (default banner), tagline, bio, contactPhone, contactEmail, location, locationId, url, facebookUrl, twitterName, linkedinUrl, isProfilePublic.

Layout top → bottom:

1. Label "Banner and Avatar Images" (sm, 50% foreground).
   - **Banner**: full width, height 20vh, rounded‑lg, shadow, background image cover/center; 20% dark overlay (60% on hover); centered `ImageUp` icon 32px (white 60% → 100% on hover); whole banner scales to 105% on hover; click opens file upload (`UploadAttachmentButton type='userBanner' id=<userId>`). On upload success sets `bannerUrl` (marks changed).
   - **Avatar**: 80×80 rounded‑lg square overlapping the banner bottom edge (absolute, `-bottom-10`, horizontally centered), same overlay and a 24px `ImageUp` icon; upload type `userAvatar`.
2. (margin‑top 48px) Fields (`SettingsControl`: label above an input):
   - "Name" (maxLength 60). If blank/whitespace: red text "Name must not be blank".
   - "Tagline" (maxLength 60).
   - "About Me" (textarea).
   - "Location" (`type='location'`: Mapbox autocomplete `LocationInput`). On change: `location = fullText`; `locationId` = selected id, or for raw coordinates geocoded via `ensureLocationIdIfCoordinate`.
   - "Website".
3. Top‑bordered section "My Skills & Interests" → `SkillsSection` (add/remove skill chips; mutations `addSkill`/`removeSkill`, saved immediately — see 20).
4. Section "What I'm learning" → `SkillsToLearnSection` (`addSkillToLearn`/`removeSkillToLearn`, immediate).
5. Section: "Contact Email", "Contact Phone".
6. Section "Social Accounts": three `SocialControl` cards (Facebook, Twitter, LinkedIn):
   - Card: provider brand icon (SimpleIcon 20px), name, linked value (xs, truncated 200px), status pill — linked: check icon + "Linked" (`text-selected bg-selected/10`); unlinked: `Link2Off` + "Not Linked" (`bg-darkening/20`).
   - Right button (outline, small) **visible only on card hover**: "Link" (link icon) or "Unlink" (unlink icon).
   - Link: Twitter → `window.prompt("Please enter your twitter name.")`; Facebook/LinkedIn → `window.prompt("Please enter the full url for your {{network}} page.")` (network "Facebook"/"LinkedIn"). The value is put into edits (needs Save).
   - Unlink: immediately calls `unlinkAccount(provider)` mutation (deletes `linked_account` rows for that provider and nulls `facebook_url`/`linkedin_url`/`twitter_name`) and sets edit value to null.
7. Section heading "Other Affiliations" (xl bold):
   - Message banner (click to dismiss): success (`bg-selected`) "Your affiliation was added" / "Your affiliation was deleted"; error (`bg-destructive`) raw error or "Error deleting this affiliation.".
   - Each affiliation row (40px tall, rounded, `bg-darkening/10`, hover scale): "{role} {preposition} {orgName}" — orgName links to `url` in a new tab if present — and a "Delete" link → `window.confirm("Are you sure you want to delete your affiliation as {{role}} {{preposition}} {{orgName}}?")` → `deleteAffiliation(id)`.
   - Empty: "Add your affiliations".
   - "+ Add new affiliation" card (green circle with +) toggles the **AddAffiliation** form: header "Add new affiliation" with × close; input "Name of role" (max 30 chars, counter "n/30" top‑right); preposition dropdown (`of` / `at` / `for`, default `of`, with ArrowDown icon); input "Name of organization" (max 30, counter); input "URL of organization" which always displays a fixed `https://` prefix (the typed text after it is kept); button **Add Affiliation** enabled when role and org are non‑empty.
   - Affiliations save immediately (not part of Save Changes).
8. Public profile card (bordered, rounded, flex): title "Make my profile public"; text "When enabled, anyone with the link can view your profile without logging in to Hylo."; when on, extra xs line "Shareable link: {origin}/members/{id}"; Switch on the right. Toggling immediately calls `updateMe({ isProfilePublic })` (not part of Save).
9. **Save bar** (desktop ≥ lg only): sticky bottom, translucent blurred background, top border, rounded, shadow: left status text — "Changes not saved" (accent) when changed, else "Current settings up to date" (50% foreground); right button **Save Changes** (`highVisibility` when savable, else outline/disabled). Savable = something changed and name valid.
   - On phones/tablets (≤1023px) the save button is instead placed in the view header as **Save**.

Save: clears changed/confirm, sends `updateMe(changes)` with all profile edits except `isProfilePublic` (optimistic update). Toast success "Your changes have been saved" or error "There was a problem saving your changes".

### 4.2 Groups (`/my/groups`)

Header title "My Groups". Container `p-4 max-w-4xl mx-auto`.

- Intro: "This list shows which groups on Hylo you are a part of."
- H2 "Hylo Groups".
- Feedback banner after leaving (click to dismiss): "You left {{group_name}}" (green) or "Error leaving {{group_name}}" (red).
- List from `getMyGroupsWithChildren`: top‑level group memberships sorted (`sortGroups`), each followed by its **space** memberships (sorted by name) indented (`ml-4 sm:ml-8`). If the user belongs to spaces of a group they're not a member of, that parent appears as a plain H3 heading (no card, no leave button) with its spaces below.
- Each row: `GroupCard` (avatar, name, description etc., marked as member; spaces link to `spaceHomeUrl(parentSlug, space)`) + a leave panel (right on ≥sm, below on phones; `bg-darkening/20`): outline button with large Trash icon and "Leave Group" / "Leave Space" (accent colors).
- Leave → Dialog: title "Leave Group"/"Leave Space"; description "Are you sure you want to leave {{group_name}}? You will no longer have access to this group's content."; buttons **Cancel** (outline) and **Leave Group/Space** (destructive). Confirm → `mutation leaveGroup(id)`; on success remove the row (and parent headings left with no spaces). Legacy WebView receives `LEFT_GROUP {groupId}`.
- Server: `user.leaveGroup(group)` → `group.removeMembers([userId])`, then job `User.afterLeaveGroup` (Zapier `member_leaves` triggers). Leave semantics/restrictions: [10](10-joining-invitations.md).

Note: despite the docs/menu naming "Groups & Affiliations", affiliations are edited in Edit Profile; the Groups tab has only groups.

### 4.3 Invites & Requests (`/my/invitations`)

Header title "Group Invitations & Join Requests" (with search). Fetches `fetchMyInvitesAndRequestsQuery` on mount (spinner while loading).

- Intro: "This list contains all open requests and invitations to join groups. To view all groups you are a part of go to your [Groups & Affiliations]." (link → `/my/groups`).
- Five sections, each H2 + list, with an empty state box (2px border, `CircleOff` icon 64px, muted text):

| Section | Content | Empty text |
|---|---|---|
| "Invitations to Join New Groups" | pending invitations for non‑space groups | "No active invitations to join new groups" |
| "Invitations to Join Spaces" | pending invitations for spaces | "No active invitations to join spaces" |
| "Your Open Requests to Join Groups" | my pending join requests, non‑space | "No active requests to join groups" |
| "Your Open Requests to Join Spaces" | pending join requests to spaces | "No active requests to join spaces" |
| "Declined Invitations & Requests" | my join requests with status Rejected (non‑space) | "You have not declined any invitations or requests" |

- **Invitation card** (`bg-card rounded-lg p-4 shadow-lg`): "[Creator name](→ profile) invited you to join", `GroupButton` (group avatar + name), footer (top border): "Sent {short date}"; buttons **Decline** (accent outline) and **Join group** / **Join Space** (selected outline).
  - Decline → confirm "Are you sure you want to decline the invitation to join {{groupName}}?" → `mutation expireInvitation(invitationId)`; removed locally.
  - Join → if the invite is for a space whose parent the user isn't a member of: navigate `/groups/<parentSlug>/about?token=<token>` (join parent first). Else `useInvitation(invitationToken)`; on membership → Mixpanel `Group Invitation Accepted`; navigate to the space home or group home.
- **Join request card**: `GroupButton`, footer "You requested to join {short date}" and, by status: Pending → **Cancel Request** (confirm "Are you sure you want to cancel your request to join {{groupName}}?" → `cancelJoinRequest(joinRequestId)`, Mixpanel `Join Request Canceled`); Rejected → red "Declined"; Canceled → muted "Canceled".

### 4.4 Language (`/my/locale`)

Header title "Language Settings". Text "Select your preferred language for the Hylo interface", then a dropdown whose toggle shows "{flag} {language word} ▾". Options (in order): 🇺🇸 English (`en-US`), 🇬🇧 English (UK) (`en-GB`), 🇪🇸 Spanish (`es-ES`), 🇩🇪 German (`de-DE`), 🇫🇷 French (`fr-FR`), 🇮🇳 Hindi (`hi-IN`), 🇵🇹 Portuguese (`pt-BR`).

Selecting: `i18n.changeLanguage(locale)` immediately; if logged in `updateMe({settings:{locale}})`, then store in localStorage (`getLocaleFromLocalStorage(locale)` writes it). Logged out (auth pages) only localStorage. The user's locale also selects the language of server emails. On app load `AuthLayoutRouter` syncs `me.settings.locale` into localStorage.

### 4.5 Appearance (`/my/appearance`)

Header title "Appearance Settings". Intro "Customize the look and feel of Hylo by choosing your preferred color mode and color theme."

Rows (label left, segmented control right: 2px `foreground/20` rounded border, p‑1; active segment `bg-selected text-selected-foreground`, inactive hover `bg-muted`). Every click saves immediately via `updateMe({ settings: {...} })`:

| Label | Segments (icon + text) | Setting |
|---|---|---|
| "Color Mode" | Monitor (aria "Auto"), Sun ("Light Mode"), Moon ("Dark Mode") — icons only | `colorScheme`: `auto`/`light`/`dark` |
| "Global Navigation" | PanelLeft "Sidebar", AppWindow "Topbar" | `globalNavStyle`: `sidebar`/`tabs` |
| "Group Nav Stacking" | List "Flat" (title "Show every group as its own item"), Layers "Stacked" ("Show subgroups stacked on their parent group") | `stackGroups`: false/true |
| "Group Menu Style" | LayoutPanelTop "Group Default" ("Use each group layout setting"), Columns2 "Side Menu" ("Always show the side menu beside the view"), LayoutGrid "Card Menu" ("Always use the full-screen card menu") | `groupNavStyle`: `group-default`/`two-column`/`one-column` |

"Color Theme": grid (1 col, 2 cols on md) of buttons, one per theme in order `default, forest, ocean, desert, snow, jungle, blossom, fall, stone`. Each: theme icon (Palette, Trees, Waves, Mountain, Snowflake, TreePalm, Flower2, Leaf, Gem), capitalised translated name, then five 16px swatches showing the theme's `background, accent, selected, focus, theme-highlight` colors for the *currently effective* light/dark scheme. Selected theme: `border-selected bg-selected/10`. Click → `updateMe({settings:{theme}})`.

On phones the global‑nav "tabs" style is forced off (the toggle is hidden in the avatar menu on phone viewports). Theme tokens and how settings are applied: [08-design-system-i18n.md](08-design-system-i18n.md). Legacy localStorage keys (`hylo-theme`, `hylo-color-scheme`, `hylo-nav-mode`, `hylo-stack-groups`) are migrated once into `settings`.

### 4.6 Notifications (`/my/notifications`)

Header icon "Notifications", title "Notifications". All changes save immediately (no save button).

**A. "Global notifications"** (small muted caption, then a `bg-card rounded-lg p-4 shadow-lg` panel):
1. Row "💬 Messages" (xl, Messages icon) with two Switches: "Mobile Push" and "Email". Bound to `dmNotifications` (`both`=both on, `email`, `push`, `none`). Each toggle recomputes the enum from both flags and calls `updateMe({settings:{dmNotifications}})`.
2. Row "Comments on followed posts" — same, bound to `commentNotifications`.
3. Row "Unified email digest" with an ⓘ info popover: "When this is on, groups with a daily digest are combined into one daily email, and groups with a weekly digest are combined into one weekly email. A post sent to several groups is included once. Each item shows which of your groups it was posted in." and a Switch (`data-testid='unified-email-digest'`) → `updateMe({settings:{unifiedEmailDigest}})`.

**B. "Default group notifications"** panel:
- Text: "These settings apply to all groups. Toggling related group settings will turn off these default settings."
- `GroupMembershipNotificationSettings` with aggregated values across all memberships:
  - "Receive group notifications by" ⓘ ("This controls how you receive notifications for all your groups.") + Switches "Mobile Push" / "Email" — on iff *every* membership has it on.
  - "Receive new post notifications for" select: "No Posts" (`none`), "Important Posts (Announcements & Mentions)" (`important`), "Every Post" (`all`), plus disabled "~ Mixed ~" (`mixed`) shown when memberships differ.
  - "Receive an email digest summarizing group activity" select: Daily / Weekly / Never / disabled "~ Mixed ~".
- Any change → `window.confirm("You wish to set {{key}} to '{{value}}' for all groups? This will affect {{numGroups}} {{groups}}.")` (`group`/`groups`) → `mutation updateAllMemberships(data:{settings:{<key>:<value>}})` (optimistic).

**C. "Group-specific notifications"** (only if the user has memberships): one collapsible card per top‑level group membership (sorted by name), then orphan spaces (spaces whose parent isn't a membership) as their own cards.
- Card header (click toggles): group avatar, group name (xl bold), right icon `Settings` (50% → 100% on hover) when closed, `X` when open. Card `bg-card/60` → `/100` on hover/open, scales 102% on hover. Element id `group-<groupId>`.
- Expanded body: the same three controls as section B, bound to this membership (`ⓘ` text: "This controls how you receive all notifications for this group. Including new posts (according to setting below), event invitations and mentions."). Changes → `updateMembership(groupId, data:{settings:{...}})` (optimistic).
- If the group has space memberships: divider + caption "Spaces", then a row per space: space Lucide icon (or `Layers`) + name, and a "post notifications" select (None/Important/Every Post) → `updateMembership(spaceId, {settings:{postNotifications}})`. Spaces have no channel or digest controls (inherit the group's).
- `?group=<id>`: the matching group (or the parent containing that space) starts expanded and the page scrolls to `#group-<id>` after 100ms.

**D. Footer**: "Download our iOS or Android app to receive push notifications." (iOS → `https://itunes.apple.com/app/appName/id1002185140`, Android → `https://play.google.com/store/apps/details?id=com.hylo.hyloandroid`).

The group‑level popover version of these controls (from a group's menu) is described in [19](19-notifications-email-push.md).

### 4.7 Account (`/my/account`)

Header title "Account Settings". Container `p-4`, 24px spacing.

1. Title "Update Account" (xl semibold).
2. Form error lines (red, sm), computed only when something changed:
   - "Email address is not in a valid format" (`validateEmail` fails)
   - "Passwords must be at least 9 characters long" (0 < length < 9)
   - "Passwords don't match"
3. "Email" field (value trimmed on every keystroke; prefilled with current email). Inline red alert for email‑change errors.
4. **Pending email change card** (shown when `me.pendingEmail` is set; `data-testid='pending-email-change'`): title "Confirm your new email address"; text "We sent a 6 digit code to {{pendingEmail}}. Until you enter it, {{email}} stays the email for logging in and notifications."; 6‑box numeric code input (same look as signup; aria‑label "Verification code"; disabled while verifying; completing 6 digits submits); links "Resend code" (re‑requests the change for the pending address) and "Cancel email change".
5. "New Password", "New Password (Confirm)" (password fields).
6. Help text: "Passwords must be at least 9 characters long, and should be a mix of lower and upper case letters, numbers and symbols."
7. Status + button row: "Changes not saved" (accent) / "Current settings up to date" (these two strings are **not translated** on this tab) and **Save Changes** (disabled unless changed and no form errors).
8. Action buttons row (stacked on phones, max 280px): **Export Profile Data** (accent filled; "Exporting..." + spinner below while running), **Deactivate Account** and **Delete Account** (accent outline).
   - Export result line: green "Profile data exported successfully!" (auto‑hides after 3s) or red "Failed to export profile data.".
9. Divider, then **Cookie Preferences** section (`SettingsSection`): heading "Cookie Preferences"; text "We use cookies to help understand whether you are logged in and to understand your preferences and where you are in Hylo."; two rows with Switch on right:
   - "Analytics (Mixpanel)" — "We use a service called Mixpanel to understand how people like you use Hylo. Your identity is anonymized but your behavior is recorded so that we can make improvements to Hylo based on how people are using it." + xs "This helps us understand how people use Hylo so we can improve the platform. Your data is anonymized and aggregated."
   - "Support (Intercom)" — "When people on Hylo need help or want to report a bug, they are interacting with a service called Intercom. Intercom stores cookies in your browser to keep track of conversations with us, the development team." + xs "This helps us provide better customer support and track bug reports. Your conversations are stored securely."
   - Initial values from `me.cookieConsentPreferences.settings`, default both on. Toggle → `updateCookieConsent(newSettings)` (rewrites the `hylo_cookie_consent` cookie, POSTs `/noo/cookie-consent` with `user_id`) — see 04 §4.13.

**Save flow**: password (if changed) → `updateMe({ password })` (optimistic; no toast). Email (if changed) → `requestEmailChange(email)` = `updateMe({ email })` returning `{id email pendingEmail}`; success toast "We sent a verification code to {{email}}"; failure toast with mapped message and the email stays marked as changed. Error mapping (`emailChangeErrorMessage`): `invalid-email` → "Email address is not in a valid format"; `duplicate-email` → "That email address is already in use"; `invalid-code` → "Invalid code, please try again"; `invalid-link` → "Link expired, please start over"; rate limit → "Too many attempts. Please wait a few minutes and try again."; other → "Something went wrong. Please try again.".

**Verify**: by code (card) or by link `/my/account?emailChangeToken=<jwt>` (the param is stripped from the URL then submitted). `verifyEmailChange(code|token)` → success toast "Your email address is now {{email}}"; failure → inline error, code boxes reset, user settings refetched. **Cancel** → `cancelEmailChange` → refetch → toast "Email change cancelled".

**Deactivate modal** (`ModalDialog`, no title bar): H2 "Deactivate"; "This action is reversible, just log back in"; card "If you deactivate your account:" bullets: "You won't be able to use Hylo unless you log back in", "You won't receive platform notifications", "Your profile won't show up in any member searches or group memberships", "Your comments and posts will REMAIN as they are". Submit button "Deactivate my account" (untranslated literal; accent → destructive on hover). → `deactivateMe` then `logout`.

**Delete modal**: H2 (accent) "DELETE: CAUTION"; "This action is **NOT** reversible"; card "If you delete your account:" bullets "Your account and its details will be deleted", "The content of your posts and comments will be removed", "You won't be able to use Hylo unless you create a brand new account". Submit "Delete my account" (untranslated). → `deleteMe` then `logout`.

There is no "current password" prompt for password/email change, deactivate or delete.

### 4.8 Saved Searches (`/my/saved-searches`)

Header title "Saved Searches". Fetches `savedSearches(userId)` on mount.
- Empty: centered muted "No saved searches. You can set them up in the map".
- Each search: card (`bg-card rounded-lg p-4`, shadow grows on hover): name as a button (hover accent) → navigates to the map path for its context (`/all/map`, `/groups/<slug>/map`, or `/public/map`); an `Info` icon with a dark tooltip (desktop only, right side, 200ms delay) listing "Created on {long date}", "Context: all|public", group, search text, post types, topics (joined with line breaks); right: accent "⚠ Delete" (TriangleAlert icon) → `deleteSavedSearch(id)` immediately (optimistic, no confirm).

### 4.9 Blocked Users (`/my/blocked-users`)

Header title "Blocked Users". Spinner while user settings are loading. Rows (py‑2, bottom border): user name (base text) and a red "Unblock" text button → `unblockUser(blockedUserId)` (Mixpanel `User Un-Blocked`). Empty: "No blocked users". Users are blocked from their profile/hover card ([12](12-roles-permissions-moderation.md), [20](20-members-profiles.md)).

### 4.10 Payment (`/my/payment`) — feature‑flagged

Only exists when `currentUser.hasFeature('PROJECT_CONTRIBUTIONS')`. Legacy Stripe *standard OAuth* connect for receiving contributions to project posts (separate from the group Stripe Connect / paid content system in [23](23-paid-content-stripe.md)).
- Title "Connect Stripe Account"; prompt "Click the button below to create a free Stripe account (or connect an existing account). Once you've done that you will be able to accept contributions to Projects." or, if `hasStripeAccount`, "You already have a stripe account linked to this account. If you would like to link a different account, click the button below."
- `?registered=success` → "Your account is registered, you're ready to accept contributions to projects."; `error` → "There was an issue registering your stripe account. Please try again. If the problem persists, contact us."
- Button "Link Stripe Account" opens `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=<VITE_STRIPE_CLIENT_ID>&scope=read_write` in a new window. The return goes to `/noo/payment/registerStripe` (`PaymentController`), which exchanges the code and redirects to `/settings/payment?registered=success|error`. GraphQL `registerStripeAccount(authorizationCode)` / `updateStripeAccount(accountId)` store a `stripe_accounts` row and `users.stripe_account_id` (old row destroyed).

---

## 5. Business rules & side effects

### 5.1 `updateMe(changes)`

1. `User.find(currentUserId)` (active only); `convertGraphqlData` → snake_case.
2. If `email` present: `validateEmailChange` (below); removed from the regular update.
3. `settings.rsvp_calendar_sub === true` → generate `calendar_token` (uuid v4) if missing and queue `User.createRsvpCalendarSubscription`; `=== false` with existing token → queue the same job (writes an empty calendar).
4. `validateAndSave`: validate password/name; in a transaction refresh, `setSanely` (trim name; strip `@` from twitter; add `https://` to `url`, `facebook_url`, `linkedin_url`; merge settings), set password (bcrypt; if a password linked account exists `updatePassword`, which also **clears all other sessions** of the user; else create one), save `updated_at`.
5. If any of `avatar_url, bio, contact_email, contact_phone, facebook_url, linkedin_url, location, location_id, name, tagline, twitter_name, url` changed → job `User.afterUpdate` posts `{id, profileUrl, ...changes}` to every Zapier `member_updated` trigger of each of the user's groups.
6. `settings.signup_in_progress === false` → welcome email job in 2 minutes (04).
7. If a new email was validated → `startEmailChange`.
8. Returns the user (`Me`).

Validation errors (GraphQL errors): "Name must be a string." / "Name must not consist solely of whitespace.", "Password must not consist solely of whitespace, must be at least 9 characters." (or subset), `invalid-email`, `duplicate-email`, rate limit message.

### 5.2 Email change (`api/graphql/mutations/emailChange.js`)

- `validateEmailChange`: normalize (trim, lowercase, `isEmail`) else `invalid-email`; same as current → no‑op. Rate limit `sendEmailVerification` checked for `{ip, newEmail}` and `{currentEmail}` (5/hour per email, 50/hour per IP). Not unique → records an attempt against the current email and throws `duplicate-email`.
- `startEmailChange`: records attempts; random 6‑digit code; JWT `user.generateJWT({purpose:'email-change', email, code})` (4h); stores `settings.pending_email = {email, code_hash: sha256(code), requested_at}` (replaces any earlier request); emails:
  - to the **new** address: verification email (same template as signup, `version:'with link'`, `{code, verify_url: <origin>/my/account?emailChangeToken=<jwt>}`), user's locale;
  - to the **old** address: "email change requested" notice (`sendEmailChangeRequested`) with `{name, masked_new_email (e.g. j***@example.com), account_settings_url: <origin>/my/account}` — never the code or link.
- `Me.pendingEmail` resolves to the pending address unless expired (≥ 4h since `requested_at`).
- `verifyEmailChange(code | token)`: token must decode, have `purpose:'email-change'` and `sub` = current user; rate limit `verifyCode` (failures; 10/hour per pending email, 50/hour per IP); expired → pending cleared, error; code compared with timing‑safe hash compare and token's email must equal pending email; in a locked transaction re‑checks pending and uniqueness (taken meanwhile → pending cleared, `duplicate-email`); sets `email`, `email_validated=true`, removes `pending_email`. Errors are `invalid-code` (code) / `invalid-link` (token). Returns `{ me }`.
- `cancelEmailChange`: removes `pending_email`; `{success:true}`.
- Until verified, login, password reset and all notifications use the old email.

### 5.3 Deactivate / delete

- `deactivateMe`: `users.active=false`; job `User.clearSessionsFor` removes all other sessions (keeps the current one, which the client then logs out). Inactive users are excluded from `User.find` default lookups, member lists and searches, and get no notifications; posts/comments remain. Logging in again reactivates (04 §5.11).
- `deleteMe` (`sanelyDeleteUser`): queue deletion of all the user's uploaded media plus avatar and banner (`Media.deleteMediaByUrl`); clear other sessions; then one SQL transaction:
  - posts: `name='Post by deleted user'`, `description=''`, location cleared; comments: `text='Comment by deleted user'`;
  - delete: user_connections (both directions), thanks (on their comments and by them), group_memberships_group_roles, notifications for activities where they were reader or actor, push_notifications, activities (actor/reader), contributions, devices, group_invites used by them, group_memberships, linked_account, group_join_questions_answers, join_requests, skills_users, posts_about_users, tag_follows, user_external_data, user_post_relevance, posts_tags of their posts, reactions;
  - users row: `active=false`, `settings=NULL`, `name='Deleted User'`, avatar/bio/banner/location/url/tagline/location_id/contact_email/contact_phone/first_name/last_name/twitter_name/linkedin_url/facebook_url/work/intention/extra_info NULL, `email='<uuid>@hylo.com'`.
  - Not deleted: affiliations, saved searches, message‑thread posts' messages beyond the generic post update, blocked_users, tracks enrollment, etc.

### 5.4 Data export

`POST /noo/export/user-account` (sessionAuth) → `200 {message:"Account export started. You will receive an email when it's ready."}` (the UI shows its own success text) and queues `ExportService.exportUserAccount`: builds JSON of profile fields (`id, name, email, contact_email, contact_phone, avatar_url, tagline, bio, url, twitter_name, facebook_url, linkedin_url, created_at, updated_at`, location object), the user's active posts (with media urls), comments, memberships etc., and emails it as an attachment named `user-account-export-<name>-<YYYY-MM-DD>.json` (`Email.sendExportUserAccount`).

### 5.5 Affiliations

- `createAffiliation(data:{role, preposition, orgName, url})`: all of role, preposition, orgName required ("Invalid parameters to create affiliation"); url optional, if present must be a valid URL after adding `https://` ("Please enter a valid URL.").
- `deleteAffiliation(id)` → `Affiliation.delete` (see quirk on ownership).

### 5.6 Membership settings

- `updateMembership(groupId, data:{settings})`: merges settings into the membership (throws "Couldn't find membership for group with id <id>").
- `updateAllMemberships(data:{settings})`: whitelist `sendEmail, sendPushNotifications, postNotifications, digestFrequency`; single SQL `update group_memberships set settings = settings || jsonb_build_object(...) where user_id = <id>` (affects all memberships including spaces and inactive memberships).

### 5.7 Blocking

`blockUser`/`unblockUser(blockedUserId)`; unblock of a non‑blocked user → "user is not blocked". Effects of blocking (hidden content, messaging): module 12.

---

## 6. Permissions

All tabs require login; every mutation acts on `context.currentUserId` only (`updateMe`, `deactivateMe`, `deleteMe`, `verifyEmailChange`, `cancelEmailChange`, `unblockUser`, `deleteSavedSearch` with owner check, `updateMembership` on own memberships, `leaveGroup` for self). Payment tab requires the `PROJECT_CONTRIBUTIONS` feature flag on the user.

## 7. API

```graphql
query  me { id email pendingEmail rsvpCalendarUrl isProfilePublic hasStripeAccount cookieConsentPreferences
            affiliations { items { id role preposition orgName url createdAt updatedAt isActive } }
            blockedUsers { id name } memberships { id settings { sendEmail sendPushNotifications postNotifications digestFrequency } group { id name type parentId avatarUrl } } }
mutation updateMe(changes: MeInput): Me
mutation verifyEmailChange(code: String, token: String): UserResult   # { me, error }
mutation cancelEmailChange: GenericResult
mutation deactivateMe: GenericResult
mutation deleteMe: GenericResult
mutation unlinkAccount(provider: String): GenericResult              # facebook | linkedin | twitter
mutation createAffiliation(data: AffiliationInput): Affiliation
mutation deleteAffiliation(id: ID): ID
mutation leaveGroup(id: ID): ID
mutation updateMembership(groupId: ID, data: MembershipInput): Membership
mutation updateAllMemberships(data: MembershipInput): GenericResult
mutation useInvitation(invitationToken: String, accessCode: String): { membership, error }
mutation expireInvitation(invitationId: ID): GenericResult
mutation cancelJoinRequest(joinRequestId: ID): GenericResult
query  savedSearches(userId: ID): SavedSearchQuerySet
mutation deleteSavedSearch(id: ID): ID
mutation blockUser(blockedUserId: ID) / unblockUser(blockedUserId: ID): GenericResult
mutation registerStripeAccount(authorizationCode: String) / updateStripeAccount(accountId: String): GenericResult
mutation addSkill / removeSkill / addSkillToLearn / removeSkillToLearn   # module 20
```

REST: `POST /noo/export/user-account`; `POST /noo/cookie-consent`; `GET|POST /noo/payment/registerStripe`; `POST /noo/upload` (avatar/banner, module 01).

## 8. Edge cases & known quirks

- `SocialControl.windowPrompt` validation loop is `while (!url && !url.match(...))`, which never runs for a non‑empty answer — any text is accepted as a Facebook/LinkedIn URL.
- Linking a social account only edits the profile URL field (needs Save); unlinking hits the server immediately.
- `deleteAffiliation` ownership check is a Promise (always truthy), so the server does not actually verify ownership.
- Affiliation preposition is stored as the *translated* word (e.g. "de" in Spanish UI).
- `updateAllMemberships` and the unsubscribe page interpolate values into raw SQL.
- Saved search "view" only navigates to the map path; the saved filters (bounding box, types, text, topics) are computed by `generateViewParams` but not applied.
- Account tab strings "Changes not saved", "Current settings up to date", "Deactivate my account", "Delete my account" are hard‑coded English.
- Password change doesn't require the current password; changing the password signs out all *other* sessions.
- Email validity on the client uses `validateEmail`; the server normalises to lowercase, so the stored email is lowercased after verification.
- `UserSettings` builds tabs only once `me` is loaded; logout while on a settings page renders nothing until redirect.
- `reactivateMe` mutation is broken (see 04).
- The Groups tab's message banner only shows when the last UserGroupsTab action was `LEAVE_GROUP`.
- Unknown `/my/<x>` paths render an empty settings shell rather than a 404.

## 9. Docs vs. code

- Docs call the tab "Groups & Affiliations" (and the Invites tab links to "Groups & Affiliations"); in code the Groups tab (`/my/groups`, menu "My Groups") lists only groups, and affiliations live under Edit Profile ("Other Affiliations").
- Docs (Account): "Change the email associated with your Hylo account and update your password here." Code adds a verification step: the new email only takes effect after entering a 6‑digit code (or link) sent to it, and a notice goes to the old address.
- Docs (Account, deactivation): matches the modal bullets.

## 10. Source references

- `apps/web/src/routes/UserSettings/**` (UserSettings.js, UserSettings.store.js, all tab folders)
- `apps/web/src/routes/FullPageModal/FullPageModal.js`
- `apps/web/src/routes/AuthLayoutRouter/AuthLayoutRouter.js`, `components/GlobalNav/GlobalNav.jsx`, `components/GlobalNav/LocaleDropdown/LocaleDropdown.js`, `components/ContextMenu/ContextMenu.jsx`
- `packages/presenters/src/GroupViewPresenter.js` (`MY_CONTEXT_VIEWS`), `packages/navigation/src/index.js`
- `apps/web/src/components/{Affiliation, SocialControl, CookiePreferencesPanel, SkillsSection, SkillsToLearnSection}`, `util/{appearance.js, navigationLayout.js, savedSearch.js, cookieConsent.js}`, `themes/index.js`, `store/actions/{fetchUserSettings.js, updateUserSettings.js}`, `store/selectors/getMyGroups.js`
- `apps/backend/api/graphql/mutations/{index.js (updateMe, leaveGroup, unlinkAccount), emailChange.js, user.js, membership.js, affiliation.js, savedSearch.js}`
- `apps/backend/api/models/{User.js, LinkedAccount.js, BlockedUser.js}`, `api/controllers/ExportController.js`, `api/services/ExportService.js`
- `apps/backend/api/graphql/schema.graphql` (`MeInput`, `UserSettings`, `UserSettingsInput`)
- `apps/web/public/locales/en.json`
