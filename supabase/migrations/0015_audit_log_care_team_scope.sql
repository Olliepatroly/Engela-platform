-- ============================================================================
-- 0015 — Scope the audit trail to the consented care team
-- ----------------------------------------------------------------------------
-- Until now audit_log_select_clinical let ANY clinical user read EVERY audit
-- row. The row's `meta` can hold special-category detail (metric codes, values)
-- tied to a client, so a clinician could read audit detail about clients
-- outside their care team. This tightens the read to:
--   * admins (full governance view), OR
--   * the actor's own actions, OR
--   * rows about a client on the viewer's care team WITH consent granted
--     (is_on_care_team already requires care_team.consent_at IS NOT NULL).
-- Rows with no resolvable client (MFA, profile, invite, library edits) stay
-- visible only to the actor and to admins.
-- ============================================================================

-- Pull the client a row concerns out of its shape. Every client-scoped write
-- puts the id in meta.client_id; consent events carry it in entity_id
-- (entity = 'care_team'). Pure computation (no table access), SECURITY INVOKER,
-- and the uuid-shape guard keeps a malformed value from breaking audit reads.
create or replace function public.audit_client_id(p_entity text, p_entity_id uuid, p_meta jsonb)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
declare
  v text;
begin
  v := p_meta ->> 'client_id';
  if v is not null and v ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return v::uuid;
  end if;
  if p_entity = 'care_team' then
    return p_entity_id;
  end if;
  return null;
end;
$$;

revoke execute on function public.audit_client_id(text, uuid, jsonb) from public, anon;
grant execute on function public.audit_client_id(text, uuid, jsonb) to authenticated;

drop policy if exists audit_log_select_clinical on public.audit_log;
create policy audit_log_select_clinical on public.audit_log
  for select to authenticated
  using (
    public.is_clinical()
    and (
      public.is_admin()
      or actor_id = (select auth.uid())
      or public.is_on_care_team(public.audit_client_id(entity, entity_id, meta))
    )
  );

-- Read paths filter and sort the trail by these.
create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id);
