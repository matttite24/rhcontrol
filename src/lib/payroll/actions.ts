'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { calculatePayroll } from '@/lib/payroll/calculate'
import {
  Employee,
  EmployeeSalary,
  EmployeeSchedule,
  Deduction,
  ShiftRequest,
  Incident,
  PayrollOvertimeAdjustment,
} from '@/types/employee'

/**
 * Crea o actualiza el ajuste de "horas efectivamente cumplidas" de una hora
 * extra aprobada, ligado al reporte de rol en revisión (pestaña Novedades).
 * Solo tiene efecto mientras el reporte esté en 'borrador' — un reporte
 * 'cerrado' ya tiene su snapshot fijo y no se recalcula.
 */
export async function upsertOvertimeAdjustmentAction(input: {
  organizationId: string
  payrollReportId: string
  shiftRequestId: string
  employeeId: string
  actualHours: number
  reason: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado.' }

    if (input.actualHours < 0) {
      return { success: false, error: 'Las horas efectivas no pueden ser negativas.' }
    }
    if (!input.reason.trim()) {
      return { success: false, error: 'Debes indicar un motivo para el ajuste.' }
    }

    // El reporte debe seguir en borrador: cerrar el rol congela el snapshot,
    // y permitir un ajuste después haría que Novedades y el snapshot guardado
    // se desincronicen silenciosamente.
    const { data: report } = await supabase
      .from('payroll_reports')
      .select('status')
      .eq('id', input.payrollReportId)
      .single()

    if (!report || report.status !== 'borrador') {
      return { success: false, error: 'Este rol ya fue generado y no admite más ajustes.' }
    }

    const { error } = await supabase.from('payroll_overtime_adjustments').upsert(
      {
        organization_id: input.organizationId,
        payroll_report_id: input.payrollReportId,
        shift_request_id: input.shiftRequestId,
        employee_id: input.employeeId,
        actual_hours: input.actualHours,
        reason: input.reason.trim(),
        created_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'payroll_report_id,shift_request_id' }
    )

    if (error) return { success: false, error: error.message }

    revalidatePath(`/payroll/history/${input.payrollReportId}`)
    return { success: true }
  } catch (err) {
    console.error(err)
    return { success: false, error: 'Ocurrió un error inesperado.' }
  }
}

export async function deleteOvertimeAdjustmentAction(
  payrollReportId: string,
  shiftRequestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado.' }

    const { data: report } = await supabase
      .from('payroll_reports')
      .select('status')
      .eq('id', payrollReportId)
      .single()

    if (!report || report.status !== 'borrador') {
      return { success: false, error: 'Este rol ya fue generado y no admite más ajustes.' }
    }

    const { error } = await supabase
      .from('payroll_overtime_adjustments')
      .delete()
      .eq('payroll_report_id', payrollReportId)
      .eq('shift_request_id', shiftRequestId)

    if (error) return { success: false, error: error.message }

    revalidatePath(`/payroll/history/${payrollReportId}`)
    return { success: true }
  } catch (err) {
    console.error(err)
    return { success: false, error: 'Ocurrió un error inesperado.' }
  }
}

/**
 * Cierra un rol en borrador: recalcula el snapshot con los ajustes de
 * Novedades ya aplicados, lo fija como definitivo (status 'cerrado') y ya no
 * admite más cambios — ni de Novedades ni de recálculo. Este es el botón
 * "Generar" del flujo Guardar Borrador -> revisar -> Generar.
 */
export async function generatePayrollReportAction(
  payrollReportId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado.' }

    const { data: report, error: reportError } = await supabase
      .from('payroll_reports')
      .select('*')
      .eq('id', payrollReportId)
      .single()

    if (reportError || !report) return { success: false, error: 'Reporte no encontrado.' }
    if (report.status !== 'borrador') {
      return { success: false, error: 'Este rol ya fue generado anteriormente.' }
    }

    const { organization_id: organizationId, start_date: startDate, end_date: endDate, department } = report

    // Recalcular con los mismos criterios que el borrador original, pero
    // aplicando los ajustes de Novedades guardados hasta ahora.
    let empQuery = supabase
      .from('employees')
      .select(`*, salaries:employee_salaries (*), schedules:employee_schedules (*)`)
      .eq('organization_id', organizationId)
      .order('full_name')
    if (department) empQuery = empQuery.eq('department', department)

    const [
      { data: employeesData },
      { data: deductionsData },
      { data: recurringData },
      { data: shiftsData },
      { data: incidentsData },
      { data: adjustmentsData },
    ] = await Promise.all([
      empQuery,
      supabase
        .from('deductions')
        .select('*')
        .eq('organization_id', organizationId)
        .neq('status', 'anulado')
        .gte('date', startDate)
        .lte('date', endDate),
      supabase
        .from('deductions')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_recurring', true)
        .neq('status', 'anulado'),
      supabase
        .from('shift_requests')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('created_at', { ascending: true }),
      supabase
        .from('incidents')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('start_date', startDate)
        .lte('start_date', endDate)
        .order('created_at', { ascending: true }),
      supabase
        .from('payroll_overtime_adjustments')
        .select('*')
        .eq('payroll_report_id', payrollReportId),
    ])

    const rawEmployees = (employeesData || []) as (Employee & {
      salaries: EmployeeSalary[]
      schedules: EmployeeSchedule[]
    })[]

    const calculations = calculatePayroll({
      startDate,
      endDate,
      rawEmployees,
      rawDeductions: (deductionsData || []) as Deduction[],
      rawRecurringRules: (recurringData || []) as Deduction[],
      rawShifts: (shiftsData || []) as ShiftRequest[],
      rawIncidents: (incidentsData || []) as Incident[],
      overtimeAdjustments: (adjustmentsData || []) as PayrollOvertimeAdjustment[],
    })

    const totalIncome = calculations.reduce((sum, c) => sum + c.totalIncome, 0)
    const totalDeductions = calculations.reduce((sum, c) => sum + c.totalDeductions, 0)
    const totalNet = calculations.reduce((sum, c) => sum + c.netSalary, 0)

    const { error: updateError } = await supabase
      .from('payroll_reports')
      .update({
        status: 'cerrado',
        total_employees: calculations.length,
        total_income: totalIncome,
        total_deductions: totalDeductions,
        total_net: totalNet,
        snapshot: calculations,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payrollReportId)

    if (updateError) return { success: false, error: updateError.message }

    revalidatePath(`/payroll/history/${payrollReportId}`)
    revalidatePath('/payroll/history')
    return { success: true }
  } catch (err) {
    console.error(err)
    return { success: false, error: 'Ocurrió un error inesperado al generar el rol.' }
  }
}
