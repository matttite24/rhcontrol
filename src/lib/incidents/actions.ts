'use server'

import { createClient } from '@/lib/supabase/server'
import { Incident } from '@/types/employee'
import { revalidatePath } from 'next/cache'
import { getNextIncidentSequenceCode } from './sequence'

export interface CreateWarningIncidentParams {
  organizationId: string
  employeeId: string
  severity: 'verbal' | 'escrito'
  incidentDate: string
  regulationArticle: string
  infractionTitle: string
  detailedDescription: string
  correctiveCommitment?: string
  metadata?: Record<string, any>
}

export async function createWarningIncidentAction(params: CreateWarningIncidentParams): Promise<{
  success: boolean
  data?: Incident
  error?: string
}> {
  try {
    const supabase = await createClient()

    // 1. Validar sesión
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado. Inicia sesión nuevamente.' }
    }

    // 2. Generar numeración secuencial de 3 letras (LLA-0001) para la organización
    const { code, sequenceNumber } = await getNextIncidentSequenceCode(
      supabase,
      params.organizationId,
      'llamado_atencion'
    )

    const today = new Date().toISOString().split('T')[0]
    const severityLabel = params.severity === 'escrito' ? 'Escrito' : 'Verbal'
    const fullTitle = `[${code}] Llamado de atención (${severityLabel}): ${params.infractionTitle}`

    const combinedMetadata = {
      ...(params.metadata || {}),
      sub_type: 'llamado_atencion',
      document_code: code,
      sequence_number: sequenceNumber,
      severity: params.severity,
      incident_date: params.incidentDate,
      issue_date: today,
      regulation_article: params.regulationArticle,
      infraction_title: params.infractionTitle,
      corrective_commitment: params.correctiveCommitment?.trim() || null,
    }

    const { data, error } = await supabase
      .from('incidents')
      .insert({
        organization_id: params.organizationId,
        employee_id: params.employeeId,
        incident_type: 'llamado_atencion',
        title: fullTitle,
        description: params.detailedDescription.trim(),
        start_date: params.incidentDate,
        end_date: params.incidentDate,
        status: 'registrado', // Queda formalmente registrado y emitido
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
      console.error('Error creando llamado de atención:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/incidents')
    revalidatePath(`/employees/${params.employeeId}`)

    return { success: true, data: data as Incident }
  } catch (err: any) {
    console.error('Catch en createWarningIncidentAction:', err)
    return {
      success: false,
      error: err?.message || 'Error inesperado al registrar el llamado de atención.',
    }
  }
}

export interface CancelIncidentParams {
  incidentId: string
  cancellationReason?: string
}

export async function cancelIncidentAction(params: CancelIncidentParams): Promise<{
  success: boolean
  data?: Incident
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado. Inicia sesión nuevamente.' }
    }

    // Obtener la incidencia actual para preservar y enriquecer metadata
    const { data: currentInc, error: fetchError } = await supabase
      .from('incidents')
      .select('*, metadata')
      .eq('id', params.incidentId)
      .single()

    if (fetchError || !currentInc) {
      return { success: false, error: 'Incidencia no encontrada.' }
    }

    const updatedMetadata = {
      ...(currentInc.metadata || {}),
      canceled_at: new Date().toISOString(),
      canceled_by: user.email || user.id,
      cancellation_reason: params.cancellationReason?.trim() || 'Anulado para corrección o repetición',
    }

    const { data, error } = await supabase
      .from('incidents')
      .update({
        status: 'anulado',
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.incidentId)
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
      console.error('Error anulando incidencia:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/incidents')
    if (data?.employee_id) {
      revalidatePath(`/employees/${data.employee_id}`)
    }

    return { success: true, data: data as Incident }
  } catch (err: any) {
    console.error('Catch en cancelIncidentAction:', err)
    return {
      success: false,
      error: err?.message || 'Error inesperado al anular la incidencia.',
    }
  }
}

export interface CreateNonCompliantIncidentParams {
  organizationId: string
  employeeId: string
  incidentDate: string
  category: string
  categoryTitle: string
  detailedDescription: string
  legalReference?: string
  immediateCorrection?: string
  metadata?: Record<string, any>
}

