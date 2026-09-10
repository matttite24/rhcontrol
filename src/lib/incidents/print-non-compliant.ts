'use client'

import { Organization } from '@/types/employee'
import { INCIDENT_TYPE_OPTIONS } from './constants'
import { buildDocumentHeader, DOCUMENT_HEADER_STYLES } from '@/lib/print/document-header'
import { buildDocumentSignatures, DOCUMENT_SIGNATURES_STYLES } from '@/lib/print/document-signatures'
import { openPrintWindow, resolveApproverStatus, shiftAccentHex } from '@/lib/print/document-shell'

export interface PrintNonCompliantData {
  organization?: Partial<Organization> | null
  organizationName?: string
  employeeName: string
  nationalId: string
  department: string
  position: string
  incidentDate: string
  issueDate?: string
  categoryTitle: string
  detailedDescription: string
  immediateCorrection?: string
  legalReference?: string
  consecutiveCount?: number
  status?: string
  resolvedAt?: string
  documentCode?: string
  /** Color de acento del tipo de documento (hex). Por defecto el de "actividad_no_conforme". */
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

export function printNonCompliantDocument(data: PrintNonCompliantData) {
  const org = data.organization || {}
  const orgLegalName = org.legal_name || org.name || data.organizationName || 'RH Garden'

  const isCanceled = data.status === 'anulado'
  const accentHex =
    data.accentHex || shiftAccentHex(INCIDENT_TYPE_OPTIONS, 'actividad_no_conforme', '#d97706')
  const approverStatus = resolveApproverStatus(data.status, data.resolvedAt, {
    approved: 'Registrado',
    rejected: 'Anulado',
  })
  const issueDateFormatted = data.issueDate ? formatLongDate(data.issueDate) : formatLongDate(new Date().toISOString().split('T')[0])
  const incidentDateFormatted = formatLongDate(data.incidentDate)
  const count = data.consecutiveCount || 1

  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Actividad No Conforme - ${data.employeeName}</title>
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
    :root { --doc-accent: ${accentHex}; }
    .doc-type-title { font-size: 15pt; margin-bottom: 6px; }
    .incident-counter {
      text-align: center;
      font-size: 9.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--doc-accent, #d97706);
      margin-bottom: 18px;
    }
    /* TABLA DE DESTINATARIO */
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
      width: 120px;
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
    /* CUERPO */
    .memo-body {
      text-align: justify;
      line-height: 1.6;
      font-size: 10pt;
      color: #1e293b;
    }
    .memo-body p {
      margin-bottom: 13px;
    }
    .section-title {
      font-size: 9.5pt;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 18px;
      margin-bottom: 6px;
      padding-left: 0;
    }
    /* CAJA DE DETALLE */
    .facts-box {
      background: #fafaf9;
      border: 1px solid #e7e5e4;
      border-left: 3px solid #64748b;
      padding: 12px 14px;
      margin: 10px 0 14px 0;
      font-style: italic;
      color: #292524;
      font-size: 9.5pt;
      line-height: 1.5;
    }
    /* AVISO DE ACUMULACIÓN REITERATIVA */
    .accumulation-warning {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 10px 12px;
      margin: 14px 0;
      font-size: 9pt;
      color: #78350f;
      line-height: 1.45;
    }
    .accumulation-warning strong {
      color: #92400e;
    }
    /* CITAS LEGALES */
    .legal-quote {
      font-family: Georgia, "Times New Roman", Times, serif;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #475569;
      padding: 10px 14px;
      margin: 12px 0;
      font-size: 9pt;
      color: #334155;
      line-height: 1.5;
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
    ${isCanceled ? '<div class="canceled-watermark">REGISTRO ANULADO</div>' : ''}

    <!-- ENCABEZADO INSTITUCIONAL -->
    ${buildDocumentHeader({
      organization: data.organization,
      organizationName: data.organizationName,
      documentCode: data.documentCode,
      issueDateFormatted,
      accentColor: accentHex,
      docTypeTitle: 'Registro de Actividad No Conforme',
    })}

    <div class="incident-counter">Incidencia N° ${count} de 3 (Tolerancia)</div>

    <!-- TABLA DESTINATARIO -->
    <table class="dest-table">
      <tr class="dest-divider">
        <td class="dest-label">PARA:</td>
        <td class="dest-val"><strong>${data.employeeName}</strong></td>
        <td class="dest-label">C.I. / R.U.C.:</td>
        <td class="dest-val font-mono">${data.nationalId || '—'}</td>
      </tr>
      <tr class="dest-divider">
        <td class="dest-label">CARGO:</td>
        <td class="dest-val">${data.position}</td>
        <td class="dest-label">ÁREA / DEPTO:</td>
        <td class="dest-val">${data.department}</td>
      </tr>
      <tr class="dest-divider">
        <td class="dest-label">FECHA EVENTO:</td>
        <td class="dest-val">${incidentDateFormatted}</td>
        <td class="dest-label">ESTADO:</td>
        <td class="dest-val"><strong>${isCanceled ? 'ANULADO' : 'REGISTRADO'}</strong></td>
      </tr>
      <tr>
        <td class="dest-label">ASUNTO:</td>
        <td class="dest-val" colspan="3"><strong>${data.categoryTitle}</strong></td>
      </tr>
    </table>

    <!-- CUERPO -->
    <article class="memo-body">
      <p>
        Por medio del presente documento, la Administración deja constancia formal del desvío operativo detectado en el desempeño de sus actividades asignadas, el cual no guarda conformidad con los procedimientos establecidos en la organización.
      </p>

      <div class="section-title">1. DESCRIPCIÓN DE LA ACTIVIDAD NO CONFORME</div>
      <div class="facts-box">
        "${data.detailedDescription}"
      </div>

      ${data.immediateCorrection ? `
      <div class="section-title">2. ACCIÓN CORRECTIVA INMEDIATA / COMPROMISO ADOPTADO</div>
      <p>
        Ante lo suscitado, se establece la siguiente acción correctiva de ejecución inmediata:
      </p>
      <div class="facts-box">
        "${data.immediateCorrection}"
      </div>
      ` : ''}

      <div class="section-title">${data.immediateCorrection ? '3' : '2'}. FUNDAMENTO LEGAL Y REGULATORIO APLICABLE</div>
      <div class="legal-quote">
        <strong>${data.legalReference || 'Reglamento Interno de Trabajo'}:</strong><br>
        El colaborador tiene la obligación de cumplir a cabalidad las órdenes e instrucciones impartidas, mantener el debido cuidado de bienes, respetar los horarios y registros biométricos, y velar por los estándares de calidad, higiene y servicio al cliente.
      </div>

      <!-- ADVERTENCIA DE ACUMULACIÓN (REGLA DE 3 INCIDENCIAS) -->
      <div class="accumulation-warning">
        <strong>AVISO DE CONTROL Y SEGUIMIENTO DISCIPLINARIO:</strong><br>
        Este registro constituye una observación operativa de carácter preventivo. De conformidad con las políticas internas de la organización, la reiteración acumulativa de <strong>tres (3) actividades no conformes</strong> facultará a la empresa para emitir un <strong>Llamado de Atención Escrito</strong> formal con copia al expediente laboral, de conformidad con el Art. 44 y 64 del Código del Trabajo del Ecuador.
      </div>

      <p style="margin-top: 14px;">
        Se extiende la presente para constancia del archivo de gestión operativa y compromiso de mejora en sus actividades.
      </p>
    </article>

    <!-- SECCIÓN DE FIRMAS -->
    ${buildDocumentSignatures({
      employeeName: data.employeeName,
      approverName: 'Administración / Talento Humano',
      approverRole: `${orgLegalName} — Emisor responsable`,
      employeeRole: 'Colaborador — Notificado',
      approverStatusNote: approverStatus.note,
      approverStatusDate: approverStatus.date,
    })}

    <div class="doc-footer">
      <span>Sistema de Gestión de Personal — ${orgLegalName}</span>
      <span>Original: Archivo Operativo / Copia: Colaborador</span>
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
