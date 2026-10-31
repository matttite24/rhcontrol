import { getEcuadorTodayIso } from '@/lib/utils/ecuador-time'

/*
 * Cálculo de períodos de vacaciones (Ecuador). Vive fuera de actions.ts
 * ('use server' solo permite exportar funciones async) para compartirlo entre
 * el saldo por empleado (getEmployeeVacationBalanceAction) y el reporte de
 * vacaciones, garantizando que ambos usen exactamente la misma regla.
 */

/**
 * Años de servicio y período legal vigente de vacaciones (Ecuador) a partir
 * de la fecha de ingreso. El "período" es la ventana de 1 año en la que se
 * acumulan/consumen los días de vacaciones actuales — sin acotar las
 * consultas de "días ya tomados" a este rango, solicitudes de períodos
 * anteriores (ya disfrutados hace años) seguirían restando indefinidamente
 * del saldo disponible actual.
 */
/**
 * Diferencia en meses "completos" entre dos fechas UTC-medianoche (calendario,
 * no de 30 días). Usa los getters UTC (no los locales) — ver nota en
 * calculateVacationPeriod sobre por qué mezclar getters locales con fechas
 * parseadas de un string YYYY-MM-DD (siempre UTC) corrompe el cálculo en
 * cualquier máquina/servidor que no corra en UTC (ej. desarrollo local en
 * Ecuador, UTC-5).
 */
function fullMonthsBetween(from: Date, to: Date): number {
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth())
  if (to.getUTCDate() < from.getUTCDate()) months -= 1
  return Math.max(0, months)
}

/**
 * Vacaciones según el Código del Trabajo del Ecuador (Art. 69):
 *   - Derecho a 15 días de descanso por cada año completo de servicio.
 *   - A partir del 6.º año, 1 día adicional por año, hasta un máximo de 30.
 *   - Antes de cumplir el año, NO hay derecho formal, pero la empresa puede
 *     conceder permisos con cargo a las vacaciones PROPORCIONALES acumuladas
 *     (mutuo acuerdo). Se acumula `totalAnual / 12` por cada mes trabajado.
 *
 * `accruedToDate` es el saldo proporcional disponible a la fecha dentro del
 * período de vacaciones vigente.
 */
