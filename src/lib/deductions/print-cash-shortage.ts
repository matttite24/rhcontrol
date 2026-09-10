'use client'

import { Organization } from '@/types/employee'
import { buildDocumentHeader, DOCUMENT_HEADER_STYLES } from '@/lib/print/document-header'

export interface PrintCashShortageData {
  organization?: Partial<Organization> | null
  organizationName?: string
  employeeName: string
  nationalId: string
  department: string
  position: string
  cashDate: string
  amount: number
  reason: string
  periodMonth?: number
  periodYear?: number
  status?: string
  documentCode?: string
  issueDate?: string
}

const MONTH_NAMES = [
  '',
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

function formatLongDate(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  const dateObj = new Date(y, m - 1, d)

  const monthNames = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ]

  const dayNum = dateObj.getDate()
  const monthName = monthNames[dateObj.getMonth()]
  const year = dateObj.getFullYear()

  return `${dayNum} de ${monthName} de ${year}`
}

export function printCashShortageDocument(data: PrintCashShortageData) {
  const printWindow = window.open('', '_blank', 'width=850,height=950')
  if (!printWindow) {
    window.print()
    return
  }

  const org = data.organization || {}
  const orgLegalName = org.legal_name || org.name || data.organizationName || 'RH Garden'

  const isCanceled = data.status === 'anulado'
  const issueDateFormatted = formatLongDate(
    data.issueDate || new Date().toISOString().split('T')[0]
  )
  const cashDateFormatted = formatLongDate(data.cashDate)

  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Descuento por Faltante de Caja - ${data.employeeName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 20mm 20mm 20mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.55;
      color: #111827;
      background: #ffffff;
    }
    .document-container {
      width: 100%;
      max-width: 720px;
      margin: 0 auto;
      position: relative;
    }
    .canceled-watermark {
      position: absolute;
      top: 35%;
      left: 10%;
      width: 80%;
      text-align: center;
      font-size: 46pt;
      font-weight: 900;
      color: rgba(220, 38, 38, 0.12);
      transform: rotate(-30deg);
      text-transform: uppercase;
      letter-spacing: 6px;
      pointer-events: none;
      z-index: 10;
      border: 4px dashed rgba(220, 38, 38, 0.18);
      padding: 18px;
    }
    ${DOCUMENT_HEADER_STYLES}
    .doc-badge {
      display: inline-block;
      font-size: 8pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 4px 10px;
      border-radius: 4px;
      background-color: #ffe4e6;
      color: #9f1239;
      border: 1px solid #fb7185;
      margin-bottom: 5px;
    }
    .doc-badge.canceled {
      background-color: #fee2e2;
      color: #991b1b;
      border-color: #ef4444;
    }
    .doc-title-section {
      text-align: center;
      margin: 16px 0 22px 0;
    }
    .doc-main-title {
      font-size: 13pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .doc-sub-title {
      font-size: 9.5pt;
      color: #64748b;
      margin-top: 4px;
      font-weight: 600;
    }
    .dest-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 9.5pt;
    }
    .dest-table td {
      padding: 5px 8px;
      vertical-align: top;
    }
    .dest-label {
      width: 130px;
      font-weight: 700;
      color: #334155;
      text-transform: uppercase;
      font-size: 8.5pt;
      letter-spacing: 0.3px;
    }
    .dest-val {
      color: #0f172a;
      font-weight: 500;
    }
    .dest-divider {
      border-bottom: 1px solid #e2e8f0;
    }
    .memo-body {
      text-align: justify;
      line-height: 1.6;
      font-size: 10pt;
      color: #1e293b;
    }
    .memo-body p {
      margin-bottom: 12px;
    }
    .section-title {
      font-size: 9.5pt;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 16px;
      margin-bottom: 6px;
    }
    .clause-box {
      background: #fafaf9;
      border: 1px solid #e7e5e4;
      border-left: 3px solid #64748b;
      padding: 11px 14px;
      margin: 10px 0 14px 0;
      color: #292524;
      font-size: 9pt;
      line-height: 1.5;
    }
    .amount-box {
      background: #fff1f2;
      border: 1px solid #fecdd3;
      border-radius: 6px;
      padding: 12px 16px;
      margin: 14px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .amount-label {
      font-size: 9.5pt;
      font-weight: 700;
      color: #9f1239;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .amount-value {
      font-size: 15pt;
      font-weight: 800;
      color: #9f1239;
      font-family: monospace;
    }
    .signatures-section {
      margin-top: 48px;
      page-break-inside: avoid;
    }
    .signatures-grid {
      display: table;
      width: 100%;
    }
    .sig-col {
      display: table-cell;
      width: 48%;
      vertical-align: top;
      text-align: center;
    }
    .sig-col-spacing {
      display: table-cell;
      width: 4%;
    }
    .sig-line {
      border-top: 1.5px solid #0f172a;
      margin: 0 12px 8px 12px;
    }
    .sig-name {
      font-weight: 700;
      font-size: 9.5pt;
      color: #0f172a;
    }
    .sig-title {
      font-size: 8pt;
      color: #475569;
      margin-top: 2px;
    }
    .sig-id {
      font-size: 8pt;
      color: #64748b;
      margin-top: 2px;
      font-family: monospace;
    }
    .doc-footer {
      margin-top: 36px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      font-size: 7.5pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="document-container">
    ${isCanceled ? '<div class="canceled-watermark">DESCUENTO ANULADO</div>' : ''}

    <!-- ENCABEZADO INSTITUCIONAL -->
    ${buildDocumentHeader({
      organization: data.organization,
      organizationName: data.organizationName,
      documentCode: data.documentCode,
      issueDateFormatted,
      extraRight: isCanceled
        ? '<div class="doc-badge canceled">DESCUENTO ANULADO</div>'
        : '<div class="doc-badge">FALTANTE DE CAJA</div>',
    })}

    <!-- TÍTULO -->
    <section class="doc-title-section">
      <div class="doc-main-title">COMPROBANTE DE DESCUENTO POR FALTANTE DE CAJA</div>
      <div class="doc-sub-title">Registro de auditoría y control económico interno</div>
    </section>

    <!-- TABLA DESTINATARIO -->
    <table class="dest-table">
      <tr class="dest-divider">
        <td class="dest-label">COLABORADOR:</td>
        <td class="dest-val"><strong>${data.employeeName}</strong></td>
        <td class="dest-label">C.I.:</td>
        <td class="dest-val font-mono">${data.nationalId || '—'}</td>
      </tr>
      <tr class="dest-divider">
        <td class="dest-label">CARGO:</td>
        <td class="dest-val">${data.position}</td>
        <td class="dest-label">DEPARTAMENTO:</td>
        <td class="dest-val">${data.department}</td>
      </tr>
      <tr class="dest-divider">
        <td class="dest-label">FECHA DE LA CAJA:</td>
        <td class="dest-val" colspan="3"><strong>${cashDateFormatted}</strong></td>
      </tr>
      <tr>
        <td class="dest-label">SE DESCONTARÁ EN:</td>
        <td class="dest-val" colspan="3"><strong>Rol de ${MONTH_NAMES[data.periodMonth || 0] || '—'} de ${data.periodYear || '—'}</strong></td>
      </tr>
    </table>

    <!-- CUERPO -->
    <article class="memo-body">
      <p>
        Se deja constancia del faltante identificado en el cuadre / arqueo de caja correspondiente al colaborador <strong>${data.employeeName}</strong>, con Cédula de Identidad N° <strong>${data.nationalId || '__________'}</strong>, según el detalle a continuación.
      </p>

      <div class="amount-box">
        <span class="amount-label">Valor a Descontar</span>
        <span class="amount-value">$${data.amount.toFixed(2)} USD</span>
      </div>

      <div class="section-title">MOTIVO DEL FALTANTE</div>
      <p style="font-style: italic; color: #334155; margin-bottom: 12px;">
        "${data.reason}"
      </p>

      <div class="section-title">AUTORIZACIÓN DE DESCUENTO (CÓDIGO DEL TRABAJO ART. 90)</div>
      <div class="clause-box">
        <strong>AUTORIZACIÓN DE DESCUENTO POR FALTANTE:</strong> De conformidad con la legislación laboral ecuatoriana y el reglamento interno de trabajo, el valor detallado será deducido de la remuneración mensual del colaborador correspondiente al período en que se emite el presente comprobante.
      </div>
    </article>

    <!-- FIRMAS -->
    <footer class="signatures-section">
      <div class="signatures-grid">
        <div class="sig-col">
          <div style="height: 52px;"></div>
          <div class="sig-line"></div>
          <div class="sig-name">${data.employeeName}</div>
          <div class="sig-title">Colaborador(a)</div>
          <div class="sig-id">C.I.: ${data.nationalId || '____________________'}</div>
        </div>
        <div class="sig-col-spacing"></div>
        <div class="sig-col">
          <div style="height: 52px;"></div>
          <div class="sig-line"></div>
          <div class="sig-name">GERENCIA / TALENTO HUMANO</div>
          <div class="sig-title">${orgLegalName}</div>
          <div class="sig-id">Responsable del Registro</div>
        </div>
      </div>

      <div class="doc-footer">
        <span>Sistema de Nómina y Talento Humano RH Garden</span>
        <span>Original: Contabilidad / Copia: Empleado</span>
      </div>
    </footer>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`

  printWindow.document.open()
  printWindow.document.write(htmlContent)
  printWindow.document.close()
}
