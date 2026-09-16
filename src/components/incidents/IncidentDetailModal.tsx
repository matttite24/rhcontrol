'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Incident,
  IncidentStatus,
  LeaveIncidentMetadata,
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
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from '@/components/ui/toast'
import {
  Printer,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Palmtree,
  DollarSign,
  CalendarOff,
  HeartPulse,
  FileText,
  Ban,
  X,
  PackageCheck,
  FileBadge,
  GraduationCap,
} from 'lucide-react'
import { printLeavePermissionDocument } from '@/lib/shifts/print-leave-permission'
import { printWarningLetterDocument } from '@/lib/incidents/print-warning'
import { printNonCompliantDocument } from '@/lib/incidents/print-non-compliant'
import { printSalaryAdvanceDocument } from '@/lib/incidents/print-salary-advance'
import { printDeliveryActDocument } from '@/lib/incidents/print-delivery-act'
import { printWorkCertificateDocument } from '@/lib/incidents/print-work-certificate'
import { printTrainingActDocument } from '@/lib/incidents/print-training-act'
import { cancelIncidentAction, approveSalaryAdvanceAction } from '@/lib/incidents/actions'
import { getIncidentCode } from '@/lib/incidents/sequence'
import { cn } from '@/lib/utils'

// Subcomponentes de detalle modulares
import { WarningDetailContent } from './detail/WarningDetailContent'
import { DeliveryActDetailContent } from './detail/DeliveryActDetailContent'
import { SalaryAdvanceDetailContent } from './detail/SalaryAdvanceDetailContent'
import { NonCompliantDetailContent } from './detail/NonCompliantDetailContent'
import { VacationDetailContent } from './detail/VacationDetailContent'
import { LeavePermissionDetailContent } from './detail/LeavePermissionDetailContent'
import { GenericIncidentContent } from './detail/GenericIncidentContent'

interface IncidentDetailModalProps {
  incident: Incident | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusChanged?: (updated: Incident) => void
  /** Organización activa, ya resuelta server-side. Evita refetchear en cada apertura del modal. */
  organization?: Organization | null
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function formatLongDate(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  const dateObj = new Date(y, m - 1, d)

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const monthNames = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ]

  const dayName = dayNames[dateObj.getDay()]
  const dayNum = dateObj.getDate()
  const monthName = monthNames[dateObj.getMonth()]
  const year = dateObj.getFullYear()

  return `${dayName}, ${dayNum} de ${monthName} ${year}`
}

