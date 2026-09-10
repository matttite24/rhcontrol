import { DeductionType } from '@/types/employee'
import {
  DollarSign,
  PackageX,
  AlertTriangle,
  Utensils,
} from 'lucide-react'
import React from 'react'

export interface DeductionTypeOption {
  type: DeductionType
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  badgeColor: string
  iconBg: string
}

export const DEDUCTION_TYPE_OPTIONS: DeductionTypeOption[] = [
  {
    type: 'faltante_caja',
    title: 'Faltante de caja',
    description: 'Diferencia negativa identificada en cuadre o arqueo de caja.',
    icon: DollarSign,
    badgeColor: 'text-rose-600 dark:text-rose-400',
    iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  },
  {
    type: 'inventario',
    title: 'Descuento por inventario',
    description: 'Pérdida, merma no justificada o daño de mercadería/herramientas.',
    icon: PackageX,
    badgeColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  {
    type: 'multa',
    title: 'Multa disciplinaria',
    description: 'Sanción económica contemplada en el reglamento interno.',
    icon: AlertTriangle,
    badgeColor: 'text-orange-600 dark:text-orange-400',
    iconBg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  },
  {
    type: 'alimentacion',
    title: 'Alimentación / Vivienda',
    description: 'Descuento recurrente mensual fijo o calculado por días trabajados.',
    icon: Utensils,
    badgeColor: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
]
