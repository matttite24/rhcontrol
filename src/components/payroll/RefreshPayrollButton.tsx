'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Recalcula el borrador con los datos actuales (novedades, deducciones,
 * quincenas, etc.): un borrador se calcula en vivo al cargar la página
 * (ver /payroll/history/[id]), así que basta con volver a pedirla al servidor.
 */
export function RefreshPayrollButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleRefresh() {
    startTransition(() => {
      router.refresh()
      toast.success('Rol recalculado', 'Se actualizó con los datos más recientes.')
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={isPending}
      className="gap-1.5 font-medium cursor-pointer"
      title="Recalcular con los datos más recientes"
    >
      <RefreshCw className={cn('h-4 w-4', isPending && 'animate-spin')} />
      Recalcular
    </Button>
  )
}
