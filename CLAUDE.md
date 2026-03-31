# Hylo - Claude Code Project Guide

## Project Structure

Monorepo with Yarn workspaces:
- `apps/web` — React web frontend (Vite, port 3000)
- `apps/mobile` — React Native mobile app
- `apps/backend` — Node.js API server (port 3001)
- `apps/desktop` — Electron desktop app
- `packages/` — Shared packages (`shared`, `graphql`, `hooks`, `contexts`, `presenters`, `navigation`, `urql`)

## Common Commands

```bash
# Dev servers
yarn web:dev          # Start web frontend (builds packages first)
yarn backend:dev      # Start backend API

# Testing
cd apps/web
yarn test --watchAll=false                        # Unit tests (Jest)
yarn test --watchAll=false --testPathPattern=Name # Unit tests for specific component
yarn test:e2e                                     # E2E tests (Playwright, headless)
yarn test:e2e --headed                            # E2E tests (visible browser)

cd apps/backend
yarn test                                         # Backend tests

# Linting
cd apps/web && yarn lint
cd apps/web && yarn lint:fix

# Build
cd apps/web && yarn build
```

## GitHub

- Repo: `Hylozoic/hylo`
- Main branch: `dev`
- Issues: `gh issue list --repo Hylozoic/hylo`
- PRs target `dev` branch

## Workflow: Ticket to PR

When picking up and completing work autonomously, follow this process:

### 1. Find a ticket
```bash
gh issue list --repo Hylozoic/hylo --label "ready" --limit 10
gh issue view <number> --repo Hylozoic/hylo
```

### 2. Create a branch
```bash
git checkout dev
git pull origin dev
git checkout -b <issue-number>-short-description
```

### 3. Implement the changes
- Read relevant code before modifying
- Follow existing patterns and conventions
- Keep changes focused on the ticket scope

### 4. Test your work

**Unit tests:**
```bash
cd apps/web && yarn test --watchAll=false --testPathPattern=<relevant-pattern>
```

**E2E tests:** Playwright is configured in `apps/web/playwright.config.js`.
- Tests live in `apps/web/e2e/`
- The dev server auto-starts when running tests (if not already running)
- Write E2E tests for new user-facing features
- Run: `cd apps/web && yarn test:e2e`

**Build verification:**
```bash
cd apps/web && yarn build
```

### 5. Create the PR
- PRs target `dev` branch
- Link the issue in the PR body
- Include a test plan describing what was verified

## E2E Testing Guidelines

- Place tests in `apps/web/e2e/`
- Use `data-testid` attributes for selectors when possible
- Tests should be independent and not rely on state from other tests
- Use Playwright's auto-waiting — avoid manual sleeps
- For authenticated flows, set up auth state in a global setup or per-test

## Code Conventions

- Web app uses React with SCSS modules (camelCase class names)
- GraphQL for API queries (`.graphql` files)
- Shared logic goes in `packages/` when used by both web and mobile
- Standard.js linting for the web app
