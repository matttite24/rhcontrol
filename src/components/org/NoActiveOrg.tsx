import { Building } from 'lucide-react'

/**
 * Estado vacío compartido para páginas que requieren una organización activa.
 * `action` permite precisar qué se podrá hacer una vez seleccionada, sin
 * repetir la instrucción genérica de "usa el sidebar" en cada página.
 */
export function NoActiveOrg({ action }: { action?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <Building className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h2 className="text-xl font-semibold text-foreground">Sin empresa activa</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        Selecciona o crea una empresa desde el sidebar{action ? ` para ${action}` : ''}.
      </p>
    </div>
  )
}
