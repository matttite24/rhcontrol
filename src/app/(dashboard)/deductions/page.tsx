import { createClient } from '@/lib/supabase/server'
import { fetchEmployeePickerList, findMatchingEmployeeIds } from '@/lib/employees/picker'
import { getCurrentOrganization } from '@/lib/org/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { SubHeader } from '@/components/layout/SubHeader'
import { HeaderDateRange } from '@/components/layout/HeaderDateRange'
import { StatusTabs, type StatusTab } from '@/components/ui/status-tabs'
import { formatDateRangeShort } from '@/lib/shifts/format'
import { buttonVariants } from '@/components/ui/button'
import { NewDeductionButton } from '@/components/deductions/NewDeductionButton'
import { DeductionsTableClient } from '@/components/deductions/DeductionsTableClient'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { DEDUCTION_TYPE_OPTIONS } from '@/lib/deductions/constants'
import { Deduction } from '@/types/employee'
import Link from 'next/link'
import { Receipt } from 'lucide-react'
import { NoActiveOrg } from '@/components/org/NoActiveOrg'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 15

interface DeductionsPageProps {
  searchParams: Promise<{
    q?: string
    type?: string
    status?: string
    date_from?: string
    date_to?: string
    page?: string
  }>
}

export default async function DeductionsPage({ searchParams }: DeductionsPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const currentOrg = await getCurrentOrganization()

  if (!currentOrg) {
    return (
      <NoActiveOrg action="ver sus descuentos" />
    )
  }

  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const rangeStart = (currentPage - 1) * PAGE_SIZE
  const rangeEnd = rangeStart + PAGE_SIZE - 1

  // Empleados de la organización (para el asistente modal, y para resolver
  // la búsqueda `q` por nombre/cédula antes de filtrar descuentos).

  // La búsqueda `q` matchea por título O por nombre/cédula del empleado
  // (tabla relacionada, no filtrable directo con .or()) — se resuelve primero
  // qué empleados matchean el término, igual que en /incidents.
  const matchingEmployeeIds: string[] | null = params.q
    ? await findMatchingEmployeeIds(supabase, currentOrg.id, params.q, { excludeInactive: true })
    : null

  // idsFilter/qFilter se aplican igual en ambas queries de abajo (la
  // paginada y la de suma total) para que ambas vean exactamente el mismo
  // conjunto de filas filtradas.
  const qIdsFilter = (matchingEmployeeIds ?? []).length > 0
    ? `,employee_id.in.(${matchingEmployeeIds!.join(',')})`
    : ''
  const qFilter = params.q ? `title.ilike.%${params.q}%${qIdsFilter}` : null

  // Consulta de descuentos con join a empleado, acotada a la página actual
  let dataQuery = supabase
    .from('deductions')
    .select(
      `
      *,
      deduction_roll_title,
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

  // Filtro por estado visible. "En rol" se calcula en la base
  // (deduction_roll_id, ver add_payroll_monthly_rolls.sql): un descuento en rol
  // deja de contar como pendiente/vigente.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyStatusScope<Q extends { eq: any; is: any; not: any }>(q: Q, status: string): Q {
    if (status === 'todos') return q
    if (status === 'anulado') return q.eq('status', 'anulado')
    if (status === 'en_rol') return q.not('deduction_roll_id', 'is', null)
    return q.eq('status', status === 'vigente' ? 'aplicado' : 'pendiente').is('deduction_roll_id', null)
  }

  // Filtros comunes (todo menos el estado): se reutilizan para la lista, la
  // suma total y los contadores de las pestañas, así todos ven exactamente
  // el mismo conjunto de filas.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyBaseFilters<Q extends { eq: any; or: any; gte: any; lte: any }>(q: Q): Q {
    let filtered = q
    if (params.type) filtered = filtered.eq('deduction_type', params.type)
    if (params.date_from) filtered = filtered.gte('date', params.date_from)
    if (params.date_to) filtered = filtered.lte('date', params.date_to)
    if (qFilter) filtered = filtered.or(qFilter)
    return filtered
  }

  // "Todos" no filtra por estado; el resto filtra por su estado.
  const statusFilter = params.status ?? 'todos'
  dataQuery = applyBaseFilters(dataQuery)
  dataQuery = applyStatusScope(dataQuery, statusFilter)

  dataQuery = dataQuery.order('created_at', { ascending: false }).range(rangeStart, rangeEnd)

  const countFor = (status: string) =>
    applyStatusScope(
      applyBaseFilters(
        supabase
          .from('deductions')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', currentOrg.id)
      ),
      status
    )

  const [
    { data: employees },
    { data: deductionsData, count },
    { count: allCount },
    { count: pendingCount },
    { count: currentCount },
    { count: inRollCount },
    { count: annulledCount },
  ] = await Promise.all([
    fetchEmployeePickerList(supabase, currentOrg.id, { excludeInactive: true }),
    dataQuery,
    countFor('todos'),
    countFor('pendiente'),
    countFor('vigente'),
    countFor('en_rol'),
    countFor('anulado'),
  ])

  const filteredDeductions = (deductionsData as Deduction[]) || []
  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const hasFilters = Boolean(
    params.q || params.type || params.date_from || params.date_to
  )
  const hasDateRange = Boolean(params.date_from && params.date_to)

  const statusTabs: StatusTab[] = [
    { value: 'todos', label: 'Todos', count: allCount ?? 0, tone: 'neutral', alwaysShow: true },
    { value: 'pendiente', label: 'Pendientes', count: pendingCount ?? 0, tone: 'warning' },
    { value: 'vigente', label: 'Vigentes', count: currentCount ?? 0, tone: 'neutral' },
    { value: 'en_rol', label: 'En rol', count: inRollCount ?? 0, tone: 'success' },
    { value: 'anulado', label: 'Anulados', count: annulledCount ?? 0, tone: 'neutral' },
  ]

  function buildStatusHref(status: string) {
    const sp = new URLSearchParams()
    if (params.q) sp.set('q', params.q)
    if (params.type) sp.set('type', params.type)
    if (params.date_from) sp.set('date_from', params.date_from)
    if (params.date_to) sp.set('date_to', params.date_to)
    // "Todos" es la vista por defecto: no necesita parámetro.
    if (status !== 'todos') sp.set('status', status)
    const qs = sp.toString()
    return qs ? `/deductions?${qs}` : '/deductions'
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
    return qs ? `/deductions?${qs}` : '/deductions'
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      {/* Header oficial con botón de Nuevo Descuento */}
      <PageHeader
        title={hasDateRange ? `Descuentos · ${formatDateRangeShort(params.date_from!, params.date_to!)}` : 'Descuentos'}
        description={
          hasDateRange
            ? `${allCount ?? 0} ${allCount === 1 ? 'descuento' : 'descuentos'} con fecha de descuento en este rango`
            : 'Registro y auditoría de descuentos de caja, inventarios, multas y consumos'
        }
        action={
          <>
            <HeaderDateRange
              placeholder="Fechas"
              defaultFrom={params.date_from}
              defaultTo={params.date_to}
            />
            <NewDeductionButton
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
            options: DEDUCTION_TYPE_OPTIONS.map((t) => ({ value: t.type, label: t.title })),
          },
        ]}
        hasFilters={hasFilters}
        clearHref="/deductions"
        className="bg-muted"
        trailing={
          <StatusTabs
            ariaLabel="Estado de los descuentos"
            tabs={statusTabs}
            activeValue={statusFilter}
            buildHref={buildStatusHref}
          />
        }
      />

      {/* Tabla a Ancho Completo */}
      <div data-pending-dim className="flex-1 w-full overflow-x-auto bg-card">
        {filteredDeductions.length > 0 ? (
          <>
            <DeductionsTableClient deductions={filteredDeductions} organization={currentOrg}  />
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
              <Receipt className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-base">Sin registros de descuentos</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {hasFilters
                  ? 'No se encontraron descuentos con los filtros aplicados. Prueba limpiando los criterios.'
                  : 'No hay descuentos ni débitos económicos registrados para esta empresa todavía.'}
              </p>
            </div>
            {hasFilters ? (
              <div className="pt-2">
                <Link href="/deductions" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                  Limpiar filtros
                </Link>
              </div>
            ) : (
              <div className="pt-2">
                <NewDeductionButton
                  organizationId={currentOrg.id}
                  organizationName={currentOrg.name}
                  employees={employees}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
