-- ============================================================================
-- 0018 — Tiered clinical flags with SBAR and client voice notes
-- ----------------------------------------------------------------------------
-- A clinical screening flag raised about a client, tiered minor or major.
--   * Clinician-raised (cep / physio / consultant / nurse): must carry a full
--     SBAR (Situation, Background, Assessment, Recommendation). Background is
--     prefilled from the client's clinical record + health profile in the UI.
--   * Client-raised (after a self-conducted session): carries a voice note
--     (stored in the private voice-notes bucket) or a typed description as a
--     fallback, reviewed by the clinical team. The client UI tells clients to
--     call 999 immediately for any medical emergency.
--
-- Security notes (load-bearing, CLAUDE.md §2):
--   * A clinician-raised flag is a safety flag and must NEVER be visible to
--     the client. The SELECT policy lets a client read ONLY flags they raised
--     themselves; the consented care team reads all flags for their clients.
--   * All writes are server-only (service role) with explicit checks; no
--     INSERT/UPDATE/DELETE policies exist. Deny-by-default.
--   * The voice-notes bucket is private with NO storage.objects policies, so
--     no direct client access exists; uploads and signed playback URLs are
--     created server-side with the service role only.
-- ============================================================================

create table public.clinical_flags (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  session_id  uuid references public.program_sessions (id) on delete set null,
  raised_by   uuid not null references public.profiles (id),
  raised_role text not null check (raised_role in ('clinician', 'client')),
  tier        text not null check (tier in ('minor', 'major')),
  summary     text,
  -- SBAR for clinician flags: { situation, background, assessment, recommendation }
  sbar        jsonb,
  -- Client flags: voice note in the private bucket, or a typed fallback.
  voice_path  text,
  transcript  text,
  status      text not null default 'open' check (status in ('open', 'reviewed')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  -- DB-level backstops for the server-side rules.
  constraint clinician_flags_need_sbar
    check (raised_role <> 'clinician' or sbar is not null),
  constraint client_flags_need_account
    check (raised_role <> 'client' or voice_path is not null or transcript is not null)
);

alter table public.clinical_flags enable row level security;

create index clinical_flags_client_created_idx on public.clinical_flags (client_id, created_at desc);
create index clinical_flags_status_idx on public.clinical_flags (status);

-- A client reads ONLY the concerns they raised themselves (never the team's
-- flags about them); the consented care team reads all flags for their clients.
create policy clinical_flags_select on public.clinical_flags
  for select to authenticated
  using (
    (raised_by = (select auth.uid()) and client_id = public.current_client_id())
    or public.is_on_care_team(client_id)
  );

-- Private bucket for client voice notes. No storage.objects policies are added,
-- so direct access is denied for anon and authenticated; the server uses the
-- service role to upload and to mint short-lived signed playback URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-notes',
  'voice-notes',
  false,
  10485760, -- 10 MB
  array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav']
)
on conflict (id) do nothing;
