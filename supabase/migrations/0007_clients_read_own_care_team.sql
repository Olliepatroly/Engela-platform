-- The consent manager on the client account page lists who has access: a
-- client can read the care_team rows for their own record (and the profiles
-- policy already lets them read their own profile; clinician names on the
-- care team are exposed to the client via a narrow SECURITY DEFINER helper
-- rather than widening profiles access).
create policy care_team_select_own_client on public.care_team
  for select to authenticated
  using (client_id = public.current_client_id());

-- Names + disciplines of the calling client's own care team, without granting
-- general profiles/clinicians SELECT to clients.
create or replace function public.my_care_team()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'clinician_id', ct.clinician_id,
    'full_name', p.full_name,
    'discipline', cl.discipline,
    'relationship', ct.relationship,
    'consent_at', ct.consent_at
  ) order by p.full_name), '[]'::jsonb)
  from public.care_team ct
  join public.profiles p on p.id = ct.clinician_id
  left join public.clinicians cl on cl.profile_id = ct.clinician_id
  where ct.client_id = public.current_client_id();
$$;

revoke execute on function public.my_care_team() from public;
revoke execute on function public.my_care_team() from anon;
grant execute on function public.my_care_team() to authenticated;
