import { Badge } from '@/components/ui/badge'
import { Cake } from 'lucide-react'
import { getEcuadorNow } from '@/lib/utils/ecuador-time'
import { getDashboardInsights } from '@/lib/dashboard/insights'
import { BirthdayActionItem } from './BirthdayActionItem'
import { Organization } from '@/types/employee'

export async function BirthdaysCard({ currentOrg }: { currentOrg: Organization }) {
  const insights = await getDashboardInsights(currentOrg.id)
  const birthdayEmployees = insights.birthdays

  const today = getEcuadorNow()
  const currentMonth = today.getMonth() + 1
  const currentDay = today.getDate()
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const currentMonthName = monthNames[currentMonth - 1]

  return (
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
              <BirthdayActionItem
                key={emp.id}
                employee={emp}
                isTodayBday={isTodayBday}
                day={day}
                currentMonthName={currentMonthName}
                orgName={currentOrg.name}
                logoUrl={currentOrg.logo_url}
              />
            )
          })}
        </div>
      ) : (
        <div className="p-8 text-center text-xs text-muted-foreground italic">
          No hay empleados que cumplan años durante {currentMonthName}.
        </div>
      )}
    </div>
  )
}
