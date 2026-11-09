# 08 — Design system & internationalisation

> Scope: colour tokens and themes (light/dark), Tailwind configuration, typography, spacing/radii/shadows/animation, iconography, core UI components (shadcn/Radix `ui/*` and legacy components), avatars & default images, emoji picker, dark mode mechanics, group-level layout setting, i18n (i18next setup, locales, detection, persistence), date/time formatting, and accessibility conventions. Shell-specific visuals (rail, menu, cards) are in [06-app-shell-navigation.md](06-app-shell-navigation.md); the Appearance settings *pages* are in [05-user-settings.md](05-user-settings.md) (user) and [11-group-settings.md](11-group-settings.md) (group).

## 1. Overview
- Web UI: React + **Tailwind CSS v3** (utility classes) with **shadcn/ui-style** components built on **Radix UI** primitives; legacy SCSS modules remain on older components (being removed).
- All colours are **CSS custom properties holding HSL triplets** (`H S% L%`), set at runtime on `<html>` from a JS theme table; Tailwind colours reference them as `hsl(var(--token) / <alpha-value>)`, so any token supports opacity modifiers (`bg-foreground/20`).
- **9 colour themes × 2 schemes** (light/dark). Scheme selection: `auto` (OS), `light`, `dark`. Stored per user in `users.settings` (`theme`, `colorScheme`) and synced to the native app.
- Fonts: **Onest** (Google Fonts, variable 100–900) primary; "Circular Book/Medium/Bold" (local TTFs) fallback/legacy.
- Icons: **lucide-react** (primary) + legacy **`hylo-evo-icons`** icon font (135 glyph classes `icon-<Name>`).
- i18n: **i18next** + react-i18next + http backend + browser language detector; 6 translation files (`en, es, de, fr, hi, pt`) covering 7 UI locales (en-US, en-GB share `en`).

## 2. Concepts & data

### 2.1 Theme tokens
Token names (all set as `--<token>` on `document.documentElement`):

| Token | Role |
|---|---|
| `background` | App/page surface, menu cards, dialogs |
| `midground` | Center column / shell background (`bg-midground`) |
| `context-menu-background` | Context menu gradient start; sticky headers (ViewHeader) |
| `foreground` | Primary text; most borders as `foreground/10–50` |
| `card`, `card-foreground` | Cards, rail base, popovers' default bg (`Popover` uses `bg-card`) |
| `popover`, `popover-foreground` | Dropdown menus, tooltips |
| `primary`, `primary-foreground` | Default button, nav tiles (a pale neutral in light mode) |
| `secondary`, `secondary-foreground` | Secondary buttons, active settings menu border |
| `muted`, `muted-foreground` | Muted text |
| `accent`, `accent-foreground` | Badges, unread borders, notifications highlight, "Join Hylo" button (warm orange by default) |
| `selected` | Selection/brand green: selected tiles border, active pills, switches, primary CTA (`bg-selected`), tour buttons |
| `focus` | Focus outlines; default-avatar gradient start (`focus → selected`) |
| `destructive`, `error` (+ `-foreground`) | Errors, destructive buttons, alert banners |
| `border`, `input`, `ring` | Form borders, input bg, focus ring |
| `darkening` | Near-black overlay colour (scrims, banner shading, shadows) |
| `theme-background`, `theme-highlight` | Rail/top-bar gradient ends (`from-theme-background/75 to-theme-highlight`) and tinted washes |
| `black` | Referenced (`--black`) in detail column shadow |
| Post-type colours: `chats`, `discussions`, `events`, `offers`, `projects`, `proposals`, `requests`, `resources`, `members` | Post-type tinting (`text-events`, etc.) — not overridden per theme |
| `chart-1..5` | Referenced by Tailwind config; not defined in the theme table (unused) |

Base theme (`default`) — complete values:

