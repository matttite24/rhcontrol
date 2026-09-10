import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { SubHeader } from '@/components/layout/SubHeader'
import { BulkUpdateClient } from '@/components/employees/BulkUpdateClient'
import { Employee, EmployeeSalary, Department, Position } from '@/types/employee'
import { NoActiveOrg } from '@/components/org/NoActiveOrg'

interface BulkUpdatePageProps {
  searchParams: Promise<{ q?: string; department?: string; position?: string }>
}

export default async function BulkUpdatePage({ searchParams }: BulkUpdatePageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const currentOrg = await getCurrentOrganization()

  if (!currentOrg) {
    return (
      <NoActiveOrg action="actualizar empleados en lote" />
    )
  }

  let query = supabase
    .from('employees')
    .select('*, salaries:employee_salaries(*)')
    .eq('organization_id', currentOrg.id)
    .neq('status', 'inactivo')
    .order('full_name')

  if (params.q) {
    query = query.or(`full_name.ilike.%${params.q}%,national_id.ilike.%${params.q}%`)
  }
  if (params.department) {
    query = query.eq('department', params.department)
  }
  if (params.position) {
    query = query.eq('position', params.position)
  }

  const [{ data: empData }, { data: deptData }, { data: posData }] = await Promise.all([
    query,
    supabase
      .from('departments')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .order('name'),
    supabase
      .from('positions')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .order('name'),
  ])

  const employees = (empData || []) as (Employee & { salaries?: EmployeeSalary[] })[]
  const departments = (deptData || []) as Department[]
  const positions = (posData || []) as Position[]
  const hasFilters = Boolean(params.q || params.department || params.position)

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <BulkUpdateClient
        organizationId={currentOrg.id}
        organizationName={currentOrg.name}
        initialEmployees={employees}
        departments={departments}
        positions={positions}
        subHeader={
          <SubHeader
            search={{
              name: 'q',
              defaultValue: params.q,
              placeholder: 'Buscar por empleado...',
            }}
            selects={[
              {
                name: 'department',
                defaultValue: params.department ?? '',
                placeholder: 'Todos los departamentos',
                options: departments.map((d) => ({ value: d.name, label: d.name })),
              },
              {
                name: 'position',
                defaultValue: params.position ?? '',
                placeholder: 'Todos los cargos',
                options: positions.map((p) => ({ value: p.name, label: p.name })),
              },
            ]}
            hasFilters={hasFilters}
            clearHref="/employees/bulk-update"
            counter={`${employees.length} ${employees.length === 1 ? 'empleado' : 'empleados'}`}
          />
        }
      />
    </div>
  )
}
