'use server'

import { createClient } from '@/lib/supabase/server'
import { Deduction } from '@/types/employee'
import { DeliveryAssetItem } from '@/lib/incidents/constants'
import { revalidatePath } from 'next/cache'
import { getNextDeductionSequenceCode } from './sequence'

export interface DeliveryActWithAvailableItems {
  id: string
  document_code: string
  delivery_date: string
  items: DeliveryAssetItem[]
  availableItems: DeliveryAssetItem[]
}

/**
 * Obtiene las actas de entrega-recepción ACTIVAS (status distinto de 'anulado')
 * de un empleado, junto con los ítems que aún no han sido usados en un
 * descuento de inventario vigente (excluye ítems ya descontados salvo que
 * ese descuento previo haya sido anulado).
 *
 * Regla de negocio: solo se puede descontar por inventario bienes que
 * consten en un acta de entrega-recepción activa del empleado.
 */
export async function getActiveDeliveryActsForEmployee(
  employeeId: string
): Promise<DeliveryActWithAvailableItems[]> {
  const supabase = await createClient()

  const { data: acts, error } = await supabase
    .from('incidents')
    .select('id, status, metadata')
    .eq('employee_id', employeeId)
    .eq('incident_type', 'acta_entrega')
    .neq('status', 'anulado')

  if (error || !acts || acts.length === 0) {
    return []
  }

  // Ítems ya vinculados a un descuento de inventario vigente (no anulado)
  const { data: existingDeductions } = await supabase
    .from('deductions')
    .select('status, metadata')
    .eq('employee_id', employeeId)
    .eq('deduction_type', 'inventario')
    .neq('status', 'anulado')

  const consumedItemIds = new Set<string>()
  for (const ded of existingDeductions || []) {
    const linkedIds: string[] = ded.metadata?.delivery_item_ids || []
    linkedIds.forEach((id) => consumedItemIds.add(id))
  }

  return acts.map((act) => {
    const items: DeliveryAssetItem[] = act.metadata?.items || []
    const availableItems = items.filter((it) => !consumedItemIds.has(it.id))
    return {
      id: act.id,
      document_code: act.metadata?.document_code || '',
      delivery_date: act.metadata?.delivery_date || '',
      items,
      availableItems,
    }
  })
}

export interface CreateCashShortageDeductionParams {
  organizationId: string
  employeeId: string
  cashDate: string
  amount: number
  reason: string
  periodMonth?: number
  periodYear?: number
  metadata?: Record<string, any>
}

/**
 * Crea un descuento por Faltante de Caja.
 * No requiere aprobación: queda directamente como "Aplicado en Rol".
 * Puede anularse posteriormente mediante cancelDeductionAction.
 */
export async function createCashShortageDeductionAction(
  params: CreateCashShortageDeductionParams
): Promise<{ success: boolean; data?: Deduction; error?: string }> {
  try {
    if (!params.reason?.trim()) {
      return { success: false, error: 'Indica el motivo del faltante de caja.' }
    }

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado. Inicia sesión nuevamente.' }
    }

    const { code, sequenceNumber } = await getNextDeductionSequenceCode(
      supabase,
      params.organizationId,
      'faltante_caja'
    )

    const today = new Date()
    const fullTitle = `[${code}] Faltante de Caja`
    const periodMonth = params.periodMonth || today.getMonth() + 1
    const periodYear = params.periodYear || today.getFullYear()

    const combinedMetadata = {
      ...(params.metadata || {}),
      document_code: code,
      sequence_number: sequenceNumber,
      cash_date: params.cashDate,
      issue_date: today.toISOString().split('T')[0],
      registered_by: user.email || user.id,
      period_month: periodMonth,
      period_year: periodYear,
    }

    const { data, error } = await supabase
      .from('deductions')
      .insert({
        organization_id: params.organizationId,
        employee_id: params.employeeId,
        deduction_type: 'faltante_caja',
        title: fullTitle,
        description: params.reason.trim(),
        amount: params.amount,
        is_recurring: false,
        status: 'aplicado', // No requiere aprobación
        period_month: periodMonth,
        period_year: periodYear,
        date: params.cashDate,
        metadata: combinedMetadata,
      })
      .select(
        `
        *,
        employee:employees (
          id,
          full_name,
          national_id,
          department,
          position,
          avatar_url
        )
      `
      )
      .single()

    if (error) {
      console.error('Error creando descuento por faltante de caja:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/deductions')
    revalidatePath(`/employees/${params.employeeId}`)

    return { success: true, data: data as Deduction }
  } catch (err: any) {
    console.error('Catch en createCashShortageDeductionAction:', err)
    return {
      success: false,
      error: err?.message || 'Error inesperado al registrar el descuento.',
    }
  }
}

