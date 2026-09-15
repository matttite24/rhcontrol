import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { NoActiveOrg } from '@/components/org/NoActiveOrg'
import { QuincenaView } from '@/components/payroll/QuincenaView'
import { Employee } from '@/types/employee'

export const metadata = {
  title: 'Quincena | Nómina',
  description: 'Genera el archivo de pago de anticipos quincenales para el banco.',
}

interface QuincenaPageProps {
  searchParams: Promise<{
    year?: string
    month?: string
  }>
}

export default async function QuincenaPage({ searchParams }: QuincenaPageProps) {
  const params = await searchParams
  const currentOrg = await getCurrentOrganization()

  if (!currentOrg) {
    return <NoActiveOrg action="generar el archivo de quincena" />
  }

  const supabase = await createClient()

  const now = new Date()
  const year = parseInt(params.year || '', 10) || now.getFullYear()
  const month = parseInt(params.month || '', 10) || now.getMonth() + 1

  // Empleados activos con el ajuste de anticipo quincenal configurado — no
  // depende del mes elegido (ver QuincenaView): el mes solo arma el texto de
  // REFERENCIA del TSV y el nombre del archivo, cualquier empleado activo
  // con biweekly_advance_amount > 0 aparece en la lista.
  const [{ data: employeesData }, { data: paymentsData }] = await Promise.all([
    supabase
      .from('employees')
      .select('id, full_name, national_id, bank_name, bank_code, account_number, payment_type, department, position, avatar_url, status, biweekly_advance_amount')
      .eq('organization_id', currentOrg.id)
      .eq('status', 'activo')
      .gt('biweekly_advance_amount', 0)
      .order('full_name'),

    // Quiénes ya fueron marcados como pagados en este período (ver
    // markQuincenaPaidAction) — determina el estado "Pagado" en la tabla.
    supabase
      .from('quincena_payments')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .eq('period_year', year)
      .eq('period_month', month),
  ])

  const employees = (employeesData || []) as Pick<
    Employee,
    | 'id'
    | 'full_name'
    | 'national_id'
    | 'bank_name'
    | 'bank_code'
    | 'account_number'
    | 'payment_type'
    | 'department'
    | 'position'
    | 'avatar_url'
    | 'status'
    | 'biweekly_advance_amount'
  >[]

  const paidEmployeeIds = (paymentsData || []).map((p) => p.employee_id as string)

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <QuincenaView
        employees={employees}
        year={year}
        month={month}
        organization={currentOrg}
        organizationId={currentOrg.id}
        paidEmployeeIds={paidEmployeeIds}
      />
    </div>
  )
}
