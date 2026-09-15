-- Registra qué empleados fueron marcados como "pagados" en el anticipo
-- quincenal de un mes/año dado. El Rol mensual solo descuenta
-- biweekly_advance_amount para un empleado si existe un registro aquí para
-- el período que cubre el corte — así, si alguien no se marcó como pagado
-- en /payroll/quincena, no se le descuenta en el Rol (evita descontar un
-- anticipo que nunca se transfirió).
create table if not exists quincena_payments (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  employee_id         uuid not null references employees(id) on delete cascade,
  period_year         integer not null check (period_year >= 2020),
  period_month        integer not null check (period_month between 1 and 12),
  amount              numeric(12,2) not null default 0,
  paid_at             timestamptz not null default now(),
  paid_by             uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  unique (organization_id, employee_id, period_year, period_month)
);

create index if not exists idx_quincena_payments_period
  on quincena_payments (organization_id, period_year, period_month);

alter table quincena_payments enable row level security;
drop policy if exists "Permitir lectura quincena_payments" on quincena_payments;
create policy "Permitir lectura quincena_payments" on quincena_payments for select using (auth.role() = 'authenticated');
drop policy if exists "Permitir insercion quincena_payments" on quincena_payments;
create policy "Permitir insercion quincena_payments" on quincena_payments for insert with check (auth.role() = 'authenticated');
drop policy if exists "Permitir eliminacion quincena_payments" on quincena_payments;
create policy "Permitir eliminacion quincena_payments" on quincena_payments for delete using (auth.role() = 'authenticated');
