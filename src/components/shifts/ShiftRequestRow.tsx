'use client'

import Link from 'next/link'
import { ShiftRequest } from '@/types/employee'
import { TableRow, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SHIFT_REQUEST_TYPE_OPTIONS, SHIFT_REQUEST_STATUS_MAP } from '@/lib/shifts/constants'
import { Eye, Pencil, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/shifts/format'

/** Tipos de novedad que hoy soportan edición mientras están 'pendiente'. */
export const EDITABLE_TYPES = new Set(['horas_extras', 'solicitud_vacaciones'])

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  sin_marcacion: 'Sin Marcación',
  doble_marcacion: 'Doble Marcación',
  marcacion_fuera_de_tiempo: 'Marcación Fuera de Tiempo',
}

export function formatEmissionDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  // Soporta ISO timestamps o cadenas YYYY-MM-DD
  const cleanStr = dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`
  const d = new Date(cleanStr)
  if (isNaN(d.getTime())) return dateStr

  const rawDayName = d.toLocaleDateString('es-EC', { weekday: 'short' })
  // Capitalizar día (ej. 'Sáb' -> 'Sáb' o 'Sábado' corto)
  const dayName = rawDayName.charAt(0).toUpperCase() + rawDayName.slice(1).replace('.', '')
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()

  return `${dayName}, ${dd}/${mm}/${yyyy}`
}

interface ShiftRequestRowProps {
  request: ShiftRequest
  documentCode: string
  onOpenDetail: (req: ShiftRequest) => void
  onOpenEdit: (req: ShiftRequest) => void
}

/** Una fila de la tabla de /shifts/requests: resuelve tipo/subtítulo/estado y renderiza las celdas. */
export function ShiftRequestRow({ request: req, documentCode, onOpenDetail, onOpenEdit }: ShiftRequestRowProps) {
  const isLeavePermission = req.request_type === 'permiso_laboral' || req.metadata?.sub_type === 'permiso_laboral'
  const isVacation = req.request_type === 'solicitud_vacaciones' || req.metadata?.sub_type === 'solicitud_vacaciones'
  const isBiometricIncident = req.request_type === 'incidencia_marcacion' || req.metadata?.sub_type === 'incidencia_marcacion'
  // Igual que horas extras/permisos: algunas filas quedan guardadas con
  // request_type='otro' + metadata.sub_type='solicitud_vacaciones' (fallback
  // cuando el check constraint de Postgres rechazaba el tipo directo) — sin
  // esta normalización, esas filas caían al icono genérico FileText en vez
  // de la palmera.
  const resolvedType = isLeavePermission
    ? 'permiso_laboral'
    : isVacation
    ? 'solicitud_vacaciones'
    : isBiometricIncident
    ? 'incidencia_marcacion'
    : req.request_type
  const typeMeta = SHIFT_REQUEST_TYPE_OPTIONS.find((t) => t.type === resolvedType)
  const TypeIcon = typeMeta?.icon || FileText
  // Sin flujo de aprobación: "rechazado" se reutiliza como "Anulado" (no
  // existe status propio en la base de datos).
  const statusInfo =
    isBiometricIncident && req.status === 'rechazado'
      ? { label: 'Anulado', badgeClass: SHIFT_REQUEST_STATUS_MAP.rechazado.badgeClass }
      : SHIFT_REQUEST_STATUS_MAP[req.status] ?? SHIFT_REQUEST_STATUS_MAP.pendiente
  const displayTitle = req.title ? req.title.replace(/^\[[A-Z]{3}-\d+\]\s*/, '') : ''

  // Subtítulo limpio y sin redundancias
  let subtitle = ''
  if (resolvedType === 'permiso_laboral') {
    const days = req.metadata?.requested_days || 1
    const unit = req.metadata?.leave_unit === 'horas' ? `${req.hours || 1} hrs` : `${days} día(s)`
    subtitle = `${unit} (${req.start_time || '08:00'} - ${req.end_time || '17:00'})`
  } else if (resolvedType === 'cambio_horario') {
    subtitle = `${req.start_time || ''}${req.end_time ? ` - ${req.end_time}` : ''}`
  } else if (resolvedType === 'horas_extras') {
    const rateLabel = req.metadata?.overtime_type === 'suplementaria_50' ? '50% Recargo' : '100% Extraordinaria'
    subtitle = `${req.hours} hrs (${req.start_time || ''} - ${req.end_time || ''}) • ${rateLabel}`
  } else if (resolvedType === 'solicitud_vacaciones') {
    const days = req.metadata?.days_count || (req.hours ? Math.round(req.hours / 8) : 1)
    subtitle = `${days} día(s) de descanso legal`
  } else if (resolvedType === 'incidencia_marcacion') {
    subtitle = INCIDENT_TYPE_LABELS[req.metadata?.incident_type] || 'Marcación Biométrica'
  } else {
    subtitle = displayTitle
  }

  return (
    <TableRow className="hover:bg-muted/40 transition-colors text-xs">
      {/* 1. Emisión */}
      <TableCell className="pl-6 py-3.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
        <span className="text-foreground font-medium">{formatEmissionDate(req.created_at || req.date)}</span>
      </TableCell>

      {/* 2. Empleado */}
      <TableCell className="py-3.5">
        {req.employee ? (
          <div className="flex items-center gap-3">
            <Link
              href={`/employees/${req.employee.id}`}
              title={`Ver expediente de ${req.employee.full_name}`}
              aria-label={`Ver expediente de ${req.employee.full_name}`}
              className="shrink-0 rounded-full transition-transform duration-150 ease-out motion-reduce:transition-none active:scale-90 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 cursor-pointer"
            >
              <Avatar className="h-8 w-8 ring-1 ring-border">
                <AvatarImage src={req.employee.avatar_url ?? undefined} alt={req.employee.full_name} />
                <AvatarFallback className="text-[10px] font-semibold">
                  {getInitials(req.employee.full_name)}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-foreground truncate">
                {req.employee.full_name}
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {req.employee.national_id ?? req.employee.department ?? '—'}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground italic">Sin empleado</span>
        )}
      </TableCell>

      {/* 3. Tipo de Solicitud con detalle limpio y conciso */}
      <TableCell className="py-3.5">
        <div className="flex items-center gap-2.5">
          <div className={cn("p-1.5 rounded-md border shrink-0", typeMeta?.iconBg)}>
            <TypeIcon className="h-3.5 w-3.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-foreground truncate">
              {typeMeta?.title || displayTitle}
            </span>
            {subtitle && (
              <span className="text-[11px] text-muted-foreground font-mono truncate max-w-sm mt-0.5">
                {subtitle}
              </span>
            )}
          </div>
        </div>
      </TableCell>

      {/* 4. Identificador: Código sin borde + Estado en misma fila */}
      <TableCell className="py-3.5">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="font-mono text-xs font-semibold text-foreground tracking-tight">
            {documentCode}
          </span>
          <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 font-medium border capitalize", statusInfo.badgeClass)}>
            {statusInfo.label}
          </Badge>
        </div>
      </TableCell>

      {/* Acciones */}
      <TableCell className="pr-6 py-3.5 text-right">
        <div className="flex items-center justify-end gap-1">
          {req.status === 'pendiente' && EDITABLE_TYPES.has(resolvedType) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenEdit(req)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Editar novedad pendiente"
              aria-label="Editar novedad pendiente"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenDetail(req)}
            className="h-8 text-xs text-primary font-medium hover:text-primary hover:bg-primary/10 gap-1 cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5" />
            Ver detalle
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
