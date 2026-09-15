/**
 * Genera el archivo TSV para el "Cash Management" del banco — formato fijo
 * de 12 columnas separadas por tabulación, sin fila de encabezado, cada
 * línea es un beneficiario. Compartido entre Quincena (anticipos
 * quincenales) y Generar Rol (neto a pagar de fin de mes) — mismo formato
 * bancario, la única diferencia es de dónde sale el monto y el texto de
 * REFERENCIA ("QUINCENA <MES> <AÑO>" vs "ROL <MES> <AÑO>").
 */

export interface BankPaymentTsvRow {
  fullName: string
  nationalId: string
  bankCode: string | null
  accountNumber: string | null
  amount: number
}

export const MONTH_NAMES_ES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

/**
 * "ROL <MES> <AÑO>" — ej. "ROL SEPTIEMBRE 2026". El mes/año se toma de la
 * fecha de fin del corte (endDate), que es la que mejor representa a qué mes
 * pertenece el rol cuando el corte no coincide exactamente con el 1-30/31.
 */
export function buildRolReference(endDateIso: string): string {
  const [y, m] = endDateIso.split('-').map(Number)
  const monthName = MONTH_NAMES_ES[(m || 1) - 1] || ''
  return `ROL ${monthName} ${y || ''}`.trim()
}

/**
 * Convierte un monto decimal (200.00) al formato sin punto que pide el banco
 * (20000): centavos como enteros, sin separador. Redondea a 2 decimales
 * antes de convertir para evitar arrastrar errores de coma flotante
 * (200.1 → 20010, no 20009 por 200.1*100 = 20009.999999999998).
 */
export function formatAmountForBank(amount: number): string {
  return Math.round(amount * 100).toString()
}

/** Código de banco por defecto cuando el empleado no tiene uno configurado. */
export const DEFAULT_BANK_CODE = '10'

function buildRow(row: BankPaymentTsvRow, reference: string): string {
  const columns = [
    'PA',
    row.nationalId,
    'USD',
    formatAmountForBank(row.amount),
    'CTA',
    'AHO',
    row.accountNumber || '',
    reference,
    'C',
    row.nationalId,
    row.fullName.toUpperCase(),
    row.bankCode?.trim() || DEFAULT_BANK_CODE,
  ]
  return columns.join('\t')
}

export function buildBankPaymentTsvContent(rows: BankPaymentTsvRow[], reference: string): string {
  return rows.map((row) => buildRow(row, reference)).join('\r\n')
}

/** Dispara la descarga del archivo en el navegador (Blob + <a download>). */
export function downloadBankPaymentTsv(rows: BankPaymentTsvRow[], reference: string, fileName: string) {
  const content = buildBankPaymentTsvContent(rows, reference)

  const blob = new Blob([content], { type: 'text/tab-separated-values;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
