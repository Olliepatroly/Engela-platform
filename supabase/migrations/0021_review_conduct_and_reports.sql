-- ============================================================================
-- 0021 — Conducting a weekly review, and reports conducted elsewhere
-- ----------------------------------------------------------------------------
-- Until now a weekly review could only be read: nothing in the product created
-- one. A newly invited client therefore had no review, so every clinician write
-- (readings, actions, goals) refused with "no weekly review to record against"
-- and the console showed an empty state with no way out.
--
-- This migration adds what the clinical team needs to conduct a review:
--   * weekly_reviews.conducted_at / conducted_by — who actually did the review
--     and when, which is NOT the same as who signs it off. Any clinical role
--     (consultant, nurse, CEP, physio, admin) may conduct one; sign-off stays
--     the consultant's act (safety rule 4, unchanged).
--   * weekly_reviews.source — 'console' when the week was worked up here,
--     'uploaded' when it was conducted earlier elsewhere and entered after the
--     fact (typically a consultant's PDF report).
--   * weekly_reviews.summary — the clinical narrative for a review conducted
--     elsewhere. CLINICAL-ONLY, like context: the client-safe projection
--     (client_home_payload) names its fields explicitly and does not read it.
--   * review_reports — PDF documents (consultant review, bloods, DEXA, clinic
--     letter) held against a client and optionally against one review.
--
-- Security notes:
--   * review_reports is a clinical document store. It carries raw labs and
--     disease markers, so it is NEVER client-readable: the only SELECT policy
--     is the consented care team. Safety rule 2 holds.
--   * The 'clinical-reports' bucket is private with NO storage.objects
--     policies, so anon and authenticated are denied outright; the server uses
--     the service role to upload and to mint short-lived signed URLs. Same
--     pattern as the voice-notes bucket in 0018.
--   * All writes are server-only (service role) through audited server
--     actions. No INSERT/UPDATE/DELETE policies exist on review_reports.
-- ============================================================================

-- ── Who conducted the review, and how it reached the record ─────────────────
alter table public.weekly_reviews
  add column conducted_at timestamptz,
  add column conducted_by uuid references public.profiles (id),
  add column source text not null default 'console'
    check (source in ('console', 'uploaded')),
  -- CLINICAL-ONLY narrative for a review conducted outside the console.
  add column summary text;

comment on column public.weekly_reviews.conducted_by is
  'The clinician who conducted the review. Any clinical role may conduct one; sign-off (signed_by) stays the consultant''s act.';
comment on column public.weekly_reviews.summary is
  'Clinical-only narrative for a review conducted elsewhere. Never exposed to the client role.';

-- ── Clinical reports (PDF) ──────────────────────────────────────────────────
create table public.review_reports (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  -- Optional: a report can predate the review it belongs to, or stand alone.
  review_id     uuid references public.weekly_reviews (id) on delete set null,
  kind          text not null default 'consultant_review'
    check (kind in ('consultant_review', 'bloods', 'dexa', 'clinic_letter', 'other')),
  title         text not null,
  note          text,
  -- Object key in the private 'clinical-reports' bucket.
  storage_path  text not null unique,
  file_name     text not null,
  file_size     integer,
  -- When the review/test the document records actually took place.
  conducted_on  date,
  -- The author, as a profile when they hold an account, else free text (an
  -- external consultant's report still needs attribution).
  conducted_by  uuid references public.profiles (id),
  conducted_by_name text,
  uploaded_by   uuid not null references public.profiles (id),
  created_at    timestamptz not null default now()
);

create index review_reports_client_idx on public.review_reports (client_id, created_at desc);
create index review_reports_review_idx on public.review_reports (review_id);

alter table public.review_reports enable row level security;

-- Consented care team only. Deliberately no client policy: these documents
-- hold raw labs and disease markers (safety rule 2).
create policy review_reports_select_care_team on public.review_reports
  for select to authenticated
  using (public.is_on_care_team(client_id));

-- Private bucket for clinical report PDFs. No storage.objects policies are
-- added, so direct access is denied for anon and authenticated; the server
-- uploads and mints short-lived signed URLs with the service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinical-reports',
  'clinical-reports',
  false,
  10485760, -- 10 MB
  array['application/pdf']
)
on conflict (id) do nothing;
