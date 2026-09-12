'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Employee, ShiftRequest, EmployeeSchedule, DayOfWeek, Holiday, Organization } from '@/types/employee'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import {
  Clock,
  Printer,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Search,
  FileText,
  AlertTriangle,
  Calendar as CalendarIcon,
  Info,
} from 'lucide-react'
import { printOvertimeDocument } from '@/lib/shifts/print-overtime'
import { createOvertimeRequestAction } from '@/lib/shifts/actions'
import { getInitials, formatLongDate } from '@/lib/shifts/format'
import { parseTimeToMinutes, intervalsOverlap } from '@/lib/shifts/time'
import { cn } from '@/lib/utils'

interface EmployeeWithSchedule extends Employee {
  schedules?: EmployeeSchedule[]
}

interface OvertimeWizardModalProps {
  organizationId: string
  organizationName?: string
  employees: EmployeeWithSchedule[]
  // El <Dialog> raíz ahora vive en el launcher (NewShiftRequestButton), que
  // decide si mostrar el selector o este wizard dentro de un único backdrop
  // compartido — evita el parpadeo de dos Dialogs independientes al pasar
  // de uno a otro. Este componente solo devuelve su <DialogContent>, y usa
  // onOpenChange para pedirle al padre que lo cierre (con confirmación si
  // hay cambios sin guardar).
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  // El Dialog raíz vive en el launcher: para que Escape/click-fuera respeten
  // la misma confirmación de "descartar cambios" que el botón Cerrar interno,
  // este wizard publica su propio handleRequestClose hacia el padre, que lo
  // usa como onOpenChange del Dialog mientras este wizard está activo.
  onRegisterRequestClose?: (fn: () => void) => void
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

const WEEKDAY_OPTIONS: { value: number; label: DayOfWeek }[] = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
]

/**
 * Calcula las próximas `count` fechas (ISO) que caen en `weekday` (0=Domingo,
 * ..., 6=Sábado), empezando desde `fromDate` inclusive. Ej. "Sábado" x 3 desde
 * hoy da los próximos 3 sábados — para solicitudes de horas extras repetidas
 * (ver toggle "Repetir" en el Paso 2).
 */
function getUpcomingWeekdayDates(fromDate: string, weekday: number, count: number): string[] {
  const [y, m, d] = fromDate.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const diff = (weekday - start.getDay() + 7) % 7
  start.setDate(start.getDate() + diff)

  const dates: string[] = []
  for (let i = 0; i < count; i++) {
    const dt = new Date(start)
    dt.setDate(start.getDate() + i * 7)
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
    dates.push(iso)
  }
  return dates
}

