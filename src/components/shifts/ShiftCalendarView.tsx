'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { es } from 'date-fns/locale'
import { Employee, EmployeeSchedule, DayOfWeek, ShiftRequest, Holiday } from '@/types/employee'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { ShiftRequestDetailModal } from './ShiftRequestDetailModal'
import { toast } from '@/components/ui/toast'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Moon, Filter, Check, ChevronDown, RefreshCw, Palmtree, CalendarSearch, Info, UserX, CalendarOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/shifts/format'

interface EmployeeWithSchedule extends Employee {
  schedules?: EmployeeSchedule[]
}

interface ShiftCalendarViewProps {
  employees: EmployeeWithSchedule[]
  requests?: ShiftRequest[]
  departments?: string[]
  currentDepartment?: string
  holidays?: Holiday[]
}

const DAYS_OF_WEEK_MAP: Record<number, DayOfWeek> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
}

const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// Horario por defecto usado ÚNICAMENTE como último recurso quando ni la
// solicitud de cambio de horario ni el horario base del empleado tienen un
// valor — nunca debe sustituir silenciosamente un horario real (ver
// `getEffectiveSchedule`, que primero intenta el horario propio del empleado).
const DEFAULT_SHIFT_START_1 = '08:00'
const DEFAULT_SHIFT_END_1 = '17:00'
const DEFAULT_SHIFT_START_2 = '14:00'
const DEFAULT_SHIFT_END_2 = '18:00'

type ViewRange = '8' | '15' | 'month'

interface DayChangeDetail {
  date: string
  is_workday: boolean
  has_split_shift?: boolean
  start_time_1?: string
  end_time_1?: string
  start_time_2?: string
  end_time_2?: string
}

/**
 * Resuelve el horario "efectivo" a mostrar para un empleado en un día dado,
 * combinando su horario base con una eventual solicitud de cambio de horario
 * aprobada/pendiente para esa fecha específica.
 *
 * Importante: si hay una solicitud de cambio de horario pero SIN el detalle
 * puntual para este día (`dayChangeDetail` ausente), no se debe fabricar un
 * horario 08:00–17:00 genérico — eso mostraría un turno inventado que nada
 * tiene que ver con la realidad. En ese caso se cae al horario base real del
 * propio empleado (`sched`), y solo si tampoco existe se usan los defaults
 * literales como último recurso.
 */
function getEffectiveSchedule(
  sched: EmployeeSchedule | undefined,
  scheduleChangeReq: ShiftRequest | undefined,
  dayChangeDetail: DayChangeDetail | undefined
) {
  if (!scheduleChangeReq) {
    return {
      isWorkday: sched?.is_workday ?? false,
      hasSplit: sched?.has_split_shift ?? false,
      start1: sched?.start_time_1 || DEFAULT_SHIFT_START_1,
      end1: sched?.end_time_1 || DEFAULT_SHIFT_END_1,
      start2: sched?.start_time_2 || DEFAULT_SHIFT_START_2,
      end2: sched?.end_time_2 || DEFAULT_SHIFT_END_2,
    }
  }

  if (dayChangeDetail) {
    return {
      isWorkday: dayChangeDetail.is_workday,
      hasSplit: dayChangeDetail.has_split_shift ?? false,
      start1: dayChangeDetail.start_time_1 || sched?.start_time_1 || DEFAULT_SHIFT_START_1,
      end1: dayChangeDetail.end_time_1 || sched?.end_time_1 || DEFAULT_SHIFT_END_1,
      start2: dayChangeDetail.start_time_2 || sched?.start_time_2 || DEFAULT_SHIFT_START_2,
      end2: dayChangeDetail.end_time_2 || sched?.end_time_2 || DEFAULT_SHIFT_END_2,
    }
  }

  // Hay solicitud de cambio de horario pero sin detalle para este día puntual:
  // se conserva el horario real del empleado en vez de fabricar uno genérico.
  return {
    isWorkday: sched?.is_workday ?? true,
    hasSplit: sched?.has_split_shift ?? false,
    start1: sched?.start_time_1 || scheduleChangeReq.start_time || DEFAULT_SHIFT_START_1,
    end1: sched?.end_time_1 || scheduleChangeReq.end_time || DEFAULT_SHIFT_END_1,
    start2: sched?.start_time_2 || DEFAULT_SHIFT_START_2,
    end2: sched?.end_time_2 || DEFAULT_SHIFT_END_2,
  }
}


// Obtener rango de fechas según selección (8 días, 15 días o mes completo)
function getRangeDates(baseDate: Date, range: ViewRange) {
  const current = new Date(baseDate)

  if (range === 'month') {
    const year = current.getFullYear()
    const month = current.getMonth()
    const lastDay = new Date(year, month + 1, 0)
    const daysCount = lastDay.getDate()

    const dates: Date[] = []
    for (let i = 1; i <= daysCount; i++) {
      dates.push(new Date(year, month, i))
    }
    return dates
  }

  // Si es 8 o 15 días: empezar en lunes
  const day = current.getDay()
  const diff = current.getDate() - day + (day === 0 ? -6 : 1) // Lunes
  const monday = new Date(current.setDate(diff))
  monday.setHours(0, 0, 0, 0)

  const count = range === '15' ? 15 : 8
  const dates: Date[] = []
  for (let i = 0; i < count; i++) {
    const nextDate = new Date(monday)
    nextDate.setDate(monday.getDate() + i)
    dates.push(nextDate)
  }
  return dates
}

