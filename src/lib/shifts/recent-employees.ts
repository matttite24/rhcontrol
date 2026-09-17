'use client'

const STORAGE_KEY = 'rhgarden:recent_employee_ids'
const MAX_RECENT = 10

/** Lee el historial de empleados recientes (más reciente primero), compartido entre los 5 wizards de Novedades. */
export function getRecentEmployeeIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

/** Registra un empleado como usado recientemente — lo mueve al frente, sin duplicados, tope de MAX_RECENT. */
export function pushRecentEmployeeId(employeeId: string): void {
  if (!employeeId) return
  try {
    const current = getRecentEmployeeIds()
    const next = [employeeId, ...current.filter((id) => id !== employeeId)].slice(0, MAX_RECENT)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // localStorage no disponible (SSR, modo privado, cuota excedida) — no es crítico, se ignora.
  }
}