export function OvertimeWizardModal({
  organizationId,
  organizationName = 'RH Garden',
  employees,
  onOpenChange,
  onSuccess,
  onRegisterRequestClose,
}: OvertimeWizardModalProps) {
  const router = useRouter()
  const supabase = createClient()

  // Pasos: 1 = Empleado, 2 = Fecha y Horas, 3 = Motivo & Confirmación, 4 = Imprimir / Éxito
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [loading, setLoading] = useState(false)
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  // Datos del Formulario
  const [selectedEmpId, setSelectedEmpId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState('18:00')
  const [endTime, setEndTime] = useState('20:00')
  const [reason, setReason] = useState('')
  const [isHoliday, setIsHoliday] = useState(false)
  const [holidayTouched, setHolidayTouched] = useState(false)
  const [overtimeType, setOvertimeType] = useState<'suplementaria_50' | 'extraordinaria_100'>('suplementaria_50')
  const [overtimeTypeTouched, setOvertimeTypeTouched] = useState(false)
  const [createdRequest, setCreatedRequest] = useState<ShiftRequest | null>(null)

  // Modo "Repetir" (solicitud en lote): en vez de una única fecha, se generan
  // N solicitudes independientes para los próximos N días de la semana
  // elegida (ej. "Sábado" x 3 = los próximos 3 sábados), todas con el mismo
  // horario/tipo/motivo. Cada una queda como una fila propia en shift_requests,
  // aprobable/editable por separado — igual que el resto del sistema.
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [batchWeekday, setBatchWeekday] = useState<number>(6) // Sábado por defecto
  const [batchCount, setBatchCount] = useState(3)
  const [createdBatch, setCreatedBatch] = useState<{ date: string; success: boolean; error?: string }[]>([])
  const [batchProgress, setBatchProgress] = useState(0)

  // Horarios del empleado seleccionado (si no vienen precargados)
  const [employeeSchedules, setEmployeeSchedules] = useState<EmployeeSchedule[]>([])
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [holidays, setHolidays] = useState<Holiday[]>([])

  // Cargar datos de la organización para el encabezado oficial
  useEffect(() => {
    if (!organizationId) return
    async function loadOrg() {
      const { data } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single()
      if (data) setOrganization(data)
    }
    loadOrg()
  }, [organizationId, supabase])

  // Cargar feriados registrados de la organización para sugerir el tipo de recargo
  useEffect(() => {
    if (!organizationId) return
    async function loadHolidays() {
      const { data } = await supabase
        .from('holidays')
        .select('*')
        .eq('organization_id', organizationId)
      if (data) setHolidays(data as Holiday[])
    }
    loadHolidays()
  }, [organizationId, supabase])

  // Empleado seleccionado
  const selectedEmp = useMemo(
    () => employees.find((e) => e.id === selectedEmpId),
    [employees, selectedEmpId]
  )

  // Cargar horarios del empleado si no están en memoria
  useEffect(() => {
    if (!selectedEmpId) {
      setEmployeeSchedules([])
      return
    }

    if (selectedEmp?.schedules && selectedEmp.schedules.length > 0) {
      setEmployeeSchedules(selectedEmp.schedules)
      return
    }

    async function loadSchedules() {
      const { data } = await supabase
        .from('employee_schedules')
        .select('*')
        .eq('employee_id', selectedEmpId)
      if (data) {
        setEmployeeSchedules(data as EmployeeSchedule[])
      }
    }
    loadSchedules()
  }, [selectedEmpId, selectedEmp, supabase])

  // Comprobar si hay datos en proceso para advertir antes de cerrar
  const hasUnsavedChanges = useMemo(() => {
    return Boolean(selectedEmpId || reason.trim() || step > 1) && step !== 4
  }, [selectedEmpId, reason, step])

  // Filtrar empleados en paso 1
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees
    const q = searchQuery.toLowerCase()
    return employees.filter(
      (e) =>
        e.full_name.toLowerCase().includes(q) ||
        (e.national_id && e.national_id.includes(q)) ||
        (e.department && e.department.toLowerCase().includes(q)) ||
        (e.position && e.position.toLowerCase().includes(q))
    )
  }, [employees, searchQuery])

  // Identificar el horario habitual para la fecha seleccionada
  const activeDaySchedule = useMemo(() => {
    if (!date) return null
    // Evitar desfase de zona horaria parseando YYYY-MM-DD
    const [y, m, d] = date.split('-').map(Number)
    const dayObj = new Date(y, m - 1, d)
    const dayName = DAYS_OF_WEEK_MAP[dayObj.getDay()]
    return employeeSchedules.find((s) => s.day_of_week === dayName) || null
  }, [date, employeeSchedules])

  // Fechas resultantes del modo "Repetir": próximas `batchCount` ocurrencias
  // de `batchWeekday` a partir de `date` (inclusive, si `date` ya cae en ese
  // día de semana). Se recalcula al vuelo — nada se guarda hasta confirmar.
  const batchDates = useMemo(() => {
    if (!isBatchMode || !date || batchCount <= 0) return []
    return getUpcomingWeekdayDates(date, batchWeekday, batchCount)
  }, [isBatchMode, date, batchWeekday, batchCount])

  // Cálculo de horas trabajadas
  const calculatedHours = useMemo(() => {
    if (!startTime || !endTime) return 0
    const t1 = parseTimeToMinutes(startTime)
    let t2 = parseTimeToMinutes(endTime)
    if (t2 <= t1) {
      t2 += 24 * 60 // Pasa de medianoche
    }
    const diffHours = (t2 - t1) / 60
    return Number(diffHours.toFixed(2))
  }, [startTime, endTime])

  // Detección de Conflicto / Solapamiento con jornada laboral regular
  const scheduleOverlapWarning = useMemo(() => {
    if (!activeDaySchedule || !activeDaySchedule.is_workday || !startTime || !endTime) {
      return null
    }

    const otStart = parseTimeToMinutes(startTime)
    let otEnd = parseTimeToMinutes(endTime)
    if (otEnd <= otStart) otEnd += 24 * 60

    // Tramo 1 — normalizar también el cruce de medianoche del turno regular
    // (ej. 22:00-06:00): sin esto, s1End (360) < s1Start (1320) forma un
    // intervalo mal formado y intervalsOverlap falla silenciosamente,
    // dejando pasar horas extra que en realidad se solapan con la jornada.
    const s1Start = parseTimeToMinutes(activeDaySchedule.start_time_1 || '08:00')
    let s1End = parseTimeToMinutes(activeDaySchedule.end_time_1 || '13:00')
    if (s1End <= s1Start) s1End += 24 * 60
    if (intervalsOverlap(otStart, otEnd, s1Start, s1End)) {
      return `La hora extra solicitada (${startTime} - ${endTime}) se solapa con su 1er turno regular (${activeDaySchedule.start_time_1} a ${activeDaySchedule.end_time_1}).`
    }

    // Tramo 2 (si tiene doble jornada)
    if (activeDaySchedule.has_split_shift) {
      const s2Start = parseTimeToMinutes(activeDaySchedule.start_time_2 || '14:00')
      let s2End = parseTimeToMinutes(activeDaySchedule.end_time_2 || '18:00')
      if (s2End <= s2Start) s2End += 24 * 60
      if (intervalsOverlap(otStart, otEnd, s2Start, s2End)) {
        return `La hora extra solicitada (${startTime} - ${endTime}) se solapa con su 2do turno regular (${activeDaySchedule.start_time_2} a ${activeDaySchedule.end_time_2}).`
      }
    }

    return null
  }, [activeDaySchedule, startTime, endTime])

  // Detectar si la fecha seleccionada corresponde a un feriado registrado
  const matchedHoliday = useMemo(() => {
    if (!date) return null
    return holidays.find((h) => h.date === date) || null
  }, [date, holidays])

  // Autocompletar el checkbox de feriado según el calendario, mientras el usuario no lo edite manualmente
  useEffect(() => {
    if (holidayTouched) return
    setIsHoliday(Boolean(matchedHoliday))
  }, [matchedHoliday, holidayTouched])

  // Sugerencia automática del tipo de recargo:
  // día laboral (según horario habitual) => Suplementaria (50%)
  // día libre/descanso o feriado marcado => Extraordinaria (100%)
  const suggestedOvertimeType = useMemo<'suplementaria_50' | 'extraordinaria_100'>(() => {
    if (isHoliday) return 'extraordinaria_100'
    if (activeDaySchedule && !activeDaySchedule.is_workday) return 'extraordinaria_100'
    return 'suplementaria_50'
  }, [activeDaySchedule, isHoliday])

  // Aplicar la sugerencia mientras el usuario no haya elegido el tipo manualmente
  useEffect(() => {
    if (overtimeTypeTouched) return
    setOvertimeType(suggestedOvertimeType)
  }, [suggestedOvertimeType, overtimeTypeTouched])

  function handleReset() {
    setStep(1)
    setSelectedEmpId('')
    setSearchQuery('')
    setDate(new Date().toISOString().split('T')[0])
    setStartTime('18:00')
    setEndTime('20:00')
    setReason('')
    setIsHoliday(false)
    setHolidayTouched(false)
    setOvertimeType('suplementaria_50')
    setOvertimeTypeTouched(false)
    setCreatedRequest(null)
    setShowConfirmClose(false)
    setIsBatchMode(false)
    setBatchWeekday(6)
    setBatchCount(3)
    setCreatedBatch([])
    setBatchProgress(0)
  }

  function handleRequestClose() {
    if (hasUnsavedChanges) {
      setShowConfirmClose(true)
    } else {
      forceClose()
    }
  }

  // Publicar handleRequestClose hacia el padre para que Escape/click-fuera
  // en el Dialog raíz compartido respeten esta misma confirmación.
  useEffect(() => {
    onRegisterRequestClose?.(handleRequestClose)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnsavedChanges])

  function forceClose() {
    setShowConfirmClose(false)
    onOpenChange(false)
    setTimeout(handleReset, 300)
  }

  async function handleCreateRequest() {
    if (!selectedEmpId || !date || !startTime || !endTime || !reason.trim()) {
      toast.error('Completa todos los campos obligatorios.')
      return
    }

    if (scheduleOverlapWarning) {
      toast.error('No puedes emitir una hora extra sobre el horario de trabajo habitual.')
      return
    }

    if (isBatchMode) {
      await handleCreateBatchRequests()
      return
    }

    setLoading(true)
    try {
      const result = await createOvertimeRequestAction({
        organizationId,
        employeeId: selectedEmpId,
        date,
        startTime,
        endTime,
        hours: calculatedHours,
        reason,
        overtimeType,
        isHoliday,
        isWorkday: activeDaySchedule ? activeDaySchedule.is_workday : null,
      })

      if (!result.success || !result.data) {
        toast.error(result.error || 'Error al generar la solicitud.')
        return
      }

      setCreatedRequest(result.data)
      setStep(4)
      toast.success('Solicitud de horas extras generada con éxito.')
      if (onSuccess) onSuccess()
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error al generar la solicitud.')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Crea una solicitud independiente por cada fecha del lote (ver batchDates)
   * — mismo horario/tipo/motivo, pero cada una queda como su propia fila en
   * shift_requests, aprobable/editable por separado. Se lanzan en paralelo
   * (Promise.allSettled, no Promise.all): un fallo puntual en una fecha no
   * debe descartar los éxitos del resto del lote, y se reporta cuál falló.
   */
  async function handleCreateBatchRequests() {
    if (batchDates.length === 0) {
      toast.error('No hay fechas para generar en el lote.')
      return
    }

    setLoading(true)
    setBatchProgress(0)
    try {
      const results = await Promise.allSettled(
        batchDates.map((batchDate) =>
          createOvertimeRequestAction({
            organizationId,
            employeeId: selectedEmpId,
            date: batchDate,
            startTime,
            endTime,
            hours: calculatedHours,
            reason,
            overtimeType,
            isHoliday,
            isWorkday: activeDaySchedule ? activeDaySchedule.is_workday : null,
          }).then((r) => {
            setBatchProgress((p) => p + 1)
            return r
          })
        )
      )

      const summary = results.map((r, i) => {
        if (r.status === 'fulfilled' && r.value.success) {
          return { date: batchDates[i], success: true }
        }
        const error = r.status === 'fulfilled' ? r.value.error : (r.reason as Error)?.message
        return { date: batchDates[i], success: false, error: error || 'Error desconocido' }
      })

      setCreatedBatch(summary)
      setStep(4)

      const successCount = summary.filter((s) => s.success).length
      if (successCount === summary.length) {
        toast.success(`${successCount} solicitudes de horas extras generadas con éxito.`)
      } else if (successCount > 0) {
        toast.info(`${successCount} de ${summary.length} solicitudes generadas. Revisa las que fallaron.`)
      } else {
        toast.error('No se pudo generar ninguna solicitud del lote.')
      }

      if (onSuccess) onSuccess()
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error al generar el lote de solicitudes.')
    } finally {
      setLoading(false)
    }
  }

  function handlePrintDocument() {
    printOvertimeDocument({
      organization: organization || { name: organizationName },
      organizationName,
      employeeName: selectedEmp?.full_name || 'Empleado',
      nationalId: selectedEmp?.national_id || '',
      department: selectedEmp?.department || '',
      position: selectedEmp?.position || '',
      date,
      startTime,
      endTime,
      hours: calculatedHours,
      reason: reason.trim(),
    })
  }

  return (
    <>
      {/* El <DialogContent> único (clase incluida) vive en el launcher
          (NewShiftRequestButton) para no remontar el Portal/Overlay al
          cambiar de vista — este componente solo aporta su contenido. */}
          {/* Cabecera del Wizard */}
          <DialogHeader className="p-5 pb-4 border-b bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Solicitud de Horas Extras
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Asistente paso a paso para autorización y registro legal
                  </DialogDescription>
                </div>
              </div>

              {/* Botón Cerrar */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRequestClose}
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cerrar
              </Button>
            </div>
          </DialogHeader>

          {/* Cuerpo del Modal según el paso actual */}
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {/* PASO 1: Selección de Empleado */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    Paso 1: Selecciona el empleado
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Elige a la persona a la que se le autorizarán las horas extras.
                  </p>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre, cédula, cargo o departamento..."
                    className="pl-9 h-9 text-xs"
                    autoFocus
                  />
                </div>

                <div className="max-h-[320px] overflow-y-auto space-y-1.5 pr-1">
                  {filteredEmployees.map((emp) => {
                    const isSelected = selectedEmpId === emp.id
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => setSelectedEmpId(emp.id)}
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

                        {isSelected && (
                          <div className="size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                            ✓
                          </div>
                        )}
                      </button>
                    )
                  })}

                  {filteredEmployees.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      No se encontraron empleados coincidentes.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* PASO 2: Selección de Fecha y Horas con Referencia de Horario Regular */}
            {step === 2 && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    Paso 2: Fecha y Horas Autorizadas
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Define la fecha, el horario y el tipo de recargo a aplicar.
                  </p>
                </div>

                {/* Tarjeta de Referencia del Empleado y Horario Regular de la Fecha */}
                {selectedEmp && (
                  <div className="p-3 rounded-xl border bg-muted/20 space-y-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 ring-1 ring-border shrink-0">
                        <AvatarImage src={selectedEmp.avatar_url ?? undefined} alt={selectedEmp.full_name} />
                        <AvatarFallback className="text-[10px] font-semibold">
                          {getInitials(selectedEmp.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-semibold text-foreground">{selectedEmp.full_name}</span>
                        <span className="text-[11px] text-muted-foreground truncate">{selectedEmp.position || selectedEmp.department || 'Empleado'}</span>
                      </div>
                    </div>

                    {/* Referencia Visual del Horario Regular */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-card border text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CalendarIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="font-medium text-foreground">Horario habitual para esta fecha:</span>
                      </div>
                      <div>
                        {activeDaySchedule ? (
                          activeDaySchedule.is_workday ? (
                            <span className="font-mono font-semibold text-foreground bg-muted px-2 py-0.5 rounded text-[11px]">
                              {activeDaySchedule.start_time_1} - {activeDaySchedule.end_time_1}
                              {activeDaySchedule.has_split_shift && ` | ${activeDaySchedule.start_time_2} - ${activeDaySchedule.end_time_2}`}
                            </span>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-muted/50 text-muted-foreground font-mono">
                              Día Libre / Descanso
                            </Badge>
                          )
                        ) : (
                          <span className="text-muted-foreground text-[11px] italic">Sin horario asignado</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Toggle "Repetir": genera una solicitud independiente por cada
                    ocurrencia futura del día de semana elegido, en vez de una
                    sola fecha — ej. "Sábado" x 3 = próximos 3 sábados. */}
                <label
                  htmlFor="batch_mode"
                  className="flex items-center gap-2.5 p-3 rounded-xl border bg-muted/10 cursor-pointer select-none"
                >
                  <input
                    id="batch_mode"
                    type="checkbox"
                    checked={isBatchMode}
                    onChange={(e) => setIsBatchMode(e.target.checked)}
                    className="h-4 w-4 rounded border-input cursor-pointer accent-primary"
                  />
                  <div className="text-xs">
                    <span className="font-medium text-foreground">Repetir en varias fechas</span>
                    <p className="text-[11px] text-muted-foreground">
                      Genera una solicitud independiente por cada semana, para el mismo día y horario.
                    </p>
                  </div>
                </label>

                {isBatchMode ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                    <div className="space-y-1.5">
                      <Label htmlFor="batch_weekday" className="text-xs font-medium">
                        Día de la Semana *
                      </Label>
                      <select
                        id="batch_weekday"
                        value={batchWeekday}
                        onChange={(e) => setBatchWeekday(Number(e.target.value))}
                        className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-xs text-foreground focus:ring-1 focus:ring-ring cursor-pointer"
                      >
                        {WEEKDAY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="batch_count" className="text-xs font-medium">
                        Cantidad de Repeticiones *
                      </Label>
                      <Input
                        id="batch_count"
                        type="number"
                        min={1}
                        max={26}
                        value={batchCount}
                        onChange={(e) => setBatchCount(Math.max(1, Math.min(26, Number(e.target.value) || 1)))}
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1.5">
                      <Label className="text-xs font-medium">A partir de</Label>
                      <DatePicker
                        id="batch_start_date"
                        name="batch_start_date"
                        value={date}
                        onChange={(val) => setDate(val)}
                        placeholder="Seleccionar fecha de referencia"
                      />
                      {batchDates.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {batchDates.map((d) => (
                            <Badge key={d} variant="outline" className="text-[10px] font-mono bg-primary/5 border-primary/20 text-primary">
                              {formatLongDate(d)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="date" className="text-xs font-medium">
                      Fecha Autorizada *
                    </Label>
                    <DatePicker
                      id="date"
                      name="date"
                      value={date}
                      onChange={(val) => setDate(val)}
                      placeholder="Seleccionar fecha"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="overtime_type" className="text-xs font-medium">
                    Tipo de Recargo *
                  </Label>
                  <select
                    id="overtime_type"
                    value={overtimeType}
                    onChange={(e) => {
                      setOvertimeType(e.target.value as any)
                      setOvertimeTypeTouched(true)
                    }}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-xs text-foreground focus:ring-1 focus:ring-ring cursor-pointer"
                  >
                    <option value="suplementaria_50">Suplementaria (50% Recargo)</option>
                    <option value="extraordinaria_100">Extraordinaria (100% Feriados / Fines de Semana)</option>
                  </select>
                  {!overtimeTypeTouched && (
                    <p className="text-[10px] text-muted-foreground italic">
                      Sugerido automáticamente según el horario habitual{isHoliday ? ' y el feriado marcado' : ''}.
                      {isBatchMode && ' Se aplica igual a todas las fechas del lote.'}
                    </p>
                  )}
                </div>

                {/* Checkbox: Marcar la fecha como feriado (no existe calendario de feriados en el sistema) */}
                <label
                  htmlFor="is_holiday"
                  className="flex items-center gap-2.5 p-3 rounded-xl border bg-muted/10 cursor-pointer select-none"
                >
                  <input
                    id="is_holiday"
                    type="checkbox"
                    checked={isHoliday}
                    onChange={(e) => {
                      setIsHoliday(e.target.checked)
                      setHolidayTouched(true)
                    }}
                    className="h-4 w-4 rounded border-input cursor-pointer accent-primary"
                  />
                  <div className="text-xs">
                    <span className="font-medium text-foreground">Es día feriado</span>
                    <p className="text-[11px] text-muted-foreground">
                      {matchedHoliday
                        ? `Detectado automáticamente: ${matchedHoliday.name}.`
                        : 'Marca esta opción si la fecha autorizada corresponde a un feriado nacional o local.'}
                      {' '}Se sugerirá Extraordinaria (100%).
                    </p>
                  </div>
                </label>

                {/* Selectores de Horas usando TimePicker del UI Kit */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      Hora Desde (Inicio) *
                    </Label>
                    <TimePicker
                      value={startTime}
                      onChange={(t) => setStartTime(t)}
                      className="w-full h-9 text-xs justify-start"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      Hora Hasta (Fin) *
                    </Label>
                    <TimePicker
                      value={endTime}
                      onChange={(t) => setEndTime(t)}
                      className="w-full h-9 text-xs justify-start"
                    />
                  </div>
                </div>

                {/* Alerta si hay Solapamiento con la Jornada Regular */}
                {scheduleOverlapWarning ? (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs animate-in fade-in-50">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Conflicto de Horario detectado:</span>
                      <p className="mt-0.5 leading-relaxed">{scheduleOverlapWarning}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3.5 rounded-xl border bg-primary/5 border-primary/20">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                      <Clock className="h-4 w-4" />
                      <span>Total Horas Extras Calculadas:</span>
                    </div>
                    <span className="text-sm font-bold font-mono text-primary">
                      {calculatedHours} horas
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* PASO 3: Motivo & Justificación */}
            {step === 3 && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    Paso 3: Motivo y Justificación de la Actividad
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Describe las labores o motivos que justifiquen el tiempo extraordinario.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reason" className="text-xs font-medium">
                    Motivo de las Horas Extras *
                  </Label>
                  <textarea
                    id="reason"
                    rows={4}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ej. Apoyo en cierre contable y arqueo de fin de mes, atención por inventario general de bodega..."
                    className="w-full rounded-md border border-input bg-transparent p-3 text-xs text-foreground focus:ring-1 focus:ring-ring resize-none leading-relaxed"
                    required
                  />
                </div>

                {/* Resumen Final de la Solicitud */}
                <div className="rounded-xl border bg-card p-4 space-y-2.5 text-xs">
                  <h4 className="font-bold text-foreground flex items-center gap-1.5 border-b pb-2">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    {isBatchMode ? `Resumen de la Autorización (${batchDates.length} solicitudes)` : 'Resumen de la Autorización'}
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <div>Empleado: <span className="font-medium text-foreground">{selectedEmp?.full_name}</span></div>
                    {!isBatchMode && (
                      <div>Fecha Autorizada: <span className="font-medium text-foreground">{formatLongDate(date)}</span></div>
                    )}
                    <div>Jornada Extra: <span className="font-medium font-mono text-foreground">{startTime} a {endTime}</span></div>
                    <div>Duración por fecha: <span className="font-medium font-mono text-primary">{calculatedHours} horas</span></div>
                    <div className="col-span-2">Recargo: <span className="font-medium text-foreground">{overtimeType === 'suplementaria_50' ? '50% (Suplementaria)' : '100% (Extraordinaria)'}</span></div>
                    {isBatchMode && (
                      <div className="col-span-2">
                        <span>Fechas:</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {batchDates.map((d) => (
                            <Badge key={d} variant="outline" className="text-[10px] font-mono bg-primary/5 border-primary/20 text-primary">
                              {formatLongDate(d)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* PASO 4 (modo lote): Resultado de las N Solicitudes Generadas */}
            {step === 4 && isBatchMode && createdBatch.length > 0 && (
              <div className="space-y-5 animate-in fade-in-50 duration-200">
                {(() => {
                  const successCount = createdBatch.filter((b) => b.success).length
                  const allSucceeded = successCount === createdBatch.length
                  return (
                    <div
                      className={cn(
                        "flex items-center gap-3 p-3.5 rounded-xl border text-xs",
                        allSucceeded
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400"
                      )}
                    >
                      {allSucceeded ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                      )}
                      <div>
                        <span className="font-bold">
                          {successCount} de {createdBatch.length} solicitudes generadas
                        </span>
                        <p className="mt-0.5 opacity-90">
                          {allSucceeded
                            ? 'Todas se registraron como Pendiente de Aprobación.'
                            : 'Revisa las fechas que fallaron abajo; el resto ya quedó registrado.'}
                        </p>
                      </div>
                    </div>
                  )
                })()}

                <div className="rounded-xl border bg-card divide-y">
                  {createdBatch.map((entry) => (
                    <div key={entry.date} className="flex items-center justify-between p-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        {entry.success ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                        )}
                        <span className="font-medium text-foreground">{formatLongDate(entry.date)}</span>
                      </div>
                      {!entry.success && (
                        <span className="text-destructive text-[11px]">{entry.error}</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Empleado:</span> {selectedEmp?.full_name} ·{' '}
                  <span className="font-medium text-foreground">Horario:</span> {startTime} a {endTime} ({calculatedHours} horas c/u)
                </div>
              </div>
            )}

            {/* PASO 4 (individual): Solicitud Generada e Impresión */}
            {step === 4 && !isBatchMode && createdRequest && (
              <div className="space-y-5 animate-in fade-in-50 duration-200">
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold">¡Solicitud generada con éxito!</span>
                    <p className="mt-0.5 opacity-90">
                      Se registró en el listado de solicitudes como <strong>Pendiente de Aprobación</strong>.
                    </p>
                  </div>
                </div>

                {/* Formato Imprimible de Solicitud de Horas Extras */}
                <div className="p-6 rounded-xl border bg-card shadow-sm space-y-4 print:border-none print:p-0">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <h3 className="font-bold text-sm text-foreground uppercase tracking-wide">
                        {organizationName}
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Autorización de Horas Extras
                      </p>
                    </div>
                    <div className="text-right text-[11px] font-mono text-muted-foreground">
                      Emisión: {new Date().toLocaleDateString('es-EC')}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground text-[11px] block">Empleado:</span>
                      <span className="font-semibold text-foreground">{selectedEmp?.full_name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[11px] block">Cédula:</span>
                      <span className="font-mono text-foreground">{selectedEmp?.national_id || '—'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[11px] block">Cargo / Depto:</span>
                      <span className="text-foreground">{selectedEmp?.position || selectedEmp?.department || '—'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[11px] block">Fecha Autorizada:</span>
                      <span className="font-medium text-foreground">{formatLongDate(date)}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground text-[11px] block">Horario Autorizado:</span>
                      <span className="font-mono text-foreground font-semibold">
                        {startTime} a {endTime} ({calculatedHours} horas)
                      </span>
                    </div>
                  </div>

                  <div className="border-t pt-2 text-xs">
                    <span className="text-muted-foreground text-[11px] block mb-1">Motivo / Justificación:</span>
                    <p className="text-foreground italic bg-muted/30 p-2.5 rounded-lg border leading-relaxed">
                      "{reason}"
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer limpio con botones alineados a los extremos */}
          <div className="p-4 border-t bg-muted/10 flex items-center justify-between gap-3 shrink-0">
            {/* Botón Izquierdo: Anterior o Cancelar */}
            <div>
              {step > 1 && step < 4 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep((s) => (s - 1) as any)}
                  disabled={loading}
                  className="gap-1.5 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRequestClose}
                  className="cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  {step === 4 ? 'Cerrar' : 'Cancelar'}
                </Button>
              )}
            </div>

            {/* Botón Derecho: Siguiente / Guardar / Imprimir */}
            <div className="flex items-center gap-2">
              {step === 1 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setStep(2)}
                  disabled={!selectedEmpId}
                  className="gap-1.5 cursor-pointer font-medium"
                >
                  Siguiente: Horario
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}

              {step === 2 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setStep(3)}
                  disabled={
                    !date ||
                    !startTime ||
                    !endTime ||
                    calculatedHours <= 0 ||
                    Boolean(scheduleOverlapWarning) ||
                    (isBatchMode && batchDates.length === 0)
                  }
                  className="gap-1.5 cursor-pointer font-medium"
                >
                  Siguiente: Motivo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}

              {step === 3 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateRequest}
                  disabled={loading || !reason.trim()}
                  className="gap-1.5 cursor-pointer font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isBatchMode ? `Generando ${batchProgress}/${batchDates.length}...` : 'Generando...'}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      {isBatchMode ? `Generar ${batchDates.length} Solicitudes` : 'Generar Solicitud'}
                    </>
                  )}
                </Button>
              )}

              {step === 4 && !isBatchMode && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handlePrintDocument}
                  className="gap-2 cursor-pointer font-semibold"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir Solicitud
                </Button>
              )}
            </div>
          </div>

      {/* Modal de Confirmación para Evitar Cierre Accidental (sub-modal independiente, mantiene su propio Dialog) */}
      <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  ¿Descartar cambios de la solicitud?
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  Tienes datos ingresados en el asistente de horas extras. Si sales ahora, se perderá la información no guardada.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogFooter className="gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowConfirmClose(false)}
              className="cursor-pointer"
            >
              Continuar editando
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={forceClose}
              className="cursor-pointer border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 hover:text-rose-800 dark:hover:text-rose-300 hover:border-rose-300"
            >
              Descartar y salir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
