'use client'

import { Organization } from '@/types/employee'

/**
 * Encabezado estándar para todos los documentos imprimibles del sistema
 * (solicitudes, incidencias, descuentos, certificados, etc.):
 *
 *   Izquierda: Logo (opcional) + Razón Social + RUC + Contacto
 *   Derecha:   Código de documento (N°) + Fecha de registro
 *
 * Se usa junto con `DOCUMENT_HEADER_STYLES` (el CSS compartido) dentro del
 * <style> de cada plantilla, y `buildDocumentHeader(...)` para el HTML.
 * Cada plantilla puede seguir agregando su propio contenido a la derecha
 * (ej. un tag de estado o severidad) vía el parámetro `extraRight`.
 */

export interface DocumentHeaderData {
  organization?: Partial<Organization> | null
  organizationName?: string
  documentCode?: string
  issueDateFormatted: string
  /** HTML adicional debajo de fecha, en la misma columna derecha (ej. status-tag). */
  extraRight?: string
  /** Color de acento para el borde inferior del header y el título del tipo de documento (por defecto #0f172a). */
  accentColor?: string
  /** Título del tipo de documento (ej. "Solicitud de Vacaciones"), centrado debajo del encabezado. */
  docTypeTitle?: string
}

export const DOCUMENT_HEADER_STYLES = `
  .doc-header {
    border-bottom: 1.5px solid var(--doc-header-accent, #0f172a);
    padding-bottom: 8px;
    margin-bottom: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .doc-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
  }
  .doc-header-logo {
    height: 32px;
    width: auto;
    max-width: 160px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .doc-header-org-name {
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: -0.2px;
    margin: 0;
    color: #0f172a;
    line-height: 1.25;
  }
  .doc-header-meta {
    font-size: 9px;
    color: #64748b;
    margin-top: 1px;
  }
  .doc-header-right {
    text-align: right;
    min-width: 180px;
  }
  .doc-header-code {
    font-size: 11px;
    font-weight: 800;
    color: #0f172a;
    font-family: monospace;
  }
  .doc-header-date {
    font-size: 9.5px;
    color: #64748b;
    margin-top: 2px;
  }
  .doc-type-title {
    text-align: center;
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--doc-header-accent, #0f172a);
    margin: 0 0 16px;
  }
`

/**
 * Devuelve la razón social, RUC, contacto y logo ya resueltos con sus
 * fallbacks estándar, para que cada plantilla los use también en el cuerpo
 * del documento si lo necesita.
 */
export function resolveOrgHeaderFields(
  organization?: Partial<Organization> | null,
  organizationName?: string
) {
  const org = organization || {}
  const orgName = org.name || organizationName || 'RH Garden'
  const orgLegalName = org.legal_name || orgName
  const orgTaxId = org.tax_id || ''
  const orgContact = org.email || ''
  const orgLogoUrl = org.logo_url || ''
  return { orgName, orgLegalName, orgTaxId, orgContact, orgLogoUrl }
}


export function buildDocumentHeader(data: DocumentHeaderData): string {
  const { orgLegalName, orgTaxId, orgLogoUrl } = resolveOrgHeaderFields(
    data.organization,
    data.organizationName
  )

  const accentStyle = data.accentColor ? ` style="--doc-header-accent: ${data.accentColor}"` : ''

  return `
    <div class="doc-header"${accentStyle}>
      <div class="doc-header-left">
        ${orgLogoUrl ? `<img class="doc-header-logo" src="${orgLogoUrl}" alt="" />` : ''}
        <div>
          <h1 class="doc-header-org-name">${orgLegalName}</h1>
          ${orgTaxId ? `<div class="doc-header-meta">RUC: ${orgTaxId}</div>` : ''}
        </div>
      </div>
      <div class="doc-header-right">
        ${data.documentCode ? `<div class="doc-header-code">N° ${data.documentCode}</div>` : ''}
        <div class="doc-header-date">Fecha de registro: ${data.issueDateFormatted}</div>
        ${data.extraRight || ''}
      </div>
    </div>
    ${data.docTypeTitle ? `<div class="doc-type-title"${accentStyle}>${data.docTypeTitle}</div>` : ''}
  `
}
