import type { ShiftRequest } from '@/types/employee'

/**
 * Formatea una fecha YYYY-MM-DD como "Lunes, 10 de marzo 2026", parseando
 * manualmente año/mes/día en vez de `new Date(str)` para evitar el desfase
 * de zona horaria (un string de solo fecha se interpreta como UTC medianoche
 * por el motor JS, lo que en zonas horarias negativas puede mostrar el día
 * anterior). Estaba duplicada literalmente en ShiftRequestDetailModal,
 * OvertimeWizardModal, LeavePermissionWizardModal, ScheduleChangeWizardModal
 * y VacationWizardModal.
 */
export function formatLongDate(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  const dateObj = new Date(y, m - 1, d)

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const monthNames = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ]

  const dayName = dayNames[dateObj.getDay()]
  const dayNum = dateObj.getDate()
  const monthName = monthNames[dateObj.getMonth()]
  const year = dateObj.getFullYear()

  return `${dayName}, ${dayNum} de ${monthName} ${year}`
}

/**
 * Iniciales de un nombre completo (máx. 2 letras, mayúsculas) para
 * avatares. Estaba duplicada en ShiftCalendarView, ShiftRequestsList,
 * ShiftRequestDetailModal y los 4 wizards.
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

/** Suma `days` días a una fecha ISO (YYYY-MM-DD) sin problemas de zona horaria. */
export function addDaysToIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(y, m - 1, d + days)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

/**
 * Rango [inicio, fin] (ISO) que cubre una solicitud de vacaciones. Usa
 * `metadata.end_date` si existe; si no, lo deriva de `days_count` (para filas
 * antiguas o guardadas sin fecha de retorno). Si tampoco hay días, cae al día
 * exacto de la solicitud.
 */
export function getVacationRange(r: ShiftRequest): { start: string; end: string } {
  const start = r.metadata?.start_date || r.date
  if (r.metadata?.end_date) return { start, end: r.metadata.end_date }
  const days = Number(r.metadata?.days_count) || 0
  if (days > 1) return { start, end: addDaysToIso(start, days - 1) }
  return { start, end: start }
}

/**
 * Rango [inicio, fin] (ISO) que cubre un permiso laboral por días. A
 * diferencia de vacaciones, `metadata.end_date` en permisos es el día de
 * REINCORPORACIÓN (no un día de ausencia), así que el último día ausente es
 * `end_date - 1`. `requested_days` ya refleja esa resta (ver
 * LeavePermissionWizardModal `calculatedDays`), por lo que el rango de
 * ausencia siempre se deriva de él. Los permisos por horas ocupan un único
 * día exacto.
 */
export function getLeavePermitRange(r: ShiftRequest): { start: string; end: string } {
  const start = r.metadata?.start_date || r.date
  const days = Number(r.metadata?.requested_days) || 0
  if (r.metadata?.leave_unit === 'dias' && days > 1) return { start, end: addDaysToIso(start, days - 1) }
  return { start, end: start }
}

const WEEKDAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/**
 * Fecha(s) para la que aplica la novedad (no la de emisión): día exacto,
 * rango (vacaciones / permiso por días) o lista de días (cambio de horario).
 * Devuelve [] si la solicitud no tiene fecha.
 */
export function getAuthorizedDates(r: ShiftRequest): string[] {
  const type = r.request_type === 'otro' || !r.request_type ? r.metadata?.sub_type : r.request_type
  if (type === 'solicitud_vacaciones' || r.metadata?.sub_type === 'solicitud_vacaciones') {
    const { start, end } = getVacationRange(r)
    return start ? [start, end] : []
  }
  if (type === 'permiso_laboral' || r.metadata?.sub_type === 'permiso_laboral') {
    const { start, end } = getLeavePermitRange(r)
    return start ? [start, end] : []
  }
  if (type === 'cambio_horario' || r.metadata?.sub_type === 'cambio_horario') {
    const days: string[] = (r.metadata?.day_changes || []).map((dc: { date?: string }) => dc.date).filter(Boolean)
    if (days.length) return Array.from(new Set(days)).sort()
  }
  return r.date ? [r.date] : []
}

/**
 * Fecha(s) autorizada(s) en dos líneas: ["Jue 05", "Mar - 2026"]. Rango:
 * ["Jue 05 → Vie 19", "Mar - 2026"]; lista: ["Jue 05, Sáb 07 y Dom 08", "Mar - 2026"].
 * Si abarca meses distintos, cada día lleva su mes y la 2ª línea solo el año.
 */
export function formatAuthorizedDates(r: ShiftRequest): [string, string] {
  const dates = getAuthorizedDates(r)
  if (dates.length === 0) return ['—', '']
  const parts = dates.map((iso) => {
    const [y, m, d] = iso.split('-')
    return { y, mon: MONTHS_ES[Number(m) - 1], d, wd: WEEKDAYS_ES[new Date(Number(y), Number(m) - 1, Number(d)).getDay()] }
  })
  const isList = r.request_type === 'cambio_horario' || r.metadata?.sub_type === 'cambio_horario'
  const sep = (items: string[]) =>
    isList && items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}` : items.join(' → ')
  const sameMonth = parts.every((p) => p.y === parts[0].y && p.mon === parts[0].mon)

  if (sameMonth) {
    const days = Array.from(new Set(parts.map((p) => `${p.wd} ${p.d}`)))
    return [sep(days), `${parts[0].mon} - ${parts[0].y}`]
  }
  const years = Array.from(new Set(parts.map((p) => p.y)))
  return [sep(parts.map((p) => `${p.wd} ${p.d} ${p.mon}`)), years.join(' → ')]
}
