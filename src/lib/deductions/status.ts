import type { DeductionStatus } from '@/types/employee'

/**
 * Estado que se muestra de un descuento. Combina el estado guardado
 * (`pendiente | aplicado | anulado`) con un dato derivado: si ya se descontó
 * en un rol generado ("En rol", calculado en la base: deduction_roll_id, ver add_payroll_monthly_rolls.sql).
 *
 * El `aplicado` guardado significa "registrado y vigente" (no requiere
 * aprobación), no "ya descontado en un rol": por eso se muestra como "Vigente".
 */
export type DeductionDisplayStatus = 'pendiente' | 'vigente' | 'en_rol' | 'anulado'

export const DEDUCTION_DISPLAY_STATUS: Record<
  DeductionDisplayStatus,
  { label: string; badgeClass: string }
> = {
  pendiente: { label: 'Pendiente', badgeClass: 'bg-state-warning-bg text-state-warning-fg border-state-warning-border' },
  vigente: { label: 'Vigente', badgeClass: 'bg-state-neutral-bg text-state-neutral-fg border-state-neutral-border' },
  en_rol: { label: 'En rol', badgeClass: 'bg-state-success-bg text-state-success-fg border-state-success-border' },
  anulado: { label: 'Anulado', badgeClass: 'bg-state-danger-bg text-state-danger-fg border-state-danger-border' },
}

export function resolveDeductionDisplayStatus(
  status: DeductionStatus,
  inRoll: boolean
): DeductionDisplayStatus {
  if (status === 'anulado') return 'anulado'
  if (inRoll) return 'en_rol'
  return status === 'aplicado' ? 'vigente' : 'pendiente'
}
