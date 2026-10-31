'use client'

import React, { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { buttonVariants } from '@/components/ui/button'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { usePendingFlag } from '@/components/layout/nav-pending'
import { SubHeaderNavContext } from '@/components/layout/subheader-nav'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

export interface FilterOption {
  value: string
  label: string
}

export interface FilterSelectConfig {
  name: string
  defaultValue?: string
  placeholder?: string
  options: FilterOption[]
  className?: string
}

export interface DateRangeFilterConfig {
  /** Nombre del parámetro GET para la fecha de inicio (por defecto "date_from") */
  fromName?: string
  /** Nombre del parámetro GET para la fecha de fin (por defecto "date_to") */
  toName?: string
  defaultFrom?: string
  defaultTo?: string
  placeholder?: string
}

export interface SubHeaderProps {
  /** Ruta base para navegar al filtrar (por defecto la ruta actual) */
  action?: string
  /** Texto del buscador (opcional). Si se omite, no renderiza búsqueda */
  search?: {
    name?: string
    defaultValue?: string
    placeholder?: string
    className?: string
  }
  /** Selectores preconfigurados */
  selects?: FilterSelectConfig[]
  /** Filtro de rango de fechas (viaja como parámetros GET junto al resto de filtros) */
  dateRange?: DateRangeFilterConfig
  /** Elementos personalizados adicionales (p.ej. DatePickers, separadores) */
  children?: React.ReactNode
  /** Si hay filtros activos para mostrar el botón de limpiar */
  hasFilters?: boolean
  /** URL para limpiar los filtros */
  clearHref?: string
  /** @deprecated Ya no se usa: los filtros se aplican automáticamente, sin botón de submit. */
  submitLabel?: string
  /** Contenido al final (lado derecho) de la barra, p.ej. pestañas de estado. */
  trailing?: React.ReactNode
  /** Elemento o texto para el lado derecho (p.ej. total de registros) */
  counter?: React.ReactNode
  /** Clases adicionales para el contenedor */
  className?: string
}

// Altura común a la que convergen todos los controles de esta barra
// (buscador, selects, rango de fechas, botones) para que se vean como un
// mismo grupo, en vez de piezas de tamaños distintos.
const CONTROL_HEIGHT = 'h-9'

// Cuánto esperar tras la última tecla del buscador antes de navegar. Los
// selects y el rango de fecha, en cambio, navegan de inmediato al elegir un
// valor — ahí no hay ambigüedad de "¿terminó de escribir?" como sí la hay
// con texto libre.
const SEARCH_DEBOUNCE_MS = 250

export function SubHeader({
  action,
  search,
  selects,
  trailing,
  dateRange,
  children,
  hasFilters = false,
  clearHref,
  counter,
  className,
}: SubHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // isPending se activa mientras el servidor responde al cambiar un filtro:
  // sin esto la pantalla parece congelada porque loading.tsx no se muestra
  // cuando solo cambian los searchParams.
  const [isPending, startTransition] = useTransition()
  usePendingFlag(isPending)
  // Estado optimista: la pestaña/selector elegido se marca al instante, sin
  // esperar a que lleguen los datos. Se descarta cuando termina la navegación.
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [pendingSelects, setPendingSelects] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!isPending) {
      setPendingHref(null)
      setPendingSelects({})
    }
  }, [isPending])

  const fromName = dateRange?.fromName || 'date_from'
  const toName = dateRange?.toName || 'date_to'

  // Navega reemplazando solo los parámetros de filtro indicados, preservando
  // cualquier otro searchParam ya presente en la URL (ej. paginación futura).
  // Usa replace (no push) para no llenar el historial con un entry por cada
  // tecla/selección — "atrás" debe volver a la página anterior, no al estado
  // de filtro previo.
  const navigateWithParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      }
      const query = params.toString()
      startTransition(() => {
        router.replace(`${action || pathname}${query ? `?${query}` : ''}`)
      })
    },
    [router, pathname, action, searchParams]
  )

  // Buscador: estado local para que el input responda instantáneamente al
  // tipeo, con la navegación real disparada tras una pausa (debounce) — evita
  // una consulta al servidor por cada tecla. Se resincroniza cuando el valor
  // en la URL cambia por una causa externa (ej. "Limpiar filtros"), pero solo
  // si el usuario no sigue escribiendo algo más nuevo: sin ese resguardo, un
  // eco tardío de una navegación vieja (el usuario ya tecleó más letras
  // mientras esa navegación estaba en curso) pisaría lo que acaba de escribir.
  const [searchValue, setSearchValue] = useState(search?.defaultValue ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastNavigatedValue = useRef(search?.defaultValue ?? '')

  useEffect(() => {
    const incoming = search?.defaultValue ?? ''
    // Ignorar si es simplemente el eco de la navegación que nosotros mismos
    // disparamos (evita re-sincronizar y perder el "isFirstRender" gate).
    if (incoming === lastNavigatedValue.current) return
    setSearchValue(incoming)
    lastNavigatedValue.current = incoming
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search?.defaultValue])

  useEffect(() => {
    if (!search) return
    if (searchValue === lastNavigatedValue.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      lastNavigatedValue.current = searchValue
      navigateWithParams({ [search.name || 'q']: searchValue })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue])

  const navCtx = React.useMemo(
    () => ({
      pendingHref,
      navigate: (href: string) => {
        setPendingHref(href)
        startTransition(() => {
          router.push(href)
        })
      },
    }),
    [router, pendingHref]
  )

  function handleSelectChange(name: string, value: string) {
    setPendingSelects((prev) => ({ ...prev, [name]: value }))
    navigateWithParams({ [name]: value })
  }

  // Rango de fecha: DateRangePicker es un componente controlado (sin estado
  // propio) que dispara onChange dos veces por selección — una con solo el
  // inicio elegido (fin vacío, esperando el segundo clic) y otra al
  // completar el rango. Se necesita estado local para reflejar visualmente
  // esa selección intermedia (si no, el primer clic se vería como si no
  // hiciera nada), pero solo se navega/filtra cuando el rango queda
  // completo o se limpia del todo.
  const [rangeStart, setRangeStart] = useState(dateRange?.defaultFrom ?? '')
  const [rangeEnd, setRangeEnd] = useState(dateRange?.defaultTo ?? '')

  useEffect(() => {
    setRangeStart(dateRange?.defaultFrom ?? '')
    setRangeEnd(dateRange?.defaultTo ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange?.defaultFrom, dateRange?.defaultTo])

  function handleDateRangeChange({ startDate, endDate }: { startDate: string; endDate: string }) {
    setRangeStart(startDate)
    setRangeEnd(endDate)
    const isComplete = (startDate && endDate) || (!startDate && !endDate)
    if (!isComplete) return
    navigateWithParams({ [fromName]: startDate, [toName]: endDate })
  }

  return (
    <SubHeaderNavContext.Provider value={navCtx}>
    <div
      className={cn(
        'relative bg-card/75 supports-[backdrop-filter]:backdrop-blur-md px-6 py-3 sticky top-[73px] z-10',
        'border-b border-border',
        className
      )}
    >
      {isPending && (
        <div
          role="progressbar"
          aria-label="Aplicando filtros"
          className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-primary/20"
        >
          <div className="h-full w-1/3 bg-primary animate-pulse" />
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 w-full">
        <div
          className={cn(
            'flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 min-w-0',
            // Con pestañas a la derecha, los filtros se quedan en UNA línea (el buscador cede ancho
            // primero) y, si no caben junto a las pestañas, son las pestañas las que bajan a su
            // propia línea — en vez de partir los filtros en dos y dejar las pestañas flotando.
            trailing ? 'sm:flex-nowrap sm:min-w-fit' : 'sm:flex-wrap'
          )}
        >
          {/* Buscador opcional — navega con debounce tras dejar de escribir */}
          {search && (
            <div className={cn('relative w-full sm:max-w-xs', trailing && 'sm:flex-1 sm:min-w-[130px] sm:max-w-[200px]', search.className)}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                name={search.name || 'q'}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={search.placeholder || 'Buscar...'}
                className={cn(CONTROL_HEIGHT, 'pl-8.5 text-xs w-full bg-background/80 focus:bg-background rounded-lg border-input')}
              />
            </div>
          )}

          {/* Selectores configurados — navegan de inmediato al elegir un valor */}
          {selects?.map((sel) => {
            const currentValue = pendingSelects[sel.name] ?? sel.defaultValue ?? ''
            return (
              <Popover key={sel.name}>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      className={cn(
                        CONTROL_HEIGHT,
                        'flex items-center justify-between gap-2 rounded-lg border border-input bg-background/80 px-3 text-xs text-foreground cursor-pointer hover:bg-background w-full sm:w-auto sm:max-w-[220px]',
                        // Filtro activo: borde y fondo con el color primario para que se note a simple vista
                        currentValue && 'border-primary/50 bg-primary/10 font-medium text-primary hover:bg-primary/15',
                        sel.className
                      )}
                    />
                  }
                >
                  <span className={cn('flex items-center gap-1.5 truncate', !currentValue && 'text-muted-foreground')}>
                    {currentValue && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
                    {sel.options.find((opt) => opt.value === currentValue)?.label ||
                      sel.placeholder ||
                      'Seleccionar'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto min-w-[200px] max-w-xs p-1.5 rounded-xl border text-xs">
                  <div className="space-y-0.5 max-h-64 overflow-y-auto">
                    {sel.placeholder && (
                      <button
                        type="button"
                        onClick={() => handleSelectChange(sel.name, '')}
                        className={cn(
                          'flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-left',
                          !currentValue ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted text-foreground'
                        )}
                      >
                        <span className="truncate">{sel.placeholder}</span>
                        {!currentValue && <Check className="h-3.5 w-3.5 shrink-0" />}
                      </button>
                    )}
                    {sel.options.map((opt) => {
                      const isSelected = currentValue === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleSelectChange(sel.name, opt.value)}
                          className={cn(
                            'flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-left',
                            isSelected ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted text-foreground'
                          )}
                        >
                          <span className="truncate">{opt.label}</span>
                          {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            )
          })}

          {/* Filtro de rango de fechas — navega de inmediato al elegir ambas fechas */}
          {dateRange && (
            <DateRangePicker
              startDate={rangeStart}
              endDate={rangeEnd}
              onChange={handleDateRangeChange}
              placeholder={dateRange.placeholder || 'Rango de fechas'}
              className="w-full sm:w-auto sm:max-w-[260px]"
              triggerClassName={cn(CONTROL_HEIGHT, 'bg-background/80 text-xs', (rangeStart || rangeEnd) && 'border-primary/50 bg-primary/10 font-medium text-primary hover:bg-primary/15')}
            />
          )}

          {/* Elementos personalizados (DatePickers, rangos, etc.) */}
          {children}

          {/* Botón de limpiar filtros */}
          {hasFilters && clearHref && (
            <Link
              href={clearHref}
              // Con pestañas a la derecha el espacio es justo: el botón se reduce a un icono.
              title="Limpiar filtros"
              aria-label="Limpiar filtros"
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                CONTROL_HEIGHT,
                'text-xs text-muted-foreground hover:text-foreground w-full sm:w-auto',
                trailing ? 'sm:w-8 sm:px-0' : 'px-2.5'
              )}
            >
              <X className={cn('h-3.5 w-3.5', !trailing && 'mr-1')} />
              <span className={cn(trailing && 'sm:sr-only')}>Limpiar</span>
            </Link>
          )}
        </div>

        {trailing && <div className="shrink-0 min-w-0 overflow-x-auto sm:ml-auto">{trailing}</div>}

        {/* Contador o información del lado derecho */}
        {counter && (
          <div className="text-xs text-muted-foreground font-medium shrink-0 bg-muted/50 px-2.5 py-1 rounded-md border border-border/50 self-start sm:self-auto">
            {counter}
          </div>
        )}
      </div>
    </div>
    </SubHeaderNavContext.Provider>
  )
}
