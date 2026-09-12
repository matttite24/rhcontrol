import { calculateEcuadorDecimals, getIessPersonalRate } from '@/lib/payroll/ecuador'
import {
  Employee,
  EmployeeSalary,
  Deduction,
  ShiftRequest,
  Incident,
  EmployeeSchedule,
  DayOfWeek,
  PayrollOvertimeAdjustment,
} from '@/types/employee'
import { getIncidentCode, getShiftRequestCode, INCIDENT_PREFIX_MAP } from '@/lib/incidents/sequence'
import { PayrollEmployeeCalculation } from '@/components/payroll/PayrollDetailModal'

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

/** Días completos entre dos fechas ISO (YYYY-MM-DD), inclusive del punto de inicio. */
function daysBetweenIso(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number)
  const [ty, tm, td] = toIso.split('-').map(Number)
  const fromUtc = Date.UTC(fy, fm - 1, fd)
  const toUtc = Date.UTC(ty, tm - 1, td)
  return Math.round((toUtc - fromUtc) / 86400000)
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

export interface CalculatePayrollInput {
  startDate: string
  endDate: string
  rawEmployees: (Employee & { salaries: EmployeeSalary[]; schedules: EmployeeSchedule[] })[]
  rawDeductions: Deduction[]
  rawRecurringRules: Deduction[]
  rawShifts: ShiftRequest[]
  rawIncidents: Incident[]
  /**
   * Ajustes de "horas efectivamente cumplidas" del borrador en revisión (ver
   * payroll_overtime_adjustments) — sustituyen shift_requests.hours SOLO en
   * este cálculo, indexados por shift_request_id. Vacío/omitido en un cálculo
   * nuevo (aún sin borrador guardado, ver /payroll).
   */
  overtimeAdjustments?: PayrollOvertimeAdjustment[]
}

/**
 * Cálculo económico y expediente de acciones por empleado para un rol de
 * pagos. Compartido entre /payroll (cálculo en vivo, sin ajustes) y
 * /payroll/history/[id] cuando el reporte está en borrador (con los ajustes
 * de Novedades ya guardados aplicados) — ver PayrollOvertimeAdjustment.
 */
