import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { SubHeader } from '@/components/layout/SubHeader'
import { HeaderDateRange } from '@/components/layout/HeaderDateRange'
import { formatDateRangeShort } from '@/lib/shifts/format'
import { StatusTabs, type StatusTab } from '@/components/ui/status-tabs'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { NewIncidentButton } from '@/components/incidents/NewIncidentButton'
import { IncidentsTableClient } from '@/components/incidents/IncidentsTableClient'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { INCIDENT_TYPE_OPTIONS } from '@/lib/incidents/constants'
import { Incident, IncidentStatus } from '@/types/employee'
import Link from 'next/link'
import { Search, FileText, Calendar, Filter, X } from 'lucide-react'
import { NoActiveOrg } from '@/components/org/NoActiveOrg'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 15

interface IncidentsPageProps {
  searchParams: Promise<{
    q?: string
    type?: string
    status?: string
    date_from?: string
    date_to?: string
    page?: string
  }>
}

const statusConfig: Record<IncidentStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  registrado: { label: 'Registrado', variant: 'default' },
  aprobado:   { label: 'Aprobado',   variant: 'secondary' },
  pendiente:  { label: 'Pendiente',  variant: 'outline' },
  rechazado:  { label: 'Rechazado',  variant: 'destructive' },
  anulado:    { label: 'Anulado',    variant: 'destructive' },
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

