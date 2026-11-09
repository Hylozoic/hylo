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

