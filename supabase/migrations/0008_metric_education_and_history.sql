-- Metric drill-down: education copy per metric, and history/target added to
-- the client-safe payload so the client app can draw the detailed chart.
alter table public.metrics_catalog add column if not exists why_it_matters text;

update public.metrics_catalog set why_it_matters = c.copy
from (values
  ('lean_muscle_mass', 'Muscle is your reserve. Treatment and recovery draw on it, and protecting lean mass supports strength, balance, metabolism and how well you tolerate therapy. Slow, steady gains here compound over months.'),
  ('grip_strength', 'Grip strength is one of the best single indicators of whole-body strength and resilience. It is quick to measure, sensitive to change, and closely tracks how well the wider programme is working.'),
  ('vo2_max', 'Stamina reflects how well your heart, lungs and muscles work together. Higher aerobic capacity is linked with better energy through the day, faster recovery between sessions, and better long-term outcomes.'),
  ('resting_hr', 'A settled resting heart rate is a sign the body is coping well with training and daily life. A rise held over several days can signal fatigue, illness or stress before you feel them.'),
  ('activity_sessions', 'Consistency beats intensity. The number of active sessions in a week shows the rhythm of the programme, and rhythm is what builds lasting change.'),
  ('active_time', 'Total active time captures all the movement that does not look like exercise: walks, gardening, daily life. It is often where the biggest wins hide.'),
  ('protein_intake', 'Protein provides the raw material for maintaining and rebuilding muscle, and supports immune function and recovery. Spreading it across the day helps the body use it well.'),
  ('visceral_fat', 'Visceral fat sits around the organs and is metabolically active. Reducing it lowers inflammation and supports hormonal and cardiovascular health.'),
  ('neutrophils', 'Neutrophils are the immune system''s first responders. Tracking them helps the team time training load safely, especially around treatment.'),
  ('crp', 'CRP is a general marker of inflammation. Trends matter more than single values: a sustained rise prompts the team to look closer and adjust the plan.'),
  ('hrv', 'Recovery, measured through heart rate variability, reflects how well your nervous system is balancing effort and rest. Higher and steadier is better; a falling trend is an early cue to ease off.'),
  ('sleep', 'Sleep is where adaptation happens: muscle repair, memory, immune regulation. Protecting 7 to 9 hours a night gives every other part of the programme more effect.')
) as c(code, copy)
where metrics_catalog.code = c.code;

-- Extend the client-safe projection with history, target and education copy.
-- Still excludes lab metrics (no client_label), context, and safety flags;
-- 'flag' status still softens to 'focus'.
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
        'target_def', mc.target_def,
        'why_it_matters', mc.why_it_matters
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
