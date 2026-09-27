'use client'

import { Organization } from '@/types/employee'
import { resolveOrgHeaderFields } from '@/lib/print/document-header'
import { DOCUMENT_SHELL_STYLES, openPrintWindow } from '@/lib/print/document-shell'
import { buildEmployeeSignatureBlock } from '@/lib/employees/print-signature-block'

export type PayrollDiscountConcept =
  | 'consumo'
  | 'faltante_caja'
  | 'faltante_inventario'
  | 'alimentacion'
  | 'vivienda'

export interface PrintPayrollDiscountAuthorizationData {
  organization?: Partial<Organization> | null
  organizationName?: string
  employeeName: string
  nationalId: string
  position: string
  concepts: PayrollDiscountConcept[]
  /** Fecha de emisión del documento (YYYY-MM-DD). Permite generar el documento de forma retroactiva. */
  issueDate?: string
  documentCode?: string
}

interface ConceptCopy {
  label: string
  /** Párrafo de autorización específico del concepto, bajo "SOLICITO Y AUTORIZO". */
  authorizationText: (orgName: string) => string
  /** Reglas propias del concepto, se agregan a la lista numerada compartida. */
  rules: string[]
}

const CONCEPT_COPY: Record<PayrollDiscountConcept, ConceptCopy> = {
  consumo: {
    label: 'Consumos Internos',
    authorizationText: (orgName) =>
      `Que todos los consumos internos realizados a mi nombre dentro de las instalaciones de <em>${orgName}</em> sean registrados como CRÉDITO y descontados automáticamente de mi rol de pagos en el mes correspondiente.`,
    rules: [
      'Los consumos deben ser facturados a mi nombre.',
      'La factura deberá ser ingresada al sistema con forma de pago: CRÉDITO.',
      'Cada factura debe ser firmada por mí como validación y autorización.',
      'Todas las facturas firmadas serán archivadas por el Departamento Administrativo para su descuento correspondiente.',
      'El descuento de consumos se realizará cada mes con corte hasta el día 25.',
      'Comprendo que mis consumos no deben superar el 25% de mi sueldo, según la Política Interna de Consumos del Personal.',
    ],
  },
  faltante_caja: {
    label: 'Faltante de Caja',
    authorizationText: () =>
      `Que el valor correspondiente a los faltantes de caja detectados y verificados bajo mi responsabilidad como custodio/a de fondos sea descontado de mi rol de pagos en el mes correspondiente.`,
    rules: [
      'El faltante debe estar respaldado por el arqueo de caja y/o cierre de caja correspondiente.',
      'Se me notificará por escrito el monto y la fecha del faltante antes de aplicar el descuento.',
      'El descuento se realizará de forma proporcional, sin superar el porcentaje máximo permitido por la ley respecto de mi remuneración mensual.',
    ],
  },
  faltante_inventario: {
    label: 'Faltante de Inventario',
    authorizationText: () =>
      `Que el valor correspondiente a los faltantes de inventario o mercadería detectados y verificados bajo mi responsabilidad como custodio/a de dichos bienes sea descontado de mi rol de pagos en el mes correspondiente.`,
    rules: [
      'El faltante debe estar respaldado por el acta de conteo o toma física de inventario correspondiente.',
      'Se me notificará por escrito el detalle y valor del faltante antes de aplicar el descuento.',
      'El descuento se realizará de forma proporcional, sin superar el porcentaje máximo permitido por la ley respecto de mi remuneración mensual.',
    ],
  },
  alimentacion: {
    label: 'Alimentación',
    authorizationText: (orgName) =>
      `Que el valor correspondiente al beneficio de alimentación provisto por <em>${orgName}</em> sea descontado de mi rol de pagos en el mes correspondiente, conforme a la tarifa y condiciones establecidas por la empresa.`,
    rules: [
      'El valor a descontar corresponde únicamente al beneficio de alimentación efectivamente utilizado por mí.',
      'La tarifa aplicada será la vigente según la Política Interna de Beneficios del Personal.',
      'El descuento se realizará cada mes con corte hasta el día 25.',
    ],
  },
  vivienda: {
    label: 'Vivienda',
    authorizationText: (orgName) =>
      `Que el valor correspondiente al beneficio de vivienda/hospedaje provisto por <em>${orgName}</em> sea descontado de mi rol de pagos en el mes correspondiente, conforme a la tarifa y condiciones establecidas por la empresa.`,
    rules: [
      'El valor a descontar corresponde únicamente al beneficio de vivienda/hospedaje efectivamente utilizado por mí.',
      'La tarifa aplicada será la vigente según la Política Interna de Beneficios del Personal.',
      'El descuento se realizará cada mes con corte hasta el día 25.',
    ],
  },
}

