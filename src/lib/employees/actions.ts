'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
