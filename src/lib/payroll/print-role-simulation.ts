'use client'

import { Organization } from '@/types/employee'
import { resolveOrgHeaderFields } from '@/lib/print/document-header'
import {
  DOCUMENT_SHELL_STYLES,
  formatLongDate,
  openPrintWindow,
} from '@/lib/print/document-shell'

export interface RoleSimulationPrintData {
  organization?: Partial<Organization> | null
  organizationName?: string
  candidateName: string
  position: string
  department: string
  contractType: string
  baseSalary: number
  sbu: number
  
  // Ingresos adicionales
  bonuses: { name: string; amount: number }[]
  overtime50Hours: number
  overtime50Amount: number
  overtime100Hours: number
  overtime100Amount: number
  totalOvertimeAmount: number
  
  // Beneficios sociales
  monthlyThirteenth: boolean
  thirteenthAmount: number
  monthlyFourteenth: boolean
  fourteenthAmount: number
  reserveFundsTreatment: 'pagar_ingreso' | 'pagar_ano' | 'acumular'
  reserveFundsAmount: number
  totalSocialBenefits: number

  // Deducciones adicionales (Alimentación, Vivienda, etc.)
  customDeductions: { name: string; amount: number }[]
  totalCustomDeductions: number
  totalDeductions: number

  // Totales
  taxableIncome: number
  totalIncome: number
  iessPersonal: number
  iessPersonalRate: number
  netToReceive: number

  // Costo empleador
  iessEmployer: number
  iessEmployerRate: number
  totalCompanyCost: number

  notes?: string
}

