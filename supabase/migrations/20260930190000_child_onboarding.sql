-- Phase 2: child onboarding.
-- preferred_call_time and sleep_time were added in 20260930170000_parent_call_times.sql.

alter table public.parent_profiles
  add column if not exists language text;

comment on column public.parent_profiles.language is 'Starting language for the voice agent, e.g. Hindi.';

-- Existing parents kept their language in facts.language.
update public.parent_profiles
set language = coalesce(nullif(facts->>'language', ''), 'Hindi')
where language is null;

alter table public.parent_profiles
  alter column language set default 'Hindi';

-- Single-use links a child opens to fill the onboarding form.
-- Only a SHA-256 hash of the token is stored; the raw token lives in the link.
create table if not exists public.onboarding_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  used_at timestamptz,
  parent_id uuid references public.parent_profiles(id) on delete set null
);

comment on table public.onboarding_tokens is 'Single-use onboarding links for /onboard/[token]. Accessed server-side with the service role only.';

-- No policies: only the service role (the dashboard API) can read or write.
alter table public.onboarding_tokens enable row level security;
