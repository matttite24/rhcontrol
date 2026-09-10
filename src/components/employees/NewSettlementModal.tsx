'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Employee, EmployeeSalary, TerminationReason } from '@/types/employee'
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
import { toast } from '@/components/ui/toast'
import {
  Calculator,
  UserMinus,
  TrendingDown,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NewSettlementModalProps {
  organizationId: string
  employees: (Employee & { salaries?: EmployeeSalary[] })[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TERMINATION_REASONS: { value: TerminationReason; label: string; desc: string }[] = [
  { value: 'renuncia_voluntaria', label: 'Renuncia Voluntaria', desc: 'No aplica indemnización por despido, solo proporcionales y vacaciones.' },
  { value: 'despido_intempestivo', label: 'Despido Intempestivo', desc: 'Aplica indemnización por años de servicio + 25% desahucio + proporcionales.' },
  { value: 'desahucio', label: 'Desahucio (Bonificación 25%)', desc: 'Bonificación del 25% del último sueldo por cada año de servicio.' },
  { value: 'fin_contrato', label: 'Fin de Contrato a Plazo / Eventual', desc: 'Conclusión natural del período pactado.' },
  { value: 'acuerdo_mutuo', label: 'Acuerdo Mutuo', desc: 'Convenio de terminación suscrito por ambas partes.' },
  { value: 'visto_bueno', label: 'Visto Bueno Aprobado', desc: 'Resolución de inspector del trabajo.' },
  { value: 'otro', label: 'Otro motivo', desc: 'Otras causales estipuladas en el Código del Trabajo.' },
]

export function NewSettlementModal({
  organizationId,
  employees,
  open,
  onOpenChange,
}: NewSettlementModalProps) {
  const [selectedEmpId, setSelectedEmpId] = useState<string>('')
  const [terminationDate, setTerminationDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [reason, setReason] = useState<TerminationReason>('renuncia_voluntaria')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const selectedEmp = employees.find((e) => e.id === selectedEmpId)
  const baseSalary = selectedEmp?.salaries?.find((s) => s.salary_type === 'Sueldo')?.amount || 460

  // Cálculo de tiempo de servicio
  const hireDate = selectedEmp?.hire_date ? new Date(selectedEmp.hire_date) : new Date()
  const termDate = new Date(terminationDate || new Date())
  const diffTime = Math.max(0, termDate.getTime() - hireDate.getTime())
  const yearsServed = Number((diffTime / (1000 * 60 * 60 * 24 * 365.25)).toFixed(2))
  const completeYears = Math.max(1, Math.ceil(yearsServed))

  // 1. Proporcionales de ley
  const pendingSalary = Number(((baseSalary / 30) * 15).toFixed(2)) // Días trabajados del mes
  const proportional13th = Number(((baseSalary / 12) * 6).toFixed(2)) // 6 meses prom
  const proportional14th = Number(((460 / 12) * 6).toFixed(2))
  const pendingVacations = Number(((baseSalary / 24)).toFixed(2))

  // 2. Indemnizaciones según causal
  const isDespido = reason === 'despido_intempestivo'
  const isDesahucio = reason === 'despido_intempestivo' || reason === 'desahucio'

  const severancePay = isDespido ? Number((baseSalary * completeYears).toFixed(2)) : 0
  const desahucioPay = isDesahucio ? Number(((baseSalary * 0.25) * completeYears).toFixed(2)) : 0

  const totalIncome = Number((pendingSalary + proportional13th + proportional14th + pendingVacations + severancePay + desahucioPay).toFixed(2))
  const iessPending = Number((pendingSalary * 0.0945).toFixed(2))
  const pendingDeductions = 0
  const totalDeductions = Number((iessPending + pendingDeductions).toFixed(2))
  const netSettlement = Number(Math.max(0, totalIncome - totalDeductions).toFixed(2))

  async function handleSaveSettlement() {
    if (!selectedEmpId) {
      toast.error('Selecciona un empleado', 'Debes elegir el empleado a liquidar.')
      return
    }

    setLoading(true)
    try {
      // 1. Crear el acta de finiquito / liquidación
      const { error: setErr } = await supabase.from('employee_settlements').insert({
        organization_id: organizationId,
        employee_id: selectedEmpId,
        termination_date: terminationDate,
        termination_reason: reason,
        years_served: yearsServed,
        pending_salary: pendingSalary,
        proportional_13th: proportional13th,
        proportional_14th: proportional14th,
        pending_vacations: pendingVacations,
        severance_pay: severancePay,
        desahucio_pay: desahucioPay,
        other_income: 0,
        total_income: totalIncome,
        pending_deductions: pendingDeductions,
        iess_pending: iessPending,
        total_deductions: totalDeductions,
        net_settlement: netSettlement,
        status: 'borrador',
      })

      if (setErr) throw setErr

      // 2. Actualizar estado del empleado a 'inactivo' y fijar su fecha de salida
      await supabase
        .from('employees')
        .update({
          status: 'inactivo',
          termination_date: terminationDate,
        })
        .eq('id', selectedEmpId)

      toast.success(
        'Liquidación generada',
        `Se registró la baja de ${selectedEmp?.full_name} y se calculó el finiquito.`
      )

      onOpenChange(false)
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error('Error al generar liquidación', err?.message || 'No se pudo procesar la baja.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border-border/80 gap-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <UserMinus className="h-5 w-5 text-primary" />
            Asistente de Liquidación & Baja de Empleado
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Calcula automáticamente el acta de finiquito, proporcionales de ley e indemnizaciones laborales según la normativa de Ecuador (MDT / IESS).
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Fila 1: Selección de Empleado y Fecha de Salida */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-semibold">Empleado a Liquidar *</Label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground cursor-pointer"
              >
                <option value="">Seleccionar empleado activo...</option>
                {employees
                  .filter((e) => e.status !== 'inactivo')
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.position || emp.department || 'Empleado'})
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold">Fecha de Salida Efectiva *</Label>
              <Input
                type="date"
                value={terminationDate}
                onChange={(e) => setTerminationDate(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>

          {/* Fila 2: Causal de Terminación */}
          <div className="space-y-1.5">
            <Label className="font-semibold">Causal de Terminación de Contrato *</Label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as TerminationReason)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground cursor-pointer"
            >
              {TERMINATION_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground italic">
              {TERMINATION_REASONS.find((r) => r.value === reason)?.desc}
            </p>
          </div>

          {selectedEmp && (
            <>
              {/* Resumen del empleado */}
              <div className="p-3 rounded-xl bg-muted/40 border grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Ingreso</span>
                  <span className="font-semibold">{selectedEmp.hire_date || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Tiempo Servido</span>
                  <span className="font-semibold text-primary">{yearsServed} años</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Último Sueldo</span>
                  <span className="font-semibold">${baseSalary.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Tipo Contrato</span>
                  <span className="font-semibold truncate">{selectedEmp.contract_type || 'Indefinido'}</span>
                </div>
              </div>

              {/* Cálculo en 2 Columnas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Haberes Finiquito */}
                <div className="p-4 rounded-xl border bg-card space-y-2.5">
                  <span className="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pb-1 border-b">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    Haberes a Liquidar
                  </span>
                  <div className="space-y-1.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Días trabajados:</span>
                      <span>${pendingSalary.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Décimo Tercero prop.:</span>
                      <span>${proportional13th.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Décimo Cuarto prop.:</span>
                      <span>${proportional14th.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vacaciones no gozadas:</span>
                      <span>${pendingVacations.toFixed(2)}</span>
                    </div>
                    {severancePay > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                        <span>Indemnización Intempestivo:</span>
                        <span>${severancePay.toFixed(2)}</span>
                      </div>
                    )}
                    {desahucioPay > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                        <span>Bonif. Desahucio (25%):</span>
                        <span>${desahucioPay.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1.5 border-t font-bold text-foreground">
                      <span>Total Ingresos:</span>
                      <span>${totalIncome.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Deducciones y Neto Final */}
                <div className="p-4 rounded-xl border bg-card flex flex-col justify-between space-y-3">
                  <div className="space-y-2.5">
                    <span className="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pb-1 border-b">
                      <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                      Deducciones de Salida
                    </span>
                    <div className="space-y-1.5 font-mono">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Aporte IESS proporcional:</span>
                        <span className="text-rose-600 dark:text-rose-400">-${iessPending.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t font-semibold">
                        <span className="text-muted-foreground">Total Deducciones:</span>
                        <span className="text-rose-600 dark:text-rose-400">-${totalDeductions.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-center space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
                      Valor Neto a Liquidar
                    </span>
                    <p className="text-xl font-black font-mono text-primary">
                      ${netSettlement.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="p-4 border-t bg-muted/20 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-xs cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSaveSettlement}
            disabled={loading || !selectedEmpId}
            className="text-xs cursor-pointer gap-1.5 font-medium"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Procesar Baja y Liquidación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
