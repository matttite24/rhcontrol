'use client'

import { Organization } from '@/types/employee'
import { resolveOrgHeaderFields } from '@/lib/print/document-header'
import { openPrintWindow, renderDocumentShell } from '@/lib/print/document-shell'
import { buildEmployeeSignatureBlock } from '@/lib/employees/print-signature-block'

export interface PrintBiweeklyPaymentRequestData {
  organization?: Partial<Organization> | null
  organizationName?: string
  employeeName: string
  nationalId: string
  position: string
  /** Fecha de emisión del documento (YYYY-MM-DD). Permite generar el documento de forma retroactiva. */
  issueDate?: string
  documentCode?: string
}

export function printBiweeklyPaymentRequestDocument(data: PrintBiweeklyPaymentRequestData) {
  const { orgLegalName, orgName } = resolveOrgHeaderFields(data.organization, data.organizationName)
  const city = data.organization?.city || 'Tena'
  const issueDate = data.issueDate ? new Date(`${data.issueDate}T00:00:00`) : new Date()
  const issueDateFormatted = issueDate.toLocaleDateString('es-EC', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const bodyHtml = `
    <p class="body-text" style="text-align:right;">${city}, ${issueDateFormatted}</p>

    <p class="body-text" style="margin-top:18px;">
      Yo, <strong>${data.employeeName.toUpperCase()}</strong>, portador/a de la cédula de ciudadanía N.º
      <strong>${data.nationalId || '—'}</strong>, colaborador/a de <em>${orgName}</em>, en el cargo de
      <strong>${data.position || '—'}</strong>, por medio de la presente:
    </p>

    <p class="body-text" style="font-weight:700;margin-top:18px;">SOLICITO</p>

    <p class="body-text">
      Que, de conformidad con lo dispuesto en el Código del Trabajo del Ecuador, el pago de mi
      remuneración mensual sea realizado de forma fraccionada en dos (2) pagos quincenales, en lugar
      del pago mensual único, en los siguientes términos:
    </p>

    <table class="data-table" style="margin-top:8px;">
      <tr>
        <td class="key">Primer Pago</td>
        <td>
          Anticipo equivalente al 50% de mi remuneración mensual, a cancelarse el día 15 de cada mes
          (o el día hábil inmediato anterior si este fuera feriado o fin de semana).
        </td>
      </tr>
      <tr>
        <td class="key">Segundo Pago</td>
        <td>
          Saldo restante de mi remuneración mensual, correspondiente al segundo pago, a cancelarse el
          último día de cada mes (o el día hábil inmediato anterior si este fuera feriado o fin de
          semana).
        </td>
      </tr>
    </table>

    <p class="body-text" style="margin-top:22px;">
      Declaro conocer que el presente anticipo quincenal no genera intereses ni recargos a mi favor ni
      en contra, y que el valor total pagado en el mes corresponderá siempre a mi remuneración mensual
      íntegra, sin perjuicio de los descuentos de ley que correspondan (aporte personal IESS, préstamos
      quirografarios/hipotecarios, anticipos, u otros autorizados por mí o dispuestos por autoridad
      competente).
    </p>

    <p class="body-text">
      Esta solicitud se realiza de manera libre y voluntaria, y estará vigente mientras mantenga mi
      relación laboral con ${orgLegalName} o hasta que presente por escrito mi deseo de revocarla.
    </p>

    <p class="body-text" style="margin-top:18px;">Atentamente,</p>

    ${buildEmployeeSignatureBlock({
      employeeName: data.employeeName,
      receivedByRole: 'Talento Humano',
    })}
  `

  const html = renderDocumentShell({
    organization: data.organization,
    organizationName: data.organizationName,
    documentCode: data.documentCode,
    issueDate: data.issueDate,
    hideIssueDate: true,
    hideHeader: true,
    accentHex: '#0f172a',
    docTypeTitle: 'Solicitud de Pago de Remuneración en Quincenas',
    windowTitle: `Solicitud de Pago Quincenal - ${data.employeeName}`,
    footerNote: `Documento oficial • ${orgLegalName} • Control de Nómina y Asistencia`,
    bodyHtml,
  })

  openPrintWindow(html)
}
