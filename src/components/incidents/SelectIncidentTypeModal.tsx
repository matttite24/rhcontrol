'use client'

import React from 'react'
import {
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { IncidentType } from '@/types/employee'
import { INCIDENT_TYPE_OPTIONS, IncidentTypeOption } from '@/lib/incidents/constants'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export { INCIDENT_TYPE_OPTIONS }
export type { IncidentTypeOption }

interface SelectIncidentTypeModalProps {
  onSelectType: (type: IncidentType) => void
}

// El <DialogContent> único vive en el launcher (NewIncidentButton), que
// decide si mostrar este selector o el wizard activo dentro de él — evita
// remontar el Portal/Overlay (y su animación) al cambiar de vista. Este
// componente solo aporta su contenido.
export function SelectIncidentTypeModal({
  onSelectType,
}: SelectIncidentTypeModalProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base font-semibold">
          Seleccionar Tipo de Incidencia
        </DialogTitle>
      </DialogHeader>

      <div className="grid grid-cols-1 gap-2.5 pt-2">
        {/* Vacaciones ya no vive en Incidencias (ver /incidents/page.tsx) —
            se crea desde Novedades (/shifts/requests), que es donde queda
            reflejada. Ofrecerla aquí llevaría a un resultado que nunca
            aparece en esta lista. */}
        {INCIDENT_TYPE_OPTIONS.filter((item) => item.type !== 'solicitud_vacaciones').map((item) => {
          const Icon = item.icon
          const isDisabled = item.disabled

          return (
            <button
              key={item.type}
              type="button"
              disabled={isDisabled}
              onClick={() => {
                if (isDisabled) return
                onSelectType(item.type)
              }}
              className={cn(
                "group flex items-center justify-between p-3.5 rounded-xl border transition-all text-left shadow-xs motion-reduce:transition-none",
                isDisabled
                  ? "bg-muted/20 border-border/40 opacity-45 cursor-not-allowed select-none"
                  : "bg-card/60 hover:bg-accent/40 hover:border-primary/40 active:scale-[0.98] cursor-pointer"
              )}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className={cn(
                    "p-2.5 rounded-lg border shrink-0 transition-transform",
                    isDisabled
                      ? "bg-muted text-muted-foreground/60 border-border/40 grayscale"
                      : cn(item.iconBg, "group-hover:scale-105")
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4
                      className={cn(
                        "text-sm font-semibold truncate",
                        isDisabled
                          ? "text-muted-foreground"
                          : "text-foreground group-hover:text-primary transition-colors"
                      )}
                    >
                      {item.title}
                    </h4>
                    {isDisabled && (
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-muted text-muted-foreground border border-border/50">
                        Próximamente
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground/80 line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </div>

              {!isDisabled && (
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              )}
            </button>
          )
        })}
      </div>
    </>
  )
}
