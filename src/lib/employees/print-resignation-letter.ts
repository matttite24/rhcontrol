'use client'

import { Organization } from '@/types/employee'
import { resolveOrgHeaderFields } from '@/lib/print/document-header'
import { DOCUMENT_SHELL_STYLES, formatLongDate, openPrintWindow } from '@/lib/print/document-shell'
import { buildEmployeeSignatureBlock } from '@/lib/employees/print-signature-block'

export interface PrintResignationLetterData {
  organization?: Partial<Organization> | null
  organizationName?: string
  employeeName: string
  nationalId: string
  position: string
  recipientName: string
  recipientPosition?: string
  resignationDate: string
  /** Fecha de emisión del documento (YYYY-MM-DD). Permite generar el documento de forma retroactiva. */
  issueDate?: string
  /** Solo si aplica un descuento por días no laborados calculados en un rol ya emitido. */
  hasPayrollDiscount: boolean
  discountDaysCount?: number
  discountPeriodStart?: string
  discountPeriodEnd?: string
  documentCode?: string
}

export function printResignationLetterDocument(data: PrintResignationLetterData) {
  const { orgLegalName } = resolveOrgHeaderFields(data.organization, data.organizationName)
  const city = data.organization?.city || 'Tena'
  const issueDate = data.issueDate ? new Date(`${data.issueDate}T00:00:00`) : new Date()
  const issueDateFormatted = issueDate.toLocaleDateString('es-EC', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const discountParagraph = data.hasPayrollDiscount
    ? `
      <p class="body-text">
        Asimismo, por medio del presente documento, <strong>autorizo expresamente a la empresa a
        realizar el descuento correspondiente a los ${data.discountDaysCount ?? ''} días no laborados</strong>
        ${data.discountPeriodStart && data.discountPeriodEnd
          ? `(del ${formatLongDate(data.discountPeriodStart)} al ${formatLongDate(data.discountPeriodEnd)})`
          : ''}, toda vez que por error involuntario en el procesamiento de la nómina, el rol de pagos
        fue calculado considerando el mes completo trabajado, cuando en realidad mi fecha efectiva de
        salida fue el ${formatLongDate(data.resignationDate)}.
      </p>

      <p class="body-text">
        En tal virtud, reconozco que el descuento indicado es justo y correcto, y libero a la empresa
        de cualquier responsabilidad al respecto.
      </p>
    `
    : ''

  const bodyHtml = `
    <div class="doc-type-title" style="--doc-header-accent:#0f172a;">Carta de Renuncia</div>

    <p class="body-text" style="text-align:right;">${city}, ${issueDateFormatted}</p>

    <p class="body-text" style="font-weight:700;margin-top:18px;margin-bottom:0;">Señor</p>
    <p class="body-text" style="font-weight:700;margin:0;">${data.recipientName}</p>
    ${data.recipientPosition ? `<p class="body-text" style="margin:0;">${data.recipientPosition}</p>` : ''}
    <p class="body-text" style="margin-top:0;">Presente.–</p>

    <p class="body-text" style="margin-top:18px;">De mi consideración:</p>

    <p class="body-text">
      Por medio de la presente, yo, <strong>${data.employeeName.toUpperCase()}</strong>, portador de la
      cédula de ciudadanía N.º <strong>${data.nationalId || '—'}</strong>, presento mi
      <strong>renuncia irrevocable</strong> al cargo que desempeño como ${(data.position || '—').toUpperCase()},
      con efecto a partir del ${formatLongDate(data.resignationDate)}.
    </p>

    ${discountParagraph}

    <p class="body-text">
      Agradezco profundamente la oportunidad brindada de formar parte de esta honorable institución y
      el apoyo recibido durante el tiempo en que ejercí mis funciones, por motivos netamente personales
      me retiro con la mejor disposición y quedo atento/a para colaborar en el proceso de transición de
      mis responsabilidades.
    </p>

    <p class="body-text">
      Sin más por el momento, me despido cordialmente, deseándole éxitos en las funciones a usted
      encomendadas.
    </p>

    <p class="body-text" style="margin-top:18px;">Atentamente,</p>

    ${buildEmployeeSignatureBlock({
      employeeName: data.employeeName,
      employeeRole: `C.I. ${data.nationalId || '—'}`,
      receivedByRole: 'Talento Humano',
    })}
  `

  const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Carta de Renuncia - ${data.employeeName}</title>
        <style>
          ${DOCUMENT_SHELL_STYLES}
          :root { --doc-accent: #0f172a; }
        </style>
      </head>
      <body>
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

  openPrintWindow(html)
}