function formatDateToIso(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Suma `days` días a una fecha ISO (YYYY-MM-DD) sin problemas de zona horaria. */
function addDaysToIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return formatDateToIso(new Date(y, m - 1, d + days))
}

/**
 * Rango [inicio, fin] (ISO) que cubre una solicitud de vacaciones. Usa
 * `metadata.end_date` si existe; si no, lo deriva de `days_count` (para filas
 * antiguas o guardadas sin fecha de retorno). Si tampoco hay días, cae al día
 * exacto de la solicitud.
 */
function getVacationRange(r: ShiftRequest): { start: string; end: string } {
  const start = r.metadata?.start_date || r.date
  if (r.metadata?.end_date) return { start, end: r.metadata.end_date }
  const days = Number(r.metadata?.days_count) || 0
  if (days > 1) return { start, end: addDaysToIso(start, days - 1) }
  return { start, end: start }
}

interface EmployeeDateRequestIndex {
  overtime: ShiftRequest[]
  scheduleChanges: ShiftRequest[]
  leavePermits: ShiftRequest[]
  /** Solicitudes de vacaciones cuyo rango podría cubrir cualquier fecha (no indexables por día exacto) */
  vacations: ShiftRequest[]
}

/**
 * Pre-indexa las solicitudes por `employee_id|fecha` una sola vez por cambio
 * de `requests`, en vez de recorrer el arreglo completo con `.find()` dentro
 * de cada celda de la tabla (O(empleados × días × solicitudes) → O(1) por celda).
 * Las solicitudes de vacaciones no se indexan por día exacto (su rango puede
 * cubrir varias fechas vía `metadata.start_date`/`end_date`), así que se
 * agrupan solo por empleado y su match de fecha se resuelve al consultarlas.
 */
function buildRequestIndex(requests: ShiftRequest[]) {
  const byEmployeeDate = new Map<string, EmployeeDateRequestIndex>()
  const vacationsByEmployee = new Map<string, ShiftRequest[]>()

  function getOrCreate(key: string): EmployeeDateRequestIndex {
    let entry = byEmployeeDate.get(key)
    if (!entry) {
      entry = { overtime: [], scheduleChanges: [], leavePermits: [], vacations: [] }
      byEmployeeDate.set(key, entry)
    }
    return entry
  }

  for (const r of requests) {
    const isOvertime = r.request_type === 'horas_extras'
    const isScheduleChange = r.request_type === 'cambio_horario' || r.metadata?.sub_type === 'cambio_horario'
    const isVacation = r.request_type === 'solicitud_vacaciones' || r.metadata?.sub_type === 'solicitud_vacaciones'
    const isLeavePermit = r.request_type === 'permiso_laboral' || r.metadata?.sub_type === 'permiso_laboral'

    if (isOvertime && r.date) {
      getOrCreate(`${r.employee_id}|${r.date}`).overtime.push(r)
    }

    if (isScheduleChange) {
      if (r.date) {
        getOrCreate(`${r.employee_id}|${r.date}`).scheduleChanges.push(r)
      }
      const dayChanges: DayChangeDetail[] = r.metadata?.day_changes || []
      for (const dc of dayChanges) {
        if (dc.date) getOrCreate(`${r.employee_id}|${dc.date}`).scheduleChanges.push(r)
      }
    }

    // Un permiso laboral solo tiene una fecha exacta (a diferencia de las
    // vacaciones, que cubren un rango) — se indexa igual que horas extra.
    if (isLeavePermit && r.date) {
      getOrCreate(`${r.employee_id}|${r.date}`).leavePermits.push(r)
    }

    if (isVacation) {
      const list = vacationsByEmployee.get(r.employee_id) || []
      list.push(r)
      vacationsByEmployee.set(r.employee_id, list)
    }
  }

  return { byEmployeeDate, vacationsByEmployee }
}

