import { PageHeader } from '@/components/layout/PageHeader'

/**
 * Sin este archivo, navegar aquí heredaba el loading.tsx de (dashboard)/ (el
 * skeleton de "Inicio"), así que por unos instantes se veía el dashboard en
 * vez de esta página — un layout completamente distinto parpadeando antes
 * del contenido real.
 */
export default function QuincenaLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <PageHeader title="Quincena" description="Genera el archivo de pago de anticipos quincenales para el banco." />
      <div className="flex-1 w-full p-6 space-y-4">
        <div className="h-9 w-64 rounded-lg bg-muted animate-pulse" />
        <div className="rounded-xl border bg-card overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 border-b last:border-b-0 bg-muted/30 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
