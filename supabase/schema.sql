-- =========================================================
-- MIGRACIÓN COMPLETA DE CAMPOS EXTENDIDOS PARA EMPLEADOS
-- (Copia y ejecuta este script en el SQL Editor de Supabase)
-- =========================================================

-- 1. TABLA DE ORGANIZACIONES
create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  logo_url    text,
  tax_id      text,
  legal_name  text,
  email       text,
  phone       text,
  website     text,
  address     text,
  city        text,
  country     text,
  created_at  timestamptz not null default now()
);

-- 2. TABLA DE MIEMBROS DE ORGANIZACIÓN
create table if not exists organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at      timestamptz not null default now(),
  unique(organization_id, user_id)
);

-- 3. TABLA DE DEPARTAMENTOS
create table if not exists departments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  name            text not null,
  description     text,
  created_at      timestamptz not null default now()
);

-- 4. TABLA DE CARGOS / PUESTOS
create table if not exists positions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  name            text not null,
  description     text,
  created_at      timestamptz not null default now()
);

-- 4.0.1 TABLA DE FERIADOS NACIONALES / LOCALES
create table if not exists holidays (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  date            date not null,
  name            text not null,
  created_at      timestamptz not null default now(),
  unique(organization_id, date)
);

-- 4.1 TABLA DE CONCEPTOS SALARIALES DE EMPLEADOS (Sueldo, Bonificación, Extras)
create table if not exists employee_salaries (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid references organizations(id) on delete cascade,
  employee_id         uuid references employees(id) on delete cascade,
  salary_type         text not null check (salary_type in ('Sueldo', 'Bonificacion', 'Extras')),
  name                text, -- Nombre descriptivo o concepto opcional (ej. Bono puntualidad, Horas extras)
  amount              numeric(12,2) not null default 0,
  affects_iess        boolean not null default true, -- Check 'Afecta aportación'
  created_at          timestamptz not null default now()
);

-- 5. TABLA DE EMPLEADOS CON TODOS LOS CAMPOS LABORALES Y CONFIGURACIONES
create table if not exists employees (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid references organizations(id) on delete cascade,
  full_name             text not null,
  email                 text not null,
  national_id           text, -- Cédula de ciudadanía / Documento de identidad
  phone                 text,
  position              text,
  department            text,
  hire_date             date,
  termination_date      date,
  status                text not null default 'activo' check (status in ('activo', 'inactivo', 'prueba')),
  avatar_url            text,
  notes                 text,
  
  -- Datos Personales extendidos
  address               text,
  province              text,
  civil_status          text default 'Soltero/a',
  phone_secondary       text,

  -- Datos para la Empresa / Forma de Pago
  contract_type         text default 'Indefinido',
  payment_type          text default 'Transferencia',
  bank_name             text,
  account_type          text default 'Ahorros',
  account_number        text,
  check_issuing_bank    text,
  
  -- Configuraciones Generales
  reserve_funds         text default 'pagar_ano',
  accumulate_decimals   boolean not null default false,
  spouse_extension      boolean not null default false,
  
  -- Otras Configuraciones / IESS
  iess_code             text,
  personal_charges      integer not null default 0,
  
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Migración segura por si la tabla `employees` ya existía
do $$ 
begin
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'national_id') then
    alter table employees add column national_id text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'termination_date') then
    alter table employees add column termination_date date;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'birth_date') then
    alter table employees add column birth_date date;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'contract_type') then
    alter table employees add column contract_type text default 'Indefinido';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'payment_type') then
    alter table employees add column payment_type text default 'Transferencia';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'payment_group') then
    alter table employees add column payment_group text default 'Costos';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'has_disability') then
    alter table employees add column has_disability boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'gender') then
    alter table employees add column gender text default 'Masculino';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'reserve_funds') then
    alter table employees add column reserve_funds text default 'pagar_ano';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'accumulate_decimals') then
    alter table employees add column accumulate_decimals boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'spouse_extension') then
    alter table employees add column spouse_extension boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'reduced_workday_hours') then
    alter table employees add column reduced_workday_hours numeric default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'iess_code') then
    alter table employees add column iess_code text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'personal_charges') then
    alter table employees add column personal_charges integer not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'address') then
    alter table employees add column address text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'province') then
    alter table employees add column province text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'civil_status') then
    alter table employees add column civil_status text default 'Soltero/a';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'phone_secondary') then
    alter table employees add column phone_secondary text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'bank_name') then
    alter table employees add column bank_name text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'account_type') then
    alter table employees add column account_type text default 'Ahorros';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'account_number') then
    alter table employees add column account_number text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'check_issuing_bank') then
    alter table employees add column check_issuing_bank text;
  end if;
