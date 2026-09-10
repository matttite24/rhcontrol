import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { NewShiftRequestButton } from '@/components/shifts/NewShiftRequestButton'
import { ShiftCalendarView } from '@/components/shifts/ShiftCalendarView'
import { Employee, EmployeeSchedule, ShiftRequest, Holiday } from '@/types/employee'
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

  // Obtener departamentos disponibles (deduplicados y sin vacíos por seguridad)
  const { data: deptData, error: deptError } = await supabase
    .from('departments')
    .select('name')
    .eq('organization_id', currentOrg.id)
    .order('name')

  const departments = Array.from(
    new Set((deptData || []).map((d) => d.name).filter(Boolean))
  )

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

  const { data: employeesData, error: employeesError } = await empQuery

  // Consulta de solicitudes de horas extras y turnos para mostrar en el calendario.
  // Se acota a una ventana razonable (6 meses atrás / 1 año adelante) en vez de
  // traer el histórico completo de la organización en cada navegación: el
  // calendario solo necesita fechas dentro de ese margen alrededor de "hoy",
  // y una solicitud de vacaciones/cambio de horario largo cabe holgadamente ahí.
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

  // Solicitudes con fecha exacta (horas extras, permisos, cambios de horario):
  // acotadas a la ventana visible/navegable por su columna `date`.
  const datedRequestsPromise = supabase
    .from('shift_requests')
    .select(requestsSelect)
    .eq('organization_id', currentOrg.id)
    .neq('request_type', 'solicitud_vacaciones')
    .gte('date', toIsoDate(requestsRangeStart))
    .lte('date', toIsoDate(requestsRangeEnd))

  // Vacaciones: su columna `date` solo guarda el día de inicio, pero el rango
  // (metadata.start_date..end_date) puede empezar antes de la ventana y
  // extenderse dentro de ella. Se filtra por SOLAPAMIENTO de rango, no por el
  // día de inicio, para que un período que ya empezó siga marcándose.
  const vacationRequestsPromise = supabase
    .from('shift_requests')
    .select(requestsSelect)
    .eq('organization_id', currentOrg.id)
    .eq('request_type', 'solicitud_vacaciones')
    .lte('metadata->>start_date', toIsoDate(requestsRangeEnd))
    .gte('metadata->>end_date', toIsoDate(requestsRangeStart))

  const [{ data: datedData, error: requestsError }, { data: vacationData, error: vacationError }] =
    await Promise.all([datedRequestsPromise, vacationRequestsPromise])

  const shiftRequests = [
    ...((datedData as ShiftRequest[]) || []),
    ...((vacationData as ShiftRequest[]) || []),
  ]

  // Consulta de feriados registrados para marcarlos en el calendario.
  // Acotada a la misma ventana que shift_requests: el calendario solo puede
  // mostrar feriados dentro de las fechas visibles/navegables, no todo el
  // histórico de feriados de la organización desde su creación.
  const { data: holidaysData, error: holidaysError } = await supabase
    .from('holidays')
    .select('*')
    .eq('organization_id', currentOrg.id)
    .gte('date', toIsoDate(requestsRangeStart))
    .lte('date', toIsoDate(requestsRangeEnd))
    .order('date', { ascending: true })

  const holidays = (holidaysData as Holiday[]) || []

  // Si alguna consulta falló, no debe verse igual que "organización sin datos":
  // un fallo de red/RLS silencioso podría hacer creer al admin que no hay
  // empleados registrados cuando en realidad la consulta nunca respondió.
  const hasLoadError = Boolean(
    deptError || employeesError || requestsError || vacationError || holidaysError
  )

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
      {/* Header oficial con botón de Nueva Solicitud */}
      <PageHeader
        title="Calendario de Turnos"
        description={`${filteredEmployees.length} ${filteredEmployees.length === 1 ? 'empleado' : 'empleados'}`}
        action={
          <NewShiftRequestButton
            organizationId={currentOrg.id}
            organizationName={currentOrg.name}
            employees={filteredEmployees}
          />
        }
      />

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
        />
      </div>
    </div>
  )
}
