'use client'

import { Organization } from '@/types/employee'
import { SHIFT_REQUEST_TYPE_OPTIONS } from '@/lib/shifts/constants'
import { resolveOrgHeaderFields } from '@/lib/print/document-header'
import {
  formatLongDate,
  openPrintWindow,
  renderDocumentShell,
  resolveApproverStatus,
  shiftAccentHex,
} from '@/lib/print/document-shell'

export interface PrintVacationData {
  organization?: Partial<Organization> | null
  organizationName?: string
  employeeName: string
  nationalId: string
  department: string
  position: string
  hireDate?: string
  startDate: string
  endDate: string
  daysCount: number
  settlementPeriod: string
  availableDays: number
  remainingDays: number
  reason?: string
  status?: string
  resolvedAt?: string
  documentCode?: string
  accentHex?: string
}

export function printVacationDocument(data: PrintVacationData) {
  const { orgLegalName } = resolveOrgHeaderFields(data.organization, data.organizationName)
  const accentHex =
    data.accentHex || shiftAccentHex(SHIFT_REQUEST_TYPE_OPTIONS, 'solicitud_vacaciones', '#059669')

  const status = resolveApproverStatus(data.status, data.resolvedAt)

  const bodyHtml = `
    <p class="body-text">
      Por medio del presente documento, el/la colaborador/a <strong>${data.employeeName}</strong>,
      con cédula de identidad <strong>${data.nationalId || '—'}</strong>, quien se desempeña como
      <strong>${data.position || '—'}</strong> en el departamento de
      <strong>${data.department || '—'}</strong>, solicita a <strong>${orgLegalName}</strong> el
      goce de su descanso vacacional anual, conforme al detalle que se expone a continuación.
    </p>

    <table class="data-table" style="margin-top:8px;">
      <tr>
        <td class="key">Fecha de Salida</td>
        <td>${formatLongDate(data.startDate)}</td>
      </tr>
      <tr>
        <td class="key">Fecha de Retorno</td>
        <td>${formatLongDate(data.endDate)}</td>
      </tr>
      <tr>
        <td class="key">Total de Días Solicitados</td>
        <td>${data.daysCount} día(s)</td>
      </tr>
      <tr>
        <td class="key">Período a Liquidar</td>
        <td>${data.settlementPeriod}</td>
      </tr>
      <tr>
        <td class="key">Días Disponibles</td>
        <td>${data.availableDays} día(s)</td>
      </tr>
      <tr>
        <td class="key">Saldo Restante</td>
        <td>${data.remainingDays} día(s)</td>
      </tr>
      <tr>
        <td class="key">Observaciones</td>
        <td>${data.reason || 'Descanso anual por derecho de ley.'}</td>
      </tr>
    </table>

    <p class="body-text" style="margin-top:22px;">
      El goce de vacaciones se concede conforme a lo previsto en el Código del Trabajo del Ecuador.
      El presente documento se hace efectivo mediante la firma de la jefatura inmediata, que aprueba
      el período solicitado, mientras que el colaborador firma en señal de conformidad.
    </p>
  `

  const html = renderDocumentShell({
    organization: data.organization,
    organizationName: data.organizationName,
    documentCode: data.documentCode,
    accentHex,
    docTypeTitle: 'Solicitud de Vacaciones',
    windowTitle: `Solicitud de Vacaciones - ${data.employeeName}`,
    footerNote: `Documento oficial • ${orgLegalName} • Control de Vacaciones y Descanso Legal`,
    bodyHtml,
    signatures: {
      employeeName: data.employeeName,
      approverRole: 'Firma y Sello — Aprueba',
      employeeRole: 'Firma del Colaborador — Conformidad',
      approverStatusNote: status.note,
      approverStatusDate: status.date,
    },
  })

  openPrintWindow(html)
}
