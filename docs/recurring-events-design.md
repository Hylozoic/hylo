# Recurring Events — Design & Implementation Plan

Issue: [#1506](https://github.com/Hylozoic/hylo/issues/1506) · Branch: `1506-recurring-events`

## Summary

Recurring events are modeled as an **`event_series` parent entity** plus **materialized occurrence posts**: every occurrence is a real event Post (`type = 'event'`) referencing its series via `posts.event_series_id`. RSVPs, comments, ICS calendars, digests, and calendar/stream queries all continue to work per-occurrence with no special cases, because they all assume "one post = one thing with a `start_time`".

There is **no scheduled/cron materialization**. All occurrences are generated at creation time, capped at **20 upcoming occurrences** per series. When a recurring event is edited, more occurrences can be generated on demand, topping the series back up to 20 upcoming — occurrences that have passed don't count against the cap.

## Decisions made

| Question | Decision |
| --- | --- |
| Collections as the recurrence mechanism? | **No.** Collections (`GroupView type='collection'` / `collections_posts`) are curated ordered post lists with no time semantics. Recurrence gets its own model. |
| Virtual occurrences (expand at query time) vs materialized posts? | **Materialized posts.** RSVPs (`event_invitations.event_id`), comments, ICS UIDs, digests and stream pagination all FK/query against real post rows. |
| Parent = first occurrence post, or separate entity? | **Separate `event_series` entity.** Cleaner semantics; the first occurrence is an ordinary post like every other occurrence, so RSVPs/comments on it aren't special. |
| Materialization strategy | **Up-front at creation, no cron.** Cap of 20 upcoming occurrences; regeneration ("top up") happens on user-initiated edit. Past occurrences don't count toward the cap. |
| Edit/delete scoping | **Yes, wanted** (this occurrence / this and following / all) — Phase 2. The schema supports it now via `posts.original_start_time`. |
| RSVPs | **Per-occurrence.** The creator is auto-RSVP'd "yes" to every occurrence. Series-level "RSVP to all" is a possible later convenience. |
| Timezones | Recurrence expands **in the event's timezone** using luxon, preserving wall-clock times across DST. Builds on the timezone-selection work merged from `1453-choose-timezone` (`posts.timezone`, `TimezoneSelect`, `DateTimeHelpers` additions). |
| Recurrence library | **None.** A luxon-based expander in `packages/shared` (`RecurrenceHelpers`) supports the RRULE subset the UI can produce. The `rrule` npm package is UTC-naive (needs floating-time workarounds) and its `toText()` is English-only, while we need descriptions in 6 locales anyway. We still store standard RFC 5545 RRULE strings, so swapping in a full library later needs no migration. |

> Note: the cap was specified as "2-" in discussion and has been implemented as **20** (`RecurrenceHelpers.MAX_FUTURE_OCCURRENCES`), a single constant to change if a different number was meant.

## Data model (Phase 1 — implemented)

Migration: `apps/backend/migrations/20260806000000_add-event-series.js` (also folded into `migrations/schema.sql` for the test schema).

```
event_series
  id               bigint PK
  user_id          bigint FK → users        (series creator)
  recurrence_rule  text NOT NULL            (normalized RFC 5545 RRULE, e.g. FREQ=WEEKLY;BYDAY=TU;COUNT=10)
  timezone         varchar                  (IANA zone the rule is anchored in)
  start_time       timestamptz              (series anchor / DTSTART = start of the first occurrence)
  is_active        boolean default true
  created_at / updated_at

posts (new columns)
  event_series_id      bigint FK → event_series, indexed
  original_start_time  timestamptz  (the slot this occurrence was generated for)
```

`original_start_time` serves two purposes:

1. **Pattern anchoring.** Generation expands the rule from the series `start_time` and only creates occurrences after `max(original_start_time)` across *all* series posts (including deactivated ones) — so deleted occurrences are never recreated and a rescheduled occurrence never shifts the pattern.
2. **Detached-occurrence detection (Phase 2).** `start_time != original_start_time` means the occurrence was individually rescheduled; series-wide edits should skip its time fields.

## Recurrence rules

`packages/shared/src/RecurrenceHelpers/RecurrenceHelpers.ts` — shared so the web UI (Phase 3) can preview occurrence dates with the exact same expansion the backend uses.

- **Supported RRULE subset**: `FREQ=DAILY|WEEKLY|MONTHLY|YEARLY`, `INTERVAL`, `COUNT`, `UNTIL` (date-only UNTIL is read as end-of-day in the event timezone), `BYDAY` (weekly: plain weekdays; monthly: ordinal weekdays like `2TU` / `-1FR`), `BYMONTHDAY`. Anything else throws — unsupported rules fail loudly instead of silently producing wrong dates.
- **DTSTART is always the first occurrence**, and `COUNT` is consumed from DTSTART even when expansion starts mid-series (`after` param), so topping up a partially-materialized series stays consistent.
- **RFC edge cases**: monthly on the 31st skips short months; yearly on Feb 29 skips non-leap years.
- API: `parseRecurrenceRule`, `buildRecurrenceRule`, `validateRecurrenceRule`, `normalizeRecurrenceRule`, `expandRecurrenceRule({ rule, dtstart, timezone, after, limit })`, `MAX_FUTURE_OCCURRENCES`.
- Tested in `RecurrenceHelpers.test.ts`, including wall-clock stability across both US DST transitions.

## Generation semantics (Phase 1 — implemented)

`apps/backend/api/models/EventSeries.js`:

- `EventSeries.createForPost(post, recurrenceRule, { transacting })` — called from `afterCreatingPost` (after groups and tags are attached) when `createPost` params include `recurrenceRule` and the post is an event. Creates the series, links the first post, and materializes the rest, all inside the createPost transaction.
- `series.generateOccurrences({ transacting })` — idempotent "fill to cap": creates posts for un-materialized slots until the series has `MAX_FUTURE_OCCURRENCES` upcoming (start_time >= now) active occurrences, or the rule is exhausted (`COUNT`/`UNTIL`). Phase 2 calls this again on edit to top up.
- Generated occurrences copy from the latest existing occurrence (the template): `name`, `description`, `location`/`location_id`, `timezone`, `is_public`, groups, topics, and duration (`end_time − start_time`). Each gets a creator "yes" `EventInvitation`.
- **Deliberately skipped side effects** for generated occurrences (vs. a normal `createPost`): no `createActivities`/announcement notifications, no per-occurrence RSVP email, no unread-count increments, no Slack/Zapier triggers. A weekly event must not notify the whole group 20 times. Group ICS calendars still pick everything up because the first post's `processEventCreated` rebuilds them after commit.
- Not copied in v1: media (images/files), event invitees beyond the creator (invitees are invited to the first occurrence only, via the existing `processEventCreated` path). Revisit in Phase 2/3.

## Remaining phases

### Phase 2 — Mutations & GraphQL
- `PostInput.recurrenceRule` (pass-through to `createPost` params — the domain layer already handles it); validation in `validatePostData` (events only, requires `startTime`).
- Expose on `Post`: `eventSeries` / `recurrenceRule` / `isRecurring`; possibly a `PostInput.generateMoreOccurrences` or dedicated mutation to top up a series on edit.
- `updatePost` / `deletePost` scope arg: `'this' | 'future' | 'all'`.
  - `'this'`: current behavior (the occurrence is thereby "detached" for changed fields).
  - `'all'`: apply to all future occurrences, skipping time changes on detached ones (`start_time != original_start_time`).
  - `'future'`: truncate the series rule (`UNTIL`) and start a new series from this occurrence.
  - Delete series: deactivate future occurrences, leave past ones; existing CANCEL-ICS flow per occurrence.
- Fix schema doc bug while in there: `respondToEvent`/`myEventResponse` say `'maybe'`, actual value is `'interested'`.

### Phase 3 — Web UI
- `PostEditor`: recurrence selector under the `DateTimePicker` (event type only): presets (daily/weekly/monthly patterns derived from the chosen start), end condition (never / on date / after N), building an RRULE string; occurrence-count preview via shared `RecurrenceHelpers`.
- Edit/delete scope dialog ("This event / This and following / All events").
- Display: "Repeats weekly" line in `EventBody`/`EventDate`, series indicator in calendar view; decide whether streams collapse a series to its next occurrence.
- Localized recurrence descriptions — all new strings translated in `public/locales/{en,de,es,fr,hi,pt}.json`.

### Phase 4 — Notifications/ICS/digests polish
- Verify group + RSVP ICS feeds and digest "starting soon" behave with many occurrences; RSVP-update emails scoped to affected occurrences on series edits.

### Phase 5 — Mobile parity & E2E
- Mobile creation flows through the web PostEditor in a WebView (inherits the picker); native `PostCard`/`EventBody` needs a recurrence badge.
- Playwright spec: create a weekly event, see the occurrences on the calendar.

## Phase 1 files

| Change | File |
| --- | --- |
| Recurrence helpers + tests | `packages/shared/src/RecurrenceHelpers/RecurrenceHelpers.ts`, `.test.ts`, exported from `packages/shared/src/index.js` |
| Migration | `apps/backend/migrations/20260806000000_add-event-series.js` |
| Test schema | `apps/backend/migrations/schema.sql` (event_series table, posts columns, PK/FKs, index) |
| Model | `apps/backend/api/models/EventSeries.js` (+ `EventSeries` in `standard.global` in `apps/backend/package.json`) |
| Post relation | `apps/backend/api/models/event/mixin.js` (`eventSeries()`) |
| createPost hook | `apps/backend/api/models/post/createPost.js` (`recurrenceRule` param → `EventSeries.createForPost`) |
| Backend tests | `apps/backend/api/models/EventSeries.test.js` |
