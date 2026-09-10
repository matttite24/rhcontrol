import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { SubHeader } from '@/components/layout/SubHeader'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { NewShiftRequestButton } from '@/components/shifts/NewShiftRequestButton'
import { ShiftRequestsList } from '@/components/shifts/ShiftRequestsList'
import { ShiftRequest } from '@/types/employee'
import { Search, Filter, X } from 'lucide-react'
import { NoActiveOrg } from '@/components/org/NoActiveOrg'
import { SHIFT_REQUEST_TYPE_OPTIONS } from '@/lib/shifts/constants'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// Evitar que el client router cache sirva un snapshot desactualizado tras aprobar/rechazar
export const dynamic = 'force-dynamic'

interface ShiftRequestsPageProps {
  searchParams: Promise<{
    q?: string
    type?: string
    status?: string
    date_from?: string
    date_to?: string
  }>
}

export default async function ShiftRequestsPage({ searchParams }: ShiftRequestsPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const currentOrg = await getCurrentOrganization()

  if (!currentOrg) {
    return (
      <NoActiveOrg action="ver sus solicitudes" />
    )
  }

  // Consulta de solicitudes de turnos y horas extras
  let query = supabase
    .from('shift_requests')
    .select(`
      *,
      employee:employees (
        id,
        full_name,
        national_id,
        department,
        position,
        avatar_url
      )
    `)
    .eq('organization_id', currentOrg.id)
    .order('created_at', { ascending: false })

  if (params.type) {
    if (params.type === 'permiso_laboral') {
      query = query.or('request_type.eq.permiso_laboral,and(request_type.eq.otro,metadata->>sub_type.eq.permiso_laboral)')
    } else {
      query = query.eq('request_type', params.type)
    }
  }
  if (params.status) {
    query = query.eq('status', params.status)
  }
  if (params.date_from) {
    query = query.gte('date', params.date_from)
  }
  if (params.date_to) {
    query = query.lte('date', params.date_to)
  }

  const { data: requestsData } = await query

  const shiftRequests = ((requestsData as ShiftRequest[]) || []).filter((req) => {
    if (!params.q) return true
    const term = params.q.toLowerCase()
    return (
      req.title?.toLowerCase().includes(term) ||
      req.employee?.full_name?.toLowerCase().includes(term) ||
      req.employee?.national_id?.toLowerCase().includes(term)
    )
  })

  // Obtener empleados para el modal asistente
  const { data: employeesData } = await supabase
    .from('employees')
    .select('*')
    .eq('organization_id', currentOrg.id)
    .order('full_name')

  const employees = employeesData || []

  const hasFilters = Boolean(
    params.q || params.type || params.status || params.date_from || params.date_to
  )

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      {/* Header oficial con botón de Nueva Novedad */}
      <PageHeader
        title="Novedades"
        description="Registro y autorizaciones de horas extras, cambios de turno, permisos y ausencias"
        showExport
        action={
          <NewShiftRequestButton
            organizationId={currentOrg.id}
            organizationName={currentOrg.name}
            employees={employees}
          />
        }
      />

      {/* Subbarra de Filtros a Ancho Completo */}
      <SubHeader
        search={{
          name: 'q',
          defaultValue: params.q,
          placeholder: 'Buscar por empleado o motivo...',
        }}
        selects={[
          {
            name: 'type',
            defaultValue: params.type ?? '',
            placeholder: 'Todos los tipos',
            options: SHIFT_REQUEST_TYPE_OPTIONS.map((t) => ({ value: t.type, label: t.title })),
          },
          {
            name: 'status',
            defaultValue: params.status ?? '',
            placeholder: 'Todos los estados',
            options: [
              { value: 'pendiente', label: 'Pendiente' },
              { value: 'aprobado', label: 'Aprobado' },
              { value: 'rechazado', label: 'Rechazado' },
            ],
          },
        ]}
        dateRange={{
          defaultFrom: params.date_from,
          defaultTo: params.date_to,
          placeholder: 'Rango de fecha de la novedad',
        }}
        hasFilters={hasFilters}
        clearHref="/shifts/requests"
        counter={`${shiftRequests.length} ${shiftRequests.length === 1 ? 'novedad' : 'novedades'}`}
      />

      {/* Listado de Novedades a Ancho Completo */}
      <div className="flex-1 w-full overflow-x-auto bg-card">
        <ShiftRequestsList requests={shiftRequests} organization={currentOrg} />
      </div>
    </div>
  )
}
