'use client'

import React from 'react'
import { SalaryType } from '@/types/employee'
import { SalaryRowItem } from './EmployeeForm'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DollarSign, Plus, Trash2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmployeeSalaryTabProps {
  salaries: SalaryRowItem[]
  addSalaryItem: (type?: SalaryType) => void
  removeSalaryItem: (index: number) => void
  updateSalaryItem: <K extends keyof SalaryRowItem>(index: number, field: K, value: SalaryRowItem[K]) => void
  readOnly?: boolean
  selectClasses: string
}

export function EmployeeSalaryTab({
  salaries,
  addSalaryItem,
  removeSalaryItem,
  updateSalaryItem,
  readOnly = false,
  selectClasses,
}: EmployeeSalaryTabProps) {
  const totalSalary = salaries.reduce((acc, s) => acc + (Number(s.amount) || 0), 0)
  const taxableSalary = salaries
    .filter((s) => s.affects_iess)
    .reduce((acc, s) => acc + (Number(s.amount) || 0), 0)

  return (
    <div className="space-y-6 pt-2">
      {/* Resumen de Compensación */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card/60 shadow-xs">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Estructura Salarial y Compensación
          </h4>
          <p className="text-xs text-muted-foreground">
            Sueldo base, bonificaciones recurrentes y rubros adicionales del empleado.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-muted/40 border text-xs">
            <span className="text-muted-foreground">Base IESS:</span>{' '}
            <span className="font-bold font-mono text-foreground">${taxableSalary.toFixed(2)}</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-medium">
            Total Ingresos: <span className="font-bold font-mono text-sm">${totalSalary.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Botones de acción rápida para añadir rubros */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
          <span className="text-xs font-medium text-muted-foreground">
            Rubros configurados ({salaries.length})
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addSalaryItem('Bonificacion')}
              className="text-xs h-8"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              + Bonificación
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addSalaryItem('Extras')}
              className="text-xs h-8"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              + Extras
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addSalaryItem('Sueldo')}
              className="text-xs h-8"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              + Sueldo
            </Button>
          </div>
        </div>
      )}

      {/* Lista de rubros salariales */}
      {salaries.length === 0 ? (
        <div className="p-6 border rounded-xl border-dashed text-center text-xs text-muted-foreground">
          No hay conceptos salariales registrados. Haz clic en los botones superiores para añadir sueldo o rubros adicionales.
        </div>
      ) : (
        <div className="space-y-3">
          {salaries.map((sal, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center p-3.5 rounded-xl border bg-card/60 shadow-xs"
            >
              {/* Tipo de Rubro */}
              <div className="sm:col-span-3 space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Tipo de Rubro</Label>
                <select
                  disabled={readOnly}
                  value={sal.salary_type}
                  onChange={(e) => updateSalaryItem(idx, 'salary_type', e.target.value as SalaryType)}
                  className={selectClasses}
                >
                  <option value="Sueldo">Sueldo</option>
                  <option value="Bonificacion">Bonificación</option>
                  <option value="Extras">Extras</option>
                </select>
              </div>

              {/* Concepto / Nombre */}
              <div className={cn("space-y-1", readOnly ? "sm:col-span-5" : "sm:col-span-4")}>
                <Label className="text-[11px] font-medium text-muted-foreground">Descripción / Concepto</Label>
                <Input
                  readOnly={readOnly}
                  disabled={readOnly}
                  value={sal.name}
                  onChange={(e) => updateSalaryItem(idx, 'name', e.target.value)}
                  placeholder="Ej. Sueldo Base, Bono Desempeño..."
                  className={cn("h-9 text-xs", readOnly && "bg-muted/30 cursor-default")}
                />
              </div>

              {/* Valor */}
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Valor ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  readOnly={readOnly}
                  disabled={readOnly}
                  value={sal.amount}
                  onChange={(e) => updateSalaryItem(idx, 'amount', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className={cn("h-9 text-xs font-mono", readOnly && "bg-muted/30 cursor-default")}
                />
              </div>

              {/* Checkbox Afecta Aportación */}
              <div className="sm:col-span-2 flex items-center gap-2 pt-4 sm:pt-4 sm:justify-center">
                <input
                  id={`affects_iess_${idx}`}
                  type="checkbox"
                  disabled={readOnly}
                  checked={sal.affects_iess}
                  onChange={(e) => updateSalaryItem(idx, 'affects_iess', e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-ring cursor-pointer disabled:cursor-default"
                />
                <Label
                  htmlFor={`affects_iess_${idx}`}
                  className={cn("text-xs font-medium", readOnly ? "cursor-default select-none" : "cursor-pointer select-none")}
                >
                  Afecta IESS
                </Label>
              </div>

              {/* Botón Eliminar */}
              {!readOnly && (
                <div className="sm:col-span-1 flex items-center justify-end pt-4 sm:pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSalaryItem(idx)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    title="Eliminar rubro"
                    aria-label="Eliminar rubro"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
