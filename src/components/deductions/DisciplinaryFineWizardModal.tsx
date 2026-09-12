'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Employee, Deduction } from '@/types/employee'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from '@/components/ui/toast'
import {
  AlertTriangle,
  Printer,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Search,
  Info,
  Gavel,
} from 'lucide-react'
import { printDisciplinaryFineDocument } from '@/lib/deductions/print-disciplinary-fine'
import { createDisciplinaryFineDeductionAction } from '@/lib/deductions/actions'
import { getDeductionCode } from '@/lib/deductions/sequence'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface DisciplinaryFineWizardModalProps {
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

export function DisciplinaryFineWizardModal({
  organizationId,
  organizationName = 'RH Garden',
  employees,
  onOpenChange,
  onSuccess,
  onRegisterRequestClose,
}: DisciplinaryFineWizardModalProps) {
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

  // Pasos: 1: Empleado, 2: Falta/Reglamento/Monto, 3: Confirmación e Impresión
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [searchEmp, setSearchEmp] = useState('')
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
  const [employeeSalary, setEmployeeSalary] = useState<number | null>(null)
  const [loadingSalary, setLoadingSalary] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const [fineDate, setFineDate] = useState<string>(today)
  const [amount, setAmount] = useState<string>('')
  const [regulationArticle, setRegulationArticle] = useState<string>('')
  const [infractionDescription, setInfractionDescription] = useState<string>('')
  const [additionalInfo, setAdditionalInfo] = useState<string>('')

  const [submitting, setSubmitting] = useState(false)
  const [createdDeduction, setCreatedDeduction] = useState<Deduction | null>(null)
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  // Cargar sueldo base del empleado al seleccionarlo
  useEffect(() => {
    if (!selectedEmp) {
      setEmployeeSalary(null)
      return
    }

    const empId = selectedEmp.id
    let isMounted = true
    setLoadingSalary(true)

    async function loadSalary() {
      try {
        const { data } = await supabase
          .from('employee_salaries')
          .select('amount')
          .eq('employee_id', empId)
          .eq('salary_type', 'Sueldo')
          .maybeSingle()

        if (!isMounted) return
        if (data?.amount) {
          setEmployeeSalary(Number(data.amount))
        } else {
          setEmployeeSalary(460.0) // SBU de referencia si no tiene registrado
        }
      } catch {
        if (isMounted) setEmployeeSalary(460.0)
      } finally {
        if (isMounted) setLoadingSalary(false)
      }
    }

    loadSalary()

    return () => {
      isMounted = false
    }
  }, [selectedEmp, supabase])

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

  const parsedAmount = Math.max(0, parseFloat(amount) || 0)

  // Límite legal: Art. 44 lit. b) del Código del Trabajo — máximo 10% de la remuneración mensual
  const maxAllowedAmount = useMemo(() => {
    if (!employeeSalary || employeeSalary <= 0) return null
    return Number((employeeSalary * 0.1).toFixed(2))
  }, [employeeSalary])

  const exceedsLegalLimit = useMemo(() => {
    if (maxAllowedAmount === null) return false
    return parsedAmount > maxAllowedAmount
  }, [parsedAmount, maxAllowedAmount])

  const fineRatio = useMemo(() => {
    if (!employeeSalary || employeeSalary <= 0 || parsedAmount <= 0) return 0
    return Number(((parsedAmount / employeeSalary) * 100).toFixed(1))
  }, [parsedAmount, employeeSalary])

  function resetState() {
    setStep(1)
    setSelectedEmp(null)
    setSearchEmp('')
    setEmployeeSalary(null)
    setFineDate(today)
    setAmount('')
    setRegulationArticle('')
    setInfractionDescription('')
    setAdditionalInfo('')
    setCreatedDeduction(null)
  }

  function handleRequestClose() {
    if (selectedEmp || parsedAmount > 0 || regulationArticle.trim() || infractionDescription.trim() || step > 1) {
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
  }, [selectedEmp, parsedAmount, regulationArticle, infractionDescription, step])

  async function handleCreateFine() {
    if (!selectedEmp) {
      toast.error('Selecciona un empleado.')
      return
    }

    if (!fineDate) {
      toast.error('Ingresa la fecha de la falta.')
      return
    }

    if (parsedAmount <= 0) {
      toast.error('Ingresa un valor válido para la multa.')
      return
    }

    if (!regulationArticle.trim()) {
      toast.error('Indica el artículo/numeral del reglamento interno que tipifica la falta.')
      return
    }

    if (!infractionDescription.trim()) {
      toast.error('Describe la falta cometida.')
      return
    }

    if (exceedsLegalLimit) {
      toast.error(`El monto excede el límite legal del 10% de la remuneración mensual ($${maxAllowedAmount?.toFixed(2)} USD). Art. 44 lit. b) del Código del Trabajo.`)
      return
    }

    setSubmitting(true)

    try {
      const res = await createDisciplinaryFineDeductionAction({
        organizationId: organizationId || selectedEmp.organization_id,
        employeeId: selectedEmp.id,
        fineDate,
        amount: parsedAmount,
        employeeBaseSalary: employeeSalary || 0,
        regulationArticle: regulationArticle.trim(),
        infractionDescription: infractionDescription.trim(),
        additionalInfo: additionalInfo.trim(),
      })

      if (!res.success || !res.data) {
        throw new Error(res.error || 'No se pudo registrar la multa disciplinaria.')
      }

      setCreatedDeduction(res.data)
      setStep(3)
      toast.success('Multa disciplinaria registrada y aplicada.')
      if (onSuccess) onSuccess()
      router.refresh()
    } catch (err: any) {
      console.error('Error creando multa disciplinaria:', err)
      toast.error(err.message || 'Error al procesar la multa.')
    } finally {
      setSubmitting(false)
    }
  }

  function handlePrint() {
    if (!selectedEmp) return

    printDisciplinaryFineDocument({
      organization: organization || { name: organizationName },
      organizationName,
      employeeName: selectedEmp.full_name,
      nationalId: selectedEmp.national_id || '',
      department: selectedEmp.department || '—',
      position: selectedEmp.position || '—',
      fineDate,
      amount: parsedAmount,
      employeeBaseSalary: employeeSalary || 0,
      regulationArticle: regulationArticle.trim(),
      infractionDescription: infractionDescription.trim(),
      additionalInfo: additionalInfo.trim(),
      status: createdDeduction?.status,
      documentCode: getDeductionCode(createdDeduction || undefined),
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
      {/* El <DialogContent> único vive en el launcher. Ver OvertimeWizardModal (Turnos). */}
          {/* Header */}
          <DialogHeader className="p-5 pb-4 bg-orange-500/10 border-b border-orange-500/20 text-left shrink-0 pr-12">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-600 dark:text-orange-400 shrink-0">
                <Gavel className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold text-foreground truncate">
                  Multa Disciplinaria
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                  Sanción pecuniaria según reglamento interno (Art. 44 Código del Trabajo)
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Contenido según paso */}
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
                              ? "bg-orange-500/10 border-l-4 border-l-orange-500 dark:bg-orange-950/30"
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
                              <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">
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

            {/* PASO 2: FALTA, REGLAMENTO Y MONTO */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Resumen del empleado y sueldo */}
                <div className="p-3.5 rounded-xl bg-muted/40 border flex items-center justify-between text-xs">
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

                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                      Sueldo Base
                    </span>
                    {loadingSalary ? (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Cargando...
                      </span>
                    ) : (
                      <span className="font-mono font-bold text-foreground text-xs">
                        ${employeeSalary?.toFixed(2) || '460.00'} USD
                      </span>
                    )}
                  </div>
                </div>

                {/* Fecha de la falta */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Fecha de la Falta *
                  </Label>
                  <Input
                    type="date"
                    value={fineDate}
                    onChange={(e) => setFineDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                {/* Artículo del reglamento interno */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Artículo/Numeral del Reglamento Interno *
                  </Label>
                  <Input
                    value={regulationArticle}
                    onChange={(e) => setRegulationArticle(e.target.value)}
                    placeholder="Ej. Art. 15, numeral 3 del Reglamento Interno de Trabajo"
                    className="h-9 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Requerido por el Art. 44 lit. a) del Código del Trabajo: la multa solo procede si está prevista en el reglamento interno legalmente aprobado.
                  </p>
                </div>

                {/* Descripción de la falta */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Descripción de la Falta Cometida *
                  </Label>
                  <textarea
                    rows={2}
                    value={infractionDescription}
                    onChange={(e) => setInfractionDescription(e.target.value)}
                    placeholder="Ej. Incumplimiento del horario de ingreso reincidente..."
                    className="w-full p-2.5 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
                  />
                </div>

                {/* Monto de la multa */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Valor de la Multa (USD) *
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-bold">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className={cn(
                        "pl-7 h-9 text-xs font-mono font-bold",
                        exceedsLegalLimit && "border-destructive focus-visible:ring-destructive/40"
                      )}
                    />
                  </div>
                  {maxAllowedAmount !== null && (
                    <p className="text-[10px] text-muted-foreground">
                      Límite legal (10% del sueldo): <strong>${maxAllowedAmount.toFixed(2)} USD</strong>
                      {parsedAmount > 0 && !exceedsLegalLimit && ` — equivale al ${fineRatio}% del sueldo`}
                    </p>
                  )}
                </div>

                {/* Bloqueo por exceder límite legal */}
                {exceedsLegalLimit && (
                  <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-xs text-destructive flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <strong>Monto no permitido:</strong> el valor ingresado supera el límite legal del <strong>10%</strong> de la remuneración mensual del empleado (máximo ${maxAllowedAmount?.toFixed(2)} USD), conforme al <strong>Art. 44 literal b)</strong> del Código del Trabajo. Ajusta el monto para poder continuar.
                    </div>
                  </div>
                )}

                {/* Información adicional */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Información Adicional (Opcional)
                  </Label>
                  <textarea
                    rows={2}
                    value={additionalInfo}
                    onChange={(e) => setAdditionalInfo(e.target.value)}
                    placeholder="Notas adicionales sobre el proceso disciplinario..."
                    className="w-full p-2.5 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
                  />
                </div>

                <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
                  <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                  <div>
                    Este descuento no requiere aprobación: quedará registrado como <strong>Aplicado en Rol</strong> de inmediato. Podrá anularse después en caso de corrección.
                  </div>
                </div>
              </div>
            )}

            {/* PASO 3: CONFIRMACIÓN E IMPRESIÓN */}
            {step === 3 && (
              <div className="space-y-4 py-2">
                <div className="flex flex-col items-center justify-center text-center p-5 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                  <div className="p-3 rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 mb-2">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    Multa Disciplinaria Registrada con Éxito
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    La multa quedó registrada con estado <strong>Aplicado en Rol</strong>. Puedes anularla posteriormente desde el detalle si fuese necesario.
                  </p>
                </div>

                <div className="p-4 rounded-xl border bg-card text-xs space-y-2.5">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground text-[11px]">Documento:</span>
                    <span className="font-bold font-mono text-foreground">
                      {getDeductionCode(createdDeduction || undefined) || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground text-[11px]">Empleado:</span>
                    <span className="font-bold text-foreground">{selectedEmp?.full_name}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground text-[11px]">Fundamento:</span>
                    <span className="font-medium text-foreground text-right max-w-[60%] truncate">{regulationArticle}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">Valor de la Multa:</span>
                    <span className="font-bold font-mono text-sm text-orange-600 dark:text-orange-400">
                      -${parsedAmount.toFixed(2)} USD {fineRatio > 0 && `(${fineRatio}%)`}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border bg-muted/20 text-xs text-muted-foreground flex items-center gap-2">
                  <Info className="h-4 w-4 text-orange-600 shrink-0" />
                  <span>
                    Puedes imprimir el comprobante oficial para adjuntarlo al expediente del empleado.
                  </span>
                </div>
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
                  className="text-xs gap-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold cursor-pointer"
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
                  disabled={
                    submitting ||
                    parsedAmount <= 0 ||
                    !fineDate ||
                    !regulationArticle.trim() ||
                    !infractionDescription.trim() ||
                    exceedsLegalLimit
                  }
                  onClick={handleCreateFine}
                  className="text-xs gap-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold cursor-pointer"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  Guardar Multa
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
                  Imprimir Comprobante
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
              <div className="p-2.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  ¿Descartar multa disciplinaria?
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
