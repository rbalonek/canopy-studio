# CanopyStudio

AI-grounded ad + content platform for marketing agencies and SMBs. Two
audience modes (Agency / Business) drive vocabulary throughout. The repo
hosts the **app** (this `.app` domain product); the marketing site lives
in a separate project on `.com`.

## Stack

- Vite + React 18 + TypeScript + React Router v6
- Supabase (Postgres + Auth + Storage) — local for dev, hosted for live
- `@supabase/supabase-js` v2 (publishable-key flow)
- Plain CSS with design tokens (no Tailwind, no UI library)

## Quick start

```bash
npm install
cp .env.example .env.local         # then fill in keys (see below)
supabase start                     # one-time ~5-min image pull, then fast
npm run dev                        # http://localhost:5173
```

Hit `/` — login (or your workspace if signed in). The full design
reference is browseable under `/dev/*` (Overview, Clients, Ad Studio,
Brand Intelligence, etc).

## Routes

- **`/`** — live gate: login when signed out; when authed, redirects to
  `/onboard` (no workspace yet) or `/app/<slug>` (first workspace).
- **`/app/:slug/*`** — the live product: auth-gated, workspace-scoped,
  Supabase provider, RLS does the tenant isolation. The sidebar lists
  only routes flagged `live` in `src/routes.ts`.
- **`/dev/*`** — design reference / wireframe mode. No auth, mock
  provider. Every wireframe view stays browsable here even before (or
  without) going live.
- **`/legal/*`** — public legal pages (privacy, terms, data deletion).
  No auth — Meta/Google app review require login-free URLs.

See [`ROADMAP.md`](ROADMAP.md) for what's live vs. still being wired up.

## Data layer

Single source of truth lives in [`src/data/`](src/data/):

- `types.ts` — every record shape (clients, campaigns, assets, brand
  profile, comparisons, gaps, rules, …). The TS types drive the SQL
  schema, not the other way around.
- `mock.ts` — typed in-memory fixtures for every table.
- `provider.ts` — async read interface (`DataProvider`).
- `mockProvider.ts` — implements `DataProvider` against `mock.ts`.
- `supabaseProvider.ts` — factory that returns a `DataProvider` backed
  by `@supabase/supabase-js`. Spreads `mockDataProvider` first so any
  method without a real table still returns fixture data — the migration
  to Supabase is method-by-method.
- `pickProvider.ts` — boot-time picker reading `VITE_DATA_PROVIDER`.
- `context.tsx` — React `useDataProvider()` + `useQuery()` hooks.

Views never reach into mock arrays directly. Always `useQuery(p =>
p.listX())`.

## Supabase

Schema migrations and seed live in [`supabase/`](supabase/). The CLI is
linked to the hosted project; same migrations apply to local and hosted.

```bash
# Local
supabase start                                  # boot stack
supabase db reset                               # re-apply migrations + seed (local only)
supabase migration new <slug>                   # add a new migration

# Hosted (linked to project iklouyjenajyagccymaj)
supabase db push                                # push migrations to hosted
supabase db query --linked --file supabase/seed.sql   # apply seed to hosted (only safe pre-real-data)
```

`supabase start` prints local URLs + a deterministic publishable key.
Studio is at `http://127.0.0.1:54323`.

## Env vars

See [`.env.example`](.env.example). Notable:

- `VITE_DATA_PROVIDER` — `mock` or `supabase` (default `mock`)
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` — read by the
  browser; safe to commit (publishable key is designed for the client).
  Toggle between local (`http://127.0.0.1:54321`) and hosted
  (`https://<ref>.supabase.co`) by editing these.
- `SUPABASE_DB_PASSWORD` — used only by the CLI for `supabase db push`
  against hosted. **Never** read by the browser. Keep in `.env.local`.

## Repo layout

```
.
├── README.md / CLAUDE.md        ← you are here
├── index.html                   ← Vite entry
├── src/
│   ├── App.tsx                  ← top-level router (/, /dev/*, catch-all)
│   ├── routes.ts                ← prefix-agnostic route table + sidebar metadata
│   ├── shell/                   ← AppShell, Sidebar, Topbar, AppState
│   ├── data/                    ← types, mock, provider interface, providers
│   ├── components/              ← shared primitives (Icon, KPI, MetricPicker, …)
│   ├── lib/                     ← framework-free helpers (metaMetrics: metric catalog)
│   └── views/                   ← one file per route (sub-folders for tabbed views)
├── supabase/
│   ├── config.toml              ← local stack config
│   ├── migrations/              ← timestamped .sql files; applied in order
│   └── seed.sql                 ← runs on `supabase db reset` (local only)
└── wireframes/                  ← design reference exported from Claude Design.
                                   Treat as source-of-design-truth; may be
                                   overwritten by Claude Design itself.
```

## Website scraper

