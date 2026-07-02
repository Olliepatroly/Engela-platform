-- ============================================================================
-- DEMO seed — sample accounts + worked-example patient (HCA-MM-0142, week 32)
-- ----------------------------------------------------------------------------
-- Applied to the live project on 2026-07-02. Kept for the record / re-seeding.
-- ALL of this is clearly-labelled sample data for demonstrations, not real
-- patient records. The auth users were created first via the Auth Admin API
-- (email_confirm: true, app_metadata.role set), which produced the fixed UUIDs
-- below. If re-seeding a fresh project, create the auth users first and
-- substitute their ids.
--
-- Demo sign-ins (password EngelaDemo2026! — rotate before any real use):
--   demo.consultant@engelahealth.com  consultant  Dr Emily Hartley
--   demo.cep@engelahealth.com         cep         Daniel Ross
--   demo.client@engelahealth.com      client      Michael Mercer (HCA-MM-0142)
-- Roster-only patients (random throwaway passwords, nobody signs in):
--   demo.patient2@engelahealth.com    client      Beatrice Cole  (HCA-BC-0087)
--   demo.patient3@engelahealth.com    client      Peter Curtis   (HCA-PC-0203)
--   demo.patient4@engelahealth.com    client      Leo Yates      (HCA-LY-0011)
-- ============================================================================

insert into public.profiles (id, role, full_name, email) values
  ('4734ba30-b0f0-42b6-ab6f-2a07469fcde8', 'consultant', 'Dr Emily Hartley', 'demo.consultant@engelahealth.com'),
  ('f4dee8ed-cb33-4bbe-aeb0-b4b61da86f9e', 'cep',        'Daniel Ross',      'demo.cep@engelahealth.com'),
  ('2215ec8e-dac4-4388-861b-95a4f13edfc1', 'client',     'Michael Mercer',   'demo.client@engelahealth.com'),
  ('eec630f6-a3e4-4e0f-a467-8bf8046aa8ab', 'client',     'Beatrice Cole',    'demo.patient2@engelahealth.com'),
  ('e214c8ca-2175-42c8-b435-1604d286500a', 'client',     'Peter Curtis',     'demo.patient3@engelahealth.com'),
  ('b5055a5a-4e36-4d26-a002-9ff1d94e2dc6', 'client',     'Leo Yates',        'demo.patient4@engelahealth.com');

insert into public.clinicians (profile_id, discipline, registration_no) values
  ('4734ba30-b0f0-42b6-ab6f-2a07469fcde8', 'Consultant Haematologist', 'GMC 7012345 (sample)'),
  ('f4dee8ed-cb33-4bbe-aeb0-b4b61da86f9e', 'Clinical Exercise Physiologist', 'RCCP 20481 (sample)');

insert into public.clients (id, profile_id, mrn, diagnosis, treatment_phase, consultant_id, rehab_lead_id, programme_week, baseline_week, status) values
  ('11111111-0000-4000-8000-000000000001', '2215ec8e-dac4-4388-861b-95a4f13edfc1', 'HCA-MM-0142', 'Multiple myeloma', 'Maintenance, post-ASCT', '4734ba30-b0f0-42b6-ab6f-2a07469fcde8', 'f4dee8ed-cb33-4bbe-aeb0-b4b61da86f9e', 32, 1, 'active'),
  ('11111111-0000-4000-8000-000000000002', 'eec630f6-a3e4-4e0f-a467-8bf8046aa8ab', 'HCA-BC-0087', 'Breast cancer', 'Adjuvant endocrine therapy', '4734ba30-b0f0-42b6-ab6f-2a07469fcde8', 'f4dee8ed-cb33-4bbe-aeb0-b4b61da86f9e', 14, 1, 'active'),
  ('11111111-0000-4000-8000-000000000003', 'e214c8ca-2175-42c8-b435-1604d286500a', 'HCA-PC-0203', 'Prostate cancer', 'Active surveillance', '4734ba30-b0f0-42b6-ab6f-2a07469fcde8', 'f4dee8ed-cb33-4bbe-aeb0-b4b61da86f9e', 6, 1, 'active'),
  ('11111111-0000-4000-8000-000000000004', 'b5055a5a-4e36-4d26-a002-9ff1d94e2dc6', 'HCA-LY-0011', 'Hodgkin lymphoma', 'Post-treatment surveillance', '4734ba30-b0f0-42b6-ab6f-2a07469fcde8', 'f4dee8ed-cb33-4bbe-aeb0-b4b61da86f9e', 45, 1, 'active');

