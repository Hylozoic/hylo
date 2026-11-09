# 07 — Search

> Scope: the global/group search page (`/search`), the backend full-text search index and ranking, other search-like query paths (stream keyword filter, members search, group explorer search), and the shared typeahead/autocomplete components (@mentions, #topics, member selector, topic selector, group/space "To" field, people selector). Member directory UI is in [20-members-profiles.md](20-members-profiles.md); map location search in [16-map.md](16-map.md); saved searches in [16-map.md](16-map.md)/[05-user-settings.md](05-user-settings.md); the ViewHeader search box that launches search is in [06-app-shell-navigation.md](06-app-shell-navigation.md) §4.9.

## 1. Overview
- **Global search** finds People, Posts, Comments and Groups across everything the user can see, ordered by relevance weighted by recency. Optionally **scoped to one group** (`groupSlug`).
- Entry points: the search box in a view's ViewHeader (offers "Search in {{groupName}}" / "Search across all your groups"), the card-menu group banner's magnifying-glass icon, and clicking a `#hashtag` in a post (opens `/search?t=#name&groupSlug=…`).
- Search is **authenticated only** (`/search` exists only in the auth router; anonymous visitors hitting it are sent to `/login` with return path).
- Typeahead (autocomplete) is used across the app for mentions, topics, members, groups and DM recipients; each uses a different backend path (prefix matching) rather than the full-text index.

## 2. Concepts & data

### 2.1 Search index (`search_index` materialized view, Postgres)
One row per searchable entity, with a weighted `tsvector` column `document` (language config `english`), `sort_ts` (recency timestamp) and exactly one of `post_id`/`user_id`/`comment_id`/`group_id`. `row_key` = `post-<id>` / `user-<id>` / `comment-<id>` / `group-<id>` (unique index). GIN index on `document`; partial indexes on each id column.

| Entity | Included rows | Indexed fields (weight) | `sort_ts` |
|---|---|---|---|
| Post | `posts.active` and author active; `type` not in (`welcome`, `chat_activity`) — note chat posts **are** included | title `posts.name` (B), `description` (C), author name (D) | `posts.updated_at` |
| Person | `users.active` | name (A), skills names with `-` → space (C), `bio` (C) | latest active membership `created_at`, else `last_active_at`, `updated_at`, `created_at` |
| Comment | `comments.active` and author active | comment text (C), author name (D) | `comments.created_at` |
| Group | `groups.active` and not a space (`type` null or ≠ `space`) | name (A), description (B), location (C) | `coalesce(updated_at, created_at)` |

Refresh: cron job every **10 minutes** runs `refresh materialized view concurrently search_index` (falls back to non-concurrent refresh). New content therefore becomes searchable with up to ~10 min delay.

### 2.2 GraphQL types
```graphql
search(first: Int, groupIds: [ID], offset: Int, term: String, type: String): SearchResultQuerySet
type SearchResultQuerySet { total: Int, hasMore: Boolean, items: [SearchResult] }
type SearchResult { id: ID, content: SearchResultContent }
union SearchResultContent = Person | Post | Comment | Group
```
- `type`: `'post' | 'person' | 'comment' | 'group'`; anything else (the client sends `'all'`) means all types.
- `first` defaults to 20. `SearchResult.id` is an opaque hex encoding of `"<type>_id-<id>"` (e.g. hex of `post_id-123`).
- `total` is requested by the client but not computed by the resolver (always null/undefined) — only `hasMore` is meaningful.

## 3. Routes / entry points
| URL | Behaviour |
|---|---|
| `/search` | Search page, empty input focused |
| `/search?t=<term>` | Prefilled term (URL kept in sync, debounced 500ms, replace) |
| `/search?groupSlug=<slug>` | Scope to that group (chip shown) |
| `/search?from=<path+search>` | Where the header back button returns; removed from the URL after first read |
| `/search/post/:postId` | Opens a post in the `PostDialog` overlay over results |
Launchers:
- ViewHeader search (views with `search: true`): `/search?t=<trimmed input>[&groupSlug=<current group>][&from=<current path>]` (no `from` if already on /search).
- Card-menu banner search icon: `/search?groupSlug=<slug>&from=<current>` (no term).
- Hashtag click (`tagSearchUrl`): `/search?t=%23<name>[&groupSlug=<slug> unless slug is all/public/search/my/messages][&from=…]`.

## 4. UX specification — Search page
ViewHeader is configured as: centered, back button on both mobile and desktop, `backTo` = `from` param or the previous non-search location (fixed at first value), and the **title slot holds the search input**:
- Input: magnifying-glass icon at left (50% opacity), `placeholder="Search for people, posts, comments and groups"`, autofocus; `bg-input rounded-lg py-1 pl-7`, `border-2 border-transparent focus:border-focus`, `min-w-[300px] sm:min-w-[375px] max-w-[750px]`.

Body: `max-w-[750px] mx-auto p-2 flex-col gap-2`.
1. **Group scope chip** (when `groupSlug` resolves to a loaded group): `px-2 py-1 rounded-md bg-selected/40 border-2 border-selected`, text "Searching in group {name}" (hard-coded English) and an `X` icon that removes `groupSlug` from the URL.
2. **Tab bar**: `rounded-lg bg-darkening/10 p-2`, centered pills (`border-2 border-foreground/20 rounded-lg px-2 py-1`, hover border 50% + scale 105; active `border-selected bg-selected`): "All", "Posts", "Comments", "People", "Groups" → type `all|post|comment|person|group`. Tab state is local (not in URL); default All.
3. **Results** in server order:
   - **Person** card: `rounded-xl p-2 bg-card/40 border-2 border-card/30 shadow-md`, hover lift (`scale-105`, `shadow-lg`); large round avatar, name (`text-lg font-bold`), location (`text-sm text-foreground/50`). Optional skill pill if a skill matches the highlight terms (never, since terms are empty — see quirks). Click → `/members/:id`.
   - **Post**: standard `PostCard` (module 13); `childPost` flag set when not group-scoped (shows which group it came from). Opening the post uses the post card's normal link behaviour (dialog at `/search/post/:id`).
   - **Comment**: `CommentCard` (not expanded) showing the comment, its author and parent post context.
   - **Group**: `GroupCard` linking to `/groups/:slug` (mb-4).
4. **States**:
   - Term shorter than **2** characters (after trim): nothing is fetched or shown.
   - Loading: bottom spinner (`Loading type='bottom'`) while waiting (including while the scoped group record loads).
   - Empty: centered `/assets/hey-axolotl.png` (w-40, max 50%), "No results for this search" + "Try searching with different keywords".
   - Error with no results: puzzled axolotl + red message: server error text when JSON/plain, else "Oh no, something went wrong! Check your internet connection and try again".
   - Error after some results: red message below the list.
5. **Pagination**: 20 per page; infinite scroll via a ScrollListener on the center column (`onBottom` → fetch `offset = results.length`, guarded against duplicate offsets). Additionally, if the list doesn't fill the column (within 250px), more pages are fetched automatically.
6. Debounce: input → fetch after 500ms idle; changing tab or scope refetches.

## 5. Business rules (backend)

### 5.1 Query construction (`FullTextSearch.search`)
1. **Term normalisation** (`prefixTsQuery`): split on whitespace; strip tsquery-special characters `, ; | : & ( ) ! \ # ' " < > *` from inside words; drop empty words; each word becomes a prefix term `word:*`; AND-joined. `"#release! notes"` → `release:* & notes:*`. Empty → no results (`where false`).
2. `to_tsquery('english', <term>)` — English stemming applies to both query words and documents.
3. Match: `document @@ tsquery`; type filter column `IS NOT NULL` per `type`.
4. **Access filter** (always applied):
   - **Group-scoped** (`groupIds` given): posts in `groups_posts` for those groups; users with a membership in those groups; comments on posts in those groups; groups whose id is in `groupIds`. Public content outside the group is **not** included.
   - **Unscoped (logged-in user)**: posts in any group the user is a member of, users who are members of any of the user's groups, comments on posts in the user's groups, **plus** all public posts (`is_public` and active) and comments on public posts, **plus** groups that are (a) public visibility (2), (b) the user's own groups, or (c) protected-visibility groups connected by an active parent/child or peer relationship (either direction) to one of the user's groups — always excluding spaces and inactive groups.
   - Anonymous (not reachable from the web UI): public groups only (+ public posts/comments).
   - `Group.selectIdsForMember(userId)` defines "member groups" (active memberships; module 02/10).
5. **Ranking**: `rank = ts_rank_cd(document, tsquery)` (cover density; weights A>B>C>D), multiplied by an exponential **recency decay** `exp(-(now - sort_ts)/1,209,600s)` (time constant 14 days; null `sort_ts` → no decay). Order: decayed rank desc, then raw rank desc. Results of all types are interleaved in one list.
6. Pagination: `limit first+1` rows at `offset` to compute `hasMore`; return `first` items.
7. A transaction-local `statement_timeout` (env `SEARCH_STATEMENT_TIMEOUT_MS`, default 20 000 ms) bounds each query.
8. Hydration: ids grouped by type and loaded as models; returned in rank order.

### 5.2 Other search paths (not using the global search page)
| Feature | API | Matching |
|---|---|---|
| Stream keyword filter (`posts(search: …)`, e.g. stream/collection filters, map) | `Search.forPosts` → `filterAndSortPosts` | case-insensitive **substring** `ILIKE %term%` on post title, description, or creator name (`%`, `_`, `\` escaped) |
| Member directory search (`group.members(search:)`, `people(search:)`) | `Search.forUsers` | full-text index subquery restricted to person rows (same prefix/stemming semantics, no access filter inside the subquery; the people filter below still applies) |
| People autocomplete (`people(autocomplete:)`) | `filterAndSortUsers` | `to_tsvector('simple', users.name) @@ to_tsquery('simple', prefix-query)` with special chars splitting words (so `o'brien` → `o:* & brien:*`), ordered by `ts_rank_cd` desc then name; optional `groupIds` limits to active members of those groups |
| Group explorer / group lists (`groups(search:)`) | `Search.forGroups` → `filterAndSortGroups` | `to_tsvector('english', col) @@ to_tsquery(prefix)` on name OR description OR location (special chars split words); spaces excluded unless explicitly requested |
| Group autocomplete (`groups(autocomplete:)`) | `forGroups` | `groups.name ILIKE 'term%'` |
| Topic autocomplete (`topics(autocomplete:)`) | `Search.forTags` | `tags.name ILIKE 'term%'`, limited to topics used in groups the user belongs to (optionally `groupSlug`/`groupIds`), excluding system tags starting with `‡` |
| Tracks / funding rounds autocomplete | `forTracks` / `forFundingRounds` | parent group name `ILIKE 'term%'` |
| Skills autocomplete | `Skill.search` | (module 20) |

People visibility filter (`personFilter`, applied to `people`/`members` queries for a logged-in user): excludes users the viewer has blocked/been blocked by; limited to Axolotl (system user), users sharing a group, connected users, or users with a public profile. Anonymous: public profiles only.

## 6. Shared typeahead behaviour

### 6.1 Editor mentions (`@` people, `#` topics) — TipTap Mention extension (HyloEditor, used by post editor, comments, chat, DMs)
- **Trigger** `@` (people; spaces allowed in the query) and `#` (topics). The dropdown mounts immediately (showing "Loading...") then updates when results arrive; stale responses are dropped by request id.
- **People**: `people(autocomplete: query, groupIds: <editor's groups>, first: 7, offset)` → items `{id, label: name, avatarUrl}`. Empty query returns members of the post's groups so the list opens instantly. Infinite "load more" when scrolling to the end or arrowing to the last item (offset = loaded count).
- **Topics**: `topics(autocomplete: query, groupIds, first: maxSuggestions)` → items labelled `#name`. If the typed query is longer than 2 characters, the literal query is prepended as a "create" option `#<query>`. Duplicates removed by label.
- **Popup**: tippy.js, `placement: bottom-start`, offset −10, no arrow, appended to `body`, theme `suggestions` (mobile WebView editor: `suggestions-mobile`, which pads the editor if it's too short to show the list). List rows are buttons `suggestion-list-item` with a tiny avatar (people) and label; selected row `is-selected`. Empty: "No result".
- **Keys**: ↑/↓ wrap around and scroll the selected row into view; Enter inserts; Escape closes. Typing a query with more than one space and zero results closes the list.
- Inserted nodes render as `<span class="mention" data-id=… >Name</span>` / `<span class="topic">#name</span>`; mentions trigger notifications (module 19); clicking them in rendered content goes to `/groups/:slug/members/:id` (or `/all/members/:id`) and topic tags to tag search.

### 6.2 `TagInput` + `KeyControlledList` (base component for chip-style pickers)
- Selected items are inline chips (optional small round avatar, label, `×` remove). Spaces render as "Parent / [icon] Space".
- Input: typing is debounced **200ms** before `handleInputChange`; focus triggers a fetch with `''`; blur clears input and suggestions after 150ms. Optional `stripInputHashtag`, `addLeadingHashtag`.
- Suggestions dropdown below input (`absolute top-full w-full z-10`, `bg-input border rounded-md shadow-lg`), rows `p-2 rounded-md hover:bg-selected`. Mouse-down inside the list doesn't blur the input.
- Keyboard (KeyControlledList): ↑/↓ move highlight; Enter chooses; Tab chooses when `tabChooses`; Space chooses unless `spaceChooses=false`. With `allowNewTags`, Enter/Space/Comma create a tag from the raw text; Esc clears.
- `maxTags`: once reached, typing shows a single error row "no more than {{maxTags}} allowed".

### 6.3 MemberSelector (e.g. post editor "project members"/co-hosts)
- TagInput with placeholder "Type persons name..." (`spaceChooses=false`).
- Typing → debounced 300ms `fetchPeople({autocomplete, groupIds: forGroups})`; suggestions are computed client-side from the members of the given groups already in the store: not already selected, not the current user, name contains the input (case-insensitive), sorted by name. Suggestion row: small round avatar + name.

### 6.4 TopicSelector (post editor topics, custom view topic filters)
- react-select AsyncCreatable multi-select; placeholder "Enter up to three topics..."; **max 3** topics.
- Leading `#` stripped. Query → `topics(autocomplete, groupIds | groupSlug, includeCounts)`; results sorted exact-name match first, then followers desc, then posts desc; grouped under "All Topics" (plus a default-topics group named after the single group or "Default Topics" — default-topic fetching is currently disabled).
- Option rendering: `#name` with two stats: Star icon "{n} subscribers", Events icon "{n} posts" (≥1000 shown as `1.2k`).
- Create option when input (minus `#`) length > 1: "Create topic \"#{{item.value}}\"", or the validation message. Topic name rules (`validateTopicName`): no `#`, `/`, `@`; not a relative path; no whitespace; 2–40 characters; message "Topic name …".
- At the limit: no options; message "You can only select up to {{MAX_TOPICS}} topics"; otherwise "Start typing to add a topic".
- Styling: control `rounded-lg` border `--border` (focus `--ring`), chips `bg-selected`, menu `bg-background` with border and shadow, focused option `selected/10`.

### 6.5 ToField (post editor "Post in" groups/spaces)
- TagInput over a fixed option list (groups and spaces the user can post to); filtering is client-side: case-insensitive substring of option name or parent group name (regex-escaped); options already selected excluded; empty input lists all. Space options are indented and shown "Parent / [icon] Space". Removal by group id. (Module 13.)

### 6.6 DM PeopleSelector (`/messages/new`)
- Placeholder "Send a new message to..." (first), "+ Add someone..." (subsequent), "Group limit reached" at the participant cap; note "Group messages are limited to {{count}} people". Input filter debounced 200ms, remote fetch throttled to once per 1000ms. (Module 18.)

## 7. Permissions
- `/search` requires login. Result visibility per §5.1 access filter. Group-scoped search trusts the supplied `groupIds` (no membership check in the resolver — see quirks).
- People in search results are **not** passed through the blocked-user / shared-group person filter that `people` queries use.

## 8. API summary
| Query | Used by |
|---|---|
| `search(term, type, first: 20, offset, groupIds)` | Search page |
| `people(autocomplete, first, offset, groupIds)` | @mentions, MemberSelector, DM picker |
| `topics(autocomplete, first, groupSlug, groupIds) { items { id name followersTotal postsTotal } }` | #mentions, TopicSelector |
| `groups(autocomplete|search, …)` | group pickers, explorer |
| `posts(search: …)` / `group.posts(search:)` | stream filters |
| `group.members(search:)` | members directory |

## 9. Edge cases & known quirks
- Highlighting is disabled: `Highlight` receives `terms: []`, so matches are never highlighted and the person "matching skill" pill never appears (`.highlight` style is `caribbean-green-20` but unused).
- Index refresh lag of up to 10 minutes; newly created/edited content and new members may be missing from search.
- Chat posts are indexed (only `welcome` and `chat_activity` excluded) and so appear as Post results.
- Post weight: title B, so a person/group name match (A) tends to outrank post titles.
- Comments only match their text and author name, not the parent post.
- The Search page's tab selection isn't persisted in the URL; reloading returns to "All".
- "Searching in group {name}" is not translated.
- `groupIds` passed to `search` are not validated against membership, so a crafted request could search inside a group the user doesn't belong to (posts/members/comments of that group).
- Search results bypass the person visibility filter (blocked users can appear).
- `total` always empty.
- If `groupSlug` refers to a group not in the local store, results never load (`groupScopeReady` stays false; spinner).
- Spaces are never returned as Group results (excluded from the index).
- Unscoped search includes public posts from anywhere on Hylo, not only the user's groups.

## 10. Docs vs. code
| Docs | Code |
|---|---|
| "Click on the magnifying glass in the upper right of the screen to go to the search page" | There is no global search button; search launches from a view's header search box (center-column top right on desktop), the card-menu banner icon, or hashtag clicks. |
| "Search among all people, discussions and comments or just one of those categories" | Five tabs: All, Posts, Comments, People, Groups (groups are searchable too). |
| "Search a Group Stream by keyword using the magnifying glass at the top of a Group Stream" | The stream header search box opens the global search page pre-scoped to the group ("Search in {{groupName}}") rather than filtering the stream in place. |

## 11. Source references
- `apps/web/src/routes/Search/{Search.js,Search.store.js,Search.module.scss}`
- `apps/web/src/components/ViewHeader/ViewHeader.jsx`, `ContextMenu/ContextMenuGrid.jsx` (banner search), `components/ClickCatcher/ClickCatcher.js`, `PostCard/PostHeader/PostHeader.js` (hashtags)
- `apps/web/src/components/HyloEditor/extensions/{PeopleMentions.js,TopicMentions.js,suggestions/*}`
- `apps/web/src/components/{TagInput,KeyControlledList,MemberSelector,TopicSelector,ToField}`, `routes/Messages/PeopleSelector`
- `apps/web/src/store/actions/{findMentions.js,findTopics.js}`
- `packages/navigation/src/index.js` (`tagSearchUrl`, `searchUrl`), `packages/shared/src/Validators.js`
- `apps/backend/api/services/{FullTextSearch.js,Search.js,Search/forUsers.js,Search/forPosts.js,Search/util.js,Search/prefixTsQuery.js,Search/addTermToQueryBuilder.js}`
- `apps/backend/api/graphql/{makeSchema.js,schema.graphql,searchQuerySet.js,makeModels.js,filters.js}`, `apps/backend/cron.js`