export function calculatePayroll({
  startDate,
  endDate,
  rawEmployees,
  rawDeductions,
  rawRecurringRules,
  rawShifts,
  rawIncidents,
  overtimeAdjustments = [],
}: CalculatePayrollInput): PayrollEmployeeCalculation[] {
  const adjustmentsByShiftRequest = new Map(overtimeAdjustments.map((a) => [a.shift_request_id, a]))

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

  return rawEmployees.map((emp) => {
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

    // b. Horas Extras aprobadas calculadas. Cada solicitud lleva su propio
    // recargo (metadata.overtime_type): 'suplementaria_50' = 1.5x la tarifa
    // hora base, 'extraordinaria_100' = 2.0x.
    const empShifts = rawShifts.filter((s) => s.employee_id === emp.id)
    const approvedOvertimeShifts = empShifts.filter(
      (s) => s.request_type === 'horas_extras' && s.status === 'aprobado'
    )
    // Tarifa hora base (sin recargo) = Sueldo base / 240 horas mensuales.
    const baseHourlyRate = baseSalary > 0 ? baseSalary / 240 : 3.50 / 1.5
    const overtimeBreakdown = approvedOvertimeShifts.map((s) => {
      // El ajuste de "horas efectivamente cumplidas" (ver Novedades, ligado
      // al reporte en revisión — NUNCA a la solicitud original) sustituye a
      // `hours` SOLO para este cálculo.
      const adjustment = adjustmentsByShiftRequest.get(s.id)
      const hours = adjustment ? adjustment.actual_hours : Number(s.hours) || 0
      const isExtraordinary = s.metadata?.overtime_type === 'extraordinaria_100'
      const surchargeMultiplier = isExtraordinary ? 2.0 : 1.5
      const amount = Number((hours * baseHourlyRate * surchargeMultiplier).toFixed(2))
      return {
        shiftRequestId: s.id,
        hours,
        isExtraordinary,
        surchargeMultiplier,
        amount,
        adjustment: adjustment || null,
      }
    })
    const overtimeHours = overtimeBreakdown.reduce((sum, o) => sum + o.hours, 0)
    const overtimeAmount = Number(overtimeBreakdown.reduce((sum, o) => sum + o.amount, 0).toFixed(2))

    // c. Cálculo de Décimos y Beneficios Sociales Mensualizados (Ecuador).
    // El Gerente Propietario autoafiliado no tiene relación de dependencia,
    // así que no le corresponden décimos ni fondos de reserva (calculateEcuadorDecimals
    // los devuelve en cero cuando isOwnerManager=true).
    const accumulateDecimals = emp.accumulate_decimals === true
    const isOwnerManager = emp.is_owner_manager === true
    const decimalsCalc = calculateEcuadorDecimals({
      baseSalary,
      overtimeAmount,
      bonuses,
      accumulateDecimals,
      reserveFundsTreatment: emp.reserve_funds || 'pagar_ano',
      hireDate: emp.hire_date,
      payrollDate: endDate,
      isOwnerManager,
    })

    // Total Ingresos (Base + Bonos + Horas Extras + Décimos/Fondos Mensualizados)
    const totalIncome = Number((baseSalary + bonuses + overtimeAmount + decimalsCalc.totalMensualizado).toFixed(2))

    // d. Aporte IESS Personal sobre base sueldo + horas extras + bonos.
    // Gerente Propietario autoafiliado: 17.60% (todo a su cargo, sin aporte
    // patronal aparte). Relación de dependencia normal: 9.45%.
    const iessTaxable = baseSalary + overtimeAmount + bonuses
    const iessRate = getIessPersonalRate(isOwnerManager)
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

    // e.2 Anticipo Quincenal Recurrente (ver employees.biweekly_advance_amount):
    // se paga aparte a mitad de mes, así que se resta del rol MENSUAL para no
    // duplicar el pago. Solo aplica si el corte cubre más de 15 días — un
    // corte quincenal (≤15 días) YA ES el pago del anticipo en sí, restarlo
    // ahí lo descontaría dos veces.
    const cutDurationDays = daysBetweenIso(startDate, endDate) + 1
    const biweeklyAdvanceAmount = Number(emp.biweekly_advance_amount) || 0
    const biweeklyAdvanceDeducted = cutDurationDays > 15 ? biweeklyAdvanceAmount : 0

    const totalEconomicDeductions =
      empDeductions.reduce((sum, d) => sum + Number(d.amount || 0), 0) + mealDeductions + biweeklyAdvanceDeducted
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
        sourceType: 'incident',
        rawType: inc.incident_type,
      })
    }

    // Solicitudes de turnos (Permisos, Horas Extras, Cambios de Turno, Vacaciones)
    for (const req of empShifts) {
      const docCode = shiftCodesMap.get(req.id) || getShiftRequestCode(req)
      const cleanTitle = req.title ? req.title.replace(/^\[[A-Z]{3}-\d+\]\s*/, '') : 'Solicitud'
      const isOvertime = req.request_type === 'horas_extras'
      const isLeave = req.request_type === 'permiso_laboral' || req.metadata?.sub_type === 'permiso_laboral'
      // Monto real que esta hora extra aporta al rol (ver overtimeBreakdown):
      // solo aplica a horas extras aprobadas — pendientes/rechazadas no suman
      // al cálculo, así que no tienen un monto "confirmado" que mostrar aquí.
      const overtimeDetail = isOvertime
        ? overtimeBreakdown.find((o) => o.shiftRequestId === req.id)
        : undefined

      actionsList.push({
        id: req.id,
        code: docCode,
        title: cleanTitle,
        type: isOvertime ? 'Horas Extras' : isLeave ? 'Permiso Laboral' : req.request_type,
        category: isOvertime ? 'turno' : isLeave ? 'permiso' : 'turno',
        status: req.status,
        date: req.date || req.created_at?.split('T')[0] || startDate,
        // Si hay ajuste de horas efectivas guardado en Novedades, se muestra
        // ese valor (lo que realmente suma al rol) en vez de lo autorizado.
        hours: overtimeDetail ? overtimeDetail.hours : (req.hours || null),
        amount: overtimeDetail ? overtimeDetail.amount : null,
        description: req.reason || null,
        sourceType: 'shift_request',
        rawType: req.request_type,
        overtimeType: isOvertime ? (req.metadata?.overtime_type ?? null) : undefined,
        hasOvertimeAdjustment: Boolean(overtimeDetail?.adjustment),
        overtimeAdjustmentReason: overtimeDetail?.adjustment?.reason ?? null,
        originalHours: isOvertime ? (req.hours ?? null) : undefined,
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
      isOwnerManager,
      iessCode: emp.iess_code ?? null,
      cashShortages,
      inventoryDeductions,
      fines,
      loans,
      mealDeductions,
      otherDeductions,
      biweeklyAdvanceDeducted,
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

      // Objetos completos para abrir el modal de detalle real (mismo que en
      // /shifts/requests e /incidents) desde la pestaña "Incidencias" del
      // drawer — actionsList solo trae un resumen aplanado.
      rawShiftRequests: empShifts,
      rawIncidents: empIncidents,

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
          ...(biweeklyAdvanceDeducted > 0
            ? [
                {
                  title: 'Anticipo Quincenal',
                  amount: biweeklyAdvanceDeducted,
                  type: 'anticipo_quincenal' as const,
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
}
