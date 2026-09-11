-- ==============================================================================
-- RPC: ELIMINAR EMPLEADO (BORRADO PERMANENTE)
-- Ejecuta este script en el SQL Editor de Supabase
-- ==============================================================================
--
-- Borra el empleado y TODO lo relacionado (salarios, horarios, incidencias,
-- solicitudes de turno, descuentos, documentos, liquidaciones) en una sola
-- transacción. No hay confirmación de que las FKs tengan ON DELETE CASCADE
-- configurado (esas tablas se crearon fuera de este historial de migraciones),
-- así que se borra explícitamente en el orden correcto en vez de asumirlo.
--
-- Nota: employee_documents.file_url apunta a un archivo en Supabase Storage;
-- este RPC borra la FILA de metadata pero no el archivo en Storage (eso
-- requiere la Storage API, no SQL). Los archivos huérfanos no son un problema
-- funcional, pero conviene una limpieza periódica si se usa mucho en producción.

create or replace function public.delete_employee(p_employee_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  -- Verificar que el empleado exista y obtener su organización.
  select organization_id into v_org_id
  from employees
  where id = p_employee_id;

  if v_org_id is null then
    return json_build_object('success', false, 'error', 'Empleado no encontrado.');
  end if;

  -- Solo admin/owner de esa organización puede eliminar empleados.
  if not public.is_org_admin_or_owner(v_org_id) then
    return json_build_object('success', false, 'error', 'No tienes permisos para eliminar empleados de esta organización.');
  end if;

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
