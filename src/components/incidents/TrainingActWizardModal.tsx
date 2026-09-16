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
  GraduationCap,
  Printer,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Search,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { printTrainingActDocument } from '@/lib/incidents/print-training-act'
import { createTrainingActAction } from '@/lib/incidents/actions'
import { TRAINING_TOPIC_CATEGORIES } from '@/lib/incidents/constants'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface TrainingActWizardModalProps {
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

export function TrainingActWizardModal({
  organizationId,
  organizationName = 'RH Garden',
  employees,
  onOpenChange,
  onSuccess,
  onRegisterRequestClose,
}: TrainingActWizardModalProps) {
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

  // Pasos: 1. Empleado, 2. Fecha/capacitador/tema/descripción/duración, 3. Confirmación e impresión
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [searchEmp, setSearchEmp] = useState('')
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)

  const [trainingDate, setTrainingDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [trainerName, setTrainerName] = useState('')
  const [topicCategory, setTopicCategory] = useState<string>('')
  const [topicLabel, setTopicLabel] = useState('')
  const [description, setDescription] = useState('')
  const [durationHours, setDurationHours] = useState<number>(1)

  const [submitting, setSubmitting] = useState(false)
  const [createdIncident, setCreatedIncident] = useState<Incident | null>(null)
  const [showConfirmClose, setShowConfirmClose] = useState(false)

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

  function resetState() {
    setStep(1)
    setSelectedEmp(null)
    setSearchEmp('')
    setTrainingDate(new Date().toISOString().split('T')[0])
    setTrainerName('')
    setTopicCategory('')
    setTopicLabel('')
    setDescription('')
    setDurationHours(1)
    setCreatedIncident(null)
  }

  function handleRequestClose() {
    if (selectedEmp || trainerName.trim() || topicLabel.trim() || step > 1) {
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

  useEffect(() => {
    onRegisterRequestClose?.(handleRequestClose)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmp, trainerName, topicLabel, step])

  function selectTopicCategory(catId: string, catLabel: string) {
    setTopicCategory(catId)
    // Solo autocompleta el campo de tema si el usuario aún no escribió uno propio.
    if (!topicLabel.trim() && catId !== 'otro') {
      setTopicLabel(catLabel)
    }
  }

  async function handleCreateTrainingAct() {
    if (!selectedEmp) {
      toast.error('Selecciona un empleado.')
      return
    }
    if (!trainerName.trim()) {
      toast.error('Ingresa el nombre del capacitador.')
      return
    }
    if (!topicLabel.trim()) {
      toast.error('Ingresa el tema o área de la capacitación.')
      return
    }
    if (!description.trim()) {
      toast.error('Ingresa la descripción de la capacitación.')
      return
    }
    if (!durationHours || durationHours <= 0) {
      toast.error('Ingresa una duración válida.')
      return
    }

    setSubmitting(true)
    try {
      const res = await createTrainingActAction({
        organizationId: organizationId || selectedEmp.organization_id,
        employeeId: selectedEmp.id,
        trainingDate,
        trainerName: trainerName.trim(),
        topicCategory,
        topicLabel: topicLabel.trim(),
        description: description.trim(),
        durationHours,
        metadata: {
          national_id: selectedEmp.national_id,
          department: selectedEmp.department,
          position: selectedEmp.position,
        },
      })

      if (!res.success || !res.data) {
        throw new Error(res.error || 'No se pudo generar el acta de capacitación.')
      }

      setCreatedIncident(res.data)
      setStep(3)
      toast.success('Acta de capacitación generada y registrada con éxito.')
      if (onSuccess) onSuccess()
      router.refresh()
    } catch (err: any) {
      console.error('Error creando acta de capacitación:', err)
      toast.error(err.message || 'Error al generar el acta.')
    } finally {
      setSubmitting(false)
    }
  }

  function handlePrint() {
    if (!selectedEmp) {
      toast.error('No se encontró el empleado seleccionado.')
      return
    }

    printTrainingActDocument({
      organization: organization || { name: organizationName },
      organizationName,
      employeeName: selectedEmp.full_name,
      nationalId: selectedEmp.national_id || '',
      department: selectedEmp.department || '—',
      position: selectedEmp.position || '—',
      trainingDate,
      trainerName: trainerName.trim(),
      topicLabel: topicLabel.trim(),
      description: description.trim(),
      durationHours,
      documentCode: createdIncident?.metadata?.document_code,
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
      {/* El <DialogContent> único vive en el launcher. Ver WorkCertificateWizardModal. */}
          <DialogHeader className="p-5 pb-4 bg-fuchsia-500/10 border-b border-fuchsia-500/20 text-left shrink-0 pr-12">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-600 dark:text-fuchsia-400 shrink-0">
                <GraduationCap className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold text-foreground truncate">
                  Acta de Capacitación
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                  Constancia de capacitación recibida por el colaborador
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
                              ? "bg-fuchsia-500/10 border-l-4 border-l-fuchsia-500 dark:bg-violet-950/30"
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

                          {isSelected && (
                            <span className="text-[10px] font-bold text-fuchsia-600 dark:text-fuchsia-400 shrink-0">
                              Seleccionado
                            </span>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* PASO 2: FECHA, CAPACITADOR, TEMA, DESCRIPCIÓN Y DURACIÓN */}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="training_date" className="text-xs font-medium">
                      Fecha de la Capacitación *
                    </Label>
                    <DatePicker
                      id="training_date"
                      name="training_date"
                      value={trainingDate}
                      onChange={(val) => setTrainingDate(val)}
                      placeholder="Seleccionar fecha"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="duration_hours" className="text-xs font-medium">
                      Duración (horas) *
                    </Label>
                    <Input
                      id="duration_hours"
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={durationHours}
                      onChange={(e) => setDurationHours(Number(e.target.value) || 0)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="trainer_name" className="text-xs font-medium">
                    Capacitador / Instructor *
                  </Label>
                  <Input
                    id="trainer_name"
                    value={trainerName}
                    onChange={(e) => setTrainerName(e.target.value)}
                    placeholder="Nombre de quien dictó la capacitación"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-foreground">
                    Tema o Área de la Capacitación *
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {TRAINING_TOPIC_CATEGORIES.map((cat) => {
                      const isSelected = topicCategory === cat.id
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => selectTopicCategory(cat.id, cat.label)}
                          className={cn(
                            "p-2.5 rounded-lg border text-left transition-all cursor-pointer",
                            isSelected
                              ? "bg-fuchsia-500/10 border-fuchsia-500 ring-1 ring-fuchsia-500/30"
                              : "bg-card hover:bg-muted/40 border-border/60"
                          )}
                        >
                          <span className="text-[11.5px] font-semibold text-foreground block">
                            {cat.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {cat.examples}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  <Input
                    value={topicLabel}
                    onChange={(e) => setTopicLabel(e.target.value)}
                    placeholder="Ej. Manejo de extintores y prevención de incendios"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-xs font-medium">
                    Descripción de la Capacitación *
                  </Label>
                  <textarea
                    id="description"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe brevemente el contenido y objetivo de la capacitación..."
                    className="w-full p-2.5 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* PASO 3: CONFIRMACIÓN E IMPRESIÓN */}
            {step === 3 && (
              <div className="space-y-4 py-2">
                <div className="flex flex-col items-center justify-center text-center p-5 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20">
                  <div className="p-3 rounded-full bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400 mb-2">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    Acta de Capacitación Generada
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    Queda constancia de esta capacitación en el historial del empleado.
                  </p>
                </div>

                <div className="p-4 rounded-xl border bg-card text-xs space-y-2.5">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground text-[11px]">Empleado:</span>
                    <span className="font-bold text-foreground">{selectedEmp?.full_name}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground text-[11px]">Tema:</span>
                    <Badge variant="outline" className="text-[11px]">
                      {topicLabel}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground text-[11px]">Capacitador:</span>
                    <span className="font-semibold text-foreground">{trainerName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">Duración:</span>
                    <span className="font-bold font-mono text-sm text-foreground">
                      {durationHours === 1 ? '1 hora' : `${durationHours} horas`}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border bg-muted/20 text-xs text-muted-foreground flex items-center gap-2">
                  <Info className="h-4 w-4 text-fuchsia-600 shrink-0" />
                  <span>
                    Imprime el acta para la firma de recibido del colaborador.
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
                  className="text-xs gap-1.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold cursor-pointer"
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
                  disabled={submitting || !trainerName.trim() || !topicLabel.trim() || !description.trim() || !durationHours}
                  onClick={handleCreateTrainingAct}
                  className="text-xs gap-1.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold cursor-pointer"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  Generar Acta
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
                  Imprimir Acta
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
              <div className="p-2.5 rounded-full bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-500/20 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  ¿Descartar acta de capacitación?
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