end $$;

-- Trigger para updated_at en employees
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists employees_updated_at on employees;
create trigger employees_updated_at
  before update on employees
  for each row execute function update_updated_at();

-- =========================================================
-- HABILITAR RLS Y POLÍTICAS
-- =========================================================
alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table departments enable row level security;
alter table positions enable row level security;
alter table holidays enable row level security;
alter table employees enable row level security;
alter table employee_salaries enable row level security;

-- Policies organizations
drop policy if exists "Lectura organizaciones del usuario" on organizations;
create policy "Lectura organizaciones del usuario" on organizations for select using (auth.role() = 'authenticated');
drop policy if exists "Crear organizaciones autenticados" on organizations;
create policy "Crear organizaciones autenticados" on organizations for insert with check (auth.role() = 'authenticated');
drop policy if exists "Actualizar organizaciones" on organizations;
create policy "Actualizar organizaciones" on organizations for update using (auth.role() = 'authenticated');
drop policy if exists "Eliminar organizaciones" on organizations;
create policy "Eliminar organizaciones" on organizations for delete using (auth.role() = 'authenticated');

-- Policies organization_members
drop policy if exists "Lectura members" on organization_members;
create policy "Lectura members" on organization_members for select using (auth.uid() = user_id);
drop policy if exists "Insertar members" on organization_members;
create policy "Insertar members" on organization_members for insert with check (auth.uid() = user_id);
drop policy if exists "Eliminar members" on organization_members;
create policy "Eliminar members" on organization_members for delete using (auth.uid() = user_id);

-- Policies departments
drop policy if exists "Permitir lectura departamentos" on departments;
create policy "Permitir lectura departamentos" on departments for select using (auth.role() = 'authenticated');
drop policy if exists "Permitir insercion departamentos" on departments;
create policy "Permitir insercion departamentos" on departments for insert with check (auth.role() = 'authenticated');
drop policy if exists "Permitir actualizacion departamentos" on departments;
create policy "Permitir actualizacion departamentos" on departments for update using (auth.role() = 'authenticated');
drop policy if exists "Permitir eliminacion departamentos" on departments;
create policy "Permitir eliminacion departamentos" on departments for delete using (auth.role() = 'authenticated');

-- Policies positions
drop policy if exists "Permitir lectura cargos" on positions;
create policy "Permitir lectura cargos" on positions for select using (auth.role() = 'authenticated');
drop policy if exists "Permitir insercion cargos" on positions;
create policy "Permitir insercion cargos" on positions for insert with check (auth.role() = 'authenticated');
drop policy if exists "Permitir actualizacion cargos" on positions;
create policy "Permitir actualizacion cargos" on positions for update using (auth.role() = 'authenticated');
drop policy if exists "Permitir eliminacion cargos" on positions;
create policy "Permitir eliminacion cargos" on positions for delete using (auth.role() = 'authenticated');

-- Policies holidays
drop policy if exists "Permitir lectura feriados" on holidays;
create policy "Permitir lectura feriados" on holidays for select using (auth.role() = 'authenticated');
drop policy if exists "Permitir insercion feriados" on holidays;
create policy "Permitir insercion feriados" on holidays for insert with check (auth.role() = 'authenticated');
drop policy if exists "Permitir actualizacion feriados" on holidays;
create policy "Permitir actualizacion feriados" on holidays for update using (auth.role() = 'authenticated');
drop policy if exists "Permitir eliminacion feriados" on holidays;
create policy "Permitir eliminacion feriados" on holidays for delete using (auth.role() = 'authenticated');

