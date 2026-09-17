import { createClient } from '@/lib/supabase/server'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Plane } from 'lucide-react'
import { getEcuadorNow, getEcuadorTodayIso } from '@/lib/utils/ecuador-time'
import { Organization, ShiftRequest } from '@/types/employee'

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export async function UpcomingVacationsCard({ currentOrg }: { currentOrg: Organization }) {
  const supabase = await createClient()
  const todayIso = getEcuadorTodayIso()
  const in30DaysIso = new Date(getEcuadorNow().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data } = await supabase
    .from('shift_requests')
    .select('id, date, employee:employees(full_name, avatar_url, department)')
    .eq('organization_id', currentOrg.id)
    .eq('request_type', 'solicitud_vacaciones')
    .eq('status', 'aprobado')
    .gte('date', todayIso)
    .lte('date', in30DaysIso)
    .order('date', { ascending: true })
    .limit(6)

  const upcomingVacations = (data || []) as unknown as (Pick<ShiftRequest, 'id' | 'date'> & {
    employee?: { full_name: string; avatar_url: string | null; department: string | null }
  })[]

  return (
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
  )
}
