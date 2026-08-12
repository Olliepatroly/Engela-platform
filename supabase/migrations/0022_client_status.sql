-- ============================================================================
-- 0022 — Client record status: activate, pause, discharge
-- ----------------------------------------------------------------------------
-- clients.status has existed since 0001 with the three values named in its
-- comment, but nothing could ever change it: every record sat on the 'active'
-- default forever. The console now carries a status control, so the column
-- gains the backstop it never had plus the fields needed to show WHO changed
-- it, WHEN, and WHY.
--
--   active      on the programme.
--   paused      a protective hold. The client app already reads this and shows
--               a calm "your programme is paused" banner (rule 6/copy rules:
--               pausing is framed as protective, never as a failure).
--   discharged  the programme has finished, or the client has moved on from
--               this team.
--
-- Status is NOT an access control. A paused or discharged client keeps their
-- own record and their own sign-in; UK GDPR gives them access to their data
-- regardless of where they are on the programme. It changes what the surfaces
-- say, and it is an audited clinical act.
--
-- Security notes (load-bearing, CLAUDE.md §2):
--   * No new policy is added. Writes stay server-only (service role) through
--     the audited setClientStatus action, exactly like every other clinical
--     write. Deny-by-default is untouched.
--   * The REASON for a status change is deliberately NOT stored here. A client
--     can read their own clients row (clients_select_own_or_care_team), and
--     RLS is row-level, so a column on this table is a column the client can
--     read. The team's reasoning lives in the clinical-only audit_log instead;
--     only who changed it and when sit on the row.
-- ============================================================================

-- Nothing has ever written a value other than the default, but normalise
-- before constraining so the migration cannot fail on unexpected data.
update public.clients
set status = 'active'
where status not in ('active', 'paused', 'discharged');

-- Guarded so the migration can be re-run safely (ADD CONSTRAINT has no
-- IF NOT EXISTS form).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.clients'::regclass
      and conname = 'clients_status_check'
  ) then
    alter table public.clients
      add constraint clients_status_check
        check (status in ('active', 'paused', 'discharged'));
  end if;
end $$;

alter table public.clients
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid references public.profiles (id);

comment on column public.clients.status_changed_at is
  'When the status last changed. Null on records that have never moved off active.';
comment on column public.clients.status_changed_by is
  'The clinical team member who last changed the status.';
