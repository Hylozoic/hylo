# Spec: Workspace Post Type

Status: Draft  
Author: Codex (ChatGPT) for Hylo team  
Last Updated: 2025-02-09

## Summary
Introduce a new `workspace` post type that opens an interactive, Figma/Miro-style canvas while still behaving like other posts in feeds, chats, and notifications. The canvas must support real-time collaboration, rich editing (shapes, vectors, sticky notes, embedded Hylo entities, file and image drops), and continue to use Hylo's existing post permissions, comments, and engagement flows. This document proposes backend, data, GraphQL, web, and mobile changes plus rollout, observability, and open questions.

## Goals
- Treat workspace posts as first-class citizens in streams, chats, search, notifications, and moderation tools.
- Provide a collaborative canvas where users can add/manipulate shapes, draw vectors, upload or paste media, and drop references to posts, users, and other group data items.
- Allow multiple members to edit the workspace simultaneously with presence indicators, undo/redo, collision-free updates, and autosave.
- Generate thumbnails/snapshots so workspace posts have meaningful previews in cards.
- Reuse existing Hylo concepts: post permissions, attachments, comment threads, moderation, and analytics.
- Deliver an initial web editing experience with a clear path for mobile consumption (read-only initially, authoring later).

## Non-Goals
- Importing or embedding full Figma/Miro boards from external tools.
- Offline collaboration or conflict resolution beyond online CRDT syncing.
- Granular per-object permissions within a workspace (all viewers of the post share the same editing level for now).
- Full design-system overhaul of the Hylo editor or stream UI.
- Solving network-partition tolerant collaboration beyond best-effort reconnect and autosave.

## Success Metrics
- ≥ 30% of groups with the feature flag enabled create at least one workspace in the first 30 days.
- ≥ 75% of workspace opens render a snapshot successfully in the stream card.
- Real-time collaboration latency ≤ 250 ms round-trip for updates in targeted regions.
- Error rate for workspace save/persist operations < 0.5% in the first month post-launch.

## Glossary
- **Workspace Post**: A Hylo post whose `type` is `workspace`; it owns exactly one collaborative canvas document plus standard post metadata.
- **Canvas Node**: A shape or object on the workspace (text box, sticky note, connector, embedded Hylo resource, pasted image).
- **Workspace Document**: The persisted CRDT state (base snapshot and revisions) backing a workspace post.
- **Workspace Revision**: A persisted checkpoint of the workspace document used for history, audit, and recovery.
- **Awareness/Presence**: Metadata shared across clients to represent cursors, selections, and currently active collaborators.
- **Group Data Items**: Objects tied to a group (posts, members, tracks, resources, collections) that can be referenced on the canvas.
- **Snapshot**: A static PNG or JPEG preview stored with the workspace for use in cards and link unfurls.

## Current State
- Posts are stored in `posts` (Bookshelf model `Post`) with `type` constrained to action, chat, discussion, event, offer, project, proposal, request, resource, thread, or welcome.
- Post validation lives in `apps/backend/api/models/post/validatePostData.js`; unknown types are rejected.
- Streams, filters, analytics, and background jobs assume the existing type set (e.g. `Search/util.js`, `Group.doesMenuUpdate`).
- Post creation flows (`createPost`, `PostEditor`, `PostTypeSelect`, `CreateMenu`, mobile editor) rely on `POST_TYPES` definitions for icons/colors/prompt text.
- There is no persisted collaborative document or websocket channel dedicated to post bodies; real-time support exists for comments and typing only (`Websockets.js`, GraphQL subscriptions).
- Attachments are stored in `media` referencing posts or comments; there is no attachment type scoped to arbitrary editors or canvases.
- Post detail views (`PostDetail`, mobile analogue) render HyloEditor output or proposal widgets; no concept of an embedded canvas.
- Search, digests, saved searches, Zapier triggers, menu auto-updates, and moderation flows rely on post `type` filters.

