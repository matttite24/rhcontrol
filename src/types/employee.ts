export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  tax_id: string | null         // RFC / RUC / CIF / NIF
  legal_name: string | null     // Razón social
  email: string | null          // Correo corporativo
  phone: string | null          // Teléfono de contacto
  website: string | null        // Sitio web
  address: string | null        // Dirección fiscal / física
  city: string | null           // Ciudad
  country: string | null        // País
  created_at: string
}

export type OrgRole = 'owner' | 'admin' | 'member'

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: OrgRole
  created_at: string
  user_email?: string | null
}

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export interface OrganizationInvitation {
  id: string
  organization_id: string
  email: string
  role: 'admin' | 'member'
  token: string
  invited_by?: string | null
  status: InvitationStatus
  expires_at: string
  created_at: string
}

export type OrganizationInsert = Omit<Organization, 'id' | 'created_at'>
export type OrganizationUpdate = Partial<Omit<Organization, 'id' | 'created_at'>>

export type EmployeeStatus = 'activo' | 'inactivo' | 'prueba'
export type ContractType = 'Indefinido' | 'Eventual' | 'Por Obra' | 'Plazo Fijo' | 'Pasantía'
export type PaymentType = 'Transferencia' | 'Efectivo' | 'Cheque'
export type PaymentGroup = 'Costos' | 'Gastos' | 'Administrativo' | 'Ventas' | 'Operaciones'
export type Gender = 'Masculino' | 'Femenino' | 'Otro'
export type CivilStatus = 'Soltero/a' | 'Casado/a' | 'Divorciado/a' | 'Viudo/a' | 'Unión Libre'
export type AccountType = 'Ahorros' | 'Corriente'
export type ReserveFunds = 'pagar_ano' | 'pagar_ingreso' | 'acumular_ano' | 'acumular_ingreso'

export interface Employee {
  id: string
  organization_id: string
  full_name: string
  email: string | null
  national_id?: string | null   // Cédula de ciudadanía / Documento de identidad
  phone: string | null
  phone_secondary: string | null
  address: string | null
  province: string | null
  civil_status: string | null
  position: string | null
  department: string | null
  hire_date: string | null
  termination_date: string | null
  status: EmployeeStatus
  avatar_url: string | null
  notes: string | null
  
  // Datos Personales
  birth_date: string | null
  has_disability: boolean
  gender: string | null
  
  // Datos para la Empresa / Pago
  contract_type: string | null
  payment_type: string | null
  bank_name: string | null
  /** Código de banco (2-4 dígitos), ingresado manualmente junto al nombre del banco. */
  bank_code: string | null
  account_type: string | null
  account_number: string | null
  check_issuing_bank: string | null

  // Configuraciones Generales
  reserve_funds: string | null
  accumulate_decimals: boolean
  spouse_extension: boolean
  /**
   * Anticipo quincenal recurrente (ej. $200), opcional. Se paga a mitad de
   * mes y se resta del rol mensual completo — ver calculatePayroll, que solo
   * lo resta si el corte cubre más de 15 días (un corte quincenal ya ES el
   * pago del anticipo, no debe restarse de sí mismo).
   */
  biweekly_advance_amount: number | null
  
  // Otras Configuraciones / IESS
  iess_code: string | null
  personal_charges: number
  // Gerente Propietario de compañía: se autoafilia al IESS y aporta él mismo
  // el equivalente personal + patronal combinado (17.60%), en vez del 9.45%
  // de aporte personal normal. La empresa no genera aporte patronal (12.15%)
  // aparte para él — ver src/lib/payroll/ecuador.ts (IESS_MANAGER_OWNER_RATE).
  is_owner_manager: boolean
  
  created_at: string
  updated_at: string
}

export type EmployeeInsert = Omit<Employee, 'id' | 'created_at' | 'updated_at'>
export type EmployeeUpdate = Partial<EmployeeInsert>

export interface Department {
  id: string
  organization_id: string
  name: string
  description: string | null
  created_at: string
}

export type DepartmentInsert = Omit<Department, 'id' | 'created_at'>

export interface Position {
  id: string
  organization_id: string
  name: string
  description: string | null
  created_at: string
}

export interface Holiday {
  id: string
  organization_id: string
  date: string
  name: string
  created_at: string
}

export type HolidayInsert = Omit<Holiday, 'id' | 'created_at'>

export type PositionInsert = Omit<Position, 'id' | 'created_at'>

export type SalaryType = 'Sueldo' | 'Bonificacion' | 'Extras'

export interface EmployeeSalary {
  id: string
  organization_id: string
  employee_id: string
  salary_type: SalaryType
  name: string | null
  amount: number
  affects_iess: boolean
  created_at: string
}

