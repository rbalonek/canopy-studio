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
supabase db query --linked --file supabase/seed.sql    # seed
supabase db query --linked --output table 'select ...' # ad-hoc
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
