'use client'

import { Organization } from '@/types/employee'
import { DeliveryAssetItem, INCIDENT_TYPE_OPTIONS } from './constants'
import { buildDocumentHeader, DOCUMENT_HEADER_STYLES } from '@/lib/print/document-header'
import { buildDocumentSignatures, DOCUMENT_SIGNATURES_STYLES } from '@/lib/print/document-signatures'
import { openPrintWindow, resolveApproverStatus, shiftAccentHex } from '@/lib/print/document-shell'

export interface PrintDeliveryActData {
  organization?: Partial<Organization> | null
  organizationName?: string
  employeeName: string
  nationalId: string
  /** @deprecated Ya no se muestra en el acta de entrega. */
  department?: string
  position: string
  deliveryDate: string
  issueDate?: string
  items: DeliveryAssetItem[]
  totalAmount: number
  totalItemsCount: number
  notes?: string
  discountAgreementAccepted: boolean
  discountDisclaimerText: string
  deliveredByName?: string
  deliveredByPosition?: string
  status?: string
  resolvedAt?: string
  documentCode?: string
  /** Color de acento del tipo de documento (hex). Por defecto el de "acta_entrega". */
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

export function printDeliveryActDocument(data: PrintDeliveryActData) {
  const org = data.organization || {}
  const orgName = org.name || data.organizationName || 'RH Garden'
  const orgLegalName = org.legal_name || orgName
  const orgCity = org.city || 'Quito'

  const isCanceled = data.status === 'anulado'
  const accentHex =
    data.accentHex || shiftAccentHex(INCIDENT_TYPE_OPTIONS, 'acta_entrega', '#4f46e5')
  const approverStatus = resolveApproverStatus(data.status, data.resolvedAt, {
    approved: 'Conforme',
    rejected: 'Anulado',
  })
  const deliveryDateFormatted = formatLongDate(data.deliveryDate)
  const issueDateFormatted = data.issueDate ? formatLongDate(data.issueDate) : deliveryDateFormatted

  const itemsRows = (data.items || [])
    .map((item, idx) => {
      const catLabel =
        item.category === 'uniformes'
          ? 'Uniforme'
          : item.category === 'herramientas'
          ? 'Herramienta'
          : item.category === 'equipos_tecnologicos'
          ? 'Tecnología'
          : item.category === 'seguridad_epp'
          ? 'EPP'
          : item.category === 'inventario_mobiliario'
          ? 'Mobiliario/Activo'
          : 'General'

      return `
        <tr>
          <td style="text-align: center; font-weight: 600;">${idx + 1}</td>
          <td>
            <strong>${item.description}</strong>
            ${item.serialOrCode ? `<div style="font-size: 10px; color: #475569; font-family: monospace;">Serie/Cód: ${item.serialOrCode}</div>` : ''}
          </td>
          <td style="font-size: 10.5px; color: #334155;">${catLabel}</td>
          <td style="text-align: center; text-transform: capitalize; font-size: 10.5px;">${item.condition}</td>
          <td style="text-align: center; font-weight: 700; font-family: monospace;">${item.quantity}</td>
          <td style="text-align: right; font-family: monospace;">$${Number(item.unitValue || 0).toFixed(2)}</td>
          <td style="text-align: right; font-weight: 700; font-family: monospace;">$${Number(item.totalValue || 0).toFixed(2)}</td>
        </tr>
      `
    })
    .join('')

  const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Acta Entrega-Recepción - ${data.employeeName} - ${data.documentCode || 'ACT'}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 18mm 18mm 18mm 18mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #fff;
            margin: 0;
            padding: 10px 15px;
            font-size: 11.5px;
            line-height: 1.55;
          }

          ${DOCUMENT_HEADER_STYLES}
          ${DOCUMENT_SIGNATURES_STYLES}
          :root { --doc-accent: ${accentHex}; }

