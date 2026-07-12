# CanopyStudio Roadmap — to fully-live product

Tracks the path off all template/sample surfaces and onto real auth, payments,
approvals, and Google Ads. **How to use this file:**

- Every feature commit that completes an item flips its `- [ ]` to `- [x]`
  **in the same commit** — git history is the progress record.
- External/manual steps carry a `Status:` line — update it as things move
  (e.g. `Status: submitted 2026-07-14, awaiting review`).
- Full design rationale (schemas, flows, decisions) lives in the plan this was
  cut from; the checklists here are the execution surface. Future sessions:
  check this file for current phase before starting roadmap work.

**Locked decisions:** email + Google sign-in now, Facebook Login later (rides
the Meta App Review) · Google Ads reporting-first · legal pages public on
`.app` · Stripe for payments (USD credit ledger; margin in per-event billed
price) · BYO provider keys per workspace · per-client/agency profile docs ·
one-click Approve→Publish (ads always PAUSED; organic posts confirm-first).

---

## Phase 0 — External account kickoffs (no code, start immediately)

- [ ] **Stripe**: create account, complete business/bank verification (1–3 days).
      Status: not started
- [ ] **Meta**: create production Meta App (type Business), add Facebook Login
      for Business product.
      Status: not started
- [ ] **Meta**: start Business Verification on the owning Business Manager
      (prereq for Advanced Access; days–2 weeks, runs *before* the 2–4 week
      App Review).
      Status: not started
- [ ] **Google Cloud**: create project, OAuth consent screen (External),
      verify `.app` domain ownership.
      Status: not started
- [ ] **Google Cloud**: two OAuth clients — (1) Supabase Google sign-in
      (redirect `https://<ref>.supabase.co/auth/v1/callback`), (2) Google Ads
      connect (redirect = `google-oauth` Edge Function URL).
      Status: not started
- [ ] **Google Ads**: apply for developer token Basic Access from an MCC
      account (API Center). Test accounts work instantly meanwhile.
      Status: not started

## Phase 1 — Legal pages, login cleanup, Google sign-in

- [x] `src/views/legal/` — `LegalLayout.tsx` (public shell) + `Privacy.tsx`,
      `Terms.tsx`, `DataDeletion.tsx`. Privacy covers Meta Platform Data
      handling/retention/deletion **and** the Google API Services User Data
      Policy Limited Use disclosure (verbatim phrase). DataDeletion documents
      the Phase 4 callback. Terms include AI-content disclaimer + payment
      placeholder. *Owner to skim; contact address is
      support@canopystudio.app — create the mailbox or change it.*
- [x] `src/App.tsx` — `/legal/*` routes outside the auth gates.
- [x] `src/views/Login.tsx` — strip "Redwood Digital Strategies" branding +
      fake testimonial; real links to `/legal/terms` + `/legal/privacy`; hide
      azure/apple buttons until configured.
- [x] README quick pass — remove stale "/app not yet" claim.
- [ ] Manual: enable Google provider in Supabase dashboard, production Site
      URL + redirect allow-list.
      Status: not started — needs the Phase 0 Google OAuth client id/secret
- [ ] Manual: add legal URLs to Meta app settings + Google consent screen.
      Status: pages built; blocked on production deploy + Phase 0 apps existing

## Phase 2 — Profile docs + BYO provider keys

### 2a. Per-client / per-agency profile docs
- [x] Migration `profile_docs` (one doc per entity: `client_id` null =
      agency-level; `unique nulls not distinct (workspace_id, client_id)`;
      member-CRUD RLS like `skills`).
- [x] `_shared/ai/orchestrator.ts` `loadProfiles()` + `_shared/ai/prompts.ts`
      `profileBlock()` (`## AGENCY PROFILE` / `## CLIENT PROFILE`); appended
      after `skillsBlock` in every `taskSpecs.ts` builder that loads skills
      (all 10 + the shared generation scope). Deploy: `enqueue-job`,
      `run-job`, `cron-dispatch`.
