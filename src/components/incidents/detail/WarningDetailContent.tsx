import { Incident } from '@/types/employee'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WarningDetailContentProps {
  incident: Incident
  formatLongDate: (dateStr: string) => string
  isCanceled: boolean
}

export function WarningDetailContent({
  incident,
  formatLongDate,
  isCanceled,
}: WarningDetailContentProps) {
  return (
    <div className="space-y-4 pt-1">
      <div className="space-y-0.5 min-w-0">
        <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Infracción Disciplinaria Registrada
        </span>
        <h4 className="text-sm font-bold text-foreground truncate">
          {incident.metadata?.infraction_title || incident.title}
        </h4>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-muted-foreground text-[11px] block">Tipo de Medida / Sanción:</span>
          <span className="inline-flex items-center gap-1.5 font-bold text-foreground">
            <Badge
              variant="outline"
              className={cn(
                'text-[11px] font-bold capitalize',
                incident.metadata?.severity === 'escrito'
                  ? 'border-rose-300 text-rose-700 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                  : 'border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
              )}
            >
              {incident.metadata?.severity === 'escrito' ? 'Amonestación Escrita' : 'Amonestación Verbal'}
            </Badge>
          </span>
        </div>

        <div>
          <span className="text-muted-foreground text-[11px] block">Fecha del Suceso / Falta:</span>
          <span className="font-semibold text-foreground">
            {incident.start_date ? formatLongDate(incident.start_date) : '—'}
          </span>
        </div>

        {incident.metadata?.issue_date && (
          <div>
            <span className="text-muted-foreground text-[11px] block">Fecha de Emisión Formal:</span>
            <span className="font-semibold text-foreground font-mono">
              {formatLongDate(incident.metadata.issue_date)}
            </span>
          </div>
        )}

        <div>
          <span className="text-muted-foreground text-[11px] block">Efecto Disciplinario:</span>
          <span className="font-medium text-foreground">
            {isCanceled
              ? 'Sin efecto (Registro Anulado)'
              : incident.metadata?.severity === 'escrito'
              ? 'Copia a Expediente Laboral'
              : 'Constancia Preventiva'}
          </span>
        </div>

        {/* Detalle de los Hechos e Inobservancia */}
        <div className="col-span-2 border-t pt-2 space-y-1">
          <span className="text-muted-foreground text-[11px] font-semibold block">
            Detalle de los Hechos e Inobservancia:
          </span>
          <p className="p-3 rounded-lg bg-muted/40 border text-foreground italic leading-relaxed text-xs">
            "{incident.description || 'Sin hechos descritos.'}"
          </p>
        </div>

        {/* Causal legal y reglamento */}
        {incident.metadata?.regulation_article && (
          <div className="col-span-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400">
              <Scale className="h-3.5 w-3.5 shrink-0" />
              Causal del Reglamento Interno y Código del Trabajo
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {incident.metadata.regulation_article}
            </p>
          </div>
        )}

        {/* Compromiso correctivo si existe */}
        {incident.metadata?.corrective_commitment && (
          <div className="col-span-2 p-3 rounded-lg bg-muted/40 border text-xs space-y-1">
            <span className="text-[11px] font-bold text-foreground block">
              Compromiso de Corrección Asumido:
            </span>
            <p className="text-[11px] text-muted-foreground italic">
              "{incident.metadata.corrective_commitment}"
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
