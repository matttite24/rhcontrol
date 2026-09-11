import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { ShiftCalendarView } from '@/components/shifts/ShiftCalendarView'
import { Employee, EmployeeSchedule, ShiftRequest, Holiday, EmployeeRotatingSchedule } from '@/types/employee'
import { AlertTriangle } from 'lucide-react'
import { NoActiveOrg } from '@/components/org/NoActiveOrg'

// Evitar que el client router cache sirva un snapshot desactualizado
// (p. ej. tras aprobar una solicitud de horas extras desde /shifts/requests)
export const dynamic = 'force-dynamic'

interface ShiftCalendarPageProps {
  searchParams: Promise<{
    q?: string
    department?: string
  }>
}

export default async function ShiftCalendarPage({ searchParams }: ShiftCalendarPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const currentOrg = await getCurrentOrganization()

  if (!currentOrg) {
    return (
      <NoActiveOrg action="ver sus turnos y asistencias" />
    )
  }

  // Ventana de fechas para solicitudes/feriados: 6 meses atrás / 1 año adelante
  // desde "hoy", en vez de traer el histórico completo de la organización en
  // cada navegación — el calendario solo puede mostrar fechas dentro de ese
  // margen, y una solicitud de vacaciones/cambio de horario largo cabe
  // holgadamente ahí.
  const today = new Date()
  const requestsRangeStart = new Date(today.getFullYear(), today.getMonth() - 6, 1)
  const requestsRangeEnd = new Date(today.getFullYear() + 1, today.getMonth(), 0)
  const toIsoDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const requestsSelect = `
    *,
    employee:employees (
      id,
      full_name,
      national_id,
      department,
      position,
      avatar_url
    )
  `

  // Consulta de empleados con sus horarios de trabajo
  let empQuery = supabase
    .from('employees')
    .select(`
      *,
      schedules:employee_schedules (*)
    `)
    .eq('organization_id', currentOrg.id)
    .order('full_name')

  if (params.department) {
    empQuery = empQuery.eq('department', params.department)
  }

  // Las 5 consultas de esta página no dependen entre sí, así que se lanzan
  // TODAS juntas en vez de en serie (departments → employees → requests →
  // holidays, como antes). Con Supabase/Postgres corriendo lejos del server,
  // cada round-trip de red suma cientos de ms; encadenarlas en serie es lo
  // que hacía sentir "colgado" el calendario aun con pocos empleados.
  const [
    { data: deptData, error: deptError },
    { data: employeesData, error: employeesError },
    { data: datedData, error: requestsError },
    { data: vacationData, error: vacationError },
    { data: holidaysData, error: holidaysError },
    { data: rotatingSchedulesData, error: rotatingSchedulesError },
  ] = await Promise.all([
    // Departamentos disponibles (deduplicados y sin vacíos por seguridad)
    supabase
      .from('departments')
      .select('name')
      .eq('organization_id', currentOrg.id)
      .order('name'),
    empQuery,
    // Solicitudes con fecha exacta (horas extras, permisos, cambios de horario):
    // acotadas a la ventana visible/navegable por su columna `date`.
    supabase
      .from('shift_requests')
      .select(requestsSelect)
      .eq('organization_id', currentOrg.id)
      .neq('request_type', 'solicitud_vacaciones')
      .gte('date', toIsoDate(requestsRangeStart))
      .lte('date', toIsoDate(requestsRangeEnd)),
    // Vacaciones: su columna `date` solo guarda el día de inicio, pero el rango
    // (metadata.start_date..end_date) puede empezar antes de la ventana y
    // extenderse dentro de ella. Se filtra por SOLAPAMIENTO de rango, no por el
    // día de inicio, para que un período que ya empezó siga marcándose.
    supabase
      .from('shift_requests')
      .select(requestsSelect)
      .eq('organization_id', currentOrg.id)
      .eq('request_type', 'solicitud_vacaciones')
      .lte('metadata->>start_date', toIsoDate(requestsRangeEnd))
      .gte('metadata->>end_date', toIsoDate(requestsRangeStart)),
    // Feriados registrados, acotados a la misma ventana: el calendario solo
    // puede mostrar feriados dentro de las fechas visibles/navegables, no
    // todo el histórico de feriados de la organización desde su creación.
    supabase
      .from('holidays')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .gte('date', toIsoDate(requestsRangeStart))
      .lte('date', toIsoDate(requestsRangeEnd))
      .order('date', { ascending: true }),
    // Horarios rotativos asignados (ver rotating-pattern.ts): se necesita el
    // patrón completo (cycle_length + days_off) para calcular libre/laborable
    // por fecha en el cliente, no solo la asignación.
    supabase
      .from('employee_rotating_schedules')
      .select('*, pattern:rotating_shift_patterns(*)')
      .eq('organization_id', currentOrg.id),
  ])

  const departments = Array.from(
    new Set((deptData || []).map((d) => d.name).filter(Boolean))
  )

  const shiftRequests = [
    ...((datedData as ShiftRequest[]) || []),
    ...((vacationData as ShiftRequest[]) || []),
  ]

  const holidays = (holidaysData as Holiday[]) || []

  // Si alguna consulta falló, no debe verse igual que "organización sin datos":
  // un fallo de red/RLS silencioso podría hacer creer al admin que no hay
  // empleados registrados cuando en realidad la consulta nunca respondió.
  const hasLoadError = Boolean(
    deptError || employeesError || requestsError || vacationError || holidaysError || rotatingSchedulesError
  )

  const rotatingSchedules = (rotatingSchedulesData as EmployeeRotatingSchedule[]) || []

  const filteredEmployees = ((employeesData as (Employee & { schedules: EmployeeSchedule[] })[]) || []).filter((emp) => {
    if (!params.q) return true
    const term = params.q.toLowerCase()
    return (
      emp.full_name?.toLowerCase().includes(term) ||
      emp.national_id?.toLowerCase().includes(term) ||
      emp.position?.toLowerCase().includes(term)
    )
  })

  return (
    <div className="flex flex-col flex-1 min-h-screen min-w-0 w-full overflow-x-hidden">
      {/* Sin PageHeader: el título/contador y el botón de crear se movieron
          a la barra de controles del calendario, para recuperar altura
          vertical de la tabla — la que más se beneficia de espacio aquí. */}
      {hasLoadError && (
        <div className="mx-6 mt-4 flex items-center gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p>
            Ocurrió un error al cargar parte de la información del calendario (empleados, solicitudes,
            feriados o departamentos). Los datos mostrados pueden estar incompletos — intenta recargar la página.
          </p>
        </div>
      )}

      {/* Vista de Calendario a Ancho Completo con iconos de horas extras */}
      <div className="flex-1 w-full min-w-0">
        <ShiftCalendarView
          employees={filteredEmployees}
          requests={shiftRequests}
          departments={departments}
          currentDepartment={params.department}
          holidays={holidays}
          rotatingSchedules={rotatingSchedules}
          organizationId={currentOrg.id}
          organizationName={currentOrg.name}
        />
      </div>
    </div>
  )
}
