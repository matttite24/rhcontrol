import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { notFound } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmployeeForm } from '@/components/employees/EmployeeForm'
import { EmployeeFormSubmitButton } from '@/components/employees/EmployeeFormSubmitButton'
import { PageHeader } from '@/components/layout/PageHeader'
import { Department, Position } from '@/types/employee'
import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const currentOrg = await getCurrentOrganization()

  if (!currentOrg) {
    return (
      <div className="flex flex-col flex-1 p-8 items-center justify-center text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold">No hay empresa seleccionada</h2>
      </div>
    )
  }

  const [
    { data: employee, error },
    { data: departments },
    { data: positions },
    { data: initialSalaries },
    { data: initialSchedules },
    { data: initialDocuments },
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .eq('organization_id', currentOrg.id)
      .single(),
    supabase
      .from('departments')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .order('name', { ascending: true }),
    supabase
      .from('positions')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .order('name', { ascending: true }),
    supabase
      .from('employee_salaries')
      .select('*')
      .eq('employee_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('employee_schedules')
      .select('*')
      .eq('employee_id', id)
      .order('day_order', { ascending: true }),
    supabase
      .from('employee_documents')
      .select('*')
      .eq('employee_id', id),
  ])

  if (error || !employee) notFound()

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      {/* Header con Botones de Acción (Guardar Cambios + Cancelar) Arriba */}
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <span>Editar: {employee.full_name}</span>
            <Badge
              variant={
                employee.status === 'activo'
                  ? 'default'
                  : employee.status === 'prueba'
                  ? 'secondary'
                  : 'outline'
              }
              className="text-xs px-2.5 py-0.5"
            >
              {employee.status === 'activo'
                ? 'Activo'
                : employee.status === 'prueba'
                ? 'En prueba'
                : 'Inactivo'}
            </Badge>
          </div>
        }
        description="Modificar datos del empleado"
        breadcrumbs={[
          { label: 'Empleados', href: '/employees' },
          { label: employee.full_name, href: `/employees/${employee.id}` },
          { label: 'Editar' },
        ]}
        action={
          <div className="flex items-center gap-2">
            <Link
              href={`/employees/${id}`}
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            >
              Cancelar
            </Link>

            <EmployeeFormSubmitButton formId="employee-form" label="Guardar Cambios" />
          </div>
        }
      />

      {/* Contenido a Ancho Completo Real */}
      <div className="flex-1 w-full px-6 md:px-10 py-6">
        <EmployeeForm
          currentOrgId={currentOrg.id}
          employee={employee}
          departments={(departments as Department[]) ?? []}
          positions={(positions as Position[]) ?? []}
          initialSalaries={initialSalaries ?? []}
          initialSchedules={initialSchedules ?? []}
          initialDocuments={initialDocuments ?? []}
        />
      </div>
    </div>
  )
}
