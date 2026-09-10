import { Incident } from '@/types/employee'
import { Palmtree } from 'lucide-react'

interface VacationDetailContentProps {
  incident: Incident
  formatLongDate: (dateStr: string) => string
}

export function VacationDetailContent({
  incident,
  formatLongDate,
}: VacationDetailContentProps) {
  const metadata = incident.metadata || {}

  return (
    <div className="space-y-4 pt-1">
      <div className="space-y-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
          <Palmtree className="h-3.5 w-3.5 shrink-0" />
          Período de Descanso Anual
        </span>
        <h4 className="text-sm font-bold text-foreground">
          {incident.title}
        </h4>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-muted-foreground text-[11px] block">Fecha de Inicio:</span>
          <span className="font-semibold text-foreground">
            {incident.start_date ? formatLongDate(incident.start_date) : '—'}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground text-[11px] block">Fecha de Finalización:</span>
          <span className="font-semibold text-foreground">
            {incident.end_date ? formatLongDate(incident.end_date) : '—'}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground text-[11px] block">Días Solicitados:</span>
          <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {metadata.requested_days || metadata.days_count || 1} días calendario
          </span>
        </div>
        {metadata.settlement_period && (
          <div>
            <span className="text-muted-foreground text-[11px] block">Período a Liquidar:</span>
            <span className="font-medium text-foreground font-mono">
              {metadata.settlement_period}
            </span>
          </div>
        )}
        {incident.description && (
          <div className="col-span-2 border-t pt-2 space-y-1">
            <span className="text-muted-foreground text-[11px] font-medium block">
              Observaciones / Justificación:
            </span>
            <p className="p-3 rounded-lg bg-muted/40 border text-foreground italic leading-relaxed">
              "{incident.description}"
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
