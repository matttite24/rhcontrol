-- ==============================================================================
-- RPC: GUARDAR EMPLEADO (CREAR O ACTUALIZAR, TRANSACCIONAL)
-- Ejecuta este script en el SQL Editor de Supabase
-- ==============================================================================
--
-- Reemplaza la cadena de 7 escrituras secuenciales que EmployeeForm hacía
-- directo desde el navegador (update/insert de employees + delete/insert de
-- employee_salaries + delete/insert de employee_schedules + delete/insert de
-- employee_rotating_schedules). Ese patrón causaba dos síntomas reportados:
--
--   1. Guardado lento: 7 round-trips secuenciales navegador->Supabase, cada
--      uno esperando al anterior.
--   2. Guardado que a veces no persistía todo: los inserts de salarios y
--      horarios solo hacían console.error si fallaban (nunca throw), así que
--      el usuario veía "Empleado actualizado" con éxito aunque el delete ya
--      hubiera corrido y el insert posterior fallara — dejando al empleado
--      sin salarios o sin horario.
--
-- Este RPC hace las mismas 7 operaciones pero dentro de una sola transacción
-- de Postgres: si cualquier paso falla, todo se revierte (no puede quedar un
-- delete aplicado sin su insert correspondiente) y es una sola llamada de red.

