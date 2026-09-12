import { PageHeader } from '@/components/layout/PageHeader'
import { SubHeader } from '@/components/layout/SubHeader'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { buttonVariants } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { INCIDENT_TYPE_OPTIONS } from '@/lib/incidents/constants'

/**
 * Loading state para /incidents. Cada cambio de filtro (SubHeader) navega
 * con un <form method="GET"> que dispara un round-trip completo al servidor;
 * sin este archivo, Next.js no muestra ningún feedback pendiente y la tabla
 * anterior queda congelada hasta que responde el servidor.
 *
 * Título, descripción, opciones de filtro y encabezados de columna son
 * texto/constantes estáticas (no dependen de ninguna consulta), así que se
 * renderizan de inmediato con los componentes reales — el pulso solo aplica
 * a lo que sí depende de datos: el contador y las filas del cuerpo.
 *
 * El botón de acción se replica con su texto real (no un bloque gris de
 * ancho inventado): así el navegador mide su ancho exacto y el <h1 truncate>
 * de al lado no salta de tamaño cuando la página real reemplaza este loading.
 */
export default function IncidentsLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <PageHeader
        title="Incidencias"
        description="Registros, solicitudes y documentación del personal"
        showExport
        action={
          <button type="button" disabled className={cn(buttonVariants({ size: 'sm' }), 'gap-2 font-medium opacity-70')}>
            <Plus className="h-4 w-4" />
            Nueva Incidencia
          </button>
        }
      />

      <SubHeader
        search={{
          name: 'q',
          placeholder: 'Buscar por empleado o motivo...',
        }}
        selects={[
          {
            name: 'type',
            placeholder: 'Todos los tipos',
            options: INCIDENT_TYPE_OPTIONS.map((t) => ({ value: t.type, label: t.title })),
          },
          {
            name: 'status',
            placeholder: 'Todos los estados',
            options: [
              { value: 'registrado', label: 'Registrado' },
              { value: 'aprobado', label: 'Aprobado' },
              { value: 'pendiente', label: 'Pendiente' },
              { value: 'rechazado', label: 'Rechazado' },
              { value: 'anulado', label: 'Anulado' },
            ],
          },
        ]}
        dateRange={{
          placeholder: 'Rango de fecha del evento',
        }}
        counter="Cargando..."
      />

      <div className="flex-1 w-full overflow-x-auto bg-card">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
              <TableHead className="w-[13%] pl-6 font-semibold">Emisión</TableHead>
              <TableHead className="w-[24%] font-semibold">Empleado</TableHead>
              <TableHead className="w-[34%] font-semibold">Tipo / Asunto</TableHead>
              <TableHead className="w-[18%] font-semibold">Identificador</TableHead>
              <TableHead className="w-[11%] pr-6 text-right font-semibold">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={5} className="py-2.5">
                  <div className="h-8 w-full rounded-md bg-muted/50 animate-pulse" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
