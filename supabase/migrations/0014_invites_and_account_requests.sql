-- ============================================================================
-- 0014 — Invite flow (Phase 2)
-- ----------------------------------------------------------------------------
-- Invite-only onboarding: the clinical team sends signed invite links; nobody
-- self-registers. The public create-account page files a request the team can
-- follow up with an invite.
--
-- Security notes:
--   * The raw invite token never touches the database — only its SHA-256 hash.
--   * All writes are server-only (service role). No INSERT/UPDATE/DELETE
--     policies exist on either table.
--   * Inviters see the invites they sent (admin sees all); the clinical team
--     reads account requests. Deny-by-default otherwise.
-- ============================================================================

create table public.invites (
  id               uuid primary key default gen_random_uuid(),
  email            text not null,
  full_name        text not null,
  role             public.role not null,
  token_hash       text not null unique,
  invited_by       uuid not null references public.profiles (id),
  -- Client invites can carry the clinical context the record starts with.
  mrn              text,
  diagnosis        text,
  expires_at       timestamptz not null,
  accepted_at      timestamptz,
  accepted_profile uuid references public.profiles (id),
  revoked_at       timestamptz,
  created_at       timestamptz not null default now()
);

create table public.account_requests (
  id             uuid primary key default gen_random_uuid(),
  path           text not null check (path in ('team', 'client')),
  full_name      text not null,
  email          text not null,
  requested_role text,
  status         text not null default 'new' check (status in ('new', 'handled')),
  created_at     timestamptz not null default now()
);

alter table public.invites enable row level security;
alter table public.account_requests enable row level security;

-- Inviters read their own invites (status view); admin reads all.
create policy invites_select_inviter on public.invites
  for select to authenticated
  using (public.is_clinical() and (invited_by = (select auth.uid()) or public.is_admin()));

-- Account requests come from the public create-account page (service-role
-- insert); the clinical team reads them to follow up with an invite.
create policy account_requests_select_clinical on public.account_requests
  for select to authenticated
  using (public.is_clinical());