- [x] UI: ClientDetail "Profile" tab + agency doc card in Settings →
      workspace, both via the shared `ProfileDocEditor` (direct-supabase
      CRUD like SkillsTab — no provider changes needed).

### 2b. BYO API keys
- [x] Migration `workspace_api_keys` (`(workspace_id, provider)` PK,
      anthropic/openai/xai; member SELECT never reads `api_key`, owner-only
      writes — `workspace_meta_credentials` pattern).
- [x] `_shared/ai/providers.ts` — `apiKey?` on LlmOptions with env fallback;
      `keySource: 'workspace' | 'platform'` on `LlmResult`; orchestrator loads
      workspace keys once per step and threads them to all four callLlm
      sites. Same resolution in `generate-post-image` (xai/openai).
- [x] UI: Settings → **api** tab is `ApiKeysPanel.tsx` (set/replace/remove,
      owner-only writes, key never SELECTed back).

## Phase 3 — Stripe billing: credit ledger, plans, webhooks

Ledger in USD credits; `billed_usd = max(taskFloor, rateCard × 2.0)` (+$0.13
surcharge over $0.50 raw; floors $0.13 generation / $0.10 analysis; images
flat ~$0.20; BYO-key events 10% of rate-card, no floor).

- [x] Migration `billing_core`: `billing_accounts`, `credit_ledger`
      (append-only, trigger-maintained balance cache — trigger verified
      locally), `stripe_events` (webhook idempotency),
      `ai_usage_events.billed_usd` + `key_source` columns, daily
      `canopy-billing-cycle` pg_cron. Member read; all writes service-role.
- [x] `usage.ts`: `billedUsd()` (×2 markup, $0.13/$0.10 floors, +$0.13
      surcharge >$0.50 raw, BYO = 10% fee no floor) + ledger debit in
      `recordUsage`; leaks fixed — grok chat rates, flat image rates, and
      `recordImageUsage` in `generate-post-image`.
- [x] Edge Function `stripe-webhook` (`verify_jwt=false`, raw-fetch HMAC
      Stripe-Signature gate — no SDK): `checkout.session.completed` (topup),
      `invoice.paid` (grant / postpaid clear), `customer.subscription.*`
      (plan sync); idempotent via `stripe_events`, failed handlers release
      the idempotency row so Stripe retries.
- [x] Edge Function `billing-portal` (authed, owner-gated): Checkout
      subscribe/top-up + Billing Portal sessions; never writes the ledger.
- [x] Friends & family: monthly-1st + −$25-threshold invoicing in new
      internal `billing-cycle` function (cron-dispatch task
      `billing_cycle`); `invoice.paid` webhook posts `postpaid_invoice`.
- [x] Enforcement: `enqueue-job` + `generate-post-image` return 402 via
      `billingBlockReason` (prepaid ≤ $0; friends & family ≤ −$50; **no
      `billing_accounts` row = billing not enabled = never blocked**, so
      existing workspaces are unaffected until they subscribe — replaces
      the planned create_workspace trial grant).
- [x] UI: `BillingPanel.tsx` in Settings → billing (plan, balance, usage
      this month, ledger table, Subscribe/Upgrade/Add credits/Portal).
- [ ] Manual: Stripe Products/Prices (starter, pro, ff-$0), webhook endpoint,
      `supabase secrets set STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET` + price ids.
      Status: blocked on Phase 0 Stripe verification
- [ ] Finalize Terms payment language.

## Phase 4 — Meta OAuth, data-deletion callback, App Review, FB sign-in

Tokens land in existing credential tables; `resolveAccessToken` untouched;
manual System-User paste stays as an "Advanced" option.

- [x] Migration `meta_oauth`: `oauth_states` (service-role only, single-use,
      `provider` column reused by Google, `return_to` for the redirect
      home), `expires_at` on `workspace_meta_credentials` +
      `client_meta_credentials`, `deletion_requests` table.
