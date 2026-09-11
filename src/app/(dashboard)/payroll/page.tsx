import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { SubHeader } from '@/components/layout/SubHeader'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { PayrollTableView } from '@/components/payroll/PayrollTableView'
import { SavePayrollReportButton } from '@/components/payroll/SavePayrollReportButton'
import { PayrollEmployeeCalculation } from '@/components/payroll/PayrollDetailModal'
import { calculateEcuadorDecimals, getIessPersonalRate } from '@/lib/payroll/ecuador'
import { Employee, EmployeeSalary, Deduction, ShiftRequest, Incident, EmployeeSchedule, DayOfWeek } from '@/types/employee'
import { getIncidentCode, getShiftRequestCode, INCIDENT_PREFIX_MAP } from '@/lib/incidents/sequence'
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

const DAYS_OF_WEEK_MAP: Record<number, DayOfWeek> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
}

function toIsoDate(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calcula los días efectivamente trabajados por un empleado en el rango del
 * corte: días calendario que son día laborable según su horario semanal
 * (employee_schedules), excluyendo fechas cubiertas por vacaciones
 * (shift_requests) o incapacidad (incidents) APROBADAS que caigan dentro
 * del rango.
 */
function calculateWorkedDays(
  startDateStr: string,
  endDateStr: string,
  schedules: EmployeeSchedule[],
  employeeShifts: ShiftRequest[],
  employeeIncidents: Incident[]
): number {
  const [sy, sm, sd] = startDateStr.split('-').map(Number)
  const [ey, em, ed] = endDateStr.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)

  // Fechas cubiertas por vacaciones o incapacidad aprobadas
  const absenceDates = new Set<string>()

  function markAbsenceRange(rangeStart?: string | null, rangeEnd?: string | null) {
    if (!rangeStart || !rangeEnd) return
    const [ry, rm, rd] = rangeStart.split('-').map(Number)
    const [rey, rem, red] = rangeEnd.split('-').map(Number)
    const cursor = new Date(ry, rm - 1, rd)
    const rEnd = new Date(rey, rem - 1, red)
    while (cursor <= rEnd) {
      absenceDates.add(toIsoDate(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  for (const req of employeeShifts) {
    const isVacation = req.request_type === 'solicitud_vacaciones' || req.metadata?.sub_type === 'solicitud_vacaciones'
    if (!isVacation || req.status !== 'aprobado') continue
    markAbsenceRange(req.metadata?.start_date || req.date, req.metadata?.end_date || req.date)
  }

  for (const inc of employeeIncidents) {
    if (inc.incident_type !== 'incapacidad' || inc.status !== 'aprobado') continue
    markAbsenceRange(inc.start_date, inc.end_date || inc.start_date)
  }

  let workedDays = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    const isoDate = toIsoDate(cursor)
    const dayName = DAYS_OF_WEEK_MAP[cursor.getDay()]
    const sched = schedules.find((s) => s.day_of_week === dayName)
    const isWorkday = sched?.is_workday ?? false

    if (isWorkday && !absenceDates.has(isoDate)) {
      workedDays += 1
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return workedDays
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

  // Construir mapa de códigos secuenciales deterministas para incidencias y solicitudes
  const incidentCounters: Record<string, number> = {}
  const incidentCodesMap = new Map<string, string>()
  for (const inc of rawIncidents) {
    const explicit = getIncidentCode(inc)
    const prefix = INCIDENT_PREFIX_MAP[inc.incident_type || 'otro'] || 'DOC'
    if (explicit) {
      const match = explicit.match(/^[A-Z]{3}-(\d+)$/)
      if (match) incidentCounters[prefix] = Math.max(incidentCounters[prefix] || 0, parseInt(match[1], 10))
      incidentCodesMap.set(inc.id, explicit)
    } else {
      incidentCounters[prefix] = (incidentCounters[prefix] || 0) + 1
      incidentCodesMap.set(inc.id, `${prefix}-${incidentCounters[prefix].toString().padStart(4, '0')}`)
    }
  }

  const shiftCounters: Record<string, number> = {}
  const shiftCodesMap = new Map<string, string>()
  for (const req of rawShifts) {
    const explicit = getShiftRequestCode(req)
    const effType = req.metadata?.sub_type || (req.request_type === 'otro' ? 'permiso_laboral' : req.request_type) || 'DOC'
    const prefix = INCIDENT_PREFIX_MAP[effType] || 'DOC'
    if (explicit) {
      const match = explicit.match(/^[A-Z]{3}-(\d+)$/)
      if (match) shiftCounters[prefix] = Math.max(shiftCounters[prefix] || 0, parseInt(match[1], 10))
      shiftCodesMap.set(req.id, explicit)
    } else {
      shiftCounters[prefix] = (shiftCounters[prefix] || 0) + 1
      shiftCodesMap.set(req.id, `${prefix}-${shiftCounters[prefix].toString().padStart(4, '0')}`)
    }
  }

  // 6. Consolidar cálculo económico y expediente de acciones por empleado
  const calculations: PayrollEmployeeCalculation[] = rawEmployees.map((emp) => {
    // a. Salario Base y Bonificaciones
    const salaryItems = (emp.salaries || []).map((s) => ({
      name: s.name || s.salary_type,
      amount: Number(s.amount) || 0,
      type: s.salary_type,
      affects_iess: s.affects_iess,
    }))

    const baseSalaryItem = salaryItems.find((s) => s.type === 'Sueldo')
    const baseSalary = baseSalaryItem ? baseSalaryItem.amount : 0
    const bonuses = salaryItems
      .filter((s) => s.type === 'Bonificacion')
      .reduce((sum, s) => sum + s.amount, 0)

    // b. Horas Extras aprobadas calculadas
    const empShifts = rawShifts.filter((s) => s.employee_id === emp.id)
    const approvedOvertimeShifts = empShifts.filter(
      (s) => s.request_type === 'horas_extras' && s.status === 'aprobado'
    )
    const overtimeHours = approvedOvertimeShifts.reduce((sum, s) => sum + (Number(s.hours) || 0), 0)
    // Tarifa hora aproximada = (Sueldo base / 240 horas) * 1.5 recargo
    const hourlyRate = baseSalary > 0 ? (baseSalary / 240) * 1.5 : 3.50
    const overtimeAmount = Number((overtimeHours * hourlyRate).toFixed(2))

    // c. Cálculo de Décimos y Beneficios Sociales Mensualizados (Ecuador)
    const accumulateDecimals = emp.accumulate_decimals === true
    const decimalsCalc = calculateEcuadorDecimals({
      baseSalary,
      overtimeAmount,
      bonuses,
      accumulateDecimals,
      reserveFundsTreatment: emp.reserve_funds || 'pagar_ano',
      hireDate: emp.hire_date,
      payrollDate: endDate,
    })

    // Total Ingresos (Base + Bonos + Horas Extras + Décimos/Fondos Mensualizados)
    const totalIncome = Number((baseSalary + bonuses + overtimeAmount + decimalsCalc.totalMensualizado).toFixed(2))

    // d. Aporte IESS Personal sobre base sueldo + horas extras + bonos.
    // Gerente Propietario autoafiliado: 17.60% (todo a su cargo, sin aporte
    // patronal aparte). Relación de dependencia normal: 9.45%.
    const iessTaxable = baseSalary + overtimeAmount + bonuses
    const iessRate = getIessPersonalRate(emp.is_owner_manager === true)
    const iessPersonal = emp.status === 'activo' ? Number((iessTaxable * iessRate).toFixed(2)) : 0

    // g (adelantado). Incidencias del empleado — se necesitan antes para
    // calcular días trabajados (incapacidad aprobada resta días del corte)
    const empIncidents = rawIncidents.filter((inc) => inc.employee_id === emp.id)

    // e. Descuentos económicos del empleado en el corte. Se excluyen los
    // registros que YA son la regla recurrente activa (se calculan aparte
    // más abajo) para no contarlos dos veces si su `date` original cae
    // dentro del rango del corte actual.
    const empDeductions = rawDeductions.filter(
      (d) => d.employee_id === emp.id && !d.is_recurring
    )
    const cashShortages = empDeductions
      .filter((d) => d.deduction_type === 'faltante_caja')
      .reduce((sum, d) => sum + Number(d.amount || 0), 0)
    const inventoryDeductions = empDeductions
      .filter((d) => d.deduction_type === 'inventario')
      .reduce((sum, d) => sum + Number(d.amount || 0), 0)
    const fines = empDeductions
      .filter((d) => d.deduction_type === 'multa')
      .reduce((sum, d) => sum + Number(d.amount || 0), 0)
    const loans = empDeductions
      .filter((d) => d.deduction_type === 'prestamo')
      .reduce((sum, d) => sum + Number(d.amount || 0), 0)
    const otherDeductions = empDeductions
      .filter((d) => d.deduction_type === 'otro')
      .reduce((sum, d) => sum + Number(d.amount || 0), 0)

    // e.1 Regla recurrente activa de Alimentación/Vivienda: se aplica en
    // cada corte mientras esté activa. Modalidad 'fijo' = mismo valor cada
    // mes; 'por_dias' = valor diario × días efectivamente trabajados.
    const empRecurringRule = rawRecurringRules.find(
      (d) => d.employee_id === emp.id && d.deduction_type === 'alimentacion'
    )
    let mealDeductions = 0
    let recurringDeductionDetail: {
      title: string
      amount: number
      calculationMode: 'fijo' | 'por_dias'
      workedDays?: number
    } | null = null

    if (empRecurringRule) {
      const calculationMode: 'fijo' | 'por_dias' =
        empRecurringRule.metadata?.calculation_mode === 'por_dias' ? 'por_dias' : 'fijo'
      const baseAmount = Number(empRecurringRule.metadata?.base_amount ?? empRecurringRule.amount) || 0

      if (calculationMode === 'por_dias') {
        const workedDays = calculateWorkedDays(
          startDate,
          endDate,
          emp.schedules || [],
          empShifts,
          empIncidents
        )
        mealDeductions = Number((baseAmount * workedDays).toFixed(2))
        recurringDeductionDetail = {
          title: empRecurringRule.title,
          amount: mealDeductions,
          calculationMode,
          workedDays,
        }
      } else {
        mealDeductions = Number(baseAmount.toFixed(2))
        recurringDeductionDetail = {
          title: empRecurringRule.title,
          amount: mealDeductions,
          calculationMode,
        }
      }
    }

    const totalEconomicDeductions =
      empDeductions.reduce((sum, d) => sum + Number(d.amount || 0), 0) + mealDeductions
    const totalDeductions = Number((iessPersonal + totalEconomicDeductions).toFixed(2))

    // f. Sueldo Neto a Recibir
    const netSalary = Number(Math.max(0, totalIncome - totalDeductions).toFixed(2))

    const actionsList: PayrollEmployeeCalculation['actions'] = []

    // Incidencias (Anticipos, Llamados de atención, Faltas, Incapacidades)
    for (const inc of empIncidents) {
      const docCode = incidentCodesMap.get(inc.id) || getIncidentCode(inc)
      const cleanTitle = inc.title ? inc.title.replace(/^\[[A-Z]{3}-\d+\]\s*/, '') : 'Incidencia'
      const isAdvance = inc.incident_type === 'anticipo_sueldo'
      const isWarning = inc.incident_type === 'llamado_atencion'
      const isDeliveryAct = inc.incident_type === 'acta_entrega'

      actionsList.push({
        id: inc.id,
        code: docCode,
        title: cleanTitle,
        type: isAdvance
          ? 'Anticipo de Sueldo'
          : isWarning
          ? 'Llamado de Atención'
          : isDeliveryAct
          ? 'Acta Entrega de Bienes'
          : inc.incident_type,
        category: isAdvance ? 'anticipo' : isWarning ? 'sancion' : 'incidencia',
        status: inc.status,
        date: inc.start_date || inc.created_at?.split('T')[0] || startDate,
        amount: inc.amount || null,
        description: inc.description || null,
      })
    }

    // Solicitudes de turnos (Permisos, Horas Extras, Cambios de Turno, Vacaciones)
    for (const req of empShifts) {
      const docCode = shiftCodesMap.get(req.id) || getShiftRequestCode(req)
      const cleanTitle = req.title ? req.title.replace(/^\[[A-Z]{3}-\d+\]\s*/, '') : 'Solicitud'
      const isOvertime = req.request_type === 'horas_extras'
      const isLeave = req.request_type === 'permiso_laboral' || req.metadata?.sub_type === 'permiso_laboral'

      actionsList.push({
        id: req.id,
        code: docCode,
        title: cleanTitle,
        type: isOvertime ? 'Horas Extras' : isLeave ? 'Permiso Laboral' : req.request_type,
        category: isOvertime ? 'turno' : isLeave ? 'permiso' : 'turno',
        status: req.status,
        date: req.date || req.created_at?.split('T')[0] || startDate,
        hours: req.hours || null,
        description: req.reason || null,
      })
    }

    // Ordenar acciones cronológicamente
    actionsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Resumen numérico
    const approvedActions = actionsList.filter((a) => a.status === 'aprobado').length
    const pendingActions = actionsList.filter((a) => a.status === 'pendiente').length
    const advancesTotal = actionsList
      .filter((a) => a.category === 'anticipo' && a.status === 'aprobado')
      .reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
    const warningsCount = actionsList.filter((a) => a.category === 'sancion').length

    return {
      employeeId: emp.id,
      fullName: emp.full_name,
      nationalId: emp.national_id ?? null,
      department: emp.department ?? null,
      position: emp.position ?? null,
      avatarUrl: emp.avatar_url ?? null,
      status: emp.status,
      contractType: emp.contract_type ?? null,
      paymentType: emp.payment_type ?? null,
      bankName: emp.bank_name ?? null,
      accountNumber: emp.account_number ?? null,

      baseSalary,
      bonuses,
      overtimeAmount,

      accumulateDecimals,
      decimoTercero: decimalsCalc.decimoTercero,
      decimoCuarto: decimalsCalc.decimoCuarto,
      fondosReserva: decimalsCalc.fondosReserva,
      totalDecimalsMonthly: decimalsCalc.totalMensualizado,

      totalIncome,

      iessPersonal,
      iessRate,
      isOwnerManager: emp.is_owner_manager === true,
      iessCode: emp.iess_code ?? null,
      cashShortages,
      inventoryDeductions,
      fines,
      loans,
      mealDeductions,
      otherDeductions,
      totalDeductions,

      netSalary,

      actionsSummary: {
        total: actionsList.length,
        approved: approvedActions,
        pending: pendingActions,
        advancesTotal,
        overtimeHours,
        warningsCount,
        leaveDaysOrHours: `${empShifts.filter((s) => s.request_type === 'permiso_laboral').length} permiso(s)`,
      },

      actions: actionsList,

      details: {
        salaryItems,
        deductionItems: [
          ...empDeductions.map((d) => ({
            title: d.title,
            amount: Number(d.amount || 0),
            type: d.deduction_type,
            is_recurring: d.is_recurring,
            date: d.date,
          })),
          ...(recurringDeductionDetail
            ? [
                {
                  title:
                    recurringDeductionDetail.calculationMode === 'por_dias'
                      ? `${recurringDeductionDetail.title} (${recurringDeductionDetail.workedDays} días trabajados)`
                      : recurringDeductionDetail.title,
                  amount: recurringDeductionDetail.amount,
                  type: 'alimentacion' as const,
                  is_recurring: true,
                  date: endDate,
                },
              ]
            : []),
        ],
        shiftRequests: empShifts.map((s) => ({
          title: s.title,
          hours: s.hours,
          date: s.date,
        })),
        incidents: empIncidents.map((i) => ({
          title: i.title,
          type: i.incident_type,
          date: i.start_date || i.created_at || startDate,
        })),
      },
    }
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
