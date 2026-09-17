'use client'

import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DetailModalHeaderProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  headerBg: string
  accentText: string
  statusLabel: string
  statusBadgeClass: string
  documentCode?: string
  /** Fecha ya formateada para mostrar, ej. "15/9/2026". */
  registeredAtLabel: string
  onClose: () => void
}

/**
 * Header compartido por los modales de detalle de novedades/incidencias:
 * Título + Estado en la primera fila, Código + Fecha de registro en la
 * segunda. Mismo patrón en ShiftRequestDetailModal e IncidentDetailModal —
 * un solo lugar para no duplicar el layout en cada uno.
 */
export function DetailModalHeader({
  icon: Icon,
  title,
  headerBg,
  accentText,
  statusLabel,
  statusBadgeClass,
  documentCode,
  registeredAtLabel,
  onClose,
}: DetailModalHeaderProps) {
  return (
    <DialogHeader className={cn("p-6 pb-4 border-b shrink-0 transition-colors", headerBg)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("p-2.5 rounded-xl border shrink-0 bg-background/80 shadow-2xs", accentText)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-bold text-foreground truncate">
                {title}
              </DialogTitle>
              <Badge
                variant="outline"
                className={cn("text-xs font-medium border capitalize shrink-0", statusBadgeClass)}
              >
                {statusLabel}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
              {documentCode && <span className="font-semibold text-foreground">{documentCode}</span>}
              {documentCode && ' • '}
              Fecha de registro: {registeredAtLabel}
            </DialogDescription>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer shrink-0"
          title="Cerrar"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Cerrar</span>
        </Button>
      </div>
    </DialogHeader>
  )
}
