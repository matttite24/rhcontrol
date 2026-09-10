import { Separator } from '@/components/ui/separator'
import {
  Search,
  Briefcase,
  Building2,
  Landmark,
  Receipt,
} from 'lucide-react'

// Mismos portales oficiales que ComplianceView — son texto estático (no
// dependen de la BD), así que se renderizan reales de inmediato en el loading.
const OFFICIAL_LINKS = [
  { href: 'https://sut.trabajo.gob.ec/', label: 'SUT', description: 'Sistema Único de Trabajo', icon: Briefcase },
  { href: 'https://encuentraempleo.trabajo.gob.ec/socioEmpleo-war/paginas/index.jsf', label: 'Socio Empleo', description: 'Bolsa de empleo del MDT', icon: Building2 },
  { href: 'https://www.iess.gob.ec/empleadores/', label: 'IESS Empleadores', description: 'Aportes y planillas', icon: Landmark },
  { href: 'https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT', label: 'SRI en Línea', description: 'Trámites tributarios', icon: Receipt },
]

/**
 * Loading state para /compliance. El hero completo (título, subtítulo,
 * buscador deshabilitado y accesos a portales oficiales) es texto estático
 * y se renderiza real de inmediato; solo el contenido derivado del
 * SBU/organización va en skeleton.
 */
export default function ComplianceLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <div className="flex flex-col items-start px-6 md:px-8 pt-8 pb-6 gap-5 w-full">
        <div className="space-y-0.5">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Cumplimiento
          </h1>
          <p className="text-sm text-muted-foreground">
            Parámetros laborales, beneficios de ley y obligaciones ante IESS, MDT y control corporativo en Ecuador.
          </p>
        </div>

        <div className="flex flex-wrap items-stretch gap-3 w-full">
          <div className="relative w-full max-w-md h-11">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              disabled
              placeholder="Buscar información de cumplimiento…"
              className="w-full h-11 pl-10 pr-3 rounded-2xl border border-input bg-transparent text-sm opacity-70"
            />
          </div>

          <Separator orientation="vertical" className="hidden sm:block self-stretch h-auto" />

          <div className="flex flex-wrap items-center gap-2.5">
            {OFFICIAL_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2.5 pl-3 pr-3.5 py-2 rounded-2xl border bg-card text-left transition-[transform,background-color] duration-150 ease-out motion-reduce:transition-none hover:bg-muted/50 active:scale-[0.97]"
              >
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                  <link.icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-semibold text-foreground">{link.label}</span>
                  <span className="text-[11px] text-muted-foreground">{link.description}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-10 w-full px-6 md:px-8 pb-10 animate-pulse">
        <div className="space-y-4">
          <div className="h-4 w-64 bg-muted rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-muted/20" />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="h-4 w-72 bg-muted rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-48 rounded-xl border bg-card" />
            ))}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-44 rounded-xl border bg-card" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
