-- ============================================================================
-- 0019 — Client health profile: PAR-Q screening + clinical details
-- ----------------------------------------------------------------------------
-- One row per client holding:
--   * parq — the client's PAR-Q readiness screening answers (prompted at
--     sign-on, skippable). Any "yes" sets parq_positive so the team follows up
--     before the next session.
--   * details — the clinical details the care team keeps with the account
--     (conditions, medications, allergies, emergency contact...). Maintained
--     by the team; used to prefill the Background section of an SBAR flag.
--
-- Security notes:
--   * SELECT via RLS: the client reads their own profile (their own answers
--     and the details held about them); the consented care team reads it.
--     Deny-by-default.
--   * All writes are server-only (service role): the PAR-Q submit action
--     writes the client's own answers; team edits come through the console.
--     No INSERT/UPDATE/DELETE policies exist.
-- ============================================================================

create table public.client_health_profiles (
  client_id         uuid primary key references public.clients (id) on delete cascade,
  parq              jsonb,
  parq_completed_at timestamptz,
  parq_positive     boolean,
  details           jsonb not null default '{}'::jsonb,
  updated_by        uuid references public.profiles (id),
  updated_at        timestamptz not null default now()
);

alter table public.client_health_profiles enable row level security;

-- The client reads their own profile; the consented care team reads it.
create policy client_health_profiles_select on public.client_health_profiles
  for select to authenticated
  using (
    client_id = public.current_client_id()
    or public.is_on_care_team(client_id)
  );
