-- ==============================================================================
-- MIGRACIÓN: MULTI-TENANT ISOLATION (RLS) & SISTEMA DE INVITACIONES
-- Ejecuta este script en el SQL Editor de Supabase
-- ==============================================================================

-- 1. FUNCIÓN HELPER PARA VERIFICAR MEMBRESÍA EN LA ORGANIZACIÓN
-- SECURITY DEFINER corre con privilegios de sistema, evitando recursión en RLS.
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from organization_members
    where organization_id = org_id
      and user_id = auth.uid()
  );
$$;

-- 2. FUNCIÓN HELPER PARA VERIFICAR SI ES OWNER O ADMIN DE LA ORGANIZACIÓN
create or replace function public.is_org_admin_or_owner(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- ==============================================================================
-- 3. POLICIES PARA ORGANIZATIONS Y ORGANIZATION_MEMBERS
-- ==============================================================================

-- Organizations
alter table organizations enable row level security;
drop policy if exists "Lectura organizaciones del usuario" on organizations;
drop policy if exists "Crear organizaciones autenticados" on organizations;
drop policy if exists "Actualizar organizaciones" on organizations;
drop policy if exists "Eliminar organizaciones" on organizations;

create policy "Lectura organizaciones del usuario" on organizations
  for select using (
    public.is_org_member(id)
  );

create policy "Crear organizaciones autenticados" on organizations
  for insert with check (
    auth.role() = 'authenticated'
  );

create policy "Actualizar organizaciones" on organizations
  for update using (
    public.is_org_admin_or_owner(id)
  );

create policy "Eliminar organizaciones" on organizations
  for delete using (
    exists (
      select 1 from organization_members
      where organization_id = organizations.id
        and user_id = auth.uid()
        and role = 'owner'
    )
  );

-- Organization Members
alter table organization_members enable row level security;
drop policy if exists "Lectura members" on organization_members;
drop policy if exists "Insertar members" on organization_members;
drop policy if exists "Insertar primer miembro (owner) de una org nueva" on organization_members;
drop policy if exists "Eliminar members" on organization_members;
drop policy if exists "Actualizar members" on organization_members;

create policy "Lectura members" on organization_members
  for select using (
    public.is_org_member(organization_id)
  );

-- Permite auto-insertarse como 'owner' al crear una org NUEVA (sin miembros aún)
create policy "Insertar primer miembro (owner) de una org nueva" on organization_members
  for insert with check (
    auth.uid() = user_id
    and role = 'owner'
    and not exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
    )
  );

-- Permite a admins y owners eliminar miembros (o al propio usuario salirse de la org)
create policy "Eliminar members" on organization_members
  for delete using (
    user_id = auth.uid() or public.is_org_admin_or_owner(organization_id)
  );

create policy "Actualizar members" on organization_members
  for update using (
    public.is_org_admin_or_owner(organization_id)
  );

-- ==============================================================================
-- 4. POLICIES PARA TODAS LAS ENTIDADES DE LA ORGANIZACIÓN
-- ==============================================================================

-- DEPARTMENTS
alter table departments enable row level security;
drop policy if exists "Permitir lectura departamentos" on departments;
drop policy if exists "Permitir insercion departamentos" on departments;
drop policy if exists "Permitir actualizacion departamentos" on departments;
drop policy if exists "Permitir eliminacion departamentos" on departments;

create policy "Permitir lectura departamentos" on departments
  for select using (public.is_org_member(organization_id));
create policy "Permitir insercion departamentos" on departments
  for insert with check (public.is_org_member(organization_id));
create policy "Permitir actualizacion departamentos" on departments
  for update using (public.is_org_member(organization_id));
create policy "Permitir eliminacion departamentos" on departments
  for delete using (public.is_org_member(organization_id));

-- POSITIONS
alter table positions enable row level security;
drop policy if exists "Permitir lectura cargos" on positions;
drop policy if exists "Permitir insercion cargos" on positions;
drop policy if exists "Permitir actualizacion cargos" on positions;
drop policy if exists "Permitir eliminacion cargos" on positions;

create policy "Permitir lectura cargos" on positions
  for select using (public.is_org_member(organization_id));
create policy "Permitir insercion cargos" on positions
  for insert with check (public.is_org_member(organization_id));
create policy "Permitir actualizacion cargos" on positions
  for update using (public.is_org_member(organization_id));
create policy "Permitir eliminacion cargos" on positions
  for delete using (public.is_org_member(organization_id));

-- HOLIDAYS
alter table holidays enable row level security;
drop policy if exists "Permitir lectura feriados" on holidays;
drop policy if exists "Permitir insercion feriados" on holidays;
drop policy if exists "Permitir actualizacion feriados" on holidays;
drop policy if exists "Permitir eliminacion feriados" on holidays;

create policy "Permitir lectura feriados" on holidays
  for select using (public.is_org_member(organization_id));
