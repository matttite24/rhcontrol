'use client'

import { useEffect, useMemo, useState } from 'react'
import { Employee } from '@/types/employee'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Search, Check, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/shifts/format'
import { getRecentEmployeeIds } from '@/lib/shifts/recent-employees'

/** Retrasa la actualización de `value` hasta que pase `delayMs` sin cambios — evita filtrar en cada tecla cuando la lista es grande. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

/** Cuántos empleados mostrar por defecto cuando no hay búsqueda activa (recientes + relleno). */
const RECENT_LIST_SIZE = 10

interface EmployeePickerStepProps<T extends Employee> {
  employees: T[]
  selectedEmployeeId: string
  onSelect: (id: string) => void
  searchQuery: string
  onSearchQueryChange: (q: string) => void
  /** Placeholder del buscador. Por defecto cubre los 4 criterios que ya filtra el componente. */
  searchPlaceholder?: string
  /** Mensaje cuando la búsqueda no encuentra coincidencias. */
  emptyMessage?: string
  /** Altura máxima de la lista scrolleable. */
  maxHeight?: string
  /**
   * Contenido extra al final de cada fila (ej. badge de años de servicio en
   * Vacaciones). Si no se pasa, se muestra el check circular de "seleccionado"
   * por defecto.
   */
  renderTrailing?: (employee: T, isSelected: boolean) => React.ReactNode
  /** Contenido opcional arriba del buscador (ej. contador "N habilitados"). */
  header?: React.ReactNode
  /**
   * Estado vacío especial cuando `employees` ya viene vacío de origen (ej.
   * "sin empleados elegibles"), distinto del mensaje de "sin resultados de
   * búsqueda" que maneja el componente internamente.
   */
  emptySourceContent?: React.ReactNode
}

/**
 * Buscador + lista de selección de empleado (único), reutilizado por los 5
 * wizards de Novedades (Permiso, Horas Extra, Cambio de Horario, Vacaciones,
 * Marcación Biométrica) — mismo filtro (nombre, cédula, cargo, departamento)
 * y mismo layout, con slots opcionales para lo que cada wizard necesita
 * agregar (badge de antigüedad en Vacaciones, contador de elegibles, etc.).
 */
export function EmployeePickerStep<T extends Employee>({
  employees,
  selectedEmployeeId,
  onSelect,
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder = 'Buscar por nombre, cédula, cargo o departamento...',
  emptyMessage = 'No se encontraron empleados coincidentes.',
  maxHeight = '320px',
  renderTrailing,
  header,
  emptySourceContent,
}: EmployeePickerStepProps<T>) {
  const debouncedQuery = useDebouncedValue(searchQuery, 200)
  const isSearching = debouncedQuery.trim().length > 0

  // Sin búsqueda activa: priorizar los empleados usados más recientemente en
  // cualquiera de los 5 wizards (historial local del navegador), para no
  // obligar a buscar cada vez en organizaciones con muchos empleados. Se
  // completa con el resto de la lista hasta un tope razonable.
  const [recentIds] = useState<string[]>(() => getRecentEmployeeIds())

  const displayList = useMemo(() => {
    if (isSearching) {
      const q = debouncedQuery.toLowerCase()
      return employees.filter(
        (e) =>
          e.full_name.toLowerCase().includes(q) ||
          (e.national_id && e.national_id.includes(q)) ||
          (e.department && e.department.toLowerCase().includes(q)) ||
          (e.position && e.position.toLowerCase().includes(q))
      )
    }

    if (recentIds.length === 0) return employees.slice(0, RECENT_LIST_SIZE)

    const byId = new Map(employees.map((e) => [e.id, e]))
    const recent = recentIds.map((id) => byId.get(id)).filter((e): e is T => Boolean(e))
    const recentIdSet = new Set(recent.map((e) => e.id))
    const rest = employees.filter((e) => !recentIdSet.has(e.id))
    return [...recent, ...rest].slice(0, Math.max(RECENT_LIST_SIZE, recent.length))
  }, [employees, isSearching, debouncedQuery, recentIds])

  const showingRecentOnly = !isSearching && recentIds.length > 0

  if (employees.length === 0 && emptySourceContent) {
    return (
      <div className="space-y-4">
        {header}
        {emptySourceContent}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {header}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9 h-9 text-xs"
          autoFocus
        />
      </div>

      {showingRecentOnly && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <History className="h-3 w-3" />
          <span>Usados recientemente</span>
          {employees.length > displayList.length && (
            <Badge variant="outline" className="text-[10px] font-normal ml-auto">
              Busca para ver los {employees.length - displayList.length} restantes
            </Badge>
          )}
        </div>
      )}

      <div className="overflow-y-auto space-y-1.5 pr-1" style={{ maxHeight }}>
        {displayList.map((emp) => {
          const isSelected = selectedEmployeeId === emp.id
          return (
            <button
              key={emp.id}
              type="button"
              onClick={() => onSelect(emp.id)}
              className={cn(
                "w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer",
                isSelected
                  ? "bg-primary/10 border-primary text-foreground ring-1 ring-primary/30"
                  : "bg-card hover:bg-muted/50 border-border/60"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-9 w-9 ring-1 ring-border shrink-0">
                  <AvatarImage src={emp.avatar_url ?? undefined} alt={emp.full_name} />
                  <AvatarFallback className="text-[11px] font-semibold">
                    {getInitials(emp.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-foreground truncate">
                    {emp.full_name}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground truncate">
                    CI: {emp.national_id || '—'} • {emp.position || emp.department || 'Empleado'}
                  </span>
                </div>
              </div>

              {renderTrailing ? (
                renderTrailing(emp, isSelected)
              ) : (
                isSelected && (
                  <div className="size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </div>
                )
              )}
            </button>
          )
        })}

        {displayList.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            {emptyMessage}
          </p>
        )}
      </div>
    </div>
  )
}