/**
 * Documento de 3 firmas (colaborador, departamento administrativo, gerencia)
 * — distinto al bloque estándar de 2 firmas de `buildDocumentSignatures` —
 * por eso arma su propio pie de firmas en vez de usar `renderDocumentShell`.
 *
 * Cubre uno o varios conceptos de descuento (consumo, faltante de caja,
 * faltante de inventario, alimentación, vivienda) en un mismo documento,
 * cada uno con su propio párrafo de autorización y reglas.
 */
export function printPayrollDiscountAuthorizationDocument(
  data: PrintPayrollDiscountAuthorizationData
) {
  const { orgLegalName, orgName } = resolveOrgHeaderFields(data.organization, data.organizationName)
  const city = data.organization?.city || 'Tena'
  const issueDate = data.issueDate ? new Date(`${data.issueDate}T00:00:00`) : new Date()
  const issueDateFormatted = issueDate.toLocaleDateString('es-EC', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const concepts = data.concepts.length > 0 ? data.concepts : (['consumo'] as PayrollDiscountConcept[])
  const conceptsLabel = concepts.map((c) => CONCEPT_COPY[c].label).join(', ')

  const authorizationParagraphs = concepts
    .map((c) => `<p class="body-text">${CONCEPT_COPY[c].authorizationText(orgName)}</p>`)
    .join('')

  const allRules = [
    ...concepts.flatMap((c) => CONCEPT_COPY[c].rules),
    'Este beneficio es de uso personal, por lo que asumo total responsabilidad por los valores registrados bajo mi nombre y firma.',
  ]
  const rulesHtml = allRules.map((rule) => `<li style="margin-bottom:8px;">${rule}</li>`).join('')

  const bodyHtml = `
    <div class="doc-type-title" style="--doc-header-accent:#0f172a;">Solicitud y Autorización de Descuento a Rol de Pagos</div>

    <p class="body-text" style="margin-top:18px;">${city}, ${issueDateFormatted}</p>

    <p class="body-text">
      Yo, <strong>${data.employeeName.toUpperCase()}</strong> portador de la Cédula N°
      <strong>${data.nationalId || '—'}</strong> colaborador/a de <em>${orgName}</em>, en el cargo de
      ${data.position || '—'}, por medio de la presente:
    </p>

    <p class="body-text" style="font-weight:700;margin-top:18px;">SOLICITO Y AUTORIZO</p>

    <p class="body-text" style="font-style:italic;color:#555;">
      Concepto(s) de descuento autorizado(s): ${conceptsLabel}.
    </p>

    ${authorizationParagraphs}

    <p class="body-text">Declaro haber sido informado/a y aceptar que:</p>

    <ol class="body-text" style="padding-left:20px;margin:0 0 16px;">
      ${rulesHtml}
    </ol>

    <p class="body-text">
      Declaro que he leído y acepto íntegramente la Política Interna de Descuentos y Beneficios del
      Personal de ${orgLegalName}, y autorizo a la empresa a realizar los descuentos respectivos
      mientras haga uso de estos beneficios.
    </p>

    ${buildEmployeeSignatureBlock({
      employeeName: data.employeeName,
      receivedByRole: 'Departamento Administrativo',
    })}
  `

  const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Autorización de Descuento a Rol de Pagos - ${data.employeeName}</title>
        <style>
          ${DOCUMENT_SHELL_STYLES}
          :root { --doc-accent: #0f172a; }
        </style>
      </head>
      <body>
        ${bodyHtml}

        <div class="footer-note">Documento oficial • ${orgLegalName} • Control de Nómina y Asistencia</div>

        <script>
          window.onload = function() {
            window.focus();
            window.print();
            setTimeout(function() { window.close(); }, 1000);
          };
        </script>
      </body>
    </html>
  `

  openPrintWindow(html)
}
