import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { SubHeader } from '@/components/layout/SubHeader'
import { HeaderDateRange } from '@/components/layout/HeaderDateRange'
import { formatDateRangeShort } from '@/lib/shifts/format'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { NewShiftRequestButton } from '@/components/shifts/NewShiftRequestButton'
import { ShiftRequestsList } from '@/components/shifts/ShiftRequestsList'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { ShiftRequest } from '@/types/employee'
import { Search, Filter, X } from 'lucide-react'
import { NoActiveOrg } from '@/components/org/NoActiveOrg'
import { SHIFT_REQUEST_TYPE_OPTIONS } from '@/lib/shifts/constants'
import { StatusTabs, type StatusTab } from '@/components/ui/status-tabs'
import { cn } from '@/lib/utils'

// Evitar que el client router cache sirva un snapshot desactualizado tras aprobar/rechazar
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 15

interface ShiftRequestsPageProps {
  searchParams: Promise<{
    q?: string
    type?: string
    status?: string
    date_from?: string
    date_to?: string
    page?: string
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

  const hasDateRange = Boolean(params.date_from && params.date_to)

  // Por defecto se muestra la bandeja de pendientes (lo que hay que resolver);
  // "todos" desactiva el filtro de estado y se ve el historial completo.
  const statusFilter = params.status ?? 'pendiente'

  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const rangeStart = (currentPage - 1) * PAGE_SIZE
  const rangeEnd = rangeStart + PAGE_SIZE - 1

  // Obtener empleados de la organización (para el asistente modal, y para
  // resolver la búsqueda `q` por nombre/cédula antes de filtrar solicitudes).
  const { data: employeesData } = await supabase
    .from('employees')
    .select('*')
    .eq('organization_id', currentOrg.id)
    .neq('status', 'inactivo')
    .order('full_name')

  const employees = employeesData || []

  // La búsqueda `q` matchea por título O por nombre/cédula del empleado
  // (tabla relacionada, no filtrable directo con .or()) — se resuelve primero
  // qué empleados matchean el término, igual que en /incidents y /deductions.
  let matchingEmployeeIds: string[] | null = null
  if (params.q) {
    const term = params.q.toLowerCase()
    matchingEmployeeIds = employees
      .filter(
        (e) =>
          e.full_name?.toLowerCase().includes(term) ||
          e.national_id?.toLowerCase().includes(term)
      )
      .map((e) => e.id)
  }
  const qIdsFilter = (matchingEmployeeIds ?? []).length > 0
    ? `,employee_id.in.(${matchingEmployeeIds!.join(',')})`
    : ''
  const qFilter = params.q ? `title.ilike.%${params.q}%${qIdsFilter}` : null

  // Consulta de solicitudes de turnos y horas extras, acotada a la página actual
  let query = supabase
    .from('shift_requests')
    .select(
      `
      *,
      employee:employees (
        id,
        full_name,
        national_id,
        department,
        position,
        avatar_url
      )
    `,
      { count: 'exact' }
    )
    .eq('organization_id', currentOrg.id)

  // Filtros comunes (todo menos el estado): se reutilizan para la lista y para
  // los contadores de las pestañas, así los números siempre coinciden con lo
  // que se vería al abrir cada pestaña.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyBaseFilters<Q extends { eq: any; or: any; gte: any; lte: any }>(q: Q): Q {
    let query = q
    if (params.type) {
      if (params.type === 'permiso_laboral') {
        query = query.or('request_type.eq.permiso_laboral,and(request_type.eq.otro,metadata->>sub_type.eq.permiso_laboral)')
      } else if (params.type === 'incidencia_marcacion') {
        query = query.or('request_type.eq.incidencia_marcacion,and(request_type.eq.otro,metadata->>sub_type.eq.incidencia_marcacion)')
      } else {
        query = query.eq('request_type', params.type)
      }
    }
    if (params.date_from) query = query.gte('date', params.date_from)
    if (params.date_to) query = query.lte('date', params.date_to)
    if (qFilter) query = query.or(qFilter)
    return query
  }

  query = applyBaseFilters(query)
  if (statusFilter !== 'todos') {
    query = query.eq('status', statusFilter)
  }

  // Pendientes: las más antiguas primero (llevan más tiempo esperando);
  // el resto de vistas muestra lo más reciente arriba.
  query = query
    .order('created_at', { ascending: statusFilter === 'pendiente' })
    .range(rangeStart, rangeEnd)

  const countFor = (status?: string) => {
    let q = applyBaseFilters(
      supabase
        .from('shift_requests')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', currentOrg.id)
    )
    if (status) q = q.eq('status', status)
    return q
  }

