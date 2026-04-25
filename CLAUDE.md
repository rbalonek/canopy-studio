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

- `/` — redirects to `/dev` for now (will become the live, auth-gated
  flow once steps 2–6 of the live-flow plan land — see below).
- `/dev/*` — design reference, no auth, all 16 wireframe views browsable.
- `/app/*` — not yet. Will mount the same `AppShell` with a different
  prefix and a workspace-scoped data provider.

Routes are **prefix-agnostic**: [`src/routes.ts`](src/routes.ts) stores
relative `subpath` values and the `Sidebar` takes a `prefix` prop. A
shell mounted at `/dev` and a future shell at `/app` share the same
ROUTES table. `routePath(prefix, subpath)` composes URLs.

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

## Live-flow plan (in progress)

Six-step plan agreed with the user (we're partway through):

1. **Route split — DONE** (commit `d0059b8`). All current views moved
   under `/dev/*`. `/` redirects to `/dev` for now.
2. **Workspaces schema** — second migration adding `profiles`,
   `workspaces`, `workspace_members`, `clients.workspace_id`. RLS
   flips from "anon read all" to "auth user reads own workspace."
3. **Supabase auth wiring** — auth context, `/login` actually
   authenticates. The existing `Auth` view becomes the real form.
4. **Onboarding persistence** — the wizard writes the workspace +
   first client.
5. **`/app/*` auth guard** — gates the live product on auth + workspace.
   Reads scoped to user's workspace via RLS.
6. **META manual-token UI** — Settings → Connections gets a paste-token
   field while META OAuth approval is pending; replace with real OAuth
   later.

`/dev` should keep working through all of this — it stays on the mock
provider (cleanest) so the showroom doesn't depend on the live schema.

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
