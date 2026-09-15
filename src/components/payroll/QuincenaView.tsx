'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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
import { Employee, Organization } from '@/types/employee'
import {
  buildQuincenaReference,
  downloadQuincenaTsv,
  DEFAULT_BANK_CODE,
  QuincenaTsvRow,
} from '@/lib/payroll/generate-quincena-tsv'
import { printQuincenaDocument } from '@/lib/payroll/print-quincena'
import { Download, Printer, AlertTriangle, Users, DollarSign, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

type QuincenaEmployee = Pick<
  Employee,
  | 'id'
  | 'full_name'
  | 'national_id'
  | 'bank_name'
  | 'bank_code'
  | 'account_number'
  | 'payment_type'
  | 'department'
  | 'position'
  | 'avatar_url'
  | 'status'
  | 'biweekly_advance_amount'
>

interface QuincenaViewProps {
  employees: QuincenaEmployee[]
  year: number
  month: number
  organization?: Partial<Organization> | null
}

const MONTH_OPTIONS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
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

export function QuincenaView({ employees, year, month, organization }: QuincenaViewProps) {
  const router = useRouter()
  const [exporting, setExporting] = useState(false)

  function handleMonthChange(newYear: number, newMonth: number) {
    router.push(`/payroll/quincena?year=${newYear}&month=${newMonth}`)
  }

  // Empleados sin cédula o sin número de cuenta no pueden ir en el archivo
  // del banco (columnas CONTRAPARTIDA/NUMERO ID y NUMERO CTA quedarían
  // vacías) — se marcan en la tabla y se excluyen del conteo exportable, en
  // vez de generar un TSV con filas inválidas que el banco rechazaría.
  const { validEmployees, invalidEmployees } = useMemo(() => {
    const valid: QuincenaEmployee[] = []
    const invalid: QuincenaEmployee[] = []
    for (const emp of employees) {
      if (emp.national_id?.trim() && emp.account_number?.trim()) {
        valid.push(emp)
      } else {
        invalid.push(emp)
      }
    }
    return { validEmployees: valid, invalidEmployees: invalid }
  }, [employees])

  const totalAmount = employees.reduce((sum, e) => sum + (Number(e.biweekly_advance_amount) || 0), 0)
  const reference = buildQuincenaReference(year, month)

  async function handleExport() {
    if (validEmployees.length === 0) return
    setExporting(true)
    try {
      const rows: QuincenaTsvRow[] = validEmployees.map((emp) => ({
        fullName: emp.full_name,
        nationalId: emp.national_id!.trim(),
        bankCode: emp.bank_code,
        accountNumber: emp.account_number,
        amount: Number(emp.biweekly_advance_amount) || 0,
      }))
      downloadQuincenaTsv(rows, year, month)
    } finally {
      setExporting(false)
    }
  }

  // El reporte imprimible incluye a TODOS los empleados con el anticipo
  // configurado, incluso los que tienen datos incompletos y por eso no
  // entran en el TSV bancario — es un checklist físico para marcar quién
  // recibió su pago, no depende de que la transferencia bancaria sea viable.
  function handlePrint() {
    printQuincenaDocument({
      organization,
      year,
      month,
      rows: employees.map((emp) => ({
        fullName: emp.full_name,
        nationalId: emp.national_id ?? null,
        accountNumber: emp.account_number,
        amount: Number(emp.biweekly_advance_amount) || 0,
      })),
    })
  }

  return (
    <>
      {/* Barra de selección de mes + exportar */}
      <div className="px-6 py-3 border-b bg-card/75 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <select
            value={month}
            onChange={(e) => handleMonthChange(year, parseInt(e.target.value, 10))}
            className="h-9 rounded-lg border border-input bg-background/80 px-3 text-xs text-foreground cursor-pointer hover:bg-background"
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => handleMonthChange(parseInt(e.target.value, 10), month)}
            className="h-9 rounded-lg border border-input bg-background/80 px-3 text-xs text-foreground cursor-pointer hover:bg-background"
          >
            {Array.from({ length: 5 }).map((_, i) => {
              const y = new Date().getFullYear() - 1 + i
              return (
                <option key={y} value={y}>
                  {y}
                </option>
              )
            })}
          </select>
          <Badge variant="outline" className="text-[10.5px] font-mono text-muted-foreground hidden sm:inline-flex">
            REF: {reference}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handlePrint}
            disabled={employees.length === 0}
            variant="outline"
            size="sm"
            className="gap-2 font-medium cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
          <Button
            onClick={handleExport}
            disabled={validEmployees.length === 0 || exporting}
            size="sm"
            className="gap-2 font-medium cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Exportar TSV ({validEmployees.length})
          </Button>
        </div>
      </div>

      {/* Tarjetas KPI */}
      <div className="px-6 py-4 border-b bg-muted/20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-xl border bg-card shadow-2xs space-y-1">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" />
              Empleados con Anticipo
            </span>
            <p className="text-lg font-bold font-mono text-foreground">{employees.length}</p>
          </div>
          <div className="p-3.5 rounded-xl border bg-primary/10 border-primary/30 shadow-2xs space-y-1">
            <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              Total a Transferir
            </span>
            <p className="text-lg font-black font-mono text-primary">${totalAmount.toFixed(2)}</p>
          </div>
          {invalidEmployees.length > 0 && (
            <div className="p-3.5 rounded-xl border bg-amber-500/10 border-amber-500/30 shadow-2xs space-y-1">
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Con Datos Incompletos
              </span>
              <p className="text-lg font-bold font-mono text-amber-700 dark:text-amber-400">
                {invalidEmployees.length}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="flex-1 p-6 md:p-8 w-full">
        {employees.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center bg-card/40 max-w-md mx-auto my-8">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
              <DollarSign className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-base text-foreground">Sin anticipos quincenales configurados</h3>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
              Configura el "Anticipo Quincenal Recurrente" en la pestaña de Salario de cada empleado para que aparezca aquí.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border bg-card shadow-xs overflow-hidden w-full">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
                  <TableHead className="w-[28%] pl-6 font-semibold">Empleado</TableHead>
                  <TableHead className="w-[16%] font-semibold">Cédula</TableHead>
                  <TableHead className="w-[16%] font-semibold">Banco</TableHead>
                  <TableHead className="w-[18%] font-semibold">N° Cuenta</TableHead>
                  <TableHead className="w-[12%] font-semibold">Monto</TableHead>
                  <TableHead className="w-[10%] pr-6 text-right font-semibold">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => {
                  const isInvalid = !emp.national_id?.trim() || !emp.account_number?.trim()
                  const amount = Number(emp.biweekly_advance_amount) || 0

                  return (
                    <TableRow
                      key={emp.id}
                      className={cn(
                        'hover:bg-muted/40 transition-colors text-xs',
                        isInvalid && 'bg-amber-500/5'
                      )}
                    >
                      <TableCell className="pl-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 ring-1 ring-border shrink-0">
                            <AvatarImage src={emp.avatar_url ?? undefined} alt={emp.full_name} />
                            <AvatarFallback className="text-[10px] font-semibold">
                              {getInitials(emp.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-foreground truncate max-w-[200px]">
                              {emp.full_name}
                            </span>
                            <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                              {emp.position || emp.department || '—'}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="py-3.5 font-mono text-foreground">
                        {emp.national_id || (
                          <span className="text-amber-600 dark:text-amber-400 italic">Sin cédula</span>
                        )}
                      </TableCell>

                      <TableCell className="py-3.5">
                        <div className="flex flex-col">
                          <span className="text-foreground">{emp.bank_name || '—'}</span>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            Cód. {emp.bank_code?.trim() || `${DEFAULT_BANK_CODE} (por defecto)`}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="py-3.5 font-mono text-foreground">
                        {emp.account_number || (
                          <span className="text-amber-600 dark:text-amber-400 italic">Sin cuenta</span>
                        )}
                      </TableCell>

                      <TableCell className="py-3.5 font-mono font-bold text-foreground">
                        ${amount.toFixed(2)}
                      </TableCell>

                      <TableCell className="pr-6 py-3.5 text-right">
                        {isInvalid ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-5 px-1.5 font-medium border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10"
                          >
                            Incompleto
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-5 px-1.5 font-medium border-emerald-200 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50"
                          >
                            Listo
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {invalidEmployees.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-3 px-1">
            {invalidEmployees.length} {invalidEmployees.length === 1 ? 'empleado no se incluye' : 'empleados no se incluyen'} en el archivo exportado por falta de cédula o número de cuenta — completa sus datos en la ficha del empleado.
          </p>
        )}
      </div>
    </>
  )
}
