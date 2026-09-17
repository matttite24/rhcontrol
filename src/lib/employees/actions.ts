'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { EmployeeInsert, DayOfWeek } from '@/types/employee'
import { SalaryRowItem } from '@/components/employees/EmployeeForm'

interface SchedulePayloadItem {
  id?: string
  day_of_week: DayOfWeek
  day_order: number
  is_workday: boolean
  has_split_shift: boolean
  start_time_1: string | null
  end_time_1: string | null
  start_time_2: string | null
  end_time_2: string | null
}

interface SaveEmployeeParams {
  employeeId?: string
  organizationId: string
  employee: EmployeeInsert
  salaries: SalaryRowItem[]
  schedules: SchedulePayloadItem[]
  rotatingSchedule: { pattern_id: string; anchor_date: string } | null
}

/**
 * Crea o actualiza un empleado junto con sus salarios, horario semanal y
 * horario rotativo en una sola llamada transaccional (RPC `save_employee`).
 *
 * Reemplaza el flujo anterior, que hacía 7 escrituras secuenciales directo
 * desde el navegador (update/insert de employees + delete/insert de
 * employee_salaries + delete/insert de employee_schedules + delete/insert de
 * employee_rotating_schedules): cada paso era un round-trip aparte —de ahí la
 * lentitud percibida— y los inserts de salarios/horarios solo registraban el
 * error en consola sin abortar ni avisar al usuario, así que un fallo a mitad
 * de la cadena (ej. delete aplicado, insert siguiente fallando por timeout)
 * dejaba al empleado con datos parciales mientras se mostraba "guardado con
 * éxito". El RPC corre las mismas operaciones dentro de una transacción de
 * Postgres: si algo falla, se revierte todo, y es una sola llamada de red.
 */
export async function saveEmployeeAction(
  params: SaveEmployeeParams
): Promise<{ success: boolean; employeeId?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado.' }
    }

    const { data, error } = await supabase.rpc('save_employee', {
      p_employee_id: params.employeeId ?? null,
      p_organization_id: params.organizationId,
      p_employee: params.employee,
      p_salaries: params.salaries,
      p_schedules: params.schedules,
      p_rotating_schedule: params.rotatingSchedule,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'No se pudo guardar el empleado.' }
    }

    revalidatePath('/employees')
    if (data.employee_id) revalidatePath(`/employees/${data.employee_id}`)

    return { success: true, employeeId: data.employee_id }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error al guardar el empleado.',
    }
  }
}

/**
 * Elimina permanentemente un empleado y todos sus datos relacionados
 * (salarios, horarios, incidencias, solicitudes, descuentos, documentos,
 * liquidaciones). Llama al RPC transaccional `delete_employee`, que también
 * valida que el usuario sea admin/owner de la organización del empleado.
 */
export async function deleteEmployeeAction(
  employeeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!employeeId) {
      return { success: false, error: 'ID de empleado inválido.' }
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado.' }
    }

    const { data, error } = await supabase.rpc('delete_employee', {
      p_employee_id: employeeId,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'No se pudo eliminar el empleado.' }
    }

    revalidatePath('/employees')

    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error al eliminar el empleado.',
    }
  }
}
