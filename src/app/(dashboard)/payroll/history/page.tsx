import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { SubHeader } from '@/components/layout/SubHeader'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PayrollReport, PayrollReportStatus } from '@/types/employee'
import Link from 'next/link'
import { Search, Filter, Calendar, Users, DollarSign, Eye, Plus, History, X, FileSpreadsheet } from 'lucide-react'
import { NoActiveOrg } from '@/components/org/NoActiveOrg'
import { cn } from '@/lib/utils'

interface PayrollHistoryPageProps {
  searchParams: Promise<{
    q?: string
    status?: string
    date_from?: string
    date_to?: string
  }>
}

const statusConfig: Record<PayrollReportStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  borrador: { label: 'Borrador', variant: 'outline' },
  cerrado:  { label: 'Corte Cerrado', variant: 'secondary' },
  pagado:   { label: 'Liquidado / Pagado', variant: 'default' },
}

export default async function PayrollHistoryPage({ searchParams }: PayrollHistoryPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const currentOrg = await getCurrentOrganization()

  if (!currentOrg) {
    return (
      <NoActiveOrg action="revisar el historial de reportes" />
    )
  }

  let query = supabase
    .from('payroll_reports')
    .select('*')
    .eq('organization_id', currentOrg.id)
    .order('created_at', { ascending: false })

  if (params.status) {
    query = query.eq('status', params.status)
  }

  // Rango de fechas: se incluyen reportes cuyo período de corte se solapa
  // con el rango seleccionado (start_date <= date_to y end_date >= date_from)
  if (params.date_to) {
    query = query.lte('start_date', params.date_to)
  }
  if (params.date_from) {
    query = query.gte('end_date', params.date_from)
  }

  const { data: reportsData } = await query
  const rawReports = (reportsData || []) as PayrollReport[]

  const filteredReports = rawReports.filter((item) => {
    if (!params.q) return true
    const term = params.q.toLowerCase()
    return (
      item.title.toLowerCase().includes(term) ||
      item.department?.toLowerCase().includes(term)
    )
  })

  const hasFilters = Boolean(params.q || params.status || params.date_from || params.date_to)

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      {/* Header con botón para ir al Generador */}
      <PageHeader
        title="Historial"
        description="Registro y archivo histórico de cortes y liquidaciones"
        breadcrumbs={[
          { label: 'Nómina', href: '/payroll' },
          { label: 'Historial de Reportes' },
        ]}
        showExport
        action={
          <Link href="/payroll" className={cn(buttonVariants({ size: 'sm' }), "gap-2")}>
            <Plus className="h-4 w-4" />
            Nuevo Corte
          </Link>
        }
      />

      {/* Subbarra de Filtros a Ancho Completo */}
      <SubHeader
        search={{
          name: 'q',
          defaultValue: params.q,
          placeholder: 'Buscar reporte por título o departamento...',
        }}
        selects={[
          {
            name: 'status',
            defaultValue: params.status ?? '',
            placeholder: 'Todos los estados',
            options: [
              { value: 'cerrado', label: 'Corte Cerrado' },
              { value: 'pagado', label: 'Liquidado / Pagado' },
              { value: 'borrador', label: 'Borrador' },
            ],
          },
        ]}
        dateRange={{
          defaultFrom: params.date_from,
          defaultTo: params.date_to,
          placeholder: 'Rango del período de corte',
        }}
        hasFilters={hasFilters}
        clearHref="/payroll/history"
        counter={`${filteredReports.length} ${filteredReports.length === 1 ? 'reporte guardado' : 'reportes guardados'}`}
      />

      {/* Tabla de Historial a Ancho Completo */}
      <div className="flex-1 p-6 md:p-8 w-full">
        {filteredReports.length > 0 ? (
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
                {filteredReports.map((report) => {
                  const status = statusConfig[report.status] ?? statusConfig.cerrado
                  return (
                    <TableRow key={report.id} className="hover:bg-muted/40 transition-colors text-xs">
                      {/* Título */}
                      <TableCell className="pl-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                            <FileSpreadsheet className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-foreground truncate">
                              {report.title}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              Guardado el {new Date(report.created_at).toLocaleDateString('es-EC')}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Período */}
                      <TableCell className="py-3.5 font-mono text-muted-foreground">
                        {report.start_date} al {report.end_date}
                      </TableCell>

                      {/* Total Empleados */}
                      <TableCell className="py-3.5 font-mono font-medium text-foreground">
                        {report.total_employees} empleados
                      </TableCell>

                      {/* Total Neto */}
                      <TableCell className="py-3.5 font-mono font-bold text-sm text-primary">
                        ${Number(report.total_net || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>

                      {/* Estado */}
                      <TableCell className="py-3.5">
                        <Badge variant={status.variant} className="text-[11px]">
                          {status.label}
                        </Badge>
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="pr-6 py-3.5 text-right">
                        <Link
                          href={`/payroll/history/${report.id}`}
                          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), "h-8 text-xs gap-1.5 cursor-pointer")}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {report.status === 'borrador' ? 'Continuar revisión' : 'Ver Reporte'}
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-12 text-center bg-card/40 max-w-md mx-auto my-8">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
              <History className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-base text-foreground">Sin reportes archivados</h3>
            <p className="text-xs text-muted-foreground mt-1.5 mb-5 max-w-xs mx-auto">
              {hasFilters
                ? 'No se encontraron reportes con los filtros seleccionados.'
                : 'Aún no has guardado cortes en el historial. Puedes generar uno nuevo ahora mismo.'}
            </p>
            <Link href="/payroll" className={cn(buttonVariants({ size: 'sm' }))}>
              Generar Nuevo Corte
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