| Token | Light | Dark |
|---|---|---|
| darkening | 28 18% 7% | 39 2% 0% |
| background | 36 46% 90% | 39 3% 18% |
| context-menu-background | 36 48% 96% | 39 3% 20% |
| midground | 38 55% 96% | 39 3% 22% |
| foreground | 28 16% 11% | 40 100% 99% |
| selected | 145 50% 62% | 145 40% 45% |
| card / card-foreground | 40 66% 99% / 28 16% 14% | 39 3% 25% / 40 100% 99% |
| popover / -foreground | 40 55% 99% / 28 16% 11% | 240 10% 3.9% / 0 0% 98% |
| primary / -foreground | 38 44% 94% / 0 0% 0% | 190 7% 20% / 40 100% 99% |
| secondary / -foreground | 196 100% 50% / 0 0% 100% | 169 44% 48% / 0 0% 98% |
| muted / -foreground | 38 38% 93% / 32 18% 40% | 240 3.7% 15.9% / 240 5% 64.9% |
| accent / -foreground | 21 79% 63% / `0 0 100%` (sic) | 21 79% 63% / 0 0% 98% |
| destructive / -foreground | 0 84.2% 60.2% / 0 0% 98% | 0 86.8% 59.6% / 0 0% 98% |
| error / -foreground | 0 84.2% 60.2% / 0 0% 98% | 0 84.2% 60.2% / (key mis-spelt `errorForeground`, so `--error-foreground` keeps the light value) |
| focus | 203 70% 56% | 203 65% 50% |
| border | 34 16% 83% | 240 3.7% 15.9% |
| input | 40 50% 99% | 200 2.7% 8.9% |
| ring | 28 16% 11% | 240 4.9% 83.9% |
| theme-background | 28 26% 10% | 39 2% 8% |
| theme-highlight | 32 30% 12% | 39 2% 8% |
| chats / discussions / events | 197 100% 69% / 197 100% 45% / 357 99% 64% | same |
| offers / requests | 167 100% 39% | same |
| projects / proposals / resources / members | 30 100% 49% / 258 38% 47% / 50 100% 51% / 315 51% 57% | same |

Design intent (code comment): light mode is "warm paper" — all neutrals share a warm hue (~30–42) with slight chroma.

Other themes override a subset on top of the base (unlisted tokens inherit base values):

| Theme | Scheme | background | ctx-menu-bg | midground | foreground | card | primary | secondary | accent | selected | focus | darkening | theme-bg | theme-highlight |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| stone | light | 0 0% 92% | 0 0% 84% | 0 0% 96% | 0 0% 10% | 0 0% 98% | 0 0% 94% | 0 0% 50% | 10 55% 60% | 165 30% 55% | 235 25% 50% | 0 0% 4% | 0 0% 8% | 0 0% 3% |
| stone | dark | 0 0% 13% | 0 0% 16% | 0 0% 18% | 0 0% 92% | 0 0% 21% | 0 0% 15% | 0 0% 38% | 10 50% 55% | 165 35% 45% | 235 20% 48% | 0 0% 2% | 0 0% 6% | 0 0% 28% |
| forest | light | 120 15% 92% | 135 35% 88% | 135 25% 93% | 95 10% 10% | 120 10% 98% | 95 30% 95% | 120 15% 45% | 43 74% 49% | 140 55% 45% | 45 80% 45% | 120 15% 3% | 144 20% 4% | 144 64% 20% |
| forest | dark | 120 20% 14% | 144 25% 16% | 144 15% 15% | 95 10% 90% | 120 15% 23% | 95 10% 14% | 120 20% 25% | 35 80% 55% | 140 55% 35% | 45 75% 50% | 95 20% 2% | 144 20% 4% | 144 64% 20% |
| ocean | light | 187 16% 92% | 187 55% 88% | 187 60% 96% | 200 30% 10% | 185 15% 98% | 200 40% 98% | 220 40% 45% | 5 90% 72% | 175 50% 45% | 185 70% 45% | 187 25% 3% | 190 20% 8% | 185 95% 14% |
| ocean | dark | 187 25% 14% | 187 55% 16% | 187 30% 18% | 187 10% 90% | 187 20% 23% | 200 15% 15% | 220 40% 25% | 5 100% 72% | 170 75% 40% | 185 65% 50% | 187 30% 2% | 187 20% 6% | 185 95% 14% |
| desert | light | 35 50% 92% | 42 55% 88% | 42 50% 96% | 35 35% 10% | 42 20% 98% | 35 40% 97% | 25 45% 45% | 15 60% 55% | 155 51% 62% | 190 60% 45% | 30 40% 4% | 35 50% 8% | 42 23% 36% |
| desert | dark | 25 14% 14% | 32 15% 16% | 42 14% 18% | 42 10% 90% | 42 15% 23% | 35 10% 13% | 25 45% 25% | 15 60% 55% | 155 51% 42% | 190 55% 50% | 25 20% 3% | 25 20% 6% | 42 23% 22% |
| snow | light | 210 10% 95% | 210 42% 92% | 210 56% 98% | 210 20% 10% | 210 5% 100% | 210 50% 94% | 200 30% 85% | 35 70% 50% | 200 80% 65% | 180 70% 55% | 210 15% 4% | 210 15% 8% | 199 86% 28% |
| snow | dark | 210 15% 15% | 210 32% 18% | 210 25% 18% | 210 10% 95% | 210 10% 23% | 210 10% 15% | 200 30% 30% | 35 90% 55% | 199 95% 50% | 220 65% 55% | 210 20% 3% | 210 20% 7% | 199 86% 28% |
| jungle | light | 155 35% 92% | 155 50% 88% | 155 40% 96% | 150 45% 10% | 150 30% 98% | 150 60% 95% | 160 55% 45% | 346 80% 60% | 150 65% 45% | 180 60% 40% | 155 35% 3% | 155 40% 8% | 331 38% 32% |
| jungle | dark | 150 40% 12% | 155 55% 14% | 155 67% 14% | 150 10% 90% | 150 34% 21% | 150 10% 15% | 160 55% 25% | 346 80% 60% | 150 75% 35% | 180 55% 45% | 150 40% 2% | 150 45% 5% | 331 38% 20% |
| blossom | light | 270 25% 93% | 280 35% 90% | 270 30% 97% | 270 25% 12% | 270 20% 98% | 270 30% 95% | 240 45% 60% | 35 95% 60% | 280 50% 70% | 200 55% 50% | 270 20% 4% | 270 30% 8% | 265 70% 55% |
| blossom | dark | 270 22% 15% | 280 30% 18% | 270 28% 19% | 270 15% 92% | 270 20% 22% | 270 18% 16% | 240 40% 40% | 35 95% 60% | 280 45% 55% | 200 50% 55% | 270 25% 2% | 270 28% 6% | 265 70% 55% |
| fall | light | 25 55% 90% | 22 60% 82% | 25 52% 94% | 12 35% 12% | 35 30% 97% | 35 50% 93% | 25 58% 45% | 15 90% 50% | 50 75% 60% | 200 45% 45% | 25 40% 4% | 12 45% 10% | 25 75% 40% |
| fall | dark | 5 35% 16% | 5 45% 20% | 5 40% 20% | 35 20% 90% | 20 26% 21% | 5 45% 18% | 5 60% 30% | 15 85% 50% | 50 75% 50% | 200 40% 50% | 12 35% 3% | 12 38% 7% | 20 55% 30% |