export interface CreateDisciplinaryFineDeductionParams {
  organizationId: string
  employeeId: string
  fineDate: string
  amount: number
  employeeBaseSalary: number
  regulationArticle: string
  infractionDescription: string
  additionalInfo?: string
  metadata?: Record<string, any>
}

/**
 * Crea un descuento por Multa Disciplinaria.
 *
 * Marco legal (Código del Trabajo de Ecuador):
 * - Art. 44 lit. a): la multa solo es procedente si está prevista en el
 *   reglamento interno legalmente aprobado (se exige artículo/numeral).
 * - Art. 44 lit. b): el empleador no puede retener más del 10% de la
 *   remuneración mensual del trabajador por concepto de multas. Se valida
 *   en servidor además de en el cliente, como defensa en profundidad.
 *
 * No requiere aprobación: queda directamente como "Aplicado en Rol".
 * Puede anularse posteriormente mediante cancelDeductionAction.
 */
export async function createDisciplinaryFineDeductionAction(
  params: CreateDisciplinaryFineDeductionParams
): Promise<{ success: boolean; data?: Deduction; error?: string }> {
  try {
    if (!params.regulationArticle?.trim()) {
      return {
        success: false,
        error: 'Debes indicar el artículo/numeral del reglamento interno que tipifica la falta (Art. 44 lit. a del Código del Trabajo).',
      }
    }

    const maxAllowed = Number((params.employeeBaseSalary * 0.1).toFixed(2))
    if (params.employeeBaseSalary > 0 && params.amount > maxAllowed) {
      return {
        success: false,
        error: `El monto excede el límite legal del 10% de la remuneración mensual (máximo $${maxAllowed.toFixed(2)} USD). Art. 44 lit. b) del Código del Trabajo.`,
      }
    }

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado. Inicia sesión nuevamente.' }
    }

    const { code, sequenceNumber } = await getNextDeductionSequenceCode(
      supabase,
      params.organizationId,
      'multa'
    )

    const today = new Date()
    const fullTitle = `[${code}] Multa Disciplinaria`

    const combinedMetadata = {
      ...(params.metadata || {}),
      document_code: code,
      sequence_number: sequenceNumber,
      fine_date: params.fineDate,
      issue_date: today.toISOString().split('T')[0],
      registered_by: user.email || user.id,
      employee_base_salary: params.employeeBaseSalary,
      regulation_article: params.regulationArticle.trim(),
      infraction_description: params.infractionDescription.trim(),
      fine_ratio: params.employeeBaseSalary > 0
        ? Number(((params.amount / params.employeeBaseSalary) * 100).toFixed(2))
        : null,
    }

    const { data, error } = await supabase
      .from('deductions')
      .insert({
        organization_id: params.organizationId,
        employee_id: params.employeeId,
        deduction_type: 'multa',
        title: fullTitle,
        description: params.additionalInfo?.trim() || null,
        amount: params.amount,
        is_recurring: false,
        status: 'aplicado', // No requiere aprobación
        period_month: today.getMonth() + 1,
        period_year: today.getFullYear(),
        date: params.fineDate,
        metadata: combinedMetadata,
      })
      .select(
        `
        *,
        employee:employees (
          id,
          full_name,
          national_id,
          department,
          position,
          avatar_url
        )
      `
      )
      .single()

    if (error) {
      console.error('Error creando descuento por multa disciplinaria:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/deductions')
    revalidatePath(`/employees/${params.employeeId}`)

    return { success: true, data: data as Deduction }
  } catch (err: any) {
    console.error('Catch en createDisciplinaryFineDeductionAction:', err)
    return {
      success: false,
      error: err?.message || 'Error inesperado al registrar la multa disciplinaria.',
    }
  }
}

