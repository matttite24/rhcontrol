'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const pad = (n: number) => String(n).padStart(2, '0')
const firstOfMonth = (y: number, m: number) => `${y}-${pad(m)}-01`
const lastOfMonth = (y: number, m: number) => `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`

interface PayrollMonthPickerProps {
  /** Corte actual (de la URL). Un mes completo se muestra como "Octubre 2026". */
  startDate: string
  endDate: string
  /** Primer mes permitido (YYYY-MM-DD). Los meses anteriores quedan deshabilitados. */
  minMonth?: string | null
}

/**
 * Selector de mes para generar el rol: cada rol cubre un mes calendario
 * completo. Al elegir un mes, la página recibe start_date = día 1 y
 * end_date = último día (los mismos parámetros que usaba el rango libre, así
 * el cálculo no cambia).
 */
export function PayrollMonthPicker({ startDate, endDate, minMonth }: PayrollMonthPickerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)

  const selected = useMemo(() => {
    const [y, m] = startDate.split('-').map(Number)
    if (!y || !m) return null
    return startDate === firstOfMonth(y, m) && endDate === lastOfMonth(y, m) ? { y, m } : null
  }, [startDate, endDate])

  const [viewYear, setViewYear] = useState(() => selected?.y ?? new Date().getFullYear())

  const minIdx = useMemo(() => {
    if (!minMonth) return null
    const [y, m] = minMonth.split('-').map(Number)
    return y * 12 + (m - 1)
  }, [minMonth])

  function selectMonth(m: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('start_date', firstOfMonth(viewYear, m))
    params.set('end_date', lastOfMonth(viewYear, m))
    router.replace(`${pathname}?${params.toString()}`)
    setOpen(false)
  }

  const hasCut = Boolean(startDate && endDate)
  const label = selected
    ? `${MONTHS[selected.m - 1]} ${selected.y}`
    : hasCut
      ? `${startDate.split('-').reverse().join('/')} – ${endDate.split('-').reverse().join('/')}`
      : 'Seleccionar mes'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-xs cursor-pointer hover:bg-accent/40',
              hasCut && 'border-primary/50 bg-primary/10 font-medium text-primary hover:bg-primary/15'
            )}
            aria-label="Elegir el mes del rol"
          />
        }
      >
        <CalendarDays className="h-4 w-4" />
        {label}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3 rounded-xl">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setViewYear((y) => y - 1)}
            aria-label="Año anterior"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold tabular-nums">{viewYear}</span>
          <button
            type="button"
            onClick={() => setViewYear((y) => y + 1)}
            aria-label="Año siguiente"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTHS.map((name, i) => {
            const m = i + 1
            const disabled = minIdx !== null && viewYear * 12 + (m - 1) < minIdx
            const isSelected = selected?.y === viewYear && selected?.m === m
            return (
              <button
                key={name}
                type="button"
                disabled={disabled}
                onClick={() => selectMonth(m)}
                aria-pressed={isSelected}
                className={cn(
                  'h-9 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-foreground',
                  disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent'
                )}
              >
                {name.slice(0, 3)}
              </button>
            )
          })}
        </div>
        {minMonth && (
          <p className="text-xs text-muted-foreground">
            Los roles mensuales se generan desde {MONTHS[Number(minMonth.split('-')[1]) - 1]} {minMonth.split('-')[0]}.
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
