-- ============================================================================
-- Engela Health — Clinical Platform · initial schema
-- ----------------------------------------------------------------------------
-- Data model per the build brief §8 and the core-data-model diagram.
--
-- RLS GOLDEN RULES (load-bearing — do not weaken):
--   1. RLS is ON for every table, deny-by-default (enable RLS + grant nothing
--      except the explicit policies below).
--   2. Clients see only their own safe data. Raw labs, disease markers (MRD),
--      metric readings and safety flags are NEVER exposed to the client role.
--      The client-safe projection (composite score, pillar scores, visible
--      actions) is served in Phase 1 via a SECURITY DEFINER function, not by
--      direct table access — so clients get no direct SELECT on those tables.
--   3. Clinicians read a client only if they are on that client's care_team.
--   4. The service-role key stays on the server; elevated writes (invites,
--      audited sign-off) go through server code / SECURITY DEFINER functions.
-- ============================================================================

-- ── Enums ───────────────────────────────────────────────────────────────────
create type public.role as enum ('consultant', 'nurse', 'cep', 'client', 'admin');
create type public.pillar as enum ('exercise', 'nutrition', 'immune');
create type public.metric_status as enum ('on_track', 'watch', 'flag');
create type public.direction_of_benefit as enum ('higher', 'lower', 'range');

-- ── Tables ──────────────────────────────────────────────────────────────────
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       public.role not null,
  full_name  text not null,
  email      text not null,
  created_at timestamptz not null default now()
);

create table public.clinicians (
  profile_id      uuid primary key references public.profiles (id) on delete cascade,
  discipline      text not null,
  registration_no text
);

create table public.clients (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null unique references public.profiles (id) on delete cascade,
  mrn             text not null,
  diagnosis       text not null,
  treatment_phase text,
  consultant_id   uuid references public.profiles (id),
  rehab_lead_id   uuid references public.profiles (id),
  programme_week  int,
  baseline_week   int,
  status          text not null default 'active', -- active | paused | discharged
  created_at      timestamptz not null default now()
);

-- Link + consent: sharing a client with a clinician is explicit and recorded.
create table public.care_team (
  client_id    uuid not null references public.clients (id) on delete cascade,
  clinician_id uuid not null references public.profiles (id) on delete cascade,
  relationship text,
  consent_at   timestamptz,
  primary key (client_id, clinician_id)
);

create table public.weekly_reviews (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients (id) on delete cascade,
  week_no         int not null,
  window_start    date not null,
  window_end      date not null,
  composite_score numeric(3, 1),
  status          public.metric_status,
  -- Status-strip context (diagnosis, treatment phase, MRD, QOL, sessions…).
  -- CLINICAL-ONLY: contains disease markers — never selected by the client role.
  context         jsonb not null default '{}'::jsonb,
  issued_at       timestamptz,
  issued_by       uuid references public.profiles (id),
  signed_by       uuid references public.profiles (id),
  signed_at       timestamptz,
  created_at      timestamptz not null default now(),
  unique (client_id, week_no)
);

create table public.pillar_scores (
  id        uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.weekly_reviews (id) on delete cascade,
  pillar    public.pillar not null,
  score     numeric(3, 1) not null,
  baseline  numeric(3, 1),
  unique (review_id, pillar)
);

-- Reference/config: drives the status engine + the "estimate" caveat marker.
create table public.metrics_catalog (
  code                 text primary key,
  pillar               public.pillar not null,
  name                 text not null,
  client_label         text,
  unit                 text,
  target_def           jsonb not null,  -- { kind: 'ceiling'|'floor'|'range', ... }
  direction_of_benefit public.direction_of_benefit not null,
  is_estimate          boolean not null default false
);

create table public.metric_readings (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references public.weekly_reviews (id) on delete cascade,
  metric_code text not null references public.metrics_catalog (code),
  current     numeric,
  previous    numeric,
  delta       numeric,
  status      public.metric_status,
  history     jsonb not null default '[]'::jsonb, -- 12-week trend for the sparkline
  unique (review_id, metric_code)
);

-- Raw labs — CONSULTANT-ONLY, never reachable from the client app.
create table public.labs (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  taken_at   timestamptz not null,
  panel      jsonb not null, -- FLC, paraprotein, Hb, MRI…
  created_at timestamptz not null default now()
);

create table public.actions_flags (
  id             uuid primary key default gen_random_uuid(),
  review_id      uuid not null references public.weekly_reviews (id) on delete cascade,
  text           text not null,
  is_flag        boolean not null default false,
  severity       text,
  -- Gates the client app: only client_visible actions are ever surfaced to a
  -- client, and a safety flag (is_flag = true) is never client_visible.
  client_visible boolean not null default false
);

