'use client'

import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Search, X, Landmark, Briefcase, Building2, Receipt } from 'lucide-react'
import { useComplianceSearch } from '@/components/compliance/ComplianceSearchContext'

// Portales oficiales del Estado ecuatoriano para trámites de cumplimiento laboral
const OFFICIAL_LINKS = [
  { href: 'https://sut.trabajo.gob.ec/', label: 'SUT', description: 'Sistema Único de Trabajo', icon: Briefcase },
  { href: 'https://encuentraempleo.trabajo.gob.ec/socioEmpleo-war/paginas/index.jsf', label: 'Socio Empleo', description: 'Bolsa de empleo del MDT', icon: Building2 },
  { href: 'https://www.iess.gob.ec/empleadores/', label: 'IESS Empleadores', description: 'Aportes y planillas', icon: Landmark },
  { href: 'https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT', label: 'SRI en Línea', description: 'Trámites tributarios', icon: Receipt },
]

/**
 * Encabezado alineado a la izquierda (aprovecha el ancho completo de la
 * pantalla, en vez del PageHeader estándar de lista/tabla): título +
 * subtítulo, y una sola fila con el buscador y los accesos directos a los
 * portales oficiales del Estado ecuatoriano.
 */
export function ComplianceHero() {
  const { query, setQuery } = useComplianceSearch()

  return (
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
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar información de cumplimiento…"
            className="pl-10 pr-9 h-11 rounded-2xl"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer active:scale-90"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          )}
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
  )
}
