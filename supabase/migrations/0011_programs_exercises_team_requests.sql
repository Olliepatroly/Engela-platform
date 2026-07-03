-- ============================================================================
-- Exercise programmes + community search / team requests
-- ----------------------------------------------------------------------------
-- 1. An exercise library (built by CEPs) with muscle groups for the body map.
-- 2. Per-client programmes made of dated sessions; each session holds
--    exercises across three categories (cardiovascular, resistance, mobility)
--    with sets/reps/weights. Clients mark work complete; the console sees
--    history and upcoming sessions.
-- 3. Team requests: a client can ask a community member to join their team; a
--    member can invite a client into their care, or invite a fellow member to
--    a client's team. Accepting writes a care_team row. CONSENT RULES HOLD:
--    only the client's own action (their request, or their acceptance of an
--    invite) sets consent_at. A member-to-member addition starts with
--    consent_at null until the client turns sharing on in The community.
--
-- Same golden rules as 0001: RLS on, deny-by-default, SELECT-only policies;
-- all writes go through audited server actions with the service role.
-- ============================================================================

-- ── Enums ───────────────────────────────────────────────────────────────────
create type public.exercise_category as enum ('cardiovascular', 'resistance', 'mobility');

create type public.muscle_group as enum (
  'traps', 'shoulders', 'chest', 'biceps', 'triceps', 'forearms',
  'abdominals', 'obliques', 'upper_back', 'lats', 'lower_back',
  'glutes', 'quadriceps', 'hamstrings', 'calves'
);

create type public.session_status as enum ('scheduled', 'completed', 'missed');

create type public.team_request_kind as enum (
  'client_request',   -- a client asks a community member to join their team
  'clinician_invite', -- a community member invites a client into their care
  'peer_invite'       -- a community member invites another member to a client's team
);

create type public.team_request_status as enum ('pending', 'accepted', 'declined', 'cancelled');

-- Which body figure the client app and console show for this client.
alter table public.clients
  add column body_map text not null default 'male'
  check (body_map in ('male', 'female'));

-- ── Tables ──────────────────────────────────────────────────────────────────

-- Shared exercise library. Reference data (no PHI): any signed-in user can
-- read it; only CEPs and admins add to it (enforced in the server action).
create table public.exercises (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  category          public.exercise_category not null,
  primary_muscles   public.muscle_group[] not null default '{}',
  secondary_muscles public.muscle_group[] not null default '{}',
  equipment         text,
  instructions      text,
  created_by        uuid references public.profiles (id),
  created_at        timestamptz not null default now()
);

create table public.programs (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  title      text not null,
  focus      text,
  status     text not null default 'active' check (status in ('active', 'completed', 'archived')),
  starts_on  date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- client_id is denormalised from the programme so RLS stays one hop.
create table public.program_sessions (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid not null references public.programs (id) on delete cascade,
  client_id     uuid not null references public.clients (id) on delete cascade,
  title         text not null,
  scheduled_for date not null,
  status        public.session_status not null default 'scheduled',
  completed_at  timestamptz,
  notes         text,
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now()
);

create table public.session_exercises (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.program_sessions (id) on delete cascade,
  exercise_id  uuid not null references public.exercises (id),
  position     int not null default 0,
  sets         int,
  reps         int,
  weight_kg    numeric(6, 2),
  duration_min numeric(6, 1),
  distance_km  numeric(6, 2),
  notes        text,
  completed_at timestamptz
);

create table public.team_requests (
  id           uuid primary key default gen_random_uuid(),
  kind         public.team_request_kind not null,
  -- The client whose team is in question (the requester, the invitee, or the
  -- team a peer is being invited to, depending on kind).
  client_id    uuid not null references public.clients (id) on delete cascade,
  -- The community member being asked / doing the inviting (for a
  -- clinician_invite this equals requested_by).
  clinician_id uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  message      text,
  status       public.team_request_status not null default 'pending',
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles (id)
);

create index programs_client_idx on public.programs (client_id);
create index program_sessions_client_date_idx on public.program_sessions (client_id, scheduled_for);
create index session_exercises_session_idx on public.session_exercises (session_id);
create index team_requests_clinician_idx on public.team_requests (clinician_id, status);
create index team_requests_client_idx on public.team_requests (client_id, status);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.exercises         enable row level security;
alter table public.programs          enable row level security;
alter table public.program_sessions  enable row level security;
alter table public.session_exercises enable row level security;
alter table public.team_requests     enable row level security;

-- Exercise library: reference data, readable by any signed-in user.
create policy exercises_select_all on public.exercises
  for select to authenticated
  using (true);

-- Programmes and sessions: the client's care team (with consent) and the
-- client themselves. No raw labs or clinical context live here.
create policy programs_select_team_or_own on public.programs
  for select to authenticated
  using (public.is_on_care_team(client_id) or client_id = public.current_client_id());

create policy program_sessions_select_team_or_own on public.program_sessions
  for select to authenticated
  using (public.is_on_care_team(client_id) or client_id = public.current_client_id());

create policy session_exercises_select_team_or_own on public.session_exercises
  for select to authenticated
  using (exists (
    select 1 from public.program_sessions ps
    where ps.id = session_id
      and (public.is_on_care_team(ps.client_id) or ps.client_id = public.current_client_id())
  ));

-- Team requests: visible to the people involved, nobody else.
create policy team_requests_select_involved on public.team_requests
  for select to authenticated
  using (
    requested_by = (select auth.uid())
    or clinician_id = (select auth.uid())
    or client_id = public.current_client_id()
  );

-- ── Directory search ────────────────────────────────────────────────────────
-- Safe directory fields only (name, role, discipline): no diagnosis, no MRN,
-- no programme data. Clients see community members; clinical callers also see
-- clients. SECURITY DEFINER so clients need no widened profiles access.
create or replace function public.search_directory(q text)
returns table (kind text, id uuid, full_name text, member_role text, discipline text)
language sql
stable
security definer
set search_path = public
as $$
  select * from (
    select
      'member'::text  as kind,
      p.id            as id,
      p.full_name     as full_name,
      p.role::text    as member_role,
      cl.discipline   as discipline
    from public.profiles p
    left join public.clinicians cl on cl.profile_id = p.id
    where p.role in ('consultant', 'nurse', 'cep', 'physio')
      and p.id <> (select auth.uid())
      and p.full_name ilike '%' || q || '%'

    union all

    select
      'client'::text,
      c.id,
      p.full_name,
      'client'::text,
      null::text
    from public.clients c
    join public.profiles p on p.id = c.profile_id
    where public.is_clinical()
      and p.id <> (select auth.uid())
      and p.full_name ilike '%' || q || '%'
  ) results
  where length(trim(q)) >= 2
  order by full_name
  limit 20;
$$;

revoke execute on function public.search_directory(text) from public;
revoke execute on function public.search_directory(text) from anon;
grant execute on function public.search_directory(text) to authenticated;
