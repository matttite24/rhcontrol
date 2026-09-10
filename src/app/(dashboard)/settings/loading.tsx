import { Building2, Layers, Coins, CalendarHeart, Users } from 'lucide-react'

/**
 * Loading state para /settings. Sin este archivo, Next.js cae al
 * `(dashboard)/loading.tsx` del padre — que es el esqueleto de la home — y
 * durante el render del servidor de Configuración se ve por unos segundos
 * la pantalla de Inicio antes de cambiar.
 *
 * La barra de pestañas (que ahora hace de header) es texto/íconos estáticos,
 * así que se renderiza real; solo el cuerpo del formulario queda en pulso.
 */
const TABS = [
  { icon: Building2, label: 'Perfil' },
  { icon: Layers, label: 'Departamentos y Cargos' },
  { icon: Coins, label: 'Parámetros de Nómina' },
  { icon: CalendarHeart, label: 'Feriados' },
  { icon: Users, label: 'Miembros e Invitaciones' },
]

export default function SettingsLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-background px-6 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {TABS.map((tab, i) => (
              <div
                key={tab.label}
                className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg ${
                  i === 0 ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
              </div>
            ))}
          </div>
          <div className="h-9 w-32 rounded-md bg-muted/50 animate-pulse shrink-0" />
        </div>
      </header>

      <div className="p-6 md:p-8 max-w-7xl w-full mx-auto">
        <div className="animate-pulse space-y-8">
          {[0, 1, 2].map((section) => (
            <div key={section} className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 py-2">
              <div className="lg:col-span-4">
                <div className="h-5 w-48 rounded bg-muted/60" />
              </div>
              <div className="lg:col-span-8 space-y-5 max-w-2xl">
                <div className="space-y-1.5">
                  <div className="h-3.5 w-32 rounded bg-muted/50" />
                  <div className="h-9 w-full rounded-md bg-muted/40" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-28 rounded bg-muted/50" />
                    <div className="h-9 w-full rounded-md bg-muted/40" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-28 rounded bg-muted/50" />
                    <div className="h-9 w-full rounded-md bg-muted/40" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
