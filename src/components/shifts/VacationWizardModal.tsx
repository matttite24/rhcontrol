'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Employee, ShiftRequest } from '@/types/employee'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import {
  Palmtree,
  Printer,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Search,
  Calendar,
  AlertCircle,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react'
import { printVacationDocument } from '@/lib/shifts/print-vacation'
import {
  createVacationRequestAction,
  getEmployeeVacationBalanceAction,
} from '@/lib/shifts/actions'
import { getInitials, formatLongDate } from '@/lib/shifts/format'
import { cn } from '@/lib/utils'

interface VacationWizardModalProps {
  organizationId: string
  organizationName?: string
  employees: Employee[]
  // El <Dialog> raíz vive en el launcher. Ver OvertimeWizardModal.
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  onRegisterRequestClose?: (fn: () => void) => void
}


// Calcula la antigüedad y verifica si tiene más de 1 año cumplido (>= 365 días)
function getEmployeeSeniority(hireDateStr?: string | null) {
  if (!hireDateStr) return { hasCompletedOneYear: false, days: 0, years: 0, period: 'Sin fecha de ingreso' }

  const hire = new Date(hireDateStr)
  const now = new Date()
  const diffTime = now.getTime() - hire.getTime()
  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  const hasCompletedOneYear = days >= 365
  const years = Math.floor(days / 365)

  // Período a liquidar (ej: 2024 - 2025)
  const hireYear = hire.getFullYear()
  const currentYear = now.getFullYear()
  const periodStart = Math.max(hireYear, currentYear - 1)
  const periodEnd = periodStart + 1
  const period = `Período ${periodStart} - ${periodEnd}`

  return { hasCompletedOneYear, days, years, period }
}

