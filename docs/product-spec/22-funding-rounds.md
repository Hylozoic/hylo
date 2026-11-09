# 22 — Funding rounds

> Participatory funding rounds ("priority voting" / "co-budgeting"): members submit proposals, discuss them, and allocate a budget of tokens across them.
>
> Related: spaces, Add Space dialog, space lifecycle and More Spaces → [15-views-streams-spaces.md](15-views-streams-spaces.md); submission post type and post editor → [13-posts-comments.md](13-posts-comments.md); roles → [12-roles-permissions-moderation.md](12-roles-permissions-moderation.md); joining spaces → [10-joining-invitations.md](10-joining-invitations.md); notifications → [19-notifications-email-push.md](19-notifications-email-push.md); member directory capability pills → [20-members-profiles.md](20-members-profiles.md); flagging → 12; cron infrastructure → [01-architecture.md](01-architecture.md).

---

## 1. Overview

A **funding round** is a space (child `Group`, `type='space'`) whose `funding_round_id` points to a `funding_rounds` row (1:1; `funding_rounds.group_id` points back). The space provides name, description, banner, purpose, welcome page, access and the **lifecycle status**, which doubles as the round **phase**. Participants are the space's active members.

Flow: steward creates a Funding Round space (draft) → publishes → *submissions* (members add `submission` posts) → *discussion* (no new submissions, edits allowed) → *voting* (each eligible voter receives tokens and allocates them across submissions) → *completed* (results). Phases advance automatically from scheduled dates (cron every 10 minutes and on page view) or manually from the **Manage Round** view.

---

## 2. Concepts & data

### 2.1 `funding_rounds` table

| Column | GraphQL (`FundingRound`) | Type / default | Notes |
|---|---|---|---|
| `id` | `id` | serial | |
| `group_id` | `group` | FK groups, NOT NULL | The round space. |
| `criteria` | `criteria` | text (HTML) | "Submission criteria"; sanitised (`RichText.processHTML`). |
| `require_budget` | `requireBudget` | bool, false | Shows a `Budget Total` field in the submission editor (client-side only; not enforced). |
| `voting_method` | `votingMethod` | string NOT NULL | `token_allocation_constant` (every voter gets `total_tokens`) or `token_allocation_divide` (`floor(total_tokens / eligibleVoters)` each). Default `token_allocation_constant`. |
| `token_type` | `tokenType` | string | Display name of the token, UI default `Votes` (free text, e.g. a currency). |
| `total_tokens` | `totalTokens` | int | Required on create (`totalTokens is required`). UI default 100. |
| `min_token_allocation` | `minTokenAllocation` | int | Per-submission minimum (if > 0, an allocation must be 0 or ≥ min). Not exposed in the current settings UI. |
| `max_token_allocation` | `maxTokenAllocation` | int | Per-submission maximum. Not exposed in the current settings UI. |
| `submissions_open_at` | `submissionsOpenAt` | timestamp | Schedule; all four optional. |
| `submissions_close_at` | `submissionsCloseAt` | timestamp | |
| `voting_opens_at` | `votingOpensAt` | timestamp | |
| `voting_closes_at` | `votingClosesAt` | timestamp | |
| `submission_descriptor` | `submissionDescriptor` | string | UI default `Submission` (max 40). |
| `submission_descriptor_plural` | `submissionDescriptorPlural` | string | UI default `Submissions`. |
| `submitter_roles` | `submitterRoles: [GroupRole]` | jsonb `[]` of `{id}` | Empty = any participant may submit. Roles are the parent group's. |
| `voter_roles` | `voterRoles: [GroupRole]` | jsonb `[]` of `{id}` | Empty = any participant may vote. |
| `allow_self_voting` | `allowSelfVoting` | bool, false | |
| `allow_late_joiners` | `allowLateJoiners` | bool, false | Only meaningful for `token_allocation_constant`; forced false otherwise. |
| `hide_final_results_from_participants` | `hideFinalResultsFromParticipants` | bool, false | |
| `show_realtime_votes` | `showRealtimeVotes` | bool, false | Running totals during voting. |
| `show_realtime_submissions` | `showRealtimeSubmissions` | bool, false | Members see all submissions during the submissions phase. |
| `num_submissions` | (cached) | int 0 | GraphQL `numSubmissions` is computed live (active submission posts in the space). |
| `num_participants` | (cached) | int 0 | GraphQL `numParticipants` = space `num_members`. |
| `tokens_distributed_at` | `tokensDistributedAt` | timestamp | Legacy; not set by current code. |
| `deactivated_at` | — | timestamp | Soft delete (`deleteFundingRound`). Deactivated rounds are invisible to `find`. |
| `created_at`, `updated_at` | | | |

