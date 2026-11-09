# Hylo Product & Technical Specification

This directory is a complete functional specification of Hylo, written so that a capable engineer (human or AI) could re‑implement Hylo on a different tech stack and end up with a product that **looks and behaves the same**.

It was derived from the source code in this monorepo (web, backend, mobile, desktop), its unit and end‑to‑end tests, and the public documentation at <https://hylozoic.gitbook.io/hylo>. **Where the documentation and the code disagree, the code wins**; each module calls out such conflicts in a "Docs vs. code" note.

> Spec snapshot: generated from branch `dev` (November 2026). File paths cited are relative to the repo root.

---

## How to read this spec

The spec is split into modules. Start with the **Product overview** below, then the **Foundations** (architecture, data model, API), then whichever feature modules you need. Every feature module uses the same template:

1. **Overview** — what the feature is for and who uses it.
2. **Concepts & data** — entities, fields, enums (with exact stored values), and defaults.
3. **Routes / entry points** — URLs and where in the UI the feature is reached.
4. **UX specification** — screen by screen: layout, components, exact English copy (from `apps/web/public/locales/en.json`), empty/loading/error states, validation rules and messages, interactions, responsive behaviour.
5. **Business rules & side effects** — server‑side logic: permission checks, notifications, emails, activities, background jobs, real‑time events.
6. **Permissions** — who can see / do what.
7. **API** — GraphQL queries, mutations, and subscriptions involved (names, key arguments, return shapes).
8. **Edge cases & known quirks** — including behaviour that is arguably a bug but is what the product currently does.
9. **Docs vs. code** — conflicts with the public documentation (code wins).
10. **Source references** — the files the section was derived from.

Conventions:

- `Code-formatted` names are exact identifiers (GraphQL fields, DB columns, enum values, route segments).
- "Copy:" blocks quote UI strings verbatim. Strings are translated into German, Spanish, French, Hindi and Portuguese as well as English (UI locales `en-US`, `en-GB`, `es-ES`, `de-DE`, `fr-FR`, `hi-IN`, `pt-BR`, plus legacy short codes `en`, `es`, `de`, `fr`, `hi`, `pt`; translation files are `apps/web/public/locales/{en,de,es,fr,hi,pt}.json`). A re‑implementation must ship all of them — see [08](08-design-system-i18n.md).
- "Steward" / "Coordinator" / "Admin" — see the Glossary; permission checks are expressed in terms of *responsibilities*, not role names.

---

## Table of contents

### Foundations
| # | Module | Covers |
|---|--------|--------|
| 01 | [Architecture](01-architecture.md) | System components, runtime topology, auth/session infrastructure, real‑time, jobs/queues, file storage, email/push providers, caching, feature flags, environments |
| 02 | [Data model](02-data-model.md) | Every persistent entity, its fields, relationships, enums, and invariants |
| 03 | [GraphQL API](03-graphql-api.md) | API conventions, the query/mutation/subscription surface, pagination, errors, auth scopes, REST endpoints |

### People & accounts
| # | Module | Covers |
|---|--------|--------|
| 04 | [Accounts, authentication & onboarding](04-accounts-auth-onboarding.md) | Signup, email verification, login, Google/Apple auth, password reset, logout, welcome wizard, first‑run flows |
| 05 | [User settings](05-user-settings.md) | Edit profile, groups & affiliations, invites & requests, notification settings, locale, appearance, account (email/password/deactivate/delete), blocked users, saved searches, payments |
| 20 | [Members & profiles](20-members-profiles.md) | Member directory, member profile pages, hover cards, skills, affiliations, role badges |

### Shell & navigation
| # | Module | Covers |
|---|--------|--------|
| 06 | [App shell & navigation](06-app-shell-navigation.md) | Layout, global nav (groups rail), context menu (group menu), contexts (My Home / All My Groups / Public Commons), create menu, banners, responsive & mobile‑web behaviour, routing table |
| 07 | [Search](07-search.md) | Global and group search |
| 08 | [Design system & i18n](08-design-system-i18n.md) | Visual language, themes & colour tokens, typography, iconography, core components, dark mode, localisation |

