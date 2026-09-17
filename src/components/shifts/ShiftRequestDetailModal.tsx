'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShiftRequest, ShiftRequestStatus, Organization, LeaveRecoverySchedule, EmployeeSchedule, DayOfWeek } from '@/types/employee'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from '@/components/ui/toast'
import { DetailModalHeader } from '@/components/shared/DetailModalHeader'
import {
  Clock,
  Printer,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Building,
  User,
  Calendar,
  FileText,
  X,
  CalendarOff,
  Timer,
  RefreshCw,
  Palmtree,
  Trash2,
  Plus,
  CalendarCheck2,
  Fingerprint,
} from 'lucide-react'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { deleteRejectedShiftRequestAction } from '@/lib/shifts/actions'
import { printOvertimeDocument } from '@/lib/shifts/print-overtime'
import { printLeavePermissionDocument } from '@/lib/shifts/print-leave-permission'
import { printScheduleChangeDocument } from '@/lib/shifts/print-schedule-change'
import { printVacationDocument } from '@/lib/shifts/print-vacation'
import { printBiometricIncidentDocument } from '@/lib/shifts/print-biometric-incident'
import { LeaveIncidentMetadata, ScheduleChangeMetadata, VacationRequestMetadata, BiometricIncidentMetadata, BiometricIncidentType } from '@/types/employee'
import { SHIFT_REQUEST_STATUS_MAP } from '@/lib/shifts/constants'
import { getShiftRequestCode } from '@/lib/incidents/sequence'
import { getInitials, formatLongDate } from '@/lib/shifts/format'
import { cn } from '@/lib/utils'

const DAYS_OF_WEEK_MAP: Record<number, DayOfWeek> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
}

