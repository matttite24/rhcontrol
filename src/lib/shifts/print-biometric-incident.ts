'use client'

import { Organization, BiometricIncidentType } from '@/types/employee'
import { SHIFT_REQUEST_TYPE_OPTIONS } from '@/lib/shifts/constants'
import { resolveOrgHeaderFields } from '@/lib/print/document-header'
import {
  formatLongDate,
  openPrintWindow,
  renderDocumentShell,
  shiftAccentHex,
} from '@/lib/print/document-shell'

export interface PrintBiometricIncidentData {
  organization?: Partial<Organization> | null
  organizationName?: string
  employeeName: string
  nationalId: string
  department: string
  position: string
  date: string
  incidentType: BiometricIncidentType
  reason: string
  documentCode?: string
  accentHex?: string
}

const INCIDENT_TYPE_LABELS: Record<BiometricIncidentType, string> = {
  sin_marcacion: 'Sin Marcación',
  doble_marcacion: 'Doble Marcación',
  marcacion_fuera_de_tiempo: 'Marcación Fuera de Tiempo',
}

export function printBiometricIncidentDocument(data: PrintBiometricIncidentData) {
  const { orgLegalName } = resolveOrgHeaderFields(data.organization, data.organizationName)
  const accentHex =
    data.accentHex || shiftAccentHex(SHIFT_REQUEST_TYPE_OPTIONS, 'incidencia_marcacion', '#e11d48')

  const incidentLabel = INCIDENT_TYPE_LABELS[data.incidentType] || 'Marcación Biométrica'

  const bodyHtml = `
    <p class="body-text">
      Por medio del presente documento se deja constancia informativa de una incidencia en el
      registro de marcación biométrica del/de la colaborador/a <strong>${data.employeeName}</strong>,
      con cédula de identidad <strong>${data.nationalId || '—'}</strong>, quien se desempeña como
      <strong>${data.position || '—'}</strong> en el departamento de
      <strong>${data.department || '—'}</strong> de <strong>${orgLegalName}</strong>.
    </p>

    <table class="data-table" style="margin-top:8px;">
      <tr>
        <td class="key">Fecha de la Incidencia</td>
        <td>${formatLongDate(data.date)}</td>
      </tr>
      <tr>
        <td class="key">Tipo de Incidencia</td>
        <td>${incidentLabel}</td>
      </tr>
      <tr>
        <td class="key">Motivo o Justificación</td>
        <td>${data.reason || 'Sin justificación especificada.'}</td>
      </tr>
    </table>

    <div class="note-block">
      <strong>Documento Informativo</strong>
      Esta constancia no requiere aprobación y no tiene efecto disciplinario. Su único propósito
      es justificar la incidencia ante la revisión del sistema biométrico de control de asistencia.
    </div>

    <p class="body-text" style="margin-top:22px;">
      El presente documento se firma en señal de conocimiento de la incidencia registrada.
    </p>
  `

  const html = renderDocumentShell({
    organization: data.organization,
    organizationName: data.organizationName,
    documentCode: data.documentCode,
    accentHex,
    docTypeTitle: 'Marcación Biométrica',
    windowTitle: `Marcación Biométrica - ${data.employeeName}`,
    bodyHtml,
    signatures: {
      employeeName: data.employeeName,
      approverRole: 'Firma y Sello — Talento Humano',
      employeeRole: 'Firma del Colaborador — Conocimiento',
    },
  })

  openPrintWindow(html)
}