### Groups
| # | Module | Covers |
|---|--------|--------|
| 09 | [Groups: creation & structure](09-groups.md) | Creating a group, group types, about page, welcome page/modal, related groups (parent/child/peer), group explorer, farm groups |
| 10 | [Joining groups & invitations](10-joining-invitations.md) | Accessibility/visibility, join flows, join requests & questions, agreements on join, email invitations, invite links, leaving a group |
| 11 | [Group settings](11-group-settings.md) | Every settings tab: details, appearance, privacy, invitations, requests, agreements, roles, responsibilities, related groups, paid content, import/export, delete |
| 12 | [Roles, permissions & moderation](12-roles-permissions-moderation.md) | Common & custom roles, responsibilities, permissions matrix, moderation (flagging, moderation actions), agreements enforcement, blocking |

### Content
| # | Module | Covers |
|---|--------|--------|
| 13 | [Posts & comments](13-posts-comments.md) | Post model and types, post editor, post cards & detail, comments, reactions, mentions, topics, attachments, link previews, cross‑posting, saving, pinning, announcements, drafts |
| 14 | [Events, proposals, projects, requests & offers](14-events-proposals-projects.md) | Type‑specific behaviour: RSVPs & invitations & calendars; proposals & voting & quorum; projects & members; request/offer completion |
| 15 | [Views, streams & spaces](15-views-streams-spaces.md) | Stream, view modes, filters & sorting, built‑in views, custom views, collections, spaces, topic pages, group menu customization |
| 16 | [Map](16-map.md) | Map explorer, layers, filters, location search, saved searches |
| 17 | [Chat rooms](17-chat-rooms.md) | Topic/chat rooms, chat composer, threading, presence, typing |
| 18 | [Direct messages](18-direct-messages.md) | Message threads, composing, participants, real‑time |
| 19 | [Notifications, email & push](19-notifications-email-push.md) | Activity → notification pipeline, in‑app notifications, email (instant & digests), push, per‑group settings |

### Programs & economy
| # | Module | Covers |
|---|--------|--------|
| 21 | [Tracks & actions](21-tracks.md) | Learning journeys, enrollment, actions, completion, badges |
| 22 | [Funding rounds](22-funding-rounds.md) | Participatory funding rounds: phases, submissions, voting, allocation |
| 23 | [Paid content & Stripe](23-paid-content-stripe.md) | Stripe Connect, offerings, content access, subscriptions, transactions |

### Platform surfaces
| # | Module | Covers |
|---|--------|--------|
| 24 | [Integrations, API & embeds](24-integrations-api-embeds.md) | OAuth/OIDC provider, API clients, Zapier, iframes/embeds, calendar feeds, data export, analytics, admin tools |
| 25 | [Mobile & desktop apps](25-mobile-desktop.md) | Native mobile app (Expo) screens and differences from web, WebView usage, push, deep links; Electron desktop app |

---

## Product overview

Hylo is a free, open‑source, not‑for‑profit community coordination platform ("Prosocial Coordination for a Thriving Planet"). People join **groups** (communities, organisations, networks, bioregions, farms), and inside groups they share **posts** of several types (discussions, requests, offers, resources, projects, events, proposals), talk in **chat rooms**, message each other directly, see everything on a **map**, make decisions (proposals with voting), run **learning tracks**, run participatory **funding rounds**, and optionally sell access to content via Stripe.

Groups can be nested (parent/child) and connected peer‑to‑peer, forming networks. Content can be cross‑posted to several groups at once, and can be made public so it appears in **The Commons** (the public context).

Every user has three aggregate "contexts" in addition to their groups:

- **My Home** (`/my`) — the user's own content, mentions, interactions, saved posts, and settings.
- **All My Groups** (`/all`) — aggregated content from every group the user belongs to.
- **The Commons / Public** (`/public`) — public posts and groups from across Hylo, visible to anyone.

Each group has a configurable **menu** of views (stream, chat rooms, events, projects, proposals, map, members, custom views, collections, tracks, funding rounds, spaces…) and its stewards control privacy, membership, roles, agreements, and appearance.

## Glossary

| Term | Meaning |
|------|---------|
| Group | A community container. Has members, posts, chat rooms, settings. Formerly called "community"/"network". |
| Space | A sub‑area of a group (see module 15) |
| Steward / Coordinator / Moderator | Built‑in *common roles*. Permissions are granted by *responsibilities* attached to roles (module 12). "Admin" in code usually means the "Administration" responsibility. |
| Responsibility | A named permission, e.g. `Administration`, `Manage Content`, `Add Members`, `Remove Members` (module 12) |
| Post | Any piece of content of a type: `discussion`, `request`, `offer`, `resource`, `project`, `event`, `proposal`, `action`, `chat`, `submission`, … (module 13) |
| Chat / chat room | A topic whose posts are shown as a chat stream (module 17) |
| Topic | A `#hashtag`; posts are tagged with topics; topics can be followed (module 13/17) |
| Message thread | A direct‑message conversation (module 18) |
| Context | `groups`, `my`, `all`, or `public` — the scope a view is shown in |
| Commons | The public context (`/public`) |
| Track | A learning journey made of action posts (module 21) |
| Funding round | A participatory budgeting process (module 22) |
| Offering | A paid product (Stripe) granting content access (module 23) |
| Activity / Notification | A recorded event and its per‑user delivery (module 19) |

