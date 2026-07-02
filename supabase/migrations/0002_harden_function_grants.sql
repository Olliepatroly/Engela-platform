-- Postgres grants EXECUTE to PUBLIC by default on function creation, which left
-- the SECURITY DEFINER helpers callable by the anon role via PostgREST RPC.
-- Revoke that default so only authenticated sessions can call them.
revoke execute on function public.jwt_role() from public;
revoke execute on function public.is_clinical() from public;
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_on_care_team(uuid) from public;
revoke execute on function public.current_client_id() from public;

grant execute on function public.jwt_role() to authenticated;
grant execute on function public.is_clinical() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_on_care_team(uuid) to authenticated;
grant execute on function public.current_client_id() to authenticated;
