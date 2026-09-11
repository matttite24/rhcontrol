'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNewItemShortcut } from '@/hooks/use-new-item-shortcut'

/**
 * Botón "Nuevo Empleado" del directorio, extraído a su propio componente
 * (mismo patrón que NewIncidentButton/NewShiftRequestButton) para que
 * cualquier lógica futura (permisos, estado de carga, un asistente en pasos)
 * tenga un único lugar consistente donde vivir, en vez de un <Link> inline.
 *
 * También responde al atajo de teclado "N" navegando a /employees/new.
 */
export function NewEmployeeButton() {
  const router = useRouter()

  useNewItemShortcut(() => {
    router.push('/employees/new')
  })

  return (
    <Link
      href="/employees/new"
      title="Atajo: N"
      className={cn(buttonVariants({ size: 'sm' }), 'gap-2 font-medium')}
    >
      <Plus className="h-4 w-4" />
      Nuevo Empleado
    </Link>
  )
}
