'use client'

import React, { createContext, useContext, useState, useMemo, useEffect } from 'react'
import { PayrollTableView } from './PayrollTableView'
import { SavePayrollReportButton } from './SavePayrollReportButton'
import { PayrollEmployeeCalculation } from './PayrollDetailModal'
import { TrendingUp, TrendingDown, DollarSign, Users } from 'lucide-react'

interface PayrollSelectionContextValue {
  selectedIds: Set<string>
  toggleOne: (employeeId: string, checked: boolean) => void
  toggleAll: (checked: boolean) => void
}

const PayrollSelectionContext = createContext<PayrollSelectionContextValue | null>(null)

function usePayrollSelection() {
  const ctx = useContext(PayrollSelectionContext)
  if (!ctx) throw new Error('usePayrollSelection debe usarse dentro de <PayrollWorkspaceProvider>')
  return ctx
}

interface PayrollWorkspaceProviderProps {
  calculations: PayrollEmployeeCalculation[]
  startDate: string
  endDate: string
  department?: string
  children: React.ReactNode
}

/**
 * Comparte la selección de empleados (checkboxes de la tabla) entre el botón
 * "Guardar Borrador" (en el header de la página) y <PayrollTableView> (en el
 * cuerpo) — antes eran hermanos server-rendered sin ningún estado en común,
 * así que el botón siempre guardaba a TODOS los empleados filtrados, sin
 * poder excluir a nadie puntualmente.
 */
export function PayrollWorkspaceProvider({
  calculations,
  startDate,
  endDate,
  department,
  children,
}: PayrollWorkspaceProviderProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(calculations.map((c) => c.employeeId))
  )

  // Si cambian los filtros (búsqueda, departamento, rango de fechas) llega
  // una lista de cálculos distinta — reseleccionar todo por defecto, en vez
  // de arrastrar ids que ya ni aparecen en la vista actual.
  useEffect(() => {
    setSelectedIds(new Set(calculations.map((c) => c.employeeId)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, department, calculations.length])

  function toggleOne(employeeId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(employeeId)
      else next.delete(employeeId)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(calculations.map((c) => c.employeeId)) : new Set())
  }

  const value = useMemo(
    () => ({ selectedIds, toggleOne, toggleAll }),
    [selectedIds]
  )

  return (
    <PayrollSelectionContext.Provider value={value}>
      {children}
    </PayrollSelectionContext.Provider>
  )
}

interface PayrollSaveButtonSlotProps {
  organizationId: string
  startDate: string
  endDate: string
  department?: string
  calculations: PayrollEmployeeCalculation[]
}

/** Va en el header de la página — guarda solo los empleados seleccionados en la tabla. */
export function PayrollSaveButtonSlot({
  organizationId,
  startDate,
  endDate,
  department,
  calculations,
}: PayrollSaveButtonSlotProps) {
  const { selectedIds } = usePayrollSelection()
  const selectedCalculations = useMemo(
    () => calculations.filter((c) => selectedIds.has(c.employeeId)),
    [calculations, selectedIds]
  )

  return (
    <SavePayrollReportButton
      organizationId={organizationId}
      startDate={startDate}
      endDate={endDate}
      department={department}
      calculations={selectedCalculations}
    />
  )
}

interface PayrollKpiSlotProps {
  calculations: PayrollEmployeeCalculation[]
}

function formatMoney(n: number) {
  return n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Tarjetas KPI del período: suman SOLO los empleados seleccionados en la
 * tabla (ver checkboxes), no todos los que trae el filtro — para que el
 * total mostrado coincida con lo que realmente se guardará al pulsar
 * "Guardar Borrador". La 4ta tarjeta reemplaza el contador de texto que
 * antes iba junto al botón.
 */
export function PayrollKpiSlot({ calculations }: PayrollKpiSlotProps) {
  const { selectedIds } = usePayrollSelection()
  const selected = useMemo(
    () => calculations.filter((c) => selectedIds.has(c.employeeId)),
    [calculations, selectedIds]
  )

  const totalIncome = selected.reduce((sum, c) => sum + c.totalIncome, 0)
  const totalDeductions = selected.reduce((sum, c) => sum + c.totalDeductions, 0)
  const totalNet = selected.reduce((sum, c) => sum + c.netSalary, 0)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="p-4 rounded-xl border bg-card shadow-2xs space-y-1">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          Total Haberes / Ingresos
        </span>
        <p className="text-xl font-bold font-mono text-foreground">
          ${formatMoney(totalIncome)}
        </p>
      </div>

      <div className="p-4 rounded-xl border bg-card shadow-2xs space-y-1">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <TrendingDown className="h-4 w-4 text-rose-500" />
          Total Deducciones & Descuentos
        </span>
        <p className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
          -${formatMoney(totalDeductions)}
        </p>
      </div>

      <div className="p-4 rounded-xl border bg-primary/5 border-primary/20 shadow-2xs space-y-1">
        <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
          <DollarSign className="h-4 w-4" />
          Neto a Pagar en Nómina
        </span>
        <p className="text-xl font-black font-mono text-primary">
          ${formatMoney(totalNet)}
        </p>
      </div>

      <div className="p-4 rounded-xl border bg-muted/30 shadow-2xs space-y-1">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          Empleados Seleccionados
        </span>
        <p className="text-xl font-bold font-mono text-foreground">
          {selectedIds.size} <span className="text-sm font-normal text-muted-foreground">de {calculations.length}</span>
        </p>
      </div>
    </div>
  )
}

interface PayrollTableSlotProps {
  calculations: PayrollEmployeeCalculation[]
  startDate: string
  endDate: string
}

/** Va en el cuerpo de la página — la tabla con checkboxes de selección. */
export function PayrollTableSlot({ calculations, startDate, endDate }: PayrollTableSlotProps) {
  const { selectedIds, toggleOne, toggleAll } = usePayrollSelection()

  return (
    <PayrollTableView
      calculations={calculations}
      startDate={startDate}
      endDate={endDate}
      selectedIds={selectedIds}
      onToggleOne={toggleOne}
      onToggleAll={toggleAll}
    />
  )
}
