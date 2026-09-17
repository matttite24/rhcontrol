import { PageHeader } from '@/components/layout/PageHeader'

/** Ver nota en payroll/quincena/loading.tsx: sin este archivo se hereda el
 * skeleton de "Inicio" en vez de mostrar algo propio de esta página. */
export default function SimulatorLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <PageHeader title="Simulador de Rol" description="Calcula el rol de pagos de un empleado sin afectar la nómina real." />
      <div className="flex-1 w-full p-6 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border bg-card p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-9 w-full rounded-md bg-muted animate-pulse" />
            ))}
          </div>
          <div className="rounded-xl border bg-card p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-6 w-full rounded-md bg-muted/60 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
