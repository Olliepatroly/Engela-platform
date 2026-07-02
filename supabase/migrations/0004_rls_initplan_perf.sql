-- Wrap auth.uid() in a subselect so Postgres evaluates it once per query instead
-- of once per row. Same security semantics, better plan.
drop policy profiles_select_self_or_clinical on public.profiles;
create policy profiles_select_self_or_clinical on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_clinical());

drop policy clients_select_own_or_care_team on public.clients;
create policy clients_select_own_or_care_team on public.clients
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.is_on_care_team(id)
  );

drop policy care_team_select_clinical on public.care_team;
create policy care_team_select_clinical on public.care_team
  for select to authenticated
  using (clinician_id = (select auth.uid()) or public.is_admin());