-- Consultant on all four care teams; the CEP only on the worked example —
-- demonstrates care-team-scoped RLS (the CEP's roster shows one patient).
insert into public.care_team (client_id, clinician_id, relationship, consent_at) values
  ('11111111-0000-4000-8000-000000000001', '4734ba30-b0f0-42b6-ab6f-2a07469fcde8', 'Consultant', now()),
  ('11111111-0000-4000-8000-000000000001', 'f4dee8ed-cb33-4bbe-aeb0-b4b61da86f9e', 'Rehab lead', now()),
  ('11111111-0000-4000-8000-000000000002', '4734ba30-b0f0-42b6-ab6f-2a07469fcde8', 'Consultant', now()),
  ('11111111-0000-4000-8000-000000000003', '4734ba30-b0f0-42b6-ab6f-2a07469fcde8', 'Consultant', now()),
  ('11111111-0000-4000-8000-000000000004', '4734ba30-b0f0-42b6-ab6f-2a07469fcde8', 'Consultant', now());

insert into public.weekly_reviews (id, client_id, week_no, window_start, window_end, composite_score, status, context, issued_at, issued_by) values
  ('22222222-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 32,
   '2026-06-22', '2026-06-28', 8.0, 'watch',
   '{"diagnosis":"Multiple myeloma","treatment_phase":"Maintenance, post-ASCT","mrd":"MRD negative (10^-5), May 2026","qol":"EORTC QLQ-C30: 72/100","sessions_attended":"31 of 32 weeks"}'::jsonb,
   '2026-06-29T09:00:00Z', 'f4dee8ed-cb33-4bbe-aeb0-b4b61da86f9e'),
  ('22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002', 14,
   '2026-06-22', '2026-06-28', 8.4, 'on_track',
   '{"diagnosis":"Breast cancer","treatment_phase":"Adjuvant endocrine therapy","qol":"EORTC QLQ-C30: 78/100","sessions_attended":"14 of 14 weeks"}'::jsonb,
   '2026-06-29T09:00:00Z', 'f4dee8ed-cb33-4bbe-aeb0-b4b61da86f9e'),
  ('22222222-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000003', 6,
   '2026-06-22', '2026-06-28', 6.9, 'watch',
   '{"diagnosis":"Prostate cancer","treatment_phase":"Active surveillance","qol":"EORTC QLQ-C30: 66/100","sessions_attended":"5 of 6 weeks"}'::jsonb,
   '2026-06-29T09:00:00Z', 'f4dee8ed-cb33-4bbe-aeb0-b4b61da86f9e'),
  ('22222222-0000-4000-8000-000000000004', '11111111-0000-4000-8000-000000000004', 45,
   '2026-06-22', '2026-06-28', 8.8, 'on_track',
   '{"diagnosis":"Hodgkin lymphoma","treatment_phase":"Post-treatment surveillance","qol":"EORTC QLQ-C30: 84/100","sessions_attended":"44 of 45 weeks"}'::jsonb,
   '2026-06-29T09:00:00Z', 'f4dee8ed-cb33-4bbe-aeb0-b4b61da86f9e');

insert into public.pillar_scores (review_id, pillar, score, baseline) values
  ('22222222-0000-4000-8000-000000000001', 'exercise',  8.6, 6.2),
  ('22222222-0000-4000-8000-000000000001', 'nutrition', 8.4, 7.0),
  ('22222222-0000-4000-8000-000000000001', 'immune',    7.1, 6.8);

insert into public.metric_readings (review_id, metric_code, current, previous, delta, status, history) values
  ('22222222-0000-4000-8000-000000000001', 'lean_muscle_mass', 57.2, 56.8, 0.4, 'on_track',
   '[55.1,55.3,55.6,55.9,56.0,56.2,56.1,56.4,56.5,56.6,56.8,57.2]'::jsonb),
  ('22222222-0000-4000-8000-000000000001', 'grip_strength', 54, 53, 1, 'on_track',
   '[50,50,51,51,52,52,52,53,53,53,53,54]'::jsonb),
  ('22222222-0000-4000-8000-000000000001', 'vo2_max', 51.8, 51.2, 0.6, 'watch',
   '[48.9,49.2,49.6,49.8,50.1,50.4,50.6,50.8,51.0,51.1,51.2,51.8]'::jsonb),
  ('22222222-0000-4000-8000-000000000001', 'resting_hr', 64, 66, -2, 'on_track',
   '[71,70,70,69,68,68,67,67,66,66,66,64]'::jsonb),
  ('22222222-0000-4000-8000-000000000001', 'activity_sessions', 19, 17, 2, 'on_track',
   '[14,15,16,16,17,18,17,18,18,17,17,19]'::jsonb),
  ('22222222-0000-4000-8000-000000000001', 'active_time', 945, 910, 35, 'on_track',
   '[780,800,820,850,860,880,890,900,905,900,910,945]'::jsonb),
  ('22222222-0000-4000-8000-000000000001', 'protein_intake', 1.4, 1.3, 0.1, 'on_track',
   '[1.1,1.2,1.2,1.2,1.3,1.3,1.3,1.4,1.3,1.3,1.3,1.4]'::jsonb),
  ('22222222-0000-4000-8000-000000000001', 'visceral_fat', 4.6, 4.8, -0.2, 'on_track',
   '[5.6,5.5,5.4,5.3,5.2,5.1,5.0,4.9,4.9,4.8,4.8,4.6]'::jsonb),
  ('22222222-0000-4000-8000-000000000001', 'neutrophils', 1.8, 1.7, 0.1, 'on_track',
   '[1.5,1.6,1.6,1.5,1.6,1.7,1.6,1.7,1.7,1.6,1.7,1.8]'::jsonb),
  ('22222222-0000-4000-8000-000000000001', 'crp', 6.2, 4.1, 2.1, 'watch',
   '[3.2,3.0,3.4,2.9,3.1,3.3,3.0,3.5,3.8,3.9,4.1,6.2]'::jsonb),
  ('22222222-0000-4000-8000-000000000001', 'hrv', 58, 61, -3, 'watch',
   '[52,53,55,56,58,60,61,62,63,62,61,58]'::jsonb),
  ('22222222-0000-4000-8000-000000000001', 'sleep', 5.9, 6.8, -0.9, 'flag',
   '[7.4,7.5,7.3,7.6,7.4,7.2,7.5,7.3,7.1,7.0,6.8,5.9]'::jsonb);

insert into public.actions_flags (review_id, text, is_flag, severity, client_visible) values
  ('22222222-0000-4000-8000-000000000001',
   'Sleep below 6 hours alongside falling HRV for 2 consecutive weeks: review sleep hygiene, screen for maintenance-related fatigue and discuss at Thursday MDT.',
   true, 'moderate', false),
  ('22222222-0000-4000-8000-000000000001',
   'Repeat CRP with next scheduled bloods: raised at 6.2 mg/L, consistent with the mild upper respiratory infection reported on day 3.',
   false, null, false),
  ('22222222-0000-4000-8000-000000000001',
   'Keep protein at 1.3 to 1.5 g per kg each day: three palm-sized portions across the day works well.',
   false, null, true),
  ('22222222-0000-4000-8000-000000000001',
   'Ease this week''s sessions back to a comfortable effort and protect a wind-down hour before bed: rest is part of the programme, not a pause from it.',
   false, null, true);

insert into public.labs (client_id, taken_at, panel) values
  ('11111111-0000-4000-8000-000000000001', '2026-06-24T08:30:00Z',
   '{"flc_ratio":"1.1 (normal)","paraprotein":"Not detected","hb":"13.8 g/dL","neutrophils":"1.8 x10^9/L","crp":"6.2 mg/L","source":"Sample data for demonstration"}'::jsonb);

-- ── Added 2026-07-02 (second wave): more clinicians for the community ──
-- demo.consultant2@engelahealth.com  consultant  Dr Priya Sharma
-- demo.physio@engelahealth.com       physio      Tom Whitfield
insert into public.profiles (id, role, full_name, email) values
  ('419dfa98-2c49-41af-a719-0c2ddc6a28b6', 'consultant', 'Dr Priya Sharma', 'demo.consultant2@engelahealth.com'),
  ('6a0d6159-c45b-4cec-8652-674f6abf4093', 'physio',     'Tom Whitfield',   'demo.physio@engelahealth.com');

insert into public.clinicians (profile_id, discipline, registration_no) values
  ('419dfa98-2c49-41af-a719-0c2ddc6a28b6', 'Consultant Oncologist', 'GMC 7098765 (sample)'),
  ('6a0d6159-c45b-4cec-8652-674f6abf4093', 'Physiotherapist', 'HCPC PH123456 (sample)');

insert into public.care_team (client_id, clinician_id, relationship, consent_at) values
  ('11111111-0000-4000-8000-000000000001', '419dfa98-2c49-41af-a719-0c2ddc6a28b6', 'Consultant', now()),
  ('11111111-0000-4000-8000-000000000001', '6a0d6159-c45b-4cec-8652-674f6abf4093', 'Physiotherapist', now()),
  ('11111111-0000-4000-8000-000000000003', '6a0d6159-c45b-4cec-8652-674f6abf4093', 'Physiotherapist', now()),
  ('11111111-0000-4000-8000-000000000004', '419dfa98-2c49-41af-a719-0c2ddc6a28b6', 'Consultant', now());
