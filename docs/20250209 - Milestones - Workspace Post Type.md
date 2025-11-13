# Milestones: Workspace Post Type

Status: Draft  
Author: Codex (ChatGPT) for Hylo team  
Last Updated: 2025-02-09

This document breaks the Workspace Post Type initiative into sequenced milestones so the team can plan, build, and ship in manageable slices. Use it alongside the feature spec.

## Overview
- **Goal:** Deliver collaborative workspace posts that integrate with Hylo’s existing post flows.
- **Approach:** Roll out in four milestones (M0–M3) with explicit feature gates, allowing validation at each layer before broad release.
- **Feature Flag:** `workspacePost` (scoped per group). Enabled progressively as milestones complete.

## Milestone Breakdown

### M0 — Foundations & Schema
**Objective:** Lay the groundwork so the backend understands workspace posts without exposing UI.
- **Scope:**
  - Database migrations for `workspace_documents`, `workspace_revisions`, `workspace_elements`, and `media.workspace_id`.
  - Extend `Post.Type` enum, validation, and GraphQL schema placeholders (`workspace` field on `Post`).
  - Stub `WorkspaceService` with create/delete hooks invoked during `createPost`/`removePost`.
  - Feature flag plumbing (`workspacePost`).
- **Deliverables:**
  - Migration files with unit tests.
  - Updated backend type validation + minimal GraphQL resolvers returning empty structures.
  - Feature flag toggled off by default.
- **Dependencies:** None (starting point).
- **Exit Criteria:** CI green; migrations rolled forward/back on staging; existing post types unaffected.

### M1 — Backend & API MVP
**Objective:** Provide usable API + real-time scaffolding for clients to consume.
- **Scope:**
  - Full `WorkspaceService` (CRUD, revision persistence, entity indexing, snapshot storage).
  - Websocket/Yjs collaboration server with auth + presence.
  - GraphQL queries/mutations for workspace document, revisions, snapshot uploads.
  - Search/menu updates to recognize `workspace` type.
  - Background jobs (Zapier, digests) aware of workspace posts.
- **Deliverables:**
  - Automated tests covering workspace creation, revision persistence, deletion cascade.
  - Docs for websocket endpoints + API shapes.
  - Observability hooks (metrics/events) for collaboration layer.
- **Dependencies:** M0 migrations.
- **Exit Criteria:** Client can create workspace post via GraphQL playground and observe persisted document state; collaboration server smoke tests pass; no regressions in existing real-time features.

### M2 — Web Editor MVP
**Objective:** Ship authoring/viewing experience on web for internal alpha.
- **Scope:**
  - Web UI for selecting workspace post type in `PostEditor` and launching `WorkspaceCanvas` (tldraw/excalidraw + Yjs binding).
  - Toolbar (select, draw, text, sticky, connector), color picker, undo/redo.
  - Embedded Hylo entity search/drop with backend validation.
  - Snapshot export + upload pipeline for card previews.
  - Post card/detail integrations, read-only mode for viewers.
  - Feature flag gating in UI; analytics instrumentation.
- **Deliverables:**
  - Component/unit/Cypress tests for editor and autosave.
  - Internal docs / quickstart for staff testers.
- **Dependencies:** M1 APIs and websockets.
- **Exit Criteria:** Staff can create/edit workspace posts via web in feature-flagged groups; autosave + snapshot verified; no unhandled errors in browser console during smoke test.

### M3 — Beta Rollout & Mobile Viewer
**Objective:** Prepare for pilot groups with polished UX and mobile consumption.
- **Scope:**
  - Version history UI (surface `workspace_revisions`).
  - Presence avatars/list, improved onboarding (empty state, templates optional).
  - Mobile read-only viewer (snapshot + webview fallback).
  - Rollout playbook, support docs, analytics dashboards, alerting.
  - Performance tuning (large canvas handling, snapshot throttling).
- **Deliverables:**
  - Mobile screen + tests (manual/automated).
  - Updated marketing/help content.
  - Monitoring dashboards + alert thresholds.
- **Dependencies:** M2 web editor stable.
- **Exit Criteria:** Beta groups enabled via flag; mobile clients display workspaces; metrics within agreed thresholds (latency, error rate).

### Post-GA Enhancements (Backlog)
- Granular collaborator permissions.
- Workspace notifications/mentions.
- Server-side snapshot rendering for massive canvases.
- Native mobile authoring.
- Accessibility improvements (keyboard nav, descriptions).

## Cross-Milestone Considerations
- **Security & Permissions:** Enforce view/edit checks at API + websocket layer each milestone.
- **QA Strategy:** Regression suite updated at each milestone; load test collaboration during M1/M2.
- **Documentation:** Keep spec and API docs updated; capture decisions in CHANGELOG once shipped.
- **Project Tracking:** Mirror these milestones in issue tracker (epics) with linked tasks.

## Timeline (Tentative)
- **M0:** 1 sprint
- **M1:** 2 sprints (heavier backend + infra work)
- **M2:** 2–3 sprints (UI iteration + feedback loop)
- **M3:** 2 sprints (polish + rollout)

Adjust durations based on team capacity and findings during earlier milestones.