(Themes also set `card-foreground`, `muted`, `muted-foreground` and sometimes `popover`, `border`, `input`; see `apps/web/src/themes/index.js` for the full table.) Theme order in pickers: `default, stone, forest, ocean, desert, snow, jungle, blossom, fall`. Unknown/unset theme → `default`. Theme picker icons (lucide): default Palette, forest Trees, ocean Waves, desert Mountain, snow Snowflake, jungle TreePalm, blossom Flower2, fall Leaf, stone Gem; each option shows swatches of `background, accent, selected, focus, theme-highlight`.

### 2.2 Fixed brand/post-type colours (`@hylo/presenters/colors`, used in JS-computed styles)
Post-type primary colours: discussion & action `#40A1DD` (pictonBlue), event `#FE4850` (sunsetOrange), offer & request `#0DC39F` (caribbeanGreen), project `#FC8000` (flushOrange), proposal `#664BA5` (butterflyBush), resource `#FFD403` (gold). Neutral `slateGrey #67768A`. Others: rhino `#2C4059`, mirage `#1F2C3D`, amaranth `#EE4266`, persimmon `#FE6848`, havelockBlue `#41A1DC` (links), athensGray `#FAFBFC`, ghost `#CCD1D7`, mangoYellow `#FDD549`, mediumPurple `#9883E5`, etc. Legacy SCSS variables (`_sass_resources.scss`) mirror these (e.g. `$color-caribbean-green-20`).

### 2.3 User settings
`settings.theme` (theme key), `settings.colorScheme` (`auto|light|dark`, default `auto`), plus nav settings (module 06). Legacy localStorage keys `hylo-theme`, `hylo-color-scheme`, `hylo-nav-mode`, `hylo-stack-groups` are migrated once into user settings (if DB unset) and deleted.

### 2.4 Group-level appearance
There is **no per-group colour theming**. Groups customise: avatar, banner (module 09/11), and **layout** (`groups.settings.layout`: "Two Column" — "Sidebar menu with content pane", or "One Column" — "Full-width dashboard with cards") in Group Settings → "Appearance & Layout" ("Customize how this group is displayed to members."). Views/spaces get icons and auto-derived tints (module 06 §4.7, module 15).

