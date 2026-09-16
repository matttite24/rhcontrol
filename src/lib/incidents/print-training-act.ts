'use client'

import { Organization } from '@/types/employee'
import { INCIDENT_TYPE_OPTIONS } from './constants'
import { resolveOrgHeaderFields } from '@/lib/print/document-header'
import {
  formatLongDate,
  openPrintWindow,
  renderDocumentShell,
  shiftAccentHex,
} from '@/lib/print/document-shell'

export interface PrintTrainingActData {
  organization?: Partial<Organization> | null
  organizationName?: string
  employeeName: string
  nationalId: string
  department: string
  position: string
  trainingDate: string
  trainerName: string
  topicLabel: string
  description: string
  durationHours: number
  documentCode?: string
  accentHex?: string
}

export function printTrainingActDocument(data: PrintTrainingActData) {
  const { orgLegalName } = resolveOrgHeaderFields(data.organization, data.organizationName)
  const accentHex =
    data.accentHex || shiftAccentHex(INCIDENT_TYPE_OPTIONS, 'acta_capacitacion', '#c026d3')

  const durationLabel = data.durationHours === 1 ? '1 hora' : `${data.durationHours} horas`

  const bodyHtml = `
    <p class="body-text">
      Por medio del presente documento se deja constancia de que el/la colaborador/a
      <strong>${data.employeeName}</strong>, con cédula de identidad
      <strong>${data.nationalId || '—'}</strong>, quien se desempeña como
      <strong>${data.position || '—'}</strong> en el departamento de
      <strong>${data.department || '—'}</strong>, recibió capacitación por parte de
      <strong>${orgLegalName}</strong> conforme al detalle que se expone a continuación.
    </p>

    <table class="data-table" style="margin-top:8px;">
      <tr>
        <td class="key">Fecha de la Capacitación</td>
        <td>${formatLongDate(data.trainingDate)}</td>
      </tr>
      <tr>
        <td class="key">Tema / Área</td>
        <td>${data.topicLabel}</td>
      </tr>
      <tr>
        <td class="key">Capacitador / Instructor</td>
        <td>${data.trainerName}</td>
      </tr>
      <tr>
        <td class="key">Duración</td>
        <td>${durationLabel}</td>
      </tr>
      <tr>
        <td class="key">Descripción de la Capacitación</td>
        <td>${data.description || 'Sin descripción adicional.'}</td>
      </tr>
    </table>

    <p class="body-text" style="margin-top:22px;">
      El colaborador declara haber recibido la capacitación detallada y firma el presente
      documento en señal de conocimiento y constancia de su participación.
    </p>
  `

  const html = renderDocumentShell({
    organization: data.organization,
    organizationName: data.organizationName,
    documentCode: data.documentCode,
    accentHex,
    docTypeTitle: 'Acta de Capacitación',
    windowTitle: `Acta de Capacitación - ${data.employeeName}`,
    bodyHtml,
    signatures: {
      employeeName: data.employeeName,
      approverName: data.trainerName,
      approverRole: 'Capacitador / Instructor',
      employeeRole: 'Colaborador — Recibe la capacitación conforme',
    },
  })

  openPrintWindow(html)
}
