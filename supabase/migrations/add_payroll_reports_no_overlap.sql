-- ==============================================================================
-- NÓMINA — los cortes de rol no pueden solaparse
-- Ejecuta este script en el SQL Editor de Supabase
-- ==============================================================================
--
-- Un registro entra a un rol por su fecha: si dos cortes cubren los mismos días
-- (misma organización y mismo alcance), sus novedades, descuentos y cuotas se
-- contarían dos veces. Se rechaza guardar o generar un corte cuyo rango se
-- cruce con otro rol YA GENERADO (cerrado o pagado).
--
-- "Mismo alcance": ambos sin departamento (todos), o uno de los dos sin
-- departamento (cubre a todos, incluye al otro), o el mismo departamento.
-- Los borradores no bloquean entre sí; el choque se valida al guardar el
-- borrador contra los roles ya generados, y de nuevo al generar.

create or replace function public.enforce_payroll_reports_no_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other record;
begin
  -- Solo valida al crear o cuando cambia el rango, el alcance o el estado.
  if TG_OP = 'UPDATE'
     and NEW.start_date = OLD.start_date
     and NEW.end_date = OLD.end_date
     and NEW.department is not distinct from OLD.department
     and NEW.status = OLD.status then
    return NEW;
  end if;

  select r.title, r.start_date, r.end_date into v_other
  from payroll_reports r
  where r.organization_id = NEW.organization_id
    and r.id <> NEW.id
    and r.status in ('cerrado', 'pagado')
    and r.start_date <= NEW.end_date
    and r.end_date >= NEW.start_date
    and (
      nullif(r.department, '') is null
      or nullif(NEW.department, '') is null
      or r.department = NEW.department
    )
  order by r.end_date desc
  limit 1;

  if found then
    raise exception 'El corte del % al % se solapa con el rol "%" (% al %), ya generado. Inicia el corte el día siguiente al último rol generado.',
      NEW.start_date, NEW.end_date, v_other.title, v_other.start_date, v_other.end_date
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_payroll_reports_no_overlap on public.payroll_reports;
create trigger trg_payroll_reports_no_overlap
  before insert or update on public.payroll_reports
  for each row execute function public.enforce_payroll_reports_no_overlap();
