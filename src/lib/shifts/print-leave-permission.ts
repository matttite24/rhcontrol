'use client'

import { Organization, LeaveRecoverySchedule } from '@/types/employee'
import { SHIFT_REQUEST_TYPE_OPTIONS } from '@/lib/shifts/constants'
import { resolveOrgHeaderFields } from '@/lib/print/document-header'
import {
  formatLongDate,
  openPrintWindow,
  renderDocumentShell,
  resolveApproverStatus,
  shiftAccentHex,
} from '@/lib/print/document-shell'

export interface PrintLeavePermissionData {
  organization?: Partial<Organization> | null
  organizationName?: string
  employeeName: string
  nationalId: string
  department: string
  position: string
  leaveUnit: 'dias' | 'horas'
  startDate: string
  endDate?: string
  daysCount?: number
  hoursCount?: number
  startTime?: string
  endTime?: string
  reason: string
  recoveryMethod: 'cargo_vacaciones' | 'descuento_dia' | 'recuperacion_dias' | 'reemplazo_personal'
  recoverySchedules?: LeaveRecoverySchedule[]
  replacementEmployeeName?: string
  discountAmount?: number
  status?: string
  resolvedAt?: string
  documentCode?: string
  accentHex?: string
}

export function printLeavePermissionDocument(data: PrintLeavePermissionData) {
  const { orgLegalName } = resolveOrgHeaderFields(data.organization, data.organizationName)
  const accentHex =
    data.accentHex || shiftAccentHex(SHIFT_REQUEST_TYPE_OPTIONS, 'permiso_laboral', '#7c3aed')

  const status = resolveApproverStatus(data.status, data.resolvedAt, {
    approved: 'Autorizado',
    rejected: 'Rechazado',
  })

  let recoveryLabel = 'Cargo a Vacaciones Anuales'
  let recoveryNote = 'Las horas o días solicitados se descuentan de los días de vacaciones acumulados.'

  if (data.recoveryMethod === 'descuento_dia') {
    recoveryLabel = 'Descuento Salarial'
    recoveryNote = 'El valor proporcional se descontará en el próximo rol de pagos de nómina.'
  } else if (data.recoveryMethod === 'reemplazo_personal') {
    recoveryLabel = `Reemplazo por: ${data.replacementEmployeeName || 'Compañero asignado'}`
    recoveryNote = 'El compañero indicado cubrirá las funciones durante la ausencia.'
  } else if (data.recoveryMethod === 'recuperacion_dias') {
    recoveryLabel = 'Reposición de Horas acordadas'
    recoveryNote = 'El colaborador compensará el tiempo en jornadas posteriores convenidas con su jefatura.'
  }

  const isDays = data.leaveUnit === 'dias'
  const periodRow = isDays
    ? `
      <tr>
        <td class="key">Fecha de Inicio</td>
        <td>${formatLongDate(data.startDate)}</td>
      </tr>
      <tr>
        <td class="key">Fecha de Reincorporación</td>
        <td>${formatLongDate(data.endDate || data.startDate)}</td>
      </tr>
      <tr>
        <td class="key">Tiempo Solicitado</td>
        <td>${data.daysCount} día(s)</td>
      </tr>
    `
    : `
      <tr>
        <td class="key">Fecha del Permiso</td>
        <td>${formatLongDate(data.startDate)}</td>
      </tr>
      <tr>
        <td class="key">Horario Autorizado</td>
        <td>${data.startTime} a ${data.endTime}</td>
      </tr>
      <tr>
        <td class="key">Tiempo Solicitado</td>
        <td>${data.hoursCount} hora(s)</td>
      </tr>
    `

  const bodyHtml = `
    <p class="body-text">
      Por medio del presente documento, el/la colaborador/a <strong>${data.employeeName}</strong>,
      con cédula de identidad <strong>${data.nationalId || '—'}</strong>, quien se desempeña como
      <strong>${data.position || '—'}</strong> en el departamento de
      <strong>${data.department || '—'}</strong>, solicita a <strong>${orgLegalName}</strong> un
      permiso laboral conforme al detalle que se expone a continuación.
    </p>

    <table class="data-table" style="margin-top:8px;">
      ${periodRow}
      <tr>
        <td class="key">Motivo o Justificación</td>
        <td>${data.reason || 'Permiso laboral convenido.'}</td>
      </tr>
    </table>

    <div class="note-block">
      <strong>Forma de Compensación — ${recoveryLabel}</strong>
      ${recoveryNote}
    </div>

    <p class="body-text" style="margin-top:22px;">
      El presente documento se hace efectivo mediante la firma de la jefatura inmediata, que autoriza
      el permiso y su forma de compensación, mientras que el colaborador firma en señal de
      conocimiento y aceptación.
    </p>
  `

  const html = renderDocumentShell({
    organization: data.organization,
    organizationName: data.organizationName,
    documentCode: data.documentCode,
    accentHex,
    docTypeTitle: 'Permiso Laboral / Salida',
    windowTitle: `Permiso Laboral - ${data.employeeName}`,
    bodyHtml,
    signatures: {
      employeeName: data.employeeName,
      approverRole: 'Firma y Sello — Autoriza',
      employeeRole: 'Firma del Colaborador — Conocimiento y aceptación',
      approverStatusNote: status.note,
      approverStatusDate: status.date,
    },
  })

  openPrintWindow(html)
}
