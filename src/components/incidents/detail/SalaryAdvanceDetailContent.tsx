import { Incident } from '@/types/employee'
import { Badge } from '@/components/ui/badge'

interface SalaryAdvanceDetailContentProps {
  incident: Incident
  formatLongDate: (dateStr: string) => string
  isApproved: boolean
  isRejected: boolean
  isCanceled: boolean
}

export function SalaryAdvanceDetailContent({
  incident,
  formatLongDate,
  isApproved,
  isRejected,
  isCanceled,
}: SalaryAdvanceDetailContentProps) {
  return (
    <div className="space-y-4">
      {/* Tarjetas métricas de montos */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 shadow-2xs">
          <span className="text-muted-foreground text-[11px] font-medium block mb-0.5">
            Monto Total Solicitado
          </span>
          <div className="text-2xl font-black font-mono text-foreground tracking-tight">
            ${(incident.amount || incident.metadata?.total_amount || 0).toFixed(2)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 shadow-2xs">
          <span className="text-emerald-700/80 dark:text-emerald-400/80 text-[11px] font-medium block mb-0.5">
            {incident.metadata?.modality === 'mes_actual' ? 'Descuento Único' : 'Valor por Cuota'}
          </span>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
            ${(incident.metadata?.installment_amount || (incident.amount || 0)).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Datos informativos */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-muted-foreground text-[11px] block font-medium">Fecha de Solicitud:</span>
          <span className="font-semibold text-foreground mt-0.5 block">
            {incident.start_date ? formatLongDate(incident.start_date) : '—'}
          </span>
        </div>

        <div>
          <span className="text-muted-foreground text-[11px] block font-medium">Período de Descuento:</span>
          <span className="font-semibold text-foreground font-mono mt-0.5 block">
            {incident.metadata?.start_month
              ? `${incident.metadata.start_month.toString().padStart(2, '0')}/${incident.metadata.start_year}`
              : '—'}
          </span>
        </div>

        {/* Motivo declarado si existe */}
        {incident.description && (
          <div className="col-span-2 pt-1 space-y-1">
            <span className="text-muted-foreground text-[11px] font-medium block">
              Motivo / Destino declarado:
            </span>
            <p className="text-xs text-foreground italic bg-muted/30 p-3 rounded-lg border border-border/60 leading-relaxed">
              "{incident.description}"
            </p>
          </div>
        )}
      </div>

      {/* Tabla de Cronograma de Cuotas */}
      {incident.metadata?.schedule && incident.metadata.schedule.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              Cronograma de Deducción Mensual:
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              {incident.metadata.installments_count || incident.metadata.schedule.length} cuotas programadas
            </span>
          </div>

          <div className="border rounded-xl overflow-hidden bg-card text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/60 text-[11px] font-semibold text-muted-foreground border-b">
                  <th className="py-2 px-3.5">Cuota</th>
                  <th className="py-2 px-3.5">Mes / Rol de Pago</th>
                  <th className="py-2 px-3.5 text-right">Valor</th>
                  <th className="py-2 px-3.5 text-center">Estado Nómina</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {incident.metadata.schedule.map((item: any) => {
                  const monthNames = [
                    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
                  ]
                  const mName = monthNames[item.month - 1] || `Mes ${item.month}`
                  return (
                    <tr key={item.installment_number} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3.5 font-bold text-foreground font-mono text-xs">
                        #{item.installment_number}
                      </td>
                      <td className="py-2.5 px-3.5 text-foreground font-medium">
                        {mName} {item.year}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ${item.amount?.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        {isApproved ? (
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 font-medium">
                            Generado en Rol
                          </Badge>
                        ) : isRejected || isCanceled ? (
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 font-medium">
                            No Aplicado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 font-medium">
                            Pendiente Aprobación
                          </Badge>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
