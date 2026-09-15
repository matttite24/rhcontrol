'use client'

import { Organization } from '@/types/employee'
import {
  buildDocumentHeader,
  DOCUMENT_HEADER_STYLES,
  resolveOrgHeaderFields,
} from '@/lib/print/document-header'
import { DOCUMENT_SHELL_STYLES, formatLongDate, openPrintWindow } from '@/lib/print/document-shell'

export interface BankPaymentListRow {
  fullName: string
  nationalId: string | null
  accountNumber: string | null
  amount: number
}

export interface BankPaymentListPrintData {
  organization?: Partial<Organization> | null
  organizationName?: string
  /** Título mostrado bajo el encabezado, ej. "Listado de Pago — ROL SEPTIEMBRE 2026". */
  docTypeTitle: string
  /** Texto para el <title> de la pestaña de impresión. */
  windowTitle: string
  /** Frase introductoria, ej. "Listado de anticipos quincenales a transferir correspondiente a...". */
  introText: string
  rows: BankPaymentListRow[]
}

/**
 * Listado imprimible compartido entre Quincena y Generar Rol — a diferencia
 * del resto de documentos del sistema (una firma por documento, un empleado
 * por documento), este es un LISTADO de N filas con una columna de check por
 * fila para que quien reparte los comprobantes marque manualmente a cada
 * beneficiario. No usa renderDocumentShell (pensado para un solo firmante al
 * pie) — arma su propio cuerpo reutilizando el mismo encabezado
 * institucional y estilos base.
 */
export function printBankPaymentListDocument(data: BankPaymentListPrintData) {
  const { orgLegalName } = resolveOrgHeaderFields(data.organization, data.organizationName)
  const issueDateFormatted = formatLongDate(new Date().toISOString().split('T')[0])
  const totalAmount = data.rows.reduce((sum, r) => sum + r.amount, 0)

  const rowsHtml = data.rows
    .map(
      (row, idx) => `
        <tr>
          <td class="col-num">${idx + 1}</td>
          <td>${row.fullName}</td>
          <td class="col-mono">${row.nationalId || '—'}</td>
          <td class="col-mono">${row.accountNumber || '—'}</td>
          <td class="col-amount">$${row.amount.toFixed(2)}</td>
          <td class="col-check"><span class="check-box"></span></td>
        </tr>
      `
    )
    .join('')

  const bodyHtml = `
    <p class="body-text">
      ${data.introText} Total de beneficiarios: <strong>${data.rows.length}</strong>.
    </p>

    <table class="payment-list-table">
      <thead>
        <tr>
          <th class="col-num">#</th>
          <th>Nombre del Empleado</th>
          <th class="col-mono">Cédula</th>
          <th class="col-mono">N° de Cuenta</th>
          <th class="col-amount">Valor</th>
          <th class="col-check">Check</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4" class="total-label">Total</td>
          <td class="col-amount total-amount">$${totalAmount.toFixed(2)}</td>
          <td class="col-check"></td>
        </tr>
      </tfoot>
    </table>
  `

  const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${data.windowTitle}</title>
        <style>
          ${DOCUMENT_HEADER_STYLES}
          ${DOCUMENT_SHELL_STYLES}
          :root { --doc-header-accent: #059669; --doc-accent: #059669; }

          .payment-list-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 14px;
            font-size: 11px;
          }
          .payment-list-table th,
          .payment-list-table td {
            border: 1px solid #d4d4d4;
            padding: 6px 8px;
            text-align: left;
          }
          .payment-list-table thead th {
            background: #f3f4f6;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 9.5px;
            letter-spacing: 0.02em;
            color: #374151;
          }
          .payment-list-table .col-num { width: 28px; text-align: center; }
          .payment-list-table .col-mono { font-family: 'Courier New', monospace; }
          .payment-list-table .col-amount { text-align: right; font-family: 'Courier New', monospace; font-weight: 700; width: 80px; }
          .payment-list-table .col-check { width: 50px; text-align: center; }
          .check-box {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 1.5px solid #1a1a1a;
            border-radius: 3px;
          }
          .payment-list-table tfoot td {
            font-weight: 700;
            background: #f9fafb;
          }
          .total-label { text-align: right; text-transform: uppercase; font-size: 10px; }
          .total-amount { font-size: 12px; }

          @media print {
            .payment-list-table tr { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        ${buildDocumentHeader({
          organization: data.organization,
          organizationName: data.organizationName,
          issueDateFormatted,
          accentColor: '#059669',
          docTypeTitle: data.docTypeTitle,
        })}

        ${bodyHtml}

        <div class="footer-note">Documento oficial • ${orgLegalName} • Control de Nómina y Asistencia</div>

        <script>
          window.onload = function() {
            window.focus();
            window.print();
            setTimeout(function() { window.close(); }, 1000);
          };
        </script>
      </body>
    </html>
  `

  return openPrintWindow(html)
}
