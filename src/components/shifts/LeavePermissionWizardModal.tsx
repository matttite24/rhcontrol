'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Employee,
  ShiftRequest,
  LeaveUnit,
  LeaveRecoveryMethod,
  LeaveRecoverySchedule,
  LeaveIncidentMetadata,
  Organization,
} from '@/types/employee'
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
  CalendarOff,
  Clock,
  Printer,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Search,
  FileText,
  AlertTriangle,
  Palmtree,
  DollarSign,
  Calendar,
  Users,
  Plus,
  Trash2,
} from 'lucide-react'
import { printLeavePermissionDocument } from '@/lib/shifts/print-leave-permission'
import { createLeavePermissionAction, getEmployeeVacationBalanceAction } from '@/lib/shifts/actions'
import { getInitials, formatLongDate } from '@/lib/shifts/format'
import { normalizeMinuteRange } from '@/lib/shifts/time'
import { cn } from '@/lib/utils'

/** Suma `days` días a una fecha ISO (YYYY-MM-DD) sin problemas de zona horaria. */
function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${mm}-${dd}`
}

interface LeavePermissionWizardModalProps {
  organizationId: string
  organizationName?: string
  employees: Employee[]
  // El <Dialog> raíz vive en el launcher (NewShiftRequestButton). Ver
  // OvertimeWizardModal para la explicación completa.
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  onRegisterRequestClose?: (fn: () => void) => void
}


export function LeavePermissionWizardModal({
  organizationId,
  organizationName = 'RH Garden',
  employees,
  onOpenChange,
  onSuccess,
  onRegisterRequestClose,
}: LeavePermissionWizardModalProps) {
  const router = useRouter()
  const supabase = createClient()

  // Pasos: 1 = Empleado, 2 = Tiempo del permiso, 3 = Mecanismo de recuperación y motivo, 4 = Imprimir / Concluido
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [loading, setLoading] = useState(false)
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  // Paso 1: Empleado
  const [selectedEmpId, setSelectedEmpId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  // Balance de vacaciones del empleado seleccionado
  const [vacationBalance, setVacationBalance] = useState<{
    availableDays: number
    /** Días proporcionales acumulados a la fecha (= totalLawDays por compat). */
    totalLawDays: number
    usedDays: number
    /** Días anuales por ley según antigüedad (15..30). */
    annualLawDays: number
    monthsInPeriod: number
    hasCompletedFirstYear: boolean
    loading: boolean
    error?: string
  }>({
    availableDays: 0,
    totalLawDays: 0,
    usedDays: 0,
    annualLawDays: 0,
    monthsInPeriod: 0,
    hasCompletedFirstYear: false,
    loading: false,
  })

  // Paso 2: Tiempo
  const [leaveUnit, setLeaveUnit] = useState<LeaveUnit>('dias')
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0])
  // "Fecha Fin (Retorno)" = día de reincorporación → mínimo inicio + 1.
  const [endDate, setEndDate] = useState<string>(addDaysISO(new Date().toISOString().split('T')[0], 1))
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('12:00')

  // Paso 3: Recuperación y justificación
  const [recoveryMethod, setRecoveryMethod] = useState<LeaveRecoveryMethod>('cargo_vacaciones')
  const [recoverySchedules, setRecoverySchedules] = useState<LeaveRecoverySchedule[]>([])
  const [replacementEmployeeId, setReplacementEmployeeId] = useState<string>('')
  const [reason, setReason] = useState('')

  // Datos guardados
  const [createdRequest, setCreatedRequest] = useState<ShiftRequest | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)

  // Cargar organización para impresión
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

  // Empleado solicitante seleccionado
  const selectedEmp = useMemo(
    () => employees.find((e) => e.id === selectedEmpId),
    [employees, selectedEmpId]
  )

  // Empleado reemplazo
  const replacementEmp = useMemo(
    () => employees.find((e) => e.id === replacementEmployeeId),
    [employees, replacementEmployeeId]
  )

  // Empleados filtrados en paso 1
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

  // Cálculo de días solicitados.
  // "Fecha Fin (Retorno)" es el día de reincorporación, así que los días de
  // ausencia son (retorno − inicio), no (fin − inicio + 1).
  const calculatedDays = useMemo(() => {
    if (leaveUnit !== 'dias') return 1
    if (!startDate || !endDate) return 1
    const d1 = new Date(startDate).getTime()
    const d2 = new Date(endDate).getTime()
    if (d2 <= d1) return 1
    const diffTime = d2 - d1
    const days = Math.round(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(1, days)
  }, [leaveUnit, startDate, endDate])

  // Cálculo de horas solicitadas
  const calculatedHours = useMemo(() => {
    if (leaveUnit !== 'horas') return 0
    if (!startTime || !endTime) return 0
    const { start: t1, end: t2 } = normalizeMinuteRange(startTime, endTime)
    const diff = (t2 - t1) / 60
    return Number(diff.toFixed(2))
  }, [leaveUnit, startTime, endTime])

  // Total de horas en el cronograma de recuperación
  const totalRecoveryHours = useMemo(() => {
    return Number(
      recoverySchedules.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0).toFixed(2)
    )
  }, [recoverySchedules])

  const EMPTY_BALANCE = {
    availableDays: 0,
    totalLawDays: 0,
    usedDays: 0,
    annualLawDays: 0,
    monthsInPeriod: 0,
    hasCompletedFirstYear: false,
    loading: false,
  }

  // Cargar balance de vacaciones del empleado seleccionado
  useEffect(() => {
    if (!selectedEmpId) {
      setVacationBalance(EMPTY_BALANCE)
      return
    }

    let isMounted = true
    setVacationBalance((prev) => ({ ...prev, loading: true, error: undefined }))

    getEmployeeVacationBalanceAction(selectedEmpId)
      .then((res) => {
        if (!isMounted) return
        if (res.success) {
          setVacationBalance({
            availableDays: res.availableDays,
            totalLawDays: res.totalLawDays,
            usedDays: res.usedDays,
            annualLawDays: res.annualLawDays,
            monthsInPeriod: res.monthsInPeriod,
            hasCompletedFirstYear: res.hasCompletedFirstYear,
            loading: false,
          })
        } else {
          setVacationBalance({ ...EMPTY_BALANCE, error: res.error })
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setVacationBalance({ ...EMPTY_BALANCE, error: err.message })
      })

    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmpId])

  // Reset del asistente
  function handleReset() {
    setStep(1)
    setSelectedEmpId('')
    setSearchQuery('')
    setVacationBalance(EMPTY_BALANCE)
    setLeaveUnit('dias')
    const today = new Date().toISOString().split('T')[0]
    setStartDate(today)
    setEndDate(addDaysISO(today, 1))
    setStartTime('08:00')
    setEndTime('12:00')
    setRecoveryMethod('cargo_vacaciones')
    setRecoverySchedules([])
    setReplacementEmployeeId('')
    setReason('')
    setCreatedRequest(null)
  }

  function handleRequestClose() {
    if (selectedEmpId || reason.trim() || step > 1) {
      if (step === 4) {
        handleReset()
        onOpenChange(false)
      } else {
        setShowConfirmClose(true)
      }
    } else {
      handleReset()
      onOpenChange(false)
    }
  }

  // Publicar handleRequestClose hacia el padre para que Escape/click-fuera
  // en el Dialog raíz compartido respeten esta misma confirmación.
  useEffect(() => {
    onRegisterRequestClose?.(handleRequestClose)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmpId, reason, step])

  function forceClose() {
    setShowConfirmClose(false)
    handleReset()
    onOpenChange(false)
  }

  // Agregar fila al cronograma de recuperación
  function handleAddRecoverySchedule() {
    const nextDate = startDate || new Date().toISOString().split('T')[0]
    setRecoverySchedules((prev) => [
      ...prev,
      {
        date: nextDate,
        start_time: '18:00',
        end_time: '20:00',
        hours: 2,
      },
    ])
  }

  // Eliminar fila de recuperación
  function handleRemoveRecoverySchedule(index: number) {
    setRecoverySchedules((prev) => prev.filter((_, i) => i !== index))
  }

  // Modificar fila de recuperación
  function handleUpdateRecoverySchedule(
    index: number,
    field: keyof LeaveRecoverySchedule,
    value: any
  ) {
    setRecoverySchedules((prev) => {
      const next = [...prev]
      const row = { ...next[index], [field]: value }
      if (field === 'start_time' || field === 'end_time') {
        const { start: t1, end: t2 } = normalizeMinuteRange(row.start_time, row.end_time)
        row.hours = Number(((t2 - t1) / 60).toFixed(2))
      }
      next[index] = row
      return next
    })
  }

  // Guardar incidencia de Permiso Laboral
  async function handleCreateIncident() {
    if (!selectedEmpId || !selectedEmp) {
      toast.error('Selecciona un empleado.')
      return
    }

    if (!reason.trim()) {
      toast.error('Ingresa el motivo del permiso.')
      return
    }

    if (recoveryMethod === 'reemplazo_personal' && !replacementEmployeeId) {
      toast.error('Selecciona al empleado que realizará el reemplazo.')
      return
    }

    if (recoveryMethod === 'cargo_vacaciones') {
      const requestedEquivDays = leaveUnit === 'horas' ? calculatedHours / 8 : calculatedDays
      if (!vacationBalance.loading && requestedEquivDays > vacationBalance.availableDays) {
        toast.error(
          `Saldo insuficiente: El empleado solo dispone de ${vacationBalance.availableDays} día(s) de vacaciones, y el permiso requiere ${requestedEquivDays} día(s).`
        )
        return
      }
    }

    setLoading(true)

    try {
      const title =
        leaveUnit === 'dias'
          ? `Permiso Laboral: ${calculatedDays} día(s) (${startDate})`
          : `Permiso Laboral: ${calculatedHours} hora(s) (${startDate})`

      const metadata: LeaveIncidentMetadata = {
        leave_unit: leaveUnit,
        requested_days: leaveUnit === 'dias' ? calculatedDays : undefined,
        start_date: startDate,
        end_date: leaveUnit === 'dias' ? endDate : undefined,
        date: startDate,
        start_time: leaveUnit === 'horas' ? startTime : undefined,
        end_time: leaveUnit === 'horas' ? endTime : undefined,
        requested_hours: leaveUnit === 'horas' ? calculatedHours : undefined,
        recovery_method: recoveryMethod,
        recovery_schedules: recoveryMethod === 'recuperacion_dias' ? recoverySchedules : undefined,
        replacement_employee_id:
          recoveryMethod === 'reemplazo_personal' ? replacementEmployeeId : undefined,
        replacement_employee_name:
          recoveryMethod === 'reemplazo_personal' ? replacementEmp?.full_name : undefined,
      }

      const targetOrgId = organizationId || selectedEmp?.organization_id || ''
      if (!targetOrgId) {
        toast.error('No se detectó la empresa activa para este empleado.')
        return
      }

      const res = await createLeavePermissionAction({
        organizationId: targetOrgId,
        employeeId: selectedEmpId,
        title,
        reason: reason.trim(),
        date: startDate,
        startTime: leaveUnit === 'horas' ? startTime : '08:00',
        endTime: leaveUnit === 'horas' ? endTime : '17:00',
        hours: leaveUnit === 'horas' ? calculatedHours : calculatedDays * 8,
        metadata,
      })

      if (!res.success || !res.data) {
        throw new Error(res.error || 'Error al guardar la solicitud de permiso laboral')
      }

      setCreatedRequest(res.data)
      setStep(4)
      toast.success('Permiso laboral registrado como Pendiente de Aprobación en Control de Asistencia.')
      if (onSuccess) onSuccess()
      router.refresh()
    } catch (err: any) {
      console.error('Error al registrar permiso laboral:', err)
      toast.error(err.message || 'No se pudo guardar la solicitud de permiso')
    } finally {
      setLoading(false)
    }
  }

  // Imprimir documento oficial de permiso
  function handlePrintDocument() {
    printLeavePermissionDocument({
      organization: organization || { name: organizationName },
      organizationName,
      employeeName: selectedEmp?.full_name || 'Empleado',
      nationalId: selectedEmp?.national_id || '',
      department: selectedEmp?.department || '',
      position: selectedEmp?.position || '',
      leaveUnit,
      startDate,
      endDate: leaveUnit === 'dias' ? endDate : undefined,
      daysCount: calculatedDays,
      hoursCount: calculatedHours,
      startTime: leaveUnit === 'horas' ? startTime : undefined,
      endTime: leaveUnit === 'horas' ? endTime : undefined,
      reason: reason.trim(),
      recoveryMethod,
      recoverySchedules: recoveryMethod === 'recuperacion_dias' ? recoverySchedules : undefined,
      replacementEmployeeName:
        recoveryMethod === 'reemplazo_personal' ? replacementEmp?.full_name : undefined,
    })
  }

  return (
    <>
      {/* El <DialogContent> único vive en el launcher. Ver OvertimeWizardModal. */}
          {/* Cabecera del Wizard */}
          <DialogHeader className="p-5 pb-4 border-b bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                  <CalendarOff className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Asistente de Permiso Laboral
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Registro y autorización de ausencias por días u horas
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

          {/* Cuerpo interactivo del Wizard */}
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {/* PASO 1: Selección de Empleado */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    Paso 1: Selecciona el empleado
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Elige al empleado que requiere el permiso laboral.
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
                            ? "bg-cyan-500/10 border-cyan-500 text-foreground ring-1 ring-cyan-500/30"
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
                          <div className="size-5 rounded-full bg-cyan-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                            ✓
                          </div>
                        )}
                      </button>
                    )
                  })}

                  {filteredEmployees.length === 0 && (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      No se encontraron empleados coincidentes.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PASO 2: Duración / Tiempo del Permiso */}
            {step === 2 && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    Paso 2: Tiempo del Permiso
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Define si la ausencia es por días completos o por tramo de horas.
                  </p>
                </div>

                {/* Switch Días vs Horas */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-xl border">
                  <button
                    type="button"
                    onClick={() => setLeaveUnit('dias')}
                    className={cn(
                      "py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2",
                      leaveUnit === 'dias'
                        ? "bg-background text-foreground shadow-xs border"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Día(s) Completo(s)
                  </button>

                  <button
                    type="button"
                    onClick={() => setLeaveUnit('horas')}
                    className={cn(
                      "py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2",
                      leaveUnit === 'horas'
                        ? "bg-background text-foreground shadow-xs border"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    Por Horas / Fracción de Jornada
                  </button>
                </div>

                {/* Formulario si es por Días */}
                {leaveUnit === 'dias' ? (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="start_date" className="text-xs font-medium">
                          Fecha Inicio *
                        </Label>
                        <DatePicker
                          id="start_date"
                          name="start_date"
                          value={startDate}
                          onChange={(v) => {
                            setStartDate(v)
                            // El retorno debe ser al menos el día siguiente al inicio.
                            if (new Date(endDate) <= new Date(v)) {
                              setEndDate(addDaysISO(v, 1))
                            }
                          }}
                          placeholder="Seleccionar inicio"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="end_date" className="text-xs font-medium">
                          Fecha de Reincorporación *
                        </Label>
                        <DatePicker
                          id="end_date"
                          name="end_date"
                          value={endDate}
                          minDate={addDaysISO(startDate, 1)}
                          onChange={(v) => setEndDate(v)}
                          placeholder="Seleccionar retorno"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border bg-cyan-500/5 border-cyan-500/20 text-xs">
                      <span className="text-muted-foreground">Total de días solicitados:</span>
                      <span className="font-bold text-cyan-600 dark:text-cyan-400 font-mono text-sm">
                        {calculatedDays} {calculatedDays === 1 ? 'día' : 'días'}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Formulario si es por Horas */
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="leave_date" className="text-xs font-medium">
                        Fecha del Permiso *
                      </Label>
                      <DatePicker
                        id="leave_date"
                        name="leave_date"
                        value={startDate}
                        onChange={(v) => {
                          setStartDate(v)
                          setEndDate(v)
                        }}
                        placeholder="Seleccionar fecha"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Hora Desde (Salida) *</Label>
                        <TimePicker
                          value={startTime}
                          onChange={(t) => setStartTime(t)}
                          className="w-full h-9 text-xs justify-start"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Hora Hasta (Retorno) *</Label>
                        <TimePicker
                          value={endTime}
                          onChange={(t) => setEndTime(t)}
                          className="w-full h-9 text-xs justify-start"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border bg-cyan-500/5 border-cyan-500/20 text-xs">
                      <span className="text-muted-foreground">Total de horas calculadas:</span>
                      <span className="font-bold text-cyan-600 dark:text-cyan-400 font-mono text-sm">
                        {calculatedHours} horas
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PASO 3: Mecanismo de Recuperación y Motivo */}
            {step === 3 && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    Paso 3: Mecanismo de Recuperación y Motivo
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    ¿Cómo se compensará o cubrirá este permiso laboral?
                  </p>
                </div>

                {/* 4 Opciones de Recuperación */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Opción A: Cargo a vacaciones */}
                  <button
                    type="button"
                    onClick={() => setRecoveryMethod('cargo_vacaciones')}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1",
                      recoveryMethod === 'cargo_vacaciones'
                        ? "bg-emerald-500/10 border-emerald-500 text-foreground ring-1 ring-emerald-500/30"
                        : "bg-card hover:bg-muted/40 border-border/60"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Palmtree className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-bold text-foreground">Cargo a vacaciones</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Se descuenta del saldo de vacaciones anuales acumuladas.
                    </p>
                  </button>

                  {/* Opción B: Descuento en día de trabajo */}
                  <button
                    type="button"
                    onClick={() => setRecoveryMethod('descuento_dia')}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1",
                      recoveryMethod === 'descuento_dia'
                        ? "bg-amber-500/10 border-amber-500 text-foreground ring-1 ring-amber-500/30"
                        : "bg-card hover:bg-muted/40 border-border/60"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-bold text-foreground">Descuento en día de trabajo</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Genera deducción salarial en el siguiente rol de pagos.
                    </p>
                  </button>

                  {/* Opción C: Recuperación con otros días */}
                  <button
                    type="button"
                    onClick={() => setRecoveryMethod('recuperacion_dias')}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1",
                      recoveryMethod === 'recuperacion_dias'
                        ? "bg-blue-500/10 border-blue-500 text-foreground ring-1 ring-blue-500/30"
                        : "bg-card hover:bg-muted/40 border-border/60"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-bold text-foreground">Recuperación con otros días</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Ingreso de fechas y turnos en que se repondrá el tiempo.
                    </p>
                  </button>

                  {/* Opción D: Será reemplazado por alguien */}
                  <button
                    type="button"
                    onClick={() => setRecoveryMethod('reemplazo_personal')}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1",
                      recoveryMethod === 'reemplazo_personal'
                        ? "bg-purple-500/10 border-purple-500 text-foreground ring-1 ring-purple-500/30"
                        : "bg-card hover:bg-muted/40 border-border/60"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-xs font-bold text-foreground">Reemplazado por alguien</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Un compañero cubrirá sus actividades durante la ausencia.
                    </p>
                  </button>
                </div>

                {/* Bloque dinámico según el método elegido */}
                {recoveryMethod === 'cargo_vacaciones' && (
                  <div className={cn(
                    "p-3.5 rounded-xl border space-y-1.5 transition-all",
                    vacationBalance.loading
                      ? "bg-muted/30 border-border/50 text-muted-foreground"
                      : (leaveUnit === 'horas' ? calculatedHours / 8 : calculatedDays) > vacationBalance.availableDays
                      ? "bg-destructive/10 border-destructive/30 text-destructive dark:text-destructive-foreground"
                      : "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                  )}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold flex items-center gap-1.5">
                        <Palmtree className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        Disponibilidad de Vacaciones
                      </span>
                      {vacationBalance.loading ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Verificando saldo...
                        </span>
                      ) : (
                        <span className="text-xs font-mono font-bold">
                          {vacationBalance.availableDays} día(s) disponibles
                        </span>
                      )}
                    </div>
                    {!vacationBalance.loading && (
                      <>
                        <p className="text-[11px] leading-relaxed opacity-80">
                          {vacationBalance.hasCompletedFirstYear ? (
                            <>
                              Derecho anual: <strong>{vacationBalance.annualLawDays} días</strong>.
                              Acumulados en el período vigente ({vacationBalance.monthsInPeriod} mes(es)):{' '}
                              <strong>{vacationBalance.totalLawDays}</strong>. Ya usados:{' '}
                              <strong>{vacationBalance.usedDays}</strong>.
                            </>
                          ) : (
                            <>
                              El colaborador aún no cumple 1 año. Vacaciones{' '}
                              <strong>proporcionales</strong> acumuladas a la fecha (
                              {vacationBalance.monthsInPeriod} mes(es) × {vacationBalance.annualLawDays}/12):{' '}
                              <strong>{vacationBalance.totalLawDays} día(s)</strong>. Ya usados:{' '}
                              <strong>{vacationBalance.usedDays}</strong>. Permitido por mutuo acuerdo
                              (Art. 69, Código del Trabajo).
                            </>
                          )}
                        </p>
                        <p className="text-[11px] leading-relaxed opacity-90">
                          {(leaveUnit === 'horas' ? calculatedHours / 8 : calculatedDays) > vacationBalance.availableDays ? (
                            <span className="font-semibold text-destructive">
                              ⚠️ Atención: El permiso requiere {leaveUnit === 'horas' ? `${calculatedHours}h (~${(calculatedHours / 8).toFixed(2)} días)` : `${calculatedDays} día(s)`}, pero el empleado solo tiene {vacationBalance.availableDays} día(s) disponibles.
                            </span>
                          ) : (
                            <span>
                              Se descontarán <strong>{leaveUnit === 'horas' ? `${(calculatedHours / 8).toFixed(2)} día(s) (${calculatedHours}h)` : `${calculatedDays} día(s)`}</strong> del saldo de vacaciones del empleado al registrar o aprobar este permiso.
                            </span>
                          )}
                        </p>
                      </>
                    )}
                  </div>
                )}

                {recoveryMethod === 'reemplazo_personal' && (
                  <div className="p-3.5 rounded-xl border bg-muted/20 space-y-2">
                    <Label className="text-xs font-medium">Compañero que realizará el reemplazo *</Label>
                    <select
                      value={replacementEmployeeId}
                      onChange={(e) => setReplacementEmployeeId(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-card px-3 text-xs text-foreground focus:ring-1 focus:ring-ring cursor-pointer"
                    >
                      <option value="">Selecciona un empleado...</option>
                      {employees
                        .filter((e) => e.id !== selectedEmpId)
                        .map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.full_name} ({emp.position || emp.department || 'Personal'})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {recoveryMethod === 'recuperacion_dias' && (
                  <div className="p-3.5 rounded-xl border bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-medium">Jornadas de Reposición *</Label>
                        <p className="text-[11px] text-muted-foreground">
                          Total acumulado a reponer: <strong className="font-mono">{totalRecoveryHours} horas</strong>
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={handleAddRecoverySchedule}
                        className="h-7 text-xs gap-1 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Agregar fecha
                      </Button>
                    </div>

                    {recoverySchedules.length === 0 ? (
                      <div className="text-center py-4 border border-dashed rounded-lg text-xs text-muted-foreground">
                        Haz clic en "Agregar fecha" para definir los horarios de recuperación.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {recoverySchedules.map((row, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-card rounded-lg border text-xs">
                            <div className="w-[35%]">
                              <DatePicker
                                name={`recovery_date_${idx}`}
                                value={row.date}
                                onChange={(d) => handleUpdateRecoverySchedule(idx, 'date', d)}
                              />
                            </div>
                            <div className="w-[25%]">
                              <TimePicker
                                value={row.start_time}
                                onChange={(t) => handleUpdateRecoverySchedule(idx, 'start_time', t)}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="w-[25%]">
                              <TimePicker
                                value={row.end_time}
                                onChange={(t) => handleUpdateRecoverySchedule(idx, 'end_time', t)}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="w-[10%] text-right font-mono font-bold text-primary text-[11px]">
                              {row.hours}h
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveRecoverySchedule(idx)}
                              title="Eliminar jornada de reposición"
                              aria-label="Eliminar jornada de reposición"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Motivo y Justificación */}
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="reason" className="text-xs font-medium">
                    Motivo / Justificación del Permiso *
                  </Label>
                  <textarea
                    id="reason"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ej. Cita médica IESS con especialista, trámite notarial personal, calamidad doméstica familiar..."
                    className="w-full rounded-md border border-input bg-transparent p-3 text-xs text-foreground focus:ring-1 focus:ring-ring resize-none leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* PASO 4: Resumen, Confirmación e Impresión */}
            {step === 4 && createdRequest && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold">¡Permiso laboral registrado exitosamente!</span>
                    <p className="mt-0.5 opacity-90">
                      El registro ha quedado en estado <strong>Pendiente de Aprobación</strong>. Una vez aprobado por jefatura o talento humano, se aplicarán las acciones sobre el módulo correspondiente.
                    </p>
                  </div>
                </div>

                {/* Formato de resumen previo a impresión */}
                <div className="p-5 rounded-xl border bg-card shadow-xs space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b pb-2.5">
                    <div>
                      <h4 className="font-bold text-foreground text-sm uppercase tracking-wide">
                        {organizationName}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">Solicitud de Permiso Laboral</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                      Pendiente
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <div>Empleado: <span className="font-semibold text-foreground">{selectedEmp?.full_name}</span></div>
                    <div>Cédula: <span className="font-mono text-foreground">{selectedEmp?.national_id || '—'}</span></div>
                    <div>
                      Tiempo: <span className="font-semibold text-foreground">
                        {leaveUnit === 'dias' ? `${calculatedDays} día(s)` : `${calculatedHours} horas`}
                      </span>
                    </div>
                    <div>Fecha: <span className="font-mono text-foreground">{formatLongDate(startDate)}</span></div>
                    <div className="col-span-2">
                      Compensación: <span className="font-medium text-foreground">
                        {recoveryMethod === 'cargo_vacaciones' && 'Cargo a Vacaciones'}
                        {recoveryMethod === 'descuento_dia' && 'Descuento Salarial en Rol de Pagos'}
                        {recoveryMethod === 'recuperacion_dias' && `Recuperación de turnos (${totalRecoveryHours} hrs)`}
                        {recoveryMethod === 'reemplazo_personal' && `Reemplazo por: ${replacementEmp?.full_name}`}
                      </span>
                    </div>
                  </div>

                  <div className="border-t pt-2 space-y-1">
                    <span className="text-[11px] text-muted-foreground">Justificación:</span>
                    <p className="p-2.5 rounded-lg bg-muted/40 border italic text-foreground leading-relaxed">
                      "{reason}"
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer de navegación */}
          <div className="p-4 border-t bg-muted/10 flex items-center justify-between gap-3 shrink-0">
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

            <div className="flex items-center gap-2">
              {step === 1 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setStep(2)}
                  disabled={!selectedEmpId}
                  className="gap-1.5 cursor-pointer font-medium"
                >
                  Siguiente: Tiempo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}

              {step === 2 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setStep(3)}
                  disabled={
                    !startDate ||
                    (leaveUnit === 'horas' && (!startTime || !endTime || calculatedHours <= 0))
                  }
                  className="gap-1.5 cursor-pointer font-medium"
                >
                  Siguiente: Recuperación
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}

              {step === 3 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateIncident}
                  disabled={
                    loading ||
                    !reason.trim() ||
                    (recoveryMethod === 'reemplazo_personal' && !replacementEmployeeId) ||
                    (recoveryMethod === 'recuperacion_dias' && recoverySchedules.length === 0)
                  }
                  className="gap-1.5 cursor-pointer font-semibold bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Generar Permiso
                    </>
                  )}
                </Button>
              )}

              {step === 4 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handlePrintDocument}
                  className="gap-2 cursor-pointer font-semibold"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir Formato
                </Button>
              )}
            </div>
          </div>

      {/* Confirmación para evitar cierre accidental con datos cargados (sub-modal independiente, mantiene su propio Dialog) */}
      <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  ¿Descartar trámite de permiso?
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  Tienes datos ingresados en el formulario de permiso laboral. Si sales ahora, se perderá la información no guardada.
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