export function ShiftCalendarView({
  employees,
  requests = [],
  departments = [],
  currentDepartment = '',
  holidays = [],
}: ShiftCalendarViewProps) {
  const [currentBaseDate, setCurrentBaseDate] = useState<Date>(new Date())
  const [viewRange, setViewRange] = useState<ViewRange>('15') // Por defecto 15 días

  // En pantallas angostas, 15 días o el mes completo fuerzan un scroll horizontal
  // casi inmediato; arrancar en "8 días" deja más celdas legibles sin scroll.
  // Es solo el valor inicial: el usuario puede cambiarlo libremente después.
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(max-width: 640px)').matches) {
      setViewRange('8')
    }
  }, [])
  const [selectedRequest, setSelectedRequest] = useState<ShiftRequest | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [goToDateOpen, setGoToDateOpen] = useState(false)
  // Dirección del último cambio de período, para animar la entrada del contenido
  // en el mismo sentido del movimiento (spatial consistency): siguiente entra
  // desde la derecha, anterior desde la izquierda, saltar a fecha hace fade.
  const [navDirection, setNavDirection] = useState<'next' | 'prev' | 'jump'>('jump')
  const [contentKey, setContentKey] = useState(0)

  const router = useRouter()
  const searchParams = useSearchParams()

  const rangeDates = useMemo(
    () => getRangeDates(currentBaseDate, viewRange),
    [currentBaseDate, viewRange]
  )
  const isCurrentPeriod = useMemo(
    () => rangeDates.some((d) => d.toDateString() === new Date().toDateString()),
    [rangeDates]
  )

  // Mapa rápido de fecha ISO -> nombre del feriado
  const holidayByDate = useMemo(
    () => new Map(holidays.map((h) => [h.date, h.name])),
    [holidays]
  )

  // Agrupa la lista de empleados por departamento, insertando una fila de
  // encabezado de grupo antes de cada sección — sin esto, orgs con varios
  // departamentos se ven como una sola lista continua sin ninguna separación
  // visual. Se agrupa solo si NO hay un filtro de departamento activo (con
  // filtro ya son todos del mismo departamento, el encabezado sería redundante).
  type EmployeeRow =
    | { kind: 'group'; department: string; count: number }
    | { kind: 'employee'; employee: EmployeeWithSchedule }

  const groupedRows = useMemo<EmployeeRow[]>(() => {
    if (currentDepartment) {
      return employees.map((employee) => ({ kind: 'employee', employee }))
    }

    // `employees` llega ordenado por nombre (no por departamento), así que un
    // mismo departamento podría aparecer disperso entre otros — se reordena
    // por departamento primero (conservando el orden alfabético dentro de cada
    // uno) para que cada grupo quede junto y el encabezado no se repita.
    const sorted = [...employees].sort((a, b) => {
      const deptA = a.department || 'Sin departamento'
      const deptB = b.department || 'Sin departamento'
      if (deptA !== deptB) return deptA.localeCompare(deptB, 'es')
      return a.full_name.localeCompare(b.full_name, 'es')
    })

    const rows: EmployeeRow[] = []
    let lastDept: string | null = null
    for (const employee of sorted) {
      const dept = employee.department || 'Sin departamento'
      if (dept !== lastDept) {
        const count = sorted.filter((e) => (e.department || 'Sin departamento') === dept).length
        rows.push({ kind: 'group', department: dept, count })
        lastDept = dept
      }
      rows.push({ kind: 'employee', employee })
    }
    return rows
  }, [employees, currentDepartment])

  // Índice O(1) de solicitudes por empleado+fecha, construido una sola vez
  // por cambio de `requests` (no en cada celda de la tabla, ver `buildRequestIndex`)
  const requestIndex = useMemo(() => buildRequestIndex(requests), [requests])

  function handleFilterDept(deptName: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (deptName) {
      params.set('department', deptName)
    } else {
      params.delete('department')
    }
    router.push(`/shifts/calendar?${params.toString()}`)
  }

  function handlePrev() {
    const prev = new Date(currentBaseDate)
    if (viewRange === 'month') {
      prev.setMonth(prev.getMonth() - 1)
    } else if (viewRange === '15') {
      prev.setDate(prev.getDate() - 15)
    } else {
      prev.setDate(prev.getDate() - 8)
    }
    setNavDirection('prev')
    setContentKey((k) => k + 1)
    setCurrentBaseDate(prev)
  }

  function handleNext() {
    const next = new Date(currentBaseDate)
    if (viewRange === 'month') {
      next.setMonth(next.getMonth() + 1)
    } else if (viewRange === '15') {
      next.setDate(next.getDate() + 15)
    } else {
      next.setDate(next.getDate() + 8)
    }
    setNavDirection('next')
    setContentKey((k) => k + 1)
    setCurrentBaseDate(next)
  }

  function handleToday() {
    setNavDirection('jump')
    setContentKey((k) => k + 1)
    setCurrentBaseDate(new Date())
  }

  function handleGoToDate(date: Date | undefined) {
    if (!date) return
    setNavDirection('jump')
    setContentKey((k) => k + 1)
    setCurrentBaseDate(date)
    setGoToDateOpen(false)
  }

  function handleOpenRequest(req: ShiftRequest) {
    setSelectedRequest(req)
    setDetailModalOpen(true)
  }

  const startFormatted = rangeDates[0].toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })
  const endFormatted = rangeDates[rangeDates.length - 1].toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })
  const monthName = currentBaseDate.toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })

  return (
    <>
      <div className="flex flex-col w-full">
        {/* Controles del Calendario fijados y a ancho completo */}
        <div className="relative flex flex-wrap items-center justify-between gap-3 bg-card/75 supports-[backdrop-filter]:backdrop-blur-md px-6 py-2.5 sticky top-[73px] z-20 w-full after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-border after:to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <CalendarIcon className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.02em] text-foreground capitalize">
                  {viewRange === 'month' ? monthName : `${startFormatted} — ${endFormatted}`}
                </span>
                {isCurrentPeriod && (
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                    Actual
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                {rangeDates.length} días visualizados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Ir a fecha específica */}
            <Popover open={goToDateOpen} onOpenChange={setGoToDateOpen}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-xs shadow-xs hover:bg-accent hover:text-accent-foreground transition-[color,background-color,transform] duration-150 ease-out motion-reduce:transition-none active:scale-90 cursor-pointer"
                    title="Ir a fecha"
                    aria-label="Ir a fecha"
                  />
                }
              >
                <CalendarSearch className="h-4 w-4" />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-md shadow-lg border" align="start">
                <Calendar
                  mode="single"
                  selected={currentBaseDate}
                  onSelect={handleGoToDate}
                  locale={es}
                  captionLayout="dropdown"
                  startMonth={new Date(1940, 0)}
                  endMonth={new Date(2040, 11)}
                  autoFocus
                />
              </PopoverContent>
            </Popover>

            {/* Selector de Rango: 8 días, 15 días, Mes Completo */}
            <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border text-xs">
              <button
                type="button"
                onClick={() => { setNavDirection('jump'); setContentKey((k) => k + 1); setViewRange('8') }}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-[color,background-color,transform] duration-150 ease-out motion-reduce:transition-none active:scale-95 cursor-pointer",
                  viewRange === '8' ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                8 días
              </button>
              <button
                type="button"
                onClick={() => { setNavDirection('jump'); setContentKey((k) => k + 1); setViewRange('15') }}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-[color,background-color,transform] duration-150 ease-out motion-reduce:transition-none active:scale-95 cursor-pointer",
                  viewRange === '15' ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                15 días
              </button>
              <button
                type="button"
                onClick={() => { setNavDirection('jump'); setContentKey((k) => k + 1); setViewRange('month') }}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-[color,background-color,transform] duration-150 ease-out motion-reduce:transition-none active:scale-95 cursor-pointer",
                  viewRange === 'month' ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Mes Completo
              </button>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToday}
                className="h-8 text-xs cursor-pointer transition-transform duration-150 ease-out motion-reduce:transition-none active:scale-95"
              >
                Hoy
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={handlePrev}
                aria-label="Período anterior"
                className="h-8 w-8 cursor-pointer transition-transform duration-150 ease-out motion-reduce:transition-none active:scale-90"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={handleNext}
                aria-label="Período siguiente"
                className="h-8 w-8 cursor-pointer transition-transform duration-150 ease-out motion-reduce:transition-none active:scale-90"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Leyenda de colores/badges del calendario */}
            <Popover>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-xs shadow-xs hover:bg-accent hover:text-accent-foreground transition-[color,background-color,transform] duration-150 ease-out motion-reduce:transition-none active:scale-90 cursor-pointer"
                    title="Leyenda"
                    aria-label="Ver leyenda de colores"
                  />
                }
              >
                <Info className="h-4 w-4" />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3 rounded-md shadow-lg border space-y-2.5">
                <p className="text-xs font-semibold text-foreground border-b pb-2">Leyenda del Calendario</p>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-rose-500/20 border border-rose-500/40 shrink-0" />
                    <span className="text-muted-foreground">Feriado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500/20 border border-indigo-500/40 shrink-0" />
                    <span className="text-muted-foreground">Fin de semana</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Palmtree className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-muted-foreground">Vacaciones (aprobadas / pendientes)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="text-muted-foreground">Cambio de horario (aprobado / pendiente)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarOff className="h-3 w-3 text-violet-600 dark:text-violet-400 shrink-0" />
                    <span className="text-muted-foreground">Permiso laboral (aprobado / pendiente)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-muted-foreground">Horas suplementarias (50% recargo)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-orange-600 dark:text-orange-400 shrink-0" />
                    <span className="text-muted-foreground">Horas extraordinarias (100% recargo)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserX className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-muted-foreground">Sin horario base configurado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Moon className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                    <span className="text-muted-foreground">Día libre según horario</span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Matriz Horizontal de Turnos */}
        <div className="no-scrollbar overflow-x-auto overflow-y-hidden w-full">
          <table
            key={contentKey}
            className={cn(
              "w-full text-left border-collapse",
              "motion-reduce:[animation:none]",
              navDirection === 'next' && "animate-[calendar-enter-right_220ms_cubic-bezier(0.23,1,0.32,1)_both]",
              navDirection === 'prev' && "animate-[calendar-enter-left_220ms_cubic-bezier(0.23,1,0.32,1)_both]",
              navDirection === 'jump' && "animate-[calendar-enter-fade_180ms_ease-out_both]"
            )}
          >
            <thead>
              <tr className="border-b bg-muted/40 text-xs">
                {/* Celda Empleado con Popover de Filtro por Departamento */}
                <th className="p-3 pl-6 font-semibold min-w-[260px] max-w-[300px] sticky left-0 bg-muted z-10 border-r border-border/40">
                  <Popover>
                    <PopoverTrigger
                      render={
                        <button
                          type="button"
                          className="group flex items-center justify-between w-full text-left font-semibold text-foreground hover:text-primary transition-colors cursor-pointer select-none"
                        />
                      }
                    >
                      <div className="flex items-center gap-1.5 min-w-0 pr-1">
                        <span className="truncate text-xs font-semibold">
                          {currentDepartment || 'Departamentos'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground group-hover:text-primary shrink-0">
                        <Filter className={cn("h-3.5 w-3.5", currentDepartment && "text-primary")} />
                        <ChevronDown className="h-3 w-3 opacity-60" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-56 p-2 rounded-md shadow-lg border">
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b mb-1">
                        Filtrar por Departamento
                      </div>
                      <div className="space-y-0.5 max-h-56 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => handleFilterDept('')}
                          className={cn(
                            "flex items-center justify-between w-full px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer text-left",
                            !currentDepartment ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-foreground"
                          )}
                        >
                          <span>Todos los departamentos</span>
                          {!currentDepartment && <Check className="h-3.5 w-3.5" />}
                        </button>
                        {departments.map((dept) => {
                          const isSelected = currentDepartment === dept
                          return (
                            <button
                              key={dept}
                              type="button"
                              onClick={() => handleFilterDept(dept)}
                              className={cn(
                                "flex items-center justify-between w-full px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer text-left",
                                isSelected ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-foreground"
                              )}
                            >
                              <span className="truncate">{dept}</span>
                              {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </th>
                {rangeDates.map((dayDate) => {
                  const isToday = dayDate.toDateString() === new Date().toDateString()
                  const dayIndex = dayDate.getDay()
                  const dayName = DAY_NAMES_SHORT[dayIndex]
                  const dayNumber = dayDate.getDate()
                  const isWeekend = dayIndex === 0 || dayIndex === 6
                  const holidayName = holidayByDate.get(formatDateToIso(dayDate))
                  const isHoliday = Boolean(holidayName)

                  return (
                    <th
                      key={dayDate.toISOString()}
                      onClick={isHoliday ? () => toast.info('Día Feriado', holidayName) : undefined}
                      className={cn(
                        "p-2 text-center font-medium border-l border-border/50 min-w-[110px]",
                        isToday && "bg-primary/15 text-primary font-bold ring-1 ring-inset ring-primary/30",
                        isWeekend && !isToday && !isHoliday && "bg-slate-500/[0.07] dark:bg-slate-400/[0.08]",
                        isHoliday && !isToday && "bg-rose-500/10 cursor-pointer"
                      )}
                      title={holidayName ? `Feriado: ${holidayName}` : undefined}
                    >
                      <div className="flex flex-col items-center">
                        <span className={cn("text-[10px] uppercase tracking-[0.02em] font-medium", isWeekend ? "text-muted-foreground/70" : "text-muted-foreground")}>
                          {dayName}
                        </span>
                        <span className={cn(
                          "text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center mt-0.5",
                          isToday
                            ? "bg-primary text-primary-foreground font-bold"
                            : isHoliday
                              ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold"
                              : "text-foreground"
                        )}>
                          {dayNumber}
                        </span>
                        {isHoliday && (
                          <Badge
                            variant="outline"
                            className="mt-0.5 text-[10px] px-1.5 py-0 h-4 bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 font-semibold"
                          >
                            Feriado
                          </Badge>
                        )}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-xs">
              {employees.length > 0 ? (
                groupedRows.map((row) => {
                  if (row.kind === 'group') {
                    // Dos celdas en vez de un único <td colSpan>: así el nombre del
                    // departamento queda en la celda angosta y realmente "sticky"
                    // (mismo ancho que la columna de empleado), y no se desliza
                    // fuera de vista al hacer scroll horizontal como ocurre cuando
                    // el sticky se aplica sobre una celda que abarca toda la fila.
                    return (
                      <tr key={`group-${row.department}`} className="bg-muted/60">
                        <td className="sticky left-0 z-10 px-6 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground bg-muted/60 border-y border-r border-border/60 whitespace-nowrap">
                          {row.department}
                          <span className="ml-1.5 font-normal normal-case text-muted-foreground/70">
                            ({row.count} {row.count === 1 ? 'empleado' : 'empleados'})
                          </span>
                        </td>
                        <td colSpan={rangeDates.length} className="bg-muted/60 border-y border-border/60" />
                      </tr>
                    )
                  }

                  const emp = row.employee
                  return (
                    <tr key={emp.id} className="hover:bg-muted/30 transition-colors duration-150 ease-out motion-reduce:transition-none">
                      {/* Empleado Sticky */}
                      <td className="p-3 pl-6 sticky left-0 bg-card z-10 border-r border-border/40 shadow-xs">
                        <div className="flex items-center gap-2.5">
                          <Link
                            href={`/employees/${emp.id}`}
                            title={`Ver expediente de ${emp.full_name}`}
                            aria-label={`Ver expediente de ${emp.full_name}`}
                            className="shrink-0 rounded-full transition-transform duration-150 ease-out motion-reduce:transition-none active:scale-90 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 cursor-pointer"
                          >
                            <Avatar className="h-7 w-7 ring-1 ring-border">
                              <AvatarImage src={emp.avatar_url ?? undefined} alt={emp.full_name} />
                              <AvatarFallback className="text-[10px] font-semibold">
                                {getInitials(emp.full_name)}
                              </AvatarFallback>
                            </Avatar>
                          </Link>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-foreground truncate max-w-[210px]" title={emp.full_name}>
                              {emp.full_name}
                            </span>
                            <span className="text-[11px] text-muted-foreground truncate max-w-[210px]" title={emp.position || undefined}>
                              {emp.position || '—'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Celdas de los Días con soporte de Icono de Horas Extras Aprobadas */}
                      {rangeDates.map((dayDate) => {
                        const isoDate = formatDateToIso(dayDate)
                        const dayNameSpanish = DAYS_OF_WEEK_MAP[dayDate.getDay()]
                        const sched = emp.schedules?.find((s) => s.day_of_week === dayNameSpanish)
                        const hasNoScheduleAssigned = !emp.schedules || emp.schedules.length === 0
                        const isToday = dayDate.toDateString() === new Date().toDateString()
                        const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6
                        const isHolidayDate = holidayByDate.has(isoDate)

                        // Lookups O(1) contra el índice pre-construido (ver buildRequestIndex),
                        // en vez de recorrer todo `requests` por cada celda de la tabla.
                        const dayEntry = requestIndex.byEmployeeDate.get(`${emp.id}|${isoDate}`)
                        const approvedOvertime = dayEntry?.overtime.find((r) => r.status === 'aprobado')
                        const pendingOvertime = dayEntry?.overtime.find((r) => r.status === 'pendiente')
                        // Extraordinaria (100% recargo, feriados/fines de semana) vs. Suplementaria
                        // (50% recargo, día laboral normal) — mismo dato ya usado en OvertimeWizardModal.
                        const isApprovedExtraordinary = approvedOvertime?.metadata?.overtime_type === 'extraordinaria_100'
                        const isPendingExtraordinary = pendingOvertime?.metadata?.overtime_type === 'extraordinaria_100'
                        const scheduleChangeReq = dayEntry?.scheduleChanges[0]
                        const approvedLeavePermit = dayEntry?.leavePermits.find((r) => r.status === 'aprobado')
                        const pendingLeavePermit = dayEntry?.leavePermits.find((r) => r.status === 'pendiente')

                        const dayChangeDetail: DayChangeDetail | undefined = scheduleChangeReq?.metadata?.day_changes?.find(
                          (dc: DayChangeDetail) => dc.date === isoDate
                        )
                        const isScheduleChangeApproved = scheduleChangeReq?.status === 'aprobado'
                        const isScheduleChangePending = scheduleChangeReq?.status === 'pendiente'

                        const effective = getEffectiveSchedule(sched, scheduleChangeReq, dayChangeDetail)
                        const effectiveIsWorkday = effective.isWorkday
                        const effectiveSplit = effective.hasSplit
                        const effectiveStart1 = effective.start1
                        const effectiveEnd1 = effective.end1
                        const effectiveStart2 = effective.start2
                        const effectiveEnd2 = effective.end2

                        // Las vacaciones cubren un rango (no un día exacto indexable), así que
                        // se resuelven contra la lista de vacaciones del empleado, ya agrupada
                        // por `buildRequestIndex` (no contra todo `requests`).
                        const employeeVacations = requestIndex.vacationsByEmployee.get(emp.id)
                        const vacationReq = employeeVacations?.find((r) => {
                          const { start, end } = getVacationRange(r)
                          return isoDate >= start && isoDate <= end
                        })
                        const isVacationApproved = vacationReq?.status === 'aprobado'
                        const isVacationPending = vacationReq?.status === 'pendiente'

                        // Si tiene vacaciones aprobadas para este día, sustituir el horario por 'Vacaciones'
                        if (vacationReq && isVacationApproved) {
                          return (
                            <td
                              key={dayDate.toISOString()}
                              className={cn(
                                "p-1.5 text-center border-l border-border/50 select-none min-w-[110px] bg-emerald-500/10 dark:bg-emerald-950/30"
                              )}
                            >
                              <div className="flex flex-col items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenRequest(vacationReq)}
                                  className="inline-flex items-center justify-center gap-1 py-1 px-2 rounded-md border border-emerald-500/30 bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] shadow-2xs transition-transform duration-150 ease-out motion-reduce:transition-none active:scale-95 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 cursor-pointer w-full"
                                  title={`Vacaciones Aprobadas (${vacationReq.metadata?.settlement_period || ''}) • Clic para ver detalle`}
                                >
                                  <Palmtree className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                  <span>Vacaciones</span>
                                </button>
                              </div>
                            </td>
                          )
                        }

                        if (!effectiveIsWorkday) {
                          return (
                            <td
                              key={dayDate.toISOString()}
                              className={cn(
                                "p-1.5 text-center border-l border-border/50 select-none min-w-[110px]",
                                isToday
                                  ? "bg-primary/10"
                                  : isHolidayDate
                                    ? "bg-rose-500/5"
                                    : isWeekend
                                      ? "bg-slate-500/[0.08] dark:bg-slate-400/10"
                                      : "bg-muted/10"
                              )}
                            >
                              <div className="flex flex-col items-center justify-center gap-1">
                                {hasNoScheduleAssigned && !scheduleChangeReq ? (
                                  <span
                                    className="inline-flex items-center justify-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap"
                                    title="Este empleado no tiene un horario base configurado (distinto de un día libre real)"
                                  >
                                    <UserX className="h-2.5 w-2.5" />
                                    Sin horario
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center text-[11px] font-mono text-muted-foreground/60 whitespace-nowrap">
                                    <Moon className="h-2.5 w-2.5 mr-0.5 opacity-60" />
                                    Libre
                                  </span>
                                )}

                                {/* Indicador si tiene vacaciones pendientes */}
                                {vacationReq && isVacationPending && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRequest(vacationReq)}
                                    className="flex items-center justify-center gap-1 w-full py-0.5 px-1 rounded font-bold text-[10px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 transition-transform duration-150 ease-out motion-reduce:transition-none active:scale-95 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 cursor-pointer shadow-2xs"
                                    title="Vacaciones pendientes de aprobación • Clic para ver"
                                  >
                                    <Palmtree className="h-2.5 w-2.5" />
                                    <span>Vacac. Pend.</span>
                                  </button>
                                )}

                                {/* Indicador de Cambio de Horario a Libre */}
                                {scheduleChangeReq && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRequest(scheduleChangeReq)}
                                    className={cn(
                                      "flex items-center justify-center gap-1 w-full py-0.5 px-1 rounded font-bold text-[10px] transition-transform duration-150 ease-out motion-reduce:transition-none active:scale-95 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 cursor-pointer shadow-2xs",
                                      isScheduleChangeApproved
                                        ? "bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-400"
                                        : "bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400"
                                    )}
                                    title={`Cambio de Horario ${isScheduleChangeApproved ? 'Aprobado' : 'Pendiente'}: Día Libre • Clic para ver`}
                                  >
                                    <RefreshCw className="h-2.5 w-2.5" />
                                    <span>{isScheduleChangeApproved ? 'Cambio Libre' : 'Cambio Pend.'}</span>
                                  </button>
                                )}

                                {/* Indicador de Permiso Laboral (aprobado o pendiente) */}
                                {(approvedLeavePermit || pendingLeavePermit) && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRequest((approvedLeavePermit || pendingLeavePermit)!)}
                                    className={cn(
                                      "flex items-center justify-center gap-1 w-full py-0.5 px-1 rounded font-bold text-[10px] transition-transform duration-150 ease-out motion-reduce:transition-none active:scale-95 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 cursor-pointer shadow-2xs",
                                      approvedLeavePermit
                                        ? "bg-violet-500/15 border border-violet-500/30 text-violet-600 dark:text-violet-400"
                                        : "bg-violet-500/10 border border-violet-500/20 text-violet-500 dark:text-violet-400/80"
                                    )}
                                    title={`Permiso Laboral ${approvedLeavePermit ? 'Aprobado' : 'Pendiente'} • Clic para ver`}
                                  >
                                    <CalendarOff className="h-2.5 w-2.5" />
                                    <span>{approvedLeavePermit ? 'Permiso' : 'Permiso Pend.'}</span>
                                  </button>
                                )}

                                {/* Icono si tiene horas extras aprobadas en día libre */}
                                {approvedOvertime && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRequest(approvedOvertime)}
                                    className={cn(
                                      "flex items-center gap-1 px-1.5 py-0.5 rounded font-bold text-[10px] transition-transform duration-150 ease-out motion-reduce:transition-none active:scale-95 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 cursor-pointer shadow-2xs",
                                      isApprovedExtraordinary
                                        ? "bg-orange-500/15 border border-orange-500/30 text-orange-600 dark:text-orange-400"
                                        : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                    )}
                                    title={`Horas Extras ${isApprovedExtraordinary ? 'Extraordinarias' : 'Suplementarias'} Aprobadas: +${approvedOvertime.hours} hrs (${approvedOvertime.start_time} - ${approvedOvertime.end_time})`}
                                  >
                                    <Clock className="h-2.5 w-2.5" />
                                    <span>+{approvedOvertime.hours}h {isApprovedExtraordinary ? 'Extras' : 'Suple.'}</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          )
                        }

                        return (
                          <td
                            key={dayDate.toISOString()}
                            className={cn(
                              "p-1.5 border-l border-border/50 text-center min-w-[110px]",
                              isToday && "bg-primary/10",
                              isHolidayDate && !isToday && "bg-rose-500/5",
                              isWeekend && !isToday && !isHolidayDate && "bg-slate-500/[0.06] dark:bg-slate-400/[0.07]",
                              scheduleChangeReq && isScheduleChangeApproved && "bg-blue-500/5"
                            )}
                          >
                            <div className="flex flex-col items-center justify-center gap-1 w-full">
                              {/* Horario en texto plano sobre el grid (sin card): lectura rápida, deja protagonismo a los indicadores */}
                              <div className={cn(
                                "flex flex-col items-center justify-center w-full",
                                scheduleChangeReq && isScheduleChangeApproved
                                  ? "text-blue-700 dark:text-blue-300"
                                  : isToday && "text-primary"
                              )}>
                                <div className={cn(
                                  "text-[11px] font-mono whitespace-nowrap",
                                  isToday ? "font-bold" : "font-medium",
                                  !(scheduleChangeReq && isScheduleChangeApproved) && !isToday && "text-foreground"
                                )}>
                                  {effectiveStart1} - {effectiveEnd1}
                                </div>
                                {effectiveSplit && (
                                  <div className={cn(
                                    "text-[10.5px] font-mono whitespace-nowrap mt-0.5",
                                    isToday ? "text-primary/80 font-semibold" : "text-muted-foreground"
                                  )}>
                                    {effectiveStart2} - {effectiveEnd2}
                                  </div>
                                )}
                              </div>

                              {/* Indicador visual destacado de Cambio de Horario */}
                              {scheduleChangeReq && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenRequest(scheduleChangeReq)}
                                  className={cn(
                                    "flex items-center justify-center gap-1 w-full py-0.5 px-1 rounded font-bold text-[10px] transition-transform duration-150 ease-out motion-reduce:transition-none active:scale-95 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 cursor-pointer shadow-2xs",
                                    isScheduleChangeApproved
                                      ? "bg-blue-500/20 border border-blue-500/40 text-blue-700 dark:text-blue-300"
                                      : "bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400"
                                  )}
                                  title={`Cambio de Horario ${isScheduleChangeApproved ? 'Aprobado y Vigente' : 'Pendiente de Aprobación'} • Clic para ver`}
                                >
                                  <RefreshCw className="h-2.5 w-2.5" />
                                  <span>{isScheduleChangeApproved ? 'Modificado' : 'Cambio Pend.'}</span>
                                </button>
                              )}

                              {/* Indicador de Permiso Laboral (aprobado o pendiente) */}
                              {(approvedLeavePermit || pendingLeavePermit) && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenRequest((approvedLeavePermit || pendingLeavePermit)!)}
                                  className={cn(
                                    "flex items-center justify-center gap-1 w-full py-0.5 px-1 rounded font-bold text-[10px] transition-transform duration-150 ease-out motion-reduce:transition-none active:scale-95 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 cursor-pointer shadow-2xs",
                                    approvedLeavePermit
                                      ? "bg-violet-500/15 border border-violet-500/30 text-violet-600 dark:text-violet-400"
                                      : "bg-violet-500/10 border border-violet-500/20 text-violet-500 dark:text-violet-400/80"
                                  )}
                                  title={`Permiso Laboral ${approvedLeavePermit ? 'Aprobado' : 'Pendiente'} • Clic para ver`}
                                >
                                  <CalendarOff className="h-2.5 w-2.5" />
                                  <span>{approvedLeavePermit ? 'Permiso' : 'Permiso Pend.'}</span>
                                </button>
                              )}

                              {/* Icono Badge para Horas Extras Aprobadas (naranja = extraordinaria 100%, verde = suplementaria 50%) */}
                              {approvedOvertime && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenRequest(approvedOvertime)}
                                  className={cn(
                                    "flex items-center justify-center gap-1 w-full py-0.5 px-1 rounded font-bold text-[10px] transition-transform duration-150 ease-out motion-reduce:transition-none active:scale-95 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 cursor-pointer shadow-2xs",
                                    isApprovedExtraordinary
                                      ? "bg-orange-500/15 border border-orange-500/30 text-orange-600 dark:text-orange-400"
                                      : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                  )}
                                  title={`Horas Extras ${isApprovedExtraordinary ? 'Extraordinarias (100%)' : 'Suplementarias (50%)'} Aprobadas: +${approvedOvertime.hours} hrs (${approvedOvertime.start_time} - ${approvedOvertime.end_time}) • Clic para ver solicitud`}
                                >
                                  <Clock className="h-2.5 w-2.5" />
                                  <span>+{approvedOvertime.hours}h {isApprovedExtraordinary ? 'Extras' : 'Suple.'}</span>
                                </button>
                              )}

                              {/* Indicador sutil para Horas Extras Pendientes (naranja = extraordinaria, ámbar = suplementaria) */}
                              {pendingOvertime && !approvedOvertime && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenRequest(pendingOvertime)}
                                  className={cn(
                                    "flex items-center justify-center gap-1 w-full py-0.5 px-1 rounded font-semibold text-[10px] transition-transform duration-150 ease-out motion-reduce:transition-none active:scale-95 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 cursor-pointer",
                                    isPendingExtraordinary
                                      ? "bg-orange-500/15 border border-orange-500/30 text-orange-600 dark:text-orange-400"
                                      : "bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400"
                                  )}
                                  title={`Horas Extras ${isPendingExtraordinary ? 'Extraordinarias (100%)' : 'Suplementarias (50%)'} Pendientes de Aprobación (${pendingOvertime.hours} hrs) • Clic para autorizar`}
                                >
                                  <Clock className="h-2.5 w-2.5" />
                                  <span className="whitespace-nowrap">+{pendingOvertime.hours}h Pendiente</span>
                                </button>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={rangeDates.length + 1} className="p-8 text-center text-muted-foreground">
                    {currentDepartment ? (
                      <span>
                        Ningún empleado pertenece al departamento <strong className="text-foreground">{currentDepartment}</strong>.{' '}
                        <button
                          type="button"
                          onClick={() => handleFilterDept('')}
                          className="text-primary hover:underline cursor-pointer font-medium"
                        >
                          Quitar filtro
                        </button>
                      </span>
                    ) : (
                      'No hay empleados registrados.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal interactivo al hacer clic sobre el icono de horas extras */}
      <ShiftRequestDetailModal
        request={selectedRequest}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
      />
    </>
  )
}
