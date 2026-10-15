import { PageHeader } from '@/components/layout/PageHeader'
import { SubHeader } from '@/components/layout/SubHeader'
import { HeaderDateRange } from '@/components/layout/HeaderDateRange'
import { StatusTabsSkeleton } from '@/components/ui/status-tabs'
import { buttonVariants } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'

/**
 * Loading state para /payroll/history. Sin este archivo, Next.js cae al
 * `(dashboard)/loading.tsx` del padre — el esqueleto de la home — y al entrar
 * se ve por unos segundos la pantalla de Inicio antes de cambiar.
 */
export default function PayrollHistoryLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <PageHeader
        title="Historial"
        description="Registro y archivo histórico de cortes y liquidaciones"
        action={
          <>
            <HeaderDateRange placeholder="Fechas" />
            <button type="button" disabled className={cn(buttonVariants({ size: 'sm' }), 'gap-2 font-medium opacity-70')}>
              <Plus className="h-4 w-4" />
              Nuevo Corte
            </button>
          </>
        }
      />

      <SubHeader
        search={{ name: 'q', placeholder: 'Título o departamento…' }}
        className="bg-muted"
        trailing={<StatusTabsSkeleton labels={['Todos', 'Borradores', 'Cortes cerrados', 'Liquidados']} />}
      />

      <div className="flex-1 p-6 md:p-8 w-full">
        <div className="rounded-xl border bg-card shadow-xs overflow-hidden w-full">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
                <TableHead className="w-[30%] pl-6 font-semibold">Reporte / Título</TableHead>
                <TableHead className="w-[20%] font-semibold">Período de Corte</TableHead>
                <TableHead className="w-[12%] font-semibold">Empleados</TableHead>
                <TableHead className="w-[14%] font-semibold">Total a Pagar</TableHead>
                <TableHead className="w-[12%] font-semibold">Estado</TableHead>
                <TableHead className="w-[12%] pr-6 text-right font-semibold">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6} className="py-2.5">
                    <div className="h-8 w-full rounded-md bg-muted/50 animate-pulse" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
