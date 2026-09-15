import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { PageHeader } from '@/components/layout/PageHeader'
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
  const { data: employeesData } = await supabase
    .from('employees')
    .select('id, full_name, national_id, bank_name, bank_code, account_number, payment_type, department, position, avatar_url, status, biweekly_advance_amount')
    .eq('organization_id', currentOrg.id)
    .eq('status', 'activo')
    .gt('biweekly_advance_amount', 0)
    .order('full_name')

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

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <PageHeader
        title="Quincena"
        description="Empleados con anticipo quincenal recurrente y exportación del archivo de pago para el banco"
      />
      <QuincenaView employees={employees} year={year} month={month} organization={currentOrg} />
    </div>
  )
}
