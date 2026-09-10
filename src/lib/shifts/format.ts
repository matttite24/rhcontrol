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
