import { ShiftRequestType } from '@/types/employee'
import { CalendarOff, Timer, RefreshCw, Palmtree, FileText, Fingerprint } from 'lucide-react'
import React from 'react'

export interface ShiftRequestTypeOption {
  type: ShiftRequestType
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  /** Color de acento (hex) para documentos imprimibles de este tipo. */
  accentHex: string
}

export const SHIFT_REQUEST_TYPE_OPTIONS: ShiftRequestTypeOption[] = [
  {
    type: 'permiso_laboral',
    title: 'Permiso Laboral',
    description: 'Solicitud de ausencia por horas o días por calamidad, trámites o citas.',
    icon: CalendarOff,
    iconBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    accentHex: '#7c3aed',
  },
  {
    type: 'horas_extras',
    title: 'Horas Extras',
    description: 'Registro y cálculo de horas suplementarias o extraordinarias.',
    icon: Timer,
    iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    accentHex: '#d97706',
  },
  {
    type: 'cambio_horario',
    title: 'Cambio de Horario',
    description: 'Modificación temporal de jornada de trabajo para fechas específicas.',
    icon: RefreshCw,
    iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    accentHex: '#2563eb',
  },
  {
    type: 'solicitud_vacaciones',
    title: 'Vacaciones',
    description: 'Descanso anual para empleados con más de 1 año.',
    icon: Palmtree,
    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    accentHex: '#059669',
  },
  {
    type: 'incidencia_marcacion',
    title: 'Marcación Biométrica',
    description: 'Constancia informativa para justificar errores del biométrico.',
    icon: Fingerprint,
    iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    accentHex: '#e11d48',
  },
]

export const SHIFT_REQUEST_STATUS_MAP: Record<
  string,
  { label: string; badgeClass: string }
> = {
  pendiente: {
    label: 'Pendiente',
    badgeClass: 'bg-state-warning-bg text-state-warning-fg border-state-warning-border',
  },
  aprobado: {
    label: 'Aprobado',
    badgeClass: 'bg-state-success-bg text-state-success-fg border-state-success-border',
  },
  anulado: {
    label: 'Anulado',
    badgeClass: 'bg-state-neutral-bg text-state-neutral-fg border-state-neutral-border',
  },
  rechazado: {
    label: 'Rechazado',
    badgeClass: 'bg-state-danger-bg text-state-danger-fg border-state-danger-border',
  },
}

