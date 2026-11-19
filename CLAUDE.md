# Hylo - Claude Code Project Guide

## Project Structure

Monorepo with Yarn workspaces:
- `apps/web` — React web frontend (Vite, port 3000)
- `apps/mobile-leap` — Expo / React Native mobile app
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
gh issue list --repo Hylozoic/hylo --label "agent-ready" --limit 10
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

**E2E / Playwright screenshots:** Playwright is configured in `apps/web/playwright.config.js`.
- Tests live in `apps/web/e2e/`
- Auth is automatic — reads `E2E_TEST_USERNAME`/`E2E_TEST_PASSWORD` from `apps/web/.env`
- The dev server auto-starts when running tests (if not already running)
- Run: `cd apps/web && yarn test:e2e`

**Take a screenshot of any authenticated page:**
```bash
cd apps/web && E2E_PATH=/groups/building-hylo yarn screenshot
```

**Interactive screenshots (click, then capture):** Write a spec in `apps/web/e2e/` that interacts with the page and screenshots the result. See `apps/web/e2e/invite-copy.spec.js` for an example.

**Build verification:**
```bash
cd apps/web && yarn build
```

### 5. Create the PR
- PRs target `dev` branch
- Link the issue in the PR body (`Closes #NUMBER`)
- Include Playwright screenshots for visual/UI changes
- Include a test plan describing what was verified

**Uploading screenshots to PRs:**
```bash
# Upload to the persistent draft release
gh release upload "untagged-5c3bf358d6724b65a174" screenshot.png --repo Hylozoic/hylo --clobber
# Embed in PR body
# ![description](https://github.com/Hylozoic/hylo/releases/download/untagged-5c3bf358d6724b65a174/screenshot.png)
```

### Splitting a feature into several PRs

Use one PR unless the change is too big to review as a whole. When you split, split for the reviewer, not by the order you built things in.

- **Order the series backend first, then features:**
  1. **Backend changes and migrations.** Migrations go here only when they've been permitted. Every migration and schema change the feature needs goes in this first PR.
  2. **Front-end changes, one PR per feature.** Where one feature ends and the next begins is a judgement call: aim for pieces a reviewer can understand and try on their own. These PRs can include backend changes their feature needs, but no migrations, and ideally no edits to what earlier PRs added.

  When the feature set is one shared backend change with several features built on it, the first PR is that backend change and each later PR covers one of the features.
- **After the first PR, later PRs only add; they never rewrite earlier ones.** Don't change behaviour, defaults, signatures, names or comments that an earlier PR in the series introduced, and don't add or edit migrations. If an earlier PR needs to change, change it on that PR's branch and rebase the PRs after it.
  Check before opening or updating any PR after the first: `git diff <earlier-branch> <last-branch> -- <files the earlier PR added>` should show only additions.
- **No abandoned approaches in the history.** If you changed direction partway through, squash or rewrite the commits so the PR shows only the final design.
- **Plan the split before writing code.** Each PR's description should say what it contains, what it depends on, and what the later PRs will add. Keep every description true to its own code.
- **Each PR builds and passes tests on top of the ones before it**, so the series can be merged in order and stopped at any point.

## Autonomous Agent Workflow

For working through the backlog autonomously (investigate → fix → PR):

### For each issue:
1. **Read the ticket** — understand what's reported
2. **Explore the code** — find the relevant component/logic
3. **Can you identify the problem?**
   - **YES** → Fix it, take Playwright screenshots, open a PR
   - **NO** → Comment on the issue with what you found and what info is missing
4. **Is this a duplicate or already fixed?**
   - **YES** → Comment with evidence and close

### Triage criteria for `agent-ready` label:
- Clear bug with screenshot or repro steps
- Expected vs actual behavior described
- Scoped to a single component/area
- Fix is deterministic (broken → correct)
- Does NOT require: design mockups, product decisions, mobile-native debugging, or multi-system coordination

### Confidence levels:
- **High** — clear bug, can fix and verify with screenshots
- **Medium** — understand the problem, may need a design decision mid-way
- **Low** — under-specified, needs human input before starting

### Running Playwright (important):
Use this from `apps/web/` — `npx playwright` picks up a wrong global version:
```bash
yarn node node_modules/@playwright/test/cli.js test [args]
```
Or use the package.json scripts: `yarn test:e2e`, `yarn screenshot`

## E2E Testing Guidelines

- Place tests in `apps/web/e2e/`
- Use `data-testid` attributes for selectors when possible
- Tests should be independent and not rely on state from other tests
- Use Playwright's auto-waiting — avoid manual sleeps
- For authenticated flows, set up auth state in a global setup or per-test

## Code Conventions

- Web app uses React with Tailwind CSS (legacy SCSS modules still exist but are being removed)
- GraphQL for API queries (some in `.graphql` files, most defined inline)
- Shared logic goes in `packages/` when used by both web and backend
- Standard.js linting for the web app

## Web App Guidelines
- When adding new strings always translate them to the different languages in public/locales
