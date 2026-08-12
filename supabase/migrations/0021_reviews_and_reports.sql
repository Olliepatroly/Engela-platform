-- ============================================================================
-- 0021 — Conducting a review, and reports the team or the client submits
-- ----------------------------------------------------------------------------
-- Two gaps this closes:
--
--   1. Nothing could OPEN a weekly review. Readings, actions, flags and goals
--      all hang off weekly_reviews, so a newly invited client had no review to
--      record against and the console showed an empty week forever. Any
--      clinical role on the client's care team (consultant, nurse, CEP,
--      physio, admin) may now conduct a review; the CONSULTANT still signs it
--      off (CLAUDE.md §2 rule 4 is untouched — sign-off stays consultant-only
--      and audited).
--
--      issued_by / issued_at carry WHO conducted the review and WHEN it was
--      conducted, so a review run earlier off-system can be submitted with its
--      real date. summary holds the reviewer's narrative for the week.
--
--   2. Reports (a consultant's PDF, bloods, a DEXA scan, a clinic letter, a
--      photo of a test result) had nowhere to live. client_reports stores the
--      metadata; the file itself sits in a private bucket.
--
-- Security notes (load-bearing, CLAUDE.md §2):
--   * A clinical upload can hold raw lab values and disease markers, so it is
--     NEVER visible to the client unless a clinician explicitly shares it
--     (visible_to_client, default false).
--   * A client's own upload is theirs. They choose whether the care team sees
--     it (shared_with_team) and can withdraw that at any time; withdrawing
--     removes team access immediately through the policy below.
--   * Team access is consent-gated as everywhere else: is_on_care_team() only
--     returns true while care_team.consent_at is set (0006).
--   * All writes are server-only (service role) with explicit checks. No
--     INSERT/UPDATE/DELETE policies exist here. Deny-by-default.
--   * The clinical-reports bucket is private with NO storage.objects policies,
--     so there is no direct access; uploads and short-lived signed download
--     URLs are minted server-side with the service role only.
-- ============================================================================

alter table public.weekly_reviews
  add column summary text;

comment on column public.weekly_reviews.summary is
  'The reviewer''s narrative for the week, written when the review is conducted.';
comment on column public.weekly_reviews.issued_by is
  'The clinical team member who conducted the review (any clinical role).';
comment on column public.weekly_reviews.issued_at is
  'When the review was conducted, which may be earlier than when it was entered.';

create table public.client_reports (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  -- Optional: the week the report belongs to. Kept on the record if that
  -- review is ever removed.
  review_id     uuid references public.weekly_reviews (id) on delete set null,
  title         text not null,
  kind          text not null check (
                  kind in ('review', 'bloods', 'imaging', 'dexa', 'clinic_letter', 'test', 'other')
                ),
  -- The date the report or test is FROM (not the upload date).
  taken_on      date,
  note          text,
  storage_path  text not null unique,
  mime_type     text not null,
  size_bytes    integer not null,
  uploaded_by   uuid not null references public.profiles (id),
  uploaded_role text not null check (uploaded_role in ('clinician', 'client')),
  -- Consent gates, one per direction. See the security notes above.
  visible_to_client boolean not null default false,
  shared_with_team  boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.client_reports enable row level security;

create index client_reports_client_created_idx
  on public.client_reports (client_id, created_at desc);
create index client_reports_review_idx
  on public.client_reports (review_id);

-- The client reads reports shared with them (always including their own
-- uploads); the consented care team reads reports shared with the team.
create policy client_reports_select on public.client_reports
  for select to authenticated
  using (
    (client_id = public.current_client_id() and visible_to_client)
    or (public.is_on_care_team(client_id) and shared_with_team)
  );

-- Private bucket for report files. No storage.objects policies are added, so
-- direct access is denied for anon and authenticated; the server uses the
-- service role to upload and to mint short-lived signed download URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinical-reports',
  'clinical-reports',
  false,
  10485760, -- 10 MB, matching the server action's limit
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic']
)
on conflict (id) do nothing;