## Requirements & User Stories
1. As a group member with create permissions, I can choose “Workspace” from the create menu, supply title/topics/visibility, and open a canvas editor before publishing.
2. As a viewer, a workspace post appears in feeds with a thumbnail, type badge, and metadata; clicking or tapping opens the canvas instead of the rich-text view.
3. Within the canvas I can add shapes, freehand draw, drop sticky notes, and format them (color, size, rotation, labels).
4. I can paste or upload images/files; media uploads use Hylo’s attachment pipeline and render on the canvas.
5. I can search for posts, people, group resources, and drop them as linked cards (auto-updating when titles change).
6. Multiple editors can work at once with visible presence; edits reconcile automatically and persist without conflicts.
7. The workspace autosaves, exposing `undo`/`redo`, and persists named versions for audit.
8. Comments, reactions, notifications, and moderation continue to work as for other posts.
9. Mobile clients can open workspace posts (read-only canvas snapshot or lightweight viewer) even if editing launches later.
10. Workspace posts participate in search filters, saved searches, digest emails, Zapier, and group menu auto-linking.

## Proposed Solution

### Experience & UX
- **Creation flow**: Selecting the workspace post type in web PostEditor swaps the rich-text body for a “Launch workspace builder” button. Clicking opens a dedicated full-screen canvas (modal or route) seeded with title, topics, and group context. We keep the existing metadata panel (title, audience, topics, visibility) on the left so users can publish once satisfied.
- **Canvas layout**: Canvas fills the main area; a left rail houses object toolbar (select, draw, text, sticky, connector, embed resource). A right rail houses layers, collaborator list, and version history toggle. Comments remain beneath the canvas in PostDetail (same component, so comment threads are unaffected).
- **Embedding Hylo items**: Searching from the toolbar hits GraphQL to fetch posts, members, tracks, resources within the current groups. Dropping creates specialized nodes storing `{resourceType, resourceId}`; clicking opens a lightweight card or deep link.
- **Media handling**: Image/file paste opens AttachmentManager upload; we reuse existing S3 flow and reference uploads from canvas nodes. Videos default to static preview with link-out.
- **Real-time cues**: Each collaborator gets a color; their cursor/selection show in canvas. Presence list mirrors awareness state. Typing in object text updates awareness.
- **Snapshot generation**: On publish and every significant edit (throttled), the client exports a PNG via the canvas library and calls a mutation to upload snapshot media and mark `workspace_documents.snapshot_media_id`.
- **Mobile**: Phase 1 shows a snapshot with “Open workspace” button launching an embedded web view (stretch goal) or a warning + open-in-browser fallback. Long term we can render with a simplified canvas (tldraw/react-native).

### Architecture & Data Flow
1. Post creation hits `createPost`. When `type === 'workspace'`, the backend seeds a `workspace_document` row and returns `workspaceId` to the client.
2. Client immediately opens canvas and establishes websocket connection to `workspaceRoom(postId)` using a new collaboration service (Yjs-based). Initial document state fetched via GraphQL `workspaceDocument` query.
3. Collaborative updates are CRDT deltas broadcast via Redis-backed websocket emitter. The service persists debounced snapshots and discrete revisions via `WorkspaceService.persistRevision`.
4. Snapshot uploads go through existing Media uploader with `subjectType = 'workspace'`; once stored, `workspace_documents.snapshot_media_id` references the media row for card display.
5. Post detail route loads Post + WorkspaceDocument; renders canvas viewer/editor depending on permissions.

### Data Model Changes
Create new tables (Knex migrations in `apps/backend/migrations`):

1. `workspace_documents`
   - `id` (pk)
   - `post_id` (unique, fk -> posts.id, cascade delete)
   - `group_id` (nullable, primary group for quick filtering)
   - `version` (int, monotonically increasing)
   - `state` (jsonb) – latest persisted Yjs snapshot (compressed binary stored base64 or JSON structure)
   - `snapshot_media_id` (fk -> media.id, optional)
   - `created_by` (fk -> users.id)
   - `created_at`, `updated_at`
   - Indexes: `post_id` unique, `group_id`, `updated_at`

2. `workspace_revisions`
   - `id`
   - `workspace_id` (fk -> workspace_documents.id)
   - `version` (int)
   - `diff` (bytea/jsonb) – encoded Yjs update or delta
   - `summary` (text, optional commit message)
   - `created_by` (fk -> users.id)
   - `created_at`
   - Index on `(workspace_id, version)`

