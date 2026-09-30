-- Phase 3: progressive memory.
-- memory_events (append-only), profile_facts (valid_from / valid_to), threads,
-- reflections and call_briefs. Written by the sarvam-call-handler and
-- build-brief edge functions with the service role; no client policies.

-- 1. Event log: every observation from a real call. Never updated or deleted.
create table if not exists public.memory_events (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parent_profiles(id) on delete cascade,
  call_record_id uuid references public.call_records(id) on delete set null,
  call_number integer,
  call_date date not null,
  category text not null check (category in ('health', 'life', 'mood', 'routine')),
  parent_words text not null,
  summary text not null,
  importance smallint not null check (importance between 1 and 5),
  created_at timestamptz not null default now()
);
create index if not exists memory_events_parent_idx on public.memory_events (parent_id, call_date desc);
create index if not exists memory_events_call_idx on public.memory_events (call_record_id);

create or replace function public.memory_events_append_only()
returns trigger language plpgsql as $$
begin
  -- Deleting a parent removes their events through the cascade.
  if tg_op = 'DELETE' and not exists (select 1 from public.parent_profiles where id = old.parent_id) then
    return old;
  end if;
  -- Deleting a call record only unlinks the event (on delete set null).
  if tg_op = 'UPDATE' and new.call_record_id is null and old.call_record_id is not null
     and (to_jsonb(new) - 'call_record_id') = (to_jsonb(old) - 'call_record_id') then
    return new;
  end if;
  raise exception 'memory_events is append-only (% not allowed)', tg_op;
end;
$$;

drop trigger if exists memory_events_append_only on public.memory_events;
create trigger memory_events_append_only
  before update or delete on public.memory_events
  for each row execute function public.memory_events_append_only();

-- 2. Living profile: one current value per (parent, block, key); history kept.
create table if not exists public.profile_facts (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parent_profiles(id) on delete cascade,
  block text not null check (block in ('person', 'household', 'routine', 'health', 'likes', 'sensitivities')),
  key text not null,
  value text not null,
  source text not null check (source in ('child', 'parent')),
  confirmed boolean not null default false,
  valid_from date not null default current_date,
  valid_to date,
  last_seen_call_id uuid references public.call_records(id) on delete set null,
  created_at timestamptz not null default now(),
  check (key <> 'child_worry')
);
create unique index if not exists profile_facts_current_key
  on public.profile_facts (parent_id, block, key) where valid_to is null;

-- 3. Threads: open items to follow up.
create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parent_profiles(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('health', 'life')),
  status text not null default 'open' check (status in ('open', 'closed')),
  importance smallint not null default 3 check (importance between 1 and 5),
  opened_on date not null,
  last_update date not null,
  last_mentioned_call integer not null,
  next_ask_on date,
  next_ask_call integer,
  last_words text,
  last_event_id uuid references public.memory_events(id) on delete set null,
  closed_reason text check (closed_reason in ('resolved', 'faded')),
  created_at timestamptz not null default now()
);
create index if not exists threads_open_idx on public.threads (parent_id) where status = 'open';

-- 4. Reflections: 2-3 patterns every 5 real calls, each citing event ids.
create table if not exists public.reflections (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parent_profiles(id) on delete cascade,
  calls_covered integer[] not null,
  patterns jsonb not null,
  created_at timestamptz not null default now()
);

-- 5. Pre-call briefs. mode: shadow (built, old memory sent), live (sent), example.
create table if not exists public.call_briefs (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parent_profiles(id) on delete cascade,
  call_number integer not null,
  brief_text text not null,
  used_in_call boolean not null default false,
  mode text not null default 'shadow' check (mode in ('shadow', 'live', 'example')),
  attempt_id text,
  sent_user_context text,
  inputs jsonb,
  checks jsonb,
  created_at timestamptz not null default now()
);
create index if not exists call_briefs_parent_idx on public.call_briefs (parent_id, created_at desc);

-- Which real calls the pipeline has processed (drives "every 5th call").
alter table public.call_records
  add column if not exists call_number integer,
  add column if not exists memory_processed_at timestamptz;

alter table public.memory_events enable row level security;
alter table public.profile_facts enable row level security;
alter table public.threads enable row level security;
alter table public.reflections enable row level security;
alter table public.call_briefs enable row level security;