  const [
    { data: requestsData, count },
    { count: pendingCount },
    { count: approvedCount },
    { count: rejectedCount },
    { count: annulledCount },
    { count: allCount },
  ] = await Promise.all([
    query,
    countFor('pendiente'),
    countFor('aprobado'),
    countFor('rechazado'),
    countFor('anulado'),
    countFor(),
  ])

  const statusTabs: StatusTab[] = [
    { value: 'pendiente', label: 'Pendientes', count: pendingCount ?? 0, tone: 'warning' },
    { value: 'aprobado', label: 'Aprobadas', count: approvedCount ?? 0, tone: 'success' },
    { value: 'rechazado', label: 'Rechazadas', count: rejectedCount ?? 0, tone: 'danger' },
    { value: 'anulado', label: 'Anuladas', count: annulledCount ?? 0, tone: 'neutral' },
    { value: 'todos', label: 'Todas', count: allCount ?? 0, tone: 'neutral', alwaysShow: true },
  ]

  function buildStatusHref(status: string) {
    const sp = new URLSearchParams()
    if (params.q) sp.set('q', params.q)
    if (params.type) sp.set('type', params.type)
    if (params.date_from) sp.set('date_from', params.date_from)
    if (params.date_to) sp.set('date_to', params.date_to)
    // "Pendientes" es la vista por defecto: no necesita parámetro.
    if (status !== 'pendiente') sp.set('status', status)
    const qs = sp.toString()
    return qs ? `/shifts/requests?${qs}` : '/shifts/requests'
  }

  const shiftRequests = (requestsData as ShiftRequest[]) || []
  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const hasFilters = Boolean(
    params.q || params.type || params.date_from || params.date_to
  )

  function buildPageHref(page: number) {
    const sp = new URLSearchParams()
    if (params.q) sp.set('q', params.q)
    if (params.type) sp.set('type', params.type)
    if (params.status) sp.set('status', params.status)
    if (params.date_from) sp.set('date_from', params.date_from)
    if (params.date_to) sp.set('date_to', params.date_to)
    if (page > 1) sp.set('page', String(page))
    const qs = sp.toString()
    return qs ? `/shifts/requests?${qs}` : '/shifts/requests'
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      {/* Header oficial con botón de Nueva Novedad */}
      <PageHeader
        title={hasDateRange ? `Novedades · ${formatDateRangeShort(params.date_from!, params.date_to!)}` : 'Novedades'}
        description={
          hasDateRange
            ? `${allCount ?? 0} ${allCount === 1 ? 'solicitud' : 'solicitudes'} con fecha autorizada en este rango`
            : 'Registro y autorizaciones de horas extras, cambios de turno, permisos y ausencias'
        }
        action={
          <>
            <HeaderDateRange
              placeholder="Fechas"
              defaultFrom={params.date_from}
              defaultTo={params.date_to}
            />
            <NewShiftRequestButton
              organizationId={currentOrg.id}
              organizationName={currentOrg.name}
              employees={employees}
            />
          </>
        }
      />

      {/* Subbarra de Filtros a Ancho Completo */}
      <SubHeader
        search={{
          name: 'q',
          defaultValue: params.q,
          placeholder: 'Empleado o motivo…',
        }}
        selects={[
          {
            name: 'type',
            defaultValue: params.type ?? '',
            placeholder: 'Todos los tipos',
            options: SHIFT_REQUEST_TYPE_OPTIONS.map((t) => ({ value: t.type, label: t.title })),
          },
        ]}
        hasFilters={hasFilters}
        clearHref="/shifts/requests"
        className="bg-muted"
        trailing={
          <StatusTabs
            ariaLabel="Estado de las solicitudes"
            tabs={statusTabs}
            activeValue={statusFilter}
            buildHref={buildStatusHref}
          />
        }
      />

      {/* Listado de Novedades a Ancho Completo */}
      <div className="flex-1 w-full overflow-x-auto bg-card">
        <ShiftRequestsList
          requests={shiftRequests}
          organization={currentOrg}
          employees={employees}
          organizationId={currentOrg.id}
          organizationName={currentOrg.name}
          {...(statusFilter === 'pendiente' && !hasFilters
            ? {
                emptyTitle: 'No hay solicitudes pendientes',
                emptyDescription: 'Todo está al día. Las nuevas solicitudes aparecerán aquí; revisa las otras pestañas para ver el historial.',
              }
            : hasFilters || statusFilter !== 'todos'
              ? {
                  emptyTitle: 'No hay solicitudes en esta vista',
                  emptyDescription: 'Prueba con otra pestaña o ajusta los filtros.',
                }
              : {})}
        />
        <PaginationBar
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
          itemLabel={{ singular: 'novedad', plural: 'novedades' }}
          buildHref={buildPageHref}
        />
      </div>
    </div>
  )
}
