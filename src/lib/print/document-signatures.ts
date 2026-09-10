'use client'

/**
 * Bloque de firmas estándar para los documentos imprimibles del sistema.
 *
 * Constante en casi todos los documentos: dos columnas, primero la
 * autorización de la jefatura inmediata / Talento Humano y luego la
 * recepción del colaborador.
 *
 * Se usa junto con `DOCUMENT_SIGNATURES_STYLES` (el CSS compartido) dentro
 * del <style> de cada plantilla, y `buildDocumentSignatures(...)` para el
 * HTML.
 */

export interface DocumentSignaturesData {
  employeeName: string
  /** Etiqueta bajo la firma de la jefatura (por defecto "Firma y Sello — Autorización"). */
  approverRole?: string
  /** Nombre/cargo de quien autoriza (por defecto "Jefatura Inmediata / Talento Humano"). */
  approverName?: string
  /** Etiqueta bajo la firma del colaborador (por defecto "Firma del Colaborador — Recepción"). */
  employeeRole?: string
  /**
   * Etiqueta de estado que se muestra sobre la firma de la jefatura cuando el
   * documento ya fue resuelto (ej. "Autorizado", "Rechazado"). El documento
   * firmado se conserva aparte como copia física.
   */
  approverStatusNote?: string
  /** Fecha de resolución, se muestra en una segunda línea bajo la etiqueta. */
  approverStatusDate?: string
}

export const DOCUMENT_SIGNATURES_STYLES = `
  .doc-signatures {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 70px;
    margin-top: 70px;
    align-items: start;
  }
  .doc-signatures.has-status {
    margin-top: 116px;
  }
  .doc-sign-box {
    text-align: center;
    border-top: 1px solid #1a1a1a;
    padding-top: 6px;
    position: relative;
  }
  .doc-sign-status {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 100%;
    padding-bottom: 5px;
    font-family: Georgia, "Times New Roman", serif;
    color: #b02a2a;
    text-align: center;
    pointer-events: none;
    line-height: 1.4;
  }
  .doc-sign-status-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .doc-sign-status-date {
    font-size: 9.5px;
    font-style: italic;
  }
  .doc-sign-name {
    font-size: 11px;
    font-weight: 700;
    color: #1a1a1a;
  }
  .doc-sign-role {
    font-size: 10px;
    color: #555;
  }
`

export function buildDocumentSignatures(data: DocumentSignaturesData): string {
  const approverName = data.approverName || 'Jefatura Inmediata / Talento Humano'
  const approverRole = data.approverRole || 'Firma y Sello — Autorización'
  const employeeRole = data.employeeRole || 'Firma del Colaborador — Recepción'

  return `
    <div class="doc-signatures${data.approverStatusNote ? ' has-status' : ''}">
      <div class="doc-sign-box">
        ${data.approverStatusNote ? `<div class="doc-sign-status">
          <div class="doc-sign-status-label">${data.approverStatusNote}</div>
          ${data.approverStatusDate ? `<div class="doc-sign-status-date">Fecha: ${data.approverStatusDate}</div>` : ''}
        </div>` : ''}
        <div class="doc-sign-name">${approverName}</div>
        <div class="doc-sign-role">${approverRole}</div>
      </div>
      <div class="doc-sign-box">
        <div class="doc-sign-name">${data.employeeName}</div>
        <div class="doc-sign-role">${employeeRole}</div>
      </div>
    </div>
  `
}