export function calculateVacationPeriod(hireDateStr: string) {
  // Todo este cálculo se hace en UTC-medianoche puro, sin usar new Date(y, m, d)
  // (constructor LOCAL) ni los getters locales (.getMonth/.getDate/.getFullYear).
  // hire viene de parsear un string 'YYYY-MM-DD', que Date SIEMPRE interpreta
  // como UTC medianoche — mezclarlo con new Date(y, m, d) (que construye en la
  // TZ del proceso Node) desalinea las fechas en cualquier entorno que no
  // corra en UTC. En dev local esto corre con la TZ del sistema operativo
  // (ej. America/Guayaquil, UTC-5): el aniversario/período anterior se
  // construían un día antes de lo real, y en el caso límite de un empleado
  // con EXACTAMENTE 1 año cumplido eso hacía creer que el período anterior
  // "no existía todavía" — el saldo normal salía en 0 y el sistema ofrecía
  // el flujo de adelanto en vez de las vacaciones ya ganadas.
  const hire = new Date(hireDateStr)
  const now = new Date(`${getEcuadorTodayIso()}T00:00:00Z`)
  const diffDays = Math.floor((now.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24))
  const yearsOfService = Math.floor(diffDays / 365)

  // Días anuales según antigüedad: 15 base + 1 por cada año a partir del 6.º, tope 30.
  const extraYears = Math.max(0, yearsOfService - 5)
  const annualLawDays = Math.min(30, 15 + extraYears)

  // El período vigente arranca en el último "aniversario de ingreso" — Date.UTC
  // construye en UTC explícitamente, igual que el parseo de hire.
  const anniversaryThisYear = new Date(Date.UTC(now.getUTCFullYear(), hire.getUTCMonth(), hire.getUTCDate()))
  const periodStart =
    anniversaryThisYear <= now
      ? anniversaryThisYear
      : new Date(Date.UTC(now.getUTCFullYear() - 1, hire.getUTCMonth(), hire.getUTCDate()))
  const periodEnd = new Date(Date.UTC(periodStart.getUTCFullYear() + 1, periodStart.getUTCMonth(), periodStart.getUTCDate()))

  // Meses trabajados dentro del período vigente (0..12).
  const monthsInPeriod = Math.min(12, fullMonthsBetween(periodStart, now))

  // Días proporcionales acumulados a la fecha (redondeo a 0.5 días).
  const rawAccrued = (monthsInPeriod * annualLawDays) / 12
  const accruedToDate = Math.round(rawAccrued * 2) / 2

  // Período INMEDIATO ANTERIOR (el año previo al vigente), para arrastrar el
  // saldo no consumido — el Código del Trabajo de Ecuador permite acumular
  // vacaciones hasta 2 períodos (no prescriben automáticamente cada año). Si
  // el período anterior empieza antes de la fecha de ingreso, no existe
  // (empleado con menos de 1 año de antigüedad en el período vigente).
  const previousPeriodStart = new Date(Date.UTC(periodStart.getUTCFullYear() - 1, periodStart.getUTCMonth(), periodStart.getUTCDate()))
  const previousPeriodEnd = periodStart // el fin del anterior es el inicio del vigente
  const previousPeriodExists = previousPeriodStart >= hire

  // Antigüedad (en años completos) al CIERRE del período anterior — determina
  // cuántos días anuales le correspondían en ese momento, no los de hoy.
  const yearsAtPreviousPeriodEnd = Math.floor(
    (previousPeriodEnd.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24 * 365)
  )
  const previousPeriodAnnualDays = previousPeriodExists
    ? Math.min(30, 15 + Math.max(0, yearsAtPreviousPeriodEnd - 5))
    : 0

  const iso = (d: Date) => d.toISOString().split('T')[0]

  // El label mostrado al usuario debe describir el período que realmente se
  // está LIQUIDANDO — el saldo normal (ver getEmployeeVacationBalanceAction)
  // es el arrastre del período anterior, no el vigente, así que el label
  // apunta ahí cuando existe. Solo cae al vigente si no hay período anterior
  // (empleado con exactamente 1 año de antigüedad: su primer año cumplido ES
  // el vigente).
  const settlementLabel = previousPeriodExists
    ? `Período ${iso(previousPeriodStart)} a ${iso(previousPeriodEnd)}`
    : `Período ${iso(periodStart)} a ${iso(periodEnd)}`

  return {
    yearsOfService,
    annualLawDays,
    monthsInPeriod,
    accruedToDate,
    hasCompletedFirstYear: yearsOfService >= 1,
    periodStartDate: iso(periodStart),
    periodEndDate: iso(periodEnd),
    periodLabel: settlementLabel,
    previousPeriodExists,
    previousPeriodStartDate: iso(previousPeriodStart),
    previousPeriodEndDate: iso(previousPeriodEnd),
    previousPeriodAnnualDays,
  }
}

export interface VacationUsageRow {
  id: string
  request_type: string
  hours: number | null
  metadata: any
  status: string
}

/** Suma días usados (vacaciones + permisos con cargo a vacaciones) entre solicitudes ya cargadas. */
export function sumVacationUsedDays(rows: VacationUsageRow[], excludeRequestId?: string): number {
  return rows.reduce((acc, curr) => {
    // Excluir la solicitud que se está editando — no debe contar contra
    // su propio saldo al re-validar (ver excludeRequestId).
    if (excludeRequestId && curr.id === excludeRequestId) return acc
    const isVacation =
      curr.request_type === 'solicitud_vacaciones' ||
      curr.metadata?.sub_type === 'solicitud_vacaciones'
    const isCargoVacaciones =
      (curr.request_type === 'permiso_laboral' || curr.metadata?.sub_type === 'permiso_laboral') &&
      curr.metadata?.recovery_method === 'cargo_vacaciones'

    if (isVacation) {
      return acc + Number(curr.metadata?.days_count || (curr.hours ? curr.hours / 8 : 0))
    }
    if (isCargoVacaciones) {
      const days =
        curr.metadata?.leave_unit === 'horas'
          ? (curr.hours || curr.metadata?.requested_hours || 0) / 8
          : Number(curr.metadata?.requested_days || (curr.hours ? curr.hours / 8 : 1))
      return acc + days
    }
    return acc
  }, 0)
}
