import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationBarProps {
  currentPage: number
  totalPages: number
  totalCount: number
  pageSize: number
  /** Nombre singular/plural del recurso, p. ej. "empleado" / "empleados". */
  itemLabel: { singular: string; plural: string }
  /**
   * Construye el href de una página dada, preservando los demás query params
   * (búsqueda, filtros). Recibe el número de página (1-indexado).
   */
  buildHref: (page: number) => string
}

/**
 * Paginación server-side: navega con <Link href="?page=N"> en vez de estado
 * de React, así cada página es una petición real al servidor (con su propio
 * .range() en la query de Supabase) — no un slice() de una lista ya cargada
 * completa. Comparte el mismo layout visual en las 4 tablas paginadas
 * (empleados, incidencias, descuentos, solicitudes de turno).
 */
export function PaginationBar({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  itemLabel,
  buildHref,
}: PaginationBarProps) {
  if (totalPages <= 1) return null

  const from = (currentPage - 1) * pageSize + 1
  const to = Math.min(currentPage * pageSize, totalCount)

  // Con muchas páginas, mostrar todos los números satura la barra — se
  // muestran los números pegados al actual y se colapsa el resto.
  const pageNumbers = getVisiblePageNumbers(currentPage, totalPages)

  return (
    <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/20 text-xs">
      <span className="text-muted-foreground">
        Mostrando <span className="font-semibold text-foreground">{from}</span> a{' '}
        <span className="font-semibold text-foreground">{to}</span> de{' '}
        <span className="font-semibold text-foreground">{totalCount}</span>{' '}
        {totalCount === 1 ? itemLabel.singular : itemLabel.plural}
      </span>
      <div className="flex items-center gap-2">
        <Link
          href={buildHref(Math.max(1, currentPage - 1))}
          aria-disabled={currentPage === 1}
          tabIndex={currentPage === 1 ? -1 : undefined}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'h-8 px-2.5 gap-1 text-xs',
            currentPage === 1 && 'pointer-events-none opacity-50'
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Anterior
        </Link>
        <div className="flex items-center gap-1">
          {pageNumbers.map((page, idx) =>
            page === 'ellipsis' ? (
              <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground">
                …
              </span>
            ) : (
              <Link
                key={page}
                href={buildHref(page)}
                className={cn(
                  buttonVariants({ variant: page === currentPage ? 'default' : 'ghost', size: 'sm' }),
                  'h-8 w-8 p-0 text-xs'
                )}
              >
                {page}
              </Link>
            )
          )}
        </div>
        <Link
          href={buildHref(Math.min(totalPages, currentPage + 1))}
          aria-disabled={currentPage === totalPages}
          tabIndex={currentPage === totalPages ? -1 : undefined}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'h-8 px-2.5 gap-1 text-xs',
            currentPage === totalPages && 'pointer-events-none opacity-50'
          )}
        >
          Siguiente
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

function getVisiblePageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  const delta = 1 // páginas a cada lado de la actual
  const range: (number | 'ellipsis')[] = []
  const rangeStart = Math.max(2, current - delta)
  const rangeEnd = Math.min(total - 1, current + delta)

  range.push(1)
  if (rangeStart > 2) range.push('ellipsis')
  for (let i = rangeStart; i <= rangeEnd; i++) range.push(i)
  if (rangeEnd < total - 1) range.push('ellipsis')
  if (total > 1) range.push(total)

  return range
}