3. `workspace_elements`
   - `id`
   - `workspace_id`
   - `resource_type` (enum: post, user, group, track, resource, custom)
   - `resource_id` (uuid/int depending on type)
   - `metadata` (jsonb) – cached title, color, url
   - `created_at`, `updated_at`
   - Unique partial index on `(workspace_id, resource_type, resource_id)` to avoid duplicates
   - Maintained by backend when CRDT updates include entity nodes; used for search, analytics, and eventual notifications.

Adapt existing tables:
- Allow `media` to reference `workspace_documents` via `workspace_id` (add nullable `workspace_id` column + foreign key) so pasted images can belong to a workspace without cluttering post attachments.
- Ensure `posts` default `type` column continues to allow 255-char strings; no schema change required, only validation updates.

### Backend Updates
- Extend `Post.Type` in `apps/backend/api/models/Post.js` with `WORKSPACE: 'workspace'` plus helper `isWorkspace()`.
- Update validation and mutation flows:
  - `apps/backend/api/models/post/validatePostData.js`: add `Post.Type.WORKSPACE` to `allowedTypes`; enforce that workspace posts do not require `details` but may accept optional summary.
  - `apps/backend/api/models/post/createPost.js`: when creating a workspace, call new `WorkspaceService.create(post, opts)` to seed `workspace_documents`, set creator, and enqueue snapshot generation job stub. Ensure rollback cleans up workspace tables if post creation fails.
  - `apps/backend/api/models/post/updatePost.js`: prevent changing type away from `workspace`; allow metadata updates (title/topics) and propagate to workspace metadata.
- Implement `WorkspaceService` in `apps/backend/api/services/WorkspaceService.js` (new file): responsibilities include loading documents, persisting revisions, updating element index, generating snapshots (kicking off queue jobs), and deleting workspace data when posts are removed.
- Introduce websocket handler `WorkspaceCollaboration` (under `api/services/Websockets` or dedicated `api/services/collaboration`):
  - Accepts connections scoped by `postRoom` ID.
  - Uses Yjs for state merging; stores updates in Redis for horizontal scale.
  - Emits `workspaceUpdate` (add to `validMessageTypes` in `Websockets.js`).
  - Throttles persistence (e.g. every 5 seconds or on disconnect) by calling `WorkspaceService.persistRevision`.
- Extend GraphQL schema (`apps/backend/api/graphql/schema.graphql`):
  - Add `workspace` to `Post` type: `workspace: WorkspaceDocument`.
  - Define types `WorkspaceDocument`, `WorkspaceRevision`, `WorkspaceElement`, `WorkspacePresence`.
  - Add queries: `workspaceDocument(postId: ID!): WorkspaceDocument`, `workspaceRevisions(postId: ID!, first: Int, afterVersion: Int): [WorkspaceRevision!]`.
  - Add mutations: `upsertWorkspaceSnapshot(postId: ID!, snapshot: WorkspaceSnapshotInput!, version: Int!): WorkspaceDocument`, `recordWorkspaceEntityUsage(postId: ID!, entities: [WorkspaceEntityInput!]!): WorkspaceDocument` (used by client after CRDT analysis), `createWorkspaceDraft(postId: ID!, initialState: JSON): WorkspaceDocument` (optional if we preload before publish).
- Update resolvers in `makeModels.js` / `makeSchema`: expose workspace relations using new service.
- Update search filters (`apps/backend/api/services/Search/util.js`) so workspace posts appear in filter drop-downs and do not break existing logic.
- Update `Group.doesMenuUpdate` to treat `workspace` similar to other specialized views: ensure a `workspaces` auto widget is surfaced once a group has ≥1 workspace.
- Update queue cleanup (`PostManagement.removePost`) to delete related workspace records and workspace media.
- Update background jobs (Zapier, digests) to include workspace posts; ensure email/Slack templates handle the preview snapshot and deep link appropriately.
- Add tests covering creation, revisions, deletion, access control, and GraphQL resolvers (`apps/backend/test/...`).

### GraphQL & API Contract
New additions (illustrative):
```
type WorkspaceDocument {
  id: ID!
  postId: ID!
  version: Int!
  state: JSON
  snapshotMedia: Media
  elements: [WorkspaceElement!]
  updatedAt: Date!
  updatedBy: Person
  presence: [WorkspacePresence!] # optional real-time mirror
}

type WorkspaceRevision {
  version: Int!
  createdAt: Date!
  createdBy: Person
  diff: JSON
}

type WorkspaceElement {
  id: ID!
  resourceType: String!
  resourceId: ID!
  metadata: JSON
}

type WorkspacePresence {
  user: Person!
  color: String!
  lastSeenAt: Date!
}

input WorkspaceSnapshotInput {
  mediaId: ID
  dataUrl: String
}

input WorkspaceEntityInput {
  resourceType: String!
  resourceId: ID!
  metadata: JSON
}
```

