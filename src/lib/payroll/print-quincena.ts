'use client'

import { Organization } from '@/types/employee'
import { buildQuincenaReference } from '@/lib/payroll/generate-quincena-tsv'
import { printBankPaymentListDocument, BankPaymentListRow } from '@/lib/payroll/print-bank-payment-list'

export type QuincenaPrintRow = BankPaymentListRow

export interface QuincenaPrintData {
  organization?: Partial<Organization> | null
  organizationName?: string
  year: number
  month: number
  rows: QuincenaPrintRow[]
}

/** Listado imprimible del pago de anticipos quincenales — ver printBankPaymentListDocument. */
export function printQuincenaDocument(data: QuincenaPrintData) {
  const reference = buildQuincenaReference(data.year, data.month)
  return printBankPaymentListDocument({
    organization: data.organization,
    organizationName: data.organizationName,
    docTypeTitle: `Listado de Pago — ${reference}`,
    windowTitle: `Quincena - ${reference}`,
    introText: `Listado de anticipos quincenales a transferir correspondiente a <strong>${reference}</strong>.`,
    rows: data.rows,
  })
}
