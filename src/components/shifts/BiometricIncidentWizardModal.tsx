'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Employee, ShiftRequest, BiometricIncidentType, BiometricIncidentMetadata, Organization } from '@/types/employee'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import {
  Fingerprint,
  Printer,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertTriangle,
  XCircle,
  Copy,
  Clock,
} from 'lucide-react'
import { printBiometricIncidentDocument } from '@/lib/shifts/print-biometric-incident'
import { createBiometricIncidentAction } from '@/lib/shifts/actions'
import { getInitials, formatLongDate } from '@/lib/shifts/format'
import { EmployeePickerStep } from '@/components/shared/EmployeePickerStep'
import { pushRecentEmployeeId } from '@/lib/shifts/recent-employees'
import { cn } from '@/lib/utils'

interface BiometricIncidentTypeOption {
  value: BiometricIncidentType
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const BIOMETRIC_INCIDENT_TYPES: BiometricIncidentTypeOption[] = [
  {
    value: 'sin_marcacion',
    label: 'Sin Marcación',
    description: 'El empleado no marcó entrada/salida (falla del equipo, corte de luz, olvido, diligencia externa).',
    icon: XCircle,
  },
  {
    value: 'doble_marcacion',
    label: 'Doble Marcación',
    description: 'El biométrico registró dos marcaciones erróneas para el mismo evento.',
    icon: Copy,
  },
  {
    value: 'marcacion_fuera_de_tiempo',
    label: 'Marcación Fuera de Tiempo',
    description: 'La marcación se registró con una diferencia significativa respecto al horario real.',
    icon: Clock,
  },
]

interface BiometricIncidentWizardModalProps {
  organizationId: string
  organizationName?: string
  employees: Employee[]
  // El <Dialog> raíz vive en el launcher (NewShiftRequestButton). Ver
  // OvertimeWizardModal para la explicación completa.
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  onRegisterRequestClose?: (fn: () => void) => void
}

export function BiometricIncidentWizardModal({
  organizationId,
  organizationName = 'RH Garden',
  employees,
  onOpenChange,
  onSuccess,
  onRegisterRequestClose,
}: BiometricIncidentWizardModalProps) {
  const router = useRouter()
  const supabase = createClient()

  // Pasos: 1 = Empleado y fecha, 2 = Tipo de error y motivo, 3 = Confirmación e impresión
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  const [selectedEmpId, setSelectedEmpId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [incidentDate, setIncidentDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [incidentType, setIncidentType] = useState<BiometricIncidentType>('sin_marcacion')
  const [reason, setReason] = useState('')

  const [createdRequest, setCreatedRequest] = useState<ShiftRequest | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)

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

  function handleReset() {
    setStep(1)
    setSelectedEmpId('')
    setSearchQuery('')
    setIncidentDate(new Date().toISOString().split('T')[0])
    setIncidentType('sin_marcacion')
    setReason('')
    setCreatedRequest(null)
  }

  function handleRequestClose() {
    if (selectedEmpId || reason.trim() || step > 1) {
      if (step === 3 && createdRequest) {
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

  useEffect(() => {
    onRegisterRequestClose?.(handleRequestClose)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmpId, reason, step, createdRequest])

  function forceClose() {
    setShowConfirmClose(false)
    handleReset()
    onOpenChange(false)
  }

  async function handleCreateIncident() {
    if (!selectedEmpId || !selectedEmp) {
      toast.error('Selecciona un empleado.')
      return
    }

    if (!reason.trim()) {
      toast.error('Ingresa el motivo de la incidencia.')
      return
    }

    setLoading(true)

    try {
      const typeLabel = BIOMETRIC_INCIDENT_TYPES.find((t) => t.value === incidentType)?.label || 'Incidencia'
      const title = `Marcación Biométrica: ${typeLabel} (${incidentDate})`

      const metadata: BiometricIncidentMetadata = {
        employee_id: selectedEmpId,
        employee_name: selectedEmp.full_name,
        national_id: selectedEmp.national_id || undefined,
        department: selectedEmp.department || undefined,
        position: selectedEmp.position || undefined,
        incident_type: incidentType,
        reason: reason.trim(),
      }

      const targetOrgId = organizationId || selectedEmp.organization_id || ''
      if (!targetOrgId) {
        toast.error('No se detectó la empresa activa para este empleado.')
        return
      }

      const res = await createBiometricIncidentAction({
        organizationId: targetOrgId,
        employeeId: selectedEmpId,
        title,
        reason: reason.trim(),
        date: incidentDate,
        metadata,
      })

      if (!res.success || !res.data) {
        throw new Error(res.error || 'Error al guardar la incidencia de marcación')
      }

      setCreatedRequest(res.data)
      setStep(3)
      toast.success('Incidencia de marcación registrada como constancia informativa.')
      if (onSuccess) onSuccess()
      router.refresh()
    } catch (err: any) {
      console.error('Error al registrar incidencia de marcación:', err)
      toast.error(err.message || 'No se pudo guardar la incidencia')
    } finally {
      setLoading(false)
    }
  }

  function handlePrintDocument() {
    printBiometricIncidentDocument({
      organization: organization || { name: organizationName },
      organizationName,
      employeeName: selectedEmp?.full_name || 'Empleado',
      nationalId: selectedEmp?.national_id || '',
      department: selectedEmp?.department || '',
      position: selectedEmp?.position || '',
      date: incidentDate,
      incidentType,
      reason: reason.trim(),
      documentCode: createdRequest?.metadata?.document_code,
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
        <DialogHeader className="p-5 pb-4 border-b bg-muted/20 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <Fingerprint className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Marcación Biométrica
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Constancia informativa para justificar errores del biométrico
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

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* PASO 1: Empleado */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">
                  Paso 1: Selecciona el empleado
                </h3>
                <p className="text-xs text-muted-foreground">
                  Elige al empleado que presenta la incidencia de marcación.
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
                maxHeight="260px"
              />
            </div>
          )}

          {/* PASO 2: Fecha, tipo de error y motivo */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">
                  Paso 2: Fecha, tipo de error y motivo
                </h3>
                <p className="text-xs text-muted-foreground">
                  Indica cuándo ocurrió, qué ocurrió con la marcación y describe el motivo.
                </p>
              </div>

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
                      <span className="text-[11px] text-muted-foreground truncate">
                        {selectedEmp.position || selectedEmp.department || 'Empleado'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="incident_date" className="text-xs font-medium">
                  Fecha de la incidencia *
                </Label>
                <DatePicker
                  id="incident_date"
                  name="incident_date"
                  value={incidentDate}
                  onChange={setIncidentDate}
                  placeholder="Seleccionar fecha"
                />
              </div>

              <div className="space-y-2">
                {BIOMETRIC_INCIDENT_TYPES.map((opt) => {
                  const Icon = opt.icon
                  const isSelected = incidentType === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setIncidentType(opt.value)}
                      className={cn(
                        "w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer",
                        isSelected
                          ? "bg-rose-500/10 border-rose-500 ring-1 ring-rose-500/30"
                          : "bg-card hover:bg-muted/50 border-border/60"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", isSelected ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")} />
                      <div className="text-xs">
                        <span className="font-semibold text-foreground">{opt.label}</span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{opt.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="space-y-1.5 pt-1">
                <Label htmlFor="reason" className="text-xs font-medium">
                  Motivo / Justificación *
                </Label>
                <textarea
                  id="reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej. Corte de luz en el área de marcación, salida a diligencia de la empresa, falla del lector biométrico..."
                  className="w-full rounded-md border border-input bg-transparent p-3 text-xs text-foreground focus:ring-1 focus:ring-ring resize-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* PASO 3: Confirmación e impresión */}
          {step === 3 && createdRequest && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold">¡Incidencia registrada exitosamente!</span>
                  <p className="mt-0.5 opacity-90">
                    Constancia informativa guardada. No requiere aprobación adicional.
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-xl border bg-card shadow-xs space-y-3 text-xs">
                <div className="flex items-center justify-between border-b pb-2.5">
                  <div>
                    <h4 className="font-bold text-foreground text-sm uppercase tracking-wide">
                      {organizationName}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">Marcación Biométrica</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono">
                    Informativo
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <div>Empleado: <span className="font-semibold text-foreground">{selectedEmp?.full_name}</span></div>
                  <div>Cédula: <span className="font-mono text-foreground">{selectedEmp?.national_id || '—'}</span></div>
                  <div>Fecha: <span className="font-mono text-foreground">{formatLongDate(incidentDate)}</span></div>
                  <div>
                    Tipo: <span className="font-semibold text-foreground">
                      {BIOMETRIC_INCIDENT_TYPES.find((t) => t.value === incidentType)?.label}
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

        <div className="p-4 border-t bg-muted/10 flex items-center justify-between gap-3 shrink-0">
          <div>
            {step > 1 && step < 3 ? (
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
                {step === 3 ? 'Cerrar' : 'Cancelar'}
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
                Siguiente: Fecha y Motivo
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}

            {step === 2 && (
              <Button
                type="button"
                size="sm"
                onClick={handleCreateIncident}
                disabled={loading || !incidentDate || !reason.trim()}
                className="gap-1.5 cursor-pointer font-semibold bg-rose-600 hover:bg-rose-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Registrar Incidencia
                  </>
                )}
              </Button>
            )}

            {step === 3 && (
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
      </div>

      <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  ¿Descartar esta incidencia?
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  Tienes datos ingresados en el formulario. Si sales ahora, se perderá la información no guardada.
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
