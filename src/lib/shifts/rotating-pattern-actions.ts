'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { RotatingShiftPattern } from '@/types/employee'

/**
 * Crea o actualiza un patrón de horario rotativo (plantilla reutilizable,
 * ej. "4 libres + 10 trabajo"). RLS ya exige admin/owner para escribir, pero
 * se valida sesión igual antes de intentar la operación.
 */
export async function upsertRotatingPatternAction(input: {
  id?: string
  organizationId: string
  name: string
  cycleLength: number
  daysOff: number[]
}): Promise<{ success: boolean; error?: string; pattern?: RotatingShiftPattern }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado.' }

    if (!input.name.trim()) return { success: false, error: 'El nombre del patrón es obligatorio.' }
    if (input.cycleLength <= 0 || input.cycleLength > 90) {
      return { success: false, error: 'La duración del ciclo debe estar entre 1 y 90 días.' }
    }
    const invalidOffset = input.daysOff.some((d) => d < 0 || d >= input.cycleLength)
    if (invalidOffset) {
      return { success: false, error: 'Hay un día libre fuera del rango del ciclo.' }
    }

    const payload = {
      organization_id: input.organizationId,
      name: input.name.trim(),
      cycle_length: input.cycleLength,
      days_off: input.daysOff,
      updated_at: new Date().toISOString(),
    }

    const query = input.id
      ? supabase.from('rotating_shift_patterns').update(payload).eq('id', input.id).select().single()
      : supabase.from('rotating_shift_patterns').insert(payload).select().single()

    const { data, error } = await query

    if (error) return { success: false, error: error.message }

    revalidatePath('/employees')
    revalidatePath('/shifts/calendar')
    return { success: true, pattern: data as RotatingShiftPattern }
  } catch (err) {
    console.error(err)
    return { success: false, error: 'Ocurrió un error inesperado.' }
  }
}

export async function deleteRotatingPatternAction(
  patternId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado.' }

    const { error } = await supabase.from('rotating_shift_patterns').delete().eq('id', patternId)
    if (error) return { success: false, error: error.message }

    revalidatePath('/employees')
    revalidatePath('/shifts/calendar')
    return { success: true }
  } catch (err) {
    console.error(err)
    return { success: false, error: 'Ocurrió un error inesperado.' }
  }
}
