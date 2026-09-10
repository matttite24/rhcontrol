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

export interface PrintOvertimeData {
  organization?: Partial<Organization> | null
  organizationName?: string
  employeeName: string
  nationalId: string
  department: string
  position: string
  date: string
  startTime: string
  endTime: string
  hours: number
  reason: string
  status?: string
  /** Fecha ISO en que se resolvió (aprobó/rechazó) la solicitud. */
  resolvedAt?: string
  documentCode?: string
  /** Color de acento del tipo de documento (hex). Por defecto el de "horas_extras". */
  accentHex?: string
}

export function printOvertimeDocument(data: PrintOvertimeData) {
  const { orgLegalName } = resolveOrgHeaderFields(data.organization, data.organizationName)
  const accentHex =
    data.accentHex || shiftAccentHex(SHIFT_REQUEST_TYPE_OPTIONS, 'horas_extras', '#d97706')

  const status = resolveApproverStatus(data.status, data.resolvedAt, {
    approved: 'Autorizado',
    rejected: 'Rechazado',
  })

  const bodyHtml = `
    <p class="body-text">
      Por medio del presente documento, <strong>${orgLegalName}</strong> dispone y autoriza al/a
      la colaborador/a <strong>${data.employeeName}</strong>, con cédula de identidad
      <strong>${data.nationalId || '—'}</strong>, quien se desempeña como
      <strong>${data.position || '—'}</strong> en el departamento de
      <strong>${data.department || '—'}</strong>, la realización de trabajo en jornada
      extraordinaria conforme al detalle que se expone a continuación.
    </p>

    <table class="data-table" style="margin-top:8px;">
      <tr>
        <td class="key">Fecha de Ejecución</td>
        <td>${formatLongDate(data.date)}</td>
      </tr>
      <tr>
        <td class="key">Horario Autorizado</td>
        <td>${data.startTime} a ${data.endTime}</td>
      </tr>
      <tr>
        <td class="key">Total de Horas</td>
        <td>${data.hours} hora(s)</td>
      </tr>
      <tr>
        <td class="key">Motivo y Justificación</td>
        <td>${data.reason || 'Labores extraordinarias acordadas con la jefatura inmediata.'}</td>
      </tr>
    </table>

    <p class="body-text" style="margin-top:22px;">
      El trabajo suplementario o extraordinario se ejecuta por disposición del empleador y con la
      aceptación del colaborador, de acuerdo con lo previsto en el Código del Trabajo del Ecuador.
      En tal sentido, el presente documento se hace efectivo mediante la firma de la jefatura
      inmediata, que dispone y autoriza el trabajo extraordinario, mientras que el colaborador
      firma en señal de conocimiento y aceptación.
    </p>
  `

  const html = renderDocumentShell({
    organization: data.organization,
    organizationName: data.organizationName,
    documentCode: data.documentCode,
    accentHex,
    docTypeTitle: 'Autorización de Horas Extras',
    windowTitle: `Autorización de Horas Extras - ${data.employeeName}`,
    bodyHtml,
    signatures: {
      employeeName: data.employeeName,
      approverRole: 'Firma y Sello — Autoriza y dispone',
      employeeRole: 'Firma del Colaborador — Conocimiento y aceptación',
      approverStatusNote: status.note,
      approverStatusDate: status.date,
    },
  })

  openPrintWindow(html)
}