## 3. Routes / entry points
- `/my/appearance` (User Settings → Appearance: "Appearance Settings"; "Customize the look and feel of Hylo by choosing your preferred color mode and color theme."; controls Color Mode [Auto / Light Mode / Dark Mode icon buttons], Global Navigation [Sidebar/Topbar], Group Nav Stacking [Flat — "Show every group as its own item" / Stacked — "Show subgroups stacked on their parent group"], Group Menu Style [Group Default — "Use each group layout setting" / Side Menu — "Always show the side menu beside the view" / Card Menu — "Always use the full-screen card menu"], Color Theme list).
- Gear menu → Appearance submenus (module 06 §4.4).
- `/my/locale` (Language tab; module 05) and gear menu → Language.
- `/themes`: developer preview page rendering every theme's tokens side-by-side ("Light Mode" and "Dark Mode" columns; `lg:flex-row`).
- Anonymous pages: `LocaleDropdown` in the NonAuth header ("Locale: {code} {flag}").

## 4. UX specification

### 4.1 Applying appearance (`AppearanceSync`, mounted at app root)
1. Resolve theme (`themes[settings.theme] ? settings.theme : 'default'`) and effective scheme (`auto` → `prefers-color-scheme`, live-updated on OS change).
2. Write every token of `themes[theme][scheme]` as `--token` on `<html>`; set `<html class="light|dark">` and `style.color-scheme`.
3. Post `THEME_CHANGE {themeName, colorScheme}` to the native app WebView.
Before login (anonymous pages) settings are absent → default theme, OS scheme. Tailwind `darkMode: ['class']` so `dark:` variants follow the class, not the OS. `index.html` sets `<meta name="color-scheme" content="light dark">` and pre-React backgrounds `#EDECE8`/`#2E2E2E`.

### 4.2 Tailwind configuration (`apps/web/tailwind.config.js`)
- `future.hoverOnlyWhenSupported: true` (hover styles only on hover-capable devices).
- **Screens**: `xs 410px`, `sm 640px`, `md 768px`, `lg 1024px`, `xl 1280px`, `2xl 1536px` (min-width).
- **Colours**: tokens in §2.1 incl. `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `error` (DEFAULT/foreground, no alpha support), `border`, `input`, `ring`, `chart-1..5`, `theme-background` (no alpha), `theme-highlight`, `context-menu-background`, post-type colours.
- **Border radius**: `lg 0.5rem`, `md calc(0.5rem - 2px)`, `sm calc(0.5rem - 4px)` (others Tailwind default: `xl 0.75rem`, `2xl 1rem`, `full`).
- **Border widths**: add `1` (1px) and `3` (3px).
- **Spacing additions**: `190`, `280`, `300`, `320` (px).
- **Scale**: `101` (1.01), `102` (1.02) — used for subtle hover growth.
- **Font size**: `2xs` = 0.625rem.
- **Shadows**: `shadow-header` `0 4px 14px 0 rgba(0,0,0,.16)`; `shadow-header-dark` `0 6px 18px 0 rgba(0,0,0,.45)`.
- **Keyframes/animations**: `slide-up` (10px rise + fade, 0.15s, honours `--delay`), `pulsate` (green glow 0.75s infinite), `menu-flash` (two 3px `selected/0.7` ring + `selected/0.28` bg pulses over 1.4s — highlights newly added menu items), `typing-dot` (1.1s bounce for typing indicators), `animationDelay` utilities 0–950ms in 50ms steps; plugin `tailwindcss-animate` (Radix `animate-in/out`, `fade-in-0`, `zoom-in-95`, `slide-in-from-*`).

### 4.3 Typography
- Global font stack on every element: `'Onest', 'Circular Book', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif`. Onest loaded from Google Fonts (`wght@100..900`, `display=swap`).
- Body: `bg-background text-foreground`, `overflow-x: hidden` (except the mobile editor body).
- Tailwind type scale used throughout: `text-xs` 12px, `text-sm` 14px, `text-base` 16px, `text-lg` 18px, `text-xl` 20px, `text-2xl` 24px; weights `font-medium` 500, `font-semibold` 600, `font-bold` 700.
- Legacy typography classes (`typography.scss`): `h1/.hdr-headline` 32px → 20px ≤600px → 16px/20px ≤500px; `.hdr-display`; body classes `bdy-*`, `caption-*`, `.timestamp` (10px ≤320px). `html.compact-layout` (phones & tablets): h1 20px, h2 16px/20px, `.bdy-lt-lg` 15px/22px.
- Rich content (`.global-postContent`): h1 1.3rem bold, h2 1.15rem bold, h3–h6 1rem bold, headings `margin-bottom: 15px`; lists indented 2em (disc/decimal); links break anywhere; selectable text on phones. Blockquote: 2px left border `foreground/0.6`, text `foreground/0.7`, padding 0.5em. Inline code: 12px, `rgba(255,255,255,.8)` on rhino `#2C4059`, radius 0.25em; code blocks radius 0.5em, padding 1em 1.25em.
- Scrollbars: thin (Firefox `scrollbar-width: thin`, thumb `hsl(240 10% 3.9% / .2)`; dark `hsl(40 100% 99% / .2)`); WebKit width 8px, transparent track; dark thumb `rgba(255,255,255,.3)` with 1px `rgba(255,255,255,.1)` border (hover .4).
- Dark-mode autofill: text `hsl(40 100% 99%)` with an inset box-shadow in the input colour.