create or replace function public.save_employee(
  p_employee_id uuid,               -- null = crear nuevo
  p_organization_id uuid,
  p_employee jsonb,                 -- columnas de employees a upsert (sin id/organization_id)
  p_salaries jsonb,                 -- array de filas de employee_salaries
  p_schedules jsonb,                -- array de filas de employee_schedules
  p_rotating_schedule jsonb         -- fila única de employee_rotating_schedules, o null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_salary jsonb;
  v_schedule jsonb;
begin
  if not public.is_org_member(p_organization_id) then
    return json_build_object('success', false, 'error', 'No tienes permisos sobre esta organización.');
  end if;

  if p_employee_id is not null then
    -- Actualizar: confirmar que el empleado pertenece a esta organización.
    if not exists (
      select 1 from employees
      where id = p_employee_id and organization_id = p_organization_id
    ) then
      return json_build_object('success', false, 'error', 'Empleado no encontrado en esta organización.');
    end if;

    update employees
    set
      full_name = p_employee->>'full_name',
      national_id = p_employee->>'national_id',
      email = p_employee->>'email',
      phone = p_employee->>'phone',
      phone_secondary = p_employee->>'phone_secondary',
      address = p_employee->>'address',
      province = p_employee->>'province',
      civil_status = p_employee->>'civil_status',
      position = p_employee->>'position',
      department = p_employee->>'department',
      hire_date = nullif(p_employee->>'hire_date', '')::date,
      termination_date = nullif(p_employee->>'termination_date', '')::date,
      status = p_employee->>'status',
      avatar_url = p_employee->>'avatar_url',
      notes = p_employee->>'notes',
      birth_date = nullif(p_employee->>'birth_date', '')::date,
      has_disability = (p_employee->>'has_disability')::boolean,
      gender = p_employee->>'gender',
      contract_type = p_employee->>'contract_type',
      payment_type = p_employee->>'payment_type',
      bank_name = p_employee->>'bank_name',
      bank_code = p_employee->>'bank_code',
      account_type = p_employee->>'account_type',
      account_number = p_employee->>'account_number',
      check_issuing_bank = p_employee->>'check_issuing_bank',
      reserve_funds = p_employee->>'reserve_funds',
      accumulate_decimals = (p_employee->>'accumulate_decimals')::boolean,
      spouse_extension = (p_employee->>'spouse_extension')::boolean,
      iess_code = p_employee->>'iess_code',
      personal_charges = (p_employee->>'personal_charges')::int,
      is_owner_manager = (p_employee->>'is_owner_manager')::boolean,
      biweekly_advance_amount = nullif(p_employee->>'biweekly_advance_amount', '')::numeric
    where id = p_employee_id;

    v_employee_id := p_employee_id;
  else
    insert into employees (
      organization_id, full_name, national_id, email, phone, phone_secondary,
      address, province, civil_status, position, department, hire_date,
      termination_date, status, avatar_url, notes, birth_date, has_disability,
      gender, contract_type, payment_type, bank_name, bank_code, account_type,
      account_number, check_issuing_bank, reserve_funds, accumulate_decimals,
      spouse_extension, iess_code, personal_charges, is_owner_manager,
      biweekly_advance_amount
    ) values (
      p_organization_id,
      p_employee->>'full_name',
      p_employee->>'national_id',
      p_employee->>'email',
      p_employee->>'phone',
      p_employee->>'phone_secondary',
      p_employee->>'address',
      p_employee->>'province',
      p_employee->>'civil_status',
      p_employee->>'position',
      p_employee->>'department',
      nullif(p_employee->>'hire_date', '')::date,
      nullif(p_employee->>'termination_date', '')::date,
      p_employee->>'status',
      p_employee->>'avatar_url',
      p_employee->>'notes',
      nullif(p_employee->>'birth_date', '')::date,
      (p_employee->>'has_disability')::boolean,
      p_employee->>'gender',
      p_employee->>'contract_type',
      p_employee->>'payment_type',
      p_employee->>'bank_name',
      p_employee->>'bank_code',
      p_employee->>'account_type',
      p_employee->>'account_number',
      p_employee->>'check_issuing_bank',
      p_employee->>'reserve_funds',
      (p_employee->>'accumulate_decimals')::boolean,
      (p_employee->>'spouse_extension')::boolean,
      p_employee->>'iess_code',
      (p_employee->>'personal_charges')::int,
      (p_employee->>'is_owner_manager')::boolean,
      nullif(p_employee->>'biweekly_advance_amount', '')::numeric
    )
    returning id into v_employee_id;
  end if;

  -- Conceptos salariales: reemplazo completo (borrar + insertar), igual que
  -- el flujo original, pero ahora dentro de la misma transacción.
  delete from employee_salaries where employee_id = v_employee_id;

  if jsonb_array_length(p_salaries) > 0 then
    for v_salary in select * from jsonb_array_elements(p_salaries)
    loop
      insert into employee_salaries (
        organization_id, employee_id, salary_type, name, amount, affects_iess
      ) values (
        p_organization_id,
        v_employee_id,
        v_salary->>'salary_type',
        v_salary->>'name',
        (v_salary->>'amount')::numeric,
        (v_salary->>'affects_iess')::boolean
      );
    end loop;
  end if;

  -- Horario semanal: mismo patrón de reemplazo completo.
  delete from employee_schedules where employee_id = v_employee_id;

  if jsonb_array_length(p_schedules) > 0 then
    for v_schedule in select * from jsonb_array_elements(p_schedules)
    loop
      insert into employee_schedules (
        organization_id, employee_id, day_of_week, day_order, is_workday,
        has_split_shift, start_time_1, end_time_1, start_time_2, end_time_2
      ) values (
        p_organization_id,
        v_employee_id,
        v_schedule->>'day_of_week',
        (v_schedule->>'day_order')::int,
        (v_schedule->>'is_workday')::boolean,
        (v_schedule->>'has_split_shift')::boolean,
        nullif(v_schedule->>'start_time_1', '')::time,
        nullif(v_schedule->>'end_time_1', '')::time,
        nullif(v_schedule->>'start_time_2', '')::time,
        nullif(v_schedule->>'end_time_2', '')::time
      );
    end loop;
  end if;

  -- Horario rotativo: reemplaza la asignación previa (si existía). Si
  -- p_rotating_schedule es null, el empleado queda sin horario rotativo
  -- (modo semanal fijo).
  delete from employee_rotating_schedules where employee_id = v_employee_id;

  if p_rotating_schedule is not null then
    insert into employee_rotating_schedules (
      organization_id, employee_id, pattern_id, anchor_date
    ) values (
      p_organization_id,
      v_employee_id,
      (p_rotating_schedule->>'pattern_id')::uuid,
      (p_rotating_schedule->>'anchor_date')::date
    );
  end if;

  return json_build_object('success', true, 'employee_id', v_employee_id);
exception
  when others then
    return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.save_employee(uuid, uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
