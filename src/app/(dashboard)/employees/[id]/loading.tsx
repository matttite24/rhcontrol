import { ArrowLeft, UserCheck, Building2, DollarSign, Clock, FileCheck2 } from 'lucide-react'

/**
 * Loading state para /employees/[id] (ficha de empleado). Toda la página
 * depende de datos (nombre en el header, breadcrumb, formulario completo),
 * así que no hay mucho texto estático real que reutilizar como en otras
 * rutas — el objetivo aquí es solo que la estructura (header sticky + tabs +
 * bloques de campos) coincida con la real, para que no se sienta como un
 * diseño distinto apareciendo por un instante.
 */
export default function EmployeeProfileLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <header className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-background px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="h-6 w-48 rounded bg-muted animate-pulse" />
            <div className="h-3.5 w-32 rounded bg-muted/70 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 shrink-0 text-muted-foreground/50 text-xs">
            <ArrowLeft className="h-4 w-4" />
          </div>
        </div>
      </header>

      <div className="flex-1 w-full px-6 md:px-10 py-6 space-y-6">
        {/* Barra de pestañas */}
        <div className="border-b border-border/80">
          <div className="flex items-center gap-6 h-10">
            {[
              { icon: UserCheck, label: 'General' },
              { icon: Building2, label: 'Empresa' },
              { icon: DollarSign, label: 'Salario' },
              { icon: Clock, label: 'Horario' },
              { icon: FileCheck2, label: 'Documentos' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-xs font-semibold text-muted-foreground/40 pb-2.5">
                <Icon className="h-4 w-4" />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Bloques de campos en pulso */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-24 rounded bg-muted/70" />
              <div className="h-9 w-full rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
