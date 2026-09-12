'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Employee, Incident } from '@/types/employee'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import {
  FileBadge,
  Printer,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Search,
  AlertTriangle,
  CalendarCheck2,
  CalendarX2,
  Info,
} from 'lucide-react'
import { printWorkCertificateDocument } from '@/lib/incidents/print-work-certificate'
import { createWorkCertificateAction } from '@/lib/incidents/actions'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface WorkCertificateWizardModalProps {
  organizationId: string
  organizationName?: string
  employees: Employee[]
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  onRegisterRequestClose?: (fn: () => void) => void
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

/** Calcula la antigüedad entre dos fechas (o hasta hoy) en un texto legible: "3 años, 4 meses". */
function calculateSeniorityLabel(hireDateStr: string, endDateStr?: string | null): string {
  if (!hireDateStr) return '—'
  const [hy, hm, hd] = hireDateStr.split('-').map(Number)
  if (!hy || !hm || !hd) return '—'
  const hireDate = new Date(hy, hm - 1, hd)

  let endDate: Date
  if (endDateStr) {
    const [ey, em, ed] = endDateStr.split('-').map(Number)
    endDate = ey && em && ed ? new Date(ey, em - 1, ed) : new Date()
  } else {
    endDate = new Date()
  }

  if (endDate < hireDate) return '—'

  let years = endDate.getFullYear() - hireDate.getFullYear()
  let months = endDate.getMonth() - hireDate.getMonth()
  let days = endDate.getDate() - hireDate.getDate()

  if (days < 0) {
    months -= 1
    const prevMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0)
    days += prevMonth.getDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }

  const parts: string[] = []
  if (years > 0) parts.push(`${years} ${years === 1 ? 'año' : 'años'}`)
  if (months > 0) parts.push(`${months} ${months === 1 ? 'mes' : 'meses'}`)
  if (parts.length === 0) parts.push(`${Math.max(days, 0)} ${days === 1 ? 'día' : 'días'}`)

  return parts.join(', ')
}

