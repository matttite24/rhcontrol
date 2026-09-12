import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { SubHeader } from '@/components/layout/SubHeader'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { NewShiftRequestButton } from '@/components/shifts/NewShiftRequestButton'
import { ShiftRequestsList } from '@/components/shifts/ShiftRequestsList'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { ShiftRequest } from '@/types/employee'
import { Search, Filter, X } from 'lucide-react'
import { NoActiveOrg } from '@/components/org/NoActiveOrg'
import { SHIFT_REQUEST_TYPE_OPTIONS } from '@/lib/shifts/constants'
import Link from 'next/link'
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

  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const rangeStart = (currentPage - 1) * PAGE_SIZE
  const rangeEnd = rangeStart + PAGE_SIZE - 1

  // Obtener empleados de la organización (para el asistente modal, y para
  // resolver la búsqueda `q` por nombre/cédula antes de filtrar solicitudes).
  const { data: employeesData } = await supabase
    .from('employees')
    .select('*')
    .eq('organization_id', currentOrg.id)
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
  if (qFilter) {
    query = query.or(qFilter)
  }

  query = query.order('created_at', { ascending: false }).range(rangeStart, rangeEnd)

  const { data: requestsData, count } = await query

  const shiftRequests = (requestsData as ShiftRequest[]) || []
  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const hasFilters = Boolean(
    params.q || params.type || params.status || params.date_from || params.date_to
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
        counter={`${totalCount} ${totalCount === 1 ? 'novedad' : 'novedades'}`}
      />

      {/* Listado de Novedades a Ancho Completo */}
      <div className="flex-1 w-full overflow-x-auto bg-card">
        <ShiftRequestsList
          requests={shiftRequests}
          organization={currentOrg}
          employees={employees}
          organizationId={currentOrg.id}
          organizationName={currentOrg.name}
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