export async function createNonCompliantIncidentAction(params: CreateNonCompliantIncidentParams): Promise<{
  success: boolean
  data?: Incident
  activeCount?: number
  canTriggerWarning?: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    // 1. Validar sesión
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado. Inicia sesión nuevamente.' }
    }

    // 2. Generar numeración secuencial de 3 letras (ANC-0001) para la organización
    const { code, sequenceNumber } = await getNextIncidentSequenceCode(
      supabase,
      params.organizationId,
      'actividad_no_conforme'
    )

    const today = new Date().toISOString().split('T')[0]
    const fullTitle = `[${code}] Actividad No Conforme: ${params.categoryTitle}`

    const combinedMetadata = {
      ...(params.metadata || {}),
      sub_type: 'actividad_no_conforme',
      document_code: code,
      sequence_number: sequenceNumber,
      incident_date: params.incidentDate,
      issue_date: today,
      category: params.category,
      category_title: params.categoryTitle,
      legal_reference: params.legalReference || 'Reglamento Interno de Trabajo',
      immediate_correction: params.immediateCorrection?.trim() || null,
    }

    // 2. Insertar registro
    const { data, error } = await supabase
      .from('incidents')
      .insert({
        organization_id: params.organizationId,
        employee_id: params.employeeId,
        incident_type: 'actividad_no_conforme',
        title: fullTitle,
        description: params.detailedDescription.trim(),
        start_date: params.incidentDate,
        end_date: params.incidentDate,
        status: 'registrado',
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
      console.error('Error creando actividad no conforme:', error)
      return { success: false, error: error.message }
    }

    // 3. Contar actividades no conformes activas (no anuladas y no convertidas a sanción)
    const { data: activeActivities } = await supabase
      .from('incidents')
      .select('id, metadata')
      .eq('employee_id', params.employeeId)
      .eq('incident_type', 'actividad_no_conforme')
      .eq('status', 'registrado')

    const unescalatedActivities = (activeActivities || []).filter(
      (item) => !item.metadata?.escalated_to_warning_id
    )

    const activeCount = unescalatedActivities.length
    const canTriggerWarning = activeCount >= 3

    revalidatePath('/incidents')
    revalidatePath(`/employees/${params.employeeId}`)

    return {
      success: true,
      data: data as Incident,
      activeCount,
      canTriggerWarning,
    }
  } catch (err: any) {
    console.error('Catch en createNonCompliantIncidentAction:', err)
    return {
      success: false,
      error: err?.message || 'Error inesperado al registrar la actividad no conforme.',
    }
  }
}

export async function getEmployeeNonCompliantActivitiesAction(employeeId: string): Promise<{
  success: boolean
  activities: Incident[]
  totalActive: number
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('incidents')
      .select(`
        *,
        employee:employees (
          id,
          full_name,
          national_id,
          department,
          position,
          avatar_url
        )
      `)
      .eq('employee_id', employeeId)
      .eq('incident_type', 'actividad_no_conforme')
      .eq('status', 'registrado')
      .order('start_date', { ascending: false })

    if (error) {
      return { success: false, activities: [], totalActive: 0, error: error.message }
    }

    const unescalated = (data || []).filter((item) => !item.metadata?.escalated_to_warning_id)

    return {
      success: true,
      activities: unescalated as Incident[],
      totalActive: unescalated.length,
    }
  } catch (err: any) {
    return {
      success: false,
      activities: [],
      totalActive: 0,
      error: err.message,
    }
  }
}

export interface SalaryAdvanceInstallment {
  installment_number: number
  amount: number
  month: number
  year: number
  deduction_id?: string
}

export interface CreateSalaryAdvanceParams {
  organizationId: string
  employeeId: string
  totalAmount: number
  modality: 'mes_actual' | 'cuotas'
  installmentsCount: number
  startMonth: number
  startYear: number
  reason: string
  metadata?: Record<string, any>
}

