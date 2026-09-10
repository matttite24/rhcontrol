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
import { DatePicker } from '@/components/ui/date-picker'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from '@/components/ui/toast'
import {
  Utensils,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Search,
  AlertTriangle,
  Info,
  CalendarDays,
  Repeat,
} from 'lucide-react'
import { createRecurringMealHousingDeductionAction } from '@/lib/deductions/actions'
import { getDeductionCode } from '@/lib/deductions/sequence'
import { cn } from '@/lib/utils'

interface MealHousingDeductionWizardModalProps {
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

export function MealHousingDeductionWizardModal({
  organizationId,
  employees,
  onOpenChange,
  onSuccess,
  onRegisterRequestClose,
}: MealHousingDeductionWizardModalProps) {
  const router = useRouter()

  // Pasos: 1: Empleado, 2: Modalidad/Monto/Detalle, 3: Confirmación
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [searchEmp, setSearchEmp] = useState('')
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)

  const today = new Date().toISOString().split('T')[0]

  const [calculationMode, setCalculationMode] = useState<'fijo' | 'por_dias'>('fijo')
  const [amount, setAmount] = useState<string>('')
  const [detail, setDetail] = useState<string>('')
  const [startDate, setStartDate] = useState<string>(today)

  const [submitting, setSubmitting] = useState(false)
  const [createdDeduction, setCreatedDeduction] = useState<Deduction | null>(null)
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

  const parsedAmount = Math.max(0, parseFloat(amount) || 0)

  function resetState() {
    setStep(1)
    setSelectedEmp(null)
    setSearchEmp('')
    setCalculationMode('fijo')
    setAmount('')
    setDetail('')
    setStartDate(today)
    setCreatedDeduction(null)
  }

  function handleRequestClose() {
    if (selectedEmp || parsedAmount > 0 || detail.trim() || step > 1) {
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
  }, [selectedEmp, parsedAmount, detail, step])