Mutations/queries should enforce `canViewPost` / `canEditPost` permissions and reuse existing loaders. Snapshot uploads accept either an existing `mediaId` (after S3 upload) or raw `dataUrl` (server stores via uploader).

### Web Frontend
- Extend `POST_TYPES` (`apps/web/src/store/models/Post.js`) and `packages/presenters/src/PostPresenter.js` with workspace entry (colors, icon, map flag false).
- Update `PostTypeSelect`, `CreateMenu`, `CreateModal` to list “Workspace.” Provide tooltip/description text.
- Adjust `PostEditor` to show workspace-specific prompts (no HyloEditor); wire up button to launch new `WorkspaceCanvasModal` component.
- Build `WorkspaceCanvas` module under `apps/web/src/components/Workspace`:
  - Use `@tldraw/tldraw` or `@excalidraw/excalidraw` plus `yjs` binding for CRDT.
  - Implement toolbar (shapes, text, connector, sticky), color picker, layer list, and embed search panel.
  - Integrate `useWorkspaceCollaboration(postId)` hook to manage websocket connection, apply Yjs updates, and track presence.
  - Implement `useWorkspaceAutosave` to batch updates (e.g. every 3 seconds or on idle) and call `upsertWorkspaceSnapshot` + `recordWorkspaceEntityUsage`.
  - Provide `exportSnapshot` utility leveraging canvas library to produce PNG for Post card.
  - Include analytics dispatches for key actions (create node, drop resource, snapshot saved).
- Update `PostCard` to display workspace preview image (if available) and fallback glyph; new CSS entry in `PostCard.module.scss` for `.workspace` colors.
- Update `PostDetail` to render `WorkspaceCanvas` when `post.type === 'workspace'`. Provide edit vs read-only mode (read-only uses same component but disables editing controls unless user has edit permission).
- Add dedicated route state (`/groups/:slug/post/:postId/workspace`) for full-screen editing with ability to collapse comments.
- Update `StreamViewControls` and saved search UI to include workspace in filters; adjust icons.
- Ensure `offers/requests` widgets ignore workspace unless part of aggregator. Consider new widget listing group workspaces.
- Add new icons to `components/Icon` (e.g. `Workspace` glyph) and theme tokens.
- Update localization strings for new copy.
- Testing: write component unit tests, Cypress integration covering creation, editing, and snapshot saving (behind feature flag).

### Mobile
- Update `apps/mobile/src/components/PostTypeSelect` and `screens/PostEditor` to allow selecting workspace (if feature flag on). Editing may route to explanatory modal that prompts to continue on web until native editor ships.
- For viewing, implement a React Native screen that fetches snapshot and metadata; show image + “Open Interactive Workspace” button launching an in-app webview (pointing to `/workspace` route) with authentication cookies. Provide fallback message if webview unsupported.
- Record telemetry for mobile open attempts.

### Real-Time Collaboration Layer
- Adopt Yjs for CRDT state with awareness. Use `y-websocket` server inside Hylo backend (so we can reuse auth and Redis). We can embed the official server or implement minimal subset:
  - On connection, authenticate via existing session/csrf; ensure viewer has `canViewPost` and optionally `canEditPost` rights.
  - Join Redis pub/sub room `workspace:<postId>` so edits propagate across pods.
  - Persist updates: maintain in-memory doc per workspace, flush to Postgres on interval/idle/disconnect. Store compact encoded snapshot in `workspace_documents.state`, append incremental diff to `workspace_revisions`.
  - Manage awareness state (presence) via Redis; optionally surface in GraphQL for initial render.
  - Support ephemeral events: `workspaceUpdate`, `workspacePresence`, `workspaceSnapshotRequested`.
- Ensure `WorkspaceService` gracefully handles reconnect/resync by reloading latest snapshot when server restarts.

