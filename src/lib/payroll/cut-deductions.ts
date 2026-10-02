import type { SupabaseClient } from '@supabase/supabase-js'
import type { Deduction } from '@/types/employee'

/**
 * Descuentos que entran a un corte de rol.
 *
 * Un descuento lleva dos datos distintos: su `date` (cuándo ocurrió, p. ej. el
 * día del faltante de caja) y su período de rol `period_month/period_year` (en
 * qué rol se descuenta, elegido al registrarlo). Filtrar solo por `date` dejaba
 * fuera, por ejemplo, un faltante de caja ocurrido el 2 de octubre y destinado
 * al rol de septiembre. Reglas:
 *
 *  1. Entran los descuentos con `date` dentro del corte, salvo que su período
 *     sea de un mes POSTERIOR al fin del corte (se descuentan en ese rol).
 *  2. Entran también los de fuera de fecha cuyo período cae en los meses del
 *     corte, siempre que ese mes no lo haya consumido ya otro rol generado
 *     (cerrado/pagado) y la fecha del descuento no esté dentro de otro rol
 *     generado — así un descuento no aparece en dos roles.
 *
 * Los descuentos recurrentes (alimentación/vivienda) no pasan por aquí.
 */
export async function fetchCutDeductions(
  supabase: SupabaseClient,
  organizationId: string,
  startDate: string,
  endDate: string,
  options: { department?: string | null; excludeReportId?: string } = {}
): Promise<Deduction[]> {
  const monthIndex = (iso: string) => {
    const [y, m] = iso.split('-').map(Number)
    return y * 12 + (m - 1)
  }
  const startM = monthIndex(startDate)
  const endM = monthIndex(endDate)

  const [{ data: inRange }, { data: reports }] = await Promise.all([
    supabase
      .from('deductions')
      .select('*')
      .eq('organization_id', organizationId)
      .neq('status', 'anulado')
      .gte('date', startDate)
      .lte('date', endDate),
    supabase
      .from('payroll_reports')
      .select('id, start_date, end_date, department')
      .eq('organization_id', organizationId)
      .in('status', ['cerrado', 'pagado']),
  ])

  // Roles ya generados que pueden haber consumido descuentos de este alcance.
  const otherReports = (reports || []).filter(
    (r) =>
      r.id !== options.excludeReportId &&
      (!r.department || !options.department || r.department === options.department)
  )
  const dateInOtherReport = (date: string) =>
    otherReports.some((r) => date >= r.start_date && date <= r.end_date)
  const monthTouchedByOtherReport = (idx: number) =>
    otherReports.some((r) => monthIndex(r.start_date) <= idx && monthIndex(r.end_date) >= idx)

  const periodIdx = (d: Deduction) =>
    d.period_year && d.period_month ? d.period_year * 12 + (d.period_month - 1) : null

  // (1) Dentro de fechas, salvo los destinados a un rol de un mes posterior.
  const result = ((inRange || []) as Deduction[]).filter((d) => {
    const p = periodIdx(d)
    return p === null || p <= endM
  })
  const seen = new Set(result.map((d) => d.id))

  // (2) Fuera de fechas pero con período dentro de los meses (libres) del corte.
  const openMonths: number[] = []
  for (let idx = startM; idx <= endM; idx++) {
    if (!monthTouchedByOtherReport(idx)) openMonths.push(idx)
  }
  if (openMonths.length > 0) {
    const years = Array.from(new Set(openMonths.map((i) => Math.floor(i / 12))))
    const months = Array.from(new Set(openMonths.map((i) => (i % 12) + 1)))
    const { data: byPeriod } = await supabase
      .from('deductions')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_recurring', false)
      .neq('status', 'anulado')
      .in('period_year', years)
      .in('period_month', months)

    for (const d of (byPeriod || []) as Deduction[]) {
      if (seen.has(d.id)) continue
      const p = periodIdx(d)
      if (p === null || !openMonths.includes(p)) continue
      if (d.date >= startDate && d.date <= endDate) continue
      if (dateInOtherReport(d.date)) continue
      result.push(d)
      seen.add(d.id)
    }
  }

  return result
}
