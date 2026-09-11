'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Incident, IncidentStatus, Organization } from '@/types/employee'
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
import { INCIDENT_TYPE_OPTIONS } from '@/lib/incidents/constants'
import { getIncidentCode, INCIDENT_PREFIX_MAP } from '@/lib/incidents/sequence'
import { IncidentDetailModal } from './IncidentDetailModal'
import { FileText, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IncidentsTableClientProps {
  incidents: Incident[]
  organization?: Organization | null
}

const statusConfig: Record<
  IncidentStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  registrado: { label: 'Registrado', variant: 'default' },
  aprobado: { label: 'Aprobado', variant: 'secondary' },
  pendiente: { label: 'Pendiente', variant: 'outline' },
  rechazado: { label: 'Rechazado', variant: 'destructive' },
  anulado: { label: 'Anulado', variant: 'destructive' },
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function formatEmissionDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  const cleanStr = dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`
  const d = new Date(cleanStr)
  if (isNaN(d.getTime())) return dateStr

  const rawDayName = d.toLocaleDateString('es-EC', { weekday: 'short' })
  const dayName = rawDayName.charAt(0).toUpperCase() + rawDayName.slice(1).replace('.', '')
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()

  return `${dayName}, ${dd}/${mm}/${yyyy}`
}

export function IncidentsTableClient({ incidents, organization }: IncidentsTableClientProps) {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)

  // La paginación ya viene resuelta por el servidor (ver PaginationBar en la
  // page): `incidents` aquí es solo la página actual, no la lista completa.
  // NOTA: el mapa de códigos de abajo es un fallback solo para incidencias
  // legacy sin `metadata.document_code` guardado — con paginación, ese
  // fallback ordena únicamente dentro de la página actual (no todo el
  // histórico), así que para esos registros antiguos específicos puede
  // numerar distinto a como lo hacía antes. No afecta a registros con código
  // ya persistido (la mayoría) ni a datos reales de nómina/incidencias.

  // Map secuencial de códigos numéricos (ej. ANT-0001, LLA-0001, ANC-0001) para registros previos
  const incidentCodesMap = useMemo(() => {
    const codeMap = new Map<string, string>()
    const sorted = [...incidents].sort((a, b) => {
      const timeA = new Date(a.created_at || a.start_date || 0).getTime()
      const timeB = new Date(b.created_at || b.start_date || 0).getTime()
      return timeA - timeB
    })

    const counters: Record<string, number> = {}

    for (const inc of sorted) {
      const explicitCode = getIncidentCode(inc)
      const prefix = INCIDENT_PREFIX_MAP[inc.incident_type || 'otro'] || 'DOC'

      if (!explicitCode) {
        counters[prefix] = (counters[prefix] || 0) + 1
        const formatted = `${prefix}-${counters[prefix].toString().padStart(4, '0')}`
        codeMap.set(inc.id, formatted)
      } else {
        const numMatch = explicitCode.match(/^[A-Z]{3}-(\d+)$/)
        if (numMatch) {
          const val = parseInt(numMatch[1], 10)
          counters[prefix] = Math.max(counters[prefix] || 0, val)
        }
        codeMap.set(inc.id, explicitCode)
      }
    }
    return codeMap
  }, [incidents])

  function handleOpenDetail(inc: Incident) {
    const resolvedCode = incidentCodesMap.get(inc.id) || getIncidentCode(inc)
    const enrichedInc: Incident = {
      ...inc,
      metadata: {
        ...inc.metadata,
        document_code: inc.metadata?.document_code || resolvedCode,
      },
    }
    setSelectedIncident(enrichedInc)
    setDetailModalOpen(true)
  }

  return (
    <>
      <div className="w-full">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
              <TableHead className="w-[13%] pl-6 font-semibold">Emisión</TableHead>
              <TableHead className="w-[24%] font-semibold">Empleado</TableHead>
              <TableHead className="w-[34%] font-semibold">Tipo / Asunto</TableHead>
              <TableHead className="w-[18%] font-semibold">Identificador</TableHead>
              <TableHead className="w-[11%] pr-6 text-right font-semibold">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incidents.map((inc) => {
              const effectiveType = (inc.incident_type === 'otro' && inc.metadata?.sub_type)
                ? inc.metadata.sub_type
                : inc.incident_type
              const typeMeta = INCIDENT_TYPE_OPTIONS.find((t) => t.type === effectiveType)
              const TypeIcon = typeMeta?.icon || FileText
              const status = statusConfig[inc.status] ?? statusConfig.registrado
              const docCode = incidentCodesMap.get(inc.id) || getIncidentCode(inc)
              const cleanTitle = inc.title.replace(/^\[[A-Z]{3}-\d+\]\s*/, '')

              return (
                <TableRow key={inc.id} className="hover:bg-muted/40 transition-colors text-xs">
                  {/* 1. Emisión */}
                  <TableCell className="pl-6 py-3.5 text-muted-foreground font-mono text-[11px] whitespace-nowrap">
                    <span className="text-foreground font-medium">
                      {formatEmissionDate(inc.created_at || inc.start_date)}
                    </span>
                  </TableCell>

                  {/* 2. Empleado */}
                  <TableCell className="py-3.5">
                    {inc.employee ? (
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/employees/${inc.employee.id}`}
                          title={`Ver expediente de ${inc.employee.full_name}`}
                          aria-label={`Ver expediente de ${inc.employee.full_name}`}
                          className="shrink-0 rounded-full transition-transform duration-150 ease-out motion-reduce:transition-none active:scale-90 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 cursor-pointer"
                        >
                          <Avatar className="h-8 w-8 ring-1 ring-border">
                            <AvatarImage
                              src={inc.employee.avatar_url ?? undefined}
                              alt={inc.employee.full_name}
                            />
                            <AvatarFallback className="text-[10px] font-semibold">
                              {getInitials(inc.employee.full_name)}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-foreground truncate">
                            {inc.employee.full_name}
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {inc.employee.national_id ?? inc.employee.department ?? '—'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">Sin empleado asociado</span>
                    )}
                  </TableCell>

                  {/* 3. Tipo de Incidencia / Asunto */}
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-2">
                      <div className={cn('p-1.5 rounded-md border shrink-0', typeMeta?.iconBg)}>
                        <TypeIcon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-foreground truncate">
                          {typeMeta?.title || cleanTitle}
                        </span>
                        {cleanTitle && (
                          <span className="text-[11px] text-muted-foreground truncate max-w-xs">
                            {cleanTitle}
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
                      <Badge variant={status.variant} className="text-[10px] h-5 px-1.5 font-medium border capitalize">
                        {status.label}
                      </Badge>
                    </div>
                  </TableCell>

                  {/* 6. Acciones */}
                  <TableCell className="pr-6 py-3.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDetail(inc)}
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

      {/* Modal interactivo de Detalle & Aprobación */}
      <IncidentDetailModal
        incident={selectedIncident}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onStatusChanged={(updated) => {
          setSelectedIncident(updated)
        }}
        organization={organization}
      />
    </>
  )
}
