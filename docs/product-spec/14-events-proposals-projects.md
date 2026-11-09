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
