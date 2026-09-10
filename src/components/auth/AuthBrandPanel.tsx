import {
  UserCheck,
  Users,
  CalendarRange,
  Calculator,
  FileText,
  Receipt,
  ShieldCheck,
} from 'lucide-react'

const MODULES = [
  { icon: Users, label: 'Empleados' },
  { icon: CalendarRange, label: 'Turnos y ausencias' },
  { icon: Calculator, label: 'Nómina' },
  { icon: FileText, label: 'Documentos' },
  { icon: Receipt, label: 'Deducciones' },
  { icon: ShieldCheck, label: 'Cumplimiento' },
]

interface AuthBrandPanelProps {
  /** Titular grande del panel. Cambia según la pantalla. */
  headline: string
  /** Oculta la fila de íconos de módulos (p. ej. en pantallas más densas). */
  hideModules?: boolean
}

/**
 * Panel de marca lateral compartido por /login y /select-org (y la pantalla
 * de invitación). Fondo azul con la rejilla de puntos animada (.login-dots,
 * definida en globals.css), logo, titular y accesos visuales a los módulos.
 * Solo visible en desktop (lg+).
 */
export function AuthBrandPanel({ headline, hideModules = false }: AuthBrandPanelProps) {
  return (
    <div className="hidden lg:flex flex-col justify-between bg-primary text-primary-foreground p-12 relative overflow-hidden">
      {/* Fondo animado: rejilla de puntos con deriva lenta y diagonal */}
      <div aria-hidden className="login-dots" />
      <div
        aria-hidden
        className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-black/10 blur-3xl"
      />

      <div className="relative flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
          <UserCheck className="h-6 w-6" />
        </div>
        <span className="text-lg font-bold tracking-tight">RH Control</span>
      </div>

      <div className="relative space-y-6 max-w-sm">
        <h2 className="text-3xl font-bold leading-tight tracking-tight">{headline}</h2>

        {!hideModules && (
          <div className="flex flex-wrap gap-3">
            {MODULES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                title={label}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="sr-only">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="relative text-xs text-primary-foreground/60">RH Control · Ecuador · v1.0</p>
    </div>
  )
}
