import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Loading state para /shifts/calendar. La página es `force-dynamic` (para no
 * servir un snapshot desactualizado tras aprobar solicitudes), así que cada
 * cambio de filtro (departamento, búsqueda) dispara un round-trip completo al
 * servidor; sin este archivo, Next.js no muestra ningún feedback pendiente y
 * el contenido anterior queda congelado hasta que responde el servidor.
 *
 * El título "Calendario de Turnos" es texto estático, pero la descripción
 * (conteo de empleados) sí depende de la consulta — por eso el título se
 * renderiza real de inmediato con el PageHeader y solo el contador queda
 * como skeleton, junto con el resto de la UI que sí depende de datos.
 *
 * El botón de acción se replica con su texto real (no un bloque gris de
 * ancho inventado): así el navegador mide su ancho exacto y el <h1 truncate>
 * de al lado no salta de tamaño cuando la página real reemplaza este loading.
 */
export default function ShiftCalendarLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-screen min-w-0 w-full overflow-x-hidden">
      <PageHeader
        title="Calendario de Turnos"
        description="Cargando..."
        action={
          <button type="button" disabled className={cn(buttonVariants({ size: 'sm' }), 'gap-2 font-medium opacity-70')}>
            <Plus className="h-4 w-4" />
            Nueva Solicitud
          </button>
        }
      />

      <div className="animate-pulse">
        {/* Skeleton de la barra de controles del calendario */}
        <div className="flex items-center justify-between gap-3 px-6 py-2.5 border-b">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-muted" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-40 rounded-md bg-muted" />
              <div className="h-3 w-24 rounded-md bg-muted/70" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-muted" />
            <div className="h-8 w-52 rounded-lg bg-muted" />
            <div className="h-8 w-24 rounded-md bg-muted" />
          </div>
        </div>

        {/* Skeleton de filas de la tabla */}
        <div className="flex-1 px-6 py-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-11 w-full rounded-md bg-muted/50" />
          ))}
        </div>
      </div>
    </div>
  )
}
