# CanopyStudio — Project Context

AI-grounded ad + content platform for **Redwood Digital Strategies** (marketing agency) and their SMB clients. Single-HTML interactive wireframe — all 14 screens + component library + two golden-path flows live in one SPA-like doc.

## How to run
Open `CanopyStudio Wireframes.html`. Sidebar routes between views; state persists to `localStorage` under `canopy.state.v1`. Tweaks panel (toolbar toggle) exposes theme/mode/density/AI/grid controls.

## Two modes (top-bar toggle)
- **Agency** — Jordan at Redwood manages 9 clients. Default. Sidebar shows "Clients".
- **Business** — Acme Dental owner manages 3 locations directly. Sidebar shows "Locations".
`state.mode` is threaded into every view that needs it.

## File structure

| File | Contains |
|---|---|
| `CanopyStudio Wireframes.html` | Shell, script order, TWEAK_DEFAULTS (EDITMODE-BEGIN block), App router |
| `styles.css` | Design tokens (dark-first zinc shell, teal accent, indigo AI), layout primitives, component classes |
| `icons.jsx` | Inline SVG icon set (`Icon name="..."`) — UNUSED: icons are defined in components.jsx instead. Safe to ignore. |
| `components.jsx` | Icon, Delta, Spark, KPI, Strategy, Status, AIBadge, Ring, Drawer, ProgressBanner, Empty, AreaChart, Bars, EntityCard |
| `midfi.jsx` | **Mid-fi visuals** — LogoDot, DeltaSpark, LiftBar, AdThumb, AdLibraryStrip, CreativeCadence, Donut, Histogram, BRAND_TINTS |
| `data.jsx` | CLIENTS, CLIENT_PERF, CAMPAIGNS, POSTS_WEEK, URGENT, POSTS_QUEUE, COMPETITORS |
| `shell.jsx` | Sidebar, Topbar, TweaksPanel |
| `preview.jsx` | ChannelPreview — IG Feed / FB Feed / Reels phone mocks for Ad Studio |
| `views1.jsx` | ViewComponents, ViewOverview, ViewClients, ViewClientDetail |
| `views2.jsx` | ViewAdPerf, ViewCalendar, ViewAdStudio |
| `views3.jsx` | ViewBrand, ViewApprovals, ViewPublish, ViewReports, ViewSettings, Swatches |
| `views4.jsx` | ViewBilling, ViewAuth, ViewOnboard, ViewGolden |

Script load order matters — `components.jsx` → `midfi.jsx` → `data.jsx` → `shell.jsx` → `views1-4.jsx` → `preview.jsx` → inline App script. Each file exports to `window` at the bottom via `Object.assign(window, {...})` because Babel `<script>` scopes don't share.

## Design system
- **Shell**: dark-first, zinc neutrals (`--bg-1`, `--bg-2`, `--fg`, `--fg-2`, `--border`)
- **Accent**: teal `--accent` (primary actions, performance metrics, selected states)
- **AI**: indigo `--ai` (Claude surfaces, "AI ✦" badges, `.ai-surface` class)
- **Status colors**: `--green` / `--amber` / `--red`
- **Type**: Inter + JetBrains Mono; tabular-nums on all numeric columns
- **Pattern for card chrome**: `.card` + `.card-pad` + optional `.bdr-{red|amber|green}` left-border accent
- **Logo marks**: `<LogoDot name="Acme Dental" size={28} />` — per-client gradient via `BRAND_TINTS` map in `midfi.jsx`

## Hero screens (mid-fi)
1. **Overview** (`ViewOverview`) — client/industry scope filter chips recompute KPIs + perf table live. Gradient sparklines, brand logo dots, area chart w/ legend.
2. **Ad Performance** (`ViewAdPerf`) — tree nav + 12-cell metric grid (each with DeltaSpark), Ad Sets table with CPL bar fills.
3. **Ad Studio** (`ViewAdStudio`) — 4-step stepper. **Step 1 "Your brief"** is the hero: prompt textarea + tone pills + AI idea bank (click to fill prompt) + reference image upload + 3 modes (consider/banners/variations) + generator picker (DALL·E / Nano Banana / Imagen). Steps 2–4 below. Channel preview right rail toggles IG/FB/Reels.
4. **Brand Intelligence → Competitors** (`ViewBrand`) — competitor cards w/ LogoDot + Donut SoV + 4-up AdLibraryStrip + 12-week CreativeCadence bars.

## Tweaks / EditMode
Persisted defaults in `TWEAK_DEFAULTS` inside HTML. `TweaksPanel` in `shell.jsx` posts `__edit_mode_set_keys` to parent. Keys: `view`, `mode`, `theme`, `collapsed`, `density`, `ai`, `grid`.

## Known conventions
- No placeholder greys on hero screens — always use `AdThumb` for creative imagery
- Numbers always `fontVariantNumeric: 'tabular-nums'`
- AI-originated content sits on `.ai-surface` (indigo-tinted card)
- When adding a new screen: add ViewFoo to a views*.jsx, export to window, register in `views` map inside `App` (HTML inline), add a sidebar entry in `shell.jsx`

## Outstanding / nice-to-haves
- Icons file (`icons.jsx`) is dead code — Icon is defined inside `components.jsx`. Can delete.
- Onboarding wizard (ViewOnboard) is static steps, not wired to actual state progression
- Golden-path flow view is a static storyboard
- Only one mode of the channel preview (IG) uses the new AdThumb; FB/Reels still use simpler creative layers — could upgrade for consistency