export type EmployeeSalaryInsert = Omit<EmployeeSalary, 'id' | 'created_at'>

export type DayOfWeek = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo'

export interface EmployeeSchedule {
  id: string
  organization_id: string
  employee_id: string
  day_of_week: DayOfWeek
  day_order: number
  is_workday: boolean
  has_split_shift: boolean
  start_time_1: string | null
  end_time_1: string | null
  start_time_2: string | null
  end_time_2: string | null
  created_at: string
}

/**
 * Patrón de horario rotativo reutilizable (ej. "4 libres + 10 trabajo").
 * `days_off` son offsets 0-indexados dentro del ciclo (0 = día de la fecha
 * ancla); cualquier offset no listado se considera laborable.
 */
export interface RotatingShiftPattern {
  id: string
  organization_id: string
  name: string
  cycle_length: number
  days_off: number[]
  created_at: string
  updated_at: string
}

export type RotatingShiftPatternInsert = Omit<RotatingShiftPattern, 'id' | 'created_at' | 'updated_at'>

/** Asignación de un patrón rotativo a un empleado, con su propia fecha ancla. */
export interface EmployeeRotatingSchedule {
  id: string
  organization_id: string
  employee_id: string
  pattern_id: string
  anchor_date: string
  created_at: string
  updated_at: string
  pattern?: RotatingShiftPattern
}

export type EmployeeRotatingScheduleInsert = Omit<EmployeeRotatingSchedule, 'id' | 'created_at' | 'updated_at' | 'pattern'>

export type IncidentType =
  | 'actividad_no_conforme'
  | 'llamado_atencion'
  | 'solicitud_vacaciones'
  | 'anticipo_sueldo'
  | 'incapacidad'
  | 'permiso_laboral'
  | 'acta_entrega'
  | 'certificado_trabajo'
  | 'otro'

export type IncidentStatus = 'pendiente' | 'aprobado' | 'rechazado' | 'registrado' | 'anulado'

export interface Incident {
  id: string
  organization_id: string
  employee_id: string
  incident_type: IncidentType
  title: string
  description: string | null
  status: IncidentStatus
  start_date: string | null
  end_date: string | null
  amount: number | null
  document_url: string | null
  metadata: Record<string, any> | null
  created_at: string
  updated_at: string
  // Relación con empleado
  employee?: {
    id: string
    full_name: string
    national_id: string | null
    department: string | null
    position: string | null
    avatar_url: string | null
  }
}

export type LeaveUnit = 'dias' | 'horas'

export type LeaveRecoveryMethod =
  | 'cargo_vacaciones'
  | 'descuento_dia'
  | 'recuperacion_dias'
  | 'reemplazo_personal'
  /**
   * Falta autorizada sin ningún costo: no genera deducción salarial ni
   * descuenta vacaciones. Se elige marcando el checkbox "Autorizar la falta
   * sin descuento" dentro de la tarjeta de "Descuento en día de trabajo" —
   * misma tarjeta visual, comportamiento distinto (ver LeavePermissionWizardModal).
   */
  | 'sin_descuento'

export interface LeaveRecoverySchedule {
  date: string
  start_time: string
  end_time: string
  hours: number
}

export interface LeaveIncidentMetadata {
  leave_unit: LeaveUnit
  requested_days?: number
  start_date: string
  end_date?: string
  date?: string
  start_time?: string
  end_time?: string
  requested_hours?: number
  recovery_method: LeaveRecoveryMethod
  recovery_schedules?: LeaveRecoverySchedule[]
  replacement_employee_id?: string
  replacement_employee_name?: string
  discount_amount?: number
  deduction_id?: string
  incident_id?: string
  shift_request_ids?: string[]
}

export interface ScheduleDayChange {
  date: string // YYYY-MM-DD
  day_of_week: DayOfWeek
  is_workday: boolean
  has_split_shift: boolean
  start_time_1: string
  end_time_1: string
  start_time_2?: string
  end_time_2?: string
  original_summary?: string
  new_summary?: string
}

export interface ScheduleChangeMetadata {
  employee_id: string
  employee_name: string
  national_id?: string
  department?: string
  position?: string
  days_count: number
  day_changes: ScheduleDayChange[]
  reason: string
  sub_type?: string
}

export interface VacationRequestMetadata {
  employee_id: string
  employee_name: string
  national_id?: string
  department?: string
  position?: string
  hire_date?: string
  start_date: string
  end_date: string
  days_count: number
  available_days: number
  remaining_days: number
  settlement_period: string
  reason?: string
  sub_type?: string
  /** true si se autorizaron días del período vigente aún no acumulados proporcionalmente (ver checkbox "Adelantar días" en VacationWizardModal). */
  is_advance?: boolean
}