          /* MARCA DE AGUA ANULADO */
          .watermark-canceled {
            position: fixed;
            top: 40%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-30deg);
            font-size: 85px;
            font-weight: 900;
            color: rgba(239, 68, 68, 0.14);
            border: 8px dashed rgba(239, 68, 68, 0.25);
            padding: 15px 50px;
            border-radius: 20px;
            pointer-events: none;
            z-index: 9999;
            letter-spacing: 4px;
          }


          /* DATOS DE LAS PARTES (SIN TABLA) */
          .party-info {
            display: flex;
            gap: 40px;
            margin-bottom: 14px;
            font-size: 11px;
            line-height: 1.7;
          }
          .party-col {
            flex: 1;
          }
          .party-label {
            font-weight: 700;
            color: #334155;
            text-transform: uppercase;
            font-size: 9.5px;
            letter-spacing: 0.3px;
          }

          /* TABLA DE ÍTEMS */
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0 16px 0;
          }
          .items-table th, .items-table td {
            border: 1px solid #cbd5e1;
            padding: 6px 8px;
            font-size: 11px;
          }
          .items-table th {
            background: #f1f5f9;
            color: #1e293b;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 9.5px;
            letter-spacing: 0.3px;
          }

          /* PÁRRAFOS LEGALES */
          .body-p {
            text-align: justify;
            margin-bottom: 11px;
            color: #1e293b;
          }
          .legal-box {
            background: #f8fafc;
            border: 1px solid #c2ccd8;
            border-left: 3px solid var(--doc-accent, #4f46e5);
            padding: 10px 12px;
            margin: 12px 0;
            font-size: 10.5px;
            line-height: 1.5;
            color: #1e293b;
          }
          .legal-box strong {
            color: var(--doc-accent, #1e1b4b);
          }

          .footer-note {
            margin-top: 30px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
            font-size: 9px;
            color: #94a3b8;
            text-align: center;
          }
        </style>
      </head>
      <body>
        ${isCanceled ? '<div class="watermark-canceled">ANULADO</div>' : ''}

        <!-- ENCABEZADO OFICIAL -->
        ${buildDocumentHeader({
          organization: data.organization,
          organizationName: data.organizationName,
          documentCode: data.documentCode,
          issueDateFormatted,
          accentColor: accentHex,
          docTypeTitle: 'Acta de Entrega-Recepción de Bienes',
        })}

        <!-- DATOS DEL COLABORADOR Y RECEPCIÓN -->
        <div class="party-info">
          <div class="party-col">
            <div><span class="party-label">Colaborador:</span> <strong>${data.employeeName.toUpperCase()}</strong></div>
            <div><span class="party-label">Cédula:</span> ${data.nationalId || '—'}</div>
            <div><span class="party-label">Cargo:</span> ${data.position || '—'}</div>
          </div>
          <div class="party-col">
            <div><span class="party-label">Fecha de Entrega:</span> ${deliveryDateFormatted}</div>
            <div><span class="party-label">Entregado por:</span> ${data.deliveredByName || 'Talento Humano / Bodega'}</div>
          </div>
        </div>

        <!-- PÁRRAFO INTRODUCTORIO -->
        <div class="body-p">
          En la ciudad de <strong>${orgCity}</strong>, en la fecha indicada, comparecen por una parte <strong>${orgLegalName}</strong> en calidad de empleador; y por otra parte el/la colaborador(a) <strong>${data.employeeName}</strong>, con la finalidad de formalizar la entrega-recepción de los implementos de trabajo, indumentaria, equipos o herramientas que se detallan a continuación, los mismos que son asignados en perfecto estado operativo para el exclusivo desempeño de sus funciones laborales.
        </div>

        <!-- TABLA DE BIENES ENTREGADOS -->
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 5%;">#</th>
              <th style="width: 38%;">Descripción / Detalle del Bien</th>
              <th style="width: 17%;">Categoría</th>
              <th style="width: 10%;">Estado</th>
              <th style="width: 8%;">Cant.</th>
              <th style="width: 11%;">V. Unit.</th>
              <th style="width: 11%;">V. Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
          <tfoot>
            <tr style="background: #f8fafc; font-size: 11.5px;">
              <td colspan="4" style="text-align: right; font-weight: 800; text-transform: uppercase;">
                Total Activos / Implementos (${data.totalItemsCount || data.items?.length} unidades):
              </td>
              <td style="text-align: center; font-weight: 800; font-family: monospace;">
                ${data.totalItemsCount || data.items?.reduce((a, b) => a + (Number(b.quantity) || 1), 0)}
              </td>
              <td style="text-align: right; font-weight: 800;">VALOR TOTAL:</td>
              <td style="text-align: right; font-weight: 900; font-family: monospace; color: ${accentHex};">
                $${Number(data.totalAmount || 0).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>

        ${
          data.notes
            ? `<div style="font-size: 10.5px; color: #334155; margin-bottom: 12px; background: #fff; border: 1px solid #e2e8f0; padding: 8px 10px; border-radius: 4px;">
                <strong>Observaciones / Especificaciones adicionales:</strong> ${data.notes}
              </div>`
            : ''
        }

        <!-- OBLIGACIONES Y CLÁUSULA DE CUSTODIA -->
        <div class="body-p">
          El trabajador declara haber recibido los bienes detallados a entera satisfacción, en perfecto estado de funcionamiento, aseo y conservación. El trabajador se obliga a:
          <strong>1)</strong> Utilizar los bienes, uniformes y herramientas únicamente para los fines propios del trabajo;
          <strong>2)</strong> Cumplir con las normas de seguridad e higiene industrial;
          <strong>3)</strong> No ceder, transferir ni prestar dichos activos a terceras personas no autorizadas; y,
          <strong>4)</strong> Restituir inmediatamente los mismos a la empresa a la terminación de la relación laboral o en el momento en que la jefatura lo requiera.
        </div>

        <!-- CLÁUSULA LEGAL DE DESCUENTO EN CASO DE PÉRDIDA O DAÑO (Art. 44 lit. f Código del Trabajo) -->
        <div class="legal-box">
          <strong>AUTORIZACIÓN EXPRESA DE DESCUENTO POR PÉRDIDA O DETERIORO CULPOSO (CÓDIGO DEL TRABAJO):</strong><br />
          ${data.discountDisclaimerText ||
            'De conformidad con el Artículo 44 literal f) del Código del Trabajo de la República del Ecuador y el Reglamento Interno de la empresa, el trabajador asume la custodia, conservación y cuidado diligente de los bienes y herramientas detallados en la presente acta. En caso de pérdida, extravío, daño o deterioro imputable a negligencia, descuido grave o uso indebido de los mismos, el colaborador autoriza expresamente a la empresa para que el valor de reposición o reparación de los bienes sea descontado de su rol de pago o liquidación final.'}
        </div>

        <div class="body-p" style="font-size: 10.5px; color: #475569;">
          En fe de conformidad, aceptación de las condiciones y para constancia de la entrega material de los bienes descritos, las partes suscriben el presente documento por duplicado en el lugar y fecha indicados.
        </div>

        <!-- FIRMAS -->
        ${buildDocumentSignatures({
          employeeName: data.employeeName,
          approverName: (data.deliveredByName || 'Talento Humano / Bodega'),
          approverRole: `${orgLegalName} — ${data.deliveredByPosition || 'Entrega formal de activos'}`,
          employeeRole: 'Colaborador — Recibe conforme y acepta cláusula de descuento',
          approverStatusNote: approverStatus.note,
          approverStatusDate: approverStatus.date,
        })}

        <div class="footer-note">
          Original: Expediente Laboral • Copia: Colaborador Receptor • ${orgLegalName}
        </div>

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

  openPrintWindow(html)
}
