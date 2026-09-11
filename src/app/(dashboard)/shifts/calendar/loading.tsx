/**
 * Loading state para /shifts/calendar. La página es `force-dynamic` (para no
 * servir un snapshot desactualizado tras aprobar solicitudes), así que cada
 * cambio de filtro (departamento, búsqueda) dispara un round-trip completo al
 * servidor; sin este archivo, Next.js no muestra ningún feedback pendiente y
 * el contenido anterior queda congelado hasta que responde el servidor.
 *
 * Sin PageHeader: la página real ya no lo tiene (se movió el título/contador/
 * botón a la barra de controles del calendario para recuperar altura), así
 * que este skeleton reproduce esa misma barra en vez del header viejo.
 */
export default function ShiftCalendarLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-screen min-w-0 w-full overflow-x-hidden">
      <div className="animate-pulse">
        {/* Skeleton de la barra de controles del calendario */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 border-b">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-muted" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-40 rounded-md bg-muted" />
              <div className="h-3 w-32 rounded-md bg-muted/70" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-muted" />
            <div className="h-8 w-52 rounded-lg bg-muted" />
            <div className="h-8 w-20 rounded-md bg-muted" />
            <div className="h-8 w-8 rounded-md bg-muted" />
            <div className="h-8 w-24 rounded-md bg-primary/30" />
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
