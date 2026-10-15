/**
 * Ecuador está en UTC-5 todo el año (sin horario de verano) — pero el
 * servidor (Vercel/Node) corre normalmente en UTC. `new Date()` y
 * `.toISOString()` sin ajustar devuelven la fecha/hora del servidor, que
 * puede ir hasta 5 horas adelantada respecto a Ecuador (ej: 19:00 en Ecuador
 * ya es medianoche del día siguiente en UTC) — eso hacía que el dashboard
 * mostrara "16 de septiembre" cuando en Ecuador todavía era 15. Usar estos
 * helpers en vez de `new Date()` directo para cualquier cálculo de
 * "hoy"/"ahora" visible al usuario o usado para filtrar por fecha.
 *
 * Los helpers usan la zona horaria 'America/Guayaquil' con Intl, así que dan
 * el mismo resultado sin importar la zona horaria de la máquina. (La versión
 * anterior restaba 5 horas al instante y suponía un servidor en UTC: en una
 * máquina ya configurada en Ecuador, como un equipo de desarrollo, el desfase
 * se aplicaba dos veces y el dashboard mostraba el día anterior.)
 */
const ECUADOR_TIME_ZONE = 'America/Guayaquil'

const ecuadorParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: ECUADOR_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function readEcuadorParts(date: Date) {
  const get = (type: string) => Number(ecuadorParts.formatToParts(date).find((p) => p.type === type)?.value)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

/**
 * La hora actual de Ecuador, como un Date cuyos campos LOCALES (`getDate()`,
 * `getHours()`, `getMonth()`...) coinciden con el reloj de pared de Ecuador.
 * Úsalo solo leyendo esos getters; para obtener un string de fecha usa
 * getEcuadorTodayIso() / getEcuadorDateIso() (no `.toISOString()`).
 */
export function getEcuadorNow(): Date {
  const p = readEcuadorParts(new Date())
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
}

/** La fecha de hoy en Ecuador, como string ISO 'YYYY-MM-DD'. */
export function getEcuadorTodayIso(): string {
  const p = readEcuadorParts(new Date())
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** La fecha de Ecuador dentro de `daysFromToday` días (puede ser negativo), 'YYYY-MM-DD'. */
export function getEcuadorDateIso(daysFromToday = 0): string {
  const [y, m, d] = getEcuadorTodayIso().split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + daysFromToday)).toISOString().slice(0, 10)
}
