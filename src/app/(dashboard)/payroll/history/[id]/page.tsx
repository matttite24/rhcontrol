import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { PayrollTableView } from '@/components/payroll/PayrollTableView'
import { fetchCutDeductions } from '@/lib/payroll/cut-deductions'
import { RefreshPayrollButton } from '@/components/payroll/RefreshPayrollButton'
import { GeneratePayrollButton } from '@/components/payroll/GeneratePayrollButton'
import { PayrollHistoryPayoutButtons } from '@/components/payroll/PayrollHistoryPayoutButtons'
import { calculatePayroll } from '@/lib/payroll/calculate'
import {
  PayrollReport,
  Employee,
  EmployeeSalary,
  EmployeeSchedule,
  Deduction,
  ShiftRequest,
  Incident,
  PayrollOvertimeAdjustment,
  QuincenaPayment,
} from '@/types/employee'
import { PayrollEmployeeCalculation } from '@/components/payroll/PayrollDetailModal'
import { Badge } from '@/components/ui/badge'
import { Calendar, Users, DollarSign, TrendingUp, TrendingDown, Building, History } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PayrollReportDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function PayrollReportDetailPage({ params }: PayrollReportDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const currentOrg = await getCurrentOrganization()

  if (!currentOrg) return notFound()

  const { data: reportData, error } = await supabase
    .from('payroll_reports')
    .select('*')
    .eq('id', id)
    .eq('organization_id', currentOrg.id)
    .single()

  if (error || !reportData) {
    notFound()
  }

  const report = reportData as PayrollReport
  const isDraft = report.status === 'borrador'

  // Un borrador se recalcula EN VIVO (empleados/solicitudes/deducciones
  // pueden haber cambiado desde que se guardó, y los ajustes de Novedades
  // deben reflejarse de inmediato) en vez de leer el snapshot congelado.
  // Un rol ya cerrado sí usa su snapshot fijo — es el registro histórico.
  let calculations: PayrollEmployeeCalculation[]

  if (isDraft) {
    let empQuery = supabase
      .from('employees')
      .select(`*, salaries:employee_salaries (*), schedules:employee_schedules (*)`)
      .eq('organization_id', currentOrg.id)
      .order('full_name')
    if (report.department) empQuery = empQuery.eq('department', report.department)

    const endDateParts = report.end_date.split('-').map(Number)
    const periodYear = endDateParts[0]
    const periodMonth = endDateParts[1]

    const [
      { data: employeesData },
      { data: deductionsData },
      { data: recurringData },
      { data: shiftsData },
      { data: incidentsData },
      { data: adjustmentsData },
      { data: quincenaPaymentsData },
    ] = await Promise.all([
      empQuery,
      fetchCutDeductions(supabase, currentOrg.id, report.start_date, report.end_date, {
        department: report.department,
        excludeReportId: report.id,
      }).then((data) => ({ data })),
      supabase
        .from('deductions')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .eq('is_recurring', true)
        .neq('status', 'anulado'),
      supabase
        .from('shift_requests')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .gte('date', report.start_date)
        .lte('date', report.end_date)
        .order('created_at', { ascending: true }),
      // Vacaciones vive únicamente en shift_requests (Novedades) — ver
      // createVacationRequestAction y el mismo filtro en /incidents/page.tsx
      // y /payroll/page.tsx. Excluye filas históricas de tipo
      // solicitud_vacaciones que hayan quedado en `incidents` de antes de
      // ese cambio, para no duplicar el mismo período de vacaciones en la
      // pestaña "Incidencias" del drawer.
      supabase
        .from('incidents')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .neq('incident_type', 'solicitud_vacaciones')
        .gte('start_date', report.start_date)
        .lte('start_date', report.end_date)
        .order('created_at', { ascending: true }),
      supabase
        .from('payroll_overtime_adjustments')
        .select('*')
        .eq('payroll_report_id', report.id),

      // Anticipos quincenales marcados como pagados en el mes del corte.
      supabase
        .from('quincena_payments')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .eq('period_year', periodYear)
        .eq('period_month', periodMonth),
    ])

    const rawEmployees = (employeesData || []) as (Employee & {
      salaries: EmployeeSalary[]
      schedules: EmployeeSchedule[]
    })[]

    calculations = calculatePayroll({
      startDate: report.start_date,
      endDate: report.end_date,
      rawEmployees,
      rawDeductions: (deductionsData || []) as Deduction[],
      rawRecurringRules: (recurringData || []) as Deduction[],
      rawShifts: (shiftsData || []) as ShiftRequest[],
      rawIncidents: (incidentsData || []) as Incident[],
      overtimeAdjustments: (adjustmentsData || []) as PayrollOvertimeAdjustment[],
      rawQuincenaPayments: (quincenaPaymentsData || []) as QuincenaPayment[],
    })
  } else {
    calculations = (report.snapshot || []) as PayrollEmployeeCalculation[]
  }

  // Empleados marcados como "revisados" en este rol (indicador visual, no afecta el cálculo).
  const { data: reviewsData } = await supabase
    .from('payroll_report_reviews')
    .select('employee_id')
    .eq('payroll_report_id', report.id)
  const reviewedEmployeeIds = (reviewsData || []).map((r) => r.employee_id as string)

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <PageHeader
        title={
          <div className="flex items-center gap-2.5">
            <span>{report.title}</span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-semibold",
                isDraft
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
              )}
            >
              {isDraft ? 'Borrador' : 'Generado'}
            </Badge>
          </div>
        }
        description={
          isDraft
            ? `Corte del ${report.start_date} al ${report.end_date} • En revisión, aún no generado`
            : `Corte del ${report.start_date} al ${report.end_date} • Guardado el ${new Date(report.created_at).toLocaleDateString('es-EC')}`
        }
        action={
          <div className="flex items-center gap-2">
            <PayrollHistoryPayoutButtons
              calculations={calculations}
              endDate={report.end_date}
              organization={currentOrg}
            />
            {isDraft && <RefreshPayrollButton />}
            {isDraft && <GeneratePayrollButton payrollReportId={report.id} />}
          </div>
        }
      />

      {/* Resumen de KPIs */}
      <div className="px-6 py-4 border-b bg-muted/20">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl border bg-card shadow-2xs space-y-1">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" />
              Empleados
            </span>
            <p className="text-lg font-bold font-mono text-foreground">
              {calculations.length}
            </p>
          </div>

          <div className="p-3.5 rounded-xl border bg-card shadow-2xs space-y-1">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Total Haberes
            </span>
            <p className="text-lg font-bold font-mono text-foreground">
              ${calculations.reduce((s, c) => s + c.totalIncome, 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="p-3.5 rounded-xl border bg-card shadow-2xs space-y-1">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4 text-rose-500" />
              Total Deducciones
            </span>
            <p className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400">
              -${calculations.reduce((s, c) => s + c.totalDeductions, 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="p-3.5 rounded-xl border bg-primary/5 border-primary/20 shadow-2xs space-y-1">
            <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" />
              Neto Liquidado
            </span>
            <p className="text-lg font-black font-mono text-primary">
              ${calculations.reduce((s, c) => s + c.netSalary, 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Tabla con el cálculo (en vivo si es borrador, snapshot fijo si está cerrado) */}
      <div className="flex-1 p-6 md:p-8 w-full">
        <PayrollTableView
          calculations={calculations}
          startDate={report.start_date}
          endDate={report.end_date}
          payrollReportId={isDraft ? report.id : undefined}
          organizationId={currentOrg.id}
          hasSavedReport
          reviewReportId={report.id}
          reviewedEmployeeIds={reviewedEmployeeIds}
        />
      </div>
    </div>
  )
}
