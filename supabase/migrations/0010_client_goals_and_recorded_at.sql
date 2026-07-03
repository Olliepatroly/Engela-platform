-- Per-client metric goals: the care team can adjust a target for one client
-- based on health status. Effective target = the client override when present,
-- otherwise the catalogue default.
create table public.client_metric_targets (
  client_id   uuid not null references public.clients (id) on delete cascade,
  metric_code text not null references public.metrics_catalog (code),
  target_def  jsonb not null,
  set_by      uuid references public.profiles (id),
  set_at      timestamptz not null default now(),
  primary key (client_id, metric_code)
);

alter table public.client_metric_targets enable row level security;

-- Care team (with consent) reads a client's goals; the client reads their own.
create policy client_metric_targets_select on public.client_metric_targets
  for select to authenticated
  using (public.is_on_care_team(client_id) or client_id = public.current_client_id());

-- When a reading was taken (data entry can back-date after a session or test).
alter table public.metric_readings add column if not exists recorded_at timestamptz;

-- Activity sessions: the goal is one activity a day, so at least 6 a week,
-- a far more attainable rhythm than the old placeholder of 18.
update public.metrics_catalog
set target_def = '{"kind":"floor","value":6}'::jsonb,
    why_it_matters = 'Consistency beats intensity. Around six to seven active sessions a week, one a day, is the rhythm the programme aims for, and rhythm is what builds lasting change.'
where code = 'activity_sessions';

-- The client-safe payload now reports the effective target.
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
      select jsonb_agg(jsonb_build_object('id', af.id, 'text', af.text))
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
