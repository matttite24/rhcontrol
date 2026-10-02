'use client'

import React, { useState, useTransition } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { PayrollEmployeeCalculation, PayrollDetailModal } from './PayrollDetailModal'
import { FileText, Eye, Printer, Download, TrendingUp, TrendingDown, DollarSign, CheckCircle2, Circle } from 'lucide-react'
import { setEmployeeReviewedAction } from '@/lib/payroll/actions'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

interface PayrollTableViewProps {
  calculations: PayrollEmployeeCalculation[]
  startDate: string
  endDate: string
  /** Solo si el rol está en borrador: habilita la pestaña Novedades (editable) en el drawer de detalle. */
  payrollReportId?: string
  organizationId?: string
  /** true si ya existe una fila en payroll_reports (borrador o cerrado) — ver PayrollDetailModal. */
  hasSavedReport?: boolean
  /**
   * Marca visual "revisado" por empleado, solo en roles guardados (borrador o
   * generado) — no afecta el cálculo. Se activa al pasar `reviewReportId`.
   */
  reviewReportId?: string
  reviewedEmployeeIds?: string[]
  /**
   * Selección de empleados a incluir al guardar el rol (ver
   * PayrollWorkspace) — opcionales porque las vistas de solo lectura
   * (ej. /payroll/history/[id]) usan esta misma tabla sin selección.
   */
  selectedIds?: Set<string>
  onToggleOne?: (employeeId: string, checked: boolean) => void
  onToggleAll?: (checked: boolean) => void
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

export function PayrollTableView({
  calculations,
  startDate,
  endDate,
  payrollReportId,
  organizationId,
  hasSavedReport = false,
  reviewReportId,
  reviewedEmployeeIds,
  selectedIds,
  onToggleOne,
  onToggleAll,
}: PayrollTableViewProps) {
  // Se guarda solo el id: el detalle debe leer SIEMPRE el cálculo vigente de
  // `calculations`. Una copia del objeto quedaría desactualizada tras
  // router.refresh() (p. ej. al guardar un ajuste en la pestaña Novedades) y
  // obligaría a recargar la página para ver el cambio.
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const selectedEmployee = React.useMemo(
    () => calculations.find((c) => c.employeeId === selectedEmployeeId) ?? null,
    [calculations, selectedEmployeeId]
  )
  const [modalOpen, setModalOpen] = useState(false)

  // Revisado: estado local optimista; se persiste en payroll_report_reviews.
  const reviewEnabled = Boolean(reviewReportId && organizationId)
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(() => new Set(reviewedEmployeeIds ?? []))
  const [, startReviewTransition] = useTransition()

  function toggleReviewed(employeeId: string) {
    if (!reviewReportId || !organizationId) return
    const next = !reviewedIds.has(employeeId)
    setReviewedIds((prev) => {
      const s = new Set(prev)
      if (next) s.add(employeeId)
      else s.delete(employeeId)
      return s
    })
    startReviewTransition(async () => {
      const result = await setEmployeeReviewedAction({
        organizationId,
        payrollReportId: reviewReportId,
        employeeId,
        reviewed: next,
      })
      if (!result.success) {
        // Revertir el cambio optimista.
        setReviewedIds((prev) => {
          const s = new Set(prev)
          if (next) s.delete(employeeId)
          else s.add(employeeId)
          return s
        })
        toast.error('No se pudo guardar la marca de revisado', result.error)
      }
    })
  }
  // Selección solo se muestra cuando el padre la controla (ver
  // PayrollWorkspace) — en vistas de solo lectura (historial) no se pasan
  // estas props y la columna de checkbox no se renderiza.
  const selectionEnabled = Boolean(selectedIds && onToggleOne && onToggleAll)
  const allSelected = selectionEnabled && calculations.length > 0 && calculations.every((c) => selectedIds!.has(c.employeeId))
  const someSelected = selectionEnabled && !allSelected && calculations.some((c) => selectedIds!.has(c.employeeId))

  // El estado "indeterminado" (algunos pero no todos seleccionados) no tiene
  // atributo declarativo en HTML — solo se puede setear imperativamente vía
  // ref sobre el elemento nativo.
  const selectAllRef = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected
    }
  }, [someSelected])

  function handleOpenDetail(calc: PayrollEmployeeCalculation) {
    setSelectedEmployeeId(calc.employeeId)
    setModalOpen(true)
  }

  function handlePrintAll() {
    window.print()
  }

  return (
    <>
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden w-full">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
              {selectionEnabled && (
                <TableHead className="w-[3%] pl-6">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => onToggleAll!(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-input cursor-pointer accent-primary"
                    aria-label="Seleccionar todos los empleados"
                  />
                </TableHead>
              )}
              <TableHead className={cn('font-semibold', selectionEnabled ? 'w-[23%]' : 'w-[24%] pl-6')}>Empleado</TableHead>
              <TableHead className="w-[9%] font-semibold">Sueldo Base</TableHead>
              <TableHead className="w-[8%] font-semibold">Bonos/Ext.</TableHead>
              <TableHead className="w-[9%] font-semibold">Décimos (Ley)</TableHead>
              <TableHead className="w-[9%] font-semibold">Total Ing.</TableHead>
              <TableHead className="w-[9%] font-semibold">Descuentos</TableHead>
              <TableHead className="w-[10%] font-semibold">Neto Rol</TableHead>
              <TableHead className="w-[13%] font-semibold">Registros</TableHead>
              <TableHead className={cn('pr-6 text-right font-semibold', reviewEnabled ? 'w-[8%]' : 'w-[6%]')}>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calculations.map((calc) => {
              const bonusesAndExtras = calc.bonuses + calc.overtimeAmount
              const actions = calc.actions || []
              const hasActions = actions.length > 0
              const approvedCount = actions.filter((a) => a.status === 'aprobado').length
              const pendingCount = actions.filter((a) => a.status === 'pendiente').length

              const isSelected = selectionEnabled && selectedIds!.has(calc.employeeId)

              return (
                <TableRow
                  key={calc.employeeId}
                  className={cn(
                    'hover:bg-muted/40 transition-colors text-xs',
                    reviewEnabled && reviewedIds.has(calc.employeeId) && 'bg-emerald-500/5'
                  )}
                >
                  {selectionEnabled && (
                    <TableCell className="pl-6 py-3.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onToggleOne!(calc.employeeId, e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-input cursor-pointer accent-primary"
                        aria-label={`Seleccionar a ${calc.fullName}`}
                      />
                    </TableCell>
                  )}
                  {/* Empleado */}
                  <TableCell className={cn('py-3.5', !selectionEnabled && 'pl-6')}>
                    <div className="flex items-center gap-3">
                      <Avatar
                        className={cn(
                          'h-8 w-8 shrink-0 transition-shadow duration-150 motion-reduce:transition-none',
                          reviewEnabled && reviewedIds.has(calc.employeeId)
                            ? 'ring-2 ring-emerald-500'
                            : 'ring-1 ring-border'
                        )}
                      >
                        <AvatarImage src={calc.avatarUrl ?? undefined} alt={calc.fullName} />
                        <AvatarFallback className="text-[10px] font-semibold">
                          {getInitials(calc.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-foreground truncate max-w-[220px]" title={calc.fullName}>
                          {calc.fullName}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[220px]">
                          {calc.nationalId || calc.department || '—'}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Sueldo Base */}
                  <TableCell className="py-3.5 font-mono text-foreground font-medium">
                    ${calc.baseSalary.toFixed(2)}
                  </TableCell>

                  {/* Bonos / Extras */}
                  <TableCell className="py-3.5 font-mono text-muted-foreground">
                    {bonusesAndExtras > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        +${bonusesAndExtras.toFixed(2)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>

                  {/* Décimos Mensualizados de Ecuador */}
                  <TableCell className="py-3.5 font-mono">
                    {!calc.accumulateDecimals && calc.totalDecimalsMonthly > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded text-[11px]">
                        +${calc.totalDecimalsMonthly.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 text-[11px] italic">
                        Acumula
                      </span>
                    )}
                  </TableCell>

                  {/* Total Ingresos */}
                  <TableCell className="py-3.5 font-mono font-semibold text-foreground">
                    ${calc.totalIncome.toFixed(2)}
                  </TableCell>

                  {/* Total Descuentos */}
                  <TableCell className="py-3.5 font-mono font-medium">
                    {calc.totalDeductions > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400">
                        -${calc.totalDeductions.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">$0.00</span>
                    )}
                  </TableCell>

                  {/* Neto a Recibir */}
                  <TableCell className="py-3.5 font-mono font-bold text-sm text-primary">
                    ${calc.netSalary.toFixed(2)}
                  </TableCell>

                  {/* Documentos y Solicitudes del Período */}
                  <TableCell className="py-3.5">
                    {actions.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 border border-border/70 text-xs font-mono font-semibold text-foreground">
                        {actions.length} {actions.length === 1 ? 'registro' : 'registros'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 text-[11px] font-mono italic">0</span>
                    )}
                  </TableCell>

                  {/* Detalle */}
                  <TableCell className="pr-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                    {/* Revisado (indicador visual, no afecta el cálculo) */}
                    {reviewEnabled && (
                      <button
                        type="button"
                        onClick={() => toggleReviewed(calc.employeeId)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md cursor-pointer transition-transform duration-150 ease-out motion-reduce:transition-none active:scale-90 hover:bg-muted/60"
                        title={reviewedIds.has(calc.employeeId) ? 'Revisado: clic para desmarcar' : 'Marcar como revisado'}
                        aria-label={`${reviewedIds.has(calc.employeeId) ? 'Desmarcar' : 'Marcar'} a ${calc.fullName} como revisado`}
                        aria-pressed={reviewedIds.has(calc.employeeId)}
                      >
                        {reviewedIds.has(calc.employeeId) ? (
                          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Circle className="h-4.5 w-4.5 text-muted-foreground/40 hover:text-muted-foreground" />
                        )}
                      </button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDetail(calc)}
                      className="h-8 w-8 cursor-pointer text-primary hover:text-primary hover:bg-primary/10"
                      title="Ver detalle"
                      aria-label={`Ver detalle de ${calc.fullName}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <PayrollDetailModal
        item={selectedEmployee}
        startDate={startDate}
        endDate={endDate}
        open={modalOpen}
        onOpenChange={setModalOpen}
        payrollReportId={payrollReportId}
        organizationId={organizationId}
        hasSavedReport={hasSavedReport}
      />
    </>
  )
}
