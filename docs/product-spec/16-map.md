# 16 — Map

> Cross-links: view/menu system → [15-views-streams-spaces.md](15-views-streams-spaces.md); post editor & post location field → [13-posts-comments.md](13-posts-comments.md); member profile location & settings "Saved Searches" tab → [05-user-settings.md](05-user-settings.md), [20-members-profiles.md](20-members-profiles.md); group location/boundary editing → [11-group-settings.md](11-group-settings.md); notifications for saved searches → [19-notifications-email-push.md](19-notifications-email-push.md); farm map widget → [09-groups.md](09-groups.md); public group explorer → [09-groups.md](09-groups.md).

---

## 1. Overview

The **Map Explorer** shows geolocated content on an interactive web map: posts (with a location), group members (with a profile location), related groups, and spaces of the current group, plus group/space boundary polygons. It has a right-hand **results drawer** listing what is in the current viewport, client-side filtering by feature type / keyword / topic, a base-layer switcher (Mapbox styles) and an optional **Native Territories** overlay, a place-search box (Mapbox geocoder), **saved searches** ("Save this view"), and long-press / "+" creation of a post at a clicked location.

It is available in three contexts:

| Context | Route | What is shown |
|---|---|---|
| Group / space | `/groups/:slug/map`, `/groups/:parent/spaces/:space/map` | Posts of the group (plus child groups/spaces the viewer belongs to, toggleable), members of the group, child groups + spaces of the group, the group itself |
| All My Groups | `/all/map` | Posts from all the viewer's groups; groups the viewer can see in the area; **no members** |
| Public (The Commons) | `/public/map` | Public posts; public groups `allowed_in_public`; **no members**; no boundary polygons |

The map is a menu view type (`type = 'map'`, default label "Map", Lucide `Map` icon) that a steward can add to a group/space menu ([15](15-views-streams-spaces.md)). Public menu label "Public Map"; My Home label "All My Groups Map".

Technology (web): Mapbox GL JS via `react-map-gl` (Mercator projection) with a deck.gl `MapboxOverlay` (non-interleaved canvas on top of the map) for Hylo features; clustering with `supercluster`; geometry helpers from Turf. A re-implementation needs: a slippy vector/raster base map with the four styles below, a WebGL/canvas overlay for icon markers + clusters + GeoJSON polygons, and a geocoding provider.

---

## 2. Concepts & data

### 2.1 Location (`locations` table, `Location` model)

Shared by posts (`posts.location_id` + free-text `posts.location`), users (`users.location_id`, `users.location`), and groups/spaces (`groups.location_id`, `groups.location`, plus `groups.geo_shape` boundary polygon).

GraphQL `Location`: `id, accuracy, addressNumber, addressStreet, bbox [Point], center Point {lat,lng}, city, country, fullText, geometry, locality, neighborhood, region, postcode, wikidata` (see §7). `center` is a PostGIS point (SRID 4326); bounding-box queries use `locations.center && ST_MakeEnvelope(west, south, east, north, 4326)`.

### 2.2 Saved search (`saved_searches`, `SavedSearch`; `saved_search_topics`, `SavedSearchTopic`)

See §5.4 for fields.

### 2.3 Feature types (`FEATURE_TYPES` in `MapExplorer.store.js`)

Post types from the web `POST_TYPES` + `member` + `group`. Only types with `map: true` are toggleable/default-on:

| Feature | Primary colour (RGBA) | On map by default |
|---|---|---|
| discussion | 0,163,227 (picton blue) | yes |
| event | 254,72,80 | yes |
| offer | 0,199,157 | yes |
| request | 102,75,165 | yes |
| resource | 255,212,3 | yes |
| project | 252,128,0 | yes |
| proposal | 0,163,227 | yes |
| member | 201,88,172 | yes (not offered in Public) |
| group | 128,140,155 ("Related Groups & Spaces") | yes |
| chat, action | — | never (map:false) |

---

## 3. Routes / entry points

| Route | Notes |
|---|---|
| `/groups/:groupSlug/map/*` | `MapExplorer context=groups view=map` |
| `/groups/:parentSlug/spaces/:spaceSlug/map/*` | same, scoped to the space (`useEffectiveGroupSlug`) |
| `/all/map/*` | `MapExplorer context=all` |
| `/public/map/*` | `MapExplorer context=public` (also reachable logged-out via the public layout; then no saved searches / creation) |
| `.../map/post/:postId` | post opens as a dialog over the map (`postUrl(..., view:'map')`) |
| `.../map/group/:groupSlug` | group detail panel over the map (`groupDetailUrl`) |

