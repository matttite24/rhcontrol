import { calculateVacationPeriod, sumVacationUsedDays, type VacationUsageRow } from '@/lib/shifts/vacation'

export type VacationReportStatus = 'completas' | 'parciales' | 'sin_tomar' | 'en_acumulacion'

export interface VacationReportEmployee {
  id: string
  full_name: string
  national_id: string | null
  department: string | null
  position: string | null
  hire_date: string
}

export interface VacationReportRequest extends VacationUsageRow {
  employee_id: string
  date: string
}

export interface VacationReportRow {
  employeeId: string
  fullName: string
  nationalId: string
  department: string
  hireDate: string
  yearsOfService: number
  /** Período de vacaciones que se está gozando (el último ya cumplido), o el vigente si aún no cumple el año. */
  periodStart: string
  periodEnd: string
  /** Días que le corresponden por ley en ese período (0 si aún no cumple el primer año). */
  entitledDays: number
  /** Días ya registrados o aprobados (vacaciones y permisos con cargo a vacaciones). */
  takenDays: number
  /** Días que aún le faltan por tomar. */
  remainingDays: number
  /** Proporcional acumulado del año en curso (solo informativo para quien aún no cumple el año). */
  accruedDays: number
  status: VacationReportStatus
}

/**
 * Misma regla que getEmployeeVacationBalanceAction (saldo por empleado), pero
 * para toda la lista a la vez: el período que se goza es el último ya
 * cumplido; los días tomados son los del período anterior más los registrados
 * en el período en curso.
 */
export function buildVacationReport(
  employees: VacationReportEmployee[],
  requests: VacationReportRequest[]
): VacationReportRow[] {
  const byEmployee = new Map<string, VacationReportRequest[]>()
  for (const r of requests) {
    const list = byEmployee.get(r.employee_id)
    if (list) list.push(r)
    else byEmployee.set(r.employee_id, [r])
  }

  return employees.map((emp) => {
    const calc = calculateVacationPeriod(emp.hire_date)
    const mine = byEmployee.get(emp.id) ?? []

    const usedCurrent = sumVacationUsedDays(
      mine.filter((r) => r.date >= calc.periodStartDate && r.date <= calc.periodEndDate)
    )
    const usedPrevious = calc.previousPeriodExists
      ? sumVacationUsedDays(
          mine.filter((r) => r.date >= calc.previousPeriodStartDate && r.date < calc.previousPeriodEndDate)
        )
      : 0

    const entitledDays = calc.previousPeriodExists ? calc.previousPeriodAnnualDays : 0
    const carriedOver = Math.max(0, entitledDays - usedPrevious)
    const remainingDays = Math.max(0, carriedOver - usedCurrent)
    const takenDays = usedPrevious + usedCurrent

    let status: VacationReportStatus
    if (!calc.previousPeriodExists) status = 'en_acumulacion'
    else if (remainingDays === 0) status = 'completas'
    else if (takenDays === 0) status = 'sin_tomar'
    else status = 'parciales'

    const periodStart = calc.previousPeriodExists ? calc.previousPeriodStartDate : calc.periodStartDate
    const periodEnd = calc.previousPeriodExists ? calc.previousPeriodEndDate : calc.periodEndDate

    return {
      employeeId: emp.id,
      fullName: emp.full_name,
      nationalId: emp.national_id ?? '',
      department: emp.department ?? 'Sin departamento',
      hireDate: emp.hire_date,
      yearsOfService: calc.yearsOfService,
      periodStart,
      periodEnd,
      entitledDays,
      takenDays,
      remainingDays,
      accruedDays: calc.accruedToDate,
      status,
    }
  })
}

export const VACATION_STATUS_LABEL: Record<VacationReportStatus, string> = {
  completas: 'Completas',
  parciales: 'Parciales',
  sin_tomar: 'Sin tomar',
  en_acumulacion: 'En acumulación',
}
