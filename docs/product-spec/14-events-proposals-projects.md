# 14 — Events, proposals, projects, requests & offers (type-specific behaviour)

> Scope: everything that differs by post type. The generic post model, editor shell, cards, detail page, comments and reactions are in [13-posts-comments.md](13-posts-comments.md). View/stream mechanics (Events / Projects / Proposals / Requests & Offers views, calendar view mode, filters) are in [15-views-streams-spaces.md](15-views-streams-spaces.md). Notification delivery is in [19-notifications-email-push.md](19-notifications-email-push.md). Actions/tracks: [21-tracks.md](21-tracks.md). Submissions/funding rounds: [22-funding-rounds.md](22-funding-rounds.md).

<!-- sections appended below -->

## 1. Overview

Hylo posts have a `type` (see 13). Seven "stream" types are user-creatable from the post editor's type picker: `discussion`, `request`, `offer`, `resource`, `project`, `event`, `proposal`. Each type reuses the same post row, editor shell and card, then adds type-specific fields, editor sections, card/detail sections, server rules and side effects:

| Type | Purpose | Type-specific features (this module) |
|------|---------|--------------------------------------|
| `event` | Time-bounded gathering (in person, online, hybrid) | Mandatory start/end, timezone, venue + video "Join link", RSVPs (`yes`/`interested`/`no`), invitations, .ics RSVP emails, per-group and per-user ICS calendar feeds, "Happening now!/Upcoming/Event ended" badges |
| `proposal` | Group decision / poll | Options (emoji + text), 7 templates, voting method single/multi, quorum %, anonymous voting, voting window that drives a status machine (`casual`/`discussion`/`voting`/`completed`), free-text outcome, vote reset on edit |
| `project` | Ongoing coordinated work | Project members (join/leave), project-management link, donation link, budget, legacy Stripe contributions (flag-gated, effectively dead) |
| `request`, `offer`, `resource` | Mutual support / shared assets | Optional timeframe (start/end = "expiry"), fulfil/unfulfil ("still needed?" toggle), moderator fulfilment with author notification, digest "starting soon / ending soon" reminders |
| `discussion` | Conversation | No type-specific fields (cannot have times) |
| `action` | Track step | Completion actions — see [21-tracks.md](21-tracks.md); summarised in §7 |
| `submission` | Funding-round entry | See [22-funding-rounds.md](22-funding-rounds.md); shares `budget` with projects |

Type colours / labels / editor descriptions (web `store/models/Post.js` `POST_TYPES`):

| type | primaryColor (RGBA) | label | description (type picker) | icon (`getPostTypeIcon`) |
|------|---------------------|-------|---------------------------|------|
| discussion | 0,163,227 | Discussion | "Talk about what's important with others" | `Chat` |
| event | 254,72,80 | Event | "Invite people to your event" | `Calendar` |
| offer | 0,199,157 | Offer | "What do you have for others?" | `Offer` |
| request | 102,75,165 | Request | "What can people help you with?" | `Heart` |
| resource | 255,212,3 | Resource | "Let people know about available resources" | `Resource` |
| project | 252,128,0 | Project | "Create a project that people can help with" | `Project` |
| proposal | 0,163,227 | Proposal | "Suggest a proposal for others to vote on" | `Proposal` |
| action / chat | 0,163,227 | Action / Chat | — | `Post` / `Messages` |

`POST_TYPES_SHOW_LOCATION_BY_DEFAULT = ['request','offer','resource','project','event']` — the editor's location row starts visible for these (other types reveal it via the ActionsBar location button, see 13).

---

## 2. Concepts & data

### 2.1 Type-specific columns on `posts`

| Column | Type | Used by | Notes |
|--------|------|---------|-------|
| `start_time` | timestamptz | event (required), proposal (voting start), request/offer/resource/project (optional), action (track) | Stored UTC. GraphQL `startTime: Date`; clients send epoch ms (`startTime.valueOf()`), server does `new Date(Number(x))`. Null clears. |
| `end_time` | timestamptz | same | GraphQL `endTime`. Null clears. |
| `timezone` | varchar | all timed types | IANA id, e.g. `America/Los_Angeles`. Default in editor = browser zone (`DateTimeHelpers.getCurrentTimezone()`, fallback `UTC`). Used only for display; instants are absolute. |
| `location`, `location_id` | varchar / FK Location | all (event label "Venue") | See 16-map. |
| `meeting_link` | varchar(255) | event | Video-call URL. Migration `20260803120000_add_meeting_link_to_posts`. Server accepts `meetingLink` or `meeting_link`; missing → `null` (so every create/update without it **clears** it). |
| `ical_sequence` | int | event | iCalendar SEQUENCE for group feed / owner-less sends; default treated as 0. |
| `proposal_status` | text (indexed) | proposal | `discussion` \| `voting` \| `completed` \| `casual`. Computed — see §4.3. **Also written for every other post type** (always `casual` unless they have times). |
| `proposal_outcome` | text (indexed) | proposal | Free text written by the author (UI). Server enum constants exist (`cancelled`, `quorum-not-met`, `incomplete`, `in-progress`, `successful`, `tie`) but nothing computes them. |
| `voting_method` | text | proposal | `single` \| `multi-unrestricted` (renamed from `proposal_type` in migration `20240610131324`). Commented-out future values `majority`, `consensus`. |
| `quorum` | bigint | proposal | Integer percent 0–100 of possible voters. 0/null = no quorum. |
| `anonymous_voting` | **text** | proposal | Written from boolean `isAnonymousVote` → Postgres stores `'true'`/`'false'`; GraphQL `isAnonymousVote` = `anonymous_voting === 'true'`, `anonymousVoting` returns the raw string. |
| `proposal_strict` | boolean default false | — | **Dead.** `isStrictProposal` exists in GraphQL input/type but is never persisted or resolved (always null). |
| `proposal_vote_limit` | int | — | **Dead** column. |
| `accept_contributions` | boolean default false | project | Legacy Stripe contributions; see §5.4. |
| `donations_link` | varchar(255) | project | External fundraising URL. |
| `project_management_link` | varchar(255) | project | External PM tool URL. |
| `budget` | varchar(255) | project, submission | Free text ("Budget Total"). |
| `fulfilled_at` | timestamptz | request, offer, resource, project, proposal | "Completed/closed" marker; see §6. |
| `completion_action`, `completion_action_settings`, `num_people_completed` | — | action | §7 / 21-tracks. |
| `starts_at`, `ends_at`, `is_project_request` | — | — | Legacy, unused. |

### 2.2 `event_invitations` (one row per user per event = invitation **and** RSVP)

| Column | Notes |
|--------|-------|
| `id` | serial |
| `user_id` | invitee / responder |
| `inviter_id` | who invited; equals `user_id` when the person RSVP'd uninvited ("inviting themselves") or for the creator's own row |
| `event_id` | FK posts |
| `response` | `yes` \| `interested` \| `no` \| `NULL` (invited, not answered) |
| `ical_sequence` | per-recipient iCalendar SEQUENCE, incremented after every RSVP email is queued |
| `created_at`, `updated_at` | |

Constants `EventInvitation.RESPONSE = { YES: 'yes', NO: 'no', INTERESTED: 'interested' }`. "Going" in the iCal/RSVP sense (`EventInvitation.going()`) means `yes` **or** `interested`. Human strings: server `getHumanResponse()` → `'Going to'` / `'Not Going to'` / `'Interested in'` (used in RSVP email `response` field); client `humanResponse()` → `Going` / `Not Going` / `Interested`.

`event_responses` table + `EventResponse` model + `Post.responders()` are **legacy/dead** (nothing writes them).

GraphQL `Post.myEventResponse` = current user's invitation `response` or `''` (schema comment says `'yes','maybe','no'` — "maybe" does not exist).

### 2.3 Proposals: `proposal_options`, `proposal_votes`

`proposal_options`: `id`, `post_id` (NOT NULL; FK dropped), `text` (NOT NULL), `emoji` (text, `''` when none), `color` (text, `''`; never shown in UI).
`proposal_votes`: `id`, `post_id`, `option_id`, `user_id`, `created_at`. No unique constraint (one user can technically hold several votes, even on the same option, through the API).

### 2.4 Projects: membership via `posts_users`

A project member is a `posts_users` row with `project_role_id IS NOT NULL`, `following = true`, `active = true` (and active user). `project_roles(id, name, post_id)` — each project lazily gets one role named `member` (`ProjectRole.MEMBER_ROLE_NAME`); `getOrCreateMemberProjectRole()` creates it on first member add. Custom roles exist only via the legacy role mutations (§5.5).

