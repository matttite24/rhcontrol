/**
 * Redondeo monetario único del sistema: a centavos, "half-up" (0.005 sube),
 * igual que la contabilidad. Usar SIEMPRE esto en cálculos de dinero.
 * `Number.toFixed(2)` falla en medios centavos (1.005 -> "1.00") porque opera
 * sobre la representación binaria del número.
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  const sign = value < 0 ? -1 : 1
  return sign * Number(Math.round(Number(`${Math.abs(value)}e2`)) + 'e-2')
}
