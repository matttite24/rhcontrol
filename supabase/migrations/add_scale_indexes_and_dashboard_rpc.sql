-- ==============================================================================
-- ÍNDICES DE ESCALA + RPC AGREGADO PARA EL DASHBOARD
-- Ejecuta este script en el SQL Editor de Supabase
-- ==============================================================================
--
-- Contexto: todas las tablas multi-tenant se filtran por organization_id en
-- cada query (RLS + WHERE explícito). Con pocos datos esto es imperceptible;
-- con miles de filas por organización, sin índice cada query hace un seq scan
-- sobre TODA la tabla (todas las organizaciones), no solo la del usuario.
--
-- Estos CREATE INDEX son seguros de re-ejecutar (IF NOT EXISTS). Se crean sin
-- CONCURRENTLY para poder pegar y correr todo el script de una sola vez desde
-- el SQL Editor; cada CREATE bloquea escrituras en su tabla solo mientras se
-- construye el índice (rápido con el volumen actual). Si en el futuro corres
-- esto contra una tabla ya grande y con tráfico de escritura activo, ejecuta
-- esa sentencia puntual por separado con CONCURRENTLY para no bloquear.

-- ------------------------------------------------------------------------------
-- 1. MEMBRESÍA Y LOOKUP DE ORGANIZACIÓN — lo que se consulta en CADA request
-- ------------------------------------------------------------------------------
-- is_org_member() / is_org_admin_or_owner() filtran por (organization_id, user_id)
-- en cada policy de RLS de cada tabla. Sin este índice, cada chequeo de RLS es
-- un seq scan sobre organization_members completa.
create index if not exists idx_organization_members_org_user
  on organization_members (organization_id, user_id);

-- getUserOrganizations() filtra por user_id (todas las orgs de un usuario)
create index if not exists idx_organization_members_user
  on organization_members (user_id);

-- ------------------------------------------------------------------------------
-- 2. TABLAS DE NEGOCIO — todas se leen filtradas por organization_id
-- ------------------------------------------------------------------------------
create index if not exists idx_employees_org
  on employees (organization_id);

-- El dashboard y el directorio filtran activos y ordenan por nombre; birth_date/
-- hire_date se usan para cumpleaños, aniversarios y período de prueba.
create index if not exists idx_employees_org_status
  on employees (organization_id, status);

create index if not exists idx_departments_org
  on departments (organization_id);

create index if not exists idx_positions_org
  on positions (organization_id);

create index if not exists idx_holidays_org
  on holidays (organization_id);

create index if not exists idx_employee_salaries_org
  on employee_salaries (organization_id);

create index if not exists idx_employee_schedules_org
  on employee_schedules (organization_id);

-- El dashboard ordena incidencias por created_at desc con límite: índice
-- compuesto para que ese ORDER BY + WHERE no requiera un sort completo.
create index if not exists idx_incidents_org_created
  on incidents (organization_id, created_at desc);

-- shift_requests: el dashboard filtra por organization_id + status + fecha
-- (pendientes) y por organization_id + request_type + status + rango de fecha
-- (vacaciones próximas). Un índice compuesto cubre ambos patrones razonablemente.
create index if not exists idx_shift_requests_org_status_date
  on shift_requests (organization_id, status, date);

create index if not exists idx_deductions_org
  on deductions (organization_id);

-- payroll_reports: el dashboard trae los últimos 2 cerrados/pagados por end_date.
create index if not exists idx_payroll_reports_org_status_end
  on payroll_reports (organization_id, status, end_date desc);

create index if not exists idx_employee_documents_org
  on employee_documents (organization_id);

-- invitaciones: la pantalla de invitado propio filtra por email + status, y
-- Settings filtra por organization_id + status.
create index if not exists idx_org_invitations_org_status
  on organization_invitations (organization_id, status);

create index if not exists idx_org_invitations_email_status
  on organization_invitations (lower(email), status);

-- ==============================================================================
-- 3. RPC AGREGADO PARA LAS MÉTRICAS DEL DASHBOARD
-- ==============================================================================
-- Antes: la página traía TODOS los empleados activos completos y calculaba en
-- JS cumpleaños del mes, aniversarios y período de prueba. Con miles de
-- empleados esto transfiere y procesa filas de más en cada carga de "/".
--
-- Ahora: un solo RPC hace los tres cálculos con SQL (filtrando por mes/día
-- directamente en la base) y devuelve listas ya acotadas (top N por cercanía),
-- más el conteo total de activos sin traer las filas.

create or replace function public.get_dashboard_employee_insights(
  org_id uuid,
  result_limit int default 8
)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_active_count int;
  v_probation json;
  v_birthdays json;
  v_anniversaries json;
begin
  if not public.is_org_member(org_id) then
    raise exception 'No autorizado para ver los datos de esta organización.';
  end if;

  -- Total de empleados activos (no inactivos) — un count, no las filas.
  select count(*) into v_active_count
  from employees
  where organization_id = org_id
    and status <> 'inactivo';

  -- Período de prueba: los que llevan más tiempo primero.
  select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_probation
  from (
    select id, full_name, avatar_url, department, position, hire_date,
           (current_date - hire_date) as days_since_hire
    from employees
    where organization_id = org_id
      and status = 'prueba'
      and hire_date is not null
    order by days_since_hire desc
    limit result_limit
  ) t;

  -- Cumpleaños del mes en curso, ordenados por día.
  select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_birthdays
  from (
    select id, full_name, avatar_url, department, position, birth_date
    from employees
    where organization_id = org_id
      and status <> 'inactivo'
      and birth_date is not null
      and extract(month from birth_date) = extract(month from current_date)
    order by extract(day from birth_date) asc
    limit result_limit
  ) t;

  -- Aniversarios laborales del mes en curso (años > 0), ordenados por día.
  select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_anniversaries
  from (
    select id, full_name, avatar_url, department, hire_date,
           (extract(year from current_date) - extract(year from hire_date))::int as years
    from employees
    where organization_id = org_id
      and status <> 'inactivo'
      and hire_date is not null
      and extract(month from hire_date) = extract(month from current_date)
      and extract(year from current_date) > extract(year from hire_date)
    order by extract(day from hire_date) asc
    limit result_limit
  ) t;

  return json_build_object(
    'active_count', v_active_count,
    'probation', v_probation,
    'birthdays', v_birthdays,
    'anniversaries', v_anniversaries
  );
end;
$$;

grant execute on function public.get_dashboard_employee_insights(uuid, int) to authenticated;
