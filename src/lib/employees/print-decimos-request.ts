'use client'

import { Organization } from '@/types/employee'
import { resolveOrgHeaderFields } from '@/lib/print/document-header'
import { openPrintWindow, renderDocumentShell } from '@/lib/print/document-shell'
import { buildEmployeeSignatureBlock } from '@/lib/employees/print-signature-block'

export type DecimosRubro = 'decima_tercera' | 'decima_cuarta'
export type DecimosModalidad = 'acumular' | 'mensualizar'

export interface PrintDecimosRequestData {
  organization?: Partial<Organization> | null
  organizationName?: string
  employeeName: string
  nationalId: string
  modalidad: DecimosModalidad
  rubros: DecimosRubro[]
  /** Fecha de emisión del documento (YYYY-MM-DD). Permite generar el documento de forma retroactiva. */
  issueDate?: string
  documentCode?: string
}

const RUBRO_LABEL: Record<DecimosRubro, string> = {
  decima_tercera: 'Décima Tercera Remuneración',
  decima_cuarta: 'Décima Cuarta Remuneración',
}

function joinRubros(rubros: DecimosRubro[]): string {
  const labels = rubros.map((r) => RUBRO_LABEL[r])
  if (labels.length <= 1) return labels[0] || ''
  return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`
}

export function printDecimosRequestDocument(data: PrintDecimosRequestData) {
  const { orgLegalName } = resolveOrgHeaderFields(data.organization, data.organizationName)
  const city = data.organization?.city || 'Puyo'
  const issueDate = data.issueDate ? new Date(`${data.issueDate}T00:00:00`) : new Date()
  const issueDateFormatted = issueDate.toLocaleDateString('es-EC', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const rubrosLabel = joinRubros(data.rubros)
  const requestParagraph =
    data.modalidad === 'acumular'
      ? `Se proceda a <strong>acumular</strong> y pagar en el mes que corresponda por Ley el valor de mi ${rubrosLabel}.`
      : `Se cancele <strong>mensualmente</strong> el valor proporcional que por Ley me corresponde de mi ${rubrosLabel}.`

  const docTypeTitle =
    data.modalidad === 'acumular'
      ? `Solicitud de Acumulación de ${rubrosLabel}`
      : `Solicitud de Mensualización de ${rubrosLabel}`

  const bodyHtml = `
    <p class="body-text" style="text-align:right;">${city}, ${issueDateFormatted}</p>

    <p class="body-text" style="margin-top:18px;">
      Yo, <strong>${data.employeeName.toUpperCase()}</strong> con cédula de ciudadanía No.
      <strong>${data.nationalId || '—'}</strong>, solicito expresamente que ${requestParagraph}
    </p>

    <p class="body-text" style="margin-top:22px;">
      De conformidad a lo establecido en la Ley Orgánica para la Justicia Laboral y Reconocimiento del
      Trabajo en el Hogar publicada el lunes 20 de abril de 2015 mediante Registro Oficial No. 483 y al
      Acuerdo Ministerial MDT-2015-0087 emitido por parte del Ministerio de Trabajo el jueves 23 de abril
      de 2015.
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
    windowTitle: `Solicitud de Décimos - ${data.employeeName}`,
    footerNote: `Documento oficial • ${orgLegalName} • Control de Nómina y Asistencia`,
    bodyHtml,
  })

  openPrintWindow(html)
}