export interface CreateInventoryDeductionParams {
  organizationId: string
  employeeId: string
  deliveryActIncidentId: string
  selectedItemIds: string[]
  deductionDate: string
  additionalInfo?: string
  metadata?: Record<string, any>
}

/**
 * Crea un descuento por Inventario, vinculado obligatoriamente a un acta de
 * entrega-recepción ACTIVA del empleado y a los ítems específicos de esa
 * acta que se están descontando (no se admite monto libre desvinculado de
 * bienes realmente entregados).
 *
 * No requiere aprobación: queda directamente como "Aplicado en Rol".
 * Puede anularse posteriormente mediante cancelDeductionAction, lo que
 * libera los ítems para que puedan corregirse/re-descontarse si aplica.
 */
export async function createInventoryDeductionAction(
  params: CreateInventoryDeductionParams
): Promise<{ success: boolean; data?: Deduction; error?: string }> {
  try {
    if (!params.selectedItemIds || params.selectedItemIds.length === 0) {
      return { success: false, error: 'Selecciona al menos un bien del acta a descontar.' }
    }

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado. Inicia sesión nuevamente.' }
    }

    // Re-validar en servidor que el acta pertenece al empleado y está activa
    const { data: act, error: actError } = await supabase
      .from('incidents')
      .select('id, status, employee_id, metadata')
      .eq('id', params.deliveryActIncidentId)
      .eq('incident_type', 'acta_entrega')
      .single()

    if (actError || !act) {
      return { success: false, error: 'No se encontró el acta de entrega-recepción indicada.' }
    }

    if (act.employee_id !== params.employeeId) {
      return { success: false, error: 'El acta seleccionada no corresponde a este empleado.' }
    }

    if (act.status === 'anulado') {
      return {
        success: false,
        error: 'No se puede descontar contra un acta de entrega-recepción anulada.',
      }
    }

    const actItems: DeliveryAssetItem[] = act.metadata?.items || []
    const selectedItems = actItems.filter((it) => params.selectedItemIds.includes(it.id))

    if (selectedItems.length !== params.selectedItemIds.length) {
      return {
        success: false,
        error: 'Uno o más bienes seleccionados no existen en el acta indicada.',
      }
    }

    // Re-validar en servidor que ninguno de los ítems ya fue descontado
    const { data: existingDeductions } = await supabase
      .from('deductions')
      .select('metadata')
      .eq('employee_id', params.employeeId)
      .eq('deduction_type', 'inventario')
      .neq('status', 'anulado')

    const consumedItemIds = new Set<string>()
    for (const ded of existingDeductions || []) {
      const linkedIds: string[] = ded.metadata?.delivery_item_ids || []
      linkedIds.forEach((id) => consumedItemIds.add(id))
    }

    const alreadyConsumed = params.selectedItemIds.some((id) => consumedItemIds.has(id))
    if (alreadyConsumed) {
      return {
        success: false,
        error: 'Uno o más bienes seleccionados ya fueron descontados previamente.',
      }
    }

    const totalAmount = selectedItems.reduce((acc, it) => acc + (Number(it.totalValue) || 0), 0)

    const { code, sequenceNumber } = await getNextDeductionSequenceCode(
      supabase,
      params.organizationId,
      'inventario'
    )

    const today = new Date()
    const fullTitle = `[${code}] Descuento por Inventario`
    const itemsSummary = selectedItems.map((it) => `${it.description} (x${it.quantity})`).join(', ')

    const combinedMetadata = {
      ...(params.metadata || {}),
      document_code: code,
      sequence_number: sequenceNumber,
      registered_by: user.email || user.id,
      issue_date: today.toISOString().split('T')[0],
      delivery_act_incident_id: params.deliveryActIncidentId,
      delivery_act_document_code: act.metadata?.document_code || '',
      delivery_item_ids: params.selectedItemIds,
      delivery_items_detail: selectedItems,
      items_summary: itemsSummary,
    }

    const { data, error } = await supabase
      .from('deductions')
      .insert({
        organization_id: params.organizationId,
        employee_id: params.employeeId,
        deduction_type: 'inventario',
        title: fullTitle,
        description: params.additionalInfo?.trim() || itemsSummary,
        amount: totalAmount,
        is_recurring: false,
        status: 'aplicado', // No requiere aprobación
        period_month: today.getMonth() + 1,
        period_year: today.getFullYear(),
        date: params.deductionDate,
        metadata: combinedMetadata,
      })
      .select(
        `
        *,
        employee:employees (
          id,
          full_name,
          national_id,
          department,
          position,
          avatar_url
        )
      `
      )
      .single()

    if (error) {
      console.error('Error creando descuento por inventario:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/deductions')
    revalidatePath(`/employees/${params.employeeId}`)

    return { success: true, data: data as Deduction }
  } catch (err: any) {
    console.error('Catch en createInventoryDeductionAction:', err)
    return {
      success: false,
      error: err?.message || 'Error inesperado al registrar el descuento de inventario.',
    }
  }
}

