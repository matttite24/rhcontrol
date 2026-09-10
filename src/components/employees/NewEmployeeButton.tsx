import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Botón "Nuevo Empleado" del directorio, extraído a su propio componente
 * (mismo patrón que NewIncidentButton/NewShiftRequestButton) para que
 * cualquier lógica futura (permisos, estado de carga, un asistente en pasos)
 * tenga un único lugar consistente donde vivir, en vez de un <Link> inline.
 */
export function NewEmployeeButton() {
  return (
    <Link href="/employees/new" className={cn(buttonVariants({ size: 'sm' }), 'gap-2 font-medium')}>
      <Plus className="h-4 w-4" />
      Nuevo Empleado
    </Link>
  )
}
