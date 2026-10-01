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
  // paymentMethod 'Cheque' ya NO requiere checkNumber al pagar: el número se
  // registra después con setQuincenaCheckNumberAction, cuando se emite el cheque.
  employees: { employeeId: string; amount: number; paymentMethod: 'Transferencia' | 'Cheque'; checkNumber?: string | null }[]
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

    // Defensa en profundidad: aunque la UI ya excluye del checklist a quien
    // fue pagado, se vuelve a filtrar aquí contra la base de datos antes de
    // insertar — un empleado ya pagado en este período nunca debe
    // sobrescribir su paid_at/amount por un reintento o una petición manual.
    const employeeIds = input.employees.map((e) => e.employeeId)
    const { data: alreadyPaid, error: checkError } = await supabase
      .from('quincena_payments')
      .select('employee_id')
      .eq('organization_id', input.organizationId)
      .eq('period_year', input.periodYear)
      .eq('period_month', input.periodMonth)
      .in('employee_id', employeeIds)

    if (checkError) {
      console.error('[markQuincenaPaidAction] Error al verificar pagos existentes:', checkError)
      return { success: false, error: 'No se pudo verificar el estado de pago. Intenta de nuevo.' }
    }

    const alreadyPaidIds = new Set((alreadyPaid || []).map((r) => r.employee_id))
    const pendingEmployees = input.employees.filter((e) => !alreadyPaidIds.has(e.employeeId))

    if (pendingEmployees.length === 0) {
      return { success: false, error: 'Los empleados seleccionados ya fueron pagados en este período.' }
    }

    const rows = pendingEmployees.map((e) => ({
      organization_id: input.organizationId,
      employee_id: e.employeeId,
      period_year: input.periodYear,
      period_month: input.periodMonth,
      amount: e.amount,
      payment_method: e.paymentMethod,
      check_number: e.paymentMethod === 'Cheque' ? e.checkNumber?.trim() || null : null,
      paid_by: user.id,
      paid_at: new Date().toISOString(),
    }))

    const { error } = await supabase.from('quincena_payments').insert(rows)

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

interface ReleaseQuincenaPaymentsInput {
  organizationId: string
  periodYear: number
  periodMonth: number
  employeeIds: string[]
}

/**
 * Suelta (revierte) el pago de quincena de los empleados indicados en un
 * período: elimina su registro de quincena_payments, así vuelven a quedar
 * "Pendiente" y se pueden pagar de nuevo (p. ej. si se pagó el mes
 * equivocado). Sin ese registro, calculatePayroll() deja de descontar el
 * anticipo en el Rol de ese mes. Un rol ya 'cerrado' conserva su snapshot.
 */
export async function releaseQuincenaPaymentsAction(
  input: ReleaseQuincenaPaymentsInput
): Promise<{ success: boolean; error?: string; releasedCount?: number }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado.' }

    if (input.employeeIds.length === 0) {
      return { success: false, error: 'No hay pagos seleccionados para soltar.' }
    }

    const { data, error } = await supabase
      .from('quincena_payments')
      .delete()
      .eq('organization_id', input.organizationId)
      .eq('period_year', input.periodYear)
      .eq('period_month', input.periodMonth)
      .in('employee_id', input.employeeIds)
      .select('id')

    if (error) {
      console.error('[releaseQuincenaPaymentsAction] Error al soltar pagos de quincena:', error)
      return { success: false, error: 'No se pudo soltar el pago. Intenta de nuevo.' }
    }
    // Con RLS, un delete sin permiso no falla: simplemente no borra filas.
    if (!data || data.length === 0) {
      return { success: false, error: 'No se encontró ningún pago para soltar en este período.' }
    }

    revalidatePath('/payroll/quincena')
    revalidatePath('/payroll')

    return { success: true, releasedCount: data.length }
  } catch (err) {
    console.error('[releaseQuincenaPaymentsAction] Error inesperado:', err)
    return { success: false, error: 'Error inesperado al soltar el pago.' }
  }
}

interface SetQuincenaCheckNumberInput {
  organizationId: string
  periodYear: number
  periodMonth: number
  employeeId: string
  /** Vacío/null borra el número registrado. */
  checkNumber: string | null
}

/**
 * Registra (o corrige) el número de cheque de un pago de quincena ya hecho.
 * Solo aplica a pagos con payment_method 'Cheque'.
 */
export async function setQuincenaCheckNumberAction(
  input: SetQuincenaCheckNumberInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado.' }

    const { data, error } = await supabase
      .from('quincena_payments')
      .update({ check_number: input.checkNumber?.trim() || null })
      .eq('organization_id', input.organizationId)
      .eq('employee_id', input.employeeId)
      .eq('period_year', input.periodYear)
      .eq('period_month', input.periodMonth)
      .eq('payment_method', 'Cheque')
      .select('id')

    if (error) {
      console.error('[setQuincenaCheckNumberAction] Error al registrar el cheque:', error)
      return { success: false, error: 'No se pudo registrar el número de cheque. Intenta de nuevo.' }
    }
    // Con RLS, un update sin permiso no falla: simplemente no afecta filas.
    if (!data || data.length === 0) {
      return { success: false, error: 'No se encontró el pago por cheque de este empleado en el período.' }
    }

    revalidatePath('/payroll/quincena')
    return { success: true }
  } catch (err) {
    console.error('[setQuincenaCheckNumberAction] Error inesperado:', err)
    return { success: false, error: 'Error inesperado al registrar el número de cheque.' }
  }
}