export function IncidentDetailModal({
  incident,
  open,
  onOpenChange,
  onStatusChanged,
  organization: organizationProp,
}: IncidentDetailModalProps) {
  const [loading, setLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [fetchedOrganization, setFetchedOrganization] = useState<Organization | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const orgId = incident?.organization_id

  // La organización activa normalmente llega ya resuelta desde el servidor
  // (evita un round-trip en cada apertura del modal). Solo se refetch como
  // respaldo si el padre no la pasó, o si el incidente pertenece a otra org.
  const needsFetch = !organizationProp || organizationProp.id !== orgId
  useEffect(() => {
    if (!orgId || !needsFetch) return
    async function loadOrg() {
      const { data } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single()
      if (data) setFetchedOrganization(data)
    }
    loadOrg()
  }, [orgId, needsFetch, supabase])

  const organization = needsFetch ? fetchedOrganization : organizationProp

  if (!incident) return null

  const isPending = incident.status === 'pendiente'
  const isApproved = incident.status === 'aprobado'
  const isRejected = incident.status === 'rechazado'
  const isCanceled = incident.status === 'anulado'

  const isDeliveryAct =
    incident.incident_type === 'acta_entrega' || incident.metadata?.sub_type === 'acta_entrega'
  const isWarning =
    incident.incident_type === 'llamado_atencion' || incident.metadata?.sub_type === 'llamado_atencion'
  const isSalaryAdvance =
    incident.incident_type === 'anticipo_sueldo' || incident.metadata?.sub_type === 'anticipo_sueldo'
  const isLeavePermission =
    incident.incident_type === 'permiso_laboral' || incident.metadata?.sub_type === 'permiso_laboral'
  const isVacation =
    incident.incident_type === 'solicitud_vacaciones' || incident.metadata?.sub_type === 'solicitud_vacaciones'
  const isNonCompliant =
    incident.incident_type === 'actividad_no_conforme' || incident.metadata?.sub_type === 'actividad_no_conforme'
  const isMedicalLeave =
    incident.incident_type === 'incapacidad' || incident.metadata?.sub_type === 'incapacidad'
  const isWorkCertificate =
    incident.incident_type === 'certificado_trabajo' || incident.metadata?.sub_type === 'certificado_trabajo'
  const isTrainingAct =
    incident.incident_type === 'acta_capacitacion' || incident.metadata?.sub_type === 'acta_capacitacion'

  const metadata = (incident.metadata || {}) as LeaveIncidentMetadata

  // Anular incidencia
  async function handleCancelIncident() {
    if (!incident) return
    setCancelLoading(true)

    try {
      const res = await cancelIncidentAction({
        incidentId: incident.id,
        cancellationReason: cancelReason.trim() || 'Anulado para corrección o repetición',
      })

      if (!res.success || !res.data) {
        throw new Error(res.error || 'No se pudo anular la incidencia.')
      }

      toast.success('Incidencia anulada formalmente.')
      setCancelDialogOpen(false)
      setCancelReason('')
      if (onStatusChanged) onStatusChanged(res.data)
      onOpenChange(false)
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error al anular la incidencia.')
    } finally {
      setCancelLoading(false)
    }
  }

  // Aprobar incidencia
  async function handleApprove() {
    if (!incident) return
    setLoading(true)

    try {
      if (isSalaryAdvance) {
        const res = await approveSalaryAdvanceAction(incident.id)
        if (!res.success || !res.data) {
          throw new Error(res.error || 'Error al aprobar el anticipo de sueldo.')
        }
        toast.success('Anticipo de sueldo aprobado. Se programaron las deducciones en el módulo de Nómina.')
        if (onStatusChanged) onStatusChanged(res.data)
        onOpenChange(false)
        router.refresh()
        return
      }

      let createdDeductionId: string | undefined = undefined

      if (isLeavePermission && metadata.recovery_method === 'descuento_dia') {
        const { data: salaryData } = await supabase
          .from('employee_salaries')
          .select('amount')
          .eq('employee_id', incident.employee_id)
          .eq('salary_type', 'Sueldo')
          .single()

        const baseSalary = salaryData?.amount || 460.0
        let deductionAmount = 0

        if (metadata.leave_unit === 'dias') {
          const days = metadata.requested_days || 1
          deductionAmount = Number(((baseSalary / 30) * days).toFixed(2))
        } else {
          const hours = metadata.requested_hours || 1
          deductionAmount = Number(((baseSalary / 240) * hours).toFixed(2))
        }

        const now = new Date()
        const currentMonth = now.getMonth() + 1
        const currentYear = now.getFullYear()

        const { data: deduction, error: dedError } = await supabase
          .from('deductions')
          .insert({
            organization_id: incident.organization_id,
            employee_id: incident.employee_id,
            deduction_type: 'otro',
            title: `Descuento por Permiso Laboral (${metadata.leave_unit === 'dias' ? `${metadata.requested_days} días` : `${metadata.requested_hours} hrs`})`,
            description: `Generado automáticamente por aprobación de permiso laboral: ${incident.title}. ${incident.description || ''}`,
            amount: deductionAmount,
            status: 'pendiente',
            period_month: currentMonth,
            period_year: currentYear,
            date: incident.start_date || now.toISOString().split('T')[0],
            metadata: {
              incident_id: incident.id,
              recovery_method: 'descuento_dia',
            },
          })
          .select('id')
          .single()

        if (!dedError && deduction) {
          createdDeductionId = deduction.id
        }
      }

      const updatedMetadata = {
        ...metadata,
        approved_at: new Date().toISOString(),
        ...(createdDeductionId ? { deduction_id: createdDeductionId } : {}),
      }

      const { data: updatedIncident, error: incError } = await supabase
        .from('incidents')
        .update({
          status: 'aprobado',
          metadata: updatedMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', incident.id)
        .select(
          `
          *,
          employee:employees (
            id,
            full_name,
            national_id,
            department,
            position,
            avatar_url
          )
        `
        )
        .single()

      if (incError) throw incError

      if (isLeavePermission) {
        await supabase
          .from('shift_requests')
          .update({
            status: 'aprobado',
            reviewed_at: new Date().toISOString(),
          })
          .eq('metadata->>incident_id', incident.id)
      }

      toast.success(
        isLeavePermission && metadata.recovery_method === 'descuento_dia'
          ? 'Permiso aprobado. Se generó automáticamente la deducción de sueldo.'
          : 'Incidencia aprobada exitosamente.'
      )

      if (onStatusChanged && updatedIncident) {
        onStatusChanged(updatedIncident as Incident)
      }
      onOpenChange(false)
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error al aprobar la incidencia.')
    } finally {
      setLoading(false)
    }
  }

  // Rechazar incidencia
  async function handleReject() {
    if (!incident) return
    setLoading(true)

    try {
      if (isLeavePermission) {
        await supabase
          .from('shift_requests')
          .update({
            status: 'rechazado',
            reviewed_at: new Date().toISOString(),
          })
          .eq('metadata->>incident_id', incident.id)
      }

      const { data, error } = await supabase
        .from('incidents')
        .update({
          status: 'rechazado',
          updated_at: new Date().toISOString(),
        })
        .eq('id', incident.id)
        .select(
          `
          *,
          employee:employees (
            id,
            full_name,
            national_id,
            department,
            position,
            avatar_url
          )
        `
        )
        .single()

      if (error) throw error

      toast.success('Incidencia rechazada.')
      if (onStatusChanged) onStatusChanged(data as Incident)
      onOpenChange(false)
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error al rechazar.')
    } finally {
      setLoading(false)
    }
  }

  // Imprimir documento
  function handlePrint() {
    if (!incident) return

    try {
      handlePrintInner()
    } catch (err: any) {
      console.error('Error al generar el documento:', err)
      toast.error(err?.message || 'Ocurrió un error inesperado al generar el documento.')
    }
  }

  function handlePrintInner() {
    if (!incident) return

    const docCode = getIncidentCode(incident)

    if (isLeavePermission) {
      printLeavePermissionDocument({
        organization: organization || { name: 'RH Garden' },
        organizationName: organization?.name || 'RH Garden',
        employeeName: incident.employee?.full_name || 'Empleado',
        nationalId: incident.employee?.national_id || '',
        department: incident.employee?.department || '',
        position: incident.employee?.position || '',
        leaveUnit: metadata.leave_unit || 'dias',
        startDate: incident.start_date || new Date().toISOString().split('T')[0],
        endDate: incident.end_date || undefined,
        daysCount: metadata.requested_days || 1,
        hoursCount: metadata.requested_hours || 0,
        startTime: metadata.start_time || undefined,
        endTime: metadata.end_time || undefined,
        reason: incident.description || 'Sin justificación especificada.',
        recoveryMethod: metadata.recovery_method || 'cargo_vacaciones',
        recoverySchedules: metadata.recovery_schedules || undefined,
        replacementEmployeeName: metadata.replacement_employee_name || undefined,
        documentCode: docCode,
      })
    } else if (isWarning) {
      const incMeta = (incident.metadata || {}) as any
      printWarningLetterDocument({
        organization: organization || { name: 'RH Garden' },
        organizationName: organization?.name || 'RH Garden',
        employeeName: incident.employee?.full_name || 'Empleado',
        nationalId: incident.employee?.national_id || '',
        department: incident.employee?.department || '—',
        position: incident.employee?.position || '—',
        severity: incMeta.severity || 'escrito',
        incidentDate: incident.start_date || incident.created_at?.split('T')[0] || '',
        issueDate: incMeta.issue_date || incident.created_at?.split('T')[0],
        regulationArticle: incMeta.regulation_article || 'Reglamento Interno y Código del Trabajo',
        infractionTitle: incMeta.infraction_title || incident.title,
        detailedDescription: incident.description || '',
        correctiveCommitment: incMeta.corrective_commitment || undefined,
        status: incident.status,
        documentCode: docCode,
      })
    } else if (isNonCompliant) {
      const incMeta = (incident.metadata || {}) as any
      printNonCompliantDocument({
        organization: organization || { name: 'RH Garden' },
        organizationName: organization?.name || 'RH Garden',
        employeeName: incident.employee?.full_name || 'Empleado',
        nationalId: incident.employee?.national_id || '',
        department: incident.employee?.department || '—',
        position: incident.employee?.position || '—',
        incidentDate: incident.start_date || incident.created_at?.split('T')[0] || '',
        issueDate: incMeta.issue_date || incident.created_at?.split('T')[0],
        categoryTitle: incMeta.category_title || incident.title,
        detailedDescription: incident.description || '',
        immediateCorrection: incMeta.immediate_correction || undefined,
        legalReference: incMeta.legal_reference || 'Reglamento Interno de Trabajo',
        status: incident.status,
        documentCode: docCode,
      })
    } else if (isSalaryAdvance) {
      const incMeta = (incident.metadata || {}) as any
      printSalaryAdvanceDocument({
        organization: organization || { name: 'RH Garden' },
        organizationName: organization?.name || 'RH Garden',
        employeeName: incident.employee?.full_name || 'Empleado',
        nationalId: incident.employee?.national_id || '',
        department: incident.employee?.department || '—',
        position: incident.employee?.position || '—',
        totalAmount: incident.amount || incMeta.total_amount || 0,
        modality: incMeta.modality || (incMeta.installments_count > 1 ? 'cuotas' : 'mes_actual'),
        installmentsCount: incMeta.installments_count || 1,
        installmentAmount: incMeta.installment_amount || (incident.amount || 0),
        startMonth: incMeta.start_month || new Date().getMonth() + 1,
        startYear: incMeta.start_year || new Date().getFullYear(),
        schedule: incMeta.schedule || [],
        reason: incident.description || '',
        requestDate: incMeta.request_date || incident.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        status: incident.status,
        documentCode: docCode,
      })
    } else if (isDeliveryAct) {
      const incMeta = (incident.metadata || {}) as any
      printDeliveryActDocument({
        organization: organization || { name: 'RH Garden' },
        organizationName: organization?.name || 'RH Garden',
        employeeName: incident.employee?.full_name || 'Empleado',
        nationalId: incident.employee?.national_id || '',
        department: incident.employee?.department || '—',
        position: incident.employee?.position || '—',
        deliveryDate: incident.start_date || incMeta.delivery_date || incident.created_at?.split('T')[0] || '',
        issueDate: incMeta.issue_date || incident.created_at?.split('T')[0],
        items: incMeta.items || [],
        totalAmount: incident.amount || incMeta.total_amount || 0,
        totalItemsCount: incMeta.total_items_count || (incMeta.items?.length || 1),
        notes: incMeta.notes || incident.description || '',
        discountAgreementAccepted: incMeta.discount_agreement_accepted ?? true,
        discountDisclaimerText: incMeta.discount_disclaimer_text || '',
        deliveredByName: incMeta.delivered_by_name || 'Talento Humano / Bodega',
        deliveredByPosition: incMeta.delivered_by_position || 'Administración de Activos',
        status: incident.status,
        documentCode: docCode,
      })
    } else if (isWorkCertificate) {
      console.log('[handlePrint] rama certificado_trabajo', { incident_type: incident.incident_type, sub_type: incident.metadata?.sub_type })
      const incMeta = (incident.metadata || {}) as any
      const opened = printWorkCertificateDocument({
        organization: organization || { name: 'RH Garden' },
        organizationName: organization?.name || 'RH Garden',
        employeeName: incident.employee?.full_name || 'Empleado',
        nationalId: incMeta.national_id || incident.employee?.national_id || '',
        department: incMeta.department || incident.employee?.department || '—',
        position: incMeta.position || incident.employee?.position || '—',
        hireDate: incMeta.hire_date || incident.start_date || incident.created_at?.split('T')[0] || '',
        terminationDate: incMeta.termination_date || null,
        seniorityLabel: incMeta.seniority_label || '—',
        purpose: incMeta.purpose || incident.description || undefined,
        issuedByName: incMeta.issued_by_name || undefined,
        issuedByPosition: incMeta.issued_by_position || undefined,
        documentCode: docCode,
      })
      if (!opened) {
        toast.error('El navegador bloqueó la ventana del certificado. Permite ventanas emergentes para este sitio e inténtalo de nuevo.')
      }
    } else if (isTrainingAct) {
      const incMeta = (incident.metadata || {}) as any
      printTrainingActDocument({
        organization: organization || { name: 'RH Garden' },
        organizationName: organization?.name || 'RH Garden',
        employeeName: incident.employee?.full_name || 'Empleado',
        nationalId: incMeta.national_id || incident.employee?.national_id || '',
        department: incMeta.department || incident.employee?.department || '—',
        position: incMeta.position || incident.employee?.position || '—',
        trainingDate: incident.start_date || incMeta.issue_date || incident.created_at?.split('T')[0] || '',
        trainerName: incMeta.trainer_name || '—',
        topicLabel: incMeta.topic_label || cleanIncidentTitle,
        description: incident.description || '',
        durationHours: Number(incMeta.duration_hours) || 1,
        documentCode: docCode,
      })
    } else {
      window.print()
    }
  }

  const cleanIncidentTitle = (incident.title || '').replace(/^\[[A-Z]{3}-\d+\]\s*/, '')

  const typeConfig = isDeliveryAct
    ? {
        title: 'Acta de Entrega de Bienes',
        icon: PackageCheck,
        headerBg: 'bg-indigo-500/10 border-indigo-500/20',
        badgeBg: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
        accentText: 'text-indigo-600 dark:text-indigo-400',
        primaryBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white',
      }
    : isVacation
    ? {
        title: 'Solicitud de Vacaciones',
        icon: Palmtree,
        headerBg: 'bg-emerald-500/10 border-emerald-500/20',
        badgeBg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        accentText: 'text-emerald-600 dark:text-emerald-400',
        primaryBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      }
    : isWarning
    ? {
        title: 'Llamado de Atención',
        icon: AlertCircle,
        headerBg: 'bg-rose-500/10 border-rose-500/20',
        badgeBg: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
        accentText: 'text-rose-600 dark:text-rose-400',
        primaryBtn: 'bg-rose-600 hover:bg-rose-700 text-white',
      }
    : isLeavePermission
    ? {
        title: 'Permiso Laboral / Salida',
        icon: CalendarOff,
        headerBg: 'bg-violet-500/10 border-violet-500/20',
        badgeBg: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
        accentText: 'text-violet-600 dark:text-violet-400',
        primaryBtn: 'bg-violet-600 hover:bg-violet-700 text-white',
      }
    : isNonCompliant
    ? {
        title: 'Actividad No Conforme',
        icon: AlertTriangle,
        headerBg: 'bg-amber-500/10 border-amber-500/20',
        badgeBg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
        accentText: 'text-amber-600 dark:text-amber-400',
        primaryBtn: 'bg-amber-600 hover:bg-amber-700 text-white',
      }
    : isSalaryAdvance
    ? {
        title: 'Anticipo de Sueldo',
        icon: DollarSign,
        headerBg: 'bg-blue-500/10 border-blue-500/20',
        badgeBg: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
        accentText: 'text-blue-600 dark:text-blue-400',
        primaryBtn: 'bg-blue-600 hover:bg-blue-700 text-white',
      }
    : isMedicalLeave
    ? {
        title: 'Incapacidad / Permiso Médico',
        icon: HeartPulse,
        headerBg: 'bg-purple-500/10 border-purple-500/20',
        badgeBg: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
        accentText: 'text-purple-600 dark:text-purple-400',
        primaryBtn: 'bg-purple-600 hover:bg-purple-700 text-white',
      }
    : isWorkCertificate
    ? {
        title: 'Certificado de Trabajo',
        icon: FileBadge,
        headerBg: 'bg-cyan-500/10 border-cyan-500/20',
        badgeBg: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
        accentText: 'text-cyan-600 dark:text-cyan-400',
        primaryBtn: 'bg-cyan-600 hover:bg-cyan-700 text-white',
      }
    : isTrainingAct
    ? {
        title: 'Acta de Capacitación',
        icon: GraduationCap,
        headerBg: 'bg-fuchsia-500/10 border-fuchsia-500/20',
        badgeBg: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30',
        accentText: 'text-fuchsia-600 dark:text-fuchsia-400',
        primaryBtn: 'bg-fuchsia-600 hover:bg-fuchsia-700 text-white',
      }
    : {
        title: cleanIncidentTitle || 'Detalle de Incidencia',
        icon: FileText,
        headerBg: 'bg-muted/30 border-border/60',
        badgeBg: 'bg-muted text-muted-foreground border-border',
        accentText: 'text-primary',
        primaryBtn: 'bg-primary hover:bg-primary/90 text-primary-foreground',
      }

  const TypeIcon = typeConfig.icon

  const statusBadgeMap: Record<string, { label: string; badgeClass: string }> = {
    pendiente: {
      label: 'Pendiente',
      badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/50',
    },
    registrado: {
      label: 'Registrado',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50',
    },
    aprobado: {
      label: 'Aprobado',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50',
    },
    rechazado: {
      label: 'Rechazado',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50',
    },
    anulado: {
      label: 'Anulado',
      badgeClass: 'bg-destructive/10 text-destructive border-destructive/30 dark:bg-destructive/20',
    },
  }

  const currentStatusInfo = statusBadgeMap[incident.status] || {
    label: incident.status,
    badgeClass: 'bg-muted text-muted-foreground border-border',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl p-0 overflow-hidden border-border/80 gap-0 max-h-[90vh] flex flex-col"
        showCloseButton={false}
      >
        {/* Cabecera con Tipo de incidencia, Fecha de registro, Badge de estado y Botón de cerrar */}
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
                  {getIncidentCode(incident) && (
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-background/90 border border-border shadow-2xs text-foreground shrink-0">
                      {getIncidentCode(incident)}
                    </span>
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                  Fecha de registro: {incident.created_at ? new Date(incident.created_at).toLocaleDateString('es-EC') : '—'}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <Badge
                variant="outline"
                className={cn("text-xs font-medium border capitalize", currentStatusInfo.badgeClass)}
              >
                {currentStatusInfo.label}
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

        {/* Banner de Anulado si aplica */}
        {isCanceled && (
          <div className="bg-destructive/10 border-b border-destructive/20 px-6 py-2.5 flex items-center justify-between text-xs text-destructive">
            <div className="flex items-center gap-2 font-medium">
              <Ban className="h-4 w-4 shrink-0" />
              <span>
                Este registro se encuentra <strong>ANULADO</strong>. No tiene validez disciplinaria activa.
              </span>
            </div>
            {incident.metadata?.cancellation_reason && (
              <span className="text-[11px] text-muted-foreground italic truncate max-w-xs">
                Motivo: {incident.metadata.cancellation_reason}
              </span>
            )}
          </div>
        )}

        {/* Formato y detalles */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Datos del empleado */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/70">
            <Avatar className="h-10 w-10 ring-1 ring-border shrink-0">
              <AvatarImage src={incident.employee?.avatar_url ?? undefined} alt={incident.employee?.full_name} />
              <AvatarFallback className="text-xs font-semibold">
                {getInitials(incident.employee?.full_name || 'E')}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground truncate">
                {incident.employee?.full_name || 'Empleado'}
              </div>
              <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                CI: {incident.employee?.national_id || '—'} • {incident.employee?.position || incident.employee?.department || 'Personal'}
              </div>
            </div>
          </div>

          {/* Subcomponente según el tipo de incidencia */}
          {isWarning ? (
            <WarningDetailContent
              incident={incident}
              formatLongDate={formatLongDate}
              isCanceled={isCanceled}
            />
          ) : isVacation ? (
            <VacationDetailContent
              incident={incident}
              formatLongDate={formatLongDate}
            />
          ) : isNonCompliant ? (
            <NonCompliantDetailContent
              incident={incident}
              formatLongDate={formatLongDate}
              isCanceled={isCanceled}
            />
          ) : isSalaryAdvance ? (
            <SalaryAdvanceDetailContent
              incident={incident}
              formatLongDate={formatLongDate}
              isApproved={isApproved}
              isRejected={isRejected}
              isCanceled={isCanceled}
            />
          ) : isDeliveryAct ? (
            <DeliveryActDetailContent
              incident={incident}
              formatLongDate={formatLongDate}
            />
          ) : isLeavePermission ? (
            <LeavePermissionDetailContent
              incident={incident}
              metadata={metadata}
              formatLongDate={formatLongDate}
              isApproved={isApproved}
            />
          ) : (
            <GenericIncidentContent
              incident={incident}
              formatLongDate={formatLongDate}
            />
          )}
        </div>

        {/* Footer con Acciones de Aprobación */}
        <div className="p-4 border-t bg-muted/10 flex items-center justify-between gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={isRejected || isCanceled || loading || cancelLoading}
            className="gap-2 cursor-pointer font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            title={isRejected ? 'No disponible para solicitudes rechazadas' : isCanceled ? 'No disponible para solicitudes anuladas' : undefined}
          >
            <Printer className="h-4 w-4" />
            Imprimir Formato
          </Button>

          <div className="flex items-center gap-2">
            {!isCanceled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCancelDialogOpen(true)}
                disabled={loading || cancelLoading}
                className="border-border/80 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-colors cursor-pointer gap-1.5 font-medium text-xs"
              >
                <Ban className="h-3.5 w-3.5" />
                {isWarning ? 'Anular Llamado' : 'Anular'}
              </Button>
            )}

            {isPending && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReject}
                  disabled={loading || cancelLoading}
                  className="border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 hover:text-rose-800 dark:hover:text-rose-300 hover:border-rose-300 dark:hover:border-rose-800 transition-colors cursor-pointer gap-1.5 font-medium shadow-2xs"
                >
                  <XCircle className="h-4 w-4" />
                  Rechazar
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleApprove}
                  disabled={loading || cancelLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer gap-1.5 font-semibold"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {isLeavePermission
                    ? 'Aprobar Permiso'
                    : isVacation
                    ? 'Aprobar Vacaciones'
                    : isSalaryAdvance
                    ? 'Aprobar Anticipo'
                    : 'Aprobar Incidencia'}
                </Button>
              </>
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

      {/* Modal de confirmación de anulación */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2.5 text-destructive mb-1">
              <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 shrink-0">
                <Ban className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base font-bold">
                {isWarning ? '¿Anular este Llamado de Atención?' : '¿Anular esta Incidencia?'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-1 space-y-3">
              <span className="block leading-relaxed">
                Al anular este documento, quedará invalidado formalmente en el expediente del empleado para permitir su repetición o corrección sin duplicidad de sanciones.
              </span>
              <span className="space-y-1.5 text-left block">
                <label className="text-xs font-semibold text-foreground block">
                  Motivo de anulación (opcional):
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ej: Error en fecha, causal incorrecta o acuerdo de repetición..."
                  className="w-full h-8 px-3 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={cancelLoading}
              onClick={() => setCancelDialogOpen(false)}
              className="text-xs h-9 cursor-pointer"
            >
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={cancelLoading}
              onClick={handleCancelIncident}
              className="text-xs h-9 font-semibold gap-1.5 cursor-pointer"
            >
              {cancelLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Anulando...
                </>
              ) : (
                <>
                  <Ban className="h-3.5 w-3.5" />
                  Confirmar Anulación
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
