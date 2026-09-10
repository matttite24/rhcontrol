import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CalendarDays, Infinity as InfinityIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EcuadorComplianceNotice, getNoticeNextDueDate } from '@/lib/compliance/notices'

const authorityBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  IESS: 'default',
  MDT: 'secondary',
  SRI: 'secondary',
  Empresa: 'outline',
}

interface ComplianceCalendarSectionProps {
  notices: EcuadorComplianceNotice[]
}

/** Calendario de Obligaciones: avisos de cumplimiento ordenados por cercanía, con cuenta regresiva. */
export function ComplianceCalendarSection({ notices }: ComplianceCalendarSectionProps) {
  const orderedNotices = useMemo(() => {
    const withDueDate = notices.map((notice) => ({
      notice,
      due: getNoticeNextDueDate(notice),
    }))
    // Las que sí tienen fecha van primero, ordenadas por días restantes;
    // las de frecuencia "Permanente" (sin fecha fija) van al final.
    return withDueDate.sort((a, b) => {
      if (a.due && b.due) return a.due.daysRemaining - b.due.daysRemaining
      if (a.due) return -1
      if (b.due) return 1
      return 0
    })
  }, [notices])

  if (notices.length === 0) return null

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
          Calendario de Obligaciones
        </h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Ordenado por proximidad de vencimiento
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {orderedNotices.map(({ notice, due }) => {
          const isUrgent = due !== null && due.daysRemaining <= 7
          const isSoon = due !== null && due.daysRemaining > 7 && due.daysRemaining <= 15

          return (
            <Card
              key={notice.id}
              className="rounded-xl border-border/80 shadow-2xs transition-colors hover:bg-muted/30 py-0"
            >
              <CardContent className="flex items-stretch gap-4 p-4">
                {/* Bloque de cuenta regresiva destacado */}
                <div
                  className={cn(
                    'flex flex-col items-center justify-center shrink-0 w-16 py-1 rounded-lg border',
                    isUrgent
                      ? 'bg-destructive/10 border-destructive/30'
                      : isSoon
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-muted/50 border-border/50'
                  )}
                >
                  {due ? (
                    <>
                      <span
                        className={cn(
                          'text-2xl font-bold font-mono leading-none',
                          isUrgent
                            ? 'text-destructive'
                            : isSoon
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-foreground'
                        )}
                      >
                        {due.daysRemaining === 0 ? '¡Hoy!' : due.daysRemaining}
                      </span>
                      {due.daysRemaining !== 0 && (
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide mt-1">
                          {due.daysRemaining === 1 ? 'día' : 'días'}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <InfinityIcon className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide mt-1">
                        Continuo
                      </span>
                    </>
                  )}
                </div>

                <Separator orientation="vertical" />

                <div className="flex flex-col justify-center min-w-0 flex-1 gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant={authorityBadgeVariant[notice.authority] ?? 'outline'}
                      className="text-[10px] font-mono uppercase"
                    >
                      {notice.authority}
                    </Badge>
                    <Badge variant="ghost" className="text-[10px] font-medium text-muted-foreground">
                      {notice.frequency}
                    </Badge>
                  </div>

                  <CardTitle className="text-sm font-bold text-foreground leading-tight">
                    {notice.title}
                  </CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    {notice.description}
                  </CardDescription>
                  <p className="text-[11px] font-medium text-foreground/80 mt-0.5">
                    {notice.dueDescription}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
