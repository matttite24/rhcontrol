import { PageHeader } from '@/components/layout/PageHeader'

/** Ver nota en payroll/quincena/loading.tsx: sin este archivo se hereda el
 * skeleton de "Inicio" en vez de mostrar algo propio de esta página. */
export default function BulkUpdateLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <PageHeader title="Ajuste Masivo" description="Actualiza datos de varios empleados a la vez." />
      <div className="flex-1 w-full p-6 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 rounded-md bg-muted/50 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