export async function createSalaryAdvanceAction(params: CreateSalaryAdvanceParams): Promise<{
  success: boolean
  data?: Incident
  error?: string
}> {
  try {
    const supabase = await createClient()

    // 1. Validar sesión
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado. Inicia sesión nuevamente.' }
    }

    if (!params.totalAmount || params.totalAmount <= 0) {
      return { success: false, error: 'El monto del anticipo debe ser mayor a cero.' }
    }

    const count = params.modality === 'mes_actual' ? 1 : Math.max(1, params.installmentsCount || 1)
    const basePerInstallment = Number((params.totalAmount / count).toFixed(2))

    // Calcular cronograma proyectado de cuotas
    const schedule: SalaryAdvanceInstallment[] = []
    let accumulated = 0

    for (let i = 0; i < count; i++) {
      let m = params.startMonth + i
      let y = params.startYear
      while (m > 12) {
        m -= 12
        y += 1
      }

      // Ajuste de centavos en la última cuota para cuadrar exacto
      const isLast = i === count - 1
      const instAmount = isLast ? Number((params.totalAmount - accumulated).toFixed(2)) : basePerInstallment
      accumulated += instAmount

      schedule.push({
        installment_number: i + 1,
        amount: instAmount,
        month: m,
        year: y,
      })
    }

    const today = new Date().toISOString().split('T')[0]
    const modalityLabel =
      count === 1
        ? `1 cuota de $${params.totalAmount.toFixed(2)} (${params.startMonth}/${params.startYear})`
        : `${count} cuotas de ~$${basePerInstallment.toFixed(2)} (Inicia: ${params.startMonth}/${params.startYear})`

    // 2. Generar numeración secuencial de 3 letras (ANT-0001) para la organización
    const { code, sequenceNumber } = await getNextIncidentSequenceCode(
      supabase,
      params.organizationId,
      'anticipo_sueldo'
    )

    const fullTitle = `[${code}] Anticipo de Sueldo: $${params.totalAmount.toFixed(2)} (${count === 1 ? 'Mes en curso' : `${count} cuotas`})`

    const combinedMetadata = {
      ...(params.metadata || {}),
      sub_type: 'anticipo_sueldo',
      document_code: code,
      sequence_number: sequenceNumber,
      total_amount: params.totalAmount,
      modality: params.modality,
      installments_count: count,
      installment_amount: basePerInstallment,
      start_month: params.startMonth,
      start_year: params.startYear,
      schedule,
      request_date: today,
    }

    // Insertar en incidents con status 'pendiente'
    const { data, error } = await supabase
      .from('incidents')
      .insert({
        organization_id: params.organizationId,
        employee_id: params.employeeId,
        incident_type: 'anticipo_sueldo',
        title: fullTitle,
        description: params.reason.trim(),
        amount: params.totalAmount,
        start_date: today,
        end_date: today,
        status: 'pendiente', // Queda como solicitud pendiente de aprobación
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
      console.error('Error creando solicitud de anticipo:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/incidents')
    revalidatePath(`/employees/${params.employeeId}`)

    return { success: true, data: data as Incident }
  } catch (err: any) {
    console.error('Catch en createSalaryAdvanceAction:', err)
    return {
      success: false,
      error: err?.message || 'Error inesperado al registrar el anticipo de sueldo.',
    }
  }
}

export async function approveSalaryAdvanceAction(incidentId: string): Promise<{
  success: boolean
  data?: Incident
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado. Inicia sesión nuevamente.' }
    }

    // Obtener la incidencia
    const { data: incident, error: fetchErr } = await supabase
      .from('incidents')
      .select('*, employee:employees(id, full_name, national_id)')
      .eq('id', incidentId)
      .single()

    if (fetchErr || !incident) {
      return { success: false, error: 'No se encontró la solicitud de anticipo.' }
    }

    if (incident.status === 'aprobado') {
      return { success: false, error: 'Esta solicitud ya fue aprobada previamente.' }
    }

    const metadata = incident.metadata || {}
    const schedule: SalaryAdvanceInstallment[] = metadata.schedule || []
    const count = metadata.installments_count || 1
    const totalAmount = incident.amount || metadata.total_amount || 0

    const createdDeductionIds: string[] = []
    const updatedSchedule: SalaryAdvanceInstallment[] = []

    // Generar deducciones para cada cuota programada
    for (const inst of schedule) {
      const monthStr = inst.month.toString().padStart(2, '0')
      const deductionTitle =
        count === 1
          ? `Anticipo de Sueldo ($${inst.amount.toFixed(2)})`
          : `Anticipo de Sueldo (Cuota ${inst.installment_number}/${count})`

      const description = `Descuento por anticipo de sueldo aprobado ($${totalAmount.toFixed(2)}). Cuota ${inst.installment_number} de ${count} para el rol de ${monthStr}/${inst.year}.`

      const firstDayOfMonth = `${inst.year}-${monthStr}-01`

      const { data: deduction, error: dedErr } = await supabase
        .from('deductions')
        .insert({
          organization_id: incident.organization_id,
          employee_id: incident.employee_id,
          deduction_type: 'prestamo', // Tipo estándar de nómina para anticipos/préstamos
          title: deductionTitle,
          description,
          amount: inst.amount,
          status: 'pendiente',
          period_month: inst.month,
          period_year: inst.year,
          date: firstDayOfMonth,
          metadata: {
            incident_id: incident.id,
            installment_number: inst.installment_number,
            total_installments: count,
            total_advance_amount: totalAmount,
          },
        })
        .select('id')
        .single()

      if (dedErr) {
        console.error('Error insertando cuota de deducción:', dedErr)
      } else if (deduction) {
        createdDeductionIds.push(deduction.id)
        updatedSchedule.push({
          ...inst,
          deduction_id: deduction.id,
        })
      }
    }

    // Actualizar estado de la incidencia a 'aprobado'
    const updatedMetadata = {
      ...metadata,
      approved_at: new Date().toISOString(),
      approved_by: user.email || user.id,
      deduction_ids: createdDeductionIds,
      schedule: updatedSchedule.length > 0 ? updatedSchedule : schedule,
    }

    const { data: updatedIncident, error: updateErr } = await supabase
      .from('incidents')
      .update({
        status: 'aprobado',
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', incident.id)
      .select(`
        *,
        employee:employees (
          id,
          full_name,
          national_id,
          department,
          position,
          avatar_url
        )
      `)
      .single()

    if (updateErr) {
      return { success: false, error: updateErr.message }
    }

    revalidatePath('/incidents')
    revalidatePath('/deductions')
    revalidatePath('/payroll')
    revalidatePath(`/employees/${incident.employee_id}`)

    return { success: true, data: updatedIncident as Incident }
  } catch (err: any) {
    console.error('Catch en approveSalaryAdvanceAction:', err)
    return {
      success: false,
      error: err?.message || 'Error inesperado al aprobar el anticipo.',
    }
  }
}

export interface CreateDeliveryActIncidentParams {
  organizationId: string
  employeeId: string
  deliveryDate: string
  notes?: string
  items: Array<{
    id: string
    category: string
    quantity: number
    description: string
    unitValue: number
    totalValue: number
    condition: 'nuevo' | 'bueno' | 'regular'
    serialOrCode?: string
  }>
  discountAgreementAccepted: boolean
  discountDisclaimerText: string
  deliveredByName?: string
  deliveredByPosition?: string
  metadata?: Record<string, any>
}

export async function createDeliveryActIncidentAction(
  params: CreateDeliveryActIncidentParams
): Promise<{
  success: boolean
  data?: Incident
  error?: string
}> {
  try {
    const supabase = await createClient()

    // 1. Validar sesión
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado. Inicia sesión nuevamente.' }
    }

    if (!params.items || params.items.length === 0) {
      return { success: false, error: 'Debes ingresar al menos un bien, activo o prenda en el acta.' }
    }

    // 2. Calcular monto total del inventario/activos entregados
    const totalAmount = params.items.reduce((acc, item) => acc + (Number(item.totalValue) || 0), 0)
    const totalItemsCount = params.items.reduce((acc, item) => acc + (Number(item.quantity) || 1), 0)

    // 3. Generar numeración secuencial de 3 letras (ACT-0001) para la organización
    const { code, sequenceNumber } = await getNextIncidentSequenceCode(
      supabase,
      params.organizationId,
      'acta_entrega'
    )

    const today = new Date().toISOString().split('T')[0]
    const fullTitle = `[${code}] Acta Entrega-Recepción de Bienes (${totalItemsCount} ${totalItemsCount === 1 ? 'ítem' : 'ítems'})`

    const combinedMetadata = {
      ...(params.metadata || {}),
      sub_type: 'acta_entrega',
      document_code: code,
      sequence_number: sequenceNumber,
      delivery_date: params.deliveryDate || today,
      issue_date: today,
      total_amount: totalAmount,
      total_items_count: totalItemsCount,
      items: params.items,
      discount_agreement_accepted: params.discountAgreementAccepted,
      discount_disclaimer_text: params.discountDisclaimerText,
      delivered_by_name: params.deliveredByName || 'Talento Humano / Bodega',
      delivered_by_position: params.deliveredByPosition || 'Administrador de Activos / RRHH',
      notes: params.notes?.trim() || null,
      created_by: user.email || user.id,
    }

    let insertRes = await supabase
      .from('incidents')
      .insert({
        organization_id: params.organizationId,
        employee_id: params.employeeId,
        incident_type: 'acta_entrega',
        title: fullTitle,
        description: params.notes?.trim() || `Entrega y custodia formal de ${totalItemsCount} ${totalItemsCount === 1 ? 'activo/bien' : 'activos/bienes'} institucionales.`,
        start_date: params.deliveryDate || today,
        end_date: null,
        amount: totalAmount,
        status: 'registrado',
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

    // Si la BD remota de Supabase tiene check constraint antiguo que no incluye 'acta_entrega'
    if (insertRes.error) {
      console.warn('Fallo intento directo incident_type=acta_entrega, reintentando con fallback incident_type=otro:', insertRes.error.message)

      insertRes = await supabase
        .from('incidents')
        .insert({
          organization_id: params.organizationId,
          employee_id: params.employeeId,
          incident_type: 'otro',
          title: fullTitle,
          description: params.notes?.trim() || `Entrega y custodia formal de ${totalItemsCount} ${totalItemsCount === 1 ? 'activo/bien' : 'activos/bienes'} institucionales.`,
          start_date: params.deliveryDate || today,
          end_date: null,
          amount: totalAmount,
          status: 'registrado',
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
    }

    if (insertRes.error) {
      console.error('Error insertando acta de entrega:', insertRes.error)
      return { success: false, error: insertRes.error.message }
    }

    const incident = insertRes.data

    revalidatePath('/incidents')
    revalidatePath(`/employees/${params.employeeId}`)

    return { success: true, data: incident as Incident }
  } catch (err: any) {
    console.error('Catch en createDeliveryActIncidentAction:', err)
    return {
      success: false,
      error: err?.message || 'Error inesperado al generar el acta de entrega.',
    }
  }
}

export interface CreateWorkCertificateParams {
  organizationId: string
  employeeId: string
  purpose?: string
  issuedByName?: string
  issuedByPosition?: string
  metadata?: Record<string, any>
}

/**
 * Genera y registra un Certificado de Trabajo: documento formal con
 * antigüedad, cargo y estado laboral actual del colaborador (activo hasta
 * hoy, o finalizado en su fecha de salida), firmado por la jefatura. Queda
 * guardado como incidencia (incident_type='certificado_trabajo') para dejar
 * constancia de cuándo y para quién se emitió.
 */
export async function createWorkCertificateAction(
  params: CreateWorkCertificateParams
): Promise<{
  success: boolean
  data?: Incident
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado. Inicia sesión nuevamente.' }
    }

    // Generar numeración secuencial de 3 letras (CER-0001) para la organización
    const { code, sequenceNumber } = await getNextIncidentSequenceCode(
      supabase,
      params.organizationId,
      'certificado_trabajo'
    )

    const today = new Date().toISOString().split('T')[0]
    const fullTitle = `[${code}] Certificado de Trabajo`

    const combinedMetadata = {
      ...(params.metadata || {}),
      document_code: code,
      sequence_number: sequenceNumber,
      issue_date: today,
      purpose: params.purpose?.trim() || null,
      issued_by_name: params.issuedByName || 'Talento Humano / Gerencia',
      issued_by_position: params.issuedByPosition || 'Jefatura Inmediata / Recursos Humanos',
      created_by: user.email || user.id,
    }

    let insertRes = await supabase
      .from('incidents')
      .insert({
        organization_id: params.organizationId,
        employee_id: params.employeeId,
        incident_type: 'certificado_trabajo',
        title: fullTitle,
        description: params.purpose?.trim() || 'Certificado de trabajo emitido a solicitud del colaborador.',
        start_date: today,
        end_date: null,
        amount: null,
        status: 'registrado',
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

    // Si la BD remota de Supabase aún no tiene el check constraint actualizado
    // con 'certificado_trabajo' (ver migración add_certificado_trabajo_incident_type.sql)
    if (insertRes.error) {
      console.warn('Fallo intento directo incident_type=certificado_trabajo, reintentando con fallback incident_type=otro:', insertRes.error.message)

      insertRes = await supabase
        .from('incidents')
        .insert({
          organization_id: params.organizationId,
          employee_id: params.employeeId,
          incident_type: 'otro',
          title: fullTitle,
          description: params.purpose?.trim() || 'Certificado de trabajo emitido a solicitud del colaborador.',
          start_date: today,
          end_date: null,
          amount: null,
          status: 'registrado',
          metadata: { ...combinedMetadata, sub_type: 'certificado_trabajo' },
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
    }

    if (insertRes.error) {
      console.error('Error insertando certificado de trabajo:', insertRes.error)
      return { success: false, error: insertRes.error.message }
    }

    const incident = insertRes.data

    revalidatePath('/incidents')
    revalidatePath(`/employees/${params.employeeId}`)

    return { success: true, data: incident as Incident }
  } catch (err: any) {
    console.error('Catch en createWorkCertificateAction:', err)
    return {
      success: false,
      error: err?.message || 'Error inesperado al generar el certificado de trabajo.',
    }
  }
}

