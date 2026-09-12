-- Ajuste de "horas efectivamente cumplidas" para horas extras aprobadas,
-- usado exclusivamente durante la revisión de un rol de pagos en borrador
-- (ver flujo de Generar Rol: Guardar Borrador -> revisar Novedades -> Generar).
--
-- Deliberadamente separado de `shift_requests`: la solicitud de horas extras
-- es un documento ya autorizado (impreso, firmado) y no debe alterarse. Este
-- ajuste vive ligado al REPORTE de rol (payroll_reports) que se está
-- revisando, no a la solicitud — así el mismo shift_request puede tener
-- ajustes distintos en cortes distintos sin contaminar el documento original,
-- y desaparece si el borrador se descarta sin generar el rol.
create table if not exists payroll_overtime_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  payroll_report_id uuid not null references payroll_reports(id) on delete cascade,
  shift_request_id uuid not null references shift_requests(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  -- Horas realmente cumplidas (ej. según el biométrico), sustituye a
  -- shift_requests.hours SOLO para el cálculo de este rol en particular.
  actual_hours numeric not null check (actual_hours >= 0),
  reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un ajuste por solicitud y por rol: reajustar la misma solicitud dentro
  -- del mismo borrador actualiza el registro existente, no crea uno nuevo.
  unique (payroll_report_id, shift_request_id)
);

create index if not exists idx_payroll_overtime_adjustments_report on payroll_overtime_adjustments(payroll_report_id);
create index if not exists idx_payroll_overtime_adjustments_org on payroll_overtime_adjustments(organization_id);

alter table payroll_overtime_adjustments enable row level security;

drop policy if exists "payroll_overtime_adjustments_select" on payroll_overtime_adjustments;
create policy "payroll_overtime_adjustments_select" on payroll_overtime_adjustments
  for select using (is_org_member(organization_id));

drop policy if exists "payroll_overtime_adjustments_write" on payroll_overtime_adjustments;
create policy "payroll_overtime_adjustments_write" on payroll_overtime_adjustments
  for all using (is_org_admin_or_owner(organization_id))
  with check (is_org_admin_or_owner(organization_id));
