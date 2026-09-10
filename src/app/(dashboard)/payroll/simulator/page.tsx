import { getCurrentOrganization } from '@/lib/org/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { PayrollSimulatorView } from '@/components/payroll/PayrollSimulatorView'
import { NoActiveOrg } from '@/components/org/NoActiveOrg'

export const metadata = {
  title: 'Simulador de Rol | Nómina',
  description: 'Proyecta el rol de pago y costo laboral de nuevas contrataciones en Ecuador.',
}

export default async function PayrollSimulatorPage() {
  const currentOrg = await getCurrentOrganization()

  if (!currentOrg) {
    return <NoActiveOrg action="utilizar el simulador de nómina" />
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <PayrollSimulatorView currentOrg={currentOrg} />
    </div>
  )
}
