import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { SubHeader } from '@/components/layout/SubHeader'
import { buttonVariants } from '@/components/ui/button'
import { NewDeductionButton } from '@/components/deductions/NewDeductionButton'
import { DeductionsTableClient } from '@/components/deductions/DeductionsTableClient'
import { DEDUCTION_TYPE_OPTIONS } from '@/lib/deductions/constants'
import { Deduction } from '@/types/employee'
import Link from 'next/link'
import { Receipt } from 'lucide-react'
import { NoActiveOrg } from '@/components/org/NoActiveOrg'
import { cn } from '@/lib/utils'

interface DeductionsPageProps {
  searchParams: Promise<{
    q?: string
    type?: string
    status?: string
    date_from?: string
    date_to?: string
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

  // Consulta de descuentos con join a empleado
  let query = supabase
    .from('deductions')
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
    `)
    .eq('organization_id', currentOrg.id)
    .order('created_at', { ascending: false })

  if (params.type) {
    query = query.eq('deduction_type', params.type)
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

  const { data: deductionsData } = await query

  // Filtro en memoria por búsqueda libre de texto (nombre, motivo, cédula)
  const filteredDeductions = ((deductionsData as Deduction[]) || []).filter((item) => {
    if (!params.q) return true
    const term = params.q.toLowerCase()
    const matchTitle = item.title?.toLowerCase().includes(term)
    const matchEmp = item.employee?.full_name?.toLowerCase().includes(term)
    const matchId = item.employee?.national_id?.toLowerCase().includes(term)
    return matchTitle || matchEmp || matchId
  })

  const hasFilters = Boolean(
    params.q || params.type || params.status || params.date_from || params.date_to
  )

  // Total acumulado
  const totalAmount = filteredDeductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  // Empleados de la organización para el asistente modal de nuevo descuento
  const { data: employeesData } = await supabase
    .from('employees')
    .select('*')
    .eq('organization_id', currentOrg.id)
    .order('full_name')

  const employees = employeesData || []

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
              {filteredDeductions.length} {filteredDeductions.length === 1 ? 'registro' : 'registros'}
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
          <DeductionsTableClient deductions={filteredDeductions} organization={currentOrg} />
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
