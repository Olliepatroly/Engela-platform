-- ============================================================================
-- 0017 — Client / care-team messages (Phase 3c, "message Ollie")
-- ----------------------------------------------------------------------------
-- A two-way thread between a client and their consented care team. One thread
-- per client (messages scoped by client_id); sender_role marks each message as
-- from the client or a clinician for display.
--
-- Special-category note: message bodies may contain health information, so they
-- are stored in-app under RLS, never emailed. Deny-by-default.
--
-- Security notes:
--   * SELECT via RLS: the client reads their own thread; the consented care
--     team reads it through is_on_care_team (consent-gated).
--   * All writes are server-only (service role) with explicit checks: the
--     server verifies the sender is a participant (the client themselves, or a
--     consented care-team clinician) and stamps sender_id/sender_role. No
--     client INSERT policy exists.
-- ============================================================================

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  sender_id   uuid not null references public.profiles (id),
  sender_role text not null check (sender_role in ('client', 'clinician')),
  body        text not null check (length(btrim(body)) between 1 and 4000),
  created_at  timestamptz not null default now()
);

alter table public.messages enable row level security;

create index messages_client_created_idx on public.messages (client_id, created_at);

-- The client reads their own thread; the consented care team reads it.
create policy messages_select on public.messages
  for select to authenticated
  using (
    client_id = public.current_client_id()
    or public.is_on_care_team(client_id)
  );