Map URL query parameters:

| Param | Meaning |
|---|---|
| `center` | `lat,lng` (URL-encoded); written on every move (replace) |
| `zoom` | float zoom; written on every move |
| `style` | base layer id (`light-v11`, `streets-v12`, `satellite-v9`, `satellite-streets-v12`) |
| `hide` | array of feature types toggled **off** |
| `topics` | array of topic ids to filter by |
| `search` | keyword filter |
| `sortBy` | drawer sort (`updated`/`created`/`reactions`) |
| `c` | child posts `yes`/`no` (groups context) |
| `hideDrawer` | `true` to collapse the drawer |
| `group` | extra group slugs to include (array) |
| `create=post&lat=&lng=` | opens the post editor with the location prefilled |

Entry points: group/space menu "Map" item; My Home "All My Groups Map"; Commons "Public Map"; saved-search "View"; legacy custom views with `defaultViewMode='map'` redirect here ([15](15-views-streams-spaces.md)); Group Explorer map.

---

## 4. UX specification

### 4.1 Layout

- The map fills the center column (left of the drawer); header via `ViewHeader`: title "Map", Lucide `Map` icon, no info line. Document title: `Map | {group name} | Hylo`, or `Map | Public | Hylo`, or `Map |  All My Groups | Hylo`.
- First visit: tour invitation "New to the map? Take a quick tour." with steps: "The results drawer" — "The list of everything on the map lives here, with a lens for posts, groups, and people."; "Choose what appears" — "This is a filter: pick which kinds of things show up on the map."; "Map layers" — "Switch base styles and overlays, including Native Territories."; "Save this view" — "Saves the current map view as a search you can revisit any time."
- Floating controls (all: 2px border at 20% foreground, rounded-md, background colour, 85% opacity → 100% and scale 1.05 on hover):
  - **Top-left**: Saved searches heart button (36×36, `Heart` icon; selected-colour border when open) — logged-in only. Next to it (left 74px, width 320px max) the **location search** input (`LocationInput` with `saveLocationToDB=false`).
  - **Top-right**: Mapbox navigation control (zoom ±, compass) at top 55px/right 13px; inverted colours in dark mode. When the drawer is hidden, an "Open Drawer" hamburger button at top 20px.
  - **Bottom-left**: "Features: **N/M**" button (N = enabled feature types, M = available) toggling the feature-filter panel.
  - **Bottom-right**: Layers button (`Layers` icon, tooltip "Change Map Layers") above the "+" add button (logged-in only; tooltip "Add item to map"). Controls shift left when the drawer is open.
- Any map mousedown closes open panels (features, layers, saved searches).
- Loading: a spinner overlays the map while the map-posts fetch is pending.

### 4.2 Initial viewport

Center (first match): `?center` → last pan stored for the same scope (`context:groupSlug`, kept in the client store for the session) → the group's location pin, or the centroid of its boundary polygon → the viewer's profile location → the browser's geolocation (requested only when none of the above; sets zoom 10) → fallback `lat 35.442845, lng 7.916598` (central Africa/Mediterranean). Zoom: `?zoom` → stored zoom for the scope → 10 (a center always exists, so the 2 branch is unreachable). Bearing/pitch 0. When the scope changes or the group's center arrives late, the viewport re-fits to it.

On every move end (debounced 300ms): the visible bbox is computed; the **total loaded bbox** is extended to the union of the previous total and the new view (Turf `combine` + `bbox`) — data fetches use the total box, so panning back never refetches; `center`/`zoom` are written to the URL (replace) and store.

### 4.3 Base layers & overlays

Layers panel (200px, above the layers button):
- "Base Layer" dropdown: **Basic** (`light-v11`), **Streets** (`streets-v12`), **Satellite** (`satellite-v9`), **Satellite + Streets** (`satellite-streets-v12`, default). Choice saved to `user.settings.mapBaseLayer` (logged-in) and `?style`. Invalid stored values fall back to the default.
- Dark mode substitutes: `light-v11` → `dark-v11`; `streets-v12` → `navigation-night-v1`; satellite styles unchanged.
- "Other Layers": switch **Native Territories** (colour rgb(0,163,227)) with an info icon linking to https://native-land.ca (tooltip "Credit to native-land.ca"). Source GeoJSON: `https://hylo-app.s3.amazonaws.com/map/indigenousTerritories.json`; fill using each feature's `color` property at 25% opacity, black outline, plus centred 14px name labels with white halo. Hovering shows a tooltip "Native Territories" + the names of the territories under the cursor. Not persisted.
- There are no watershed/ecological layers in code (an unused deck.gl `indigenousLayers` and `scatterplotLayer` module exist as dead code).

