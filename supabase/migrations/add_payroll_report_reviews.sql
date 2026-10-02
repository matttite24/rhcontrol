-- ==============================================================================
-- NÓMINA — marca "revisado" por empleado dentro de un rol guardado
-- Ejecuta este script en el SQL Editor de Supabase
-- ==============================================================================
--
-- Indicador puramente visual: no afecta el cálculo, el estado ni el bloqueo del
-- rol. Sirve para llevar el control de qué empleados ya se revisaron.
-- Una fila = ese empleado está revisado en ese rol.

create table if not exists payroll_report_reviews (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  payroll_report_id uuid not null references payroll_reports(id) on delete cascade,
  employee_id       uuid not null references employees(id) on delete cascade,
  reviewed_by       uuid references auth.users(id) on delete set null,
  reviewed_at       timestamptz not null default now(),
  unique (payroll_report_id, employee_id)
);

create index if not exists idx_payroll_report_reviews_report
  on payroll_report_reviews (payroll_report_id);

alter table payroll_report_reviews enable row level security;

drop policy if exists "payroll_report_reviews_select" on payroll_report_reviews;
create policy "payroll_report_reviews_select" on payroll_report_reviews
  for select using (is_org_member(organization_id));

drop policy if exists "payroll_report_reviews_write" on payroll_report_reviews;
create policy "payroll_report_reviews_write" on payroll_report_reviews
  for all using (is_org_member(organization_id))
  with check (is_org_member(organization_id));
