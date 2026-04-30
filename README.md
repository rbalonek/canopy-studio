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

Hit `/` — redirects to `/dev`. The full design reference is browseable
under `/dev/*` (Overview, Clients, Ad Studio, Brand Intelligence, etc).

## Routes

- **`/dev/*`** — design reference / wireframe mode. No auth. Reads through
  the `DataProvider` interface — currently the local Supabase by default,
  falls back to in-memory mock for any methods whose tables haven't
  been migrated yet.
- **`/`** — reserved for the live, auth-gated product. Currently just
  redirects to `/dev`. Will become: login → onboarding → `/app/*`.
- **`/app/*`** — (not yet) the live product, mounting the same shell as
  `/dev` but with auth and workspace-scoped reads.

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
│   ├── components/              ← shared primitives (Icon, KPI, AdThumb, …)
│   └── views/                   ← one file per route (sub-folders for tabbed views)
├── supabase/
│   ├── config.toml              ← local stack config
│   ├── migrations/              ← timestamped .sql files; applied in order
│   └── seed.sql                 ← runs on `supabase db reset` (local only)
└── wireframes/                  ← design reference exported from Claude Design.
                                   Treat as source-of-design-truth; may be
                                   overwritten by Claude Design itself.
```

## Meta publishing roadmap

Four publishing features confirmed viable against the Meta Graph API. To be
built after the live-flow steps (auth, workspaces, `/app/*` guard, Meta token
UI) are complete. Full implementation notes are in `CLAUDE.md`.

| Feature | Status | Key caveat |
|---|---|---|
| Per-platform captions (separate FB / IG text + tags) | Planned | Two caption fields needed in the post composer; separate API calls by design |
| Auto-publish to Stories (no phone tap required) | Planned | Interactive stickers (polls, link stickers) cannot be added via API — must be added manually in-app after publish |
| Location tagging via Meta's place search | Planned | Always show the user the exact Meta-canonical place name before confirming — it may differ from what they typed. Not available on carousel posts. |
| Multi-image carousel upload (up to 10 images) | Planned | Single multi-file picker in UI; N+1 API calls happen server-side. Location tags not supported on carousels. |

All four require Meta App Review (Advanced Access) before the app can serve
external clients — plan for a 2–4 week review window.

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
