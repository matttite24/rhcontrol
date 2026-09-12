import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { SubHeader } from '@/components/layout/SubHeader'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { PayrollTableView } from '@/components/payroll/PayrollTableView'
import { SavePayrollReportButton } from '@/components/payroll/SavePayrollReportButton'
import { calculatePayroll } from '@/lib/payroll/calculate'
import { Employee, EmployeeSalary, Deduction, ShiftRequest, Incident, EmployeeSchedule } from '@/types/employee'
import Link from 'next/link'
import { Search, Filter, Calculator, DollarSign, Users, TrendingUp, TrendingDown, Calendar, FileSpreadsheet, X } from 'lucide-react'
import { NoActiveOrg } from '@/components/org/NoActiveOrg'
import { cn } from '@/lib/utils'

interface PayrollPageProps {
  searchParams: Promise<{
    q?: string
    start_date?: string
    end_date?: string
    department?: string
  }>
}

// Helper para obtener primer y último día del mes actual por defecto
function getDefaultDateRange() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  // Ejemplo: del 1 al fin de mes (o fecha personalizada como 25 a 25)
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const format = (d: Date) => d.toISOString().split('T')[0]
  return {
    start: format(firstDay),
    end: format(lastDay),
  }
}

export default async function PayrollPage({ searchParams }: PayrollPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const currentOrg = await getCurrentOrganization()

  const defaultRange = getDefaultDateRange()
  const startDate = params.start_date || defaultRange.start
  const endDate = params.end_date || defaultRange.end

  if (!currentOrg) {
    return (
      <NoActiveOrg action="generar su reporte de nómina" />
    )
  }

  // 1. Obtener lista de departamentos para filtros
  const { data: deptData } = await supabase
    .from('departments')
    .select('name')
    .eq('organization_id', currentOrg.id)
    .order('name')

  const departments = (deptData || []).map((d) => d.name)

  // 2. Obtener empleados con sus conceptos salariales configurados y su
  // horario semanal (necesario para calcular días trabajados en descuentos
  // recurrentes "por días trabajados")
  let empQuery = supabase
    .from('employees')
    .select(`
      *,
      salaries:employee_salaries (*),
      schedules:employee_schedules (*)
    `)
    .eq('organization_id', currentOrg.id)
    .order('full_name')

  if (params.department) {
    empQuery = empQuery.eq('department', params.department)
  }

  const { data: employeesData } = await empQuery
  const rawEmployees = (employeesData || []) as (Employee & { salaries: EmployeeSalary[]; schedules: EmployeeSchedule[] })[]

  // 3. Obtener descuentos dentro del rango de corte
  const { data: deductionsData } = await supabase
    .from('deductions')
    .select('*')
    .eq('organization_id', currentOrg.id)
    .neq('status', 'anulado')
    .gte('date', startDate)
    .lte('date', endDate)

  const rawDeductions = (deductionsData || []) as Deduction[]

  // 3.1 Reglas de descuento RECURRENTE activas (alimentación/vivienda) — no
  // llevan un registro por mes, se aplican en cada corte mientras estén
  // activas (status distinto de 'anulado'), independientemente de su `date`
  // original de creación.
  const { data: recurringData } = await supabase
    .from('deductions')
    .select('*')
    .eq('organization_id', currentOrg.id)
    .eq('is_recurring', true)
    .neq('status', 'anulado')

  const rawRecurringRules = (recurringData || []) as Deduction[]

  // 4. Obtener TODAS las solicitudes de turnos dentro del rango de corte
  const { data: shiftsData } = await supabase
    .from('shift_requests')
    .select('*')
    .eq('organization_id', currentOrg.id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('created_at', { ascending: true })

  const rawShifts = (shiftsData || []) as ShiftRequest[]

  // 5. Obtener TODAS las incidencias, anticipos y llamados de atención dentro del rango
  const { data: incidentsData } = await supabase
    .from('incidents')
    .select('*')
    .eq('organization_id', currentOrg.id)
    .gte('start_date', startDate)
    .lte('start_date', endDate)
    .order('created_at', { ascending: true })

  const rawIncidents = (incidentsData || []) as Incident[]

  const calculations = calculatePayroll({
    startDate,
    endDate,
    rawEmployees,
    rawDeductions,
    rawRecurringRules,
    rawShifts,
    rawIncidents,
  })

  // Filtro de búsqueda por texto
  const filteredCalculations = calculations.filter((item) => {
    if (!params.q) return true
    const term = params.q.toLowerCase()
    return (
      item.fullName.toLowerCase().includes(term) ||
      item.nationalId?.toLowerCase().includes(term) ||
      item.department?.toLowerCase().includes(term) ||
      item.position?.toLowerCase().includes(term)
    )
  })

  // Totales Globales del Período
  const totalPayrollCost = filteredCalculations.reduce((sum, c) => sum + c.totalIncome, 0)
  const totalDeductionsSum = filteredCalculations.reduce((sum, c) => sum + c.totalDeductions, 0)
  const totalNetToPay = filteredCalculations.reduce((sum, c) => sum + c.netSalary, 0)

  const hasFilters = Boolean(params.q || params.department || params.start_date || params.end_date)

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      {/* Header oficial con títulos y botón de guardar */}
      <PageHeader
        title="Generar Rol"
        description="Cálculo y consolidación general de haberes, horas extras y deducciones"
        breadcrumbs={[
          { label: 'Nómina', href: '/payroll' },
          { label: 'Generar Reporte' },
        ]}
        action={
          <SavePayrollReportButton
            organizationId={currentOrg.id}
            startDate={startDate}
            endDate={endDate}
            department={params.department}
            calculations={filteredCalculations}
          />
        }
      />

      {/* Subbarra de Filtros con Rango de Fechas (Corte Inicial y Final) */}
      <SubHeader
        search={{
          name: 'q',
          defaultValue: params.q,
          placeholder: 'Buscar por empleado...',
        }}
        selects={[
          {
            name: 'department',
            defaultValue: params.department ?? '',
            placeholder: 'Todos los departamentos',
            options: departments.map((d) => ({ value: d, label: d })),
          },
        ]}
        dateRange={{
          fromName: 'start_date',
          toName: 'end_date',
          defaultFrom: startDate,
          defaultTo: endDate,
          placeholder: 'Rango del período de corte',
        }}
        hasFilters={hasFilters}
        clearHref="/payroll"
        submitLabel="Actualizar"
        counter={`${filteredCalculations.length} ${filteredCalculations.length === 1 ? 'empleado' : 'empleados'}`}
      />

      {/* Tarjetas KPI de Resumen Económico */}
      <div className="px-6 py-4 border-b bg-muted/20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border bg-card shadow-2xs space-y-1">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Total Haberes / Ingresos
            </span>
            <p className="text-xl font-bold font-mono text-foreground">
              ${totalPayrollCost.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="p-4 rounded-xl border bg-card shadow-2xs space-y-1">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4 text-rose-500" />
              Total Deducciones & Descuentos
            </span>
            <p className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
              -${totalDeductionsSum.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="p-4 rounded-xl border bg-primary/5 border-primary/20 shadow-2xs space-y-1">
            <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" />
              Neto a Pagar en Nómina
            </span>
            <p className="text-xl font-black font-mono text-primary">
              ${totalNetToPay.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Vista de Tabla a Ancho Completo */}
      <div className="flex-1 p-6 md:p-8 w-full">
        {filteredCalculations.length > 0 ? (
          <PayrollTableView
            calculations={filteredCalculations}
            startDate={startDate}
            endDate={endDate}
          />
        ) : (
          <div className="rounded-xl border border-dashed p-12 text-center bg-card/40 max-w-md mx-auto my-8">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
              <Calculator className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-base text-foreground">Sin empleados para liquidar</h3>
            <p className="text-xs text-muted-foreground mt-1.5 mb-5 max-w-xs mx-auto">
              No hay empleados registrados o que coincidan con los filtros seleccionados.
            </p>
            <Link href="/employees/new" className={cn(buttonVariants({ size: 'sm' }))}>
              Registrar Empleado
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
