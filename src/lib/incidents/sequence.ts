import { SupabaseClient } from '@supabase/supabase-js'
import { IncidentType } from '@/types/employee'

/**
 * Mapeo de códigos de 3 letras para cada tipo de incidencia/solicitud/documento:
 * - anticipo_sueldo        -> 'ANT' (Anticipo de Sueldo)
 * - llamado_atencion       -> 'LLA' (Llamado de Atención)
 * - actividad_no_conforme  -> 'ANC' (Actividad No Conforme)
 * - solicitud_vacaciones   -> 'VAC' (Vacaciones)
 * - permiso_laboral        -> 'PER' (Permiso Laboral)
 * - incapacidad            -> 'MED' (Permiso Médico / Incapacidad)
 * - otro                   -> 'DOC' (Documento General)
 */
export const INCIDENT_PREFIX_MAP: Record<IncidentType | string, string> = {
  anticipo_sueldo: 'ANT',
  llamado_atencion: 'LLA',
  actividad_no_conforme: 'ANC',
  solicitud_vacaciones: 'VAC',
  permiso_laboral: 'PER',
  incapacidad: 'MED',
  acta_entrega: 'ACT',
  certificado_trabajo: 'CER',
  horas_extras: 'HEX',
  cambio_horario: 'CAM',
  otro: 'DOC',
}

/**
 * Obtiene el identificador de 3 letras + número para una incidencia.
 * Si ya lo tiene en metadata o en el título lo devuelve;
 * si no, genera un código determinista basado en los últimos 4 caracteres de su ID o fecha.
 */
export function getIncidentCode(incident?: {
  id?: string
  incident_type?: string
  title?: string
  metadata?: Record<string, any> | null
  created_at?: string
} | null): string {
  if (!incident) return ''

  // 1. Si ya está guardado explícitamente en metadata
  if (incident.metadata?.document_code) {
    return incident.metadata.document_code
  }

  // 2. Si está en el título entre corchetes ej: [ANT-0001]
  const titleMatch = incident.title?.match(/^\[([A-Z]{3}-\d+)\]/)
  if (titleMatch?.[1]) {
    return titleMatch[1]
  }

  const effectiveType =
    incident.metadata?.sub_type ||
    incident.incident_type ||
    'otro'

  const prefix = INCIDENT_PREFIX_MAP[effectiveType] || 'DOC'
  const seq = incident.metadata?.sequence_number
  if (seq) {
    return `${prefix}-${Number(seq).toString().padStart(4, '0')}`
  }

  return ''
}

/**
 * Obtiene el identificador de 3 letras + número para una solicitud de turnos (shift_requests).
 */
export function getShiftRequestCode(request?: {
  id?: string
  request_type?: string
  title?: string
  metadata?: Record<string, any> | null
  created_at?: string
} | null): string {
  if (!request) return ''

  // 1. Guardado explícitamente en metadata
  if (request.metadata?.document_code) {
    return request.metadata.document_code
  }

  // 2. En el título entre corchetes ej: [PER-0001]
  const titleMatch = request.title?.match(/^\[([A-Z]{3}-\d+)\]/)
  if (titleMatch?.[1]) {
    return titleMatch[1]
  }

  // Resolver sub_type si fue guardado como 'otro'
  const effectiveType =
    request.metadata?.sub_type ||
    (request.request_type === 'otro' ? 'permiso_laboral' : request.request_type) ||
    'DOC'

  const prefix = INCIDENT_PREFIX_MAP[effectiveType] || 'DOC'
  const seq = request.metadata?.sequence_number
  if (seq) {
    return `${prefix}-${Number(seq).toString().padStart(4, '0')}`
  }

  return ''
}

/**
 * Fallback no atómico (comportamiento anterior): calcula el máximo
 * sequence_number ya usado en `table` para esa organización/tipo y usa
 * max+1. Tiene una condición de carrera real bajo concurrencia — se usa
 * solo si el RPC atómico `get_next_document_sequence` aún no existe en la
 * base de datos (p. ej. antes de aplicar la migración
 * add_atomic_sequence_counters.sql).
 */
