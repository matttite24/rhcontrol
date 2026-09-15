/**
 * Wrapper de Quincena sobre el generador TSV genérico compartido con
 * Generar Rol — ver generate-bank-payment-tsv.ts (mismo formato bancario de
 * 12 columnas, solo cambia el texto de REFERENCIA y el nombre del archivo).
 */
import {
  MONTH_NAMES_ES,
  BankPaymentTsvRow,
  DEFAULT_BANK_CODE,
  buildBankPaymentTsvContent,
  downloadBankPaymentTsv,
} from './generate-bank-payment-tsv'

export type QuincenaTsvRow = BankPaymentTsvRow
export { DEFAULT_BANK_CODE, formatAmountForBank } from './generate-bank-payment-tsv'

/** "QUINCENA <MES> <AÑO>" — ej. "QUINCENA SEPTIEMBRE 2026". */
export function buildQuincenaReference(year: number, month: number): string {
  const monthName = MONTH_NAMES_ES[month - 1] || ''
  return `QUINCENA ${monthName} ${year}`
}

export function buildQuincenaTsvContent(rows: QuincenaTsvRow[], year: number, month: number): string {
  return buildBankPaymentTsvContent(rows, buildQuincenaReference(year, month))
}

/** Dispara la descarga del archivo en el navegador (Blob + <a download>). */
export function downloadQuincenaTsv(rows: QuincenaTsvRow[], year: number, month: number) {
  const monthName = MONTH_NAMES_ES[month - 1] || ''
  const fileName = `quincena_${monthName.toLowerCase()}_${year}.tsv`
  downloadBankPaymentTsv(rows, buildQuincenaReference(year, month), fileName)
}
