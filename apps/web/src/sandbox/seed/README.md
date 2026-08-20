# Sandbox seed data

Editable demo content for `/sandbox`. Loaded by the mock GraphQL engine (Phase 1+).

## Trying it

With `yarn web:dev` running, open `/sandbox`. Phase 0 intercepts GraphQL in the browser — nothing is written to the database. Reload resets demo state.

Edit copy in `en/*.js` (names = `%%%%%%%%%%%%`, prose = 200 `*`).

| Field type | Placeholder | Example |
|---|---|---|
| Names (people, groups, post titles) | 12× `%` | `%%%%%%%%%%%%` |
| Descriptions, post bodies, comments | 200× `*` | `***…***` |

Replace these in the `en/*.js` files with real copy. Constants live in `constants.js`.

## File layout

```
apps/web/src/sandbox/seed/
  constants.js          — shared IDs, slugs, placeholder strings
  helpers.js            — id builders, timestamp materialization, location stubs
  index.js              — loadSandboxSeed(locale)
  en/
    index.js            — assembles full seed; start here
    people.js           — Me (coordinator) + 44 members + 3 starter-group members
    groups.js           — main group, simple group, 3 spaces, memberships, groupViews
    posts.js            — 12 stream posts + 8 chat + 3 funding submissions + 5 simple chats
    comments.js         — comments, reactions, proposal options/votes
    tracks.js           — onboarding track + 4 actions
    fundingRounds.js      — spring grants funding round
    messageThreads.js   — 1 group DM + 2 direct DMs
```

## Content inventory

### Main group (`demo-community`) — 45 members, Me is coordinator

**Stream posts (12):** discussion ×4, event ×2, proposal ×2, request ×2, offer ×2

**Spaces:**
- `general-chat` — 8 chat posts
- `onboarding-track` — track with 4 action steps
- `spring-grants` — funding round in voting phase, 3 project submissions

**Engagement:** comments on 5 posts (5-thread on post 002), reactions on 4 posts, proposal votes on post 005

### Simple group (`starter-circle`) — 4 members, chat-only menu

5 chat posts — “just created” feel

### Direct messages

1. Group thread (Me + 4 members)
2. 1-on-1 with `sandbox-person-002`
3. 1-on-1 with `sandbox-person-003` (1 unread)

## Timestamps

Seed data uses `*_offset` fields (seconds relative to page load). `loadSandboxSeed()` converts them to ISO dates — do not hand-edit absolute dates in seed files.

## Adding locales

Add `seed/es/index.js` (etc.) mirroring `en/`, keyed in `seed/index.js` loaders. Fall back to `en` for missing keys until translated.

## Editing workflow

1. Open the relevant `en/*.js` file
2. Replace `PLACEHOLDER_NAME` / `PLACEHOLDER_COPY` literals, or import constants and substitute inline
3. IDs and slugs are stable — change copy without breaking resolvers
