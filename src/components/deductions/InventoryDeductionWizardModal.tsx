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
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import {
  PackageX,
  Printer,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Search,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { printInventoryDeductionDocument } from '@/lib/deductions/print-inventory'
import {
  createInventoryDeductionAction,
  getActiveDeliveryActsForEmployee,
  DeliveryActWithAvailableItems,
} from '@/lib/deductions/actions'
import { getDeductionCode } from '@/lib/deductions/sequence'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface InventoryDeductionWizardModalProps {
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

export function InventoryDeductionWizardModal({
  organizationId,
  organizationName = 'RH Garden',
  employees,
  onOpenChange,
  onSuccess,
  onRegisterRequestClose,
}: InventoryDeductionWizardModalProps) {
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

  // Pasos: 1: Empleado, 2: Acta e ítems, 3: Confirmación e Impresión
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [searchEmp, setSearchEmp] = useState('')
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)

  const [loadingActs, setLoadingActs] = useState(false)
  const [deliveryActs, setDeliveryActs] = useState<DeliveryActWithAvailableItems[]>([])
  const [selectedActId, setSelectedActId] = useState<string>('')
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])

  const today = new Date().toISOString().split('T')[0]
  const [deductionDate, setDeductionDate] = useState<string>(today)
  const [additionalInfo, setAdditionalInfo] = useState<string>('')

  const [submitting, setSubmitting] = useState(false)
  const [createdDeduction, setCreatedDeduction] = useState<Deduction | null>(null)
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  // Cargar actas activas del empleado al seleccionarlo
  useEffect(() => {
    if (!selectedEmp) {
      setDeliveryActs([])
      setSelectedActId('')
      setSelectedItemIds([])
      return
    }

    let isMounted = true
    setLoadingActs(true)

    getActiveDeliveryActsForEmployee(selectedEmp.id)
      .then((acts) => {
        if (!isMounted) return
        setDeliveryActs(acts)
        const firstWithItems = acts.find((a) => a.availableItems.length > 0)
        setSelectedActId(firstWithItems?.id || acts[0]?.id || '')
        setSelectedItemIds([])
      })
      .finally(() => {
        if (isMounted) setLoadingActs(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedEmp])

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

  const selectedAct = useMemo(
    () => deliveryActs.find((a) => a.id === selectedActId) || null,
    [deliveryActs, selectedActId]
  )

  const selectedItems = useMemo(() => {
    if (!selectedAct) return []
    return selectedAct.availableItems.filter((it) => selectedItemIds.includes(it.id))
  }, [selectedAct, selectedItemIds])

  const totalAmount = useMemo(
    () => selectedItems.reduce((acc, it) => acc + (Number(it.totalValue) || 0), 0),
    [selectedItems]
  )

  const hasNoActiveActs = !loadingActs && deliveryActs.length === 0
  const hasActsButNoAvailableItems =
    !loadingActs && deliveryActs.length > 0 && deliveryActs.every((a) => a.availableItems.length === 0)

  function toggleItem(id: string) {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function resetState() {
    setStep(1)
    setSelectedEmp(null)
    setSearchEmp('')
    setDeliveryActs([])
    setSelectedActId('')
    setSelectedItemIds([])
    setDeductionDate(today)
    setAdditionalInfo('')
    setCreatedDeduction(null)
  }

  function handleRequestClose() {
    if (selectedEmp || selectedItemIds.length > 0 || additionalInfo.trim() || step > 1) {
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
  }, [selectedEmp, selectedItemIds, additionalInfo, step])

  async function handleCreateDeduction() {
    if (!selectedEmp) {
      toast.error('Selecciona un empleado.')
      return
    }

    if (!selectedAct) {
      toast.error('Selecciona un acta de entrega-recepción activa.')
      return
    }

    if (selectedItemIds.length === 0) {
      toast.error('Selecciona al menos un bien del acta a descontar.')
      return
    }

    setSubmitting(true)

    try {
      const res = await createInventoryDeductionAction({
        organizationId: organizationId || selectedEmp.organization_id,
        employeeId: selectedEmp.id,
        deliveryActIncidentId: selectedAct.id,
        selectedItemIds,
        deductionDate,
        additionalInfo: additionalInfo.trim(),
      })

      if (!res.success || !res.data) {
        throw new Error(res.error || 'No se pudo registrar el descuento de inventario.')
      }

      setCreatedDeduction(res.data)
      setStep(3)
      toast.success('Descuento por inventario registrado y aplicado.')
      if (onSuccess) onSuccess()
      router.refresh()
    } catch (err: any) {
      console.error('Error creando descuento por inventario:', err)
      toast.error(err.message || 'Error al procesar el descuento.')
    } finally {
      setSubmitting(false)
    }
  }

  function handlePrint() {
    if (!selectedEmp) return

    printInventoryDeductionDocument({
      organization: organization || { name: organizationName },
      organizationName,
      employeeName: selectedEmp.full_name,
      nationalId: selectedEmp.national_id || '',
      department: selectedEmp.department || '—',
      position: selectedEmp.position || '—',
      deductionDate,
      amount: totalAmount,
      items: selectedItems,
      deliveryActCode: selectedAct?.document_code,
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
          <DialogHeader className="p-5 pb-4 bg-amber-500/10 border-b border-amber-500/20 text-left shrink-0 pr-12">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 shrink-0">
                <PackageX className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold text-foreground truncate">
                  Descuento por Inventario
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                  Requiere un acta de entrega-recepción activa del empleado
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
              </div>
            )}

            {/* PASO 2: ACTA E ÍTEMS */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Resumen del empleado */}
                <div className="p-3.5 rounded-xl bg-muted/40 border flex items-center gap-2.5 text-xs">
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

                {loadingActs ? (
                  <div className="p-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando actas de entrega-recepción activas...
                  </div>
                ) : hasNoActiveActs ? (
                  <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-xs text-destructive flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <strong>Sin acta de entrega-recepción activa.</strong> Este empleado no tiene ningún acta vigente en el sistema. Solo se puede descontar por inventario bienes previamente entregados y registrados en un acta activa (crea el acta desde el módulo de Incidencias).
                    </div>
                  </div>
                ) : hasActsButNoAvailableItems ? (
                  <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <strong>Sin bienes disponibles.</strong> Todos los bienes entregados a este empleado ya fueron descontados previamente. Si un descuento anterior fue un error, anúlalo para liberar el bien.
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Selector de acta si hay más de una */}
                    {deliveryActs.length > 1 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground">
                          Acta de Entrega-Recepción *
                        </Label>
                        <select
                          value={selectedActId}
                          onChange={(e) => {
                            setSelectedActId(e.target.value)
                            setSelectedItemIds([])
                          }}
                          className="w-full h-9 rounded-md border border-input bg-card px-3 text-xs text-foreground focus:ring-1 focus:ring-ring cursor-pointer"
                        >
                          {deliveryActs.map((act) => (
                            <option key={act.id} value={act.id} disabled={act.availableItems.length === 0}>
                              {act.document_code} — {act.delivery_date} ({act.availableItems.length} bienes disponibles)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Lista de ítems disponibles */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-foreground">
                          Bienes a Descontar (Acta {selectedAct?.document_code}) *
                        </Label>
                        <span className="text-[11px] text-muted-foreground">
                          {selectedAct?.availableItems.length || 0} disponibles
                        </span>
                      </div>

                      <div className="border rounded-xl divide-y max-h-[220px] overflow-y-auto bg-card/40">
                        {selectedAct?.availableItems.length === 0 ? (
                          <div className="p-4 text-center text-xs text-muted-foreground">
                            No hay bienes disponibles en esta acta.
                          </div>
                        ) : (
                          selectedAct?.availableItems.map((it) => {
                            const isChecked = selectedItemIds.includes(it.id)
                            return (
                              <label
                                key={it.id}
                                className={cn(
                                  "w-full text-left p-2.5 flex items-center justify-between gap-3 transition-colors text-xs cursor-pointer",
                                  isChecked ? "bg-amber-500/10" : "hover:bg-muted/50"
                                )}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleItem(it.id)}
                                    className="h-4 w-4 rounded border-input text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <p className="font-semibold text-foreground truncate">
                                      {it.description}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground font-mono">
                                      Cant: {it.quantity} • {it.condition} {it.serialOrCode ? `• Cód: ${it.serialOrCode}` : ''}
                                    </p>
                                  </div>
                                </div>
                                <span className="font-mono font-bold text-foreground shrink-0">
                                  ${Number(it.totalValue).toFixed(2)}
                                </span>
                              </label>
                            )
                          })
                        )}
                      </div>
                    </div>

                    {/* Total calculado */}
                    <div className="p-3 rounded-lg bg-muted/30 border flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Total a Descontar ({selectedItemIds.length} {selectedItemIds.length === 1 ? 'bien' : 'bienes'}):</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400 font-mono text-sm">
                        ${totalAmount.toFixed(2)} USD
                      </span>
                    </div>

                    {/* Fecha del descuento */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">
                        Fecha del Descuento *
                      </Label>
                      <Input
                        type="date"
                        value={deductionDate}
                        onChange={(e) => setDeductionDate(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>

                    {/* Información adicional */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">
                        Información Adicional (Opcional)
                      </Label>
                      <textarea
                        rows={2}
                        value={additionalInfo}
                        onChange={(e) => setAdditionalInfo(e.target.value)}
                        placeholder="Ej. Herramienta extraviada al finalizar el turno..."
                        className="w-full p-2.5 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
                      />
                    </div>

                    <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
                      <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                      <div>
                        Este descuento no requiere aprobación: quedará registrado como <strong>Aplicado en Rol</strong> de inmediato. Podrá anularse después, lo que liberará los bienes seleccionados.
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* PASO 3: CONFIRMACIÓN E IMPRESIÓN */}
            {step === 3 && (
              <div className="space-y-4 py-2">
                <div className="flex flex-col items-center justify-center text-center p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <div className="p-3 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 mb-2">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    Descuento por Inventario Registrado
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    El descuento quedó registrado con estado <strong>Aplicado en Rol</strong>. Puedes anularlo posteriormente desde el detalle, lo que liberará los bienes para corrección.
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
                    <span className="text-muted-foreground text-[11px]">Acta de Origen:</span>
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {selectedAct?.document_code}
                    </Badge>
                  </div>

                  <div className="pt-1">
                    <span className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
                      Bienes Descontados:
                    </span>
                    <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                      {selectedItems.map((it) => (
                        <div key={it.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-[11px]">
                          <span>{it.description} (x{it.quantity})</span>
                          <span className="font-mono font-bold text-foreground">
                            ${Number(it.totalValue).toFixed(2)} USD
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-muted-foreground text-[11px]">Total Descontado:</span>
                    <span className="font-bold font-mono text-sm text-amber-600 dark:text-amber-400">
                      -${totalAmount.toFixed(2)} USD
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border bg-muted/20 text-xs text-muted-foreground flex items-center gap-2">
                  <Info className="h-4 w-4 text-amber-600 shrink-0" />
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
                  disabled={
                    submitting ||
                    loadingActs ||
                    hasNoActiveActs ||
                    hasActsButNoAvailableItems ||
                    selectedItemIds.length === 0 ||
                    !deductionDate
                  }
                  onClick={handleCreateDeduction}
                  className="text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  Guardar Inventario
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
              <div className="p-2.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  ¿Descartar descuento por inventario?
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
