'use client'

import { Organization } from '@/types/employee'
import { SalaryAdvanceInstallment } from './actions'
import { INCIDENT_TYPE_OPTIONS } from './constants'
import { buildDocumentHeader, DOCUMENT_HEADER_STYLES } from '@/lib/print/document-header'
import { buildDocumentSignatures, DOCUMENT_SIGNATURES_STYLES } from '@/lib/print/document-signatures'
import { openPrintWindow, resolveApproverStatus, shiftAccentHex } from '@/lib/print/document-shell'

export interface PrintSalaryAdvanceData {
  organization?: Partial<Organization> | null
  organizationName?: string
  employeeName: string
  nationalId: string
  department: string
  position: string
  totalAmount: number
  modality: 'mes_actual' | 'cuotas'
  installmentsCount: number
  installmentAmount: number
  startMonth: number
  startYear: number
  schedule?: SalaryAdvanceInstallment[]
  requestDate?: string
  reason?: string
  status?: string
  resolvedAt?: string
  documentCode?: string
  /** Color de acento del tipo de documento (hex). Por defecto el de "anticipo_sueldo". */
  accentHex?: string
}

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

const MONTH_NAMES = [
  '',
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export function printSalaryAdvanceDocument(data: PrintSalaryAdvanceData) {
  const org = data.organization || {}
  const orgLegalName = org.legal_name || org.name || data.organizationName || 'RH Garden'

  const isCanceled = data.status === 'anulado'
  const accentHex =
    data.accentHex || shiftAccentHex(INCIDENT_TYPE_OPTIONS, 'anticipo_sueldo', '#2563eb')
  const approverStatus = resolveApproverStatus(data.status, data.resolvedAt)
  const requestDateFormatted = data.requestDate
    ? formatLongDate(data.requestDate)
    : formatLongDate(new Date().toISOString().split('T')[0])

  const count = data.installmentsCount || 1
  const schedule = data.schedule || []

  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Solicitud de Anticipo de Sueldo - ${data.employeeName}</title>
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
    /* ENCABEZADO */
    ${DOCUMENT_HEADER_STYLES}
    ${DOCUMENT_SIGNATURES_STYLES}
    .doc-type-title { font-size: 15pt; }
    /* CUERPO */
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
    /* TABLA DE CUOTAS */
    .schedule-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0 16px 0;
      font-size: 9pt;
    }
    .schedule-table th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 8pt;
      letter-spacing: 0.5px;
      border: 1px solid #cbd5e1;
      padding: 6px 10px;
      text-align: left;
    }
    .schedule-table td {
      border: 1px solid #e2e8f0;
      padding: 6px 10px;
      color: #334155;
    }
    .schedule-table tr:nth-child(even) {
      background: #f8fafc;
    }
    .total-row {
      font-weight: 700;
      background: #f1f5f9 !important;
      color: #0f172a;
    }
    /* CAJA DE HECHOS / CLÁUSULA */
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
    /* FIRMAS */
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
    ${isCanceled ? '<div class="canceled-watermark">SOLICITUD ANULADA</div>' : ''}

    <!-- ENCABEZADO INSTITUCIONAL -->
    ${buildDocumentHeader({
      organization: data.organization,
      organizationName: data.organizationName,
      documentCode: data.documentCode,
      issueDateFormatted: requestDateFormatted,
      accentColor: accentHex,
      docTypeTitle: 'Solicitud de Anticipo de Sueldo',
    })}

    <!-- CUERPO -->
    <article class="memo-body">
      <p>
        Por medio del presente documento, el/la colaborador/a <strong>${data.employeeName}</strong>,
        con cédula de identidad <strong>${data.nationalId || '—'}</strong>, quien se desempeña como
        <strong>${data.position || '—'}</strong> en el departamento de
        <strong>${data.department || '—'}</strong>, solicita a la Gerencia / Dirección de Talento
        Humano de <strong>${orgLegalName}</strong> la concesión de un anticipo de sueldo por un valor
        total de <strong>$${data.totalAmount.toFixed(2)} USD</strong>, a descontarse en
        <strong>${count === 1 ? 'una sola cuota' : `${count} cuotas mensuales`}</strong> conforme al
        cronograma que se detalla a continuación.
      </p>

      ${
        data.reason
          ? `<p><strong>Motivo declarado:</strong> ${data.reason}</p>`
          : ''
      }

      <div class="section-title">Cronograma de Deducciones en Rol de Pagos</div>
      <table class="schedule-table">
        <thead>
          <tr>
            <th style="width: 15%;">Cuota</th>
            <th style="width: 45%;">Período / Rol de Pagos</th>
            <th style="width: 40%; text-align: right;">Valor a Descontar</th>
          </tr>
        </thead>
        <tbody>
          ${schedule.map((inst) => `
          <tr>
            <td>Cuota ${inst.installment_number}</td>
            <td>${MONTH_NAMES[inst.month] || inst.month} de ${inst.year}</td>
            <td style="text-align: right; font-family: monospace; font-weight: 600;">$${Number(inst.amount).toFixed(2)} USD</td>
          </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="2">TOTAL AMORTIZACIÓN PROGRAMADA</td>
            <td style="text-align: right; font-family: monospace; font-weight: 700;">$${data.totalAmount.toFixed(2)} USD</td>
          </tr>
        </tbody>
      </table>

      <div class="section-title">Autorización Expresa de Descuento (Código del Trabajo, Art. 90)</div>
      <div class="clause-box">
        <strong>Autorización voluntaria de descuento:</strong> De conformidad con la legislación
        laboral ecuatoriana, el colaborador autoriza de manera expresa, libre y voluntaria a
        <strong>${orgLegalName}</strong> para que deduzca de sus remuneraciones mensuales y/o
        quincenales el valor total del anticipo aquí detallado, hasta su total liquidación. En caso
        de terminación de la relación laboral por cualquier causa antes de completarse el descuento,
        autoriza descontar el saldo pendiente de su liquidación final de haberes.
      </div>
    </article>

    <!-- FIRMAS -->
    ${buildDocumentSignatures({
      employeeName: data.employeeName,
      approverName: 'Gerencia / Talento Humano',
      approverRole: 'Firma y Sello — Aprueba',
      employeeRole: 'Firma del Colaborador — Solicita y autoriza descuento',
      approverStatusNote: approverStatus.note,
      approverStatusDate: approverStatus.date,
    })}

    <div class="doc-footer">
      <span>Sistema de Nómina y Talento Humano — ${orgLegalName}</span>
      <span>Original: Contabilidad / Copia: Empleado</span>
    </div>
  </div>

  <script>
    window.onload = function() {
      window.focus();
      window.print();
      setTimeout(function() { window.close(); }, 1000);
    };
  </script>
</body>
</html>`

  openPrintWindow(htmlContent)
}