- [x] Edge Function `meta-oauth`: POST start (authed/owner, per-client via
      `client_id`) → FB Login for Business dialog URL (uses
      `FB_LOGIN_CONFIG_ID` when set, scope-list fallback); GET callback
      (`verify_jwt=false`, claim-and-delete state row, 10-min TTL) →
      long-lived token exchange → upsert into the existing credential
      tables → 302 back with `?meta=connected|error`.
- [x] Edge Function `meta-data-deletion` (`verify_jwt=false`,
      `signed_request` HMAC verification) → `deletion_requests` +
      confirmation URL/code response.
- [x] UI: "Connect with Facebook" in `WorkspaceMetaPanel` (+ callback
      result banner + ≤7-day expiry warning) and per-client in
      `AdAccountsTab`'s override panel; manual token paste demoted to the
      advanced path. Daily cron warns owners via connectors when an OAuth
      token is ≤7 days from expiry.
- [x] `'facebook'` added to the `OAuthProvider` union; the Login button
      ships when the provider is enabled in the Supabase dashboard (a
      listed-but-disabled provider just errors on click).
- [x] `config.toml`: `verify_jwt=false` for `meta-oauth`, `meta-data-deletion`.
- [ ] Manual: Meta app redirect URI + Data Deletion Callback URL + legal URLs.
      Status: blocked on Phase 1
- [ ] Manual: **App Review** — `pages_manage_posts`, `pages_read_engagement`,
      `instagram_business_content_publish`, `instagram_business_basic`,
      `ads_management`, `business_management`, Page Public Metadata Access,
      `email`/`public_profile`. Screencasts: OAuth connect, post publish,
      PAUSED ad creation. 2–4 weeks after Business Verification.
      Status: blocked on Business Verification + working OAuth flow

## Phase 5 — Approvals live + Publishing Queue live

Pure composition over `publish-meta-post` / `publish-meta-ad` — no new tables
or functions.

- [x] Data access: direct-supabase in the live views (SkillsTab/LiveCalendar
      convention) — provider methods unnecessary; shared `invokeErrorText`
      helper extracted to `src/lib/invokeError.ts`.
- [x] `Approvals.tsx` live branch (`approvals/LiveApprovals.tsx`): draft
      `content_posts` (Approve / Approve & Schedule / **Approve & Post now**
      with per-item confirm — organic has no paused state); draft
      `generations` (**Publish to Meta (paused)** with inline daily budget —
      single-click safe, ads always created PAUSED); `content_plans` bulk
      approve (status flip only). Per-row results; one failure never blocks
      the rest.
- [x] `Publish.tsx` live branch (`publish/LivePublishQueue.tsx`):
      scheduled posts (FB-native vs IG-cron badges, Cancel), failed posts
      (error shown, deliberate Re-approve instead of one-click retry),
      merged `post_publishes`/`ad_publishes` activity table.
- [x] `src/routes.ts`: `live: true` on `approvals` + `publish`.

## Phase 6 — Google Ads reporting

One table set with a `platform` column (display layer is already
platform-agnostic); Google campaign ids prefixed `gads_<id>`.

- [x] Migration `google_ads_reporting`: `platform` column on `campaigns`,
      `ad_sets`, `ads`, `campaign_metrics_daily`;
      `workspace_google_credentials` (owner-only, refresh token +
      `login_customer_id`); `google_customer_id` on `locations` + `clients`.
- [x] Edge Function `google-oauth` (clone of `meta-oauth`, `provider='google'`,
      `access_type=offline&prompt=consent`, scope `adwords`;
      `verify_jwt=false` on the GET callback).