export function VacationWizardModal({
  organizationId,
  organizationName = 'RH Garden',
  employees,
  onOpenChange,
  onSuccess,
  onRegisterRequestClose,
}: VacationWizardModalProps) {
  const router = useRouter()

  // Pasos: 1. Seleccionar Empleado (+1 año), 2. Fechas & Días, 3. Confirmación
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [submitting, setSubmitting] = useState(false)
  const [createdRequest, setCreatedRequest] = useState<ShiftRequest | null>(null)
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  // Estado del Formulario
  const [selectedEmpId, setSelectedEmpId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [reason, setReason] = useState('Descanso anual reglamentario')

  // Balance y días tomados
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [realBalance, setRealBalance] = useState<{
    totalLawDays: number
    usedDays: number
    availableDays: number
    period: string
  } | null>(null)

  // Cargar balance real de vacaciones desde la base de datos al seleccionar empleado
  React.useEffect(() => {
    if (!selectedEmpId) {
      setRealBalance(null)
      return
    }
    let isCurrent = true
    async function loadBalance() {
      setBalanceLoading(true)
      try {
        const res = await getEmployeeVacationBalanceAction(selectedEmpId)
        if (isCurrent && res.success) {
          setRealBalance({
            totalLawDays: res.totalLawDays,
            usedDays: res.usedDays,
            availableDays: res.availableDays,
            period: res.period,
          })
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (isCurrent) setBalanceLoading(false)
      }
    }
    loadBalance()
    return () => {
      isCurrent = false
    }
  }, [selectedEmpId])

  // Filtrar empleados que ya cumplieron más de 1 año
  const eligibleEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const { hasCompletedOneYear } = getEmployeeSeniority(emp.hire_date)
      return hasCompletedOneYear && emp.status === 'activo'
    })
  }, [employees])

  const selectedEmp = useMemo(() => {
    return employees.find((e) => e.id === selectedEmpId) || null
  }, [employees, selectedEmpId])

  const seniority = useMemo(() => {
    return getEmployeeSeniority(selectedEmp?.hire_date)
  }, [selectedEmp])

  // Días de vacaciones disponibles por ley y descontando los ya tomados
  const availableDays = useMemo(() => {
    if (realBalance) {
      return realBalance.availableDays
    }
    if (!seniority.hasCompletedOneYear) return 0
    const extraYears = Math.max(0, seniority.years - 5)
    return Math.min(30, 15 + extraYears)
  }, [realBalance, seniority])

  const totalLawDays = realBalance ? realBalance.totalLawDays : (seniority.hasCompletedOneYear ? Math.min(30, 15 + Math.max(0, seniority.years - 5)) : 0)
  const usedDays = realBalance ? realBalance.usedDays : 0
  const currentPeriod = realBalance?.period || seniority.period

  // Cálculo de días solicitados
  const requestedDays = useMemo(() => {
    if (!startDate || !endDate) return 0
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (end < start) return 0
    const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    return diff
  }, [startDate, endDate])

  const isExceeded = requestedDays > availableDays
  const remainingDays = Math.max(0, availableDays - requestedDays)

  // Empleados filtrados por búsqueda en Paso 1
  const displayedEmployees = useMemo(() => {
    if (!searchQuery.trim()) return eligibleEmployees
    const q = searchQuery.toLowerCase()
    return eligibleEmployees.filter(
      (e) =>
        e.full_name?.toLowerCase().includes(q) ||
        e.national_id?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q) ||
        e.position?.toLowerCase().includes(q)
    )
  }, [eligibleEmployees, searchQuery])

  function resetForm() {
    setStep(1)
    setSelectedEmpId('')
    setSearchQuery('')
    setStartDate('')
    setEndDate('')
    setReason('Descanso anual reglamentario')
    setCreatedRequest(null)
  }

  function handleModalClose(wantOpen: boolean) {
    if (!wantOpen) {
      if (step > 1 && !createdRequest) {
        setShowConfirmClose(true)
        return
      }
      resetForm()
      onOpenChange(false)
    } else {
      onOpenChange(true)
    }
  }

  // Publicar el cierre-con-confirmación hacia el padre para que Escape/click-fuera
  // en el Dialog raíz compartido respeten esta misma confirmación.
  useEffect(() => {
    onRegisterRequestClose?.(() => handleModalClose(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, createdRequest])

  function forceClose() {
    setShowConfirmClose(false)
    resetForm()
    onOpenChange(false)
  }

  // Validación de pasos
  function handleNext() {
    if (step === 1) {
      if (!selectedEmp) {
        toast.error('Selecciona un empleado que tenga más de 1 año de antigüedad.')
        return
      }
      setStep(2)
    } else if (step === 2) {
      if (!startDate) {
        toast.error('Ingresa la fecha de inicio de las vacaciones.')
        return
      }
      if (!endDate) {
        toast.error('Ingresa la fecha de finalización de las vacaciones.')
        return
      }
      if (new Date(endDate) < new Date(startDate)) {
        toast.error('La fecha de fin debe ser igual o posterior a la de inicio.')
        return
      }
      if (requestedDays <= 0) {
        toast.error('El número de días solicitados debe ser mayor a cero.')
        return
      }
      if (requestedDays > availableDays) {
        toast.error(`Los días solicitados (${requestedDays}) superan el saldo disponible (${availableDays} días).`)
        return
      }
      setStep(3)
    }
  }

  async function handleEmitRequest() {
    if (!selectedEmp || requestedDays <= 0) return
    setSubmitting(true)

    try {
      const res = await createVacationRequestAction({
        organizationId,
        employeeId: selectedEmp.id,
        title: `Solicitud de Vacaciones - ${requestedDays} días (${seniority.period})`,
        reason: reason.trim() || 'Descanso anual de ley',
        startDate,
        endDate,
        daysCount: requestedDays,
        metadata: {
          employee_id: selectedEmp.id,
          employee_name: selectedEmp.full_name,
          national_id: selectedEmp.national_id ?? undefined,
          department: selectedEmp.department ?? undefined,
          position: selectedEmp.position ?? undefined,
          hire_date: selectedEmp.hire_date ?? undefined,
          start_date: startDate,
          end_date: endDate,
          days_count: requestedDays,
          available_days: availableDays,
          remaining_days: remainingDays,
          settlement_period: seniority.period,
          reason: reason.trim(),
        },
      })

      if (!res.success || !res.data) {
        throw new Error(res.error || 'Error al emitir la solicitud de vacaciones.')
      }

      setCreatedRequest(res.data)
      toast.success('Solicitud de vacaciones generada como pendiente para aprobación.')
      if (onSuccess) onSuccess()
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Ocurrió un error al procesar la solicitud.')
    } finally {
      setSubmitting(false)
    }
  }

  function handlePrintDocument() {
    if (!selectedEmp) return
    printVacationDocument({
      organization: { name: organizationName },
      organizationName,
      employeeName: selectedEmp.full_name,
      nationalId: selectedEmp.national_id || '',
      department: selectedEmp.department || '',
      position: selectedEmp.position || '',
      hireDate: selectedEmp.hire_date || undefined,
      startDate,
      endDate,
      daysCount: requestedDays,
      settlementPeriod: seniority.period,
      availableDays,
      remainingDays,
      reason: reason.trim(),
      status: createdRequest?.status || 'pendiente',
    })
  }

  return (
    <>
      {/* El <DialogContent> único vive en el launcher. Ver OvertimeWizardModal. */}
          {/* HEADER DEL MODAL CON INDICADOR DE PASOS */}
          <div className="p-5 border-b bg-emerald-500/5 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                  <Palmtree className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Solicitud de Vacaciones
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    {step === 1 && 'Paso 1: Seleccionar empleado con más de 1 año de antigüedad'}
                    {step === 2 && 'Paso 2: Período a liquidar y rango de fechas de descanso'}
                    {step === 3 && 'Paso 3: Emisión oficial y documento para aprobación'}
                  </DialogDescription>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleModalClose(false)}
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
              >
                Cerrar
              </Button>
            </div>
          </div>

          {/* CUERPO DEL WIZARD */}
          <div className="p-6">
            {/* PASO 1: SELECCIÓN DEL EMPLEADO CON MÁS DE 1 AÑO */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-xs font-semibold text-foreground">
                    Empleados que cumplen el requisito legal (&gt; 1 año de antigüedad)
                  </Label>
                  <Badge variant="outline" className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {eligibleEmployees.length} habilitados
                  </Badge>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Buscar empleado por nombre, cédula o cargo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 text-xs h-9"
                  />
                </div>

                {eligibleEmployees.length === 0 ? (
                  <div className="p-8 text-center rounded-xl border border-dashed text-xs text-muted-foreground space-y-2">
                    <AlertCircle className="h-8 w-8 text-amber-500 mx-auto opacity-80" />
                    <p className="font-semibold text-foreground">No hay empleados con más de 1 año cumplido</p>
                    <p>Para tener derecho al descanso anual legal se requiere un mínimo de 365 días continuos de servicio.</p>
                  </div>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                    {displayedEmployees.map((emp) => {
                      const sen = getEmployeeSeniority(emp.hire_date)
                      const isSelected = selectedEmpId === emp.id

                      return (
                        <div
                          key={emp.id}
                          onClick={() => setSelectedEmpId(emp.id)}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all",
                            isSelected
                              ? "bg-emerald-500/10 border-emerald-500/50 shadow-xs"
                              : "bg-card hover:bg-muted/40 border-border/70"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-9 w-9 ring-1 ring-border">
                              <AvatarImage src={emp.avatar_url ?? undefined} alt={emp.full_name} />
                              <AvatarFallback className="text-[11px] font-bold">
                                {getInitials(emp.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-foreground truncate">
                                {emp.full_name}
                              </h4>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {emp.position || 'Empleado'} • {emp.department || 'General'}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 pl-2">
                            <Badge variant="outline" className="text-[10px] font-mono border-emerald-200 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-300">
                              {sen.years} año(s) servicio
                            </Badge>
                            <span className="block text-[10px] text-muted-foreground mt-0.5 font-mono">
                              Ingreso: {emp.hire_date || '—'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* PASO 2: DÍAS DISPONIBLES, FECHA DE INICIO / FIN Y PERÍODO */}
            {step === 2 && selectedEmp && (
              <div className="space-y-5 animate-in fade-in-50 duration-200">
                {/* Tarjeta del Empleado Seleccionado */}
                <div className="flex items-center gap-3 p-3 rounded-xl border bg-card">
                  <Avatar className="h-9 w-9 ring-1 ring-border">
                    <AvatarImage src={selectedEmp.avatar_url ?? undefined} alt={selectedEmp.full_name} />
                    <AvatarFallback className="text-[11px] font-bold">
                      {getInitials(selectedEmp.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-foreground truncate">
                      {selectedEmp.full_name}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      C.I: {selectedEmp.national_id || '—'} • {selectedEmp.position} • Ingreso: {selectedEmp.hire_date}
                    </p>
                  </div>
                </div>

                {/* Resumen del Período y Saldo Disponible */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl border bg-muted/30 space-y-1">
                    <span className="text-[10.5px] font-medium text-muted-foreground uppercase">Período a Liquidar</span>
                    <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{currentPeriod}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-medium text-emerald-800 dark:text-emerald-300 uppercase">Días Disponibles</span>
                      {balanceLoading && <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />}
                    </div>
                    <div className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400">
                      {availableDays} días
                    </div>
                    {usedDays > 0 && (
                      <span className="text-[10px] text-muted-foreground block">
                        (Ley: {totalLawDays} • Ya tomados: {usedDays})
                      </span>
                    )}
                  </div>

                  <div className={cn(
                    "p-3 rounded-xl border space-y-1 transition-colors",
                    isExceeded
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400"
                      : "bg-muted/30 text-foreground"
                  )}>
                    <span className="text-[10.5px] font-medium uppercase opacity-75">Saldo Posterior</span>
                    <div className="text-sm font-bold font-mono">
                      {isExceeded ? `-${requestedDays - availableDays} (Excedido)` : `${remainingDays} días`}
                    </div>
                  </div>
                </div>

                {/* Selector de Rango de Fechas Integrado (Rango de Salida y Retorno) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      Período de Vacaciones (Fecha de Salida y Retorno) <span className="text-rose-500">*</span>
                    </Label>
                    {startDate && availableDays > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const s = new Date(startDate)
                          s.setDate(s.getDate() + availableDays - 1)
                          setEndDate(s.toISOString().split('T')[0])
                        }}
                        className="text-[10.5px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer font-medium"
                      >
                        Ajustar al máximo disponible ({availableDays} días)
                      </button>
                    )}
                  </div>

                  <DateRangePicker
                    startDate={startDate}
                    endDate={endDate}
                    onChange={({ startDate: s, endDate: e }) => {
                      setStartDate(s)
                      setEndDate(e)
                    }}
                    placeholder="Haz clic para seleccionar fecha de inicio y fin en el calendario"
                  />

                  {/* Resumen visual de fechas seleccionadas */}
                  {startDate && (
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2.5 rounded-lg border bg-muted/20">
                        <span className="text-[10.5px] text-muted-foreground block">Fecha de Salida:</span>
                        <span className="font-semibold text-foreground">{formatLongDate(startDate)}</span>
                      </div>
                      <div className="p-2.5 rounded-lg border bg-muted/20">
                        <span className="text-[10.5px] text-muted-foreground block">Fecha de Retorno:</span>
                        <span className="font-semibold text-foreground">
                          {endDate ? formatLongDate(endDate) : '— (Selecciona en el calendario)'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Desglose de Días Solicitados y Alertas de Límite */}
                {startDate && endDate && (
                  <div className="space-y-2">
                    <div className={cn(
                      "p-3.5 rounded-xl border flex items-center justify-between text-xs transition-colors",
                      isExceeded
                        ? "bg-rose-500/10 border-rose-500/30"
                        : "bg-card border-border"
                    )}>
                      <div className="flex items-center gap-2">
                        {isExceeded ? (
                          <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                        ) : (
                          <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                        <span className={isExceeded ? "text-rose-700 dark:text-rose-300 font-medium" : "text-muted-foreground"}>
                          Total días de descanso seleccionados:
                        </span>
                      </div>
                      <span className={cn(
                        "font-mono font-bold text-sm",
                        isExceeded ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                      )}>
                        {requestedDays} día(s)
                      </span>
                    </div>

                    {isExceeded && (
                      <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-semibold">
                            Supera el límite de días disponibles
                          </p>
                          <p className="text-[11px] opacity-90 leading-relaxed">
                            Has seleccionado <strong>{requestedDays} días</strong>, pero el empleado solo dispone de <strong>{availableDays} días</strong> para este período. Por favor ajusta la fecha de finalización.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Motivo o Justificación */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Observaciones / Motivo (Opcional)
                  </Label>
                  <Input
                    placeholder="Ej: Descanso anual reglamentario"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>
              </div>
            )}

            {/* PASO 3: CONFIRMACIÓN Y EMISIÓN DE SOLICITUD */}
            {step === 3 && selectedEmp && (
              <div className="space-y-5 animate-in fade-in-50 duration-200">
                {!createdRequest ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border bg-card space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-muted-foreground font-medium">Empleado:</span>
                        <span className="font-bold text-foreground">{selectedEmp.full_name}</span>
                      </div>
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-muted-foreground font-medium">Período a Liquidar:</span>
                        <span className="font-bold text-foreground">{seniority.period}</span>
                      </div>
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-muted-foreground font-medium">Rango de Vacaciones:</span>
                        <span className="font-semibold text-foreground">
                          {formatLongDate(startDate)} al {formatLongDate(endDate)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-muted-foreground font-medium">Días Solicitados:</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {requestedDays} días
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-muted-foreground font-medium">Saldo Restante:</span>
                        <span className="font-mono font-medium text-muted-foreground">
                          {remainingDays} días
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-medium">Estado inicial:</span>
                        <Badge variant="outline" className="text-[10px] font-mono text-orange-700 bg-orange-50 border-orange-200">
                          Pendiente de Aprobación
                        </Badge>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
                      <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <p>
                        Al emitir la solicitud, quedará registrada como <strong>Pendiente</strong>. Una vez que sea aprobada por talento humano, el calendario marcará los días automáticamente sustituyendo el horario por el texto <strong>Vacaciones</strong>.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5 text-center py-4">
                    <div className="h-12 w-12 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">¡Solicitud de Vacaciones Emitida!</h3>
                      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                        La solicitud ha sido registrada como <strong>Pendiente de Aprobación</strong>. Ya puedes imprimir el documento membretado listo para su firma y revisión.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                      <Button
                        type="button"
                        onClick={handlePrintDocument}
                        variant="outline"
                        size="sm"
                        className="gap-2 cursor-pointer border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      >
                        <Printer className="h-4 w-4" />
                        Imprimir Documento
                      </Button>
                      <Button
                        type="button"
                        onClick={forceClose}
                        size="sm"
                        className="cursor-pointer"
                      >
                        Finalizar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* FOOTER CON BOTONES DE NAVEGACIÓN */}
          <div className="p-4 border-t bg-muted/10 flex items-center justify-between gap-3">
            {step > 1 && !createdRequest ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => (s - 1) as any)}
                className="gap-1.5 cursor-pointer text-xs"
              >
                <ChevronLeft className="h-4 w-4" />
                Atrás
              </Button>
            ) : (
              <div />
            )}

            {!createdRequest && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleModalClose(false)}
                  className="cursor-pointer text-xs"
                >
                  Cancelar
                </Button>

                {step < 3 ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleNext}
                    disabled={step === 2 && (isExceeded || requestedDays <= 0)}
                    className="gap-1.5 cursor-pointer text-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleEmitRequest}
                    disabled={submitting}
                    className="gap-1.5 cursor-pointer text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Emitiendo...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Emitir Solicitud
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>

      {/* DIÁLOGO CONFIRMACIÓN DESCARTAR (sub-modal independiente, mantiene su propio Dialog) */}
      <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <AlertCircle className="h-5 w-5" />
              </div>
              <DialogTitle className="text-base font-bold">¿Descartar cambios?</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-2">
              Hay datos ingresados para la solicitud de vacaciones. Si sales ahora se cancelará el proceso.
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
              onClick={forceClose}
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