### 4.4 Iconography
- **Lucide** (`lucide-react`): primary icon set for new UI (nav, menus, buttons). A curated `LucideIcon` component renders icons by name (`lucideIconSet.js` / `lucideIconImports.js`) for user-chosen view/space icons via `LucideIconPicker`; falls back to the Hylo icon font when the name isn't Lucide.
- **Hylo icon font** `hylo-evo-icons` (eot/ttf/woff/svg in `/assets/fonts/icons/`): `<Icon name='X'>` renders `<span class="icon icon-X">`; 135 classes, e.g. EmailNotification, InAppNotification, PushNotification, Announcement, Invite, Post, Star, Plus, Settings, ArrowForward, Document, Download, Send, Checkmark, Back, AddImage, Clock, Reply, Google, Facebook, LinkedIn, Ex (close), NewCommunity, Projects, Events, Home, Topics, Members, Messages, Notifications, Search, Share, More, ArrowUp/Down, Location, Trash, Pin, Complete, Flag, Paperclip, Globe, Stack, Calendar, Public, Funnel, Hamburger, BadgeCheck, Unlock, Person, Eye, Letter, Phone, Email, Copy, Heart, Request, Info, Create, Groups, Project, Resource, Discussion, Event, RaisedHand, SmallEdit, Replies, Chat, Smiley, CardView, ListView, Stream, Enter, Lock, Shield, Hand, Hidden, CircleEx, Handshake, Twitter, Edit, SpeechBubble, People, Binoculars, Buy, Cooperative, Filter, Mentorship, Message, Volunteering, Research, Equipment, Proposal, Posticon, Support, … Optional modifiers `green`, `blue`.
- `BadgedIcon` = Icon + unread dot. `SimpleIcon` renders brand logos (Simple Icons paths with `<title>`).
- View type → icon mapping is defined in `GroupViewPresenter` (module 15; summary in module 06).

### 4.5 Core components

