import { Incident } from '@/types/employee'
import { AlertTriangle, Scale } from 'lucide-react'

interface NonCompliantDetailContentProps {
  incident: Incident
  formatLongDate: (dateStr: string) => string
  isCanceled: boolean
}

export function NonCompliantDetailContent({
  incident,
  formatLongDate,
  isCanceled,
}: NonCompliantDetailContentProps) {
  return (
    <div className="space-y-4 pt-1">
      <div className="space-y-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Observación de Desvío Operativo
        </span>
        <h4 className="text-sm font-bold text-foreground">
          {incident.metadata?.category_title || incident.title}
        </h4>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-muted-foreground text-[11px] block">Tipo de Incidencia:</span>
          <span className="font-bold text-amber-700 dark:text-amber-300">
            Actividad No Conforme
          </span>
        </div>

        <div>
          <span className="text-muted-foreground text-[11px] block">Fecha del Evento:</span>
          <span className="font-semibold text-foreground">
            {incident.start_date ? formatLongDate(incident.start_date) : '—'}
          </span>
        </div>

        {incident.metadata?.issue_date && (
          <div>
            <span className="text-muted-foreground text-[11px] block">Fecha de Registro:</span>
            <span className="font-medium text-foreground font-mono">
              {formatLongDate(incident.metadata.issue_date)}
            </span>
          </div>
        )}

        <div>
          <span className="text-muted-foreground text-[11px] block">Estado Disciplinario:</span>
          <span className="font-medium text-foreground">
            {isCanceled
              ? 'Sin efecto (Anulado)'
              : incident.metadata?.escalated_to_warning_id
              ? 'Escalado a Llamado Escrito'
              : 'Observación Preventiva Activa'}
          </span>
        </div>

        {/* Detalle de los Hechos */}
        <div className="col-span-2 border-t pt-2 space-y-1">
          <span className="text-muted-foreground text-[11px] font-semibold block">
            Descripción de los Hechos:
          </span>
          <p className="p-3 rounded-lg bg-muted/40 border text-foreground italic leading-relaxed text-xs">
            "{incident.description || 'Sin hechos descritos.'}"
          </p>
        </div>

        {/* Acción Correctiva */}
        {incident.metadata?.immediate_correction && (
          <div className="col-span-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 block">
              Acción Correctiva Inmediata / Instrucción:
            </span>
            <p className="text-[11px] text-muted-foreground italic">
              "{incident.metadata.immediate_correction}"
            </p>
          </div>
        )}

        {/* Base legal */}
        {incident.metadata?.legal_reference && (
          <div className="col-span-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
              <Scale className="h-3.5 w-3.5 shrink-0" />
              Fundamento Operativo y Legal
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {incident.metadata.legal_reference}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
