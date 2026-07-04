-- ============================================================================
-- 0016 — Tickable actions (Phase 3c)
-- ----------------------------------------------------------------------------
-- The client can tick off this week's actions ("This week's focus"). One check
-- row per completed action. The consented care team can see what a client has
-- ticked (future console surface); the client sees their own.
--
-- Security notes:
--   * SELECT via RLS: the client reads their own checks; the consented care
--     team reads them through is_on_care_team (consent-gated). Deny-by-default.
--   * All writes are server-only (service role) with explicit ownership checks,
--     matching setConsent and the rest of the app. No client INSERT/DELETE
--     policy exists.
--   * A check can only ever exist for a client-visible, non-flag action that
--     belongs to the client (enforced server-side on write and by the FK).
-- ============================================================================

create table public.client_action_checks (
  action_id  uuid primary key references public.actions_flags (id) on delete cascade,
  client_id  uuid not null references public.clients (id) on delete cascade,
  checked_at timestamptz not null default now()
);

alter table public.client_action_checks enable row level security;

create index client_action_checks_client_idx on public.client_action_checks (client_id);

-- The client reads their own checks; the consented care team can see them.
create policy client_action_checks_select on public.client_action_checks
  for select to authenticated
  using (
    client_id = public.current_client_id()
    or public.is_on_care_team(client_id)
  );

-- ----------------------------------------------------------------------------
-- The client-safe payload now reports whether each visible action is done.
-- Recreated from 0010 verbatim except the 'actions' subquery adds 'done'.
-- CREATE OR REPLACE preserves the existing (hardened) grants.
-- ----------------------------------------------------------------------------
create or replace function public.client_home_payload()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'client', jsonb_build_object(
      'first_name', split_part(p.full_name, ' ', 1),
      'programme_week', c.programme_week,
      'status', c.status
    ),
    'review', case when wr.id is null then null else jsonb_build_object(
      'week_no', wr.week_no,
      'window_end', wr.window_end,
      'composite_score', wr.composite_score
    ) end,
    'pillars', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pillar', ps.pillar, 'score', ps.score, 'baseline', ps.baseline
      ) order by ps.pillar)
      from public.pillar_scores ps where ps.review_id = wr.id
    ), '[]'::jsonb),
    'metrics', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', mr.metric_code,
        'label', mc.client_label,
        'pillar', mc.pillar,
        'current', mr.current,
        'previous', mr.previous,
        'unit', mc.unit,
        'is_estimate', mc.is_estimate,
        'status', case when mr.status = 'flag' then 'focus' else mr.status::text end,
        'history', mr.history,
        'target_def', coalesce(cmt.target_def, mc.target_def),
        'why_it_matters', mc.why_it_matters
      ) order by mc.pillar, mc.client_label)
      from public.metric_readings mr
      join public.metrics_catalog mc on mc.code = mr.metric_code
      left join public.client_metric_targets cmt
        on cmt.client_id = c.id and cmt.metric_code = mr.metric_code
      where mr.review_id = wr.id and mc.client_label is not null
    ), '[]'::jsonb),
    'actions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', af.id,
        'text', af.text,
        'done', exists (
          select 1 from public.client_action_checks cac where cac.action_id = af.id
        )
      ))
      from public.actions_flags af
      where af.review_id = wr.id and af.client_visible and not af.is_flag
    ), '[]'::jsonb)
  )
  from public.clients c
  join public.profiles p on p.id = c.profile_id
  left join lateral (
    select * from public.weekly_reviews w
    where w.client_id = c.id
    order by w.week_no desc
    limit 1
  ) wr on true
  where c.id = public.current_client_id();
$$;
