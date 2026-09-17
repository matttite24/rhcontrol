'use server'

import { createClient } from '@/lib/supabase/server'
import { ShiftRequest, LeaveIncidentMetadata, ScheduleChangeMetadata, VacationRequestMetadata, BiometricIncidentMetadata } from '@/types/employee'
import { revalidatePath } from 'next/cache'
import { getNextShiftRequestSequenceCode } from '@/lib/incidents/sequence'
import { normalizeMinuteRange } from '@/lib/shifts/time'

/** Jornada ordinaria máxima por día (Código del Trabajo del Ecuador). */
const MAX_WORK_MINUTES_PER_DAY = 8 * 60

/**
 * Años de servicio y período legal vigente de vacaciones (Ecuador) a partir
 * de la fecha de ingreso. El "período" es la ventana de 1 año en la que se
 * acumulan/consumen los días de vacaciones actuales — sin acotar las
 * consultas de "días ya tomados" a este rango, solicitudes de períodos
 * anteriores (ya disfrutados hace años) seguirían restando indefinidamente
 * del saldo disponible actual.
 */
/** Diferencia en meses "completos" entre dos fechas (calendario, no de 30 días). */
function fullMonthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  if (to.getDate() < from.getDate()) months -= 1
  return Math.max(0, months)
}

/**
 * Vacaciones según el Código del Trabajo del Ecuador (Art. 69):
 *   - Derecho a 15 días de descanso por cada año completo de servicio.
 *   - A partir del 6.º año, 1 día adicional por año, hasta un máximo de 30.
 *   - Antes de cumplir el año, NO hay derecho formal, pero la empresa puede
 *     conceder permisos con cargo a las vacaciones PROPORCIONALES acumuladas
 *     (mutuo acuerdo). Se acumula `totalAnual / 12` por cada mes trabajado.
 *
 * `accruedToDate` es el saldo proporcional disponible a la fecha dentro del
 * período de vacaciones vigente.
 */
function calculateVacationPeriod(hireDateStr: string) {
  const hire = new Date(hireDateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24))
  const yearsOfService = Math.floor(diffDays / 365)

  // Días anuales según antigüedad: 15 base + 1 por cada año a partir del 6.º, tope 30.
  const extraYears = Math.max(0, yearsOfService - 5)
  const annualLawDays = Math.min(30, 15 + extraYears)

  // El período vigente arranca en el último "aniversario de ingreso".
  const anniversaryThisYear = new Date(now.getFullYear(), hire.getMonth(), hire.getDate())
  const periodStart =
    anniversaryThisYear <= now
      ? anniversaryThisYear
      : new Date(now.getFullYear() - 1, hire.getMonth(), hire.getDate())
  const periodEnd = new Date(periodStart.getFullYear() + 1, periodStart.getMonth(), periodStart.getDate())

  // Meses trabajados dentro del período vigente (0..12).
  const monthsInPeriod = Math.min(12, fullMonthsBetween(periodStart, now))

  // Días proporcionales acumulados a la fecha (redondeo a 0.5 días).
  const rawAccrued = (monthsInPeriod * annualLawDays) / 12
  const accruedToDate = Math.round(rawAccrued * 2) / 2

  // Período INMEDIATO ANTERIOR (el año previo al vigente), para arrastrar el
  // saldo no consumido — el Código del Trabajo de Ecuador permite acumular
  // vacaciones hasta 2 períodos (no prescriben automáticamente cada año). Si
  // el período anterior empieza antes de la fecha de ingreso, no existe
  // (empleado con menos de 1 año de antigüedad en el período vigente).
  const previousPeriodStart = new Date(periodStart.getFullYear() - 1, periodStart.getMonth(), periodStart.getDate())
  const previousPeriodEnd = periodStart // el fin del anterior es el inicio del vigente
  const previousPeriodExists = previousPeriodStart >= hire

  // Antigüedad (en años completos) al CIERRE del período anterior — determina
  // cuántos días anuales le correspondían en ese momento, no los de hoy.
  const yearsAtPreviousPeriodEnd = Math.floor(
    (previousPeriodEnd.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24 * 365)
  )
  const previousPeriodAnnualDays = previousPeriodExists
    ? Math.min(30, 15 + Math.max(0, yearsAtPreviousPeriodEnd - 5))
    : 0

  const iso = (d: Date) => d.toISOString().split('T')[0]

  // El label mostrado al usuario debe describir el período que realmente se
  // está LIQUIDANDO — el saldo normal (ver getEmployeeVacationBalanceAction)
  // es el arrastre del período anterior, no el vigente, así que el label
  // apunta ahí cuando existe. Solo cae al vigente si no hay período anterior
  // (empleado con exactamente 1 año de antigüedad: su primer año cumplido ES
  // el vigente).
  const settlementLabel = previousPeriodExists
    ? `Período ${iso(previousPeriodStart)} a ${iso(previousPeriodEnd)}`
    : `Período ${iso(periodStart)} a ${iso(periodEnd)}`

  return {
    yearsOfService,
    annualLawDays,
    monthsInPeriod,
    accruedToDate,
    hasCompletedFirstYear: yearsOfService >= 1,
    periodStartDate: iso(periodStart),
    periodEndDate: iso(periodEnd),
    periodLabel: settlementLabel,
    previousPeriodExists,
    previousPeriodStartDate: iso(previousPeriodStart),
    previousPeriodEndDate: iso(previousPeriodEnd),
    previousPeriodAnnualDays,
  }
}

