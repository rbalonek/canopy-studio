-- Meta OAuth (Facebook Login for Business) replaces manual token paste as
-- the primary connect path. Tokens still land in the EXISTING credential
-- tables (workspace_meta_credentials / client_meta_credentials) so the
-- Edge Functions' resolveAccessToken order is untouched; manual System
-- User paste stays as the advanced fallback (those tokens never expire).

-- Single-use, short-TTL state rows gate the OAuth callback (which must be
-- verify_jwt = false — the browser arrives from facebook.com with no JWT).
-- Service-role only: RLS on, zero policies.
create table if not exists oauth_states (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  client_id    text references clients(id) on delete cascade,
  provider     text not null default 'meta' check (provider in ('meta', 'google')),
  -- Where to send the browser after the exchange (the Settings page that
  -- started the flow). Captured at start; callback appends ?meta=… to it.
  return_to    text,
  created_by   uuid not null,
  created_at   timestamptz not null default now()
);

alter table oauth_states enable row level security;

-- OAuth tokens expire (long-lived user tokens ≈ 60 days) — System User
-- tokens don't, and leave this null.
alter table workspace_meta_credentials add column if not exists expires_at timestamptz;
alter table client_meta_credentials    add column if not exists expires_at timestamptz;

-- Meta's required Data Deletion Request callback records every request it
-- receives; the confirmation code is returned to Meta and shown to the
-- user on /legal/data-deletion. Service-role only.
create table if not exists deletion_requests (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null default 'meta',
  provider_user_id  text,
  confirmation_code text not null,
  status            text not null default 'received'
                    check (status in ('received', 'completed')),
  created_at        timestamptz not null default now()
);

alter table deletion_requests enable row level security;
