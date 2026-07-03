-- Team requests with display names for everyone involved. The RLS policy on
-- team_requests already scopes rows to the people involved; this SECURITY
-- DEFINER projection adds the names (a requesting client's name is not
-- otherwise readable by a clinician who is not yet on their care team, and
-- vice versa). Directory-safe fields only: names, role, discipline.
create or replace function public.my_team_requests()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', tr.id,
    'kind', tr.kind,
    'status', tr.status,
    'message', tr.message,
    'created_at', tr.created_at,
    'client_id', tr.client_id,
    'client_name', cp.full_name,
    'clinician_id', tr.clinician_id,
    'clinician_name', clp.full_name,
    'clinician_role', clp.role,
    'clinician_discipline', cl.discipline,
    'requested_by', tr.requested_by,
    'requested_by_name', rp.full_name
  ) order by tr.created_at desc), '[]'::jsonb)
  from public.team_requests tr
  join public.clients c on c.id = tr.client_id
  join public.profiles cp on cp.id = c.profile_id
  join public.profiles clp on clp.id = tr.clinician_id
  left join public.clinicians cl on cl.profile_id = tr.clinician_id
  join public.profiles rp on rp.id = tr.requested_by
  where tr.requested_by = (select auth.uid())
     or tr.clinician_id = (select auth.uid())
     or tr.client_id = public.current_client_id();
$$;

revoke execute on function public.my_team_requests() from public;
revoke execute on function public.my_team_requests() from anon;
grant execute on function public.my_team_requests() to authenticated;
