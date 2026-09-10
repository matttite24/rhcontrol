import { PageHeader } from '@/components/layout/PageHeader'
import { SubHeader } from '@/components/layout/SubHeader'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { buttonVariants } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Loading state para /employees. Cada cambio de filtro (SubHeader) navega
 * con un <form method="GET"> que dispara un round-trip completo al servidor;
 * sin este archivo, Next.js no muestra ningún feedback pendiente y la tabla
 * anterior queda congelada hasta que responde el servidor.
 *
 * Título, descripción, buscador, el select de "Estado" y los encabezados de
 * columna son estáticos, así que se renderizan de inmediato con los
 * componentes reales. Solo los selects de Departamento y Cargo dependen de
 * una consulta (sus opciones salen de la BD), así que esos dos quedan como
 * skeleton junto al contador y las filas del cuerpo.
 *
 * El botón de acción se replica con su texto real (no un bloque gris de
 * ancho inventado): así el navegador mide su ancho exacto y el <h1 truncate>
 * de al lado no salta de tamaño cuando la página real reemplaza este loading.
 */
export default function EmployeesLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <PageHeader
        title="Directorio de Empleados"
        description="Perfil, cargo y estado laboral de cada empleado"
        breadcrumbs={[{ label: 'Empleados' }]}
        showExport
        action={
          <button type="button" disabled className={cn(buttonVariants({ size: 'sm' }), 'gap-2 font-medium opacity-70')}>
            <Plus className="h-4 w-4" />
            Nuevo Empleado
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
            name: 'status',
            placeholder: 'Todos los estados',
            options: [
              { value: 'activo', label: 'Activo' },
              { value: 'inactivo', label: 'Inactivo' },
              { value: 'prueba', label: 'En prueba' },
            ],
          },
        ]}
        counter="Cargando..."
      >
        {/* Departamento y Cargo dependen de la BD: skeleton mientras cargan */}
        <div className="h-9 w-40 rounded-lg bg-muted animate-pulse" />
        <div className="h-9 w-40 rounded-lg bg-muted animate-pulse" />
      </SubHeader>

      <div className="flex-1 w-full overflow-x-auto bg-card">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
              <TableHead className="w-[21%] pl-6 font-semibold">Empleado</TableHead>
              <TableHead className="w-[15%] font-semibold">Contacto</TableHead>
              <TableHead className="w-[17%] font-semibold">Cargo / Departamento</TableHead>
              <TableHead className="w-[10%] font-semibold">Sueldo Base</TableHead>
              <TableHead className="w-[8%] font-semibold">Estado</TableHead>
              <TableHead className="w-[9%] font-semibold">Ingreso</TableHead>
              <TableHead className="w-[9%] font-semibold">Ficha</TableHead>
              <TableHead className="w-[6%] pr-6 text-right font-semibold">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={8} className="py-3.5">
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