---

## Coverage & confidence

Every module follows the template above and was written from the code; the public docs were consulted only for comparison. Some things to know before relying on it:

- **Length is uneven.** Modules are dense (mostly tables) rather than long. The thinnest areas, where a re‑implementer will need to read the cited source files to get pixel‑level layout, are: 07 Search, 08 Design system (only 13 tokens per theme are tabulated — the rest are in `apps/web/src/themes/index.js`), 16 Map, 18 Direct messages, 21 Tracks and 22 Funding rounds. Each module lists its own gaps in its "Edge cases" / gaps notes.
- **Email bodies are not in this repo.** Transactional and digest emails are SendWithUs templates hosted externally; the spec gives each template ID, subject and the data passed to it, but not the HTML.
- **Inferred, not verified at runtime.** Nothing was checked in a running app. Statements a module marks as inferred (e.g. some map sprite names, some JSON settings keys in 02, push‑URL parsing on old mobile clients) should be spot‑checked.
- **The native mobile app is a shell.** After login, `apps/mobile-leap` renders the web app in a WebView; only auth/onboarding screens are native (module 25). So the web modules describe the mobile product too.
- **Model shifts the public docs haven't caught up with** (the code wins throughout):
  - Tracks and funding rounds are *spaces* (`groups.type = 'space'`) with a linked `tracks` / funding‑round record, not standalone group features (15, 21, 22).
  - Chat rooms are one `group_views` row of `type='chat'` per group/space; topic‑based chat and `#general` are gone (17).
  - The top built‑in role is **Administrator** (legacy "Coordinator"); there are four system responsibilities (`Administration`, `Add Members`, `Remove Members`, `Manage Content`); Manage Tracks/Rounds were folded into Administration (12).
  - "Networks" are parent/child group relationships (09).

## Appendix: notable code findings

While specifying current behaviour the writers recorded a number of probable bugs. The spec describes what the code *does*; a re‑implementation should decide deliberately whether to reproduce these. The ones with security or data‑integrity impact:

| Area | Finding | Module |
|------|---------|--------|
| Posts | `updatePost` has no author/moderator check server‑side — any member of all the post's groups can edit it via the API | 13 |
| Paid content | `recordStripePurchase` lets any logged‑in user create a paid access record for anyone; checkout metadata user id is client‑overridable; `checkContentAccess` reveals any user's access | 23 |
| Paid content | `charge.refunded` webhook calls a non‑existent method, so dashboard refunds never revoke access; delete triggers on `content_access` / role assignments read `NEW` so deletes don't clean up scopes | 23, 02 |
| Search | Global search doesn't validate the `groupIds` argument (can search groups you're not in) and skips the blocked‑user filter | 07 |
| Profiles | `deleteAffiliation` ownership check is an un‑awaited async call (always truthy) — anyone can delete any affiliation | 05, 20 |
| Saved searches | `savedSearches(userId)` returns any user's saved searches | 16 |
| Moderation | Moderation actions list has no permission check; deactivated custom roles still grant their responsibilities | 12 |
| Proposals / events | Single‑vote and anonymous voting are only enforced in the UI; any proposal edit from the web client deletes all votes; calendar feeds expose the creator's email | 14 |
| DMs | 20‑participant limit is client‑only; reply‑by‑email skips the block check; inbound email signature check passes when the key is unset | 18, 19 |
| OAuth / API | OAuth scopes aren't enforced once a token is accepted; LinkedIn/Facebook login routes are broken | 24, 01 |
| Accounts | `reactivateMe` reads the wrong argument (never works); platform agreement acceptance is never persisted | 04 |
| Analytics | Mixpanel runs even when analytics cookies are rejected | 07 |

Each module's "Edge cases & known quirks" section has the full list (several dozen more UX‑level quirks, untranslated strings, and dead code).
