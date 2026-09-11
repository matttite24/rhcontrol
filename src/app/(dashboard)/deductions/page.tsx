import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { SubHeader } from '@/components/layout/SubHeader'
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
  const { data: employeesData } = await supabase
    .from('employees')
    .select('*')
    .eq('organization_id', currentOrg.id)
    .order('full_name')

  const employees = employeesData || []

  // La búsqueda `q` matchea por título O por nombre/cédula del empleado
  // (tabla relacionada, no filtrable directo con .or()) — se resuelve primero
  // qué empleados matchean el término, igual que en /incidents.
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

  if (params.type) dataQuery = dataQuery.eq('deduction_type', params.type)
  if (params.status) dataQuery = dataQuery.eq('status', params.status)
  if (params.date_from) dataQuery = dataQuery.gte('date', params.date_from)
  if (params.date_to) dataQuery = dataQuery.lte('date', params.date_to)
  if (qFilter) dataQuery = dataQuery.or(qFilter)

  dataQuery = dataQuery.order('created_at', { ascending: false }).range(rangeStart, rangeEnd)

  // Suma total del MONTO de todos los registros que matchean el filtro (no
  // solo los de la página actual) — se pide agregada a la base en vez de
  // sumar en el cliente sobre una lista que ya no llega completa.
  let sumQuery = supabase.from('deductions').select('amount').eq('organization_id', currentOrg.id)
  if (params.type) sumQuery = sumQuery.eq('deduction_type', params.type)
  if (params.status) sumQuery = sumQuery.eq('status', params.status)
  if (params.date_from) sumQuery = sumQuery.gte('date', params.date_from)
  if (params.date_to) sumQuery = sumQuery.lte('date', params.date_to)
  if (qFilter) sumQuery = sumQuery.or(qFilter)

  const [{ data: deductionsData, count }, { data: sumData }] = await Promise.all([
    dataQuery,
    sumQuery,
  ])

  const filteredDeductions = (deductionsData as Deduction[]) || []
  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const totalAmount = (sumData || []).reduce((sum, row: any) => sum + (Number(row.amount) || 0), 0)

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
    return qs ? `/deductions?${qs}` : '/deductions'
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      {/* Header oficial con botón de Nuevo Descuento */}
      <PageHeader
        title="Descuentos"
        description="Registro y auditoría de descuentos de caja, inventarios, multas y consumos"
        breadcrumbs={[
          { label: 'Descuentos & Control Económico' },
        ]}
        showExport
        action={
          <NewDeductionButton
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
            options: DEDUCTION_TYPE_OPTIONS.map((t) => ({ value: t.type, label: t.title })),
          },
          {
            name: 'status',
            defaultValue: params.status ?? '',
            placeholder: 'Todos los estados',
            options: [
              { value: 'pendiente', label: 'Pendiente' },
              { value: 'aplicado', label: 'Aplicado en Rol' },
              { value: 'anulado', label: 'Anulado' },
            ],
          },
        ]}
        dateRange={{
          defaultFrom: params.date_from,
          defaultTo: params.date_to,
          placeholder: 'Rango de fecha del descuento',
        }}
        hasFilters={hasFilters}
        clearHref="/deductions"
        counter={
          <div className="flex items-center gap-3">
            <span>
              {totalCount} {totalCount === 1 ? 'registro' : 'registros'}
            </span>
            <div className="h-3.5 w-px bg-border" />
            <span className="font-semibold font-mono text-foreground">
              Total: ${totalAmount.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        }
      />

      {/* Tabla a Ancho Completo */}
      <div className="flex-1 w-full overflow-x-auto bg-card">
        {filteredDeductions.length > 0 ? (
          <>
            <DeductionsTableClient deductions={filteredDeductions} organization={currentOrg} />
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
