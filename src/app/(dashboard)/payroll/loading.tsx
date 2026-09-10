import { PageHeader } from '@/components/layout/PageHeader'
import { SubHeader } from '@/components/layout/SubHeader'
import { buttonVariants } from '@/components/ui/button'
import { Save } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Loading state para /payroll (Generar Rol). Sin este archivo, Next.js cae al
 * `(dashboard)/loading.tsx` del padre — el esqueleto de la home — y al entrar
 * se ve por unos segundos la pantalla de Inicio antes de cambiar.
 *
 * Header, subbarra de filtros y encabezados son texto estático; solo el
 * contador y las tarjetas/tabla de datos quedan en pulso.
 */
export default function PayrollLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <PageHeader
        title="Generar Rol"
        description="Cálculo y consolidación general de haberes, horas extras y deducciones"
        breadcrumbs={[{ label: 'Nómina' }, { label: 'Generar Reporte' }]}
        action={
          <button
            type="button"
            disabled
            className={cn(buttonVariants({ size: 'sm' }), 'gap-2 font-medium opacity-70')}
          >
            <Save className="h-4 w-4" />
            Guardar Reporte
          </button>
        }
      />

      <SubHeader
        search={{ name: 'q', placeholder: 'Buscar por empleado...' }}
        selects={[
          { name: 'department', placeholder: 'Todos los departamentos', options: [] },
        ]}
        dateRange={{ placeholder: 'Rango del período de corte' }}
        submitLabel="Actualizar"
        counter="Cargando..."
      />

      <div className="p-6 md:p-8 w-full space-y-6">
        {/* Tarjetas KPI de resumen económico */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="p-4 rounded-xl border bg-card shadow-xs space-y-2">
              <div className="h-3 w-24 rounded bg-muted/50" />
              <div className="h-7 w-32 rounded bg-muted/40" />
              <div className="h-2.5 w-20 rounded bg-muted/40" />
            </div>
          ))}
        </div>

        {/* Tabla de cálculo */}
        <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
          <div className="bg-muted/40 h-10 w-full" />
          <div className="divide-y divide-border/40">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="p-3">
                <div className="h-8 w-full rounded-md bg-muted/50 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
