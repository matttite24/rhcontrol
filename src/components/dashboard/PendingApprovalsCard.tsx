import { createClient } from '@/lib/supabase/server'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ClipboardCheck, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Organization, ShiftRequest } from '@/types/employee'

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

const requestTypeLabels: Record<string, string> = {
  horas_extras: 'Horas extras',
  cambio_horario: 'Cambio de turno',
  permiso_laboral: 'Permiso laboral',
  solicitud_vacaciones: 'Vacaciones',
  otro: 'Novedad',
}

export async function PendingApprovalsCard({ currentOrg }: { currentOrg: Organization }) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shift_requests')
    .select('id, request_type, title, date, hours, created_at, employee:employees(full_name, avatar_url, department)')
    .eq('organization_id', currentOrg.id)
    .eq('status', 'pendiente')
    .order('created_at', { ascending: false })
    .limit(6)

  const pendingRequests = (data || []) as unknown as (Pick<ShiftRequest, 'id' | 'request_type' | 'title' | 'date' | 'hours' | 'created_at'> & {
    employee?: { full_name: string; avatar_url: string | null; department: string | null }
  })[]

  return (
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
  )
}
