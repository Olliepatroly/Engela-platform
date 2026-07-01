-- ============================================================================
-- Seed data — Engela Health Clinical Platform
-- ----------------------------------------------------------------------------
-- Phase 0 seeds the metrics_catalog REFERENCE data only (the 12 metric
-- definitions that drive the status engine + the "estimate" caveat). This is
-- config, not patient data.
--
-- Phase 1 adds the worked-example patient (HCA-MM-0142, week 32) with the 12
-- metric values + 12-week histories, pillar scores, actions and the sleep flag,
-- plus the 3 sample roster patients — all clearly sample data, not real records.
-- Values come from the brief's Appendix B.
-- ============================================================================

-- target_def kinds:
--   { "kind": "floor",   "value": n }            -- at/above value is good
--   { "kind": "ceiling", "value": n }            -- at/below value is good
--   { "kind": "range",   "min": a, "max": b }    -- inside [a,b] is good

insert into public.metrics_catalog (code, pillar, name, client_label, unit, target_def, direction_of_benefit, is_estimate) values
  ('lean_muscle_mass', 'exercise', 'Lean muscle mass',      'Muscle',          'kg',          '{"kind":"floor","value":56.0}',        'higher', false),
  ('grip_strength',    'exercise', 'Grip strength',         'Grip strength',   'kg',          '{"kind":"floor","value":52}',          'higher', false),
  ('vo2_max',          'exercise', 'VO2 max',               'Stamina',         'ml/kg/min',   '{"kind":"floor","value":54}',          'higher', true),
  ('resting_hr',       'exercise', 'Resting HR',            'Resting heart rate', 'bpm',      '{"kind":"ceiling","value":70}',        'lower',  false),
  ('activity_sessions','exercise', 'Activity sessions / wk', 'Active sessions', 'per week',   '{"kind":"floor","value":18}',          'higher', false),
  ('active_time',      'exercise', 'Active time',           'Active time',     'hh:mm/wk',    '{"kind":"floor","value":900}',         'higher', false),
  ('protein_intake',   'nutrition','Protein intake',        'Protein',         'g/kg/day',    '{"kind":"range","min":1.3,"max":1.5}', 'range',  false),
  ('visceral_fat',     'nutrition','Visceral fat',          'Visceral fat',    'kg',          '{"kind":"ceiling","value":5.0}',       'lower',  false),
  ('neutrophils',      'immune',   'Neutrophils',           null,              'x10^9/L',     '{"kind":"floor","value":1.5}',         'higher', false),
  ('crp',              'immune',   'CRP',                   null,              'mg/L',        '{"kind":"ceiling","value":5}',         'lower',  false),
  ('hrv',              'immune',   'HRV',                   'Recovery',        'ms',          '{"kind":"floor","value":55}',          'higher', true),
  ('sleep',            'immune',   'Sleep',                 'Sleep',           'hrs/night',   '{"kind":"range","min":7,"max":9}',     'range',  true)
on conflict (code) do nothing;
