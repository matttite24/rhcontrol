import { IncidentType } from '@/types/employee'
import {
  AlertTriangle,
  AlertCircle,
  Palmtree,
  DollarSign,
  HeartPulse,
  PackageCheck,
  FileBadge,
} from 'lucide-react'
import React from 'react'

export interface IncidentTypeOption {
  type: IncidentType
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  badgeColor: string
  iconBg: string
  /** Color de acento (hex) para documentos imprimibles de este tipo. */
  accentHex: string
  disabled?: boolean
}

export const INCIDENT_TYPE_OPTIONS: IncidentTypeOption[] = [
  {
    type: 'acta_entrega',
    accentHex: '#4f46e5',
    title: 'Acta de Entrega-Recepción',
    description: 'Asignación formal de uniformes, herramientas, equipos e inventario con cláusula de responsabilidad laboral.',
    icon: PackageCheck,
    badgeColor: 'text-indigo-600 dark:text-indigo-400',
    iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    disabled: false,
  },
  {
    type: 'solicitud_vacaciones',
    accentHex: '#059669',
    title: 'Solicitud de vacaciones',
    description: 'Gestión de días de descanso anual y balance de días pendientes.',
    icon: Palmtree,
    badgeColor: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  {
    type: 'llamado_atencion',
    accentHex: '#e11d48',
    title: 'Llamado de atención',
    description: 'Amonestaciones verbales o escritas con respaldo del Reglamento Interno y Código del Trabajo.',
    icon: AlertCircle,
    badgeColor: 'text-rose-600 dark:text-rose-400',
    iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    disabled: false,
  },
  {
    type: 'actividad_no_conforme',
    accentHex: '#d97706',
    title: 'Actividad no conforme',
    description: 'Registro de desvíos en procesos, fallas operativas o no conformidades.',
    icon: AlertTriangle,
    badgeColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    disabled: false,
  },
  {
    type: 'anticipo_sueldo',
    accentHex: '#2563eb',
    title: 'Anticipo de Sueldo',
    description: 'Solicitud de préstamos o anticipos quincenales para descuento en rol.',
    icon: DollarSign,
    badgeColor: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    disabled: false,
  },
  {
    type: 'incapacidad',
    accentHex: '#9333ea',
    title: 'Permisos Médicos',
    description: 'Certificados médicos IESS, licencias de maternidad/paternidad o enfermedad.',
    icon: HeartPulse,
    badgeColor: 'text-purple-600 dark:text-purple-400',
    iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    disabled: true,
  },
  {
    type: 'certificado_trabajo',
    accentHex: '#0891b2',
    title: 'Certificado de Trabajo',
    description: 'Documento formal con antigüedad, cargo y estado laboral actual del colaborador, firmado por la jefatura.',
    icon: FileBadge,
    badgeColor: 'text-cyan-600 dark:text-cyan-400',
    iconBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    disabled: false,
  },
]

// Tipos de llamado de atención según normativa laboral
export type WarningSeverity = 'verbal' | 'escrito'

// Causal típica en Reglamento Interno y Código del Trabajo Ecuador (Arts. 44, 46, 64)
export interface InternalRegulationClause {
  id: string
  label: string
  article: string
  description: string
  suggestedSeverity: WarningSeverity
}

export const INTERNAL_REGULATION_CLAUSES: InternalRegulationClause[] = [
  {
    id: 'puntualidad_asistencia',
    label: 'Atrasos reiterados / Impuntualidad injustificada',
    article: 'Art. 44 lit. a) y Reglamento Interno de Trabajo',
    description: 'Llegadas con retraso injustificado o abandono temporal del puesto de trabajo sin permiso previo.',
    suggestedSeverity: 'verbal',
  },
  {
    id: 'falta_injustificada',
    label: 'Falta o inasistencia no justificada',
    article: 'Art. 44 lit. a), Art. 172 num. 1 y Reglamento Interno',
    description: 'Ausencia al puesto de trabajo durante la jornada laboral sin debida justificación o aviso oportuno.',
    suggestedSeverity: 'escrito',
  },
  {
    id: 'incumplimiento_funciones',
    label: 'Incumplimiento de funciones u órdenes de superiores',
    article: 'Art. 44 lit. b) y Reglamento Interno de Trabajo',
    description: 'Inobservancia en la ejecución del trabajo asignado o renuencia al cumplimiento de directrices impartidas.',
    suggestedSeverity: 'escrito',
  },
  {
    id: 'seguridad_epp',
    label: 'No uso de EPP / Inobservancia de Seguridad y Salud Ocupacional',
    article: 'Art. 46 lit. f), Art. 410 y Reglamento de Seguridad y Salud',
    description: 'No portar implementos de protección personal o incurrir en actos que pongan en peligro su seguridad y la de sus compañeros.',
    suggestedSeverity: 'escrito',
  },
  {
    id: 'cuidado_bienes',
    label: 'Descuido o mal uso de herramientas, equipos o materiales',
    article: 'Art. 44 lit. f) y Reglamento Interno de Trabajo',
    description: 'Negligencia en la preservación de activos, maquinaria, materia prima o vehículos de la organización.',
    suggestedSeverity: 'escrito',
  },
  {
    id: 'respeto_convivencia',
    label: 'Falta de respeto, indisciplina o alteración del clima laboral',
    article: 'Art. 44 lit. e), Art. 46 y Reglamento Interno de Trabajo',
    description: 'Comportamientos o expresiones que atentan contra la disciplina, compañerismo o la debida atención a clientes.',
    suggestedSeverity: 'escrito',
  },
  {
    id: 'otro_reglamento',
    label: 'Otra infracción al Reglamento Interno',
    article: 'Reglamento Interno de Trabajo y Código del Trabajo',
    description: 'Otra inobservancia estipulada en el reglamento interno debidamente aprobado por el Ministerio del Trabajo.',
    suggestedSeverity: 'escrito',
  },
]

// Categorías de actividades no conformes operativas
export interface NonCompliantCategory {
  id: string
  label: string
  description: string
  legalReference: string
}

export const NON_COMPLIANT_CATEGORIES: NonCompliantCategory[] = [
  {
    id: 'marcacion_biometrico',
    label: 'Marcación errónea o no registro en biométrico',
    description: 'Omisión de registro en el reloj biométrico al ingreso, salida o receso sin justificación previa.',
    legalReference: 'Art. 44 lit. a) Código del Trabajo y Reglamento Interno (Control de Jornada)',
  },
  {
    id: 'error_facturacion',
    label: 'Error en facturación / cuadre de caja',
    description: 'Errores involuntarios pero reiterados en emisión de comprobantes o descuadres menores.',
    legalReference: 'Art. 44 lit. b) Código del Trabajo (Diligencia en funciones)',
  },
  {
    id: 'no_entrega_documentacion',
    label: 'No entrega de documentación requerida',
    description: 'Falta de presentación de justificativos, bitácoras, reportes o documentación asignada en el plazo indicado.',
    legalReference: 'Art. 44 lit. b) Código del Trabajo (Obligaciones del trabajador)',
  },
  {
    id: 'imagen_personal_uniforme',
    label: 'Incumplimiento de uniforme e imagen personal',
    description: 'No portar el uniforme institucional reglamentario o no cumplir las normas de higiene y presentación.',
    legalReference: 'Art. 44 lit. e) y Reglamento Interno de Trabajo',
  },
  {
    id: 'incumplimiento_tareas',
    label: 'Cumplimiento deficiente de tareas designadas',
    description: 'Retraso o entrega con falencias de asignaciones operativas delegadas por la jefatura.',
    legalReference: 'Art. 44 lit. b) Código del Trabajo',
  },
  {
    id: 'limpieza_local',
    label: 'Incumplimiento de procedimiento de limpieza y orden',
    description: 'No mantener la estación de trabajo, local o herramientas en óptimas condiciones de orden y aseo.',
    legalReference: 'Art. 44 lit. f) Código del Trabajo y Normas de Higiene',
  },
  {
    id: 'calidad_servicio',
    label: 'Afectación a la percepción de limpieza y calidad del servicio',
    description: 'Descuido en el estándar de presentación del local o servicio perceptible por los clientes.',
    legalReference: 'Reglamento Interno de Trabajo (Estándares de Calidad y Servicio)',
  },
  {
    id: 'quejas_clientes',
    label: 'Quejas o descontento en atención al cliente',
    description: 'Reportes de usuarios por trato poco cortés, demora injustificada o falta de empatía comercial.',
    legalReference: 'Art. 44 lit. e) Código del Trabajo y Reglamento Interno',
  },
  {
    id: 'uso_celular',
    label: 'Uso indebido de celular en horario laboral',
    description: 'Uso recreativo de dispositivos electrónicos personales en horario operativo distrayendo sus labores.',
    legalReference: 'Reglamento Interno de Trabajo y Directrices de Productividad',
  },
  {
    id: 'otra_no_conformidad',
    label: 'Otra actividad no conforme u operativa',
    description: 'Otra inobservancia operativa o procedimental de menor escala.',
    legalReference: 'Reglamento Interno de Trabajo',
  },
]

// Categorías de bienes / activos entregables
export interface DeliveryAssetCategory {
  id: string
  label: string
  iconName?: string
  examples: string
}

export const DELIVERY_ASSET_CATEGORIES: DeliveryAssetCategory[] = [
  {
    id: 'uniformes',
    label: 'Uniformes y Prendas Institucionales',
    examples: 'Camisas, pantalones, mandiles, chalecos, calzado de trabajo',
  },
  {
    id: 'herramientas',
    label: 'Herramientas y Utensilios de Trabajo',
    examples: 'Herramientas manuales, tijeras, cajas de herramientas, insumos de poda',
  },
  {
    id: 'equipos_tecnologicos',
    label: 'Equipos Tecnológicos y Comunicación',
    examples: 'Laptop, computador, monitor, tablet, teléfono celular, radio transceptor',
  },
  {
    id: 'seguridad_epp',
    label: 'Equipo de Protección Personal (EPP)',
    examples: 'Casco, gafas, guantes certificados, botas punta de acero, arnés',
  },
  {
    id: 'inventario_mobiliario',
    label: 'Mobiliario, Activos e Inventario General',
    examples: 'Llaves, credenciales, caja de seguridad, vehículos, mobiliario',
  },
  {
    id: 'otros',
    label: 'Otros Bienes Asignados',
    examples: 'Otros implementos específicos según el área operativa',
  },
]

// Ítem de bien / activo en el acta de entrega
export interface DeliveryAssetItem {
  id: string
  category: string
  quantity: number
  description: string
  unitValue: number
  totalValue: number
  condition: 'nuevo' | 'bueno' | 'regular'
  serialOrCode?: string
}

// Cláusula legal de descuento por pérdida o daño (Art. 44 lit. f, Art. 42 num. 22 y Art. 90 del Código del Trabajo)
export const LEGAL_DISCOUNT_DISCLAIMER_ECUADOR =
  'De conformidad con el Artículo 44 literal f) del Código del Trabajo de la República del Ecuador y el Reglamento Interno de la empresa, el trabajador asume la custodia, conservación y cuidado diligente de los bienes, herramientas, equipos y uniformes detallados en la presente acta. En caso de pérdida, extravío, sustracción culposa, daño intencional o deterioro atribuible a culpa grave o descuido inexcusable en el uso de los mismos, el colaborador autoriza expresamente de forma libre y voluntaria a la empresa para que el valor reposición o reparación de los bienes aquí descritos sea descontado de su remuneración mensual ordinaria o, en su defecto, liquidado en el acta de finiquito definitiva, con sujeción a los límites y previsiones contempladas en el Código del Trabajo.'