| Component | Spec |
|---|---|
| **Button** (`ui/button`, cva) | Base: `inline-flex items-center justify-center gap-1 rounded-md text-sm font-medium`, hover `scale-101`, focus-visible `ring-1 ring-ring`, disabled 50% opacity, child svg 16px. Variants: `default` (`bg-primary text-primary-foreground`, 2px transparent border → `foreground/20` + `shadow-xl` on hover), `destructive`, `highVisibility` (`bg-selected text-foreground p-2`, text-xs→sm:text-base, hover scale 105), `outline` (`text-base border-2 border-foreground/20` → 50%, `bg-background p-2`), `selectedOutline` (border `selected`), `secondary` (`bg-secondary/80`), `tertiary`, `ghost` (hover `bg-selected`), `link` (underline on hover). Sizes: `default h-10 px-4 py-2`, `sm h-9 px-3`, `lg h-11 px-8`, `icon h-10 w-10`. Optional `tooltip` prop. |
| Legacy `components/Button` | SCSS button with `label`, `color` (e.g. `white`), used in older screens. |
| **Dialog** (`ui/dialog`, Radix) | Overlay `fixed inset-0 z-[100] bg-darkening/30` fade; content `fixed centered z-[101] max-w-lg w-full p-6 bg-background shadow-xl sm:rounded-lg gap-4`, zoom/fade/slide animations 200ms; close `X` 16px at top-right 16px (`sr-only` "Close"). Header `text-lg font-semibold`, description `text-sm text-muted-foreground`, footer stacks on mobile (`flex-col-reverse`) and right-aligns on sm. Supports `overlayAsDiv` for non-modal use. |
| **ModalDialog** (legacy) | Title, body, submit button (`submitButtonText`), Escape closes. |
| **Popover** (`ui/popover`) | `z-[200] w-72 rounded-md bg-card p-4 shadow-2xl`, fade/zoom/slide-in; optional arrow (`fill-card`). |
| **DropdownMenu** (`ui/dropdown-menu`) | Content `z-50 min-w-[8rem] rounded-md border bg-popover p-1 shadow-md`, max height = available height (scrolls); items `px-2 py-1.5 text-sm rounded-sm gap-2`, focus `bg-accent text-accent-foreground`, svg 16px; radio/checkbox items `pl-8` with check indicator; labels `font-semibold`; submenus with `ChevronRight`. |
| **RightClickMenu** | Radix ContextMenu wrapper (used on rail items). |
| **Tooltip** (`ui/tooltip`) | `TooltipProvider delayDuration={0}` app-wide; content `z-[400] rounded-md bg-popover px-3 py-1.5 text-sm shadow-md`, fade/zoom; optional arrow. |
| **InfoButton** (`ui/info`) | (i) icon showing a tooltip with help content (ViewHeader `info`). |
| **Switch** (`ui/switch`) | Track `h-6 w-12 rounded-full`, checked `bg-selected`, unchecked `bg-foreground/50`; thumb 16px white with shadow; tiny 8px bold uppercase white labels inside the track: "ON" (visible when checked, left) / "OFF" (when unchecked, right); with `yesNo` prop "YES"/"NO" (not translated). |
| **Input** (`ui/input`) | `h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm`, placeholder muted, focus `ring-2 ring-ring ring-offset-2`. Legacy `TextInput` used widely (e.g. `bg-input rounded-lg`, focus `border-focus`). |
| **Select** (`ui/select`), **Checkbox**, **RadioGroup**, **Label**, **ToggleGroup/Toggle**, **Command** (cmdk list), **Calendar**, **DateTimePicker** (with native picker fallback on touch devices; module 14), **form-field** | shadcn conventions with the tokens above. |
| **Toaster** (sonner) | See module 06 §4.2. Used via `toast(...)`. |
| **Loading** | Rotating 270° arc SVG (`#999999`, 0.6s/rev), 40px (inline 25px). Types: `fullscreen` (full screen, `midground` bg), `top` (pt 10%), `bottom` (10% height, mb 30px), `inline`. `role=img aria-label="loading"`. |
| **Skeleton** | Pulsing placeholder blocks (route-shaped skeletons, module 06). |
| **RoundImage** | Background-image circle (or `square` → `rounded-lg`), `p-1 bg-background bg-cover bg-center`. Sizes: tiny 14px, small 20px, medium 32px, large 40px, default 44px, xlarge 80px, xxlarge up to 20vh; options overlaps, border. |
| **Avatar** | RoundImage linking to a profile; when `personId` given, shows the **profile hover card** (hover on desktop, long-press on touch; module 20), suppressing iOS callouts. |
| **Badge** | Accent circle (`bg-accent`, accent-foreground text, `font-semibold 12px`), min 21×21 when expanded, 7px dot when collapsed; `'-'` renders a 12px white inner dot (used as "unread"). Optional border. `role=status`. |
| **Pill** | Rounded label (skills/topics) with tooltip (default "Click to Search"), optional click (search), editable two-step remove (first click arms, second removes), mobile long-press (500ms) opens tooltip. |
| **TagInput / KeyControlledList** | Chip pickers (module 07 §6). |
| **TruncatedText** | Truncates and shows full text in a tooltip only when truncated. |
| **Highlight** | Wraps matches in a highlight class. |
| **EmojiPicker** | `@emoji-mart/react` picker opened from a `SmilePlus` trigger; used for reactions and emoji insertion (module 13). Mobile devices get adjusted sizing/positioning. Emoji pills (`EmojiPill`, `EmojiRow`) show reaction counts. |
| **Icon/LucideIcon/IconSelector/LucideIconPicker** | §4.4. |

### 4.6 Avatars & default images
| Asset | Path |
|---|---|
| Default group avatar | `/default-group-avatar.svg` — in nav/menus never shown raw: replaced by a `focus→selected` diagonal gradient (70–80% opacity) on `bg-darkening` with white initials (first letter of first two words, uppercase) |
| Default group banner | `/default-group-banner.svg` |
| Default user banner | `/default-user-banner.svg` |
| The Commons banner | `/the-commons.jpg` |
| Context avatars (legacy drawer) | All Groups `/assets/white-merkaba.svg`, Group Explorer `/assets/group-explorer.svg`, Public Map `/assets/earth.svg`, Public `/public.svg`, My Home `/my-home.svg` |
| Logos | `/hylo-logo-dark-horizontal.svg` (light bg), `/hylo-logo-light-horizontal.svg` (dark bg), `/hylo.svg`, merkaba marks `/assets/navy-merkaba.svg` & `/assets/white-merkaba.svg` |
| Mascot illustrations (axolotl) | `/assets/hey-axolotl.png` (empty), `/assets/thinking-axolotl.png` (loading), `/assets/puzzled-axolotl.jpg` (404/error) |
| Space default glyph | Lucide `Shapes` |
User default avatars are generated server-side (module 20).