### 4.4 Markers, clusters and polygons (deck.gl overlay)

Draw order (bottom→top): group boundary polygons, space boundary polygons, group/space icons, post+member cluster layer.

**Posts & members** (`PostClusterLayer`): features = posts with `locationObject.center` and members with a location. Clustered with Supercluster (`radius 20`, `maxZoom 25`) for the current integer zoom and visible bbox.
- Single feature: 15px sprite `<type>.png` from the sprite atlas `/mapIconAtlas.png` (coloured dot per type: discussion, event, offer, request, resource, project, proposal(uses its own sprite)… member).
- Cluster: 34px sprite named by the set of types present, in order event, member, offer, request, resource, project, discussion (proposal counts as discussion), pluralised and joined with `-` (e.g. `events-members-discussions.png`); white count text (14px, "Circular Bold") centered.
- Zoom > 14: label under each single feature (type colour, 14px, offset 15px down; titles over 20 chars truncated to 19 + "...").
- Hover tooltip (offset 15px from the pointer): a single feature shows its title (posts) or name (members), coloured by type; a cluster shows a line per type: "N discussions", "1 event"… Cursor becomes pointer over features; "grab" otherwise; in add mode a pin cursor (`/assets/create-post-pin.png`, hotspot 12,31).
- Click a cluster: fly (500ms) to the centroid of its leaves at `max(currentZoom, expansionZoom)` (expansion zoom capped at 14). At zoom ≥ 20 with the drawer hidden: open the drawer. On mobile devices at zoom 18–20: toggle the drawer.
- Click a post → post dialog over the map; member → member profile (`/groups/:slug/members/:id`).

**Groups & spaces** (`IconLayer`, 32px, anchored at top): only groups/spaces with a location pin.
- Group: circular 42px avatar (pre-sized `-forMap.png` variant when it exists, else the avatar clipped to a circle client-side with a black hairline stroke; initials on a theme gradient circle — white bold 15px text — until the image loads or when there is no avatar).
- Space: white circle (2px slate stroke) with the space's Lucide icon (22px).
- Tooltip "Group: {name}" / "Space: {name}". Click group → group detail panel (`/…/map/group/:slug`); click space → the space home (`spaceHomeUrl(parentSlug, space)`).

**Boundaries** (`GeoJsonLayer`, not in Public context): `groups.geo_shape` polygons; fill rgba(64,161,221,65/255), line rgba(60,100,180,100/255) min 1px; spaces drawn above groups. Tooltip "Group area: {{name}}" / "Space area: {{name}}". A polygon is included if any vertex is inside the view or its center is inside.

### 4.5 Feature filter panel

Title "What do you want to see on the map?" then a coloured switch per feature type (colour = type primary colour): Discussions, Requests, Offers, Resources, Projects, Proposals, Events, Members (not in Public), "Related Groups & Spaces". Labels are the type capitalised + "s". Toggling writes `?hide=` (types turned off) and the client filter state. Filtering is **client-side** on already-fetched data (posts/members/groups), except the drawer's post fetch, which passes enabled types as `types`.

### 4.6 Results drawer (`MapDrawer`)

Right side; width 40% (min 330px, max 400px); hidden by default on mobile devices; toggled by its X ("Close Drawer") or the "Open Drawer" button (`?hideDrawer`), resizing the map after 100ms.

Header:
1. X button + keyword input "Filter by topics and keywords". While focused, up to 10 topic suggestion chips (topics of currently fetched map posts, by frequency, "count name") — mousedown adds a topic filter. Enter commits the keyword (`?search`). Active filters render as removable chips: `"keyword" ×` and `count #topic ×`.
2. Lens dropdown ("Show on map" label): **All**, **Posts**, **Spaces**, **Groups**, **People** (People hidden in Public), each with a count (All = posts in view + groups/spaces in view + people). Lens is local UI state (not in URL).
3. Child-posts toggle (groups context only; `Subgroup` icon; tooltip "Hide posts from child groups and spaces" / "Show posts from child groups and spaces"; writes `?c` and `user.settings.streamChildPosts`).
4. Sort dropdown: "Latest activity" (default, `updated`), "Post Date" (`created`), "Popular" (`reactions`).

