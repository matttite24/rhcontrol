'use client'

import * as React from 'react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TimePickerProps {
  value?: string
  onChange?: (time: string) => void
  disabled?: boolean
  readOnly?: boolean
  className?: string
  placeholder?: string
}

export function TimePicker({
  value = '08:00',
  onChange,
  disabled = false,
  readOnly = false,
  className,
  placeholder = '--:--',
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Parsear valor actual "HH:mm"
  const [hours, minutes] = React.useMemo(() => {
    if (!value) return ['08', '00']
    const parts = value.split(':')
    return [parts[0]?.padStart(2, '0') || '08', parts[1]?.padStart(2, '0') || '00']
  }, [value])

  const HOURS_LIST = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const MINUTES_LIST = ['00', '15', '30', '45']

  function handleSelectHour(newHour: string) {
    const nextTime = `${newHour}:${minutes}`
    onChange?.(nextTime)
  }

  function handleSelectMinute(newMinute: string) {
    const nextTime = `${hours}:${newMinute}`
    onChange?.(nextTime)
  }

  if (readOnly) {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg border border-transparent bg-muted/40 text-xs font-mono font-medium text-foreground cursor-default",
          className
        )}
      >
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{value || placeholder}</span>
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-between gap-1.5 h-8 px-2.5 rounded-lg border border-input bg-card/60 hover:bg-accent/40 text-xs font-mono font-medium text-foreground transition-all shadow-xs outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
          open && "ring-1 ring-ring border-ring",
          className
        )}
      >
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{value || placeholder}</span>
        </div>
      </PopoverTrigger>

      <PopoverContent align="center" sideOffset={6} className="w-56 p-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-xs font-semibold text-foreground">Seleccionar hora</span>
            <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
              {hours}:{minutes}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Columna Horas */}
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground block text-center">
                Hora
              </span>
              <div className="h-36 overflow-y-auto pr-1 space-y-1 scrollbar-thin">
                {HOURS_LIST.map((h) => {
                  const isSelected = h === hours
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleSelectHour(h)}
                      className={cn(
                        "w-full py-1 rounded text-center text-xs font-mono transition-colors cursor-pointer",
                        isSelected
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      {h}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Columna Minutos */}
            <div className="space-y-1 border-l pl-2">
              <span className="text-[11px] font-medium text-muted-foreground block text-center">
                Minuto
              </span>
              <div className="space-y-1">
                {MINUTES_LIST.map((m) => {
                  const isSelected = m === minutes
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSelectMinute(m)}
                      className={cn(
                        "w-full py-1.5 rounded text-center text-xs font-mono transition-colors cursor-pointer",
                        isSelected
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      :{m}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => setOpen(false)}
              className="h-7 text-xs px-3"
            >
              Listo
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
