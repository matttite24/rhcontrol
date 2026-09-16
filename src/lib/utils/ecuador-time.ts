/**
 * Ecuador está en UTC-5 todo el año (sin horario de verano) — pero el
 * servidor (Vercel/Node) corre en UTC. `new Date()` y `.toISOString()` sin
 * ajustar devuelven la fecha/hora del servidor, que puede ir hasta 5 horas
 * adelantada respecto a Ecuador (ej: 19:00 en Ecuador ya es medianoche del
 * día siguiente en UTC) — eso hacía que el dashboard mostrara "16 de
 * septiembre" cuando en Ecuador todavía era 15. Usar estos helpers en vez de
 * `new Date()` directo para cualquier cálculo de "hoy"/"ahora" visible al
 * usuario o usado para filtrar por fecha.
 */
const ECUADOR_UTC_OFFSET_HOURS = 5

/** La hora actual, corregida a la hora de Ecuador (UTC-5). */
export function getEcuadorNow(): Date {
  const now = new Date()
  return new Date(now.getTime() - ECUADOR_UTC_OFFSET_HOURS * 60 * 60 * 1000)
}

/** La fecha de hoy en Ecuador, como string ISO 'YYYY-MM-DD'. */
export function getEcuadorTodayIso(): string {
  return getEcuadorNow().toISOString().slice(0, 10)
}
