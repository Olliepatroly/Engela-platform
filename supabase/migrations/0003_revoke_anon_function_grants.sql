-- Supabase's default privileges grant EXECUTE to anon/authenticated/service_role
-- explicitly on function creation (not just via the PUBLIC pseudo-role), which is
-- why revoking from PUBLIC alone didn't remove anon's access. These helpers are
-- internal to RLS policy evaluation and have no legitimate unauthenticated caller,
-- so anon is revoked outright; authenticated keeps EXECUTE (required for RLS
-- policies to evaluate under the authenticated role during normal API queries).
revoke execute on function public.jwt_role() from anon;
revoke execute on function public.is_clinical() from anon;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.is_on_care_team(uuid) from anon;
revoke execute on function public.current_client_id() from anon;
