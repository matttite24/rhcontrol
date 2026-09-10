-- ==============================================================================
-- RPC: LISTAR MIEMBROS DE UNA ORGANIZACIÓN CON SU CORREO
-- Ejecuta este script en el SQL Editor de Supabase
-- ==============================================================================
--
-- organization_members no guarda el email, y la RLS no permite leer
-- auth.users desde el cliente. Este RPC (security definer) une ambas
-- tablas y expone el correo, pero SÓLO si quien llama es miembro de
-- esa organización (se valida con public.is_org_member).

create or replace function public.get_organization_members_with_email(org_id uuid)
returns table (
  id              uuid,
  organization_id uuid,
  user_id         uuid,
  role            text,
  created_at      timestamptz,
  email           text
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_org_member(org_id) then
    raise exception 'No autorizado para ver los miembros de esta organización.';
  end if;

  return query
  select
    m.id,
    m.organization_id,
    m.user_id,
    m.role::text,
    m.created_at,
    u.email::text
  from organization_members m
  join auth.users u on u.id = m.user_id
  where m.organization_id = org_id
  order by m.created_at asc;
end;
$$;

grant execute on function public.get_organization_members_with_email(uuid) to authenticated;