-- Append-only governance trail. No UPDATE/DELETE policy is ever added.
create table public.audit_log (
  id        uuid primary key default gen_random_uuid(),
  actor_id  uuid references public.profiles (id),
  action    text not null,
  entity    text not null,
  entity_id uuid,
  meta      jsonb not null default '{}'::jsonb,
  at        timestamptz not null default now()
);

-- ── Helper functions (role + access checks) ─────────────────────────────────
-- Role travels as a claim on the access token (set by the access-token hook).
create or replace function public.jwt_role()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'role',
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'user_role'
  );
$$;

create or replace function public.is_clinical()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.jwt_role() in ('consultant', 'nurse', 'cep', 'admin');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.jwt_role() = 'admin';
$$;

-- SECURITY DEFINER so the policy check does not recurse through RLS.
create or replace function public.is_on_care_team(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.care_team ct
    where ct.client_id = p_client
      and ct.clinician_id = auth.uid()
  ) or public.is_admin();
$$;

-- The signed-in client's own client row id (or null). SECURITY DEFINER to
-- avoid recursion in the clients policy.
create or replace function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id from public.clients c where c.profile_id = auth.uid();
$$;

grant execute on function public.jwt_role() to authenticated;
grant execute on function public.is_clinical() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_on_care_team(uuid) to authenticated;
grant execute on function public.current_client_id() to authenticated;

-- ── Enable RLS everywhere (deny-by-default) ─────────────────────────────────
alter table public.profiles        enable row level security;
alter table public.clinicians      enable row level security;
alter table public.clients         enable row level security;
alter table public.care_team       enable row level security;
alter table public.weekly_reviews  enable row level security;
alter table public.pillar_scores   enable row level security;
alter table public.metrics_catalog enable row level security;
alter table public.metric_readings enable row level security;
alter table public.labs            enable row level security;
alter table public.actions_flags   enable row level security;
alter table public.audit_log       enable row level security;

-- ── Policies (SELECT only; all writes go through server / service role) ──────

-- profiles: read own; clinical team can read profiles (names/roles, not PHI).
create policy profiles_select_self_or_clinical on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_clinical());

-- clinicians: clinical team only.
create policy clinicians_select_clinical on public.clinicians
  for select to authenticated
  using (public.is_clinical());

-- clients: a client reads their own row; a clinician reads a client on their care team.
create policy clients_select_own_or_care_team on public.clients
  for select to authenticated
  using (
    profile_id = auth.uid()
    or public.is_on_care_team(id)
  );

-- care_team: a clinician sees their own membership rows; admin sees all.
create policy care_team_select_clinical on public.care_team
  for select to authenticated
  using (clinician_id = auth.uid() or public.is_admin());

-- metrics_catalog: reference config, readable by any authenticated user.
create policy metrics_catalog_select_all on public.metrics_catalog
  for select to authenticated
  using (true);

-- weekly_reviews: CLINICAL-ONLY direct access (context holds disease markers).
-- The client-safe summary is served via a SECURITY DEFINER function in Phase 1.
create policy weekly_reviews_select_clinical on public.weekly_reviews
  for select to authenticated
  using (public.is_on_care_team(client_id));

-- pillar_scores / metric_readings / actions_flags: clinical-only direct access,
-- scoped to the care team through the parent review.
create policy pillar_scores_select_clinical on public.pillar_scores
  for select to authenticated
  using (exists (
    select 1 from public.weekly_reviews wr
    where wr.id = review_id and public.is_on_care_team(wr.client_id)
  ));

create policy metric_readings_select_clinical on public.metric_readings
  for select to authenticated
  using (exists (
    select 1 from public.weekly_reviews wr
    where wr.id = review_id and public.is_on_care_team(wr.client_id)
  ));

create policy actions_flags_select_clinical on public.actions_flags
  for select to authenticated
  using (exists (
    select 1 from public.weekly_reviews wr
    where wr.id = review_id and public.is_on_care_team(wr.client_id)
  ));

-- labs: CONSULTANT-ONLY, care-team scoped. Never reachable by the client role.
create policy labs_select_clinical on public.labs
  for select to authenticated
  using (public.is_on_care_team(client_id));

-- audit_log: clinical team read-only. Appended by server code only (no
-- INSERT/UPDATE/DELETE policy — service role / SECURITY DEFINER writes only).
create policy audit_log_select_clinical on public.audit_log
  for select to authenticated
  using (public.is_clinical());
