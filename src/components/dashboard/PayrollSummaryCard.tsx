import { createClient } from '@/lib/supabase/server'
import { DollarSign, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Organization, PayrollReport } from '@/types/employee'

export async function PayrollSummaryCard({ currentOrg }: { currentOrg: Organization }) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('payroll_reports')
    .select('id, title, start_date, end_date, total_employees, total_income, total_deductions, total_net, status')
    .eq('organization_id', currentOrg.id)
    .in('status', ['cerrado', 'pagado'])
    .order('end_date', { ascending: false })
    .limit(2)

  const payrollReports = (data || []) as Pick<PayrollReport, 'id' | 'title' | 'start_date' | 'end_date' | 'total_employees' | 'total_income' | 'total_deductions' | 'total_net' | 'status'>[]
  const [latestPayroll, previousPayroll] = payrollReports

  return (
    <div className="lg:col-span-5 rounded-xl border bg-card p-5 space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-violet-500/10 text-violet-600">
            <DollarSign className="h-4 w-4" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Último Corte de Nómina
          </h3>
        </div>
        <Link
          href="/payroll/history"
          className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
        >
          Historial
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {latestPayroll ? (
        <div className="space-y-3">
          <div>
            <p className="text-[11px] text-muted-foreground truncate">{latestPayroll.title}</p>
            <p className="text-2xl font-bold font-mono text-foreground leading-tight">
              ${Number(latestPayroll.total_net || 0).toFixed(2)}
            </p>
            {previousPayroll && previousPayroll.total_net > 0 && (() => {
              const diff = latestPayroll.total_net - previousPayroll.total_net
              const pct = (diff / previousPayroll.total_net) * 100
              const isUp = diff > 0
              const isFlat = Math.abs(pct) < 0.05
              return (
                <span className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-medium mt-0.5",
                  isFlat ? "text-muted-foreground" : isUp ? "text-emerald-600" : "text-rose-600"
                )}>
                  {isFlat ? <Minus className="h-3 w-3" /> : isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {isFlat ? 'Sin variación' : `${isUp ? '+' : ''}${pct.toFixed(1)}%`} vs. corte anterior
                </span>
              )
            })()}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t text-center">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Empleados</p>
              <p className="text-sm font-bold font-mono text-foreground">{latestPayroll.total_employees}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ingresos</p>
              <p className="text-sm font-bold font-mono text-foreground">${Number(latestPayroll.total_income || 0).toFixed(0)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Descuentos</p>
              <p className="text-sm font-bold font-mono text-foreground">${Number(latestPayroll.total_deductions || 0).toFixed(0)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-xs text-muted-foreground italic">
          Aún no hay cortes de nómina cerrados o pagados.
        </div>
      )}
    </div>
  )
}
