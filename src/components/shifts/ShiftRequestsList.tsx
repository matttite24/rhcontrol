'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ShiftRequest, ShiftRequestStatus, Organization } from '@/types/employee'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SHIFT_REQUEST_TYPE_OPTIONS, SHIFT_REQUEST_STATUS_MAP } from '@/lib/shifts/constants'
import { ShiftRequestDetailModal } from './ShiftRequestDetailModal'
import { Clock, RefreshCw, FileText, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getShiftRequestCode, INCIDENT_PREFIX_MAP } from '@/lib/incidents/sequence'
import { getInitials } from '@/lib/shifts/format'

interface ShiftRequestsListProps {
  requests: ShiftRequest[]
  organization?: Organization | null
}

function formatEmissionDate(dateStr?: string | null): string {
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

export function ShiftRequestsList({ requests, organization }: ShiftRequestsListProps) {
  const [selectedRequest, setSelectedRequest] = useState<ShiftRequest | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)

  // La paginación ya viene resuelta por el servidor (ver PaginationBar en la
  // page): `requests` aquí es solo la página actual, no la lista completa.
  // NOTA (igual que en IncidentsTableClient): el fallback de código legacy de
  // abajo solo ordena dentro de la página actual, no todo el histórico.

  // Map precalculado para asignar código numérico secuencial (ej. PER-0001, HEX-0001)
  // a registros antiguos creados sin sequence_number en la base de datos
  const requestCodesMap = useMemo(() => {
    const codeMap = new Map<string, string>()
    // Agrupar por tipo cronológicamente (antiguos a recientes)
    const sorted = [...requests].sort((a, b) => {
      const timeA = new Date(a.created_at || a.date || 0).getTime()
      const timeB = new Date(b.created_at || b.date || 0).getTime()
      return timeA - timeB
    })

    const counters: Record<string, number> = {}

    for (const req of sorted) {
      const explicitCode = getShiftRequestCode(req)
      const isLeavePermission = req.request_type === 'permiso_laboral' || req.metadata?.sub_type === 'permiso_laboral'
      const resolvedType = isLeavePermission ? 'permiso_laboral' : req.request_type
      const prefix = INCIDENT_PREFIX_MAP[resolvedType] || 'DOC'

      if (!explicitCode) {
        counters[prefix] = (counters[prefix] || 0) + 1
        const formattedCode = `${prefix}-${counters[prefix].toString().padStart(4, '0')}`
        codeMap.set(req.id, formattedCode)
      } else {
        // Actualizar contador si tiene número
        const numMatch = explicitCode.match(/^[A-Z]{3}-(\d+)$/)
        if (numMatch) {
          const val = parseInt(numMatch[1], 10)
          counters[prefix] = Math.max(counters[prefix] || 0, val)
        }
        codeMap.set(req.id, explicitCode)
      }
    }
    return codeMap
  }, [requests])

  function handleOpenDetail(req: ShiftRequest) {
    const resolvedCode = requestCodesMap.get(req.id) || getShiftRequestCode(req)
    // Enriquecer metadata para que el modal y el documento usen el código numérico asignado
    const enrichedReq: ShiftRequest = {
      ...req,
      metadata: {
        ...req.metadata,
        document_code: req.metadata?.document_code || resolvedCode,
      },
    }
    setSelectedRequest(enrichedReq)
    setDetailModalOpen(true)
  }

  if (requests.length === 0) {
    return (
      <div className="p-16 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          <Clock className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <p className="font-medium text-base">No hay solicitudes de turnos u horas extras</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Crea solicitudes de horas extras o cambios de horario para gestionar las autorizaciones de asistencia del personal.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="w-full">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
              <TableHead className="w-[13%] pl-6 font-semibold">Emisión</TableHead>
              <TableHead className="w-[24%] font-semibold">Empleado</TableHead>
              <TableHead className="w-[34%] font-semibold">Tipo de Novedad</TableHead>
              <TableHead className="w-[18%] font-semibold">Identificador</TableHead>
              <TableHead className="w-[11%] pr-6 text-right font-semibold">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((req) => {
              const isLeavePermission = req.request_type === 'permiso_laboral' || req.metadata?.sub_type === 'permiso_laboral'
              const resolvedType = isLeavePermission ? 'permiso_laboral' : req.request_type
              const typeMeta = SHIFT_REQUEST_TYPE_OPTIONS.find((t) => t.type === resolvedType)
              const TypeIcon = typeMeta?.icon || FileText
              const statusInfo = SHIFT_REQUEST_STATUS_MAP[req.status] ?? SHIFT_REQUEST_STATUS_MAP.pendiente
              const docCode = requestCodesMap.get(req.id) || getShiftRequestCode(req)
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
              } else {
                subtitle = displayTitle
              }

              return (
                <TableRow key={req.id} className="hover:bg-muted/40 transition-colors text-xs">
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
                        {docCode}
                      </span>
                      <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 font-medium border capitalize", statusInfo.badgeClass)}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                  </TableCell>

                  {/* Acciones */}
                  <TableCell className="pr-6 py-3.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDetail(req)}
                      className="h-8 text-xs text-primary font-medium hover:text-primary hover:bg-primary/10 gap-1 cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver detalle
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Modal de Detalle, Impresión y Aprobación */}
      <ShiftRequestDetailModal
        request={selectedRequest}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        organization={organization}
      />
    </>
  )
}
