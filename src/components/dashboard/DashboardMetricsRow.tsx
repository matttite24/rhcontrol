import { ChevronRight, ShieldCheck, DollarSign, TrendingUp, Users } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { getEcuadorNow } from '@/lib/utils/ecuador-time'
import { getDashboardInsights } from '@/lib/dashboard/insights'
import { Organization } from '@/types/employee'

/**
 * Fila de métricas del día (IESS, quincena, cierre de nómina, empleados
 * activos). Solo el conteo de activos depende de una consulta (RPC
 * get_dashboard_employee_insights); el resto son cálculos de fecha locales.
 * Aislado en su propio Server Component + Suspense (ver page.tsx) para que
 * el saludo y el resto del dashboard no esperen a este RPC.
 */
export async function DashboardMetricsRow({ currentOrg }: { currentOrg: Organization }) {
  const insights = await getDashboardInsights(currentOrg.id)
  const activeEmployeeCount = insights.active_count

  const today = getEcuadorNow()
  const currentMonth = today.getMonth() + 1
  const currentDay = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), currentMonth, 0).getDate()
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const currentMonthName = monthNames[currentMonth - 1]

  const daysToQuincena = currentDay <= 15 ? 15 - currentDay : (daysInMonth - currentDay) + 15
  const daysToEndOfMonth = Math.max(0, daysInMonth - currentDay)
  const daysToIess = currentDay <= 15 ? 15 - currentDay : (daysInMonth - currentDay) + 15

  const metrics = [
    {
      label: 'Planilla IESS',
      value: daysToIess === 0 ? 'Hoy' : `${daysToIess}`,
      unit: daysToIess === 0 ? '' : daysToIess === 1 ? 'día' : 'días',
      hint: `Límite 15 de ${currentMonthName}`,
      icon: ShieldCheck,
      urgent: daysToIess <= 2,
      href: '/compliance',
    },
    {
      label: 'Quincena',
      value: daysToQuincena === 0 ? 'Hoy' : `${daysToQuincena}`,
      unit: daysToQuincena === 0 ? '' : daysToQuincena === 1 ? 'día' : 'días',
      hint: 'Anticipo acordado',
      icon: DollarSign,
      urgent: daysToQuincena <= 2,
      href: '/payroll/quincena',
    },
    {
      label: 'Cierre de nómina',
      value: daysToEndOfMonth === 0 ? 'Hoy' : `${daysToEndOfMonth}`,
      unit: daysToEndOfMonth === 0 ? '' : daysToEndOfMonth === 1 ? 'día' : 'días',
      hint: `Fin de ${currentMonthName}`,
      icon: TrendingUp,
      urgent: daysToEndOfMonth <= 2,
      href: '/payroll',
    },
    {
      label: 'Empleados activos',
      value: `${activeEmployeeCount}`,
      unit: activeEmployeeCount === 1 ? 'persona' : 'personas',
      hint: 'Total en nómina',
      icon: Users,
      urgent: false,
      href: '/employees',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {metrics.map(({ label, value, unit, hint, icon: Icon, urgent, href }) => (
        <Link
          key={label}
          href={href}
          className="group relative rounded-2xl border bg-card px-5 py-5 shadow-xs transition-colors duration-200 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="absolute right-4 top-5 h-4 w-4 text-muted-foreground/40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <span className="text-[13px] font-medium tracking-tight">{label}</span>
          </div>
          <div className="mt-3.5 flex items-baseline gap-1.5">
            <span
              className={cn(
                'text-[2rem] font-semibold leading-none tabular-nums tracking-[-0.03em]',
                urgent ? 'text-destructive' : 'text-foreground'
              )}
            >
              {value}
            </span>
            {unit && (
              <span className="text-[13px] font-medium text-muted-foreground tracking-tight">
                {unit}
              </span>
            )}
          </div>
          <p className="mt-2 text-[12px] leading-tight text-muted-foreground/80">{hint}</p>
        </Link>
      ))}
    </div>
  )
}
