'use client'

import { useState } from 'react'
import { Incident } from '@/types/employee'
import { Scale, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'

interface DeliveryActDetailContentProps {
  incident: Incident
  formatLongDate: (dateStr: string) => string
}

export function DeliveryActDetailContent({
  incident,
  formatLongDate,
}: DeliveryActDetailContentProps) {
  const [isClauseExpanded, setIsClauseExpanded] = useState(false)

  return (
    <div className="space-y-4">
      {/* Tarjetas métricas de activos entregados */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 shadow-2xs">
          <span className="text-muted-foreground text-[11px] font-medium block mb-0.5">
            Valor Total de Bienes Asignados
          </span>
          <div className="text-2xl font-black font-mono text-foreground tracking-tight">
            ${(incident.amount || incident.metadata?.total_amount || 0).toFixed(2)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/20 shadow-2xs">
          <span className="text-indigo-700/80 dark:text-indigo-400/80 text-[11px] font-medium block mb-0.5">
            Total de Implementos / Prendas
          </span>
          <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 tracking-tight">
            {incident.metadata?.total_items_count || incident.metadata?.items?.length || 0} unidades
          </div>
        </div>
      </div>

      {/* Datos de entrega */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-muted-foreground text-[11px] block font-medium">Fecha de Entrega:</span>
          <span className="font-semibold text-foreground mt-0.5 block">
            {incident.start_date ? formatLongDate(incident.start_date) : '—'}
          </span>
        </div>

        <div>
          <span className="text-muted-foreground text-[11px] block font-medium">Responsable de Entrega:</span>
          <span className="font-semibold text-foreground mt-0.5 block">
            {incident.metadata?.delivered_by_name || 'Talento Humano / Bodega'}
          </span>
        </div>

        {incident.description && (
          <div className="col-span-2 pt-1 space-y-1">
            <span className="text-muted-foreground text-[11px] font-medium block">
              Observaciones / Justificación de la Dotación:
            </span>
            <p className="text-xs text-foreground italic bg-muted/30 p-3 rounded-lg border border-border/60 leading-relaxed">
              "{incident.description}"
            </p>
          </div>
        )}
      </div>

      {/* Detalle de ítems entregados */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-foreground block">
          Inventario de Bienes Entregados en Custodia:
        </span>
        <div className="border rounded-xl overflow-hidden bg-card text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/60 text-[11px] font-semibold text-muted-foreground border-b">
                <th className="py-2 px-3">Descripción / Ítem</th>
                <th className="py-2 px-2.5 text-center">Estado</th>
                <th className="py-2 px-2.5 text-center">Cant.</th>
                <th className="py-2 px-3 text-right">V. Unit</th>
                <th className="py-2 px-3 text-right">V. Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {(incident.metadata?.items || []).map((it: any, idx: number) => (
                <tr key={it.id || idx} className="hover:bg-muted/20">
                  <td className="py-2.5 px-3">
                    <span className="font-semibold text-foreground block">{it.description}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {it.category} {it.serialOrCode ? `• Serie: ${it.serialOrCode}` : ''}
                    </span>
                  </td>
                  <td className="py-2.5 px-2.5 text-center capitalize text-muted-foreground">
                    {it.condition || 'bueno'}
                  </td>
                  <td className="py-2.5 px-2.5 text-center font-mono font-semibold text-foreground">
                    {it.quantity || 1}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                    ${Number(it.unitValue || 0).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                    ${Number(it.totalValue || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cláusula de descuento expandible */}
      <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-xs space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Scale className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="font-semibold text-foreground text-xs truncate">
              Autorización de Descuento por Pérdida o Daño (Art. 44 lit. f Código del Trabajo)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsClauseExpanded((prev) => !prev)}
            className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium flex items-center gap-1 shrink-0 px-2 py-0.5 rounded hover:bg-indigo-500/10 cursor-pointer transition-colors"
          >
            <span>{isClauseExpanded ? 'Ocultar' : 'Ver cláusula'}</span>
            {isClauseExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>

        {isClauseExpanded && (
          <div className="pt-2 border-t border-indigo-500/20 text-[11px] text-muted-foreground leading-relaxed text-justify bg-background/50 p-2.5 rounded-lg">
            {incident.metadata?.discount_disclaimer_text ||
              'El empleado asume la custodia diligente de los bienes entregados y autoriza el descuento de su remuneración o liquidación de haberes en caso de pérdida, sustracción culposa o daño imputable a negligencia.'}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] pt-0.5">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Cláusula autorizada e impresa en el documento para firma del empleado.
        </div>
      </div>
    </div>
  )
}