export function printRoleSimulationDocument(data: RoleSimulationPrintData): boolean {
  const { orgLegalName, orgTaxId } = resolveOrgHeaderFields(data.organization, data.organizationName)
  const todayFormatted = formatLongDate(new Date().toISOString().split('T')[0])
  const accentHex = '#059669' // Verde esmeralda corporativo para simulador/nómina

  const bonusesRows = data.bonuses.length > 0
    ? data.bonuses
        .filter((b) => b.amount > 0)
        .map(
          (b) => `
          <tr>
            <td style="padding-left: 20px; color: #4b5563;">• Bono: ${b.name || 'Bono adicional'}</td>
            <td style="text-align: right; font-family: monospace;">$${b.amount.toFixed(2)}</td>
          </tr>`
        )
        .join('')
    : ''

  const deductionsRows = data.customDeductions.length > 0
    ? data.customDeductions
        .filter((d) => d.amount > 0)
        .map(
          (d) => `
          <tr>
            <td style="padding-left: 20px; color: #dc2626;">• ${d.name || 'Descuento interno'}</td>
            <td style="text-align: right; font-family: monospace; color: #dc2626;">-$${d.amount.toFixed(2)}</td>
          </tr>`
        )
        .join('')
    : ''

  const overtimeRows = `
    ${data.overtime50Hours > 0 ? `
      <tr>
        <td style="padding-left: 20px; color: #4b5563;">• Horas Extras 50% (${data.overtime50Hours} hrs)</td>
        <td style="text-align: right; font-family: monospace;">$${data.overtime50Amount.toFixed(2)}</td>
      </tr>
    ` : ''}
    ${data.overtime100Hours > 0 ? `
      <tr>
        <td style="padding-left: 20px; color: #4b5563;">• Horas Extraordinarias 100% (${data.overtime100Hours} hrs)</td>
        <td style="text-align: right; font-family: monospace;">$${data.overtime100Amount.toFixed(2)}</td>
      </tr>
    ` : ''}
  `

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Simulación de Rol de Pagos - ${data.candidateName || 'Candidato'}</title>
  <style>
    ${DOCUMENT_SHELL_STYLES}
    :root { --doc-accent: ${accentHex}; }
    .sim-badge {
      display: inline-block;
      padding: 4px 10px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
      border-radius: 4px;
    }
    .watermark-notice {
      background: #f8fafc;
      border-left: 4px solid #059669;
      padding: 10px 14px;
      font-size: 11px;
      color: #334155;
      margin-bottom: 20px;
      border-radius: 0 6px 6px 0;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }
    .summary-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px;
      background: #fafafa;
    }
    .summary-card.highlight {
      background: #f0fdf4;
      border-color: #86efac;
    }
    .summary-card.company {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
    .table-section-title {
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: #f1f5f9;
      color: #1e293b;
      padding: 6px 10px;
      border: 1px solid #cbd5e1;
    }
  </style>
</head>
<body>
  <!-- Encabezado -->
  <div style="border-bottom: 2px solid ${accentHex}; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start;">
    <div>
      <h1 style="margin: 0; font-size: 16px; font-weight: 800; text-transform: uppercase; color: #0f172a;">
        ${orgLegalName}
      </h1>
      ${orgTaxId ? `<div style="font-size: 11px; color: #64748b; font-family: monospace;">RUC: ${orgTaxId}</div>` : ''}
      <div style="font-size: 12px; font-weight: 600; color: #059669; margin-top: 4px;">
        SIMULACIÓN PROYECTADA DE ROL DE PAGOS
      </div>
    </div>
    <div style="text-align: right;">
      <span class="sim-badge">Documento Informativo</span>
      <div style="font-size: 10px; color: #64748b; margin-top: 6px; font-family: monospace;">
        Fecha: ${todayFormatted}
      </div>
    </div>
  </div>

  <div class="watermark-notice">
    <strong>Nota de Confidencialidad y Proyección:</strong>
    Este documento constituye una proyección preliminar orientativa de ingresos y aportes laborales bajo la normativa de la República del Ecuador (SBU $${data.sbu.toFixed(2)}). No representa una obligación contractual definitiva ni genera pasivo laboral hasta la firma oficial del contrato de trabajo.
  </div>

  <!-- Ficha del Candidato / Cargo -->
  <div class="section-heading">Información de la Posición y Contratación</div>
  <table class="data-table">
    <tr>
      <td class="key">Candidato / Referencia</td>
      <td><strong>${data.candidateName || 'No especificado (Proyección de Vacante)'}</strong></td>
      <td class="key">Cargo / Puesto</td>
      <td>${data.position || 'No especificado'}</td>
    </tr>
    <tr>
      <td class="key">Departamento</td>
      <td>${data.department || 'General / Operaciones'}</td>
      <td class="key">Tipo de Contrato</td>
      <td>${data.contractType}</td>
    </tr>
    <tr>
      <td class="key">Salario Básico Referencial</td>
      <td><strong style="font-family: monospace; font-size: 12px;">$${data.baseSalary.toFixed(2)}</strong></td>
      <td class="key">Régimen Legal</td>
      <td>Código del Trabajo (Ecuador)</td>
    </tr>
  </table>

  <!-- Detalle Financiero: Ingresos vs Deducciones -->
  <div class="grid-2" style="margin-top: 20px;">
    <!-- Columna Ingresos -->
    <div>
      <div class="table-section-title">1. Ingresos Mensuales Proyectados</div>
      <table class="data-table" style="margin-top: -1px;">
        <tr>
          <td>Sueldo Base Nominal</td>
          <td style="text-align: right; font-family: monospace; width: 35%;">$${data.baseSalary.toFixed(2)}</td>
        </tr>
        ${bonusesRows}
        ${overtimeRows}
        <tr style="background: #f8fafc; font-weight: 600;">
          <td>Total Ingreso Imponible (IESS)</td>
          <td style="text-align: right; font-family: monospace; color: #0f172a;">$${data.taxableIncome.toFixed(2)}</td>
        </tr>
      </table>

      <div class="table-section-title" style="margin-top: 14px;">2. Beneficios de Ley (Mensualizados)</div>
      <table class="data-table" style="margin-top: -1px;">
        <tr>
          <td>
            13er Sueldo (Bono Navideño)
            <div style="font-size: 9.5px; color: #64748b;">${data.monthlyThirteenth ? 'Mensualizado (1/12 computable)' : 'Acumulado (No se paga mensual)'}</div>
          </td>
          <td style="text-align: right; font-family: monospace; width: 35%;">
            ${data.monthlyThirteenth ? `$${data.thirteenthAmount.toFixed(2)}` : '<span style="color:#94a3b8;">$0.00 (Acumula)</span>'}
          </td>
        </tr>
        <tr>
          <td>
            14to Sueldo (Bono Escolar)
            <div style="font-size: 9.5px; color: #64748b;">${data.monthlyFourteenth ? `Mensualizado (1/12 SBU $${data.sbu.toFixed(2)})` : 'Acumulado (No se paga mensual)'}</div>
          </td>
          <td style="text-align: right; font-family: monospace;">
            ${data.monthlyFourteenth ? `$${data.fourteenthAmount.toFixed(2)}` : '<span style="color:#94a3b8;">$0.00 (Acumula)</span>'}
          </td>
        </tr>
        <tr>
          <td>
            Fondos de Reserva (8.33%)
            <div style="font-size: 9.5px; color: #64748b;">
              ${data.reserveFundsTreatment === 'pagar_ingreso' ? 'Mensualizado desde el 1er mes' : data.reserveFundsTreatment === 'pagar_ano' ? 'Aplica a partir del 2do año' : 'Acumulado en IESS'}
            </div>
          </td>
          <td style="text-align: right; font-family: monospace;">
            ${data.reserveFundsAmount > 0 ? `$${data.reserveFundsAmount.toFixed(2)}` : '<span style="color:#94a3b8;">$0.00</span>'}
          </td>
        </tr>
        <tr style="background: #f8fafc; font-weight: 600;">
          <td>Total Beneficios en Rol</td>
          <td style="text-align: right; font-family: monospace; color: #047857;">$${data.totalSocialBenefits.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <!-- Columna Deducciones y Retenciones -->
    <div>
      <div class="table-section-title">3. Aportes y Deducciones del Empleado</div>
      <table class="data-table" style="margin-top: -1px;">
        <tr>
          <td>
            Aporte Personal IESS (${(data.iessPersonalRate * 100).toFixed(2)}%)
            <div style="font-size: 9.5px; color: #64748b;">Sobre materia gravada ($${data.taxableIncome.toFixed(2)})</div>
          </td>
          <td style="text-align: right; font-family: monospace; width: 35%; color: #dc2626;">-$${data.iessPersonal.toFixed(2)}</td>
        </tr>
        ${deductionsRows}
        <tr style="background: #fef2f2; font-weight: 600;">
          <td>Total Deducciones y Retenciones</td>
          <td style="text-align: right; font-family: monospace; color: #dc2626;">-$${data.totalDeductions.toFixed(2)}</td>
        </tr>
      </table>

      <!-- Resumen para el Colaborador -->
      <div class="summary-card highlight" style="margin-top: 14px;">
        <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #047857; letter-spacing: 0.5px;">
          Líquido Estimado a Percibir (Bolsillo)
        </div>
        <div style="font-size: 24px; font-weight: 800; font-family: monospace; color: #065f46; margin: 6px 0 2px;">
          $${data.netToReceive.toFixed(2)}
        </div>
        <div style="font-size: 10px; color: #4b5563;">
          Total Ingresos ($${data.totalIncome.toFixed(2)}) - Total Deducciones ($${data.totalDeductions.toFixed(2)})
        </div>
      </div>

      <!-- Resumen para la Empresa -->
      <div class="summary-card company" style="margin-top: 12px;">
        <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #334155; letter-spacing: 0.5px;">
          Costo Total Mensual para la Empresa
        </div>
        <div style="font-size: 18px; font-weight: 800; font-family: monospace; color: #0f172a; margin: 4px 0 2px;">
          $${data.totalCompanyCost.toFixed(2)}
        </div>
        <div style="font-size: 10px; color: #64748b;">
          Incluye Aporte Patronal IESS (${(data.iessEmployerRate * 100).toFixed(2)}% = $${data.iessEmployer.toFixed(2)}) + Provisiones completas de ley.
        </div>
      </div>
    </div>
  </div>

  ${data.notes ? `
    <div style="margin-top: 14px;">
      <div class="table-section-title">Observaciones Especiales</div>
      <div style="border: 1px solid #cbd5e1; border-top: none; padding: 10px; font-size: 11px; color: #475569; background: #fff;">
        ${data.notes}
      </div>
    </div>
  ` : ''}

  <!-- Firmas referenciales -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 60px;">
    <div style="border-top: 1px solid #94a3b8; text-align: center; padding-top: 6px;">
      <div style="font-size: 11px; font-weight: 700; color: #1e293b;">Elaborado por: Gestión de Talento Humano</div>
      <div style="font-size: 10px; color: #64748b;">${orgLegalName}</div>
    </div>
    <div style="border-top: 1px solid #94a3b8; text-align: center; padding-top: 6px;">
      <div style="font-size: 11px; font-weight: 700; color: #1e293b;">Candidato / Interesado</div>
      <div style="font-size: 10px; color: #64748b;">Recibí y revisé simulación informativa</div>
    </div>
  </div>

  <div class="footer-note" style="margin-top: 30px;">
    Simulador Laboral RH Garden • ${orgLegalName} • Generado con fines de cotización de contratación
  </div>

  <script>
    window.onload = function() {
      window.focus();
      window.print();
      setTimeout(function() { window.close(); }, 1000);
    };
  </script>
</body>
</html>`

  return openPrintWindow(html)
}
