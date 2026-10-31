'use client'

import { Organization, LeaveRecoverySchedule } from '@/types/employee'
import { SHIFT_REQUEST_TYPE_OPTIONS } from '@/lib/shifts/constants'
import { resolveOrgHeaderFields } from '@/lib/print/document-header'
import { formatTimeHHmm, recoveryRanges, recoveryHours } from '@/lib/shifts/time'
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
  recoveryMethod: 'cargo_vacaciones' | 'descuento_dia' | 'recuperacion_dias' | 'reemplazo_personal' | 'sin_descuento'
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
  } else if (data.recoveryMethod === 'sin_descuento') {
    recoveryLabel = 'Falta Autorizada sin Descuento'
    recoveryNote = 'La ausencia queda autorizada sin generar deducción salarial ni afectar el saldo de vacaciones.'
  } else if (data.recoveryMethod === 'reemplazo_personal') {
    recoveryLabel = `Reemplazo por: ${data.replacementEmployeeName || 'Compañero asignado'}`
    recoveryNote = 'El compañero indicado cubrirá las funciones durante la ausencia.'
  } else if (data.recoveryMethod === 'recuperacion_dias') {
    recoveryLabel = 'Reposición de Horas acordadas'
    recoveryNote = (data.recoverySchedules ?? []).some((rs) => rs.date)
      ? 'El colaborador compensará el tiempo en las jornadas programadas que se detallan a continuación.'
      : 'El colaborador compensará el tiempo en jornadas posteriores convenidas con su jefatura.'
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
        <td>${formatTimeHHmm(data.startTime)} a ${formatTimeHHmm(data.endTime)}</td>
      </tr>
      <tr>
        <td class="key">Tiempo Solicitado</td>
        <td>${data.hoursCount} hora(s)</td>
      </tr>
    `

  const scheduled = (data.recoverySchedules ?? []).filter((rs) => rs.date)
  let recoveryBlockHtml = ''
  if (data.recoveryMethod === 'recuperacion_dias') {
    if (scheduled.length > 0) {
      const sorted = [...scheduled].sort((a, b) => a.date.localeCompare(b.date))
      const fmtRange = (r?: { start: string; end: string }) =>
        r ? `${formatTimeHHmm(r.start)} a ${formatTimeHHmm(r.end)}` : '—'
      const rows = sorted
        .map((rs) => {
          const ranges = recoveryRanges(rs)
          return `
      <tr>
        <td>${formatLongDate(rs.date)}</td>
        <td>${fmtRange(ranges[0])}</td>
        <td>${fmtRange(ranges[1])}</td>
        <td style="text-align:right;">${recoveryHours(rs)} h</td>
      </tr>`
        })
        .join('')
      const totalHours = Math.round(sorted.reduce((sum, rs) => sum + recoveryHours(rs), 0) * 100) / 100
      const toRecover = isDays
        ? `${data.daysCount ?? sorted.length} día(s)`
        : `${data.hoursCount ?? 0} hora(s)`
      recoveryBlockHtml = `
    <div class="section-heading">Detalle de la Recuperación Programada</div>
    <table class="data-table" style="margin-top:6px;">
      <tr>
        <th>Fecha</th>
        <th>Franja 1</th>
        <th>Franja 2</th>
        <th style="text-align:right;">Horas</th>
      </tr>${rows}
      <tr>
        <td colspan="3" style="text-align:right;font-weight:700;">Total programado a recuperar (${toRecover} de permiso)</td>
        <td style="text-align:right;font-weight:700;">${totalHours} h</td>
      </tr>
    </table>`
    } else {
      recoveryBlockHtml = `
    <table class="data-table" style="margin-top:14px;">
      <tr>
        <td class="key">Fecha(s) de Reposición Acordada(s)</td>
        <td style="height:32px;">&nbsp;</td>
      </tr>
      <tr>
        <td class="key">Horario(s) de Reposición</td>
        <td style="height:32px;">&nbsp;</td>
      </tr>
    </table>`
    }
  }

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

    ${recoveryBlockHtml}

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