- [x] Edge Function `google-ads-refresh` mirroring `meta-refresh-client`:
      account-level `searchStream` GAQL only (never per-campaign), campaign
      snapshot with `metrics_by_period` (this_month/last_month/last_30d) +
      month-chunked idempotent daily backfill with missing-campaign
      filtering. Ids stored `gads_<id>`. **Untestable until the developer
      token + a connected account exist — first real pull will need a
      debugging pass.** Ad-group/ad-level ingestion deferred until campaign
      reporting is validated (empty drill-downs are handled by the UI).
      Secrets: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_OAUTH_CLIENT_ID/SECRET`.
- [x] `cron-dispatch` `refresh_all` fans out to `google-ads-refresh` for
      clients with a client- or location-level `google_customer_id`.
- [x] UI: `WorkspaceGooglePanel.tsx` connect card in Settings → connections
      (Google Ads removed from "coming soon"); Google customer-id field +
      "Refresh now" on `AdAccountsTab`. Platform filter chips on campaign
      lists/Overview deferred to Phase 7 polish (google rows flow through
      the same tables/catalog already).
- [ ] Manual: `adwords`-scope OAuth verification — submit demo video the day
      the connect flow works on a test account (4–6 weeks; longest external
      item).
      Status: blocked on connect flow demo

## Phase 7 — Surface completion + docs

- [x] `AdPerf.tsx` live branch (`adperf/LiveAdPerf.tsx`): cross-client
      campaign leaderboard + per-client subtotals + workspace total via
      `metaMetrics.ts`, period toggle, client filter, platform chips.
- [x] `BrandIntelligence.tsx` live branch (`brand/LiveBrand.tsx`): client
      picker over the existing live per-client tabs (BrandTab,
      CompetitorsTab, ScrapedPagesTab, AssetsTab). Cross-client rollups
      (rules/compare/gaps) stay /dev-only until they earn a live port.
- [x] Settings → team: roster via `list_workspace_members` RPC, owner-only
      role change/remove RPCs, invite-by-email with accept-on-login
      (`accept_workspace_invites` runs before the workspace list loads).
      No invite email sent yet — UI says so.
- [x] Settings → notifications + excluded accounts: cut from live TABS.
- [x] `Overview.tsx`: replaced wholesale with `overview/LiveOverview.tsx`
      for the live app — working period toggle (Yesterday/7d/MTD/30d/90d)
      over `campaign_metrics_daily` via `aggregateDaily`, real KPI
      sparklines + spend-over-time chart (no seeds), wired counts row,
      computed "Needs attention" alerts (failed posts, expiring token,
      budget overpace, spend-without-results — the `urgent_issues`
      fixture is gone from live), **Monthly spend vs budget** pacing card
      (`clients.monthly_budget`, inline-editable, month-end projection),
      and the AI suggestions panel moved below the chart, collapsible
      ("Ack" renamed to "Mark seen"). The /dev wireframe keeps the mock
      composition.
- [ ] `Clients.tsx`: same treatment for its residual `client_perf`
      placeholder fields (smaller surface; next pass).
- [x] README + CLAUDE.md refresh: live-state summary, billing ledger
      section, OAuth-connections section, secrets checklist
      (`STRIPE_*`, `FB_APP_*`, `GOOGLE_*`), `verify_jwt=false` gate
      inventory.

---

## External dependency ladder

| Blocker | Started | Needed by | Lead time |
|---|---|---|---|
| Stripe verification | Phase 0 | Phase 3 | days |
| Meta Business Verification → App Review | Phase 0 / submit Phase 4 | external-client publishing, FB sign-in | 2–6 weeks total |
| Google OAuth brand review (sign-in) | Phase 0 | Phase 1 | days |
| Google Ads developer token (Basic) | Phase 0 | Phase 6 prod | days–weeks |
| Google `adwords` scope verification | early Phase 6 | Phase 6 GA | 4–6 weeks |
| Public legal pages | Phase 1 | all three reviews | — |

## Cross-cutting conventions

- Every new browser `functions.invoke` keeps the `error.context` unwrap.
- Every new `verify_jwt=false` function has a real gate (Stripe signature /
  single-use `oauth_states` row / `signed_request` verification) — the
  `cron-dispatch` precedent.
- New credential tables copy `workspace_meta_credentials`: member SELECT that
  never reads the secret column, owner-only writes, service-role reads in
  Edge Functions.
- Never hardcode model ids; pricing constants live in `usage.ts` until a
  table earns its keep.
