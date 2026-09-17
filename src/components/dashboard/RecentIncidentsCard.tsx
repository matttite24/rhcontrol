import { createClient } from '@/lib/supabase/server'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Bell, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Organization, Incident } from '@/types/employee'

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export async function RecentIncidentsCard({ currentOrg }: { currentOrg: Organization }) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('incidents')
    .select('id, title, incident_type, created_at, employee:employees(full_name, avatar_url, department)')
    .eq('organization_id', currentOrg.id)
    .neq('incident_type', 'solicitud_vacaciones')
    .order('created_at', { ascending: false })
    .limit(5)

  const recentIncidents = (data || []) as unknown as (Pick<Incident, 'id' | 'title' | 'incident_type' | 'created_at'> & {
    employee?: { full_name: string; avatar_url: string | null; department: string | null }
  })[]

  return (
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
  )
}
