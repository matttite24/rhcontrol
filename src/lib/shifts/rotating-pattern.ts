import { RotatingShiftPattern } from '@/types/employee'

/**
 * Cuenta los días completos entre dos fechas ISO (YYYY-MM-DD), sin usar
 * `Date` directamente para la resta (evita desfases por horario de verano en
 * zonas que lo tengan) — se arma con año/mes/día locales y `Date.UTC`.
 */
function daysBetweenIso(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number)
  const [ty, tm, td] = toIso.split('-').map(Number)
  const fromUtc = Date.UTC(fy, fm - 1, fd)
  const toUtc = Date.UTC(ty, tm - 1, td)
  return Math.round((toUtc - fromUtc) / 86400000)
}

/**
 * Determina si una fecha es día libre según un patrón rotativo + su fecha
 * ancla, para un empleado dado. La fecha ancla puede ser posterior a la
 * fecha consultada (ciclo hacia atrás) — el módulo se normaliza a positivo
 * para que funcione en ambas direcciones.
 */
export function isRotatingDayOff(
  pattern: Pick<RotatingShiftPattern, 'cycle_length' | 'days_off'>,
  anchorDateIso: string,
  targetDateIso: string
): boolean {
  const diff = daysBetweenIso(anchorDateIso, targetDateIso)
  const position = ((diff % pattern.cycle_length) + pattern.cycle_length) % pattern.cycle_length
  return pattern.days_off.includes(position)
}