export function WorkCertificateWizardModal({
  organizationId,
  organizationName = 'RH Garden',
  employees,
  onOpenChange,
  onSuccess,
  onRegisterRequestClose,
}: WorkCertificateWizardModalProps) {
  const router = useRouter()
  const supabase = createClient()

  const [organization, setOrganization] = useState<any>(null)

  useEffect(() => {
    const targetOrgId = organizationId || employees[0]?.organization_id
    if (!targetOrgId) return
    async function loadOrg() {
      const { data } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', targetOrgId)
        .single()
      if (data) setOrganization(data)
    }
    loadOrg()
  }, [organizationId, employees, supabase])

  // Pasos: 1. Empleado, 2. Estado laboral y propósito, 3. Confirmación e impresión
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [searchEmp, setSearchEmp] = useState('')
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)

  // Paso 2: el sistema sugiere el estado real del empleado (activo/inactivo)
  // según su registro, pero permite confirmar/ajustar la fecha de salida.
  const [stillWorking, setStillWorking] = useState(true)
  const [stillWorkingTouched, setStillWorkingTouched] = useState(false)
  const [terminationDate, setTerminationDate] = useState<string>('')
  const [purpose, setPurpose] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [createdIncident, setCreatedIncident] = useState<Incident | null>(null)
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  // Al elegir un empleado, sugerir su estado real (activo vs. ya finalizado)
  // según employees.status / termination_date, mientras el usuario no lo
  // haya ajustado manualmente.
  useEffect(() => {
    if (!selectedEmp || stillWorkingTouched) return
    const isInactive = selectedEmp.status === 'inactivo'
    setStillWorking(!isInactive)
    setTerminationDate(isInactive ? (selectedEmp.termination_date || '') : '')
  }, [selectedEmp, stillWorkingTouched])

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const term = searchEmp.toLowerCase().trim()
      if (!term) return true
      return (
        emp.full_name.toLowerCase().includes(term) ||
        (emp.national_id && emp.national_id.includes(term)) ||
        (emp.department && emp.department.toLowerCase().includes(term)) ||
        (emp.position && emp.position.toLowerCase().includes(term))
      )
    })
  }, [employees, searchEmp])

  const seniorityLabel = useMemo(() => {
    if (!selectedEmp?.hire_date) return '—'
    return calculateSeniorityLabel(selectedEmp.hire_date, stillWorking ? null : terminationDate)
  }, [selectedEmp, stillWorking, terminationDate])

  function resetState() {
    setStep(1)
    setSelectedEmp(null)
    setSearchEmp('')
    setStillWorking(true)
    setStillWorkingTouched(false)
    setTerminationDate('')
    setPurpose('')
    setCreatedIncident(null)
  }

  function handleRequestClose() {
    if (selectedEmp || purpose.trim() || step > 1) {
      if (step === 3) {
        resetState()
        onOpenChange(false)
      } else {
        setShowConfirmClose(true)
      }
    } else {
      resetState()
      onOpenChange(false)
    }
  }

  function forceClose() {
    setShowConfirmClose(false)
    resetState()
    onOpenChange(false)
  }

  // Publicar handleRequestClose hacia el padre para que Escape/click-fuera
  // en el Dialog raíz compartido respeten esta misma confirmación.
  useEffect(() => {
    onRegisterRequestClose?.(handleRequestClose)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmp, purpose, step])

  async function handleCreateCertificate() {
    if (!selectedEmp) {
      toast.error('Selecciona un empleado.')
      return
    }
    if (!stillWorking && !terminationDate) {
      toast.error('Ingresa la fecha en que finalizó la relación laboral.')
      return
    }

    setSubmitting(true)
    try {
      const res = await createWorkCertificateAction({
        organizationId: organizationId || selectedEmp.organization_id,
        employeeId: selectedEmp.id,
        purpose: purpose.trim(),
        metadata: {
          hire_date: selectedEmp.hire_date,
          termination_date: stillWorking ? null : terminationDate,
          seniority_label: seniorityLabel,
          national_id: selectedEmp.national_id,
          department: selectedEmp.department,
          position: selectedEmp.position,
        },
      })

      if (!res.success || !res.data) {
        throw new Error(res.error || 'No se pudo generar el certificado de trabajo.')
      }

      setCreatedIncident(res.data)
      setStep(3)
      toast.success('Certificado de trabajo generado y registrado con éxito.')
      if (onSuccess) onSuccess()
      router.refresh()
    } catch (err: any) {
      console.error('Error creando certificado de trabajo:', err)
      toast.error(err.message || 'Error al generar el certificado.')
    } finally {
      setSubmitting(false)
    }
  }

  function handlePrint() {
    if (!selectedEmp) {
      toast.error('No se encontró el empleado seleccionado.')
      return
    }

    const opened = printWorkCertificateDocument({
      organization: organization || { name: organizationName },
      organizationName,
      employeeName: selectedEmp.full_name,
      nationalId: selectedEmp.national_id || '',
      department: selectedEmp.department || '—',
      position: selectedEmp.position || '—',
      hireDate: selectedEmp.hire_date || '',
      terminationDate: stillWorking ? null : terminationDate,
      seniorityLabel,
      purpose: purpose.trim(),
      documentCode: createdIncident?.metadata?.document_code,
    })

    if (!opened) {
      toast.error('El navegador bloqueó la ventana del certificado. Permite ventanas emergentes para este sitio e inténtalo de nuevo.')
    }
  }

  return (
    <>
      <div
        className={cn(
          'flex flex-col flex-1 min-h-0 transition-[filter] duration-200 ease-out motion-reduce:transition-none',
          showConfirmClose && 'blur-[6px] pointer-events-none'
        )}
      >
      {/* El <DialogContent> único vive en el launcher. Ver OvertimeWizardModal (Turnos). */}
          <DialogHeader className="p-5 pb-4 bg-cyan-500/10 border-b border-cyan-500/20 text-left shrink-0 pr-12">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 shrink-0">
                <FileBadge className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold text-foreground truncate">
                  Certificado de Trabajo
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                  Documento formal de antigüedad, cargo y estado laboral
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* PASO 1: SELECCIONAR EMPLEADO */}
            {step === 1 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">
                    1. Seleccionar Empleado
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    {employees.length} empleados disponibles
                  </span>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, cédula, cargo o departamento..."
                    value={searchEmp}
                    onChange={(e) => setSearchEmp(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>

                <div className="border rounded-xl divide-y max-h-[320px] overflow-y-auto bg-card/40">
                  {filteredEmployees.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      No se encontraron empleados con esa búsqueda.
                    </div>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const isSelected = selectedEmp?.id === emp.id
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => setSelectedEmp(emp)}
                          className={cn(
                            "w-full text-left p-3 flex items-center justify-between transition-colors cursor-pointer text-xs",
                            isSelected
                              ? "bg-cyan-500/10 border-l-4 border-l-cyan-500 dark:bg-cyan-950/30"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-8 w-8 border border-border shrink-0">
                              <AvatarImage src={emp.avatar_url || ''} />
                              <AvatarFallback className="text-[10px] bg-muted font-bold">
                                {getInitials(emp.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">
                                {emp.full_name}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {emp.position || 'Sin cargo'} • {emp.department || 'General'}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <Badge
                              variant={emp.status === 'inactivo' ? 'secondary' : 'outline'}
                              className="text-[10px] mb-0.5"
                            >
                              {emp.status === 'inactivo' ? 'Inactivo' : emp.status === 'prueba' ? 'En prueba' : 'Activo'}
                            </Badge>
                            {isSelected && (
                              <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 block">
                                Seleccionado
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* PASO 2: ESTADO LABORAL Y PROPÓSITO */}
            {step === 2 && selectedEmp && (
              <div className="space-y-4">
                {/* Resumen del empleado */}
                <div className="p-3.5 rounded-xl bg-muted/40 border flex items-center gap-2.5 text-xs">
                  <Avatar className="h-9 w-9 border">
                    <AvatarImage src={selectedEmp.avatar_url || ''} />
                    <AvatarFallback className="text-[10px] font-bold">
                      {getInitials(selectedEmp.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <span className="font-bold text-foreground block truncate">
                      {selectedEmp.full_name}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate block">
                      {selectedEmp.position || '—'} • {selectedEmp.department || '—'} • C.I.: {selectedEmp.national_id || '—'}
                    </span>
                  </div>
                </div>

                {/* Estado laboral: ¿sigue laborando hasta la fecha o ya finalizó? */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-foreground">
                    Estado Laboral Actual *
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setStillWorking(true)
                        setStillWorkingTouched(true)
                      }}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1",
                        stillWorking
                          ? "bg-emerald-500/10 border-emerald-500 text-foreground ring-1 ring-emerald-500/30"
                          : "bg-card hover:bg-muted/40 border-border/60"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <CalendarCheck2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-bold text-foreground">
                          Labora hasta la fecha
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Continúa activo en la empresa; el certificado indicará relación laboral vigente.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStillWorking(false)
                        setStillWorkingTouched(true)
                        if (!terminationDate) {
                          setTerminationDate(selectedEmp.termination_date || new Date().toISOString().split('T')[0])
                        }
                      }}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1",
                        !stillWorking
                          ? "bg-slate-500/10 border-slate-500 text-foreground ring-1 ring-slate-500/30"
                          : "bg-card hover:bg-muted/40 border-border/60"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <CalendarX2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        <span className="text-xs font-bold text-foreground">
                          Relación finalizada
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Ya no labora en la empresa; se debe indicar la fecha de salida.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Fecha de salida (solo si ya finalizó) */}
                {!stillWorking && (
                  <div className="space-y-1.5">
                    <Label htmlFor="termination_date" className="text-xs font-medium">
                      Fecha de Finalización de la Relación Laboral *
                    </Label>
                    <DatePicker
                      id="termination_date"
                      name="termination_date"
                      value={terminationDate}
                      onChange={(val) => setTerminationDate(val)}
                      placeholder="Seleccionar fecha de salida"
                    />
                  </div>
                )}

                {/* Resumen de antigüedad calculada */}
                <div className="p-3.5 rounded-xl border bg-cyan-500/5 border-cyan-500/20 flex items-center justify-between">
                  <div className="text-xs">
                    <span className="text-muted-foreground block">Fecha de Ingreso</span>
                    <span className="font-semibold text-foreground">
                      {selectedEmp.hire_date || 'Sin registrar'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                      Tiempo de Servicio
                    </span>
                    <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400 text-sm">
                      {seniorityLabel}
                    </span>
                  </div>
                </div>

                {/* Propósito del certificado */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Motivo del Certificado (Opcional)
                  </Label>
                  <textarea
                    rows={2}
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Ej. trámites bancarios, migratorios, académicos..."
                    className="w-full p-2.5 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* PASO 3: CONFIRMACIÓN E IMPRESIÓN */}
            {step === 3 && (
              <div className="space-y-4 py-2">
                <div className="flex flex-col items-center justify-center text-center p-5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                  <div className="p-3 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 mb-2">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    Certificado Generado y Registrado
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    Queda constancia de la emisión de este certificado en el historial del empleado.
                  </p>
                </div>

                <div className="p-4 rounded-xl border bg-card text-xs space-y-2.5">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground text-[11px]">Empleado:</span>
                    <span className="font-bold text-foreground">{selectedEmp?.full_name}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground text-[11px]">Estado Laboral:</span>
                    <Badge variant={stillWorking ? 'default' : 'secondary'} className="text-[11px]">
                      {stillWorking ? 'Labora Actualmente' : 'Relación Finalizada'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">Tiempo de Servicio:</span>
                    <span className="font-bold font-mono text-sm text-foreground">
                      {seniorityLabel}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border bg-muted/20 text-xs text-muted-foreground flex items-center gap-2">
                  <Info className="h-4 w-4 text-cyan-600 shrink-0" />
                  <span>
                    Imprime el certificado formal para su firma y entrega al colaborador.
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t bg-muted/10 flex items-center justify-between gap-2 shrink-0">
            {step === 1 && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRequestClose}
                  className="text-xs cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!selectedEmp}
                  onClick={() => setStep(2)}
                  className="text-xs gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold cursor-pointer"
                >
                  Continuar
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(1)}
                  disabled={submitting}
                  className="text-xs gap-1 cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Atrás
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={submitting || (!stillWorking && !terminationDate)}
                  onClick={handleCreateCertificate}
                  className="text-xs gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold cursor-pointer"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  Generar Certificado
                </Button>
              </>
            )}

            {step === 3 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="text-xs gap-1.5 cursor-pointer font-medium"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir Certificado
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={forceClose}
                  className="text-xs font-semibold cursor-pointer"
                >
                  Finalizar
                </Button>
              </>
            )}
          </div>

      </div>

      {/* Diálogo de Confirmación para Evitar Cierre Accidental (sub-modal independiente, mantiene su propio Dialog) */}
      <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  ¿Descartar certificado?
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
              className="cursor-pointer text-xs"
            >
              Continuar editando
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={forceClose}
              className="cursor-pointer text-xs border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 hover:text-rose-800 dark:hover:text-rose-300 hover:border-rose-300"
            >
              Descartar y salir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