-- Policies employees
drop policy if exists "Permitir lectura empleados" on employees;
create policy "Permitir lectura empleados" on employees for select using (auth.role() = 'authenticated');
drop policy if exists "Permitir insercion empleados" on employees;
create policy "Permitir insercion empleados" on employees for insert with check (auth.role() = 'authenticated');
drop policy if exists "Permitir actualizacion empleados" on employees;
create policy "Permitir actualizacion empleados" on employees for update using (auth.role() = 'authenticated');
drop policy if exists "Permitir eliminacion empleados" on employees;
create policy "Permitir eliminacion empleados" on employees for delete using (auth.role() = 'authenticated');

-- 4.2 TABLA DE HORARIOS LABORALES DE EMPLEADOS
create table if not exists employee_schedules (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid references organizations(id) on delete cascade,
  employee_id         uuid references employees(id) on delete cascade,
  day_of_week         text not null check (day_of_week in ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo')),
  day_order           integer not null default 1, -- 1 para Lunes, 7 para Domingo
  is_workday          boolean not null default true,
  has_split_shift     boolean not null default false, -- Doble jornada (mañana y tarde)
  start_time_1        text default '08:00',
  end_time_1          text default '13:00',
  start_time_2        text default '14:00',
  end_time_2          text default '18:00',
  created_at          timestamptz not null default now()
);

-- Policies employee_salaries
drop policy if exists "Permitir lectura salarios" on employee_salaries;
create policy "Permitir lectura salarios" on employee_salaries for select using (auth.role() = 'authenticated');
drop policy if exists "Permitir insercion salarios" on employee_salaries;
create policy "Permitir insercion salarios" on employee_salaries for insert with check (auth.role() = 'authenticated');
drop policy if exists "Permitir actualizacion salarios" on employee_salaries;
create policy "Permitir actualizacion salarios" on employee_salaries for update using (auth.role() = 'authenticated');
drop policy if exists "Permitir eliminacion salarios" on employee_salaries;
create policy "Permitir eliminacion salarios" on employee_salaries for delete using (auth.role() = 'authenticated');

-- Policies employee_schedules
alter table employee_schedules enable row level security;
drop policy if exists "Permitir lectura horarios" on employee_schedules;
create policy "Permitir lectura horarios" on employee_schedules for select using (auth.role() = 'authenticated');
drop policy if exists "Permitir insercion horarios" on employee_schedules;
create policy "Permitir insercion horarios" on employee_schedules for insert with check (auth.role() = 'authenticated');
drop policy if exists "Permitir actualizacion horarios" on employee_schedules;
create policy "Permitir actualizacion horarios" on employee_schedules for update using (auth.role() = 'authenticated');
drop policy if exists "Permitir eliminacion horarios" on employee_schedules;
create policy "Permitir eliminacion horarios" on employee_schedules for delete using (auth.role() = 'authenticated');

-- 6. TABLA DE INCIDENCIAS Y DOCUMENTACIONES DEL PERSONAL
create table if not exists incidents (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  employee_id         uuid not null references employees(id) on delete cascade,
  incident_type       text not null check (incident_type in (
    'actividad_no_conforme',
    'llamado_atencion',
    'solicitud_vacaciones',
    'anticipo_sueldo',
    'incapacidad',
    'permiso_laboral',
    'otro'
  )),
  title               text not null,
  description         text,
  status              text not null default 'registrado' check (status in ('pendiente', 'aprobado', 'rechazado', 'registrado', 'anulado')),
  start_date          date,
  end_date            date,
  amount              numeric(12,2),
  document_url        text,
  metadata            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Policies incidents
alter table incidents enable row level security;
drop policy if exists "Permitir lectura incidencias" on incidents;
create policy "Permitir lectura incidencias" on incidents for select using (auth.role() = 'authenticated');
drop policy if exists "Permitir insercion incidencias" on incidents;
create policy "Permitir insercion incidencias" on incidents for insert with check (auth.role() = 'authenticated');
drop policy if exists "Permitir actualizacion incidencias" on incidents;
create policy "Permitir actualizacion incidencias" on incidents for update using (auth.role() = 'authenticated');
-- 7. TABLA DE SOLICITUDES DE HORARIO Y HORAS EXTRAS (TURNOS Y ASISTENCIA)
create table if not exists shift_requests (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  employee_id         uuid not null references employees(id) on delete cascade,
  request_type        text not null check (request_type in ('horas_extras', 'cambio_horario', 'otro')),
  title               text not null,
  reason              text,
  date                date not null,
  start_time          text,
  end_time            text,
  hours               numeric(5,2),
  status              text not null default 'pendiente' check (status in ('pendiente', 'aprobado', 'rechazado')),
  metadata            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Policies shift_requests
alter table shift_requests enable row level security;
drop policy if exists "Permitir lectura shift_requests" on shift_requests;
create policy "Permitir lectura shift_requests" on shift_requests for select using (auth.role() = 'authenticated');
drop policy if exists "Permitir insercion shift_requests" on shift_requests;
create policy "Permitir insercion shift_requests" on shift_requests for insert with check (auth.role() = 'authenticated');
drop policy if exists "Permitir actualizacion shift_requests" on shift_requests;
create policy "Permitir actualizacion shift_requests" on shift_requests for update using (auth.role() = 'authenticated');
drop policy if exists "Permitir eliminacion shift_requests" on shift_requests;
create policy "Permitir eliminacion shift_requests" on shift_requests for delete using (auth.role() = 'authenticated');

-- 8. TABLA DE DESCUENTOS Y CONTROL ECONÓMICO
create table if not exists deductions (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  employee_id         uuid not null references employees(id) on delete cascade,
  deduction_type      text not null check (deduction_type in ('faltante_caja', 'inventario', 'multa', 'prestamo', 'alimentacion', 'otro')),
  title               text not null,
  description         text,
  amount              numeric(12,2) not null default 0,
  is_recurring        boolean not null default false,
  status              text not null default 'pendiente' check (status in ('pendiente', 'aplicado', 'anulado')),
  period_month        integer check (period_month between 1 and 12),
  period_year         integer check (period_year >= 2020),
  date                date not null default current_date,
  metadata            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Policies deductions
alter table deductions enable row level security;
drop policy if exists "Permitir lectura deductions" on deductions;
create policy "Permitir lectura deductions" on deductions for select using (auth.role() = 'authenticated');
drop policy if exists "Permitir insercion deductions" on deductions;
create policy "Permitir insercion deductions" on deductions for insert with check (auth.role() = 'authenticated');
drop policy if exists "Permitir actualizacion deductions" on deductions;
create policy "Permitir actualizacion deductions" on deductions for update using (auth.role() = 'authenticated');
drop policy if exists "Permitir eliminacion deductions" on deductions;
create policy "Permitir eliminacion deductions" on deductions for delete using (auth.role() = 'authenticated');

-- 9. TABLA DE HISTORIAL DE REPORTES DE NÓMINA
create table if not exists payroll_reports (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  title               text not null,
  start_date          date not null,
  end_date            date not null,
  department          text,
  total_employees     integer not null default 0,
  total_income        numeric(12,2) not null default 0,
  total_deductions    numeric(12,2) not null default 0,
  total_net           numeric(12,2) not null default 0,
  status              text not null default 'cerrado' check (status in ('borrador', 'cerrado', 'pagado')),
  snapshot            jsonb not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Policies payroll_reports
alter table payroll_reports enable row level security;
drop policy if exists "Permitir lectura payroll_reports" on payroll_reports;
create policy "Permitir lectura payroll_reports" on payroll_reports for select using (auth.role() = 'authenticated');
drop policy if exists "Permitir insercion payroll_reports" on payroll_reports;
create policy "Permitir insercion payroll_reports" on payroll_reports for insert with check (auth.role() = 'authenticated');
drop policy if exists "Permitir actualizacion payroll_reports" on payroll_reports;
create policy "Permitir actualizacion payroll_reports" on payroll_reports for update using (auth.role() = 'authenticated');
drop policy if exists "Permitir eliminacion payroll_reports" on payroll_reports;
create policy "Permitir eliminacion payroll_reports" on payroll_reports for delete using (auth.role() = 'authenticated');

-- 10. TABLA DE DOCUMENTOS DEL EXPEDIENTE DIGITAL (INGRESO / ONBOARDING)
create table if not exists employee_documents (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  employee_id         uuid not null references employees(id) on delete cascade,
  doc_type            text not null check (doc_type in ('contrato', 'legalizacion_mdt', 'aviso_entrada_iess', 'cedula_papeleta', 'hoja_vida', 'otro')),
  title               text not null,
  file_url            text,
  file_name           text,
  notes               text,
  uploaded_at         timestamptz not null default now()
);

alter table employee_documents enable row level security;
drop policy if exists "Permitir lectura employee_documents" on employee_documents;
create policy "Permitir lectura employee_documents" on employee_documents for select using (auth.role() = 'authenticated');
drop policy if exists "Permitir insercion employee_documents" on employee_documents;
create policy "Permitir insercion employee_documents" on employee_documents for insert with check (auth.role() = 'authenticated');
drop policy if exists "Permitir actualizacion employee_documents" on employee_documents;
create policy "Permitir actualizacion employee_documents" on employee_documents for update using (auth.role() = 'authenticated');
drop policy if exists "Permitir eliminacion employee_documents" on employee_documents;
create policy "Permitir eliminacion employee_documents" on employee_documents for delete using (auth.role() = 'authenticated');

-- 11. TABLA DE LIQUIDACIONES / ACTAS DE FINIQUITO (BAJAS)
create table if not exists employee_settlements (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  employee_id         uuid not null references employees(id) on delete cascade,
  termination_date    date not null,
  termination_reason  text not null check (termination_reason in ('renuncia_voluntaria', 'despido_intempestivo', 'desahucio', 'acuerdo_mutuo', 'fin_contrato', 'visto_bueno', 'otro')),
  years_served        numeric(5,2) not null default 0,
  
  -- Valores calculados
  pending_salary      numeric(12,2) not null default 0,
  proportional_13th   numeric(12,2) not null default 0,
  proportional_14th   numeric(12,2) not null default 0,
  pending_vacations   numeric(12,2) not null default 0,
  severance_pay       numeric(12,2) not null default 0,
  desahucio_pay       numeric(12,2) not null default 0,
  other_income        numeric(12,2) not null default 0,
  total_income        numeric(12,2) not null default 0,
  
  -- Deducciones al finiquito
  pending_deductions  numeric(12,2) not null default 0,
  iess_pending        numeric(12,2) not null default 0,
  total_deductions    numeric(12,2) not null default 0,
  
  -- Neto liquidación
  net_settlement      numeric(12,2) not null default 0,
  
  -- Documentación de salida
  settlement_doc_url  text,
  iess_exit_doc_url   text,
  payment_receipt_url text,
  
  status              text not null default 'borrador' check (status in ('borrador', 'aprobado', 'pagado')),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table employee_settlements enable row level security;
drop policy if exists "Permitir lectura employee_settlements" on employee_settlements;
create policy "Permitir lectura employee_settlements" on employee_settlements for select using (auth.role() = 'authenticated');
drop policy if exists "Permitir insercion employee_settlements" on employee_settlements;
create policy "Permitir insercion employee_settlements" on employee_settlements for insert with check (auth.role() = 'authenticated');
drop policy if exists "Permitir actualizacion employee_settlements" on employee_settlements;
create policy "Permitir actualizacion employee_settlements" on employee_settlements for update using (auth.role() = 'authenticated');
drop policy if exists "Permitir eliminacion employee_settlements" on employee_settlements;
create policy "Permitir eliminacion employee_settlements" on employee_settlements for delete using (auth.role() = 'authenticated');