/** Suma `days` días a una fecha ISO (YYYY-MM-DD) sin problemas de zona horaria. */
function addDaysToIsoLocal(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface ShiftRequestDetailModalProps {
  request: ShiftRequest | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusChanged?: (updated: ShiftRequest) => void
  /** Organización activa, ya resuelta server-side. Evita refetchear en cada apertura del modal. */
  organization?: Organization | null
}


export function ShiftRequestDetailModal({
  request,
  open,
  onOpenChange,
  onStatusChanged,
  organization: organizationProp,
}: ShiftRequestDetailModalProps) {
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [fetchedOrganization, setFetchedOrganization] = useState<Organization | null>(null)
  const [showRecoveryForm, setShowRecoveryForm] = useState(false)
  const [savingRecovery, setSavingRecovery] = useState(false)
  // `_key` es un id local estable para el `key` de React en la lista editable
  // (evita usar el índice del array, que se desalinea al quitar filas del
  // medio) — nunca se envía al guardar (ver handleSaveRecovery).
  const [recoveryRows, setRecoveryRows] = useState<(LeaveRecoverySchedule & { _key: number })[]>([])
  const nextRecoveryRowKey = React.useRef(0)
  // Horario habitual del empleado para la fecha de la solicitud de horas
  // extras — se consulta en vivo (no se persiste al crear la solicitud), así
  // que refleja el horario ACTUAL del empleado, no necesariamente el que
  // tenía cuando pidió la hora extra si cambió de turno después.
  const [dayOwnSchedule, setDayOwnSchedule] = useState<EmployeeSchedule | null>(null)
  const [loadingDaySchedule, setLoadingDaySchedule] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const orgId = request?.organization_id

  // La organización activa normalmente llega ya resuelta desde el servidor
  // (evita un round-trip en cada apertura del modal). Solo se refetch como
  // respaldo si el padre no la pasó, o si el request pertenece a otra org.
  const needsFetch = !organizationProp || organizationProp.id !== orgId
  React.useEffect(() => {
    if (!orgId || !needsFetch) return
    let isMounted = true
    async function loadOrg() {
      const { data } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single()
      if (data && isMounted) setFetchedOrganization(data)
    }
    loadOrg()
    return () => {
      isMounted = false
    }
  }, [orgId, needsFetch, supabase])

  const organization = needsFetch ? fetchedOrganization : organizationProp

  const isOvertimeForSchedule = request?.request_type === 'horas_extras'
  useEffect(() => {
    let isMounted = true
    async function loadDaySchedule() {
      if (!request || !isOvertimeForSchedule || !request.employee_id) {
        if (isMounted) {
          setDayOwnSchedule(null)
          setLoadingDaySchedule(false)
        }
        return
      }
      setLoadingDaySchedule(true)
      const { data } = await supabase
        .from('employee_schedules')
        .select('*')
        .eq('employee_id', request.employee_id)
      if (!isMounted) return
      if (data) {
        const [y, m, d] = request.date.split('-').map(Number)
        const dayName = DAYS_OF_WEEK_MAP[new Date(y, m - 1, d).getDay()]
        const sched = (data as EmployeeSchedule[]).find((s) => s.day_of_week === dayName) || null
        setDayOwnSchedule(sched)
      }
      setLoadingDaySchedule(false)
    }
    loadDaySchedule()
    return () => {
      isMounted = false
    }
  }, [request, isOvertimeForSchedule, supabase])

  if (!request) return null

  async function handleUpdateStatus(newStatus: ShiftRequestStatus) {
    if (!request) return
    setLoading(true)

    try {
      const isLeave = request.request_type === 'permiso_laboral' || request.metadata?.sub_type === 'permiso_laboral'
      const metadata = (request.metadata || {}) as LeaveIncidentMetadata

      // Si es permiso laboral y se aprueba con descuento en día de trabajo, generar deducción
      if (isLeave && newStatus === 'aprobado' && metadata.recovery_method === 'descuento_dia') {
        const { data: salaryData } = await supabase
          .from('employee_salaries')
          .select('amount')
          .eq('employee_id', request.employee_id)
          .eq('salary_type', 'Sueldo')
          .single()

        const baseSalary = salaryData?.amount || 460.0
        let deductionAmount = 0
        if (metadata.leave_unit === 'dias') {
          const days = metadata.requested_days || 1
          deductionAmount = Number(((baseSalary / 30) * days).toFixed(2))
        } else {
          const hours = metadata.requested_hours || Number(request.hours) || 1
          deductionAmount = Number(((baseSalary / 240) * hours).toFixed(2))
        }

        const now = new Date()
        await supabase.from('deductions').insert({
          organization_id: request.organization_id,
          employee_id: request.employee_id,
          deduction_type: 'otro',
          title: `Descuento por Permiso Laboral (${metadata.leave_unit === 'dias' ? `${metadata.requested_days} días` : `${metadata.requested_hours || request.hours} hrs`})`,
          description: `Aprobación de solicitud de permiso laboral: ${request.title}. ${request.reason || ''}`,
          amount: deductionAmount,
          status: 'pendiente',
          period_month: now.getMonth() + 1,
          period_year: now.getFullYear(),
          date: request.date,
          metadata: {
            shift_request_id: request.id,
            recovery_method: 'descuento_dia',
          },
        })
      }

      // Si tiene incident_id vinculado, sincronizar su estado
      if (metadata.incident_id) {
        await supabase
          .from('incidents')
          .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', metadata.incident_id)
      }

      const { data, error } = await supabase
        .from('shift_requests')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id)
        .select(`
          *,
          employee:employees (
            id,
            full_name,
            national_id,
            department,
            position,
            avatar_url
          )
        `)
        .single()

      if (error) throw error

      if (isLeave && newStatus === 'aprobado') {
        if (metadata.recovery_method === 'descuento_dia') {
          toast.success('Permiso aprobado: Deducción registrada en nómina.')
        } else if (metadata.recovery_method === 'cargo_vacaciones') {
          toast.success('Permiso aprobado: Descontado de vacaciones anuales.')
        } else if (metadata.recovery_method === 'sin_descuento') {
          toast.success('Permiso aprobado: falta autorizada sin descuento.')
        } else {
          toast.success('Permiso laboral aprobado con éxito.')
        }
      } else if (request.request_type === 'incidencia_marcacion' || request.metadata?.sub_type === 'incidencia_marcacion') {
        toast.success(newStatus === 'rechazado' ? 'Incidencia de marcación anulada.' : 'Incidencia de marcación actualizada.')
      } else {
        toast.success(
          newStatus === 'aprobado'
            ? 'Solicitud aprobada con éxito.'
            : 'Solicitud rechazada.'
        )
      }

      if (onStatusChanged) onStatusChanged(data as ShiftRequest)
      onOpenChange(false)
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error al actualizar el estado.')
    } finally {
      setLoading(false)
    }
  }

  // Cantidad de turnos que debe reponer el empleado: un turno por cada día
  // ausente (permiso por días) o un único turno equivalente a las horas
  // solicitadas (permiso por horas).
  function getRecoveryTargetCount(): number {
    const metadata = (request?.metadata || {}) as LeaveIncidentMetadata
    if (metadata.leave_unit === 'dias') return Math.max(1, metadata.requested_days || 1)
    return 1
  }

  function openRecoveryForm() {
    const metadata = (request?.metadata || {}) as LeaveIncidentMetadata
    const target = getRecoveryTargetCount()
    if (metadata.recovery_schedules && metadata.recovery_schedules.length > 0) {
      setRecoveryRows(metadata.recovery_schedules.map((r) => ({ ...r, _key: nextRecoveryRowKey.current++ })))
    } else {
      setRecoveryRows(
        Array.from({ length: target }, () => ({ date: '', start_time: '', end_time: '', hours: 0, _key: nextRecoveryRowKey.current++ }))
      )
    }
    setShowRecoveryForm(true)
  }

  function updateRecoveryRow(index: number, field: keyof LeaveRecoverySchedule, value: string) {
    setRecoveryRows((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row
        const updated = { ...row, [field]: field === 'hours' ? Number(value) || 0 : value }
        return updated
      })
    )
  }

  function addRecoveryRow() {
    setRecoveryRows((rows) => [...rows, { date: '', start_time: '', end_time: '', hours: 0, _key: nextRecoveryRowKey.current++ }])
  }

  function removeRecoveryRow(index: number) {
    setRecoveryRows((rows) => rows.filter((_, i) => i !== index))
  }

  async function handleSaveRecovery() {
    if (!request) return
    const validRows: LeaveRecoverySchedule[] = recoveryRows
      .filter((r) => r.date)
      .map(({ _key, ...row }) => row)
    if (validRows.length === 0) {
      toast.error('Agrega al menos una fecha de recuperación.')
      return
    }

    const target = getRecoveryTargetCount()
    if (validRows.length !== target) {
      toast.error(`Debes registrar ${target} día(s) de recuperación (llevas ${validRows.length}).`)
      return
    }

    setSavingRecovery(true)
    try {
      const metadata = (request.metadata || {}) as LeaveIncidentMetadata
      const updatedMetadata = { ...metadata, recovery_schedules: validRows }

      const { data, error } = await supabase
        .from('shift_requests')
        .update({
          metadata: updatedMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id)
        .select(`
          *,
          employee:employees (
            id,
            full_name,
            national_id,
            department,
            position,
            avatar_url
          )
        `)
        .single()

      if (error) throw error

      toast.success('Fechas de recuperación registradas.')
      setShowRecoveryForm(false)
      if (onStatusChanged) onStatusChanged(data as ShiftRequest)
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error al guardar las fechas de recuperación.')
    } finally {
      setSavingRecovery(false)
    }
  }

  async function handleDelete() {
    if (!request) return
    setDeleting(true)
    try {
      const result = await deleteRejectedShiftRequestAction(request.id)
      if (!result.success) {
        toast.error('No se pudo eliminar', result.error || 'Ocurrió un error inesperado.')
        return
      }
      toast.success('Solicitud eliminada')
      setShowConfirmDelete(false)
      onOpenChange(false)
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error al eliminar la solicitud.')
    } finally {
      setDeleting(false)
    }
  }

  function handlePrint() {
    if (!request) return

    const docCode = getShiftRequestCode(request)

    const isLeave = request.request_type === 'permiso_laboral' || request.metadata?.sub_type === 'permiso_laboral'
    const isScheduleChange = request.request_type === 'cambio_horario' || request.metadata?.sub_type === 'cambio_horario'
    const isVacation = request.request_type === 'solicitud_vacaciones' || request.metadata?.sub_type === 'solicitud_vacaciones'
    const isBiometricIncident = request.request_type === 'incidencia_marcacion' || request.metadata?.sub_type === 'incidencia_marcacion'

    if (isBiometricIncident) {
      const metadata = (request.metadata || {}) as BiometricIncidentMetadata
      printBiometricIncidentDocument({
        organization: organization || { name: 'RH Garden' },
        organizationName: organization?.name || 'RH Garden',
        employeeName: request.employee?.full_name || metadata.employee_name || 'Empleado',
        nationalId: request.employee?.national_id || metadata.national_id || '',
        department: request.employee?.department || metadata.department || '',
        position: request.employee?.position || metadata.position || '',
        date: request.date,
        incidentType: metadata.incident_type || 'sin_marcacion',
        reason: request.reason || 'Sin justificación especificada.',
        documentCode: docCode,
      })
      return
    }

    if (isVacation) {
      const metadata = (request.metadata || {}) as VacationRequestMetadata
      printVacationDocument({
        organization: organization || { name: 'RH Garden' },
        organizationName: organization?.name || 'RH Garden',
        employeeName: request.employee?.full_name || metadata.employee_name || 'Empleado',
        nationalId: request.employee?.national_id || metadata.national_id || '',
        department: request.employee?.department || metadata.department || '',
        position: request.employee?.position || metadata.position || '',
        hireDate: metadata.hire_date || undefined,
        startDate: metadata.start_date || request.date,
        endDate: metadata.end_date || request.date,
        daysCount: metadata.days_count || (request.hours ? Math.round(request.hours / 8) : 1),
        settlementPeriod: metadata.settlement_period || 'Período Reglamentario',
        availableDays: metadata.available_days || 15,
        remainingDays: metadata.remaining_days || 0,
        reason: request.reason || 'Descanso anual legal.',
        status: request.status,
        resolvedAt: request.status !== 'pendiente' ? request.updated_at : undefined,
        documentCode: docCode,
      })
      return
    }

    if (isScheduleChange) {
      const metadata = (request.metadata || {}) as ScheduleChangeMetadata
      printScheduleChangeDocument({
        organization: organization || { name: 'RH Garden' },
        organizationName: organization?.name || 'RH Garden',
        employeeName: request.employee?.full_name || 'Empleado',
        nationalId: request.employee?.national_id || '',
        department: request.employee?.department || '',
        position: request.employee?.position || '',
        date: request.date,
        reason: request.reason || 'Cambio temporal de horario convenido.',
        dayChanges: metadata.day_changes || [],
        status: request.status,
        resolvedAt: request.status !== 'pendiente' ? request.updated_at : undefined,
        documentCode: docCode,
      })
      return
    }

    if (isLeave) {
      const metadata = (request.metadata || {}) as LeaveIncidentMetadata
      printLeavePermissionDocument({
        organization: organization || { name: 'RH Garden' },
        organizationName: organization?.name || 'RH Garden',
        employeeName: request.employee?.full_name || 'Empleado',
        nationalId: request.employee?.national_id || '',
        department: request.employee?.department || '',
        position: request.employee?.position || '',
        leaveUnit: metadata.leave_unit || 'dias',
        startDate: request.date,
        endDate: metadata.end_date || undefined,
        daysCount: metadata.requested_days || 1,
        hoursCount: metadata.requested_hours || Number(request.hours) || 0,
        startTime: metadata.start_time || request.start_time || undefined,
        endTime: metadata.end_time || request.end_time || undefined,
        reason: request.reason || 'Sin justificación especificada.',
        recoveryMethod: metadata.recovery_method || 'cargo_vacaciones',
        recoverySchedules: metadata.recovery_schedules || undefined,
        replacementEmployeeName: metadata.replacement_employee_name || undefined,
        status: request.status,
        resolvedAt: request.status !== 'pendiente' ? request.updated_at : undefined,
        documentCode: docCode,
      })
      return
    }

    printOvertimeDocument({
      organization: organization || { name: 'RH Garden' },
      organizationName: organization?.name || 'RH Garden',
      employeeName: request.employee?.full_name || 'Empleado',
      nationalId: request.employee?.national_id || '',
      department: request.employee?.department || '',
      position: request.employee?.position || '',
      date: request.date,
      startTime: request.start_time || '—',
      endTime: request.end_time || '—',
      hours: Number(request.hours || 0),
      reason: request.reason || 'Sin justificación especificada.',
      status: request.status,
      resolvedAt: request.status !== 'pendiente' ? request.updated_at : undefined,
      documentCode: docCode,
    })
  }

  const isApproved = request.status === 'aprobado'
  const isRejected = request.status === 'rechazado'
  const isPending = request.status === 'pendiente'

  const isLeave = request.request_type === 'permiso_laboral' || request.metadata?.sub_type === 'permiso_laboral'
  const isScheduleChange = request.request_type === 'cambio_horario' || request.metadata?.sub_type === 'cambio_horario'
  const isVacation = request.request_type === 'solicitud_vacaciones' || request.metadata?.sub_type === 'solicitud_vacaciones'
  const isBiometricIncident = request.request_type === 'incidencia_marcacion' || request.metadata?.sub_type === 'incidencia_marcacion'
  const isOvertime = request.request_type === 'horas_extras'

  // Este tipo no tiene flujo de aprobación: "rechazado" se reutiliza como
  // equivalente a "Anulado" (no existe un status propio en la base de datos).
  const statusInfo =
    isBiometricIncident && isRejected
      ? { label: 'Anulado', badgeClass: SHIFT_REQUEST_STATUS_MAP.rechazado.badgeClass }
      : SHIFT_REQUEST_STATUS_MAP[request.status] ?? SHIFT_REQUEST_STATUS_MAP.pendiente

  // Último día de ausencia real del permiso (metadata.end_date, cuando existe,
  // es el día de REINCORPORACIÓN, no un día de falta — ver
  // LeavePermissionWizardModal `calculatedDays`).
  const leaveLastAbsentDate =
    isLeave && request.metadata?.leave_unit === 'dias' && request.metadata?.requested_days && request.metadata.requested_days > 1
      ? addDaysToIsoLocal(request.date, request.metadata.requested_days - 1)
      : undefined

  const typeConfig = isVacation
    ? {
        title: 'Solicitud de Vacaciones',
        icon: Palmtree,
        headerBg: 'bg-emerald-500/10 border-emerald-500/20',
        badgeBg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        accentText: 'text-emerald-600 dark:text-emerald-400',
        primaryBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      }
    : isBiometricIncident
    ? {
        title: 'Marcación Biométrica',
        icon: Fingerprint,
        headerBg: 'bg-rose-500/10 border-rose-500/20',
        badgeBg: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
        accentText: 'text-rose-600 dark:text-rose-400',
        primaryBtn: 'bg-rose-600 hover:bg-rose-700 text-white',
      }
    : isLeave
    ? {
        title: 'Permiso Laboral / Salida',
        icon: CalendarOff,
        headerBg: 'bg-violet-500/10 border-violet-500/20',
        badgeBg: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
        accentText: 'text-violet-600 dark:text-violet-400',
        primaryBtn: 'bg-violet-600 hover:bg-violet-700 text-white',
      }
    : isScheduleChange
    ? {
        title: 'Solicitud de Cambio de Horario',
        icon: RefreshCw,
        headerBg: 'bg-blue-500/10 border-blue-500/20',
        badgeBg: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
        accentText: 'text-blue-600 dark:text-blue-400',
        primaryBtn: 'bg-blue-600 hover:bg-blue-700 text-white',
      }
    : {
        title: 'Solicitud de Horas Extras',
        icon: Timer,
        headerBg: 'bg-amber-500/10 border-amber-500/20',
        badgeBg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
        accentText: 'text-amber-600 dark:text-amber-400',
        primaryBtn: 'bg-amber-600 hover:bg-amber-700 text-white',
      }

  const docCode = getShiftRequestCode(request)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl p-0 overflow-hidden border-border/80 gap-0 max-h-[90vh] flex flex-col"
        showCloseButton={false}
      >
        <DetailModalHeader
          icon={typeConfig.icon}
          title={typeConfig.title}
          headerBg={typeConfig.headerBg}
          accentText={typeConfig.accentText}
          statusLabel={statusInfo.label}
          statusBadgeClass={statusInfo.badgeClass}
          documentCode={docCode}
          registeredAtLabel={new Date(request.created_at).toLocaleDateString('es-EC')}
          onClose={() => onOpenChange(false)}
        />

        {/* Formato imprimible y detalles */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Datos del empleado debajo del header */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/70">
            <Avatar className="h-10 w-10 ring-1 ring-border shrink-0">
              <AvatarImage src={request.employee?.avatar_url ?? undefined} alt={request.employee?.full_name} />
              <AvatarFallback className="text-xs font-semibold">
                {getInitials(request.employee?.full_name || 'U')}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground truncate">
                {request.employee?.full_name || 'Empleado'}
              </div>
              <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                CI: {request.employee?.national_id || '—'} • {request.employee?.position || request.employee?.department || 'Personal'}
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* Cambio de Horario: la fecha ya se muestra dentro del bloque
                  "Cambio de Horario"/"Días y Horarios Modificados" de abajo
                  (única fuente, evita repetir la misma fecha dos veces). */}
              {!isScheduleChange && (
                <div>
                  <span className="text-muted-foreground text-[11px] block">
                    {(isVacation || (isLeave && leaveLastAbsentDate && leaveLastAbsentDate !== request.date)) ? 'Fechas Autorizadas:' : 'Fecha Autorizada:'}
                  </span>
                  <span className="font-semibold text-foreground">
                    {isVacation
                      ? `${formatLongDate(request.metadata?.start_date || request.date)} al ${formatLongDate(request.metadata?.end_date || request.date)}`
                      : isLeave && leaveLastAbsentDate && leaveLastAbsentDate !== request.date
                      ? `${formatLongDate(request.date)} al ${formatLongDate(leaveLastAbsentDate)}`
                      : formatLongDate(request.date)}
                  </span>
                </div>
              )}
              {!isBiometricIncident && !isScheduleChange && (
                <div>
                  <span className="text-muted-foreground text-[11px] block">
                    {(isLeave || isVacation) ? 'Duración:' : 'Horas Autorizadas:'}
                  </span>
                  <span className={cn("font-bold font-mono", typeConfig.accentText)}>
                    {isVacation
                      ? `${request.metadata?.days_count || (request.hours ? Math.round(request.hours / 8) : 1)} día(s)`
                      : isLeave && request.metadata?.leave_unit === 'dias'
                      ? `${request.metadata.requested_days || 1} día(s)`
                      : request.hours
                      ? `${request.hours} horas`
                      : '—'}
                  </span>
                </div>
              )}
              {!isBiometricIncident && !isVacation && !isScheduleChange && (
                <div>
                  <span className="text-muted-foreground text-[11px] block">Jornada / Horario:</span>
                  <span className="font-mono text-foreground">
                    {request.start_time || '—'} {request.end_time ? `a ${request.end_time}` : ''}
                  </span>
                </div>
              )}
              {!isVacation && !isScheduleChange && (
                <div>
                  <span className="text-muted-foreground text-[11px] block">Tipo de Trámite:</span>
                  <span className="text-foreground capitalize font-medium">
                    {(request.request_type === 'permiso_laboral' || request.metadata?.sub_type === 'permiso_laboral')
                      ? 'Permiso Laboral'
                      : isBiometricIncident
                      ? 'Marcación Biométrica'
                      : request.request_type.replace('_', ' ')}
                  </span>
                </div>
              )}

              {(request.request_type === 'permiso_laboral' || request.metadata?.sub_type === 'permiso_laboral') && request.metadata && (
                <div className="col-span-2 pt-1 text-[11px]">
                  <span className="text-muted-foreground block mb-1">Mecanismo de Compensación:</span>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 font-medium text-foreground">
                    {request.metadata.recovery_method === 'cargo_vacaciones' && 'Cargo a Vacaciones anuales'}
                    {request.metadata.recovery_method === 'descuento_dia' && 'Descuento Salarial en Rol de Pagos'}
                    {request.metadata.recovery_method === 'sin_descuento' && 'Falta Autorizada sin Descuento'}
                    {request.metadata.recovery_method === 'recuperacion_dias' && (
                      request.metadata.recovery_schedules && request.metadata.recovery_schedules.length > 0
                        ? `Recuperación en fechas y horarios acordados (${request.metadata.recovery_schedules.length} turnos)`
                        : 'Fechas de reposición pendientes por acordar'
                    )}
                    {request.metadata.recovery_method === 'reemplazo_personal' && `Reemplazo por: ${request.metadata.replacement_employee_name || 'Compañero asignado'}`}
                  </div>

                  {request.metadata.recovery_method === 'recuperacion_dias' &&
                    request.metadata.recovery_schedules &&
                    request.metadata.recovery_schedules.length > 0 && (
                      <div className="mt-2 space-y-1 rounded-lg border border-border/60 bg-muted/20 p-2">
                        {request.metadata.recovery_schedules.map((rs: LeaveRecoverySchedule, idx: number) => (
                          <div key={`${rs.date}-${idx}`} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                            <span className="font-semibold text-foreground">{formatLongDate(rs.date)}:</span>
                            <span className="font-mono text-violet-600 dark:text-violet-400 font-medium">
                              {rs.start_time && rs.end_time ? `${rs.start_time} a ${rs.end_time}` : `${rs.hours || 0} horas`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              )}

              {isScheduleChange && request.metadata?.day_changes && (
                <div className="col-span-2 pt-1 text-[11px] space-y-1.5">
                  <span className="text-muted-foreground block font-medium">
                    {request.metadata.day_changes.length === 1 ? 'Cambio de Horario:' : `Días y Horarios Modificados (${request.metadata.day_changes.length} fechas):`}
                  </span>
                  <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                    {request.metadata.day_changes.map((dc: any, idx: number) => (
                      <div key={dc.date || idx} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                        <span className="font-semibold text-foreground">{formatLongDate(dc.date)}</span>
                        <span className="font-mono text-right">
                          <span className="text-muted-foreground">{dc.original_summary || 'Horario Regular'}</span>
                          <span className="text-muted-foreground mx-1">→</span>
                          <span className="text-blue-600 dark:text-blue-400 font-semibold">
                            {dc.is_workday ? (dc.new_summary || `${dc.start_time_1} a ${dc.end_time_1}`) : 'Descanso / Libre'}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(request.request_type === 'solicitud_vacaciones' || request.metadata?.sub_type === 'solicitud_vacaciones') && request.metadata && (
                <div className="col-span-2 pt-1 text-[11px]">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5">
                    <div className="font-bold text-emerald-800 dark:text-emerald-300">
                      {request.metadata.settlement_period || 'Período Legal de Vacaciones'}
                    </div>
                    {request.metadata.available_days !== undefined && (
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-emerald-500/20 font-mono">
                        <span>Saldo previo: {request.metadata.available_days} días</span>
                        <span>Saldo restante: {request.metadata.remaining_days} días</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isOvertime && (
                <div className="col-span-2 pt-1 text-[11px]">
                  <span className="text-muted-foreground block mb-1">Contexto del Día:</span>
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 font-medium text-foreground">
                    {loadingDaySchedule ? (
                      <span className="text-muted-foreground italic">Verificando horario habitual del empleado…</span>
                    ) : !dayOwnSchedule ? (
                      <span className="text-muted-foreground italic">Sin horario base configurado para este empleado.</span>
                    ) : !dayOwnSchedule.is_workday ? (
                      <span>
                        El empleado tiene ese día <strong>libre</strong> según su horario habitual — toda la jornada
                        solicitada ({request.start_time} a {request.end_time}) es tiempo extra.
                      </span>
                    ) : (
                      <span>
                        Horario habitual ese día: <strong>{dayOwnSchedule.start_time_1} a {dayOwnSchedule.end_time_1}</strong>
                        {dayOwnSchedule.has_split_shift && dayOwnSchedule.start_time_2 && (
                          <> / <strong>{dayOwnSchedule.start_time_2} a {dayOwnSchedule.end_time_2}</strong></>
                        )}
                        . Se autorizó tiempo adicional de <strong className="text-amber-700 dark:text-amber-400">{request.start_time} a {request.end_time}</strong>.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {isBiometricIncident && request.metadata && (
                <div className="col-span-2 pt-1 text-[11px]">
                  <span className="text-muted-foreground block mb-1">Tipo de Incidencia:</span>
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 font-medium text-foreground flex items-center gap-2">
                    <Fingerprint className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                    {request.metadata.incident_type === 'sin_marcacion' && 'Sin Marcación'}
                    {request.metadata.incident_type === 'doble_marcacion' && 'Doble Marcación'}
                    {request.metadata.incident_type === 'marcacion_fuera_de_tiempo' && 'Marcación Fuera de Tiempo'}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {isRejected
                      ? 'Esta incidencia fue anulada y ya no es válida como constancia.'
                      : 'Documento informativo, no requiere aprobación.'}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 text-xs space-y-1.5">
              <span className="text-muted-foreground text-[11px] font-medium block">
                Motivo / Justificación declarada:
              </span>
              <p className="p-3 rounded-lg bg-muted/30 border border-border/60 text-foreground italic leading-relaxed">
                "{request.reason || 'Sin justificación descrita.'}"
              </p>
            </div>
          </div>
        </div>

        {/* Footer con Acciones de Aprobación */}
        <div className="p-4 border-t bg-muted/10 flex items-center justify-between gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="gap-2 cursor-pointer font-medium"
          >
            <Printer className="h-4 w-4" />
            Imprimir Solicitud
          </Button>

          <div className="flex items-center gap-2">
            {isPending && !isBiometricIncident && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleUpdateStatus('rechazado')}
                  disabled={loading}
                  className="border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 hover:text-rose-800 dark:hover:text-rose-300 hover:border-rose-300 dark:hover:border-rose-800 transition-colors cursor-pointer gap-1.5 font-medium shadow-2xs"
                >
                  <XCircle className="h-4 w-4" />
                  Rechazar
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleUpdateStatus('aprobado')}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer gap-1.5 font-semibold"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {request.request_type === 'permiso_laboral' || request.metadata?.sub_type === 'permiso_laboral'
                    ? 'Aprobar Permiso'
                    : request.request_type === 'cambio_horario' || request.metadata?.sub_type === 'cambio_horario'
                    ? 'Aprobar Cambio de Horario'
                    : 'Aprobar Solicitud'}
                </Button>
              </>
            )}

            {isBiometricIncident && isApproved && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleUpdateStatus('rechazado')}
                disabled={loading}
                className="border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 hover:text-rose-800 dark:hover:text-rose-300 hover:border-rose-300 dark:hover:border-rose-800 transition-colors cursor-pointer gap-1.5 font-medium shadow-2xs"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Anular
              </Button>
            )}

            {isRejected && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowConfirmDelete(true)}
                className="border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 hover:text-rose-800 dark:hover:text-rose-300 hover:border-rose-300 dark:hover:border-rose-800 transition-colors cursor-pointer gap-1.5 font-medium shadow-2xs"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
            )}

            {isApproved && isLeave && request.metadata?.recovery_method === 'recuperacion_dias' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openRecoveryForm}
                className="gap-1.5 font-medium cursor-pointer"
              >
                <CalendarCheck2 className="h-4 w-4" />
                {request.metadata.recovery_schedules && request.metadata.recovery_schedules.length > 0
                  ? 'Editar fechas de recuperación'
                  : 'Programar recuperación'}
              </Button>
            )}

          </div>
        </div>
      </DialogContent>

      {/* Confirmación de eliminación permanente — solo aplica a rechazadas. */}
      <Dialog open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  ¿Eliminar esta solicitud rechazada?
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  Esta acción es permanente y no se puede deshacer. La solicitud desaparecerá del listado y del
                  calendario.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogFooter className="gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowConfirmDelete(false)}
              disabled={deleting}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="cursor-pointer gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Eliminar permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Programación de fechas de recuperación — solo permisos aprobados con recovery_method='recuperacion_dias'. */}
      <Dialog open={showRecoveryForm} onOpenChange={setShowRecoveryForm}>
        <DialogContent className="sm:max-w-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Programar recuperación de días
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Registra las fechas y horarios en los que {request.employee?.full_name || 'el empleado'} repondrá el tiempo del permiso.
            </DialogDescription>
          </DialogHeader>

          {/* Contexto del permiso (qué se debe recuperar) + progreso, separados
              en su propia fila cada uno para que el texto largo nunca empuje
              al contador a envolver de forma rara. */}
          <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-3 mt-2 space-y-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {request.metadata?.leave_unit === 'dias' ? (
                <>
                  Debe recuperar <strong className="text-foreground font-semibold">{getRecoveryTargetCount()}</strong>{' '}
                  {getRecoveryTargetCount() === 1 ? 'día' : 'días'} de ausencia
                  {request.metadata?.start_date && (
                    <>
                      {' '}(permiso del{' '}
                      <strong className="text-foreground font-semibold">{formatLongDate(request.metadata.start_date)}</strong>
                      {request.metadata.end_date && request.metadata.end_date !== request.metadata.start_date && (
                        <> al <strong className="text-foreground font-semibold">{formatLongDate(request.metadata.end_date)}</strong></>
                      )}
                      )
                    </>
                  )}
                  .
                </>
              ) : (
                <>
                  Debe recuperar{' '}
                  <strong className="text-foreground font-semibold">
                    {request.metadata?.requested_hours ?? request.hours ?? 0} {(request.metadata?.requested_hours ?? request.hours) === 1 ? 'hora' : 'horas'}
                  </strong>
                  {request.metadata?.start_time && request.metadata?.end_time && (
                    <>
                      {' '}del permiso (
                      <strong className="text-foreground font-semibold">{request.metadata.start_time} a {request.metadata.end_time}</strong>
                      )
                    </>
                  )}
                  , en un turno equivalente.
                </>
              )}
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-violet-500/20">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Turnos programados
              </span>
              <span
                className={cn(
                  "font-mono font-bold text-sm tabular-nums",
                  recoveryRows.filter((r) => r.date).length === getRecoveryTargetCount()
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                )}
              >
                {recoveryRows.filter((r) => r.date).length} / {getRecoveryTargetCount()}
              </span>
            </div>
          </div>

          <div className="space-y-3 mt-3 max-h-[50vh] overflow-y-auto pr-1">
            {recoveryRows.map((row, idx) => (
              <div key={row._key} className="p-3.5 rounded-lg border border-border/60 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold text-muted-foreground">Turno {idx + 1}</Label>
                  {recoveryRows.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRecoveryRow(idx)}
                      className="h-6 w-6 text-muted-foreground hover:text-rose-600 cursor-pointer"
                      title="Eliminar turno"
                      aria-label="Eliminar turno"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span className="sr-only">Eliminar turno</span>
                    </Button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground">Fecha</Label>
                  <DatePicker
                    name={`recovery_date_${idx}`}
                    value={row.date}
                    onChange={(v) => updateRecoveryRow(idx, 'date', v)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">Hora inicio</Label>
                    <TimePicker
                      value={row.start_time || ''}
                      onChange={(v) => updateRecoveryRow(idx, 'start_time', v)}
                      placeholder="Hora inicio"
                      className="h-9 w-full justify-start"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">Hora fin</Label>
                    <TimePicker
                      value={row.end_time || ''}
                      onChange={(v) => updateRecoveryRow(idx, 'end_time', v)}
                      placeholder="Hora fin"
                      className="h-9 w-full justify-start"
                    />
                  </div>
                </div>
              </div>
            ))}

            {(request.metadata?.leave_unit !== 'dias' || recoveryRows.length < getRecoveryTargetCount()) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRecoveryRow}
                className="gap-1.5 font-medium cursor-pointer w-full"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar otra fecha
              </Button>
            )}
          </div>

          <DialogFooter className="gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowRecoveryForm(false)}
              disabled={savingRecovery}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveRecovery}
              disabled={savingRecovery}
              className="cursor-pointer gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold"
            >
              {savingRecovery && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Guardar fechas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