async function getNextSequenceFallback(
  supabase: SupabaseClient,
  table: 'shift_requests' | 'incidents',
  typeColumn: 'request_type' | 'incident_type',
  organizationId: string,
  documentType: string
): Promise<number> {
  const { data: rows, error } = await supabase
    .from(table)
    .select('id, metadata')
    .eq('organization_id', organizationId)
    .or(`${typeColumn}.eq.${documentType},metadata->>sub_type.eq.${documentType}`)

  if (error) {
    console.warn(`Error consultando secuencia de ${table} (fallback):`, error)
  }

  let maxSeq = 0
  if (rows && rows.length > 0) {
    for (const row of rows) {
      const num = Number(row.metadata?.sequence_number)
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num
      }
    }
    if (maxSeq === 0) {
      maxSeq = rows.length
    }
  }

  return maxSeq + 1
}

/**
 * Genera el siguiente código secuencial (3 letras + número, ej. PER-0001)
 * para una organización y tipo de documento, usando un contador atómico en
 * Postgres (get_next_document_sequence) compartido entre shift_requests e
 * incidents — mismo tipo de documento (ej. 'solicitud_vacaciones') nunca
 * desincroniza su numeración sin importar en qué tabla se consulte o
 * inserte primero, y dos inserciones concurrentes nunca pueden obtener el
 * mismo número (a diferencia del cálculo anterior basado en SELECT MAX).
 *
 * Si el RPC todavía no existe (antes de aplicar
 * supabase/migrations/add_atomic_sequence_counters.sql), cae de vuelta al
 * cálculo anterior no atómico para no romper la creación de solicitudes.
 */
async function getNextDocumentSequenceCode(
  supabase: SupabaseClient,
  table: 'shift_requests' | 'incidents',
  typeColumn: 'request_type' | 'incident_type',
  organizationId: string,
  documentType: string
): Promise<{ code: string; sequenceNumber: number }> {
  const prefix = INCIDENT_PREFIX_MAP[documentType] || 'DOC'

  try {
    const { data: nextSeq, error } = await supabase.rpc('get_next_document_sequence', {
      p_organization_id: organizationId,
      p_document_type: documentType,
    })

    if (error) {
      // Función aún no existe (migración no aplicada) u otro error de RPC:
      // usar el cálculo anterior como respaldo en vez de fallar la solicitud.
      console.warn('get_next_document_sequence no disponible, usando fallback no atómico:', error.message)
      const seq = await getNextSequenceFallback(supabase, table, typeColumn, organizationId, documentType)
      return { code: `${prefix}-${seq.toString().padStart(4, '0')}`, sequenceNumber: seq }
    }

    const seq = Number(nextSeq)
    return { code: `${prefix}-${seq.toString().padStart(4, '0')}`, sequenceNumber: seq }
  } catch (err) {
    console.error('Error generando secuencia de documento:', err)
    return { code: `${prefix}-0001`, sequenceNumber: 1 }
  }
}

/**
 * Genera el siguiente código secuencial para shift_requests por organización.
 */
export async function getNextShiftRequestSequenceCode(
  supabase: SupabaseClient,
  organizationId: string,
  requestType: string
): Promise<{ code: string; sequenceNumber: number }> {
  return getNextDocumentSequenceCode(supabase, 'shift_requests', 'request_type', organizationId, requestType)
}

/**
 * Genera el siguiente código secuencial para una organización y tipo de documento.
 * Formato: 3 LETRAS + Número consecutivo (ej. ANT-0001, LLA-0001, ANC-0001, VAC-0001)
 * El intervalo e incremento son estrictamente por organización.
 */
export async function getNextIncidentSequenceCode(
  supabase: SupabaseClient,
  organizationId: string,
  incidentType: IncidentType | string
): Promise<{ code: string; sequenceNumber: number }> {
  return getNextDocumentSequenceCode(supabase, 'incidents', 'incident_type', organizationId, incidentType)
}
