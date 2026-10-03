-- Invite links: a friend's name to greet them by, and a way to turn a link off.

alter table public.onboarding_tokens
  add column if not exists label text,
  add column if not exists revoked_at timestamptz;

comment on column public.onboarding_tokens.label is 'Optional first name of the friend the link was sent to. Shown on the form as a greeting.';
comment on column public.onboarding_tokens.revoked_at is 'Set when the link was turned off from the dashboard before it was filled.';

create index if not exists onboarding_tokens_created_idx on public.onboarding_tokens (created_at desc);