The `scrape-client` Edge Function crawls a client's site (and competitor sites)
and stores the extracted page text in the `scraped_pages` table. That content is
kept and reused — it grounds the AI brand profile, ad copy, and competitor
analysis; the site isn't re-fetched every time. Managed from a client's **Scraped
Pages** tab:

- **Re-scrape** — full re-crawl from the saved website URL (discovers the
  sitemap, ranks pages, fetches the top ~8). Non-destructive: a failed run never
  wipes existing pages.
- **Add pages** — paste one or more URLs/paths to scrape just those, leaving
  existing pages untouched (no re-crawl).
- **Exclude** — per-page dropdown: *Active*, *Skip re-scrape* (keep the last
  content for the AI), or *Skip re-scrape + content* (also hide it from the AI).
- **Edit words** — click a page's word count to open its extracted text; edits
  are saved and preserved across future re-scrapes.

A client's analyzed logo (detected during scraping, stored on `brand_profiles`)
is shown in place of the initials avatar across the client grid, tables, headers,
and its location cards — falling back to initials when there's no logo.

## Asset library

A client's **Assets** tab is a real upload-backed library: drop in logos, photos,
videos, or brand docs and they're stored in a public Supabase Storage bucket
(`client-assets`) with a metadata row per file. Uploads, thumbnails, and delete
all work from the browser. **Set as client logo** on any image makes it the
client's brand logo (shown app-wide, and protected from being overwritten by a
future website analysis). `/dev` keeps the wireframe on mock data.

## Organic posting & scheduling — LIVE ✅

CanopyStudio officially posts and schedules organic content to Facebook and
Instagram. The Content Calendar (top-level "All clients" view + a Calendar
tab on every client) covers the full loop:

- **Plan** — a `content_plan` AI job drafts a whole calendar from a brief
  (objective, channels, date range, cadence, optional source URL to build
  around), grounded in the client's brand profile + scraped site.
- **Per-platform captions** — separate FB and IG copy per post (they're
  independent API calls; IG gets hooks + hashtags, FB stays link-friendly).
- **Imagery** — per-post image briefs; "Generate image" renders them via
  the configured provider (xAI `grok-imagine-image` by default —
  `-quality` variant and OpenAI selectable in Settings → AI; the model
  field is free text, so provider renames never need a deploy).
  Image / video / link media types per post.
- **Post now** — instant live publish to the selected channels, gated to
  approved posts behind a confirm.
- **Schedule** — Facebook posts are scheduled *natively in Meta* (they
  appear in the Page's Content Library → Scheduled and Meta publishes
  them); Instagram has no API scheduling (a platform limitation for all
  tools), so a 5-minute cron publishes IG at the scheduled time. Cancel
  un-schedules both sides.

Needs per environment: a Meta token + Page ID (+ IG Business account id
for Instagram) on the client, `XAI_API_KEY` for image generation, and the
two Vault secrets for the cron (see `CLAUDE.md` → secrets checklist).
External client accounts still require Meta App Review
(`pages_manage_posts`, `instagram_business_content_publish`).

### Still roadmap

| Feature | Status | Key caveat |
|---|---|---|
| Auto-publish to Stories (no phone tap required) | Planned | Interactive stickers (polls, link stickers) cannot be added via API — must be added manually in-app after publish |
| Location tagging via Meta's place search | Planned | Always show the user the exact Meta-canonical place name before confirming — it may differ from what they typed. Not available on carousel posts. |
| Multi-image carousel upload (up to 10 images) | Planned | Single multi-file picker in UI; N+1 API calls happen server-side. Location tags not supported on carousels. |

## Common tasks

**Add a view** — drop a component in `src/views/`, register it in the
`VIEWS` map in [`src/shell/AppShell.tsx`](src/shell/AppShell.tsx), and
add an entry to `ROUTES` in [`src/routes.ts`](src/routes.ts).

**Add a table** — add the type to `src/data/types.ts`, fixture rows to
`src/data/mock.ts`, a method to `DataProvider`, and a real implementation
in `mockDataProvider`. When ready to back it with Postgres: write the
migration, add the seed insert, and override the method in
`createSupabaseDataProvider`.

**Switch the app between local & hosted Supabase** — edit two lines in
`.env.local` (`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`),
restart the dev server.

**Add a Meta metric** — add a `MetricDef` to `METRICS` in
[`src/lib/metaMetrics.ts`](src/lib/metaMetrics.ts). The campaigns table, the
client Overview, and the metric picker all pick it up automatically. Values
come from the period-aware `Norm` (built from `campaigns.metrics_by_period` —
this month / last month / last 30 days — plus the full Meta action map). Every
action type present in the data is already auto-discovered as a selectable
metric, so you only add a `MetricDef` for a *derived* metric (a ratio,
cost-per, or a friendly-named rollup). See CLAUDE.md → *Meta refresh & metrics*.
