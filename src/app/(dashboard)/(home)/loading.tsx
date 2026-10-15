import {
  ShieldCheck,
  DollarSign,
  TrendingUp,
  Users,
  ChevronRight,
  ClipboardCheck,
  Plane,
  UserCheck,
  Cake,
  Award,
  Bell,
} from 'lucide-react'

/**
 * Loading state para "/" (Inicio). Debe reflejar la MISMA estructura que
 * page.tsx (hero sin header sticky, tarjetas como <Link> con número
 * dominante) — un loading.tsx con un layout distinto al real es peor que no
 * tener ninguno: el usuario ve literalmente un diseño distinto por unos
 * segundos antes de que la page real lo reemplace, como si la app hubiera
 * "revertido" a una versión anterior.
 *
 * El saludo depende de la hora y del nombre del usuario (ver page.tsx), así
 * que aquí se muestra un saludo genérico sin nombre — es solo el placeholder
 * mientras carga, no necesita ser idéntico letra por letra.
 */
export default function DashboardLoading() {
  const today = new Date()
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const currentMonthName = monthNames[today.getMonth()]
  const todayLabel = `${dayNames[today.getDay()]}, ${today.getDate()} de ${currentMonthName}`

  const hour = today.getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <div className="p-6 md:p-8 space-y-6 w-full">
        {/* Hero: saludo + fecha — mismo bloque que page.tsx, sin el nombre
            (depende de auth.getUser(), aún no resuelto en este punto) */}
        <section className="pb-2 space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {greeting}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{todayLabel}</p>
        </section>

        {/* FILA 1: métricas del día — mismo grid/tarjeta que page.tsx, con el
            número en pulso mientras no hay dato real */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'Planilla IESS', hint: `Límite 15 de ${currentMonthName}`, icon: ShieldCheck },
            { label: 'Quincena', hint: 'Anticipo acordado', icon: DollarSign },
            { label: 'Cierre de nómina', hint: `Fin de ${currentMonthName}`, icon: TrendingUp },
            { label: 'Empleados activos', hint: 'Total en nómina', icon: Users },
          ].map(({ label, hint, icon: Icon }) => (
            <div
              key={label}
              className="relative rounded-2xl border bg-card px-5 py-5 shadow-xs"
            >
              <ChevronRight className="absolute right-4 top-5 h-4 w-4 text-muted-foreground/30" />
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                <span className="text-[13px] font-medium tracking-tight">{label}</span>
              </div>
              <div className="mt-3.5">
                <div className="h-8 w-14 rounded bg-muted animate-pulse" />
              </div>
              <p className="mt-2 text-[12px] leading-tight text-muted-foreground/80">{hint}</p>
            </div>
          ))}
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
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                Ver todo
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
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
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                Ver todo
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
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
