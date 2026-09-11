-- Horarios rotativos por ciclo de N días (ej. 4 libres + 10 trabajo), en vez
-- de un horario fijo por día de la semana. Necesario para turnos como el de
-- dos cocineros que se intercalan cobertura: el mismo día de la semana (ej.
-- "Domingo") alterna entre libre y laborable según en qué punto del ciclo
-- esté cada empleado, algo que `employee_schedules` (fijo por día de semana)
-- no puede representar.
--
-- Diseño: patrón reutilizable (plantilla) + asignación por empleado con una
-- fecha de referencia ("ancla") que fija la posición 0 del ciclo. Para saber
-- si una fecha es laborable: se cuentan los días desde la fecha ancla,
-- `% cycle_length` da la posición dentro del ciclo, y se busca esa posición
-- en `days_off` (array de offsets 0-indexados que son libres).
--
-- Las horas de entrada/salida en los días laborables del ciclo NO se
-- duplican aquí: se siguen tomando del horario semanal normal ya guardado en
-- `employee_schedules` (decisión del usuario) — este patrón solo decide
-- libre/laborable, no las horas.

create table if not exists rotating_shift_patterns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  cycle_length integer not null check (cycle_length > 0 and cycle_length <= 90),
  -- Offsets (0-indexados, 0 = día de la fecha ancla) dentro del ciclo que son
  -- día libre. Todo offset no listado se considera laborable.
  days_off integer[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rotating_shift_patterns_org on rotating_shift_patterns(organization_id);

create table if not exists employee_rotating_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  pattern_id uuid not null references rotating_shift_patterns(id) on delete cascade,
  -- Fecha ancla: define la posición 0 del ciclo para este empleado en
  -- particular. Dos empleados usando el mismo patrón con distinta fecha
  -- ancla es justamente lo que permite que se intercalen (ver Chef 1 / Chef 2).
  anchor_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un empleado tiene a lo sumo un horario rotativo activo a la vez; si en el
  -- futuro se necesita historial de cambios de patrón, se puede revisar esta
  -- restricción entonces.
  unique (employee_id)
);

create index if not exists idx_employee_rotating_schedules_org on employee_rotating_schedules(organization_id);
create index if not exists idx_employee_rotating_schedules_employee on employee_rotating_schedules(employee_id);
create index if not exists idx_employee_rotating_schedules_pattern on employee_rotating_schedules(pattern_id);

alter table rotating_shift_patterns enable row level security;
alter table employee_rotating_schedules enable row level security;

-- Mismo criterio de acceso ya usado en el resto de tablas multi-tenant:
-- lectura para cualquier miembro de la organización, escritura solo para
-- admin/owner (via is_org_member / is_org_admin_or_owner ya existentes).
drop policy if exists "rotating_shift_patterns_select" on rotating_shift_patterns;
create policy "rotating_shift_patterns_select" on rotating_shift_patterns
  for select using (is_org_member(organization_id));

drop policy if exists "rotating_shift_patterns_write" on rotating_shift_patterns;
create policy "rotating_shift_patterns_write" on rotating_shift_patterns
  for all using (is_org_admin_or_owner(organization_id))
  with check (is_org_admin_or_owner(organization_id));

drop policy if exists "employee_rotating_schedules_select" on employee_rotating_schedules;
create policy "employee_rotating_schedules_select" on employee_rotating_schedules
  for select using (is_org_member(organization_id));

drop policy if exists "employee_rotating_schedules_write" on employee_rotating_schedules;
create policy "employee_rotating_schedules_write" on employee_rotating_schedules
  for all using (is_org_admin_or_owner(organization_id))
  with check (is_org_admin_or_owner(organization_id));
