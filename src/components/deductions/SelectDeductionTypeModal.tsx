'use client'

import React from 'react'
import {
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DEDUCTION_TYPE_OPTIONS, DeductionTypeOption } from '@/lib/deductions/constants'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectDeductionTypeModalProps {
  onSelectType: (option: DeductionTypeOption) => void
}

// El <DialogContent> único vive en el launcher (NewDeductionButton), que
// decide si mostrar este selector o el wizard activo dentro de él — evita
// remontar el Portal/Overlay (y su animación) al cambiar de vista. Este
// componente solo aporta su contenido.
export function SelectDeductionTypeModal({
  onSelectType,
}: SelectDeductionTypeModalProps) {
  return (
    <>
      <DialogHeader className="p-6 pb-4 border-b">
        <DialogTitle className="text-lg font-bold">
          Tipo de Descuento
        </DialogTitle>
      </DialogHeader>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[70vh] overflow-y-auto">
        {DEDUCTION_TYPE_OPTIONS.map((option) => {
          const Icon = option.icon
          return (
            <button
              key={option.type}
              type="button"
              onClick={() => onSelectType(option)}
              className={cn(
                "flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer group motion-reduce:transition-none",
                "hover:bg-muted/50 hover:border-primary/40 hover:shadow-xs active:scale-[0.98]",
                "bg-card/50"
              )}
            >
              <div className={cn("p-2 rounded-lg border shrink-0 mt-0.5", option.iconBg)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                    {option.title}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                  {option.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}