### Permissions & Security
- Workspace inherits post visibility. Editing defaults to anyone who can edit the post (author + group hosts/mods). Expose optional collaborator list later.
- Enforce checks server-side for all GraphQL queries/mutations and websocket connections. Do not trust client-submitted references; validate `resourceType/resourceId` exist and user has visibility before storing in `workspace_elements`.
- Limit snapshot uploads to allowed MIME types; reuse existing media sanitizer.
- For presence/pointers, share only display name + avatar URL already available to viewers.
- Ensure rate limiting on websocket connect attempts and snapshot mutations to prevent abuse.

### Observability & Analytics
- Log workspace lifecycle events (created, opened, snapshot saved, revision persisted) with postId/groupId.
- Emit metrics via StatsD/Datadog for: active editors, update throughput, snapshot failures, persistence latency.
- Instrument front-end analytics events for create/open/close, resource drops, undo/redo usage.
- Alert on elevated websocket error rates or persistence failures.

### Testing Strategy
- **Backend**: unit tests for WorkspaceService (create, persist, revise, delete), GraphQL resolver tests, migration tests ensuring cascade delete works.
- **Web**: component tests for toolbar, embed panel, autosave hook; Cypress flow covering creation -> canvas edit -> snapshot -> publish.
- **Mobile**: snapshot viewer smoke test behind feature flag.
- **Load**: simulate concurrent editors (≥10) to validate CRDT stability and server resource usage.
- **Security**: verify permission checks by attempting unauthorized connections and mutations.

### Rollout Plan
1. **Phase 0 (Foundations)**: land migrations, backend scaffolding, feature flag (`workspacePost`) default off. Implement API and snapshot storage without exposing UI.
2. **Phase 1 (Internal Alpha)**: enable flag for staff sandbox groups. Ship web canvas MVP (shapes, text, embed posts/users, image uploads, autosave) and read-only mobile snapshot. Collect feedback, tune performance.
3. **Phase 2 (Beta Groups)**: enable for pilot communities. Add version history UI, improved palette, analytics dashboards.
4. **Phase 3 (GA)**: enable by default once metrics stable; update onboarding docs, marketing materials, and help center content.
5. Provide migration script to backfill `workspace_documents.snapshot_media_id` from default placeholder for older posts if necessary.

### Open Questions & Risks
- Do we restrict editing to explicit collaborators or allow everyone with view access to edit? Need policy decision + UI indicator.
- Which canvas library (tldraw vs excalidraw vs custom) best fits licensing, bundle size, and feature needs? Evaluate integration complexity and mobile roadmap.
- Snapshot generation: client-side export may fail on huge boards; do we need server-side rendering (e.g. headless Chromium)?
- How do we handle extremely large canvases (thousands of nodes) in terms of performance and search indexing?
- Do we need notifications for workspace-specific events (e.g. someone @mentions you inside canvas)? Out of scope for MVP but worth planning hooks.
- Storage growth: assess Postgres JSONB size for large Yjs docs; may require compression or object storage.
- Conflict resolution if two browser tabs publish different snapshots simultaneously—should we gate on version numbers and reject stale writes?
- Accessibility: how do keyboard navigation and screen readers interact with the canvas? MVP will provide alternative description field but needs dedicated follow-up.

### Impacted Surfaces (non-exhaustive)
- Backend models/services: `apps/backend/api/models/Post.js`, `.../post/createPost.js`, `.../post/validatePostData.js`, `.../post/updatePost.js`, `.../services/Search/util.js`, `.../services/PostManagement.js`, new `.../services/WorkspaceService.js`.
- GraphQL schema/resolvers: `apps/backend/api/graphql/schema.graphql`, `makeModels.js`, mutations directory, subscriptions (if presence surfaced).
- Database migrations under `apps/backend/migrations` plus seeds for testing.
- Web app: `apps/web/src/store/models/Post.js`, `PostEditor`, `PostTypeSelect`, `CreateMenu`, `PostCard`, `PostDetail`, new `components/Workspace/*` module, `StreamViewControls`, `MapExplorer` filters, global styles/icons.
- Mobile app: `apps/mobile/src/screens/PostEditor/PostEditor.js`, `Stream.js`, `PostCard`, new viewer screen.
- Shared presenter: `packages/presenters/src/PostPresenter.js`.
- DevOps: websocket infrastructure, Redis sizing, snapshot storage bucket policies, feature flag rollout tooling.