create policy "Permitir insercion feriados" on holidays
  for insert with check (public.is_org_member(organization_id));
create policy "Permitir actualizacion feriados" on holidays
  for update using (public.is_org_member(organization_id));
create policy "Permitir eliminacion feriados" on holidays
  for delete using (public.is_org_member(organization_id));

-- EMPLOYEES
alter table employees enable row level security;
drop policy if exists "Permitir lectura empleados" on employees;
drop policy if exists "Permitir insercion empleados" on employees;
drop policy if exists "Permitir actualizacion empleados" on employees;
drop policy if exists "Permitir eliminacion empleados" on employees;

create policy "Permitir lectura empleados" on employees
  for select using (public.is_org_member(organization_id));
create policy "Permitir insercion empleados" on employees
  for insert with check (public.is_org_member(organization_id));
create policy "Permitir actualizacion empleados" on employees
  for update using (public.is_org_member(organization_id));
create policy "Permitir eliminacion empleados" on employees
  for delete using (public.is_org_member(organization_id));

-- EMPLOYEE_SALARIES
alter table employee_salaries enable row level security;
drop policy if exists "Permitir lectura salarios" on employee_salaries;
drop policy if exists "Permitir insercion salarios" on employee_salaries;
drop policy if exists "Permitir actualizacion salarios" on employee_salaries;
drop policy if exists "Permitir eliminacion salarios" on employee_salaries;

create policy "Permitir lectura salarios" on employee_salaries
  for select using (public.is_org_member(organization_id));
create policy "Permitir insercion salarios" on employee_salaries
  for insert with check (public.is_org_member(organization_id));
create policy "Permitir actualizacion salarios" on employee_salaries
  for update using (public.is_org_member(organization_id));
create policy "Permitir eliminacion salarios" on employee_salaries
  for delete using (public.is_org_member(organization_id));

-- EMPLOYEE_SCHEDULES
alter table employee_schedules enable row level security;
drop policy if exists "Permitir lectura horarios" on employee_schedules;
drop policy if exists "Permitir insercion horarios" on employee_schedules;
drop policy if exists "Permitir actualizacion horarios" on employee_schedules;
drop policy if exists "Permitir eliminacion horarios" on employee_schedules;

create policy "Permitir lectura horarios" on employee_schedules
  for select using (public.is_org_member(organization_id));
create policy "Permitir insercion horarios" on employee_schedules
  for insert with check (public.is_org_member(organization_id));
create policy "Permitir actualizacion horarios" on employee_schedules
  for update using (public.is_org_member(organization_id));
create policy "Permitir eliminacion horarios" on employee_schedules
  for delete using (public.is_org_member(organization_id));

-- INCIDENTS
alter table incidents enable row level security;
drop policy if exists "Permitir lectura incidencias" on incidents;
drop policy if exists "Permitir insercion incidencias" on incidents;
drop policy if exists "Permitir actualizacion incidencias" on incidents;
drop policy if exists "Permitir eliminacion incidencias" on incidents;

create policy "Permitir lectura incidencias" on incidents
  for select using (public.is_org_member(organization_id));
create policy "Permitir insercion incidencias" on incidents
  for insert with check (public.is_org_member(organization_id));
create policy "Permitir actualizacion incidencias" on incidents
  for update using (public.is_org_member(organization_id));
create policy "Permitir eliminacion incidencias" on incidents
  for delete using (public.is_org_member(organization_id));

-- SHIFT_REQUESTS
alter table shift_requests enable row level security;
drop policy if exists "Permitir lectura shift_requests" on shift_requests;
drop policy if exists "Permitir insercion shift_requests" on shift_requests;
drop policy if exists "Permitir actualizacion shift_requests" on shift_requests;
drop policy if exists "Permitir eliminacion shift_requests" on shift_requests;

create policy "Permitir lectura shift_requests" on shift_requests
  for select using (public.is_org_member(organization_id));
create policy "Permitir insercion shift_requests" on shift_requests
  for insert with check (public.is_org_member(organization_id));
create policy "Permitir actualizacion shift_requests" on shift_requests
  for update using (public.is_org_member(organization_id));
create policy "Permitir eliminacion shift_requests" on shift_requests
  for delete using (public.is_org_member(organization_id));

-- DEDUCTIONS
alter table deductions enable row level security;
drop policy if exists "Permitir lectura deductions" on deductions;
drop policy if exists "Permitir insercion deductions" on deductions;
drop policy if exists "Permitir actualizacion deductions" on deductions;
drop policy if exists "Permitir eliminacion deductions" on deductions;

create policy "Permitir lectura deductions" on deductions
  for select using (public.is_org_member(organization_id));
create policy "Permitir insercion deductions" on deductions
  for insert with check (public.is_org_member(organization_id));
create policy "Permitir actualizacion deductions" on deductions
  for update using (public.is_org_member(organization_id));
create policy "Permitir eliminacion deductions" on deductions
  for delete using (public.is_org_member(organization_id));