`project_contributions(id, user_id, post_id, amount INT cents, created_at, updated_at)` — Stripe donations (legacy).
`contributions(id, post_id, user_id, contributed_at)` — "contributors" credited when a request is fulfilled with `contributorIds` (legacy; no current UI passes them).

### 2.5 Calendar tokens

`users.calendar_token` (string, migration `20251020145500`) — created the first time the user enables `settings.rsvp_calendar_sub`.
`groups.calendar_token` (migration `20251206183200`, backfilled for all groups by `20260116120000`) — generated with `uuidv4()` at group/space creation, or lazily when the feed is first built.
`users.settings.rsvp_calendar_sub` (boolean; GraphQL `settings.rsvpCalendarSub`).

---

## 3. Routes / entry points

| Entry point | Where | Notes |
|-------------|-------|-------|
| Create typed post | Create menu / "New" / view post prompt → post editor with `?newPostType=<type>` | Editor routing & modal: 13. If `newPostType` is not allowed in the current view/group, editor falls back to the first allowed type in `POST_TYPES` order (default `discussion`). |
| Create event on a calendar day | Calendar view → day → create, `?newPostType=event&eventDate=<date>` | Prefills times via `defaultEventTimesForDate` (§4.1.2). |
| Duplicate post | Post ⋯ menu "Duplicate" → `?fromPostId=<id>` | New post with title `Copy of <title truncated to 72 chars>`; **event invitations are dropped** (`eventInvitations: []`). |
| Edit post | Post ⋯ menu "Edit" (creator only) | Proposal edit always shows the vote-reset confirm (§4.2.6). |
| Typed views | Group menu: Events, Projects, Proposals, Requests & Offers, Resources… | Owned by 15. Events view supports a calendar view mode (month/week/day). |
| Group ICS feed | `{AWS_S3_CONTENT_URL}/{UPLOADER_PATH_PREFIX}/group/{groupId}/calendar-{groups.calendar_token}.ics` | Exposed as `Group.eventCalendarUrl` (null if no token). Static file on S3, unauthenticated, secret-by-obscurity. |
| Personal RSVP ICS feed | `{AWS_S3_CONTENT_URL}/{UPLOADER_PATH_PREFIX}/user/{userId}/calendar-{users.calendar_token}.ics` | Exposed as `Me.rsvpCalendarUrl` (null until enabled). |
| Subscribe buttons | Below the month calendar in an events/calendar view | §4.1.9 |
| Join online | Event detail "Join online" button → opens `meetingLink` in new tab | |
| Email links | RSVP / invitation emails link to `Frontend.Route.post(post, group)` | |

---

## 4. UX specification

### 4.1 Events

#### 4.1.1 Editor — event-specific rows (in order, after body/attachments)

The generic editor layout (To, Title, body, Public toggle, ActionsBar) is in 13. Event-specific rows appear in this order:

1. **Timeframe** row (shared by all timed types) — label `Timeframe` (proposal: `Voting window`).
   - Desktop: two popover `DateTimePicker`s (granularity minute, 12/24h per locale `getHourCycle()`), placeholders `Select Start` / `Select End`, separated by `to`.
   - Touch devices (`usePrefersNativeDateTimePicker`): native OS date/time inputs, one full-width row each, labelled `Select Start` / `Select End` (e2e `event-native-time-pickers.spec.js`; must fit 320–430 px wide screens with a long timezone name).
   - Events: **no** remove (×) buttons — `timesAreClearable = type !== 'event'`.
2. **Timezone** row: label `Timezone`, `TimezoneSelect` (`data-testid=post-editor-timezone`). Options from `getTimezoneOptions(locale)`: every IANA zone from `Intl.supportedValuesOf('timeZone')`, label `(<±HH:MM>) <long generic name> — <Zone id with spaces>` e.g. `(-08:00) Pacific Time — America/Los Angeles`, sorted by current offset then label.
3. Date error banner (any timed type): `End Time must be after Start Time` (white text on destructive red) shown when an edited end ≤ start.
4. **Location** row (visible by default for events): label `Venue`, placeholder `Where is the event taking place?` (proposals: `Is there a relevant location for this proposal?`; other types: `Where is your {{type}} located?`, label `Location`).
5. **Join link** row: label `Join link` (turns destructive red when non-empty and not a valid URL), text input placeholder `Add a video call link (Zoom, Meet, Jitsi, etc.)`.
6. **Invite People** row: label `Invite People`, `MemberSelector` scoped to members of the selected destination groups (`forGroups = currentPost.groups`). When editing, it is pre-filled with **every existing invitation** (including the creator's own row and people who self-RSVP'd).

Behaviour:
- Start change → end is recomputed to keep the previous duration (default 1 hour if no prior pair): `end = start + (oldEnd − oldStart)`. The end picker value is pushed imperatively.
- End change → validated (`start < end`), sets/clears the date-error flag.
- Timezone change → **wall-clock preserved** (`preserveWallClockOnTimezoneChange`): 3 pm stays 3 pm in the new zone, so the stored instants shift.
- Pickers display stored instants converted to wall-clock in the post's timezone (`toPickerDate`) and interpret picked wall-clock in that timezone (`fromPickerDate`) — i.e. the user always edits in the *event's* zone, not the browser's.
- Meeting-link auto-fill: when a link is typed/pasted into the body (link-preview hook) and the post is an event and the URL matches a known meeting host (`zoom.us` incl. subdomains, `meet.google.com`, `meet.jit.si`, `teams.microsoft.com`, `teams.live.com`, http/https), and Join link is empty, the URL is copied into Join link.
- On save, `meetingLink` is trimmed then `sanitizeURL`d: a string that is a URL with protocol is kept; otherwise `https://` is prefixed if that makes it valid; else `null`.

Validation (`isValid`, Post button disabled with tooltip listing errors joined by `<br />`):
- `Valid start and end time required` — missing start or end, or start ≥ end.
- `Video call link must be a valid URL` — non-empty and `sanitizeURL` fails.
- plus generic `Title is required`, `At least one group required` (13).

Server-side there is **no** time validation for events (any start/end, even reversed or null, is accepted via API).

#### 4.1.2 Prefilled times from the calendar (`defaultEventTimesForDate`)
- Selected day is **today** → start = next whole hour from now (`now+1h` floored to the hour); if that is ≤ now, start = now + 30 min (to the minute).
- Any other day (past or future) → 09:00 local that day.
- End = start + 1 hour.
Only applied when creating an event and no start is already set.

#### 4.1.3 Event card (`EventBody`, used in stream card and detail)

Layout (top to bottom), inside the standard card shell (header from 13 — note `PostHeader` time-window pill is **not** shown for events; events use their own date row):

```
[ MMM ]  <badge> <time text> <Event ended chip>
[  d  ]  <Title>
<details / PostContent>
┌ dashed box ─────────────────────────────────────────────┐
│ (avatars ×3) "<names> attending"     [RSVP ▾] [Invite]  │
└─────────────────────────────────────────────────────────┘
```

- **Date tile** (`EventDate`): 64×64 rounded tile; top half red (`bg-error`, white, uppercase bold `MMM` month abbreviation), bottom half white with dark bold day number `d`. Computed in the **event's timezone** (fallback browser zone), locale from local storage.
- **Status badge** (computed client-side at render, no live refresh):
  - `Happening now!` — `start ≤ now ≤ end` (selected-colour pill).
  - else `Upcoming` — start in the future and within 72 hours (accent pill).
  - `Event ended` (grey chip, after the time) — `end < now`.
