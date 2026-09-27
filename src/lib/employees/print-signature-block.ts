'use client'

/**
 * Bloque de firmas compartido por los documentos de la pestaña "Documentos"
 * del expediente de empleado (Décimos, Descuento a Rol de Pagos, Pago
 * Quincenal, Carta de Renuncia). En todos ellos solo firma el empleado; el
 * lado de la empresa es una constancia de "Recibido por", no una firma de
 * autorización — por eso siempre se muestra primero el empleado.
 */

export interface EmployeeSignatureBlockOptions {
  employeeName: string
  /** Texto bajo la firma del empleado (por defecto "Firma del Colaborador/a"). */
  employeeRole?: string
  /** Texto bajo la línea de recepción de la empresa (ej. "Talento Humano", "Departamento Administrativo", "Gerencia"). */
  receivedByRole: string
}

export function buildEmployeeSignatureBlock(opts: EmployeeSignatureBlockOptions): string {
  const employeeRole = opts.employeeRole || 'Firma del Colaborador/a'

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:70px;margin-top:70px;align-items:start;">
      <div style="text-align:center;border-top:1px solid #1a1a1a;padding-top:6px;">
        <div style="font-size:11px;font-weight:700;color:#1a1a1a;">${opts.employeeName}</div>
        <div style="font-size:10px;color:#555;">${employeeRole}</div>
      </div>
      <div style="text-align:center;border-top:1px solid #1a1a1a;padding-top:6px;">
        <div style="font-size:11px;font-weight:700;color:#1a1a1a;">&nbsp;</div>
        <div style="font-size:10px;color:#555;">Recibido por — ${opts.receivedByRole}</div>
        <div style="font-size:10px;color:#555;margin-top:14px;">Fecha: _______________</div>
      </div>
    </div>
  `
}