export type IncidentInsert = Omit<Incident, 'id' | 'created_at' | 'updated_at' | 'employee'>

export type ShiftRequestType = 'horas_extras' | 'cambio_horario' | 'permiso_laboral' | 'solicitud_vacaciones' | 'otro'
export type ShiftRequestStatus = 'pendiente' | 'aprobado' | 'rechazado'

export interface ShiftRequest {
  id: string
  organization_id: string
  employee_id: string
  request_type: ShiftRequestType
  title: string
  reason: string | null
  date: string
  start_time: string | null
  end_time: string | null
  hours: number | null
  status: ShiftRequestStatus
  metadata: Record<string, any> | null
  created_at: string
  updated_at: string
  employee?: {
    id: string
    full_name: string
    national_id: string | null
    department: string | null
    position: string | null
    avatar_url: string | null
  }
}

export type ShiftRequestInsert = Omit<ShiftRequest, 'id' | 'created_at' | 'updated_at' | 'employee'>

export type DeductionType =
  | 'faltante_caja'
  | 'inventario'
  | 'multa'
  | 'prestamo'
  | 'alimentacion'
  | 'otro'

export type DeductionStatus = 'pendiente' | 'aplicado' | 'anulado'

export interface Deduction {
  id: string
  organization_id: string
  employee_id: string
  deduction_type: DeductionType
  title: string
  description: string | null
  amount: number
  is_recurring: boolean
  status: DeductionStatus
  period_month: number | null
  period_year: number | null
  date: string
  metadata: Record<string, any> | null
  created_at: string
  updated_at: string
  employee?: {
    id: string
    full_name: string
    national_id: string | null
    department: string | null
    position: string | null
    avatar_url: string | null
  }
}

export type DeductionInsert = Omit<Deduction, 'id' | 'created_at' | 'updated_at' | 'employee'>

export type PayrollReportStatus = 'borrador' | 'cerrado' | 'pagado'

export interface PayrollReport {
  id: string
  organization_id: string
  title: string
  start_date: string
  end_date: string
  department: string | null
  total_employees: number
  total_income: number
  total_deductions: number
  total_net: number
  status: PayrollReportStatus
  snapshot: any
  created_at: string
  updated_at: string
}

export type PayrollReportInsert = Omit<PayrollReport, 'id' | 'created_at' | 'updated_at'>

/**
 * Ajuste de "horas efectivamente cumplidas" en horas extras aprobadas,
 * capturado durante la revisión de un rol en borrador (ver pestaña Novedades
 * en PayrollDetailModal). Ligado al reporte, no a la solicitud — la
 * solicitud original (documento autorizado) nunca se modifica.
 */
export interface PayrollOvertimeAdjustment {
  id: string
  organization_id: string
  payroll_report_id: string
  shift_request_id: string
  employee_id: string
  actual_hours: number
  reason: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export type PayrollOvertimeAdjustmentInsert = Omit<
  PayrollOvertimeAdjustment,
  'id' | 'created_at' | 'updated_at' | 'created_by'
>

export type EmployeeDocType =
  | 'contrato'
  | 'legalizacion_mdt'
  | 'aviso_entrada_iess'
  | 'cedula_papeleta'
  | 'hoja_vida'
  | 'otro'

export interface EmployeeDocument {
  id: string
  organization_id: string
  employee_id: string
  doc_type: EmployeeDocType
  title: string
  file_url: string | null
  file_name: string | null
  notes: string | null
  uploaded_at: string
}

export type TerminationReason =
  | 'renuncia_voluntaria'
  | 'despido_intempestivo'
  | 'desahucio'
  | 'acuerdo_mutuo'
  | 'fin_contrato'
  | 'visto_bueno'
  | 'otro'

export type SettlementStatus = 'borrador' | 'aprobado' | 'pagado'

export interface EmployeeSettlement {
  id: string
  organization_id: string
  employee_id: string
  termination_date: string
  termination_reason: TerminationReason
  years_served: number

  pending_salary: number
  proportional_13th: number
  proportional_14th: number
  pending_vacations: number
  severance_pay: number
  desahucio_pay: number
  other_income: number
  total_income: number

  pending_deductions: number
  iess_pending: number
  total_deductions: number

  net_settlement: number

  settlement_doc_url: string | null
  iess_exit_doc_url: string | null
  payment_receipt_url: string | null

  status: SettlementStatus
  notes: string | null
  created_at: string
  updated_at: string
  employee?: {
    id: string
    full_name: string
    national_id: string | null
    department: string | null
    position: string | null
    avatar_url: string | null
    hire_date: string | null
  }
}

export type EmployeeSettlementInsert = Omit<EmployeeSettlement, 'id' | 'created_at' | 'updated_at' | 'employee'>