  async function handleCreateDeduction() {
    if (!selectedEmp) {
      toast.error('Selecciona un empleado.')
      return
    }

    if (parsedAmount <= 0) {
      toast.error('Ingresa un valor válido para el descuento.')
      return
    }

    if (!detail.trim()) {
      toast.error('Indica el detalle del descuento (ej. Vivienda, Comedor).')
      return
    }

    setSubmitting(true)

    try {
      const res = await createRecurringMealHousingDeductionAction({
        organizationId: organizationId || selectedEmp.organization_id,
        employeeId: selectedEmp.id,
        calculationMode,
        amount: parsedAmount,
        detail: detail.trim(),
        startDate,
      })

      if (!res.success || !res.data) {
        throw new Error(res.error || 'No se pudo registrar la regla de descuento.')
      }

      setCreatedDeduction(res.data)
      setStep(3)
      toast.success('Regla de descuento recurrente registrada y activa.')
      if (onSuccess) onSuccess()
      router.refresh()
    } catch (err: any) {
      console.error('Error creando regla de descuento por alimentación/vivienda:', err)
      toast.error(err.message || 'Error al procesar el descuento.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* El <DialogContent> único vive en el launcher. Ver OvertimeWizardModal (Turnos). */}
          {/* Header */}
          <DialogHeader className="p-5 pb-4 bg-emerald-500/10 border-b border-emerald-500/20 text-left shrink-0 pr-12">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Utensils className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold text-foreground truncate">
                  Descuento por Alimentación / Vivienda
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                  Regla recurrente mensual, no requiere aprobación
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
                              ? "bg-emerald-500/10 border-l-4 border-l-emerald-500 dark:bg-emerald-950/30"
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
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
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

            {/* PASO 2: MODALIDAD, MONTO Y DETALLE */}
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

                {/* Tipo de descuento: mensual fijo o por días trabajados */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-foreground">
                    Tipo de Descuento *
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setCalculationMode('fijo')}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1",
                        calculationMode === 'fijo'
                          ? "bg-emerald-500/10 border-emerald-500 text-foreground ring-1 ring-emerald-500/30"
                          : "bg-card hover:bg-muted/40 border-border/60"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Repeat className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-bold text-foreground">
                          Mensual Fijo
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Mismo valor cada mes, sin importar los días trabajados.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCalculationMode('por_dias')}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1",
                        calculationMode === 'por_dias'
                          ? "bg-emerald-500/10 border-emerald-500 text-foreground ring-1 ring-emerald-500/30"
                          : "bg-card hover:bg-muted/40 border-border/60"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-bold text-foreground">
                          Por Días Trabajados
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Valor diario × días efectivamente trabajados en cada corte.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Monto */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    {calculationMode === 'fijo' ? 'Valor Mensual (USD) *' : 'Valor Diario (USD) *'}
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
                      className="pl-7 h-9 text-xs font-mono font-bold"
                    />
                  </div>
                  {calculationMode === 'por_dias' && parsedAmount > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      Ej. con 22 días trabajados en el corte: ${(parsedAmount * 22).toFixed(2)} USD estimados.
                    </p>
                  )}
                </div>

                {/* Detalle corto (obligatorio) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Detalle del Descuento *
                  </Label>
                  <Input
                    value={detail}
                    onChange={(e) => setDetail(e.target.value.slice(0, 60))}
                    placeholder="Ej. Vivienda, Comedor institucional..."
                    className="h-9 text-xs"
                    maxLength={60}
                  />
                </div>

                {/* Fecha de inicio de la regla */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Vigente Desde *
                  </Label>
                  <DatePicker
                    name="start_date"
                    value={startDate}
                    onChange={(val) => setStartDate(val || today)}
                    className="w-full"
                  />
                </div>

                <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
                  <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                  <div>
                    Esta es una <strong>regla recurrente activa</strong>: no necesitas crear el descuento cada mes. Se aplicará automáticamente en cada rol de pagos mientras esté activa. Puedes <strong>anularla</strong> en cualquier momento desde el detalle para desactivarla, y reactivarla después si es necesario.
                  </div>
                </div>
              </div>
            )}

            {/* PASO 3: CONFIRMACIÓN */}
            {step === 3 && (
              <div className="space-y-4 py-2">
                <div className="flex flex-col items-center justify-center text-center p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="p-3 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mb-2">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    Regla de Descuento Activada
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    Quedó registrada como <strong>Activa</strong> y se aplicará automáticamente en cada rol de pagos mientras no se anule.
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
                    <span className="text-muted-foreground text-[11px]">Detalle:</span>
                    <span className="font-medium text-foreground">{detail}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground text-[11px]">Modalidad:</span>
                    <span className="font-medium text-foreground">
                      {calculationMode === 'fijo' ? 'Mensual Fijo' : 'Por Días Trabajados'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">
                      {calculationMode === 'fijo' ? 'Valor Mensual:' : 'Valor Diario:'}
                    </span>
                    <span className="font-bold font-mono text-sm text-emerald-600 dark:text-emerald-400">
                      -${parsedAmount.toFixed(2)} USD
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border bg-muted/20 text-xs text-muted-foreground flex items-center gap-2">
                  <Info className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    Podrás ver, anular o reactivar esta regla desde el listado de Descuentos.
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
                  className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
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
                  disabled={submitting || parsedAmount <= 0 || !detail.trim() || !startDate}
                  onClick={handleCreateDeduction}
                  className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  Activar Descuento
                </Button>
              </>
            )}

            {step === 3 && (
              <Button
                type="button"
                size="sm"
                onClick={forceClose}
                className="text-xs font-semibold cursor-pointer ml-auto"
              >
                Finalizar
              </Button>
            )}
          </div>

      {/* Diálogo de Confirmación para Evitar Cierre Accidental (sub-modal independiente, mantiene su propio Dialog) */}
      <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  ¿Descartar regla de descuento?
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
