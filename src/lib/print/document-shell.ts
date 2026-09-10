'use client'

import { Organization } from '@/types/employee'
import {
  buildDocumentHeader,
  DOCUMENT_HEADER_STYLES,
  resolveOrgHeaderFields,
} from '@/lib/print/document-header'
import {
  buildDocumentSignatures,
  DocumentSignaturesData,
  DOCUMENT_SIGNATURES_STYLES,
} from '@/lib/print/document-signatures'

/**
 * Cascarón común para los documentos formales del sistema (solicitudes,
 * autorizaciones, actas). Unifica márgenes, tipografía, encabezado, tablas
 * de datos con color de acento, bloque de firmas y pie de página.
 *
 * Cada plantilla solo aporta:
 *   - `docTypeTitle` y `titleTag` (el <title> de la ventana)
 *   - `accentHex` (color del tipo de documento, desde las constantes del módulo)
 *   - `bodyHtml` (los párrafos y tablas propios)
 *   - los datos de firma (`signatures`)
 */

export interface DocumentShellOptions {
  organization?: Partial<Organization> | null
  organizationName?: string
  documentCode?: string
  accentHex: string
  /** Título del tipo de documento, centrado bajo el encabezado. */
  docTypeTitle: string
  /** Texto para el <title> de la pestaña de impresión. */
  windowTitle: string
  /** HTML del cuerpo (párrafos, tablas, etc.). */
  bodyHtml: string
  signatures: DocumentSignaturesData
  /** Pie de página (por defecto: "Documento oficial • {org} • Control de Nómina y Asistencia"). */
  footerNote?: string
}

export function formatLongDate(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  const dateObj = new Date(y, m - 1, d)

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const monthNames = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]

  const dayName = dayNames[dateObj.getDay()]
  const dayNum = dateObj.getDate()
  const monthName = monthNames[dateObj.getMonth()]
  const year = dateObj.getFullYear()

  return `${dayName}, ${dayNum} de ${monthName} de ${year}`
}

/** Traduce el status crudo a la nota que se muestra sobre la firma de la jefatura. */
export function resolveApproverStatus(
  status: string | undefined,
  resolvedAt: string | undefined,
  labels: { approved: string; rejected: string } = { approved: 'Aprobado', rejected: 'Rechazado' }
): { note?: string; date?: string } {
  if (status === 'aprobado') {
    return {
      note: labels.approved,
      date: resolvedAt ? formatLongDate(resolvedAt.split('T')[0]) : undefined,
    }
  }
  if (status === 'rechazado') {
    return {
      note: labels.rejected,
      date: resolvedAt ? formatLongDate(resolvedAt.split('T')[0]) : undefined,
    }
  }
  return {}
}

export const DOCUMENT_SHELL_STYLES = `
  @page {
    size: A4 portrait;
    margin: 20mm 18mm;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    font-family: Arial, Helvetica, "Segoe UI", sans-serif;
    color: #1a1a1a;
    background: #fff;
    margin: 0;
    padding: 24px;
    font-size: 12px;
    line-height: 1.6;
  }
  ${DOCUMENT_HEADER_STYLES}
  ${DOCUMENT_SIGNATURES_STYLES}
  .body-text {
    text-align: justify;
    margin: 0 0 16px;
    color: #1a1a1a;
  }
  .body-text strong {
    font-weight: 700;
  }
  .section-heading {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--doc-accent, #1a1a1a);
    border-bottom: 1px solid #cbd2da;
    padding-bottom: 4px;
    margin: 22px 0 10px;
  }
  table.data-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
    border: 1px solid var(--doc-accent, #9aa4b0);
  }
  table.data-table td,
  table.data-table th {
    border: 1px solid #c2ccd8;
    padding: 6px 10px;
    vertical-align: top;
    font-size: 11.5px;
    text-align: left;
  }
  table.data-table td.key,
  table.data-table th {
    width: 32%;
    background: #eef2f7;
    border-left: 3px solid var(--doc-accent, #9aa4b0);
    font-weight: 700;
    color: var(--doc-accent, #333);
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.4px;
  }
  table.data-table th {
    width: auto;
  }
  .note-block {
    border: 1px solid #c2ccd8;
    border-left: 3px solid var(--doc-accent, #9aa4b0);
    background: #f8fafc;
    padding: 10px 12px;
    font-size: 11.5px;
    margin-bottom: 8px;
  }
  .note-block strong {
    display: block;
    color: var(--doc-accent, #333);
    margin-bottom: 2px;
  }
  .footer-note {
    margin-top: 40px;
    text-align: center;
    font-size: 9px;
    color: #888;
    border-top: 1px solid #e2e2e2;
    padding-top: 8px;
  }
`

export function renderDocumentShell(opts: DocumentShellOptions): string {
  const issueDateFormatted = formatLongDate(new Date().toISOString().split('T')[0])
  const { orgLegalName } = resolveOrgHeaderFields(opts.organization, opts.organizationName)
  const footerNote =
    opts.footerNote || `Documento oficial • ${orgLegalName} • Control de Nómina y Asistencia`

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${opts.windowTitle}</title>
        <style>
          ${DOCUMENT_SHELL_STYLES}
          :root { --doc-accent: ${opts.accentHex}; }
        </style>
      </head>
      <body>
        ${buildDocumentHeader({
          organization: opts.organization,
          organizationName: opts.organizationName,
          documentCode: opts.documentCode,
          issueDateFormatted,
          accentColor: opts.accentHex,
          docTypeTitle: opts.docTypeTitle,
        })}

        ${opts.bodyHtml}

        ${buildDocumentSignatures(opts.signatures)}

        <div class="footer-note">${footerNote}</div>

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
}

/** Abre la ventana e imprime; devuelve false si el navegador la bloqueó. */
export function openPrintWindow(html: string): boolean {
  const printWindow = window.open('', '_blank', 'width=850,height=950')
  if (!printWindow) {
    window.print()
    return false
  }
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  return true
}

/** Devuelve el color de acento (hex) para un tipo de solicitud del módulo. */
export function shiftAccentHex(
  options: { type: string; accentHex: string }[],
  type: string,
  fallback = '#1a1a1a'
): string {
  return options.find((o) => o.type === type)?.accentHex || fallback
}
