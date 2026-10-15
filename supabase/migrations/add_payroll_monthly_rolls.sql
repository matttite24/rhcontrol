-- ==============================================================================
-- NÓMINA — roles mensuales (un rol = un mes calendario)
-- Ejecuta este script en el SQL Editor de Supabase
-- ==============================================================================
--
-- Hasta ahora un rol se generaba con un rango de fechas libre ("corte"). Desde
-- ahora cada rol cubre un MES COMPLETO (del día 1 al último día del mes), y los
-- registros (novedades, descuentos, cuotas) se asignan a ese mes.
--
-- Qué hace este script:
--   1. organizations.payroll_start_month: primer mes en que se generan roles
--      mensuales. Para empresas que ya tienen roles, se fija en el mes siguiente
--      al último rol generado (el corte ya cerrado, aunque abarque parte del mes
--      anterior, se deja tal cual: no se modifica).
--   2. payroll_reports.period_year / period_month: mes del rol (columnas
--      generadas desde end_date; no hay que rellenar nada).
--   3. Un solo rol cerrado/pagado por mes y alcance (organización + departamento).
--   4. Trigger: un rol nuevo debe ser de un mes completo y no anterior a
--      payroll_start_month. NO afecta a los roles ya existentes.
--   5. Columnas calculadas deduction_roll_id / deduction_roll_title: en qué rol
--      ya se descontó cada descuento (misma regla de pertenencia que fetchCutDeductions
--      y que el bloqueo de roles cerrados). Sirven para filtrar "En rol" en la lista de
--      Descuentos directamente en la base, sin listas de ids.
--
-- Es idempotente: se puede ejecutar más de una vez.

-- 1. Primer mes de roles mensuales -------------------------------------------
alter table public.organizations
  add column if not exists payroll_start_month date;

update public.organizations o
set payroll_start_month = (date_trunc('month', m.last_end) + interval '1 month')::date
from (
  select organization_id, max(end_date) as last_end
  from public.payroll_reports
  where status in ('cerrado', 'pagado')
  group by organization_id
) m
where m.organization_id = o.id
  and o.payroll_start_month is null;

-- 2. Mes del rol -------------------------------------------------------------
alter table public.payroll_reports
  add column if not exists period_year integer generated always as (extract(year from end_date)::integer) stored,
  add column if not exists period_month integer generated always as (extract(month from end_date)::integer) stored;

-- 3. Un rol generado por mes y alcance ---------------------------------------
create unique index if not exists payroll_reports_one_per_month_scope
  on public.payroll_reports (organization_id, period_year, period_month, (coalesce(department, '')))
  where status in ('cerrado', 'pagado');

-- 4. Los roles nuevos son de un mes completo y no anteriores al inicio -------
create or replace function public.enforce_payroll_reports_monthly()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first date;
  v_last date;
  v_start_month date;
begin
  -- Solo valida al crear o cuando cambia el rango (no toca roles ya existentes).
  if TG_OP = 'UPDATE'
     and NEW.start_date = OLD.start_date
     and NEW.end_date = OLD.end_date then
    return NEW;
  end if;

  v_first := date_trunc('month', NEW.start_date)::date;
  v_last := (date_trunc('month', NEW.start_date) + interval '1 month' - interval '1 day')::date;

  if NEW.start_date <> v_first or NEW.end_date <> v_last then
    raise exception 'Los roles se generan por mes completo (del % al %). Corte recibido: % al %.',
      v_first, v_last, NEW.start_date, NEW.end_date
      using errcode = 'P0001';
  end if;

  select o.payroll_start_month into v_start_month
  from organizations o
  where o.id = NEW.organization_id;

  if v_start_month is not null and NEW.start_date < v_start_month then
    raise exception 'Los roles mensuales se generan desde % en adelante.', v_start_month
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_payroll_reports_monthly on public.payroll_reports;
create trigger trg_payroll_reports_monthly
  before insert or update on public.payroll_reports
  for each row execute function public.enforce_payroll_reports_monthly();

-- 5. En qué rol ya se descontó cada descuento ---------------------------------
-- Columnas calculadas (PostgREST las expone como columnas de `deductions`):
--   select=*,deduction_roll_id,deduction_roll_title   |   ?deduction_roll_id=is.null
-- Los recurrentes (alimentación/vivienda) y los anulados no pertenecen a un rol.
--
-- Regla de pertenencia (la misma de fetchCutDeductions y del bloqueo de roles
-- cerrados): el descuento entra al rol cerrado/pagado cuyo rango contiene su
-- fecha, o cuyo rango de meses contiene su período de rol (period_year/month);
-- y solo si el rol es de la empresa y del departamento del empleado (o de todos).
-- No depende de closed_payroll_for: esta migración funciona aunque no se haya
-- ejecutado add_closed_payroll_lock.sql.
create or replace function public.closed_roll_for_deduction(
  p_org uuid,
  p_employee uuid,
  p_date date,
  p_period_year integer,
  p_period_month integer
)
returns table (id uuid, title text)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.title
  from public.payroll_reports r
  where r.organization_id = p_org
    and r.status in ('cerrado', 'pagado')
    and (
      p_date between r.start_date and r.end_date
      or (
        p_period_year is not null
        and p_period_month is not null
        and (p_period_year * 12 + p_period_month)
            between (extract(year from r.start_date)::int * 12 + extract(month from r.start_date)::int)
                and (extract(year from r.end_date)::int * 12 + extract(month from r.end_date)::int)
      )
    )
    and (
      nullif(r.department, '') is null
      or r.department = (select e.department from public.employees e where e.id = p_employee)
    )
  order by r.end_date desc
  limit 1
$$;

create or replace function public.deduction_roll_id(d public.deductions)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.id
  from public.closed_roll_for_deduction(d.organization_id, d.employee_id, d.date, d.period_year, d.period_month) r
  where coalesce(d.is_recurring, false) = false
    and d.status <> 'anulado'
$$;

create or replace function public.deduction_roll_title(d public.deductions)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.title
  from public.closed_roll_for_deduction(d.organization_id, d.employee_id, d.date, d.period_year, d.period_month) r
  where coalesce(d.is_recurring, false) = false
    and d.status <> 'anulado'
$$;

grant execute on function public.closed_roll_for_deduction(uuid, uuid, date, integer, integer) to authenticated;
grant execute on function public.deduction_roll_id(public.deductions) to authenticated;
grant execute on function public.deduction_roll_title(public.deductions) to authenticated;