export interface CreateRecurringMealHousingDeductionParams {
  organizationId: string
  employeeId: string
  calculationMode: 'fijo' | 'por_dias'
  amount: number
  detail: string
  startDate: string
  metadata?: Record<string, any>
}

/**
 * Crea una regla RECURRENTE de descuento por Alimentación/Vivienda.
 *
 * Es una regla activa única (is_recurring=true), no un registro por mes:
 * el generador de reporte de nómina la incluye automáticamente en cada
 * corte mientras esté activa (status distinto de 'anulado'), calculando
 * el monto según la modalidad:
 * - 'fijo': el mismo valor cada período.
 * - 'por_dias': valor diario × días efectivamente trabajados en el corte.
 *
 * No requiere aprobación: queda activa de inmediato. Se desactiva
 * anulándola (cancelDeductionAction) y se puede reactivar
 * (reactivateRecurringDeductionAction) sin perder el histórico.
 * Solo puede existir una regla activa de este tipo por empleado.
 */
export async function createRecurringMealHousingDeductionAction(
  params: CreateRecurringMealHousingDeductionParams
): Promise<{ success: boolean; data?: Deduction; error?: string }> {
  try {
    if (!params.detail?.trim()) {
      return { success: false, error: 'Indica el detalle del descuento (ej. Vivienda, Comedor).' }
    }

    if (params.amount <= 0) {
      return { success: false, error: 'Ingresa un valor válido para el descuento.' }
    }

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado. Inicia sesión nuevamente.' }
    }

    // Solo una regla recurrente activa de este tipo por empleado
    const { data: existingActive } = await supabase
      .from('deductions')
      .select('id')
      .eq('employee_id', params.employeeId)
      .eq('deduction_type', 'alimentacion')
      .eq('is_recurring', true)
      .neq('status', 'anulado')
      .limit(1)

    if (existingActive && existingActive.length > 0) {
      return {
        success: false,
        error: 'Este empleado ya tiene una regla de descuento recurrente activa. Anúlala antes de crear una nueva.',
      }
    }

    const { code, sequenceNumber } = await getNextDeductionSequenceCode(
      supabase,
      params.organizationId,
      'alimentacion'
    )

    const today = new Date()
    const fullTitle = `[${code}] ${params.detail.trim()}`

    const combinedMetadata = {
      ...(params.metadata || {}),
      document_code: code,
      sequence_number: sequenceNumber,
      issue_date: today.toISOString().split('T')[0],
      registered_by: user.email || user.id,
      calculation_mode: params.calculationMode,
      // Para 'fijo': monto mensual. Para 'por_dias': valor diario (se
      // multiplica por los días trabajados de cada corte al calcular nómina).
      base_amount: params.amount,
      detail: params.detail.trim(),
      start_date: params.startDate,
    }

    const { data, error } = await supabase
      .from('deductions')
      .insert({
        organization_id: params.organizationId,
        employee_id: params.employeeId,
        deduction_type: 'alimentacion',
        title: fullTitle,
        description: params.detail.trim(),
        amount: params.amount,
        is_recurring: true,
        status: 'aplicado', // Regla activa, no requiere aprobación
        period_month: today.getMonth() + 1,
        period_year: today.getFullYear(),
        date: params.startDate,
        metadata: combinedMetadata,
      })
      .select(
        `
        *,
        employee:employees (
          id,
          full_name,
          national_id,
          department,
          position,
          avatar_url
        )
      `
      )
      .single()

    if (error) {
      console.error('Error creando regla de descuento por alimentación/vivienda:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/deductions')
    revalidatePath('/payroll')
    revalidatePath(`/employees/${params.employeeId}`)

    return { success: true, data: data as Deduction }
  } catch (err: any) {
    console.error('Catch en createRecurringMealHousingDeductionAction:', err)
    return {
      success: false,
      error: err?.message || 'Error inesperado al registrar la regla de descuento.',
    }
  }
}

