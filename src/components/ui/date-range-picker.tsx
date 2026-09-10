'use client'

import * as React from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon, X } from 'lucide-react'
import type { DateRange } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface DateRangePickerProps {
  startDate?: string
  endDate?: string
  onChange?: (range: { startDate: string; endDate: string }) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Clases para el botón-disparador (p.ej. para igualar su altura a otros controles de un mismo formulario). Por defecto h-10. */
  triggerClassName?: string
  maxDays?: number
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  placeholder = 'Selecciona rango de fechas',
  disabled = false,
  className,
  triggerClassName,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  const selectedRange: DateRange | undefined = React.useMemo(() => {
    if (!startDate && !endDate) return undefined
    return {
      from: startDate ? parseISO(startDate) : undefined,
      to: endDate ? parseISO(endDate) : undefined,
    }
  }, [startDate, endDate])

  function handleSelect(range: DateRange | undefined) {
    if (!range) {
      onChange?.({ startDate: '', endDate: '' })
      return
    }

    const fromStr = range.from ? format(range.from, 'yyyy-MM-dd') : ''
    // Si solo seleccionó from, dejamos endDate vacío para esperar que elija el segundo día
    const toStr = range.to ? format(range.to, 'yyyy-MM-dd') : ''

    onChange?.({
      startDate: fromStr,
      endDate: toStr,
    })

    // NO cerrar automáticamente aquí para que el usuario pueda ver el rango completo y corregir cómodamente
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange?.({ startDate: '', endDate: '' })
  }

  // Texto amigable para el input
  const displayText = React.useMemo(() => {
    if (!startDate) return placeholder
    const fromDate = parseISO(startDate)
    if (!endDate) {
      return `Desde ${format(fromDate, 'dd/MM/yyyy', { locale: es })} (elige fecha fin)`
    }
    if (startDate === endDate) {
      return format(fromDate, 'dd/MM/yyyy', { locale: es })
    }
    const toDate = parseISO(endDate)
    return `${format(fromDate, 'dd/MM/yyyy', { locale: es })} al ${format(toDate, 'dd/MM/yyyy', { locale: es })}`
  }, [startDate, endDate, placeholder])

  return (
    <div className={cn('relative w-full', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          render={
            <Button
              type="button"
              variant="outline"
              className={cn(
                'w-full h-10 justify-start text-left font-normal border-input bg-card px-3 text-sm shadow-2xs hover:bg-muted/50 cursor-pointer',
                !startDate && 'text-muted-foreground',
                triggerClassName
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="flex-1 truncate font-medium">
                {displayText}
              </span>
              {startDate && (
                <span
                  role="button"
                  onClick={handleClear}
                  className="ml-auto hover:bg-muted p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  title="Limpiar rango"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl border overflow-hidden" align="start">
          <div className="p-3 bg-muted/20 border-b flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">Seleccionar período de vacaciones</span>
            <span className="text-[11px] text-muted-foreground font-mono">
              {!startDate ? 'Haz clic para fecha de salida' : !endDate ? 'Ahora haz clic en fecha de retorno' : displayText}
            </span>
          </div>
          <Calendar
            mode="range"
            defaultMonth={selectedRange?.from || new Date()}
            selected={selectedRange}
            onSelect={handleSelect}
            numberOfMonths={2}
            locale={es}
            captionLayout="dropdown"
            startMonth={new Date(new Date().getFullYear() - 1, 0)}
            endMonth={new Date(new Date().getFullYear() + 2, 11)}
            autoFocus
          />
          {/* Barra inferior con acciones para cerrar con seguridad cuando termine */}
          <div className="p-2.5 bg-muted/20 border-t flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange?.({ startDate: '', endDate: '' })
              }}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer h-8"
            >
              Limpiar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={!startDate}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer h-8 px-4"
            >
              Aplicar Rango
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
