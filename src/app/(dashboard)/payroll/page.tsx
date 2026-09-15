import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { SubHeader } from '@/components/layout/SubHeader'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { PayrollWorkspaceProvider, PayrollSaveButtonSlot, PayrollTableSlot, PayrollKpiSlot, PayrollPayoutButtonsSlot } from '@/components/payroll/PayrollWorkspace'
import { calculatePayroll } from '@/lib/payroll/calculate'
import { Employee, EmployeeSalary, Deduction, ShiftRequest, Incident, EmployeeSchedule, QuincenaPayment } from '@/types/employee'
import Link from 'next/link'
import { Search, Filter, Calculator, Users, Calendar, FileSpreadsheet, X } from 'lucide-react'
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

export default async function PayrollPage({ searchParams }: PayrollPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const currentOrg = await getCurrentOrganization()

  if (!currentOrg) {
    return (
      <NoActiveOrg action="generar su reporte de nómina" />
    )
  }

  // El cálculo solo se dispara cuando el usuario elige explícitamente un
  // rango de fechas (antes se precargaba el mes actual automáticamente al
  // entrar) — más intuitivo: primero se pide el corte a liquidar, y recién
  // ahí se ejecutan las 5 consultas + el cálculo de nómina, en vez de correr
  // ese trabajo "a ciegas" contra un rango que el usuario ni pidió.
  const hasDateRange = Boolean(params.start_date && params.end_date)
  const startDate = params.start_date || ''
  const endDate = params.end_date || ''

  // La lista de departamentos siempre se necesita para el selector de filtro
  // (es liviana: solo nombres) — es la única consulta que no depende de
  // haber elegido un rango de fechas.
  const { data: deptData } = await supabase
    .from('departments')
    .select('name')
    .eq('organization_id', currentOrg.id)
    .order('name')
  const departments = (deptData || []).map((d) => d.name)

  let filteredCalculations: ReturnType<typeof calculatePayroll> = []

  if (hasDateRange) {
    // Las 4 consultas de abajo son independientes entre sí (ninguna necesita
    // el resultado de otra) — corren en paralelo con Promise.all en vez de
    // en serie, para que el tiempo total sea el de la más lenta, no la suma.
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

    // El anticipo quincenal solo se descuenta en este Rol si fue marcado
    // como pagado en /payroll/quincena para el mes que cubre `endDate` (ver
    // quincena_payments y calculatePayroll).
    const endDateParts = endDate.split('-').map(Number)
    const periodYear = endDateParts[0]
    const periodMonth = endDateParts[1]

    const [
      { data: employeesData },
      { data: deductionsData },
      { data: recurringData },
      { data: shiftsData },
      { data: incidentsData },
      { data: quincenaPaymentsData },
    ] = await Promise.all([
      // Empleados con sus conceptos salariales configurados y su horario
      // semanal (necesario para calcular días trabajados en descuentos
      // recurrentes "por días trabajados")
      empQuery,

      // Descuentos dentro del rango de corte
      supabase
        .from('deductions')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .neq('status', 'anulado')
        .gte('date', startDate)
        .lte('date', endDate),

      // Reglas de descuento RECURRENTE activas (alimentación/vivienda) — no
      // llevan un registro por mes, se aplican en cada corte mientras estén
      // activas (status distinto de 'anulado'), independientemente de su
      // `date` original de creación.
      supabase
        .from('deductions')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .eq('is_recurring', true)
        .neq('status', 'anulado'),

      // Todas las solicitudes de turnos dentro del rango de corte
      supabase
        .from('shift_requests')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('created_at', { ascending: true }),

      // Todas las incidencias, anticipos y llamados de atención dentro del rango.
      // Vacaciones vive únicamente en shift_requests (Novedades) — ver
      // createVacationRequestAction y el mismo filtro en /incidents/page.tsx.
      // Filas históricas de tipo solicitud_vacaciones que quedaron en
      // `incidents` (de antes de ese cambio) se excluyen aquí también, para
      // no mostrar el mismo período de vacaciones duplicado en la pestaña
      // "Incidencias" del drawer (una vez desde shift_requests, otra desde
      // este reflejo viejo — y si el reflejo viejo quedó huérfano o
      // desactualizado tras editar/borrar la solicitud real, se veía un
      // "fantasma" que ya no existía en shift_requests).
      supabase
        .from('incidents')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .neq('incident_type', 'solicitud_vacaciones')
        .gte('start_date', startDate)
        .lte('start_date', endDate)
        .order('created_at', { ascending: true }),

      // Anticipos quincenales marcados como pagados en el mes del corte.
      supabase
        .from('quincena_payments')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .eq('period_year', periodYear)
        .eq('period_month', periodMonth),
    ])

    const rawEmployees = (employeesData || []) as (Employee & { salaries: EmployeeSalary[]; schedules: EmployeeSchedule[] })[]
    const rawDeductions = (deductionsData || []) as Deduction[]
    const rawRecurringRules = (recurringData || []) as Deduction[]
    const rawShifts = (shiftsData || []) as ShiftRequest[]
    const rawIncidents = (incidentsData || []) as Incident[]
    const rawQuincenaPayments = (quincenaPaymentsData || []) as QuincenaPayment[]

    const calculations = calculatePayroll({
      startDate,
      endDate,
      rawEmployees,
      rawDeductions,
      rawRecurringRules,
      rawShifts,
      rawIncidents,
      rawQuincenaPayments,
    })

    // Filtro de búsqueda por texto
    filteredCalculations = calculations.filter((item) => {
      if (!params.q) return true
      const term = params.q.toLowerCase()
      return (
        item.fullName.toLowerCase().includes(term) ||
        item.nationalId?.toLowerCase().includes(term) ||
        item.department?.toLowerCase().includes(term) ||
        item.position?.toLowerCase().includes(term)
      )
    })
  }

  const hasFilters = Boolean(params.q || params.department || params.start_date || params.end_date)

  return (
    <PayrollWorkspaceProvider
      calculations={filteredCalculations}
      startDate={startDate}
      endDate={endDate}
      department={params.department}
    >
    <div className="flex flex-col flex-1 min-h-screen">
      {/* Header oficial con títulos y botón de guardar */}
      <PageHeader
        title="Generar Rol"
        description="Cálculo y consolidación general de haberes, horas extras y deducciones"
        action={
          <div className="flex items-center gap-2">
            {hasDateRange && (
              <PayrollPayoutButtonsSlot
                calculations={filteredCalculations}
                endDate={endDate}
                organization={currentOrg}
              />
            )}
            <PayrollSaveButtonSlot
              organizationId={currentOrg.id}
              startDate={startDate}
              endDate={endDate}
              department={params.department}
              calculations={filteredCalculations}
            />
          </div>
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
        submitLabel={hasDateRange ? 'Actualizar' : 'Cargar'}
        counter={hasDateRange ? `${filteredCalculations.length} ${filteredCalculations.length === 1 ? 'empleado' : 'empleados'}` : 'Sin cargar'}
      />

      {!hasDateRange ? (
        /* Estado inicial: sin rango de fechas elegido todavía no se ejecuta
           ninguna consulta ni cálculo — evita correr el trabajo pesado de
           calculatePayroll "a ciegas" contra un rango que nadie pidió, y deja
           claro cuál es el primer paso antes de ver cualquier dato. */
        <div className="flex-1 flex items-center justify-center p-6 md:p-8">
          <div className="rounded-xl border border-dashed p-12 text-center bg-card/40 max-w-md mx-auto">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
              <Calendar className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-base text-foreground">Selecciona el período de corte</h3>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
              Elige el rango de fechas del rol a liquidar y pulsa <strong>"Cargar"</strong> para calcular haberes, horas extras y deducciones de ese período.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Tarjetas KPI de Resumen Económico — suman solo lo seleccionado en la tabla */}
          <div className="px-6 py-4 border-b bg-muted/20">
            <PayrollKpiSlot calculations={filteredCalculations} />
          </div>

          {/* Vista de Tabla a Ancho Completo */}
          <div className="flex-1 p-6 md:p-8 w-full">
            {filteredCalculations.length > 0 ? (
              <PayrollTableSlot
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
        </>
      )}
    </div>
    </PayrollWorkspaceProvider>
  )
}