### 4.7 Accessibility conventions
- Radix primitives provide focus management, `aria-*`, Escape-to-close, roving focus in menus. Dialogs include `DialogTitle` (sometimes `sr-only`).
- Icon-only buttons carry `aria-label` (e.g. "Create", "Back", "Space Settings", "Group Settings", "Search", "Dismiss", "Adjust menu width"); tooltips mirror labels.
- Live/stateful elements: Badge `role=status`; boot loader `role=status aria-label="Loading"`; Loading SVG `role=img aria-label="loading"`; site banner top card `role=dialog aria-modal`; resizer `role=separator`; tour invitation `role=dialog`.
- Focus rings: `focus-visible:ring-ring` (buttons/inputs), `outline-focus` on search inputs.
- Keyboard: drag-and-drop lists have keyboard sensors; card buttons respond to Enter/Space; menus & typeaheads support arrows/Enter/Escape (module 06 §4.18, module 07 §6).
- Motion: tour invitation uses `motion-reduce:transition-none`; most other animations don't honour reduced motion.
- `hoverOnlyWhenSupported` avoids sticky hover on touch. Pinch-zoom is disabled by the viewport meta (accessibility regression; see quirks).
- Text contrast on photos: white text with `text-shadow: 0 1px 3px rgba(0,0,0,.65)` and dark gradients.
- Data-test hooks: `data-testid` on key controls; `data-tour` anchors for tours.

## 5. Internationalisation

### 5.1 Locales
| UI locale (stored) | Label | Flag | Translation file |
|---|---|---|---|
| `en-US` (default) | English | 🇺🇸 | `en.json` |
| `en-GB` | English (UK) | 🇬🇧 | `en.json` (falls back to en-US; dates use day-first) |
| `es-ES` | Spanish | 🇪🇸 | `es.json` |
| `de-DE` | German | 🇩🇪 | `de.json` |
| `fr-FR` | French | 🇫🇷 | `fr.json` |
| `hi-IN` | Hindi | 🇮🇳 | `hi.json` |
| `pt-BR` | Portuguese | 🇵🇹 (flag is Portugal although the code is pt-BR) | `pt.json` |
`normalizeLocaleToFull`: short codes map to the full codes above (`en→en-US`, `es→es-ES`, `de→de-DE`, `fr→fr-FR`, `hi→hi-IN`, `pt→pt-BR`, `pt-PT` kept); unknown full codes are kept; anything else → `en-US`. `localeToTranslationKey`: any `en*` → `en`; otherwise the language part.

### 5.2 i18next setup (`apps/web/src/i18n.mjs`)
- Plugins: `i18next-http-backend` (loads `/locales/<key>.json` at runtime), `react-i18next`, `i18next-browser-languagedetector`.
- **Keys are the English source strings** (`keySeparator: false`, `nsSeparator: false`, `defaultNS: false`) — e.g. `t('Create a group')`; a few semantic keys exist (`view-*`, `widget-*`). `en.json` has ~3,300 keys; missing keys render the key itself (English).
- Interpolation `{{name}}`, `escapeValue: false`; plurals via `_one/_other` suffix keys with `count` (e.g. `{{count}} Members`).
- Detection order: cookie `hylo-i18n-lng` → localStorage `hylo-i18n-lng` → sessionStorage → `navigator` → `<html lang>`; cached to localStorage; detected value normalised to full locale. `supportedLngs` include full and legacy short codes; `nonExplicitSupportedLngs: true`. Fallback: `en-GB → en-US`, default `en-US`; `en-US` preloaded. Debug logging outside production.
- **Choosing the locale**: (1) user's `settings.locale` once logged in (written to localStorage on bootstrap); (2) changing language in the gear menu, `/my/locale`, or the anonymous `LocaleDropdown` calls `i18n.changeLanguage(full)`, writes localStorage, and (if logged in) saves `settings.locale`. The backend uses the user's locale for emails/notifications (module 19). The native app receives locale via WebView messages.
- Rule (CLAUDE.md): every new UI string must be added to all six locale files.
- Hard-coded English exists in places (e.g. "A new version of Hylo is available", "Searching in group …", "Management", some legacy SCSS components).

