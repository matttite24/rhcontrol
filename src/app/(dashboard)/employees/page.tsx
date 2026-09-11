import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { SubHeader } from '@/components/layout/SubHeader'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { NewEmployeeButton } from '@/components/employees/NewEmployeeButton'
import { EmployeesTableClient } from '@/components/employees/EmployeesTableClient'
import Link from 'next/link'
import { Plus, Users, Building2 } from 'lucide-react'
import { Employee, EmployeeSalary, EmployeeSchedule, EmployeeDocument } from '@/types/employee'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 15

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; department?: string; position?: string; status?: string; page?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const currentOrg = await getCurrentOrganization()

  if (!currentOrg) {
    return (
      <div className="flex flex-col flex-1 p-8 items-center justify-center text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold">No hay empresa seleccionada</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Crea o selecciona una empresa desde el menú superior del sidebar para comenzar.
        </p>
      </div>
    )
  }

  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const rangeStart = (currentPage - 1) * PAGE_SIZE
  const rangeEnd = rangeStart + PAGE_SIZE - 1

  // Filtrar SIEMPRE por la organización activa. Se traen también horarios y
  // documentos (campos mínimos) para calcular el % de completitud de la ficha.
  // count: 'exact' pide a Postgres el total de filas que matchean el filtro
  // (sin traerlas todas) para poder calcular totalPages; .range() acota la
  // respuesta a solo la página pedida — antes se traía la tabla completa de
  // la organización y se recortaba en el cliente con .slice().
  let query = supabase
    .from('employees')
    .select(`
      *,
      salaries:employee_salaries (*),
      schedules:employee_schedules (is_workday, start_time_1, end_time_1),
      documents:employee_documents (doc_type, file_url)
    `, { count: 'exact' })
    .eq('organization_id', currentOrg.id)
    .order('full_name', { ascending: true })
    .range(rangeStart, rangeEnd)

  if (params.q) {
    query = query.or(`full_name.ilike.%${params.q}%,national_id.ilike.%${params.q}%,email.ilike.%${params.q}%`)
  }
  if (params.department) {
    query = query.eq('department', params.department)
  }
  if (params.position) {
    query = query.eq('position', params.position)
  }
  if (params.status) {
    query = query.eq('status', params.status)
  }

  // Cargar datos de empleados, departamentos y cargos de la empresa activa
  const [{ data: employeesData, error, count }, { data: deptList }, { data: posList }] = await Promise.all([
    query,
    supabase
      .from('departments')
      .select('name')
      .eq('organization_id', currentOrg.id)
      .order('name', { ascending: true }),
    supabase
      .from('positions')
      .select('name')
      .eq('organization_id', currentOrg.id)
      .order('name', { ascending: true }),
  ])

  const employees = (employeesData ?? []) as (Employee & {
    salaries?: EmployeeSalary[]
    schedules?: Pick<EmployeeSchedule, 'is_workday' | 'start_time_1' | 'end_time_1'>[]
    documents?: Pick<EmployeeDocument, 'doc_type' | 'file_url'>[]
  })[]
  const departments = (deptList ?? []).map((d) => d.name)
  const positions = (posList ?? []).map((p) => p.name)
  const hasFilters = Boolean(params.q || params.department || params.position || params.status)
  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  function buildPageHref(page: number) {
    const sp = new URLSearchParams()
    if (params.q) sp.set('q', params.q)
    if (params.department) sp.set('department', params.department)
    if (params.position) sp.set('position', params.position)
    if (params.status) sp.set('status', params.status)
    if (page > 1) sp.set('page', String(page))
    const qs = sp.toString()
    return qs ? `/employees?${qs}` : '/employees'
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      {/* Header Principal */}
      <PageHeader
        title="Directorio de Empleados"
        description="Perfil, cargo y estado laboral de cada empleado"
        breadcrumbs={[
          { label: 'Empleados' },
        ]}
        showExport
        action={<NewEmployeeButton />}
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
            name: 'department',
            defaultValue: params.department ?? '',
            placeholder: 'Todos los departamentos',
            options: departments.map((d) => ({ value: d, label: d })),
          },
          {
            name: 'position',
            defaultValue: params.position ?? '',
            placeholder: 'Todos los cargos',
            options: positions.map((p) => ({ value: p, label: p })),
          },
          {
            name: 'status',
            defaultValue: params.status ?? '',
            placeholder: 'Todos los estados',
            options: [
              { value: 'activo', label: 'Activo' },
              { value: 'inactivo', label: 'Inactivo' },
              { value: 'prueba', label: 'En prueba' },
            ],
          },
        ]}
        hasFilters={hasFilters}
        clearHref="/employees"
        counter={`${totalCount} ${totalCount === 1 ? 'empleado' : 'empleados'}`}
      />

      {/* Tabla a Ancho Completo */}
      <div className="flex-1 w-full overflow-x-auto bg-card">
        {error ? (
          <div className="p-8 text-destructive text-sm">
            Error al consultar la base de datos: {error.message}
          </div>
        ) : employees.length > 0 ? (
          <>
            <EmployeesTableClient employees={employees} />
            <PaginationBar
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={PAGE_SIZE}
              itemLabel={{ singular: 'empleado', plural: 'empleados' }}
              buildHref={buildPageHref}
            />
          </>
        ) : (
          <div className="p-16 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Users className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-base">No se encontraron empleados</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {hasFilters
                  ? 'Prueba modificando o limpiando los filtros de búsqueda.'
                  : `Aún no hay empleados registrados en ${currentOrg.name}.`}
              </p>
            </div>
            {!hasFilters && (
              <div className="pt-2">
                <Link href="/employees/new" className={cn(buttonVariants())}>
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar primer empleado
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
