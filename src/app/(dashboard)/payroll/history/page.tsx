import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { SubHeader } from '@/components/layout/SubHeader'
import { HeaderDateRange } from '@/components/layout/HeaderDateRange'
import { StatusTabs, type StatusTab } from '@/components/ui/status-tabs'
import { formatDateRangeShort } from '@/lib/shifts/format'
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
import { DeletePayrollDraftButton } from '@/components/payroll/DeletePayrollDraftButton'
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

  // Búsqueda y fecha acotan el conjunto base; el estado se aplica después en
  // memoria para poder contar cada pestaña sobre ese mismo conjunto.
  const baseReports = rawReports.filter((item) => {
    if (!params.q) return true
    const term = params.q.toLowerCase()
    return (
      item.title.toLowerCase().includes(term) ||
      item.department?.toLowerCase().includes(term)
    )
  })

  const statusFilter = params.status ?? 'todos'
  const filteredReports =
    statusFilter === 'todos' ? baseReports : baseReports.filter((r) => r.status === statusFilter)

  const countStatus = (status: PayrollReportStatus) => baseReports.filter((r) => r.status === status).length

  const statusTabs: StatusTab[] = [
    { value: 'todos', label: 'Todos', count: baseReports.length, tone: 'neutral', alwaysShow: true },
    { value: 'borrador', label: 'Borradores', count: countStatus('borrador'), tone: 'warning' },
    { value: 'cerrado', label: 'Cortes cerrados', count: countStatus('cerrado'), tone: 'neutral' },
    { value: 'pagado', label: 'Liquidados', count: countStatus('pagado'), tone: 'success' },
  ]

  function buildStatusHref(status: string) {
    const sp = new URLSearchParams()
    if (params.q) sp.set('q', params.q)
    if (params.date_from) sp.set('date_from', params.date_from)
    if (params.date_to) sp.set('date_to', params.date_to)
    // "Todos" es la vista por defecto: no necesita parámetro.
    if (status !== 'todos') sp.set('status', status)
    const qs = sp.toString()
    return qs ? `/payroll/history?${qs}` : '/payroll/history'
  }

  const hasFilters = Boolean(params.q || params.date_from || params.date_to)
  const hasDateRange = Boolean(params.date_from && params.date_to)

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      {/* Header con botón para ir al Generador */}
      <PageHeader
        title={hasDateRange ? `Historial · ${formatDateRangeShort(params.date_from!, params.date_to!)}` : 'Historial'}
        description={
          hasDateRange
            ? `${baseReports.length} ${baseReports.length === 1 ? 'reporte' : 'reportes'} con período de corte en este rango`
            : 'Registro y archivo histórico de cortes y liquidaciones'
        }
        action={
          <>
            <HeaderDateRange
              placeholder="Fechas"
              defaultFrom={params.date_from}
              defaultTo={params.date_to}
            />
            <Link href="/payroll" className={cn(buttonVariants({ size: 'sm' }), "gap-2")}>
              <Plus className="h-4 w-4" />
              Nuevo Corte
            </Link>
          </>
        }
      />

      {/* Subbarra de Filtros a Ancho Completo */}
      <SubHeader
        search={{
          name: 'q',
          defaultValue: params.q,
          placeholder: 'Título o departamento…',
        }}
        hasFilters={hasFilters}
        clearHref="/payroll/history"
        className="bg-muted"
        trailing={
          <StatusTabs
            ariaLabel="Estado de los reportes"
            tabs={statusTabs}
            activeValue={statusFilter}
            buildHref={buildStatusHref}
          />
        }
      />

      {/* Tabla de Historial a Ancho Completo */}
      <div className="flex-1 p-6 md:p-8 w-full">
        {filteredReports.length > 0 ? (
          <div className="rounded-xl border bg-card shadow-xs overflow-hidden w-full">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
                  <TableHead className="w-[27%] pl-6 font-semibold">Reporte / Título</TableHead>
                  <TableHead className="w-[20%] font-semibold">Período de Corte</TableHead>
                  <TableHead className="w-[12%] font-semibold">Empleados</TableHead>
                  <TableHead className="w-[14%] font-semibold">Total a Pagar</TableHead>
                  <TableHead className="w-[12%] font-semibold">Estado</TableHead>
                  <TableHead className="w-[15%] pr-6 text-right font-semibold">Acciones</TableHead>
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
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/payroll/history/${report.id}`}
                            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), "h-8 text-xs gap-1.5 cursor-pointer")}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {report.status === 'borrador' ? 'Continuar revisión' : 'Ver Reporte'}
                          </Link>
                          {report.status === 'borrador' && (
                            <DeletePayrollDraftButton payrollReportId={report.id} title={report.title} />
                          )}
                        </div>
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
