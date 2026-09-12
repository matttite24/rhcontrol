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
  AlertTriangle,
  Printer,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Search,
  Calendar,
  FileText,
  Scale,
  ShieldAlert,
  ArrowRight,
  Info,
} from 'lucide-react'
import {
  NON_COMPLIANT_CATEGORIES,
  NonCompliantCategory,
} from '@/lib/incidents/constants'
import { printNonCompliantDocument } from '@/lib/incidents/print-non-compliant'
import {
  createNonCompliantIncidentAction,
  getEmployeeNonCompliantActivitiesAction,
} from '@/lib/incidents/actions'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface NonCompliantWizardModalProps {
  organizationId: string
  organizationName?: string
  employees: Employee[]
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  onTriggerWarningModal?: (employee: Employee, activities: Incident[]) => void
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

function formatLongDate(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  const dateObj = new Date(y, m - 1, d)

  const monthNames = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ]

  const dayNum = dateObj.getDate()
  const monthName = monthNames[dateObj.getMonth()]
  const year = dateObj.getFullYear()

  return `${dayNum} de ${monthName} de ${year}`
}

export function NonCompliantWizardModal({
  organizationId,
  organizationName = 'RH Garden',
  employees,
  onOpenChange,
  onSuccess,
  onTriggerWarningModal,
  onRegisterRequestClose,
}: NonCompliantWizardModalProps) {
  const router = useRouter()
  const supabase = createClient()

  // Organización activa
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

  // Pasos: 1: Empleado, 2: Detalle y Categoría, 3: Confirmación e Impresión
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [searchEmp, setSearchEmp] = useState('')
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)

  // Datos de acumulación del empleado seleccionado
  const [activeActivities, setActiveActivities] = useState<Incident[]>([])
  const [loadingActivities, setLoadingActivities] = useState(false)

  // Datos del paso 2
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const [incidentDate, setIncidentDate] = useState<string>(todayStr)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    NON_COMPLIANT_CATEGORIES[0].id
  )
  const [customTitle, setCustomTitle] = useState<string>('')
  const [detailedDescription, setDetailedDescription] = useState<string>('')
  const [immediateCorrection, setImmediateCorrection] = useState<string>('')

  // Estado de guardado y resultado
  const [submitting, setSubmitting] = useState(false)
  const [createdIncident, setCreatedIncident] = useState<Incident | null>(null)
  const [newActiveCount, setNewActiveCount] = useState<number>(1)
  const [canTriggerWarning, setCanTriggerWarning] = useState<boolean>(false)
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  // Cargar actividades acumuladas previas cuando se selecciona empleado
  useEffect(() => {
    if (!selectedEmp) {
      setActiveActivities([])
      return
    }

    let isMounted = true
    setLoadingActivities(true)

    getEmployeeNonCompliantActivitiesAction(selectedEmp.id)
      .then((res) => {
        if (!isMounted) return
        if (res.success) {
          setActiveActivities(res.activities)
        }
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (isMounted) setLoadingActivities(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedEmp])

  // Filtro de empleados
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

  // Categoría seleccionada
  const selectedCategory = useMemo(() => {
    return (
      NON_COMPLIANT_CATEGORIES.find((c) => c.id === selectedCategoryId) ||
      NON_COMPLIANT_CATEGORIES[0]
    )
  }, [selectedCategoryId])

  const effectiveTitle = useMemo(() => {
    if (selectedCategoryId === 'otra_no_conformidad' && customTitle.trim()) {
      return customTitle.trim()
    }
    return selectedCategory.label
  }, [selectedCategoryId, customTitle, selectedCategory])

  // Reset total del estado
  function resetState() {
    setStep(1)
    setSelectedEmp(null)
    setSearchEmp('')
    setIncidentDate(todayStr)
    setSelectedCategoryId(NON_COMPLIANT_CATEGORIES[0].id)
    setCustomTitle('')
    setDetailedDescription('')
    setImmediateCorrection('')
    setCreatedIncident(null)
    setActiveActivities([])
    setCanTriggerWarning(false)
  }

  // Solicitud de cierre con verificación de cambios
  function handleRequestClose() {
    if (selectedEmp || detailedDescription.trim() || immediateCorrection.trim() || step > 1) {
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

  // Cierre forzado desde el Alert Dialog
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
  }, [selectedEmp, detailedDescription, immediateCorrection, step])

  // Guardar y Registrar
  async function handleRegisterAndProceed() {
    if (!selectedEmp) {
      toast.error('Selecciona un empleado.')
      return
    }
    if (!incidentDate) {
      toast.error('Indica la fecha en que ocurrió la actividad no conforme.')
      return
    }
    if (!detailedDescription.trim()) {
      toast.error('Describe los hechos de la actividad no conforme.')
      return
    }

    setSubmitting(true)
    try {
      const res = await createNonCompliantIncidentAction({
        organizationId: organizationId || selectedEmp.organization_id,
        employeeId: selectedEmp.id,
        incidentDate,
        category: selectedCategoryId,
        categoryTitle: effectiveTitle,
        detailedDescription: detailedDescription.trim(),
        legalReference: selectedCategory.legalReference,
        immediateCorrection: immediateCorrection.trim() || undefined,
        metadata: {
          category_id: selectedCategoryId,
        },
      })

      if (!res.success || !res.data) {
        throw new Error(res.error || 'No se pudo registrar la actividad no conforme.')
      }

      setCreatedIncident(res.data)
      setNewActiveCount(res.activeCount || 1)
      setCanTriggerWarning(Boolean(res.canTriggerWarning))
      setStep(3)
      toast.success('Actividad no conforme registrada correctamente.')
      if (onSuccess) onSuccess()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error al registrar la incidencia.')
    } finally {
      setSubmitting(false)
    }
  }

  // Imprimir documento
  function handlePrintDocument() {
    if (!selectedEmp) return

    printNonCompliantDocument({
      organization: organization || { name: organizationName },
      organizationName,
      employeeName: selectedEmp.full_name,
      nationalId: selectedEmp.national_id || '',
      department: selectedEmp.department || '—',
      position: selectedEmp.position || '—',
      incidentDate,
      issueDate: todayStr,
      categoryTitle: effectiveTitle,
      detailedDescription: detailedDescription.trim(),
      immediateCorrection: immediateCorrection.trim() || undefined,
      legalReference: selectedCategory.legalReference,
      consecutiveCount: newActiveCount,
      status: 'registrado',
    })
  }

  // Manejar escalado a Llamado de Atención
  function handleTriggerWarning() {
    if (!selectedEmp || !onTriggerWarningModal) return
    const allActivities = [...activeActivities, ...(createdIncident ? [createdIncident] : [])]
    onOpenChange(false)
    onTriggerWarningModal(selectedEmp, allActivities)
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
          {/* Header con padding derecho para no solapar el botón de cerrar */}
          <DialogHeader className="p-5 pb-4 bg-amber-500/10 border-b border-amber-500/20 text-left shrink-0 pr-12">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold text-foreground truncate">
                  Actividad No Conforme
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                  Registro preventivo y seguimiento de desvíos operacionales
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* PASO 1: SELECCIONAR EMPLEADO */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">
                  1. Seleccionar Empleado Involucrado
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

              <div className="border rounded-xl divide-y max-h-[280px] overflow-y-auto bg-card/40">
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
                            ? "bg-amber-500/10 border-l-4 border-l-amber-500 dark:bg-amber-950/30"
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
                          <span className="font-mono text-[11px] text-muted-foreground block">
                            {emp.national_id || 'Sin C.I.'}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                              Seleccionado
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>

              {/* Banner de acumulación si ya tiene actividades activas */}
              {selectedEmp && (
                <div className={cn(
                  "p-3 rounded-xl border flex items-start gap-2.5 transition-all text-xs",
                  loadingActivities
                    ? "bg-muted/40 border-border text-muted-foreground"
                    : activeActivities.length >= 2
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-200"
                    : activeActivities.length === 1
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200"
                )}>
                  <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div className="space-y-1 min-w-0">
                    <p className="font-semibold">
                      Historial acumulado de {selectedEmp.full_name}:
                    </p>
                    {loadingActivities ? (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" /> Verificando registros previos...
                      </p>
                    ) : (
                      <p className="text-[11px] leading-relaxed">
                        Tiene <strong>{activeActivities.length}</strong> actividad(es) no conforme(s) acumulada(s).{' '}
                        {activeActivities.length >= 2 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-bold">
                            ⚠️ Con este nuevo registro alcanzará las 3 requeridas para emitir un Llamado de Atención Escrito formal.
                          </span>
                        ) : activeActivities.length === 1 ? (
                          <span>Este será su segundo registro (Límite: 3).</span>
                        ) : (
                          <span>No tiene registros activos pendientes. Este será su primer registro (1 de 3).</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PASO 2: FORMULARIO DE DETALLES */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Resumen del empleado */}
              <div className="p-3 rounded-xl bg-muted/40 border flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-7 w-7 border">
                    <AvatarImage src={selectedEmp?.avatar_url || ''} />
                    <AvatarFallback className="text-[10px] font-bold">
                      {selectedEmp ? getInitials(selectedEmp.full_name) : ''}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="font-bold text-foreground block">
                      {selectedEmp?.full_name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {selectedEmp?.position} • C.I.: {selectedEmp?.national_id || '—'}
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 text-[11px]">
                  {activeActivities.length} previa(s)
                </Badge>
              </div>

              {/* Fecha del evento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Fecha del Evento / Ocurrencia *
                  </Label>
                  <DatePicker
                    name="incident_date"
                    value={incidentDate}
                    onChange={(v) => setIncidentDate(v)}
                    placeholder="Seleccionar fecha"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Categoría de Actividad No Conforme *
                  </Label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-card px-3 text-xs text-foreground focus:ring-1 focus:ring-ring cursor-pointer"
                  >
                    {NON_COMPLIANT_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Si seleccionó 'otra_no_conformidad', campo para título personalizado */}
              {selectedCategoryId === 'otra_no_conformidad' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Título Específico de la No Conformidad *
                  </Label>
                  <Input
                    placeholder="Ej. Descuido en inventario de cierre..."
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              )}

              {/* Referencia legal y descripción de categoría */}
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                  <Scale className="h-3.5 w-3.5 shrink-0" />
                  {selectedCategory.legalReference}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {selectedCategory.description}
                </p>
              </div>

              {/* Detalle de los Hechos */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Descripción Detallada de los Hechos *
                </Label>
                <textarea
                  rows={3}
                  value={detailedDescription}
                  onChange={(e) => setDetailedDescription(e.target.value)}
                  placeholder="Describe con precisión qué ocurrió, hora o turno aproximado, y la afectación operativa generada..."
                  className="w-full p-2.5 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
                />
              </div>

              {/* Acción Correctiva Inmediata */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Acción Correctiva Inmediata / Instrucción Impartida (Opcional)
                </Label>
                <textarea
                  rows={2}
                  value={immediateCorrection}
                  onChange={(e) => setImmediateCorrection(e.target.value)}
                  placeholder="Ej. Se reentrena en procedimiento de apertura, se instruye cuadre diario antes del cambio de turno..."
                  className="w-full p-2.5 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* PASO 3: CONFIRMACIÓN, IMPRESIÓN Y POSIBLE ESCALADO */}
          {step === 3 && (
            <div className="space-y-4 py-2">
              <div className="flex flex-col items-center justify-center text-center p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <div className="p-3 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 mb-2">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h3 className="text-sm font-bold text-foreground">
                  Actividad No Conforme Registrada con Éxito
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md">
                  El registro ha quedado formalmente archivado en el sistema para el expediente de control de {selectedEmp?.full_name}.
                </p>
              </div>

              {/* Resumen del documento */}
              <div className="p-4 rounded-xl border bg-card text-xs space-y-2.5">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground text-[11px]">Asunto:</span>
                  <span className="font-bold text-foreground text-right">{effectiveTitle}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground text-[11px]">Fecha del Evento:</span>
                  <span className="font-medium text-foreground">{formatLongDate(incidentDate)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px]">Total Acumulado Activo:</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono font-bold text-[11px]",
                      newActiveCount >= 3
                        ? "border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                        : "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                    )}
                  >
                    {newActiveCount} de 3 registros
                  </Badge>
                </div>
              </div>

              {/* ALERTA DE 3 ACUMULADAS: Permite generar Llamado de Atención Escrito */}
              {canTriggerWarning ? (
                <div className="p-4 rounded-xl border-2 border-rose-500/40 bg-rose-500/10 space-y-3 animate-in fade-in-50 duration-300">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wide">
                        Límite de Tolerancia Alcanzado (3 Actividades No Conformes)
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Este empleado ha acumulado <strong>{newActiveCount} actividades no conformes</strong>. Según las políticas laborales, está habilitado para emitir un <strong>Llamado de Atención Escrito formal</strong> consolidando estas 3 faltas.
                      </p>
                    </div>
                  </div>

                  {onTriggerWarningModal && (
                    <Button
                      type="button"
                      onClick={handleTriggerWarning}
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs gap-2 font-bold cursor-pointer h-9 shadow-sm"
                    >
                      <ShieldAlert className="h-4 w-4" />
                      Generar Llamado de Atención Escrito con las 3 Actividades
                      <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                    </Button>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-xl border bg-muted/20 text-xs text-muted-foreground flex items-center gap-2">
                  <Info className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    El empleado cuenta con <strong>{newActiveCount} de 3</strong> incidencias acumuladas. Si llega a 3, se habilitará la opción para emitir un llamado formal.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer con Navegación */}
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
                className="text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer"
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
                disabled={submitting}
                onClick={handleRegisterAndProceed}
                className="text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                Registrar Incidencia
              </Button>
            </>
          )}

          {step === 3 && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrintDocument}
                className="text-xs gap-1.5 cursor-pointer font-medium"
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir Documento
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => forceClose()}
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
            <div className="p-2.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                ¿Descartar registro de actividad?
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
