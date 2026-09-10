import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { SubHeader } from '@/components/layout/SubHeader'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { NewIncidentButton } from '@/components/incidents/NewIncidentButton'
import { IncidentsTableClient } from '@/components/incidents/IncidentsTableClient'
import { INCIDENT_TYPE_OPTIONS } from '@/lib/incidents/constants'
import { Incident, IncidentStatus } from '@/types/employee'
import Link from 'next/link'
import { Search, FileText, Calendar, Filter, X } from 'lucide-react'
import { NoActiveOrg } from '@/components/org/NoActiveOrg'
import { cn } from '@/lib/utils'

interface IncidentsPageProps {
  searchParams: Promise<{
    q?: string
    type?: string
    status?: string
    date_from?: string
    date_to?: string
  }>
}

const statusConfig: Record<IncidentStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  registrado: { label: 'Registrado', variant: 'default' },
  aprobado:   { label: 'Aprobado',   variant: 'secondary' },
  pendiente:  { label: 'Pendiente',  variant: 'outline' },
  rechazado:  { label: 'Rechazado',  variant: 'destructive' },
  anulado:    { label: 'Anulado',    variant: 'destructive' },
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export default async function IncidentsPage({ searchParams }: IncidentsPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const currentOrg = await getCurrentOrganization()

  if (!currentOrg) {
    return (
      <NoActiveOrg action="ver sus incidencias" />
    )
  }

  // Consulta de incidencias con información del empleado
  let query = supabase
    .from('incidents')
    .select(`
      *,
      employee:employees (
        id,
        full_name,
        national_id,
        department,
        position,
        avatar_url
      )
    `)
    .eq('organization_id', currentOrg.id)
    .neq('incident_type', 'permiso_laboral')
    .order('created_at', { ascending: false })

  if (params.type) {
    query = query.or(`incident_type.eq.${params.type},metadata->>sub_type.eq.${params.type}`)
  }
  if (params.status) {
    query = query.eq('status', params.status)
  }
  if (params.date_from) {
    query = query.gte('start_date', params.date_from)
  }
  if (params.date_to) {
    query = query.lte('start_date', params.date_to)
  }

  const { data: incidents, error } = await query

  // Obtener empleados de la organización para el asistente modal
  const { data: employeesData } = await supabase
    .from('employees')
    .select('*')
    .eq('organization_id', currentOrg.id)
    .order('full_name')

  const employees = employeesData || []

  // Filtrado en memoria si hay parámetro q (por título o nombre de empleado)
  const filteredIncidents = (incidents as Incident[] || []).filter((inc) => {
    if (!params.q) return true
    const term = params.q.toLowerCase()
    const matchTitle = inc.title?.toLowerCase().includes(term)
    const matchEmp = inc.employee?.full_name?.toLowerCase().includes(term)
    const matchId = inc.employee?.national_id?.toLowerCase().includes(term)
    return matchTitle || matchEmp || matchId
  })

  const hasFilters = Boolean(
    params.q || params.type || params.status || params.date_from || params.date_to
  )

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      {/* Header con botón para Nueva Incidencia (Abre modal) */}
      <PageHeader
        title="Incidencias"
        description="Registros, solicitudes y documentación del personal"
        breadcrumbs={[
          { label: 'Incidencias' },
        ]}
        showExport
        action={
          <NewIncidentButton
            organizationId={currentOrg.id}
            organizationName={currentOrg.name}
            employees={employees}
          />
        }
      />

      {/* Subbarra de Filtros a Ancho Completo */}
      <SubHeader
        search={{
          name: 'q',
          defaultValue: params.q,
          placeholder: 'Buscar por empleado o motivo...',
        }}
        selects={[
          {
            name: 'type',
            defaultValue: params.type ?? '',
            placeholder: 'Todos los tipos',
            options: INCIDENT_TYPE_OPTIONS.map((t) => ({ value: t.type, label: t.title })),
          },
          {
            name: 'status',
            defaultValue: params.status ?? '',
            placeholder: 'Todos los estados',
            options: [
              { value: 'registrado', label: 'Registrado' },
              { value: 'aprobado', label: 'Aprobado' },
              { value: 'pendiente', label: 'Pendiente' },
              { value: 'rechazado', label: 'Rechazado' },
              { value: 'anulado', label: 'Anulado' },
            ],
          },
        ]}
        dateRange={{
          defaultFrom: params.date_from,
          defaultTo: params.date_to,
          placeholder: 'Rango de fecha del evento',
        }}
        hasFilters={hasFilters}
        clearHref="/incidents"
        counter={`${filteredIncidents.length} ${filteredIncidents.length === 1 ? 'registro' : 'registros'}`}
      />

      {/* Tabla a Ancho Completo */}
      <div className="flex-1 w-full overflow-x-auto bg-card">
        {filteredIncidents.length > 0 ? (
          <IncidentsTableClient incidents={filteredIncidents} organization={currentOrg} />
        ) : (
          <div className="p-16 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <FileText className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-base">No hay incidencias registradas</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Registra actividades no conformes, llamados de atención, vacaciones, anticipos o permisos para documentar los eventos de tu equipo.
              </p>
            </div>
            <div className="pt-2">
              <NewIncidentButton
                organizationId={currentOrg.id}
                organizationName={currentOrg.name}
                employees={employees}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
