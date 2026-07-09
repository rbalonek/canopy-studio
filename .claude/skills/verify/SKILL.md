---
name: verify
description: Drive the live /app UI end-to-end against the LOCAL Supabase stack (auth, workspace, AI jobs) without touching hosted. Use to verify feature changes at the browser surface.
---

# Verifying CanopyStudio changes locally

`.env.local` points the app at **hosted** Supabase (real accounts — don't
drive that). Verify against the **local** stack instead; the whole rig is
disposable.

## Recipe that works

1. **Local stack** (needs Docker Desktop running — `open -a Docker` and
   wait for `docker info`):
   ```bash
   supabase start && supabase db reset     # migrations + seed
   eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
   ```

2. **Edge Functions** (needed for anything on the jobs pipeline). Env file
   in the scratchpad — an Anthropic key exists in
   `~/code/projects/ad-optimizer/server/.env`; `INTERNAL_FN_SECRET` can be
   any string locally (invokeInternal sends the auto-injected service key
   for the gateway; the secret is what the code checks):
   ```bash
   printf 'ANTHROPIC_API_KEY=%s\nINTERNAL_FN_SECRET=local-verify\n' "$KEY" > "$SCRATCH/fn.env"
   supabase functions serve --env-file "$SCRATCH/fn.env"   # background
   ```

3. **Dev server against local** — process env beats `.env.local` in Vite,
   so no file edits (note the key var is `VITE_SUPABASE_PUBLISHABLE_KEY`,
   not `_ANON_KEY`):
   ```bash
   VITE_SUPABASE_URL="$API_URL" VITE_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY" \
     VITE_DATA_PROVIDER=supabase npm run dev -- --port 5199 --strictPort
   ```

4. **Test user + workspace + client** (seed has no workspaces — they're
   runtime-created). Create the user via the auth admin API
   (`POST $API_URL/auth/v1/admin/users` with the service key,
   `email_confirm: true`), then seed rows via psql:
   ```sql
   insert into workspaces (id, name, slug, mode, owner_id) values ('1111…','Verify Co','verify-co','agency','<user-id>');
   insert into workspace_members (workspace_id, user_id, role) values ('1111…','<user-id>','owner');
   -- clients.complete is a SMALLINT (0-100), not boolean
   insert into clients (id, name, industry, workspace_id, website, complete) values ('verify-client','…','…','1111…','https://example.com',100);
   ```

5. **Drive with playwright-core + system Chrome** (no browser download):
   `npm i playwright-core` in the scratchpad, then
   `chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })`.
   Login is plain email/password on `/` (`input[type=email]`,
   `input[type=password]`, `button[type=submit]`), then
   `waitForURL('**/app/<slug>**')` and go straight to any `/app/<slug>/…`
   route.

## Gotchas

- Settings tab labels are lowercase ids capitalized by CSS — locate
  `div.nav-item:has-text("ai")`, not `text=AI`.
- `button:has-text("Approve")` also matches "Approve all" — use exact
  locators near ambiguous button text.
- AI jobs take 15–120s; poll the UI (or the `jobs` row) rather than a
  fixed wait. Keep LLM-driven test inputs small (e.g. a 3-day content
  plan, not 30) — it's a real API call on a real key.
- Multiple statements in one `psql -c` run in ONE transaction — a late
  error rolls back the earlier inserts.

## Cleanup

Delete the test workspace (cascades clients/jobs/plans), delete the auth
user (`delete from auth.users where email='…'` — the admin DELETE
endpoint has been flaky locally), `rm` the fn.env with the key, stop the
two background servers.
