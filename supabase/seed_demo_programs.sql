-- ============================================================================
-- DEMO seed — exercise programme for the worked example (HCA-MM-0142)
-- ----------------------------------------------------------------------------
-- Applied to the live project on 2026-07-03. Sample data only, kept for the
-- record / re-seeding. Requires seed_demo.sql (profiles/clients) and migration
-- 0012 (exercise library) to be in place first.
--
-- Michael Mercer gets "Rebuild strength, block 3", three sessions a week
-- (Monday strength A, Wednesday engine, Friday strength B) from 8 June to
-- 15 July 2026: past sessions completed (one deliberately missed on 19 June),
-- today's and future sessions scheduled. Built by Daniel Ross (CEP).
-- Beatrice Cole's body map is set to female for the body-figure demo.
-- ============================================================================

do $$
declare
  v_client uuid := '11111111-0000-4000-8000-000000000001'; -- Michael Mercer
  v_cep    uuid := 'f4dee8ed-cb33-4bbe-aeb0-b4b61da86f9e'; -- Daniel Ross (CEP)
  v_prog   uuid;
  v_sess   uuid;
  d        date;
  dow      int;
  is_done  boolean;
  is_missed boolean;
  bump     numeric; -- small weight progression from 22 June

  ex_cycle uuid; ex_tread uuid; ex_row uuid; ex_ellip uuid;
  ex_goblet uuid; ex_legpress uuid; ex_seatedrow uuid; ex_latpull uuid;
  ex_chest uuid; ex_shpress uuid; ex_bridge uuid; ex_plank uuid; ex_step uuid;
  ex_ham uuid; ex_catcow uuid; ex_hip uuid; ex_shcircle uuid;