export interface CreateLeavePermissionParams {
  organizationId: string
  employeeId: string
  title: string
  reason: string
  date: string
  startTime: string
  endTime: string
  hours: number
  metadata: LeaveIncidentMetadata
}

export async function createLeavePermissionAction(params: CreateLeavePermissionParams): Promise<{
  success: boolean
  data?: ShiftRequest
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

    // Bloquear duplicados: mismo empleado + misma fecha y horario ya
    // registrado como permiso pendiente/aprobado. Sin esto, un doble envío
    // (doble clic, reintento tras un error transitorio en red lenta, etc.)
    // puede dejar dos filas idénticas en shift_requests.
    const { data: existingLeaves } = await supabase
      .from('shift_requests')
      .select('id, request_type, metadata, status, date')
      .eq('organization_id', params.organizationId)
      .eq('employee_id', params.employeeId)
      .eq('date', params.date)
      .in('status', ['pendiente', 'aprobado'])

    const hasDuplicateLeave = (existingLeaves || []).some((row) => {
      const isLeaveRow = row.request_type === 'permiso_laboral' || row.metadata?.sub_type === 'permiso_laboral'
      if (!isLeaveRow) return false
      return row.metadata?.start_time === params.startTime && row.metadata?.end_time === params.endTime
    })

    if (hasDuplicateLeave) {
      return {
        success: false,
        error: 'Ya existe un permiso laboral pendiente o aprobado para este empleado con la misma fecha y horario.',
      }
    }

    // Generar numeración secuencial de 3 letras (PER-0001) para la organización.
    // El registro vive en shift_requests, así que se usa ese contador.
    const { code: perCode, sequenceNumber: perSeq } = await getNextShiftRequestSequenceCode(
      supabase,
      params.organizationId,
      'permiso_laboral'
    )

    // 2. Si es con cargo a vacaciones, validar saldo disponible
    const isCargoVacaciones = params.metadata?.recovery_method === 'cargo_vacaciones'
    if (isCargoVacaciones) {
      const balanceRes = await getEmployeeVacationBalanceAction(params.employeeId)
      if (!balanceRes.success) {
        return { success: false, error: balanceRes.error || 'No se pudo verificar el saldo de vacaciones del empleado.' }
      }

      const requestedDays =
        params.metadata?.leave_unit === 'horas'
          ? (params.hours || 0) / 8
          : Number(params.metadata?.requested_days || (params.hours ? params.hours / 8 : 1))

      // Si el wizard autorizó un adelanto de días del período vigente (ver
      // checkbox "Adelantar días" en LeavePermissionWizardModal), el tope
      // pasa a ser el proporcional YA ACUMULADO a la fecha (totalLawDays)
      // menos lo ya usado — no el saldo normal, que siempre es 0 en este
      // caso. Nunca se valida contra el año completo, solo lo devengado.
      const effectiveAvailableDays = params.metadata?.is_advance
        ? Math.max(0, balanceRes.totalLawDays - balanceRes.usedDays)
        : balanceRes.availableDays

      if (requestedDays > effectiveAvailableDays) {
        return {
          success: false,
          error: `Saldo insuficiente de vacaciones: El empleado dispone de ${effectiveAvailableDays} día(s), pero el permiso requiere ${requestedDays} día(s).`,
        }
      }
    }

    const fullTitle = params.title.startsWith('[') ? params.title : `[${perCode}] ${params.title}`

    // 3. Intentar inserción con request_type = 'permiso_laboral'
    let insertRes = await supabase
      .from('shift_requests')
      .insert({
        organization_id: params.organizationId,
        employee_id: params.employeeId,
        request_type: 'permiso_laboral',
        title: fullTitle,
        reason: params.reason.trim(),
        date: params.date,
        start_time: params.startTime,
        end_time: params.endTime,
        hours: params.hours,
        status: 'pendiente',
        metadata: {
          ...params.metadata,
          document_code: perCode,
          sequence_number: perSeq,
        },
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

    // Si la BD tiene check constraint de Postgres ('horas_extras', 'cambio_horario', 'otro')
    if (insertRes.error) {
      console.warn('Fallo intento directo permiso_laboral:', insertRes.error.message)

      insertRes = await supabase
        .from('shift_requests')
        .insert({
          organization_id: params.organizationId,
          employee_id: params.employeeId,
          request_type: 'otro',
          title: params.title,
          reason: params.reason.trim(),
          date: params.date,
          start_time: params.startTime,
          end_time: params.endTime,
          hours: params.hours,
          status: 'pendiente',
          metadata: {
            ...params.metadata,
            sub_type: 'permiso_laboral',
            document_code: perCode,
            sequence_number: perSeq,
          },
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
      console.error('Error insertando en shift_requests:', insertRes.error)
      return { success: false, error: insertRes.error.message }
    }

    revalidatePath('/shifts/requests')
    return { success: true, data: insertRes.data as ShiftRequest }
  } catch (err: any) {
    console.error('Catch en createLeavePermissionAction:', err)
    return { success: false, error: err?.message || 'Error inesperado al crear el permiso' }
  }
}

export interface CreateBiometricIncidentParams {
  organizationId: string
  employeeId: string
  title: string
  reason: string
  date: string
  metadata: BiometricIncidentMetadata
}

/**
 * Registra una constancia informativa de incidencia de marcación biométrica
 * (sin marcación, doble marcación o marcación fuera de tiempo). No requiere
 * aprobación: se crea directamente con status='aprobado', ya que solo sirve
 * como justificación documental al revisar el biométrico.
 */
export async function createBiometricIncidentAction(params: CreateBiometricIncidentParams): Promise<{
  success: boolean
  data?: ShiftRequest
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

    // Bloquear duplicados: mismo empleado + misma fecha + mismo tipo de
    // incidencia ya registrado y vigente (no anulado). Sin esto, un doble
    // envío (doble clic, reintento tras un error transitorio en red lenta,
    // etc.) puede dejar dos constancias idénticas.
    const { data: existingIncidents } = await supabase
      .from('shift_requests')
      .select('id, request_type, metadata, status, date')
      .eq('organization_id', params.organizationId)
      .eq('employee_id', params.employeeId)
      .eq('date', params.date)
      .neq('status', 'rechazado')

    const hasDuplicateIncident = (existingIncidents || []).some((row) => {
      const isIncidentRow = row.request_type === 'incidencia_marcacion' || row.metadata?.sub_type === 'incidencia_marcacion'
      if (!isIncidentRow) return false
      return row.metadata?.incident_type === params.metadata.incident_type
    })

    if (hasDuplicateIncident) {
      return {
        success: false,
        error: 'Ya existe una incidencia de marcación registrada para este empleado en esta fecha con el mismo tipo.',
      }
    }

    const { code: imbCode, sequenceNumber: imbSeq } = await getNextShiftRequestSequenceCode(
      supabase,
      params.organizationId,
      'incidencia_marcacion'
    )

    const fullTitle = params.title.startsWith('[') ? params.title : `[${imbCode}] ${params.title}`

    let insertRes = await supabase
      .from('shift_requests')
      .insert({
        organization_id: params.organizationId,
        employee_id: params.employeeId,
        request_type: 'incidencia_marcacion',
        title: fullTitle,
        reason: params.reason.trim(),
        date: params.date,
        start_time: null,
        end_time: null,
        hours: null,
        status: 'aprobado',
        metadata: {
          ...params.metadata,
          document_code: imbCode,
          sequence_number: imbSeq,
        },
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

    // Si la BD tiene check constraint de Postgres que aún no acepta este tipo.
    if (insertRes.error) {
      console.warn('Fallo intento directo incidencia_marcacion:', insertRes.error.message)

      insertRes = await supabase
        .from('shift_requests')
        .insert({
          organization_id: params.organizationId,
          employee_id: params.employeeId,
          request_type: 'otro',
          title: params.title,
          reason: params.reason.trim(),
          date: params.date,
          start_time: null,
          end_time: null,
          hours: null,
          status: 'aprobado',
          metadata: {
            ...params.metadata,
            sub_type: 'incidencia_marcacion',
            document_code: imbCode,
            sequence_number: imbSeq,
          },
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
      console.error('Error insertando en shift_requests:', insertRes.error)
      return { success: false, error: insertRes.error.message }
    }

    revalidatePath('/shifts/requests')
    return { success: true, data: insertRes.data as ShiftRequest }
  } catch (err: any) {
    console.error('Catch en createBiometricIncidentAction:', err)
    return { success: false, error: err?.message || 'Error inesperado al crear la incidencia de marcación' }
  }
}

export interface CreateScheduleChangeParams {
  organizationId: string
  employeeId: string
  title: string
  reason: string
  date: string
  metadata: ScheduleChangeMetadata
}

export async function createScheduleChangeAction(params: CreateScheduleChangeParams): Promise<{
  success: boolean
  data?: ShiftRequest
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

    // Ningún día laborable del nuevo horario puede exceder la jornada
    // ordinaria de 8 horas (el excedente sería trabajo suplementario, que se
    // registra como horas extras, no como cambio de horario).
    const overLimit = (params.metadata.day_changes || []).filter((dc) => {
      if (!dc.is_workday) return false
      const r1 = normalizeMinuteRange(dc.start_time_1 || '', dc.end_time_1 || '')
      let total = Math.max(0, r1.end - r1.start)
      if (dc.has_split_shift) {
        const r2 = normalizeMinuteRange(dc.start_time_2 || '', dc.end_time_2 || '')
        total += Math.max(0, r2.end - r2.start)
      }
      return total > MAX_WORK_MINUTES_PER_DAY
    })
    if (overLimit.length > 0) {
      return {
        success: false,
        error: `El nuevo horario de ${overLimit.length} día(s) excede la jornada ordinaria de 8 horas. Ajusta las horas o registra el excedente como horas extras.`,
      }
    }

    const firstDay = params.metadata.day_changes?.[0]
    const startTime = firstDay?.start_time_1 || '08:00'
    const endTime = firstDay?.has_split_shift
      ? firstDay?.end_time_2 || '18:00'
      : firstDay?.end_time_1 || '17:00'

    // Bloquear duplicados: mismo empleado + mismo conjunto de fechas
    // modificadas ya registrado como cambio de horario pendiente/aprobado.
    // Sin esto, un doble envío (doble clic, reintento tras un error
    // transitorio en red lenta, etc.) puede dejar dos filas idénticas.
    const requestedDates = (params.metadata.day_changes || []).map((dc) => dc.date).sort().join(',')
    const { data: existingScheduleChanges } = await supabase
      .from('shift_requests')
      .select('id, request_type, metadata, status')
      .eq('organization_id', params.organizationId)
      .eq('employee_id', params.employeeId)
      .in('status', ['pendiente', 'aprobado'])

    const hasDuplicateScheduleChange = (existingScheduleChanges || []).some((row) => {
      const isScheduleChangeRow = row.request_type === 'cambio_horario' || row.metadata?.sub_type === 'cambio_horario'
      if (!isScheduleChangeRow) return false
      const rowDates = ((row.metadata?.day_changes || []) as { date: string }[]).map((dc) => dc.date).sort().join(',')
      return rowDates === requestedDates && requestedDates.length > 0
    })

    if (hasDuplicateScheduleChange) {
      return {
        success: false,
        error: 'Ya existe un cambio de horario pendiente o aprobado para este empleado con las mismas fechas.',
      }
    }

    // Generar numeración secuencial de 3 letras (CAM-0001) para la organización
    const { code: camCode, sequenceNumber: camSeq } = await getNextShiftRequestSequenceCode(
      supabase,
      params.organizationId,
      'cambio_horario'
    )

    const fullCamTitle = params.title.startsWith('[') ? params.title : `[${camCode}] ${params.title}`

    // 2. Intentar inserción con request_type = 'cambio_horario'
    let insertRes = await supabase
      .from('shift_requests')
      .insert({
        organization_id: params.organizationId,
        employee_id: params.employeeId,
        request_type: 'cambio_horario',
        title: fullCamTitle,
        reason: params.reason.trim(),
        date: params.date,
        start_time: startTime,
        end_time: endTime,
        hours: null,
        status: 'pendiente',
        metadata: {
          ...params.metadata,
          document_code: camCode,
          sequence_number: camSeq,
        },
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

    // Si la BD tuviera check constraint que requiriese 'otro'
    if (insertRes.error && insertRes.error.message?.includes('check constraint')) {
      insertRes = await supabase
        .from('shift_requests')
        .insert({
          organization_id: params.organizationId,
          employee_id: params.employeeId,
          request_type: 'otro',
          title: params.title,
          reason: params.reason.trim(),
          date: params.date,
          start_time: startTime,
          end_time: endTime,
          hours: null,
          status: 'pendiente',
          metadata: {
            ...params.metadata,
            sub_type: 'cambio_horario',
            document_code: camCode,
            sequence_number: camSeq,
          },
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
      console.error('Error insertando cambio_horario en shift_requests:', insertRes.error)
      return { success: false, error: insertRes.error.message }
    }

    revalidatePath('/shifts/requests')
    return { success: true, data: insertRes.data as ShiftRequest }
  } catch (err: any) {
    console.error('Catch en createScheduleChangeAction:', err)
    return { success: false, error: err?.message || 'Error inesperado al crear el cambio de horario' }
  }
}

export interface CreateVacationRequestParams {
  organizationId: string
  employeeId: string
  title: string
  reason: string
  startDate: string
  endDate: string
  daysCount: number
  metadata: VacationRequestMetadata
}

export async function createVacationRequestAction(params: CreateVacationRequestParams): Promise<{
  success: boolean
  data?: ShiftRequest
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

    // 2. Validar que no se soliciten más días que los permitidos
    const { data: empData } = await supabase
      .from('employees')
      .select('hire_date')
      .eq('id', params.employeeId)
      .single()

    if (empData?.hire_date) {
      const hire = new Date(empData.hire_date)
      const now = new Date()
      const daysSinceHire = Math.floor((now.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24))

      if (daysSinceHire < 365) {
        return { success: false, error: 'El empleado no cumple con el requisito legal de 1 año de antigüedad.' }
      }

      // Tope real: el saldo del ÚLTIMO AÑO YA CUMPLIDO no consumido
      // (getEmployeeVacationBalanceAction, misma fuente de verdad que usa el
      // wizard para mostrar el saldo) — el período vigente (año en curso) NO
      // cuenta aquí, solo se habilita como adelanto explícito (ver
      // VacationWizardModal "Adelantar días"), y en ese caso el tope pasa a
      // ser el máximo anual completo por ley (annualLawDays - usedDays).
      const balance = await getEmployeeVacationBalanceAction(params.employeeId)
      if (!balance.success) {
        return { success: false, error: balance.error || 'No se pudo verificar el saldo de vacaciones.' }
      }

      const isAdvance = Boolean(params.metadata?.is_advance)
      const availableLimit = isAdvance
        ? Math.max(0, balance.annualLawDays - balance.usedDays)
        : balance.availableDays

      if (params.daysCount > availableLimit) {
        return {
          success: false,
          error: isAdvance
            ? `Límite excedido: el adelanto permite hasta ${availableLimit} día(s) del año completo (Total ley: ${balance.annualLawDays}, ya tomados: ${balance.usedDays}).`
            : `Límite excedido: Solo dispone de ${availableLimit} día(s) de vacaciones del último período cumplido (tomados/en trámite: ${balance.usedDays}).`,
        }
      }
    }

    // Bloquear duplicados: mismo empleado + mismo rango de fechas ya
    // registrado como vacaciones pendiente/aprobada. Sin esto, un doble
    // envío (doble clic, reintento manual tras un error transitorio, etc.)
    // puede dejar dos filas idénticas en shift_requests — un caso real
    // detectado en producción (dos VAC-000X con el mismo período y motivo).
    const { data: existingVacations } = await supabase
      .from('shift_requests')
      .select('id, request_type, metadata, status')
      .eq('organization_id', params.organizationId)
      .eq('employee_id', params.employeeId)
      .in('status', ['pendiente', 'aprobado'])

    const hasDuplicate = (existingVacations || []).some((row) => {
      const isVacationRow =
        row.request_type === 'solicitud_vacaciones' || row.metadata?.sub_type === 'solicitud_vacaciones'
      if (!isVacationRow) return false
      return row.metadata?.start_date === params.startDate && row.metadata?.end_date === params.endDate
    })

    if (hasDuplicate) {
      return {
        success: false,
        error: 'Ya existe una solicitud de vacaciones pendiente o aprobada para este empleado con las mismas fechas.',
      }
    }

    // Generar numeración secuencial de 3 letras (VAC-0001) para la organización.
    // Se usa el contador de shift_requests (donde realmente vive el registro
    // canónico) en vez del de incidents — antes ambos podían desincronizarse
    // ya que el contador atómico compartido es el mismo por organización+tipo,
    // pero consultar aquí la tabla "equivocada" invitaba a asumir routing
    // distinto por accidente. Ver migración add_atomic_sequence_counters.sql.
    const { code: vacCode, sequenceNumber: vacSeq } = await getNextShiftRequestSequenceCode(
      supabase,
      params.organizationId,
      'solicitud_vacaciones'
    )

    const fullVacTitle = params.title.startsWith('[') ? params.title : `[${vacCode}] ${params.title}`

    // 3. Intentar inserción en shift_requests con request_type = 'solicitud_vacaciones'
    let insertRes = await supabase
      .from('shift_requests')
      .insert({
        organization_id: params.organizationId,
        employee_id: params.employeeId,
        request_type: 'solicitud_vacaciones',
        title: fullVacTitle,
        reason: params.reason.trim(),
        date: params.startDate,
        start_time: '08:00',
        end_time: '17:00',
        hours: params.daysCount * 8,
        status: 'pendiente',
        metadata: {
          ...params.metadata,
          document_code: vacCode,
          sequence_number: vacSeq,
          start_date: params.startDate,
          end_date: params.endDate,
          days_count: params.daysCount,
        },
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

    // Fallback de compatibilidad si el check constraint requiriera 'otro'
    if (insertRes.error && insertRes.error.message?.includes('check constraint')) {
      insertRes = await supabase
        .from('shift_requests')
        .insert({
          organization_id: params.organizationId,
          employee_id: params.employeeId,
          request_type: 'otro',
          title: params.title,
          reason: params.reason.trim(),
          date: params.startDate,
          start_time: '08:00',
          end_time: '17:00',
          hours: params.daysCount * 8,
          status: 'pendiente',
          metadata: {
            ...params.metadata,
            sub_type: 'solicitud_vacaciones',
            start_date: params.startDate,
            end_date: params.endDate,
            days_count: params.daysCount,
            document_code: vacCode,
            sequence_number: vacSeq,
          },
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
      console.error('Error insertando solicitud_vacaciones en shift_requests:', insertRes.error)
      return { success: false, error: insertRes.error.message }
    }

    // Ya NO se crea un reflejo en la tabla `incidents`: una solicitud de
    // vacaciones vive únicamente en shift_requests (Novedades / Control de
    // Asistencia), que es su lugar natural — es ante todo una ausencia
    // programada que afecta la jornada, igual que permisos y horas extras,
    // no documentación administrativa/disciplinaria como actas o llamados de
    // atención. Antes se duplicaba en ambas listas, generando confusión
    // sobre "dónde vive" cada solicitud (ver también el filtro en
    // /incidents/page.tsx que excluye las filas históricas ya creadas).

    revalidatePath('/shifts/requests')
    revalidatePath('/shifts/calendar')
    revalidatePath('/incidents')
    return { success: true, data: insertRes.data as ShiftRequest }
  } catch (err: any) {
    console.error('Catch en createVacationRequestAction:', err)
    return { success: false, error: err?.message || 'Error inesperado al crear la solicitud de vacaciones' }
  }
}

export interface UpdateVacationRequestParams {
  requestId: string
  organizationId: string
  employeeId: string
  reason: string
  startDate: string
  endDate: string
  daysCount: number
  metadata: VacationRequestMetadata
}

/**
 * Edita una solicitud de vacaciones EN BORRADOR (status='pendiente'). Igual
 * criterio que el resto de acciones de edición de novedades: solo mientras
 * nadie la haya resuelto. Vuelve a validar el saldo disponible contra el
 * nuevo rango de fechas, excluyendo esta misma solicitud del cálculo de días
 * ya usados (ver excludeRequestId en getEmployeeVacationBalanceAction) — sin
 * eso, la solicitud contaría contra su propio saldo y bloquearía ediciones
 * válidas (ej. solo acortar el rango).
 */
export async function updateVacationRequestAction(params: UpdateVacationRequestParams): Promise<{
  success: boolean
  data?: ShiftRequest
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

    const { data: existing, error: fetchError } = await supabase
      .from('shift_requests')
      .select('id, status, metadata, title')
      .eq('id', params.requestId)
      .single()

    if (fetchError || !existing) {
      return { success: false, error: 'No se encontró la solicitud a editar.' }
    }
    if (existing.status !== 'pendiente') {
      return { success: false, error: 'Solo se pueden editar solicitudes pendientes de aprobación.' }
    }

    // Re-validar el saldo disponible contra el rango editado.
    const balance = await getEmployeeVacationBalanceAction(params.employeeId, params.requestId)
    if (!balance.success) {
      return { success: false, error: balance.error || 'No se pudo verificar el saldo de vacaciones.' }
    }

    const isAdvance = Boolean(params.metadata?.is_advance)
    const availableLimit = isAdvance
      ? Math.max(0, balance.annualLawDays - balance.usedDays)
      : balance.availableDays

    if (params.daysCount > availableLimit) {
      return {
        success: false,
        error: isAdvance
          ? `Límite excedido: el adelanto permite hasta ${availableLimit} día(s) del año completo (Total ley: ${balance.annualLawDays}, ya tomados: ${balance.usedDays}).`
          : `Límite excedido: Solo dispone de ${availableLimit} día(s) de vacaciones del último período cumplido (tomados/en trámite: ${balance.usedDays}).`,
      }
    }

    const prevMetadata = (existing.metadata || {}) as Record<string, any>
    // Conservar el código de documento y prefijo del título ([VAC-0001]) ya
    // asignado — no se genera uno nuevo al editar.
    const docCodePrefix = existing.title?.match(/^\[[A-Z]{3}-\d+\]/)?.[0] || ''
    const newTitle = `${docCodePrefix ? `${docCodePrefix} ` : ''}Solicitud de Vacaciones - ${params.daysCount} días (${params.metadata.settlement_period || prevMetadata.settlement_period || ''})`

    const { data, error } = await supabase
      .from('shift_requests')
      .update({
        employee_id: params.employeeId,
        title: newTitle,
        reason: params.reason.trim(),
        date: params.startDate,
        hours: params.daysCount * 8,
        updated_at: new Date().toISOString(),
        metadata: {
          ...prevMetadata,
          ...params.metadata,
          start_date: params.startDate,
          end_date: params.endDate,
          days_count: params.daysCount,
        },
      })
      .eq('id', params.requestId)
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
      console.error('Error actualizando solicitud_vacaciones en shift_requests:', error)
      return { success: false, error: error.message }
    }

    // Sincronizar el incidente reflejado, si existe.
    if (prevMetadata.incident_id || existing.id) {
      await supabase
        .from('incidents')
        .update({
          title: newTitle,
          description: params.reason.trim(),
          start_date: params.startDate,
          end_date: params.endDate,
          updated_at: new Date().toISOString(),
        })
        .eq('metadata->>shift_request_id', params.requestId)
    }

    revalidatePath('/shifts/requests')
    revalidatePath('/shifts/calendar')
    revalidatePath('/incidents')
    return { success: true, data: data as ShiftRequest }
  } catch (err: any) {
    console.error('Catch en updateVacationRequestAction:', err)
    return { success: false, error: err?.message || 'Error inesperado al editar la solicitud de vacaciones' }
  }
}

export async function getEmployeeVacationBalanceAction(
  employeeId: string,
  /**
   * Id de una solicitud a excluir del cálculo de días usados — se pasa al
   * editar una solicitud de vacaciones ya existente (ver
   * updateVacationRequestAction), para que la solicitud no cuente contra su
   * propio saldo disponible al re-validar el rango editado.
   */
  excludeRequestId?: string
): Promise<{
  success: boolean
  /** Días anuales que le corresponden por ley según su antigüedad (15..30). */
  annualLawDays: number
  /**
   * Proporcional del período VIGENTE (año en curso, aún no cumplido) — ya NO
   * forma parte del saldo normal (`availableDays`). Solo se usa como techo
   * del adelanto explícito (ver checkbox "Adelantar días").
   */
  accruedDays: number
  /** @deprecated Usa `accruedDays`. Se mantiene por compatibilidad de UI. */
  totalLawDays: number
  usedDays: number
  /** Días del ÚLTIMO período (año) YA CUMPLIDO y no consumidos — esto es lo que compone `availableDays` por defecto (no se acumulan varios años). */
  carriedOverDays: number
  /** Saldo disponible SIN adelanto: igual a `carriedOverDays - usedDays`, nunca incluye el período vigente. */
  availableDays: number
  yearsOfService: number
  monthsInPeriod: number
  hasCompletedFirstYear: boolean
  /** Período que se está LIQUIDANDO (el anterior no consumido, o el vigente si es el primer año del empleado). */
  period: string
  /** Período VIGENTE (año en curso, aún no cumplido) — para el texto del adelanto, distinto de `period`. */
  currentPeriodLabel: string
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data: emp, error: empErr } = await supabase
      .from('employees')
      .select('id, hire_date')
      .eq('id', employeeId)
      .single()

    if (empErr || !emp?.hire_date) {
      return {
        success: false,
        annualLawDays: 0,
        accruedDays: 0,
        totalLawDays: 0,
        usedDays: 0,
        carriedOverDays: 0,
        availableDays: 0,
        yearsOfService: 0,
        monthsInPeriod: 0,
        hasCompletedFirstYear: false,
        period: '—',
        currentPeriodLabel: '—',
        error: 'No se encontró la fecha de ingreso del empleado',
      }
    }

    const {
      yearsOfService: years,
      annualLawDays,
      monthsInPeriod,
      accruedToDate,
      hasCompletedFirstYear,
      periodStartDate,
      periodEndDate,
      periodLabel: period,
      previousPeriodExists,
      previousPeriodStartDate,
      previousPeriodEndDate,
      previousPeriodAnnualDays,
    } = calculateVacationPeriod(emp.hire_date)

    // Label del período VIGENTE (año en curso), distinto de `period` (que
    // apunta al anterior cuando existe) — usado para el texto del adelanto.
    const currentPeriodLabel = `Período ${periodStartDate} a ${periodEndDate}`

    /** Suma días usados (vacaciones + permisos con cargo a vacaciones) entre un rango de solicitudes ya cargadas. */
    function sumUsedDays(rows: { id: string; request_type: string; hours: number | null; metadata: any; status: string }[]): number {
      return rows.reduce((acc, curr) => {
        // Excluir la solicitud que se está editando — no debe contar contra
        // su propio saldo al re-validar (ver excludeRequestId).
        if (excludeRequestId && curr.id === excludeRequestId) return acc
        const isVacation =
          curr.request_type === 'solicitud_vacaciones' ||
          curr.metadata?.sub_type === 'solicitud_vacaciones'
        const isCargoVacaciones =
          (curr.request_type === 'permiso_laboral' || curr.metadata?.sub_type === 'permiso_laboral') &&
          curr.metadata?.recovery_method === 'cargo_vacaciones'

        if (isVacation) {
          return acc + Number(curr.metadata?.days_count || (curr.hours ? curr.hours / 8 : 0))
        }
        if (isCargoVacaciones) {
          const days =
            curr.metadata?.leave_unit === 'horas'
              ? (curr.hours || curr.metadata?.requested_hours || 0) / 8
              : Number(curr.metadata?.requested_days || (curr.hours ? curr.hours / 8 : 1))
          return acc + days
        }
        return acc
      }, 0)
    }

    // Días ya registrados o aprobados DENTRO DEL PERÍODO VIGENTE (vacaciones
    // y permisos con cargo a vacaciones) — sin este filtro de fecha,
    // solicitudes de períodos anteriores ya disfrutados seguirían restando
    // indefinidamente del saldo disponible actual.
    const { data: requests } = await supabase
      .from('shift_requests')
      .select('id, request_type, hours, metadata, status')
      .eq('employee_id', employeeId)
      .in('request_type', ['solicitud_vacaciones', 'permiso_laboral', 'otro'])
      .in('status', ['pendiente', 'aprobado'])
      .gte('date', periodStartDate)
      .lte('date', periodEndDate)

    const usedDays = sumUsedDays(requests || [])

    // Arrastre del período INMEDIATO ANTERIOR no consumido: la ley ecuatoriana
    // permite acumular vacaciones hasta por 2 períodos (no prescriben cada
    // año automáticamente). Se calcula lo que le correspondía en ese período
    // (según su antigüedad en ese momento) menos lo que ya tomó dentro de él.
    let carriedOverDays = 0
    if (previousPeriodExists) {
      const { data: previousRequests } = await supabase
        .from('shift_requests')
        .select('id, request_type, hours, metadata, status')
        .eq('employee_id', employeeId)
        .in('request_type', ['solicitud_vacaciones', 'permiso_laboral', 'otro'])
        .in('status', ['pendiente', 'aprobado'])
        .gte('date', previousPeriodStartDate)
        .lt('date', previousPeriodEndDate)

      const usedInPreviousPeriod = sumUsedDays(previousRequests || [])
      carriedOverDays = Math.max(0, previousPeriodAnnualDays - usedInPreviousPeriod)
    }

    // El saldo NORMAL disponible es SOLO el bloque del último año YA CUMPLIDO
    // (carriedOverDays) — nunca se acumulan 15 días por cada año de
    // antigüedad, solo se puede arrastrar el período inmediato anterior no
    // consumido. El período VIGENTE (el año que está corriendo ahora mismo,
    // aún no cumplido) NO forma parte de este saldo: solo se ofrece como
    // adelanto explícito (ver checkbox en VacationWizardModal) cuando este
    // saldo ya llega a 0. `usedDays` aquí son días tomados dentro del período
    // vigente (ej. un adelanto ya registrado), que si los hay también restan.
    const availableDays = Math.max(0, carriedOverDays - usedDays)

    return {
      success: true,
      annualLawDays,
      accruedDays: accruedToDate,
      totalLawDays: accruedToDate,
      usedDays,
      carriedOverDays,
      availableDays,
      yearsOfService: years,
      monthsInPeriod,
      hasCompletedFirstYear,
      period,
      currentPeriodLabel,
    }
  } catch (err: any) {
    return {
      success: false,
      annualLawDays: 0,
      accruedDays: 0,
      totalLawDays: 0,
      usedDays: 0,
      carriedOverDays: 0,
      availableDays: 0,
      yearsOfService: 0,
      monthsInPeriod: 0,
      hasCompletedFirstYear: false,
      period: '—',
      currentPeriodLabel: '—',
      error: err.message,
    }
  }
}

/**
 * Elimina permanentemente una solicitud de turno (horas extras, vacaciones,
 * permiso, cambio de horario) ya RECHAZADA — no se permite borrar pendientes
 * ni aprobadas, esas requieren pasar primero por rechazo/anulación para
 * mantener el rastro de auditoría de lo que sí se autorizó.
 */
export async function deleteRejectedShiftRequestAction(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'No autenticado. Inicia sesión nuevamente.' }
    }

    const { data: existing, error: fetchError } = await supabase
      .from('shift_requests')
      .select('id, status')
      .eq('id', requestId)
      .single()

    if (fetchError || !existing) {
      return { success: false, error: 'La solicitud no existe o ya fue eliminada.' }
    }
    if (existing.status !== 'rechazado') {
      return { success: false, error: 'Solo se pueden eliminar solicitudes rechazadas.' }
    }

    const { error } = await supabase.from('shift_requests').delete().eq('id', requestId)
    if (error) return { success: false, error: error.message }

    revalidatePath('/shifts/requests')
    revalidatePath('/shifts/calendar')
    return { success: true }
  } catch (err: any) {
    console.error('Catch en deleteRejectedShiftRequestAction:', err)
    return { success: false, error: err?.message || 'Error inesperado al eliminar la solicitud' }
  }
}

export interface CreateOvertimeRequestParams {
  organizationId: string
  employeeId: string
  date: string
  startTime: string
  endTime: string
  hours: number
  reason: string
  overtimeType: 'suplementaria_50' | 'extraordinaria_100'
  isHoliday: boolean
  isWorkday: boolean | null
}

/**
 * Crea una solicitud de horas extras. Antes se insertaba directamente desde
 * el cliente (createClient() del navegador) en OvertimeWizardModal, a
 * diferencia de los otros 3 wizards (permiso, cambio de horario,
 * vacaciones) que ya usan Server Actions — sin validación de sesión propia
 * (dependía solo de RLS) ni revalidatePath explícito. Se unifica aquí con
 * el mismo patrón.
 */
export async function createOvertimeRequestAction(params: CreateOvertimeRequestParams): Promise<{
  success: boolean
  data?: ShiftRequest
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

    // Bloquear duplicados: mismo empleado + misma fecha y horario ya
    // registrado como horas extras pendiente/aprobado. Sin esto, un doble
    // envío (doble clic, reintento tras un error transitorio en red lenta,
    // etc.) puede dejar dos filas idénticas en shift_requests.
    const { data: existingOvertime } = await supabase
      .from('shift_requests')
      .select('id, request_type, status, date, start_time, end_time')
      .eq('organization_id', params.organizationId)
      .eq('employee_id', params.employeeId)
      .eq('request_type', 'horas_extras')
      .eq('date', params.date)
      .in('status', ['pendiente', 'aprobado'])

    const hasDuplicateOvertime = (existingOvertime || []).some(
      (row) => row.start_time === params.startTime && row.end_time === params.endTime
    )

    if (hasDuplicateOvertime) {
      return {
        success: false,
        error: 'Ya existe una solicitud de horas extras pendiente o aprobada para este empleado con la misma fecha y horario.',
      }
    }

    // 2. Generar numeración secuencial de 3 letras (HEX-0001) para la organización
    const { code: otCode, sequenceNumber: otSeq } = await getNextShiftRequestSequenceCode(
      supabase,
      params.organizationId,
      'horas_extras'
    )

    const title = `[${otCode}] Horas Extras (${params.hours} hrs) - ${params.overtimeType === 'suplementaria_50' ? '50% Recargo' : '100% Extraordinaria'}`

    // 3. Insertar la solicitud
    const { data, error } = await supabase
      .from('shift_requests')
      .insert({
        organization_id: params.organizationId,
        employee_id: params.employeeId,
        request_type: 'horas_extras',
        title,
        reason: params.reason.trim(),
        date: params.date,
        start_time: params.startTime,
        end_time: params.endTime,
        hours: params.hours,
        status: 'pendiente',
        metadata: {
          document_code: otCode,
          sequence_number: otSeq,
          overtime_type: params.overtimeType,
          overtime_rate: params.overtimeType === 'suplementaria_50' ? 1.5 : 2.0,
          is_holiday: params.isHoliday,
          is_workday: params.isWorkday,
          requested_at: new Date().toISOString(),
        },
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
      console.error('Error insertando horas_extras en shift_requests:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/shifts/requests')
    revalidatePath('/shifts/calendar')
    return { success: true, data: data as ShiftRequest }
  } catch (err: any) {
    console.error('Catch en createOvertimeRequestAction:', err)
    return { success: false, error: err?.message || 'Error inesperado al generar la solicitud de horas extras' }
  }
}

export interface UpdateOvertimeRequestParams {
  requestId: string
  employeeId: string
  date: string
  startTime: string
  endTime: string
  hours: number
  reason: string
  overtimeType: 'suplementaria_50' | 'extraordinaria_100'
  isHoliday: boolean
  isWorkday: boolean | null
}

/**
 * Edita una solicitud de horas extras EN BORRADOR (status='pendiente'). Solo
 * se puede editar mientras nadie la haya aprobado/rechazado — igual criterio
 * que el resto de acciones de modificación de novedades, para no reescribir
 * documentación ya resuelta. Reemplaza el empleado también, por si se eligió
 * mal al crear la solicitud.
 */
export async function updateOvertimeRequestAction(params: UpdateOvertimeRequestParams): Promise<{
  success: boolean
  data?: ShiftRequest
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

    const { data: existing, error: fetchError } = await supabase
      .from('shift_requests')
      .select('id, status, metadata')
      .eq('id', params.requestId)
      .single()

    if (fetchError || !existing) {
      return { success: false, error: 'No se encontró la solicitud a editar.' }
    }
    if (existing.status !== 'pendiente') {
      return { success: false, error: 'Solo se pueden editar solicitudes pendientes de aprobación.' }
    }

    const prevMetadata = (existing.metadata || {}) as Record<string, any>
    const title = `[${prevMetadata.document_code || ''}] Horas Extras (${params.hours} hrs) - ${params.overtimeType === 'suplementaria_50' ? '50% Recargo' : '100% Extraordinaria'}`

    const { data, error } = await supabase
      .from('shift_requests')
      .update({
        employee_id: params.employeeId,
        title,
        reason: params.reason.trim(),
        date: params.date,
        start_time: params.startTime,
        end_time: params.endTime,
        hours: params.hours,
        updated_at: new Date().toISOString(),
        metadata: {
          ...prevMetadata,
          overtime_type: params.overtimeType,
          overtime_rate: params.overtimeType === 'suplementaria_50' ? 1.5 : 2.0,
          is_holiday: params.isHoliday,
          is_workday: params.isWorkday,
        },
      })
      .eq('id', params.requestId)
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
      console.error('Error actualizando horas_extras en shift_requests:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/shifts/requests')
    revalidatePath('/shifts/calendar')
    return { success: true, data: data as ShiftRequest }
  } catch (err: any) {
    console.error('Catch en updateOvertimeRequestAction:', err)
    return { success: false, error: err?.message || 'Error inesperado al editar la solicitud de horas extras' }
  }
}
