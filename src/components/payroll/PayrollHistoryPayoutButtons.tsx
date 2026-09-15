'use client'

import { Button } from '@/components/ui/button'
import { Printer, Download } from 'lucide-react'
import { Organization } from '@/types/employee'
import { PayrollEmployeeCalculation } from './PayrollDetailModal'
import { buildRolReference, downloadBankPaymentTsv, BankPaymentTsvRow } from '@/lib/payroll/generate-bank-payment-tsv'
import { printBankPaymentListDocument } from '@/lib/payroll/print-bank-payment-list'

interface PayrollHistoryPayoutButtonsProps {
  calculations: PayrollEmployeeCalculation[]
  endDate: string
  organization?: Partial<Organization> | null
}

/**
 * Imprimir listado + Exportar TSV del neto a pagar, para un reporte ya
 * guardado en /payroll/history/[id] — a diferencia de PayrollPayoutButtonsSlot
 * (en /payroll, vista en vivo con checkboxes de selección), aquí no hay
 * selección: incluye a TODOS los empleados del reporte, sea snapshot
 * congelado (cerrado) o cálculo en vivo (borrador).
 */
export function PayrollHistoryPayoutButtons({ calculations, endDate, organization }: PayrollHistoryPayoutButtonsProps) {
  const exportableRows: BankPaymentTsvRow[] = calculations
    .filter((c) => c.nationalId?.trim() && c.accountNumber?.trim())
    .map((c) => ({
      fullName: c.fullName,
      nationalId: c.nationalId!.trim(),
      bankCode: c.bankCode,
      accountNumber: c.accountNumber,
      amount: c.netSalary,
    }))

  function handleExport() {
    if (exportableRows.length === 0 || !endDate) return
    const reference = buildRolReference(endDate)
    const [y, m] = endDate.split('-')
    downloadBankPaymentTsv(exportableRows, reference, `rol_${y}_${m}.tsv`)
  }

  function handlePrint() {
    if (!endDate) return
    const reference = buildRolReference(endDate)
    printBankPaymentListDocument({
      organization,
      docTypeTitle: `Listado de Pago — ${reference}`,
      windowTitle: `Rol de Pagos - ${reference}`,
      introText: `Listado de sueldos netos a pagar correspondiente a <strong>${reference}</strong>.`,
      rows: calculations.map((c) => ({
        fullName: c.fullName,
        nationalId: c.nationalId,
        accountNumber: c.accountNumber,
        amount: c.netSalary,
      })),
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handlePrint}
        disabled={calculations.length === 0}
        variant="outline"
        size="sm"
        className="gap-2 font-medium cursor-pointer"
      >
        <Printer className="h-4 w-4" />
        Imprimir
      </Button>
      <Button
        onClick={handleExport}
        disabled={exportableRows.length === 0}
        variant="outline"
        size="sm"
        className="gap-2 font-medium cursor-pointer"
      >
        <Download className="h-4 w-4" />
        Exportar TSV ({exportableRows.length})
      </Button>
    </div>
  )
}
