-- Phase 1: bedtime guard for outbound calls.
-- Both are "HH:MM" in India time. The outbound route refuses to call after
-- sleep_time - 60 min (or preferred_call_time + 90 min when sleep_time is empty).

alter table public.parent_profiles
  add column if not exists preferred_call_time text,
  add column if not exists sleep_time text;

alter table public.parent_profiles
  drop constraint if exists parent_profiles_preferred_call_time_format,
  add constraint parent_profiles_preferred_call_time_format
    check (preferred_call_time is null or preferred_call_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  drop constraint if exists parent_profiles_sleep_time_format,
  add constraint parent_profiles_sleep_time_format
    check (sleep_time is null or sleep_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

comment on column public.parent_profiles.preferred_call_time is 'Best time to call, HH:MM India time.';
comment on column public.parent_profiles.sleep_time is 'Usual bedtime, HH:MM India time. No calls after sleep_time - 60 min.';

-- Backfill sleep_time from a routine entry the parent already gave, e.g.
-- {"time": "10:30 PM", "activity": "Rest & sleep"} -> 22:30.
with sleep_routine as (
  select distinct on (p.id)
    p.id,
    upper(trim(r->>'time')) as t
  from public.parent_profiles p,
       jsonb_array_elements(case when jsonb_typeof(p.routines) = 'array' then p.routines else '[]'::jsonb end) r
  where p.sleep_time is null
    and (r->>'activity') ilike '%sleep%'
    and upper(trim(r->>'time')) ~ '^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$'
    -- Night-time only (7 PM to 2:59 AM), so an afternoon nap is never read as bedtime.
    and to_char(to_timestamp(upper(trim(r->>'time')), 'HH12:MI AM'), 'HH24') in
        ('19','20','21','22','23','00','01','02')
  order by p.id, to_timestamp(upper(trim(r->>'time')), 'HH12:MI AM') desc
)
update public.parent_profiles p
set sleep_time = to_char(to_timestamp(s.t, 'HH12:MI AM'), 'HH24:MI')
from sleep_routine s
where p.id = s.id;
