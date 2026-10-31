import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { NoActiveOrg } from '@/components/org/NoActiveOrg'
import { PageHeader } from '@/components/layout/PageHeader'
import { PrintReportButton } from '@/components/reports/PrintReportButton'
import { cn } from '@/lib/utils'
import { getEcuadorDateIso, getEcuadorTodayIso } from '@/lib/utils/ecuador-time'
import {
  buildVacationReport,
  VACATION_STATUS_LABEL,
  type VacationReportRequest,
  type VacationReportStatus,
} from '@/lib/shifts/vacation-report'
import { formatLongDate } from '@/lib/shifts/format'

export const metadata = { title: 'Reporte de Vacaciones' }

const STATUS_STYLE: Record<VacationReportStatus, string> = {
  completas: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  parciales: 'bg-amber-100 text-amber-800 border-amber-300',
  sin_tomar: 'bg-rose-100 text-rose-800 border-rose-300',
  en_acumulacion: 'bg-slate-100 text-slate-700 border-slate-300',
}

const FILTERS: { value: 'todos' | VacationReportStatus; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'completas', label: 'Completas' },
  { value: 'parciales', label: 'Parciales' },
  { value: 'sin_tomar', label: 'Sin tomar' },
  { value: 'en_acumulacion', label: 'En acumulación' },
]

function shortDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmtDays(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export default async function VacationsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>
}) {
  const params = await searchParams
  const currentOrg = await getCurrentOrganization()
  if (!currentOrg) return <NoActiveOrg action="ver el reporte de vacaciones" />

  const supabase = await createClient()
  // Solicitudes de los últimos 3 años: cubre el período vigente y el anterior de cualquier empleado.
  const sinceIso = getEcuadorDateIso(-365 * 3)

  const [{ data: employees }, { data: requests }] = await Promise.all([
    supabase
      .from('employees')
      .select('id, full_name, national_id, department, position, hire_date')
      .eq('organization_id', currentOrg.id)
      .neq('status', 'inactivo')
      .not('hire_date', 'is', null)
      .order('full_name'),
    supabase
      .from('shift_requests')
      .select('id, employee_id, request_type, hours, metadata, status, date')
      .eq('organization_id', currentOrg.id)
      .in('request_type', ['solicitud_vacaciones', 'permiso_laboral', 'otro'])
      .in('status', ['pendiente', 'aprobado'])
      .gte('date', sinceIso),
  ])

  const allRows = buildVacationReport(
    (employees ?? []) as Parameters<typeof buildVacationReport>[0],
    (requests ?? []) as VacationReportRequest[]
  ).sort((a, b) => a.department.localeCompare(b.department) || a.fullName.localeCompare(b.fullName))

  const counts = {
    completas: allRows.filter((r) => r.status === 'completas').length,
    parciales: allRows.filter((r) => r.status === 'parciales').length,
    sin_tomar: allRows.filter((r) => r.status === 'sin_tomar').length,
    en_acumulacion: allRows.filter((r) => r.status === 'en_acumulacion').length,
  }

  const filter = FILTERS.some((f) => f.value === params.estado) ? (params.estado as string) : 'todos'
  const rows = filter === 'todos' ? allRows : allRows.filter((r) => r.status === filter)
  const totalRemaining = rows.reduce((s, r) => s + r.remainingDays, 0)
  const totalTaken = rows.reduce((s, r) => s + r.takenDays, 0)

  return (
    <div className="flex flex-col flex-1 min-h-screen print:min-h-0">
      <style>{`@media print {
        @page { size: A4 landscape; margin: 12mm; }
        body { background: #fff !important; }
        [data-slot="sidebar-gap"], [data-slot="sidebar-container"] { display: none !important; }
        [data-slot="sidebar-wrapper"] { display: block !important; min-height: 0 !important; }
        [data-slot="sidebar-inset"] { margin: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
        tr { break-inside: avoid; } thead { display: table-header-group; }
      }`}</style>

      {/* Header de la app: solo en pantalla */}
      <div className="print:hidden">
        <PageHeader
          title="Reporte de Vacaciones"
          description="Días tomados y faltantes por empleado según su período de vacaciones"
          action={<PrintReportButton />}
        />
      </div>

      <div className="flex-1 bg-card px-6 py-5 print:bg-white print:p-0 print:text-black">
        {/* Encabezado del documento: solo al imprimir */}
        <header className="hidden print:flex border-b-2 border-slate-800 pb-3 mb-5 items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-600">{currentOrg.name}</p>
            <h1 className="text-2xl font-bold tracking-tight">Reporte de Vacaciones</h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Período de vacaciones vigente por empleado · Corte al {formatLongDate(getEcuadorTodayIso())}
            </p>
          </div>
          <p className="text-xs text-slate-600 text-right">
            {rows.length} {rows.length === 1 ? 'empleado' : 'empleados'}
            {filter !== 'todos' && ` · ${VACATION_STATUS_LABEL[filter as VacationReportStatus]}`}
          </p>
        </header>

        <p className="mb-4 text-xs text-muted-foreground print:hidden">
          Corte al {formatLongDate(getEcuadorTodayIso())} · {rows.length} {rows.length === 1 ? 'empleado' : 'empleados'}
        </p>

        {/* Resumen / filtros */}
        <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2 mb-5">
          {FILTERS.map((f) => {
            const n = f.value === 'todos' ? allRows.length : counts[f.value]
            const active = filter === f.value
            return (
              <Link
                key={f.value}
                href={f.value === 'todos' ? '/reports/vacations' : `/reports/vacations?estado=${f.value}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium',
                  active ? 'bg-foreground text-background border-foreground' : 'hover:bg-muted',
                  // En impresión solo se ve el resumen, sin aspecto de botón
                  'print:border-slate-300 print:bg-white print:text-black',
                  !active && 'print:hidden'
                )}
              >
                {f.label}
                <span className="tabular-nums font-semibold">{n}</span>
              </Link>
            )
          })}
        </nav>

        {rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No hay empleados en esta vista.</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-[10px] uppercase tracking-wide print:bg-slate-100">
                <th className="border border-slate-300 px-2 py-1.5 text-left">Empleado</th>
                <th className="border border-slate-300 px-2 py-1.5 text-left">Departamento</th>
                <th className="border border-slate-300 px-2 py-1.5 text-left">Ingreso</th>
                <th className="border border-slate-300 px-2 py-1.5 text-left">Período</th>
                <th className="border border-slate-300 px-2 py-1.5 text-right">Corresponden</th>
                <th className="border border-slate-300 px-2 py-1.5 text-right">Tomadas</th>
                <th className="border border-slate-300 px-2 py-1.5 text-right">Faltantes</th>
                <th className="border border-slate-300 px-2 py-1.5 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.employeeId}>
                  <td className="border border-slate-300 px-2 py-1.5">
                    <span className="font-semibold">{r.fullName}</span>
                    {r.nationalId && <span className="block text-[10px] text-muted-foreground print:text-slate-600">{r.nationalId}</span>}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5">{r.department}</td>
                  <td className="border border-slate-300 px-2 py-1.5 tabular-nums whitespace-nowrap">{shortDate(r.hireDate)}</td>
                  <td className="border border-slate-300 px-2 py-1.5 tabular-nums whitespace-nowrap">
                    {r.status === 'en_acumulacion'
                      ? 'Aún no cumple 1 año'
                      : `${shortDate(r.periodStart)} – ${shortDate(r.periodEnd)}`}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">
                    {r.status === 'en_acumulacion' ? '—' : fmtDays(r.entitledDays)}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{fmtDays(r.takenDays)}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums font-semibold">
                    {r.status === 'en_acumulacion' ? `${fmtDays(r.accruedDays)} acum.` : fmtDays(r.remainingDays)}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 text-center">
                    <span className={cn('inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold', STATUS_STYLE[r.status])}>
                      {VACATION_STATUS_LABEL[r.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={5} className="border border-slate-300 px-2 py-1.5 text-right">Totales de la vista</td>
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{fmtDays(totalTaken)}</td>
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{fmtDays(totalRemaining)}</td>
                <td className="border border-slate-300" />
              </tr>
            </tfoot>
          </table>
        )}

        <footer className="mt-5 space-y-1 text-[10px] leading-relaxed text-muted-foreground print:text-slate-600">
          <p>
            <strong>Corresponden:</strong> días de ley del último período ya cumplido (15 días, +1 por año desde el 6.º, máximo 30).{' '}
            <strong>Tomadas:</strong> vacaciones y permisos con cargo a vacaciones registrados o aprobados.{' '}
            <strong>Faltantes:</strong> días que aún puede tomar.
          </p>
          <p>
            <strong>Completas:</strong> ya tomó todos sus días · <strong>Parciales:</strong> tomó algunos y le faltan ·{' '}
            <strong>Sin tomar:</strong> no ha tomado ninguno · <strong>En acumulación:</strong> aún no cumple el primer año (se muestra el proporcional acumulado).
          </p>
        </footer>
      </div>
    </div>
  )
}
