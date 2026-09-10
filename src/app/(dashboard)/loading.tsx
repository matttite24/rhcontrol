import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FileCheck2, DollarSign, ShieldCheck, TrendingUp, Users, Cake, Bell, ChevronRight, ClipboardCheck, Plane, UserCheck, Award } from 'lucide-react'
import Link from 'next/link'

/**
 * Loading state para "/" (Inicio). El header y las tarjetas de cumplimiento
 * laboral son texto estático (no dependen de la base de datos), así que se
 * renderizan reales de inmediato; solo lo que depende de consultas
 * (contadores, cumpleaños, novedades recientes) queda como skeleton.
 */
export default function DashboardLoading() {
  const today = new Date()
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const currentMonthName = monthNames[today.getMonth()]
  const todayLabel = `${dayNames[today.getDay()]}, ${today.getDate()} de ${currentMonthName}`

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background/75 supports-[backdrop-filter]:backdrop-blur-md px-6 py-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground truncate">
            Inicio
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground capitalize">
            {todayLabel}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/employees/onboarding"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'text-xs gap-1.5 active:scale-95 transition-transform')}
          >
            <FileCheck2 className="h-3.5 w-3.5 text-primary" />
            Expedientes
          </Link>
          <Link
            href="/payroll"
            className={cn(buttonVariants({ size: 'sm' }), 'text-xs gap-1.5 active:scale-95 transition-transform')}
          >
            <DollarSign className="h-3.5 w-3.5" />
            Generar Nómina
          </Link>
        </div>
      </header>

      <div className="p-6 md:p-8 space-y-6 w-full">
        {/* FILA 1: tarjetas de plazos — el texto es estático, solo el número final depende de datos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="group p-4 rounded-xl border bg-card shadow-xs flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Planilla IESS</p>
              <p className="text-lg font-bold font-mono text-foreground leading-tight animate-pulse">Cargando...</p>
              <p className="text-[11px] text-muted-foreground">Límite: 15 de {currentMonthName}</p>
            </div>
          </div>

          <div className="group p-4 rounded-xl border bg-card shadow-xs flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 shrink-0">
              <DollarSign className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Quincena</p>
              <p className="text-lg font-bold font-mono text-foreground leading-tight animate-pulse">Cargando...</p>
              <p className="text-[11px] text-muted-foreground">Anticipo acordado</p>
            </div>
          </div>

          <div className="group p-4 rounded-xl border bg-card shadow-xs flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Cierre de nómina</p>
              <p className="text-lg font-bold font-mono text-foreground leading-tight animate-pulse">Cargando...</p>
              <p className="text-[11px] text-muted-foreground">Fin de {currentMonthName}</p>
            </div>
          </div>

          <div className="group p-4 rounded-xl border bg-card shadow-xs flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Empleados activos</p>
              <p className="text-lg font-bold font-mono text-foreground leading-tight animate-pulse">···</p>
              <p className="text-[11px] text-muted-foreground">Total en nómina</p>
            </div>
          </div>
        </div>

        {/* FILA 2: pendientes de aprobación + resumen de nómina — encabezados reales, contenido en skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-xl border bg-card p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-orange-500/10 text-orange-600">
                  <ClipboardCheck className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Pendientes de Aprobación
                </h3>
              </div>
              <Link
                href="/shifts/requests?status=pendiente"
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
              >
                Ver todo
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="space-y-1 animate-pulse">
              {[0, 1, 2].map((i) => (
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
            <div className="animate-pulse space-y-3">
              <div className="h-8 w-32 bg-muted rounded" />
              <div className="grid grid-cols-3 gap-2 pt-3 border-t">
                <div className="h-8 bg-muted rounded" />
                <div className="h-8 bg-muted rounded" />
                <div className="h-8 bg-muted rounded" />
              </div>
            </div>
          </div>
        </div>

        {/* FILA 3: vacaciones próximas + período de prueba */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 rounded-xl border bg-card p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-sky-500/10 text-sky-600">
                  <Plane className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Vacaciones Próximas
                </h3>
              </div>
            </div>
            <div className="space-y-1 animate-pulse">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-3 p-2.5">
                  <div className="h-7 w-7 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="h-3 w-32 bg-muted rounded" />
                    <div className="h-2.5 w-20 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 rounded-xl border bg-card p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-cyan-500/10 text-cyan-600">
                  <UserCheck className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Período de Prueba
                </h3>
              </div>
            </div>
            <div className="space-y-1 animate-pulse">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-3 p-2.5">
                  <div className="h-7 w-7 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="h-3 w-32 bg-muted rounded" />
                    <div className="h-2.5 w-20 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FILA 4: cumpleaños + aniversarios + novedades — encabezados reales, listas en skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 rounded-xl border bg-card p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-rose-500/10 text-rose-600">
                  <Cake className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Cumpleaños en {currentMonthName}
                </h3>
              </div>
            </div>
            <div className="space-y-2.5 animate-pulse">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 p-2.5">
                  <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="h-3 w-32 bg-muted rounded" />
                    <div className="h-2.5 w-20 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 rounded-xl border bg-card p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600">
                  <Award className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Aniversarios en {currentMonthName}
                </h3>
              </div>
            </div>
            <div className="space-y-2.5 animate-pulse">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 p-2.5">
                  <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="h-3 w-32 bg-muted rounded" />
                    <div className="h-2.5 w-20 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 rounded-xl border bg-card p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  <Bell className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Novedades Recientes
                </h3>
              </div>
              <Link
                href="/incidents"
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
              >
                Ver todo
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="space-y-1 animate-pulse">
              {[0, 1, 2, 3].map((i) => (
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
        </div>

      </div>
    </div>
  )
}
