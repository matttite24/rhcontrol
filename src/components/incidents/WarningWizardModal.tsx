'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Employee, Incident } from '@/types/employee'
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import {
  AlertCircle,
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
  UserCheck,
  Building,
  Info,
} from 'lucide-react'
import {
  INTERNAL_REGULATION_CLAUSES,
  WarningSeverity,
} from '@/lib/incidents/constants'
import { printWarningLetterDocument } from '@/lib/incidents/print-warning'
import { createWarningIncidentAction } from '@/lib/incidents/actions'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface WarningWizardModalProps {
  organizationId: string
  organizationName?: string
  employees: Employee[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  initialEmployee?: Employee | null
  initialNonCompliantActivities?: Incident[]
  // El <Dialog> raíz vive en el launcher (NewIncidentButton). Ver
  // OvertimeWizardModal (Turnos) para la explicación completa.
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

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const monthNames = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ]

  const dayNum = dateObj.getDate()
  const monthName = monthNames[dateObj.getMonth()]
  const year = dateObj.getFullYear()

  return `${dayNum} de ${monthName} de ${year}`
}

export function WarningWizardModal({
  organizationId,
  organizationName = 'RH Garden',
  employees,
  open,
  onOpenChange,
  onSuccess,
  initialEmployee = null,
  initialNonCompliantActivities = [],
  onRegisterRequestClose,
}: WarningWizardModalProps) {
  const router = useRouter()
  const supabase = createClient()
  const [organization, setOrganization] = useState<any>(null)

  // Cargar datos de la organización
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

  // Paso actual (1: Empleado, 2: Incidencia y Reglamento, 3: Confirmación / Emisión e Impresión)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [searchEmp, setSearchEmp] = useState('')
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)

  // Datos del paso 2
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const [incidentDate, setIncidentDate] = useState<string>(todayStr)
  const [severity, setSeverity] = useState<WarningSeverity>('escrito')
  const [selectedClauseId, setSelectedClauseId] = useState<string>(INTERNAL_REGULATION_CLAUSES[0].id)
  const [customArticle, setCustomArticle] = useState<string>('')
  const [detailedDescription, setDetailedDescription] = useState<string>('')
  const [correctiveCommitment, setCorrectiveCommitment] = useState<string>('')

  // Efecto para inicializar con empleado o actividades previas
  useEffect(() => {
    if (open && initialEmployee) {
      setSelectedEmp(initialEmployee)
      setStep(2)
      setSeverity('escrito') // Al acumular 3 no conformidades, pasa a amonestación escrita

      if (initialNonCompliantActivities && initialNonCompliantActivities.length > 0) {
        // Seleccionar causal de incumplimiento de funciones / directrices
        setSelectedClauseId('incumplimiento_funciones')
        
        // Redactar automáticamente el detalle con las 3 actividades
        const bulletPoints = initialNonCompliantActivities
          .slice(0, 3)
          .map((act, idx) => {
            const dateFmt = act.start_date ? formatLongDate(act.start_date) : 'Fecha sin registrar'
            const catTitle = act.metadata?.category_title || act.title || 'Actividad no conforme'
            const desc = act.description ? ` (${act.description})` : ''
            return `${idx + 1}. [${dateFmt}] ${catTitle}${desc}`
          })
          .join('\n')

        const consolidatedText = `El empleado ha incurrido en la reiteración de faltas operativas acumuladas (3 actividades no conformes):\n\n${bulletPoints}\n\nConforme a las directrices de la organización, la acumulación de tres observaciones operativas amerita la emisión formal del presente llamado de atención escrito con constancia en su expediente laboral.`
        
        setDetailedDescription(consolidatedText)
        setCorrectiveCommitment('El empleado se compromete a subsanar de forma inmediata los desvíos operacionales señalados y apegarse rigurosamente a los procedimientos de la empresa.')
      }
    }
  }, [open, initialEmployee, initialNonCompliantActivities])

  // Estado de guardado y resultado
  const [submitting, setSubmitting] = useState(false)
  const [createdIncident, setCreatedIncident] = useState<Incident | null>(null)

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

  // Causal seleccionada
  const selectedClause = useMemo(() => {
    return (
      INTERNAL_REGULATION_CLAUSES.find((c) => c.id === selectedClauseId) ||
      INTERNAL_REGULATION_CLAUSES[0]
    )
  }, [selectedClauseId])

  const effectiveArticle = useMemo(() => {
    if (selectedClauseId === 'otro_reglamento' && customArticle.trim()) {
      return customArticle.trim()
    }
    return selectedClause.article
  }, [selectedClauseId, customArticle, selectedClause])

  // Reiniciar estado al cerrar
  function handleClose(val: boolean) {
    if (!val) {
      setTimeout(() => {
        setStep(1)
        setSelectedEmp(null)
        setSearchEmp('')
        setIncidentDate(todayStr)
        setSeverity('escrito')
        setSelectedClauseId(INTERNAL_REGULATION_CLAUSES[0].id)
        setCustomArticle('')
        setDetailedDescription('')
        setCorrectiveCommitment('')
        setCreatedIncident(null)
      }, 200)
    }
    onOpenChange(val)
  }

  // Publicar handleClose hacia el padre para que Escape/click-fuera en el
  // Dialog raíz compartido disparen el mismo reset que el botón Cerrar.
  useEffect(() => {
    onRegisterRequestClose?.(() => handleClose(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Guardar y Registrar
  async function handleRegisterAndProceed() {
    if (!selectedEmp) {
      toast.error('Selecciona un empleado.')
      return
    }
    if (!incidentDate) {
      toast.error('Indica la fecha en que ocurrió la incidencia.')
      return
    }
    if (!detailedDescription.trim()) {
      toast.error('Detalla la falta o inobservancia cometida.')
      return
    }

    setSubmitting(true)
    try {
      const activityIds = initialNonCompliantActivities?.slice(0, 3).map((a) => a.id) || []

      const res = await createWarningIncidentAction({
        organizationId: organizationId || selectedEmp.organization_id,
        employeeId: selectedEmp.id,
        severity,
        incidentDate,
        regulationArticle: effectiveArticle,
        infractionTitle: selectedClause.label,
        detailedDescription: detailedDescription.trim(),
        correctiveCommitment: correctiveCommitment.trim() || undefined,
        metadata: {
          clause_id: selectedClauseId,
          escalated_from_activities: activityIds.length > 0 ? activityIds : undefined,
        },
      })

      if (!res.success || !res.data) {
        throw new Error(res.error || 'No se pudo registrar el llamado de atención.')
      }

      // Si fue escalado desde actividades no conformes, marcarlas como procesadas
      if (activityIds.length > 0) {
        for (const actId of activityIds) {
          const { data: actData } = await supabase
            .from('incidents')
            .select('metadata')
            .eq('id', actId)
            .single()

          await supabase
            .from('incidents')
            .update({
              metadata: {
                ...(actData?.metadata || {}),
                escalated_to_warning_id: res.data.id,
                escalated_at: new Date().toISOString(),
              },
            })
            .eq('id', actId)
        }
      }

      setCreatedIncident(res.data)
      setStep(3)
      toast.success('Llamado de atención registrado formalmente.')
      if (onSuccess) onSuccess()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error al procesar el registro.')
    } finally {
      setSubmitting(false)
    }
  }

  // Ejecutar impresión formal para marcar como recibido
  function handlePrintDocument() {
    if (!selectedEmp) return

    printWarningLetterDocument({
      organization: organization || { name: organizationName },
      organizationName,
      employeeName: selectedEmp.full_name,
      nationalId: selectedEmp.national_id || '',
      department: selectedEmp.department || '—',
      position: selectedEmp.position || '—',
      hireDate: selectedEmp.hire_date,
      severity,
      incidentDate,
      issueDate: todayStr,
      regulationArticle: effectiveArticle,
      infractionTitle: selectedClause.label,
      detailedDescription: detailedDescription.trim(),
      correctiveCommitment: correctiveCommitment.trim() || undefined,
      status: 'registrado',
    })
  }

  return (
    <>
      {/* El <DialogContent> único vive en el launcher. Ver OvertimeWizardModal (Turnos). */}
        {/* Header limpio sin pasos solapados */}
        <DialogHeader className="p-5 pb-4 border-b bg-muted/20 shrink-0 pr-12">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 border border-rose-500/20 shrink-0">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Llamado de Atención Disciplinario
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Proceso formal y sancionatorio según el Reglamento Interno y Código del Trabajo
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* CONTENIDO SEGÚN PASO */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* ============================================================== */}
          {/* PASO 1: SELECCIÓN DE EMPLEADO                                 */}
          {/* ============================================================== */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">
                  1. Selecciona al empleado
                </h4>
                <p className="text-xs text-muted-foreground">
                  Busca al trabajador a quien se le emitirá el llamado de atención.
                </p>
              </div>

              {/* Barra de búsqueda */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchEmp}
                  onChange={(e) => setSearchEmp(e.target.value)}
                  placeholder="Buscar por nombre, cédula, cargo o departamento..."
                  className="pl-9 h-9 text-xs"
                />
              </div>

              {/* Lista de empleados */}
              <div className="border rounded-xl divide-y max-h-[340px] overflow-y-auto bg-card">
                {filteredEmployees.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No se encontraron empleados con ese criterio.
                  </div>
                ) : (
                  filteredEmployees.map((emp) => {
                    const isSelected = selectedEmp?.id === emp.id

                    return (
                      <div
                        key={emp.id}
                        onClick={() => setSelectedEmp(emp)}
                        className={cn(
                          'p-3 flex items-center justify-between cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-primary/10 border-l-4 border-l-primary'
                            : 'hover:bg-muted/40'
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-9 w-9 ring-1 ring-border shrink-0">
                            <AvatarImage src={emp.avatar_url ?? undefined} alt={emp.full_name} />
                            <AvatarFallback className="text-xs font-semibold">
                              {getInitials(emp.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {emp.full_name}
                            </p>
                            <p className="text-[11px] font-mono text-muted-foreground">
                              CI: {emp.national_id || '—'} • {emp.position || emp.department || 'Empleado'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {emp.status}
                          </Badge>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PASO 2: INFORMACIÓN DE INCIDENCIA Y REGLAMENTO INTERNO        */}
          {/* ============================================================== */}
          {step === 2 && selectedEmp && (
            <div className="space-y-4">
              {/* Resumen del empleado seleccionado */}
              <div className="p-3 rounded-xl border bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 ring-1 ring-border">
                    <AvatarImage src={selectedEmp.avatar_url ?? undefined} alt={selectedEmp.full_name} />
                    <AvatarFallback className="text-xs font-semibold">
                      {getInitials(selectedEmp.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="text-xs font-bold text-foreground block">
                      {selectedEmp.full_name}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      CI: {selectedEmp.national_id || '—'} • {selectedEmp.department || 'Sin área'}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="h-7 text-xs text-muted-foreground"
                >
                  Cambiar
                </Button>
              </div>

              {/* Fechas: Emisión (automática hoy) y Fecha del incidente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Fecha de Emisión (Automática)
                  </Label>
                  <div className="h-9 px-3 rounded-md border bg-muted/40 flex items-center justify-between text-xs font-mono text-muted-foreground">
                    <span>{todayStr}</span>
                    <span className="text-[10px] text-primary font-sans font-medium">Hoy</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Fecha de la Incidencia / Falta <span className="text-destructive">*</span>
                  </Label>
                  <DatePicker
                    name="incidentDate"
                    value={incidentDate}
                    onChange={(date) => setIncidentDate(date || todayStr)}
                    placeholder="Fecha del suceso"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Tipo de llamado: Escrito o Verbal */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Tipo de Llamado de Atención
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setSeverity('escrito')}
                    className={cn(
                      'p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-1',
                      severity === 'escrito'
                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-900 dark:text-rose-300 ring-1 ring-rose-500/40'
                        : 'bg-card hover:bg-muted/30 border-border/70'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Llamado Escrito</span>
                      {severity === 'escrito' && <CheckCircle2 className="h-3.5 w-3.5 text-rose-600" />}
                    </div>
                    <span className="text-[10.5px] text-muted-foreground leading-tight">
                      Amonestación formal con copia al expediente y firma de constancia.
                    </span>
                  </div>

                  <div
                    onClick={() => setSeverity('verbal')}
                    className={cn(
                      'p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-1',
                      severity === 'verbal'
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-300 ring-1 ring-amber-500/40'
                        : 'bg-card hover:bg-muted/30 border-border/70'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Llamado Verbal</span>
                      {severity === 'verbal' && <CheckCircle2 className="h-3.5 w-3.5 text-amber-600" />}
                    </div>
                    <span className="text-[10.5px] text-muted-foreground leading-tight">
                      Apercibimiento inicial con constancia escrita para archivo.
                    </span>
                  </div>
                </div>
              </div>

              {/* Cita del Reglamento Interno y Código de Trabajo */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Scale className="h-3.5 w-3.5 text-primary" />
                    Causal del Reglamento Interno & Ley Ecuatoriana
                  </Label>
                </div>
                <select
                  value={selectedClauseId}
                  onChange={(e) => setSelectedClauseId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {INTERNAL_REGULATION_CLAUSES.map((clause) => (
                    <option key={clause.id} value={clause.id}>
                      {clause.label}
                    </option>
                  ))}
                </select>

                {/* Tarjeta de fundamentación jurídica citada */}
                <div className="p-3 rounded-lg bg-muted/40 border text-xs space-y-1 text-muted-foreground">
                  <div className="flex items-center gap-1.5 text-foreground font-semibold">
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                    Artículos Citados: {effectiveArticle}
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {selectedClause.description}
                  </p>
                </div>

                {selectedClauseId === 'otro_reglamento' && (
                  <div className="pt-1.5">
                    <Input
                      value={customArticle}
                      onChange={(e) => setCustomArticle(e.target.value)}
                      placeholder="Especifica el Artículo o Cláusula del Reglamento Interno..."
                      className="h-8 text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Descripción detallada de los hechos */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Relación de los Hechos (Descripción del Suceso) <span className="text-destructive">*</span>
                </Label>
                <textarea
                  value={detailedDescription}
                  onChange={(e) => setDetailedDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe de forma clara y objetiva qué sucedió, hora, lugar e impacto de la falta laboral..."
                  className="w-full rounded-md border border-input bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Compromiso correctivo o plan de acción */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Compromiso de Mejora / Advertencia de Reincidencia (Opcional)
                </Label>
                <Input
                  value={correctiveCommitment}
                  onChange={(e) => setCorrectiveCommitment(e.target.value)}
                  placeholder="Ej: El empleado se compromete a ingresar puntualmente y presentar justificativos médicos dentro de 48h."
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PASO 3: REGISTRO COMPLETADO E IMPRESIÓN PARA RECIBIDO          */}
          {/* ============================================================== */}
          {step === 3 && selectedEmp && (
            <div className="py-4 space-y-5 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6" />
              </div>

              <div className="space-y-1 max-w-md mx-auto">
                <h4 className="text-base font-bold text-foreground">
                  Llamado de Atención Formal Registrado
                </h4>
                <p className="text-xs text-muted-foreground">
                  Se ha generado la constancia formal para el empleado y archivado en el módulo de incidencias.
                </p>
              </div>

              {/* Tarjeta resumen formal */}
              <div className="p-4 rounded-xl border bg-card text-left max-w-lg mx-auto space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b pb-2.5">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold text-foreground">
                      Documento Listo para Firma de Notificación
                    </span>
                  </div>
                  <Badge variant={severity === 'escrito' ? 'destructive' : 'secondary'} className="text-[10px] capitalize">
                    {severity}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground text-[10px] uppercase font-semibold block">Empleado</span>
                    <span className="font-semibold text-foreground">{selectedEmp.full_name}</span>
                    <span className="text-[11px] font-mono text-muted-foreground block">CI: {selectedEmp.national_id || '—'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] uppercase font-semibold block">Fecha de Ocurrencia</span>
                    <span className="font-medium text-foreground">{formatLongDate(incidentDate)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground text-[10px] uppercase font-semibold block">Normativa Aplicada</span>
                    <span className="font-semibold text-foreground text-[11px]">{effectiveArticle}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Imprime el documento formal para entregarlo al empleado y recabar su firma como <strong>recibido</strong> para el expediente de Talento Humano.
                  </span>
                </div>
              </div>

              {/* Botón principal de impresión membretada */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  type="button"
                  onClick={handlePrintDocument}
                  size="default"
                  className="gap-2 font-semibold shadow-xs cursor-pointer w-full sm:w-auto"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir Documento Formal
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleClose(false)}
                  className="w-full sm:w-auto text-xs"
                >
                  Finalizar
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER CON BOTONES DE NAVEGACIÓN */}
        {step !== 3 && (
          <div className="p-4 border-t bg-muted/20 flex items-center justify-between shrink-0">
            {step === 1 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleClose(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(1)}
                disabled={submitting}
                className="gap-1.5 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Volver
              </Button>
            )}

            {step === 1 ? (
              <Button
                size="sm"
                disabled={!selectedEmp}
                onClick={() => setStep(2)}
                className="gap-1.5 text-xs font-semibold cursor-pointer"
              >
                Continuar a Incidencia
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={submitting || !detailedDescription.trim()}
                onClick={handleRegisterAndProceed}
                className="gap-2 text-xs font-semibold cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    Registrar e Imprimir
                    <ChevronRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            )}
          </div>
        )}
    </>
  )
}
