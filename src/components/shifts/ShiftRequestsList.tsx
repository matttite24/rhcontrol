'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Employee, ShiftRequest, Organization } from '@/types/employee'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
} from '@/components/ui/table'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ShiftRequestDetailModal } from './ShiftRequestDetailModal'
import { ShiftRequestRow } from './ShiftRequestRow'
import { Clock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getShiftRequestCode, INCIDENT_PREFIX_MAP } from '@/lib/incidents/sequence'

// Solo Horas Extras y Vacaciones soportan edición por ahora — se cargan bajo
// demanda para no inflar el bundle de /shifts/requests con componentes que
// la mayoría de aperturas de la página no necesita.
const wizardLoading = (
  <div className="flex items-center justify-center p-12">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
)
const OvertimeWizardModal = dynamic(
  () => import('./OvertimeWizardModal').then((m) => m.OvertimeWizardModal),
  { loading: () => wizardLoading }
)
const VacationWizardModal = dynamic(
  () => import('./VacationWizardModal').then((m) => m.VacationWizardModal),
  { loading: () => wizardLoading }
)

interface ShiftRequestsListProps {
  requests: ShiftRequest[]
  organization?: Organization | null
  employees?: Employee[]
  organizationId?: string
  organizationName?: string
}

export function ShiftRequestsList({
  requests,
  organization,
  employees = [],
  organizationId,
  organizationName,
}: ShiftRequestsListProps) {
  const router = useRouter()
  const [selectedRequest, setSelectedRequest] = useState<ShiftRequest | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [editingRequest, setEditingRequest] = useState<ShiftRequest | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)

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
      const isBiometricIncident = req.request_type === 'incidencia_marcacion' || req.metadata?.sub_type === 'incidencia_marcacion'
      const resolvedType = isLeavePermission ? 'permiso_laboral' : isBiometricIncident ? 'incidencia_marcacion' : req.request_type
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

  function handleOpenEdit(req: ShiftRequest) {
    setEditingRequest(req)
    setEditModalOpen(true)
  }

  function handleEditOpenChange(open: boolean) {
    setEditModalOpen(open)
    if (!open) setEditingRequest(null)
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
            {requests.map((req) => (
              <ShiftRequestRow
                key={req.id}
                request={req}
                documentCode={requestCodesMap.get(req.id) || getShiftRequestCode(req)}
                onOpenDetail={handleOpenDetail}
                onOpenEdit={handleOpenEdit}
              />
            ))}
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

      {/* Modal de Edición: reutiliza el mismo wizard de creación, precargado
          con los datos de la solicitud pendiente (ver EDITABLE_TYPES). */}
      <Dialog open={editModalOpen} onOpenChange={handleEditOpenChange}>
        <DialogContent
          className={cn(
            editingRequest?.request_type === 'solicitud_vacaciones' ||
              editingRequest?.metadata?.sub_type === 'solicitud_vacaciones'
              ? 'sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0'
              : 'sm:max-w-2xl p-0 overflow-hidden border-border/80 gap-0 max-h-[90vh] flex flex-col'
          )}
          showCloseButton={false}
        >
          {editingRequest && editingRequest.request_type === 'horas_extras' && organizationId && (
            <OvertimeWizardModal
              organizationId={organizationId}
              organizationName={organizationName}
              employees={employees}
              editRequest={editingRequest}
              onOpenChange={handleEditOpenChange}
              onSuccess={() => router.refresh()}
            />
          )}
          {editingRequest &&
            (editingRequest.request_type === 'solicitud_vacaciones' ||
              editingRequest.metadata?.sub_type === 'solicitud_vacaciones') &&
            organizationId && (
              <VacationWizardModal
                organizationId={organizationId}
                organizationName={organizationName}
                employees={employees}
                editRequest={editingRequest}
                onOpenChange={handleEditOpenChange}
                onSuccess={() => router.refresh()}
              />
            )}
        </DialogContent>
      </Dialog>
    </>
  )
}
