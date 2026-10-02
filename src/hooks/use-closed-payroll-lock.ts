'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface ClosedPayrollLock {
  id: string
  title: string
  start_date: string
  end_date: string
}

/**
 * Rol de pagos ya generado (cerrado/pagado) que incluye a un registro, según
 * su fecha y empleado — o null si no está bloqueado. Es solo la capa visual:
 * el bloqueo real lo aplica la base de datos (trigger enforce_closed_payroll_lock,
 * ver supabase/migrations/add_closed_payroll_lock.sql).
 *
 * Pasa `enabled: false` cuando el registro no cuenta en el rol (p. ej. una
 * novedad pendiente o un descuento recurrente) para no consultar de más.
 */
export function useClosedPayrollLock(
  organizationId: string | null | undefined,
  employeeId: string | null | undefined,
  date: string | null | undefined,
  enabled: boolean = true,
  /** Solo descuentos: período de rol (mes/año) al que se destinan, ver fetchCutDeductions. */
  period?: { year: number | null | undefined; month: number | null | undefined }
): ClosedPayrollLock | null {
  const [lock, setLock] = useState<ClosedPayrollLock | null>(null)

  useEffect(() => {
    let active = true
    if (!enabled || !organizationId || !employeeId || !date) {
      setLock(null)
      return
    }
    const supabase = createClient()
    supabase
      .rpc('closed_payroll_for', {
        p_org: organizationId,
        p_employee: employeeId,
        p_date: date,
        p_period_year: period?.year ?? null,
        p_period_month: period?.month ?? null,
      })
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          // Función aún no creada (migración pendiente) u otro error: sin aviso, la BD sigue siendo la que decide.
          setLock(null)
          return
        }
        const row = Array.isArray(data) ? data[0] : data
        setLock(row ? (row as ClosedPayrollLock) : null)
      })
    return () => {
      active = false
    }
  }, [organizationId, employeeId, date, enabled, period?.year, period?.month])

  return lock
}
