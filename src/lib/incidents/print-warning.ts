'use client'

import { Organization } from '@/types/employee'
import { WarningSeverity, INCIDENT_TYPE_OPTIONS } from './constants'
import { buildDocumentHeader } from '@/lib/print/document-header'
import {
  DOCUMENT_SHELL_STYLES,
  openPrintWindow,
  shiftAccentHex,
} from '@/lib/print/document-shell'

export interface PrintWarningLetterData {
  organization?: Partial<Organization> | null
  organizationName?: string
  employeeName: string
  nationalId: string
  department: string
  position: string
  hireDate?: string | null
  severity: WarningSeverity
  incidentDate: string
  issueDate?: string
  regulationArticle: string
  infractionTitle: string
  detailedDescription: string
  correctiveCommitment?: string
  consequencesWarning?: string
  status?: string
  documentCode?: string
  /** Color de acento del tipo de documento (hex). Por defecto el de "llamado_atencion". */
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

export function printWarningLetterDocument(data: PrintWarningLetterData) {
  const org = data.organization || {}
  const orgName = org.name || data.organizationName || 'RH Garden'
  const orgLegalName = org.legal_name || orgName

  const isWritten = data.severity === 'escrito'
  const isCanceled = data.status === 'anulado'
  const accentHex =
    data.accentHex || shiftAccentHex(INCIDENT_TYPE_OPTIONS, 'llamado_atencion', '#e11d48')

  const memoTitle = isWritten
    ? 'MEMORANDO DISCIPLINARIO DE AMONESTACIÓN ESCRITA'
    : 'MEMORANDO DE AMONESTACIÓN VERBAL (CONSTANCIA)'
  const severityColor = isCanceled ? '#64748b' : isWritten ? '#dc2626' : '#d97706'

  const issueDateFormatted = data.issueDate ? formatLongDate(data.issueDate) : formatLongDate(new Date().toISOString().split('T')[0])
  const incidentDateFormatted = formatLongDate(data.incidentDate)

  // Citas legales exactas según amonestación verbal vs escrita en Ecuador
  const legalPenaltyText = isWritten
    ? 'De conformidad con el <strong>Artículo 64 del Código del Trabajo de la República del Ecuador</strong>, el empleador está facultado para sancionar disciplinariamente las faltas del trabajador con amonestaciones y multas previstas en el Reglamento Interno legalmente aprobado por el Ministerio del Trabajo, sin perjuicio de las causales de terminación de la relación laboral con visto bueno establecidas en el <strong>Artículo 172</strong> del referido cuerpo legal.'
    : 'En concordancia con los <strong>Artículos 44 (Obligaciones del trabajador) y 46 (Prohibiciones al trabajador) del Código del Trabajo</strong>, la presente medida constituye una amonestación verbal formal de carácter preventivo y correctivo, orientada a evitar la reincidencia en faltas que deriven en sanciones disciplinarias de mayor gravedad.'

  const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Oficio - Llamado de Atención - ${data.employeeName}</title>
        <style>
          ${DOCUMENT_SHELL_STYLES}
          :root { --doc-accent: ${accentHex}; }
          body { padding: 10px 24px; }

          /* MARCA DE ANULACIÓN SI APLICA */
          .watermark-canceled {
            border: 1.5px dashed #94a3b8;
            background-color: #f8fafc;
            color: #64748b;
            text-align: center;
            font-weight: 700;
            font-size: 11.5px;
            padding: 6px;
            margin-bottom: 18px;
            letter-spacing: 0.8px;
          }

          /* CIUDAD, FECHA Y TITULO DE MEMORANDO / OFICIO */
          .date-location {
            text-align: right;
            font-size: 12px;
            color: #334155;
            margin-bottom: 16px;
          }
          .memo-headline {
            text-align: center;
            font-size: 13.5px;
            font-weight: 800;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin-bottom: 20px;
            color: #0f172a;
          }

          /* ENCABEZADO OFICIAL DE DESTINATARIO (PARA / DE / ASUNTO) */
          .recipient-table {
            width: 100%;
            margin-bottom: 20px;
            border-collapse: collapse;
          }
          .recipient-table td {
            padding: 3px 0;
            vertical-align: top;
            font-size: 12px;
          }
          .recipient-table .col-label {
            width: 90px;
            font-weight: 700;
            color: #1e293b;
          }
          .recipient-table .col-sep {
            width: 15px;
            font-weight: 700;
            color: #475569;
          }
          .recipient-table .col-val {
            color: #0f172a;
          }

          .section-divider {
            border-top: 1px solid #e2e8f0;
            margin: 14px 0 18px 0;
          }

          /* CUERPO DEL OFICIO EN SANS */
          .salutation {
            margin-bottom: 14px;
            font-weight: 600;
            color: #0f172a;
          }
          .body-p {
            text-align: justify;
            margin-bottom: 14px;
            line-height: 1.65;
            color: #1e293b;
          }

          /* CITAS JURÍDICAS Y DE HECHOS EN SERIF (Georgia / Times) */
          .quote-serif {
            font-family: Georgia, "Times New Roman", Times, serif;
            font-style: italic;
            font-size: 13px;
            line-height: 1.6;
            margin: 14px 16px 16px 20px;
            padding-left: 14px;
            border-left: 3px solid #64748b;
            color: #0f172a;
            text-align: justify;
          }

          .legal-box-serif {
            font-family: Georgia, "Times New Roman", Times, serif;
            font-size: 12.5px;
            line-height: 1.6;
            margin: 14px 0;
            padding: 10px 14px;
            border-left: 3px solid ${severityColor};
            background: #fafaf9;
            color: #1c1917;
            text-align: justify;
          }

          /* FIRMAS FORMALES DE OFICIO */
          .signatures-area {
            width: 100%;
            margin-top: 45px;
            page-break-inside: avoid;
          }
          .signatures-table {
            width: 100%;
            border-collapse: collapse;
          }
          .signatures-table td {
            width: 50%;
            vertical-align: top;
            padding: 0 20px;
          }
          .sign-rule {
            border-top: 1px solid #334155;
            margin-bottom: 6px;
          }
          .sign-name {
            font-weight: 700;
            font-size: 12px;
            color: #0f172a;
          }
          .sign-title {
            font-size: 11px;
            color: #475569;
            line-height: 1.35;
          }

          .footer-note {
            text-align: left;
          }
        </style>
      </head>
      <body>
        <!-- ENCABEZADO DE DATOS DE LA EMPRESA (MEMBRETE OFICIAL) -->
        ${buildDocumentHeader({
          organization: data.organization,
          organizationName: data.organizationName,
          documentCode: data.documentCode,
          issueDateFormatted,
          accentColor: accentHex,
        })}

        ${
          isCanceled
            ? `<div class="watermark-canceled">
                AVISO: ESTE DOCUMENTO HA SIDO ANULADO Y CARECE DE VALIDEZ DISCIPLINARIA ACTIVA
              </div>`
            : ''
        }

        <!-- TÍTULO DEL OFICIO -->
        <div class="memo-headline">
          ${data.documentCode ? `${memoTitle} N° ${data.documentCode}` : memoTitle}
        </div>

        <!-- DATOS DEL DESTINATARIO Y ASUNTO -->
        <table class="recipient-table">
          <tr>
            <td class="col-label">PARA</td>
            <td class="col-sep">:</td>
            <td class="col-val">
              <strong>${data.employeeName.toUpperCase()}</strong><br />
              <span>${data.position || 'Colaborador'} — Departamento de ${data.department || 'Operaciones'}</span><br />
              <span style="font-size: 11px; color: #475569;">Cédula de Identidad: ${data.nationalId || '—'}</span>
            </td>
          </tr>
          <tr>
            <td class="col-label">DE</td>
            <td class="col-sep">:</td>
            <td class="col-val">
              <strong>TALENTO HUMANO / GERENCIA GENERAL</strong><br />
              <span>${orgLegalName}</span>
            </td>
          </tr>
          <tr>
            <td class="col-label">ASUNTO</td>
            <td class="col-sep">:</td>
            <td class="col-val">
              <strong>Llamado de atención por inobservancia a normas laborales y disciplinarias</strong>
            </td>
          </tr>
        </table>

        <div class="section-divider"></div>

        <!-- SALUDO -->
        <div class="salutation">
          Estimado/a colaborador/a:
        </div>

        <!-- PÁRRAFO 1: ANTECEDENTES Y FECHA -->
        <div class="body-p">
          Por medio de la presente, la Administración de <strong>${orgLegalName}</strong> cumple con notificarle formalmente que con fecha <strong>${incidentDateFormatted}</strong> se verificó la ocurrencia del siguiente hecho o conducta laboral:
        </div>

        <!-- CITA DE LOS HECHOS EN TIPOGRAFÍA SERIF -->
        <div class="quote-serif">
          "${data.detailedDescription}"
        </div>

        <!-- PÁRRAFO 2: CITAS DE LA LEY DE TRABAJO Y REGLAMENTO INTERNO -->
        <div class="body-p">
          La conducta anteriormente expuesta contraviene directamente las obligaciones laborales y reglamentarias que rigen la relación de trabajo, fundamentándose la presente amonestación en el marco legal vigente:
        </div>

        <!-- CITA LEGAL EN SERIF SEGÚN TIPO DE AMONESTACIÓN -->
        <div class="legal-box-serif">
          <strong>Marco Legal y Cláusula Citada:</strong> ${data.regulationArticle}<br /><br />
          ${legalPenaltyText}
        </div>

        ${
          data.correctiveCommitment
            ? `<div class="body-p">
                Asimismo, se toma debida constancia del compromiso correctivo asumido: <em>"${data.correctiveCommitment}"</em>, el cual deberá cumplirse de manera irrestricta.
              </div>`
            : ''
        }

        <!-- PÁRRAFO 3: ADVERTENCIA LEGAL DE REINCIDENCIA (Art. 172 Código del Trabajo) -->
        <div class="body-p">
          Se le exhorta a conducirse en lo posterior con estricto apego a las disposiciones legales, directrices de sus superiores y normativas de seguridad y orden de la empresa. Se le advierte formalmente que la <strong>reincidencia injustificada</strong> en faltas a los deberes laborales o el desacato reiterado al Reglamento Interno legalmente aprobado constituye causal para la terminación unilateral del contrato de trabajo mediante trámite de <strong>Visto Bueno ante el Inspector del Trabajo (Artículo 172, numerales 1 y 2 del Código del Trabajo)</strong>.
        </div>

        <div class="body-p">
          Para constancia de lo actuado y debida notificación personal, se suscribe el presente oficio, disponiéndose la entrega de una copia al trabajador y el archivo de un ejemplar en su expediente laboral.
        </div>

        <!-- DESPEDIDA -->
        <div style="margin-top: 18px; margin-bottom: 35px; font-weight: 600;">
          Atentamente,
        </div>

        <!-- FIRMAS DE OFICIO -->
        <div class="signatures-area">
          <table class="signatures-table">
            <tr>
              <!-- EMPRESA / EMISOR -->
              <td>
                <div class="sign-rule"></div>
                <div class="sign-name">TALENTO HUMANO / GERENCIA</div>
                <div class="sign-title">
                  ${orgLegalName}<br />
                  Empleador / Autoridad Emisora
                </div>
              </td>

              <!-- COLABORADOR / CONSTANCIA DE RECEPCIÓN -->
              <td>
                <div class="sign-rule"></div>
                <div class="sign-name">${data.employeeName.toUpperCase()}</div>
                <div class="sign-title">
                  C.I.: ${data.nationalId || '____________________'}<br />
                  Colaborador Notificado — Recepción
                </div>
              </td>
            </tr>
          </table>
        </div>

        <div class="footer-note">
          c.c. Expediente Personal del Trabajador • Archivo de Recursos Humanos • ${orgLegalName}
        </div>

        <script>
          window.onload = function() {
            window.focus();
            window.print();
            setTimeout(function() {
              window.close();
            }, 1000);
          };
        </script>
      </body>
    </html>
  `

  openPrintWindow(html)
}