- **Time text** (`EventTimeDisplay`, §4.1.5): cards show viewer-zone time with a tooltip showing event-local time; detail (`expanded`) shows two lines.
- **Attendee strip** (`PeopleInfo`): only invitations with `response === 'yes'` count ("interested" are **not** counted as attending). Up to 3 avatars; caption rules: 0 → `No one is attending yet` (past: `No one attended`); 1 → `<First name> is attending` (if it's me: `You are attending`; past: `attended`); 2 → `{{personOne}} and {{personTwo}} attending`; 3+ → `{{personOne}}, {{personTwo}} and {{othersTotal}} other(s) attending`. The current user is shown as `You`; with exactly 2 people "me" is listed first, otherwise last. Clicking (logged in, detail only) opens the people dialog.
- **RSVP + Invite** — shown only when logged in and the event has not ended:
  - `EventRSVP` dropdown button. Label = current response: `Going` (yes) / `Interested` / `Not Going` / default `RSVP`. Choices in order: `Going` (`yes`), `Interested` (`interested`), `Not Going` (`no`). Optimistic: `myEventResponse` updates immediately; the attendee list refreshes when the post is re-fetched / pushed.
  - `Invite` button opens `EventInviteDialog`.
- Flagged events show the flag cover (13/12).

Other renderings:
- List row (`PostListRow`): subtitle is `EventTimeDisplay` (viewer time + local-time tooltip) instead of the details excerpt.
- Big grid item (`PostBigGridItem`): `EventDate` tile; when logged in and not past, an RSVP strip `Can you go?` + `EventRSVP` (dropdown opens upward).
- Calendar chips/blocks: tooltip `<title><br/><event-zone time><br/>Event time (<ABBR>)` plus `Your time (<ABBR>): <time>` when zones differ. Overlap layout: events starting within 15 min of each other share the column width; hour height 128 px; multi-day events clamp to 23:59 on the start day (week/day modes). (Calendar mechanics: 15.)

#### 4.1.4 Event detail extras (`PostDetail`)
- `EventBody` rendered `expanded` (two-line time, people dialog enabled).
- If `meetingLink` non-empty: dashed box with video icon, text `Join this event online`, button `Join online` → opens link in new tab (`https://` prepended if the stored value does not start with `http`). Shown to anyone who can see the post, including past events.
- People dialog title `Responses`; lists **all** invitations (any response, incl. unanswered) with name, avatar and the response label (`Going`/`Interested`/`Not Going`) right-aligned; search box `Find a member` appears when >7 people; selecting a row shows the member card on the right half.

#### 4.1.5 Time display rules

`formatDatePair({ start, end, timezone, locale })` (packages/shared `DateTimeHelpers`):
- Day-before-month formats for every locale except `en-US`.
- Date part: `ccc MMM d` (en-US) / `ccc d MMM` (others); year appended (`, yyyy` / ` yyyy`) only when the start year ≠ current year.
- With time: `<date> • <time>` where time is Luxon `t` (locale short time). When **no end** is given the timezone abbreviation `ZZZZ` is appended to the start.
- End: same calendar day → only `t ZZZZ`; end year < current year → full date with year + tz; else date without year + time + tz. Joined as `from - to` (or `{from,to}` object).
- Examples (en-US, current year): `Tue Mar 4 • 7:00 PM - 9:00 PM PST`; multi-day `Fri Mar 7 • 6:00 PM - Sun Mar 9 • 12:00 PM PST`.

`formatEventTimeDisplay` returns `primary` = pair in the event timezone and `secondary` = pair in the viewer's zone if different. `EventTimeDisplay`:
- `showSecondary` (detail): if zones differ → line 1 `Your time: {{time}}` (viewer zone), line 2 (muted, xs) `Local time: {{time}}` (event zone); if same → single line without label.
- `showTooltip` (cards, list rows): viewer-zone text with a 550 ms-delay tooltip `Local time: …` when zones differ.

No all-day events and no recurrence exist anywhere in the code (no RRULE, no "repeat" UI).

#### 4.1.6 Invite dialog (`EventInviteDialog`)
Radix dialog portalled into the centre column (z 110/111, max-width 750 px, backdrop blur):
- Title (hard-coded English, not translated): `Invite to event: <event title>`.
- Search input (autofocus) placeholder `Search members`; fetches people of the event's groups (excluding the pseudo-group `public`) 30 per page, debounced 300 ms, infinite scroll (loads next page when the 10th-from-last row enters view). Client filters out already-invited people and the current user, sorted by name, case-insensitive substring match.
- Each suggestion row: avatar, name, checkbox; click toggles selection.
- Section `Already Invited`: every invitation with name and response label (if any).
- Submit button: `Select people to invite` (disabled, 0 selected) / `Invite 1 person` / `Invite {{n}} people`. Submitting calls `invitePeopleToEvent` and clears the selection; dialog stays open.

#### 4.1.7 Live indicator
Only the `Happening now!` badge on the event card/detail (client-side clock check). Nothing in calendar, list or grid views, and no server-side "live" state.

#### 4.1.8 Calendar data source
Calendar view mode fetches the visible month window with `afterTime`/`beforeTime`: server keeps posts with `end_time >= afterTime` **and** `start_time < beforeTime` (so ongoing events appear). Posts lacking times are excluded by these comparisons. Personal "my events" filters use `rsvpResponse` (`yes`, `no`, `interested`, or `yes+interested`), which inner-joins the viewer's `event_invitations`. `Person.eventsAttending` = events with response `yes` and `end_time > now`. View plumbing: 15.

#### 4.1.9 Calendar subscription UI (`GroupCalendarSubscribe`)
Rendered under the calendar only in **month** mode:
- In a group context: button with RSS icon, label `Subscribe to this Group's Calendar` (hard-coded English default — not in locale files). Hidden if the group has no `eventCalendarUrl`.
- In a non-group events view (My/All contexts, `view === 'events'`): button `Subscribe to all the Hylo events you have RSVPed to`. If the user has no RSVP feed yet, clicking first calls `updateMe({ settings: { rsvpCalendarSub: true } })` (which creates the token and builds the feed) and opens the modal with the returned `rsvpCalendarUrl`; on error nothing opens.
- Modal (title = button label; Cancel only): `Calendar subscription URL:` followed by the URL in monospace (click copies; title `Click to copy`), and buttons `Copy`, `Add to Apple or Outlook` (navigates to the URL with `http(s)://` replaced by `webcal://`), `Add to Google Calendar` (copies URL and opens `https://calendar.google.com/calendar/u/0/r/settings/addbyurl` in a new tab).
- There is no web UI to turn the RSVP feed off (setting can only be set false via API; that empties the file).
- No per-event "Add to calendar" button exists; per-event calendar entries arrive only as `invite.ics` attachments on RSVP emails.

### 4.2 Proposals

#### 4.2.1 Editor — proposal rows (in order, after Public toggle)

1. **Proposal template** row — shown only while the option list is empty. Label `Proposal template`; select with placeholder `Select a template`. Items (labels = translated template names): `Yes/No`, `Poll, Single Vote`, `Multiple Choice`, `Advice`, `Consent`, `Consensus`, `Gradient of Agreement`.
2. **Proposal options** row — label `Proposal options*`. Each option: emoji select (trigger shows the emoji or `Emoji`; first item `No emoji`, then the fixed emoji list below), text input placeholder `Describe option`, × to delete. Footer button with + icon: `Add an option to vote on...` (appends a blank option). Warnings: while editing and options differ from the saved ones → `When options are changed, existing votes will be discarded` (accent, triangle icon); with zero options → `Proposals require at least one option`.
3. **Voting method** row — label `Voting method`; select `Single vote per person` (`single`, default) / `Multiple votes allowed` (`multi-unrestricted`).
4. **Quorum** row — label `Quorum` + info icon with tooltip `quorumExplainer` = "Quorum is the percentage of members who need to participate in the decision for it to be considered valid"; range slider 0–100 step 1 showing `<n>%` (default 0; track filled `#D9EBF8` up to the value, `#c4c4c4` after).
5. **Anonymous Vote** toggle — eye-off (`Hidden`) icon, `Anonymous Vote:`, switch (green `#0DC39F` on / grey `#8B96A4` off), guidance `Voting will be anonymous` / `You can see how people voted`. Row background turns "selected" when on.
6. (Strict Proposal toggle — `Strict Proposal:` / `The proposal has stricter rules about editing. Hover for more details` / `The proposal is informal and easily edited` — component exists but is commented out: **not rendered**.)
7. **Voting window** row (same pickers as events, label `Voting window`) **with** remove buttons inside each field (× `Remove start time` / `Remove end time`, `data-testid post-editor-clear-start-time|end-time`), then **Timezone** row.
8. **Location** row (hidden by default; placeholder `Is there a relevant location for this proposal?`).

Emoji list (in order): `1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 ✅✅ 👍 👎 ⁉️ ‼️ ❓ ❗ 🚫 ➡️ 🛑 ✅ 🛑🛑 🌈 🔴 🔵 🟤 🟣 🟢 🟡 🟠 ⚫ ⚪ 🤷🤷 📆 🤔 ❤️ 👏 🎉 🔥 🤣 😢 😡 🤷 💃🕺 ⛔ 🙏 👀 🙌 💯 🔗 🚀 💃 🕺 🫶💯`.

Removing times asks first (dialog `data-testid=post-editor-remove-voting-time-dialog`, buttons `Cancel` / `Remove` (destructive)):

| Action | Title | Body |
|--------|-------|------|
| Remove start (also clears end) | `Remove the voting window?` | `This makes it a casual proposal: there will be no voting period and no deadline.` |
| Remove end, start already passed | `Remove the voting end time?` | `Voting will stay open with no deadline, and the proposal will never be marked as complete.` |
| Remove end, start in future | `Remove the voting end time?` | `Without an end time, voting will not open on its own at the start time, and there will be no deadline.` |

Other timed non-event types (request/offer/resource/project) remove times immediately without a dialog; removing start also removes end; changing start while there is no end keeps the end empty.

Validation: `At least one proposal option required` (client) and server `Proposals need at a least one option` (only when `proposalOptions` is passed as an empty array). Times are optional.

#### 4.2.2 Templates (exact data, `PROPOSAL_TEMPLATES`)

Applying a template **replaces** the option list, sets `votingMethod`, sets `quorum` to the template's (undefined → slider shows 0, saved as null), and sets the title only if the title is empty.

| Template key / label | Title prefill | Voting method | Options (emoji · text) | Tooltip text (defined, not shown in UI) |
|---|---|---|---|---|
| `Yes/No` | `''` | single | 👍 Yes · 👎 No | Simple yes or no poll |
| `Poll, Single Vote` | `Poll: ` | single | 1️⃣ Option 1 · 2️⃣ Option 2 · 3️⃣ Option 3 | Single vote poll |
| `Multiple Choice` | `Multiple Choice:` | multi-unrestricted | 1️⃣ Option 1 · 2️⃣ Option 2 · 3️⃣ Option 3 · 4️⃣ Option 4 · 5️⃣ Option 5 | A poll where users can vote multiple times |
| `Advice` | `Advice: ` | single | ✅ Agree · ❓ Concern | For the Advice Process - gather input before makig a decision |
| `Consent` | `Consent: ` | single | ✅ Consent · 🔴 Objection | Consent is a lighter weight consensus, is this good enough for now, safe enough to try? |
| `Consensus` | `Consensus: ` | single | ✅ Agree · ➡️ Abstain · 🟠 Disagree · 🔴 Block | Consensus means that everyone must agree. One block/veto stops the proposal |
| `Gradient of Agreement` | `''` | single | ✅✅ Strong Agree · ✅ Agree · ❓ Some concerns · ➡️ Abstain · 🔴 Disagree · 🔴🔴 Strong Disagree | Get a weighted opinion on a topic, how much do folks agree or not? |

Option texts are inserted literally (English) — not translated. `PROPOSAL_SCHEDULING = 'Scheduling'` constant exists without a template (dead).

#### 4.2.3 Proposal card section (`PostBodyProposal`, below title/details on card and detail)

A dashed, rounded box (border colour by state, brighter on hover) with a floating centered label straddling the top border:

| State (client) | Box colour | Label text |
|---|---|---|
| `discussion` | focus colour | `Discussion in progress` + muted ` • <start–end short range>` |
| `voting` | selected colour | `Voting open, select one` (single) / `Voting open, select one or more options` (multi) + ` • <range>` |
| `casual` (and not fulfilled) | selected colour | same as voting; no range (no start time) |
| complete = `proposal_status === 'completed'` **or** `fulfilledAt` set | neutral | `Voting ended` + end date (short) if it had a start time |

An eye-off icon with tooltip `Anonymous voting` precedes the label when anonymous.

Option rows (one per option, bordered rounded, emoji then text on the left; tally box on the right):
- Tally box: vote count (hidden while anonymous **and** voting not complete; shown once complete even if anonymous); up to 3 voter avatars (never when anonymous). Hovering the tally shows a tooltip listing voter names one per line (non-anonymous only).
- Highlighting: options the current user voted for → `bg-selected`. When voting complete **or** an outcome text exists → the top-voted option(s) (ties all highlighted) get a success (green) background.
- Clicking (only when status `voting`/`casual` and not complete), throttled 200 ms:
  - `single`: click own voted option → remove vote; no vote yet → add; otherwise → `swapProposalVote` (remove old, add new).
  - `multi-unrestricted`: toggle add/remove per option.
  - Optimistic store updates for add/remove/swap.
- `discussion` status: rows are inert.
- Quorum bar (§4.2.4) when `quorum > 0`.
- Outcome line `Outcome: <proposalOutcome>` when an outcome exists **and** `fulfilledAt` is set.

#### 4.2.4 QuorumBar
Inputs: `totalVoters` = sum of `memberCount` of all the post's groups (members in several groups counted repeatedly; NaN if group member counts are not loaded); `actualVoters` = distinct users among votes; `quorum` %.
- `votersForQuorum = ceil(quorum/100 × totalVoters)`; `quorumReached = actualVoters ≥ votersForQuorum`.
- Track: 13 px high, grey (`$color-cloud-grey`), radius 5. Three stacked bars: grey full-width base (z1), quorum bar `$color-regent` width `quorum%` (z2), actual-voters bar `$color-ultramarine` width `actual/total %` (z3).
- Text inside actual bar (only if quorum > 10): uppercase white 12 px: `Quorum reached` / `Quorum` / (status completed and not reached) `Quorum not reached`; when reached and quorum > 20 appends `voterCount` → `with {{count}} vote(s)` (en `voterCount_one`/`_other`).
- When not reached: label `<quorum>% (<actual>/<needed>)` positioned just right of the quorum bar (regent colour), or inside it in white when quorum > 70.
- Info icon with `quorumExplainer` tooltip to the left.

#### 4.2.5 Completion, outcome and header
- `PostHeader` time-window pill for proposals (and request/offer/resource/project/action): see §4.4.
- Fulfil toggle (`PostCompletion`, detail view only) appears for proposals only when status is `completed` or `casual`: prompt `Is this proposal still open?` with a Yes/No switch (checked = open).
- Outcome input: on the detail view, for the **creator** only, when the proposal is fulfilled: a text input, placeholder `Summarize the outcome` (hard-coded, untranslated). Every keystroke calls `updateProposalOutcome` (no debounce, no save button).

#### 4.2.6 Editing a proposal
- Saving any edit of a proposal shows a browser `confirm`: `Changing proposal options will reset the votes. Are you sure you want to continue?` — regardless of whether options changed.
- The web client always resends the option list on update, and the server deletes **all** votes whenever a non-empty option list is sent and options already exist (§5.2.4). So every saved edit of a proposal wipes all votes (options are re-inserted keeping their ids).
- There is no "strict proposal" locking; the creator can edit options, times, voting method, quorum, anonymity at any status.

### 4.3 Projects

#### 4.3.1 Editor rows
1. **Project Members** (right after body/attachments): label `Project Members`, `MemberSelector` limited to members of the selected groups; pre-filled with current members when editing. On save the creator's id is **always appended** to `memberIds` (create and edit), so the creator is always a member.
2. Timeframe + Timezone (optional, removable).
3. **Location** (visible by default).
4. **Accept Contributions** — only when the viewer has feature flag `PROJECT_CONTRIBUTIONS`. If the user has a Stripe account: switch + (when off) `If you turn 'Accept Contributions' on, people will be able to send money to your Stripe connected account to support this project.`; otherwise text "To accept financial contributions for this project, you have to connect a Stripe account. Go to [Settings](/settings/payment) to set it up. (Remember to save your changes before leaving this form)".
5. **Donation Link** — label `Donation Link`, placeholder `Add a donation link (must be valid URL)`.
6. **Project Management** — label `Project Management`, placeholder `Add a project management link (must be valid URL)`.
7. **Budget Total** — free text input (also shown for `submission` when the funding round `requireBudget`).

Link labels turn red when invalid; validation message `Donations and project management links must be valid URLs`. Saved through `sanitizeURL` (adds `https://` if needed; invalid → null).

#### 4.3.2 Project detail (no extra card section in the stream; card shows title/details like a discussion)
For logged-in viewers, below the body, a column of dashed boxes:
1. **Join section** (`JoinProjectSection`): `PeopleInfo` of members (captions: `No project members`; `<name> is a member`; `You are a member`; `… are members`) + outline button `Join Project` / `Leave Project` (based on whether the viewer is in `members`). Clicking avatars/caption opens the people dialog titled `Project Members` (no response labels).
2. **Project management link**: if the URL contains one of `asana|trello|airtable|clickup|confluence|teamwork|notion|wrike|zoho` → `This project is being managed on <logo /assets/pm-tools/<tool>.svg>` + button `View tasks`; otherwise `View project management tool` + `View tasks`. Opens in new tab.
3. **Donation link**: if URL contains `cash|clover|gofundme|opencollective|paypal|squareup|venmo` → `Support this project on <logo /assets/payment-services/<service>.svg>` + `Contribute`; else `Support this project` + `Contribute`.
4. (Legacy) `ProjectContributions` Stripe widget — only if `acceptContributions` and flag; in practice never shown because the web post query does not fetch `acceptContributions` (§9).

Big-grid item shows a `Contribute` link chip (with service logo) for any post with a donations link.

Join/leave is optimistic (creates/deletes the local member record).

### 4.4 Requests, offers, resources (and timed projects/proposals): time window & completion

#### 4.4.1 Header time-window pill (`PostHeader`, types `action`, `offer`, `request`, `resource`, `project`, `proposal`; not events/discussions; hidden on constrained cards)
Computed with `formatUserDatePair` in the post timezone. `actualEnd = fulfilledAt` if fulfilled before `endTime`, else `endTime`.
- Start part (omitted once fulfilled): start in future → `Starts: {{from}}`; start past but end in future → `Started: {{from}}`; else none.
- End part: fulfilled on/before end → `Completed: {{endTime}}`; end in future → `Ends: {{endTime}}`; end passed → `Ended: {{endTime}}`.
- Joined as `Starts: … / Ends: …`. When no start part is shown the end is formatted with its full date. Pill: selected-colour 10% background, bold xs text.

#### 4.4.2 Fulfilment toggle (`PostCompletion`)
Shown on the **detail** view (expanded header) when the type is in `offer, request, resource, project, proposal` (proposal only if `completed`/`casual`) **and** the viewer is the creator or has `Administration`/`Manage Content` in any of the post's groups:

| type | Prompt |
|------|--------|
| request | `Is this request still needed?` |
| offer | `Is this offer still available?` |
| resource | `Is this resource still available?` |
| project | `Is this project still active?` |
| proposal | `Is this proposal still open?` |

Yes/No switch, checked (= Yes) while not fulfilled. Turning it off → `fulfillPost`; on → `unfulfillPost`. Creator: secondary-coloured box. Non-creator moderator: accent box with uppercase heading `Moderator`.

Fulfilled posts render at 60% opacity in stream cards, list rows and grids, and list/grid titles get a green `CircleCheckBig` icon.

There is no "who helped" contributor picker in the current UI (§9).

### 4.5 Discussions
No type-specific fields. Discussions cannot have times (`canHaveTimes` excludes `discussion`, `action`, `submission`, `chat` in the editor) and cannot be fulfilled.

### 4.6 Resources
Same as request/offer: optional timeframe, location shown by default, fulfilment prompt `Is this resource still available?`, included in digest reminders.

### 4.7 Actions & submissions (brief)
- `action` posts (track steps) carry `completionAction` ∈ `button | comment | reaction | selectMultiple | selectOne | text | uploadFile` and `completionActionSettings` `{ instructions, options? }`. Editor section "How can people complete this {{actionDescriptor}}?" with labels `Mark complete / Done button`, `Leave a Comment`, `Emoji Reaction`, `Multiple Choice - Select Multiple`, `Multiple Choice - Select One`, `Respond to a question or prompt`, `Upload attachment`; per-type default instructions (`postCompletionActions.<type>.instructions`). Completion stored on `posts_users.completed_at/completion_response` (JSON array; text responses sanitized HTML). Reaction/comment actions complete automatically when the user reacts/comments. Stewards (tracks responsibility) see `ActionCompletionsSection` (`No one has completed this action yet` / `… have completed this action`, button `View All Responses`) opening `ActionCompletionResponsesDialog` titled `Completions: By Button|By Comment|By Reaction|By Selected Options|By Selected Option|By Text Reflection|By File Upload`, one row per response (avatar, name, completed date, rendered response). `completionResponses` GraphQL relation: admins of any of the post's groups see all, others only their own. Full spec: [21-tracks.md](21-tracks.md).
- `submission` posts belong to a funding round; editor header `Add/Edit {{submissionDescriptor}}`, criteria box, optional Budget Total, always non-public, no notifications to group members. Full spec: [22-funding-rounds.md](22-funding-rounds.md).
- Requests/offers have **no** completion actions; the "completion" concept for them is fulfilment (§4.4.2).

---

## 5. Business rules & side effects

### 5.1 Events

#### 5.1.1 Create (`createPost` with `type: 'event'`)
After the generic create (13), inside `afterCreatingPost`:
1. Queue `Post.processEventCreated({ postId, eventInviteeIds, userId, silent })`:
   - Create the creator's own invitation: `inviter_id = user_id = creator`, `response = 'yes'` (creator is automatically "Going").
   - `updateEventInvitees(uniq([creator, ...eventInviteeIds]))` — adds missing invitations (`response NULL`, `inviter_id = creator`), removes any not in the list.
   - `createGroupEventCalendarSubscriptions()` → for each of the post's groups queue `Group.createEventCalendarSubscription`.
   - Unless `silent`: `sendUserRsvp(ownerInvitation, { new: true })` → creator receives an RSVP email with `invite.ics`.
   - Queue `User.createRsvpCalendarSubscription({ userId: creator })`.
2. Unless silent, queue `Post.createActivities`: besides the generic `newPost`/mention/announcement activities, one activity per existing invitation with reason `eventInvitation` (reader = invitee, actor = inviter). Former members of all the post's groups and the author are dropped. (Race: this job reads invitations independently of `processEventCreated`; invitees whose rows are not yet written are missed.)

#### 5.1.2 RSVP (`respondToEvent(id, response)`)
- `response` must be one of `yes|no|interested` → else error `response must be one of yes,no,interested. received <x>`. Event must exist (`Event not found`). No visibility/membership check.
- Upsert invitation: update `response` on the existing row, or create one with `inviter_id = user_id`.
- `sendRsvp` when the "going" state flips (`going = yes|interested`):

| previous \ new | yes | interested | no |
|---|---|---|---|
| none / NULL / no | email `{new:true}` + rebuild user feed | same | nothing |
| yes / interested | nothing | nothing | email `{deleted:true}` (cancel) + rebuild user feed |

  Emails are sent even if the user has a calendar feed. Group feed is not rebuilt on RSVP.
- Returns `{ success: true }`.

#### 5.1.3 Invite (`invitePeopleToEvent(eventId, inviteeIds)`)
- For each invitee without an invitation, create one (`inviter_id = caller`, `response NULL`). Runs as un-awaited `forEach(async)` — the mutation can return before rows exist.
- Then `createInviteNotifications(caller, inviteeIds)` → `eventInvitation` activity for **every** id passed (including people already invited). No permission check (any logged-in user, any event id).
- Returns the event Post (client re-reads `eventInvitations`).

#### 5.1.4 Update (`updatePost` on an event)
- Before saving, `getEventChanges` compares: `start_time`, `end_time` (ms equality), `location` (string), `meeting_link` (string). Each key holds the new value if changed, else `false` (an empty new location/link counts as "not changed").
- Queue `Post.processEventUpdated`:
  - `updateEventInvitees(eventInviteeIds)` — add new invitees silently (**no notification**), and **delete** invitations (including RSVPs and the creator's own) for anyone not in the list.
  - Rebuild all yes/interested users' RSVP feeds and all groups' feeds.
  - If any of time/location/link changed → `sendUserRsvps({ eventChanges })`: update email (`sendEventRsvpUpdateEmail`) to every yes/interested invitee, with `newDate` (formatted pair) when a time changed and `newLocation` when venue/link changed.
- Title/description changes alone send nothing.

#### 5.1.5 Delete (`deletePost`, creator only)
Deactivate post, then queue `processEventDeleted`: rebuild yes/interested users' feeds and groups' feeds (deleted events drop out), and send a cancellation email (`sendEventRsvpCancelEmail`, METHOD:CANCEL) to every yes/interested invitee. (Moderator "remove from group" does not trigger this.)

#### 5.1.6 RSVP email (`sendUserRsvp`)
Template chosen by `eventChanges`: `new` → `sendEventRsvpEmail`; `deleted` → `sendEventRsvpCancelEmail`; otherwise `sendEventRsvpUpdateEmail` (SendWithUs templates). Payload `data`:

| field | value |
|---|---|
| `date` | `formatDatePair(start, end, event timezone, recipient locale)` |
| `user_name` | recipient name |
| `event_name` | title |
| `event_description` | processed HTML details |
| `event_location` | venue; venue + `\nJoin online: <link>` if both; or just the link |
| `event_url` | post URL in its first group |
| `response` | `Going to` / `Not Going to` / `Interested in` |
| `group_names` | comma-joined names of all groups |
| `newDate`, `newLocation` | only for updates |

`sender.name` = group-branded sender name (`senderNameForGroup(firstGroup, locale)`). Attachment `invite.ics` (base64) built by `createCalInvite`. After queuing, the invitation's `ical_sequence` is incremented.

#### 5.1.7 iCalendar event data (`getCalEventData`) — used by emails and both feeds
| iCal field | value |
|---|---|
| UID | `event-<postId>-hylo.com` |
| SUMMARY | post title |
| DESCRIPTION | details as plain text; if both venue and link: `<text>\n\nJoin online: <link>` |
| LOCATION | venue, else meeting link, else empty |
| DTSTART/DTEND | stored UTC instants (new values when announcing a change); no TZID |
| STATUS | `CANCELLED` if deleted or recipient's response is `no`; `CONFIRMED` if yes/interested; omitted otherwise (group feed) |
| METHOD (calendar) | `CANCEL` if deleted/`no`, else `REQUEST` |
| SEQUENCE | invitation's `ical_sequence`, falling back to the post's |
| URL | post URL (omitted when deleted) |
| ORGANIZER | creator name + **email** |
Calendar scale `GREGORIAN`.

#### 5.1.8 Calendar feeds
- **Group feed** (`Group.createEventCalendarSubscription`, queued per group on event create/update/delete): ensure token; select the group's active `event` posts with `start_time > now − 1 year`; calendar name `All Events for <group name>`, description `All the events in group <group name> on Hylo`; write to S3 path `…/group/<id>/calendar-<token>.ics`, `Content-Type: text/calendar`. Includes events regardless of post `is_public`. The file does not exist until the first event job runs for that group.
- **User RSVP feed** (`User.createRsvpCalendarSubscription`): returns early if the user has no `calendar_token`. If `settings.rsvp_calendar_sub` is true: all the user's invitations with response yes/interested on active events with `start_time >= now − 1 year`; else an **empty** calendar (how "turning off" works). Calendar name `My Hylo Events`, description `All the events I have RSVPed to on Hylo`. Each entry uses the user's invitation (status/sequence) and URL in the event's first group. Triggered by: RSVP flips, event create (creator), event update/delete (all yes/interested), and `updateMe` toggling `rsvpCalendarSub` (true: creates token if missing).
- Feeds are rebuilt in full each time; external calendar apps poll the static URL.

#### 5.1.9 Reminders
No event-specific reminder notifications or cron. The only "reminder" is the group digest (§5.3.3).

### 5.2 Proposals

#### 5.2.1 Status computation on create **and every update** (`setupPostAttrs`, applied to all post types)
```
if no startTime:                status = 'casual'
else if startTime < now:        status = 'voting'   else 'discussion'
if endTime && endTime < now:    status = 'completed'   (only if startTime set)
```
So editing a completed proposal and moving its end into the future reopens it (`voting`); removing the start makes it `casual`.

#### 5.2.2 Cron (`every10minutes` → `Post.updateProposalStatuses`)
SQL on `type='proposal'` rows with both times set and status not in (`casual`,`completed`): now between start and end → `voting`; now > end → `completed`. Never moves anything out of `completed`/`casual`; proposals with a start but no end are never updated (stay `discussion` or `voting` forever). Granularity ≈ 10 min, so status can lag the window. No notification is sent on status changes (no "voting opened/closed" or quorum alerts).

#### 5.2.3 Voting mutations
| Mutation | Rules |
|---|---|
| `addProposalVote(postId, optionId)` | all args required (`Missing required parameters: …`); `Post.isVisibleToUser` (public, or member of a post group, or follower) else `You don't have permission to vote on this post`; status must be `voting` or `casual` else `Cannot vote on a proposal that is in discussion or completed`; voter becomes a follower; inserts a vote (no single-vote or duplicate check server-side); errors wrapped as `adding of vote failed: …`. |
| `removeProposalVote(postId, optionId)` | same checks; deletes the voter's vote on that option (returns success even if none). |
| `swapProposalVote(postId, removeOptionId, addOptionId)` | same checks; ids must differ (`You cannot swap a vote for the same option`); remove then add. |
| `setProposalOptions(postId, options)` | visible-to-user; status must be `discussion` else `Proposal options cannot be changed unless the proposal is in 'discussion'`; raw SQL delete + insert. Not used by web. |
| `updateProposalOptions(postId, options)` | visible-to-user (not author-only!); rejected only when status is `completed`; see 5.2.4. Not used by web directly (web goes through `updatePost`). |
| `updateProposalOutcome(postId, proposalOutcome)` | author only (`You don't have permission to modify this post`); stores any string. |

Fulfilled-but-casual proposals still accept votes server-side (only the UI blocks them).

All vote/option/outcome changes call `Post.afterRelatedMutation(changeContext: 'vote')` → real-time post update to subscribers (13/01).

#### 5.2.4 Options on create/update
- Create: `setProposalOptions` inserts all given options (`color`/`emoji` default `''`).
- Update via `updatePost` with `proposalOptions` → `updateProposalOptions`: if the new list is non-empty and options exist → (a) `voteReset` activity for every distinct past voter (actor = post author), (b) **delete all votes**, (c) delete all options, (d) insert the new list (ids from the client are kept). If the new list is empty, nothing changes.
- `voteReset` activities: reason not in `Notification.priorityReason`'s list, so no push/email is ever produced and the in-app presenter has no text for it → effectively invisible (push text `<person> changed the options for proposal: "<title>" in <group>. This has reset the votes` exists but is unreachable).

#### 5.2.5 Quorum & outcome
Quorum is purely presentational (client QuorumBar). The server never evaluates quorum, never sets `proposal_outcome` automatically, and never notifies stewards. `proposalOutcome`/`proposalStatus` arguments on post queries are accepted but not applied by the search layer.

### 5.3 Requests, offers, resources, projects, proposals: fulfilment & expiry

#### 5.3.1 `fulfillPost` / `unfulfillPost`
- Allowed types: `offer, request, resource, project, proposal` (proposal only when status `completed` or `casual`).
- Permission: the author, or a user with `Administration` or `Manage Content` in **any** of the post's groups (`You don't have permission to modify this post`; missing post `Post does not exist`). Note the author path skips the type check.
- `fulfill`: sets `fulfilled_at = now` (and would create `Contribution` rows + `newContribution` activities for `contributorIds`, which the GraphQL mutation never passes). `unfulfill`: clears `fulfilled_at`, removes contributions and their activities.
- Real-time update (`changeContext: 'completion'`).
- Moderator action (actor ≠ author): activity to the author with reason `postFulfilled` / `postUnfulfilled` (group = first post group) → in-app `<strong>{{name}}</strong> closed your post` / `reopened your post` with body `"<post summary>"`; push `<actor> closed your post "<title>"` / `reopened …`; email subject `Your post was closed` / `Your post was reopened`, body `<actor> closed your post "<title>" in group <group>. \n<post url>` (subject to the author's membership email/push settings).

#### 5.3.2 Expiry semantics (end time)
No job changes a post when its `end_time` passes. Instead queries treat it as done:
- `isFulfilled: true` → `fulfilled_at IS NOT NULL OR end_time < today` ; `isFulfilled: false` / `activePostsOnly` → `fulfilled_at IS NULL AND (end_time IS NULL OR end_time >= today)` (date compared at day precision, UTC date string).
- UI shows `Ended: …` in the header pill.

#### 5.3.3 Digest reminders (`Post.upcomingPostReminders`, used by daily/weekly group digests, 19)
Window = now → end of day (America/Los_Angeles) + 2 days (daily) or + 7 days (weekly); groups = the group and its spaces; active, unfulfilled posts only.
- **Starting soon** (`upcoming`): types event, offer, project, proposal, resource, request with `start_time` in the window, ascending.
- **Ending soon** (`ending`): types request, offer, resource, proposal with `end_time` in the window **and** `start_time < now` (posts with no start time are never included), ascending.
Rendered in the digest as one-line items (`start_time`/`end_time` formatted pairs). Digests are sent hourly-cron at 12:00 LA time (daily; weekly on Wednesday). There are no reminders addressed to the post creator.

### 5.4 Projects
- `createPost(type: 'project')` → after create `setProjectMembers(memberIds)`; `updatePost` with `memberIds` → `setProjectMembers` again (removes every current member — `project_role_id = null`, `following = false` — then re-adds the given list with the `member` role and `following = true`). Side effect: members not resent lose membership and stop following the post.
- `joinProject(id)`: `addProjectMembers([me])` — upsert `posts_users` with member role, `following=true`, `active=true`. No checks (visibility, type, group membership). Returns `{success:true}`.
- `leaveProject(id)`: sets `project_role_id = null`, `following = false` for me.
- `Person.projects` = active `posts_users` rows with non-null `project_role_id` on project posts.
- No notifications for join/leave.
- **Stripe contributions (legacy, flag `PROJECT_CONTRIBUTIONS`)**: `processStripeToken(postId, token, amount)` — requires `STRIPE_SECRET_KEY` (`Stripe is not configured…`), project exists (`Can't find project with that id`), creator has a connected Stripe account (`This user does not have a connected Stripe account`). Creates a USD charge of `amount×100` cents on the creator's connected account with 1% application fee, description `<contributor> contributing to project <name> - project id: <id>`; stores `project_contributions.amount` in cents; activities `donation to` (reader = contributor) and `donation from` (reader = creator) → emails `sendDonationToEmail`/`sendDonationFromEmail`, push `You contributed $<amount> to "<title>"` / `<name> contributed $<amount> to "<title>"`, in-app `<strong>You</strong> contributed to a project` / `<strong>{{name}}</strong> contributed to your project`.

### 5.5 Legacy project roles (dead)
`createProjectRole(projectId, roleName)` (error `A role with that name already exists in this project`), `deleteProjectRole(id)`, `addPeopleToProjectRole(peopleIds, projectRoleId)`. Moderation check `getModeratedProject`: author, or `Administration` responsibility looked up with the **project id as group id** (bug noted in code). `addPeopleToProjectRole` calls group-membership APIs on a post and cannot work. `createProject(data)` mutation (adds creator to members) is marked unused; web uses `createPost`.

### 5.6 Silent posts
A steward-only `silent: true` create skips the event creator's RSVP email and all `eventInvitation`/newPost activities (but invitations and feeds are still created).

### 5.7 Notification summary (type-specific reasons)

| Reason | Trigger | Reader | In-app (header / body) | Push | Email |
|---|---|---|---|---|---|
| `eventInvitation` | event created with invitees; `invitePeopleToEvent` | invitee | `<strong>{{name}}</strong> invited you to an event` / `<strong>{{name}}</strong> invited you to: "{{postSummary}}"` | `<inviter> invited you to "<title>"` | `sendEventInvitationEmail` (post presented for email, reply-to post address, sender `<inviter> via Hylo`) |
| (RSVP email) | RSVP flip, event create (creator), event update/delete | the responder / all yes+interested | — | — | RSVP new / update / cancel templates with `invite.ics` |
| `voteReset` | options changed on update | past voters | none (unreachable) | none | none |
| `postFulfilled` / `postUnfulfilled` | moderator fulfils/unfulfils | author | see §5.3.1 | yes | yes |
| `donation to` / `donation from` | Stripe contribution | contributor / creator | see §5.4 | yes | yes |
| `newContribution` | request fulfilled with contributors (legacy) | contributor | — | `You have been added as a contributor to the request "<title>"` | — |

Delivery media are filtered by membership notification settings (19); readers who have left all the post's groups get nothing.

---

## 6. Permissions

| Action | Who |
|---|---|
| Create typed post | Member of every destination group, and each group must accept the type (`accepted_post_types`; `requests-and-offers` alias covers request+offer). See 13/11. |
| Edit / delete post (incl. options, times, invitees, members) | Creator (UI). Delete enforced server-side (author only). |
| RSVP | Any logged-in user who can load the event (server performs no visibility check). UI hides RSVP for past events and logged-out viewers. |
| Invite to event | Any logged-in user (UI: anyone who sees the card; server: no check). Invitee picker limited to members of the event's groups. |
| See attendee/response list | Anyone who can see the post. |
| Vote / change vote | Anyone to whom the post is visible (public, member of a post group, or follower), during `voting`/`casual`. |
| Change options via `updateProposalOptions` | Any user who can see the post (server), unless `completed`. |
| Set proposal outcome | Author only. |
| Fulfil / unfulfil | Author, or `Administration`/`Manage Content` in any post group. |
| Join / leave project | Any logged-in user (no server checks). |
| See group calendar URL | Anyone who can query the group (`eventCalendarUrl` has no extra gate); the feed itself is public to anyone with the URL. |
| See action completion responses | Admins of a post group see all; others only their own. |
| Contribute money (legacy) | Users with `PROJECT_CONTRIBUTIONS` flag. |

---

## 7. API

### 7.1 Post fields (type-specific)
`startTime`, `endTime`, `timezone`, `location`, `locationObject`, `meetingLink`, `myEventResponse`, `eventInvitations(first,cursor,order): EventInvitationQuerySet { total hasMore items { id response person { id name avatarUrl } } }`, `proposalStatus`, `proposalOutcome`, `votingMethod`, `quorum`, `isAnonymousVote`, `anonymousVoting`, `isStrictProposal` (always null), `proposalOptions: ProposalOptionQuerySet { items { id postId text emoji color } }`, `proposalVotes: ProposalVoteQuerySet { items { id optionId createdAt user { id name avatarUrl } } }` (returned **even when anonymous**), `members(first,cursor,order): PersonQuerySet`, `postMembershipsTotal`, `donationsLink`, `projectManagementLink`, `budget`, `acceptContributions`, `totalContributions` (no resolver → null), `fulfilledAt`, `completionAction`, `completionActionSettings`, `completedAt`, `completionResponse`, `completionResponses: PostUserQuerySet`, `numPeopleCompleted`.

### 7.2 PostInput (type-specific)
`startTime: Date`, `endTime: Date`, `timezone`, `location`, `locationId`, `meetingLink`, `eventInviteeIds: [ID]`, `proposalOptions: [ProposalOptionInput { id text emoji color }]`, `votingMethod`, `quorum: Int`, `isAnonymousVote: Boolean`, `isStrictProposal` (ignored), `memberIds: [ID]`, `donationsLink`, `projectManagementLink`, `budget`, `acceptContributions`, `completionAction`, `completionActionSettings: JSON`, `silent`.

### 7.3 Mutations
```
respondToEvent(id: ID, response: String): GenericResult          # 'yes'|'interested'|'no'
invitePeopleToEvent(eventId: ID, inviteeIds: [ID]): Post
addProposalVote(postId: ID, optionId: ID): GenericResult
removeProposalVote(postId: ID, optionId: ID): GenericResult
swapProposalVote(postId: ID, addOptionId: ID, removeOptionId: ID): GenericResult
setProposalOptions(postId: ID, options: [ProposalOptionInput]): [ProposalOption]     # returns success object in practice
updateProposalOptions(postId: ID, options: [ProposalOptionInput]): [ProposalOption]
updateProposalOutcome(postId: ID, proposalOutcome: String): GenericResult
fulfillPost(postId: ID): GenericResult
unfulfillPost(postId: ID): GenericResult
completePost(postId: ID, completionResponse: JSON): Post          # actions (21)
joinProject(id: ID): GenericResult
leaveProject(id: ID): GenericResult
createProject(data: PostInput): Post                              # unused
createProjectRole(projectId: ID, roleName: String) / deleteProjectRole(id: ID) / addPeopleToProjectRole(peopleIds: [ID], projectRoleId: ID)   # legacy
processStripeToken(postId: ID, token: String, amount: Int): GenericResult   # legacy, amount in dollars
updateMe(changes: { settings: { rsvpCalendarSub: Boolean } })     # RSVP feed toggle (05)
```

### 7.4 Query filters (posts)
`afterTime`/`beforeTime` (calendar window), `rsvpResponse` (`yes|no|interested|yes+interested`, current user), `isFulfilled`, `activePostsOnly`, `types`/`filter` (type), `proposalStatus`/`proposalOutcome` (accepted, not applied). `Group.eventCalendarUrl`, `Me.rsvpCalendarUrl`, `Me.settings.rsvpCalendarSub`, `Person.eventsAttending`, `Person.projects`.

### 7.5 Background jobs
`Post.processEventCreated`, `Post.processEventUpdated`, `Post.processEventDeleted`, `Post.sendUserRsvp` (class method), `User.createRsvpCalendarSubscription`, `Group.createEventCalendarSubscription`, `Post.createActivities`, `Contribution.createActivities`; cron `every10minutes`: `Post.updateProposalStatuses`; digests: `Post.upcomingPostReminders`.

---

## 8. Edge cases & known quirks

1. **Editing an event can drop RSVPs**: the editor's Invite People field contains every invitation; removing someone there deletes their invitation (and their RSVP) with no email/feed cancel. Newly added invitees during edit get no notification.
2. Duplicating an event drops invitations; the copy gets only the creator's own `yes`.
3. Event attendee strip counts only `yes`; the Responses dialog lists everyone, including unanswered invites and `no`.
4. `Upcoming` (≤72 h) / `Happening now!` / `Event ended` are computed at render time from the browser clock; no live refresh.
5. Changing the editor timezone keeps the wall-clock time, shifting the actual instant.
6. ICS feeds and RSVP attachments carry UTC times with no TZID; organizer email is published in every feed and invite.
7. Group feed URL is returned even before the file exists (404 until the first event job runs for the group); RSVP feed similarly until first build.
8. `invitePeopleToEvent` notifies every id passed, even already-invited people, and may return before invitations are stored.
9. `respondToEvent` and `joinProject` have no visibility checks.
10. Proposal: saving **any** edit resets all votes (client always resends options; confirm dialog appears even when only the title changed). `voteReset` notifications are never delivered.
11. Proposal status is recomputed from times on every save (can reopen completed proposals); cron leaves start-only proposals in `discussion`/`voting` forever.
12. Single-vote is enforced only in the UI; the API permits multiple/duplicate votes.
13. Anonymous voting only hides names/avatars/counts in the web UI; `proposalVotes` (with users) is still returned by the API.
14. QuorumBar's denominator is the sum of `memberCount` over the post's groups (double counts cross-posted members; NaN if counts not loaded); quorum is never evaluated server-side.
15. Applying a template sets `quorum` to undefined (template has no quorum).
16. Proposal outcome field saves on every keystroke, is untranslated, and is only visible (as `Outcome: …`) once the proposal is fulfilled. Highlight of winning options also triggers when an outcome text exists.
17. `proposal_status` is written for every post type (`casual` for untimed posts).
18. `anonymous_voting` is a text column; `isAnonymousVote` true only when the string is exactly `'true'`.
19. Project editor always re-adds the creator as a member; `setProjectMembers` resets every member's `following` flag.
20. Legacy Stripe contributions: never rendered (fragment lacks `acceptContributions`), `totalContributions` unresolved, and `ProjectContributions` calls `processStripeToken(postId, tokenId, amount)` while the parent expects `(token, amount)` — would send wrong arguments.
21. `meeting_link` is cleared by any create/update that omits `meetingLink` (e.g. API clients/Zapier editing an event).
22. Event time validation exists only in the client.
23. Hard-coded English strings: `Invite to event: <title>`, `Subscribe to this Group's Calendar`, `Summarize the outcome`, proposal template option texts and titles.
24. Fulfilment author path does not check post type (author can "fulfil" a discussion/event via API).
25. `isFulfilled`/`activePostsOnly` compare `end_time` against today's UTC date string (day precision): a post ending earlier today still counts as active.

---

## 9. Docs vs. code

| Docs claim | Code reality |
|---|---|
| Completing requests/offers lets you "select the people who helped" (feature spec, steward guide §12) | No contributor picker; `fulfillPost` takes only `postId`. Contributors model exists but is unreachable. |
| "If quorum isn't reached, stewards are notified" (feature spec, steward guide §13) | No quorum evaluation or notification anywhere. |
| Presets "Agree/Disagree, Consent/Block/Abstain, Sense Check, Gradients of Agreement" | Templates are Yes/No, Poll Single Vote, Multiple Choice, Advice, Consent (Consent/Objection), Consensus (Agree/Abstain/Disagree/Block), Gradient of Agreement. No "Sense Check". |
| "Live indicator … in the stream and calendar" | Only the `Happening now!` badge on event cards/detail; calendar has none. |
| RSVP "attending (or if they're a maybe)" / schema says `'maybe'` | Values are `yes`, `interested`, `no` (UI: Going / Interested / Not Going). |
| "Stewards can see the guest list" | Anyone who can see the event sees attendees and the Responses dialog. |
| "Export events … via calendar invite emails" | True, plus per-group and personal ICS subscription feeds (not documented). |
| Requests/offers "Expiration and reminders: notifications remind creators" | No creator reminders; only group digest "starting/ending soon" sections; expiry is query-time only. |
| Projects "Linked content: connect posts, events… to a project" | Not implemented. |
| "Proposals move through phases automatically, or stewards can manage timing manually" | Automatic via 10-minute cron; manual = author editing times. Stewards have no special controls. |
| Outcome "displayed on completed proposals" | Displayed only after the proposal is marked fulfilled (`fulfilledAt`), not merely completed. |

---

## 10. Source references

- Backend models: `apps/backend/api/models/Post.js` (status cron SQL, vote methods, options, `upcomingPostReminders`, `processEvent*`), `models/event/mixin.js`, `models/project/mixin.js`, `models/post/{setupPostAttrs,createPost,updatePost,validatePostData,fulfillPost,postFulfillmentPermissions}.js`, `EventInvitation.js`, `EventResponse.js` (dead), `ProposalOption.js`, `ProposalVote.js`, `ProjectRole.js`, `ProjectContribution.js`, `Contribution.js`, `PostUser.js`, `User.js` (`createRsvpCalendarSubscription`, `rsvpCalendarUrl`, `eventsAttending`, `projects`), `Group.js` (`createEventCalendarSubscription`, `eventCalendarUrl`), `Activity.js`, `Notification.js`, `PushNotification.js`.
- GraphQL: `apps/backend/api/graphql/{schema.graphql,makeModels.js,makeSchema.js}`, `mutations/{event,project,post,index}.js`; search filters `api/services/Search/util.js`.
- Cron/digests: `apps/backend/cron.js`, `lib/group/digest2/{util,formatData}.js`; i18n `apps/backend/lib/i18n/en.js`; email templates `api/services/Email.js`.
- Migrations: `20240218134105_proposals.js`, `20240610131324_proposalType-to-votingMethod.js`, `20251020145500_add-calendar-token.js`, `20251206183200_add-calendar-token-to-groups.js`, `20260116120000_backfill_calendar_tokens_for_groups.js`, `20260803120000_add_meeting_link_to_posts.js`, `schema.sql`.
- Web: `apps/web/src/components/PostEditor/PostEditor.js` (+ `AnonymousVoteToggle`, `StrictProposalToggle`), `components/PostCard/{EventBody,EventDate,EventRSVP,PeopleInfo,PostBodyProposal,PostCompletion,PostHeader,PostBody}`, `components/{EventInviteDialog,EventTimeDisplay,QuorumBar,SliderInput,PostPeopleDialog,ActionCompletionResponsesDialog,PostListRow,PostBigGridItem,Calendar/calendar-event.tsx,TimezoneSelect}`, `routes/PostDetail/{PostDetail.js,ProjectContributions}`, `routes/GroupCalendarSubscribe/GroupCalendarSubscribe.js`, `routes/ViewContent/ViewContent.js`, `store/models/Post.js` (templates/constants), `store/actions/{respondToEvent,joinProject,leaveProject,processStripeToken,updatePost,createPost}.js`, `store/reducers/ormReducer/index.js`, `util/url.js`, `config/featureFlags.js`, `graphql/fragments/postFieldsFragment.js`.
- Shared: `packages/shared/src/DateTimeHelpers/DateTimeHelpers.ts`, `packages/presenters/src/{EventInvitationPresenter,NotificationPresenter}.js`.
- Tests: `apps/backend/api/graphql/mutations/{event,project,createPostMeetingLink}.test.js`, `api/models/event/mixin.test.js`, `test/unit/services/digest2.test.js`; e2e `apps/web/e2e/{event-native-time-pickers,post-editor-remove-times}.spec.js`.
- Public docs: gitbook `product__full-feature-spec.md` (Events, Mutual Support, Projects, Governance), `guides__hylo-user-guide.md` (§13–14, §17), `guides__hylo-steward-guide.md` (§12–13).
