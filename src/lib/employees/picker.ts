import type { SupabaseClient } from '@supabase/supabase-js'
import type { Employee } from '@/types/employee'

/**
 * Columnas de empleado que realmente usan los asistentes/modales de crear
 * (incidencias, descuentos, novedades). Antes se hacía select('*') y se
 * serializaban todas las columnas de todos los empleados al cliente.
 */
export const EMPLOYEE_PICKER_COLUMNS =
  'id, organization_id, full_name, national_id, department, position, avatar_url, status, hire_date'

export function fetchEmployeePickerList(
  supabase: SupabaseClient,
  orgId: string,
  opts: { excludeInactive?: boolean } = {}
) {
  let q = supabase.from('employees').select(EMPLOYEE_PICKER_COLUMNS).eq('organization_id', orgId)
  if (opts.excludeInactive) q = q.neq('status', 'inactivo')
  return q.order('full_name').then((res) => ({
    ...res,
    data: (res.data ?? []) as unknown as Employee[],
  }))
}

/**
 * IDs de empleados cuyo nombre o cédula contienen `term`. Se resuelve en la
 * base (solo ids) en vez de recorrer en memoria la lista completa de empleados.
 */
export async function findMatchingEmployeeIds(
  supabase: SupabaseClient,
  orgId: string,
  term: string,
  opts: { excludeInactive?: boolean } = {}
): Promise<string[]> {
  // Escapa comodines de LIKE y comillas para tratar el término como texto literal.
  const safe = term
    .replace(/[\\%_]/g, (c) => `\\${c}`)
    .replace(/"/g, '\\"')
  const pattern = `"%${safe}%"`
  let q = supabase
    .from('employees')
    .select('id')
    .eq('organization_id', orgId)
    .or(`full_name.ilike.${pattern},national_id.ilike.${pattern}`)
  if (opts.excludeInactive) q = q.neq('status', 'inactivo')
  const { data } = await q
  return (data ?? []).map((e: { id: string }) => e.id)
}
