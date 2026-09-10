export interface EcuadorComplianceNotice {
  id: string
  title: string
  authority: 'IESS' | 'MDT' | 'SRI' | 'Empresa'
  frequency: string
  dueDay: number // Día del mes o mes específico
  dueDescription: string
  description: string
  severity: 'high' | 'medium' | 'info'
  link?: string
}

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/**
 * Calcula la próxima fecha de vencimiento de un aviso y los días que faltan
 * (desde `today`, por defecto ahora). Para "Mensual" usa el dueDay del mes
 * actual o del siguiente si ya pasó; para "Anual (Mes)" usa ese mes/día del
 * año actual o del próximo si ya pasó; "Permanente" no tiene fecha fija
 * (depende de eventos, no de calendario) y no produce cuenta regresiva.
 */
export function getNoticeNextDueDate(
  notice: Pick<EcuadorComplianceNotice, 'frequency' | 'dueDay'>,
  today: Date = new Date()
): { nextDate: Date; daysRemaining: number } | null {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const annualMatch = notice.frequency.match(/\(([^)]+)\)/)
  if (annualMatch) {
    const monthIndex = MONTH_NAMES.indexOf(annualMatch[1].toLowerCase())
    if (monthIndex === -1) return null
    let dueDate = new Date(startOfToday.getFullYear(), monthIndex, notice.dueDay)
    if (dueDate < startOfToday) {
      dueDate = new Date(startOfToday.getFullYear() + 1, monthIndex, notice.dueDay)
    }
    const daysRemaining = Math.round((dueDate.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000))
    return { nextDate: dueDate, daysRemaining }
  }

  if (notice.frequency === 'Mensual') {
    let dueDate = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), notice.dueDay)
    if (dueDate < startOfToday) {
      dueDate = new Date(startOfToday.getFullYear(), startOfToday.getMonth() + 1, notice.dueDay)
    }
    const daysRemaining = Math.round((dueDate.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000))
    return { nextDate: dueDate, daysRemaining }
  }

  // "Permanente" u otras frecuencias sin fecha de calendario fija
  return null
}

// Avisos de cumplimiento legal en Ecuador (IESS, MDT, Nómina)
export const ECUADOR_COMPLIANCE_NOTICES: EcuadorComplianceNotice[] = [
  {
    id: 'iess_planillas',
    title: 'Pago de Planillas IESS (Aportes y Préstamos)',
    authority: 'IESS',
    frequency: 'Mensual',
    dueDay: 15,
    dueDescription: 'Hasta el 15 de cada mes',
    description: 'Generación y pago oportuno de planillas de aportes personales (9.45%), patronales (11.15% o 12.15%) y fondos de reserva sin intereses de mora.',
    severity: 'high',
  },
  {
    id: 'pago_sueldo',
    title: 'Pago de Sueldos y Liquidación Mensual',
    authority: 'Empresa',
    frequency: 'Mensual',
    dueDay: 30,
    dueDescription: 'Último día laborable del mes',
    description: 'Pago final de nómina neta y entrega de roles de pago individuales firmados a cada empleado.',
    severity: 'high',
  },
  {
    id: 'decimo_cuarto_costa',
    title: 'Pago Décimo Cuarto Sueldo (Régimen Costa / Galápagos)',
    authority: 'MDT',
    frequency: 'Anual (Marzo)',
    dueDay: 15,
    dueDescription: 'Hasta el 15 de marzo',
    description: 'Pago de 1 SBU a los empleados bajo régimen escolar Costa que no acumulan sus décimos.',
    severity: 'high',
  },
  {
    id: 'decimo_cuarto_sierra',
    title: 'Pago Décimo Cuarto Sueldo (Régimen Sierra / Amazonía)',
    authority: 'MDT',
    frequency: 'Anual (Agosto)',
    dueDay: 15,
    dueDescription: 'Hasta el 15 de agosto',
    description: 'Pago de 1 SBU a los empleados bajo régimen escolar Sierra/Amazonía que mensualizan o acumulan.',
    severity: 'high',
  },
  {
    id: 'decimo_tercero',
    title: 'Pago Décimo Tercer Sueldo (Bono Navideño)',
    authority: 'MDT',
    frequency: 'Anual (Diciembre)',
    dueDay: 24,
    dueDescription: 'Hasta el 24 de diciembre',
    description: 'Pago de la doceava parte de las remuneraciones percibidas durante el año (diciembre a noviembre).',
    severity: 'high',
  },
  {
    id: 'utilidades',
    title: 'Pago del 15% de Participación de Utilidades',
    authority: 'MDT',
    frequency: 'Anual (Abril)',
    dueDay: 15,
    dueDescription: 'Hasta el 15 de abril',
    description: 'Distribución del 10% a trabajadores y 5% por cargas familiares legalmente declaradas.',
    severity: 'high',
  },
  {
    id: 'registro_sut',
    title: 'Legalización de Contratos y Actas en MDT (SUT)',
    authority: 'MDT',
    frequency: 'Permanente',
    dueDay: 30,
    dueDescription: 'Máximo 30 días posteriores al ingreso o salida',
    description: 'Registro obligatorio de nuevos contratos y actas de finiquito en el portal del Sistema Único del Trabajo (SUT).',
    severity: 'medium',
  },
]
