import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { NoActiveOrg } from '@/components/org/NoActiveOrg'
import { Employee, Incident, PayrollReport, ShiftRequest } from '@/types/employee'
import Link from 'next/link'
import {
  Users,
  Cake,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileCheck2,
  ShieldCheck,
  Bell,
  Sparkles,
  ChevronRight,
  ClipboardCheck,
  Plane,
  UserCheck,
  Award,
  Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const currentOrg = await getCurrentOrganization()

  if (!currentOrg) {
    return (
      <NoActiveOrg />
    )
  }

  // Todas las consultas de esta página en paralelo, cada una acotada a las
  // columnas que realmente se pintan.
  const todayIso = new Date().toISOString().slice(0, 10)
  const in30DaysIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [
    { data: employeesData },
    { data: incidentsData },
    { data: pendingRequestsData },
    { data: upcomingVacationsData },
    { data: payrollReportsData },
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('id, full_name, avatar_url, department, position, birth_date, hire_date, status')
      .eq('organization_id', currentOrg.id)
      .neq('status', 'inactivo')
      .order('full_name'),
    supabase
      .from('incidents')
      .select('id, title, incident_type, created_at, employee:employees(full_name, avatar_url, department)')
      .eq('organization_id', currentOrg.id)
      .order('created_at', { ascending: false })
      .limit(5),
    // Novedades pendientes de aprobación (horas extras, cambios de turno, permisos, vacaciones)
    supabase
      .from('shift_requests')
      .select('id, request_type, title, date, hours, created_at, employee:employees(full_name, avatar_url, department)')
      .eq('organization_id', currentOrg.id)
      .eq('status', 'pendiente')
      .order('created_at', { ascending: false })
      .limit(6),
    // Vacaciones aprobadas que empiezan dentro de los próximos 30 días
    supabase
      .from('shift_requests')
      .select('id, date, employee:employees(full_name, avatar_url, department)')
      .eq('organization_id', currentOrg.id)
      .eq('request_type', 'solicitud_vacaciones')
      .eq('status', 'aprobado')
      .gte('date', todayIso)
      .lte('date', in30DaysIso)
      .order('date', { ascending: true })
      .limit(6),
    // Últimos 2 reportes de nómina cerrados/pagados, para comparar el más reciente vs. el anterior
    supabase
      .from('payroll_reports')
      .select('id, title, start_date, end_date, total_employees, total_income, total_deductions, total_net, status')
      .eq('organization_id', currentOrg.id)
      .in('status', ['cerrado', 'pagado'])
      .order('end_date', { ascending: false })
      .limit(2),
  ])

  const employees = (employeesData || []) as Pick<Employee, 'id' | 'full_name' | 'avatar_url' | 'department' | 'position' | 'birth_date' | 'hire_date' | 'status'>[]

  const recentIncidents = (incidentsData || []) as unknown as (Pick<Incident, 'id' | 'title' | 'incident_type' | 'created_at'> & { employee?: { full_name: string; avatar_url: string | null; department: string | null } })[]

  const pendingRequests = (pendingRequestsData || []) as unknown as (Pick<ShiftRequest, 'id' | 'request_type' | 'title' | 'date' | 'hours' | 'created_at'> & { employee?: { full_name: string; avatar_url: string | null; department: string | null } })[]

  const upcomingVacations = (upcomingVacationsData || []) as unknown as (Pick<ShiftRequest, 'id' | 'date'> & { employee?: { full_name: string; avatar_url: string | null; department: string | null } })[]

  const payrollReports = (payrollReportsData || []) as Pick<PayrollReport, 'id' | 'title' | 'start_date' | 'end_date' | 'total_employees' | 'total_income' | 'total_deductions' | 'total_net' | 'status'>[]
  const [latestPayroll, previousPayroll] = payrollReports

  const requestTypeLabels: Record<string, string> = {
    horas_extras: 'Horas extras',
    cambio_horario: 'Cambio de turno',
    permiso_laboral: 'Permiso laboral',
    solicitud_vacaciones: 'Vacaciones',
    otro: 'Novedad',
  }

  // Período de prueba: empleados con status "prueba", ordenados por antigüedad
  // (los que llevan más tiempo son los más urgentes de evaluar/confirmar).
  const probationEmployees = employees
    .filter((emp) => emp.status === 'prueba' && emp.hire_date)
    .map((emp) => {
      const hireDate = new Date(emp.hire_date as string)
      const daysSinceHire = Math.max(0, Math.floor((Date.now() - hireDate.getTime()) / (24 * 60 * 60 * 1000)))
      return { ...emp, daysSinceHire }
    })
    .sort((a, b) => b.daysSinceHire - a.daysSinceHire)

  // 3. Calcular cumpleaños del mes en curso
  const today = new Date()
  const currentMonth = today.getMonth() + 1 // 1-12
  const currentDay = today.getDate()

  const birthdayEmployees = employees.filter((emp) => {
    if (!emp.birth_date) return false
    const parts = emp.birth_date.split('-')
    if (parts.length >= 2) {
      const bMonth = parseInt(parts[1], 10)
      return bMonth === currentMonth
    }
    return false
  }).sort((a, b) => {
    const dayA = parseInt(a.birth_date?.split('-')[2] || '0', 10)
    const dayB = parseInt(b.birth_date?.split('-')[2] || '0', 10)
    return dayA - dayB
  })

  // 4. Aniversarios laborales del mes en curso (mismo criterio que cumpleaños, sobre hire_date)
  const anniversaryEmployees = employees.filter((emp) => {
    if (!emp.hire_date) return false
    const parts = emp.hire_date.split('-')
    if (parts.length >= 2) {
      const hMonth = parseInt(parts[1], 10)
      return hMonth === currentMonth
    }
    return false
  }).map((emp) => {
    const hireYear = parseInt(emp.hire_date?.split('-')[0] || '0', 10)
    const years = hireYear ? today.getFullYear() - hireYear : 0
    return { ...emp, years }
  }).filter((emp) => emp.years > 0)
    .sort((a, b) => {
      const dayA = parseInt(a.hire_date?.split('-')[2] || '0', 10)
      const dayB = parseInt(b.hire_date?.split('-')[2] || '0', 10)
      return dayA - dayB
    })

  // 5. Cálculos de días restantes para Quincena, Fin de Mes e IESS
  const daysInMonth = new Date(today.getFullYear(), currentMonth, 0).getDate()

  const daysToQuincena = currentDay <= 15 ? 15 - currentDay : (daysInMonth - currentDay) + 15
  const daysToEndOfMonth = Math.max(0, daysInMonth - currentDay)
  const daysToIess = currentDay <= 15 ? 15 - currentDay : (daysInMonth - currentDay) + 15

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const currentMonthName = monthNames[currentMonth - 1]

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const todayLabel = `${dayNames[today.getDay()]}, ${currentDay} de ${currentMonthName}`

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      {/* Header traslúcido: saludo + fecha, sin repetir el nombre de la organización (ya está en el sidebar) */}
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
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), "text-xs gap-1.5 active:scale-95 transition-transform")}
          >
            <FileCheck2 className="h-3.5 w-3.5 text-primary" />
            Expedientes
          </Link>
          <Link
            href="/payroll"
            className={cn(buttonVariants({ size: 'sm' }), "text-xs gap-1.5 active:scale-95 transition-transform")}
          >
            <DollarSign className="h-3.5 w-3.5" />
            Generar Nómina
          </Link>
        </div>
      </header>

      <div className="p-6 md:p-8 space-y-6 w-full">
        {/* FILA 1: PLAZOS Y OBLIGACIONES DE PAGO + PLANTILLA — lo más accionable primero */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="group p-4 rounded-xl border bg-card shadow-xs flex items-center gap-3.5 transition-colors hover:bg-muted/30">
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Planilla IESS</p>
              <p className="text-lg font-bold font-mono text-foreground leading-tight">
                {daysToIess === 0 ? '¡Vence hoy!' : `${daysToIess} días`}
              </p>
              <p className="text-[11px] text-muted-foreground">Límite: 15 de {currentMonthName}</p>
            </div>
          </div>

          <div className="group p-4 rounded-xl border bg-card shadow-xs flex items-center gap-3.5 transition-colors hover:bg-muted/30">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 shrink-0">
              <DollarSign className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Quincena</p>
              <p className="text-lg font-bold font-mono text-foreground leading-tight">
                {daysToQuincena === 0 ? '¡Hoy!' : `${daysToQuincena} días`}
              </p>
              <p className="text-[11px] text-muted-foreground">Anticipo acordado</p>
            </div>
          </div>

          <div className="group p-4 rounded-xl border bg-card shadow-xs flex items-center gap-3.5 transition-colors hover:bg-muted/30">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Cierre de nómina</p>
              <p className="text-lg font-bold font-mono text-foreground leading-tight">
                {daysToEndOfMonth === 0 ? '¡Hoy!' : `${daysToEndOfMonth} días`}
              </p>
              <p className="text-[11px] text-muted-foreground">Fin de {currentMonthName}</p>
            </div>
          </div>

          <div className="group p-4 rounded-xl border bg-card shadow-xs flex items-center gap-3.5 transition-colors hover:bg-muted/30">
            <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Empleados activos</p>
              <p className="text-lg font-bold font-mono text-foreground leading-tight">
                {employees.length}
              </p>
              <p className="text-[11px] text-muted-foreground">Total en nómina</p>
            </div>
          </div>
        </div>

        {/* FILA 2: NOVEDADES PENDIENTES DE APROBACIÓN + RESUMEN DE NÓMINA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* NOVEDADES PENDIENTES DE APROBACIÓN (7 columnas) */}
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
              <div className="flex items-center gap-2">
                {pendingRequests.length > 0 && (
                  <Badge variant="outline" className="text-[11px] font-mono border-orange-500/40 text-orange-600">
                    {pendingRequests.length} {pendingRequests.length === 1 ? 'pendiente' : 'pendientes'}
                  </Badge>
                )}
                <Link
                  href="/shifts/requests?status=pendiente"
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  Ver todo
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {pendingRequests.length > 0 ? (
              <div className="space-y-1">
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/40 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-7 w-7 ring-1 ring-border shrink-0">
                        <AvatarImage src={req.employee?.avatar_url ?? undefined} alt={req.employee?.full_name} />
                        <AvatarFallback className="text-[9px] font-semibold">
                          {getInitials(req.employee?.full_name || 'E')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-foreground truncate">
                          {req.employee?.full_name || 'Empleado'}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {requestTypeLabels[req.request_type] || 'Novedad'} • {req.title}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono text-[11px] text-muted-foreground ml-2">
                      {req.date ? new Date(`${req.date}T12:00:00`).toLocaleDateString('es-EC') : '—'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground italic">
                Sin novedades pendientes de aprobación.
              </div>
            )}
          </div>

          {/* RESUMEN DE NÓMINA DEL ÚLTIMO CORTE (5 columnas) */}
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
        </div>

        {/* FILA 3: VACACIONES PRÓXIMAS + PERÍODO DE PRUEBA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* VACACIONES PRÓXIMAS (6 columnas) */}
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
              <Badge variant="outline" className="text-[11px] font-mono">
                Próx. 30 días
              </Badge>
            </div>

            {upcomingVacations.length > 0 ? (
              <div className="space-y-1">
                {upcomingVacations.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/40 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-7 w-7 ring-1 ring-border shrink-0">
                        <AvatarImage src={req.employee?.avatar_url ?? undefined} alt={req.employee?.full_name} />
                        <AvatarFallback className="text-[9px] font-semibold">
                          {getInitials(req.employee?.full_name || 'E')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-foreground truncate">
                          {req.employee?.full_name || 'Empleado'}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {req.employee?.department || 'Sin departamento'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono text-[11px] text-muted-foreground ml-2">
                      {new Date(`${req.date}T12:00:00`).toLocaleDateString('es-EC')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground italic">
                Sin vacaciones aprobadas en los próximos 30 días.
              </div>
            )}
          </div>

          {/* PERÍODO DE PRUEBA (6 columnas) */}
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
              {probationEmployees.length > 0 && (
                <Badge variant="outline" className="text-[11px] font-mono">
                  {probationEmployees.length} {probationEmployees.length === 1 ? 'empleado' : 'empleados'}
                </Badge>
              )}
            </div>

            {probationEmployees.length > 0 ? (
              <div className="space-y-1">
                {probationEmployees.map((emp) => (
                  <Link
                    key={emp.id}
                    href={`/employees/${emp.id}`}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/40 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-7 w-7 ring-1 ring-border shrink-0">
                        <AvatarImage src={emp.avatar_url ?? undefined} alt={emp.full_name} />
                        <AvatarFallback className="text-[9px] font-semibold">
                          {getInitials(emp.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-foreground truncate">
                          {emp.full_name}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {emp.position || emp.department || 'Empleado'}
                        </span>
                      </div>
                    </div>

                    <div className={cn(
                      "text-right shrink-0 font-mono text-[11px] font-semibold ml-2",
                      emp.daysSinceHire >= 80 ? "text-rose-600" : "text-muted-foreground"
                    )}>
                      {emp.daysSinceHire} días
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground italic">
                Sin empleados en período de prueba actualmente.
              </div>
            )}
          </div>
        </div>

        {/* FILA 4: CUMPLEAÑOS + ANIVERSARIOS LABORALES + NOVEDADES RECIENTES */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* CUMPLEAÑOS DEL MES (4 Columnas) */}
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
              <Badge variant="outline" className="text-[11px] font-mono">
                {birthdayEmployees.length} {birthdayEmployees.length === 1 ? 'cumpleañero' : 'cumpleañeros'}
              </Badge>
            </div>

            {birthdayEmployees.length > 0 ? (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {birthdayEmployees.map((emp) => {
                  const day = parseInt(emp.birth_date?.split('-')[2] || '0', 10)
                  const isTodayBday = day === currentDay

                  return (
                    <div
                      key={emp.id}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-xl transition-colors text-xs",
                        isTodayBday
                          ? "bg-rose-500/10 font-semibold"
                          : "hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 ring-1 ring-border shrink-0">
                          <AvatarImage src={emp.avatar_url ?? undefined} alt={emp.full_name} />
                          <AvatarFallback className="text-[10px] font-semibold">
                            {getInitials(emp.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-foreground truncate max-w-[170px]">
                            {emp.full_name}
                          </span>
                          <span className="text-[11px] text-muted-foreground truncate max-w-[170px]">
                            {emp.position || emp.department || 'Empleado'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {isTodayBday ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                            <Sparkles className="h-3 w-3" />
                            ¡Hoy!
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground font-semibold">
                            {day} de {currentMonthName}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground italic">
                No hay empleados que cumplan años durante {currentMonthName}.
              </div>
            )}
          </div>

          {/* ANIVERSARIOS LABORALES DEL MES (4 Columnas) */}
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
              <Badge variant="outline" className="text-[11px] font-mono">
                {anniversaryEmployees.length}
              </Badge>
            </div>

            {anniversaryEmployees.length > 0 ? (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {anniversaryEmployees.map((emp) => {
                  const day = parseInt(emp.hire_date?.split('-')[2] || '0', 10)
                  const isTodayAnniv = day === currentDay

                  return (
                    <div
                      key={emp.id}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-xl transition-colors text-xs",
                        isTodayAnniv ? "bg-amber-500/10 font-semibold" : "hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-8 w-8 ring-1 ring-border shrink-0">
                          <AvatarImage src={emp.avatar_url ?? undefined} alt={emp.full_name} />
                          <AvatarFallback className="text-[10px] font-semibold">
                            {getInitials(emp.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-foreground truncate max-w-[130px]">
                            {emp.full_name}
                          </span>
                          <span className="text-[11px] text-muted-foreground truncate max-w-[130px]">
                            {emp.years} {emp.years === 1 ? 'año' : 'años'} en la empresa
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {isTodayAnniv ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                            <Sparkles className="h-3 w-3" />
                            ¡Hoy!
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground font-semibold">
                            {day} de {currentMonthName}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground italic">
                Sin aniversarios laborales durante {currentMonthName}.
              </div>
            )}
          </div>

          {/* NOVEDADES & INCIDENCIAS RECIENTES (4 Columnas) */}
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

            {recentIncidents.length > 0 ? (
              <div className="space-y-1">
                {recentIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/40 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-7 w-7 ring-1 ring-border shrink-0">
                        <AvatarImage src={inc.employee?.avatar_url ?? undefined} alt={inc.employee?.full_name} />
                        <AvatarFallback className="text-[9px] font-semibold">
                          {getInitials(inc.employee?.full_name || 'E')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-foreground truncate">
                          {inc.title}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {inc.employee?.full_name || 'Empleado'} • {inc.incident_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono text-[11px] text-muted-foreground ml-2">
                      {new Date(inc.created_at).toLocaleDateString('es-EC')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground italic">
                Sin novedades registradas recientemente.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
