import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Award, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getEcuadorNow } from '@/lib/utils/ecuador-time'
import { getDashboardInsights } from '@/lib/dashboard/insights'
import { Organization } from '@/types/employee'

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export async function AnniversariesCard({ currentOrg }: { currentOrg: Organization }) {
  const insights = await getDashboardInsights(currentOrg.id)
  const anniversaryEmployees = insights.anniversaries

  const today = getEcuadorNow()
  const currentMonth = today.getMonth() + 1
  const currentDay = today.getDate()
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const currentMonthName = monthNames[currentMonth - 1]

  return (
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
  )
}
