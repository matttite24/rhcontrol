'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { DateRangePicker } from '@/components/ui/date-range-picker'

interface HeaderDateRangeProps {
  placeholder?: string
  /** Rango actual (viene de la URL, resuelto por la página). */
  defaultFrom?: string
  defaultTo?: string
  /** Nombres de los parámetros GET (por defecto date_from / date_to). */
  fromName?: string
  toName?: string
}

/**
 * Filtro de rango de fechas para el encabezado de la página (junto al botón
 * de acción principal). Es el mismo selector que antes vivía dentro del
 * <SubHeader>, pero fuera de la barra de filtros: es el control más ancho y
 * quitarlo de ahí deja respirar al resto de filtros.
 *
 * Navega solo cuando el rango queda completo (o se limpia del todo): el
 * DateRangePicker dispara onChange una vez con el inicio y otra con el fin.
 */
export function HeaderDateRange({
  placeholder = 'Fechas',
  defaultFrom = '',
  defaultTo = '',
  fromName = 'date_from',
  toName = 'date_to',
}: HeaderDateRangeProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [start, setStart] = useState(defaultFrom)
  const [end, setEnd] = useState(defaultTo)

  useEffect(() => {
    setStart(defaultFrom)
    setEnd(defaultTo)
  }, [defaultFrom, defaultTo])

  const navigate = useCallback(
    (from: string, to: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (from) params.set(fromName, from)
      else params.delete(fromName)
      if (to) params.set(toName, to)
      else params.delete(toName)
      // Un filtro nuevo vuelve a la primera página.
      params.delete('page')
      const query = params.toString()
      router.replace(`${pathname}${query ? `?${query}` : ''}`)
    },
    [router, pathname, searchParams, fromName, toName]
  )

  function handleChange({ startDate, endDate }: { startDate: string; endDate: string }) {
    setStart(startDate)
    setEnd(endDate)
    const isComplete = (startDate && endDate) || (!startDate && !endDate)
    if (isComplete) navigate(startDate, endDate)
  }

  const isActive = Boolean(start || end)

  return (
    <DateRangePicker
      startDate={start}
      endDate={end}
      onChange={handleChange}
      placeholder={placeholder}
      className="w-auto max-w-[260px]"
      triggerClassName={cn(
        'h-9 bg-background text-xs',
        isActive && 'border-primary/50 bg-primary/10 font-medium text-primary hover:bg-primary/15'
      )}
    />
  )
}