Legacy columns dropped: `title`, `banner_url`, `description`, `published_at`, `phase` (moved to space), single `submitter_role_id/type`, `voter_role_id/type`; legacy tables `funding_rounds_posts`, `funding_rounds_users` dropped.

### 2.2 Phase (= space `groups.status`)

Enum `FundingRoundPhase`: `draft`, `published`, `submissions`, `discussion`, `voting`, `completed` (plus space status `archived`). GraphQL `phase` returns the space status if it is one of these, else `draft`.

| Phase | UI name | Meaning |
|---|---|---|
| `draft` | Draft | Only stewards see it; not in menus. |
| `published` | "Round has not begun" (lobby) | Members can join and read criteria; chat open. |
| `submissions` | Submission Phase | Participants with submitter roles can add submissions. |
| `discussion` | Discussion Phase | No new submissions; authors may edit; all submissions visible. |
| `voting` | Voting Phase | Tokens distributed; eligible voters allocate. |
| `completed` | Round complete | Results shown. |

### 2.3 Participation state

Stored on the space membership: `created_at` (= `joinedAt`), `settings.tokensRemaining` (int; null until tokens distributed). Per-submission allocations: `posts_users.tokens_allocated_to` (int, default 0) for (voter, submission post).

### 2.4 Submissions

