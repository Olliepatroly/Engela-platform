-- ============================================================================
-- Session effort: aimed intensity + perceived effort (Borg CR10, 0 to 10)
-- ----------------------------------------------------------------------------
-- Each exercise in a session correlates to muscle groups (via exercises.
-- primary_muscles / secondary_muscles) and now carries two effort values on
-- the Borg CR10 scale:
--
--   * aimed_intensity   the target the clinician sets for the exercise
--                       (how hard it is meant to feel).
--   * perceived_effort  the client's own rating of how hard it actually felt
--                       (RPE), recorded from the client app body map.
--
-- The body map colours each worked region by the DIRECTION from perceived to
-- aimed (on plan / easier / harder), never by the raw number, so this is
-- comparison data, not a lab value: it is safe on both surfaces.
--
-- Same golden rules as 0001/0011: RLS stays on and deny-by-default. No new
-- write policy is added here. Reads are already covered by
-- session_exercises_select_team_or_own; writes go through the audited
-- service-role server action (recordPerceivedEffort / clinician aim setter),
-- exactly like completed_at in 0011. Clients never UPDATE the table directly.
-- ============================================================================

alter table public.session_exercises
  add column aimed_intensity     smallint,
  add column perceived_effort    smallint,
  add column effort_recorded_at  timestamptz;

alter table public.session_exercises
  add constraint session_exercises_aimed_intensity_range
    check (aimed_intensity is null or aimed_intensity between 0 and 10),
  add constraint session_exercises_perceived_effort_range
    check (perceived_effort is null or perceived_effort between 0 and 10);

comment on column public.session_exercises.aimed_intensity is
  'Clinician-set target effort for this exercise on the Borg CR10 scale (0 to 10).';
comment on column public.session_exercises.perceived_effort is
  'Client-recorded rating of perceived exertion (RPE) on the Borg CR10 scale (0 to 10).';
comment on column public.session_exercises.effort_recorded_at is
  'When perceived_effort was last set by (or on behalf of) the client.';
