import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { notFound } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmployeeForm } from '@/components/employees/EmployeeForm'
import { EditEmployeeButton } from '@/components/employees/EditEmployeeButton'
import { DeleteEmployeeButton } from '@/components/employees/DeleteEmployeeButton'
import { EmployeeSalary, EmployeeSchedule, EmployeeDocument } from '@/types/employee'
import Link from 'next/link'
import { ArrowLeft, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default async function EmployeeProfilePage({
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

  // Esta página es de solo lectura (la edición vive en /employees/[id]/edit),
  // así que no necesita departments/positions de toda la organización — solo
  // se muestran los valores propios del empleado (employee.department/position).
  const [{ data: employee, error }, { data: salaries }, { data: schedules }, { data: documents }] =
    await Promise.all([
      supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .eq('organization_id', currentOrg.id)
        .single(),
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
      {/* Header con Título, Badge de Estado y Botones de Acción */}
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <span>{employee.full_name}</span>
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
        description={
          employee.position
            ? `${employee.position} — ${employee.department ?? 'General'}`
            : 'Empleado'
        }
        breadcrumbs={[
          { label: 'Empleados', href: '/employees' },
          { label: employee.full_name },
        ]}
        action={
          <div className="flex items-center gap-2">
            <Link 
              href="/employees" 
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Volver
            </Link>
            <EditEmployeeButton employeeId={employee.id} />
            <DeleteEmployeeButton employeeId={employee.id} employeeName={employee.full_name} />
          </div>
        }
      />

      {/* Formulario en modo solo lectura */}
      <div className="flex-1 w-full px-6 md:px-10 py-6">
        <EmployeeForm
          currentOrgId={currentOrg.id}
          employee={employee}
          initialSalaries={(salaries as EmployeeSalary[]) ?? []}
          initialSchedules={(schedules as EmployeeSchedule[]) ?? []}
          initialDocuments={(documents as EmployeeDocument[]) ?? []}
          readOnly={true}
        />
      </div>
    </div>
  )
}
