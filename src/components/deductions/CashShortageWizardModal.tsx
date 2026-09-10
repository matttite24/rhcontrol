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
  DollarSign,
  Printer,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Search,
  AlertTriangle,
  Info,
  CalendarClock,
} from 'lucide-react'
import { printCashShortageDocument } from '@/lib/deductions/print-cash-shortage'
import { createCashShortageDeductionAction } from '@/lib/deductions/actions'
import { getDeductionCode } from '@/lib/deductions/sequence'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface CashShortageWizardModalProps {
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

const MONTH_NAMES = [
  '',
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export function CashShortageWizardModal({
  organizationId,
  organizationName = 'RH Garden',
  employees,
  onOpenChange,
  onSuccess,
  onRegisterRequestClose,
}: CashShortageWizardModalProps) {
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

  // Pasos: 1: Empleado, 2: Fecha/Monto/Motivo/Período de aplicación, 3: Confirmación e Impresión
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [searchEmp, setSearchEmp] = useState('')
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const today = now.toISOString().split('T')[0]

  const [cashDate, setCashDate] = useState<string>(today)
  const [amount, setAmount] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [applyPeriod, setApplyPeriod] = useState<'current' | 'other'>('current')
  const [periodMonth, setPeriodMonth] = useState<number>(currentMonth)
  const [periodYear, setPeriodYear] = useState<number>(currentYear)

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
  const effectiveMonth = applyPeriod === 'current' ? currentMonth : periodMonth
  const effectiveYear = applyPeriod === 'current' ? currentYear : periodYear

  function resetState() {
    setStep(1)
    setSelectedEmp(null)
    setSearchEmp('')
    setCashDate(today)
    setAmount('')
    setReason('')
    setApplyPeriod('current')
    setPeriodMonth(currentMonth)
    setPeriodYear(currentYear)
    setCreatedDeduction(null)
  }

  function handleRequestClose() {
    if (selectedEmp || parsedAmount > 0 || reason.trim() || step > 1) {
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
  }, [selectedEmp, parsedAmount, reason, step])

  async function handleCreateDeduction() {
    if (!selectedEmp) {
      toast.error('Selecciona un empleado.')
      return
    }

    if (!cashDate) {
      toast.error('Ingresa la fecha de la caja.')
      return
    }

    if (parsedAmount <= 0) {
      toast.error('Ingresa un valor válido para el descuento.')
      return
    }

    if (!reason.trim()) {
      toast.error('Indica el motivo del faltante de caja.')
      return
    }

    setSubmitting(true)

    try {
      const res = await createCashShortageDeductionAction({
        organizationId: organizationId || selectedEmp.organization_id,
        employeeId: selectedEmp.id,
        cashDate,
        amount: parsedAmount,
        reason: reason.trim(),
        periodMonth: effectiveMonth,
        periodYear: effectiveYear,
      })

      if (!res.success || !res.data) {
        throw new Error(res.error || 'No se pudo registrar el descuento.')
      }

      setCreatedDeduction(res.data)
      setStep(3)
      toast.success('Descuento por faltante de caja registrado y aplicado.')
      if (onSuccess) onSuccess()
      router.refresh()
    } catch (err: any) {
      console.error('Error creando descuento por faltante de caja:', err)
      toast.error(err.message || 'Error al procesar el descuento.')
    } finally {
      setSubmitting(false)
    }
  }

  function handlePrint() {
    if (!selectedEmp) return

    printCashShortageDocument({
      organization: organization || { name: organizationName },
      organizationName,
      employeeName: selectedEmp.full_name,
      nationalId: selectedEmp.national_id || '',
      department: selectedEmp.department || '—',
      position: selectedEmp.position || '—',
      cashDate,
      amount: parsedAmount,
      reason: reason.trim(),
      periodMonth: effectiveMonth,
      periodYear: effectiveYear,
      status: createdDeduction?.status,
      documentCode: getDeductionCode(createdDeduction || undefined),
    })
  }

  return (
    <>
      {/* El <DialogContent> único vive en el launcher. Ver OvertimeWizardModal (Turnos). */}
          {/* Header */}
          <DialogHeader className="p-5 pb-4 bg-rose-500/10 border-b border-rose-500/20 text-left shrink-0 pr-12">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 shrink-0">
                <DollarSign className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold text-foreground truncate">
                  Descuento por Faltante de Caja
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                  Registro directo, no requiere aprobación
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
                              ? "bg-rose-500/10 border-l-4 border-l-rose-500 dark:bg-rose-950/30"
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
                              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
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

            {/* PASO 2: FECHA, MONTO, MOTIVO Y PERÍODO DE APLICACIÓN */}
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

                {/* Fecha de la caja y monto a descontar */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">
                      Fecha de la Caja *
                    </Label>
                    <DatePicker
                      name="cash_date"
                      value={cashDate}
                      onChange={(val) => setCashDate(val || today)}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">
                      Valor a Descontar (USD) *
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
                  </div>
                </div>

                {/* Motivo (obligatorio) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Motivo del Faltante *
                  </Label>
                  <textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ej. Diferencia detectada en arqueo de fin de turno..."
                    className="w-full p-2.5 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
                  />
                </div>

                {/* Cuándo se aplicará el descuento */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                    ¿Cuándo se Aplicará el Descuento? *
                  </Label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setApplyPeriod('current')}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all cursor-pointer",
                        applyPeriod === 'current'
                          ? "bg-rose-500/10 border-rose-500 text-foreground ring-1 ring-rose-500/30"
                          : "bg-card hover:bg-muted/40 border-border/60"
                      )}
                    >
                      <span className="text-xs font-bold text-foreground block">
                        Rol del Mes en Curso
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Se descuenta en {MONTH_NAMES[currentMonth]} {currentYear}.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setApplyPeriod('other')}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all cursor-pointer",
                        applyPeriod === 'other'
                          ? "bg-rose-500/10 border-rose-500 text-foreground ring-1 ring-rose-500/30"
                          : "bg-card hover:bg-muted/40 border-border/60"
                      )}
                    >
                      <span className="text-xs font-bold text-foreground block">
                        Elegir Otro Rol
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Selecciona el mes y año en que se descontará.
                      </p>
                    </button>
                  </div>

                  {applyPeriod === 'other' && (
                    <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl border bg-muted/20">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Mes</Label>
                        <select
                          value={periodMonth}
                          onChange={(e) => setPeriodMonth(parseInt(e.target.value, 10))}
                          className="w-full h-9 rounded-md border border-input bg-card px-2 text-xs text-foreground cursor-pointer"
                        >
                          {MONTH_NAMES.slice(1).map((mName, idx) => (
                            <option key={idx + 1} value={idx + 1}>
                              {mName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Año</Label>
                        <select
                          value={periodYear}
                          onChange={(e) => setPeriodYear(parseInt(e.target.value, 10))}
                          className="w-full h-9 rounded-md border border-input bg-card px-2 text-xs text-foreground cursor-pointer"
                        >
                          {[currentYear, currentYear + 1].map((yr) => (
                            <option key={yr} value={yr}>
                              {yr}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
                  <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                  <div>
                    Este descuento no requiere aprobación: quedará registrado como <strong>Aplicado en Rol</strong> de inmediato, en el rol de <strong>{MONTH_NAMES[effectiveMonth]} {effectiveYear}</strong>. Podrá anularse después en caso de corrección.
                  </div>
                </div>
              </div>
            )}

            {/* PASO 3: CONFIRMACIÓN E IMPRESIÓN */}
            {step === 3 && (
              <div className="space-y-4 py-2">
                <div className="flex flex-col items-center justify-center text-center p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                  <div className="p-3 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 mb-2">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    Descuento Registrado con Éxito
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    El descuento quedó registrado con estado <strong>Aplicado en Rol</strong>. Puedes anularlo posteriormente desde el detalle si fuese necesario.
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
                    <span className="text-muted-foreground text-[11px]">Fecha de la Caja:</span>
                    <span className="font-medium text-foreground">{cashDate}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground text-[11px]">Se Descuenta en:</span>
                    <span className="font-medium text-foreground">
                      {MONTH_NAMES[effectiveMonth]} {effectiveYear}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">Valor Descontado:</span>
                    <span className="font-bold font-mono text-sm text-rose-600 dark:text-rose-400">
                      -${parsedAmount.toFixed(2)} USD
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border bg-muted/20 text-xs text-muted-foreground flex items-center gap-2">
                  <Info className="h-4 w-4 text-rose-600 shrink-0" />
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
                  className="text-xs gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
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
                  disabled={submitting || parsedAmount <= 0 || !cashDate || !reason.trim()}
                  onClick={handleCreateDeduction}
                  className="text-xs gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  Guardar Faltante
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

      {/* Diálogo de Confirmación para Evitar Cierre Accidental (sub-modal independiente, mantiene su propio Dialog) */}
      <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  ¿Descartar descuento por faltante de caja?
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
