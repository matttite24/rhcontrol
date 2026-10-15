'use client'

import { ChevronDown, Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Organization } from '@/types/employee'
import { PayrollEmployeeCalculation } from './PayrollDetailModal'
import { buildRolReference, downloadBankPaymentTsv, BankPaymentTsvRow } from '@/lib/payroll/generate-bank-payment-tsv'
import { printBankPaymentListDocument } from '@/lib/payroll/print-bank-payment-list'

interface PayrollPayoutMenuProps {
  /** Empleados incluidos en el listado y en el archivo (ya filtrados por quien llama). */
  calculations: PayrollEmployeeCalculation[]
  endDate: string
  organization?: Partial<Organization> | null
  /**
   * El rol aún no está generado (borrador o sin guardar): imprimir y exportar
   * quedan deshabilitados — los montos pueden cambiar hasta generarlo.
   */
  locked?: boolean
}

/**
 * Menú único "Imprimir y exportar" del neto a pagar de un rol: listado
 * imprimible + archivo TSV bancario. Reemplaza a los dos botones sueltos que
 * había en /payroll y en /payroll/history/[id], y solo está disponible cuando
 * el rol ya fue generado.
 */
export function PayrollPayoutMenu({ calculations, endDate, organization, locked = false }: PayrollPayoutMenuProps) {
  // Solo va en el archivo bancario quien tiene cédula y número de cuenta; el
  // resto sí aparece en el listado imprimible.
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
    if (locked || exportableRows.length === 0 || !endDate) return
    const reference = buildRolReference(endDate)
    const [y, m] = endDate.split('-')
    downloadBankPaymentTsv(exportableRows, reference, `rol_${y}_${m}.tsv`)
  }

  function handlePrint() {
    if (locked || !endDate) return
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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5 font-medium cursor-pointer">
            <Printer className="h-4 w-4" />
            Imprimir y exportar
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-64">
        {locked && (
          // Base UI exige que el label viva dentro de un grupo.
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground whitespace-normal">
              Disponible cuando el rol esté generado. Mientras es un borrador, los montos pueden cambiar.
            </DropdownMenuLabel>
          </DropdownMenuGroup>
        )}
        <DropdownMenuItem
          onClick={handlePrint}
          disabled={locked || calculations.length === 0}
          className="gap-2 cursor-pointer"
        >
          <Printer className="h-4 w-4" />
          Imprimir listado de pago
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleExport}
          disabled={locked || exportableRows.length === 0}
          className="gap-2 cursor-pointer"
        >
          <Download className="h-4 w-4" />
          Exportar TSV bancario ({exportableRows.length})
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