List (scrolls; infinite scroll loads 10 more posts):
- **Post row** card: 18px creator avatar, creator name, type pill (type colour text/border, 14% tinted background, uppercase 8px), relative time; bold title; first image (16:9) if any; for events a date chip ("from — to" in the viewer's format) else comments count, reactions count and first `#topic`. Whole card links to the post (opens over the map).
- **Space card**: 40px circle with avatar or Lucide icon, name, "Space"; links to space home.
- **Group card**: banner background under a dark gradient wash (lightens on hover), 66px rounded avatar (or initials tile), name (+ `$` icon with tooltip "This group requires payment to join" when paywalled), "{{count}} members", 3-line markdown description; links to the group (if member) or the group detail panel.
- **People**: a card containing `Member` rows.
- The drawer lists only items whose location is inside the **current** viewport; the current group is always listed among groups.

### 4.7 Location search

`LocationInput` → `GeocoderAutocomplete`: queries Mapbox Geocoding v5 `https://api.tiles.mapbox.com/geocoding/v5/mapbox.places/{query}.json?access_token=…&proximity={lng,lat}` (proximity = browser location when available). Placeholder "Search for a location...". Inputs that look like URLs do not search. Selecting a result: if it has a bbox, fit it with zoom `min(log2(360 / max(Δlng, Δlat)), 20)`; else center on it at zoom 13. The map does not persist the location. (In other forms `saveLocationToDB=true` calls `findOrCreateLocation` and polls until saved.)

Mapbox result → Location mapping (`LocationHelpers.convertMapboxToLocation`): `accuracy`, `addressNumber`/`addressStreet` (from `properties.address` split on the first space, or `address`+`text` for address results), `bbox` (2 corner points), `center`, `city` (context `place`, or the result itself if a place), `country`, `country_code`, `fullText = place_name`, `mapboxId`, `neighborhood`, `region`, `postcode`.

### 4.8 Creating posts from the map (logged-in only)

- **Long-press**: pressing and holding on the map for 1000ms without dragging opens the post editor (`?create=post&lat=&lng=`) with that location prefilled; any drag or move-end cancels.
- **"+" button**: arms add mode (button shows pressed state; hint pill "Press where you want to create"; pin cursor). The next press on the map opens the editor immediately at that point; add mode then resets.
- No type chooser: the editor opens with its default type; location fields are filled from lat/lng ([13](13-posts-comments.md)).

### 4.9 Saved searches ("Save this view")

Popover from the heart button (logged-in):
- Title "Save this view", subtitle "Get updates about this map view", close ×.
- Name input "Name this view" + "Save" (disabled until a name is typed). Below, an info line summarising current filters: "Post types: a, b • Topics: x • Search term: "y"" or "No filters".
- "Saved Views" list: each with name, trash icon (delete), "View"; info line preview "Group: {name} • Post types: …" / "Public Groups • …" / "All Groups • …", with a tooltip listing "Created on {long date}", "Context: all|public", "Group: …", "Search term: …", "Post types: …", "Topics: …".
- Save sends: name, context, groupSlug, current viewport bbox (2 points), `postTypes` = enabled feature types (may include `member`/`group`), `searchText`, `topicIds`.
- View: navigates to `/all/map`, `/groups/:slug/map` or `/public/map` and applies the saved bbox (fit), feature types and search text.
- The same list is managed in User Settings → "Saved Searches" ([05](05-user-settings.md)).

### 4.10 Empty / error states

No explicit empty state on the map or drawer (an empty drawer list renders nothing). Missing geolocation permission is silently ignored.

---

## 5. Business rules & side effects

### 5.1 Data fetching (all triggered once a total bbox exists)

| Fetch | Query | Key params | Size |
|---|---|---|---|
| Map posts | groups: `group(slug){ viewPosts | posts }` (by `c`); all/public: root `posts(context)` | `boundingBox` = total loaded bbox, `isFulfilled: false`, `groupSlugs`, no type filter | `first: 500` |
| Drawer posts | same, full post-card fields | `boundingBox` = current view bbox, `types` = enabled feature types, `search`, `topics`, `sortBy`, `isFulfilled: false` | `first: 10`, offset paging |
| Members | `group(slug){ members(sortBy:"name", order:"asc", boundingBox, search) }` — groups context only (All/Public return no members) | total bbox | all |
| Groups | `groups(boundingBox, context, parentSlugs:[groupSlug,…], allowedInPublic: context==='public')` — skipped in groups context until a slug exists | total bbox | default |

- `isFulfilled: false` ⇒ completed/expired posts (fulfilled, or `end_time` before today) are never on the map.
- Server bbox filter: posts and users `locations.center && ST_MakeEnvelope(w,s,e,n,4326)`; groups: center within **or** `ST_Intersects(groups.geo_shape, envelope)`.
- Groups context: `parentSlugs` returns child groups (via relationships) **and spaces** of the group; Public: groups with `allow_in_public = true` and visibility Public; All: groups visible to the viewer (spaces excluded unless parentSlugs). The current group is added client-side.
- Client-side filtering (instant, no refetch): feature type toggles; keyword (posts: title, details, topic names; members: name, tagline, exact skill; groups: name, description); topics (posts with a matching topic name; members whose tagline contains or skill equals the topic; groups whose name/description contain it).
- Drawer sort is client-side over fetched drawer posts: reactions desc / updatedAt desc / createdAt desc.

### 5.2 Location privacy

- **Group location precision** (`groups.settings.location_display_precision`: `precise` default | `near` | `region`, set in group settings [11](11-group-settings.md)): for viewers without Administration on that group — `near`: `locationObject.center` is randomly shifted on every load by `random()*0.03 − 0.03` degrees in each axis (≈ up to 3 km, always south-west) and street fields are omitted; `location` text becomes "City, Region, Country"; `region`: `locationObject` is null (no map marker) and text is "City, Region, Country". Administrators always see the precise location.
- **Members**: no obfuscation — a member's profile location center is shown precisely to fellow members of the group. Members appear only in a group/space map (requires membership to query the group's members).
- Posts: exact post location; visibility follows normal post visibility ([13](13-posts-comments.md)); Public map shows only `is_public` posts.