### 5.3 Date & time formatting
- Library: **Luxon** (`DateTime`) via `@hylo/shared` `DateTimeHelpers`, with the locale from `getDateLocale()` (normalised UI locale) and per-event IANA timezones; timezone pickers list `Intl` supported zones with friendly names and `ZZ` offsets.
- **Relative time** (`humanDate`, using `pretty-date`): "just now" or "N seconds ago" → `now`; otherwise abbreviated: `5m ago`, `3h ago`, `2d ago`, `1w ago`, `4 mos ago`, `2y ago` (`short=true` drops " ago"). English-only output (not localised).
- **Event date ranges** (`formatDatePair`): en-US `ccc MMM d, yyyy` (e.g. "Sat Nov 8, 2026"), all other locales day-first `ccc d MMM yyyy`; year omitted when in the current year; time appended as `'•' t` and timezone abbreviation `ZZZZ`; same-day ranges show only the end time ("Sat Nov 8 • 3:00 PM - 5:00 PM PST"). `skipTime` variant omits times.
- Other formats seen: `DD` (localised medium date, e.g. "Nov 8, 2026") for site banners; `MMM`/`MMMM` month names; hours `h a` or `HH` (24h option).

## 6. Business rules & side effects
- Appearance & locale settings persist server-side in `users.settings` via `updateMe`; they apply on any device after login.
- Theme changes are pushed to the native app (`THEME_CHANGE`).

## 7. Permissions
Each user controls only their own appearance and language. Group layout requires the Administration responsibility.

## 8. API
- `mutation updateMe(changes: { settings: { theme, colorScheme, locale, globalNavStyle, stackGroups, groupNavStyle } })`.
- `mutation updateGroupSettings(id, changes: { settings: { layout } })` (module 11).
- Static: `GET /locales/{en,es,de,fr,hi,pt}.json`.

## 9. Edge cases & known quirks
- Base light `accent-foreground` is `0 0 100%` (missing `%`), an invalid HSL that browsers ignore in `hsl()` → falls back to inherited/initial colour.
- Dark base uses key `errorForeground` instead of `error-foreground`.
- `chart-*` colours referenced in Tailwind but never defined.
- `pt-BR` paired with the Portuguese (Portugal) flag.
- Relative dates are always English.
- `user-scalable=0` / `maximum-scale=1` prevents zoom.
- Theme switching before login is impossible (no settings), anonymous pages always use the default theme.
- Legacy SCSS colours (e.g. `.highlight` caribbean-green-20, Badge/NotFound styles) don't follow themes.

## 10. Docs vs. code
| Docs (Appearance & Themes, Language/Locale pages) | Code |
|---|---|
| "Switch between light and dark mode, as well as change your color themes." | Code adds "Auto/System" mode (follows OS), 9 named themes (Default, Stone, Forest, Ocean, Desert, Snow, Jungle, Blossom, Fall), plus navigation preferences (Sidebar/Topbar, Flat/Stacked, Group Default/Side Menu/Card Menu) on the same Appearance page. |
| "We currently offer Hylo in English and Spanish." | Code supports English (US), English (UK), Spanish, German, French, Hindi and Portuguese (Brazil), with translation files for en/es/de/fr/hi/pt. |

## 11. Source references
- `apps/web/src/themes/index.js`, `util/appearance.js`, `hooks/useAppearance.js`, `components/AppearanceSync/AppearanceSync.js`, `routes/Themes/Themes.js`
- `apps/web/tailwind.config.js`, `src/css/global/{index.scss,fonts.scss,icons.scss,_sass_resources.scss}`, `src/css/{typography.scss,layout.scss}`
- `apps/web/src/components/ui/*`, `components/{Button,Icon,LucideIcon,Badge,Pill,RoundImage,Avatar,Loading,Skeleton,EmojiPicker,TruncatedText,Highlight,ModalDialog}`
- `apps/web/src/routes/UserSettings/AppearanceTab/AppearanceTab.js`, `routes/GroupSettings/AppearanceTab/AppearanceTab.js`
- `apps/web/src/i18n.mjs`, `util/locale.js`, `apps/web/public/locales/*.json`, `routes/AuthLayoutRouter/components/GlobalNav/LocaleDropdown`
- `packages/shared/src/{LocaleHelpers.js,DateTimeHelpers/DateTimeHelpers.ts,TextHelpers.js}`, `packages/presenters/src/colors.js`, `store/models/Group.js`
