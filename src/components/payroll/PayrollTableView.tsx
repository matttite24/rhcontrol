'use client'

import React, { useState } from 'react'
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
import { FileText, Eye, Printer, Download, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PayrollTableViewProps {
  calculations: PayrollEmployeeCalculation[]
  startDate: string
  endDate: string
  /** Solo si el rol está en borrador: habilita la pestaña Novedades (editable) en el drawer de detalle. */
  payrollReportId?: string
  organizationId?: string
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
}: PayrollTableViewProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<PayrollEmployeeCalculation | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  function handleOpenDetail(calc: PayrollEmployeeCalculation) {
    setSelectedEmployee(calc)
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
              <TableHead className="w-[18%] pl-6 font-semibold">Empleado</TableHead>
              <TableHead className="w-[10%] font-semibold">Sueldo Base</TableHead>
              <TableHead className="w-[9%] font-semibold">Bonos/Ext.</TableHead>
              <TableHead className="w-[10%] font-semibold">Décimos (Ley)</TableHead>
              <TableHead className="w-[10%] font-semibold">Total Ing.</TableHead>
              <TableHead className="w-[10%] font-semibold">Descuentos</TableHead>
              <TableHead className="w-[11%] font-semibold">Neto Rol</TableHead>
              <TableHead className="w-[15%] font-semibold">Documentos / Acciones</TableHead>
              <TableHead className="w-[7%] pr-6 text-right font-semibold">Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calculations.map((calc) => {
              const bonusesAndExtras = calc.bonuses + calc.overtimeAmount
              const actions = calc.actions || []
              const hasActions = actions.length > 0
              const approvedCount = actions.filter((a) => a.status === 'aprobado').length
              const pendingCount = actions.filter((a) => a.status === 'pendiente').length

              return (
                <TableRow key={calc.employeeId} className="hover:bg-muted/40 transition-colors text-xs">
                  {/* Empleado */}
                  <TableCell className="pl-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 ring-1 ring-border shrink-0">
                        <AvatarImage src={calc.avatarUrl ?? undefined} alt={calc.fullName} />
                        <AvatarFallback className="text-[10px] font-semibold">
                          {getInitials(calc.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-foreground truncate max-w-[140px]" title={calc.fullName}>
                          {calc.fullName}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[140px]">
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

                  {/* Acciones */}
                  <TableCell className="pr-6 py-3.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDetail(calc)}
                      className="h-8 text-xs cursor-pointer gap-1 text-primary font-medium hover:text-primary hover:bg-primary/10"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver detalles
                    </Button>
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
      />
    </>
  )
}
