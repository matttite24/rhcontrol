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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import {
  DollarSign,
  Printer,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Search,
  Calendar,
  FileText,
  AlertTriangle,
  CreditCard,
  Layers,
  Info,
} from 'lucide-react'
import { printSalaryAdvanceDocument } from '@/lib/incidents/print-salary-advance'
import {
  createSalaryAdvanceAction,
  SalaryAdvanceInstallment,
} from '@/lib/incidents/actions'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface SalaryAdvanceWizardModalProps {
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

export function SalaryAdvanceWizardModal({
  organizationId,
  organizationName = 'RH Garden',
  employees,
  onOpenChange,
  onSuccess,
  onRegisterRequestClose,
}: SalaryAdvanceWizardModalProps) {
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

  // Pasos: 1: Empleado, 2: Monto y Modalidad (mes actual vs cuotas), 3: Confirmación e Impresión
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [searchEmp, setSearchEmp] = useState('')
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
  const [employeeSalary, setEmployeeSalary] = useState<number | null>(null)
  const [loadingSalary, setLoadingSalary] = useState(false)

  // Datos del paso 2
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const [totalAmount, setTotalAmount] = useState<string>('50')
  const [modality, setModality] = useState<'mes_actual' | 'cuotas'>('mes_actual')
  const [installmentsCount, setInstallmentsCount] = useState<number>(4)
  const [startMonth, setStartMonth] = useState<number>(currentMonth)
  const [startYear, setStartYear] = useState<number>(currentYear)
  const [reason, setReason] = useState<string>('')

  // Estado de guardado y resultado
  const [submitting, setSubmitting] = useState(false)
  const [createdIncident, setCreatedIncident] = useState<Incident | null>(null)
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

  // Cálculo proyectado de cronograma de cuotas
  const parsedAmount = Math.max(0, parseFloat(totalAmount) || 0)
  const count = modality === 'mes_actual' ? 1 : Math.max(1, installmentsCount || 1)
  const basePerInstallment = Number((parsedAmount / count).toFixed(2))

  const projectedSchedule: SalaryAdvanceInstallment[] = useMemo(() => {
    if (parsedAmount <= 0) return []
    const sched: SalaryAdvanceInstallment[] = []
    let accumulated = 0

    for (let i = 0; i < count; i++) {
      let m = startMonth + i
      let y = startYear
      while (m > 12) {
        m -= 12
        y += 1
      }
      const isLast = i === count - 1
      const instAmount = isLast ? Number((parsedAmount - accumulated).toFixed(2)) : basePerInstallment
      accumulated += instAmount

      sched.push({
        installment_number: i + 1,
        amount: instAmount,
        month: m,
        year: y,
      })
    }
    return sched
  }, [parsedAmount, count, basePerInstallment, startMonth, startYear])

  // Porcentaje del sueldo base que representa la cuota
  const quotaSalaryRatio = useMemo(() => {
    if (!employeeSalary || employeeSalary <= 0 || basePerInstallment <= 0) return 0
    return Math.round((basePerInstallment / employeeSalary) * 100)
  }, [basePerInstallment, employeeSalary])

  // Reset del estado
  function resetState() {
    setStep(1)
    setSelectedEmp(null)
    setSearchEmp('')
    setEmployeeSalary(null)
    setTotalAmount('50')
    setModality('mes_actual')
    setInstallmentsCount(4)
    setStartMonth(currentMonth)
    setStartYear(currentYear)
    setReason('')
    setCreatedIncident(null)
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

  // Guardar Solicitud de Anticipo
  async function handleCreateAdvance() {
    if (!selectedEmp) {
      toast.error('Selecciona un empleado.')
      return
    }

    if (parsedAmount <= 0) {
      toast.error('Ingresa un monto válido para el anticipo.')
      return
    }

    setSubmitting(true)

    try {
      const res = await createSalaryAdvanceAction({
        organizationId: organizationId || selectedEmp.organization_id,
        employeeId: selectedEmp.id,
        totalAmount: parsedAmount,
        modality,
        installmentsCount: count,
        startMonth,
        startYear,
        reason: reason.trim(),
        metadata: {
          employee_base_salary: employeeSalary,
          quota_salary_ratio: quotaSalaryRatio,
        },
      })

      if (!res.success || !res.data) {
        throw new Error(res.error || 'No se pudo registrar la solicitud de anticipo.')
      }

      setCreatedIncident(res.data)
      setStep(3)
      toast.success('Solicitud de anticipo registrada como Pendiente de Aprobación.')
      if (onSuccess) onSuccess()
      router.refresh()
    } catch (err: any) {
      console.error('Error creando anticipo:', err)
      toast.error(err.message || 'Error al procesar la solicitud.')
    } finally {
      setSubmitting(false)
    }
  }

  // Imprimir comprobante oficial
  function handlePrint() {
    if (!selectedEmp) return

    printSalaryAdvanceDocument({
      organization: organization || { name: organizationName },
      organizationName,
      employeeName: selectedEmp.full_name,
      nationalId: selectedEmp.national_id || '',
      department: selectedEmp.department || '—',
      position: selectedEmp.position || '—',
      totalAmount: parsedAmount,
      modality,
      installmentsCount: count,
      installmentAmount: basePerInstallment,
      startMonth,
      startYear,
      schedule: projectedSchedule,
      reason: reason.trim(),
      status: 'pendiente',
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
          {/* Header con colores azules y padding derecho */}
          <DialogHeader className="p-5 pb-4 bg-blue-500/10 border-b border-blue-500/20 text-left shrink-0 pr-12">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 shrink-0">
                <DollarSign className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold text-foreground truncate">
                  Solicitud de Anticipo de Sueldo
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                  Gestión de préstamos y anticipos con descuento en el rol de pagos
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
                    1. Seleccionar Empleado Solicitante
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
                              ? "bg-blue-500/10 border-l-4 border-l-blue-500 dark:bg-blue-950/30"
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
                              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
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

            {/* PASO 2: MONTO, MODALIDAD Y CUOTAS */}
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

                {/* Monto del Anticipo */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Monto Total del Anticipo Solicitado (USD) *
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-bold">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="1"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      placeholder="0.00"
                      className="pl-7 h-9 text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Selección de Modalidad de Descuento */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-foreground">
                    Modalidad de Descuento en Rol *
                  </Label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Opción A: Mes en curso (1 sola cuota) */}
                    <button
                      type="button"
                      onClick={() => {
                        setModality('mes_actual')
                        setInstallmentsCount(1)
                      }}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1",
                        modality === 'mes_actual'
                          ? "bg-blue-500/10 border-blue-500 text-foreground ring-1 ring-blue-500/30"
                          : "bg-card hover:bg-muted/40 border-border/60"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-xs font-bold text-foreground">
                          Mes en curso (1 sola cuota)
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Se descuenta la totalidad (${parsedAmount.toFixed(2)}) en el rol de pagos de este mes.
                      </p>
                    </button>

                    {/* Opción B: Diferido en cuotas mensuales */}
                    <button
                      type="button"
                      onClick={() => {
                        setModality('cuotas')
                        if (installmentsCount <= 1) setInstallmentsCount(4)
                      }}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1",
                        modality === 'cuotas'
                          ? "bg-blue-500/10 border-blue-500 text-foreground ring-1 ring-blue-500/30"
                          : "bg-card hover:bg-muted/40 border-border/60"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-xs font-bold text-foreground">
                          Diferir en Cuotas Mensuales
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Se distribuye en cuotas fijas mensuales consecutivas en los próximos roles.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Si es en cuotas, selector de cantidad de cuotas */}
                {modality === 'cuotas' && (
                  <div className="p-3.5 rounded-xl border bg-muted/20 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Número de Cuotas Mensuales *</Label>
                        <select
                          value={installmentsCount}
                          onChange={(e) => setInstallmentsCount(parseInt(e.target.value, 10))}
                          className="w-full h-9 rounded-md border border-input bg-card px-3 text-xs text-foreground focus:ring-1 focus:ring-ring cursor-pointer"
                        >
                          {[2, 3, 4, 5, 6, 8, 10, 12].map((num) => (
                            <option key={num} value={num}>
                              {num} cuotas mensuales
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">A partir del Rol de Pagos *</Label>
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
                            {[currentYear, currentYear + 1].map((yr) => (
                              <option key={yr} value={yr}>
                                {yr}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Resumen de la cuota */}
                    <div className="p-3 rounded-lg bg-card border flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Valor estimado por cuota:</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400 font-mono text-sm">
                        {count} cuotas de ~${basePerInstallment.toFixed(2)} USD
                      </span>
                    </div>
                  </div>
                )}

                {/* Advertencia de impacto en remuneración si supera el 30% del sueldo */}
                {quotaSalaryRatio > 30 && (
                  <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <strong>Aviso de retención salarial:</strong> Cada cuota (${basePerInstallment.toFixed(2)}) representa aproximadamente el <strong>{quotaSalaryRatio}%</strong> del sueldo base del empleado. Se recomienda verificar la capacidad de pago antes de aprobar.
                    </div>
                  </div>
                )}

                {/* Motivo de la solicitud */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Motivo o Justificación de la Solicitud (Opcional)
                  </Label>
                  <textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ej. Gastos médicos urgentes, imprevisto familiar, educación..."
                    className="w-full p-2.5 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* PASO 3: CONFIRMACIÓN E IMPRESIÓN */}
            {step === 3 && (
              <div className="space-y-4 py-2">
                <div className="flex flex-col items-center justify-center text-center p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                  <div className="p-3 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 mb-2">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    Solicitud de Anticipo Registrada con Éxito
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    La solicitud ha quedado registrada con estado <strong>Pendiente de Aprobación</strong>. Al aprobarse, el sistema generará automáticamente las deducciones en nómina para cada mes estipulado.
                  </p>
                </div>

                {/* Desglose de cuotas registradas */}
                <div className="p-4 rounded-xl border bg-card text-xs space-y-2.5">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground text-[11px]">Empleado:</span>
                    <span className="font-bold text-foreground">{selectedEmp?.full_name}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground text-[11px]">Monto Total:</span>
                    <span className="font-bold font-mono text-sm text-foreground">
                      ${parsedAmount.toFixed(2)} USD
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground text-[11px]">Modalidad:</span>
                    <Badge variant="outline" className="font-medium text-[11px] border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                      {count === 1 ? 'Mes en curso (1 cuota)' : `${count} cuotas mensuales`}
                    </Badge>
                  </div>

                  {/* Lista de cuotas */}
                  <div className="pt-2">
                    <span className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
                      Cronograma Programado:
                    </span>
                    <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
                      {projectedSchedule.map((inst) => (
                        <div
                          key={inst.installment_number}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-[11px]"
                        >
                          <span>
                            Cuota {inst.installment_number} ({MONTH_NAMES[inst.month]} {inst.year})
                          </span>
                          <span className="font-mono font-bold text-foreground">
                            ${inst.amount.toFixed(2)} USD
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl border bg-muted/20 text-xs text-muted-foreground flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>
                    Puedes imprimir el comprobante oficial de solicitud para que sea firmado por el empleado y adjuntado a la aprobación.
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
                  className="text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
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
                  disabled={submitting || parsedAmount <= 0}
                  onClick={handleCreateAdvance}
                  className="text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  Registrar Anticipo
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
              <div className="p-2.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  ¿Descartar solicitud de anticipo?
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
