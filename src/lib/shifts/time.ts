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

/**
 * Normaliza una hora a "HH:mm". La base de datos (columnas `time`) puede
 * devolver "12:00:00" con segundos, y el calendario mostraba ambos formatos
 * mezclados según cómo se guardó cada horario.
 */
export function formatTimeHHmm(t: string | null | undefined): string {
  if (!t) return ''
  const [h, m] = t.split(':')
  return `${(h ?? '').padStart(2, '0')}:${(m ?? '00').padStart(2, '0')}`
}

/** Horas (decimal, 2 cifras) entre dos "HH:mm"; 0 si falta alguno. Soporta cruce de medianoche. */
export function hoursBetween(startTime?: string | null, endTime?: string | null): number {
  if (!startTime || !endTime) return 0
  const { start, end } = normalizeMinuteRange(startTime, endTime)
  return Math.round(((end - start) / 60) * 100) / 100
}

/** Franjas (inicio, fin) con datos de un turno de recuperación, en orden. */
export function recoveryRanges(rs: {
  start_time?: string | null
  end_time?: string | null
  start_time_2?: string | null
  end_time_2?: string | null
}): { start: string; end: string }[] {
  const out: { start: string; end: string }[] = []
  if (rs.start_time && rs.end_time) out.push({ start: rs.start_time, end: rs.end_time })
  if (rs.start_time_2 && rs.end_time_2) out.push({ start: rs.start_time_2, end: rs.end_time_2 })
  return out
}

/** Total de horas de un turno de recuperación (suma de sus franjas). */
export function recoveryHours(rs: Parameters<typeof recoveryRanges>[0] & { hours?: number }): number {
  const ranges = recoveryRanges(rs)
  if (ranges.length === 0) return rs.hours || 0
  return Math.round(ranges.reduce((sum, r) => sum + hoursBetween(r.start, r.end), 0) * 100) / 100
}
