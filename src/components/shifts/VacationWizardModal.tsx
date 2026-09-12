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
  updateVacationRequestAction,
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
  /**
   * Presente solo en modo edición (desde la lista de Novedades, botón de
   * lápiz en filas 'pendiente'): precarga el formulario con esta solicitud
   * y guarda con updateVacationRequestAction en vez de crear una nueva. Solo
   * se permite editar solicitudes en status='pendiente'.
   */
  editRequest?: ShiftRequest
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
  editRequest,
}: VacationWizardModalProps) {
  const router = useRouter()
  const isEditMode = Boolean(editRequest)

  // Pasos: 1. Seleccionar Empleado (+1 año), 2. Fechas & Días, 3. Confirmación
  // En modo edición se arranca directo en el paso 2: el empleado ya viene fijo.
  const [step, setStep] = useState<1 | 2 | 3>(isEditMode ? 2 : 1)
  const [submitting, setSubmitting] = useState(false)
  const [createdRequest, setCreatedRequest] = useState<ShiftRequest | null>(null)
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  // Estado del Formulario — si viene editRequest, se precargan sus valores.
  const [selectedEmpId, setSelectedEmpId] = useState<string>(editRequest?.employee_id || '')
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState<string>(editRequest?.metadata?.start_date || '')
  const [endDate, setEndDate] = useState<string>(editRequest?.metadata?.end_date || '')
  const [reason, setReason] = useState(editRequest?.reason || 'Descanso anual reglamentario')

  // Balance y días tomados
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [realBalance, setRealBalance] = useState<{
    totalLawDays: number
    annualLawDays: number
    usedDays: number
    carriedOverDays: number
    availableDays: number
    /** Período que se está liquidando (el anterior no consumido, o el vigente si es el primer año). */
    period: string
    /** Período vigente (año en curso) — para el texto del adelanto, distinto de `period`. */
    currentPeriodLabel: string
  } | null>(null)

  // Adelanto de días del período vigente aún no acumulados proporcionalmente
  // (ver checkbox "Adelantar días"): solo se ofrece cuando el saldo tomable
  // (arrastre + proporcional a la fecha) ya está en 0.
  const [useAdvance, setUseAdvance] = useState(Boolean(editRequest?.metadata?.is_advance))

  // Cargar balance real de vacaciones desde la base de datos al seleccionar empleado.
  // En modo edición se excluye la propia solicitud del cálculo de días usados
  // — de lo contrario, contaría contra su propio saldo al re-validar (ver
  // excludeRequestId en getEmployeeVacationBalanceAction).
  React.useEffect(() => {
    if (!selectedEmpId) {
      setRealBalance(null)
      return
    }
    let isCurrent = true
    async function loadBalance() {
      setBalanceLoading(true)
      try {
        const res = await getEmployeeVacationBalanceAction(selectedEmpId, editRequest?.id)
        if (isCurrent && res.success) {
          setRealBalance({
            totalLawDays: res.totalLawDays,
            annualLawDays: res.annualLawDays,
            usedDays: res.usedDays,
            carriedOverDays: res.carriedOverDays,
            availableDays: res.availableDays,
            period: res.period,
            currentPeriodLabel: res.currentPeriodLabel,
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

  // Saldo real tomable hoy: SOLO el bloque del último año YA CUMPLIDO, no
  // consumido (ver carriedOverDays en getEmployeeVacationBalanceAction) — no
  // se acumulan 15 días por cada año de antigüedad, ni cuenta el período
  // vigente (año en curso, aún no cumplido). Antes de que cargue el balance
  // real, 0 es más seguro que estimar el tope anual completo (evitaría
  // mostrar de más por un instante).
  const normalAvailableDays = realBalance ? realBalance.availableDays : 0

  const totalLawDays = realBalance ? realBalance.totalLawDays : (seniority.hasCompletedOneYear ? Math.min(30, 15 + Math.max(0, seniority.years - 5)) : 0)
  // Tope anual completo del período vigente (15-30 según antigüedad, sin
  // prorratear) — límite duro del adelanto: nunca se autoriza más de esto.
  const annualLawDays = realBalance?.annualLawDays ?? totalLawDays
  const usedDays = realBalance ? realBalance.usedDays : 0
  // Período que se está LIQUIDANDO (el anterior no consumido, salvo primer
  // año) — distinto del período VIGENTE (año en curso), que solo se usa en
  // el texto del adelanto.
  const settlementPeriod = realBalance?.period || seniority.period
  const currentPeriodLabel = realBalance?.currentPeriodLabel || seniority.period

  // El adelanto solo tiene sentido si ya no queda saldo tomable normal.
  const canOfferAdvance = normalAvailableDays === 0 && annualLawDays > 0
  // Con adelanto activo, el tope pasa a ser el año COMPLETO del período
  // vigente (no solo el proporcional a la fecha) menos lo ya usado — nunca
  // supera el máximo anual por ley, aunque no se haya acumulado todavía.
  const availableDays = useAdvance && canOfferAdvance
    ? Math.max(0, annualLawDays - usedDays)
    : normalAvailableDays

  // Período efectivo de la solicitud que se está emitiendo: el vigente si se
  // usa el adelanto, el que se liquida (anterior no consumido) en cualquier
  // otro caso — para el título, metadata y documento impreso.
  const effectivePeriod = useAdvance && canOfferAdvance ? currentPeriodLabel : settlementPeriod

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
    setUseAdvance(false)
  }

  // Cambiar de empleado invalida cualquier decisión de adelanto tomada para
  // el empleado anterior — sin esto, seleccionar a otro empleado con saldo
  // normal disponible podría arrastrar el checkbox marcado sin sentido. Se
  // salta la primera ejecución en modo edición: el efecto corre también en
  // el montaje inicial, y ahí pisaría el useAdvance precargado desde
  // editRequest.metadata.is_advance antes de que el usuario cambie nada.
  const skipFirstAdvanceReset = React.useRef(isEditMode)
  useEffect(() => {
    if (skipFirstAdvanceReset.current) {
      skipFirstAdvanceReset.current = false
      return
    }
    setUseAdvance(false)
  }, [selectedEmpId])

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

    const metadata = {
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
      settlement_period: effectivePeriod,
      reason: reason.trim(),
      // Marca si se usó el adelanto de días no acumulados aún (ver
      // checkbox "Adelantar días") — deja trazabilidad de que estos días
      // no venían de saldo ya generado, para auditoría posterior.
      is_advance: useAdvance && canOfferAdvance,
    }

    try {
      if (isEditMode && editRequest) {
        const res = await updateVacationRequestAction({
          requestId: editRequest.id,
          organizationId,
          employeeId: selectedEmp.id,
          reason: reason.trim() || 'Descanso anual de ley',
          startDate,
          endDate,
          daysCount: requestedDays,
          metadata,
        })

        if (!res.success || !res.data) {
          throw new Error(res.error || 'Error al guardar los cambios.')
        }

        toast.success('Solicitud de vacaciones actualizada con éxito.')
        if (onSuccess) onSuccess()
        onOpenChange(false)
        router.refresh()
        return
      }

      const res = await createVacationRequestAction({
        organizationId,
        employeeId: selectedEmp.id,
        title: `Solicitud de Vacaciones - ${requestedDays} días (${effectivePeriod})`,
        reason: reason.trim() || 'Descanso anual de ley',
        startDate,
        endDate,
        daysCount: requestedDays,
        metadata,
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
      settlementPeriod: effectivePeriod,
      availableDays,
      remainingDays,
      reason: reason.trim(),
      status: createdRequest?.status || 'pendiente',
    })
  }

  return (
    <>
      <div
        className={cn(
          'flex flex-col flex-1 min-h-0 transition-[filter] duration-200 ease-out motion-reduce:transition-none',
          showConfirmClose && 'blur-[6px] pointer-events-none'
        )}
      >
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
                    {isEditMode ? 'Editar Solicitud de Vacaciones' : 'Solicitud de Vacaciones'}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    {isEditMode && 'Modifica los datos mientras la solicitud siga pendiente de aprobación'}
                    {!isEditMode && step === 1 && 'Paso 1: Seleccionar empleado con más de 1 año de antigüedad'}
                    {!isEditMode && step === 2 && 'Paso 2: Período a liquidar y rango de fechas de descanso'}
                    {!isEditMode && step === 3 && 'Paso 3: Emisión oficial y documento para aprobación'}
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

                {/* Resumen del Período a liquidar + Saldo Disponible (acumulado:
                    arrastre + proporcional vigente, sin desglosar) + Saldo Posterior.
                    Los días del período EN CURSO no acumulados aún se muestran
                    solo si se activa el checkbox de adelanto más abajo. */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl border bg-muted/30 space-y-1">
                    <span className="text-[10.5px] font-medium text-muted-foreground uppercase">Período a Liquidar</span>
                    <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{settlementPeriod}</span>
                      {balanceLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/20 space-y-1">
                    <span className="text-[10.5px] font-medium text-emerald-800 dark:text-emerald-300 uppercase">
                      Saldo Disponible
                    </span>
                    <div className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400">
                      {availableDays} días
                    </div>
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

                {/* Opción de adelanto: oculta por defecto, solo aparece
                    cuando el saldo acumulado (arrastre + vigente) ya está en
                    0 — recién ahí se ofrece usar días del período EN CURSO
                    aún no generados, con tope el máximo anual por ley. */}
                {canOfferAdvance && (
                  <label
                    htmlFor="use_advance"
                    className="flex items-start gap-2.5 p-3 rounded-xl border border-blue-500/30 bg-blue-500/5 cursor-pointer select-none"
                  >
                    <input
                      id="use_advance"
                      type="checkbox"
                      checked={useAdvance}
                      onChange={(e) => setUseAdvance(e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded border-input cursor-pointer accent-blue-600"
                    />
                    <div className="text-xs">
                      <span className="font-medium text-foreground">
                        Adelantar días del período vigente ({currentPeriodLabel})
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        El empleado ya no tiene saldo tomable, pero puedes autorizar hasta{' '}
                        <strong className="text-foreground">{Math.max(0, annualLawDays - usedDays)} días</strong> del
                        año completo (aún no acumulados proporcionalmente) — nunca más del máximo anual por ley.
                      </p>
                    </div>
                  </label>
                )}

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
                        <span className="font-bold text-foreground">{effectivePeriod}</span>
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
            {step > 1 && !createdRequest && !(isEditMode && step === 2) ? (
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
                        {isEditMode ? 'Guardando...' : 'Emitiendo...'}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        {isEditMode ? 'Guardar Cambios' : 'Emitir Solicitud'}
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>

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
