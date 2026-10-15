import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { NoActiveOrg } from '@/components/org/NoActiveOrg'
import { getEcuadorNow } from '@/lib/utils/ecuador-time'
import { DashboardMetricsRow } from '@/components/dashboard/DashboardMetricsRow'
import { PendingApprovalsCard } from '@/components/dashboard/PendingApprovalsCard'
import { PayrollSummaryCard } from '@/components/dashboard/PayrollSummaryCard'
import { UpcomingVacationsCard } from '@/components/dashboard/UpcomingVacationsCard'
import { ProbationCard } from '@/components/dashboard/ProbationCard'
import { BirthdaysCard } from '@/components/dashboard/BirthdaysCard'
import { AnniversariesCard } from '@/components/dashboard/AnniversariesCard'
import { RecentIncidentsCard } from '@/components/dashboard/RecentIncidentsCard'
import {
  MetricsRowSkeleton,
  PendingApprovalsSkeleton,
  PayrollSummarySkeleton,
  UpcomingVacationsSkeleton,
  ProbationSkeleton,
  BirthdaysSkeleton,
  AnniversariesSkeleton,
  RecentIncidentsSkeleton,
} from '@/components/dashboard/DashboardSkeletons'

/**
 * Antes esta página hacía 5 queries + 1 RPC en un solo Promise.all antes de
 * poder pintar nada — mientras esperaba, (dashboard)/loading.tsx quedaba
 * activo, y si el usuario navegaba a otro módulo en ese instante (ej. clic
 * en "Empleados" apenas entrando a la app), ese mismo skeleton de "Inicio"
 * seguía visible unos instantes de más antes de que la navegación real
 * tomara efecto — un bug reportado como "veo el dashboard antes de cambiar
 * de módulo".
 *
 * Ahora esta página solo espera lo mínimo para el saludo (usuario + org
 * activa) y renderiza el resto de inmediato; cada sección (métricas,
 * pendientes, nómina, vacaciones, prueba, cumpleaños, aniversarios,
 * novedades) es su propio Server Component async envuelto en <Suspense>, así
 * que ninguna bloquea a las demás ni al shell, y el layout deja de depender
 * de un solo Promise.all gigante para mostrar algo en pantalla.
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const currentOrg = await getCurrentOrganization()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!currentOrg) {
    return (
      <NoActiveOrg />
    )
  }

  const rawName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split('@')[0] ||
    ''
  const firstName = rawName
    ? rawName.split(/[.\s_-]+/)[0].replace(/^\w/, (c) => c.toUpperCase())
    : ''

  const today = getEcuadorNow()
  const hour = today.getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const todayLabel = `${dayNames[today.getDay()]}, ${today.getDate()} de ${monthNames[today.getMonth()]}`

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <div className="p-6 md:p-8 space-y-6 w-full">
        {/* Hero: saludo + fecha — se pinta de inmediato, no depende de ninguna query de negocio */}
        <section className="pb-2 space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {greeting}
            {firstName ? `, ${firstName}` : ''}{' '}
            <span className="inline-block origin-[70%_70%] motion-safe:animate-[wave_2.2s_ease-in-out_1]">
              👋
            </span>
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{todayLabel}</p>
        </section>

        {/* FILA 1: métricas del día */}
        <Suspense fallback={<MetricsRowSkeleton />}>
          <DashboardMetricsRow currentOrg={currentOrg} />
        </Suspense>

        {/* FILA 2: pendientes de aprobación + resumen de nómina */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Suspense fallback={<PendingApprovalsSkeleton />}>
            <PendingApprovalsCard currentOrg={currentOrg} />
          </Suspense>
          <Suspense fallback={<PayrollSummarySkeleton />}>
            <PayrollSummaryCard currentOrg={currentOrg} />
          </Suspense>
        </div>

        {/* FILA 3: vacaciones próximas + período de prueba */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Suspense fallback={<UpcomingVacationsSkeleton />}>
            <UpcomingVacationsCard currentOrg={currentOrg} />
          </Suspense>
          <Suspense fallback={<ProbationSkeleton />}>
            <ProbationCard currentOrg={currentOrg} />
          </Suspense>
        </div>

        {/* FILA 4: cumpleaños + aniversarios + novedades recientes */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Suspense fallback={<BirthdaysSkeleton />}>
            <BirthdaysCard currentOrg={currentOrg} />
          </Suspense>
          <Suspense fallback={<AnniversariesSkeleton />}>
            <AnniversariesCard currentOrg={currentOrg} />
          </Suspense>
          <Suspense fallback={<RecentIncidentsSkeleton />}>
            <RecentIncidentsCard currentOrg={currentOrg} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
