'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Employee } from '@/types/employee'
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
  Landmark,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Search,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { createQuirografarioDeductionAction } from '@/lib/deductions/actions'
import { cn } from '@/lib/utils'

interface QuirografarioDeductionWizardModalProps {
  organizationId: string
  organizationName?: string
  employees: Employee[]
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  onRegisterRequestClose?: (fn: () => void) => void
}

const MONTH_NAMES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function QuirografarioDeductionWizardModal({
  organizationId,
  employees,
  onOpenChange,
  onSuccess,
  onRegisterRequestClose,
}: QuirografarioDeductionWizardModalProps) {
  const router = useRouter()

  // Pasos: 1: Empleado, 2: Datos del crédito, 3: Tabla de amortización (editable), 4: Confirmación
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [searchEmp, setSearchEmp] = useState('')
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const [installmentAmount, setInstallmentAmount] = useState<string>('')
  const [totalInstallments, setTotalInstallments] = useState<string>('')
  const [paidInstallments, setPaidInstallments] = useState<string>('0')
  const [startMonth, setStartMonth] = useState<number>(currentMonth)
  const [startYear, setStartYear] = useState<number>(currentYear)
  const [iessReference, setIessReference] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  // Valor editable de cada cuota faltante (paso 3), en el mismo orden del cronograma.
  const [amounts, setAmounts] = useState<string[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [createdCount, setCreatedCount] = useState(0)
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

  const parsedAmount = Math.max(0, parseFloat(installmentAmount) || 0)
  const total = Math.floor(Number(totalInstallments) || 0)
  const paid = Math.max(0, Math.floor(Number(paidInstallments) || 0))
  const remaining = total - paid
  const isValid = parsedAmount > 0 && total >= 1 && total <= 60 && paid >= 0 && remaining >= 1

  // Cronograma de las cuotas faltantes, en meses consecutivos desde el rol elegido.
  const schedule = useMemo(() => {
    if (!isValid) return []
    return Array.from({ length: remaining }, (_, i) => {
      let m = startMonth + i
      let y = startYear
      while (m > 12) {
        m -= 12
        y += 1
      }
      return { number: paid + i + 1, month: m, year: y }
    })
  }, [isValid, remaining, paid, startMonth, startYear])

  const parsedAmounts = amounts.map((a) => Math.max(0, parseFloat(a) || 0))
  const amountsValid = amounts.length === schedule.length && parsedAmounts.every((a) => a > 0)
  const remainingTotal = Number(parsedAmounts.reduce((sum, a) => sum + a, 0).toFixed(2))
  const hasCustomAmounts = parsedAmounts.some((a) => a !== parsedAmounts[0])

  // Entra al paso 3 con todas las cuotas iguales al valor base; el usuario ajusta las que difieran.
  function goToAmortization() {
    setAmounts(schedule.map(() => parsedAmount.toFixed(2)))
    setStep(3)
  }

  function updateAmount(index: number, value: string) {
    setAmounts((prev) => prev.map((a, i) => (i === index ? value : a)))
  }

  function applyBaseToAll() {
    setAmounts(schedule.map(() => parsedAmount.toFixed(2)))
  }
  const isPastStart = startYear < currentYear || (startYear === currentYear && startMonth < currentMonth)

  function resetState() {
    setStep(1)
    setSelectedEmp(null)
    setSearchEmp('')
    setInstallmentAmount('')
    setTotalInstallments('')
    setPaidInstallments('0')
    setAmounts([])
    setStartMonth(currentMonth)
    setStartYear(currentYear)
    setIessReference('')
    setNotes('')
    setCreatedCount(0)
  }

  function handleRequestClose() {
    if (selectedEmp || parsedAmount > 0 || notes.trim() || step > 1) {
      if (step === 4) {
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
  }, [selectedEmp, parsedAmount, notes, step])

  async function handleCreate() {
    if (!selectedEmp) {
      toast.error('Selecciona un empleado.')
      return
    }
    if (!isValid || !amountsValid) {
      toast.error('Revisa los datos del crédito y el valor de cada cuota.')
      return
    }

    setSubmitting(true)
    try {
      const res = await createQuirografarioDeductionAction({
        organizationId: organizationId || selectedEmp.organization_id,
        employeeId: selectedEmp.id,
        installmentAmounts: parsedAmounts,
        totalInstallments: total,
        paidInstallments: paid,
        startMonth,
        startYear,
        iessReference: iessReference.trim(),
        notes: notes.trim(),
      })

      if (!res.success || !res.data) {
        throw new Error(res.error || 'No se pudo registrar el crédito quirografario.')
      }

      setCreatedCount(res.data.length)
      setStep(4)
      toast.success('Crédito quirografario registrado.')
      if (onSuccess) onSuccess()
      router.refresh()
    } catch (err: any) {
      console.error('Error creando crédito quirografario:', err)
      toast.error(err.message || 'Error al registrar el crédito.')
    } finally {
      setSubmitting(false)
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
        <DialogHeader className="p-5 pb-4 bg-sky-500/10 border-b border-sky-500/20 text-left shrink-0 pr-12">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-400 shrink-0">
              <Landmark className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold text-foreground truncate">
                Crédito Quirografario (IESS)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                Se descuenta en el rol y se paga al IESS por planilla
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* PASO 1: EMPLEADO */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">1. Seleccionar Empleado</Label>
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
                          'w-full text-left p-3 flex items-center justify-between transition-colors cursor-pointer text-xs',
                          isSelected
                            ? 'bg-sky-500/10 border-l-4 border-l-sky-500 dark:bg-sky-950/30'
                            : 'hover:bg-muted/50'
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
                            <p className="font-semibold text-foreground truncate">{emp.full_name}</p>
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
                            <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">
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

          {/* PASO 2: DATOS DEL CRÉDITO */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-muted/40 border flex items-center gap-2.5 text-xs">
                <Avatar className="h-7 w-7 border">
                  <AvatarImage src={selectedEmp?.avatar_url || ''} />
                  <AvatarFallback className="text-[10px] font-bold">
                    {selectedEmp ? getInitials(selectedEmp.full_name) : ''}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span className="font-bold text-foreground block">{selectedEmp?.full_name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {selectedEmp?.position} • C.I.: {selectedEmp?.national_id || '—'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Valor de la cuota (USD) *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={installmentAmount}
                    onChange={(e) => setInstallmentAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Plazo total (cuotas) *</Label>
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    step="1"
                    value={totalInstallments}
                    onChange={(e) => setTotalInstallments(e.target.value)}
                    placeholder="Ej. 18"
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Cuotas ya pagadas</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={paidInstallments}
                    onChange={(e) => setPaidInstallments(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-sky-500/5 border border-sky-500/20 text-[11px] text-muted-foreground flex items-start gap-2">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
                <span>
                  Si el crédito ya venía en curso, indica cuántas cuotas se pagaron antes: solo se registrarán las
                  que faltan.
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Rol de la primera cuota faltante *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={startMonth}
                    onChange={(e) => setStartMonth(parseInt(e.target.value, 10))}
                    className="w-full h-9 rounded-md border border-input bg-card px-2 text-xs text-foreground cursor-pointer"
                  >
                    {MONTH_NAMES.slice(1).map((mName, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {mName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={startYear}
                    onChange={(e) => setStartYear(parseInt(e.target.value, 10))}
                    className="w-full h-9 rounded-md border border-input bg-card px-2 text-xs text-foreground cursor-pointer"
                  >
                    {[currentYear - 1, currentYear, currentYear + 1].map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
                {isPastStart && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    Es un mes pasado: la cuota se cargará en el rol de {MONTH_NAMES[startMonth]} {startYear}{' '}
                    (regularización).
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">N° de crédito / referencia IESS (opcional)</Label>
                  <Input
                    value={iessReference}
                    onChange={(e) => setIessReference(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Observaciones (opcional)</Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9 text-xs" />
                </div>
              </div>

              {isValid ? (
                <div className="p-3 rounded-xl border bg-card text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Cuotas a registrar:</span>
                    <span className="font-bold text-foreground">
                      {remaining} (de la {paid + 1} a la {total})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total estimado a descontar:</span>
                    <span className="font-bold font-mono text-sky-600 dark:text-sky-400">
                      ${Number((parsedAmount * remaining).toFixed(2)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Rol final:</span>
                    <span className="font-medium text-foreground">
                      {MONTH_NAMES[schedule[schedule.length - 1].month]} {schedule[schedule.length - 1].year}
                    </span>
                  </div>
                </div>
              ) : (
                total > 0 &&
                remaining < 1 && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400">
                    Las cuotas pagadas deben ser menos que el plazo total.
                  </p>
                )
              )}
            </div>
          )}

          {/* PASO 3: TABLA DE AMORTIZACIÓN (editable antes de registrar) */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-sm text-foreground">Tabla de amortización</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Ajusta el valor de cada cuota si no son iguales (según la tabla del IESS). Cada una se
                    descontará automáticamente en el rol de su mes.
                  </p>
                </div>
                {hasCustomAmounts && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={applyBaseToAll}
                    className="text-[11px] h-7 shrink-0 cursor-pointer"
                  >
                    Igualar todas
                  </Button>
                )}
              </div>

              <div className="border rounded-xl overflow-hidden text-xs">
                <div className="grid grid-cols-[70px_1fr_120px] bg-muted/40 px-3.5 py-2 font-semibold text-muted-foreground">
                  <span>Cuota</span>
                  <span>Rol</span>
                  <span className="text-right">Valor (USD)</span>
                </div>
                <div className="divide-y max-h-[300px] overflow-y-auto">
                  {schedule.map((s, i) => (
                    <div key={s.number} className="grid grid-cols-[70px_1fr_120px] items-center px-3.5 py-1.5">
                      <span className="text-muted-foreground">
                        {s.number}/{total}
                      </span>
                      <span className="font-medium text-foreground">
                        {MONTH_NAMES[s.month]} {s.year}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amounts[i] ?? ''}
                        onChange={(e) => updateAmount(i, e.target.value)}
                        className={cn(
                          'h-8 text-xs font-mono text-right',
                          parsedAmounts[i] !== parsedAmount && 'border-sky-500/50 bg-sky-500/5'
                        )}
                        aria-label={`Valor de la cuota ${s.number}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-[70px_1fr_120px] bg-muted/30 px-3.5 py-2.5 border-t font-bold">
                  <span />
                  <span className="text-foreground">Total a descontar ({schedule.length} cuotas)</span>
                  <span className="text-right font-mono text-sky-600 dark:text-sky-400">
                    ${remainingTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {!amountsValid && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400">
                  Todas las cuotas deben tener un valor mayor a cero.
                </p>
              )}
            </div>
          )}

          {/* PASO 4: CONFIRMACIÓN */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center gap-2 py-2">
                <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-base text-foreground">Crédito registrado</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Se crearon <strong>{createdCount}</strong> {createdCount === 1 ? 'cuota' : 'cuotas'} por un total de{' '}
                  <strong>${remainingTotal.toFixed(2)}</strong> para <strong>{selectedEmp?.full_name}</strong>. Cada
                  cierre de rol tomará la cuota de su mes automáticamente.
                </p>
              </div>

              <div className="border rounded-xl divide-y max-h-[220px] overflow-y-auto text-xs">
                {schedule.map((s, i) => (
                  <div key={s.number} className="flex items-center justify-between px-3.5 py-2">
                    <span className="text-muted-foreground">
                      Cuota {s.number}/{total}
                    </span>
                    <span className="font-medium text-foreground">
                      {MONTH_NAMES[s.month]} {s.year}
                    </span>
                    <span className="font-mono font-bold text-foreground">${(parsedAmounts[i] ?? 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/10 flex items-center justify-between gap-2 shrink-0">
          {step === 1 && (
            <>
              <Button variant="outline" size="sm" onClick={handleRequestClose} className="text-xs cursor-pointer">
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!selectedEmp}
                onClick={() => setStep(2)}
                className="text-xs gap-1 cursor-pointer"
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
                className="text-xs gap-1 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Atrás
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!isValid}
                onClick={goToAmortization}
                className="text-xs gap-1 cursor-pointer"
              >
                Ver tabla de amortización
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          {step === 3 && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep(2)}
                disabled={submitting}
                className="text-xs gap-1 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Atrás
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={submitting || !amountsValid}
                onClick={handleCreate}
                className="text-xs gap-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold cursor-pointer"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                Registrar {schedule.length} {schedule.length === 1 ? 'cuota' : 'cuotas'}
              </Button>
            </>
          )}

          {step === 4 && (
            <Button type="button" size="sm" onClick={forceClose} className="text-xs font-semibold cursor-pointer ml-auto">
              Finalizar
            </Button>
          )}
        </div>
      </div>

      {/* Confirmación para evitar cierre accidental */}
      <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">¿Descartar el crédito?</DialogTitle>
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
