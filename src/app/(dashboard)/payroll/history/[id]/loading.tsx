import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { ArrowLeft, Users, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Loading state para /payroll/history/[id]. Sin este archivo, Next.js cae al
 * `(dashboard)/loading.tsx` del padre — el esqueleto de la home — y al abrir
 * un reporte guardado se ve por unos segundos la pantalla de Inicio.
 *
 * El título del reporte depende de datos, así que aquí es neutro; el resto
 * de la estructura (KPIs, tabla) queda en pulso.
 */
const KPIS = [
  { icon: Users, label: 'Empleados' },
  { icon: TrendingUp, label: 'Total Haberes' },
  { icon: TrendingDown, label: 'Total Deducciones' },
  { icon: DollarSign, label: 'Neto Liquidado' },
]

export default function PayrollHistoryDetailLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <PageHeader
        title="Reporte de Nómina"
        description="Cargando el detalle del corte guardado…"
        action={
          <span
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'gap-1.5 opacity-70 pointer-events-none'
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al Historial
          </span>
        }
      />

      <div className="px-6 py-4 border-b bg-muted/20">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 animate-pulse">
          {KPIS.map((kpi) => (
            <div key={kpi.label} className="p-3.5 rounded-xl border bg-card shadow-2xs space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <kpi.icon className="h-4 w-4 text-muted-foreground" />
                {kpi.label}
              </span>
              <div className="h-6 w-28 rounded bg-muted/50" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 md:p-8 w-full">
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
