# Group themes MVP: handoff brief

For a coding agent (or developer) picking this up in the `Hylozoic/hylo` repo. Suggested home in the repo: `docs/group-themes-mvp.md`.

## What we're building

Hylo Pro groups get their own look. A steward restyles the group's menu column and main column (colors, corner radius, later fonts); the global nav never changes. The longer-term plan adds an agent that writes the theme from a description, and agent-built "canvas" views. The full spec is the "Group Styling & Canvas Views" doc; ask Aaron for the link or an export.

This brief covers the MVP: **a steward can set, preview and save a group theme by hand.** No LLM yet.

## Where things stand

Slice 1 (read and render a stored theme) is built as two patches against `dev` at `1c8e62c6`:

1. `group-themes-poc.patch`: the feature.
2. `group-themes-sandbox-demo.patch`: a demo theme on the sandbox's main group. Optional; it changes the public `/sandbox` demo.

Apply with `git apply`, in that order, on a new branch off `dev`. If `dev` has moved, expect small conflicts in `AuthLayoutRouter.js`.

What slice 1 contains:

| File | What it does |
| --- | --- |
| `apps/web/src/util/groupTheme.js` | `sanitizeGroupTheme`, `resolveGroupThemeTokens`, `groupThemeCssVars`, `appThemeCssVars`, `contrastRatio`, `checkGroupThemeContrast` |
| `apps/web/src/hooks/useGroupTheme.js` | Sets the group's tokens on `<body>` while the group is on screen; returns the viewer's theme as a style for the global nav |
| `apps/web/src/routes/AuthLayoutRouter/AuthLayoutRouter.js` | Calls the hook; wraps `GlobalNav` and `TopNav` in a `display: contents` div carrying the viewer's theme |
| `apps/web/tailwind.config.js` | `rounded-sm/md/lg/xl` now read `--radius` (default `0.5rem`) |
| `apps/web/src/config/featureFlags.js` | `GROUP_THEMES` flag, on outside production |
| Group queries (`groupDetailsFragment`, `groupQueryFragment`, `MeQuery`, `fetchForGroup`) | Select `settings.theme` |
| `apps/backend/api/graphql/schema.graphql` | `theme: JSON` on `type GroupSettings` (read only) |

Verified: unit tests for the utility, hook and demo theme; existing `AuthLayoutRouter` tests; the repo linter on changed files; and a production build loaded in a headless browser in sandbox mode (light, dark, post editor dialog, leaving the group).

**Not verified:** the backend schema change (backend was never run), a real logged-in session, the mobile app.

## Theme shape

Stored at `groups.settings.theme`:

```json
{
  "light": { "background": "150 22% 86%", "card-foreground": "160 28% 11%" },
  "dark":  { "background": "160 18% 12%" },
  "radius": "xl",
  "borderWidth": "thick",
  "fontBody": "Inter",
  "fontHeading": "Playfair Display"
}
```

- Token names are the keys of `baseTheme.light` in `apps/web/src/themes/index.js`.
- Values are plain HSL triples (`H S% L%`), nothing else. No CSS ever.
- `radius` is one of `none | sm | md | lg | xl`.
- `fontBody` and `fontHeading` are Google Fonts family names (letters, digits and single spaces only). They set `--font-body` (all text) and `--font-display` (h1 to h6, which follow the body font when no heading font is set). The editor lists the full Google Fonts catalogue when `VITE_GOOGLE_FONTS_API_KEY` is set in `apps/web/.env`, and a short built-in list otherwise.
- `borderWidth` is one of `thin | regular | thick` (1px, 2px, 3px; default `regular`). It sets `--border-width`, which Tailwind's `border-2` family reads. Plain 1px `border` is not affected. Border color is not themed separately; most borders use the text color at low opacity.
- A group theme resolves over Hylo's **default** theme, not the viewer's personal theme, so contrast can be checked once for everyone.

## Import from a website (AI)

"Start from a website" in the theme editor suggests a theme from a site's look. Nothing is saved until the steward saves.

- Mutation: `importGroupThemeFromUrl(groupId: ID, url: String): JSON` in `apps/backend/api/graphql/mutations/group.js`; the work is in `apps/backend/lib/groupThemeImport.js`, run in a child process (`groupThemeImportProcess.js`) because the API's global Bluebird Promise breaks Playwright and the Anthropic SDK.
- A headless Chromium (Playwright) loads the page and measures the colors, fonts, corners and borders it uses, and takes a screenshot of the first screen. Claude then picks the six color roles for light and dark, a radius, a border width and two Google Fonts. The answer is checked (hex colors, known options, plain font names that Google Fonts actually serves) before it reaches the editor, which derives the rest of the tokens as it does for hand-picked colors.
- The response includes the model, token counts and an estimated cost, which the editor shows per import and as a running total for the visit. Prices live in `MODEL_PRICING` in `groupThemeImport.js` and need updating when Anthropic's prices change.
- Setup: `CLAUDE_API_KEY` in the backend's environment (`apps/backend/.env` locally). Optional `GROUP_THEME_IMPORT_MODEL` (default `claude-opus-5-5`). The server needs Playwright's Chromium installed (`yarn playwright install chromium` in `apps/backend`); production hosting for the browser is not set up yet.
- Limits: Administration responsibility, 20 imports per group per hour, public http(s) addresses only (private and internal addresses are refused for the page and for everything it loads).
- Not done: the Hylo Pro gate (waits on the `1712-hylo-pro-*` branches, see task 5). The hostname check runs before the browser resolves the name itself, so a DNS answer that changes in between is not caught.