Posts with `type='submission'` attached to the round space (`groups_posts`); optional `budget` (string). Submissions are never public (`isPublic` forced false by the editor). Computed post fields: `tokensAllocated` (viewer's allocation), `totalTokensAllocated` (sum over voters).

### 2.5 Round chat room

On create, a topic named `‡funding_round_<roundId>` is created and added to the round space (subscribed). The space also gets a standard `chat` view by default.

### 2.6 Computed GraphQL fields

`canSubmit` / `canVote` (role check against parent group roles; empty list = true), `isParticipating`, `joinedAt`, `tokensRemaining`, `userSettings`, `totalTokensAllocated` (sum across the round), `allocations: [FundingRoundAllocation { user, submission, tokensAllocated }]` (all positive active allocations — returned to any viewer), `submissions` (PostQuerySet, ordered by id asc), `users` (participants).

---

## 3. Routes / entry points

| URL | Screen |
|---|---|
| `/groups/:slug/spaces/:spaceSlug` | Space index → home route; default `/funding-round-submissions` when no view has order 0. First entry after joining → `/welcome` if enabled. |
| `…/funding-round-submissions` | **Submissions view** (`FundingRoundSubmissionsView`). Header title = `submissionDescriptorPlural` (fallback `Submissions`), icon `ClipboardList`. |
| `…/funding-round-submissions/post/:postId` | Submission detail dialog. |
| `…/manage-round` | **Manage Round** (stewards only; others redirected to the space home). Header `Manage Round`, icon `Settings`. |
| `…/about/round-details` | About page tab with `FundingRoundAboutInfo`. |
| `…/members` | Space members with `Can Submit` / `Cannot Submit` / `Can Vote` / `Cannot Vote` pills and per-member `Can Submit` / `Can Vote` / `Viewer` tags. |
| `…/chat`, `…/welcome` | Standard space views. |
| `/my/funding-rounds` | **My Funding Rounds** — card grid of round spaces you belong to; empty: `You are not a member of any funding rounds`; icon `BadgeDollarSign`. |
| `/groups/:slug/funding-rounds/*` | Legacy → redirect to More Spaces. |
| Non-members | Space join interstitial (`Join Space`, paywall, request, role-gated messages). |

---

## 4. UX specification

### 4.1 Creating a round (Add Space → Funding Round)

Space type `Funding Round` (icon `BadgeDollarSign`). Defaults: no accepted post types; views `funding-round-submissions, chat, members, welcome`; welcome page on; tour offer `Setting up a funding round? Take a quick tour.`. **Funding Round Settings** block (`FundingRoundSettingsFields`):

| Field | Control | Default |
|---|---|---|
| `Unit term` / `Unit term plural` | text, max 40 | `Submission` / `Submissions` |
| `Submissions open`, `Submissions close`, `Voting opens`, `Voting closes` | date-time pickers (minute granularity; values truncated to the minute) | empty |
| `Voting method` | select: `Same number of tokens per voter` (`token_allocation_constant`) / `Divide total tokens evenly among voters` (`token_allocation_divide`); choosing divide turns off late joiners | constant |
| `Total tokens` | number ≥ 0 | 100 |
| `Token name` | text | `Votes` |
| `Show budget field for submissions` | switch | off |
| `Show all submissions to members during the submissions phase` (info tooltip: `By default, members only see their own submissions until submissions close. Admins always see every submission.`) | switch | off |
| `Allow participants to vote on their own submissions` | switch | off |
| `Allow people who join during voting to receive tokens and vote` | switch, disabled unless constant | off |
| `Show real-time votes during voting phase` (tooltip `By default votes are not visible until after voting ends.`) | switch | off |
| `Hide final results from participants` | switch | off |
| `Submitter roles` | multi role picker, placeholder `Anyone can submit` | none |
| `Voter roles` | multi role picker, placeholder `Anyone can vote` | none |
| `Criteria` | rich text, placeholder `Criteria for submissions` | empty |

Buttons `Save as Draft` / `Create and Publish`. After `createSpace`, the client calls `createFundingRound({ groupId, …fields })`; the backend links the space, creates the chat topic and joins the creator as a participant. Editing later: Space settings modal titled `Funding Round Space Settings` with the same fields and a single `Save` button (phase is managed in Manage Round, not via Save Draft/Publish).

### 4.2 Submissions view

Container max width 750px; if the viewer is neither participating nor a manager, the whole view has pointer events disabled (read-only).

**Round status panel** (`RoundPhaseStatus`, dashed 2px border, rounded, padding 16px, semibold sm):

- `published`/`draft` without open date: lock icon, `Submissions are not open yet`, `Check back soon to offer your {{submissionDescriptor}}`. With an open date (client phase `open`): `Submissions open at {{date}}`.
- `submissions`: file-check icon tile + `Submissions open!` (selected colour, xl bold), right pill `{{count}} {{submissionDescriptor}}` (count = visible submissions, descriptor plural). If the viewer can't submit and roles are set: amber warning `You cannot submit to this round` / `Only participants with one of the following roles can submit: {{roles}}` (`emoji name`, comma list). Then muted `Submissions close at {{date}}`, `Voting opens at {{date}}` when scheduled.
- `discussion`: message icon + `Discussion in progress`, count pill, `Submissions are closed. Discuss the {{submissionDescriptorPlural}} below and in the round Chat room.`, and `Voting begins {{date}}` when scheduled.
- `voting`: vote icon + `Voting in progress`; for eligible voters a bordered box `You have {{tokens}} {{tokenType}} remaining` (live, includes unsaved edits). Ineligible by role: amber `You cannot vote in this round` / `Only participants with one of the following roles can vote: {{roles}}`. Joined after voting opened without late joiners: amber `You cannot vote in this round` / `You joined after voting started. {{tokenType}} have already been allocated to participants who joined before voting began.`. Eligible voters see `Allocate your {{tokenType}} to the {{submissionDescriptorPlural}} you think deserve support.` (the plural is a link to the submissions view) and `Voting closes at {{date}}`. Always: `{{numSubmissions}} total {{submissionDescriptorPlural}}`. Then faded hints `Minimum of {{minTokenAllocation}} {{tokenType}} / {{submissionDescriptor}}` | `Maximum of …` when set.
- `completed`: check icon + `Round Complete!`; `{{numParticipants}} Participants allocated {{totalTokens}} {{tokenType}} to {{totalSubmissions}} {{submissionDescriptorPlural}}!`.

**Add button**: during `submissions` when the viewer can submit (participating + role): full-width bordered button `+ Add {{submissionDescriptor}}` → post editor for type `submission` (editor heading `Add {{submissionDescriptor}}` / `Edit {{submissionDescriptor}}`, shows the round criteria, and `Budget Total` field when `requireBudget`).

**Which submissions are listed**:
- Managers: always all.
- Others: all during `discussion`, `voting`, `completed`; during `submissions` only all if `showRealtimeSubmissions`, otherwise only their own.
- Order: newest first (id desc); in `completed`, sorted by `totalTokensAllocated` desc (ties id desc) when results are visible to the viewer. During `voting` (and `completed` with hidden results for non-managers) the list is **shuffled with a seed = viewer id** (stable per viewer, different between viewers) to avoid position bias.

**Submission card** (`SubmissionCard`; rounded-lg, `bg-card/50`, shadow-xl, margin-bottom 16px): left column — creator avatar (medium, hover card) + name link + relative time (tooltip exact), flag icon (links to moderation) if flagged, ⋮ menu; title (`h1`); `Budget: <budget>` if present; standard post footer (comments, reactions). ⋮ items: `Edit` (author, during submissions/discussion only), `Copy Link`, `Flag` (non-authors → flag dialog), `Delete` (author; confirm `Are you sure you want to delete this {{submissionDescriptor}}? You cannot undo this.`), `Remove from Round` (managers on others' submissions; confirm `Are you sure you want to remove this {{submissionDescriptor}}? You cannot undo this.`). Clicking title/meta opens the detail dialog.

Right column by phase:
- **Voting & eligible**: shaded column (100px, 120px ≥ sm): label `Your {{tokenType}}` (uppercase xs), a numeric input (80×48px, 2xl bold, centered). Typing clamps to ≥ 0, ≤ max allocation, ≤ available tokens (remaining + this card's current value); empty while focused shows blank. Validation messages (red): `You cannot vote on your own submission`, `Not enough tokens available`, `Cannot allocate more than {{max}} tokens per submission`, `Must allocate at least {{min}} tokens or 0`. On **blur** (not on change) the value is saved via `allocateTokensToSubmission` if valid and changed; on error it reverts. Mouse wheel blurs the field instead of changing it. Own submission without self-voting: input disabled (50% opacity) with note `Cannot vote on your own submission`. With `showRealtimeVotes`: `Total Votes: {{count}}` (others' total + your current value).
- **Completed**: right-aligned column (min 100/160px). If results hidden and viewer not manager: `Your {{tokenType}}` + own allocation (5xl bold, green if > 0). Otherwise `Total {{tokenType}}` + `totalTokensAllocated` (5xl; green if the viewer allocated > 0); for managers with allocations, hovering shows a tooltip listing each voter `name  n tokenType` sorted desc; below `You: {{tokens}}`.

### 4.3 Manage Round view (`ManageRoundView` + `FundingRoundPhaseManager`)

- Top: full-width bordered button `⚙ Funding Round Settings` → opens the space settings modal.
- Box titled `Round Timeline` with one card per phase (current card: `border-selected bg-selected/10` shadow; past/future: faded 50%):
  - `draft` (only while draft): `Draft` / `This round is not yet published`; action `Publish Round` (confirm `Are you sure you want to publish this round?`) → `updateSpace({status:'published'})`.
  - `published`: current `Round has not begun` / `The funding round is ready to start`, action `Open submissions`; past → `Round started` with date.
  - `submissions`: current `Submission Phase` / `Members can offer their {{plural}}` with `Pause submissions` (back) and `End submissions & Begin discussion` (forward); past → `Submissions ended` / `{{numSubmissions}} {{plural}} received`; future → `Submission phase` / `When submissions open, members can offer their {{plural}}`.
  - `discussion`: current `Discussion Phase` / `Members can discuss {{plural}} and make modifications based on feedback`, back `Reopen {{submissionDescriptorPlural}}`, forward `End discussion & begin voting`; past `Discussion ended`; future `Discussion phase` / `When discussion begins, members can discuss {{plural}} and make modifications based on feedback`.
  - `voting`: current `Voting Phase` / `Members can vote and discuss {{plural}}`, back `Re-open Discussion`, forward `End Voting`; past `Voting ended`; future `Voting phase` / `When voting opens, members can vote and discuss {{plural}}`.
  - `completed`: current `Round complete!` / `Congratulations! {{numParticipants}} participants contributed {{numSubmissions}} {{plural}}!`, back `Re-open Voting`, plus **`Export results`** (`Exporting...`); future `Round completion` / `When the round completes, results will be available`.
  - Badges on each card: `Current` (current, non-completed), `Complete` (completed current), `Not scheduled` (future without date), and a date pill (date only).
- Forward actions confirm `Are you sure you want to {{action}}?` and call `updateFundingRound({ id, <dateField>: now })` — i.e. they set the next boundary date to now (`submissionsOpenAt`, `submissionsCloseAt`, `votingOpensAt`, `votingClosesAt`), and the server's post-update `doPhaseTransition` advances the phase. Back actions **clear** the boundary date (`null`); going back from voting/completed to discussion warns `This will reset all token allocations. Are you sure you want to {{action}}?`. Dialog buttons: confirm label = action, `Cancel`. Errors show an `Error` dialog with message (fallback `An error occurred while updating the funding round`) and `OK`.
- **Export results** → CSV `<SpaceName_sanitised>-results.csv`: header `Participants, Submission 1, Tokens 1, Submission 2, Tokens 2, …`; one row per participant (all participants, sorted by name, case-insensitive), followed by that person's positive allocations sorted by tokens desc (submission title, tokens); cells quoted when containing `"`, `,` or newline. Failure: `Unable to export results`.

### 4.4 Round details (About tab / welcome page, `FundingRoundAboutInfo`)

Phase status panel (as §4.2), then `Schedule` (uppercase) list of the four dates (`Submissions open`, `Submissions close`, `Voting opens`, `Voting closes`), then info rows: `Show Budget Field` Yes/No, `Show all submissions` Yes/No, `Show real-time votes` Yes/No, `Voting Method` (`Equal Token Allocation` / `Divide Total Tokens Equally`), `Token Type`, `Tokens per Voter` (constant) or `Total Tokens` (divide), `Minimum Tokens per Submission` / `Maximum Tokens per Submission` when set; `Submission Criteria` (HTML); `Who Can Submit` / `Who Can Vote` role pills or `Any member`.

---

## 5. Business rules & side effects

1. **Phase engine** (`FundingRound.checkPhaseTransitions`, cron **every 10 minutes**; same rules in `doPhaseTransition`, which also runs after every `updateFundingRound` and when a participant opens the submissions view and the client computes that dates imply a different phase):
   - `draft` never auto-advances (explicit Publish). `archived` is ignored.
   - `published` → `submissions` when `submissions_open_at ≤ now`.
   - `submissions` → `discussion` when `submissions_close_at ≤ now`.
   - `submissions`/`discussion` → `voting` when `voting_opens_at ≤ now`; first **distributes tokens** (if distribution throws, the round is skipped this run).
   - `voting` → `completed` when `voting_closes_at ≤ now`.
   - Rewind rules (manual, via cleared dates, `doPhaseTransition` only): `completed` with `voting_closes_at = null` → `voting`; `voting`/`completed` with `voting_opens_at = null` → clear token distribution, then `discussion` if submissions already closed else `submissions`; `discussion`/`voting`/`completed` with `submissions_close_at = null` → `submissions`; any later phase with `submissions_open_at = null` → `published`. Only one step per evaluation.
   - Each transition into `submissions`, `discussion`, `voting`, `completed` queues `sendPhaseTransitionNotifications`: an activity `fundingRoundPhaseTransition:<phase>` (meta `{phase}`) for every participant.
2. **Token distribution** (`distributeTokens`): no-op if already voting/completed; requires `voting_opens_at` set (`Voting has not been scheduled`) and ≤ now + 1 min (`Voting has not opened yet`), `total_tokens` (`Total tokens not set for this round`), ≥ 1 active participant (`No users in this round`). Eligible = participants passing `canUserVote`. Each gets `tokensRemaining = total_tokens` (constant) or `floor(total_tokens / eligibleCount)` (divide). If voter roles exclude everyone, nothing is distributed (logged).
3. **Clear distribution** (rewind out of voting): every participant's `tokensRemaining = 0` and every allocation on the round's submissions set to 0.
4. **Join** (`joinFundingRound` or joining the space): `joinFundingRound` requires membership in the parent group (`You are not a member of this group`). `FundingRound.join`: add/reactivate space membership, reset `created_at`, increment `num_participants`; if `allow_late_joiners` and method constant and phase is `voting` and `total_tokens` and the user can vote → `tokensRemaining = total_tokens`.
5. **Leave / removal / parent cascade** (`Group.settleParticipation`): clears `tokensRemaining`, **zeroes all the leaver's allocations** on the round's submissions (so a rejoin cannot keep votes), decrements `num_participants` (min 0).
6. **Submitting** (`createPost` with `type:'submission'` and `fundingRoundId`): `FundingRound.addPost` checks `canUserSubmit` (`You do not have the required role to submit to this funding round`), attaches the post to the space, increments `num_submissions`; then (unless `silent`) queues `notifyStewardsOfSubmission`: activity `fundingRoundNewSubmission` (actor = submitter, `post_id`) to every *Administration* holder of the **space** (excluding the submitter). The backend does not check the phase or participation; the UI only offers the button during `submissions`.
7. **Allocating** (`allocateTokensToSubmission(postId, tokens)`): validations in order — `postId is required`, `tokens is required`, `tokens must be non-negative`, `Post not found`, `Post must be a submission`, `Post is not part of a funding round`, `Funding round not found`, participating (`You must be participating in this round to allocate tokens`), `canUserVote` (`You do not have the required role to vote in this funding round`), self-vote (`You cannot vote on your own submission`), phase is `voting` **or `completed`** (`Voting has not started yet`), membership exists, difference vs. current allocation ≤ remaining (`Not enough tokens remaining. You have N tokens remaining.`). Then upsert `posts_users.tokens_allocated_to = tokens` (new rows `following=false`) and adjust `tokensRemaining` by the difference. Min/max per-submission limits are **not** enforced server-side.
8. **Self-voting turned off during voting/completed** (`updateFundingRound`): all existing self-allocations are refunded to the voters' `tokensRemaining` and zeroed.
9. **Changing voting method** away from constant forces `allow_late_joiners=false`.
10. **Reminders** (`sendReminderNotifications`, **daily** cron; rounds whose space status is a published status and active): activity `fundingRoundReminder` with meta `reminderType`:
    - `submissionsClosing3Days`: participants who can submit, when `submissions_close_at` falls on the calendar day 3 days from now (deduped if one was sent in the last 2 days);
    - `submissionsClosing1Day`: participants who can submit **and haven't submitted**, close date tomorrow (dedupe 12 h);
    - `votingClosing3Days` / `votingClosing1Day`: participants who can vote (same windows).
11. **Delete round** (`deleteFundingRound`): sets `deactivated_at`; returns `{ success: true }`. Deleting the space deletes rounds and nulls activity references.
12. Notifications deliver in-app, push and email (templates "funding round new submission", "phase transition", "reminder"; module 19).

---

## 6. Permissions

| Action | Who |
|---|---|
| Create / update / delete round; Manage Round view; see all submissions at any phase; see per-voter allocations; remove others' submissions from the round | *Administration* in the space or its parent group. |
| View round | Space members (non-members get the join page). Non-participating viewers who reach the view (managers excepted) cannot interact. |
| Submit | Participant (space member) with a submitter role, or anyone if no submitter roles; UI only in `submissions` phase. |
| Edit own submission | Author, in `submissions` or `discussion` (UI rule). |
| Vote | Participant with a voter role (or any if none), has tokens; not own submission unless `allowSelfVoting`; late joiners only if `allowLateJoiners` (UI). |
| See results | Everyone in `completed` unless `hideFinalResultsFromParticipants` (then only own allocations; managers see all). |
| Flag submissions | Any member except the author (module 12). |

---

## 7. API

Queries: `fundingRound(id)` (fields §2.1/§2.6), `group(slug){ fundingRound{…} }`, `fundingRounds(first, offset, order, published, search)`, round `submissions{ items{ id title budget creator{…} tokensAllocated totalTokensAllocated … } }`, `allocations{ user{id name} submission{id title} tokensAllocated }`, `users`.

Mutations: `createFundingRound(data: FundingRoundInput): FundingRound` (requires `groupId`, `votingMethod`, `totalTokens`; errors `groupId is required`, `votingMethod is required`, `totalTokens is required`, `Invalid group`, `You do not have permission to create funding rounds`), `updateFundingRound(id, data)` (`FundingRound not found`, `You do not have permission to update funding rounds`), `deleteFundingRound(id)`, `joinFundingRound(roundId)`, `leaveFundingRound(roundId)`, `doPhaseTransition(id)`, `allocateTokensToSubmission(postId, tokens): Post`, `createPost(data{ type:'submission', fundingRoundId, budget, … })`, `updateSpace({ id, status })` (publish).

`FundingRoundInput`: `allowLateJoiners, allowSelfVoting, criteria, groupId, hideFinalResultsFromParticipants, maxTokenAllocation, minTokenAllocation, requireBudget, showRealtimeSubmissions, showRealtimeVotes, submissionDescriptor, submissionDescriptorPlural, submissionsCloseAt, submissionsOpenAt, submitterRoles: [RoleSelectionInput{id}], totalTokens, tokenType, voterRoles: [RoleSelectionInput], votingClosesAt, votingOpensAt, votingMethod`. `title`, `bannerUrl`, `description`, `publishedAt`, `phase` are stripped if sent. Dates accept ISO strings or millisecond timestamps; invalid → null. Submitter/voter roles cannot include the All Members role (`The All Members role cannot be edited, assigned or used as a requirement`).

Activity reasons: `fundingRoundNewSubmission`, `fundingRoundPhaseTransition:<phase>`, `fundingRoundReminder`.

---

## 8. Edge cases & known quirks

1. Allocations are accepted by the server in `completed` too (only `voting`/`completed` check); the UI hides inputs after voting.
2. Min/max per-submission limits are enforced only in the client; they also can't be set from the current settings UI (only via API/legacy data).
3. `requireBudget` only shows the field; budget is never required.
4. Phase is stored on the space; client `getRoundPhaseMeta` derives a display phase purely from dates once published (`open` = published but no date reached), which may briefly disagree with the stored phase until the cron/`doPhaseTransition` catches up.
5. `numParticipants` reads `groups.num_members` (refreshed by the 10-minute member-count job), so it can lag.
6. Submission ordering is shuffled per viewer during voting (seed = user id).
7. Manual "forward" actions overwrite scheduled dates with now; "back" actions erase dates (schedule is lost).
8. `distributeTokens` with voter roles that match nobody silently leaves the round in its prior phase on the cron path only if it throws; when it returns early the phase still moves to voting with no tokens.
9. Several reminder code paths `console.log` debugging output.
10. `allocations` is exposed to any viewer who can load the round even when results are hidden (UI hides it).
11. `tokensDistributedAt` is never set.
12. `SliderInput` (percentage range slider) is **not** used by funding rounds (it belongs to the post editor); voting uses numeric inputs.

## 9. Docs vs. code

| Docs | Code |
|---|---|
| Create via "(+) Create Button → Funding Round" with Title / Description / banner fields on the round | Created as a space (Add Space → Funding Round); title/description/banner are the space's. |
| Token type includes searchable "Currency" dropdown; min & max per submission configurable | Free-text `Token name`; min/max not in the settings UI. |
| "Lobby/Announcement Phase" | Phase `published`, shown as "Round has not begun". |
| Join via "Join Round" from a list of Funding Rounds | Join the space (`Join Space`); legacy `/funding-rounds` list redirects to More Spaces. |
| "Submissions hidden from non-stewards during this phase" | Default yes, but `Show all submissions to members during the submissions phase` can reveal them. |
| "Votes Allocated can be viewed under the Projects tab" | Results appear on the submissions view cards and via Export results. |
| Voting: "new members can join … but cannot vote" | Late joiners can vote when `allowLateJoiners` is on (constant method). |

## 10. Source references

- Backend: `apps/backend/api/models/FundingRound.js`, `api/models/FundingRound/notifications.js`, `api/models/Group.js` (`settleParticipation`), `api/models/post/createPost.js`, `api/graphql/mutations/fundingRound.js`, `api/graphql/makeModels.js` (FundingRound, Post token getters), `api/graphql/schema.graphql`, `cron.js`, migrations `20250904120000_funding_rounds.js` … `20261001180000_add_show_realtime_submissions_to_funding_rounds.js`, `20260826120000_add_groups_status.js`; test `api/graphql/mutations/fundingRound.test.js`.
- Web: `apps/web/src/routes/FundingRoundSubmissionsView/{FundingRoundSubmissionsView,RoundPhaseStatus,SubmissionCard,FundingRoundPhaseManager}.jsx`, `phaseUtils.js`, `routes/ManageRoundView/ManageRoundView.jsx`, `routes/FundingRounds/FundingRounds.store.js`, `components/FundingRoundAboutInfo/FundingRoundAboutInfo.jsx`, `routes/AuthLayoutRouter/components/ContextMenu/{AddSpaceDialog,SpaceSettingsModal,FundingRoundSettingsFields}.jsx`, `components/PostEditor/PostEditor.js`, `routes/Members/Members.js`, `components/Member/Member.js`, `routes/MySpaceCollection`.