export interface ReactivateDeductionParams {
  deductionId: string
}

/**
 * Reactiva una regla recurrente previamente anulada (vuelve a 'aplicado').
 * Solo aplicable a descuentos recurrentes (is_recurring=true); valida que
 * no exista ya otra regla activa del mismo tipo para el empleado.
 */
export async function reactivateRecurringDeductionAction(
  params: ReactivateDeductionParams
): Promise<{ success: boolean; data?: Deduction; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado. Inicia sesión nuevamente.' }
    }

    const { data: current, error: fetchError } = await supabase
      .from('deductions')
      .select('*')
      .eq('id', params.deductionId)
      .single()

    if (fetchError || !current) {
      return { success: false, error: 'Descuento no encontrado.' }
    }

    if (!current.is_recurring) {
      return { success: false, error: 'Solo las reglas recurrentes pueden reactivarse.' }
    }

    const { data: existingActive } = await supabase
      .from('deductions')
      .select('id')
      .eq('employee_id', current.employee_id)
      .eq('deduction_type', current.deduction_type)
      .eq('is_recurring', true)
      .neq('status', 'anulado')
      .neq('id', params.deductionId)
      .limit(1)

    if (existingActive && existingActive.length > 0) {
      return {
        success: false,
        error: 'Ya existe otra regla recurrente activa de este tipo para el empleado.',
      }
    }

    const updatedMetadata = {
      ...(current.metadata || {}),
      reactivated_at: new Date().toISOString(),
      reactivated_by: user.email || user.id,
    }

    const { data, error } = await supabase
      .from('deductions')
      .update({
        status: 'aplicado',
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.deductionId)
      .select(
        `
        *,
        employee:employees (
          id,
          full_name,
          national_id,
          department,
          position,
          avatar_url
        )
      `
      )
      .single()

    if (error) {
      console.error('Error reactivando descuento recurrente:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/deductions')
    revalidatePath('/payroll')
    if (data?.employee_id) {
      revalidatePath(`/employees/${data.employee_id}`)
    }

    return { success: true, data: data as Deduction }
  } catch (err: any) {
    console.error('Catch en reactivateRecurringDeductionAction:', err)
    return {
      success: false,
      error: err?.message || 'Error inesperado al reactivar el descuento.',
    }
  }
}

export interface CancelDeductionParams {
  deductionId: string
  cancellationReason?: string
}

/**
 * Anula un descuento ya registrado (queda con status 'anulado').
 * No elimina el registro: conserva trazabilidad y auditoría.
 */
export async function cancelDeductionAction(
  params: CancelDeductionParams
): Promise<{ success: boolean; data?: Deduction; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado. Inicia sesión nuevamente.' }
    }

    const { data: current, error: fetchError } = await supabase
      .from('deductions')
      .select('*, metadata')
      .eq('id', params.deductionId)
      .single()

    if (fetchError || !current) {
      return { success: false, error: 'Descuento no encontrado.' }
    }

    const updatedMetadata = {
      ...(current.metadata || {}),
      canceled_at: new Date().toISOString(),
      canceled_by: user.email || user.id,
      cancellation_reason: params.cancellationReason?.trim() || 'Anulado por corrección',
    }

    const { data, error } = await supabase
      .from('deductions')
      .update({
        status: 'anulado',
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.deductionId)
      .select(
        `
        *,
        employee:employees (
          id,
          full_name,
          national_id,
          department,
          position,
          avatar_url
        )
      `
      )
      .single()

    if (error) {
      console.error('Error anulando descuento:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/deductions')
    if (data?.employee_id) {
      revalidatePath(`/employees/${data.employee_id}`)
    }

    return { success: true, data: data as Deduction }
  } catch (err: any) {
    console.error('Catch en cancelDeductionAction:', err)
    return {
      success: false,
      error: err?.message || 'Error inesperado al anular el descuento.',
    }
  }
}
