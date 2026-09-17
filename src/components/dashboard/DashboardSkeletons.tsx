import { ShieldCheck, DollarSign, TrendingUp, Users, ChevronRight, ClipboardCheck, Plane, UserCheck, Cake, Award, Bell } from 'lucide-react'

/**
 * Fallbacks de <Suspense> para cada sección del dashboard (ver page.tsx).
 * Antes esto vivía todo junto en (dashboard)/loading.tsx, activo mientras
 * TODA la página esperaba su Promise.all — así que navegar a otro módulo
 * mientras "/" seguía cargando dejaba ese mismo boundary visible de más.
 * Con Suspense por sección, cada card se resuelve independiente y el
 * boundary del layout ((dashboard)/loading.tsx) solo se usa para la carga
 * inicial real del shell, no para cada tarjeta individual.
 */

export function MetricsRowSkeleton() {
  const items = [
    { label: 'Planilla IESS', icon: ShieldCheck },
    { label: 'Quincena', icon: DollarSign },
    { label: 'Cierre de nómina', icon: TrendingUp },
    { label: 'Empleados activos', icon: Users },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {items.map(({ label, icon: Icon }) => (
        <div key={label} className="relative rounded-2xl border bg-card px-5 py-5 shadow-xs">
          <ChevronRight className="absolute right-4 top-5 h-4 w-4 text-muted-foreground/30" />
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <span className="text-[13px] font-medium tracking-tight">{label}</span>
          </div>
          <div className="mt-3.5">
            <div className="h-8 w-14 rounded bg-muted animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ListCardSkeleton({
  colSpan,
  icon: Icon,
  iconBg,
  title,
  linkLabel,
  rows,
}: {
  colSpan: string
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  title: string
  linkLabel?: string
  rows: number
}) {
  return (
    <div className={`${colSpan} rounded-xl border bg-card p-5 space-y-4 shadow-xs`}>
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${iconBg}`}>
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">{title}</h3>
        </div>
        {linkLabel && (
          <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
            {linkLabel}
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <div className="space-y-1 animate-pulse">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5">
            <div className="h-7 w-7 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="h-3 w-40 bg-muted rounded" />
              <div className="h-2.5 w-28 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PendingApprovalsSkeleton() {
  return (
    <ListCardSkeleton
      colSpan="lg:col-span-7"
      icon={ClipboardCheck}
      iconBg="bg-orange-500/10 text-orange-600"
      title="Pendientes de Aprobación"
      linkLabel="Ver todo"
      rows={3}
    />
  )
}

export function PayrollSummarySkeleton() {
  return (
    <div className="lg:col-span-5 rounded-xl border bg-card p-5 space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-violet-500/10 text-violet-600">
            <DollarSign className="h-4 w-4" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Último Corte de Nómina</h3>
        </div>
        <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
          Historial
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="animate-pulse space-y-3">
        <div className="h-8 w-32 bg-muted rounded" />
        <div className="grid grid-cols-3 gap-2 pt-3 border-t">
          <div className="h-8 bg-muted rounded" />
          <div className="h-8 bg-muted rounded" />
          <div className="h-8 bg-muted rounded" />
        </div>
      </div>
    </div>
  )
}

export function UpcomingVacationsSkeleton() {
  return (
    <ListCardSkeleton
      colSpan="lg:col-span-6"
      icon={Plane}
      iconBg="bg-sky-500/10 text-sky-600"
      title="Vacaciones Próximas"
      rows={2}
    />
  )
}

export function ProbationSkeleton() {
  return (
    <ListCardSkeleton
      colSpan="lg:col-span-6"
      icon={UserCheck}
      iconBg="bg-cyan-500/10 text-cyan-600"
      title="Período de Prueba"
      rows={2}
    />
  )
}

export function BirthdaysSkeleton() {
  return (
    <ListCardSkeleton
      colSpan="lg:col-span-4"
      icon={Cake}
      iconBg="bg-rose-500/10 text-rose-600"
      title="Cumpleaños"
      rows={3}
    />
  )
}

export function AnniversariesSkeleton() {
  return (
    <ListCardSkeleton
      colSpan="lg:col-span-4"
      icon={Award}
      iconBg="bg-amber-500/10 text-amber-600"
      title="Aniversarios"
      rows={3}
    />
  )
}

export function RecentIncidentsSkeleton() {
  return (
    <ListCardSkeleton
      colSpan="lg:col-span-4"
      icon={Bell}
      iconBg="bg-primary/10 text-primary"
      title="Novedades Recientes"
      linkLabel="Ver todo"
      rows={4}
    />
  )
}
