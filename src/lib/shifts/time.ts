/**
 * Convierte "HH:mm" a minutos desde medianoche. Estaba duplicada en
 * OvertimeWizardModal y LeavePermissionWizardModal.
 */
export function parseTimeToMinutes(t: string): number {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/**
 * Comprueba si dos rangos de minutos [startA,endA) y [startB,endB) se
 * solapan. Ambos rangos deben venir ya normalizados para cruce de
 * medianoche (end > start) antes de llamar esta función — ver
 * `normalizeMinuteRange`.
 */
export function intervalsOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return Math.max(startA, startB) < Math.min(endA, endB)
}

/**
 * Normaliza un rango horario que puede cruzar medianoche (ej. 22:00–06:00)
 * sumando 24h al fin cuando es menor o igual al inicio, para que quede
 * comparable con `intervalsOverlap`. Sin esto, un turno nocturno produce un
 * intervalo mal formado (end < start) y las comparaciones de solapamiento
 * fallan silenciosamente.
 */
export function normalizeMinuteRange(startTime: string, endTime: string): { start: number; end: number } {
  const start = parseTimeToMinutes(startTime)
  let end = parseTimeToMinutes(endTime)
  if (end <= start) end += 24 * 60
  return { start, end }
}
