'use client'

import React from 'react'
import {
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

      <div className="grid grid-cols-1 gap-2.5 pt-2">
        {SHIFT_REQUEST_TYPE_OPTIONS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => onSelectType(item.type)}
              className={cn(
                "group flex items-center justify-between p-3.5 rounded-xl border bg-card/60 hover:bg-accent/40 hover:border-primary/40 active:scale-[0.98] transition-all text-left cursor-pointer shadow-xs motion-reduce:transition-none"
              )}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className={cn(
                    "p-2.5 rounded-lg border shrink-0 transition-transform group-hover:scale-105",
                    item.iconBg
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {item.title}
                  </h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </div>

              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </button>
          )
        })}
      </div>
    </>
  )
}
