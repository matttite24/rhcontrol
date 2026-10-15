import Link from 'next/link'
import { cn } from '@/lib/utils'

export type StatusTabTone = 'warning' | 'success' | 'danger' | 'neutral'

export interface StatusTab {
  value: string
  label: string
  /** Cantidad de registros de ese estado (con los mismos filtros que la lista). */
  count?: number
  /** Color semántico del contador. Un contador en 0 siempre baja a gris tenue. */
  tone?: StatusTabTone
  /** Se muestra aunque tenga 0 registros (ej. la pestaña "Todas"). */
  alwaysShow?: boolean
}

// Clases completas (no interpoladas) para que Tailwind las detecte.
const TONE_CLASS: Record<StatusTabTone, string> = {
  warning: 'bg-state-warning-bg text-state-warning-fg border-state-warning-border',
  success: 'bg-state-success-bg text-state-success-fg border-state-success-border',
  danger: 'bg-state-danger-bg text-state-danger-fg border-state-danger-border',
  neutral: 'bg-state-neutral-bg text-state-neutral-fg border-state-neutral-border',
}

interface StatusTabsProps {
  tabs: StatusTab[]
  /** `value` de la pestaña activa. */
  activeValue: string
  /** Devuelve la URL de cada pestaña (conserva el resto de filtros de la página). */
  buildHref: (value: string) => string
  /** Nombre accesible de la navegación (ej. "Estado de las solicitudes"). */
  ariaLabel: string
  className?: string
}

/**
 * Pestañas de estado con contador: la vista activa es siempre visible y cada
 * pestaña muestra cuántos registros tiene. Las que están en 0 se ocultan. Son enlaces (cada una tiene su
 * propia URL), así que funcionan en Server Components sin estado de cliente.
 *
 * Pensado para ir en el slot `trailing` de <SubHeader>, que le da el fondo
 * gris de la barra (por eso la pestaña activa es blanca: sin caja propia).
 */
export function StatusTabs({ tabs, activeValue, buildHref, ariaLabel, className }: StatusTabsProps) {
  return (
    <nav aria-label={ariaLabel} className={cn('flex items-center gap-0.5 p-0.5 text-xs w-max', className)}>
      {tabs.map((tab) => {
        const isActive = activeValue === tab.value
        const count = tab.count
        // Las pestañas sin registros no aportan: se ocultan, salvo la activa
        // (para que siempre haya una seleccionada) y las marcadas alwaysShow.
        if (count === 0 && !isActive && !tab.alwaysShow) return null
        return (
          <Link
            key={tab.value}
            href={buildHref(tab.value)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 font-medium whitespace-nowrap transition-colors',
              isActive
                ? 'bg-background text-foreground font-semibold shadow-sm ring-1 ring-border'
                : 'text-foreground/70 hover:bg-background/60 hover:text-foreground'
            )}
          >
            {tab.label}
            {count !== undefined && (
              <span
                className={cn(
                  'inline-flex min-w-5 items-center justify-center rounded-full border px-1.5 text-xs tabular-nums',
                  count === 0 ? 'bg-background text-muted-foreground border-border' : TONE_CLASS[tab.tone ?? 'neutral']
                )}
              >
                {count}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

/** Versión de carga: mismas etiquetas, contadores como bloques pulsantes. */
export function StatusTabsSkeleton({ labels }: { labels: string[] }) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 text-xs w-max" aria-hidden="true">
      {labels.map((label) => (
        <span key={label} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 font-medium text-foreground/70">
          {label}
          <span className="h-4 w-5 rounded-full bg-background border border-border animate-pulse" />
        </span>
      ))}
    </div>
  )
}
