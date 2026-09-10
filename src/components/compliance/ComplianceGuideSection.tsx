import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ComplianceStatRow } from '@/components/compliance/ComplianceStatRow'
import { Sparkles, CalendarDays, ShieldCheck, Percent, Clock, Calculator } from 'lucide-react'
import { IESS_PERSONAL_RATE, IESS_EMPLOYER_RATE, RESERVE_FUNDS_RATE } from '@/lib/payroll/ecuador'

// Ítems buscables de la Guía de Parámetros Laborales, con las mismas palabras
// clave que un usuario probablemente escribiría (décimo, IESS, extras, etc.)
export const GUIDE_ITEM_KEYWORDS: Record<string, string> = {
  decimo_tercero: 'décimo tercero tercer sueldo bono navideño',
  decimo_cuarto: 'décimo cuarto sueldo bono escolar',
  fondos_reserva: 'fondos de reserva iess',
  aportes_iess: 'aportes iess seguridad social personal patronal',
  horas_extras: 'horas extras suplementarias extraordinarias recargos',
}

export type GuideVisibility = Record<keyof typeof GUIDE_ITEM_KEYWORDS, boolean>

interface ComplianceGuideSectionProps {
  sbu: number
  visibility: GuideVisibility
}

/** Guía de Parámetros Laborales y Beneficios de Ley (Ecuador), calculada sobre el SBU vigente. */
export function ComplianceGuideSection({ sbu, visibility }: ComplianceGuideSectionProps) {
  const anyVisible = Object.values(visibility).some(Boolean)
  if (!anyVisible) return null

  const decimoMensual = Number((sbu / 12).toFixed(2))
  const fondoReservaMinimoSBU = Number((sbu * RESERVE_FUNDS_RATE).toFixed(2))
  const aportePersonalMinimo = Number((sbu * IESS_PERSONAL_RATE).toFixed(2))
  const aportePatronalMinimo = Number((sbu * IESS_EMPLOYER_RATE).toFixed(2))
  const aporteTotalRate = IESS_PERSONAL_RATE + IESS_EMPLOYER_RATE
  const costoHoraOrdinariaSBU = Number((sbu / 240).toFixed(2))
  const horaSuplementariaSBU = Number((costoHoraOrdinariaSBU * 1.5).toFixed(2))
  const horaExtraordinariaSBU = Number((costoHoraOrdinariaSBU * 2.0).toFixed(2))

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
          Parámetros Laborales y Beneficios de Ley
        </h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Calculado sobre el SBU vigente de <strong className="text-foreground font-mono">${sbu.toFixed(2)}</strong>. Se ajusta desde Ajustes → Parámetros de Nómina.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visibility.decimo_tercero && (
          <Card className="rounded-xl border-border/80 shadow-2xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Sparkles className="h-4 w-4" />
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">Art. 111 Cód. Trabajo</Badge>
              </div>
              <CardTitle className="text-sm font-bold mt-2 text-foreground">
                Décimo Tercer Sueldo
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Bono Navideño acumulable o mensualizado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 text-xs">
              <ComplianceStatRow label="Cálculo" value="1/12 de ingresos anuales" />
              <ComplianceStatRow label="Período de cálculo" value="1 Dic al 30 Nov" />
              <ComplianceStatRow
                label="Valor mensualizado"
                value={`$${decimoMensual.toFixed(2)}/mes`}
                emphasis="accent"
                accentClassName="text-amber-600 dark:text-amber-400"
              />
              <ComplianceStatRow label="Fecha máxima pago" value="Hasta 24 Dic" divider={false} />
            </CardContent>
          </Card>
        )}

        {visibility.decimo_cuarto && (
          <Card className="rounded-xl border-border/80 shadow-2xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">Art. 113 Cód. Trabajo</Badge>
              </div>
              <CardTitle className="text-sm font-bold mt-2 text-foreground">
                Décimo Cuarto Sueldo
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Bono Escolar equivalente a 1 SBU
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 text-xs">
              <ComplianceStatRow
                label="Valor mensualizado"
                value={`$${decimoMensual.toFixed(2)}/mes`}
                emphasis="accent"
                accentClassName="text-blue-600 dark:text-blue-400"
              />
              <ComplianceStatRow label="Valor acumulado" value={`$${sbu.toFixed(2)} (1 SBU)`} />
              <ComplianceStatRow label="Régimen Costa / Galápagos" value="Hasta 15 Mar" />
              <ComplianceStatRow label="Régimen Sierra / Amazonía" value="Hasta 15 Ago" divider={false} />
            </CardContent>
          </Card>
        )}

        {visibility.fondos_reserva && (
          <Card className="rounded-xl border-border/80 shadow-2xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">Art. 196 Ley Seg. Social</Badge>
              </div>
              <CardTitle className="text-sm font-bold mt-2 text-foreground">
                Fondos de Reserva
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Derecho a partir del 13º mes (1 año cumplido)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 text-xs">
              <ComplianceStatRow
                label="Porcentaje legal"
                value={`${(RESERVE_FUNDS_RATE * 100).toFixed(2)}%`}
                emphasis="accent"
                accentClassName="text-emerald-600 dark:text-emerald-400"
              />
              <ComplianceStatRow label="Mínimo sobre SBU" value={`$${fondoReservaMinimoSBU.toFixed(2)}/mes`} />
              <ComplianceStatRow label="Equivalente" value="1 mes de sueldo/año" />
              <ComplianceStatRow label="Modalidad" value="Rol o acumulado IESS" divider={false} />
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {visibility.aportes_iess && (
          <Card className="rounded-xl border-border/80 shadow-2xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                  <Percent className="h-4 w-4" />
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">Seguridad Social IESS</Badge>
              </div>
              <CardTitle className="text-sm font-bold mt-2 text-foreground">
                Porcentajes de Aportación al IESS
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Tasas obligatorias aplicables sobre la materia gravada
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                <ComplianceStatRow
                  label="Aporte Personal (Empleado)"
                  hint="Se descuenta en el rol de pagos"
                  value={`${(IESS_PERSONAL_RATE * 100).toFixed(2)}%`}
                  emphasis="accent"
                  accentClassName="text-rose-600 dark:text-rose-400"
                  divider={false}
                />
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                <ComplianceStatRow
                  label="Aporte Patronal (Empleador)"
                  hint={`Mín. SBU: $${aportePersonalMinimo.toFixed(2)} / $${aportePatronalMinimo.toFixed(2)}`}
                  value={`${(IESS_EMPLOYER_RATE * 100).toFixed(2)}%`}
                  emphasis="accent"
                  accentClassName="text-blue-600 dark:text-blue-400"
                  divider={false}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between pt-1 px-1">
                <span className="font-semibold text-muted-foreground">Aportación Total Consolidada</span>
                <span className="font-mono font-bold text-foreground text-sm">
                  {(aporteTotalRate * 100).toFixed(2)}%
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {visibility.horas_extras && (
          <Card className="rounded-xl border-border/80 shadow-2xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  <Clock className="h-4 w-4" />
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">Art. 55 Cód. Trabajo</Badge>
              </div>
              <CardTitle className="text-sm font-bold mt-2 text-foreground">
                Recargos por Horas Extras
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Cálculo de hora ordinaria y recargos según la jornada
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                <ComplianceStatRow
                  label="Suplementarias (+50%)"
                  hint="Después de jornada, hasta 24h00"
                  value={`$${horaSuplementariaSBU.toFixed(2)}/h`}
                  emphasis="accent"
                  accentClassName="text-amber-600 dark:text-amber-400"
                  divider={false}
                />
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                <ComplianceStatRow
                  label="Extraordinarias (+100%)"
                  hint="Fines de semana, feriados o 24h00–06h00"
                  value={`$${horaExtraordinariaSBU.toFixed(2)}/h`}
                  emphasis="accent"
                  accentClassName="text-emerald-600 dark:text-emerald-400"
                  divider={false}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between pt-1 px-1">
                <span className="font-semibold text-muted-foreground">Valor Hora Ordinaria</span>
                <span className="font-mono font-bold text-foreground text-sm">
                  ${costoHoraOrdinariaSBU.toFixed(2)}/h
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  )
}