### 5.3 Location records

`findOrCreateLocation(data)`: dedupes by (address number + street + city + locality + neighborhood + postcode + country code) or else exact `full_text`; otherwise inserts. `center` stored as `POINT(lng lat)`, bbox as a polygon (SRID 4326); returned parsed back to `{lng,lat}` / point arrays.

### 5.4 Saved searches

Table `saved_searches`: `id, user_id, name, context ('all'|'public'|'groups'; anything else → error "Invalid context"), group_id (groups context, resolved from `groupSlug`), is_active, search_text, post_types (text[]), bounding_box (PostGIS polygon 4326), last_post_id (set to the newest post id at creation), created_at, updated_at`. `saved_search_topics(saved_search_id, tag_id)` one row per topic.

- `createSavedSearch(data)`: owner is always the authenticated user (client `userId` ignored).
- `deleteSavedSearch(id)`: owner only ("You don't have permission to delete this saved search"); soft delete `is_active = false`; returns the id.
- `savedSearches(userId)`: active searches of the given `userId`.
- **Notifications (email digest only)**: daily at cron hour 12 (and weekly on Wednesdays) `savedSearches.sendAllDigests(type)` processes active **`groups`-context** searches only: new posts in that group with `id > last_post_id`, location center `ST_Within` the bbox, type in `post_types`, optional ILIKE on title/description for `search_text`, and any of the topics (if topics set). Sent only when the user's membership `digestFrequency` equals the run type (`daily`/`weekly`) and there is ≥1 new request/offer/event/discussion/project/resource. Email subject from i18n "New saved search results in {name}" (6 locales). On success `last_post_id` advances. No in-app or push notifications. `all`/`public` searches never notify.

---

## 6. Permissions

| Capability | Who |
|---|---|
| View group/space map | Members of the group/space (spaces: space members) |
| View All My Groups map | Logged-in users |
| View Public map | Anyone (logged-out users: no saved searches, no "+", no long-press creation) |
| See members on map | Members of the group (groups context only) |
| See precise group location | Everyone when precision = precise; else group Administrators |
| Create post from map | Logged-in users (post-creation permissions apply in the editor) |
| Saved searches | Logged-in; delete own only |
| Add a Map view to a menu | Administration ([15](15-views-streams-spaces.md)) |

---

## 7. API

