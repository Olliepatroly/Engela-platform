-- Client-safe projection for the client app home (rule 2 of the RLS golden
-- rules): clients get NO direct SELECT on weekly_reviews / pillar_scores /
-- metric_readings / actions_flags. This SECURITY DEFINER function returns only
-- the client-safe fields for the CALLING client's own latest review:
--   * no weekly_reviews.context (holds MRD and other disease markers)
--   * no metrics without a client_label (labs: neutrophils, CRP)
--   * no safety flags; 'flag' status is softened to 'focus' (never red on the app)
--   * only client_visible actions
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
        'status', case when mr.status = 'flag' then 'focus' else mr.status::text end
      ) order by mc.pillar, mc.client_label)
      from public.metric_readings mr
      join public.metrics_catalog mc on mc.code = mr.metric_code
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

revoke execute on function public.client_home_payload() from public;
revoke execute on function public.client_home_payload() from anon;
grant execute on function public.client_home_payload() to authenticated;
