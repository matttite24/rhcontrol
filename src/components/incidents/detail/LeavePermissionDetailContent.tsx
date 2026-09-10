import { Incident, LeaveIncidentMetadata } from '@/types/employee'
import { Palmtree, DollarSign, Clock, Users } from 'lucide-react'

interface LeavePermissionDetailContentProps {
  incident: Incident
  metadata: LeaveIncidentMetadata
  formatLongDate: (dateStr: string) => string
  isApproved: boolean
}

export function LeavePermissionDetailContent({
  incident,
  metadata,
  formatLongDate,
  isApproved,
}: LeavePermissionDetailContentProps) {
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

        {metadata.leave_unit === 'dias' ? (
          <div>
            <span className="text-muted-foreground text-[11px] block">Días Solicitados:</span>
            <span className="font-bold text-foreground font-mono">
              {metadata.requested_days || 1} día(s)
            </span>
          </div>
        ) : metadata.start_time || metadata.end_time ? (
          <div>
            <span className="text-muted-foreground text-[11px] block">Horario Autorizado:</span>
            <span className="font-mono text-foreground font-bold">
              {metadata.start_time || '—'} a {metadata.end_time || '—'} ({metadata.requested_hours || 0} hrs)
            </span>
          </div>
        ) : null}

        {/* Mecanismo de recuperación */}
        {metadata.recovery_method && (
          <div className="col-span-2 pt-1 border-t">
            <span className="text-muted-foreground text-[11px] block mb-1">
              Mecanismo de Recuperación / Compensación:
            </span>
            <div className="p-2.5 rounded-lg bg-muted/40 border flex items-center gap-2">
              {metadata.recovery_method === 'cargo_vacaciones' && (
                <>
                  <Palmtree className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">Cargo a Vacaciones</span>
                    <p className="text-[11px] text-muted-foreground">Se debita del saldo anual de días de descanso.</p>
                  </div>
                </>
              )}

              {metadata.recovery_method === 'descuento_dia' && (
                <>
                  <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold text-amber-700 dark:text-amber-400">Descuento en Rol de Pagos</span>
                    <p className="text-[11px] text-muted-foreground">
                      {isApproved
                        ? 'Deducción salarial generada en el módulo de Nómina/Deducciones.'
                        : 'Al aprobar se generará la deducción salarial correspondiente.'}
                    </p>
                  </div>
                </>
              )}

              {metadata.recovery_method === 'recuperacion_dias' && (
                <>
                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div>
                    <span className="font-bold text-blue-700 dark:text-blue-400">Recuperación de Jornada</span>
                    <p className="text-[11px] text-muted-foreground">
                      {metadata.recovery_schedules?.length || 0} turno(s) de reposición programados.
                    </p>
                  </div>
                </>
              )}

              {metadata.recovery_method === 'reemplazo_personal' && (
                <>
                  <Users className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  <div>
                    <span className="font-bold text-purple-700 dark:text-purple-400">Reemplazo Asignado</span>
                    <p className="text-[11px] text-muted-foreground">
                      Cubierto por: <strong>{metadata.replacement_employee_name || 'Compañero asignado'}</strong>
                    </p>
                  </div>
                </>
              )}
            </div>
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
