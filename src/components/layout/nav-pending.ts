'use client'

import { useEffect } from 'react'

let pendingCount = 0

/**
 * Marca <html data-nav-pending="true"> mientras haya al menos una navegación
 * de filtro/pestaña/paginación en curso. El CSS global (globals.css) atenúa
 * con eso cualquier contenedor marcado con `data-pending-dim`, sin tener que
 * compartir estado de React entre la barra de filtros y la tabla.
 */
export function usePendingFlag(isPending: boolean) {
  useEffect(() => {
    if (!isPending) return
    pendingCount += 1
    document.documentElement.dataset.navPending = 'true'
    return () => {
      pendingCount = Math.max(0, pendingCount - 1)
      if (pendingCount === 0) delete document.documentElement.dataset.navPending
    }
  }, [isPending])
}
