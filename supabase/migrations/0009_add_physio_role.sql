-- Physiotherapists join the clinical team. The enum gains the value; the
-- clinical-role helper (text comparison against the JWT claim) includes it.
alter type public.role add value if not exists 'physio';

create or replace function public.is_clinical()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.jwt_role() in ('consultant', 'nurse', 'cep', 'physio', 'admin');
$$;
