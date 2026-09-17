import { PageHeader } from '@/components/layout/PageHeader'

/** Ver nota en payroll/quincena/loading.tsx: sin este archivo se hereda el
 * skeleton de "Inicio" en vez de mostrar algo propio de esta página. */
export default function NewEmployeeLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <PageHeader title="Nuevo Empleado" description="Registrar un nuevo empleado en la organización" />
      <div className="flex-1 w-full px-6 md:px-10 py-6 space-y-4">
        <div className="h-10 w-full max-w-md rounded-lg bg-muted animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 rounded-md bg-muted/50 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
