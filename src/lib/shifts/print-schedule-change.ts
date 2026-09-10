'use client'

import { Organization, ScheduleDayChange } from '@/types/employee'
import { SHIFT_REQUEST_TYPE_OPTIONS } from '@/lib/shifts/constants'
import { resolveOrgHeaderFields } from '@/lib/print/document-header'
import {
  formatLongDate,
  openPrintWindow,
  renderDocumentShell,
  resolveApproverStatus,
  shiftAccentHex,
} from '@/lib/print/document-shell'

export interface PrintScheduleChangeData {
  organization?: Partial<Organization> | null
  organizationName?: string
  employeeName: string
  nationalId: string
  department: string
  position: string
  date: string
  reason: string
  dayChanges: ScheduleDayChange[]
  status?: string
  resolvedAt?: string
  documentCode?: string
  accentHex?: string
}

export function printScheduleChangeDocument(data: PrintScheduleChangeData) {
  const { orgLegalName } = resolveOrgHeaderFields(data.organization, data.organizationName)
  const accentHex =
    data.accentHex || shiftAccentHex(SHIFT_REQUEST_TYPE_OPTIONS, 'cambio_horario', '#2563eb')

  const status = resolveApproverStatus(data.status, data.resolvedAt, {
    approved: 'Autorizado',
    rejected: 'Rechazado',
  })

  const daysRows = (data.dayChanges || [])
    .map((dc) => {
      let newScheduleStr = 'Descanso / Libre'
      if (dc.is_workday) {
        if (dc.has_split_shift) {
          newScheduleStr = `${dc.start_time_1} a ${dc.end_time_1} y ${dc.start_time_2 || '14:00'} a ${dc.end_time_2 || '18:00'}`
        } else {
          newScheduleStr = `${dc.start_time_1} a ${dc.end_time_1}`
        }
      }
      return `
        <tr>
          <td>${formatLongDate(dc.date)}</td>
          <td>${dc.original_summary || 'Horario Regular'}</td>
          <td>${newScheduleStr}</td>
        </tr>
      `
    })
    .join('')

  const bodyHtml = `
    <p class="body-text">
      Por medio del presente documento, el/la colaborador/a <strong>${data.employeeName}</strong>,
      con cédula de identidad <strong>${data.nationalId || '—'}</strong>, quien se desempeña como
      <strong>${data.position || '—'}</strong> en el departamento de
      <strong>${data.department || '—'}</strong>, solicita a <strong>${orgLegalName}</strong> una
      modificación temporal de su jornada de trabajo para las fechas que se detallan a continuación.
    </p>

    <table class="data-table" style="margin-top:8px;">
      <thead>
        <tr>
          <th>Fecha a Modificar</th>
          <th>Horario Regular</th>
          <th>Horario Temporal Acordado</th>
        </tr>
      </thead>
      <tbody>
        ${
          daysRows ||
          '<tr><td colspan="3" style="text-align:center;color:#94a3b8;">Sin días especificados</td></tr>'
        }
      </tbody>
    </table>

    <table class="data-table">
      <tr>
        <td class="key">Motivo o Justificación</td>
        <td>${data.reason || 'Cambio temporal acordado.'}</td>
      </tr>
    </table>

    <p class="body-text" style="margin-top:22px;">
      La modificación de jornada es de carácter temporal y no altera las condiciones contractuales
      del colaborador. El presente documento se hace efectivo mediante la firma de la jefatura
      inmediata, que autoriza el cambio, mientras que el colaborador firma en señal de conformidad.
    </p>
  `

  const html = renderDocumentShell({
    organization: data.organization,
    organizationName: data.organizationName,
    documentCode: data.documentCode,
    accentHex,
    docTypeTitle: 'Solicitud de Cambio de Horario',
    windowTitle: `Cambio de Horario - ${data.employeeName}`,
    bodyHtml,
    signatures: {
      employeeName: data.employeeName,
      approverRole: 'Firma y Sello — Autoriza',
      employeeRole: 'Firma del Colaborador — Conformidad',
      approverStatusNote: status.note,
      approverStatusDate: status.date,
    },
  })

  openPrintWindow(html)
}
