import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { PayrollTableView } from '@/components/payroll/PayrollTableView'
import { PayrollReport } from '@/types/employee'
import { PayrollEmployeeCalculation } from '@/components/payroll/PayrollDetailModal'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Calendar, Users, DollarSign, TrendingUp, TrendingDown, Building, History } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PayrollReportDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function PayrollReportDetailPage({ params }: PayrollReportDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const currentOrg = await getCurrentOrganization()

  if (!currentOrg) return notFound()

  const { data: reportData, error } = await supabase
    .from('payroll_reports')
    .select('*')
    .eq('id', id)
    .eq('organization_id', currentOrg.id)
    .single()

  if (error || !reportData) {
    notFound()
  }

  const report = reportData as PayrollReport
  const snapshotCalculations = (report.snapshot || []) as PayrollEmployeeCalculation[]

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <PageHeader
        title={report.title}
        description={`Corte del ${report.start_date} al ${report.end_date} • Guardado el ${new Date(report.created_at).toLocaleDateString('es-EC')}`}
        breadcrumbs={[
          { label: 'Nómina', href: '/payroll' },
          { label: 'Historial', href: '/payroll/history' },
          { label: report.title },
        ]}
        action={
          <Link
            href="/payroll/history"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), "gap-1.5 cursor-pointer")}
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al Historial
          </Link>
        }
      />

      {/* Resumen de KPIs Guardados */}
      <div className="px-6 py-4 border-b bg-muted/20">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl border bg-card shadow-2xs space-y-1">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" />
              Empleados
            </span>
            <p className="text-lg font-bold font-mono text-foreground">
              {report.total_employees}
            </p>
          </div>

          <div className="p-3.5 rounded-xl border bg-card shadow-2xs space-y-1">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Total Haberes
            </span>
            <p className="text-lg font-bold font-mono text-foreground">
              ${Number(report.total_income || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="p-3.5 rounded-xl border bg-card shadow-2xs space-y-1">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4 text-rose-500" />
              Total Deducciones
            </span>
            <p className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400">
              -${Number(report.total_deductions || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="p-3.5 rounded-xl border bg-primary/5 border-primary/20 shadow-2xs space-y-1">
            <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" />
              Neto Liquidado
            </span>
            <p className="text-lg font-black font-mono text-primary">
              ${Number(report.total_net || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Tabla con el snapshot del reporte histórico */}
      <div className="flex-1 p-6 md:p-8 w-full">
        <PayrollTableView
          calculations={snapshotCalculations}
          startDate={report.start_date}
          endDate={report.end_date}
        />
      </div>
    </div>
  )
}