-- PAYROLL_REPORTS
alter table payroll_reports enable row level security;
drop policy if exists "Permitir lectura payroll_reports" on payroll_reports;
drop policy if exists "Permitir insercion payroll_reports" on payroll_reports;
drop policy if exists "Permitir actualizacion payroll_reports" on payroll_reports;
drop policy if exists "Permitir eliminacion payroll_reports" on payroll_reports;

create policy "Permitir lectura payroll_reports" on payroll_reports
  for select using (public.is_org_member(organization_id));
create policy "Permitir insercion payroll_reports" on payroll_reports
  for insert with check (public.is_org_member(organization_id));
create policy "Permitir actualizacion payroll_reports" on payroll_reports
  for update using (public.is_org_member(organization_id));
create policy "Permitir eliminacion payroll_reports" on payroll_reports
  for delete using (public.is_org_member(organization_id));

-- EMPLOYEE_DOCUMENTS
alter table employee_documents enable row level security;
drop policy if exists "Permitir lectura employee_documents" on employee_documents;
drop policy if exists "Permitir insercion employee_documents" on employee_documents;
drop policy if exists "Permitir actualizacion employee_documents" on employee_documents;
drop policy if exists "Permitir eliminacion employee_documents" on employee_documents;

create policy "Permitir lectura employee_documents" on employee_documents
  for select using (public.is_org_member(organization_id));
create policy "Permitir insercion employee_documents" on employee_documents
  for insert with check (public.is_org_member(organization_id));
create policy "Permitir actualizacion employee_documents" on employee_documents
  for update using (public.is_org_member(organization_id));
create policy "Permitir eliminacion employee_documents" on employee_documents
  for delete using (public.is_org_member(organization_id));


-- ==============================================================================
-- 5. TABLA DE INVITACIONES A ORGANIZACIONES (ORGANIZATION_INVITATIONS)
-- ==============================================================================

create table if not exists organization_invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email           text not null,
  role            text not null default 'member' check (role in ('admin', 'member')),
  token           text unique not null,
  invited_by      uuid references auth.users(id) on delete set null,
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at      timestamptz not null default (now() + interval '7 days'),
  created_at      timestamptz not null default now(),
  unique(organization_id, email, status)
);

alter table organization_invitations enable row level security;

drop policy if exists "Ver invitaciones de la organizacion o dirigidas al email" on organization_invitations;
create policy "Ver invitaciones de la organizacion o dirigidas al email" on organization_invitations
  for select using (
    public.is_org_admin_or_owner(organization_id)
    or lower(email) = lower(auth.jwt() ->> 'email')
  );

drop policy if exists "Crear invitaciones administradores" on organization_invitations;
create policy "Crear invitaciones administradores" on organization_invitations
  for insert with check (
    public.is_org_admin_or_owner(organization_id)
  );

drop policy if exists "Actualizar invitaciones administradores" on organization_invitations;
create policy "Actualizar invitaciones administradores" on organization_invitations
  for update using (
    public.is_org_admin_or_owner(organization_id)
  );

drop policy if exists "Eliminar invitaciones administradores" on organization_invitations;
create policy "Eliminar invitaciones administradores" on organization_invitations
  for delete using (
    public.is_org_admin_or_owner(organization_id)
  );

-- ==============================================================================
-- 6. FUNCIÓN RPC PARA ACEPTAR INVITACIÓN (TRANSACCIONAL Y SEGURA)
-- ==============================================================================

create or replace function public.accept_organization_invitation(invitation_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite organization_invitations%rowtype;
  v_user_id uuid;
  v_user_email text;
  v_org_name text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Debes iniciar sesión para aceptar la invitación.');
  end if;

  v_user_email := auth.jwt() ->> 'email';

  -- Buscar invitación válida
  select * into v_invite
  from organization_invitations
  where token = invitation_token
    and status = 'pending'
    and expires_at > now();

  if not found then
    return json_build_object('success', false, 'error', 'La invitación no es válida o ha expirado.');
  end if;

  -- Comprobar si el correo coincide
  if lower(v_invite.email) <> lower(v_user_email) then
    return json_build_object('success', false, 'error', 'Esta invitación fue enviada para ' || v_invite.email || ' pero tu sesión actual es ' || coalesce(v_user_email, 'desconocida'));
  end if;

  -- Insertar o actualizar membresía
  insert into organization_members (organization_id, user_id, role)
  values (v_invite.organization_id, v_user_id, v_invite.role)
  on conflict (organization_id, user_id)
  do update set role = excluded.role;

  -- Marcar invitación como aceptada
  update organization_invitations
  set status = 'accepted'
  where id = v_invite.id;

  select name into v_org_name from organizations where id = v_invite.organization_id;

  return json_build_object(
    'success', true,
    'organization_id', v_invite.organization_id,
    'organization_name', v_org_name,
    'role', v_invite.role
  );
end;
$$;
