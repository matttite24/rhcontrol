import { buttonVariants } from '@/components/ui/button'
import { EmployeeForm } from '@/components/employees/EmployeeForm'
import { EmployeeFormSubmitButton } from '@/components/employees/EmployeeFormSubmitButton'
import { PageHeader } from '@/components/layout/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { Department, Position, RotatingShiftPattern } from '@/types/employee'
import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default async function NewEmployeePage() {
  const supabase = await createClient()
  const currentOrg = await getCurrentOrganization()

  if (!currentOrg) {
    return (
      <div className="flex flex-col flex-1 p-8 items-center justify-center text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold">No hay empresa seleccionada</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Crea o selecciona una empresa desde el menú superior del sidebar antes de registrar empleados.
        </p>
      </div>
    )
  }

  const [{ data: departments }, { data: positions }, { data: rotatingPatterns }] = await Promise.all([
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
      .from('rotating_shift_patterns')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .order('name', { ascending: true }),
  ])

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      {/* Header con Botones de Acción (Guardar + Cancelar) Arriba */}
      <PageHeader
        title="Nuevo Empleado"
        description="Registrar un nuevo empleado"
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/employees"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            >
              Cancelar
            </Link>

            <EmployeeFormSubmitButton formId="employee-form" label="Guardar Empleado" />
          </div>
        }
      />

      {/* Contenido a Ancho Completo Real */}
      <div className="flex-1 w-full px-6 md:px-10 py-6">
        <EmployeeForm 
          currentOrgId={currentOrg.id}
          departments={(departments as Department[]) ?? []}
          positions={(positions as Position[]) ?? []}
          rotatingPatterns={(rotatingPatterns as RotatingShiftPattern[]) ?? []}
        />
      </div>
    </div>
  )
}
