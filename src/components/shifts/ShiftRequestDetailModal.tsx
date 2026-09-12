'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShiftRequest, ShiftRequestStatus, Organization } from '@/types/employee'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from '@/components/ui/toast'
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
} from 'lucide-react'
import { deleteRejectedShiftRequestAction } from '@/lib/shifts/actions'
import { printOvertimeDocument } from '@/lib/shifts/print-overtime'
import { printLeavePermissionDocument } from '@/lib/shifts/print-leave-permission'
import { printScheduleChangeDocument } from '@/lib/shifts/print-schedule-change'
import { printVacationDocument } from '@/lib/shifts/print-vacation'
import { LeaveIncidentMetadata, ScheduleChangeMetadata, VacationRequestMetadata } from '@/types/employee'
import { SHIFT_REQUEST_STATUS_MAP } from '@/lib/shifts/constants'
import { getShiftRequestCode } from '@/lib/incidents/sequence'
import { getInitials, formatLongDate } from '@/lib/shifts/format'
import { cn } from '@/lib/utils'

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
        } else {
          toast.success('Permiso laboral aprobado con éxito.')
        }
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

  const statusInfo = SHIFT_REQUEST_STATUS_MAP[request.status] ?? SHIFT_REQUEST_STATUS_MAP.pendiente

  const isLeave = request.request_type === 'permiso_laboral' || request.metadata?.sub_type === 'permiso_laboral'
  const isScheduleChange = request.request_type === 'cambio_horario' || request.metadata?.sub_type === 'cambio_horario'
  const isVacation = request.request_type === 'solicitud_vacaciones' || request.metadata?.sub_type === 'solicitud_vacaciones'
  const isOvertime = request.request_type === 'horas_extras'

  const typeConfig = isVacation
    ? {
        title: 'Solicitud de Vacaciones',
        icon: Palmtree,
        headerBg: 'bg-emerald-500/10 border-emerald-500/20',
        badgeBg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        accentText: 'text-emerald-600 dark:text-emerald-400',
        primaryBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
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

  const TypeIcon = typeConfig.icon
  const docCode = getShiftRequestCode(request)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl p-0 overflow-hidden border-border/80 gap-0 max-h-[90vh] flex flex-col"
        showCloseButton={false}
      >
        {/* Cabecera con Tipo de solicitud, Fecha de registro y Estado */}
        <DialogHeader className={cn("p-6 pb-4 border-b shrink-0 transition-colors", typeConfig.headerBg)}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn("p-2.5 rounded-xl border shrink-0 bg-background/80 shadow-2xs", typeConfig.accentText)}>
                <TypeIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base font-bold text-foreground truncate">
                    {typeConfig.title}
                  </DialogTitle>
                  {docCode && (
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-background/90 border border-border shadow-2xs text-foreground shrink-0">
                      {docCode}
                    </span>
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                  Fecha de registro: {new Date(request.created_at).toLocaleDateString('es-EC')}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <Badge
                variant="outline"
                className={cn("text-xs font-medium border capitalize", statusInfo.badgeClass)}
              >
                {statusInfo.label}
              </Badge>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                title="Cerrar"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Cerrar</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

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
              <div>
                <span className="text-muted-foreground text-[11px] block">Fecha Autorizada:</span>
                <span className="font-semibold text-foreground">{formatLongDate(request.date)}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] block">
                  {(request.request_type === 'permiso_laboral' || request.metadata?.sub_type === 'permiso_laboral') ? 'Duración:' : 'Horas Autorizadas:'}
                </span>
                <span className={cn("font-bold font-mono", typeConfig.accentText)}>
                  {request.hours ? `${request.hours} horas` : '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] block">Jornada / Horario:</span>
                <span className="font-mono text-foreground">
                  {request.start_time || '—'} {request.end_time ? `a ${request.end_time}` : ''}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] block">Tipo de Trámite:</span>
                <span className="text-foreground capitalize font-medium">
                  {(request.request_type === 'permiso_laboral' || request.metadata?.sub_type === 'permiso_laboral')
                    ? 'Permiso Laboral'
                    : request.request_type.replace('_', ' ')}
                </span>
              </div>

              {(request.request_type === 'permiso_laboral' || request.metadata?.sub_type === 'permiso_laboral') && request.metadata && (
                <div className="col-span-2 pt-1 text-[11px]">
                  <span className="text-muted-foreground block mb-1">Mecanismo de Compensación:</span>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 font-medium text-foreground">
                    {request.metadata.recovery_method === 'cargo_vacaciones' && 'Cargo a Vacaciones anuales'}
                    {request.metadata.recovery_method === 'descuento_dia' && 'Descuento Salarial en Rol de Pagos'}
                    {request.metadata.recovery_method === 'recuperacion_dias' && `Recuperación en fechas y horarios acordados (${request.metadata.recovery_schedules?.length || 0} turnos)`}
                    {request.metadata.recovery_method === 'reemplazo_personal' && `Reemplazo por: ${request.metadata.replacement_employee_name || 'Compañero asignado'}`}
                  </div>
                </div>
              )}

              {(request.request_type === 'cambio_horario' || request.metadata?.sub_type === 'cambio_horario') && request.metadata?.day_changes && (
                <div className="col-span-2 pt-1 text-[11px] space-y-1.5">
                  <span className="text-muted-foreground block font-medium">Días y Horarios Modificados ({request.metadata.day_changes.length} fechas):</span>
                  <div className="space-y-1 rounded-lg border border-border/60 bg-muted/20 p-2">
                    {request.metadata.day_changes.map((dc: any, idx: number) => (
                      <div key={dc.date || idx} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                        <span className="font-semibold text-foreground">{formatLongDate(dc.date)}:</span>
                        <span className="font-mono text-blue-600 dark:text-blue-400 font-medium">
                          {dc.is_workday ? (dc.new_summary || `${dc.start_time_1} a ${dc.end_time_1}`) : 'Descanso / Libre'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(request.request_type === 'solicitud_vacaciones' || request.metadata?.sub_type === 'solicitud_vacaciones') && request.metadata && (
                <div className="col-span-2 pt-1 text-[11px] space-y-2">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-800 dark:text-emerald-300">
                        {request.metadata.settlement_period || 'Período Legal de Vacaciones'}
                      </span>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {request.metadata.days_count || (request.hours ? Math.round(request.hours / 8) : 1)} días solicitados
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      Fecha de salida: <strong>{formatLongDate(request.metadata.start_date || request.date)}</strong> al <strong>{formatLongDate(request.metadata.end_date || request.date)}</strong>
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
            {isPending && (
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

            {!isPending && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="cursor-pointer"
              >
                Cerrar
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
    </Dialog>
  )
}
