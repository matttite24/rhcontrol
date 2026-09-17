'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Employee,
  ShiftRequest,
  EmployeeSchedule,
  DayOfWeek,
  ScheduleDayChange,
  ScheduleChangeMetadata,
  Organization,
} from '@/types/employee'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { normalizeMinuteRange } from '@/lib/shifts/time'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import { Textarea } from '@/components/ui/textarea'
import {
  RefreshCw,
  Printer,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Plus,
  Trash2,
  Calendar,
  Clock,
  AlertCircle,
  X,
} from 'lucide-react'
import { printScheduleChangeDocument } from '@/lib/shifts/print-schedule-change'
import { createScheduleChangeAction } from '@/lib/shifts/actions'
import { getInitials, formatLongDate } from '@/lib/shifts/format'
import { EmployeePickerStep } from '@/components/shared/EmployeePickerStep'
import { pushRecentEmployeeId } from '@/lib/shifts/recent-employees'
import { cn } from '@/lib/utils'

interface EmployeeWithSchedule extends Employee {
  schedules?: EmployeeSchedule[]
}

interface ScheduleChangeWizardModalProps {
  organizationId: string
  organizationName?: string
  employees: EmployeeWithSchedule[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
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

/** Jornada ordinaria máxima por día según el Código del Trabajo del Ecuador. */
const MAX_WORK_MINUTES_PER_DAY = 8 * 60

/**
 * Minutos efectivos de trabajo del nuevo horario de un día (jornada simple o
 * dividida). Un día libre suma 0.
 */
function dayWorkMinutes(dc: ScheduleDayChange): number {
  if (!dc.is_workday) return 0
  const r1 = normalizeMinuteRange(dc.start_time_1 || '', dc.end_time_1 || '')
  let total = Math.max(0, r1.end - r1.start)
  if (dc.has_split_shift) {
    const r2 = normalizeMinuteRange(dc.start_time_2 || '', dc.end_time_2 || '')
    total += Math.max(0, r2.end - r2.start)
  }
  return total
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}


export function ScheduleChangeWizardModal({
  organizationId,
  organizationName,
  employees,
  open,
  onOpenChange,
  onSuccess,
  onRegisterRequestClose,
}: ScheduleChangeWizardModalProps) {
  const router = useRouter()
  const supabase = createClient()

  // Pasos: 1 = Empleado, 2 = Días y Horarios Temporales + Motivo, 3 = Documento Oficial & Éxito
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  // Datos del formulario
  const [selectedEmpId, setSelectedEmpId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [reason, setReason] = useState('')
  const [dayChanges, setDayChanges] = useState<ScheduleDayChange[]>([])
  const [createdRequest, setCreatedRequest] = useState<ShiftRequest | null>(null)

  // Horarios base del empleado
  const [employeeSchedules, setEmployeeSchedules] = useState<EmployeeSchedule[]>([])
  const [organization, setOrganization] = useState<Organization | null>(null)

  // Cargar organización para el documento oficial
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

    const cached = selectedEmp?.schedules
    if (cached && cached.length > 0) {
      setEmployeeSchedules(cached)
      return
    }

    async function loadSchedules() {
      const { data } = await supabase
        .from('employee_schedules')
        .select('*')
        .eq('employee_id', selectedEmpId)
        .order('day_order', { ascending: true })

      if (data) setEmployeeSchedules(data as EmployeeSchedule[])
    }
    loadSchedules()
  }, [selectedEmpId, selectedEmp, supabase])

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setStep(1)
      setSelectedEmpId('')
      setSearchQuery('')
      setReason('')
      setDayChanges([])
      setCreatedRequest(null)
    }
  }, [open])

  // Obtener horario original según fecha
  function getOriginalScheduleForDate(dateStr: string): { summary: string; schedule?: EmployeeSchedule } {
    if (!dateStr) return { summary: 'Sin horario' }
    const [y, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    const dayName = DAYS_OF_WEEK_MAP[dt.getDay()]
    const sch = employeeSchedules.find((s) => s.day_of_week === dayName)

    if (!sch || !sch.is_workday) {
      return { summary: `${dayName}: Descanso / No laborable`, schedule: sch }
    }

    if (sch.has_split_shift) {
      return {
        summary: `${dayName}: ${sch.start_time_1}-${sch.end_time_1} / ${sch.start_time_2}-${sch.end_time_2}`,
        schedule: sch,
      }
    }

    return {
      summary: `${dayName}: ${sch.start_time_1 || '08:00'} a ${sch.end_time_1 || '17:00'}`,
      schedule: sch,
    }
  }

  // Agregar un nuevo día de cambio
  function handleAddDay() {
    const today = new Date().toISOString().split('T')[0]
    const orig = getOriginalScheduleForDate(today)

    const newDay: ScheduleDayChange = {
      date: today,
      day_of_week: DAYS_OF_WEEK_MAP[new Date().getDay()],
      is_workday: true,
      has_split_shift: false,
      start_time_1: '08:00',
      end_time_1: '17:00',
      start_time_2: '14:00',
      end_time_2: '18:00',
      original_summary: orig.summary,
      new_summary: '08:00 a 17:00',
    }
    setDayChanges((prev) => [...prev, newDay])
  }

  // Modificar un día de cambio existente
  function handleUpdateDay(index: number, updates: Partial<ScheduleDayChange>) {
    setDayChanges((prev) => {
      const updated = [...prev]
      const current = { ...updated[index], ...updates }

      if (updates.date && updates.date !== updated[index].date) {
        const orig = getOriginalScheduleForDate(updates.date)
        const [y, m, d] = updates.date.split('-').map(Number)
        const dt = new Date(y, m - 1, d)
        current.day_of_week = DAYS_OF_WEEK_MAP[dt.getDay()]
        current.original_summary = orig.summary
      }

      if (!current.is_workday) {
        current.new_summary = 'Descanso / Libre'
      } else if (current.has_split_shift) {
        current.new_summary = `${current.start_time_1}-${current.end_time_1} / ${current.start_time_2}-${current.end_time_2}`
      } else {
        current.new_summary = `${current.start_time_1} a ${current.end_time_1}`
      }

      updated[index] = current
      return updated
    })
  }

  // Eliminar un día de cambio
  function handleRemoveDay(index: number) {
    setDayChanges((prev) => prev.filter((_, i) => i !== index))
  }

  // Días cuyo nuevo horario excede la jornada ordinaria de 8h.
  const daysOverLimit = useMemo(
    () =>
      dayChanges
        .map((dc, idx) => ({ idx, dc, minutes: dayWorkMinutes(dc) }))
        .filter((d) => d.minutes > MAX_WORK_MINUTES_PER_DAY),
    [dayChanges]
  )
  const hasDayOverLimit = daysOverLimit.length > 0

  // Crear la solicitud de cambio de horario
  async function handleCreateScheduleChange() {
    if (!selectedEmp || dayChanges.length === 0) return

    if (hasDayOverLimit) {
      const nums = daysOverLimit.map((d) => `#${d.idx + 1}`).join(', ')
      toast.error(
        `El nuevo horario del/de los día(s) ${nums} supera la jornada ordinaria de 8 horas. Ajusta las horas o registra el excedente como horas extras.`
      )
      return
    }

    setLoading(true)

    try {
      const targetOrgId = organizationId || selectedEmp.organization_id || ''
      if (!targetOrgId) {
        toast.error('No se detectó la organización activa.')
        return
      }

      const firstDate = dayChanges[0].date
      const title = `Cambio Temporal de Horario: ${dayChanges.length} día(s)`

      const metadata: ScheduleChangeMetadata = {
        employee_id: selectedEmp.id,
        employee_name: selectedEmp.full_name,
        national_id: selectedEmp.national_id ?? undefined,
        department: selectedEmp.department ?? undefined,
        position: selectedEmp.position ?? undefined,
        days_count: dayChanges.length,
        day_changes: dayChanges,
        reason: reason.trim(),
        sub_type: 'cambio_horario',
      }

      const res = await createScheduleChangeAction({
        organizationId: targetOrgId,
        employeeId: selectedEmp.id,
        title,
        reason: reason.trim(),
        date: firstDate,
        metadata,
      })

      if (!res.success || !res.data) {
        throw new Error(res.error || 'No se pudo guardar la solicitud')
      }

      setCreatedRequest(res.data)
      setStep(3)
      toast.success('Cambio de horario registrado como Pendiente de Aprobación.')
      if (onSuccess) onSuccess()
      router.refresh()
    } catch (err: any) {
      console.error('Error al registrar cambio de horario:', err)
      toast.error(err.message || 'Error al guardar la solicitud')
    } finally {
      setLoading(false)
    }
  }

  function handlePrintDocument() {
    if (!selectedEmp) return
    printScheduleChangeDocument({
      organization,
      organizationName,
      employeeName: selectedEmp.full_name,
      nationalId: selectedEmp.national_id || '',
      department: selectedEmp.department || '',
      position: selectedEmp.position || '',
      date: dayChanges[0]?.date || new Date().toISOString().split('T')[0],
      reason: reason.trim() || 'Cambio temporal de jornada laboral acordado.',
      dayChanges,
      status: createdRequest?.status || 'pendiente',
    })
  }

  function handleRequestClose() {
    if (step === 2 && (dayChanges.length > 0 || reason.trim())) {
      setShowConfirmClose(true)
    } else {
      onOpenChange(false)
    }
  }

  // Publicar handleRequestClose hacia el padre para que Escape/click-fuera
  // en el Dialog raíz compartido respeten esta misma confirmación.
  useEffect(() => {
    onRegisterRequestClose?.(handleRequestClose)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, dayChanges, reason])

  return (
    <>
      <div
        className={cn(
          'flex flex-col flex-1 min-h-0 transition-[filter] duration-200 ease-out motion-reduce:transition-none',
          showConfirmClose && 'blur-[6px] pointer-events-none'
        )}
      >
      {/* El <DialogContent> único vive en el launcher. Ver OvertimeWizardModal. */}
          {/* Cabecera del Wizard */}
          <DialogHeader className="p-5 pb-4 border-b bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <RefreshCw className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Solicitud de Cambio de Horario
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Paso {step} de 3 • {step === 1 ? 'Empleado' : step === 2 ? 'Días y Nuevos Horarios' : 'Documento Oficial'}
                  </DialogDescription>
                </div>
              </div>

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

          {/* Cuerpo del Wizard */}
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {/* PASO 1: Selección de Empleado */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    Paso 1: Selecciona el empleado
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Elige al empleado al que se le aplicará la modificación temporal de turnos.
                  </p>
                </div>

                <EmployeePickerStep
                  employees={employees}
                  selectedEmployeeId={selectedEmpId}
                  onSelect={(id) => {
                    setSelectedEmpId(id)
                    pushRecentEmployeeId(id)
                  }}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                />
              </div>
            )}

            {/* PASO 2: Días a Modificar, Horarios Temporales y Motivo */}
            {step === 2 && selectedEmp && (
              <div className="space-y-5 animate-in fade-in-50 duration-200">
                {/* Resumen del Empleado */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar className="h-8 w-8 ring-1 ring-border shrink-0">
                      <AvatarImage src={selectedEmp.avatar_url ?? undefined} alt={selectedEmp.full_name} />
                      <AvatarFallback className="text-[10px] font-bold">
                        {getInitials(selectedEmp.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{selectedEmp.full_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        CI: {selectedEmp.national_id || '—'} • {selectedEmp.position || 'Empleado'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                    Cambio Temporal
                  </Badge>
                </div>

                {/* Lista de Días a Cambiar */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold text-foreground">
                        Días que cambiarán de horario
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Solo afectarán las fechas específicas seleccionadas.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddDay}
                      className="gap-1.5 text-xs h-8 cursor-pointer border-blue-200 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Añadir Día
                    </Button>
                  </div>

                  {dayChanges.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed text-center bg-muted/20 space-y-2">
                      <Calendar className="h-7 w-7 text-muted-foreground mx-auto" />
                      <p className="text-xs text-muted-foreground">
                        Aún no has añadido días para el cambio temporal.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={handleAddDay}
                        className="text-xs gap-1.5 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Añadir el primer día
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {dayChanges.map((dc, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl border bg-card/80 space-y-3 transition-all"
                        >
                          <div className="flex items-center justify-between gap-2 border-b pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                                Día #{idx + 1}
                              </span>
                              <span className="text-xs font-medium text-foreground">
                                {formatLongDate(dc.date)}
                              </span>
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveDay(idx)}
                              className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                              title="Eliminar este día"
                              aria-label="Eliminar este día"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            {/* Fecha */}
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Fecha a modificar</Label>
                              <DatePicker
                                name={`date_change_${idx}`}
                                value={dc.date}
                                onChange={(d) => handleUpdateDay(idx, { date: d })}
                                className="w-full text-xs h-8"
                              />
                            </div>

                            {/* Horario Habitual (Referencia) */}
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Horario Habitual Registrado</Label>
                              <div className="h-8 px-2.5 rounded-md border bg-muted/40 flex items-center text-[11px] text-muted-foreground truncate">
                                {dc.original_summary || 'Horario Regular'}
                              </div>
                            </div>
                          </div>

                          {/* Tipo de jornada temporal */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg bg-muted/30 border text-xs gap-2">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={dc.is_workday}
                                onChange={(e) =>
                                  handleUpdateDay(idx, { is_workday: e.target.checked })
                                }
                                className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              <span className="text-xs font-medium text-foreground">
                                {dc.is_workday ? 'Día Laborable (Se asigna nuevo horario)' : 'Día Libre / Descanso Temporal'}
                              </span>
                            </label>

                            {dc.is_workday && (
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={dc.has_split_shift}
                                  onChange={(e) =>
                                    handleUpdateDay(idx, { has_split_shift: e.target.checked })
                                  }
                                  className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span className="text-[11px] text-muted-foreground">
                                  Jornada Dividida
                                </span>
                              </label>
                            )}
                          </div>

                          {/* Horarios Nuevos si es laborable */}
                          {dc.is_workday && (
                            <div className="space-y-2 pt-1">
                              {!dc.has_split_shift ? (
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Hora Entrada</Label>
                                    <TimePicker
                                      value={dc.start_time_1}
                                      onChange={(val) => handleUpdateDay(idx, { start_time_1: val })}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Hora Salida</Label>
                                    <TimePicker
                                      value={dc.end_time_1}
                                      onChange={(val) => handleUpdateDay(idx, { end_time_1: val })}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">1ª Entrada</Label>
                                    <TimePicker
                                      value={dc.start_time_1}
                                      onChange={(val) => handleUpdateDay(idx, { start_time_1: val })}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">1ª Salida</Label>
                                    <TimePicker
                                      value={dc.end_time_1}
                                      onChange={(val) => handleUpdateDay(idx, { end_time_1: val })}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">2ª Entrada</Label>
                                    <TimePicker
                                      value={dc.start_time_2 || '14:00'}
                                      onChange={(val) => handleUpdateDay(idx, { start_time_2: val })}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">2ª Salida</Label>
                                    <TimePicker
                                      value={dc.end_time_2 || '18:00'}
                                      onChange={(val) => handleUpdateDay(idx, { end_time_2: val })}
                                    />
                                  </div>
                                </div>
                              )}

                              {(() => {
                                const mins = dayWorkMinutes(dc)
                                const over = mins > MAX_WORK_MINUTES_PER_DAY
                                return (
                                  <div
                                    className={cn(
                                      'flex items-center gap-1.5 text-[11px] pt-0.5',
                                      over
                                        ? 'text-destructive font-medium'
                                        : 'text-muted-foreground'
                                    )}
                                  >
                                    {over && <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                                    <span>
                                      Jornada del día: <strong>{formatMinutes(mins)}</strong>
                                      {over && ' — supera el máximo legal de 8h'}
                                    </span>
                                  </div>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {hasDayOverLimit && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        El nuevo horario de {daysOverLimit.length === 1 ? 'un día' : `${daysOverLimit.length} días`} excede la jornada ordinaria de <strong>8 horas</strong> (Código del Trabajo del Ecuador). Ajusta las horas de entrada/salida; el tiempo adicional debe registrarse como <strong>horas extras</strong>, no como cambio de horario.
                      </span>
                    </div>
                  )}
                </div>

                {/* Motivo / Justificación */}
                <div className="space-y-1.5 pt-2 border-t">
                  <Label className="text-xs font-semibold text-foreground">
                    Motivo o Justificación del Cambio Temporal <span className="text-rose-500">*</span>
                  </Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ejemplo: Necesidad operativa por inventario de almacén, apoyo en evento especial o requerimiento de producción..."
                    className="text-xs min-h-[75px] resize-none"
                  />
                </div>
              </div>
            )}

            {/* PASO 3: Éxito & Documento Oficial Imprimible */}
            {step === 3 && createdRequest && selectedEmp && (
              <div className="space-y-5 animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                  <div className="p-3 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">
                    ¡Solicitud de Cambio de Horario Registrada!
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md">
                    La solicitud ha sido creada con estado <strong>Pendiente de Aprobación</strong>. Se ha generado el documento oficial con membrete y firmas listo para imprimir.
                  </p>
                </div>

                {/* Resumen del documento generado */}
                <div className="p-4 rounded-xl border bg-card space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground font-medium">Empleado:</span>
                    <span className="font-bold text-foreground">{selectedEmp.full_name}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground font-medium">Días Temporales:</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono">
                      {dayChanges.length} día(s) seleccionado(s)
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground font-medium">Estado:</span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Pendiente
                    </Badge>
                  </div>
                  <div className="space-y-1 pt-1">
                    <span className="text-muted-foreground font-medium block">Motivo Declarado:</span>
                    <p className="p-2.5 rounded-lg bg-muted/40 italic text-foreground">
                      "{reason}"
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer de Navegación del Wizard */}
          <div className="p-4 border-t bg-muted/10 flex items-center justify-between shrink-0">
            {step === 1 ? (
              <div />
            ) : step === 2 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep(1)}
                className="gap-1 text-xs cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
                Atrás
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs cursor-pointer"
              >
                Cerrar
              </Button>
            )}

            <div className="flex items-center gap-2">
              {step === 1 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (dayChanges.length === 0) {
                      handleAddDay()
                    }
                    setStep(2)
                  }}
                  disabled={!selectedEmpId}
                  className="gap-1 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  Continuar
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}

              {step === 2 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateScheduleChange}
                  disabled={loading || dayChanges.length === 0 || !reason.trim() || hasDayOverLimit}
                  className="gap-1.5 cursor-pointer font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Generar Solicitud
                    </>
                  )}
                </Button>
              )}

              {step === 3 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handlePrintDocument}
                  className="gap-2 cursor-pointer font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir Formato
                </Button>
              )}
            </div>
          </div>

      </div>

      {/* Modal confirmación de cierre accidental (sub-modal independiente, mantiene su propio Dialog) */}
      <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-500/10 text-amber-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <DialogTitle className="text-base font-bold">¿Descartar cambios?</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-2">
              Hay información de días u horarios ingresados. Si sales ahora se perderán los datos.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirmClose(false)}
              className="text-xs cursor-pointer"
            >
              Continuar editando
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowConfirmClose(false)
                onOpenChange(false)
              }}
              className="text-xs cursor-pointer border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 hover:text-rose-800 dark:hover:text-rose-300 hover:border-rose-300"
            >
              Descartar y salir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
