'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface MarkQuincenaPaidInput {
  organizationId: string
  periodYear: number
  periodMonth: number
  // Solo se marcan como pagados los empleados explícitamente confirmados
  // (checkbox marcado en la tabla) — quien no se incluya aquí no queda
  // registrado en quincena_payments y por lo tanto no se le descuenta el
  // anticipo en el Rol de ese mes (ver calculate.ts).
  employees: { employeeId: string; amount: number }[]
}

/**
 * Marca como pagadas las quincenas seleccionadas del período — inserta un
 * registro en quincena_payments por empleado. calculatePayroll() solo
 * descuenta biweekly_advance_amount de un empleado en el Rol mensual si
 * existe un registro aquí para el año/mes que cubre el corte.
 */
export async function markQuincenaPaidAction(
  input: MarkQuincenaPaidInput
): Promise<{ success: boolean; error?: string; paidCount?: number }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado.' }

    if (input.employees.length === 0) {
      return { success: false, error: 'No hay empleados seleccionados para marcar como pagados.' }
    }

    const rows = input.employees.map((e) => ({
      organization_id: input.organizationId,
      employee_id: e.employeeId,
      period_year: input.periodYear,
      period_month: input.periodMonth,
      amount: e.amount,
      paid_by: user.id,
      paid_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('quincena_payments')
      .upsert(rows, { onConflict: 'organization_id,employee_id,period_year,period_month' })

    if (error) {
      console.error('[markQuincenaPaidAction] Error al registrar pagos de quincena:', error)
      return { success: false, error: 'No se pudo registrar el pago. Intenta de nuevo.' }
    }

    revalidatePath('/payroll/quincena')
    revalidatePath('/payroll')

    return { success: true, paidCount: rows.length }
  } catch (err) {
    console.error('[markQuincenaPaidAction] Error inesperado:', err)
    return { success: false, error: 'Error inesperado al registrar el pago.' }
  }
}
