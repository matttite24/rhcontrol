'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RotateCcw } from 'lucide-react'

/**
 * Red de seguridad para cualquier página del dashboard que lance un error no
 * capturado (ej. una consulta a Supabase que excede su timeout y rechaza en
 * vez de colgarse — ver withTimeout en getUserOrganizations). Sin este
 * archivo, Next.js no tiene un boundary de error en esta rama del árbol y el
 * fallo se propaga sin ninguna UI amigable ni forma de reintentar.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard error boundary]', error)
  }, [error])

  return (
    <div className="flex-1 flex items-center justify-center p-6 min-h-screen">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="h-14 w-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-foreground">No se pudo cargar la página</h2>
          <p className="text-sm text-muted-foreground">
            Ocurrió un problema de conexión al obtener los datos. Puede ser algo momentáneo — intenta de nuevo.
          </p>
        </div>
        <Button onClick={() => reset()} size="sm" className="gap-2 cursor-pointer">
          <RotateCcw className="h-4 w-4" />
          Reintentar
        </Button>
      </div>
    </div>
  )
}