- `group(slug){ posts|viewPosts(boundingBox:[PointInput], isFulfilled, types, search, topics, sortBy, first, offset…) members(boundingBox, search, sortBy, order) }`
- `posts(context:'all'|'public', boundingBox, groupSlugs, …)`
- `groups(boundingBox, context, parentSlugs, allowedInPublic, search, sortBy, visibility){ items{ id avatarUrl description geoShape homeRoute icon memberCount name parentId slug type locationObject{…} parentGroup{id slug} } }`
- `PointInput {lat, lng}`; bounding box = `[southWest, northEast]`.
- `findOrCreateLocation(data: LocationInput): Location`
- `savedSearches(userId: ID): SavedSearchQuerySet` → `SavedSearch{ id boundingBox:[Float] (lng,lat,lng,lat) createdAt context group isActive name newPosts postTypes searchText topics }`
- `createSavedSearch(data: SavedSearchInput{boundingBox:[PointInput], context, groupSlug, name, postTypes, searchText, topicIds, userId}): SavedSearch`
- `deleteSavedSearch(id: ID): ID`
- `Group.geoShape` (GeoJSON), `Group.locationObject`, `Group.location` subject to precision rules; `createSpace/updateSpace(geoShape)` ([15](15-views-streams-spaces.md)).

---

## 8. Edge cases & known quirks

- Saved searches capture member/group toggles in `postTypes`, but the digest only matches post types; `all`/`public` searches never send anything (code TODO).
- `savedSearches(userId)` lists active searches for any `userId` argument (resolver filters by the argument, not the session).
- Viewing a saved search does not restore topics into the filter UI beyond the stored list, and the URL is updated only after navigation.
- `near` precision always shifts south-west (offset range [−0.03, 0)), and re-randomises each load so the marker jumps.
- Groups/spaces that have only a boundary (no pin) show a polygon but no icon marker (polygons hidden on the Public map entirely).
- Posts are limited to 500 per map fetch in the loaded area; beyond that, markers are missing although the drawer pages.
- The tour's first step targets the "Open Drawer" button, which only exists when the drawer is hidden.
- Mobile web hides the drawer by default; legacy WebView / `hideNavLayout` adjusts control positions.
- Long-press creation uses `mousedown`/`touchstart`; a quick tap never creates.
- The custom-view "Map" default view mode is disabled in the UI ("temporarily hidden while the Map view mode is in progress").
- Dead code: `GroupIconLayer` class, `indigenousLayers`, `scatterplotLayer`.

## 9. Docs vs. code

- Docs ("Saved map searches"): saving a view "in the Group view or Public view" gives "notifications when there is new activity within that saved area", with the example of saving a view of members in a bioregion. **Code**: only `groups`-context searches ever produce anything, and only as daily/weekly email digests of new *posts* (types request/offer/event/discussion/project/resource); Public/All searches and member/group toggles never notify; no in-app or push notification.
- Docs: "Clicking on the menu icon (three horizontal lines) in the upper right of the map opens up the sidebar, which shows you all of the Posts, Groups, and Members". **Code**: the drawer is open by default on desktop (hidden on mobile); it uses a lens dropdown (All/Posts/Spaces/Groups/People) and lists spaces too; people are shown only in group/space maps.
- Docs colour legend lists "Requests (yellow)" (and Requests twice); **code**: requests are purple (102,75,165), resources yellow (255,212,3), offers green, events red, projects orange, members pink, groups grey; proposals blue.
- Docs call the filter button "Post Types" in one place; **code** label is "Features: N/M".
- Docs do not mention group/space boundary polygons, location-precision obfuscation, long-press/"+" creation details, spaces on the map, or dark-mode base styles — all present in code.

## 10. Source references

- Web: `apps/web/src/routes/MapExplorer/{MapExplorer.js,MapExplorer.store.js,MapDrawer/MapDrawer.js,SavedSearches/SavedSearches.js}`, `components/Map/{Map.js,NativeTerritoriesLayers.js,layers/*}`, `components/LocationInput/*`, `components/GeocoderAutocomplete/GeocoderAutocomplete.js`, `util/savedSearch.js`, `tours/mapTour.js`, `store/models/Post.js` (POST_TYPES colours), `components/GroupNetworkMap` (separate network graph, see [09](09-groups.md)).
- Packages: `packages/shared/src/LocationHelpers.js`.
- Backend: `api/models/{Location,SavedSearch,SavedSearchTopic}.js`, `api/graphql/mutations/{location,savedSearch}.js`, `api/graphql/makeModels.js` (Group.location/locationObject precision, SavedSearch, Post/Group fetchMany), `api/services/Search/util.js` (bbox filters), `api/services/Search.js` (forGroups), `lib/group/digest2/savedSearches.js`, `cron.js`, `lib/constants.js` (`LOCATION_DISPLAY_PRECISION`), `lib/i18n/*`.
- Tests: `apps/web/e2e/map-group-cards.spec.js`, `routes/MapExplorer/*.test.js`, `components/Map/layers/*/index.test.js`.
