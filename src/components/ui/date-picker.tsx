'use client'

import * as React from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import type { Matcher } from 'react-day-picker'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface DatePickerProps {
  id?: string
  name: string
  value?: string
  defaultValue?: string
  placeholder?: string
  onChange?: (dateString: string) => void
  disabled?: boolean
  className?: string
  /** Fecha mínima seleccionable (YYYY-MM-DD). Los días anteriores quedan deshabilitados. */
  minDate?: string
  /** Fecha máxima seleccionable (YYYY-MM-DD). Los días posteriores quedan deshabilitados. */
  maxDate?: string
}

export function DatePicker({
  id,
  name,
  value: controlledValue,
  defaultValue = '',
  placeholder = 'dd/mm/aaaa',
  onChange,
  disabled = false,
  className,
  minDate,
  maxDate,
}: DatePickerProps) {
  const [internalValue, setInternalValue] = React.useState<string>(
    controlledValue !== undefined ? controlledValue : defaultValue
  )
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue)
    }
  }, [controlledValue])

  const selectedDate = internalValue ? parseISO(internalValue) : undefined

  const disabledMatchers: Matcher[] = []
  if (minDate) disabledMatchers.push({ before: parseISO(minDate) })
  if (maxDate) disabledMatchers.push({ after: parseISO(maxDate) })

  function handleSelect(date: Date | undefined) {
    const formatted = date ? format(date, 'yyyy-MM-dd') : ''
    setInternalValue(formatted)
    onChange?.(formatted)
    setOpen(false)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    setInternalValue('')
    onChange?.('')
  }

  return (
    <div className={cn('relative w-full', className)}>
      {/* Input oculto para que FormData recoja el valor correcto en el submit */}
      <input type="hidden" id={id} name={name} value={internalValue} />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          render={
            <Button
              type="button"
              variant="outline"
              className={cn(
                'w-full h-9 justify-start text-left font-normal border-input bg-transparent px-3 text-sm shadow-xs',
                !internalValue && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">
                {selectedDate && !isNaN(selectedDate.getTime())
                  ? format(selectedDate, 'dd/MM/yyyy', { locale: es })
                  : placeholder}
              </span>
              {internalValue && (
                <span
                  role="button"
                  onClick={handleClear}
                  className="ml-auto hover:bg-muted p-0.5 rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0 rounded-lg shadow-lg border" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            locale={es}
            captionLayout="dropdown"
            startMonth={new Date(1940, 0)}
            endMonth={new Date(2040, 11)}
            disabled={disabledMatchers.length > 0 ? disabledMatchers : undefined}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
