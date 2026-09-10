import { Incident } from '@/types/employee'

interface GenericIncidentContentProps {
  incident: Incident
  formatLongDate: (dateStr: string) => string
}

export function GenericIncidentContent({
  incident,
  formatLongDate,
}: GenericIncidentContentProps) {
  return (
    <div className="space-y-4 pt-1">
      <div className="space-y-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Asunto / Título
        </span>
        <h4 className="text-sm font-bold text-foreground">
          {incident.title}
        </h4>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-muted-foreground text-[11px] block">Fecha del Suceso:</span>
          <span className="font-semibold text-foreground">
            {incident.start_date ? formatLongDate(incident.start_date) : '—'}
          </span>
        </div>

        {incident.end_date && (
          <div>
            <span className="text-muted-foreground text-[11px] block">Fecha de Término:</span>
            <span className="font-semibold text-foreground">
              {formatLongDate(incident.end_date)}
            </span>
          </div>
        )}

        {incident.amount != null && incident.amount > 0 && (
          <div>
            <span className="text-muted-foreground text-[11px] block">Monto Asociado:</span>
            <span className="font-bold font-mono text-foreground">
              ${Number(incident.amount).toFixed(2)}
            </span>
          </div>
        )}

        {/* Justificación / Descripción */}
        <div className="col-span-2 border-t pt-2 space-y-1">
          <span className="text-muted-foreground text-[11px] font-medium block">
            Motivo / Justificación declarada:
          </span>
          <p className="p-3 rounded-lg bg-muted/40 border text-foreground italic leading-relaxed text-xs">
            "{incident.description || 'Sin motivo descrito.'}"
          </p>
        </div>
      </div>
    </div>
  )
}
