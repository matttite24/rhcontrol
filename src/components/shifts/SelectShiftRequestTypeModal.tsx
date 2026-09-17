'use client'

import React from 'react'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ShiftRequestType } from '@/types/employee'
import { SHIFT_REQUEST_TYPE_OPTIONS } from '@/lib/shifts/constants'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectShiftRequestTypeModalProps {
  onSelectType: (type: ShiftRequestType) => void
}

// El <DialogContent> único vive en el launcher (NewShiftRequestButton), que
// decide si mostrar este selector o el wizard activo dentro de él — evita
// remontar el Portal/Overlay (y su animación) al cambiar de vista. Este
// componente solo aporta su contenido.
//
// Grid de cards (a diferencia de la lista vertical de Incidencias en
// SelectIncidentTypeModal) — la forma distinta es intencional, para que de
// un vistazo se note en qué selector está el usuario.
export function SelectShiftRequestTypeModal({
  onSelectType,
}: SelectShiftRequestTypeModalProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base font-semibold">
          Nueva Novedad
        </DialogTitle>
      </DialogHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        {SHIFT_REQUEST_TYPE_OPTIONS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => onSelectType(item.type)}
              className="group flex items-start gap-3.5 p-4 rounded-xl border bg-card/60 hover:bg-accent/50 hover:border-primary/40 active:scale-[0.97] active:duration-75 transition-[transform,background-color,border-color] duration-150 ease-out cursor-pointer motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <div
                className={cn(
                  "p-2.5 rounded-lg border shrink-0 transition-transform duration-150 group-hover:scale-105 group-active:scale-95",
                  item.iconBg
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 text-left space-y-1 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground leading-snug tracking-tight">
                    {item.title}
                  </h4>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 motion-reduce:transition-none" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}
