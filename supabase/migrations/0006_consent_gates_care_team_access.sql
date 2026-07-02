-- Consent becomes load-bearing: a clinician's row on care_team only grants
-- data access while consent_at is set. A client withdrawing consent (set to
-- null) removes the clinician's access everywhere is_on_care_team() is used.
-- Admin retains oversight access.
create or replace function public.is_on_care_team(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.care_team ct
    where ct.client_id = p_client
      and ct.clinician_id = auth.uid()
      and ct.consent_at is not null
  ) or public.is_admin();
$$;