## Things already learned the hard way

1. **Do not save themes through `updateGroup`.** `convertGraphqlData` snake-cases nested keys (`card-foreground` becomes `card_foreground`), and `Group.update` deep-merges `settings`, so an override could never be removed. Themes need their own mutation that replaces the whole theme.
2. **Sanitize on read and on write.** The web app already sanitizes on read. The backend must validate on write with the same rules; consider moving the validator into `packages/shared` so both sides share it.
3. **Scoping is on `<body>`.** This covers Radix portals (dialogs, popovers, dropdowns) for free. Side effect: popovers opened from the global nav take the group's style. Accepted for now.
4. **`AuthLayoutRouter.js` already has a `globalNavStyle` variable** (sidebar vs tabs). The theme style is named `globalNavThemeStyle` to avoid the clash.
5. **Queries selecting `settings.theme` fail against a backend without the field.** Deploy the backend schema change first.
6. **Known coverage gaps:** the selected item in the group menu and the menu header's gradient use hardcoded colors.
7. **Unrelated bug spotted:** the `tertiary` button variant uses `bg-tertiary`, but no `tertiary` color exists in the Tailwind config.

## MVP tasks

Work in this order. Each task should land with tests and, for UI, Playwright screenshots (see `CLAUDE.md`).

### 1. Verify slice 1 against a real backend
- Run backend and web locally. Confirm the group queries return `settings.theme` (null for existing groups) and nothing regresses.
- Set a theme on one dev group directly in the database and confirm it renders for a logged-in member.
- Check the mobile WebView still gets sensible colors (`THEME_CHANGE` message in `util/appearance.js` is only sent for the user's theme today).

### 2. Save mutation (backend)
- Add `updateGroupTheme(groupId: ID, theme: JSON): Group`. Passing `null` clears the theme.
- Require the Administration responsibility for now (a dedicated "Manage appearance" responsibility comes later).
- Validate with the shared sanitizer; reject input that sanitizes to something different from what was sent, so stewards get an error instead of silent drops.
- Replace `settings.theme` whole. Do not route through `convertGraphqlData` or the deep merge.
- Add `theme` handling to the sandbox handlers so the sandbox demo can save in memory.
- Tests: permission, validation, replace semantics, clearing.

### 3. Appearance tab (web)
In `apps/web/src/routes/GroupSettings/AppearanceTab/AppearanceTab.js`, below the existing layout picker, behind the `GROUP_THEMES` flag:
- Start from a preset: the app's existing themes in `themes/index.js` (forest, ocean, desert, and so on) make good starting points.
- Edit a small set of roles first: background, card, text, primary button, accent, selected. Derive the rest. A color picker that converts to HSL triples is enough.
- Corner radius picker.
- Light and dark, with a toggle for which one is being edited.
- **Live preview** before saving: apply the draft with the same `groupThemeCssVars` path the hook uses.
- **Contrast warnings** from `checkGroupThemeContrast`, shown next to the offending pair. Block save on failures, or require an explicit override; decide with Aaron.
- Save, reset to default, and revert to last saved.
- Add strings to all six locale files in `apps/web/public/locales/`.

### 4. Coverage pass
- Fix the two known gaps (selected menu item, menu header gradient).
- Sweep the group menu, view headers, post cards and primary buttons for hardcoded colors, and convert them to tokens.
- Define the missing `tertiary` color.

### 5. Gate behind Hylo Pro
- When the `1712-hylo-pro-*` branches merge, gate saving a theme on the group's subscription. Decide what happens to a saved theme when a subscription lapses (open question in the spec).

## Out of scope for the MVP

- The style agent (needs a decision on model and hosting; there is no LLM integration in the backend today).
- Fonts (`--font-body`, `--font-display`).
- Canvas views, the sandbox and the bridge.
- Theme version history beyond "revert to last saved".

## Open questions for Aaron and the Product Circle

- Should a contrast failure block saving, or only warn?
- Can a member opt out of group themes?
- Does cross-posted content take the style of the group it's viewed in? (Proposed: yes; this is what the current implementation does.)
- Should the sandbox demo ship with a themed group?

## Running things

```bash
yarn web:dev                    # web on :3000 (builds packages first)
yarn backend:dev                # API on :3001
cd apps/web
yarn test --watchAll=false --testPathPattern='(groupTheme|useGroupTheme)'
yarn lint
E2E_PATH=/groups/<slug> yarn screenshot
```

The sandbox demo runs with no backend at `http://localhost:3000/sandbox/groups/community-hub`.
