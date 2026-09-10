'use client'

import React, { useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Percent, DollarSign, Users, Sparkles, Filter, CheckCircle2 } from 'lucide-react'
import { Employee, Department, Position } from '@/types/employee'
import { cn } from '@/lib/utils'

interface BulkSalaryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: (Employee & { salaries?: any[] })[]
  departments: Department[]
  positions: Position[]
  onApplyAdjustment: (adjustments: {
    type: 'percentage' | 'fixed'
    value: number
    targetEmployeeIds: string[]
  }) => void
}

export function BulkSalaryModal({
  open,
  onOpenChange,
  employees,
  departments,
  positions,
  onApplyAdjustment,
}: BulkSalaryModalProps) {
  const [adjustmentType, setAdjustmentType] = useState<'percentage' | 'fixed'>('percentage')
  const [adjustmentValue, setAdjustmentValue] = useState<number>(5)

  // Filtros de destino para el ajuste
  const [targetScope, setTargetScope] = useState<'all' | 'department' | 'position'>('all')
  const [targetDepartment, setTargetDepartment] = useState<string>('')
  const [targetPosition, setTargetPosition] = useState<string>('')

  // Calcular empleados afectados
  const targetEmployees = employees.filter((emp) => {
    if (targetScope === 'all') return true
    if (targetScope === 'department') return emp.department === targetDepartment
    if (targetScope === 'position') return emp.position === targetPosition
    return true
  })

  // Simulación del impacto
  const currentTotal = targetEmployees.reduce((sum, e) => {
    const base = e.salaries?.find((s: any) => s.salary_type === 'Sueldo')?.amount || 460
    return sum + base
  }, 0)

  const projectedTotal = targetEmployees.reduce((sum, e) => {
    const base = e.salaries?.find((s: any) => s.salary_type === 'Sueldo')?.amount || 460
    const newSalary = adjustmentType === 'percentage' 
      ? base * (1 + adjustmentValue / 100) 
      : base + adjustmentValue
    return sum + newSalary
  }, 0)

  const diffTotal = projectedTotal - currentTotal

  function handleConfirm() {
    onApplyAdjustment({
      type: adjustmentType,
      value: adjustmentValue,
      targetEmployeeIds: targetEmployees.map((e) => e.id),
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-border/80 gap-0">
        <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
          <div className="flex items-center gap-2 text-primary mb-1">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Paso 1 de 2: Configurar Incremento</span>
          </div>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Asistente de Ajuste Masivo de Sueldos
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Configura un incremento porcentual o valor fijo aplicable a toda la nómina o a un grupo específico. Al aplicar, podrás previsualizar la tabla antes de guardar.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-5 text-xs">
          {/* 1. Tipo y Valor del Ajuste */}
          <div className="space-y-2">
            <Label className="font-semibold text-foreground">Regla de Ajuste Salarial *</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAdjustmentType('percentage')}
                className={cn(
                  "p-3 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all cursor-pointer",
                  adjustmentType === 'percentage'
                    ? "bg-primary/10 border-primary text-foreground shadow-2xs"
                    : "bg-card border-border hover:bg-muted/40 text-muted-foreground"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">Porcentual (%)</span>
                  <Percent className="h-4 w-4" />
                </div>
                <span className="text-[11px] opacity-80">Incremento relativo por ley (ej. +5% o +7.5%)</span>
              </button>

              <button
                type="button"
                onClick={() => setAdjustmentType('fixed')}
                className={cn(
                  "p-3 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all cursor-pointer",
                  adjustmentType === 'fixed'
                    ? "bg-primary/10 border-primary text-foreground shadow-2xs"
                    : "bg-card border-border hover:bg-muted/40 text-muted-foreground"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">Monto Fijo ($ USD)</span>
                  <DollarSign className="h-4 w-4" />
                </div>
                <span className="text-[11px] opacity-80">Aumento parejo en dólares (ej. +$25 o +$50)</span>
              </button>
            </div>
          </div>

          {/* Valor input */}
          <div className="space-y-1.5">
            <Label className="font-semibold text-foreground">
              {adjustmentType === 'percentage' ? 'Porcentaje de Incremento (%) *' : 'Monto a Incrementar ($ USD) *'}
            </Label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                value={adjustmentValue}
                onChange={(e) => setAdjustmentValue(Number(e.target.value))}
                className="h-9 text-xs font-mono font-bold pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-xs text-muted-foreground">
                {adjustmentType === 'percentage' ? '%' : '$'}
              </span>
            </div>
          </div>

          {/* 2. Alcance / Grupo Destino */}
          <div className="space-y-2 pt-2 border-t">
            <Label className="font-semibold text-foreground flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              Aplicar a:
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTargetScope('all')}
                className={cn(
                  "py-2 px-3 rounded-lg border text-center font-medium text-xs transition-colors cursor-pointer",
                  targetScope === 'all' ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border hover:bg-muted"
                )}
              >
                Toda la Empresa ({employees.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetScope('department')
                  if (!targetDepartment && departments.length > 0) setTargetDepartment(departments[0].name)
                }}
                className={cn(
                  "py-2 px-3 rounded-lg border text-center font-medium text-xs transition-colors cursor-pointer",
                  targetScope === 'department' ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border hover:bg-muted"
                )}
              >
                Por Departamento
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetScope('position')
                  if (!targetPosition && positions.length > 0) setTargetPosition(positions[0].name)
                }}
                className={cn(
                  "py-2 px-3 rounded-lg border text-center font-medium text-xs transition-colors cursor-pointer",
                  targetScope === 'position' ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border hover:bg-muted"
                )}
              >
                Por Cargo
              </button>
            </div>

            {targetScope === 'department' && (
              <div className="pt-1">
                <select
                  value={targetDepartment}
                  onChange={(e) => setTargetDepartment(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground cursor-pointer"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            {targetScope === 'position' && (
              <div className="pt-1">
                <select
                  value={targetPosition}
                  onChange={(e) => setTargetPosition(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground cursor-pointer"
                >
                  {positions.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Resumen de Impacto Previo */}
          <div className="p-3.5 rounded-xl bg-muted/40 border space-y-2 font-mono">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground flex items-center gap-1 font-sans">
                <Users className="h-3 w-3" />
                Empleados alcanzados:
              </span>
              <span className="font-bold text-foreground">{targetEmployees.length} empleados</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground font-sans">Masa salarial actual:</span>
              <span>${currentTotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400 pt-1 border-t">
              <span className="font-sans">Proyección post-ajuste:</span>
              <span>${projectedTotal.toFixed(2)} (+${diffTotal.toFixed(2)})</span>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-muted/20 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={targetEmployees.length === 0}
            className="text-xs cursor-pointer gap-1.5"
          >
            <CheckCircle2 className="h-4 w-4" />
            Aplicar y Visualizar Tabla (Paso 2)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
