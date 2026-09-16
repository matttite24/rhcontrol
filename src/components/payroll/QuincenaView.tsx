'use client'

import React, { useState, useMemo, useTransition } from 'react'
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
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/layout/PageHeader'
import { Employee, Organization } from '@/types/employee'
import {
  buildQuincenaReference,
  downloadQuincenaTsv,
  DEFAULT_BANK_CODE,
  QuincenaTsvRow,
} from '@/lib/payroll/generate-quincena-tsv'
import { printQuincenaDocument } from '@/lib/payroll/print-quincena'
import { markQuincenaPaidAction } from '@/lib/payroll/quincena-actions'
import { QuincenaNoticeModal } from '@/components/payroll/QuincenaNoticeModal'
import { toast } from '@/components/ui/toast'
import {
  Download,
  Printer,
  AlertTriangle,
  Users,
  DollarSign,
  Calendar,
  ChevronDown,
  Wallet,
  CheckCircle2,
  Loader2,
  ImageIcon,
} from 'lucide-react'
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
  organizationId: string
  /** Empleados ya marcados como pagados para este año/mes (quincena_payments). */
  paidEmployeeIds: string[]
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

function formatMoney(n: number) {
  return n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function QuincenaView({
  employees,
  year,
  month,
  organization,
  organizationId,
  paidEmployeeIds,
}: QuincenaViewProps) {
  const router = useRouter()
  const [exporting, setExporting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [noticeModalOpen, setNoticeModalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const paidSet = useMemo(() => new Set(paidEmployeeIds), [paidEmployeeIds])

  // Selección de a quién se le va a pagar/exportar/marcar — por defecto todos
  // los que ya tienen datos completos y AÚN NO están pagados, para no
  // obligar a marcar uno por uno ni volver a pagar por error a quien ya
  // recibió su quincena.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(
      employees
        .filter((e) => e.national_id?.trim() && e.account_number?.trim() && !paidSet.has(e.id))
        .map((e) => e.id)
    )
  )

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

  const selectedEmployees = useMemo(
    () => employees.filter((e) => selectedIds.has(e.id)),
    [employees, selectedIds]
  )
  const notSelected = useMemo(
    () => employees.filter((e) => !selectedIds.has(e.id)),
    [employees, selectedIds]
  )

  const totalAmount = selectedEmployees.reduce((sum, e) => sum + (Number(e.biweekly_advance_amount) || 0), 0)
  const reference = buildQuincenaReference(year, month)

  function toggleOne(id: string, checked: boolean) {
    if (paidSet.has(id)) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  // Solo los empleados AÚN NO pagados son seleccionables — "Seleccionar
  // todos" nunca debe volver a marcar para pago a alguien ya pagado.
  const payableEmployees = useMemo(() => employees.filter((e) => !paidSet.has(e.id)), [employees, paidSet])

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(payableEmployees.map((e) => e.id)) : new Set())
  }

  const allSelected = payableEmployees.length > 0 && selectedIds.size === payableEmployees.length
  const someSelected = selectedIds.size > 0 && !allSelected

  async function handleExport() {
    const rows: QuincenaTsvRow[] = selectedEmployees
      .filter((e) => e.national_id?.trim() && e.account_number?.trim())
      .map((emp) => ({
        fullName: emp.full_name,
        nationalId: emp.national_id!.trim(),
        bankCode: emp.bank_code,
        accountNumber: emp.account_number,
        amount: Number(emp.biweekly_advance_amount) || 0,
      }))
    if (rows.length === 0) return
    setExporting(true)
    try {
      downloadQuincenaTsv(rows, year, month)
    } finally {
      setExporting(false)
    }
  }

  // El reporte imprimible incluye a todos los seleccionados, incluso los que
  // tienen datos incompletos — es un checklist físico para marcar quién
  // recibió su pago, no depende de que la transferencia bancaria sea viable.
  function handlePrint() {
    printQuincenaDocument({
      organization,
      year,
      month,
      rows: selectedEmployees.map((emp) => ({
        fullName: emp.full_name,
        nationalId: emp.national_id ?? null,
        accountNumber: emp.account_number,
        amount: Number(emp.biweekly_advance_amount) || 0,
      })),
    })
  }

  function requestPay() {
    setConfirmOpen(true)
  }

  function closeConfirm() {
    // Igual que en los demás modales de nómina: blurea el contenido del
    // fondo mientras se confirma cerrar, en vez de simplemente desmontar.
    setClosing(true)
    setTimeout(() => {
      setConfirmOpen(false)
      setClosing(false)
    }, 150)
  }

  function confirmPay() {
    if (selectedEmployees.length === 0) return
    startTransition(async () => {
      const result = await markQuincenaPaidAction({
        organizationId,
        periodYear: year,
        periodMonth: month,
        employees: selectedEmployees.map((e) => ({
          employeeId: e.id,
          amount: Number(e.biweekly_advance_amount) || 0,
        })),
      })
      if (result.success) {
        setConfirmOpen(false)
      } else {
        toast.error(result.error || 'No se pudo registrar el pago. Intenta de nuevo.')
      }
    })
  }

  return (
    <>
      <PageHeader
        title="Quincena"
        description="Empleados con anticipo quincenal recurrente y registro del pago para el banco"
        action={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" className="gap-1.5 font-medium cursor-pointer">
                    Exportar
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setNoticeModalOpen(true)} className="gap-2 cursor-pointer">
                  <ImageIcon className="h-4 w-4 text-emerald-500" />
                  Exportar Png
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePrint} disabled={selectedEmployees.length === 0} className="gap-2 cursor-pointer">
                  <Printer className="h-4 w-4" />
                  Imprimir listado
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport} disabled={validEmployees.length === 0 || exporting} className="gap-2 cursor-pointer">
                  <Download className="h-4 w-4" />
                  Exportar TSV ({selectedEmployees.filter((e) => e.national_id?.trim() && e.account_number?.trim()).length})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={requestPay}
              disabled={selectedEmployees.length === 0 || payableEmployees.length === 0}
              size="sm"
              className="gap-2 font-medium cursor-pointer"
              title={payableEmployees.length === 0 ? 'Todos los empleados ya fueron pagados en este período' : undefined}
            >
              <Wallet className="h-4 w-4" />
              {payableEmployees.length === 0 ? 'Todos pagados' : `Pagar (${selectedEmployees.length})`}
            </Button>
          </div>
        }
      />

      {/* Barra de selección de mes + resumen (total y personas al lado de los filtros) */}
      <div className="px-6 py-3 border-b bg-card/75 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
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

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">{selectedIds.size}</span>
            <span>de {employees.length} seleccionados</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <DollarSign className="h-3.5 w-3.5 text-primary" />
            <span className="font-bold font-mono text-primary">${formatMoney(totalAmount)}</span>
          </div>
          {invalidEmployees.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="font-semibold">{invalidEmployees.length} incompletos</span>
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
                  <TableHead className="w-[3%] pl-6">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected
                      }}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-input cursor-pointer accent-primary"
                      aria-label="Seleccionar todos los empleados"
                    />
                  </TableHead>
                  <TableHead className="w-[25%] font-semibold">Empleado</TableHead>
                  <TableHead className="w-[14%] font-semibold">Cédula</TableHead>
                  <TableHead className="w-[15%] font-semibold">Banco</TableHead>
                  <TableHead className="w-[16%] font-semibold">N° Cuenta</TableHead>
                  <TableHead className="w-[10%] font-semibold">Monto</TableHead>
                  <TableHead className="w-[9%] pr-6 text-right font-semibold">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => {
                  const isInvalid = !emp.national_id?.trim() || !emp.account_number?.trim()
                  const isPaid = paidSet.has(emp.id)
                  const isChecked = selectedIds.has(emp.id)
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
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isPaid}
                          onChange={(e) => toggleOne(emp.id, e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-input cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                          title={isPaid ? 'Ya fue pagado en este período' : undefined}
                          aria-label={isPaid ? `${emp.full_name} ya fue pagado` : `Seleccionar a ${emp.full_name}`}
                        />
                      </TableCell>
                      <TableCell className="py-3.5">
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
                        {isPaid ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-5 px-1.5 font-medium border-emerald-200 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50 gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Pagado
                          </Badge>
                        ) : isInvalid ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-5 px-1.5 font-medium border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10"
                          >
                            Incompleto
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-5 px-1.5 font-medium text-muted-foreground"
                          >
                            Pendiente
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

      {/* Confirmación de pago — avisa quién queda fuera si no está marcado */}
      <Dialog open={confirmOpen} onOpenChange={(open) => (open ? setConfirmOpen(true) : closeConfirm())}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            'sm:max-w-md transition-[filter] duration-150',
            closing && 'blur-[6px]'
          )}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-foreground">Confirmar pago de quincena</h3>
                <p className="text-xs text-muted-foreground">
                  Se marcarán como pagados <strong>{selectedEmployees.length}</strong> anticipos de <strong>{reference}</strong>, por un total de{' '}
                  <strong className="text-primary">${formatMoney(totalAmount)}</strong>. Esto habilita el descuento correspondiente en el Rol de fin de mes.
                </p>
              </div>
            </div>

            {notSelected.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {notSelected.length} {notSelected.length === 1 ? 'empleado no se marcará' : 'empleados no se marcarán'} como pagado
                </div>
                <p>
                  No se cargará su anticipo quincenal en este pago ni se descontará en el Rol de fin de mes, hasta que se lo marque:
                </p>
                <ul className="list-disc list-inside space-y-0.5 max-h-24 overflow-y-auto">
                  {notSelected.map((e) => (
                    <li key={e.id} className="truncate">{e.full_name}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={closeConfirm} disabled={isPending} className="cursor-pointer">
                Cancelar
              </Button>
              <Button size="sm" onClick={confirmPay} disabled={isPending || selectedEmployees.length === 0} className="gap-2 cursor-pointer">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                Confirmar Pago
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para generar y previsualizar imagen PNG de quincena para WhatsApp */}
      <QuincenaNoticeModal
        open={noticeModalOpen}
        onOpenChange={setNoticeModalOpen}
        organization={organization}
        year={year}
        month={month}
      />
    </>
  )
}