-- Shared secret for internal calls to the memory functions (service role only).
create table if not exists public.internal_config (
  key text primary key,
  value text not null
);
alter table public.internal_config enable row level security;
insert into public.internal_config (key, value)
values ('memory_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- Shadow first: briefs are built and saved, the old memory is still sent.
insert into public.app_settings (key, value) values ('memory_brief_mode', '"shadow"')
on conflict (key) do nothing;

-- Lets the database trigger the memory functions (used for backfills).
create extension if not exists pg_net;

-- Seed the living profile from onboarding data (Phase 2 shape and older rows).
-- Everything here came from the family: source child, not confirmed.
create or replace function pg_temp.fact_text(v jsonb) returns text language sql immutable as $$
  select nullif(trim(case
    when v is null or v = 'null'::jsonb then null
    when jsonb_typeof(v) = 'object' and v ? 'value' then pg_temp.fact_text(v->'value')
    when jsonb_typeof(v) = 'array' then (
      select string_agg(coalesce(e->>'name', e #>> '{}'), '; ')
      from jsonb_array_elements(v) e
      where coalesce(e->>'name', e #>> '{}') <> ''
    )
    when jsonb_typeof(v) = 'object' then null
    else v #>> '{}'
  end), '')
$$;

insert into public.profile_facts (parent_id, block, key, value, source, confirmed, valid_from)
select p.id, f.block, f.key, f.value, 'child', false, coalesce(p.created_at::date, current_date)
from public.parent_profiles p
cross join lateral (values
  ('person', 'address_as', nullif(trim(p.honorific), '')),
  ('person', 'language', coalesce(nullif(p.language, ''), pg_temp.fact_text(p.facts->'language'))),
  ('person', 'child', nullif(trim(concat_ws(' ', coalesce(p.child_name, pg_temp.fact_text(p.facts->'family_member')),
      '(' || lower(pg_temp.fact_text(p.facts->'relationship')) || ')')), '')),
  ('household', 'living_situation', replace(pg_temp.fact_text(p.facts->'living_situation'), '_', ' ')),
  ('household', 'household_help', pg_temp.fact_text(p.facts->'household_help')),
  ('routine', 'wake_time', (select r->>'time' from jsonb_array_elements(coalesce(p.routines, '[]')) r where r->>'name' = 'wake' limit 1)),
  ('routine', 'sleep_time', coalesce(p.sleep_time, (select r->>'time' from jsonb_array_elements(coalesce(p.routines, '[]')) r where r->>'name' = 'sleep' limit 1))),
  ('routine', 'preferred_call_time', p.preferred_call_time),
  ('health', 'conditions', pg_temp.fact_text(p.medical_baseline->'conditions')),
  ('health', 'medicines', coalesce(pg_temp.fact_text(p.medical_baseline->'medicines'), pg_temp.fact_text(p.medical_baseline->'medications'))),
  ('likes', 'enjoys', pg_temp.fact_text(p.facts->'enjoys')),
  ('sensitivities', 'avoid_topics', pg_temp.fact_text(p.facts->'avoid_topics'))
) as f(block, key, value)
where f.value is not null and f.value <> '' and f.value <> '()'
on conflict do nothing;

-- Older rows: other medical notes and free routine entries.
insert into public.profile_facts (parent_id, block, key, value, source, confirmed, valid_from)
select p.id, 'health', m.key, pg_temp.fact_text(m.value), 'child', false, coalesce(p.created_at::date, current_date)
from public.parent_profiles p, jsonb_each(case when jsonb_typeof(p.medical_baseline) = 'object' then p.medical_baseline else '{}' end) m
where m.key not in ('conditions', 'medicines', 'medications') and pg_temp.fact_text(m.value) is not null
on conflict do nothing;

insert into public.profile_facts (parent_id, block, key, value, source, confirmed, valid_from)
select p.id, 'routine', 'daily_' || r.n, concat_ws(' ', nullif(r.item->>'time', 'Daily Routine'), r.item->>'activity'), 'child', false,
       coalesce(p.created_at::date, current_date)
from public.parent_profiles p,
     jsonb_array_elements(case when jsonb_typeof(p.routines) = 'array' then p.routines else '[]' end) with ordinality as r(item, n)
where r.item ? 'activity' and nullif(trim(r.item->>'activity'), '') is not null
on conflict do nothing;
