/**
 * Utilidades y constantes laborales para Ecuador
 */

// Salario Básico Unificado oficial por defecto (Ecuador)
export const ECUADOR_SBU_DEFAULT = 482.00
export const ECUADOR_SBU = ECUADOR_SBU_DEFAULT

// Porcentaje de Aporte Personal al IESS (9.45%)
export const IESS_PERSONAL_RATE = 0.0945

// Porcentaje de Aporte Patronal al IESS (12.15%)
export const IESS_EMPLOYER_RATE = 0.1215

// Gerente Propietario de compañía: se afilia al IESS SIN relación de
// dependencia (autoafiliación), aportando él mismo el equivalente personal +
// patronal combinado. La empresa NO genera aporte patronal aparte para él.
export const IESS_MANAGER_OWNER_RATE = 0.1760

/**
 * Tasa de aporte IESS (descuento del empleado) según su condición:
 * Gerente Propietario autoafiliado (17.60%, todo a su cargo) vs. relación de
 * dependencia normal (9.45%, con aporte patronal aparte del 12.15%).
 */
export function getIessPersonalRate(isOwnerManager: boolean): number {
  return isOwnerManager ? IESS_MANAGER_OWNER_RATE : IESS_PERSONAL_RATE
}

// Porcentaje de Fondos de Reserva (8.33% de remuneración)
export const RESERVE_FUNDS_RATE = 0.0833

/**
 * Obtiene el SBU vigente para una organización en un año específico
 */
export function getActiveSbu(orgId?: string, year?: number): number {
  if (typeof window === 'undefined' || !orgId) return ECUADOR_SBU_DEFAULT
  try {
    const yr = year || new Date().getFullYear()
    const saved = localStorage.getItem(`rh_payroll_sbu_${orgId}_${yr}`)
    if (saved) {
      const parsed = parseFloat(saved)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
  } catch {
    // fallback
  }
  return ECUADOR_SBU_DEFAULT
}

/**
 * Determina si un empleado tiene derecho al pago o acumulación de Fondos de Reserva
 * basado en su fecha de ingreso y el tratamiento configurado.
 *
 * Tratamientos posibles:
 * - 'pagar_ano': Se paga mensualizado si ya cumplió 1 año de trabajo.
 * - 'pagar_ingreso': Se paga mensualizado desde el primer mes de ingreso.
 * - 'acumular_ano': Se acumula en el IESS si ya cumplió 1 año de trabajo (no se paga en el rol).
 * - 'acumular_ingreso': Se acumula en el IESS desde el ingreso (no se paga en el rol).
 */
export function checkReserveFundsEligibility({
  hireDate,
  payrollDate,
  treatment = 'pagar_ano',
}: {
  hireDate: string | null | undefined
  payrollDate?: string | Date
  treatment?: string
}) {
  const isDirectFromStart = treatment === 'pagar_ingreso' || treatment === 'acumular_ingreso'
  const isAfterOneYear = treatment === 'pagar_ano' || treatment === 'acumular_ano'
  const isPaidDirectly = treatment === 'pagar_ano' || treatment === 'pagar_ingreso'

  if (!isPaidDirectly) {
    // Si el tratamiento es acumular en el IESS, no se liquida en el rol
    return {
      eligible: false,
      reason: 'acumula_iess',
      hasCompletedOneYear: false,
    }
  }

  if (treatment === 'pagar_ingreso') {
    return {
      eligible: true,
      reason: 'pagar_ingreso',
      hasCompletedOneYear: false,
    }
  }

  // Si es 'pagar_ano', validar si ya cumplió mínimo 365 días desde la fecha de ingreso
  if (!hireDate) {
    return {
      eligible: false,
      reason: 'sin_fecha_ingreso',
      hasCompletedOneYear: false,
    }
  }

  const hire = new Date(hireDate)
  const current = payrollDate ? new Date(payrollDate) : new Date()

  // Calcular diferencia en años/días
  const diffTime = current.getTime() - hire.getTime()
  const daysWorked = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  const hasCompletedOneYear = daysWorked >= 365

  return {
    eligible: hasCompletedOneYear,
    reason: hasCompletedOneYear ? 'cumplio_ano' : 'menos_de_un_ano',
    hasCompletedOneYear,
    daysWorked,
  }
}

/**
 * Calcula los valores mensualizados según el Código del Trabajo de Ecuador
 */
export function calculateEcuadorDecimals({
  baseSalary,
  overtimeAmount = 0,
  bonuses = 0,
  accumulateDecimals = false, // false = mensualizado en cada rol
  reserveFundsTreatment = 'pagar_ano', // pagar_ingreso, pagar_ano, acumular_...
  hireDate = null,
  payrollDate,
  sbu = ECUADOR_SBU_DEFAULT,
  isOwnerManager = false,
}: {
  baseSalary: number
  overtimeAmount?: number
  bonuses?: number
  accumulateDecimals?: boolean
  reserveFundsTreatment?: string
  hireDate?: string | null
  payrollDate?: string | Date
  sbu?: number
  /**
   * Gerente Propietario autoafiliado al IESS (sin relación de dependencia).
   * Décimo Tercero, Décimo Cuarto y Fondos de Reserva son beneficios del
   * Código del Trabajo exclusivos de relación de dependencia laboral — no
   * aplican a este régimen, por lo que se devuelven en cero.
   */
  isOwnerManager?: boolean
}) {
  // Remuneración computable para décimos (Sueldo + Bonos + Horas Extras)
  const taxableIncome = Math.max(0, baseSalary + overtimeAmount + bonuses)

  // 13er Sueldo Mensualizado = 1/12 de los ingresos imponibles del mes
  const decimoTercero = !accumulateDecimals && !isOwnerManager
    ? Number((taxableIncome / 12).toFixed(2))
    : 0

  // 14to Sueldo Mensualizado = 1/12 de 1 SBU vigente fijado
  const activeSbu = sbu > 0 ? sbu : ECUADOR_SBU_DEFAULT
  const decimoCuarto = !accumulateDecimals && !isOwnerManager
    ? Number((activeSbu / 12).toFixed(2))
    : 0

  // Evaluación de Fondos de Reserva según fecha de ingreso y ajuste
  // (no aplica al Gerente Propietario: no tiene relación de dependencia)
  const reserveCheck = isOwnerManager
    ? { eligible: false, reason: 'gerente_propietario' as const, hasCompletedOneYear: false }
    : checkReserveFundsEligibility({
        hireDate,
        payrollDate,
        treatment: reserveFundsTreatment,
      })

  const fondosReserva = reserveCheck.eligible
    ? Number((taxableIncome * RESERVE_FUNDS_RATE).toFixed(2))
    : 0

  return {
    decimoTercero,
    decimoCuarto,
    fondosReserva,
    totalMensualizado: Number((decimoTercero + decimoCuarto + fondosReserva).toFixed(2)),
    taxableIncome,
    isMonthly: !accumulateDecimals,
    reserveFundsEligible: reserveCheck.eligible,
    reserveFundsReason: reserveCheck.reason,
  }
}
