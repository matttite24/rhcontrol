'use client'

import { Organization } from '@/types/employee'
import { resolveOrgHeaderFields } from '@/lib/print/document-header'
import { openPrintWindow, renderDocumentShell } from '@/lib/print/document-shell'
import { buildEmployeeSignatureBlock } from '@/lib/employees/print-signature-block'

export type ReserveFundsModalidad = 'acumular' | 'pagar_mensual'

export interface PrintReserveFundsRequestData {
  organization?: Partial<Organization> | null
  organizationName?: string
  employeeName: string
  nationalId: string
  modalidad: ReserveFundsModalidad
  /** Fecha de emisión del documento (YYYY-MM-DD). Permite generar el documento de forma retroactiva. */
  issueDate?: string
  documentCode?: string
}

export function printReserveFundsRequestDocument(data: PrintReserveFundsRequestData) {
  const { orgLegalName, orgName } = resolveOrgHeaderFields(data.organization, data.organizationName)
  const city = data.organization?.city || 'Puyo'
  const issueDate = data.issueDate ? new Date(`${data.issueDate}T00:00:00`) : new Date()
  const issueDateFormatted = issueDate.toLocaleDateString('es-EC', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const requestParagraph =
    data.modalidad === 'acumular'
      ? `se procedan <strong>acumular</strong> mis Fondos de Reserva y sean depositados mensualmente por la empresa al Instituto Ecuatoriano de Seguridad Social (IESS), conforme al régimen general establecido en el Código del Trabajo.`
      : `se cancele <strong>mensualmente</strong>, junto con mi rol de pagos, el valor proporcional que por Ley me corresponde por concepto de Fondos de Reserva, en lugar de su depósito al IESS.`

  const docTypeTitle =
    data.modalidad === 'acumular'
      ? 'Solicitud de Acumulación de Fondos de Reserva'
      : 'Solicitud de Pago Mensual de Fondos de Reserva'

  const bodyHtml = `
    <p class="body-text" style="text-align:right;">${city}, ${issueDateFormatted}</p>

    <p class="body-text" style="margin-top:18px;">
      Yo, <strong>${data.employeeName.toUpperCase()}</strong> con cédula de ciudadanía No.
      <strong>${data.nationalId || '—'}</strong>, colaborador/a de <em>${orgName}</em>, solicito
      expresamente que ${requestParagraph}
    </p>

    <p class="body-text" style="margin-top:22px;">
      De conformidad a lo establecido en el artículo 196 y siguientes del Código del Trabajo del
      Ecuador, que regula el derecho de todo trabajador que preste servicios por más de un año
      continuo para el mismo empleador a percibir Fondos de Reserva, cuya forma de pago (acumulación
      en el IESS o pago mensual directo) puede ser definida por el trabajador mediante solicitud
      expresa.
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
    hideIssueDate: true,
    hideHeader: true,
    accentHex: '#0f172a',
    docTypeTitle,
    windowTitle: `Solicitud de Fondos de Reserva - ${data.employeeName}`,
    footerNote: `Documento oficial • ${orgLegalName} • Control de Nómina y Asistencia`,
    bodyHtml,
  })

  openPrintWindow(html)
}
