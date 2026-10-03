-- Our own evals (like Sarvam's, run by the eval-agent edge function with OpenAI).
-- Prompts under test, scenarios (simulated parents), runs and one result per
-- scenario per run. Service role only; the dashboard reaches them through its API.

create table if not exists public.eval_prompts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  text text not null,
  opening_line text,
  created_at timestamptz not null default now()
);

create table if not exists public.eval_scenarios (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  group_name text not null default 'Custom',
  kind text not null default 'simulation' check (kind in ('simulation', 'scripted')),
  persona text not null,
  behaviours text,
  language text,
  parent_name text,
  honorific text,
  child_name text,
  call_number integer not null default 3 check (call_number >= 1),
  user_context text,
  script jsonb,
  max_exchanges integer not null default 12 check (max_exchanges between 1 and 40),
  checks text[],
  criteria jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.eval_runs (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid references public.eval_prompts(id) on delete set null,
  prompt_name text not null,
  label text,
  status text not null default 'running' check (status in ('running', 'done')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.eval_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.eval_runs(id) on delete cascade,
  scenario_id uuid references public.eval_scenarios(id) on delete set null,
  scenario_name text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'error')),
  transcript jsonb not null default '[]'::jsonb,
  ended text,
  stats jsonb,
  grades jsonb,
  passed boolean,
  error text,
  tokens integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists eval_results_run_idx on public.eval_results (run_id);
create index if not exists eval_runs_created_idx on public.eval_runs (created_at desc);

alter table public.eval_prompts enable row level security;
alter table public.eval_scenarios enable row level security;
alter table public.eval_runs enable row level security;
alter table public.eval_results enable row level security;
