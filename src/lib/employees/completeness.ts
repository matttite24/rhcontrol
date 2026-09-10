import type {
  Employee,
  EmployeeSalary,
  EmployeeSchedule,
  EmployeeDocument,
} from '@/types/employee'

/**
 * Completitud de la ficha del empleado por pestaña. Solo cuentan los campos
 * relevantes para nómina y cumplimiento legal (Ecuador): los datos opcionales
 * (teléfono secundario, notas, etc.) no restan porcentaje.
 *
 * Cada pestaña devuelve `{ total, filled, percent, missing }` y hay un
 * `overall` con el promedio ponderado por número de campos.
 */

export type EmployeeTabKey = 'general' | 'company' | 'salary' | 'schedule' | 'documents'

export interface TabCompleteness {
  key: EmployeeTabKey
  label: string
  total: number
  filled: number
  percent: number
  /** Etiquetas legibles de los campos que faltan. */
  missing: string[]
}

export interface EmployeeCompleteness {
  tabs: Record<EmployeeTabKey, TabCompleteness>
  overall: { total: number; filled: number; percent: number }
}

const DOC_LABELS: Record<string, string> = {
  contrato: 'Contrato de trabajo',
  legalizacion_mdt: 'Legalización MDT (SUT)',
  aviso_entrada_iess: 'Aviso de entrada IESS',
  cedula_papeleta: 'Cédula y papeleta de votación',
}

const REQUIRED_DOC_TYPES = Object.keys(DOC_LABELS)

function has(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return !Number.isNaN(value)
  return Boolean(value)
}

function buildTab(
  key: EmployeeTabKey,
  label: string,
  fields: { label: string; ok: boolean }[]
): TabCompleteness {
  const total = fields.length
  const filled = fields.filter((f) => f.ok).length
  return {
    key,
    label,
    total,
    filled,
    percent: total === 0 ? 100 : Math.round((filled / total) * 100),
    missing: fields.filter((f) => !f.ok).map((f) => f.label),
  }
}

export function getEmployeeCompleteness(
  employee: Partial<Employee> | null | undefined,
  salaries: Pick<EmployeeSalary, 'salary_type' | 'amount'>[] = [],
  schedules: Pick<EmployeeSchedule, 'is_workday' | 'start_time_1' | 'end_time_1'>[] = [],
  documents: Pick<EmployeeDocument, 'doc_type' | 'file_url'>[] = []
): EmployeeCompleteness {
  const e = employee || {}

  // 1. GENERAL — identidad y datos personales.
  const general = buildTab('general', 'General', [
    { label: 'Nombres y apellidos', ok: has(e.full_name) },
    { label: 'Cédula de identidad', ok: has(e.national_id) },
    { label: 'Correo electrónico', ok: has(e.email) },
    { label: 'Teléfono', ok: has(e.phone) },
    { label: 'Dirección', ok: has(e.address) },
    { label: 'Provincia', ok: has(e.province) },
    { label: 'Fecha de nacimiento', ok: has(e.birth_date) },
    { label: 'Sexo', ok: has(e.gender) },
    { label: 'Estado civil', ok: has(e.civil_status) },
  ])

  // 2. EMPRESA — vínculo laboral y forma de pago.
  const paymentType = e.payment_type || ''
  const paymentFields: { label: string; ok: boolean }[] = []
  if (paymentType === 'Transferencia') {
    paymentFields.push(
      { label: 'Banco', ok: has(e.bank_name) },
      { label: 'Tipo de cuenta', ok: has(e.account_type) },
      { label: 'Número de cuenta', ok: has(e.account_number) }
    )
  } else if (paymentType === 'Cheque') {
    paymentFields.push({ label: 'Banco emisor de cheques', ok: has(e.check_issuing_bank) })
  }

  const company = buildTab('company', 'Empresa', [
    { label: 'Cargo', ok: has(e.position) },
    { label: 'Departamento', ok: has(e.department) },
    { label: 'Fecha de ingreso', ok: has(e.hire_date) },
    { label: 'Tipo de contrato', ok: has(e.contract_type) },
    { label: 'Estado laboral', ok: has(e.status) },
    { label: 'Tipo de pago', ok: has(e.payment_type) },
    { label: 'Código IESS', ok: has(e.iess_code) },
    ...paymentFields,
  ])

  // 3. SALARIO — al menos un concepto de tipo "Sueldo" con monto > 0.
  const hasBaseSalary = salaries.some(
    (s) => s.salary_type === 'Sueldo' && Number(s.amount) > 0
  )
  const salary = buildTab('salary', 'Salario', [
    { label: 'Sueldo base', ok: hasBaseSalary },
  ])

  // 4. HORARIO — al menos un día laborable con horas definidas.
  const hasSchedule = schedules.some(
    (s) => s.is_workday && has(s.start_time_1) && has(s.end_time_1)
  )
  const schedule = buildTab('schedule', 'Horario', [
    { label: 'Jornada laboral configurada', ok: hasSchedule },
  ])

  // 5. DOCUMENTOS — los 4 obligatorios de ley.
  // NOTA: el módulo de documentos aún está en construcción. Se sigue
  // calculando su estado por si se quiere mostrar, pero NO entra en el
  // `overall` para no penalizar el % global por una función no disponible.
  const uploadedTypes = new Set(
    documents.filter((d) => has(d.file_url)).map((d) => d.doc_type)
  )
  const docs = buildTab(
    'documents',
    'Documentos',
    REQUIRED_DOC_TYPES.map((t) => ({
      label: DOC_LABELS[t],
      ok: uploadedTypes.has(t as EmployeeDocument['doc_type']),
    }))
  )

  const tabs = { general, company, salary, schedule, documents: docs }

  // El overall excluye "documents" mientras esté en construcción.
  const scored = [general, company, salary, schedule]
  const total = scored.reduce((a, t) => a + t.total, 0)
  const filled = scored.reduce((a, t) => a + t.filled, 0)

  return {
    tabs,
    overall: {
      total,
      filled,
      percent: total === 0 ? 100 : Math.round((filled / total) * 100),
    },
  }
}

/** Color semántico para un porcentaje de completitud. */
export function completenessTone(percent: number): 'complete' | 'partial' | 'low' {
  if (percent >= 90) return 'complete'
  if (percent >= 50) return 'partial'
  return 'low'
}
