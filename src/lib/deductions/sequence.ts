import { SupabaseClient } from '@supabase/supabase-js'
import { DeductionType } from '@/types/employee'

/**
 * Mapeo de códigos de 3 letras para cada tipo de descuento.
 */
export const DEDUCTION_PREFIX_MAP: Record<DeductionType | string, string> = {
  faltante_caja: 'FCA',
  inventario: 'INV',
  multa: 'MUL',
  prestamo: 'ANT',
  alimentacion: 'ALI',
  otro: 'DED',
}

/**
 * Obtiene el identificador de 3 letras + número para un descuento.
 * Si ya lo tiene en metadata o en el título lo devuelve; si no, queda vacío.
 */
export function getDeductionCode(deduction?: {
  title?: string
  metadata?: Record<string, any> | null
  deduction_type?: string
} | null): string {
  if (!deduction) return ''

  if (deduction.metadata?.document_code) {
    return deduction.metadata.document_code
  }

  const titleMatch = deduction.title?.match(/^\[([A-Z]{3}-\d+)\]/)
  if (titleMatch?.[1]) {
    return titleMatch[1]
  }

  const prefix = DEDUCTION_PREFIX_MAP[deduction.deduction_type || 'otro'] || 'DED'
  const seq = deduction.metadata?.sequence_number
  if (seq) {
    return `${prefix}-${Number(seq).toString().padStart(4, '0')}`
  }

  return ''
}

/**
 * Genera el siguiente código secuencial para descuentos por organización y tipo.
 * Formato: 3 LETRAS + Número consecutivo (ej. FCA-0001)
 */
export async function getNextDeductionSequenceCode(
  supabase: SupabaseClient,
  organizationId: string,
  deductionType: DeductionType | string
): Promise<{ code: string; sequenceNumber: number }> {
  const prefix = DEDUCTION_PREFIX_MAP[deductionType] || 'DED'

  try {
    const { data: deductions, error } = await supabase
      .from('deductions')
      .select('id, metadata')
      .eq('organization_id', organizationId)
      .eq('deduction_type', deductionType)

    if (error) {
      console.warn('Error consultando secuencia de descuentos:', error)
    }

    let maxSeq = 0
    if (deductions && deductions.length > 0) {
      for (const d of deductions) {
        const num = Number(d.metadata?.sequence_number)
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num
        }
      }
      if (maxSeq === 0) {
        maxSeq = deductions.length
      }
    }

    const nextSeq = maxSeq + 1
    const code = `${prefix}-${nextSeq.toString().padStart(4, '0')}`

    return { code, sequenceNumber: nextSeq }
  } catch (err) {
    console.error('Error generando secuencia para descuento:', err)
    return { code: `${prefix}-0001`, sequenceNumber: 1 }
  }
}