export default async function IncidentsPage({ searchParams }: IncidentsPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const currentOrg = await getCurrentOrganization()

  if (!currentOrg) {
    return (
      <NoActiveOrg action="ver sus incidencias" />
    )
  }

  const hasDateRange = Boolean(params.date_from && params.date_to)

  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const rangeStart = (currentPage - 1) * PAGE_SIZE
  const rangeEnd = rangeStart + PAGE_SIZE - 1

  // Obtener empleados de la organización (para el asistente modal, y para
  // resolver la búsqueda `q` por nombre/cédula antes de filtrar incidencias).
  const { data: employeesData } = await supabase
    .from('employees')
    .select('*')
    .eq('organization_id', currentOrg.id)
    .order('full_name')

  const employees = employeesData || []

  // La búsqueda `q` matchea por título de la incidencia O por nombre/cédula
  // del empleado. Como el empleado es una tabla relacionada, `.or()` no
  // puede filtrar por sus columnas directamente — se resuelve primero qué
  // empleados matchean el término y se filtra `incidents` por esos IDs
  // (combinado con el propio título) en una sola query con .range() real,
  // en vez de traer todo y recortar en memoria como antes.
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

  // Consulta de incidencias con información del empleado
  let query = supabase
    .from('incidents')
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
    `, { count: 'exact' })
    .eq('organization_id', currentOrg.id)
    .neq('incident_type', 'permiso_laboral')
    // Vacaciones vive únicamente en Novedades/Control de Asistencia
    // (shift_requests) — ver createVacationRequestAction. Filas históricas
    // ya creadas como reflejo en incidents antes de este cambio quedan en la
    // base de datos, pero dejan de listarse aquí para no duplicar dónde
    // aparece cada solicitud.
    .neq('incident_type', 'solicitud_vacaciones')
    .order('created_at', { ascending: false })
    .range(rangeStart, rangeEnd)

  // Filtros comunes (todo menos el estado): se reutilizan para la lista y para
  // los contadores de las pestañas, así los números coinciden con cada vista.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyBaseFilters<Q extends { eq: any; or: any; gte: any; lte: any }>(q: Q): Q {
    let filtered = q
    if (params.type) {
      filtered = filtered.or(`incident_type.eq.${params.type},metadata->>sub_type.eq.${params.type}`)
    }
    if (params.date_from) filtered = filtered.gte('start_date', params.date_from)
    if (params.date_to) filtered = filtered.lte('start_date', params.date_to)
    if (params.q) {
      const idsFilter = (matchingEmployeeIds ?? []).length > 0
        ? `,employee_id.in.(${matchingEmployeeIds!.join(',')})`
        : ''
      filtered = filtered.or(`title.ilike.%${params.q}%${idsFilter}`)
    }
    return filtered
  }

  // "Todas" no filtra por estado; el resto filtra por su estado.
  const statusFilter = params.status ?? 'todos'
  query = applyBaseFilters(query)
  if (statusFilter !== 'todos') {
    query = query.eq('status', statusFilter)
  }

  const countFor = (status?: string) => {
    let q = applyBaseFilters(
      supabase
        .from('incidents')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', currentOrg.id)
        .neq('incident_type', 'permiso_laboral')
        .neq('incident_type', 'solicitud_vacaciones')
    )
    if (status) q = q.eq('status', status)
    return q
  }

  const [
    { data: incidents, error, count },
    { count: allCount },
    { count: pendingCount },
    { count: registeredCount },
    { count: approvedCount },
    { count: rejectedCount },
    { count: annulledCount },
  ] = await Promise.all([
    query,
    countFor(),
    countFor('pendiente'),
    countFor('registrado'),
    countFor('aprobado'),
    countFor('rechazado'),
    countFor('anulado'),
  ])

  const filteredIncidents = (incidents as Incident[]) || []
  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const hasFilters = Boolean(
    params.q || params.type || params.date_from || params.date_to
  )

  const statusTabs: StatusTab[] = [
    { value: 'todos', label: 'Todas', count: allCount ?? 0, tone: 'neutral', alwaysShow: true },
    { value: 'pendiente', label: 'Pendientes', count: pendingCount ?? 0, tone: 'warning' },
    { value: 'registrado', label: 'Registradas', count: registeredCount ?? 0, tone: 'neutral' },
    { value: 'aprobado', label: 'Aprobadas', count: approvedCount ?? 0, tone: 'success' },
    { value: 'rechazado', label: 'Rechazadas', count: rejectedCount ?? 0, tone: 'danger' },
    { value: 'anulado', label: 'Anuladas', count: annulledCount ?? 0, tone: 'neutral' },
  ]

  function buildStatusHref(status: string) {
    const sp = new URLSearchParams()
    if (params.q) sp.set('q', params.q)
    if (params.type) sp.set('type', params.type)
    if (params.date_from) sp.set('date_from', params.date_from)
    if (params.date_to) sp.set('date_to', params.date_to)
    // "Todas" es la vista por defecto: no necesita parámetro.
    if (status !== 'todos') sp.set('status', status)
    const qs = sp.toString()
    return qs ? `/incidents?${qs}` : '/incidents'
  }

  function buildPageHref(page: number) {
    const sp = new URLSearchParams()
    if (params.q) sp.set('q', params.q)
    if (params.type) sp.set('type', params.type)
    if (params.status) sp.set('status', params.status)
    if (params.date_from) sp.set('date_from', params.date_from)
    if (params.date_to) sp.set('date_to', params.date_to)
    if (page > 1) sp.set('page', String(page))
    const qs = sp.toString()
    return qs ? `/incidents?${qs}` : '/incidents'
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      {/* Header con botón para Nueva Incidencia (Abre modal) */}
      <PageHeader
        title={hasDateRange ? `Incidencias · ${formatDateRangeShort(params.date_from!, params.date_to!)}` : 'Incidencias'}
        description={
          hasDateRange
            ? `${allCount ?? 0} ${allCount === 1 ? 'registro' : 'registros'} con fecha de evento en este rango`
            : 'Registros, solicitudes y documentación del personal'
        }
        action={
          <>
            <HeaderDateRange
              placeholder="Fechas"
              defaultFrom={params.date_from}
              defaultTo={params.date_to}
            />
            <NewIncidentButton
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
            // Vacaciones ya no vive en esta lista (ver el .neq de la query
            // arriba) — se excluye también del filtro para no ofrecer una
            // opción que nunca devolvería resultados.
            options: INCIDENT_TYPE_OPTIONS.filter((t) => t.type !== 'solicitud_vacaciones').map((t) => ({
              value: t.type,
              label: t.title,
            })),
          },
        ]}
        hasFilters={hasFilters}
        clearHref="/incidents"
        className="bg-muted"
        trailing={
          <StatusTabs
            ariaLabel="Estado de las incidencias"
            tabs={statusTabs}
            activeValue={statusFilter}
            buildHref={buildStatusHref}
          />
        }
      />

      {/* Tabla a Ancho Completo */}
      <div className="flex-1 w-full overflow-x-auto bg-card">
        {filteredIncidents.length > 0 ? (
          <>
            <IncidentsTableClient incidents={filteredIncidents} organization={currentOrg} />
            <PaginationBar
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={PAGE_SIZE}
              itemLabel={{ singular: 'registro', plural: 'registros' }}
              buildHref={buildPageHref}
            />
          </>
        ) : (
          <div className="p-16 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <FileText className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-base">No hay incidencias registradas</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Registra actividades no conformes, llamados de atención, vacaciones, anticipos o permisos para documentar los eventos de tu equipo.
              </p>
            </div>
            <div className="pt-2">
              <NewIncidentButton
                organizationId={currentOrg.id}
                organizationName={currentOrg.name}
                employees={employees}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
