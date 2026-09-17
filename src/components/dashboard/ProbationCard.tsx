import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { UserCheck } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { getDashboardInsights } from '@/lib/dashboard/insights'
import { Organization } from '@/types/employee'

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export async function ProbationCard({ currentOrg }: { currentOrg: Organization }) {
  const insights = await getDashboardInsights(currentOrg.id)
  const probationEmployees = insights.probation.map((emp) => ({
    ...emp,
    daysSinceHire: emp.days_since_hire,
  }))

  return (
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
  )
}
