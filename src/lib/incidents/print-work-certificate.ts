'use client'

import { Organization } from '@/types/employee'
import { INCIDENT_TYPE_OPTIONS } from './constants'
import { buildDocumentHeader, resolveOrgHeaderFields } from '@/lib/print/document-header'
import { DOCUMENT_SHELL_STYLES, shiftAccentHex } from '@/lib/print/document-shell'

export interface PrintWorkCertificateData {
  organization?: Partial<Organization> | null
  organizationName?: string
  employeeName: string
  nationalId: string
  department: string
  position: string
  hireDate: string
  terminationDate?: string | null // null/undefined = sigue laborando actualmente
  seniorityLabel: string // ej. "3 años, 4 meses"
  purpose?: string
  issuedByName?: string
  issuedByPosition?: string
  documentCode?: string
  /** Color de acento del tipo de documento (hex). Por defecto el de "certificado_trabajo". */
  accentHex?: string
}

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function formatLongDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  const dateObj = new Date(y, m - 1, d)
  return `${dateObj.getDate()} de ${MONTHS[dateObj.getMonth()]} de ${dateObj.getFullYear()}`
}

/**
 * Devuelve `true` si logró abrir la ventana de impresión, `false` si el
 * navegador bloqueó el popup (para que el wizard pueda avisar al usuario en
 * vez de fallar en silencio: `window.print()` de la página actual imprimiría
 * el propio wizard, no el certificado, así que no sirve como fallback real).
 */
export function printWorkCertificateDocument(data: PrintWorkCertificateData): boolean {
  const printWindow = window.open('', '_blank', 'width=850,height=950')
  if (!printWindow) {
    return false
  }

  const { orgName } = resolveOrgHeaderFields(data.organization, data.organizationName)
  const issueDateFormatted = formatLongDate(new Date().toISOString().split('T')[0])
  const accentHex =
    data.accentHex || shiftAccentHex(INCIDENT_TYPE_OPTIONS, 'certificado_trabajo', '#0891b2')

  const isActive = !data.terminationDate

  const relationText = isActive
    ? `desde el ${formatLongDate(data.hireDate)} hasta la presente fecha, laborando de manera activa e ininterrumpida`
    : `desde el ${formatLongDate(data.hireDate)} hasta el ${formatLongDate(data.terminationDate)}, fecha en la cual concluyó su relación laboral con la empresa`

  const now = new Date()
  const issuePhrase = `a los ${now.getDate()} días del mes de ${MONTHS[now.getMonth()]} de ${now.getFullYear()}`

  const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Certificado de Trabajo - ${data.employeeName}</title>
        <style>
          ${DOCUMENT_SHELL_STYLES}
          :root { --doc-accent: ${accentHex}; }
          .doc-type-title {
            font-size: 19px;
            letter-spacing: 1px;
          }
          .cert-heading {
            text-align: center;
            font-size: 13px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #1a1a1a;
            margin: 26px 0 20px;
          }
          .sign-single {
            display: flex;
            justify-content: center;
            margin-top: 75px;
          }
          .sign-single-box {
            text-align: center;
            border-top: 1px solid #1a1a1a;
            padding-top: 6px;
            width: 280px;
          }
          .sign-single-name {
            font-size: 11px;
            font-weight: 700;
            color: #1a1a1a;
          }
          .sign-single-role {
            font-size: 10px;
            color: #555;
          }
        </style>
      </head>
      <body>
        ${buildDocumentHeader({
          organization: data.organization,
          organizationName: data.organizationName,
          documentCode: data.documentCode,
          issueDateFormatted,
          accentColor: accentHex,
          docTypeTitle: 'Certificado de Trabajo',
        })}

        <div class="cert-heading">A quien pueda interesar</div>

        <p class="body-text">
          Por medio de la presente, <strong>${orgName}</strong> certifica que
          <strong>${data.employeeName}</strong>, portador(a) de la cédula de identidad
          N° <strong>${data.nationalId || '—'}</strong>, ha prestado (o presta) sus servicios
          para esta institución desempeñando el cargo de <strong>${data.position || '—'}</strong>
          en el departamento de <strong>${data.department || '—'}</strong>, ${relationText},
          acumulando un tiempo de servicio de <strong>${data.seniorityLabel}</strong>.
        </p>

        <p class="body-text">
          El presente certificado se expide ${
            data.purpose
              ? `para <strong>${data.purpose}</strong>`
              : 'a solicitud de la parte interesada'
          }, ${issuePhrase}.
        </p>

        <div class="sign-single">
          <div class="sign-single-box">
            <div class="sign-single-name">${data.issuedByName || 'Talento Humano / Gerencia'}</div>
            <div class="sign-single-role">${data.issuedByPosition || 'Jefatura Inmediata / Recursos Humanos'}</div>
          </div>
        </div>

        <div class="footer-note">
          Documento oficial • ${orgName} • Control de Nómina y Asistencia
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

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  return true
}
