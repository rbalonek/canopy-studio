# CanopyStudio — Agent guide

This file is for future Claude Code sessions in this repo. Read alongside
[`README.md`](README.md) (which covers the same ground for humans).

## What this repo is

The **app** half of CanopyStudio — an AI-grounded ad + content platform.
Two-mode product (Agency / Business) that the wireframe imported from
Claude Design fully describes. The marketing site is a separate
project on `.com`; everything in this repo ships to `.app`.

## Wireframes are the design source of truth

[`wireframes/`](wireframes/) is the export from Claude Design. **Don't
edit those files as part of feature work** — they may be overwritten by
the next Claude Design export. When porting wireframe work into the real
app, copy/transform from `wireframes/` into `src/`. The wireframe's own
[`wireframes/CLAUDE.md`](wireframes/CLAUDE.md) is the design-system
reference (tokens, hero screens, conventions like "no placeholder greys
on hero screens", etc).

## Routing model

Top-level router lives in [`src/App.tsx`](src/App.tsx):

- `/` — live gate: `<Login>` when signed out; when authed, redirects to
  `/onboard` (no workspace yet) or `/app/<slug>` (first workspace).
- `/dev/*` — design reference, no auth, all wireframe views browsable
  on the mock provider.
- `/app/:slug/*` — the live product: auth-gated, workspace-scoped,
  Supabase provider, RLS does the tenant isolation.

Routes are **prefix-agnostic**: [`src/routes.ts`](src/routes.ts) stores
relative `subpath` values and the `Sidebar` takes a `prefix` prop. The
`/dev` and `/app` shells share the same ROUTES table;
`routePath(prefix, subpath)` composes URLs. Routes carry a `live` flag —
the `/app` sidebar lists only `live: true` routes (wired-up features);
everything else stays browsable under `/dev`. Several live views
(BrandTab, CompetitorsTab, AdStudio, Reports) branch on
`useWorkspace()`: workspace present → live implementation, null → the
wireframe version for `/dev`.

## Data layer convention

**Views never read fixtures directly.** Every view goes through:

```ts
const { data, loading } = useQuery<T>((p) => p.listX(args), [deps]);
```

The `DataProvider` interface in [`src/data/provider.ts`](src/data/provider.ts)
is the single contract. Two implementations:

- `mockDataProvider` — typed in-memory fixtures from
  [`src/data/mock.ts`](src/data/mock.ts).
- `createSupabaseDataProvider()` — factory that returns a provider
  backed by `@supabase/supabase-js`. **Spreads the mock first**, then
  overrides only methods whose tables exist in Postgres. So porting is
  table-by-table — nothing breaks while a migration is mid-flight.

Choice happens once at boot in [`src/data/pickProvider.ts`](src/data/pickProvider.ts)
based on `VITE_DATA_PROVIDER`.

## When porting a new table to Supabase

1. Add the migration with `supabase migration new <slug>` and write the
   SQL. Match the TS types in `src/data/types.ts` — use `text` IDs to
   match `mock.ts` for now (production switch to UUIDs is later).
2. Add `enable row level security` + an `anon_read` policy on every
   table. Writes will be gated when real auth lands — anon read is
   intentionally permissive for the current pre-auth phase.
3. Add the corresponding `insert` block to
   [`supabase/seed.sql`](supabase/seed.sql), copying the rows from
   `mock.ts`.
4. `supabase db reset` to re-apply locally, verify counts via
   `docker exec supabase_db_canopystudio psql -U postgres -c '...'`.
5. Override the corresponding method(s) in `createSupabaseDataProvider`
   in [`src/data/supabaseProvider.ts`](src/data/supabaseProvider.ts) —
   query, then `toX()` mapper to camelCase shape. Mock spread above
   handles the methods you haven't migrated yet.
6. Push to hosted: `supabase db push` (migrations) +
   `supabase db query --linked --file supabase/seed.sql` (seed, only
   safe while we have no real user data).

## Commit style

One slice per commit, short subject + a few-paragraph body explaining
the *why* and what migrated/changed. Co-Authored-By trailer on each.
The existing `git log --oneline` is a good template.

## Current state

The original six-step live-flow plan (route split, workspaces schema,
auth, onboarding, `/app` guard, META manual token) is **all done**, as
is the feature build-out on top of it: campaigns/ad-sets/ads drill-down
with Meta refresh, website scraper, and the AI platform below. `/dev`
stays on the mock provider throughout — the showroom never depends on
the live schema.

## AI pipeline (jobs / providers / skills)

Everything AI runs through one serverless pipeline:

- **Jobs**: the browser calls the `enqueue-job` Edge Function →
  `run-job` executes **one LLM call per invocation** (collaboration
  mode = generate → review → refine as three chained invocations) →
  the UI polls the `jobs` row every 2s (`src/data/useJob.ts`).
  `run-job` is internal-only (`X-Internal-Secret`); browsers never call
  it directly.
- **Task registry**: [`supabase/functions/_shared/ai/taskSpecs.ts`](supabase/functions/_shared/ai/taskSpecs.ts)
  maps job types to prompt builders — `copy_generation`,
  `creative_directions`, `expand_content`, `regenerate_single`,
  `website_analysis`, `competitor_analysis`, `account_analysis`,
  `send_report`, `test_prompt`. Adding an AI capability = adding a
  builder there.
- **Prompts**: [`_shared/ai/prompts.ts`](supabase/functions/_shared/ai/prompts.ts)
  is a **verbatim port of Swimm-Copywriting-API's prompts.js** — the
  generation quality lives in those strings; don't reword casually.
  Output schemas: google_ads {keywords, 15 headlines ≤30ch, 10
  descriptions ≤90ch, EXACTLY 50 signals}, meta {5 primary_text, 5
  headlines ≤25ch}.
- **Provider config is data, not code**: `ai_settings` (per workspace,
  per task) picks anthropic / openai / collaboration plus
  generator+reviewer models. Editable in Settings → AI. Never hardcode
  model IDs in functions.
- **Skills**: the `skills` table holds markdown guidelines injected into
  system prompts as "LEARNED GUIDELINE" blocks (Settings → Skills,
  `applies_to` selects tasks; empty = all).
- **Scheduling**: pg_cron → `cron-dispatch` (internal secret). Jobs:
  daily 06:00 UTC `refresh_all` (Meta → campaigns +
  `campaign_metrics_daily` history), Mon 07:00 `analysis_all`
  (account_analysis → `suggestions` + connector ping), daily 07:00
  `reports_due` (due `report_settings` → send_report). On login, a
  once-per-session staleness check (`src/workspace/useStaleRefresh.ts`)
  refreshes clients whose data is >12h old. Reads always come from
  Supabase; Meta is only hit on refresh.
- **Connectors**: `workspace_connectors` (Resend from-address + Slack
  webhook; owner-only RLS — the webhook is a credential). Senders in
  `_shared/notify.ts`; every attempt logs to `notification_log`.
- **Saved generations**: Ad Studio's "Save as draft/final" writes the brief +
  copy to the `generations` table ([`LiveAdStudio.tsx`](src/views/ad-studio/LiveAdStudio.tsx),
  insert then update the same row). A **Saved generations** list at the top of
  Ad Studio (per client, `updated_at desc`) reopens a row back into the composer
  (toggles Reopen/Close without deleting), or deletes it. `PublishPanel` and the
  publish Edge Function both key off the saved row's `id`.
- **Publish (2B)**: `publish-meta-ad` creates campaign/adset/creative/ad
  from a saved generation — **always status=PAUSED**, audit trail in
  `ad_publishes`. External client accounts need `ads_management`
  Advanced Access (Meta App Review); a System User token on your own BM
  works without review.

### Secrets checklist (per environment)

- Edge Function secrets: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
  `RESEND_API_KEY`, `INTERNAL_FN_SECRET`.
- Vault secrets (for pg_cron): `canopy_functions_url`
  (`https://<ref>.supabase.co/functions/v1`) and
  `canopy_internal_fn_secret` (must equal `INTERNAL_FN_SECRET`).
- Until these exist, cron runs error harmlessly in
  `cron.job_run_details` and the AI tabs surface "not configured"
  errors.

## Website scraper

[`scrape-client`](supabase/functions/scrape-client/index.ts) discovers + fetches
a client's own site (and, tagged with a `competitor_id`, competitor sites) into
`scraped_pages` + `scraped_domains`. Ported from
`Swimm-Copywriting-API/server/routes/assets.js`. The stored page text is
**persisted and reused** — the AI jobs (`website_analysis`, `copy_generation`,
`creative_directions`, `competitor_analysis`) read it back from Postgres; Meta is
never re-fetched for content. Two run modes on the same function:

- **Discovery (default).** Body `{ client_id, url }`. robots.txt/sitemap → same-
  domain link crawl → `rankUrls` (homepage/about/services first) → cap at
  `max_pages` (default 8, max 20) → fetch/parse with cheerio → upsert on
  `(client_id, url, competitor_id)`. Non-destructive: a failed re-scrape never
  wipes prior content. Also mines homepage design signals (palette/fonts/logo)
  onto the domain row.
- **Add-mode (incremental).** Body `{ client_id, url, urls: string[] }`. When
  `urls` is present, discovery/ranking are **skipped** — exactly those same-
  domain URLs are (re)scraped, existing pages left untouched, so a member can add
  a few individual pages without a full re-crawl. Matching is www-insensitive
  (`sameSite`) and each URL's host/protocol is normalized to the client's
  canonical domain before storing, so an added `www.` URL groups + counts with
  the rest of the site instead of stranding under a separate host. Design signals
  are **not** re-mined (adding a subpage shouldn't clobber the homepage
  palette/logo). Own-site only; ignored for competitor scrapes.

**Per-page controls** (own-site pages, [`ScrapedPagesTab`](src/views/client-detail/ScrapedPagesTab.tsx)).
`scraped_pages` carries two member-editable columns, written via
membership-checked `SECURITY DEFINER` RPCs (same pattern as
`set_campaign_strategy` — the table is otherwise service-role-write-only):

- `excluded` (`set_scraped_page_exclusion(page_id, mode)`): `'none'` (active),
  `'scrape'` (skip re-scraping but **keep** the last recorded content for the
  AI), `'all'` (skip re-scraping **and** withhold content from the AI). The
  discovery crawl filters out `'scrape'`/`'all'` URLs; the AI reads in
  `taskSpecs.ts` add `.neq('excluded', 'all')`.
- `content_edited` + `set_scraped_page_content(page_id, content)`: the Words
  count opens a text editor; saving recomputes `word_count`, flags the row, and
  future re-scrapes preserve the hand-edited text (the discovery crawl also skips
  `content_edited` rows). Explicit add-mode re-scraping of a URL **re-activates**
  it (clears `excluded` + `content_edited`).

Domain-row `pages_indexed` reflects the domain's true total for own-site scrapes
(so adds accumulate) rather than just the last run's count; `pages_discovered`
never shrinks. Deploy touches: `scrape-client` (add-mode + exclusion-aware
crawl) and `run-job` (the `excluded='all'` filter).

**Multi-location detection.** Discovery scrapes record raw material on the
domain row — `nav_links` (same-site anchors + text from the *unstripped*
homepage, where "Select a Park"-style pickers live) and `discovered_urls`
(sitemap/crawl set, capped at 300). The UI chains a `location_detection` AI
job after every own-site scrape (ScrapedPagesTab + onboarding), and the
Locations tab has a manual "Detect locations" button (useJobRunner) that
re-classifies the last scrape's link data on demand: the LLM
separates location pages (`/asheville`) from look-alike generic pages
(`/birthdays` — URL shape alone can't tell them apart, which is why it's an
LLM call, not a scraper regex) and its finalize stages **new** finds in
`location_suggestions` (unique `(client_id, url)`; dismissed rows are never
resurrected — dedup is www-/trailing-slash-insensitive). The Locations tab
shows pending suggestions as a confirm banner: adding creates the `locations`
row (with `url`) and fire-and-forgets an add-mode scrape of the location URL
plus up to 4 already-discovered subpages, tagged via the new
`scraped_pages.location_id` (add-mode + own-site only; a plain add-pages run
never strips an existing tag). The Add/Edit Location form has a URL field that
triggers the same tagged scrape. Location-scoped AI jobs
(`scrapedContentSection`) read that location's tagged pages first, topped up
with site-wide (`location_id is null`) pages. Bot-walled sites (e.g.
glominigolf.com behind Cloudflare) can't be scraped at all, so detection can't
see them — locations there are added manually and their pages stay unscraped
until bot-protection handling exists. Migration:
`20260707120000_location_detection.sql` (also extends the `ai_settings` task
check constraint). Deploy touches: `scrape-client`, `enqueue-job`, `run-job`,
`cron-dispatch` (all import the shared `taskSpecs.ts`).

## Content planner (Content Calendar)

The live Content Calendar ([`LiveCalendar.tsx`](src/views/calendar/LiveCalendar.tsx),
`/dev` keeps the wireframe) plans **organic** FB/IG posts on the same jobs
pipeline as Ad Studio. A `content_plan` job takes a brief (objective,
channels, date range, cadence 1–7 posts/week) and writes one `content_plans`
row + one `content_posts` row per slot. Key decisions:

- **Slot dates are computed in the builder** (`CADENCE_WEEKDAYS` in
  `taskSpecs.ts`), never by the LLM — the model fills exactly the provided
  slots and finalize drops any invented/duplicate dates. Capped at 31 slots
  per job (`llmOptions.maxTokens` is raised to 16k for the big JSON).
- **Per-platform captions** (`caption_fb` / `caption_ig`) per the Meta
  publishing research below — FB and IG are separate API calls with
  independent copy; the review step checks they aren't copies.
- **`scheduled_date` (date) + `scheduled_time` (time) are separate columns**
  on purpose: the calendar groups by civil date; composing a real timestamptz
  with the client's timezone is the future publish phase's job.
- Post status vocabulary already reserves the publish phase's states:
  `draft → approved` are reachable today; `scheduled / published / failed`
  arrive with the future `publish-meta-post` + pg_cron work.
- Each post carries an `image_prompt`; **image generation is a later phase**
  but its provider config already exists: ai_settings task
  `image_generation`, provider `xai` (the default, Settings → AI panel) or
  `openai` — the migration extended the mode/primary_provider checks with
  `'xai'`. Never hardcode an image model in function code.
- Members edit posts directly from the browser (generations-style RLS);
  the job's finalize writes with the service role.

Migration: `20260709130000_content_plans.sql`. Deploy touches:
`enqueue-job`, `run-job`, `cron-dispatch` (shared `taskSpecs.ts`).

## Asset library

Client uploads (logos / photos / videos / docs) live in a **public** Supabase
Storage bucket `client-assets`, one path prefix per client
(`<client_id>/<uuid>-<file>`), with an `assets` metadata row per file. The
browser uploads directly via `supabase.storage` and inserts the row — no Edge
Function. [`AssetsTab`](src/views/client-detail/AssetsTab.tsx) branches on
`useWorkspace()`: live upload-backed grid vs. the `/dev` wireframe (mock
`listAssetsForClient`). Migration: `20260706180000_assets.sql`.

- **Public bucket on purpose:** objects get stable public URLs so a logo renders
  app-wide and can be passed to Meta as `image_url` on publish. Storage RLS still
  gates **writes/deletes** to workspace members of the client owning the path's
  first segment (`(storage.foldername(name))[1]`); the `assets` table has the
  usual member RLS (read/insert/update/delete). Inserts that fail roll back the
  orphaned object so storage + table stay in sync.
- **Set as client logo:** on an image asset, writes `brand_profiles.logo_url =
  asset.url` and sets `edited_fields.logo_url = true` (member RLS allows the
  upsert directly — no RPC), so `website_analysis`'s `finalize` skips overwriting
  it. Also tags that row `kind = 'Logo'`. The "Logo" badge marks whichever asset
  URL matches `brand_profiles.logo_url` — the same field the client/location
  avatars already fall back to.

## Meta refresh & metrics

[`meta-refresh-client`](supabase/functions/meta-refresh-client/index.ts) pulls
campaigns / ad sets / ads from the Meta Marketing API into the `campaigns`,
`ad_sets`, `ads` tables. Before touching it:

- **All calls are account-level and batched.** One paginated list call per
  level (`/act_/campaigns|adsets|ads`) + account-level `/insights?level=…`
  keyed by node id — **not** one call per campaign/ad set. The old per-node
  fan-out tripped Meta's per-account rate limit on large accounts, and backoff
  can't absorb minutes-long limit windows inside the ~150s function budget.
  `metaFetch` adds a short rate-limit retry as a backstop. Keep it
  account-level; don't reintroduce per-node loops.
- **Multi-period.** Campaign insights are fetched for `this_month`,
  `last_month`, and `last_30d` and stored on `campaigns.metrics_by_period`
  (`{ period: { spend, impressions, …, roas, actions: {action_type: count} } }`).
  Flat `mtd_*` columns stay for compatibility. Conversions live in the action
  map under Meta's many synonyms — **purchases are usually `omni_purchase`,
  not `purchase`**; `extractPrimaryAction` (backend) and the frontend catalog
  resolve the variants.
- Request body: `{ client_id, ad_account_id?, location_id?, backfill? }`.
  `ad_account_id` scopes the refresh to a single account (validated against the
  client's own configured accounts); omit it to refresh every account under the
  client.
- **Historical backfill.** `backfill: { since, until }` (YYYY-MM-DD) switches the
  function to a history-only path: it does **not** touch the `campaigns`
  snapshot. It pulls per-day campaign insights (`time_range` + `time_increment=1`,
  chunked by calendar month via `monthChunks` so each account-level call stays
  small) and upserts rows into `campaign_metrics_daily` — idempotent via
  `unique(campaign_id, date)`, so users can pull past periods (this year / last
  year) for comparison without a full refresh or clobbering today's numbers. The
  range is clamped to Meta's ~37-month insights retention. Triggered from the
  **Ad Accounts** tab's "Pull past data" card. Daily rows (nightly + backfill)
  now also carry `revenue`/`roas` in the `metrics` jsonb so custom ranges have
  ROAS. Backfill filters day-rows to `campaign_id`s that still exist in
  `campaigns` before upsert — historical insights reference since-**deleted**
  campaigns whose ids would violate the `campaign_metrics_daily` FK and abort the
  batch; those are skipped and the count is surfaced in the result banner.

**Metric display is data-driven** — [`src/lib/metaMetrics.ts`](src/lib/metaMetrics.ts).
`normalizeCampaign` / `aggregate` turn rows into a period-aware `Norm` (ratios
and cost-per are recomputed from totals, never averaged); `METRICS` is the
catalog and `metricsFor(rows, period)` also **auto-discovers every action type
present** in the data (custom conversions included) as selectable metrics. The
campaigns table and client Overview render user-chosen columns/cards through
`MetricPicker` (selection persisted in localStorage). **Adding a metric = add a
`MetricDef` to `METRICS`** — the picker and both views pick it up automatically.
The Overview period toggle also has a **Custom** option: it aggregates
`campaign_metrics_daily` over an arbitrary date range via `aggregateDaily`
(→ same `Norm`, same catalog; reach/frequency are non-additive across days so
they're hidden in this mode) and drives the spend chart from the same rows.

**Editable strategy.** `strategy` is auto-derived from the campaign name /
objective on every refresh. A user override is saved via the
`set_campaign_strategy(campaign_id, strategy)` RPC (SECURITY DEFINER,
membership-checked, only touches strategy) which sets
`campaigns.strategy_custom = true`; the refresh then preserves that row's
strategy instead of re-deriving it.

**config.toml gotcha:** `cron-dispatch` must have `verify_jwt = false` — it's
invoked only by pg_cron, which sends `X-Internal-Secret` but no JWT-shaped
`Authorization` header, so the gateway would 401 it otherwise. `isInternalCall`
is the real gate. Sibling functions invoked via `invokeInternal` pass a
service-role Bearer, so they keep `verify_jwt = true`.

## Useful commands

```bash
# Dev
npm run dev                        # localhost:5173
npm run build                      # type-check + bundle
npm run typecheck                  # tsc --noEmit

# Local Supabase
supabase start / stop / status
supabase db reset                  # re-apply migrations + seed (local)
supabase migration new <slug>
docker exec supabase_db_canopystudio psql -U postgres -c '...'

# Hosted Supabase (linked to project iklouyjenajyagccymaj)
supabase db push                                       # migrations
supabase functions deploy [<name>]                     # deploy fn(s); no Docker needed
supabase db query --linked --file supabase/seed.sql    # seed
supabase db query --linked --output table 'select ...' # ad-hoc (works when the Supabase MCP is down)

# Smoke-test an Edge Function via the internal path (no browser session).
# The gateway needs a JWT-shaped Authorization header (verify_jwt); the code
# trusts X-Internal-Secret. ANON_JWT = the legacy anon key; must match INTERNAL_FN_SECRET.
curl -s -X POST "https://<ref>.supabase.co/functions/v1/meta-refresh-client" \
  -H "Authorization: Bearer $ANON_JWT" \
  -H "X-Internal-Secret: $INTERNAL_FN_SECRET" \
  -d '{"client_id":"..."}'
```

## Meta publishing features (confirmed API-capable)

Four features confirmed viable against the Meta Graph API (researched April
2026). These extend the live-flow plan and should be built after step 6.

### 1. Per-platform captions with separate account tags
**Build it.** FB and IG are entirely separate API calls (`POST /{page_id}/feed`
and `POST /{ig_user_id}/media`) with independent `message`/`caption` fields.
The UI needs two caption inputs when both channels are selected — one for FB,
one for IG. Store as `captionFb` / `captionIg` on the post record (the current
`QueuedPost` type has a single implicit caption; split it). Each caption can
tag the platform-appropriate page handle independently.

### 2. Auto-publish to Stories
**Build it — with a clear UI caveat.** Both Instagram and Facebook Stories
publish fully server-side via the Graph API with no user interaction required.
IG: `POST /{ig_user_id}/media` with `media_type=STORIES`, then
`POST /{ig_user_id}/media_publish`. FB: `POST /{page_id}/photo_stories` or
`/{page_id}/video_stories`.

Add `'Story'` to the `fmt` union in `types.ts` (`'Post' | 'Reel' | 'Carousel' | 'Story'`).

**Hard limit — surface in the UI:** Interactive stickers (polls, link stickers,
hashtag stickers) cannot be added via any Meta API — this applies to all
third-party tools, not just us. Plain image/video Stories auto-publish fine.
Show a persistent notice on the Story composer: "Polls and link stickers must
be added manually in the Instagram app after publishing."

### 3. Location tagging (Meta canonical place names)
**Build it — with a search-and-confirm flow.** Pass a `location_id` (a
Facebook Page ID with lat/lng data) to the IG media endpoint. Populate via
Pages Search: `GET /pages/search?q={text}&fields=id,name,location`.

**Key caveat to design around:** Meta's Instagram-native place-search endpoint
was deprecated in 2020 with no replacement. The name that appears on the post
is the Facebook Page's name, which may differ from what the user typed (e.g.
searching "Bridgehampton, NY" may return a page named "Bridgehampton Long
Island"). Always show the user the exact name that will appear before they
confirm — never silently use the first result.

**Second caveat:** `location_id` is not supported on Carousel posts — only
single image/video posts and Reels. Disable the location field when format is
Carousel and show a tooltip explaining why.

Permissions needed: `Page Public Metadata Access` feature (requires App
Review).

### 4. Multi-image carousel upload
**Build it.** The API supports carousels up to 10 items. The flow is N+1
calls — one `POST /{ig_user_id}/media` per image (with `is_carousel_item=true`
and `image_url`), then one carousel-container call listing the child IDs, then
`media_publish`. Fire the per-image calls in parallel; assemble the container
once all IDs return. From the user's perspective this should be a single
multi-file picker (drag-and-drop, select multiple) — the sequential API calls
are invisible.

Hard limits to enforce in the UI: max 10 images, all images crop to the first
image's aspect ratio (warn the user), and location tags are not available on
carousels (see feature 3 above).

The current `QueuedPost.fmt` of `'Carousel'` is already in the type system;
the missing piece is a `carouselImages: string[]` field on the post record.

### App Review requirement (all four features)
All four require Advanced Access + Meta App Review once the app serves
external clients (not just accounts you own). Plan for a 2–4 week review
window. The relevant permissions are:
- `pages_manage_posts` + `pages_read_engagement` — Facebook posting
- `instagram_business_content_publish` + `instagram_business_basic` — IG posting + Stories
- `Page Public Metadata Access` feature — location search

## Don't

- Don't import from `src/data/mock.ts` in views. Always use
  `useQuery(p => p.method())`.
- Don't write fixture data inline in view files. New seed data → into
  `mock.ts` (and a `migrations/` insert when there's a corresponding
  table).
- Don't disable RLS to "make it work." If a query fails, fix the
  policy or query, not the safety net.
- Don't commit `.env.local`. Anything sensitive (`SUPABASE_DB_PASSWORD`)
  belongs there.
- Don't edit `wireframes/`. They're the design reference; Claude Design
  may overwrite.
