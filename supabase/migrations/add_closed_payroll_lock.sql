-- ==============================================================================
-- NÓMINA — bloqueo de registros incluidos en un rol ya generado (cerrado/pagado)
-- Ejecuta este script en el SQL Editor de Supabase
-- ==============================================================================
--
-- Un rol 'cerrado' o 'pagado' es un registro definitivo (snapshot). Para que no
-- se desfase de sus datos de origen, los registros que lo componen ya no se
-- pueden modificar, anular ni eliminar:
--   * shift_requests (novedades)   con status 'aprobado'
--   * incidents (incidencias)      con status 'aprobado' o 'registrado'
--   * deductions (descuentos)      no recurrentes y no anulados
-- cuya FECHA cae dentro del período del rol (y del departamento, si el rol era
-- de uno solo). Un rol en borrador NO bloquea nada. Los descuentos recurrentes
-- (alimentación/vivienda) no se bloquean: son reglas que aplican a cortes futuros.
-- Las correcciones van como registros nuevos en el siguiente rol.
--
-- Se aplica en la base de datos (triggers) para que valga desde cualquier
-- pantalla o acción. No bloquea INSERTs ni la eliminación de un empleado.

-- Rol cerrado/pagado que cubre la fecha de un empleado (null si no hay).
create or replace function public.closed_payroll_for(p_org uuid, p_employee uuid, p_date date)
returns table (id uuid, title text, start_date date, end_date date)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.title, r.start_date, r.end_date
  from payroll_reports r
  where r.organization_id = p_org
    and r.status in ('cerrado', 'pagado')
    and p_date between r.start_date and r.end_date
    and (
      nullif(r.department, '') is null
      or r.department = (select e.department from employees e where e.id = p_employee)
    )
  order by r.end_date desc
  limit 1
$$;

grant execute on function public.closed_payroll_for(uuid, uuid, date) to authenticated;

create or replace function public.enforce_closed_payroll_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old     jsonb := to_jsonb(OLD);
  v_status  text  := v_old->>'status';
  v_date    date;
  v_counted boolean := false;
  v_report  record;
begin
  -- Borrado de empleado (RPC delete_employee): se purga todo su historial.
  if current_setting('app.purging_employee', true) = 'on' then
    if TG_OP = 'DELETE' then return OLD; end if;
    return NEW;
  end if;

  if TG_TABLE_NAME = 'shift_requests' then
    v_date := (v_old->>'date')::date;
    v_counted := v_status = 'aprobado';
  elsif TG_TABLE_NAME = 'incidents' then
    v_date := (v_old->>'start_date')::date;
    v_counted := v_status in ('aprobado', 'registrado');
  elsif TG_TABLE_NAME = 'deductions' then
    v_date := (v_old->>'date')::date;
    v_counted := v_status <> 'anulado' and not coalesce((v_old->>'is_recurring')::boolean, false);
  end if;

  if not v_counted or v_date is null then
    if TG_OP = 'DELETE' then return OLD; end if;
    return NEW;
  end if;

  -- Un UPDATE que solo toca updated_at o el programa de recuperación de un
  -- permiso no altera lo ya cobrado en el rol.
  if TG_OP = 'UPDATE'
     and ((v_old - 'updated_at') #- '{metadata,recovery_schedules}')
       = ((to_jsonb(NEW) - 'updated_at') #- '{metadata,recovery_schedules}') then
    return NEW;
  end if;

  -- Borrado en cascada por eliminar al empleado.
  if TG_OP = 'DELETE'
     and not exists (select 1 from employees e where e.id = (v_old->>'employee_id')::uuid) then
    return OLD;
  end if;

  select * into v_report
  from public.closed_payroll_for(
    (v_old->>'organization_id')::uuid,
    (v_old->>'employee_id')::uuid,
    v_date
  );

  if found then
    raise exception 'Este registro pertenece al rol de pagos "%" (% al %), ya generado, y no se puede modificar, anular ni eliminar. Registra la corrección en el siguiente rol.',
      v_report.title, v_report.start_date, v_report.end_date
      using errcode = 'P0001';
  end if;

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

drop trigger if exists trg_lock_closed_payroll on public.shift_requests;
create trigger trg_lock_closed_payroll
  before update or delete on public.shift_requests
  for each row execute function public.enforce_closed_payroll_lock();

drop trigger if exists trg_lock_closed_payroll on public.incidents;
create trigger trg_lock_closed_payroll
  before update or delete on public.incidents
  for each row execute function public.enforce_closed_payroll_lock();

drop trigger if exists trg_lock_closed_payroll on public.deductions;
create trigger trg_lock_closed_payroll
  before update or delete on public.deductions
  for each row execute function public.enforce_closed_payroll_lock();

-- delete_employee purga el historial del empleado: debe saltarse el bloqueo.
create or replace function public.delete_employee(p_employee_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id
  from employees
  where id = p_employee_id;

  if v_org_id is null then
    return json_build_object('success', false, 'error', 'Empleado no encontrado.');
  end if;

  if not public.is_org_admin_or_owner(v_org_id) then
    return json_build_object('success', false, 'error', 'No tienes permisos para eliminar empleados de esta organización.');
  end if;

  -- Solo dentro de esta transacción: desactiva el bloqueo de roles cerrados.
  perform set_config('app.purging_employee', 'on', true);

  delete from employee_salaries where employee_id = p_employee_id;
  delete from employee_schedules where employee_id = p_employee_id;
  delete from incidents where employee_id = p_employee_id;
  delete from shift_requests where employee_id = p_employee_id;
  delete from deductions where employee_id = p_employee_id;
  delete from employee_documents where employee_id = p_employee_id;
  delete from employee_settlements where employee_id = p_employee_id;

  delete from employees where id = p_employee_id;

  return json_build_object('success', true);
end;
$$;

grant execute on function public.delete_employee(uuid) to authenticated;
