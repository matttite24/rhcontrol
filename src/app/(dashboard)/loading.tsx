/**
 * Loading state genérico del grupo (dashboard). Es el respaldo para cualquier
 * ruta que suspenda sin tener su propio loading.tsx (p. ej. mientras Next
 * compila una ruta por primera vez en desarrollo).
 *
 * Antes este archivo era el esqueleto de Inicio, así que al cambiar de módulo
 * se veía por un instante la pantalla de Inicio. El esqueleto de Inicio vive
 * ahora en (home)/loading.tsx y aplica solo a "/". Este es neutro a propósito:
 * un encabezado y filas genéricas que no se parecen a ningún módulo concreto.
 */
export default function DashboardGroupLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-screen animate-pulse" aria-busy="true">
      <div className="border-b bg-background px-6 py-4 space-y-2">
        <div className="h-6 w-48 rounded-md bg-muted" />
        <div className="h-3.5 w-80 max-w-full rounded-md bg-muted/70" />
      </div>
      <div className="flex-1 px-6 py-4 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-11 w-full rounded-md bg-muted/50" />
        ))}
      </div>
    </div>
  )
}
