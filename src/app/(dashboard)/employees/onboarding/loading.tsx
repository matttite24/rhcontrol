import { PageHeader } from '@/components/layout/PageHeader'

/** Ver nota en payroll/quincena/loading.tsx: sin este archivo se hereda el
 * skeleton de "Inicio" en vez de mostrar algo propio de esta página. */
export default function OnboardingLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <PageHeader title="Contratos" description="Expedientes de ingreso en proceso." />
      <div className="flex-1 w-full p-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg border bg-card animate-pulse" />
        ))}
      </div>
    </div>
  )
}