begin
  select id into ex_cycle     from public.exercises where name = 'Stationary cycling';
  select id into ex_tread     from public.exercises where name = 'Treadmill walking';
  select id into ex_row       from public.exercises where name = 'Rowing machine';
  select id into ex_ellip     from public.exercises where name = 'Elliptical cross trainer';
  select id into ex_goblet    from public.exercises where name = 'Goblet squat';
  select id into ex_legpress  from public.exercises where name = 'Leg press';
  select id into ex_seatedrow from public.exercises where name = 'Seated row';
  select id into ex_latpull   from public.exercises where name = 'Lat pulldown';
  select id into ex_chest     from public.exercises where name = 'Chest press';
  select id into ex_shpress   from public.exercises where name = 'Dumbbell shoulder press';
  select id into ex_bridge    from public.exercises where name = 'Glute bridge';
  select id into ex_plank     from public.exercises where name = 'Plank';
  select id into ex_step      from public.exercises where name = 'Step up';
  select id into ex_ham       from public.exercises where name = 'Hamstring stretch';
  select id into ex_catcow    from public.exercises where name = 'Cat cow stretch';
  select id into ex_hip       from public.exercises where name = 'Hip flexor stretch';
  select id into ex_shcircle  from public.exercises where name = 'Shoulder circles';

  insert into public.programs (client_id, title, focus, status, starts_on, created_by)
  values (
    v_client,
    'Rebuild strength, block 3',
    'Three sessions a week: rebuild leg and back strength, keep the heart and lungs ticking over, and ease the hips and shoulders.',
    'active', date '2026-06-08', v_cep
  )
  returning id into v_prog;

  foreach d in array array[
    date '2026-06-08', date '2026-06-10', date '2026-06-12',
    date '2026-06-15', date '2026-06-17', date '2026-06-19',
    date '2026-06-22', date '2026-06-24', date '2026-06-26',
    date '2026-06-29', date '2026-07-01', date '2026-07-03',
    date '2026-07-06', date '2026-07-08', date '2026-07-10',
    date '2026-07-13', date '2026-07-15'
  ] loop
    dow := extract(isodow from d);
    is_missed := d = date '2026-06-19';
    is_done := d < date '2026-07-03' and not is_missed;
    bump := case when d >= date '2026-06-22' then 2.5 else 0 end;

    insert into public.program_sessions (program_id, client_id, title, scheduled_for, status, completed_at, created_by)
    values (
      v_prog, v_client,
      case dow when 1 then 'Strength and steadiness A'
               when 3 then 'Engine and ease'
               else 'Strength and steadiness B' end,
      d,
      case when is_done then 'completed'::public.session_status
           when is_missed then 'missed'::public.session_status
           else 'scheduled'::public.session_status end,
      case when is_done then (d + time '18:00')::timestamptz end,
      v_cep
    )
    returning id into v_sess;

    if dow = 1 then
      insert into public.session_exercises
        (session_id, exercise_id, position, sets, reps, weight_kg, duration_min, notes, completed_at)
      values
        (v_sess, ex_cycle,     1, null, null, null,        10,   'Easy warm up',            case when is_done then (d + time '18:00')::timestamptz end),
        (v_sess, ex_goblet,    2, 3,    10,   10 + bump,   null, null,                      case when is_done then (d + time '18:00')::timestamptz end),
        (v_sess, ex_seatedrow, 3, 3,    12,   25 + bump,   null, null,                      case when is_done then (d + time '18:00')::timestamptz end),
        (v_sess, ex_chest,     4, 3,    10,   20 + bump,   null, null,                      case when is_done then (d + time '18:00')::timestamptz end),
        (v_sess, ex_plank,     5, 3,    null, null,        null, 'Hold 30 seconds each',    case when is_done then (d + time '18:00')::timestamptz end),
        (v_sess, ex_ham,       6, null, null, null,        5,    'Both sides',              case when is_done then (d + time '18:00')::timestamptz end);
    elsif dow = 3 then
      insert into public.session_exercises
        (session_id, exercise_id, position, sets, reps, weight_kg, duration_min, notes, completed_at)
      values
        (v_sess, ex_tread,    1, null, null, null, 25, 'Conversational pace',     case when is_done then (d + time '18:00')::timestamptz end),
        (v_sess, ex_row,      2, null, null, null, 10, 'Smooth and unhurried',    case when is_done then (d + time '18:00')::timestamptz end),
        (v_sess, ex_step,     3, 3,    10,   null, null, 'Each leg',              case when is_done then (d + time '18:00')::timestamptz end),
        (v_sess, ex_catcow,   4, null, null, null, 5,  null,                      case when is_done then (d + time '18:00')::timestamptz end),
        (v_sess, ex_shcircle, 5, null, null, null, 3,  null,                      case when is_done then (d + time '18:00')::timestamptz end);
    else
      insert into public.session_exercises
        (session_id, exercise_id, position, sets, reps, weight_kg, duration_min, notes, completed_at)
      values
        (v_sess, ex_ellip,    1, null, null, null,       8,    'Easy warm up',   case when is_done then (d + time '18:00')::timestamptz end),
        (v_sess, ex_legpress, 2, 3,    10,   60 + bump,  null, null,             case when is_done then (d + time '18:00')::timestamptz end),
        (v_sess, ex_latpull,  3, 3,    10,   30 + bump,  null, null,             case when is_done then (d + time '18:00')::timestamptz end),
        (v_sess, ex_shpress,  4, 3,    8,    7.5,        null, null,             case when is_done then (d + time '18:00')::timestamptz end),
        (v_sess, ex_bridge,   5, 3,    12,   null,       null, null,             case when is_done then (d + time '18:00')::timestamptz end),
        (v_sess, ex_hip,      6, null, null, null,       4,    'Both sides',     case when is_done then (d + time '18:00')::timestamptz end);
    end if;
  end loop;
end $$;

-- Body-figure demo: Beatrice Cole displays the female figure.
update public.clients set body_map = 'female'
where id = '11111111-0000-4000-8000-000000000002';
